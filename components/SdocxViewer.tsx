'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  FileText,
  Info,
  PenLine,
  ExternalLink,
} from 'lucide-react';
import {
  openSdocx,
  type SdocxSession,
  type SdocxInspection,
  type SdocxLayoutPage,
} from '@/lib/sdocx-client';

export interface SdocxViewerProps {
  /** Google Drive file id of the `.sdocx` file. */
  fileId: string;
  /** 1-based page to show initially. */
  initialPage?: number;
  /** Called when the visible page changes. */
  onPageChange?: (page: number) => void;
  /** Called once the page count is known. */
  onPageCount?: (count: number) => void;
}

interface MediaInfoEntry {
  bindId: number;
  fileName: string;
}

type PageKind = 'ink' | 'pdf-backed' | 'blank';

/**
 * Parses `media/mediaInfo.dat` so a page's `media_id` can be resolved to the
 * file that holds it.
 */
function parseMediaInfo(bytes: Uint8Array): MediaInfoEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);

  // The manifest ends with either "EOF" (unversioned) or "EOFX" (versioned).
  const versioned = text.includes('EOFX');
  let offset = 0;
  if (versioned) offset += 4; // u32 format version
  if (offset + 2 > bytes.length) return [];

  const count = view.getUint16(offset, true);
  offset += 2;

  const entries: MediaInfoEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (offset + 6 > bytes.length) break;

    let recordSize = 0;
    if (versioned) {
      recordSize = view.getUint32(offset, true);
      offset += 4;
    }
    const recordStart = offset;

    const bindId = view.getUint32(offset, true);
    offset += 4;
    const nameLength = view.getUint16(offset, true);
    offset += 2;
    if (offset + nameLength * 2 > bytes.length) break;
    const fileName = new TextDecoder('utf-16le').decode(
      bytes.subarray(offset, offset + nameLength * 2)
    );
    offset += nameLength * 2;

    // The hash may be a 64 byte hex digest or a u16 zero-length placeholder.
    // Rather than guessing, derive its size from the record length so the
    // field boundaries are always exact.
    const FIXED_TAIL = 2 /* refcount */ + 8 /* modified time */ + 1 /* attached */;
    let hashLength: number;
    if (versioned && recordSize > 0) {
      const used = 4 /* bind */ + 2 /* name length */ + nameLength * 2;
      hashLength = recordSize - used - FIXED_TAIL;
      if (hashLength !== 64 && hashLength !== 2) {
        // Unexpected layout: fall back to the 64 byte digest.
        hashLength = 64;
      }
    } else {
      hashLength = 64;
    }
    offset += hashLength + FIXED_TAIL;

    entries.push({ bindId, fileName });

    if (versioned && recordSize > 0) {
      offset = recordStart + recordSize;
    }
  }
  return entries;
}

