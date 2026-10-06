import { Platform } from 'react-native';
import { VlrMatchData, VlrMapData, VlrPlayerStats, VlrVetoRow } from './types';

// Memoria caché para evitar consultas redundantes a la web
const VLR_CACHE = new Map<string, VlrMatchData>();

/**
 * Normaliza nombres de equipos para búsquedas en las URLs de VLR.gg
 */
function normalizeTeamKey(name: string): string[] {
  const clean = (name || '').toLowerCase().trim();
  const keys: string[] = [];

  // Alias conocidos
  if (clean.includes('karmine') || clean === 'kc') keys.push('karmine-corp', 'karmine', 'kc');
  else if (clean.includes('nongshim') || clean === 'ns') keys.push('nongshim-redforce', 'nongshim', 'ns');
  else if (clean.includes('heretics') || clean === 'th') keys.push('team-heretics', 'heretics');
  else if (clean.includes('fnatic') || clean === 'fnc') keys.push('fnatic');
  else if (clean.includes('giantx') || clean === 'giants' || clean === 'gx') keys.push('giantx', 'giants');
  else if (clean.includes('koi') || clean === 'movistar') keys.push('movistar-koi', 'koi');
  else if (clean.includes('g2')) keys.push('g2-esports', 'g2');
  else if (clean.includes('liquid') || clean === 'tl') keys.push('team-liquid', 'liquid');
  else if (clean.includes('sentinels') || clean === 'sen') keys.push('sentinels');
  else if (clean.includes('paper rex') || clean === 'prx') keys.push('paper-rex', 'prx');
  else if (clean.includes('edg') || clean.includes('edward')) keys.push('edward-gaming', 'edg');
  else if (clean.includes('drx')) keys.push('drx');
  else if (clean.includes('leviat')) keys.push('leviatan');
  else if (clean.includes('loud')) keys.push('loud');
  else if (clean.includes('vitality') || clean === 'vit') keys.push('team-vitality', 'vitality');
  else if (clean.includes('bbl')) keys.push('bbl-esports', 'bbl');
  else if (clean.includes('fut')) keys.push('fut-esports', 'fut');
  else if (clean.includes('navi') || clean.includes('natus')) keys.push('natus-vincere', 'navi');
  else if (clean.includes('t1')) keys.push('t1');
  else if (clean.includes('gen.g') || clean.includes('geng')) keys.push('gen-g', 'geng');

  // Slug estándar por defecto
  const slug = clean.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (slug && !keys.includes(slug)) keys.push(slug);

  return keys;
}

/**
 * Descarga HTML de una URL de VLR.gg manejando proxy en web y petición directa en móvil
 */
async function fetchVlrHtml(targetUrl: string): Promise<string> {
  const isWeb = Platform.OS === 'web';
  const url = isWeb
    ? `/api/proxy/vlr?url=${encodeURIComponent(targetUrl)}`
    : targetUrl;

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!res.ok) {
    throw new Error(`Error HTTP ${res.status} al conectar con VLR.gg`);
  }

  return await res.text();
}

