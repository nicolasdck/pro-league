import * as webpushNS from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';

// web-push is CJS-only with no real ESM named exports — under Node's native
// ESM/CJS interop (unlike esbuild-bundled builds), `import * as webpush`
// only picks up what cjs-module-lexer can statically detect, which for this
// package is nothing: every function ends up undefined at runtime even
// though it type-checks fine. Falling back to `.default` when present
// covers that case without depending on which bundler runs this file.
const webpush: typeof webpushNS = (webpushNS as unknown as { default?: typeof webpushNS }).default ?? webpushNS;

// Server-only (needs the VAPID private key) — never imported by client code.
// Called from api/live-scores.ts / api/live-scores-euro.ts whenever a
// score comparison shows a goal just happened.
export type CompetitionKey = 'league' | 'cup' | 'cl' | 'el' | 'ecl';

const PREF_COLUMN: Record<CompetitionKey, string> = {
  league: 'pref_league',
  cup: 'pref_cup',
  cl: 'pref_cl',
  el: 'pref_el',
  ecl: 'pref_ecl',
};

export interface GoalContext {
  competitionKey: CompetitionKey;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
}

interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  favorite_team_id: number | null;
  [prefColumn: string]: unknown;
}

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

// A goal happened iff either side's score went up (never down — scores are
// only ever corrected upward by these endpoints; a decrease would mean a
// stale/out-of-order read, not an actual goal being un-scored).
export function isGoal(before: { homeScore: number | null; awayScore: number | null }, after: { homeScore: number; awayScore: number }): boolean {
  const beforeHome = before.homeScore ?? 0;
  const beforeAway = before.awayScore ?? 0;
  return after.homeScore > beforeHome || after.awayScore > beforeAway;
}

export async function sendGoalNotifications(supabase: SupabaseClient, ctx: GoalContext): Promise<void> {
  if (!ensureVapid()) return; // VAPID env vars not configured — silently skip, never breaks the sync itself.

  const prefColumn = PREF_COLUMN[ctx.competitionKey];
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select(`endpoint, p256dh, auth, favorite_team_id, ${prefColumn}`)
    .neq(prefColumn, 'none');
  if (error || !data) return;

  const subscriptions = data as unknown as PushSubscriptionRow[];
  const targets = subscriptions.filter((sub) => {
    const pref = sub[prefColumn];
    if (pref === 'all') return true;
    if (pref === 'favorite') {
      return sub.favorite_team_id !== null && (sub.favorite_team_id === ctx.homeTeamId || sub.favorite_team_id === ctx.awayTeamId);
    }
    return false;
  });
  if (targets.length === 0) return;

  const payload = JSON.stringify({
    title: `But ! ${ctx.homeName} ${ctx.homeScore} - ${ctx.awayScore} ${ctx.awayName}`,
    body: `${ctx.homeName} - ${ctx.awayName}`,
    url: '/',
  });

  await Promise.all(
    targets.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      } catch (err) {
        // 404/410 = the browser dropped this subscription (data cleared,
        // uninstalled, permission revoked) — the push service will never
        // accept it again, so clean it up rather than retrying forever.
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }
    }),
  );
}
