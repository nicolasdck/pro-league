// Scrapes footmercato.net's Pro League "Buteurs" / "Passeurs" ranking pages
// — TheSportsDB's free tier has no player-stats endpoint at all (confirmed:
// every plausible top-scorers path 404s), so this is the only source.
// Separate from footmercatoScraper.ts (calendar pages, `.matchFull` markup)
// since this is a different page template (`.complexTable` ranking grid).
//
// Server-only: never imported by client code (pulls in cheerio).
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (compatible; pro-league-app/1.0; +https://github.com/)';

export type StatKind = 'goals' | 'assists';

export const STAT_PAGE_URL: Record<StatKind, string> = {
  goals: 'https://www.footmercato.net/belgique/division-1a/buteur',
  assists: 'https://www.footmercato.net/belgique/division-1a/passeur',
};

export interface PlayerStatRow {
  rank: number;
  playerName: string;
  playerSlug: string;
  playerImage: string | null;
  clubName: string;
  clubLogo: string | null;
  position: string | null;
  value: number;
}

export async function fetchPlayerStats(kind: StatKind): Promise<PlayerStatRow[]> {
  const response = await fetch(STAT_PAGE_URL[kind], { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) {
    throw new Error(`footmercato stats request failed (${response.status}): ${kind}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);
  const rows: PlayerStatRow[] = [];

  $('table.complexTable tbody tr').each((_, el) => {
    const row = $(el);
    const cells = row.find('td');
    if (cells.length < 3) return;

    const rank = Number(row.find('.rankingCell').first().text().trim());
    const personLink = cells.eq(1).find('a.personCardCell');
    const href = personLink.attr('href') ?? '';
    const slugMatch = href.match(/\/joueur\/([a-z0-9-]+)\/?/);
    const playerSlug = slugMatch ? slugMatch[1] : href;
    const playerName = personLink.find('.personCardCell__name').clone().children().remove().end().text().trim();
    const playerImage = personLink.find('.personCardCell__image img').attr('data-src') ?? null;
    const clubLogoImg = personLink.find('.personCardCell__nationalities img');
    const clubLogo = clubLogoImg.attr('data-src') ?? null;
    const clubName = (clubLogoImg.attr('alt') ?? '').replace(/^Logo\s+/, '').trim();
    const position = personLink.find('.personCardCell__description').text().trim() || null;
    // The count column (goals/assists) is always the first stat cell right
    // after rank + player, regardless of how many secondary columns
    // (penalty goals, per-match, per-90min) follow it.
    const value = Number(cells.eq(2).text().trim());

    if (!rank || !playerName || Number.isNaN(value)) return;

    rows.push({ rank, playerName, playerSlug, playerImage, clubName, clubLogo, position, value });
  });

  return rows;
}
