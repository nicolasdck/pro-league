import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { FOOTMERCATO_CLUB_SLUGS } from '../src/lib/footmercatoClubSlugs.js';

// Aggregates footmercato.net's per-club news feed across the 18 D1 clubs
// into one table. Unlike the calendar scraping (footmercatoScraper.ts),
// footmercato exposes this as a clean JSON API — no cheerio/HTML parsing
// needed — so this file doesn't share that module.
const USER_AGENT = 'Mozilla/5.0 (compatible; pro-league-app/1.0; +https://github.com/)';
const ARTICLES_PER_CLUB = 10;
const REQUEST_DELAY_MS = 300;
const MAX_ARTICLE_AGE_DAYS = 60; // old articles fall out of every club's top-10 naturally

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface FootmercatoArticle {
  id: string;
  slug: string;
  title: string;
  url: string;
  image: { url: string } | null;
  type: string;
  publishedAtIso: string;
}

interface FootmercatoArticleComponent {
  name: string;
  data: FootmercatoArticle;
}

interface NewsRow {
  id: string;
  slug: string;
  title: string;
  url: string;
  image_url: string | null;
  article_type: string;
  published_at: string;
  team_ids: number[];
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
  await supabase.from('sync_logs').insert({ resource: 'news_items', requests_used: requestsUsed, success, message });
}

async function fetchClubNews(slug: string): Promise<FootmercatoArticle[]> {
  const response = await fetch(`https://www.footmercato.net/api/2.0/team/club/${slug}/news`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`footmercato news request failed (${response.status}): ${slug}`);
  }
  const json = (await response.json()) as { components: FootmercatoArticleComponent[] };
  return json.components
    .filter((component) => component.name === 'article/articleInline')
    .slice(0, ARTICLES_PER_CLUB)
    .map((component) => component.data);
}

async function syncNews(supabase: SupabaseClient): Promise<{ requestsUsed: number; itemsFound: number }> {
  const now = new Date().toISOString();
  const merged = new Map<string, NewsRow>();
  let requestsUsed = 0;

  for (const [teamIdStr, slug] of Object.entries(FOOTMERCATO_CLUB_SLUGS)) {
    const teamId = Number(teamIdStr);
    const articles = await fetchClubNews(slug);
    requestsUsed += 1;

    for (const article of articles) {
      const existing = merged.get(article.id);
      if (existing) {
        existing.team_ids.push(teamId);
        continue;
      }
      merged.set(article.id, {
        id: article.id,
        slug: article.slug,
        title: article.title,
        url: article.url,
        image_url: article.image?.url ?? null,
        article_type: article.type,
        published_at: article.publishedAtIso,
        team_ids: [teamId],
        updated_at: now,
      });
    }

    await sleep(REQUEST_DELAY_MS);
  }

  const rows = Array.from(merged.values());
  if (rows.length > 0) {
    const { error } = await supabase.from('news_items').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  const cutoff = new Date(Date.now() - MAX_ARTICLE_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('news_items').delete().lt('published_at', cutoff);

  return { requestsUsed, itemsFound: rows.length };
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
    const { requestsUsed, itemsFound } = await syncNews(supabase);
    await logSync(supabase, requestsUsed, true, `${itemsFound} article(s) found`);
    res.status(200).json({ success: true, requestsUsed, itemsFound });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logSync(supabase, 0, false, message).catch(() => undefined);
    res.status(500).json({ success: false, error: message });
  }
}