export function SdocxViewer({
  fileId,
  initialPage = 1,
  onPageChange,
  onPageCount,
}: SdocxViewerProps) {
  const [session, setSession] = useState<SdocxSession | null>(null);
  const [inspection, setInspection] = useState<SdocxInspection | null>(null);
  const [media, setMedia] = useState<MediaInfoEntry[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(Math.max(1, initialPage));
  const [svg, setSvg] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<import('pdfjs-dist').PDFDocumentProxy | null>(null);
  const pdfTaskRef = useRef<import('pdfjs-dist').PDFDocumentLoadingTask | null>(null);
  const pdfRenderTaskRef = useRef<{ cancel: () => void; promise: Promise<void> } | null>(null);

  /* ---------------- load and parse the note ---------------- */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatus('loading');
      setErrorMsg(null);
      try {
        const res = await fetch(`/api/drive/sdocx/${encodeURIComponent(fileId)}/bundle`, {
          headers: { 'X-Notevault-Id-Token': await getIdTokenHeader() },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || 'Could not load this Samsung Note.');
        }

        const buffer = new Uint8Array(await res.arrayBuffer());
        if (cancelled) return;

        const s = await openSdocx(buffer);
        if (cancelled) {
          s.dispose();
          return;
        }

        const info = s.inspection();
        setSession(s);
        setInspection(info);
        setPageCount(s.page_count);
        onPageCount?.(s.page_count);

        // Resolve the media manifest so a page's media_id can be mapped to a
        // file inside the archive.
        try {
          const { unzipSync } = await import('fflate');
          const files = unzipSync(buffer);
          const mediaBytes = files['media/mediaInfo.dat'];
          if (mediaBytes) {
            setMedia(parseMediaInfo(mediaBytes));
          }
        } catch (error) {
          console.warn('[sdocx] could not read the media manifest:', error);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('[sdocx] failed to open:', error);
        setStatus('error');
        setErrorMsg(
          error instanceof Error ? error.message : 'Could not open this Samsung Note.'
        );
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  useEffect(() => {
    return () => {
      session?.dispose();
      void pdfTaskRef.current?.destroy();
    };
  }, [session]);

  /* ---------------- work out what each page is ---------------- */
  const layoutPages = useMemo<SdocxLayoutPage[]>(
    () => inspection?.layout?.pages ?? [],
    [inspection]
  );

  const pageInfo = useCallback(
    (pageNumber: number) => {
      const index = pageNumber - 1;
      return layoutPages.find((p) => p.source_page_index === index) ?? layoutPages[index];
    },
    [layoutPages]
  );

  const currentPageInfo = pageInfo(currentPage);

  const pageKind: PageKind = useMemo(() => {
    const pdfPaper = currentPageInfo?.page?.background?.pdf_paper;
    if (pdfPaper && pdfPaper.length > 0) return 'pdf-backed';
    const objects = currentPageInfo?.objects ?? [];
    if (objects.length === 0) return 'blank';
    return 'ink';
  }, [currentPageInfo]);

  const pdfMedia = useMemo(() => {
    const pdfPaper = currentPageInfo?.page?.background?.pdf_paper;
    if (!pdfPaper || pdfPaper.length === 0) return null;
    const entry = media.find((m) => m.bindId === pdfPaper[0].media_id);
    if (!entry) return null;
    return { path: `media/${entry.fileName}`, pageIndex: pdfPaper[0].page_index ?? 0 };
  }, [currentPageInfo, media]);

  /* ---------------- render the current page ---------------- */
  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    (async () => {
      if (pageKind !== 'pdf-backed') {
        try {
          const markup = session.render_svg(currentPage - 1, 'light');
          if (!cancelled) setSvg(markup);
        } catch (error) {
          console.error('[sdocx] render_svg failed:', error);
          if (!cancelled) setSvg(null);
        }
        return;
      }

      // PDF-backed page: show the embedded PDF's page through pdf.js.
      if (!pdfMedia) {
        if (!cancelled) setSvg(null);
        return;
      }

      try {
        const { openPdfFromUrl } = await import('@/lib/pdfjs');
        if (!pdfDocRef.current) {
          const opened = await openPdfFromUrl(
            `/api/drive/sdocx/${encodeURIComponent(fileId)}/media?path=${encodeURIComponent(
              pdfMedia.path
            )}`,
            { Authorization: `Bearer ${await getGoogleToken()}` }
          );
          if (cancelled) {
            void opened.loadingTask.destroy();
            return;
          }
          pdfDocRef.current = opened.doc;
          pdfTaskRef.current = opened.loadingTask;
        }

        const doc = pdfDocRef.current;
        const page = await doc.getPage(pdfMedia.pageIndex + 1);
        if (cancelled || !pdfCanvasRef.current) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: 1.2 * dpr });
        const canvas = pdfCanvasRef.current;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${Math.ceil(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.ceil(viewport.height / dpr)}px`;

        pdfRenderTaskRef.current?.cancel();
        const task = page.render({ canvas, viewport, background: '#ffffff' });
        pdfRenderTaskRef.current = task;
        await task.promise;
      } catch (error) {
        console.error('[sdocx] pdf-backed page render failed:', error);
      }
    })();

    return () => {
      cancelled = true;
      pdfRenderTaskRef.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, currentPage, pageKind, pdfMedia?.path, fileId]);

  /* ---------------- report progress ---------------- */
  useEffect(() => {
    if (status === 'ready') onPageChange?.(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, status]);

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.min(Math.max(1, page), Math.max(1, pageCount)));
      setSvg(null);
    },
    [pageCount]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (e.key === 'ArrowLeft') goToPage(currentPage - 1);
      if (e.key === 'ArrowRight') goToPage(currentPage + 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentPage, goToPage]);

  const diagnostics = inspection?.report?.diagnostics ?? [];
  const templateWarnings = diagnostics.filter((d) => d.code === 'UnsupportedPageTemplate');

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-full text-zinc-500">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-xs font-mono">Reading Samsung Note…</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-full px-6 text-center text-zinc-500">
        <AlertCircle className="w-6 h-6 text-red-500" />
        <p className="text-xs max-w-sm">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-100 dark:bg-zinc-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous page"
            className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 text-xs font-mono tabular-nums text-zinc-600 dark:text-zinc-300">
            <input
              type="number"
              min={1}
              max={Math.max(1, pageCount)}
              value={currentPage}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v)) goToPage(v);
              }}
              aria-label="Current page number"
              className="w-12 text-center px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700 text-xs"
            />
            <span className="text-zinc-400">/ {pageCount || '–'}</span>
          </div>
          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= pageCount}
            aria-label="Next page"
            className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          {pageKind === 'pdf-backed' && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400">
              <FileText className="w-3 h-3" />
              PDF-backed page
            </span>
          )}
          {pageKind === 'ink' && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <PenLine className="w-3 h-3" />
              Handwriting
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            aria-label="Toggle note information"
            className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Page area */}
      <div className="relative flex-1 overflow-auto p-4">
        {pageKind === 'pdf-backed' && (
          <div className="flex justify-center">
            <canvas ref={pdfCanvasRef} className="bg-white shadow-lg rounded-sm max-w-full" />
          </div>
        )}

        {pageKind !== 'pdf-backed' && svg && (
          <div
            className="mx-auto bg-white shadow-lg rounded-sm overflow-hidden max-w-full [&>svg]:max-w-full [&>svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}

        {pageKind !== 'pdf-backed' && !svg && (
          <div className="flex flex-col items-center justify-center gap-2 h-full text-zinc-400">
            <PenLine className="w-5 h-5" />
            <span className="text-xs">This page has no renderable content.</span>
          </div>
        )}

        {showInfo && (
          <div className="absolute inset-x-0 bottom-0 max-h-56 overflow-auto bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-t border-zinc-200 dark:border-zinc-800 p-3 text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1">
            <p>
              <strong>{pageCount}</strong> pages ·{' '}
              <strong>{diagnostics.length}</strong> parser diagnostics
            </p>
            {templateWarnings.length > 0 && (
              <p>
                {templateWarnings.length} of {pageCount} pages use a PDF page template, which the
                renderer draws from the embedded PDF.
              </p>
            )}
            {pdfMedia && (
              <p className="font-mono break-all">
                Embedded PDF: {pdfMedia.path} (page {pdfMedia.pageIndex + 1})
              </p>
            )}
            {diagnostics.length > 0 && (
              <details>
                <summary className="cursor-pointer">All diagnostics</summary>
                <ul className="mt-1 space-y-0.5">
                  {diagnostics.slice(0, 40).map((d, i) => (
                    <li key={i} className="font-mono">
                      [{d.severity}] {d.code}: {d.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* Helpers that need browser-only APIs kept out of the component body. */
async function getIdTokenHeader(): Promise<string> {
  const { getIdToken } = await import('@/lib/client-auth');
  return (await getIdToken()) ?? '';
}

async function getGoogleToken(): Promise<string> {
  const { getAccessToken } = await import('@/lib/firebase');
  return (await getAccessToken()) ?? '';
}

export { ExternalLink };
