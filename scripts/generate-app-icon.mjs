// Generates the PWA/home-screen icons from public/pro-league-logo.jpg:
// the logo large on a square white canvas with a slight white border.
// Re-run after replacing the source logo file.
//
// Usage: npm run icon:generate

import sharp from 'sharp';
import path from 'node:path';

const SOURCE = path.resolve(import.meta.dirname, '../public/pro-league-logo.jpg');
const OUT_DIR = path.resolve(import.meta.dirname, '../public');

// Logo fills ~90% of the canvas, leaving a slight white border all around.
const LOGO_SCALE = 0.9;

async function makeIcon(canvasSize, outFile) {
  const logoSize = Math.round(canvasSize * LOGO_SCALE);
  const logo = await sharp(SOURCE)
    .resize({ width: logoSize, height: logoSize, fit: 'inside' })
    .toBuffer();
  const { width, height } = await sharp(logo).metadata();

  await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: logo, left: Math.round((canvasSize - width) / 2), top: Math.round((canvasSize - height) / 2) }])
    .png()
    .toFile(path.join(OUT_DIR, outFile));

  console.log(`${outFile} (${canvasSize}x${canvasSize})`);
}

await makeIcon(192, 'icon-192.png');
await makeIcon(512, 'icon-512.png');
await makeIcon(180, 'apple-touch-icon.png');
