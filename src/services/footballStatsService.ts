/**
 * Stats de fútbol en directo (minuto, goles, tarjetas, cambios y alineaciones)
 * a partir de la API pública de FotMob.
 *
 * ¿Por qué FotMob y no Football-Data? El plan gratuito de Football-Data NO
 * incluye goles, tarjetas, cambios, alineaciones ni minuto en directo (eso
 * requiere el plan "Free + Deep Data" de 29 €/mes). FotMob publica todo eso
 * sin clave y para prácticamente todas las competiciones, así que se usa como
 * fuente principal de la pestaña Stats; el detalle de Football-Data queda como
 * respaldo para quien tenga plan de pago.
 *
 * Flujo:
 *  1. `getMatchDetail(match)`: busca el partido del día en FotMob por nombres
 *     de equipo y fecha, y mapea su detalle al modelo interno.
 *  2. `enrichFootballMatches(matches)`: completa minuto y marcador en directo
 *     de los partidos en vivo de la lista (una sola consulta al día).
 *
 * Todo con timeouts, caché en memoria y tolerancia a fallos: si FotMob falla,
 * la app sigue funcionando con lo que traiga Football-Data.
 */
import { Platform } from 'react-native';
import {
  FootballBooking,
  FootballGoalCancel,
  FootballLineupPlayer,
  FootballMatchDetail,
  FootballSubstitution,
  FootballTeamLineup,
  FootballTeamStats,
  FootballUnavailablePlayer,
  Match,
  MatchGoal,
} from './types';

const FOTMOB_BASE = 'https://www.fotmob.com';
const FOTMOB_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 12000;

/** Caché de los partidos de un día (la lista cambia en directo). */
const DAILY_CACHE = new Map<string, { ts: number; matches: any[] }>();
/** Caché del id de FotMob por enfrentamiento + fecha. */
const MATCH_ID_CACHE = new Map<
  string,
  { ts: number; found: { id: number; reversed: boolean } | null }
>();
/** Caché del detalle por id de FotMob. */
const DETAIL_CACHE = new Map<number, { ts: number; live: boolean; detail: FootballMatchDetail }>();

const DAILY_TTL_MS = 45 * 1000;
const DETAIL_LIVE_TTL_MS = 45 * 1000;
const DETAIL_STATIC_TTL_MS = 5 * 60 * 1000;
const MATCH_ID_HIT_TTL_MS = 5 * 60 * 1000;
const MATCH_ID_MISS_TTL_MS = 2 * 60 * 1000;

/** Posición genérica de FotMob (`usualPlayingPositionId`) al castellano. */
const POSITION_BY_USUAL: Record<number, string> = {
  0: 'Portero',
  1: 'Defensa',
  2: 'Centrocampista',
  3: 'Delantero',
};

/**
 * Petición GET a FotMob (directa en nativo, vía proxy del dev server en web).
 * Reintenta una vez ante timeout/red (el primer arranque del dev server o la
 * red móvil pueden tardar más de lo normal) y devuelve null si falla.
 */
