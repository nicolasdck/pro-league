// Generates public/team-logos-small/ from the existing public/team-logos/
// masters (no network calls — resizes the already-localized 128px WebP
// files) and repoints teams.logo at the new path. The largest on-screen use
// of a team logo is h-6/w-6 (24px, match cards) — 64px covers that crisply
// up to ~2.5x pixel density without shipping 128px everywhere it's actually
// shown at 14-24px.
//
// Usage: npm run logos:shrink

import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SMALL_DIMENSION = 64;
const WEBP_QUALITY = 82;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const sourceDir = path.resolve(import.meta.dirname, '../public/team-logos');
const outDir = path.resolve(import.meta.dirname, '../public/team-logos-small');
await mkdir(outDir, { recursive: true });

const { data: teams, error } = await supabase.from('teams').select('id, name, logo');
if (error) throw error;

let processed = 0;
for (const team of teams) {
  if (!team.logo || !team.logo.startsWith('/team-logos/')) {
    console.warn(`Skipping ${team.name}: logo isn't a localized /team-logos/ path (${team.logo})`);
    continue;
  }

  const sourceBytes = await readFile(path.join(sourceDir, path.basename(team.logo)));
  const webpBuffer = await sharp(sourceBytes)
    .resize({ width: SMALL_DIMENSION, height: SMALL_DIMENSION, fit: 'inside' })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  const localPath = `/team-logos-small/${team.id}.webp`;
  await writeFile(path.join(outDir, `${team.id}.webp`), webpBuffer);

  const { error: updateError } = await supabase.from('teams').update({ logo: localPath }).eq('id', team.id);
  if (updateError) throw updateError;

  console.log(`${team.name} -> ${localPath} (${(webpBuffer.length / 1024).toFixed(1)} KB)`);
  processed += 1;
}

console.log(`Done. ${processed} logo(s) shrunk.`);
