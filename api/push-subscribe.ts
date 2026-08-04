import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Client-facing (no CRON_SECRET — any browser calls this directly, see
// src/hooks/usePushNotifications.ts). Writes go through the service role
// key here rather than letting the client write to Supabase directly with
// the anon key, since push_subscriptions has no RLS policies at all (see
// supabase/schema.sql) — this endpoint is the only writer, so input
// validation happens once, in one place.
const PREF_VALUES = ['none', 'all', 'favorite'] as const;
type PrefValue = (typeof PREF_VALUES)[number];

function isPrefValue(value: unknown): value is PrefValue {
  return typeof value === 'string' && (PREF_VALUES as readonly string[]).includes(value);
}

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
    return;
  }

  if (req.method === 'GET') {
    const endpoint = req.query.endpoint;
    if (typeof endpoint !== 'string' || !endpoint) {
      res.status(400).json({ success: false, error: 'Missing endpoint' });
      return;
    }
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('favorite_team_id, pref_league, pref_cup, pref_cl, pref_el, pref_ecl')
      .eq('endpoint', endpoint)
      .maybeSingle();
    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }
    res.status(200).json({ success: true, subscription: data });
    return;
  }

  if (req.method === 'DELETE') {
    const endpoint = typeof req.body === 'object' && req.body ? (req.body as { endpoint?: unknown }).endpoint : undefined;
    if (typeof endpoint !== 'string' || !endpoint) {
      res.status(400).json({ success: false, error: 'Missing endpoint' });
      return;
    }
    const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }
    res.status(200).json({ success: true });
    return;
  }

  if (req.method === 'POST') {
    const body = req.body as {
      endpoint?: unknown;
      keys?: { p256dh?: unknown; auth?: unknown };
      favoriteTeamId?: unknown;
      prefs?: { league?: unknown; cup?: unknown; cl?: unknown; el?: unknown; ecl?: unknown };
    };

    const endpoint = body.endpoint;
    const p256dh = body.keys?.p256dh;
    const auth = body.keys?.auth;
    const prefs = body.prefs ?? {};
    const favoriteTeamId =
      typeof body.favoriteTeamId === 'number' && Number.isFinite(body.favoriteTeamId) ? body.favoriteTeamId : null;

    if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
      res.status(400).json({ success: false, error: 'Invalid endpoint' });
      return;
    }
    if (typeof p256dh !== 'string' || !p256dh || typeof auth !== 'string' || !auth) {
      res.status(400).json({ success: false, error: 'Invalid keys' });
      return;
    }
    const prefLeague = isPrefValue(prefs.league) ? prefs.league : 'none';
    const prefCup = isPrefValue(prefs.cup) ? prefs.cup : 'none';
    const prefCl = isPrefValue(prefs.cl) ? prefs.cl : 'none';
    const prefEl = isPrefValue(prefs.el) ? prefs.el : 'none';
    const prefEcl = isPrefValue(prefs.ecl) ? prefs.ecl : 'none';

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        endpoint,
        p256dh,
        auth,
        favorite_team_id: favoriteTeamId,
        pref_league: prefLeague,
        pref_cup: prefCup,
        pref_cl: prefCl,
        pref_el: prefEl,
        pref_ecl: prefEcl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );
    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }
    res.status(200).json({ success: true });
    return;
  }

  res.status(405).json({ success: false, error: 'Method not allowed' });
}