function cleanVal(val?: string | null): string {
  if (!val) return '-';
  const c = val.replace(/&nbsp;/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return c || '-';
}

/**
 * Busca la URL del partido en VLR.gg según los nombres de los dos equipos
 */
async function findMatchUrl(teamA: string, teamB: string): Promise<string | null> {
  const keysA = normalizeTeamKey(teamA);
  const keysB = normalizeTeamKey(teamB);

  // 1. Intentar con endpoints generales de partidos (en directo y resultados recientes)
  const endpoints = ['https://www.vlr.gg/matches', 'https://www.vlr.gg/matches/results'];

  for (const endpoint of endpoints) {
    try {
      const html = await fetchVlrHtml(endpoint);
      const matchLinks = [...html.matchAll(/href="(\/\d+\/[a-z0-9-]+)"/g)];

      for (const m of matchLinks) {
        const slug = m[1].toLowerCase();
        const matchesA = keysA.some((k) => slug.includes(k));
        const matchesB = keysB.some((k) => slug.includes(k));

        if (matchesA && matchesB) {
          return `https://www.vlr.gg${m[1]}`;
        }
      }
    } catch (err) {
      console.warn(`Error buscando en ${endpoint}:`, err);
    }
  }

  // 2. Búsqueda dirigida en VLR (ideal para torneos regionales, qualifiers o partidos no destacados en portada)
  const searchCandidates = [keysA[0], keysB[0]].filter(Boolean);
  for (const searchKey of searchCandidates) {
    try {
      const searchHtml = await fetchVlrHtml(
        `https://www.vlr.gg/search/?q=${encodeURIComponent(searchKey)}`
      );
      // Buscar enlace a la ficha del club en VLR: /search/r/team/123/idx o /team/123/name
      const teamMatch =
        searchHtml.match(/\/search\/r\/team\/(\d+)\/idx/) ||
        searchHtml.match(/\/team\/(\d+)\/([a-z0-9-]+)/);

      if (teamMatch) {
        const teamId = teamMatch[1];
        const teamHtml = await fetchVlrHtml(`https://www.vlr.gg/team/${teamId}/`);
        const teamMatchLinks = [...teamHtml.matchAll(/href="(\/\d+\/[a-z0-9-]+)"/g)];
        const otherKeys = searchKey === keysA[0] ? keysB : keysA;

        for (const tm of teamMatchLinks) {
          const slug = tm[1].toLowerCase();
          if (otherKeys.some((k) => slug.includes(k))) {
            return `https://www.vlr.gg${tm[1]}`;
          }
        }
      }
    } catch (searchErr) {
      console.warn(`Error en búsqueda dirigida de equipo (${searchKey}):`, searchErr);
    }
  }

  return null;
}

/**
 * Parsea el HTML de un bloque de filas de jugadores
 */
function parsePlayerRows(rowsBlock: string): VlrPlayerStats[] {
  const rawRows = rowsBlock.split('<div class="ovw-row">').slice(1);
  const players: VlrPlayerStats[] = [];

  for (const row of rawRows) {
    if (!row.includes('ovw-player-name')) continue;

    const nameMatch = row.match(/class="ovw-player-name[^"]*">([\s\S]*?)<\/div>/);
    const tagMatch = row.match(/class="ovw-player-tag[^"]*">([\s\S]*?)<\/div>/);
    const flagMatch = row.match(/class="flag mod-([a-z0-9_-]+)"/);
    const agentMatch = row.match(/class="stats-sq mod-agent[^"]*"[^>]*><img src="([^"]+)" alt="([^"]+)"/);

    const name = cleanVal(nameMatch ? nameMatch[1] : '');
    const teamTag = cleanVal(tagMatch ? tagMatch[1] : '');
    const countryCode = flagMatch ? flagMatch[1].trim() : '';
    const agentName = cleanVal(agentMatch ? agentMatch[2] : '');
    const agentIconUrl = agentMatch
      ? agentMatch[1].startsWith('http')
        ? agentMatch[1]
        : `https://www.vlr.gg${agentMatch[1]}`
      : undefined;

    const getStat = (col: string): string => {
      // Buscar valor en mod-both (general)
      const bothRegex = new RegExp(
        `data-col="${col}"[\\s\\S]*?<span class="side mod-both[^"]*">([\\s\\S]*?)<\\/span>`
      );
      const bm = row.match(bothRegex);
      if (bm) return cleanVal(bm[1]);

      // Búsqueda alternativa por celda
      const cellRegex = new RegExp(`data-col="${col}">[\\s\\S]*?([0-9.+-]+%?)`);
      const cm = row.match(cellRegex);
      return cm ? cleanVal(cm[1]) : '-';
    };

    const rating = getStat('rating2') !== '-' ? getStat('rating2') : getStat('rating');
    const acs = getStat('acs');
    const kills = getStat('kills');
    const deaths = getStat('deaths');
    const assists = getStat('assists');
    const kdDiff = getStat('kd_diff') !== '-' ? getStat('kd_diff') : getStat('kd-diff');
    const kast = getStat('kast');
    const adr = getStat('adr');
    const hsPercent = getStat('hs') !== '-' ? getStat('hs') : getStat('hsp');
    const fk = getStat('fk') !== '-' ? getStat('fk') : getStat('fb');
    const fd = getStat('fd');

    if (name) {
      players.push({
        name,
        teamTag,
        countryCode,
        agentName,
        agentIconUrl,
        rating,
        acs,
        kills,
        deaths,
        assists,
        kdDiff,
        kast,
        adr,
        hsPercent,
        fk,
        fd,
      });
    }
  }

  return players;
}

/**
 * Parsea el HTML completo de la ficha de partido de VLR.gg
 */
function parseVlrMatchHtml(html: string, vlrUrl: string): VlrMatchData {
  // 1. Veto de mapas
  let vetoText = '';
  const vetoMatch = html.match(/<div class="match-header-note">([\s\S]*?)<\/div>/);
  if (vetoMatch) {
    vetoText = vetoMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }

  // 1b. Estructura del veto: "T1 ban Split; FUT ban Lotus; T1 pick Sunset; ...; Summit remains"
  const vetoRows: VlrVetoRow[] = [];
  if (vetoText) {
    for (const partRaw of vetoText.split(';')) {
      const part = partRaw.trim();
      if (!part) continue;
      const remain =
        part.match(/^(.+?)\s+remains?$/i) || part.match(/^(?:decider|mapa restante)[:\s]+(.+)$/i);
      if (remain) {
        vetoRows.push({ action: 'remain', mapName: remain[1].trim() });
        continue;
      }
      const m = part.match(/^(.+?)\s+(ban|pick)\s+(.+)$/i);
      if (m) {
        vetoRows.push({ action: m[2].toLowerCase(), mapName: m[3].trim(), team: m[1].trim() });
      }
    }
  }

  // 2. Parche
  let patch = '';
  const patchMatch = html.match(/Patch\s*([0-9.]+)/i);
  if (patchMatch) {
    patch = `Patch ${patchMatch[1]}`;
  }

  // 3. Título del torneo o partido
  let matchTitle = '';
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
  if (titleMatch) {
    matchTitle = titleMatch[1].replace('| VLR.gg', '').trim();
  }

  // 4. Mapeo de nombres de mapas por ID desde el menú de navegación (ej: id="283163" -> "Sunset")
  const mapNavRegex =
    /<[a-z]+[^>]*class="[^"]*vm-stats-gamesnav-item[^"]*"[^>]*data-game-id="([^"]+)"[^>]*>([\s\S]*?)<\/[a-z]+>/gi;
  const mapHeaders = new Map<string, string>();
  for (const mh of html.matchAll(mapNavRegex)) {
    const id = mh[1];
    let label = mh[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (id === 'all' || label.toLowerCase().includes('all maps')) {
      label = 'Todos los mapas';
    } else {
      label = label.replace(/^[0-9]+\s*/, '');
    }
    mapHeaders.set(id, label);
  }

  // 5. Extraer estrictamente los contenedores <div class="vm-stats-game ..."> (evitando coincidir con nav-items)
  const containerRegex = /<div[^>]*class="[^"]*\bvm-stats-game\b[^"]*"[^>]*data-game-id="([^"]+)"[^>]*>/gi;
  const containers: { gameId: string; start: number }[] = [];
  let cm: RegExpExecArray | null;
  while ((cm = containerRegex.exec(html)) !== null) {
    containers.push({
      gameId: cm[1],
      start: cm.index + cm[0].length,
    });
  }

  const individualMaps: VlrMapData[] = [];
  let allMapsData: VlrMapData | null = null;

  for (let i = 0; i < containers.length; i++) {
    const c = containers[i];
    const nextStart = i + 1 < containers.length ? containers[i + 1].start : html.length;
    const chunk = html.substring(c.start, nextStart);

    const isAll = c.gameId === 'all';
    const mapMatch = chunk.match(/class="map"[^>]*>[\s\S]*?<span[^>]*>\s*([A-Za-z0-9]+)/i);
    const leftScore = chunk.match(/<div class="team">[\s\S]*?<div class="score[^"]*"[^>]*>\s*([0-9]+)\s*<\/div>/i);
    const rightScore = chunk.match(/<div class="team mod-right">[\s\S]*?<div class="score[^"]*"[^>]*>\s*([0-9]+)\s*<\/div>/i);

    const navName = mapHeaders.get(c.gameId);
    const mapName = isAll
      ? 'Todos los mapas'
      : (mapMatch ? mapMatch[1].trim() : (navName || `Mapa ${individualMaps.length + 1}`));

    const allPlayersInBlock = parsePlayerRows(chunk);
    // Orden por rating (descendente) dentro de cada equipo, como en VLR.gg
    const byRating = (a: VlrPlayerStats, b: VlrPlayerStats): number => {
      const ra = parseFloat(a.rating);
      const rb = parseFloat(b.rating);
      const va = Number.isNaN(ra) ? -1 : ra;
      const vb = Number.isNaN(rb) ? -1 : rb;
      return vb - va;
    };
    const teamAStats = allPlayersInBlock.slice(0, 5).sort(byRating);
    const teamBStats = allPlayersInBlock.slice(5, 10).sort(byRating);

    const mapItem: VlrMapData = {
      mapNumber: isAll ? 0 : individualMaps.length + 1,
      mapName,
      scoreA: leftScore ? leftScore[1].trim() : undefined,
      scoreB: rightScore ? rightScore[1].trim() : undefined,
      teamAStats,
      teamBStats,
    };

    if (isAll) {
      allMapsData = mapItem;
    } else {
      mapItem.mapNumber = individualMaps.length + 1;
      individualMaps.push(mapItem);
    }
  }

  // Orden requerido: 1º Cómputo global de todos los mapas, 2º los mapas individuales (1, 2, 3...)
  const finalMaps: VlrMapData[] = [];
  if (allMapsData) {
    finalMaps.push(allMapsData);
  }
  finalMaps.push(...individualMaps);

  return {
    vlrUrl,
    matchTitle,
    patch,
    vetoText,
    vetoRows,
    maps: finalMaps,
  };
}

