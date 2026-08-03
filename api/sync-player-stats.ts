import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { D1_CLUB_ALIASES } from '../src/lib/d1ClubAliases.js';
import { fetchPlayerStats, type StatKind } from '../src/lib/footmercatoStatsScraper.js';

const KINDS: StatKind[] = ['goals', 'assists'];
const TOP_N = 20;

interface PlayerStatRowInsert {
  id: string;
  kind: StatKind;
  rank: number;
  player_name: string;
  player_slug: string;
  player_image: string | null;
  team_id: number | null;
  team_name: string;
  position: string | null;
  value: number;
  updated_at: string;
}

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

async function logSync(
  supabase: SupabaseClient,
  requestsUsed: number,
  success: boolean,
  message?: string,
): Promise<void> {
  await supabase.from('sync_logs').insert({ resource: 'player_stats', requests_used: requestsUsed, success, message });
}

async function syncPlayerStats(supabase: SupabaseClient): Promise<{ requestsUsed: number; itemsFound: number }> {
  let requestsUsed = 0;
  let itemsFound = 0;
  const now = new Date().toISOString();

  for (const kind of KINDS) {
    const rows = (await fetchPlayerStats(kind)).slice(0, TOP_N);
    requestsUsed += 1;

    const inserts: PlayerStatRowInsert[] = rows.map((row) => ({
      id: `${kind}:${row.playerSlug}`,
      kind,
      rank: row.rank,
      player_name: row.playerName,
      player_slug: row.playerSlug,
      player_image: row.playerImage,
      team_id: D1_CLUB_ALIASES[row.clubName] ?? null,
      team_name: row.clubName,
      position: row.position,
      value: row.value,
      updated_at: now,
    }));

    // Ranks reshuffle every matchday, so the table is wiped per `kind`
    // and reinserted fresh rather than upserted — a player who drops out
    // of the top N must disappear, not linger with a stale rank.
    const { error: deleteError } = await supabase.from('player_stats').delete().eq('kind', kind);
    if (deleteError) throw deleteError;

    if (inserts.length > 0) {
      const { error: insertError } = await supabase.from('player_stats').insert(inserts);
      if (insertError) throw insertError;
    }

    itemsFound += inserts.length;
  }

  return { requestsUsed, itemsFound };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret =
    (req.query.secret as string | undefined) ?? req.headers.authorization?.replace('Bearer ', '');
  if (cronSecret && providedSecret !== cronSecret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
    return;
  }

  try {
    const { requestsUsed, itemsFound } = await syncPlayerStats(supabase);
    await logSync(supabase, requestsUsed, true, `${itemsFound} row(s) found`);
    res.status(200).json({ success: true, requestsUsed, itemsFound });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logSync(supabase, 0, false, message).catch(() => undefined);
    res.status(500).json({ success: false, error: message });
  }
}
