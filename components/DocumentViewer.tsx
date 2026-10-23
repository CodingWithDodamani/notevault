'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  X,
  Loader2,
  AlertCircle,
  PanelLeftClose,
} from 'lucide-react';
import { openPdfFromUrl, extractPageText, type PdfTextPage } from '@/lib/pdfjs';

export interface DocumentViewerProps {
  /** Google Drive file id of the PDF to render. */
  fileId: string;
  /** Google OAuth access token, forwarded to the streaming proxy. */
  accessToken: string;
  /** 1-based page to show. */
  initialPage?: number;
  /** Called whenever the visible page changes, so reading progress can be persisted. */
  onPageChange?: (page: number) => void;
  /** Called once the total page count is known. */
  onPageCount?: (count: number) => void;
  /** Called when the user asks to open the file in Google Drive instead. */
  onOpenInDrive?: () => void;
  className?: string;
}

interface SearchMatch {
  page: number;
  index: number;
}

const ZOOM_STEPS = [0.6, 0.8, 1, 1.25, 1.5, 2, 2.5, 3];

export function DocumentViewer({
  fileId,
  accessToken,
  initialPage = 1,
  onPageChange,
  onPageCount,
  onOpenInDrive,
  className = '',
}: DocumentViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void; promise: Promise<void> } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [doc, setDoc] = useState<import('pdfjs-dist').PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(Math.max(1, initialPage));
  const [scaleIndex, setScaleIndex] = useState(2);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [textIndex, setTextIndex] = useState<PdfTextPage[] | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [matchIndex, setMatchIndex] = useState(0);

  const scale = ZOOM_STEPS[scaleIndex];

  /* ---------------- load the document ---------------- */
  useEffect(() => {
    let cancelled = false;
    let loadingTask: import('pdfjs-dist').PDFDocumentLoadingTask | null = null;

    (async () => {
      setStatus('loading');
      setErrorMsg(null);
      try {
        const opened = await openPdfFromUrl(
          `/api/drive/file/${encodeURIComponent(fileId)}`,
          { Authorization: `Bearer ${accessToken}` }
        );
        loadingTask = opened.loadingTask;
        if (cancelled) {
          void opened.loadingTask.destroy();
          return;
        }
        setDoc(opened.doc);
        setNumPages(opened.numPages);
        setStatus('ready');
        onPageCount?.(opened.numPages);
      } catch (error) {
        if (cancelled) return;
        console.error('[viewer] failed to open document:', error);
        setStatus('error');
        setErrorMsg(
          error instanceof Error
            ? error.message
            : 'Could not load this document from Google Drive.'
        );
      }
    })();

    return () => {
      cancelled = true;
      void loadingTask?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, accessToken]);

  /* ---------------- render the current page ---------------- */
  useEffect(() => {
    if (!doc || !canvasRef.current) return;
    const canvas = canvasRef.current;
    let cancelled = false;

    (async () => {
      setIsRendering(true);
      try {
        const page = await doc.getPage(currentPage);
        if (cancelled) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: scale * dpr });

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${Math.ceil(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.ceil(viewport.height / dpr)}px`;

        renderTaskRef.current?.cancel();
        const task = page.render({ canvas, viewport, background: '#ffffff' });
        renderTaskRef.current = task;

        await task.promise;
      } catch (error) {
        // A cancelled render is the normal path when navigating quickly.
        const name = (error as { name?: string })?.name;
        if (name !== 'RenderingCancelledException' && name !== 'AbortException') {
          console.error('[viewer] render failed:', error);
        }
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [doc, currentPage, scale]);

  /* ---------------- report the visible page ---------------- */
  useEffect(() => {
    if (status === 'ready') {
      onPageChange?.(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, status]);

  /* ---------------- navigation ---------------- */
  const goToPage = useCallback(
    (page: number) => {
      const target = Math.min(Math.max(1, page), Math.max(1, numPages));
      setCurrentPage(target);
      scrollRef.current?.scrollTo({ top: 0 });
    },
    [numPages]
  );

  const goToMatch = useCallback(
    (direction: 1 | -1) => {
      if (matches.length === 0) return;
      const next = (matchIndex + direction + matches.length) % matches.length;
      setMatchIndex(next);
      goToPage(matches[next].page);
    },
    [matches, matchIndex, goToPage]
  );

  /* ---------------- search ---------------- */
  const runSearch = useCallback(
    async (term: string) => {
      const needle = term.trim().toLowerCase();
      if (!doc) return;
      if (!needle) {
        setMatches([]);
        return;
      }
      setIsIndexing(true);
      try {
        const index = textIndex ?? (await extractPageText(doc));
        if (!textIndex) setTextIndex(index);
        const found: SearchMatch[] = [];
        for (const page of index) {
          const haystack = page.text.toLowerCase();
          let at = haystack.indexOf(needle);
          while (at !== -1) {
            found.push({ page: page.pageNumber, index: at });
            at = haystack.indexOf(needle, at + needle.length);
            if (found.length >= 500) break;
          }
          if (found.length >= 500) break;
        }
        setMatches(found);
        setMatchIndex(0);
        if (found.length > 0) {
          goToPage(found[0].page);
        }
      } catch (error) {
        console.error('[viewer] search failed:', error);
      } finally {
        setIsIndexing(false);
      }
    },
    [doc, textIndex, goToPage]
  );

  /* ---------------- keyboard shortcuts ---------------- */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) {
        if (e.key === 'Escape') target.blur();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPage(currentPage - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToPage(currentPage + 1);
      } else if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === '+' || e.key === '=') {
        setScaleIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1));
      } else if (e.key === '-') {
        setScaleIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentPage, goToPage]);

  return (
    <div className={`flex flex-col h-full bg-zinc-100 dark:bg-zinc-950 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1 || status !== 'ready'}
            aria-label="Previous page"
            className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 text-xs font-mono tabular-nums text-zinc-600 dark:text-zinc-300">
            <input
              type="number"
              min={1}
              max={Math.max(1, numPages)}
              value={currentPage}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v)) goToPage(v);
              }}
              aria-label="Current page number"
              className="w-12 text-center px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700 text-xs"
            />
            <span className="text-zinc-400">/ {numPages || '–'}</span>
          </div>

          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= numPages || status !== 'ready'}
            aria-label="Next page"
            className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          {searchOpen ? (
            <div className="flex items-center gap-1">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2 top-1.5 text-zinc-400" />
                <input
                  autoFocus
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (matches.length > 0) {
                        goToMatch(e.shiftKey ? -1 : 1);
                      } else {
                        void runSearch(searchTerm);
                      }
                    }
                    if (e.key === 'Escape') {
                      setSearchOpen(false);
                      setSearchTerm('');
                      setMatches([]);
                    }
                  }}
                  placeholder="Find in document"
                  aria-label="Find in document"
                  className="w-40 sm:w-56 pl-7 pr-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
                />
              </div>
              {matches.length > 0 && (
                <span className="text-[10px] font-mono tabular-nums text-zinc-500 whitespace-nowrap">
                  {matchIndex + 1}/{matches.length}
                </span>
              )}
              {matches.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => goToMatch(-1)}
                    aria-label="Previous match"
                    className="p-1 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => goToMatch(1)}
                    aria-label="Next match"
                    className="p-1 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              {isIndexing && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
              )}
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  setSearchTerm('');
                  setMatches([]);
                }}
                aria-label="Close search"
                className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search in document"
              className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-0.5 ml-1">
            <button
              type="button"
              onClick={() => setScaleIndex((i) => Math.max(0, i - 1))}
              disabled={scaleIndex === 0}
              aria-label="Zoom out"
              className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-mono tabular-nums text-zinc-500 w-9 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScaleIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
              disabled={scaleIndex === ZOOM_STEPS.length - 1}
              aria-label="Zoom in"
              className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {onOpenInDrive && (
            <button
              type="button"
              onClick={onOpenInDrive}
              aria-label="Open in Google Drive"
              className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Canvas area */}
      <div ref={scrollRef} className="relative flex-1 overflow-auto p-4">
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-xs font-mono">Loading document…</span>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-zinc-500">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <p className="text-xs max-w-sm">{errorMsg}</p>
          </div>
        )}

        {status === 'ready' && (
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              className="bg-white shadow-lg dark:shadow-black/40 rounded-sm max-w-full"
            />
          </div>
        )}

        {isRendering && status === 'ready' && (
          <div className="absolute top-2 right-3">
            <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
          </div>
        )}
      </div>
    </div>
  );
}

export { PanelLeftClose };
