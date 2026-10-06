import { Platform } from 'react-native';
import { LolMatchData, LolGameData, LolPick, LolTeamGame } from './types';

/**
 * LoL desde gol.gg (scraping, sin clave ni cuota agresiva).
 *
 * Flujo (validado en vivo):
 *  1. Lista de torneos (POST ajax.trlist.php) → nombre + rango de fechas.
 *  2. Match list del torneo → fila (equipos + marcador + fecha) → id de partida.
 *  3. Página de cada game (page-game) → bans/picks/KDA/CS/tiempo/patch + iconos.
 *
 * Los iconos de campeón salen de la propia página (gol.gg/_img), así que no
 * dependemos de ningún mapa externo.
 */

export type LolStatsReason = 'ok' | 'not_found' | 'timeout' | 'error';

export interface LolMatchResult {
  data: LolMatchData | null;
  reason: LolStatsReason;
}

const GOL_BASE = 'https://gol.gg';
const GOL_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 15000;
const OVERALL_TIMEOUT_MS = 60000;

// ---------------------------------------------------------------------------
// Red
// ---------------------------------------------------------------------------
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  if (typeof AbortController === 'undefined') {
    return fetch(url, options);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('overall_timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function golFetch(url: string, method: 'GET' | 'POST', body?: string): Promise<Response> {
  if (Platform.OS === 'web') {
    // En web, siempre GET al proxy del dev server (que hace el POST server-side si toca)
    let proxy = `/api/proxy/gol?url=${encodeURIComponent(url)}`;
    if (method === 'POST') proxy += `&method=POST&body=${encodeURIComponent(body || '')}`;
    return await fetchWithTimeout(proxy, {
      headers: { Accept: method === 'POST' ? 'application/json' : 'text/html' },
    });
  }
  return await fetchWithTimeout(url, {
    method,
    headers:
      method === 'POST'
        ? {
            'User-Agent': GOL_UA,
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json',
          }
        : { 'User-Agent': GOL_UA, Accept: 'text/html' },
    body: method === 'POST' ? body : undefined,
  });
}

async function fetchText(url: string): Promise<string> {
  const res = await golFetch(url, 'GET');
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return await res.text();
}

// ---------------------------------------------------------------------------
// Utilidades de HTML / nombres
// ---------------------------------------------------------------------------
function htmlText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrae un bloque con etiquetas balanceadas (evita cortarse con tablas anidadas) */
function extractBalanced(html: string, startIdx: number, open: string, close: string): string {
  let depth = 0;
  let pos = startIdx;
  while (pos < html.length) {
    const nextOpen = html.indexOf(open, pos);
    const nextClose = html.indexOf(close, pos);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      pos = nextOpen + open.length;
    } else {
      depth -= 1;
      pos = nextClose + close.length;
      if (depth === 0) return html.slice(startIdx, pos);
    }
  }
  return html.slice(startIdx);
}

const normalizeName = (s: string): string => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function nameTokens(s: string): string[] {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w.length >= 2);
}

function nameScore(queryName: string, rowName: string): number {
  const q = normalizeName(queryName);
  const r = normalizeName(rowName);
  if (!q || !r) return 0;
  if (q === r) return 3;
  if (r.includes(q) || q.includes(r)) return 2;
  const tokens = nameTokens(queryName);
  if (tokens.some((t) => r.includes(t))) return 1;
  return 0;
}

function overlapCount(a: string, b: string): number {
  const ta = new Set(nameTokens(a));
  let hit = 0;
  for (const t of nameTokens(b)) if (ta.has(t)) hit += 1;
  return hit;
}

function dateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// 1) Lista de torneos
// ---------------------------------------------------------------------------
interface GolTournament {
  name: string;
  region: string;
  firstGame: string;
  lastGame: string;
}

const TOURNAMENT_CACHE = new Map<number, GolTournament[]>();

async function fetchTournaments(season: number): Promise<GolTournament[]> {
  const cached = TOURNAMENT_CACHE.get(season);
  if (cached) return cached;

  const res = await golFetch(
    `${GOL_BASE}/tournament/ajax.trlist.php`,
    'POST',
    `season=S${season}&league=0`
  );

  const data = await res.json();
  const list: GolTournament[] = (Array.isArray(data) ? data : [])
    .map((r: Record<string, unknown>) => ({
      name: String(r.trname || ''),
      region: String(r.region || ''),
      firstGame: String(r.firstgame || ''),
      lastGame: String(r.lastgame || ''),
    }))
    .filter((t: GolTournament) => !!t.name);

  TOURNAMENT_CACHE.set(season, list);
  return list;
}

