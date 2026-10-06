import { Platform } from 'react-native';
import { R6MatchData, R6MapData, R6PlayerStats, R6VetoRow } from './types';

// Memoria caché para evitar consultas redundantes a la web
const R6_CACHE = new Map<string, R6MatchData>();

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
async function fetchGezzlyHtml(targetUrl: string): Promise<string> {
  const isWeb = Platform.OS === 'web';
  const url = isWeb
    ? `/api/proxy/gezzly?url=${encodeURIComponent(targetUrl)}`
    : targetUrl;

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!res.ok) {
    throw new Error(`Error HTTP ${res.status} al conectar con Gezzly`);
  }

  return await res.text();
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
              if (html && !/404|not found/i.test(html.slice(0, 400))) {
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

  // 4. Stats de jugadores: parejas de arrays (home, away) con kills/deaths
  const statsPairs: { home: RawR6Player[]; away: RawR6Player[] }[] = [];
  let pendingHome: RawR6Player[] | null = null;
  let playersPos = 0;
  while (true) {
    const found = extractArrayAfter(payload, '"players":[', playersPos);
    if (!found) break;
    playersPos = found.end;
    try {
      const arr = JSON.parse(found.json);
      if (!Array.isArray(arr) || arr.length === 0) continue;
      const hasStats = arr[0] && typeof arr[0] === 'object' && 'kills' in arr[0] && 'deaths' in arr[0];
      if (!hasStats) continue;
      if (pendingHome === null) {
        pendingHome = arr;
      } else {
        statsPairs.push({ home: pendingHome, away: arr });
        pendingHome = null;
      }
    } catch {
      // Array no parseable, continuar
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
      let targetUrl = directUrl;
      if (!targetUrl) {
        targetUrl = (await findMatchUrl(teamA, teamB, startTimeIso)) || undefined;
      }

      if (!targetUrl) {
        return null;
      }

      const html = await fetchGezzlyHtml(targetUrl);
      const parsedData = parseGezzlyMatchHtml(html, targetUrl, teamA, teamB);

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

      return null;
    } catch (err) {
      console.warn('Error en R6StatsService:', err);
      return null;
    }
  },
};
