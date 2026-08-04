// Generates the PWA/home-screen icons and favicon from
// public/new-app-icon.png — already a full-bleed square icon design, so it's
// just resized to each target size with no extra padding/canvas.
// Re-run after replacing the source image file.
//
// Usage: npm run icon:generate

import sharp from 'sharp';
import path from 'node:path';

const SOURCE = path.resolve(import.meta.dirname, '../public/new-app-icon.png');
const OUT_DIR = path.resolve(import.meta.dirname, '../public');

async function makeIcon(canvasSize, outFile) {
  await sharp(SOURCE)
    .resize({ width: canvasSize, height: canvasSize, fit: 'cover' })
    .png()
    .toFile(path.join(OUT_DIR, outFile));

  console.log(`${outFile} (${canvasSize}x${canvasSize})`);
}

await makeIcon(192, 'icon-192.png');
await makeIcon(512, 'icon-512.png');
await makeIcon(180, 'apple-touch-icon.png');
await makeIcon(48, 'favicon.png');
