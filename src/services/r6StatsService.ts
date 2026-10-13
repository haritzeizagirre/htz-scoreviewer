import { Platform } from 'react-native';
import { getText as nativeGetText } from '../../modules/htz-http/src/HtzHttpModule';
import { Match, R6MatchData, R6MapData, R6PlayerStats, R6VetoRow } from './types';

// Memoria caché para evitar consultas redundantes a la web
const R6_CACHE = new Map<string, R6MatchData>();

// Último motivo de fallo (diagnóstico para mostrar en la UI)
let lastError: string | null = null;

/**
 * Convierte un nombre de equipo a slug de Gezzly (minúsculas, separadas por guiones)
 */
function slugify(name: string): string {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Genera los slugs candidatos de un equipo (alias conocidos + slug estándar)
 */
function normalizeTeamKey(name: string): string[] {
  const clean = (name || '').toLowerCase().trim();
  const keys: string[] = [];

  // Alias conocidos de R6
  if (clean.includes('falcons')) keys.push('team-falcons', 'falcons');
  else if (clean.includes('heretics')) keys.push('team-heretics', 'heretics');
  else if (clean.includes('secret')) keys.push('team-secret', 'secret');
  else if (clean.includes('rbls') || clean.includes('rebels')) keys.push('rebels-gaming', 'rebels');
  else if (clean.includes('virtus')) keys.push('virtus-pro');
  else if (clean.includes('geekay')) keys.push('geekay-esports', 'geekay');
  else if (clean.includes('twisted')) keys.push('twisted-minds');
  else if (clean.includes('shifters')) keys.push('shifters');
  else if (clean.includes('g2')) keys.push('g2-esports', 'g2');
  else if (clean.includes('fnatic')) keys.push('fnatic');
  else if (clean.includes('shopify')) keys.push('shopify-rebellion');
  else if (clean.includes('darkzero')) keys.push('darkzero-esports', 'darkzero');
  else if (clean.includes('wildcard')) keys.push('wildcard-gaming');
  else if (clean.includes('mibr')) keys.push('mibr-los', 'mibr');
  else if (clean.includes('liquid')) keys.push('team-liquid', 'liquid');

  const slug = slugify(clean);
  if (slug && !keys.includes(slug)) keys.push(slug);

  // Variantes quitando/añadiendo sufijos y prefijos habituales
  // (p. ej. "Team BDS" -> "bds", "Wolves Esports" -> "wolves")
  const stripped = slug
    .replace(/-(esports|gaming|team|e-sports|esport|club|academy)$/, '')
    .replace(/^(team|club)-/, '');
  if (stripped && !keys.includes(stripped)) keys.push(stripped);
  if (slug && !slug.startsWith('team-') && !keys.includes(`team-${slug}`)) {
    keys.push(`team-${slug}`);
  }

  return keys;
}

/**
 * Normaliza un nombre para comparaciones tolerantes ("Virtus.pro" == "Virtus Pro")
 */
function normalizeName(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Descarga HTML de una URL de Gezzly manejando proxy en web y petición directa en móvil
 */
const isCloudflareChallenge = (html: string): boolean =>
  /Just a moment|cf-chl|Attention Required|Checking your browser/i.test(html);

const GEZZLY_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Referer: 'https://www.gezzly.gg/',
  'Upgrade-Insecure-Requests': '1',
};

/** `fetch` con límite de tiempo (evita cuelgues si la fuente no responde). */
async function fetchWithTimeout(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...(init || {}), signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fallback con `fetch`: reintenta si el cliente devuelve una respuesta
 * informacional (1xx, p. ej. 103 Early Hints) en lugar de la final.
 */
async function fetchGezzlyWithRetries(targetUrl: string, attempts = 3): Promise<string> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const res = await fetchWithTimeout(targetUrl, 8000, { headers: GEZZLY_HEADERS });
    if (res.status >= 100 && res.status < 200) {
      lastStatus = res.status;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      continue;
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} al conectar con Gezzly`);
    }
    return res.text();
  }
  throw new Error(`HTTP ${lastStatus} (respuesta informacional) al conectar con Gezzly`);
}

/**
 * Descarga HTML de una URL de Gezzly.
 *  - Web: proxy de Metro (la petición sale desde el servidor).
 *  - Android: módulo nativo `htz-http` (HTTP/1.1 + ignora 1xx); si no está
 *    disponible, `fetch` con reintentos.
 */
async function fetchGezzlyHtml(targetUrl: string): Promise<string> {
  if (Platform.OS === 'web') {
    const res = await fetchWithTimeout(`/api/proxy/gezzly?url=${encodeURIComponent(targetUrl)}`, 8000);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} al conectar con Gezzly`);
    }
    const html = await res.text();
    if (isCloudflareChallenge(html)) {
      throw new Error('Bloqueado por Cloudflare (challenge)');
    }
    return html;
  }

  let html: string;
  try {
    html = await nativeGetText(targetUrl);
  } catch {
    html = await fetchGezzlyWithRetries(targetUrl);
  }

  if (isCloudflareChallenge(html)) {
    throw new Error('Bloqueado por Cloudflare (challenge)');
  }
  return html;
}

