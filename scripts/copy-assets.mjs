/**
 * Copies the runtime assets that must be served as static files rather than
 * bundled:
 *
 *   public/pdfjs/  - the pdf.js worker plus the character maps, standard
 *                    fonts and wasm decoders it needs at runtime
 *   public/sdocx/  - the Samsung Notes WASM parser and its glue module
 *
 * Both are loaded by URL at runtime, which keeps them out of the JavaScript
 * bundle and out of the server build.
 *
 * IMPORTANT for deployment: `output: 'standalone'` does NOT include `public/`.
 * The container image must copy it explicitly, e.g.
 *   COPY --from=builder /app/public ./public
 */
import { cp, mkdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = process.cwd();

const targets = [
  {
    from: path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'build', 'pdf.worker.min.mjs'),
    to: path.join(root, 'public', 'pdfjs', 'pdf.worker.min.mjs'),
  },
  {
    from: path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'cmaps'),
    to: path.join(root, 'public', 'pdfjs', 'cmaps'),
  },
  {
    from: path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts'),
    to: path.join(root, 'public', 'pdfjs', 'standard_fonts'),
  },
  {
    from: path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'wasm'),
    to: path.join(root, 'public', 'pdfjs', 'wasm'),
  },
  {
    from: path.join(path.dirname(require.resolve('@twango/sdocx/package.json')), 'sdocx.js'),
    to: path.join(root, 'public', 'sdocx', 'sdocx.js'),
  },
  {
    from: path.join(path.dirname(require.resolve('@twango/sdocx/package.json')), 'sdocx_bg.wasm'),
    to: path.join(root, 'public', 'sdocx', 'sdocx_bg.wasm'),
  },
];

let copied = 0;
for (const { from, to } of targets) {
  try {
    await stat(from);
  } catch {
    console.warn(`[copy-assets] skipped (not installed): ${path.relative(root, from)}`);
    continue;
  }
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, { recursive: true, force: true });
  copied += 1;
}

console.log(`[copy-assets] prepared ${copied}/${targets.length} runtime asset(s) in public/`);
