import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchMatchEvents } from '../src/lib/footmercatoScraper.js';

// Fetched on demand (not during sync — scraping every match's detail page
// on every cron run would multiply request volume for no benefit, since
// most matches are never opened) when a user expands a finished match's
// card. Only ever proxies footmercato.net's own `/live/` detail pages —
// the strict prefix check keeps this from becoming an open URL-fetch proxy.
const ALLOWED_PREFIX = 'https://www.footmercato.net/live/';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const url = req.query.url;
  if (typeof url !== 'string' || !url.startsWith(ALLOWED_PREFIX)) {
    res.status(400).json({ error: 'Invalid or missing url' });
    return;
  }

  try {
    const events = await fetchMatchEvents(url);
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    res.status(200).json({ success: true, ...events });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(502).json({ success: false, error: message });
  }
}
