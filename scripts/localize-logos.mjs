// Downloads team badges into public/team-logos/, resizes and re-encodes them
// as small WebP files, and repoints teams.logo to that local path — so the
// app never hotlinks a third-party CDN and never ships multi-hundred-KB
// full-resolution badges for a 24-48px UI element.
// Idempotent: re-running only touches teams that aren't already a local
// .webp yet (a fresh external URL after promotion/relegation, or a leftover
// unoptimized local file from before this script resized things).
//
// Usage: npm run logos:localize

import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const MAX_DIMENSION = 128; // covers up to ~3x pixel density for the largest on-screen use (h-8/w-8)
const WEBP_QUALITY = 82;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const outDir = path.resolve(import.meta.dirname, '../public/team-logos');
await mkdir(outDir, { recursive: true });

const { data: teams, error } = await supabase.from('teams').select('id, name, logo');
if (error) throw error;

async function loadSourceBytes(team) {
  if (team.logo.startsWith('http')) {
    const response = await fetch(team.logo);
    if (!response.ok) throw new Error(`fetch failed (${response.status})`);
    return Buffer.from(await response.arrayBuffer());
  }
  // Leftover unoptimized local file (e.g. the old .png path) — read it directly, no network call.
  const { readFile } = await import('node:fs/promises');
  return readFile(path.join(outDir, path.basename(team.logo)));
}

let processed = 0;
for (const team of teams) {
  if (!team.logo || team.logo.endsWith('.webp')) continue;

  let sourceBytes;
  try {
    sourceBytes = await loadSourceBytes(team);
  } catch (err) {
    console.warn(`Skipping ${team.name}: ${err.message}`);
    continue;
  }

  const webpBuffer = await sharp(sourceBytes)
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  const localPath = `/team-logos/${team.id}.webp`;
  await writeFile(path.join(outDir, `${team.id}.webp`), webpBuffer);

  if (team.logo.startsWith('/team-logos/') && team.logo !== localPath) {
    await unlink(path.join(outDir, path.basename(team.logo))).catch(() => undefined);
  }

  const { error: updateError } = await supabase
    .from('teams')
    .update({ logo: localPath })
    .eq('id', team.id);
  if (updateError) throw updateError;

  console.log(`${team.name} -> ${localPath} (${(webpBuffer.length / 1024).toFixed(1)} KB)`);
  processed += 1;
}

console.log(`Done. ${processed} logo(s) processed.`);