/**
 * Busca la URL del partido en Gezzly según los nombres de los dos equipos.
 * Primero intenta construir la URL directa ({slugA}-{slugB}-{fecha}) si se conoce
 * la fecha del partido; después recorre los listados públicos.
 */
async function findMatchUrl(
  teamA: string,
  teamB: string,
  startTimeIso?: string
): Promise<string | null> {
  const keysA = normalizeTeamKey(teamA);
  const keysB = normalizeTeamKey(teamB);

  // 1. Construcción directa de la URL con la fecha del partido (UTC, ±1 día)
  if (startTimeIso) {
    const base = new Date(startTimeIso);
    if (!isNaN(base.getTime())) {
      const dayMs = 24 * 3600 * 1000;
      for (const offset of [0, -1, 1]) {
        const d = new Date(base.getTime() + offset * dayMs);
        const dateStr = d.toISOString().slice(0, 10);
        for (const a of keysA) {
          for (const b of keysB) {
            const candidate = `https://www.gezzly.gg/match/${a}-${b}-${dateStr}`;
            try {
              const html = await fetchGezzlyHtml(candidate);
              // Gezzly responde 200 incluso en URLs inexistentes ("soft 404"),
              // con <title>Match Not Found - Gezzly</title>. Hay que descartarlo
              // mirando el título (el texto "Match not found" también aparece en
              // un componente del payload de las fichas reales).
              if (html && !isGezzlyNotFound(html)) {
                return candidate;
              }
            } catch {
              // URL no válida, probar siguiente combinación
            }
          }
        }
      }
    }
  }

  // 2. Listados públicos de Gezzly (partidos actuales, en vivo y calendario)
  const listings = [
    'https://www.gezzly.gg/matches',
    'https://www.gezzly.gg/r6-live-scores',
    'https://www.gezzly.gg/r6-schedule',
  ];

  for (const listing of listings) {
    try {
      const html = await fetchGezzlyHtml(listing);
      const links = [...new Set([...html.matchAll(/href="(\/match\/[^"]+)"/g)].map((m) => m[1]))];

      for (const link of links) {
        const target = link.replace(/^\/match\//, '');
        const strictMatch =
          keysA.some((a) => keysB.some((b) => target.startsWith(`${a}-${b}-`) || target.startsWith(`${b}-${a}-`)));
        if (strictMatch) {
          return `https://www.gezzly.gg${link}`;
        }
      }
    } catch (err) {
      console.warn(`Error buscando en ${listing}:`, err);
    }
  }

  // 3. Coincidencia relajada (los slugs de Gezzly pueden contener variantes)
  for (const listing of listings) {
    try {
      const html = await fetchGezzlyHtml(listing);
      const links = [...new Set([...html.matchAll(/href="(\/match\/[^"]+)"/g)].map((m) => m[1]))];
      for (const link of links) {
        const target = link.replace(/^\/match\//, '');
        const looseMatch =
          keysA.some((a) => target.includes(a)) && keysB.some((b) => target.includes(b));
        if (looseMatch) {
          return `https://www.gezzly.gg${link}`;
        }
      }
    } catch {
      // Ignorar errores de listados secundarios
    }
  }

  return null;
}

/**
 * Extrae un array JSON balanceado cuyo primer carácter está justo antes del final
 * de `needle` (needle debe terminar en '['). Robusto frente a referencias del
 * payload React Flight de Next.js.
 */
function extractArrayAfter(text: string, needle: string, fromIndex = 0): { json: string; end: number } | null {
  const idx = text.indexOf(needle, fromIndex);
  if (idx === -1) return null;
  const start = idx + needle.length - 1;
  if (text[start] !== '[') return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === '\\') {
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return { json: text.substring(start, i + 1), end: i + 1 };
    }
  }
  return null;
}

/**
 * Extrae un objeto JSON balanceado cuyo primer carácter '{' está justo después
 * de `needle` (needle debe terminar en '{').
 */
function extractObjectAfter(text: string, needle: string, fromIndex = 0): { json: string; end: number } | null {
  const idx = text.indexOf(needle, fromIndex);
  if (idx === -1) return null;
  const start = idx + needle.length - 1;
  if (text[start] !== '{') return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === '\\') {
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return { json: text.substring(start, i + 1), end: i + 1 };
    }
  }
  return null;
}

/**
 * Recupera el payload RSC (React Flight) de Next.js concatenando los pushes de __next_f
 */
function extractRscPayload(html: string): string {
  const pushes = [...html.matchAll(/self\.__next_f\.push\(\[1,(".*?")\]\)/gs)].map((m) => m[1]);
  let payload = '';
  for (const p of pushes) {
    try {
      payload += JSON.parse(p);
    } catch {
      // Chunk no parseable, ignorar
    }
  }
  return payload;
}

// ---- Formateadores de stats R6 ----
const fmtNum = (v: unknown): string => (v === null || v === undefined ? '-' : String(v));
const fmtDiff = (v: unknown): string => {
  if (v === null || v === undefined) return '-';
  const n = Number(v);
  return n > 0 ? `+${n}` : String(n);
};
const fmtPct = (v: unknown): string => (v === null || v === undefined ? '-' : `${v}%`);
const fmt1 = (v: unknown): string => {
  if (v === null || v === undefined) return '-';
  const n = Number(v);
  return isNaN(n) ? '-' : n.toFixed(1);
};

interface RawR6Player {
  handle?: string;
  avatarUrl?: string | null;
  kills?: number | null;
  deaths?: number | null;
  entryKills?: number | null;
  entryDeaths?: number | null;
  entryDiff?: number | null;
  kpr?: number | null;
  hsPct?: number | null;
  kost?: number | null;
  srv?: number | null;
  eps?: number | null;
}

function toPlayerStats(raw: RawR6Player): R6PlayerStats {
  const kills = raw.kills ?? 0;
  const deaths = raw.deaths ?? 0;
  return {
    name: raw.handle || '-',
    avatarUrl: raw.avatarUrl || undefined,
    kills: fmtNum(raw.kills),
    deaths: fmtNum(raw.deaths),
    kdDiff: fmtDiff(kills - deaths),
    entryKills: fmtNum(raw.entryKills),
    entryDeaths: fmtNum(raw.entryDeaths),
    entryDiff: fmtDiff(raw.entryDiff ?? (raw.entryKills ?? 0) - (raw.entryDeaths ?? 0)),
    kpr: fmt1(raw.kpr),
    hsPercent: fmtPct(raw.hsPct),
    kost: fmtPct(raw.kost),
    srv: fmtPct(raw.srv),
    eps: fmtNum(raw.eps),
  };
}

/**
 * Parsea el HTML de una ficha de partido de Gezzly (payload RSC de Next.js).
 * Las stats llegan como parejas de arrays (home, away): la primera pareja es el
 * cómputo global y las siguientes, cuando existen, son por mapa (en orden).
 */
function parseGezzlyMatchHtml(
  html: string,
  gezzlyUrl: string,
  teamAName: string,
  teamBName: string
): R6MatchData {
  const payload = extractRscPayload(html);

  // 1. Título y liga desde <title>: "HOME vs AWAY Result|Preview - LIGA"
  let matchTitle = '';
  let league = '';
  let homeName = '';
  let awayName = '';
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
  if (titleMatch) {
    const fullTitle = titleMatch[1].replace(/\s+/g, ' ').trim();
    const splitIdx = fullTitle.indexOf(' - ');
    const head = splitIdx > -1 ? fullTitle.slice(0, splitIdx) : fullTitle;
    if (splitIdx > -1) league = fullTitle.slice(splitIdx + 3).trim();
    const vsMatch = head.match(/^(.+?)\s+vs\.?\s+(.+?)(?:\s+(?:Result|Preview))?$/i);
    if (vsMatch) {
      homeName = vsMatch[1].trim();
      awayName = vsMatch[2].trim();
      matchTitle = `${homeName} vs ${awayName}`;
    } else {
      matchTitle = head;
    }
  }

  // 2. Orientación home/away respecto a teamAName/teamBName
  const normA = normalizeName(teamAName);
  const normB = normalizeName(teamBName);
  const homeIsTeamA =
    (homeName && normalizeName(homeName).includes(normA) && normA.length > 0) ||
    (awayName && normalizeName(awayName).includes(normB) && normB.length > 0);

  // 3. Mapas y veto desde los arrays "games" y "mapVotesRows"
  const mapNames: string[] = [];
  const mapScores: { home: string; away: string }[] = [];
  let gamesPos = 0;
  while (true) {
    const found = extractArrayAfter(payload, '"games":[', gamesPos);
    if (!found) break;
    gamesPos = found.end;
    try {
      const arr = JSON.parse(found.json);
      if (Array.isArray(arr) && arr.length > 0 && arr[0] && arr[0].name && arr[0].score) {
        const sorted = [...arr].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        for (const g of sorted) {
          mapNames.push(g.name);
          mapScores.push({ home: String(g.score?.home ?? '0'), away: String(g.score?.away ?? '0') });
        }
        break; // primer array de mapas válido
      }
    } catch {
      // Array no parseable, continuar
    }
  }

  const vetoRows: R6VetoRow[] = [];
  const vetoFound = extractArrayAfter(payload, '"mapVotesRows":[');
  if (vetoFound) {
    try {
      const arr = JSON.parse(vetoFound.json);
      if (Array.isArray(arr)) {
        for (const v of arr) {
          vetoRows.push({
            mapName: v.mapName || '-',
            action: v.action || '-',
            team: v.team || undefined,
          });
        }
      }
    } catch {
      // Veto no parseable, continuar sin él
    }
  }

  // 4. Stats de jugadores: objetos "stats":{ state, home:{players}, away:{players} }.
  //    El primero es el cómputo global; los siguientes, por mapa (en orden).
  //    (Gezzly cambió el formato: ya no hay arrays "players" con kills sueltos.)
  const statsPairs: { home: RawR6Player[]; away: RawR6Player[] }[] = [];
  let statsPos = 0;
  while (true) {
    const found = extractObjectAfter(payload, '"stats":{', statsPos);
    if (!found) break;
    statsPos = found.end;
    try {
      const obj = JSON.parse(found.json);
      const home = Array.isArray(obj?.home?.players) ? (obj.home.players as RawR6Player[]) : null;
      const away = Array.isArray(obj?.away?.players) ? (obj.away.players as RawR6Player[]) : null;
      const hasStats =
        !!home &&
        !!away &&
        home.length > 0 &&
        ('kills' in home[0] || 'deaths' in home[0]);
      if (hasStats) {
        statsPairs.push({ home, away });
      }
    } catch {
      // stats no parseable, continuar
    }
  }

  // Layout: 1 pareja = solo global; 1 + nºmapas = global + por mapa
  const mapsCount = mapNames.length;
  const pairCount = statsPairs.length;
  const hasPerMap = mapsCount > 0 && pairCount === mapsCount + 1;
  const globalPair = statsPairs[0];
  const perMapPairs = hasPerMap ? statsPairs.slice(1) : [];

  // 5. Construir los mapas finales (0 = cómputo global, 1..N = mapas)
  const finalMaps: R6MapData[] = [];
  const buildMap = (
    mapNumber: number,
    mapName: string,
    scoreA: string | undefined,
    scoreB: string | undefined,
    pair?: { home: RawR6Player[]; away: RawR6Player[] }
  ): R6MapData => {
    const byKills = (a: R6PlayerStats, b: R6PlayerStats): number =>
      (parseInt(b.kills, 10) || 0) - (parseInt(a.kills, 10) || 0);
    const homeStats = pair ? pair.home.map(toPlayerStats).sort(byKills) : [];
    const awayStats = pair ? pair.away.map(toPlayerStats).sort(byKills) : [];
    return {
      mapNumber,
      mapName,
      scoreA,
      scoreB,
      teamAStats: homeIsTeamA ? homeStats : awayStats,
      teamBStats: homeIsTeamA ? awayStats : homeStats,
    };
  };

  if (globalPair) {
    const totalA = mapScores.reduce(
      (s, m) => s + (parseInt(homeIsTeamA ? m.home : m.away, 10) || 0),
      0
    );
    const totalB = mapScores.reduce(
      (s, m) => s + (parseInt(homeIsTeamA ? m.away : m.home, 10) || 0),
      0
    );
    finalMaps.push(
      buildMap(
        0,
        'Todos los mapas',
        mapScores.length > 0 ? String(totalA) : undefined,
        mapScores.length > 0 ? String(totalB) : undefined,
        globalPair
      )
    );
  }

  mapNames.forEach((name, idx) => {
    const pair = hasPerMap ? perMapPairs[idx] : undefined;
    const score = mapScores[idx] || { home: '0', away: '0' };
    finalMaps.push(
      buildMap(
        idx + 1,
        name,
        homeIsTeamA ? score.home : score.away,
        homeIsTeamA ? score.away : score.home,
        pair
      )
    );
  });

  return {
    gezzlyUrl,
    matchTitle,
    league,
    vetoRows,
    maps: finalMaps,
  };
}

/**
 * Mapa de Gezzly con su marcador de rondas, ya orientado a teamA/teamB del
 * partido de la app (no al "home/away" de la web).
 */
export interface GezzlyMapScore {
  order: number;
  name: string;
  /** Rondas del equipo A del partido (undefined si la fuente no las trae). */
  scoreA?: number;
  scoreB?: number;
  /** Estado en Gezzly: "played" | "live" | "upcoming" | ... */
  state: string;
}

/** Variantes de slug de un equipo para construir URLs de Gezzly. */
function teamSlugVariants(name: string): string[] {
  const slug = slugify(name);
  if (!slug) return [];
  const stripped = slug
    .replace(/-(e-sports|esports|esport|gaming|team|club|academy)$/, '')
    .replace(/^(team|club)-/, '');
  const out: string[] = [slug];
  if (stripped && stripped !== slug) out.push(stripped);
  if (stripped && !out.includes(`team-${stripped}`)) out.push(`team-${stripped}`);
  if (stripped && !out.includes(`${stripped}-esports`)) out.push(`${stripped}-esports`);
  return out;
}

/** ¿El slug de un enlace de Gezzly contiene a este equipo? (compacto, tolerante). */
function slugContainsTeam(linkSlug: string, variants: string[]): boolean {
  const compact = linkSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
  return variants.some((v) => {
    const token = v.replace(/[^a-z0-9]/g, '');
    return token.length >= 3 && compact.includes(token);
  });
}

/** Primer enlace de un listado de Gezzly cuyos slugs cubren a los DOS equipos. */
function pickListingMatchLink(html: string, variantsA: string[], variantsB: string[]): string | null {
  const links = [...new Set([...html.matchAll(/href="(\/match\/[^"]+)"/g)].map((m) => m[1]))];
  for (const link of links) {
    const slug = link.replace(/^\/match\//, '');
    if (slugContainsTeam(slug, variantsA) && slugContainsTeam(slug, variantsB)) return link;
  }
  return null;
}

// Caché breve de los listados de Gezzly (se comparten entre partidos de una
// misma carga) y de la URL encontrada por partido (para no repetir búsquedas
// en cada refresco).
const GEZZLY_LISTING_CACHE = new Map<string, { html: string; at: number }>();
const GEZZLY_LISTING_TTL_MS = 2 * 60_000;
const GEZZLY_MATCH_URL_CACHE = new Map<string, { url: string | null; at: number }>();
const GEZZLY_MATCH_URL_TTL_MS = 15 * 60_000;
const GEZZLY_MATCH_URL_NEGATIVE_TTL_MS = 2 * 60_000;

/** Evita solapar dos enriquecimientos R6 si se encadenan dos cargas. */
let enrichInFlight = false;

async function fetchGezzlyListing(url: string): Promise<string | null> {
  const cached = GEZZLY_LISTING_CACHE.get(url);
  if (cached && Date.now() - cached.at < GEZZLY_LISTING_TTL_MS) return cached.html;
  try {
    const html = await fetchGezzlyHtml(url);
    GEZZLY_LISTING_CACHE.set(url, { html, at: Date.now() });
    if (GEZZLY_LISTING_CACHE.size > 12) {
      for (const key of [...GEZZLY_LISTING_CACHE.keys()].slice(0, 4)) {
        GEZZLY_LISTING_CACHE.delete(key);
      }
    }
    return html;
  } catch {
    return null;
  }
}

/**
 * URL del partido en Gezzly para el enriquecimiento en directo: primero busca en
 * los listados (una descarga sirve para varios partidos) y, si no, prueba la URL
 * directa ({equipoA}-{equipoB}-{fecha}, fechas contiguas).
 */
async function findLiveMatchUrl(
  teamA: string,
  teamB: string,
  startTimeIso?: string
): Promise<string | null> {
  const cacheKey = `${teamA}|${teamB}|${startTimeIso || ''}`;
  const cached = GEZZLY_MATCH_URL_CACHE.get(cacheKey);
  if (cached) {
    const ttl = cached.url ? GEZZLY_MATCH_URL_TTL_MS : GEZZLY_MATCH_URL_NEGATIVE_TTL_MS;
    if (Date.now() - cached.at < ttl) return cached.url;
  }

  const variantsA = teamSlugVariants(teamA);
  const variantsB = teamSlugVariants(teamB);
  let found: string | null = null;

  for (const listing of ['https://www.gezzly.gg/r6-live-scores', 'https://www.gezzly.gg/matches']) {
    const html = await fetchGezzlyListing(listing);
    if (!html) continue;
    const link = pickListingMatchLink(html, variantsA, variantsB);
    if (link) {
      found = `https://www.gezzly.gg${link}`;
      break;
    }
  }

  if (!found && startTimeIso) {
    const base = new Date(startTimeIso);
    if (!isNaN(base.getTime())) {
      const pairs: [string, string][] = [];
      for (let i = 0; i < Math.min(variantsA.length, variantsB.length, 3); i++) {
        pairs.push([variantsA[i], variantsB[i]]);
      }
      if (variantsA.length > 1 && variantsB.length > 1) pairs.push([variantsA[1], variantsB[0]]);

      const dayMs = 24 * 3600 * 1000;
      // Como máximo unos pocos intentos directos: si Gezzly no responde, no
      // se lanzan decenas de peticiones seguidas (los listados ya fallaron).
      let directAttempts = 0;
      outer: for (const offset of [0, -1, 1]) {
        const date = new Date(base.getTime() + offset * dayMs).toISOString().slice(0, 10);
        for (const [a, b] of pairs.slice(0, 4)) {
          if (directAttempts++ >= 4) break outer;
          const candidate = `https://www.gezzly.gg/match/${a}-${b}-${date}`;
          try {
            const html = await fetchGezzlyHtml(candidate);
            if (html && !isGezzlyNotFound(html)) {
              found = candidate;
              break outer;
            }
          } catch {
            // URL no válida: probar la siguiente combinación
          }
        }
      }
    }
  }

  GEZZLY_MATCH_URL_CACHE.set(cacheKey, { url: found, at: Date.now() });
  if (GEZZLY_MATCH_URL_CACHE.size > 60) {
    for (const key of [...GEZZLY_MATCH_URL_CACHE.keys()].slice(0, 20)) {
      GEZZLY_MATCH_URL_CACHE.delete(key);
    }
  }
  return found;
}

/** Comparación compacta de nombres ("Black Dragons e-Sports" ≈ "Black Dragons"). */
function namesAlike(a: string, b: string): boolean {
  const ca = (a || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cb = (b || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!ca || !cb) return false;
  return ca === cb || ca.includes(cb) || cb.includes(ca);
}

/**
 * La página "Match Not Found" de Gezzly se reconoce por su <title>: el texto
 * "Match not found" también aparece en un componente del payload de las fichas
 * reales, así que no vale buscarlo en todo el HTML.
 */
function isGezzlyNotFound(html: string): boolean {
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
  return /Match Not Found/i.test(title);
}

/**
 * Extrae los mapas (nombre, rondas y estado) del payload RSC de una ficha de
 * Gezzly, orientando los marcadores a teamAName/teamBName.
 */
function parseGezzlyGames(
  html: string,
  teamAName: string,
  teamBName: string
): GezzlyMapScore[] | null {
  if (isGezzlyNotFound(html)) return null;

  // "HOME vs AWAY" del <title>, para saber qué lado de Gezzly es cada equipo.
  let homeName = '';
  let awayName = '';
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
  if (titleMatch) {
    const head = titleMatch[1].replace(/\s+/g, ' ').trim().split(' - ')[0];
    const vsMatch = head.match(/^(.+?)\s+vs\.?\s+(.+?)(?:\s+(?:Result|Results|Preview|Live))?$/i);
    if (vsMatch) {
      homeName = vsMatch[1].trim();
      awayName = vsMatch[2].trim();
    }
  }
  const direct = namesAlike(homeName, teamAName) && namesAlike(awayName, teamBName);
  const flipped = namesAlike(homeName, teamBName) && namesAlike(awayName, teamAName);
  const homeIsTeamA = flipped && !direct ? false : true;

  // Primer array "games" válido del payload (nombre + score + estado por mapa).
  const payload = extractRscPayload(html);
  let pos = 0;
  let raw: any[] | null = null;
  while (true) {
    const found = extractArrayAfter(payload, '"games":[', pos);
    if (!found) break;
    pos = found.end;
    try {
      const arr = JSON.parse(found.json);
      if (Array.isArray(arr) && arr.length > 0 && arr[0] && typeof arr[0].name === 'string') {
        raw = arr;
        break;
      }
    } catch {
      // Array no parseable: continuar con el siguiente
    }
  }
  if (!raw) return null;

  const sorted = [...raw].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
  const maps: GezzlyMapScore[] = [];
  sorted.forEach((g, idx) => {
    if (!g || typeof g.name !== 'string') return;
    const home = Number(g.score?.home);
    const away = Number(g.score?.away);
    const homeScore = isNaN(home) ? undefined : home;
    const awayScore = isNaN(away) ? undefined : away;
    maps.push({
      order: typeof g.order === 'number' ? g.order : idx + 1,
      name: g.name,
      state: String(g.state || ''),
      scoreA: homeIsTeamA ? homeScore : awayScore,
      scoreB: homeIsTeamA ? awayScore : homeScore,
    });
  });
  return maps.length > 0 ? maps : null;
}

/**
 * Descarga y parsea los mapas de un partido de R6 desde Gezzly. Devuelve null si
 * el partido no está publicado o no se puede leer (se reintenta en la siguiente
 * carga).
 */
async function fetchGezzlyMapScores(
  teamA: string,
  teamB: string,
  startTimeIso?: string
): Promise<GezzlyMapScore[] | null> {
  const url = await findLiveMatchUrl(teamA, teamB, startTimeIso);
  if (!url) return null;
  try {
    const html = await fetchGezzlyHtml(url);
    return parseGezzlyGames(html, teamA, teamB);
  } catch {
    return null;
  }
}

/**
 * Aplica los marcadores de Gezzly al partido: rondas y nombre real de cada mapa
 * en el desglose, estado (jugado / en juego) y tanteo del mapa en curso.
 */
function applyGezzlyMapsToMatch(match: Match, maps: GezzlyMapScore[]): void {
  const breakdown = match.details?.gamesBreakdown;
  if (breakdown) {
    for (const map of maps) {
      const entry = breakdown.find((g) => g.position === map.order);
      if (!entry) continue;
      if (map.name) entry.mapName = map.name;
      if (typeof map.scoreA === 'number') entry.scoreA = map.scoreA;
      if (typeof map.scoreB === 'number') entry.scoreB = map.scoreB;
      if (map.state === 'played') {
        if (entry.status !== 'finished') entry.status = 'finished';
        if (
          !entry.winnerTeam &&
          typeof map.scoreA === 'number' &&
          typeof map.scoreB === 'number' &&
          map.scoreA !== map.scoreB
        ) {
          entry.winnerTeam = map.scoreA > map.scoreB ? 'A' : 'B';
        }
      } else if (map.state === 'live' && entry.status === 'not_started') {
        entry.status = 'running';
      }
    }
  }

  // Mapa en curso: tanteo REAL de rondas (PandaScore no lo trae en R6; sin esto
  // la insignia mostraba el marcador de la serie, "1-0", como si fueran rondas).
  const liveMap = maps.find((m) => m.state === 'live');
  if (liveMap && typeof liveMap.scoreA === 'number' && typeof liveMap.scoreB === 'number') {
    const label = liveMap.name || `Mapa ${liveMap.order}`;
    match.liveRoundScore = {
      scoreA: liveMap.scoreA,
      scoreB: liveMap.scoreB,
      mapName: liveMap.name || undefined,
      mapNumber: liveMap.order,
      roundOrTime: `${label}: ${liveMap.scoreA}-${liveMap.scoreB}`,
    };
  }
}

export const R6StatsService = {
  /**
   * Obtiene las estadísticas oficiales de un partido de R6 desde Gezzly
   * (datos de la plataforma oficial de esports de Ubisoft).
   */
  async getMatchStats(
    teamA: string,
    teamB: string,
    directUrl?: string,
    startTimeIso?: string
  ): Promise<R6MatchData | null> {
    const cacheKey = `${teamA.toLowerCase().trim()}_vs_${teamB.toLowerCase().trim()}`;
    if (R6_CACHE.has(cacheKey)) {
      return R6_CACHE.get(cacheKey)!;
    }

    try {
      lastError = null;
      let targetUrl = directUrl;
      if (!targetUrl) {
        targetUrl = (await findMatchUrl(teamA, teamB, startTimeIso)) || undefined;
      }

      if (!targetUrl) {
        lastError = 'Partido no encontrado en Gezzly';
        return null;
      }

      const html = await fetchGezzlyHtml(targetUrl);
      const parsedData = parseGezzlyMatchHtml(html, targetUrl, teamA, teamB);

      // Si Gezzly devolvió su página "Match Not Found", no hay datos.
      if (parsedData.matchTitle && /Match Not Found/i.test(parsedData.matchTitle)) {
        lastError = 'Gezzly devolvió "Match Not Found"';
        return null;
      }

      if (parsedData.maps.length > 0 || parsedData.vetoRows.length > 0 || parsedData.matchTitle) {
        // Solo cachear si el encuentro ha finalizado por completo para no congelar datos en directo
        const hasGlobalStats = parsedData.maps.some(
          (m) => m.mapNumber === 0 && m.teamAStats.length > 0
        );
        const isFinal =
          hasGlobalStats &&
          !html.includes('"state":"live"') &&
          !html.includes('"state":"upcoming"');

        if (isFinal) {
          R6_CACHE.set(cacheKey, parsedData);
        } else {
          R6_CACHE.delete(cacheKey);
        }

        return parsedData;
      }

      lastError = 'La ficha no contiene estadísticas';
      return null;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn('Error en R6StatsService:', err);
      return null;
    }
  },

  /** Motivo del último fallo, para diagnóstico. */
  getLastError(): string | null {
    return lastError;
  },

  /**
   * Completa los marcadores de rondas (y el nombre real de cada mapa) de los
   * partidos de R6 en directo/recientes desde Gezzly: PandaScore no publica
   * `results` por mapa en R6 y sin esto la insignia en vivo y los avisos de
   * "fin de mapa" mostraban el marcador de la serie ("1-0") y no las rondas
   * ("7-0"). Se ejecuta en segundo plano y nunca bloquea la carga si falla.
   */
  async enrichR6Matches(matches: Match[]): Promise<void> {
    if (enrichInFlight) return;
    const now = Date.now();
    const targets = matches.filter((m) => {
      if (m.game !== 'R6') return false;
      if (m.status === 'LIVE') return true;
      if (m.status !== 'FINISHED') return false;
      const start = new Date(m.startTimeIso).getTime();
      return !isNaN(start) && now - start <= 3 * 3600 * 1000;
    });
    if (targets.length === 0) return;

    enrichInFlight = true;
    try {
      await Promise.allSettled(
        targets.slice(0, 6).map(async (m) => {
          try {
            const maps = await fetchGezzlyMapScores(m.teamA.name, m.teamB.name, m.startTimeIso);
            if (maps && maps.length > 0) applyGezzlyMapsToMatch(m, maps);
          } catch (err) {
            console.warn('Enriquecimiento R6 (Gezzly) falló:', err);
          }
        })
      );
    } finally {
      enrichInFlight = false;
    }
  },
};