async function fotmobFetch(path: string, retries = 1): Promise<any | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const url = `${FOTMOB_BASE}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const target =
        Platform.OS === 'web' ? `/api/proxy/fotmob?url=${encodeURIComponent(url)}` : url;
      const res = await fetch(target, {
        signal: controller.signal,
        headers: { 'User-Agent': FOTMOB_UA, Accept: 'application/json' },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      if (attempt >= retries) {
        console.warn(`FotMob (${path}) falló:`, err);
        return null;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fechas y nombres
// ---------------------------------------------------------------------------

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Fecha UTC de un ISO en formato YYYYMMDD (el que usa FotMob). */
function dateKeyFromIso(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

/** Desplaza una clave YYYYMMDD en ±días. */
function shiftDateKey(key: string, days: number): string {
  const d = new Date(
    Date.UTC(parseInt(key.slice(0, 4), 10), parseInt(key.slice(4, 6), 10) - 1, parseInt(key.slice(6, 8), 10))
  );
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

/** Palabras de categorías inferiores que no deben casar con el equipo sénior. */
const YOUTH_WORDS = /\b(u1[5-9]|u2[0-3]|youth|women|feminine|femenino|femenina|reserves?)\b/i;

function teamKey(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(
      (w) =>
        w &&
        ![
          'fc', 'cf', 'sk', 'sc', 'ac', 'afc', 'cd', 'ud', 'rc', 'ca', 'sd', 'rcd', 'cp',
          'club', 'de', 'the', 'as', 'ss', 'ssc', 'us', 'sv', 'vfb', 'vfl', 'tsg', 'bsc',
          'fk', 'nk', 'bk', 'if', 'cs', 'kf', 'kfc', 'cp',
        ].includes(w)
    )
    .join('');
}

/** 0 = no casa, 1 = clave exacta, 0.8 = contención (evita juveniles/féminas). */
function nameScore(candidate: string, target: string): number {
  const cRaw = candidate || '';
  const tRaw = target || '';
  if (YOUTH_WORDS.test(cRaw) && !YOUTH_WORDS.test(tRaw)) return 0;
  const c = teamKey(cRaw);
  const t = teamKey(tRaw);
  if (!c || !t) return 0;
  if (c === t) return 1;
  if (c.length >= 4 && t.length >= 4 && (c.includes(t) || t.includes(c))) return 0.8;
  return 0;
}

interface FoundMatch {
  match: any;
  reversed: boolean;
  score: number;
}

/** ¿El ranking [score, sameDay, started, -tiempo] de `a` es mejor que el de `b`? */
function isRankBetter(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

/** Elige el partido del día que corresponde a los dos equipos (o null). */
function pickMatch(
  dailyMatches: any[],
  teamAName: string,
  teamBName: string,
  startTimeIso?: string
): FoundMatch | null {
  const wanted = dateKeyFromIso(startTimeIso);
  const startMs = startTimeIso ? new Date(startTimeIso).getTime() : NaN;
  let best: FoundMatch | null = null;
  let bestRank: number[] = [];

  for (const m of dailyMatches) {
    const home = m?.home?.name;
    const away = m?.away?.name;
    if (!home || !away) continue;

    const direct = nameScore(home, teamAName) * nameScore(away, teamBName);
    const reversed = nameScore(home, teamBName) * nameScore(away, teamAName);
    const score = Math.max(direct, reversed);
    if (score < 0.64) continue;

    // Preferencia por el que ya empezó y por la fecha/hora más cercana.
    const utc = m?.status?.utcTime ? new Date(m.status.utcTime).getTime() : NaN;
    const started = m?.status?.started ? 1 : 0;
    const sameDay =
      wanted && m?.status?.utcTime && dateKeyFromIso(m.status.utcTime) === wanted ? 1 : 0;
    const timeDelta =
      isNaN(utc) || isNaN(startMs) ? Number.MAX_SAFE_INTEGER : Math.abs(utc - startMs);

    const rank = [score, sameDay, started, -timeDelta];
    if (!best || isRankBetter(rank, bestRank)) {
      best = { match: m, reversed: reversed > direct, score };
      bestRank = rank;
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Descargas
// ---------------------------------------------------------------------------

/** Partidos de un día en FotMob (aplanados, con el nombre de la liga). */
async function fetchDailyMatches(dateKey: string): Promise<any[] | null> {
  const cached = DAILY_CACHE.get(dateKey);
  if (cached && Date.now() - cached.ts < DAILY_TTL_MS) return cached.matches;

  const data = await fotmobFetch(`/api/data/matches?date=${dateKey}`);
  if (!data) return cached ? cached.matches : null;

  const matches: any[] = [];
  for (const league of Array.isArray(data?.leagues) ? data.leagues : []) {
    for (const m of Array.isArray(league?.matches) ? league.matches : []) {
      matches.push({ ...m, _leagueName: league?.name });
    }
  }
  DAILY_CACHE.set(dateKey, { ts: Date.now(), matches });
  if (DAILY_CACHE.size > 12) {
    const oldest = DAILY_CACHE.keys().next().value;
    if (oldest) DAILY_CACHE.delete(oldest);
  }
  return matches;
}

/** Busca el id de FotMob del partido (probando la fecha de inicio y ±1 día). */
async function findFotmobMatch(
  teamAName: string,
  teamBName: string,
  startTimeIso?: string,
  force = false
): Promise<{ id: number; reversed: boolean } | null> {
  const baseKey = dateKeyFromIso(startTimeIso) || todayKey();
  const cacheKey = `${baseKey}|${teamKey(teamAName)}|${teamKey(teamBName)}`;
  const cached = MATCH_ID_CACHE.get(cacheKey);
  if (!force && cached) {
    const ttl = cached.found ? MATCH_ID_HIT_TTL_MS : MATCH_ID_MISS_TTL_MS;
    if (Date.now() - cached.ts < ttl) return cached.found;
  }

  const dateKeys = [...new Set([baseKey, shiftDateKey(baseKey, -1), shiftDateKey(baseKey, 1)])];
  for (const dateKey of dateKeys) {
    const daily = await fetchDailyMatches(dateKey);
    if (!daily) continue;
    const hit = pickMatch(daily, teamAName, teamBName, startTimeIso);
    if (hit) {
      const found = { id: Number(hit.match.id), reversed: hit.reversed };
      MATCH_ID_CACHE.set(cacheKey, { ts: Date.now(), found });
      return found;
    }
  }

  MATCH_ID_CACHE.set(cacheKey, { ts: Date.now(), found: null });
  if (MATCH_ID_CACHE.size > 200) {
    const oldest = MATCH_ID_CACHE.keys().next().value;
    if (oldest) MATCH_ID_CACHE.delete(oldest);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Mapeo del detalle
// ---------------------------------------------------------------------------

/** "77’" o "45+3’" -> { minute, injuryTime }. */
function cleanMinuteParts(short: unknown): { minute: number; injuryTime: number | null } | null {
  const cleaned = String(short || '').replace(/[^\d+]/g, '');
  if (!cleaned) return null;
  const [m, extra] = cleaned.split('+');
  const minute = parseInt(m, 10);
  if (isNaN(minute)) return null;
  const injuryTime = extra ? parseInt(extra, 10) : NaN;
  return { minute, injuryTime: isNaN(injuryTime) ? null : injuryTime };
}

// ---------------------------------------------------------------------------
// Competiciones completas (partidos y clasificación) de FotMob
// ---------------------------------------------------------------------------

/** Partido de la temporada de una competición en FotMob (`fixtures`). */
export interface FotmobLeagueMatch {
  id: number;
  homeId?: number;
  homeName: string;
  homeShortName?: string;
  homeLogo?: string;
  awayId?: number;
  awayName: string;
  awayShortName?: string;
  awayLogo?: string;
  utcTime?: string;
  started: boolean;
  finished: boolean;
  scoreA?: number;
  scoreB?: number;
}

/** Fila de clasificación de una competición de FotMob (`table`). */
export interface FotmobLeagueStandingRow {
  position: number;
  teamId?: number;
  teamName: string;
  shortName?: string;
  teamLogo?: string;
  played: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

/** Datos de una competición en FotMob: partidos de la temporada y tabla. */
export interface FotmobLeagueData {
  leagueId: number;
  leagueName: string;
  season?: string;
  matches: FotmobLeagueMatch[];
  standings?: FotmobLeagueStandingRow[];
}

/** "1 - 4" o "6-0" -> { a: 1, b: 4 }. */
function parseScoreStr(value: unknown): { a: number; b: number } | null {
  const m = String(value || '').match(/(\d+)\s*-\s*(\d+)/);
  if (!m) return null;
  return { a: parseInt(m[1], 10), b: parseInt(m[2], 10) };
}

/** URL del escudo de un equipo en FotMob. */
export function fotmobTeamLogo(teamId?: number): string | undefined {
  return typeof teamId === 'number' && teamId > 0
    ? `https://images.fotmob.com/image_resources/logo/teamlogo/${teamId}.png`
    : undefined;
}