export const VlrScraperService = {
  /**
   * Obtiene las estadísticas oficiales 100% reales de un partido desde VLR.gg
   */
  async getMatchStats(
    teamA: string,
    teamB: string,
    directUrl?: string
  ): Promise<VlrMatchData | null> {
    const cacheKey = `${teamA.toLowerCase().trim()}_vs_${teamB.toLowerCase().trim()}`;
    if (VLR_CACHE.has(cacheKey)) {
      return VLR_CACHE.get(cacheKey)!;
    }

    try {
      let targetUrl = directUrl;
      if (!targetUrl) {
        targetUrl = (await findMatchUrl(teamA, teamB)) || undefined;
      }

      if (!targetUrl) {
        return null;
      }

      const html = await fetchVlrHtml(targetUrl);
      const parsedData = parseVlrMatchHtml(html, targetUrl);

      if (parsedData.maps.length > 0 || parsedData.vetoText || parsedData.matchTitle) {
        // Solo cachear en memoria si el encuentro ha finalizado por completo para no congelar datos en directo
        const isLive =
          html.includes('mod-live') ||
          parsedData.maps.some((m) => {
            if (m.mapNumber === 0) return false;
            const sA = parseInt(m.scoreA || '0', 10);
            const sB = parseInt(m.scoreB || '0', 10);
            return (sA > 0 || sB > 0) && !(sA >= 13 && sA - sB >= 2) && !(sB >= 13 && sB - sA >= 2);
          });

        if (!isLive) {
          VLR_CACHE.set(cacheKey, parsedData);
        } else {
          VLR_CACHE.delete(cacheKey);
        }

        return parsedData;
      }

      return null;
    } catch (err) {
      console.warn('Error en VlrScraperService:', err);
      return null;
    }
  },
};
