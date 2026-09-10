/**
 * Single source of truth for files that optimize-assets.mjs generates from
 * branding/xrdocs-icon.png. These are gitignored: absent on a fresh checkout,
 * created by `npm run optimize-assets` (part of `npm run build`).
 *
 * check-links.mjs consults this list so it does not flag references to
 * generated-but-not-yet-built files as broken.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const publicDir = path.join(rootDir, 'public');

export const iconOutputs = [
  {
    path: path.join(publicDir, 'xrdocs-brand.png'),
    width: 64,
    format: 'png',
  },
  {
    path: path.join(publicDir, 'xrdocs-brand.webp'),
    width: 64,
    format: 'webp',
    options: { quality: 82 },
  },
  {
    path: path.join(publicDir, 'favicon-32.png'),
    width: 32,
    format: 'png',
  },
  {
    path: path.join(publicDir, 'apple-touch-icon.png'),
    width: 180,
    format: 'png',
  },
  {
    path: path.join(publicDir, 'xrdocs-og.png'),
    width: 512,
    format: 'png',
    options: { compressionLevel: 9, palette: true },
  },
  {
    path: path.join(publicDir, 'assets', 'examples', 'xrdocs-icon.png'),
    width: 256,
    format: 'png',
    options: { compressionLevel: 9, palette: true },
  },
];

/** Posix-style paths of generated files relative to public/ (e.g. "favicon-32.png"). */
export const generatedPublicRelativePaths = new Set(
  iconOutputs.map((output) => path.relative(publicDir, output.path).split(path.sep).join('/')),
);
