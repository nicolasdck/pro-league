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
  matchUrl: string | null; // detail page, only used to look up a penalty shootout score
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

export function parseMatchesFromHtml(html: string, pageUrl: string): RawMatch[] {
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
      const href = match.find('a.matchFull__link').attr('href');

      rows.push({
        liveId,
        matchUrl: href ? new URL(href, pageUrl).toString() : null,
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

export interface PenaltyScore {
  home: number;
  away: number;
}

// The calendar listing never shows a shootout result (a 0-0 draw after
// extra time looks identical to a 0-0 draw that never went to penalties),
// so a knockout tie that finished level needs one extra request to its
// detail page, where the "TAB" (tirs au but) period separator carries the
// actual score, e.g. "4 - 2".
export async function fetchPenaltyScore(matchUrl: string): Promise<PenaltyScore | null> {
  const html = await fetchHtml(matchUrl);
  const $ = cheerio.load(html);

  let penalty: PenaltyScore | null = null;
  $('.matchHighlights__periodSeparatorAcronym').each((_, el) => {
    if ($(el).text().trim() !== 'TAB') return;
    const scoreText = $(el).siblings('.matchHighlights__periodSeparatorScore').first().text().trim();
    const score = scoreText.match(/(\d+)\s*-\s*(\d+)/);
    if (score) penalty = { home: Number(score[1]), away: Number(score[2]) };
  });
  return penalty;
}

export interface MatchEvent {
  minute: string; // e.g. "45+1'", "90'" — footmercato's own notation, not parsed into a number
  side: 'home' | 'away';
  player: string;
  detail: string | null; // assist (goals) or reason (cards), when footmercato shows one
}

export interface MatchEvents {
  goals: MatchEvent[];
  yellowCards: MatchEvent[];
  redCards: MatchEvent[];
}

function minuteSortValue(minute: string): number {
  const match = minute.match(/(\d+)(?:\+(\d+))?/);
  if (!match) return 0;
  return Number(match[1]) + Number(match[2] ?? 0) / 10;
}

// Goals, yellow and red cards, read from the match detail page's "temps
// forts" (highlights) feed — the only place footmercato exposes them (the
// calendar listing only has the final score). A goal event is the one with
// a `.matchHighlights__eventScore` sibling (the running score after it);
// cards are told apart by the icon's `colorYellowCardSvg`/`colorRedCardSvg`
// class. Substitutions use a third icon (no score, no card class) and are
// deliberately not collected — out of scope for a "buteurs et cartons" view.
export async function fetchMatchEvents(matchUrl: string): Promise<MatchEvents> {
  const html = await fetchHtml(matchUrl);
  const $ = cheerio.load(html);

  const goals: MatchEvent[] = [];
  const yellowCards: MatchEvent[] = [];
  const redCards: MatchEvent[] = [];

  $('.matchHighlights__event').each((_, el) => {
    const event = $(el);
    const isHome = event.hasClass('matchHighlights__event--home');
    const isAway = event.hasClass('matchHighlights__event--away');
    if (!isHome && !isAway) return; // period separators, "pas d'événements majeurs" placeholder, etc.

    const player = event.find('.matchHighlights__eventPersonName').first().text().trim();
    if (!player) return;

    const minute = event.find('.matchHighlights__eventNumber').first().text().trim();
    const detailText = event.find('.matchHighlights__eventPersonName__extra').first().text().trim();
    const detail = detailText ? detailText.replace(/^\(|\)$/g, '') : null;
    const side: MatchEvent['side'] = isHome ? 'home' : 'away';
    const matchEvent: MatchEvent = { minute, side, player, detail };

    if (event.find('.matchHighlights__eventScore').length > 0) {
      goals.push(matchEvent);
    } else if (event.find('svg.colorYellowCardSvg').length > 0) {
      yellowCards.push(matchEvent);
    } else if (event.find('svg.colorRedCardSvg').length > 0) {
      redCards.push(matchEvent);
    }
  });

  const byMinuteAsc = (a: MatchEvent, b: MatchEvent) => minuteSortValue(a.minute) - minuteSortValue(b.minute);
  return { goals: goals.sort(byMinuteAsc), yellowCards: yellowCards.sort(byMinuteAsc), redCards: redCards.sort(byMinuteAsc) };
}
