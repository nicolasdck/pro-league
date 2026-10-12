// Generates the PWA/home-screen icons and favicon from
// public/new-app-icon.png. That source has its own rounded corners baked in
// (transparent outside the rounded shape) rather than being truly full-bleed
// — left as-is, every OS that applies its own icon mask (iOS flattening the
// transparency to white, Android's adaptive-icon backdrop for non-maskable
// icons) ends up showing that flattened/backdrop color in a ring between the
// source's own rounding and the OS's rounding, i.e. exactly the white border
// users see around the installed icon. So the source is first cropped in by
// SAFE_CROP_RATIO (empirically the smallest centered square with zero
// transparent/antialiased pixels at its border, see scripts/measure, +margin)
// before resizing, which discards the baked-in rounded corners and leaves a
// genuinely edge-to-edge square for the OS to mask on its own.
// Re-run after replacing the source image file.
//
// Usage: npm run icon:generate

import sharp from 'sharp';
import path from 'node:path';

const SOURCE = path.resolve(import.meta.dirname, '../public/new-app-icon.png');
const OUT_DIR = path.resolve(import.meta.dirname, '../public');
const SAFE_CROP_RATIO = 0.87; // keeps the centered 87% of the source (measured safe margin ~6.5%, +0.5% buffer)

async function makeIcon(canvasSize, outFile) {
  const { width, height } = await sharp(SOURCE).metadata();
  const cropSize = Math.round(Math.min(width, height) * SAFE_CROP_RATIO);
  const left = Math.round((width - cropSize) / 2);
  const top = Math.round((height - cropSize) / 2);

  await sharp(SOURCE)
    .extract({ left, top, width: cropSize, height: cropSize })
    .flatten({ background: '#1f2937' }) // belt-and-suspenders: fill any stray edge pixel the crop didn't catch instead of leaving alpha
    .resize({ width: canvasSize, height: canvasSize, fit: 'cover' })
    .png()
    .toFile(path.join(OUT_DIR, outFile));

  console.log(`${outFile} (${canvasSize}x${canvasSize})`);
}

await makeIcon(192, 'icon-192.png');
await makeIcon(512, 'icon-512.png');
await makeIcon(180, 'apple-touch-icon.png');
await makeIcon(48, 'favicon.png');