/** Caché del id de FotMob por nombre de competición. */
const LEAGUE_ID_CACHE = new Map<string, { ts: number; id: number | null }>();
/** Caché de los datos (partidos + tabla) por id de competición. */
const LEAGUE_DATA_CACHE = new Map<number, { ts: number; data: FotmobLeagueData }>();
const LEAGUE_ID_HIT_TTL_MS = 24 * 60 * 60 * 1000;
const LEAGUE_ID_MISS_TTL_MS = 30 * 60 * 1000;
const LEAGUE_DATA_TTL_MS = 5 * 60 * 1000;

/** Nombres de búsqueda alternativos para competiciones con otro nombre en FotMob. */
const FOTMOB_LEAGUE_SEARCH_ALIASES: Record<string, string> = {
  'laliga hypermotion': 'LaLiga2',
  'segunda division': 'LaLiga2',
};

/** Clave de nombre de competición (sin siglas de confederación ni acentos). */
function leagueKey(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(uefa|conmebol|afc|caf|concacaf|ofc)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 0 = no casa, 1 = misma clave, 0.85 = contención (evita filiales/femeninas). */
function leagueNameScore(candidate: string, target: string): number {
  const cRaw = candidate || '';
  const tRaw = target || '';
  if (YOUTH_WORDS.test(cRaw) && !YOUTH_WORDS.test(tRaw)) return 0;
  if (/qualification|qualifying/i.test(cRaw) && !/qualification|qualifying/i.test(tRaw)) return 0;
  const c = leagueKey(cRaw);
  const t = leagueKey(tRaw);
  if (!c || !t) return 0;
  if (c === t) return 1;
  if (c.length >= 5 && t.length >= 5 && (c.includes(t) || t.includes(c))) return 0.85;
  return 0;
}

/** Busca el id de FotMob de una competición por su nombre (o null). */
async function findFotmobLeague(name: string): Promise<number | null> {
  const key = leagueKey(name);
  if (!key) return null;
  const cached = LEAGUE_ID_CACHE.get(key);
  if (cached) {
    const ttl = cached.id ? LEAGUE_ID_HIT_TTL_MS : LEAGUE_ID_MISS_TTL_MS;
    if (Date.now() - cached.ts < ttl) return cached.id;
  }

  const aliasTerm = FOTMOB_LEAGUE_SEARCH_ALIASES[key];
  const term = aliasTerm || name;
  // Con alias, la comparación se hace contra el término buscado (p. ej.
  // "LaLiga2" para LaLiga Hypermotion), no contra el nombre del catálogo.
  const target = aliasTerm || name;
  const data = await fotmobFetch(
    `/api/data/search/suggest?term=${encodeURIComponent(term)}&lang=en`
  );
  // El buscador devuelve grupos ([{ title, suggestions }]) o, en algunas
  // respuestas, una única lista de sugerencias; se aceptan ambas formas.
  const groups: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.suggestions)
    ? [{ suggestions: data.suggestions }]
    : [];
  const suggestions: any[] = groups.flatMap((g) =>
    Array.isArray(g?.suggestions) ? g.suggestions : []
  );
  let best: { id: number; score: number } | null = null;
  for (const s of suggestions) {
    if (String(s?.type || '') !== 'league') continue;
    const id = Number(s.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    const score = leagueNameScore(String(s.name || ''), target);
    if (score > 0 && (!best || score > best.score)) best = { id, score };
  }
  const found = best ? best.id : null;
  LEAGUE_ID_CACHE.set(key, { ts: Date.now(), id: found });
  if (LEAGUE_ID_CACHE.size > 120) {
    const oldest = LEAGUE_ID_CACHE.keys().next().value;
    if (oldest) LEAGUE_ID_CACHE.delete(oldest);
  }
  return found;
}

/** Partidos de la temporada y clasificación de una competición de FotMob. */
async function fetchFotmobLeagueData(leagueId: number): Promise<FotmobLeagueData | null> {
  const cached = LEAGUE_DATA_CACHE.get(leagueId);
  if (cached && Date.now() - cached.ts < LEAGUE_DATA_TTL_MS) return cached.data;

  const [fixturesRes, tableRes] = await Promise.all([
    fotmobFetch(`/api/data/leagues?id=${leagueId}&tab=fixtures&type=fixtures`),
    fotmobFetch(`/api/data/leagues?id=${leagueId}&tab=table`),
  ]);
  if (!fixturesRes && !tableRes) return cached ? cached.data : null;

  const details = fixturesRes?.details || tableRes?.table?.[0]?.data || {};
  const season =
    typeof details?.selectedSeason === 'string' && details.selectedSeason
      ? details.selectedSeason
      : undefined;
  const leagueName =
    typeof details?.name === 'string' && details.name
      ? details.name
      : typeof tableRes?.table?.[0]?.data?.leagueName === 'string'
      ? tableRes.table[0].data.leagueName
      : '';

  const matches: FotmobLeagueMatch[] = [];
  const rawMatches = fixturesRes?.fixtures?.allMatches;
  if (Array.isArray(rawMatches)) {
    for (const m of rawMatches) {
      if (!m || m.status?.cancelled) continue;
      const id = Number(m.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      const homeId = Number(m.home?.id) || undefined;
      const awayId = Number(m.away?.id) || undefined;
      const score = parseScoreStr(m.status?.scoreStr);
      matches.push({
        id,
        homeId,
        homeName: String(m.home?.name || ''),
        homeShortName: m.home?.shortName ? String(m.home.shortName) : undefined,
        homeLogo: fotmobTeamLogo(homeId),
        awayId,
        awayName: String(m.away?.name || ''),
        awayShortName: m.away?.shortName ? String(m.away.shortName) : undefined,
        awayLogo: fotmobTeamLogo(awayId),
        utcTime: typeof m.status?.utcTime === 'string' ? m.status.utcTime : undefined,
        started: Boolean(m.status?.started),
        finished: Boolean(m.status?.finished),
        scoreA: score?.a,
        scoreB: score?.b,
      });
    }
  }

  const standings: FotmobLeagueStandingRow[] = [];
  const tableAll = tableRes?.table?.[0]?.data?.table?.all;
  if (Array.isArray(tableAll)) {
    for (const row of tableAll) {
      if (!row || typeof row.name !== 'string' || !row.name) continue;
      const teamId = Number(row.id) || undefined;
      const goals = parseScoreStr(row.scoresStr);
      standings.push({
        position: Number(row.idx) || standings.length + 1,
        teamId,
        teamName: row.name,
        shortName: row.shortName ? String(row.shortName) : undefined,
        teamLogo: fotmobTeamLogo(teamId),
        played: Number(row.played) || 0,
        won: Number(row.wins) || 0,
        draw: Number(row.draws) || 0,
        lost: Number(row.losses) || 0,
        points: Number(row.pts) || 0,
        goalsFor: goals?.a ?? 0,
        goalsAgainst: goals?.b ?? 0,
        goalDifference: Number(row.goalConDiff) || 0,
      });
    }
  }

  const data: FotmobLeagueData = {
    leagueId,
    leagueName,
    season,
    matches,
    standings: standings.length > 0 ? standings : undefined,
  };
  LEAGUE_DATA_CACHE.set(leagueId, { ts: Date.now(), data });
  if (LEAGUE_DATA_CACHE.size > 40) {
    const oldest = LEAGUE_DATA_CACHE.keys().next().value;
    if (oldest) LEAGUE_DATA_CACHE.delete(oldest);
  }
  return data;
}

/** Motivos de baja de FotMob (`unavailability.type`) al castellano. */
const UNAVAILABLE_REASON_ES: Record<string, string> = {
  injury: 'Lesión',
  suspension: 'Sanción',
  doubt: 'Duda',
  illness: 'Enfermedad',
  international: 'Con su selección',
};

function mapLineup(team: any): FootballTeamLineup | undefined {
  const mapPlayer = (p: any): FootballLineupPlayer | null => {
    if (!p || typeof p.name !== 'string' || !p.name.trim()) return null;
    const num = parseInt(String(p.shirtNumber ?? ''), 10);
    const position = POSITION_BY_USUAL[Number(p.usualPlayingPositionId)];
    const rating = typeof p?.performance?.rating === 'number' ? p.performance.rating : null;
    // FotMob publica el hueco del jugador en el campo (`verticalLayout`): x/y
    // son ya el CENTRO de la ficha (el portero va en x=0.5) y 0 en el eje Y es
    // su propia portería; la vista decide la orientación al pintarlo.
    const vl = p?.verticalLayout;
    const hasLayout =
      vl && typeof vl.x === 'number' && typeof vl.y === 'number';
    return {
      id: p.id,
      name: p.name,
      position,
      shirtNumber: isNaN(num) ? null : num,
      rating,
      pitchX: hasLayout ? vl.x : undefined,
      pitchY: hasLayout ? vl.y : undefined,
    };
  };

  const starters = (Array.isArray(team?.starters) ? team.starters : [])
    .map(mapPlayer)
    .filter((p: FootballLineupPlayer | null): p is FootballLineupPlayer => p !== null);
  const bench = (Array.isArray(team?.subs) ? team.subs : [])
    .map(mapPlayer)
    .filter((p: FootballLineupPlayer | null): p is FootballLineupPlayer => p !== null);
  const formation = typeof team?.formation === 'string' && team.formation ? team.formation : undefined;
  const coach = typeof team?.coach?.name === 'string' ? team.coach.name : undefined;

  const unavailable: FootballUnavailablePlayer[] = (
    Array.isArray(team?.unavailable) ? team.unavailable : []
  )
    .map((u: any): FootballUnavailablePlayer | null => {
      if (!u || typeof u.name !== 'string' || !u.name.trim()) return null;
      const type = String(u?.unavailability?.type || '').toLowerCase();
      return { name: u.name, reason: UNAVAILABLE_REASON_ES[type] };
    })
    .filter((u: FootballUnavailablePlayer | null): u is FootballUnavailablePlayer => u !== null);

  if (starters.length === 0 && bench.length === 0 && !formation && !coach && unavailable.length === 0) {
    return undefined;
  }
  return { formation, coach, starters, bench, unavailable };
}

/** Mapea el JSON de `/api/data/matchDetails` al modelo interno. */
export function mapFotmobDetail(data: any, reversed: boolean): FootballMatchDetail {
  const status = data?.header?.status || {};
  const halfs = status.halfs || {};
  const started = Boolean(status.started);
  const finished = Boolean(status.finished);
  const paused =
    started && !finished && Boolean(halfs.firstHalfEnded) && !halfs.secondHalfStarted;
  const live = cleanMinuteParts(status?.liveTime?.short);

  const fotmobStatus = finished ? 'FINISHED' : paused ? 'PAUSED' : started ? 'IN_PLAY' : 'SCHEDULED';
  const minute = paused ? 45 : live?.minute ?? null;
  const injuryTime = paused ? null : live?.injuryTime ?? null;

  const sideFor = (isHome: boolean): 'A' | 'B' => (isHome !== reversed ? 'A' : 'B');

  const goals: MatchGoal[] = [];
  const bookings: FootballBooking[] = [];
  const substitutions: FootballSubstitution[] = [];
  const goalCancels: FootballGoalCancel[] = [];
  let halfTimeA: number | null = null;
  let halfTimeB: number | null = null;

  const events = data?.content?.matchFacts?.events?.events || [];
  for (const e of events) {
    if (typeof e?.time !== 'number') continue;

    if (e.type === 'Goal') {
      const situation = String(e?.shotmapEvent?.situation || '');
      const ownGoal = Boolean(e.ownGoal) || Boolean(e?.shotmapEvent?.isOwnGoal);
      const isPenalty =
        /penalty/i.test(situation) || /penalty/i.test(String(e?.goalDescription || ''));
      const newScore = Array.isArray(e.newScore) ? e.newScore : null;
      goals.push({
        minute: e.time,
        injuryTime:
          typeof e.overloadTime === 'number' && e.overloadTime > 0 ? e.overloadTime : null,
        scorer: e?.player?.name || e.nameStr,
        assist: e.assistInput || undefined,
        type: ownGoal ? 'OWN_GOAL' : isPenalty ? 'PENALTY' : 'REGULAR',
        team: sideFor(Boolean(e.isHome)),
        scoreA: newScore ? (reversed ? newScore[1] : newScore[0]) : undefined,
        scoreB: newScore ? (reversed ? newScore[0] : newScore[1]) : undefined,
      });
    } else if (e.type === 'Card') {
      const raw = String(e.card || '').toLowerCase();
      const card: FootballBooking['card'] = raw.includes('red')
        ? raw.includes('yellow')
          ? 'YELLOW_RED'
          : 'RED'
        : 'YELLOW';
      bookings.push({
        minute: e.time,
        injuryTime: null,
        card,
        player: e?.player?.name || e.nameStr,
        team: sideFor(Boolean(e.isHome)),
      });
    } else if (e.type === 'Substitution') {
      const playerIn = e?.swap?.[0]?.name;
      const playerOut = e?.swap?.[1]?.name;
      if (!playerIn && !playerOut) continue;
      substitutions.push({
        minute: e.time,
        injuryTime: null,
        playerIn,
        playerOut,
        team: sideFor(Boolean(e.isHome)),
      });
    } else if (e.type === 'VAR') {
      // Gol anulado por el VAR: clave estable del evento para no repetir el aviso.
      const decisionKeys: string[] = Array.isArray(e?.VAR?.decision?.key)
        ? e.VAR.decision.key.map((k: unknown) => String(k))
        : [];
      if (decisionKeys.includes('var_goal_cancelled')) {
        goalCancels.push({
          minute: e.time,
          injuryTime:
            typeof e.overloadTime === 'number' && e.overloadTime > 0 ? e.overloadTime : null,
          player: e?.player?.name || e.nameStr,
          team: sideFor(Boolean(e.isHome)),
          key: `cancel:${e.eventId ?? `${e.time}:${e?.player?.name || ''}`}`,
        });
      }
    } else if (e.type === 'Half' && halfTimeA === null) {
      if (typeof e.homeScore === 'number' && typeof e.awayScore === 'number') {
        halfTimeA = reversed ? e.awayScore : e.homeScore;
        halfTimeB = reversed ? e.homeScore : e.awayScore;
      }
    }
  }

  const homeLineup = mapLineup(data?.content?.lineup?.homeTeam);
  const awayLineup = mapLineup(data?.content?.lineup?.awayTeam);

  // Estadísticas: se aplanan todas las secciones y se toman las claves conocidas.
  const flatStats = new Map<string, any[]>();
  for (const section of data?.content?.stats?.Periods?.All?.stats || []) {
    for (const s of Array.isArray(section?.stats) ? section.stats : []) {
      if (s?.key && Array.isArray(s.stats) && !flatStats.has(s.key)) flatStats.set(s.key, s.stats);
    }
  }
  const statNum = (key: string, idx: 0 | 1): number | undefined => {
    const v = flatStats.get(key)?.[idx];
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return isNaN(n) ? undefined : n;
  };
  const mapStats = (idx: 0 | 1): FootballTeamStats | undefined => {
    const stats: FootballTeamStats = {
      ballPossession: statNum('BallPossesion', idx),
      shots: statNum('total_shots', idx),
      shotsOnGoal: statNum('ShotsOnTarget', idx),
      shotsOffGoal: statNum('ShotsOffTarget', idx),
      fouls: statNum('fouls', idx),
      cornerKicks: statNum('corners', idx),
      offsides: statNum('Offsides', idx),
      saves: statNum('keeper_saves', idx),
      yellowCards: statNum('yellow_cards', idx),
      redCards: statNum('red_cards', idx),
    };
    return Object.values(stats).some((v) => v !== undefined) ? stats : undefined;
  };

  const infoBox = data?.content?.matchFacts?.infoBox;
  const stadium = infoBox?.Stadium;
  const venue = stadium?.name
    ? `${stadium.name}${stadium.city ? `, ${stadium.city}` : ''}`
    : undefined;

  return {
    status: fotmobStatus,
    minute,
    injuryTime,
    halfTimeA,
    halfTimeB,
    duration: halfs.firstExtraHalfStarted ? 'EXTRA_TIME' : 'REGULAR',
    venue,
    referee: infoBox?.Referee?.text || undefined,
    goals,
    bookings,
    substitutions,
    goalCancels,
    lineupA: reversed ? awayLineup : homeLineup,
    lineupB: reversed ? homeLineup : awayLineup,
    statsA: mapStats(reversed ? 1 : 0),
    statsB: mapStats(reversed ? 0 : 1),
  };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export const FootballStatsService = {
  /**
   * Detalle completo del partido (minuto, cronología, alineaciones y stats)
   * desde FotMob. Devuelve null si el partido no está en FotMob o si la
   * consulta falla (la vista puede entonces caer a Football-Data).
   */
  async getMatchDetail(match: Match, force = false): Promise<FootballMatchDetail | null> {
    const found = await findFotmobMatch(
      match.teamA.name,
      match.teamB.name,
      match.startTimeIso,
      force
    );
    if (!found) return null;

    const cached = DETAIL_CACHE.get(found.id);
    if (!force && cached) {
      const ttl = cached.live ? DETAIL_LIVE_TTL_MS : DETAIL_STATIC_TTL_MS;
      if (Date.now() - cached.ts < ttl) return cached.detail;
    }

    const data = await fotmobFetch(`/api/data/matchDetails?matchId=${found.id}`);
    if (!data) return cached ? cached.detail : null;

    const detail = mapFotmobDetail(data, found.reversed);
    const live = detail.status === 'IN_PLAY' || detail.status === 'PAUSED';
    DETAIL_CACHE.set(found.id, { ts: Date.now(), live, detail });
    if (DETAIL_CACHE.size > 120) {
      const oldest = DETAIL_CACHE.keys().next().value;
      if (oldest) DETAIL_CACHE.delete(oldest);
    }
    return detail;
  },

  /**
   * Datos de una competición completa en FotMob (partidos de la temporada y
   * clasificación), buscándola por nombre. Es el respaldo para competiciones
   * que el plan de Football-Data no cubre (p. ej. la Europa League en el plan
   * gratuito) y no necesita token.
   */
  async getLeagueDataByName(name: string): Promise<FotmobLeagueData | null> {
    const leagueId = await findFotmobLeague(name);
    if (!leagueId) return null;
    return fetchFotmobLeagueData(leagueId);
  },

  /**
   * Completa minuto de juego y marcador real de los partidos de fútbol en
   * directo (Football-Data va con retraso en el plan gratuito). Una sola
   * consulta a la lista del día, cacheada; si FotMob falla, no toca nada.
   */
  async enrichFootballMatches(matches: Match[]): Promise<void> {
    const live = matches.filter((m) => m.game === 'FÚTBOL' && m.status === 'LIVE');
    if (live.length === 0) return;

    // Presupuesto corto: la carga de la lista no debe esperar más de ~6 s por
    // FotMob. Si no llega a tiempo, se sigue con los datos de Football-Data
    // (la petición continúa en segundo plano y deja la caché lista).
    const daily = await Promise.race([
      fetchDailyMatches(todayKey()),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
    ]);
    if (!daily || daily.length === 0) return;

    for (const m of live) {
      const hit = pickMatch(daily, m.teamA.name, m.teamB.name, m.startTimeIso);
      if (!hit) continue;

      const fm = hit.match;
      const homeScore = typeof fm?.home?.score === 'number' ? fm.home.score : undefined;
      const awayScore = typeof fm?.away?.score === 'number' ? fm.away.score : undefined;
      const scoreA = hit.reversed ? awayScore : homeScore;
      const scoreB = hit.reversed ? homeScore : awayScore;
      if (typeof scoreA === 'number') m.teamA.score = scoreA;
      if (typeof scoreB === 'number') m.teamB.score = scoreB;

      const parts = cleanMinuteParts(fm?.status?.liveTime?.short);
      const minuteLabel = parts
        ? `${parts.minute}${parts.injuryTime ? `+${parts.injuryTime}` : ''}'`
        : fm?.status?.started
        ? 'En Juego'
        : '';
      if (minuteLabel) {
        m.liveRoundScore = {
          scoreA: typeof scoreA === 'number' ? scoreA : 0,
          scoreB: typeof scoreB === 'number' ? scoreB : 0,
          roundOrTime: minuteLabel,
        };
      }
    }
  },
};