// ---------------------------------------------------------------------------
// 2) Match list del torneo
// ---------------------------------------------------------------------------
interface GolMatchRow {
  gameId: string;
  team1: string;
  team2: string;
  score: string;
  round: string;
  patch: string;
  date: string;
}

async function fetchMatchList(tournamentName: string): Promise<GolMatchRow[]> {
  const url = `${GOL_BASE}/tournament/tournament-matchlist/${encodeURIComponent(tournamentName)}/`;
  const html = await fetchText(url);
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);

  const result: GolMatchRow[] = [];
  for (const row of rows) {
    if (!/game\/stats/i.test(row)) continue;
    const idMatch = row.match(/game\/stats\/(\d+)\//);
    if (!idMatch) continue;
    const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => htmlText(m[1]));
    result.push({
      gameId: idMatch[1],
      team1: tds[1] || '',
      team2: tds[3] || '',
      score: tds[2] || '',
      round: tds[4] || '',
      patch: tds[5] || '',
      date: tds[6] || '',
    });
  }
  return result;
}

/** Encuentra, entre los torneos candidatos, el partido que mejor encaja */
async function findSeriesGameId(
  teamA: string,
  teamB: string,
  startTimeIso: string | undefined,
  leagueName: string
): Promise<{ gameId: string; tournamentName: string; row: GolMatchRow } | null> {
  const base = startTimeIso ? new Date(startTimeIso) : new Date();
  const valid = !isNaN(base.getTime());
  const when = valid ? base : new Date();
  const season = when.getFullYear() - 2010; // S16 = 2026
  const dateStr = dateOnly(when);

  let tournaments: GolTournament[] = [];
  try {
    tournaments = await fetchTournaments(season);
  } catch (err) {
    console.warn('gol.gg: no se pudo obtener la lista de torneos:', err);
  }

  // Sondea un torneo: descarga su match list y busca el partido
  const probe = async (
    tournament: GolTournament
  ): Promise<{ gameId: string; tournamentName: string; row: GolMatchRow } | null> => {
    let rows: GolMatchRow[] = [];
    try {
      rows = await fetchMatchList(tournament.name);
    } catch (err) {
      console.warn(`gol.gg: fallo el matchlist de ${tournament.name}:`, err);
      return null;
    }

    let best: GolMatchRow | null = null;
    let bestScore = -1;
    for (const row of rows) {
      const direct = nameScore(teamA, row.team1) + nameScore(teamB, row.team2);
      const swapped = nameScore(teamA, row.team2) + nameScore(teamB, row.team1);
      let s = Math.max(direct, swapped);
      if (valid && row.date) {
        const diff = Math.abs(new Date(row.date).getTime() - when.getTime());
        if (diff < 36 * 3600 * 1000) s += 2;
        else if (diff < 4 * 24 * 3600 * 1000) s += 1;
      }
      if (s > bestScore) {
        bestScore = s;
        best = row;
      }
    }

    return best && bestScore >= 4
      ? { gameId: best.gameId, tournamentName: tournament.name, row: best }
      : null;
  };

  // Ranking: solape de tokens con el nombre de la liga + fecha dentro del rango
  const ranked = tournaments
    .map((t) => {
      let score = overlapCount(leagueName, t.name) * 2;
      if (t.firstGame && t.lastGame && dateStr >= t.firstGame && dateStr <= t.lastGame) score += 3;
      return { t, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  for (const { t } of ranked) {
    const hit = await probe(t);
    if (hit) return hit;
  }

  // Respaldo: torneos cuya ventana de fechas incluye la del partido
  const tried = new Set(ranked.map((x) => x.t.name));
  const byDate = tournaments
    .filter((t) => !tried.has(t.name) && t.firstGame && t.lastGame && dateStr >= t.firstGame && dateStr <= t.lastGame)
    .slice(0, 6);

  for (const t of byDate) {
    const hit = await probe(t);
    if (hit) return hit;
  }

  return null;
}

// ---------------------------------------------------------------------------
// 3) Página de un game
// ---------------------------------------------------------------------------
interface GolTeamSide {
  name: string;
  won: boolean;
  kills?: string;
  gold?: string;
  bans: { name: string; iconUrl: string }[];
  picks: { name: string; iconUrl: string }[];
  players: {
    champion: string;
    playerName?: string;
    kills?: string;
    deaths?: string;
    assists?: string;
    cs?: string;
  }[];
}

interface GolGamePage {
  blue: GolTeamSide;
  red: GolTeamSide;
  seriesGameIds: string[];
  gameLength?: string;
  patch?: string;
}

function parseIcons(html: string): { name: string; iconUrl: string }[] {
  return [...html.matchAll(/alt='([^']+)'\s+src='([^']+)'/g)]
    .map((m) => ({ name: m[1], file: m[2].split('/').pop() || '' }))
    .filter((x) => x.name && !/^(First Pick|Runes)$/.test(x.name) && x.file)
    .map((x) => ({ name: x.name, iconUrl: `${GOL_BASE}/_img/champions_icon/${x.file}` }));
}

/** Contenido del div col-10 que sigue a una etiqueta (Bans/Picks) */
function col10After(block: string, label: string): string {
  const li = block.indexOf(label);
  if (li < 0) return '';
  const startMark = '<div class="col-10">';
  const si = block.indexOf(startMark, li);
  if (si < 0) return '';
  const from = si + startMark.length;
  const ei = block.indexOf('</div>', from);
  return block.slice(from, ei < 0 ? undefined : ei);
}

function parsePlayers(table: string): GolTeamSide['players'] {
  const rowStarts = [...table.matchAll(/<tr[ >]/g)].map((m) => m.index ?? 0);
  const rows = rowStarts
    .map((s) => extractBalanced(table, s, '<tr', '</tr>'))
    .filter((r) => /player-stats/.test(r));

  return rows.map((r) => {
    const champM = r.match(/alt='([^']+)'\s+src='\.\.\/_img\/champions_icon\//);
    const playerM = r.match(/player-stats\/[^']*'\s+title='[^']*'>([^<]+)<\/a>/);
    const tds = [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => htmlText(m[1]));

    let kills: string | undefined;
    let deaths: string | undefined;
    let assists: string | undefined;
    let cs: string | undefined;
    const kdaIdx = tds.findIndex((t) => /^\d+\s*\/\s*\d+\s*\/\s*\d+$/.test(t));
    if (kdaIdx >= 0) {
      const parts = tds[kdaIdx].split('/').map((s) => s.trim());
      kills = parts[0];
      deaths = parts[1];
      assists = parts[2];
      cs = (tds[kdaIdx + 1] || '').match(/^\d+/)?.[0];
    }

    return {
      champion: champM?.[1] || '',
      playerName: playerM?.[1]?.trim(),
      kills,
      deaths,
      assists,
      cs,
    };
  });
}

function parseGamePage(html: string): GolGamePage {
  const headers = [
    ...html.matchAll(/<div class="col-12 (blue|red)-line-header">\s*<a[^>]*>([^<]+)<\/a>\s*-\s*(WIN|LOSS)/g),
  ].map((m) => ({ side: m[1], name: m[2].trim(), won: m[3] === 'WIN', index: m.index ?? 0 }));

  const blueHeader = headers.find((h) => h.side === 'blue');
  const redHeader = headers.find((h) => h.side === 'red');

  const blueBlock =
    blueHeader && redHeader ? html.slice(blueHeader.index, redHeader.index) : html;
  const redBlock = redHeader ? html.slice(redHeader.index) : '';

  const buildSide = (header: typeof headers[number] | undefined, block: string): GolTeamSide => ({
    name: header?.name || '',
    won: !!header?.won,
    kills: (block.match(/alt='Kills'\/>\s*([\d.]+k?)/) || [])[1],
    gold: (block.match(/alt='Team Gold'\/>\s*([\d.]+k?)/) || [])[1],
    bans: parseIcons(col10After(block, '>Bans')),
    picks: parseIcons(col10After(block, '>Picks')),
    players: [],
  });

  const blue = buildSide(blueHeader, blueBlock);
  const red = buildSide(redHeader, redBlock);

  // Tablas de jugadores (sección aparte; lado por class del thead)
  const tableStarts = [...html.matchAll(/<table class='playersInfosLine/g)].map((m) => m.index ?? 0);
  for (const start of tableStarts) {
    const table = extractBalanced(html, start, '<table', '</table>');
    const players = parsePlayers(table);
    if (/blue-line-header/.test(table)) blue.players = players;
    else if (/red-line-header/.test(table)) red.players = players;
  }

  const seriesGameIds = [
    ...new Set([...html.matchAll(/href='\.\.\/game\/stats\/(\d+)\/page-game\/'/g)].map((m) => m[1])),
  ];

  const text = htmlText(html);
  const timePatch = text.match(/Game Time\s*([\d:]+)\s*v?([\d.]+)?/);

  return {
    blue,
    red,
    seriesGameIds,
    gameLength: timePatch?.[1],
    patch: timePatch?.[2],
  };
}

// ---------------------------------------------------------------------------
// Construcción del modelo de la app
// ---------------------------------------------------------------------------
function sideToTeamGame(side: GolTeamSide, assignedName: string): LolTeamGame {
  // Orden por rol (top, jungla, mid, adc, support): la tabla de jugadores de
  // gol.gg ya viene en ese orden, así que se usa como orden de los picks.
  const picks: LolPick[] = [];
  for (const pl of side.players) {
    const p = side.picks.find((pk) => normalizeName(pk.name) === normalizeName(pl.champion));
    picks.push({
      champion: pl.champion || p?.name || '',
      championIconUrl: p?.iconUrl,
      playerName: pl.playerName,
      kills: pl.kills,
      deaths: pl.deaths,
      assists: pl.assists,
      cs: pl.cs,
    });
  }
  // Picks sin jugador emparejado (o sin tabla de jugadores) al final
  for (const p of side.picks) {
    if (!picks.some((pk) => normalizeName(pk.champion) === normalizeName(p.name))) {
      picks.push({ champion: p.name, championIconUrl: p.iconUrl });
    }
  }

  return {
    teamName: assignedName || side.name,
    won: side.won,
    kills: side.kills,
    gold: side.gold,
    picks: picks.filter((pk) => pk.champion),
    bans: side.bans.map((b) => ({ champion: b.name, championIconUrl: b.iconUrl })),
  };
}

function buildMatchData(
  teamA: string,
  teamB: string,
  tournamentName: string,
  row: GolMatchRow,
  games: { number: number; page: GolGamePage }[]
): LolMatchData {
  const builtGames: LolGameData[] = games.map(({ number, page }) => {
    // Los equipos cambian de lado (azul/rojo) entre games: se resuelve por nombre en cada game
    const aIsBlue = nameScore(teamA, page.blue.name) >= nameScore(teamA, page.red.name);
    const teamABlue = sideToTeamGame(page.blue, '');
    const teamBRed = sideToTeamGame(page.red, '');
    return {
      gameNumber: number,
      gameLength: page.gameLength,
      patch: page.patch,
      teamA: aIsBlue ? teamABlue : teamBRed,
      teamB: aIsBlue ? teamBRed : teamABlue,
    };
  });

  // Marcador de serie desde el matchlist (team1 - team2), orientado a teamA/teamB
  let scoreA: string | undefined;
  let scoreB: string | undefined;
  const scoreParts = row.score.split('-').map((s) => s.trim());
  if (scoreParts.length === 2) {
    const rowDirect = nameScore(teamA, row.team1) + nameScore(teamB, row.team2);
    const rowSwapped = nameScore(teamA, row.team2) + nameScore(teamB, row.team1);
    const aIsRowTeam1 = rowDirect >= rowSwapped;
    scoreA = aIsRowTeam1 ? scoreParts[0] : scoreParts[1];
    scoreB = aIsRowTeam1 ? scoreParts[1] : scoreParts[0];
  }

  return {
    matchId: row.gameId,
    tournament: tournamentName || undefined,
    teamAName: teamA,
    teamBName: teamB,
    scoreA,
    scoreB,
    games: builtGames,
  };
}

// ---------------------------------------------------------------------------
// Caché y servicio
// ---------------------------------------------------------------------------
const MATCH_CACHE = new Map<string, LolMatchData | null>();

function cacheKeyFor(teamA: string, teamB: string, startTimeIso?: string): string {
  return `${teamA.toLowerCase().trim()}_vs_${teamB.toLowerCase().trim()}_${(startTimeIso || '').slice(0, 10)}`;
}

async function loadMatch(
  teamA: string,
  teamB: string,
  startTimeIso?: string,
  leagueName?: string
): Promise<LolMatchData | null> {
  const leagueText = leagueName || '';
  const found = await findSeriesGameId(teamA, teamB, startTimeIso, leagueText);
  if (!found) return null;

  // Página del primer game de la serie
  const firstHtml = await fetchText(`${GOL_BASE}/game/stats/${found.gameId}/page-game/`);
  const firstPage = parseGamePage(firstHtml);

  // Games de la serie (ordenados); máximo 5
  const ids = (firstPage.seriesGameIds.length > 0 ? firstPage.seriesGameIds : [found.gameId]).slice(0, 5);

  const games: { number: number; page: GolGamePage }[] = [];
  for (let i = 0; i < ids.length; i++) {
    if (ids[i] === found.gameId) {
      games.push({ number: i + 1, page: firstPage });
    } else {
      const html = await fetchText(`${GOL_BASE}/game/stats/${ids[i]}/page-game/`);
      games.push({ number: i + 1, page: parseGamePage(html) });
    }
  }

  return buildMatchData(teamA, teamB, found.tournamentName, found.row, games);
}

function classifyError(err: unknown): LolStatsReason {
  const name = (err as Error)?.name || '';
  const message = String((err as Error)?.message || err);
  if (name === 'AbortError' || message.includes('overall_timeout')) return 'timeout';
  return 'error';
}

export const LolScraperService = {
  /**
   * Obtiene picks, bans, K/D/A y marcador de un partido de LoL desde gol.gg.
   * leagueName es el nombre de la liga/torneo del partido (ayuda a localizarlo).
   */
  async getMatchData(
    teamA: string,
    teamB: string,
    startTimeIso?: string,
    leagueName?: string
  ): Promise<LolMatchResult> {
    const key = cacheKeyFor(teamA, teamB, startTimeIso);
    if (MATCH_CACHE.has(key)) {
      return { data: MATCH_CACHE.get(key)!, reason: 'ok' };
    }

    try {
      const data = await withTimeout(loadMatch(teamA, teamB, startTimeIso, leagueName), OVERALL_TIMEOUT_MS);
      MATCH_CACHE.set(key, data);
      return { data, reason: data ? 'ok' : 'not_found' };
    } catch (err) {
      console.warn('LolScraperService:', err);
      return { data: null, reason: classifyError(err) };
    }
  },

  clearCache(teamA: string, teamB: string, startTimeIso?: string): void {
    MATCH_CACHE.delete(cacheKeyFor(teamA, teamB, startTimeIso));
  },

  async diagnose(
    teamA: string,
    teamB: string,
    startTimeIso?: string,
    leagueName?: string
  ): Promise<string> {
    const lines: string[] = [];
    lines.push(`Equipos: "${teamA}" vs "${teamB}"`);
    lines.push(`Liga: "${leagueName || '(vacía)'}"`);
    lines.push(`Fecha: ${startTimeIso || '(sin fecha)'}`);

    const base = startTimeIso ? new Date(startTimeIso) : new Date();
    const when = isNaN(base.getTime()) ? new Date() : base;
    const season = when.getFullYear() - 2010;
    const dateStr = dateOnly(when);
    lines.push(`Temporada gol.gg: S${season} (${dateStr})`);

    try {
      const tournaments = await fetchTournaments(season);
      lines.push(`Torneos en la temporada: ${tournaments.length}`);
      const ranked = tournaments
        .map((t) => ({
          t,
          score: overlapCount(leagueName || '', t.name) * 2 + (dateStr >= t.firstGame && dateStr <= t.lastGame ? 3 : 0),
        }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      lines.push(`Candidatos: ${ranked.map((r) => r.t.name).join(' | ') || '(ninguno)'}`);
    } catch (err) {
      lines.push(`Error lista de torneos: ${String((err as Error)?.message || err).slice(0, 120)}`);
    }

    try {
      const found = await findSeriesGameId(teamA, teamB, startTimeIso, leagueName || '');
      lines.push(found ? `Encontrado: ${found.tournamentName} → game ${found.gameId}` : 'No se encontró el partido');
    } catch (err) {
      lines.push(`Error búsqueda: ${String((err as Error)?.message || err).slice(0, 120)}`);
    }

    return lines.join('\n');
  },
};
