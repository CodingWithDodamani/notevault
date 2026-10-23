'use client';

/**
 * Lazy loader for pdf.js.
 *
 * pdf.js must never be evaluated on the server: it touches browser globals at
 * module scope and would break the Next.js prerender of a client component.
 * The import therefore happens inside an effect, at runtime, and the module is
 * cached so it is only fetched once.
 *
 * The worker and the supporting asset directories are served as static files
 * from /public by scripts/copy-assets.mjs. Serving them from public rather
 * than bundling them keeps the build free of wasm/asset-module edge cases and
 * works identically under webpack and Turbopack.
 */

export interface PdfTextPage {
  pageNumber: number;
  text: string;
}

type PdfjsModule = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfjsModule> | null = null;

export async function getPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      return mod;
    });
  }
  return pdfjsPromise;
}

export interface OpenedPdf {
  doc: import('pdfjs-dist').PDFDocumentProxy;
  loadingTask: import('pdfjs-dist').PDFDocumentLoadingTask;
  numPages: number;
}

/**
 * Opens a PDF from a URL, letting pdf.js issue its own Range requests through
 * our streaming proxy. This is what makes large documents load incrementally.
 */
export async function openPdfFromUrl(
  url: string,
  httpHeaders: Record<string, string>
): Promise<OpenedPdf> {
  const pdfjs = await getPdfjs();

  const loadingTask = pdfjs.getDocument({
    url,
    httpHeaders,
    withCredentials: false,
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
    wasmUrl: '/pdfjs/wasm/',
    useWasm: true,
  });

  const doc = await loadingTask.promise;
  return { doc, loadingTask, numPages: doc.numPages };
}

/**
 * Extracts the plain text of every page. Used to build the in-document search
 * index.
 */
export async function extractPageText(doc: import('pdfjs-dist').PDFDocumentProxy): Promise<PdfTextPage[]> {
  const pages: PdfTextPage[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : ''))
      .join('');
    pages.push({ pageNumber, text });
  }
  return pages;
}
