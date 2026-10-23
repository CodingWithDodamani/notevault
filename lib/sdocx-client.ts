/**
 * Client-side loader for the Samsung Notes `.sdocx` renderer.
 *
 * The renderer is a Rust crate compiled to WebAssembly. It is served as a
 * static ES module plus a `.wasm` binary from /public/sdocx rather than being
 * bundled, which keeps the 9.6 MB binary out of the JavaScript bundle and
 * means it is only downloaded when someone actually opens a Samsung Note.
 */

export type SdocxColorMode = 'auto' | 'light' | 'dark';

export interface SdocxRenderedPage {
  /** Zero-based page index, as the renderer counts them. */
  index: number;
  /** Vector SVG markup for the page. */
  svg: string;
}

export interface SdocxPdfPaper {
  media_id: number;
  page_index: number;
  rectangle?: unknown;
}

export interface SdocxPageInfo {
  uuid: string;
  width: number;
  height: number;
  template?: { id: number; source?: Record<string, unknown> } | null;
  background?: {
    pdf_paper?: SdocxPdfPaper[];
    color_argb?: number;
    width?: number;
  } | null;
}

export interface SdocxLayoutPage {
  source_page_index: number;
  page: SdocxPageInfo;
  objects?: unknown[];
}

export interface SdocxInspection {
  document?: { pages?: SdocxPageInfo[]; metadata?: Record<string, unknown> };
  layout?: {
    pages?: SdocxLayoutPage[];
    stored_page_count?: number;
    omitted_trailing_blank_page?: boolean;
  };
  page_manifest?: unknown[];
  report?: {
    diagnostics?: Array<{
      severity: string;
      code: string;
      message: string;
      archive_entry?: string;
    }>;
  };
}

export interface SdocxSession {
  readonly page_count: number;
  render_svg(page_index: number, color_mode: SdocxColorMode): string;
  render_pdf(page_index: number | null, color_mode: SdocxColorMode): Uint8Array;
  inspection(): SdocxInspection;
  dispose(): void;
}

interface SdocxModule {
  default: (input: { module_or_path: string } | string) => Promise<unknown>;
  DocumentSession: new (bytes: Uint8Array) => SdocxSession;
}

let modulePromise: Promise<SdocxModule> | null = null;

/**
 * The module URL is held in a variable so the bundler does not try to resolve
 * it at build time. `webpackIgnore` keeps it as a runtime import.
 */
const SDOCX_MODULE_URL = '/sdocx/sdocx.js';

async function loadSdocxModule(): Promise<SdocxModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const mod = (await import(
        /* webpackIgnore: true */ SDOCX_MODULE_URL
      )) as unknown as SdocxModule;
      await mod.default({ module_or_path: '/sdocx/sdocx_bg.wasm' });
      return mod;
    })();
  }
  return modulePromise;
}

export async function openSdocx(bytes: Uint8Array): Promise<SdocxSession> {
  const mod = await loadSdocxModule();
  return new mod.DocumentSession(bytes);
}
