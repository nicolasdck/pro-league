// Shared scraping engine for footmercato.net calendar pages, used by
// api/sync-cup.ts (Croky Cup) and api/sync-cl.ts / sync-el.ts / sync-ecl.ts
// (Champions/Europa/Conference League). footmercato's calendar pages are
// server-rendered with a stable template across every competition on the
// site: BEM-ish class names (`matchFull`, `blockVertical`), an ISO
// `datetime` attribute on upcoming matches, and the full club name in the
// logo `alt` (the visible team name is often truncated, e.g. "Dessel" for
// "Dessel Sport"). Finished matches drop the `<time>` element entirely
// (replaced by a "terminé" label), so the day header above each block of
// matches is the fallback source of their date.
//
// Server-only: never imported by client code (would pull in `cheerio` and a
// Node-only `fetch` User-Agent override into the browser bundle).
import * as cheerio from 'cheerio';

// Be polite to a normal news site, not a rate-limited API — a short delay is
// enough (compare api/sync.ts's much longer delay for TheSportsDB's WAF).
export const REQUEST_DELAY_MS = 400;
const USER_AGENT = 'Mozilla/5.0 (compatible; pro-league-app/1.0; +https://github.com/)';

export interface RawMatch {
  liveId: string; // footmercato's data-live-id exceeds Number.MAX_SAFE_INTEGER — keep as string
  homeName: string;
  homeLogo: string | null;
  awayName: string;
  awayLogo: string | null;
  eventDate: string | null; // null only if the match has neither a kickoff time nor a parseable day header
  isPlayed: boolean;
  homeScore: number | null;
  awayScore: number | null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) {
    throw new Error(`footmercato request failed (${response.status}): ${url}`);
  }
  return response.text();
}

// Every phase/matchday of a competition's calendar gets its own numeric-id
// URL (e.g. ".../calendrier/1313017249707174871-phase-16th-finals" or
// ".../calendrier/8877473540534567503-journee-8"). These ids are re-issued
// each season, so callers must rediscover them from the base calendar page
// on every sync rather than hardcoding them.
export interface PhaseLink {
  slug: string; // e.g. "phase-16th-finals" or "journee-8"
  url: string;
}

export async function discoverPhaseLinks(baseUrl: string): Promise<PhaseLink[]> {
  const html = await fetchHtml(baseUrl);
  const $ = cheerio.load(html);
  const found = new Map<string, string>(); // slug -> absolute url

  $('a[href*="/calendrier/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const match = href.match(/\/calendrier\/\d+-((?:phase|journee)-[a-z0-9-]+)/);
    if (!match) return;
    const slug = match[1];
    if (!found.has(slug)) found.set(slug, new URL(href, baseUrl).toString());
  });

  return Array.from(found, ([slug, url]) => ({ slug, url }));
}

const FRENCH_MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

// e.g. "vendredi 24 juillet 2026" -> "2026-07-24".
function parseFrenchDayHeader(text: string): string | null {
  const match = text.match(/(\d{1,2})\s+([a-zéûôA-Z]+)\s+(\d{4})/);
  if (!match) return null;
  const [, day, monthName, year] = match;
  const monthIndex = FRENCH_MONTHS.indexOf(monthName.toLowerCase());
  if (monthIndex === -1) return null;
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function teamNameFromLogo(el: ReturnType<cheerio.CheerioAPI>): string {
  const alt = el.find('img.matchTeam__logo').attr('alt') ?? '';
  return alt.replace(/^Logo\s+/, '').trim();
}

export function parseMatchesFromHtml(html: string): RawMatch[] {
  const $ = cheerio.load(html);
  const rows: RawMatch[] = [];

  $('.blockVertical').each((_, dayBlockEl) => {
    const dayBlock = $(dayBlockEl);
    const dayIso = parseFrenchDayHeader(dayBlock.find('.blockVertical__title .title__left').first().text());

    dayBlock.find('.matchFull').each((__, el) => {
      const match = $(el);
      const liveId = match.attr('data-live-id');
      if (!liveId) return;

      const homeTeamEl = match.find('.matchFull__team').not('.matchFull__team--away').first();
      const awayTeamEl = match.find('.matchFull__team--away').first();
      const homeName = teamNameFromLogo(homeTeamEl);
      const awayName = teamNameFromLogo(awayTeamEl);
      if (!homeName || !awayName) return;

      const timeAttr = match.find('.matchFull__infos time[datetime]').attr('datetime') ?? null;
      const isPlayed = match.find('.matchFull__infosPlayed').length > 0;
      // Upcoming matches carry an exact kickoff instant; finished ones only
      // have the day (no time-of-day is shown once a match is over), so fall
      // back to a fixed midday UTC time that stays on the same calendar day
      // for any plausible viewer timezone.
      const eventDate = timeAttr ?? (dayIso ? `${dayIso}T12:00:00Z` : null);
      const homeScoreText = homeTeamEl.find('.matchFull__score').first().text().trim();
      const awayScoreText = awayTeamEl.find('.matchFull__score').first().text().trim();

      rows.push({
        liveId,
        homeName,
        homeLogo: homeTeamEl.find('img.matchTeam__logo').attr('data-src') ?? null,
        awayName,
        awayLogo: awayTeamEl.find('img.matchTeam__logo').attr('data-src') ?? null,
        eventDate,
        isPlayed,
        homeScore: isPlayed && homeScoreText ? Number(homeScoreText) : null,
        awayScore: isPlayed && awayScoreText ? Number(awayScoreText) : null,
      });
    });
  });

  return rows;
}
