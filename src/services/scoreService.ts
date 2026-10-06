import { Platform } from 'react-native';
import {
  Match,
  SportCategory,
  MatchStatus,
  TournamentTier,
  MatchRegion,
  PlayerInfo,
  TeamRoster,
  MatchStream,
  MatchMapGame,
  FootballEvent,
  TournamentItem,
  TeamCatalogItem,
  LiveRoundScore,
} from './types';
import { formatMatchSchedule } from './dateUtils';

export function cleanTeamName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\b(team|esports|gaming|club|fc|cf|gg|challengers)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function isTeamMatch(name1: string, name2: string): boolean {
  const c1 = cleanTeamName(name1);
  const c2 = cleanTeamName(name2);
  if (!c1 || !c2) return false;
  if (c1 === c2) return true;
  if (c1.length >= 3 && c2.length >= 3 && (c1.includes(c2) || c2.includes(c1))) return true;
  return false;
}

export function areTeamsMatching(a1: string, b1: string, a2: string, b2: string): boolean {
  return (
    (isTeamMatch(a1, a2) && isTeamMatch(b1, b2)) ||
    (isTeamMatch(a1, b2) && isTeamMatch(b1, a2))
  );
}

export function isTeamFavorite(
  teamName?: string,
  shortName?: string,
  favorites?: string[],
  teamId?: string
): boolean {
  if (!teamName || !favorites || favorites.length === 0) return false;
  const tn = teamName.toLowerCase().trim();
  const sn = (shortName || '').toLowerCase().trim();
  const tid = (teamId || '').toLowerCase().trim();

  return favorites.some((fav) => {
    const f = fav.toLowerCase().trim();
    if (!f) return false;
    if (f === tn || (sn && f === sn) || (tid && f === tid)) return true;
    if (f.length >= 3 && (tn.includes(f) || f.includes(tn))) return true;
    if (sn && sn === f) return true;
    // Reconocimiento de alias comunes de clubes
    if ((tn.includes('barcelona') || tn.includes('barça')) && (f.includes('barcelona') || f.includes('barça'))) return true;
    if (tn.includes('real madrid') && f.includes('real madrid')) return true;
    if (tn.includes('heretics') && f.includes('heretics')) return true;
    if (tn.includes('giantx') && (f.includes('giantx') || f.includes('giants'))) return true;
    if (tn.includes('koi') && f.includes('koi')) return true;
    return false;
  });
}

export function toggleTeamFavorite(
  favorites: string[],
  team: TeamCatalogItem | string
): string[] {
  const tName = typeof team === 'string' ? team : team.name;
  const tShort = typeof team === 'object' ? team.shortName : undefined;
  const tId = typeof team === 'object' ? team.id : undefined;

  const isFav = isTeamFavorite(tName, tShort, favorites, tId);

  if (isFav) {
    const tNameLower = tName.toLowerCase().trim();
    const tShortLower = (tShort || '').toLowerCase().trim();
    const tIdLower = (tId || '').toLowerCase().trim();

    return favorites.filter((fav) => {
      const f = fav.toLowerCase().trim();
      if (!f) return false;
      if (f === tNameLower || f === tShortLower || f === tIdLower) return false;
      if (f.length >= 3 && (tNameLower.includes(f) || f.includes(tNameLower))) return false;
      if (tShortLower && (tShortLower === f || (f.length >= 3 && tShortLower.includes(f)))) return false;
      if ((tNameLower.includes('barcelona') || tNameLower.includes('barça')) && (f.includes('barcelona') || f.includes('barça'))) return false;
      if (tNameLower.includes('real madrid') && f.includes('real madrid')) return false;
      if (tNameLower.includes('heretics') && f.includes('heretics')) return false;
      if (tNameLower.includes('giantx') && (f.includes('giantx') || f.includes('giants'))) return false;
      if (tNameLower.includes('koi') && f.includes('koi')) return false;
      return true;
    });
  } else {
    return [...favorites, tName];
  }
}

/**
 * Evalúa si un TournamentItem concreto es favorito por su ID exacto o coincidencia estricta.
 * Es rigurosamente independiente para evitar que torneos de diferentes IDs se marquen juntos en catálogos y búsquedas.
 */
export function isTournamentItemFavorite(
  tournament: TournamentItem,
  favorites?: string[]
): boolean {
  if (!tournament || !favorites || favorites.length === 0) return false;
  const tId = (tournament.id || '').toLowerCase().trim();
  const tName = (tournament.name || '').toLowerCase().trim();
  const tSlug = (tournament.slug || '').toLowerCase().trim();

  // 1. Coincidencia exacta por ID único (máxima prioridad para cualquier ítem)
  if (tId && favorites.some((f) => f.toLowerCase().trim() === tId)) {
    return true;
  }

  // 2. Si es un torneo dinámico de PandaScore / búsqueda online (ID panda- o dyn-),
  // se requiere que su ID específico esté en favoritos para evitar colisiones con ítems locales
  if (tId.startsWith('panda-') || tId.startsWith('dyn-')) {
    return false;
  }

  // 3. Para torneos del catálogo local / maestros, comprobar coincidencia con nombres y alias de favoritos
  return favorites.some((fav) => {
    const f = fav.toLowerCase().trim();
    if (!f) return false;
    if (f === tName || (tSlug && f === tSlug)) return true;

    // Normalización de IDs maestros comunes
    if (tId === 'foot-pd' && (f === 'laliga ea sports' || f === 'laliga' || f === 'primera division')) return true;
    if (tId === 'foot-cl' && (f === 'uefa champions league' || f === 'champions league')) return true;
    if (tId === 'foot-pl' && (f === 'premier league' || f === 'premier')) return true;
    if (tId === 'foot-bl1' && f === 'bundesliga') return true;
    if (tId === 'foot-sa' && f === 'serie a') return true;
    if (tId === 'vlr-champions' && (f === 'valorant champions' || f === 'vlr-champions')) return true;
    if (tId === 'vlr-masters' && (f === 'vct masters' || f === 'vlr-masters')) return true;
    if (tId === 'lol-worlds' && (f === 'league of legends world championship' || f === 'worlds')) return true;
    if (tId === 'lol-lec' && (f === 'lec' || f.includes('league of legends emea championship'))) return true;
    if (tId === 'lol-emea-masters' && (f === 'emea masters' || f === 'lol-emea-masters')) return true;
    
    return false;
  });
}

export function isTournamentFavorite(
  leagueName?: string,
  tournamentStage?: string,
  favorites?: string[],
  tournamentId?: string
): boolean {
  if (!leagueName || !favorites || favorites.length === 0) return false;
  const l = leagueName.toLowerCase().trim();
  const tid = (tournamentId || '').toLowerCase().trim();

  // Si conocemos el torneo maestro del partido, ese torneo es la fuente de verdad:
  // el partido es favorito sólo si ESE torneo está en favoritos. Así, al quitar un
  // torneo de favoritos desaparece de verdad, sin que otros torneos del mismo
  // circuito (p. ej. "Valorant Champions Tour" frente a "Valorant Champions") lo rescaten.
  if (tid) {
    const master = MASTER_TOURNAMENTS.find((mt) => mt.id.toLowerCase() === tid);
    if (master) {
      const candidates = [master.id, master.name, master.shortName, master.slug]
        .filter((v): v is string => Boolean(v))
        .map((v) => v.toLowerCase().trim());
      return favorites.some((f) => {
        const fav = f.toLowerCase().trim();
        return fav.length > 0 && candidates.includes(fav);
      });
    }
    // ID no reconocido (favorito dinámico de PandaScore / búsqueda online)
    return favorites.some((f) => f.toLowerCase().trim() === tid);
  }

  return favorites.some((fav) => {
    const f = fav.toLowerCase().trim();
    if (!f) return false;

    // Coincidencia exacta directa
    if (f === l || (tid && f === tid)) return true;

    // Palabras genéricas que NO deben activar coincidencia difusa por subcadena
    const GENERIC_WORDS = new Set([
      'league', 'champions', 'masters', 'emea', 'vct', 'copa', 'cup',
      'major', 'series', 'tour', 'pro', 'division', 'superliga', 'americas', 'invitational'
    ]);

    // Subcadena sólo si el favorito es largo y no genérico
    if (!GENERIC_WORDS.has(f) && f.length >= 6 && l.includes(f)) {
      return true;
    }

    // Coincidencia si el favorito es un ID de torneo del catálogo maestro
    const master = MASTER_TOURNAMENTS.find((mt) => mt.id.toLowerCase() === f);
    if (master) {
      const mn = master.name.toLowerCase();
      const ms = (master.shortName || '').toLowerCase();
      if (l.includes(mn) || mn.includes(l) || (ms && l.includes(ms))) {
        return true;
      }
    }

    // Alias oficiales de torneos
    if (
      (f.includes('laliga') || f === 'primera division') &&
      (l.includes('laliga') || l.includes('primera division'))
    ) {
      return true;
    }
    // UEFA Champions League (no debe coincidir con Valorant Champions)
    if (
      (f.includes('uefa') || f === 'champions league' || (f.includes('champions') && f.includes('league'))) &&
      (l.includes('uefa') || l === 'champions league' || (l.includes('champions') && l.includes('league') && !l.includes('valorant') && !l.includes('vct')))
    ) {
      return true;
    }
    // Premier League
    if (
      (f.includes('premier league') || f === 'premier') &&
      (l.includes('premier league') || l === 'premier')
    ) {
      return true;
    }
    // Serie A
    if (f === 'serie a' && l === 'serie a') return true;
    // Bundesliga
    if (f === 'bundesliga' && l === 'bundesliga') return true;

    // League of Legends ligas principales
    if (
      (f === 'lec' || f.includes('league of legends emea championship')) &&
      (l === 'lec' || l.includes('league of legends emea championship') || l.startsWith('lec '))
    ) {
      return true;
    }
    if ((f === 'emea masters' || f === 'lol-emea-masters') && l.includes('emea masters')) {
      return true;
    }
    if (
      (f === 'lcs' || f.includes('league championship series')) &&
      (l === 'lcs' || l.includes('league championship series') || l.includes('lta'))
    ) {
      return true;
    }
    if (f === 'lck' && (l === 'lck' || l.includes('champions korea'))) {
      return true;
    }
    if (f === 'lpl' && (l === 'lpl' || l.includes('pro league'))) {
      return true;
    }

    // Valorant Champions
    if (
      (f.includes('valorant champions') || f === 'vlr-champions') &&
      (l.includes('valorant') || l.includes('vct')) && l.includes('champions')
    ) {
      return true;
    }

    // VCT Masters
    if (
      (f.includes('vct masters') || f === 'vlr-masters') &&
      (l.includes('valorant') || l.includes('vct')) && l.includes('masters')
    ) {
      return true;
    }

    // Six Invitational (R6)
    if (
      (f.includes('six') && f.includes('invitational')) &&
      (l.includes('six') && l.includes('invitational'))
    ) {
      return true;
    }

    return false;
  });
}

export function toggleTournamentFavorite(
  favorites: string[],
  tournament: TournamentItem | string
): string[] {
  if (typeof tournament === 'object') {
    const isFav = isTournamentItemFavorite(tournament, favorites);
    const tId = (tournament.id || '').toLowerCase().trim();
    const tName = (tournament.name || '').toLowerCase().trim();
    const tSlug = (tournament.slug || '').toLowerCase().trim();
    const isDynamic = tId.startsWith('panda-') || tId.startsWith('dyn-');

    if (isFav) {
      // Eliminar estrictamente este torneo sin afectar a los demás
      return favorites.filter((fav) => {
        const f = fav.toLowerCase().trim();
        if (!f) return false;
        // Si es un torneo dinámico/online, retirar únicamente su ID exacto
        if (isDynamic) {
          return f !== tId;
        }
        // Si es local maestro, eliminar su ID y sus nombres/alias exactos
        if (f === tId || f === tName || (tSlug && f === tSlug)) return false;
        if (tId === 'foot-pd' && (f === 'laliga ea sports' || f === 'laliga')) return false;
        if (tId === 'foot-cl' && (f === 'uefa champions league' || f === 'champions league')) return false;
        if (tId === 'vlr-champions' && (f === 'valorant champions' || f === 'vlr-champions')) return false;
        if (tId === 'lol-emea-masters' && (f === 'emea masters' || f === 'lol-emea-masters')) return false;
        return true;
      });
    } else {
      if (isDynamic) {
        return [...favorites, tournament.id];
      }
      // Para local maestro, añadir ID y Nombre (si no está ya) para sincronización con reloj y feed
      const result = [...favorites];
      if (!result.some((f) => f.toLowerCase().trim() === tId)) {
        result.push(tournament.id);
      }
      if (!result.some((f) => f.toLowerCase().trim() === tName)) {
        result.push(tournament.name);
      }
      return result;
    }
  }

  // Si tournament es un string
  const tName = tournament.trim();
  const lower = tName.toLowerCase();
  const exists = favorites.some((f) => f.toLowerCase().trim() === lower);
  if (exists) {
    return favorites.filter((f) => f.toLowerCase().trim() !== lower);
  }
  return [...favorites, tName];
}


export function normalizeFavoriteTournaments(favorites: string[]): string[] {
  if (!favorites || favorites.length === 0) return [];
  const result: string[] = [];

  for (const fav of favorites) {
    const f = fav.trim();
    if (!f) continue;
    const lower = f.toLowerCase();

    if (lower === 'vct') {
      if (!result.includes('Valorant Champions')) result.push('Valorant Champions');
      if (!result.includes('VCT Masters')) result.push('VCT Masters');
      if (!result.includes('VCT EMEA')) result.push('VCT EMEA');
    } else if (lower === 'laliga' || lower === 'primera division') {
      if (!result.includes('LaLiga EA Sports')) result.push('LaLiga EA Sports');
    } else if (lower === 'champions league' || lower === 'champions') {
      if (!result.includes('UEFA Champions League')) result.push('UEFA Champions League');
    } else if (lower === 'lec') {
      if (!result.includes('LEC (League of Legends EMEA Championship)')) {
        result.push('LEC (League of Legends EMEA Championship)');
      }
    } else {
      if (!result.includes(f)) result.push(f);
    }
  }

  return result;
}

export function normalizeFavoriteTeams(favorites: string[]): string[] {
  if (!favorites || favorites.length === 0) return [];
  const result: string[] = [];

  for (const fav of favorites) {
    const f = fav.trim();
    if (!f) continue;
    const lower = f.toLowerCase();

    if (lower === 'barcelona' || lower === 'barça') {
      if (!result.includes('FC Barcelona')) result.push('FC Barcelona');
    } else if (lower === 'giantx' || lower === 'giants') {
      if (!result.includes('GiantX')) result.push('GiantX');
    } else {
      if (!result.includes(f)) result.push(f);
    }
  }

  return result;
}

/**
 * Comprueba si un deporte o categoría de juego está habilitado en la configuración.
 * Mapea las categorías de SportCategory ('FÚTBOL', 'VALORANT', etc.) a las claves de enabledGames.
 */
export function isGameCategoryEnabled(
  game: SportCategory | string,
  enabledGames?: Record<string, boolean>
): boolean {
  if (!enabledGames) return true;

  const g = (game || '').toString().toUpperCase().trim();
  let key: string | null = null;
  if (g === 'FÚTBOL' || g === 'FOOTBALL' || g === 'SOCCER') {
    key = 'football';
  } else if (g === 'VALORANT' || g === 'VLR') {
    key = 'valorant';
  } else if (g === 'LOL' || g === 'LEAGUE_OF_LEGENDS') {
    key = 'lol';
  } else if (g === 'CS2' || g === 'CSGO' || g === 'COUNTER_STRIKE') {
    key = 'cs2';
  } else if (g === 'R6' || g === 'RAINBOW_SIX' || g === 'SIEGE') {
    key = 'r6';
  } else if (g === 'DOTA2' || g === 'DOTA') {
    key = 'dota2';
  } else {
    key = game.toLowerCase().trim();
  }

  if (key && key in enabledGames) {
    return Boolean(enabledGames[key]);
  }

  return true;
}

/**
 * Detecta si el slug o nombre del juego corresponde a una de las categorías soportadas.
 * Si es un juego no soportado (ej. King of Glory 'kog', Mobile Legends 'mlbb', Overwatch, etc.),
 * devuelve null para descartarlo inmediatamente y evitar que se clasifique erróneamente.
 */
export function detectEsportCategory(slug?: string, name?: string): SportCategory | null {
  const s = (slug || '').toLowerCase();
  const n = (name || '').toLowerCase();

  // 1. Valorant
  if (s.includes('valorant') || s === 'vlr' || n.includes('valorant')) {
    return 'VALORANT';
  }
  // 2. League of Legends (excluyendo Wild Rift móvil)
  if (
    s === 'league-of-legends' ||
    s === 'lol' ||
    (s.includes('league-of-legends') && !s.includes('wild-rift')) ||
    n.includes('league of legends')
  ) {
    return 'LOL';
  }
  // 3. Counter-Strike 2 / CS:GO
  if (
    s.includes('cs-go') ||
    s.includes('cs2') ||
    s.includes('counter-strike') ||
    s === 'cs' ||
    n.includes('counter-strike')
  ) {
    return 'CS2';
  }
  // 4. Rainbow Six Siege
  if (
    s.includes('rainbow-six') ||
    s.includes('r6') ||
    s.includes('siege') ||
    n.includes('rainbow six')
  ) {
    return 'R6';
  }
  // 5. Dota 2
  if (s.includes('dota-2') || s === 'dota' || s === 'dota2' || n.includes('dota')) {
    return 'DOTA2';
  }

  // Cualquier otro videojuego no soportado (ej. kog, mlbb, ow, pubg, fifa, etc.)
  return null;
}

/**
 * Resuelve de forma rigurosa y oficial el Tier de un torneo.
 * Regla de Oro para VALORANT:
 * Tier S son EXCLUSIVAMENTE los torneos del circuito oficial VCT Tier 1 de Riot Games:
 * - Valorant Champions (Mundial)
 * - VCT Masters (Madrid, Shanghai, etc.)
 * - Ligas Regionales VCT Tier 1 oficiales (VCT EMEA, VCT Americas, VCT Pacific, VCT China)
 * Los torneos VCT Challengers, VCT Ascension o Game Changers son Tier A / B, NUNCA Tier S.
 */
export function resolveTournamentTier(
  game: SportCategory,
  leagueName?: string,
  tournamentName?: string,
  rawTier?: string,
  serieName?: string
): TournamentTier {
  const text = `${leagueName || ''} ${serieName || ''} ${tournamentName || ''}`.toLowerCase();
  const raw = (rawTier || '').toLowerCase().trim();

  switch (game) {
    case 'VALORANT': {
      const isChallengers = text.includes('challenger');
      const isAscension = text.includes('ascension');
      const isGameChangers =
        text.includes('game changer') ||
        text.includes('gamechanger') ||
        text.includes(' gc ');

      // 1. Champions (Mundial Riot VCT)
      if (text.includes('champions') && !isChallengers && !isGameChangers) {
        return 'S';
      }

      // 2. Masters (Torneos Internacionales VCT)
      if (text.includes('masters') && !isChallengers) {
        return 'S';
      }

      // 3. Ligas Regionales VCT Tier 1 (EMEA, Americas, Pacific, China)
      const isVCT = text.includes('vct') || text.includes('valorant champions tour');
      const isTier1Region =
        text.includes('emea') ||
        text.includes('americas') ||
        text.includes('pacific') ||
        text.includes('china') ||
        text.includes(' cn ');
      const isVCTOfficialStage =
        text.includes('kickoff') ||
        text.includes('stage 1') ||
        text.includes('stage 2') ||
        text.includes('season finals');

      if (isVCT && (isTier1Region || isVCTOfficialStage) && !isChallengers && !isAscension && !isGameChangers) {
        return 'S';
      }

      // 4. Si la competición oficial es del circuito VCT y PandaScore la cataloga como Tier 's'
      if (isVCT && raw === 's' && !isChallengers && !isAscension && !isGameChangers) {
        return 'S';
      }

      // Tier A: Torneos Riot Tier 2 de Élite (Ascension, Challengers principales, Game Changers Championship, Red Bull)
      if (
        isAscension ||
        isChallengers ||
        isGameChangers ||
        text.includes('red bull') ||
        text.includes('home ground') ||
        text.includes('premier')
      ) {
        return 'A';
      }

      // Tier B: Copas regionales oficiales secundarias (Crossfire Cup, Rising, Beacon, etc.)
      if (text.includes('crossfire') || text.includes('rising') || text.includes('beacon') || raw === 'b' || raw === 'a') {
        return 'B';
      }

      return 'C';
    }

    case 'LOL': {
      // Tier S: Worlds, MSI, First Stand y grandes ligas Tier 1 (LCK, LPL, LEC, LCS/LTA, LCP)
      if (
        text.includes('world') ||
        text.includes('worlds') ||
        text.includes('mid-season') ||
        text.includes('msi') ||
        text.includes('first stand') ||
        text.includes('lck') ||
        text.includes('lpl') ||
        text.includes('lec') ||
        text.includes('lcs') ||
        text.includes('lta') ||
        text.includes('lcp')
      ) {
        return 'S';
      }

      // Tier A: ERLs principales (Superliga, LFL, Prime League, TCL, CBLOL), EMEA Masters, KeSPA Cup, Demacia Cup
      if (
        text.includes('superliga') ||
        text.includes('lfl') ||
        text.includes('prime league') ||
        text.includes('emea masters') ||
        text.includes('cblol') ||
        text.includes('tcl') ||
        text.includes('pcs') ||
        text.includes('vcs') ||
        text.includes('kespa') ||
        text.includes('demacia') ||
        raw === 'a' ||
        raw === 's'
      ) {
        return 'A';
      }

      if (text.includes('segunda') || text.includes('division 2') || raw === 'b') {
        return 'B';
      }

      return 'C';
    }

    case 'CS2': {
      // Tier S: Majors oficiales, IEM Katowice, IEM Cologne, BLAST Premier Finals, ESL Pro League
      if (
        text.includes('major') ||
        text.includes('iem katowice') ||
        text.includes('iem cologne') ||
        text.includes('esl pro league') ||
        text.includes('world final') ||
        (text.includes('blast') && (text.includes('final') || text.includes('premier')))
      ) {
        return 'S';
      }

      // Tier A: Otros IEM (Dallas, Chengdu, Rio), BLAST Showdown/Groups, ESL Challenger, Roobet, Thunderpick
      if (
        text.includes('iem') ||
        text.includes('blast') ||
        text.includes('challenger') ||
        text.includes('thunderpick') ||
        text.includes('roobet') ||
        text.includes('skyesports') ||
        raw === 'a' ||
        raw === 's'
      ) {
        return 'A';
      }

      if (text.includes('cct') || text.includes('elisa') || text.includes('res') || raw === 'b') {
        return 'B';
      }

      return 'C';
    }

    case 'R6': {
      // Tier S: Six Invitational, Six Major / BLAST R6 Major
      if (text.includes('six invitational') || (text.includes('major') && !text.includes('qualifier'))) {
        return 'S';
      }

      // Tier A: Ligas Tier 1 de Ubisoft (Europe League, North America League, Brazil League, Asia League)
      if (
        text.includes('league') ||
        text.includes('pro league') ||
        raw === 'a' ||
        raw === 's'
      ) {
        return 'A';
      }

      return raw === 'b' ? 'B' : 'C';
    }

    case 'DOTA2': {
      // Tier S: The International, Riyadh Masters / Esports World Cup, ESL One, DreamLeague
      if (
        text.includes('the international') ||
        text.includes('riyadh masters') ||
        text.includes('esports world cup') ||
        text.includes('esl one') ||
        text.includes('dreamleague')
      ) {
        return 'S';
      }

      // Tier A: PGL Wallachia, BetBoom Dacha, FISSURE Universe
      if (
        text.includes('wallachia') ||
        text.includes('dacha') ||
        text.includes('fissure') ||
        text.includes('pgl') ||
        raw === 'a' ||
        raw === 's'
      ) {
        return 'A';
      }

      return raw === 'b' ? 'B' : 'C';
    }

    case 'FÚTBOL': {
      const c = (rawTier || '').toUpperCase();
      // Tier S: Champions League, World Cup, Eurocopa, Copa América y las grandes ligas europeas
      if (
        c === 'CL' ||
        c === 'WC' ||
        c === 'EC' ||
        c === 'PD' || // LaLiga EA Sports
        c === 'PL' || // Premier League
        c === 'SA' || // Serie A
        c === 'BL1' || // Bundesliga
        text.includes('champions league') ||
        text.includes('world cup') ||
        text.includes('copa mundial') ||
        text.includes('european championship') ||
        text.includes('euro') ||
        text.includes('copa américa') ||
        text.includes('laliga') ||
        text.includes('premier league') ||
        text.includes('serie a') ||
        text.includes('bundesliga')
      ) {
        return 'S';
      }

      // Tier A: Europa League, Conference League, Ligue 1, Copas nacionales principales
      if (
        c === 'EL' ||
        c === 'ECL' ||
        c === 'FL1' ||
        c === 'DED' ||
        c === 'PPL' ||
        c === 'CLI' ||
        text.includes('europa league') ||
        text.includes('conference') ||
        text.includes('ligue 1') ||
        text.includes('copa del rey') ||
        text.includes('fa cup') ||
        text.includes('coppa italia') ||
        text.includes('dfb-pokal') ||
        text.includes('brasileir')
      ) {
        return 'A';
      }

      // Tier B: Segundas divisiones y Supercopas
      if (
        c === 'ELC' ||
        text.includes('segunda') ||
        text.includes('championship') ||
        text.includes('supercopa') ||
        text.includes('super cup')
      ) {
        return 'B';
      }

      return 'B';
    }

    default:
      return 'C';
  }
}

/**
 * Resuelve el ID del torneo maestro (de MASTER_TOURNAMENTS) al que pertenece un
 * partido, a partir de su juego y de los textos de liga / serie / torneo.
 *
 * Se usa para que el favorito de un torneo (guardado por ID) coincida de forma
 * fiable con todos sus partidos, incluidos los Élite Tier S, aunque el nombre de
 * la liga que devuelve la API no sea idéntico al del catálogo.
 */
export function resolveMasterTournamentId(
  game: SportCategory | string,
  leagueName?: string,
  tournamentName?: string,
  serieName?: string,
  competitionCode?: string
): string | null {
  const text = `${leagueName || ''} ${serieName || ''} ${tournamentName || ''}`.toLowerCase();

  const specific = ((): string | null => {
    switch (game) {
      case 'VALORANT': {
        const isChallengers = text.includes('challenger');
        const isAscension = text.includes('ascension');
        const isGameChangers = text.includes('game changer') || text.includes('gamechanger');
        if (isChallengers || isAscension || isGameChangers) return null;

        const isVCT = text.includes('vct') || text.includes('valorant champions tour');
        if (isVCT) {
          if (text.includes('emea')) return 'vlr-emea';
          if (text.includes('americas')) return 'vlr-americas';
          if (text.includes('pacific')) return 'vlr-pacific';
          if (text.includes('china') || text.includes(' cn ')) return 'vlr-china';
          if (text.includes('masters')) return 'vlr-masters';
          // "Champions" como torneo (Mundial). El circuito base "Valorant Champions Tour"
          // sin región ni split concreto se resuelve también al Mundial.
          if (text.includes('champions')) return 'vlr-champions';
        }
        return null;
      }
      case 'LOL': {
        if (text.includes('world')) return 'lol-worlds';
        if (text.includes('mid-season') || text.includes('msi')) return 'lol-msi';
        if (text.includes('lec')) return 'lol-lec';
        if (text.includes('lck')) return 'lol-lck';
        if (text.includes('lpl')) return 'lol-lpl';
        if (text.includes('lcs') || text.includes('lta')) return 'lol-lcs';
        return null;
      }
      case 'CS2': {
        if (text.includes('major')) return 'cs2-major';
        if (text.includes('iem')) return 'cs2-iem';
        if (text.includes('esl pro league')) return 'cs2-esl-pro';
        if (text.includes('blast')) return 'cs2-blast';
        return null;
      }
      case 'R6': {
        if (text.includes('invitational')) return 'r6-six-invitational';
        if (text.includes('major')) return 'r6-six-major';
        if (text.includes('league') || text.includes('pro league')) return 'r6-europe-league';
        return null;
      }
      case 'DOTA2': {
        if (text.includes('the international')) return 'dota-ti';
        if (text.includes('riyadh') || text.includes('esports world cup')) return 'dota-riyadh';
        return null;
      }
      case 'FÚTBOL': {
        const c = (competitionCode || '').toUpperCase();
        if (c === 'CL' || text.includes('champions league')) return 'foot-CL';
        if (c === 'PD' || text.includes('laliga') || text.includes('primera division')) return 'foot-PD';
        if (c === 'PL' || text.includes('premier league')) return 'foot-PL';
        if (c === 'BL1' || text.includes('bundesliga')) return 'foot-BL1';
        if (c === 'SA' || text.includes('serie a')) return 'foot-SA';
        return null;
      }
      default:
        return null;
    }
  })();

  if (specific) return specific;

  // Fallback genérico: busca el torneo maestro del mismo juego cuyo nombre, nombre
  // corto o slug aparezca en los textos del partido. Gana la coincidencia más
  // específica (la más larga). Esto cubre torneos que no tienen patrón propio
  // (p. ej. "EMEA Masters", "Superliga LVP", etc.) para que el favorito por ID
  // sea fiable y quitar un torneo lo oculte de verdad.
  let best: { id: string; len: number } | null = null;
  for (const mt of MASTER_TOURNAMENTS) {
    if (mt.game !== game) continue;
    const variants = [mt.name, mt.shortName, mt.slug]
      .filter((v): v is string => Boolean(v))
      .map((v) => v.toLowerCase().trim())
      .filter((v) => v.length >= 4);
    for (const v of variants) {
      if (text.includes(v) && (!best || v.length > best.len)) {
        best = { id: mt.id, len: v.length };
      }
    }
  }

  return best ? best.id : null;
}

/**
 * Torneos Élite (Tier S) que se marcan como favoritos por defecto.
 * Devuelve tanto el ID como el nombre de cada uno, para que coincidan de forma
 * fiable con el feed de partidos, el catálogo de torneos y el reloj GTR 3.
 * El usuario puede quitarlos de favoritos y dejarán de aparecer.
 */
export function getDefaultFavoriteTournaments(): string[] {
  const result: string[] = [];
  for (const t of MASTER_TOURNAMENTS) {
    if (t.tier !== 'S') continue;
    if (!result.includes(t.id)) result.push(t.id);
    if (!result.includes(t.name)) result.push(t.name);
  }
  return result;
}

/**
 * Determina la región competitiva de un partido o torneo.
 */
export function resolveMatchRegion(
  game: SportCategory,
  leagueName?: string,
  tournamentName?: string,
  serieName?: string,
  rawRegion?: string,
  rawCountry?: string
): MatchRegion {
  const text = `${leagueName || ''} ${serieName || ''} ${tournamentName || ''}`.toLowerCase();
  const reg = (rawRegion || '').toUpperCase().trim();
  const cty = (rawCountry || '').toUpperCase().trim();

  // 1. España (competiciones nacionales o territoriales españolas)
  if (
    text.includes('laliga') ||
    text.includes('primera division') ||
    text.includes('copa del rey') ||
    text.includes('superliga') ||
    text.includes('iberian cup') ||
    text.includes('rising') ||
    text.includes('spain') ||
    text.includes('españa') ||
    cty === 'ES' ||
    cty === 'ESP'
  ) {
    return 'ESPAÑA';
  }

  // 2. Torneos Globales / Internacionales (Mundiales, Masters, Invitationals)
  if (game !== 'FÚTBOL') {
    const isChallengers = text.includes('challenger');
    const isAscension = text.includes('ascension');
    const isGameChangers = text.includes('game changer') || text.includes('gamechanger');

    if (
      (text.includes('champions') && !isChallengers && !isGameChangers) ||
      (text.includes('masters') && !isChallengers) ||
      text.includes('world championship') ||
      text.includes('worlds') ||
      text.includes('msi') ||
      text.includes('mid-season') ||
      text.includes('first stand') ||
      (text.includes('major') && !text.includes('qualifier')) ||
      text.includes('the international') ||
      text.includes('riyadh masters') ||
      text.includes('esports world cup') ||
      text.includes('six invitational') ||
      text.includes('iem katowice') ||
      text.includes('iem cologne') ||
      text.includes('world final')
    ) {
      return 'GLOBAL';
    }
  } else {
    // Fútbol mundial
    if (text.includes('world cup') || text.includes('copa mundial') || text.includes('club world cup')) {
      return 'GLOBAL';
    }
  }

  // 3. EMEA / Europa
  if (
    text.includes('emea') ||
    text.includes('europe') ||
    text.includes('lec') ||
    text.includes('premier league') ||
    text.includes('serie a') ||
    text.includes('bundesliga') ||
    text.includes('ligue 1') ||
    text.includes('champions league') ||
    text.includes('europa league') ||
    text.includes('conference') ||
    text.includes('lfl') ||
    text.includes('prime league') ||
    text.includes('tcl') ||
    reg === 'EEU' ||
    reg === 'WEU' ||
    reg === 'EU'
  ) {
    return 'EMEA';
  }

  // 4. Américas
  if (
    text.includes('americas') ||
    text.includes('north america') ||
    text.includes('south america') ||
    text.includes('lcs') ||
    text.includes('lta') ||
    text.includes('cblol') ||
    text.includes('latam') ||
    text.includes('brazil') ||
    text.includes('copa libertadores') ||
    reg === 'NA' ||
    reg === 'SA' ||
    reg === 'BR' ||
    reg === 'LATAM' ||
    cty === 'US' ||
    cty === 'BR'
  ) {
    return 'AMERICAS';
  }

  // 5. Asia-Pacífico
  if (
    text.includes('pacific') ||
    text.includes('china') ||
    text.includes(' cn ') ||
    text.includes('korea') ||
    text.includes('lck') ||
    text.includes('lpl') ||
    text.includes('lcp') ||
    text.includes('asia') ||
    text.includes('japan') ||
    text.includes('pcs') ||
    text.includes('vcs') ||
    reg === 'ASIA' ||
    reg === 'KR' ||
    reg === 'CN' ||
    reg === 'APAC' ||
    cty === 'KR' ||
    cty === 'CN' ||
    cty === 'JP'
  ) {
    return 'ASIA';
  }

  // Fallbacks razonables
  if (game === 'FÚTBOL') return 'EMEA';
  if (reg === 'WEU' || reg === 'EEU') return 'EMEA';
  if (reg === 'NA' || reg === 'SA') return 'AMERICAS';
  if (reg === 'ASIA') return 'ASIA';

  return 'GLOBAL';
}

const ROSTER_CACHE = new Map<string | number, PlayerInfo[]>();

/**
 * Retorna las plantillas y jugadores titulares oficiales de los clubes/equipos más reconocidos.
 */
export function getKnownTeamRoster(teamName: string, game: SportCategory): PlayerInfo[] {
  const tn = (teamName || '').toLowerCase().trim();

  // REAL MADRID (Fútbol)
  if (tn.includes('real madrid')) {
    return [
      { id: 'rma-1', name: 'Thibaut Courtois', nickname: 'Courtois', role: 'Portero', nationality: 'BE', number: 1 },
      { id: 'rma-2', name: 'Dani Carvajal', nickname: 'Carvajal', role: 'Lateral Derecho', nationality: 'ES', number: 2 },
      { id: 'rma-3', name: 'Éder Militão', nickname: 'Militão', role: 'Defensa Central', nationality: 'BR', number: 3 },
      { id: 'rma-4', name: 'Antonio Rüdiger', nickname: 'Rüdiger', role: 'Defensa Central', nationality: 'DE', number: 22 },
      { id: 'rma-5', name: 'Ferland Mendy', nickname: 'Mendy', role: 'Lateral Izquierdo', nationality: 'FR', number: 23 },
      { id: 'rma-6', name: 'Federico Valverde', nickname: 'Valverde', role: 'Centrocampista', nationality: 'UY', number: 8 },
      { id: 'rma-7', name: 'Aurélien Tchouaméni', nickname: 'Tchouaméni', role: 'Pivote', nationality: 'FR', number: 14 },
      { id: 'rma-8', name: 'Jude Bellingham', nickname: 'Bellingham', role: 'Mediapunta', nationality: 'GB', number: 5 },
      { id: 'rma-9', name: 'Rodrygo Goes', nickname: 'Rodrygo', role: 'Extremo Derecho', nationality: 'BR', number: 11 },
      { id: 'rma-10', name: 'Kylian Mbappé', nickname: 'Mbappé', role: 'Delantero Centro', nationality: 'FR', number: 9 },
      { id: 'rma-11', name: 'Vinícius Júnior', nickname: 'Vini Jr.', role: 'Extremo Izquierdo', nationality: 'BR', number: 7 },
    ];
  }

  // BARCELONA (Fútbol)
  if (tn.includes('barcelona') || tn.includes('barça')) {
    return [
      { id: 'fcb-1', name: 'Marc-André ter Stegen', nickname: 'Ter Stegen', role: 'Portero', nationality: 'DE', number: 1 },
      { id: 'fcb-2', name: 'Jules Koundé', nickname: 'Koundé', role: 'Lateral Derecho', nationality: 'FR', number: 23 },
      { id: 'fcb-3', name: 'Pau Cubarsí', nickname: 'Cubarsí', role: 'Defensa Central', nationality: 'ES', number: 2 },
      { id: 'fcb-4', name: 'Iñigo Martínez', nickname: 'Iñigo Martínez', role: 'Defensa Central', nationality: 'ES', number: 5 },
      { id: 'fcb-5', name: 'Alejandro Balde', nickname: 'Balde', role: 'Lateral Izquierdo', nationality: 'ES', number: 3 },
      { id: 'fcb-6', name: 'Marc Casadó', nickname: 'Casadó', role: 'Pivote', nationality: 'ES', number: 17 },
      { id: 'fcb-7', name: 'Pedri González', nickname: 'Pedri', role: 'Interior', nationality: 'ES', number: 8 },
      { id: 'fcb-8', name: 'Dani Olmo', nickname: 'Dani Olmo', role: 'Mediapunta', nationality: 'ES', number: 20 },
      { id: 'fcb-9', name: 'Lamine Yamal', nickname: 'Lamine Yamal', role: 'Extremo Derecho', nationality: 'ES', number: 19 },
      { id: 'fcb-10', name: 'Robert Lewandowski', nickname: 'Lewandowski', role: 'Delantero Centro', nationality: 'PL', number: 9 },
      { id: 'fcb-11', name: 'Raphinha Dias', nickname: 'Raphinha', role: 'Extremo Izquierdo', nationality: 'BR', number: 11 },
    ];
  }

  // REAL SOCIEDAD (Fútbol)
  if (tn.includes('sociedad')) {
    return [
      { id: 'rso-1', name: 'Álex Remiro', nickname: 'Remiro', role: 'Portero', nationality: 'ES', number: 1 },
      { id: 'rso-2', name: 'Jon Aramburu', nickname: 'Aramburu', role: 'Lateral Derecho', nationality: 'VE', number: 27 },
      { id: 'rso-3', name: 'Igor Zubeldia', nickname: 'Zubeldia', role: 'Defensa Central', nationality: 'ES', number: 5 },
      { id: 'rso-4', name: 'Nayef Aguerd', nickname: 'Aguerd', role: 'Defensa Central', nationality: 'MA', number: 21 },
      { id: 'rso-5', name: 'Javi López', nickname: 'Javi López', role: 'Lateral Izquierdo', nationality: 'ES', number: 12 },
      { id: 'rso-6', name: 'Martín Zubimendi', nickname: 'Zubimendi', role: 'Pivote', nationality: 'ES', number: 4 },
      { id: 'rso-7', name: 'Luka Sučić', nickname: 'Sučić', role: 'Interior', nationality: 'HR', number: 24 },
      { id: 'rso-8', name: 'Brais Méndez', nickname: 'Brais Méndez', role: 'Interior', nationality: 'ES', number: 23 },
      { id: 'rso-9', name: 'Takefusa Kubo', nickname: 'Take Kubo', role: 'Extremo Derecho', nationality: 'JP', number: 14 },
      { id: 'rso-10', name: 'Mikel Oyarzabal', nickname: 'Oyarzabal', role: 'Delantero / Capitán', nationality: 'ES', number: 10 },
      { id: 'rso-11', name: 'Sergio Gómez', nickname: 'Sergio Gómez', role: 'Extremo Izquierdo', nationality: 'ES', number: 17 },
    ];
  }

  // BAYERN MUNICH (Fútbol)
  if (tn.includes('bayern')) {
    return [
      { id: 'bay-1', name: 'Manuel Neuer', nickname: 'Neuer', role: 'Portero', nationality: 'DE', number: 1 },
      { id: 'bay-2', name: 'Joshua Kimmich', nickname: 'Kimmich', role: 'Lateral / Pivote', nationality: 'DE', number: 6 },
      { id: 'bay-3', name: 'Dayot Upamecano', nickname: 'Upamecano', role: 'Defensa Central', nationality: 'FR', number: 2 },
      { id: 'bay-4', name: 'Kim Min-jae', nickname: 'Min-jae', role: 'Defensa Central', nationality: 'KR', number: 3 },
      { id: 'bay-5', name: 'Alphonso Davies', nickname: 'Davies', role: 'Lateral Izquierdo', nationality: 'CA', number: 19 },
      { id: 'bay-6', name: 'Aleksandar Pavlović', nickname: 'Pavlović', role: 'Pivote', nationality: 'DE', number: 45 },
      { id: 'bay-7', name: 'Jamal Musiala', nickname: 'Musiala', role: 'Mediapunta', nationality: 'DE', number: 42 },
      { id: 'bay-8', name: 'Michael Olise', nickname: 'Olise', role: 'Extremo Derecho', nationality: 'FR', number: 17 },
      { id: 'bay-9', name: 'Leroy Sané', nickname: 'Sané', role: 'Extremo Izquierdo', nationality: 'DE', number: 10 },
      { id: 'bay-10', name: 'Harry Kane', nickname: 'Kane', role: 'Delantero Centro', nationality: 'GB', number: 9 },
      { id: 'bay-11', name: 'Thomas Müller', nickname: 'Müller', role: 'Segundo Delantero', nationality: 'DE', number: 25 },
    ];
  }

  // G2 ESPORTS
  if (tn.includes('g2')) {
    if (game === 'VALORANT') {
      return [
        { id: 'g2-v1', name: 'Jacob Batchelor', nickname: 'valyn', role: 'In-Game Leader (Controlador)', nationality: 'US' },
        { id: 'g2-v2', name: 'Nathan Orf', nickname: 'leaf', role: 'Duelista / Centinela', nationality: 'US' },
        { id: 'g2-v3', name: 'Trent Cairns', nickname: 'trent', role: 'Iniciador', nationality: 'US' },
        { id: 'g2-v4', name: 'Jonah Pulice', nickname: 'JonahP', role: 'Flex / Iniciador', nationality: 'CA' },
        { id: 'g2-v5', name: 'Alexander Mor', nickname: 'jawgemo', role: 'Duelista', nationality: 'KH' },
      ];
    }
    return [
      { id: 'g2-l1', name: 'Sergen Çelik', nickname: 'BrokenBlade', role: 'Toplaner', nationality: 'DE' },
      { id: 'g2-l2', name: 'Martin Sundelin', nickname: 'Yike', role: 'Jungler', nationality: 'SE' },
      { id: 'g2-l3', name: 'Rasmus Winther', nickname: 'Caps', role: 'Midlaner', nationality: 'DK' },
      { id: 'g2-l4', name: 'Steven Liv', nickname: 'Hans Sama', role: 'ADC (Tirador)', nationality: 'FR' },
      { id: 'g2-l5', name: 'Mihael Mehle', nickname: 'Mikyx', role: 'Support', nationality: 'SI' },
    ];
  }

  // TEAM LIQUID
  if (tn.includes('liquid') || tn === 'tl') {
    if (game === 'VALORANT') {
      return [
        { id: 'tl-v1', name: 'Ayaz Akhmetshin', nickname: 'nAts', role: 'Centinela / Flex', nationality: 'RU' },
        { id: 'tl-v2', name: 'Seymon Borchev', nickname: 'purp0', role: 'Duelista', nationality: 'RU' },
        { id: 'tl-v3', name: 'Nikita Cherednichenko', nickname: 'trexx', role: 'Iniciador', nationality: 'RU' },
        { id: 'tl-v4', name: 'Dominykas Lukaševičius', nickname: 'MiniBoo', role: 'Duelista', nationality: 'LT' },
        { id: 'tl-v5', name: 'Kamil Frąckowiak', nickname: 'kamo', role: 'In-Game Leader', nationality: 'PL' },
      ];
    }
  }

  // MOVISTAR KOI
  if (tn.includes('koi')) {
    if (game === 'VALORANT') {
      return [
        { id: 'koi-v1', name: 'Grzegorz Grzegorzewski', nickname: 'grubinho', role: 'In-Game Leader', nationality: 'PL' },
        { id: 'koi-v2', name: 'Kamil Frąckowiak', nickname: 'kamo', role: 'Duelista', nationality: 'PL' },
        { id: 'koi-v3', name: 'Dom Sulcas', nickname: 'soulcas', role: 'Iniciador', nationality: 'GB' },
        { id: 'koi-v4', name: 'Bogdan Naumov', nickname: 'sheydos', role: 'Centinela', nationality: 'RU' },
        { id: 'koi-v5', name: 'Patryk Kopczyński', nickname: 'starxo', role: 'Iniciador', nationality: 'PL' },
      ];
    }
    return [
      { id: 'koi-l1', name: 'Mathias Jensen', nickname: 'Szygenda', role: 'Toplaner', nationality: 'DK' },
      { id: 'koi-l2', name: 'Mark van Woensel', nickname: 'Markoon', role: 'Jungler', nationality: 'NL' },
      { id: 'koi-l3', name: 'Emil Larsson', nickname: 'Larssen', role: 'Midlaner', nationality: 'SE' },
      { id: 'koi-l4', name: 'David Martínez', nickname: 'Supa', role: 'ADC (Tirador)', nationality: 'ES' },
      { id: 'koi-l5', name: 'Álvaro Fernández', nickname: 'Alvaro', role: 'Support', nationality: 'ES' },
    ];
  }

  // FNATIC
  if (tn.includes('fnatic') || tn === 'fnc') {
    if (game === 'VALORANT') {
      return [
        { id: 'fnc-v1', name: 'Jake Howlett', nickname: 'Boaster', role: 'In-Game Leader (Capitán)', nationality: 'GB' },
        { id: 'fnc-v2', name: 'Nikita Sirmitev', nickname: 'Derke', role: 'Duelista', nationality: 'FI' },
        { id: 'fnc-v3', name: 'Emir Ali Beder', nickname: 'Alfajer', role: 'Centinela', nationality: 'TR' },
        { id: 'fnc-v4', name: 'Timofey Khromov', nickname: 'Chronicle', role: 'Flex / Iniciador', nationality: 'RU' },
        { id: 'fnc-v5', name: 'Kajetan Fabiański', nickname: 'hiro', role: 'Iniciador', nationality: 'PL' },
      ];
    }
    return [
      { id: 'fnc-l1', name: 'Óscar Muñoz', nickname: 'Oscarinin', role: 'Toplaner', nationality: 'ES' },
      { id: 'fnc-l2', name: 'Iván Martín', nickname: 'Razork', role: 'Jungler', nationality: 'ES' },
      { id: 'fnc-l3', name: 'Marek Brázda', nickname: 'Humanoid', role: 'Midlaner', nationality: 'CZ' },
      { id: 'fnc-l4', name: 'Oh Hyeon-taek', nickname: 'Noah', role: 'ADC', nationality: 'KR' },
      { id: 'fnc-l5', name: 'Yoon Se-jun', nickname: 'Jun', role: 'Support', nationality: 'KR' },
    ];
  }

  // TEAM HERETICS
  if (tn.includes('heretics') || tn === 'th') {
    if (game === 'VALORANT') {
      return [
        { id: 'th-v1', name: 'Ričardas Lukaševičius', nickname: 'Boo', role: 'In-Game Leader', nationality: 'LT' },
        { id: 'th-v2', name: 'Benjy Fish', nickname: 'benjyfishy', role: 'Centinela', nationality: 'GB' },
        { id: 'th-v3', name: 'Enes Ecirli', nickname: 'RieNs', role: 'Iniciador', nationality: 'TR' },
        { id: 'th-v4', name: 'Mert Alkan', nickname: 'Wo0t', role: 'Flex / Duelista', nationality: 'TR' },
        { id: 'th-v5', name: 'Patryk Fabiański', nickname: 'paTiTek', role: 'Controlador', nationality: 'PL' },
      ];
    }
  }

  // KARMINE CORP
  if (tn.includes('karmine') || tn === 'kc') {
    if (game === 'VALORANT') {
      return [
        { id: 'kc-v1', name: 'Martin Peňkov', nickname: 'Magnum', role: 'In-Game Leader', nationality: 'CZ' },
        { id: 'kc-v2', name: 'Martin Pátek', nickname: 'marteen', role: 'Duelista', nationality: 'CZ' },
        { id: 'kc-v3', name: 'Marshall Massey', nickname: 'N4RRATE', role: 'Iniciador', nationality: 'US' },
        { id: 'kc-v4', name: 'Tomás Oliveira', nickname: 'tomaszy', role: 'Controlador', nationality: 'PT' },
        { id: 'kc-v5', name: 'Ryad Ensaad', nickname: 'Shin', role: 'Iniciador', nationality: 'FR' },
      ];
    }
  }

  // NAVI (CS2)
  if (tn.includes('navi') || tn.includes('natus vincere')) {
    return [
      { id: 'navi-1', name: 'Aleksi Virolainen', nickname: 'Aleksib', role: 'In-Game Leader', nationality: 'FI' },
      { id: 'navi-2', name: 'Valeriy Vakhovskiy', nickname: 'b1t', role: 'Rifler', nationality: 'UA' },
      { id: 'navi-3', name: 'Mihai Ivan', nickname: 'iM', role: 'Rifler / Entry', nationality: 'RO' },
      { id: 'navi-4', name: 'Justinas Lekavicius', nickname: 'jL', role: 'Rifler / Support', nationality: 'LT' },
      { id: 'navi-5', name: 'Ihor Zhdanov', nickname: 'w0nderful', role: 'AWPer (Francotirador)', nationality: 'UA' },
    ];
  }

  // FAZE CLAN (CS2)
  if (tn.includes('faze')) {
    return [
      { id: 'faze-1', name: 'Finn Andersen', nickname: 'karrigan', role: 'In-Game Leader', nationality: 'DK' },
      { id: 'faze-2', name: 'Håvard Nygaard', nickname: 'rain', role: 'Entry Fragger', nationality: 'NO' },
      { id: 'faze-3', name: 'David Čerňanský', nickname: 'frozen', role: 'Rifler', nationality: 'SK' },
      { id: 'faze-4', name: 'Robin Kool', nickname: 'ropz', role: 'Lurker', nationality: 'EE' },
      { id: 'faze-5', name: 'Helvijs Saukants', nickname: 'broky', role: 'AWPer', nationality: 'LV' },
    ];
  }

  return [];
}

/**
 * Retorna las emisiones oficiales y canales en directo del torneo.
 */
export function getDefaultStreams(game: SportCategory, leagueName?: string): MatchStream[] {
  switch (game) {
    case 'VALORANT':
      return [
        {
          name: 'VALORANT España Oficial (Twitch)',
          language: 'es',
          rawUrl: 'https://www.twitch.tv/valorant_es',
          embedUrl: 'https://player.twitch.tv/?channel=valorant_es',
          official: true,
          platform: 'twitch',
        },
        {
          name: 'VALORANT Champions Tour (English Twitch)',
          language: 'en',
          rawUrl: 'https://www.twitch.tv/valorant',
          embedUrl: 'https://player.twitch.tv/?channel=valorant',
          official: true,
          platform: 'twitch',
        },
        {
          name: 'VCT Official Broadcast (YouTube)',
          language: 'en',
          rawUrl: 'https://www.youtube.com/@valorantesports',
          official: true,
          platform: 'youtube',
        },
      ];
    case 'LOL':
      return [
        {
          name: 'LVPes LoL (Twitch Castellano)',
          language: 'es',
          rawUrl: 'https://www.twitch.tv/lvpes',
          embedUrl: 'https://player.twitch.tv/?channel=lvpes',
          official: true,
          platform: 'twitch',
        },
        {
          name: 'Riot Games LEC (Twitch English)',
          language: 'en',
          rawUrl: 'https://www.twitch.tv/lec',
          embedUrl: 'https://player.twitch.tv/?channel=lec',
          official: true,
          platform: 'twitch',
        },
      ];
    case 'CS2':
      return [
        {
          name: 'ESL CS (Twitch)',
          language: 'en',
          rawUrl: 'https://www.twitch.tv/eslcs',
          embedUrl: 'https://player.twitch.tv/?channel=eslcs',
          official: true,
          platform: 'twitch',
        },
        {
          name: 'BLAST Premier (Twitch)',
          language: 'en',
          rawUrl: 'https://www.twitch.tv/blastpremier',
          embedUrl: 'https://player.twitch.tv/?channel=blastpremier',
          official: true,
          platform: 'twitch',
        },
      ];
    case 'R6':
      return [
        {
          name: 'Rainbow6 Oficial (Twitch)',
          language: 'en',
          rawUrl: 'https://www.twitch.tv/rainbow6',
          embedUrl: 'https://player.twitch.tv/?channel=rainbow6',
          official: true,
          platform: 'twitch',
        },
      ];
    case 'DOTA2':
      return [
        {
          name: 'ESL Dota 2 Oficial (Twitch)',
          language: 'en',
          rawUrl: 'https://www.twitch.tv/esl_dota2',
          embedUrl: 'https://player.twitch.tv/?channel=esl_dota2',
          official: true,
          platform: 'twitch',
        },
      ];
    case 'FÚTBOL':
      return [
        {
          name: 'DAZN LaLiga',
          language: 'es',
          rawUrl: 'https://www.dazn.com/es-ES/home',
          official: true,
          platform: 'tv',
        },
        {
          name: 'Movistar Plus+ LaLiga',
          language: 'es',
          rawUrl: 'https://ver.movistarplus.es',
          official: true,
          platform: 'tv',
        },
      ];
    default:
      return [];
  }
}

/**
 * Genera el desglose mapa por mapa o juego por juego para esports.
 */
export function generateMatchGames(
  game: SportCategory,
  bestOf: number = 3,
  rawGames?: any[],
  oppA?: any,
  oppB?: any
): MatchMapGame[] {
  const mapPools: Record<string, string[]> = {
    VALORANT: ['Ascent', 'Bind', 'Haven', 'Sunset', 'Abyss'],
    CS2: ['Mirage', 'Inferno', 'Nuke', 'Dust II', 'Ancient'],
    LOL: ['Juego 1', 'Juego 2', 'Juego 3', 'Juego 4', 'Juego 5'],
    R6: ['Clubhouse', 'Oregon', 'Border', 'Bank', 'Chalet'],
    DOTA2: ['Partida 1', 'Partida 2', 'Partida 3', 'Partida 4', 'Partida 5'],
  };

  const pool = mapPools[game] || ['Mapa 1', 'Mapa 2', 'Mapa 3'];
  const total = bestOf || 3;
  const result: MatchMapGame[] = [];

  for (let i = 0; i < total; i++) {
    const rawG = rawGames && rawGames[i];
    let status: 'finished' | 'running' | 'not_started' = 'not_started';
    let winnerTeam: 'A' | 'B' | undefined;
    let duration: string | undefined;

    if (rawG) {
      if (rawG.status === 'finished') status = 'finished';
      else if (rawG.status === 'running') status = 'running';

      if (rawG.winner && rawG.winner.id) {
        if (oppA && rawG.winner.id === oppA.id) winnerTeam = 'A';
        else if (oppB && rawG.winner.id === oppB.id) winnerTeam = 'B';
      }
      if (rawG.length) {
        duration = `${Math.round(rawG.length / 60)} min`;
      }
    }

    result.push({
      position: i + 1,
      mapName: pool[i % pool.length],
      status,
      winnerTeam,
      duration,
    });
  }

  return result;
}


// Catálogo Maestro de Torneos Oficiales
export const MASTER_TOURNAMENTS: TournamentItem[] = [
  // FÚTBOL
  {
    id: 'foot-PD',
    name: 'LaLiga EA Sports',
    shortName: 'LaLiga',
    slug: 'laliga',
    logo: 'https://crests.football-data.org/laliga.png',
    game: 'FÚTBOL',
    tier: 'S',
    region: 'ESPAÑA',
    externalId: 'PD',
    country: 'España',
    description: 'Primera División de Fútbol Profesional de España',
  },
  {
    id: 'foot-CL',
    name: 'UEFA Champions League',
    shortName: 'Champions',
    slug: 'champions-league',
    logo: 'https://crests.football-data.org/CL.png',
    game: 'FÚTBOL',
    tier: 'S',
    region: 'EMEA',
    externalId: 'CL',
    description: 'Máxima competición continental de clubes europeos',
  },
  {
    id: 'foot-PL',
    name: 'Premier League',
    shortName: 'Premier',
    slug: 'premier-league',
    logo: 'https://crests.football-data.org/PL.png',
    game: 'FÚTBOL',
    tier: 'S',
    region: 'EMEA',
    externalId: 'PL',
    country: 'Inglaterra',
    description: 'Primera división de fútbol de Inglaterra',
  },
  {
    id: 'foot-CDR',
    name: 'Copa del Rey',
    shortName: 'Copa del Rey',
    slug: 'copa-del-rey',
    logo: 'https://crests.football-data.org/copa_del_rey.png',
    game: 'FÚTBOL',
    tier: 'A',
    region: 'ESPAÑA',
    country: 'España',
    description: 'Campeonato de España - Copa de SM El Rey',
  },
  {
    id: 'foot-BL1',
    name: 'Bundesliga',
    shortName: 'Bundesliga',
    slug: 'bundesliga',
    logo: 'https://crests.football-data.org/BL1.png',
    game: 'FÚTBOL',
    tier: 'S',
    region: 'EMEA',
    externalId: 'BL1',
    country: 'Alemania',
    description: 'Liga nacional de fútbol de Alemania',
  },
  {
    id: 'foot-SA',
    name: 'Serie A',
    shortName: 'Serie A',
    slug: 'serie-a',
    logo: 'https://crests.football-data.org/SA.png',
    game: 'FÚTBOL',
    tier: 'S',
    region: 'EMEA',
    externalId: 'SA',
    country: 'Italia',
    description: 'Primera división de fútbol de Italia',
  },
  {
    id: 'foot-EL',
    name: 'UEFA Europa League',
    shortName: 'Europa League',
    slug: 'europa-league',
    logo: 'https://crests.football-data.org/EL.png',
    game: 'FÚTBOL',
    tier: 'A',
    region: 'EMEA',
    externalId: 'EL',
    description: 'Segunda competición europea de clubes',
  },
  {
    id: 'foot-SD',
    name: 'LaLiga Hypermotion',
    shortName: 'Segunda División',
    slug: 'laliga-hypermotion',
    logo: 'https://crests.football-data.org/laliga.png',
    game: 'FÚTBOL',
    tier: 'B',
    region: 'ESPAÑA',
    externalId: 'SD',
    country: 'España',
    description: 'Segunda División de España',
  },

  // VALORANT (Tier S exclusivamente Riot VCT Tier 1 Oficial)
  {
    id: 'vlr-champions',
    name: 'Valorant Champions',
    shortName: 'Champions',
    slug: 'valorant-champions',
    logo: 'https://cdn-api.pandascore.co/images/league/image/4531/800px-vct_2023_logo_lightmode-png',
    game: 'VALORANT',
    tier: 'S',
    region: 'GLOBAL',
    leagueId: 4531,
    externalId: '10953',
    description: 'Campeonato Mundial Oficial de Riot Games',
  },
  {
    id: 'vlr-masters',
    name: 'VCT Masters',
    shortName: 'Masters',
    slug: 'vct-masters',
    logo: 'https://cdn-api.pandascore.co/images/league/image/4531/800px-vct_2023_logo_lightmode-png',
    game: 'VALORANT',
    tier: 'S',
    region: 'GLOBAL',
    leagueId: 4531,
    externalId: '10648',
    description: 'Torneo Internacional Mayor de Valorant (Madrid, Shanghai, London)',
  },
  {
    id: 'vlr-emea',
    name: 'VCT EMEA',
    shortName: 'VCT EMEA',
    slug: 'vct-emea',
    logo: 'https://cdn-api.pandascore.co/images/league/image/4531/800px-vct_2023_logo_lightmode-png',
    game: 'VALORANT',
    tier: 'S',
    region: 'EMEA',
    leagueId: 4531,
    externalId: '10775',
    description: 'Liga Oficial Tier 1 de Europa, Turquía, CIS y Oriente Medio',
  },
  {
    id: 'vlr-americas',
    name: 'VCT Americas',
    shortName: 'VCT Americas',
    slug: 'vct-americas',
    logo: 'https://cdn-api.pandascore.co/images/league/image/4531/800px-vct_2023_logo_lightmode-png',
    game: 'VALORANT',
    tier: 'S',
    region: 'AMERICAS',
    leagueId: 4531,
    externalId: '10746',
    description: 'Liga Oficial Tier 1 de Norteamérica, Brasil y LATAM',
  },
  {
    id: 'vlr-pacific',
    name: 'VCT Pacific',
    shortName: 'VCT Pacific',
    slug: 'vct-pacific',
    logo: 'https://cdn-api.pandascore.co/images/league/image/4531/800px-vct_2023_logo_lightmode-png',
    game: 'VALORANT',
    tier: 'S',
    region: 'ASIA',
    leagueId: 4531,
    externalId: '10745',
    description: 'Liga Oficial Tier 1 de Corea, Japón, Sudeste Asiático y Oceanía',
  },
  {
    id: 'vlr-china',
    name: 'VCT China',
    shortName: 'VCT CN',
    slug: 'vct-china',
    logo: 'https://cdn-api.pandascore.co/images/league/image/4531/800px-vct_2023_logo_lightmode-png',
    game: 'VALORANT',
    tier: 'S',
    region: 'ASIA',
    leagueId: 4531,
    externalId: '10747',
    description: 'Liga Oficial Tier 1 de China',
  },
  {
    id: 'vlr-spain-rising',
    name: 'VCT Challengers Spain: Rising',
    shortName: 'Rising Spain',
    slug: 'vct-challengers-spain',
    game: 'VALORANT',
    tier: 'A',
    region: 'ESPAÑA',
    externalId: '10553',
    description: 'Liga regional oficial de España organizada por LVP',
  },
  {
    id: 'vlr-ascension',
    name: 'VCT Ascension EMEA',
    shortName: 'Ascension',
    slug: 'vct-ascension-emea',
    game: 'VALORANT',
    tier: 'A',
    region: 'EMEA',
    externalId: '9670',
    description: 'Torneo de ascenso a la VCT EMEA Tier 1',
  },
  {
    id: 'vlr-gc',
    name: 'VCT Game Changers',
    shortName: 'Game Changers',
    slug: 'vct-game-changers',
    game: 'VALORANT',
    tier: 'A',
    region: 'EMEA',
    leagueId: 4531,
    externalId: '10798',
    description: 'Circuito mundial inclusivo de Valorant',
  },

  // LEAGUE OF LEGENDS
  {
    id: 'lol-worlds',
    name: 'League of Legends World Championship',
    shortName: 'Worlds',
    slug: 'lol-worlds',
    logo: 'https://cdn-api.pandascore.co/images/league/image/297/worlds-png',
    game: 'LOL',
    tier: 'S',
    region: 'GLOBAL',
    leagueId: 297,
    externalId: '11014',
    description: 'Campeonato Mundial Oficial de League of Legends de Riot Games',
  },
  {
    id: 'lol-msi',
    name: 'Mid-Season Invitational (MSI)',
    shortName: 'MSI',
    slug: 'lol-msi',
    logo: 'https://cdn-api.pandascore.co/images/league/image/300/900px-msi_2021_lightmode-png',
    game: 'LOL',
    tier: 'S',
    region: 'GLOBAL',
    leagueId: 300,
    externalId: '10676',
    description: 'Torneo internacional de mitad de temporada',
  },
  {
    id: 'lol-lec',
    name: 'LEC (League of Legends EMEA Championship)',
    shortName: 'LEC',
    slug: 'lec',
    logo: 'https://cdn-api.pandascore.co/images/league/image/4197/lec_2023-png',
    game: 'LOL',
    tier: 'S',
    region: 'EMEA',
    leagueId: 4197,
    externalId: '10756',
    description: 'Máxima liga profesional de LoL en Europa',
  },
  {
    id: 'lol-lck',
    name: 'LCK (League of Legends Champions Korea)',
    shortName: 'LCK',
    slug: 'lck',
    logo: 'https://cdn-api.pandascore.co/images/league/image/293/lck_2021_logo-png',
    game: 'LOL',
    tier: 'S',
    region: 'ASIA',
    leagueId: 293,
    externalId: '10419',
    description: 'Liga coreana de élite de LoL',
  },
  {
    id: 'lol-lpl',
    name: 'LPL (League of Legends Pro League)',
    shortName: 'LPL',
    slug: 'lpl',
    logo: 'https://cdn-api.pandascore.co/images/league/image/294/lpl_2020-png',
    game: 'LOL',
    tier: 'S',
    region: 'ASIA',
    leagueId: 294,
    externalId: '10893',
    description: 'Liga china profesional de LoL',
  },
  {
    id: 'lol-lcs',
    name: 'LCS (League Championship Series)',
    shortName: 'LCS',
    slug: 'lcs',
    logo: 'https://cdn-api.pandascore.co/images/league/image/4198/ezgif-7-4a96621112-png',
    game: 'LOL',
    tier: 'S',
    region: 'AMERICAS',
    leagueId: 4198,
    externalId: '10753',
    description: 'Liga oficial norteamericana de League of Legends',
  },
  {
    id: 'lol-superliga',
    name: 'Superliga LVP',
    shortName: 'Superliga',
    slug: 'superliga-lvp',
    logo: 'https://cdn-api.pandascore.co/images/league/image/4213/lvp_superliga_logo-png',
    game: 'LOL',
    tier: 'A',
    region: 'ESPAÑA',
    leagueId: 4213,
    externalId: '9508',
    description: 'Liga española de League of Legends organizada por LVP',
  },
  {
    id: 'lol-emea-masters',
    name: 'EMEA Masters',
    shortName: 'EMEA Masters',
    slug: 'emea-masters',
    logo: 'https://cdn-api.pandascore.co/images/league/image/4996/emea_masters_2023-png',
    game: 'LOL',
    tier: 'A',
    region: 'EMEA',
    leagueId: 4996,
    externalId: '10993',
    description: 'Torneo europeo de las mejores ERLs regionales',
  },

  // COUNTER-STRIKE 2
  {
    id: 'cs2-major',
    name: 'CS2 Major Championship',
    shortName: 'Major',
    slug: 'cs2-major',
    game: 'CS2',
    tier: 'S',
    region: 'GLOBAL',
    externalId: '10488',
    description: 'Máximo torneo oficial auspiciado por Valve',
  },
  {
    id: 'cs2-iem',
    name: 'Intel Extreme Masters (IEM)',
    shortName: 'IEM',
    slug: 'iem',
    game: 'CS2',
    tier: 'S',
    region: 'GLOBAL',
    leagueId: 4161,
    externalId: '10877',
    description: 'Circuito histórico élite de ESL (Cologne, Katowice, Beijing)',
  },
  {
    id: 'cs2-esl-pro',
    name: 'ESL Pro League',
    shortName: 'ESL Pro',
    slug: 'esl-pro-league',
    game: 'CS2',
    tier: 'S',
    region: 'GLOBAL',
    leagueId: 4568,
    externalId: '11004',
    description: 'Liga mundial regular de Counter-Strike',
  },
  {
    id: 'cs2-blast',
    name: 'BLAST Open',
    shortName: 'BLAST',
    slug: 'blast-open',
    game: 'CS2',
    tier: 'S',
    region: 'GLOBAL',
    leagueId: 5370,
    externalId: '10874',
    description: 'Circuito premier de torneos BLAST (Open/Rivals/Bounty)',
  },

  // RAINBOW SIX SIEGE
  {
    id: 'r6-six-invitational',
    name: 'Six Invitational',
    shortName: 'Invitational',
    slug: 'six-invitational',
    game: 'R6',
    tier: 'S',
    region: 'GLOBAL',
    leagueId: 4311,
    externalId: '10160',
    description: 'Campeonato Mundial Oficial de Ubisoft',
  },
  {
    id: 'r6-six-major',
    name: 'Six Major',
    shortName: 'Six Major',
    slug: 'six-major',
    game: 'R6',
    tier: 'S',
    region: 'GLOBAL',
    leagueId: 4999,
    externalId: '10582',
    description: 'Torneo mayor intercontinental de Rainbow Six (BLAST R6 Major)',
  },
  {
    id: 'r6-europe-league',
    name: 'Europe MENA League',
    shortName: 'EML',
    slug: 'r6-siege-europe-mena-league',
    game: 'R6',
    tier: 'S',
    region: 'EMEA',
    leagueId: 5408,
    externalId: '10912',
    description: 'Liga profesional de Europa y Oriente Medio de Rainbow Six',
  },

  // DOTA 2
  {
    id: 'dota-ti',
    name: 'The International',
    shortName: 'The International',
    slug: 'the-international',
    logo: 'https://cdn-api.pandascore.co/images/league/image/4106/1200px-the_international_2023_lightmode-png',
    game: 'DOTA2',
    tier: 'S',
    region: 'GLOBAL',
    leagueId: 4106,
    externalId: '10828',
    description: 'Campeonato Mundial Oficial de Dota 2 de Valve',
  },
  {
    id: 'dota-riyadh',
    name: 'Riyadh Masters / Esports World Cup',
    shortName: 'Riyadh Masters',
    slug: 'riyadh-masters-dota',
    logo: 'https://cdn-api.pandascore.co/images/league/image/4821/riyadh_masters_lightmode-png',
    game: 'DOTA2',
    tier: 'S',
    region: 'GLOBAL',
    leagueId: 4821,
    externalId: '10728',
    description: 'Torneo mundial de máxima dotación económica (Esports World Cup)',
  },
];

// Catálogo Maestro de Equipos y Clubes Principales
export const MASTER_TEAMS: TeamCatalogItem[] = [
  // FÚTBOL
  { id: 'rma', name: 'Real Madrid', shortName: 'RMA', logo: 'https://crests.football-data.org/86.png', game: 'FÚTBOL', tier: 'S', region: 'ESPAÑA', location: 'Madrid, España' },
  { id: 'fcb', name: 'FC Barcelona', shortName: 'BAR', logo: 'https://crests.football-data.org/81.png', game: 'FÚTBOL', tier: 'S', region: 'ESPAÑA', location: 'Barcelona, España' },
  { id: 'rso', name: 'Real Sociedad', shortName: 'RSO', logo: 'https://crests.football-data.org/92.png', game: 'FÚTBOL', tier: 'S', region: 'ESPAÑA', location: 'San Sebastián, España' },
  { id: 'ath', name: 'Athletic Club', shortName: 'ATH', logo: 'https://crests.football-data.org/77.png', game: 'FÚTBOL', tier: 'S', region: 'ESPAÑA', location: 'Bilbao, España' },
  { id: 'atm', name: 'Atlético de Madrid', shortName: 'ATM', logo: 'https://crests.football-data.org/78.png', game: 'FÚTBOL', tier: 'S', region: 'ESPAÑA', location: 'Madrid, España' },
  { id: 'gir', name: 'Girona FC', shortName: 'GIR', logo: 'https://crests.football-data.org/298.png', game: 'FÚTBOL', tier: 'S', region: 'ESPAÑA', location: 'Girona, España' },
  { id: 'mci', name: 'Manchester City', shortName: 'MCI', logo: 'https://crests.football-data.org/65.png', game: 'FÚTBOL', tier: 'S', region: 'EMEA', location: 'Mánchester, Inglaterra' },
  { id: 'ars', name: 'Arsenal FC', shortName: 'ARS', logo: 'https://crests.football-data.org/57.png', game: 'FÚTBOL', tier: 'S', region: 'EMEA', location: 'Londres, Inglaterra' },
  { id: 'liv', name: 'Liverpool FC', shortName: 'LIV', logo: 'https://crests.football-data.org/64.png', game: 'FÚTBOL', tier: 'S', region: 'EMEA', location: 'Liverpool, Inglaterra' },
  { id: 'bay', name: 'Bayern München', shortName: 'BAY', logo: 'https://crests.football-data.org/5.png', game: 'FÚTBOL', tier: 'S', region: 'EMEA', location: 'Múnich, Alemania' },
  { id: 'psg', name: 'Paris Saint-Germain', shortName: 'PSG', logo: 'https://crests.football-data.org/524.png', game: 'FÚTBOL', tier: 'S', region: 'EMEA', location: 'París, Francia' },
  { id: 'int', name: 'Inter Milán', shortName: 'INT', logo: 'https://crests.football-data.org/108.png', game: 'FÚTBOL', tier: 'S', region: 'EMEA', location: 'Milán, Italia' },

  // ESPORTS
  { id: 'koi', name: 'Movistar KOI', shortName: 'KOI', logo: 'https://images.seeklogo.com/logo-png/43/1/koi-logo-png_seeklogo-434032.png', game: 'VALORANT', tier: 'S', region: 'ESPAÑA', location: 'España' },
  { id: 'fnc', name: 'Fnatic', shortName: 'FNC', logo: 'https://images.seeklogo.com/logo-png/38/1/fnatic-logo-png_seeklogo-385012.png', game: 'VALORANT', tier: 'S', region: 'EMEA', location: 'Londres, Reino Unido' },
  { id: 'g2', name: 'G2 Esports', shortName: 'G2', logo: 'https://images.seeklogo.com/logo-png/38/1/g2-esports-logo-png_seeklogo-385013.png', game: 'VALORANT', tier: 'S', region: 'EMEA', location: 'Berlín, Alemania' },
  { id: 'th', name: 'Team Heretics', shortName: 'TH', logo: 'https://images.seeklogo.com/logo-png/43/1/team-heretics-logo-png_seeklogo-434101.png', game: 'VALORANT', tier: 'S', region: 'ESPAÑA', location: 'Madrid, España' },
  { id: 'gx', name: 'GiantX', shortName: 'GX', logo: 'https://cdn-api.pandascore.co/images/team/image/132517/600px_giantx_allmode.png', game: 'VALORANT', tier: 'S', region: 'ESPAÑA', location: 'Málaga, España' },
  { id: 'kc', name: 'Karmine Corp', shortName: 'KC', logo: 'https://cdn-api.pandascore.co/images/team/image/128362/600px_karmine_corp_allmode.png', game: 'VALORANT', tier: 'S', region: 'EMEA', location: 'París, Francia' },
  { id: 'tl', name: 'Team Liquid', shortName: 'TL', logo: 'https://images.seeklogo.com/logo-png/38/1/team-liquid-logo-png_seeklogo-385008.png', game: 'VALORANT', tier: 'S', region: 'EMEA', location: 'Utrecht, Países Bajos' },
  { id: 'navi', name: 'NAVI', shortName: 'NAVI', logo: 'https://images.seeklogo.com/logo-png/43/1/natus-vincere-navi-logo-png_seeklogo-434031.png', game: 'CS2', tier: 'S', region: 'EMEA', location: 'Kiev, Ucrania' },
  { id: 'faze', name: 'FaZe Clan', shortName: 'FAZE', logo: 'https://images.seeklogo.com/logo-png/36/1/faze-clan-logo-png_seeklogo-360699.png', game: 'CS2', tier: 'S', region: 'GLOBAL', location: 'Los Ángeles, Estados Unidos' },
  { id: 'sen', name: 'Sentinels', shortName: 'SEN', logo: 'https://cdn-api.pandascore.co/images/team/image/127114/600px_sentinels_2020_allmode.png', game: 'VALORANT', tier: 'S', region: 'AMERICAS', location: 'Los Ángeles, Estados Unidos' },
  { id: 'vit', name: 'Team Vitality', shortName: 'VIT', logo: 'https://cdn-api.pandascore.co/images/team/image/3268/600px_team_vitality_2020_allmode.png', game: 'CS2', tier: 'S', region: 'EMEA', location: 'París, Francia' },
  { id: 't1', name: 'T1', shortName: 'T1', logo: 'https://images.seeklogo.com/logo-png/38/1/t1-logo-png_seeklogo-385010.png', game: 'LOL', tier: 'S', region: 'ASIA', location: 'Seúl, Corea del Sur' },
  { id: 'bds', name: 'BDS Esport', shortName: 'BDS', logo: 'https://cdn-api.pandascore.co/images/team/image/125863/600px_team_bds_2022_allmode.png', game: 'R6', tier: 'A', region: 'EMEA', location: 'Ginebra, Suiza' },
  { id: 'sec', name: 'Team Secret', shortName: 'SEC', logo: 'https://cdn-api.pandascore.co/images/team/image/3248/team_secret_2020_infobox.png', game: 'R6', tier: 'A', region: 'EMEA', location: 'Europa' },
];

// Mock realista enriquecido para cuando no haya token o conexión
const FALLBACK_MATCHES: Match[] = [
  {
    id: 'fb-1',
    game: 'FÚTBOL',
    league: 'LaLiga EA Sports',
    status: 'LIVE',
    timeInfo: "78'",
    startTimeIso: new Date().toISOString(),
    tier: 'S',
    region: 'ESPAÑA',
    teamA: {
      name: 'Real Madrid',
      shortName: 'RMA',
      score: 2,
      logo: 'https://crests.football-data.org/86.png',
      players: getKnownTeamRoster('Real Madrid', 'FÚTBOL'),
    },
    teamB: {
      name: 'Real Sociedad',
      shortName: 'RSO',
      score: 1,
      logo: 'https://crests.football-data.org/92.png',
      players: getKnownTeamRoster('Real Sociedad', 'FÚTBOL'),
    },
    details: {
      venue: 'Estadio Santiago Bernabéu, Madrid',
      tournamentStage: 'Jornada 28',
      broadcastTv: ['DAZN LaLiga', 'Movistar Plus+', 'LaLiga TV Bar'],
      streams: getDefaultStreams('FÚTBOL', 'LaLiga EA Sports'),
      footballEvents: [
        { minute: 18, type: 'goal', team: 'A', player: 'Vinícius Júnior', detail: 'Asistencia en profundidad de Bellingham (1-0)' },
        { minute: 34, type: 'card_yellow', team: 'B', player: 'Igor Zubeldia', detail: 'Falta táctica en la frontal' },
        { minute: 52, type: 'goal', team: 'B', player: 'Takefusa Kubo', detail: 'Gran disparo con rosca al segundo palo (1-1)' },
        { minute: 71, type: 'goal', team: 'A', player: 'Kylian Mbappé', detail: 'Definición ajustada al poste tras regate (2-1)' },
      ],
      rosterA: { teamName: 'Real Madrid', players: getKnownTeamRoster('Real Madrid', 'FÚTBOL') },
      rosterB: { teamName: 'Real Sociedad', players: getKnownTeamRoster('Real Sociedad', 'FÚTBOL') },
    },
  },
  {
    id: 'fb-2',
    game: 'VALORANT',
    league: 'VCT EMEA Masters',
    status: 'LIVE',
    timeInfo: 'Mapa 2 [11-9]',
    startTimeIso: new Date().toISOString(),
    tier: 'S',
    region: 'EMEA',
    teamA: {
      name: 'Movistar KOI',
      shortName: 'KOI',
      score: 1,
      logo: 'https://images.seeklogo.com/logo-png/43/1/koi-logo-png_seeklogo-434032.png',
      players: getKnownTeamRoster('Movistar KOI', 'VALORANT'),
    },
    teamB: {
      name: 'Fnatic',
      shortName: 'FNC',
      score: 0,
      logo: 'https://images.seeklogo.com/logo-png/38/1/fnatic-logo-png_seeklogo-385012.png',
      players: getKnownTeamRoster('Fnatic', 'VALORANT'),
    },
    details: {
      tournamentStage: 'Semifinal Lower Bracket',
      bestOf: 3,
      roundOrMap: 'Mapa 1: KOI 13-11 • Mapa 2: KOI 11-9',
      streams: getDefaultStreams('VALORANT', 'VCT EMEA Masters'),
      gamesBreakdown: [
        { position: 1, mapName: 'Bind', status: 'finished', winnerTeam: 'A', scoreA: 13, scoreB: 11, duration: '44m' },
        { position: 2, mapName: 'Ascent', status: 'running', scoreA: 11, scoreB: 9, duration: '38m' },
        { position: 3, mapName: 'Haven', status: 'not_started' },
      ],
      rosterA: { teamName: 'Movistar KOI', players: getKnownTeamRoster('Movistar KOI', 'VALORANT') },
      rosterB: { teamName: 'Fnatic', players: getKnownTeamRoster('Fnatic', 'VALORANT') },
    },
  },
  {
    id: 'fb-3',
    game: 'LOL',
    league: 'LEC Season Finals',
    status: 'LIVE',
    timeInfo: 'Juego 3 (24m)',
    startTimeIso: new Date().toISOString(),
    tier: 'S',
    region: 'EMEA',
    teamA: {
      name: 'G2 Esports',
      shortName: 'G2',
      score: 1,
      logo: 'https://images.seeklogo.com/logo-png/38/1/g2-esports-logo-png_seeklogo-385013.png',
      players: getKnownTeamRoster('G2 Esports', 'LOL'),
    },
    teamB: {
      name: 'Team Heretics',
      shortName: 'TH',
      score: 1,
      logo: 'https://images.seeklogo.com/logo-png/43/1/team-heretics-logo-png_seeklogo-434101.png',
      players: getKnownTeamRoster('Team Heretics', 'LOL'),
    },
    details: {
      tournamentStage: 'Gran Final',
      bestOf: 5,
      roundOrMap: 'Juego 1: G2 (32m) | Juego 2: TH (28m)',
      streams: getDefaultStreams('LOL', 'LEC Season Finals'),
      gamesBreakdown: [
        { position: 1, mapName: 'Grieta del Invocador 1', status: 'finished', winnerTeam: 'A', scoreA: 1, scoreB: 0, duration: '32m' },
        { position: 2, mapName: 'Grieta del Invocador 2', status: 'finished', winnerTeam: 'B', scoreA: 0, scoreB: 1, duration: '28m' },
        { position: 3, mapName: 'Grieta del Invocador 3', status: 'running', duration: '24m' },
        { position: 4, mapName: 'Grieta del Invocador 4', status: 'not_started' },
        { position: 5, mapName: 'Grieta del Invocador 5', status: 'not_started' },
      ],
      rosterA: { teamName: 'G2 Esports', players: getKnownTeamRoster('G2 Esports', 'LOL') },
      rosterB: { teamName: 'Team Heretics', players: getKnownTeamRoster('Team Heretics', 'LOL') },
    },
  },
  {
    id: 'fb-4',
    game: 'R6',
    league: 'Six Invitational',
    status: 'FINISHED',
    timeInfo: '7 - 5',
    startTimeIso: new Date(Date.now() - 3600000 * 5).toISOString(),
    tier: 'S',
    region: 'GLOBAL',
    teamA: {
      name: 'BDS Esport',
      shortName: 'BDS',
      score: 7,
      logo: 'https://cdn-api.pandascore.co/images/team/image/125863/600px_team_bds_2022_allmode.png',
    },
    teamB: {
      name: 'Team Secret',
      shortName: 'SEC',
      score: 5,
      logo: 'https://cdn-api.pandascore.co/images/team/image/3248/team_secret_2020_infobox.png',
    },
    details: {
      tournamentStage: 'Gran Final',
      bestOf: 1,
      roundOrMap: 'Clubhouse (7-5)',
      streams: getDefaultStreams('R6', 'Six Invitational'),
      gamesBreakdown: [
        { position: 1, mapName: 'Clubhouse', status: 'finished', winnerTeam: 'A', scoreA: 7, scoreB: 5, duration: '48m' },
      ],
    },
  },
  {
    id: 'fb-fin-foot-1',
    game: 'FÚTBOL',
    league: 'LaLiga EA Sports',
    status: 'FINISHED',
    timeInfo: '2 - 1',
    startTimeIso: new Date(Date.now() - 3600000 * 24).toISOString(),
    tier: 'S',
    region: 'ESPAÑA',
    teamA: {
      name: 'Real Madrid',
      shortName: 'RMA',
      score: 2,
      logo: 'https://crests.football-data.org/86.png',
      players: getKnownTeamRoster('Real Madrid', 'FÚTBOL'),
    },
    teamB: {
      name: 'FC Barcelona',
      shortName: 'BAR',
      score: 1,
      logo: 'https://crests.football-data.org/81.png',
      players: getKnownTeamRoster('Barcelona', 'FÚTBOL'),
    },
    details: {
      venue: 'Estadio Santiago Bernabéu, Madrid',
      tournamentStage: 'Jornada 27 - El Clásico',
      broadcastTv: ['DAZN LaLiga', 'Movistar Plus+'],
      streams: getDefaultStreams('FÚTBOL', 'LaLiga EA Sports'),
      footballEvents: [
        { minute: 22, type: 'goal', team: 'A', player: 'Vinícius Júnior', detail: 'Remate cruzado tras pase de Bellingham (1-0)' },
        { minute: 49, type: 'goal', team: 'B', player: 'Lamine Yamal', detail: 'Disparo al ángulo desde fuera del área (1-1)' },
        { minute: 84, type: 'goal', team: 'A', player: 'Kylian Mbappé', detail: 'Gol de la victoria al contraataque (2-1)' },
      ],
      rosterA: { teamName: 'Real Madrid', players: getKnownTeamRoster('Real Madrid', 'FÚTBOL') },
      rosterB: { teamName: 'FC Barcelona', players: getKnownTeamRoster('Barcelona', 'FÚTBOL') },
    },
  },
  {
    id: 'fb-fin-foot-2',
    game: 'FÚTBOL',
    league: 'LaLiga EA Sports',
    status: 'FINISHED',
    timeInfo: '2 - 0',
    startTimeIso: new Date(Date.now() - 3600000 * 48).toISOString(),
    tier: 'S',
    region: 'ESPAÑA',
    teamA: {
      name: 'Real Sociedad',
      shortName: 'RSO',
      score: 2,
      logo: 'https://crests.football-data.org/92.png',
      players: getKnownTeamRoster('Real Sociedad', 'FÚTBOL'),
    },
    teamB: {
      name: 'Athletic Club',
      shortName: 'ATH',
      score: 0,
      logo: 'https://crests.football-data.org/77.png',
      players: getKnownTeamRoster('Athletic Club', 'FÚTBOL'),
    },
    details: {
      venue: 'Reale Arena, San Sebastián',
      tournamentStage: 'Jornada 26 - Derbi Vasco',
      broadcastTv: ['Movistar Plus+ LaLiga'],
      streams: getDefaultStreams('FÚTBOL', 'LaLiga EA Sports'),
      footballEvents: [
        { minute: 31, type: 'goal', team: 'A', player: 'Take Kubo', detail: 'Definición precisa con el pie izquierdo (1-0)' },
        { minute: 76, type: 'goal', team: 'A', player: 'Mikel Oyarzabal', detail: 'Cabezazo tras saque de esquina (2-0)' },
      ],
      rosterA: { teamName: 'Real Sociedad', players: getKnownTeamRoster('Real Sociedad', 'FÚTBOL') },
      rosterB: { teamName: 'Athletic Club', players: getKnownTeamRoster('Athletic Club', 'FÚTBOL') },
    },
  },
  {
    id: 'fb-fin-foot-3',
    game: 'FÚTBOL',
    league: 'UEFA Champions League',
    status: 'FINISHED',
    timeInfo: '4 - 1',
    startTimeIso: new Date(Date.now() - 3600000 * 72).toISOString(),
    tier: 'S',
    region: 'EMEA',
    teamA: {
      name: 'FC Barcelona',
      shortName: 'BAR',
      score: 4,
      logo: 'https://crests.football-data.org/81.png',
      players: getKnownTeamRoster('Barcelona', 'FÚTBOL'),
    },
    teamB: {
      name: 'Bayern Munich',
      shortName: 'BAY',
      score: 1,
      logo: 'https://crests.football-data.org/5.png',
      players: getKnownTeamRoster('Bayern Munich', 'FÚTBOL'),
    },
    details: {
      venue: 'Estadi Olímpic Lluís Companys, Barcelona',
      tournamentStage: 'Fase de Liga - Jornada 3',
      broadcastTv: ['Movistar Liga de Campeones'],
      streams: getDefaultStreams('FÚTBOL', 'Champions League'),
      footballEvents: [
        { minute: 1, type: 'goal', team: 'A', player: 'Raphinha', detail: 'Gol tempranero a la contra (1-0)' },
        { minute: 18, type: 'goal', team: 'B', player: 'Harry Kane', detail: 'Remate dentro del área pequeña (1-1)' },
        { minute: 36, type: 'goal', team: 'A', player: 'Robert Lewandowski', detail: 'Definición a puerta vacía (2-1)' },
        { minute: 45, type: 'goal', team: 'A', player: 'Raphinha', detail: 'Gran disparo cruzado con rosca (3-1)' },
        { minute: 56, type: 'goal', team: 'A', player: 'Raphinha', detail: 'Hat-trick estelar al contragolpe (4-1)' },
      ],
      rosterA: { teamName: 'FC Barcelona', players: getKnownTeamRoster('Barcelona', 'FÚTBOL') },
      rosterB: { teamName: 'Bayern Munich', players: getKnownTeamRoster('Bayern Munich', 'FÚTBOL') },
    },
  },
  {
    id: 'fb-fin-vlr-1',
    game: 'VALORANT',
    league: 'VCT EMEA',
    status: 'FINISHED',
    timeInfo: '2 - 1',
    startTimeIso: new Date(Date.now() - 3600000 * 20).toISOString(),
    tier: 'S',
    region: 'EMEA',
    teamA: {
      name: 'Movistar KOI',
      shortName: 'KOI',
      score: 2,
      logo: 'https://images.seeklogo.com/logo-png/43/1/koi-logo-png_seeklogo-434032.png',
      players: getKnownTeamRoster('Movistar KOI', 'VALORANT'),
    },
    teamB: {
      name: 'Fnatic',
      shortName: 'FNC',
      score: 1,
      logo: 'https://images.seeklogo.com/logo-png/38/1/fnatic-logo-png_seeklogo-385012.png',
      players: getKnownTeamRoster('Fnatic', 'VALORANT'),
    },
    details: {
      tournamentStage: 'Fase Regular - Semana 4',
      bestOf: 3,
      roundOrMap: 'Bind: 13-9 | Haven: 10-13 | Sunset: 13-11',
      streams: getDefaultStreams('VALORANT', 'VCT EMEA'),
      gamesBreakdown: [
        { position: 1, mapName: 'Bind', status: 'finished', winnerTeam: 'A', scoreA: 13, scoreB: 9, duration: '41m' },
        { position: 2, mapName: 'Haven', status: 'finished', winnerTeam: 'B', scoreA: 10, scoreB: 13, duration: '46m' },
        { position: 3, mapName: 'Sunset', status: 'finished', winnerTeam: 'A', scoreA: 13, scoreB: 11, duration: '52m' },
      ],
      rosterA: { teamName: 'Movistar KOI', players: getKnownTeamRoster('Movistar KOI', 'VALORANT') },
      rosterB: { teamName: 'Fnatic', players: getKnownTeamRoster('Fnatic', 'VALORANT') },
    },
  },
  {
    id: 'fb-fin-vlr-2',
    game: 'VALORANT',
    league: 'VCT EMEA',
    status: 'FINISHED',
    timeInfo: '2 - 0',
    startTimeIso: new Date(Date.now() - 3600000 * 44).toISOString(),
    tier: 'S',
    region: 'EMEA',
    teamA: {
      name: 'Team Heretics',
      shortName: 'TH',
      score: 2,
      logo: 'https://images.seeklogo.com/logo-png/43/1/team-heretics-logo-png_seeklogo-434101.png',
      players: getKnownTeamRoster('Team Heretics', 'VALORANT'),
    },
    teamB: {
      name: 'GiantX',
      shortName: 'GX',
      score: 0,
      logo: 'https://cdn-api.pandascore.co/images/team/image/132517/600px_giantx_allmode.png',
      players: getKnownTeamRoster('Giantx', 'VALORANT'),
    },
    details: {
      tournamentStage: 'Fase Regular - Semana 3',
      bestOf: 3,
      roundOrMap: 'Abyss: 13-7 | Lotus: 13-8',
      streams: getDefaultStreams('VALORANT', 'VCT EMEA'),
      gamesBreakdown: [
        { position: 1, mapName: 'Abyss', status: 'finished', winnerTeam: 'A', scoreA: 13, scoreB: 7, duration: '36m' },
        { position: 2, mapName: 'Lotus', status: 'finished', winnerTeam: 'A', scoreA: 13, scoreB: 8, duration: '39m' },
      ],
      rosterA: { teamName: 'Team Heretics', players: getKnownTeamRoster('Team Heretics', 'VALORANT') },
      rosterB: { teamName: 'GiantX', players: getKnownTeamRoster('Giantx', 'VALORANT') },
    },
  },
  {
    id: 'fb-fin-vlr-3',
    game: 'VALORANT',
    league: 'Valorant Champions',
    status: 'FINISHED',
    timeInfo: '3 - 2',
    startTimeIso: new Date(Date.now() - 3600000 * 80).toISOString(),
    tier: 'S',
    region: 'GLOBAL',
    teamA: {
      name: 'Sentinels',
      shortName: 'SEN',
      score: 3,
      logo: 'https://cdn-api.pandascore.co/images/team/image/127114/600px_sentinels_2020_allmode.png',
      players: getKnownTeamRoster('Sentinels', 'VALORANT'),
    },
    teamB: {
      name: 'Team Heretics',
      shortName: 'TH',
      score: 2,
      logo: 'https://images.seeklogo.com/logo-png/43/1/team-heretics-logo-png_seeklogo-434101.png',
      players: getKnownTeamRoster('Team Heretics', 'VALORANT'),
    },
    details: {
      tournamentStage: 'Gran Final de Campeones',
      bestOf: 5,
      roundOrMap: 'Lotus 13-11 | Sunset 9-13 | Abyss 13-8 | Bind 11-13 | Haven 13-9',
      streams: getDefaultStreams('VALORANT', 'Valorant Champions'),
      gamesBreakdown: [
        { position: 1, mapName: 'Lotus', status: 'finished', winnerTeam: 'A', scoreA: 13, scoreB: 11 },
        { position: 2, mapName: 'Sunset', status: 'finished', winnerTeam: 'B', scoreA: 9, scoreB: 13 },
        { position: 3, mapName: 'Abyss', status: 'finished', winnerTeam: 'A', scoreA: 13, scoreB: 8 },
        { position: 4, mapName: 'Bind', status: 'finished', winnerTeam: 'B', scoreA: 11, scoreB: 13 },
        { position: 5, mapName: 'Haven', status: 'finished', winnerTeam: 'A', scoreA: 13, scoreB: 9 },
      ],
      rosterA: { teamName: 'Sentinels', players: getKnownTeamRoster('Sentinels', 'VALORANT') },
      rosterB: { teamName: 'Team Heretics', players: getKnownTeamRoster('Team Heretics', 'VALORANT') },
    },
  },
  {
    id: 'fb-fin-lol-1',
    game: 'LOL',
    league: 'LEC (League of Legends EMEA Championship)',
    status: 'FINISHED',
    timeInfo: '3 - 1',
    startTimeIso: new Date(Date.now() - 3600000 * 30).toISOString(),
    tier: 'S',
    region: 'EMEA',
    teamA: {
      name: 'G2 Esports',
      shortName: 'G2',
      score: 3,
      logo: 'https://images.seeklogo.com/logo-png/38/1/g2-esports-logo-png_seeklogo-385013.png',
      players: getKnownTeamRoster('G2 Esports', 'LOL'),
    },
    teamB: {
      name: 'Fnatic',
      shortName: 'FNC',
      score: 1,
      logo: 'https://images.seeklogo.com/logo-png/38/1/fnatic-logo-png_seeklogo-385012.png',
      players: getKnownTeamRoster('Fnatic', 'LOL'),
    },
    details: {
      tournamentStage: 'Final de Temporada LEC',
      bestOf: 5,
      roundOrMap: 'J1: G2 (28m) | J2: FNC (33m) | J3: G2 (25m) | J4: G2 (31m)',
      streams: getDefaultStreams('LOL', 'LEC (League of Legends EMEA Championship)'),
      gamesBreakdown: [
        { position: 1, mapName: 'Grieta del Invocador 1', status: 'finished', winnerTeam: 'A', scoreA: 1, scoreB: 0, duration: '28m' },
        { position: 2, mapName: 'Grieta del Invocador 2', status: 'finished', winnerTeam: 'B', scoreA: 0, scoreB: 1, duration: '33m' },
        { position: 3, mapName: 'Grieta del Invocador 3', status: 'finished', winnerTeam: 'A', scoreA: 1, scoreB: 0, duration: '25m' },
        { position: 4, mapName: 'Grieta del Invocador 4', status: 'finished', winnerTeam: 'A', scoreA: 1, scoreB: 0, duration: '31m' },
      ],
      rosterA: { teamName: 'G2 Esports', players: getKnownTeamRoster('G2 Esports', 'LOL') },
      rosterB: { teamName: 'Fnatic', players: getKnownTeamRoster('Fnatic', 'LOL') },
    },
  },
  {
    id: 'fb-fin-cs-1',
    game: 'CS2',
    league: 'ESL Pro League',
    status: 'FINISHED',
    timeInfo: '2 - 1',
    startTimeIso: new Date(Date.now() - 3600000 * 18).toISOString(),
    tier: 'S',
    region: 'GLOBAL',
    teamA: {
      name: 'NAVI',
      shortName: 'NAVI',
      score: 2,
      logo: 'https://images.seeklogo.com/logo-png/43/1/natus-vincere-navi-logo-png_seeklogo-434031.png',
      players: getKnownTeamRoster('NAVI', 'CS2'),
    },
    teamB: {
      name: 'FaZe Clan',
      shortName: 'FAZE',
      score: 1,
      logo: 'https://images.seeklogo.com/logo-png/36/1/faze-clan-logo-png_seeklogo-360699.png',
      players: getKnownTeamRoster('FaZe Clan', 'CS2'),
    },
    details: {
      tournamentStage: 'Cuartos de Final',
      bestOf: 3,
      roundOrMap: 'Mirage: 13-10 | Nuke: 8-13 | Ancient: 13-9',
      streams: getDefaultStreams('CS2', 'ESL Pro League'),
      gamesBreakdown: [
        { position: 1, mapName: 'Mirage', status: 'finished', winnerTeam: 'A', scoreA: 13, scoreB: 10, duration: '47m' },
        { position: 2, mapName: 'Nuke', status: 'finished', winnerTeam: 'B', scoreA: 8, scoreB: 13, duration: '41m' },
        { position: 3, mapName: 'Ancient', status: 'finished', winnerTeam: 'A', scoreA: 13, scoreB: 9, duration: '44m' },
      ],
      rosterA: { teamName: 'NAVI', players: getKnownTeamRoster('NAVI', 'CS2') },
      rosterB: { teamName: 'FaZe Clan', players: getKnownTeamRoster('FaZe Clan', 'CS2') },
    },
  },
  {
    id: 'fb-fin-fut-1',
    game: 'FÚTBOL',
    league: 'LaLiga EA Sports',
    status: 'FINISHED',
    timeInfo: '3 - 1',
    startTimeIso: new Date(Date.now() - 3600000 * 22).toISOString(),
    tier: 'S',
    region: 'ESPAÑA',
    teamA: {
      name: 'Real Madrid',
      shortName: 'RMA',
      score: 3,
      logo: 'https://crests.football-data.org/86.png',
      players: getKnownTeamRoster('Real Madrid', 'FÚTBOL'),
    },
    teamB: {
      name: 'Atlético de Madrid',
      shortName: 'ATM',
      score: 1,
      logo: 'https://crests.football-data.org/78.png',
      players: getKnownTeamRoster('Atlético de Madrid', 'FÚTBOL'),
    },
    details: {
      venue: 'Estadio Santiago Bernabéu, Madrid',
      tournamentStage: 'Jornada 27',
      broadcastTv: ['DAZN LaLiga', 'Movistar Plus+'],
      streams: getDefaultStreams('FÚTBOL', 'LaLiga EA Sports'),
      footballEvents: [
        { minute: 14, type: 'goal', team: 'A', player: 'Vinícius Júnior', detail: 'Remate cruzado (1-0)' },
        { minute: 39, type: 'goal', team: 'B', player: 'Antoine Griezmann', detail: 'Golpeo colocado desde la frontal (1-1)' },
        { minute: 67, type: 'goal', team: 'A', player: 'Jude Bellingham', detail: 'Cabezazo tras saque de esquina (2-1)' },
        { minute: 89, type: 'goal', team: 'A', player: 'Kylian Mbappé', detail: 'Contragolpe rápido (3-1)' },
      ],
      rosterA: { teamName: 'Real Madrid', players: getKnownTeamRoster('Real Madrid', 'FÚTBOL') },
      rosterB: { teamName: 'Atlético de Madrid', players: getKnownTeamRoster('Atlético de Madrid', 'FÚTBOL') },
    },
  },
  {
    id: 'fb-fin-fut-2',
    game: 'FÚTBOL',
    league: 'LaLiga EA Sports',
    status: 'FINISHED',
    timeInfo: '2 - 1',
    startTimeIso: new Date(Date.now() - 3600000 * 26).toISOString(),
    tier: 'S',
    region: 'ESPAÑA',
    teamA: {
      name: 'FC Barcelona',
      shortName: 'BAR',
      score: 2,
      logo: 'https://crests.football-data.org/81.png',
      players: getKnownTeamRoster('Barcelona', 'FÚTBOL'),
    },
    teamB: {
      name: 'Athletic Club',
      shortName: 'ATH',
      score: 1,
      logo: 'https://crests.football-data.org/77.png',
      players: getKnownTeamRoster('Athletic Club', 'FÚTBOL'),
    },
    details: {
      venue: 'Estadi Olímpic Lluís Companys, Barcelona',
      tournamentStage: 'Jornada 27',
      broadcastTv: ['Movistar Plus+ LaLiga'],
      streams: getDefaultStreams('FÚTBOL', 'LaLiga EA Sports'),
      footballEvents: [
        { minute: 24, type: 'goal', team: 'A', player: 'Lamine Yamal', detail: 'Disparo con rosca a la escuadra (1-0)' },
        { minute: 42, type: 'goal', team: 'B', player: 'Oihan Sancet', detail: 'Penalti convertido (1-1)' },
        { minute: 75, type: 'goal', team: 'A', player: 'Robert Lewandowski', detail: 'Remate de primeras en el área pequeña (2-1)' },
      ],
      rosterA: { teamName: 'FC Barcelona', players: getKnownTeamRoster('Barcelona', 'FÚTBOL') },
      rosterB: { teamName: 'Athletic Club', players: getKnownTeamRoster('Athletic Club', 'FÚTBOL') },
    },
  },
  {
    id: 'fb-fin-fut-3',
    game: 'FÚTBOL',
    league: 'LaLiga EA Sports',
    status: 'FINISHED',
    timeInfo: '2 - 0',
    startTimeIso: new Date(Date.now() - 3600000 * 28).toISOString(),
    tier: 'S',
    region: 'ESPAÑA',
    teamA: {
      name: 'Real Sociedad',
      shortName: 'RSO',
      score: 2,
      logo: 'https://crests.football-data.org/92.png',
      players: getKnownTeamRoster('Real Sociedad', 'FÚTBOL'),
    },
    teamB: {
      name: 'Athletic Club',
      shortName: 'ATH',
      score: 0,
      logo: 'https://crests.football-data.org/77.png',
      players: getKnownTeamRoster('Athletic Club', 'FÚTBOL'),
    },
    details: {
      venue: 'Reale Arena, San Sebastián',
      tournamentStage: 'Jornada 27',
      broadcastTv: ['DAZN LaLiga'],
      streams: getDefaultStreams('FÚTBOL', 'LaLiga EA Sports'),
      footballEvents: [
        { minute: 31, type: 'goal', team: 'A', player: 'Mikel Oyarzabal', detail: 'Zurdazo cruzado (1-0)' },
        { minute: 82, type: 'goal', team: 'A', player: 'Takefusa Kubo', detail: 'Jugada individual y definición rasa (2-0)' },
      ],
      rosterA: { teamName: 'Real Sociedad', players: getKnownTeamRoster('Real Sociedad', 'FÚTBOL') },
      rosterB: { teamName: 'Athletic Club', players: getKnownTeamRoster('Athletic Club', 'FÚTBOL') },
    },
  },
  {
    id: 'fb-5',
    game: 'FÚTBOL',
    league: 'UEFA Champions League',
    status: 'UPCOMING',
    timeInfo: '21:00h',
    startTimeIso: new Date(Date.now() + 3600000 * 3).toISOString(),
    tier: 'S',
    region: 'EMEA',
    teamA: {
      name: 'FC Barcelona',
      shortName: 'BAR',
      score: '-',
      logo: 'https://crests.football-data.org/81.png',
      players: getKnownTeamRoster('Barcelona', 'FÚTBOL'),
    },
    teamB: {
      name: 'Bayern Munich',
      shortName: 'BAY',
      score: '-',
      logo: 'https://crests.football-data.org/5.png',
      players: getKnownTeamRoster('Bayern Munich', 'FÚTBOL'),
    },
    details: {
      venue: 'Estadi Olímpic Lluís Companys, Barcelona',
      tournamentStage: 'Fase de Liga - Jornada 4',
      broadcastTv: ['Movistar Liga de Campeones', 'UEFA TV'],
      streams: getDefaultStreams('FÚTBOL', 'UEFA Champions League'),
      rosterA: { teamName: 'FC Barcelona', players: getKnownTeamRoster('Barcelona', 'FÚTBOL') },
      rosterB: { teamName: 'Bayern Munich', players: getKnownTeamRoster('Bayern Munich', 'FÚTBOL') },
    },
  },
  {
    id: 'fb-6',
    game: 'CS2',
    league: 'ESL Pro League',
    status: 'UPCOMING',
    timeInfo: '19:30h',
    startTimeIso: new Date(Date.now() + 3600000 * 2).toISOString(),
    tier: 'S',
    region: 'GLOBAL',
    teamA: {
      name: 'NAVI',
      shortName: 'NAVI',
      score: '-',
      logo: 'https://images.seeklogo.com/logo-png/43/1/natus-vincere-navi-logo-png_seeklogo-434031.png',
      players: getKnownTeamRoster('NAVI', 'CS2'),
    },
    teamB: {
      name: 'FaZe Clan',
      shortName: 'FAZE',
      score: '-',
      logo: 'https://images.seeklogo.com/logo-png/36/1/faze-clan-logo-png_seeklogo-360699.png',
      players: getKnownTeamRoster('FaZe Clan', 'CS2'),
    },
    details: {
      tournamentStage: 'Semifinales',
      bestOf: 3,
      streams: getDefaultStreams('CS2', 'ESL Pro League'),
      gamesBreakdown: [
        { position: 1, mapName: 'Mirage', status: 'not_started' },
        { position: 2, mapName: 'Nuke', status: 'not_started' },
        { position: 3, mapName: 'Inferno', status: 'not_started' },
      ],
      rosterA: { teamName: 'NAVI', players: getKnownTeamRoster('NAVI', 'CS2') },
      rosterB: { teamName: 'FaZe Clan', players: getKnownTeamRoster('FaZe Clan', 'CS2') },
    },
  },
];

/**
 * Convierte un partido crudo de Football-Data.org en el modelo interno Match.
 * Se usa tanto para la ventana global de partidos como para el detalle de competición.
 */
export function mapFootballDataMatch(m: any): Match {
  let status: MatchStatus = 'UPCOMING';
  if (m.status === 'IN_PLAY' || m.status === 'PAUSED') status = 'LIVE';
  else if (m.status === 'FINISHED') status = 'FINISHED';

  const matchDateIso = m.utcDate || null;
  const homeName = m.homeTeam?.name || 'Local';
  const awayName = m.awayTeam?.name || 'Visitante';

  const liveHomeScore = m.score?.regularTime?.home ?? m.score?.fullTime?.home ?? m.score?.halfTime?.home;
  const liveAwayScore = m.score?.regularTime?.away ?? m.score?.fullTime?.away ?? m.score?.halfTime?.away;
  const scoreH = typeof liveHomeScore === 'number' ? liveHomeScore : status === 'UPCOMING' ? '-' : 0;
  const scoreA = typeof liveAwayScore === 'number' ? liveAwayScore : status === 'UPCOMING' ? '-' : 0;

  let liveDetail: string | undefined;
  if (status === 'LIVE') {
    liveDetail = m.status === 'PAUSED' ? `Descanso (${scoreH}-${scoreA})` : `${m.minute || 'En Juego'}' (${scoreH}-${scoreA})`;
  }
  const schedule = formatMatchSchedule(matchDateIso, status, liveDetail);

  // Resolver Tier en Fútbol
  const code = (m.competition?.code || '').toUpperCase();
  const tier = resolveTournamentTier('FÚTBOL', m.competition?.name, m.stage, code);

  // Resolver Región en Fútbol
  const region = resolveMatchRegion(
    'FÚTBOL',
    m.competition?.name,
    m.stage,
    '',
    m.competition?.area?.code,
    m.competition?.area?.code
  );

  const playersHome = getKnownTeamRoster(homeName, 'FÚTBOL');
  const playersAway = getKnownTeamRoster(awayName, 'FÚTBOL');
  const streams = getDefaultStreams('FÚTBOL', m.competition?.name);

  // Generar eventos de partido (goles y tarjetas según marcador y estado)
  const footballEvents: FootballEvent[] = [];
  if (typeof scoreH === 'number' && scoreH > 0) {
    footballEvents.push({
      minute: 27,
      type: 'goal',
      team: 'A',
      player: playersHome[9]?.nickname || playersHome[10]?.nickname || homeName,
      detail: 'Gol de jugada colectiva',
    });
  }
  if (typeof scoreA === 'number' && scoreA > 0) {
    footballEvents.push({
      minute: 64,
      type: 'goal',
      team: 'B',
      player: playersAway[9]?.nickname || playersAway[10]?.nickname || awayName,
      detail: 'Remate dentro del área',
    });
  }
  if (status === 'FINISHED' || status === 'LIVE') {
    footballEvents.push({
      minute: 42,
      type: 'card_yellow',
      team: 'A',
      player: playersHome[2]?.nickname || 'Defensa Central',
      detail: 'Falta táctica',
    });
  }

  const timeInfo = status === 'FINISHED' ? `${scoreH} - ${scoreA}` : schedule.badgeText;

  const liveRoundScore: LiveRoundScore | undefined =
    status === 'LIVE'
      ? {
          scoreA: typeof scoreH === 'number' ? scoreH : 0,
          scoreB: typeof scoreA === 'number' ? scoreA : 0,
          roundOrTime: m.status === 'PAUSED' ? 'Descanso' : m.minute ? `${m.minute}'` : 'En Juego',
        }
      : undefined;

  return {
    id: `foot-${m.id}`,
    game: 'FÚTBOL' as SportCategory,
    league: m.competition?.name || 'Fútbol',
    status,
    timeInfo,
    startTimeIso: matchDateIso || new Date().toISOString(),
    tier,
    region,
    masterTournamentId:
      resolveMasterTournamentId('FÚTBOL', m.competition?.name, m.stage, undefined, m.competition?.code) ||
      undefined,
    teamA: {
      id: m.homeTeam?.id,
      name: homeName,
      shortName: m.homeTeam?.tla || m.homeTeam?.shortName || 'LOC',
      score: scoreH,
      logo: m.homeTeam?.crest,
      players: playersHome,
    },
    teamB: {
      id: m.awayTeam?.id,
      name: awayName,
      shortName: m.awayTeam?.tla || m.awayTeam?.shortName || 'VIS',
      score: scoreA,
      logo: m.awayTeam?.crest,
      players: playersAway,
    },
    liveRoundScore,
    details: {
      venue: m.venue || 'Estadio Principal',
      tournamentStage: m.matchday ? `Jornada ${m.matchday}` : m.stage ? m.stage.replace(/_/g, ' ') : undefined,
      streams,
      broadcastTv: ['DAZN LaLiga', 'Movistar Plus+', 'LaLiga TV Bar'],
      footballEvents,
      rosterA: playersHome.length > 0 ? { teamName: homeName, players: playersHome } : undefined,
      rosterB: playersAway.length > 0 ? { teamName: awayName, players: playersAway } : undefined,
    },
  };
}

export const ScoreService = {
  async fetchAllMatches(config: {
    pandaToken?: string;
    footballToken?: string;
    favoriteTeams: string[];
    favoriteTournaments?: string[];
    enabledGames: Record<string, boolean>;
    forceRefresh?: boolean;
  }): Promise<Match[]> {
    let combined: Match[] = [];

    const hasPanda = Boolean(config.pandaToken && config.pandaToken.trim().length > 5);
    const hasFootball = Boolean(config.footballToken && config.footballToken.trim().length > 5);

    const esportsEnabled =
      !config.enabledGames ||
      config.enabledGames.valorant !== false ||
      config.enabledGames.lol !== false ||
      config.enabledGames.cs2 !== false ||
      config.enabledGames.r6 !== false ||
      config.enabledGames.dota2 !== false;

    const valEnabled = !config.enabledGames || config.enabledGames.valorant !== false;
    const footballEnabled = !config.enabledGames || config.enabledGames.football !== false;

    // Ejecutar todas las fuentes en paralelo sin caché para datos 100% frescos y carga ultra rápida
    const [pandaMatches, footballMatches, vlrLiveMatches] = await Promise.all([
      hasPanda && esportsEnabled
        ? this.fetchPandaScore(
            config.pandaToken!,
            config.favoriteTeams,
            config.favoriteTournaments,
            config.enabledGames
          ).catch((err) => {
            console.warn('PandaScore API error:', err);
            return [];
          })
        : Promise.resolve([]),
      hasFootball && footballEnabled
        ? this.fetchFootball(config.footballToken!).catch((err) => {
            console.warn('Football-Data API error:', err);
            return [];
          })
        : Promise.resolve([]),
      valEnabled
        ? this.fetchLiveVlrMatches().catch((err) => {
            console.warn('VLR Live Scraper error:', err);
            return [];
          })
        : Promise.resolve([]),
    ]);

    // Fusionar datos de marcadores de rondas en directo de VLR en los partidos de PandaScore
    const matchedVlrHrefs = new Set<string>();
    for (const pm of pandaMatches) {
      if (pm.game === 'VALORANT') {
        const vlrMatch = vlrLiveMatches.find((vm) =>
          areTeamsMatching(pm.teamA.name, pm.teamB.name, vm.teamA.name, vm.teamB.name)
        );

        if (vlrMatch) {
          matchedVlrHrefs.add(vlrMatch.id);
          pm.status = 'LIVE';
          if (vlrMatch.liveRoundScore) {
            pm.liveRoundScore = vlrMatch.liveRoundScore;
            pm.timeInfo = 'EN DIRECTO';
            if (pm.details) {
              pm.details.roundOrMap = undefined;
              if (vlrMatch.details?.gamesBreakdown && vlrMatch.details.gamesBreakdown.length > 0) {
                pm.details.gamesBreakdown = vlrMatch.details.gamesBreakdown;
              }
            }
          }
          if (typeof vlrMatch.teamA.score === 'number' && typeof vlrMatch.teamB.score === 'number') {
            pm.teamA.score = Math.max(typeof pm.teamA.score === 'number' ? pm.teamA.score : 0, vlrMatch.teamA.score);
            pm.teamB.score = Math.max(typeof pm.teamB.score === 'number' ? pm.teamB.score : 0, vlrMatch.teamB.score);
          }
          if (pm.details?.gamesBreakdown) {
            const finishedA = pm.details.gamesBreakdown.filter((g) => g.winnerTeam === 'A').length;
            const finishedB = pm.details.gamesBreakdown.filter((g) => g.winnerTeam === 'B').length;
            if (typeof pm.teamA.score === 'number' && pm.teamA.score < finishedA) pm.teamA.score = finishedA;
            if (typeof pm.teamB.score === 'number' && pm.teamB.score < finishedB) pm.teamB.score = finishedB;
          }
        }
      }
    }

    // Partidos en directo de VLR que no estuvieran en PandaScore
    const unmergedVlr = vlrLiveMatches.filter((vm) => !matchedVlrHrefs.has(vm.id));

    if (footballEnabled && footballMatches.length > 0) {
      combined = [...combined, ...footballMatches];
    }

    if (esportsEnabled && pandaMatches.length > 0) {
      combined = [...combined, ...pandaMatches];
    }

    if (unmergedVlr.length > 0) {
      combined = [...combined, ...unmergedVlr];
    }

    // Para cualquier otro partido en directo de esports con mapas en juego, asegurar liveRoundScore
    for (const m of combined) {
      if (m.status === 'LIVE' && !m.liveRoundScore && m.details?.gamesBreakdown) {
        const runningMap = m.details.gamesBreakdown.find((g) => g.status === 'running');
        if (runningMap) {
          m.liveRoundScore = {
            scoreA: typeof runningMap.scoreA === 'number' ? runningMap.scoreA : (typeof m.teamA.score === 'number' ? m.teamA.score : 0),
            scoreB: typeof runningMap.scoreB === 'number' ? runningMap.scoreB : (typeof m.teamB.score === 'number' ? m.teamB.score : 0),
            mapName: runningMap.mapName,
            mapNumber: runningMap.position,
            roundOrTime: `${runningMap.mapName || 'Mapa'}: ${runningMap.scoreA ?? 0}-${runningMap.scoreB ?? 0}`,
          };
        }
      }
    }

    // Filtrar estrictamente cada deporte por si el usuario lo tiene desactivado individualmente
    if (config.enabledGames) {
      combined = combined.filter((m) => isGameCategoryEnabled(m.game, config.enabledGames));
    }

    // Marcar favoritos (Equipos y Torneos)
    const favTournaments = config.favoriteTournaments || [];
    const tagged = combined.map((m) => {
      const isFavTournament = isTournamentFavorite(
        m.league,
        m.details?.tournamentStage,
        favTournaments,
        m.masterTournamentId
      );
      const isFavA = isTeamFavorite(m.teamA.name, m.teamA.shortName, config.favoriteTeams);
      const isFavB = isTeamFavorite(m.teamB.name, m.teamB.shortName, config.favoriteTeams);
      const hasFav = isFavTournament || isFavA || isFavB;
      return {
        ...m,
        teamA: { ...m.teamA, isFav: isFavA },
        teamB: { ...m.teamB, isFav: isFavB },
        hasFav,
        isFavTournament,
      };
    });

    // Ordenación profesional:
    // - 1. En Directo (LIVE) arriba de todo
    // - 2. Equipos favoritos destacados
    // - 3. Próximos partidos ordenados por cercanía (los más próximos primero)
    // - 4. Partidos finalizados ordenados por los más recientes primero
    tagged.sort((a, b) => {
      if (a.status === 'LIVE' && b.status !== 'LIVE') return -1;
      if (b.status === 'LIVE' && a.status !== 'LIVE') return 1;

      if (a.hasFav && !b.hasFav) return -1;
      if (!a.hasFav && b.hasFav) return 1;

      if (a.status === 'UPCOMING' && b.status === 'FINISHED') return -1;
      if (a.status === 'FINISHED' && b.status === 'UPCOMING') return 1;

      const timeA = new Date(a.startTimeIso).getTime() || 0;
      const timeB = new Date(b.startTimeIso).getTime() || 0;

      if (a.status === 'UPCOMING') {
        return timeA - timeB; // Más cercano primero
      }
      if (a.status === 'FINISHED') {
        return timeB - timeA; // Más reciente primero
      }

      return 0;
    });

    return tagged;
  },

  async fetchPandaScore(
    token: string,
    favoriteTeams?: string[],
    favoriteTournaments?: string[],
    enabledGames?: Record<string, boolean>
  ): Promise<Match[]> {
    const cleanToken = token.trim();
    if (!cleanToken) return [];

    const isWeb = Platform.OS === 'web';

    const safeFetch = async (endpoint: string): Promise<any[]> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      // 1. En Web: ir directamente al proxy local para evitar bloqueos y timeouts de CORS del navegador
      if (isWeb) {
        try {
          const proxyUrl = `/api/proxy/pandascore?token=${encodeURIComponent(cleanToken)}&path=${encodeURIComponent(endpoint)}`;
          const res = await fetch(proxyUrl, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json)) return json;
          }
        } catch (proxyErr) {
          console.warn(`Proxy PandaScore (${endpoint}) falló:`, proxyErr);
        }
        return [];
      }

      // 2. En Native (Android / iOS): llamada directa de máxima velocidad (sin proxy, sin CORS)
      try {
        const sep = endpoint.includes('?') ? '&' : '?';
        const url = `https://api.pandascore.co${endpoint}${sep}token=${encodeURIComponent(cleanToken)}`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json)) return json;
        }
      } catch (err) {
        console.warn(`Llamada directa PandaScore (${endpoint}) falló:`, err);
      }

      return [];
    };

    // Determinar qué juegos están habilitados y mapearlos a slugs de PandaScore
    const activeVideogames: string[] = [];
    if (isGameCategoryEnabled('VALORANT', enabledGames)) activeVideogames.push('valorant');
    if (isGameCategoryEnabled('LOL', enabledGames)) activeVideogames.push('league-of-legends');
    if (isGameCategoryEnabled('CS2', enabledGames)) activeVideogames.push('cs-go');
    if (isGameCategoryEnabled('DOTA2', enabledGames)) activeVideogames.push('dota-2');
    if (isGameCategoryEnabled('R6', enabledGames)) activeVideogames.push('r6-siege');

    if (activeVideogames.length === 0) return [];

    const gamesFilter = activeVideogames.join(',');

    // Consultas consolidadas de alta velocidad
    const endpointsToFetch: string[] = [
      '/matches/running?per_page=50',
      `/matches/upcoming?filter[videogame]=${gamesFilter}&per_page=35&sort=begin_at`,
      `/matches/past?filter[videogame]=${gamesFilter}&per_page=25`,
    ];

    // Si Valorant está activo, añadir endpoints dedicados para que NUNCA quede desplazado por el gran volumen de LoL/CS2
    if (activeVideogames.includes('valorant')) {
      endpointsToFetch.push('/valorant/matches/running');
      endpointsToFetch.push('/valorant/matches/upcoming?per_page=25&sort=begin_at');
      endpointsToFetch.push('/valorant/matches/past?per_page=20');
    }

    // Búsquedas dirigidas para clubes favoritos (máximo 4 para mantener latencia ultra baja)
    const searchKeys = new Set<string>();
    let favCount = 0;
    for (const team of favoriteTeams || []) {
      if (favCount >= 4) break;
      const clean = team.trim();
      let q = clean;
      let teamGame: SportCategory | null = null;
      if (clean.includes('KOI')) { q = 'KOI'; teamGame = 'LOL'; }
      else if (clean.includes('Heretics')) { q = 'Heretics'; teamGame = 'VALORANT'; }
      else if (clean.includes('G2')) { q = 'G2'; teamGame = 'LOL'; }
      else if (clean.includes('Fnatic')) { q = 'Fnatic'; teamGame = 'LOL'; }
      else if (clean.includes('GiantX') || clean.includes('Giants')) { q = 'GiantX'; teamGame = 'LOL'; }
      else if (clean.includes('Sentinels')) { q = 'Sentinels'; teamGame = 'VALORANT'; }
      else if (clean.includes('Liquid')) { q = 'Liquid'; teamGame = 'LOL'; }
      else if (clean.includes('Karmine')) { q = 'Karmine'; teamGame = 'VALORANT'; }
      else if (clean.includes('NAVI') || clean.includes('Natus')) { q = 'NAVI'; teamGame = 'CS2'; }
      else if (clean.includes('Vitality')) { q = 'Vitality'; teamGame = 'CS2'; }

      // Descartar si el deporte específico de ese club está desactivado
      if (teamGame && !isGameCategoryEnabled(teamGame, enabledGames)) {
        continue;
      }

      if (q && q.length >= 2 && !searchKeys.has(q.toLowerCase())) {
        searchKeys.add(q.toLowerCase());
        endpointsToFetch.push(`/matches?search[name]=${encodeURIComponent(q)}&per_page=6`);
        favCount++;
      }
    }

    // Ejecutar todas las peticiones en paralelo de alta velocidad
    const rawResponses = await Promise.all(endpointsToFetch.map((ep) => safeFetch(ep)));
    const combinedRaw = rawResponses.flat();

    // Deduplicar por id
    const seen = new Set<number | string>();
    const validMatches: any[] = [];
    for (const item of combinedRaw) {
      if (!item || !item.id || seen.has(item.id)) continue;
      seen.add(item.id);

      // Descartar partidos cancelados o sin al menos 2 contrincantes
      if (!item.opponents || item.opponents.length < 2) continue;
      if (item.status === 'canceled') continue;

      // Descartar si ambos equipos son 'TBD'
      const oppA = item.opponents[0]?.opponent;
      const oppB = item.opponents[1]?.opponent;
      if (oppA?.name === 'TBD' && oppB?.name === 'TBD') continue;

      validMatches.push(item);
    }

    const resultMatches: Match[] = [];
    for (const item of validMatches) {
      const category = detectEsportCategory(item.videogame?.slug, item.videogame?.name);
      if (!category) {
        // Descartar torneos y juegos no soportados (ej. King of Glory 'kog', Mobile Legends, etc.)
        continue;
      }

      let status: MatchStatus = 'UPCOMING';
      if (item.status === 'running') status = 'LIVE';
      else if (item.status === 'finished') status = 'FINISHED';

      const oppA = item.opponents[0]?.opponent || {};
      const oppB = item.opponents[1]?.opponent || {};

      let scoreA: number | string = status === 'UPCOMING' ? '-' : 0;
      let scoreB: number | string = status === 'UPCOMING' ? '-' : 0;
      if (Array.isArray(item.results) && item.results.length >= 2) {
        const resA = item.results.find((r: any) => r.team_id === oppA.id);
        const resB = item.results.find((r: any) => r.team_id === oppB.id);
        if (resA && typeof resA.score === 'number') scoreA = resA.score;
        else if (typeof item.results[0]?.score === 'number') scoreA = item.results[0].score;

        if (resB && typeof resB.score === 'number') scoreB = resB.score;
        else if (typeof item.results[1]?.score === 'number') scoreB = item.results[1].score;
      }

      const matchDateIso = item.begin_at || item.scheduled_at || item.end_at || null;
      const schedule = formatMatchSchedule(matchDateIso, status);
      const timeInfo = status === 'FINISHED' ? `${scoreA} - ${scoreB}` : 'EN DIRECTO';

      const leagueName = (item.league?.name || '').trim();
      const serieName = (item.serie?.full_name || item.serie?.name || '').trim();
      const tournamentName = (item.tournament?.name || '').trim();

      // Resolver Tier oficial y estricto pasando la serie del torneo
      const tier = resolveTournamentTier(
        category,
        leagueName,
        tournamentName,
        item.tournament?.tier || item.league?.tier,
        serieName
      );

      // Título de la competición legible y completo (ej: 'VCT • Champions 2026')
      let displayLeague = leagueName;
      if (serieName) {
        if (!leagueName) {
          displayLeague = serieName;
        } else if (serieName.toLowerCase().includes(leagueName.toLowerCase())) {
          displayLeague = serieName;
        } else {
          displayLeague = `${leagueName} • ${serieName}`;
        }
      }
      // Resolver Región competitiva
      const region = resolveMatchRegion(
        category,
        leagueName,
        tournamentName,
        serieName,
        item.tournament?.region,
        item.tournament?.country
      );

      // Equipos y Plantillas
      const playersA = getKnownTeamRoster(oppA.name || '', category);
      const playersB = getKnownTeamRoster(oppB.name || '', category);

      // Emisiones y canales oficiales
      let streams: MatchStream[] = (item.streams_list || []).map((s: any) => ({
        name: s.main ? 'Retransmisión Principal' : `Canal ${s.language?.toUpperCase() || ''}`,
        language: s.language || 'en',
        rawUrl: s.raw_url,
        embedUrl: s.embed_url,
        official: Boolean(s.official || s.main),
        platform: (s.raw_url || '').includes('twitch') ? 'twitch' : (s.raw_url || '').includes('youtu') ? 'youtube' : 'other',
      }));
      if (streams.length === 0) {
        streams = getDefaultStreams(category, displayLeague);
      }

      // Desglose de mapas / partidas
      const gamesBreakdown = generateMatchGames(
        category,
        item.number_of_games || 3,
        item.games,
        oppA,
        oppB
      );

      if (gamesBreakdown && gamesBreakdown.length > 0 && status !== 'UPCOMING') {
        const finishedA = gamesBreakdown.filter((g) => g.winnerTeam === 'A').length;
        const finishedB = gamesBreakdown.filter((g) => g.winnerTeam === 'B').length;
        if (typeof scoreA === 'number' && scoreA < finishedA) scoreA = finishedA;
        if (typeof scoreB === 'number' && scoreB < finishedB) scoreB = finishedB;
      }

      // Cara a cara

      resultMatches.push({
        id: `panda-${item.id}`,
        game: category,
        league: displayLeague,
        status,
        timeInfo,
        startTimeIso: matchDateIso || new Date().toISOString(),
        tier,
        region,
        masterTournamentId:
          resolveMasterTournamentId(category, leagueName, tournamentName, serieName) || undefined,
        teamA: {
          id: oppA.id,
          name: oppA.name || 'Equipo A',
          shortName: oppA.acronym || oppA.name?.slice(0, 4)?.toUpperCase() || 'EQA',
          score: scoreA,
          logo: oppA.image_url || undefined,
          location: oppA.location,
          players: playersA,
        },
        teamB: {
          id: oppB.id,
          name: oppB.name || 'Equipo B',
          shortName: oppB.acronym || oppB.name?.slice(0, 4)?.toUpperCase() || 'EQB',
          score: scoreB,
          logo: oppB.image_url || undefined,
          location: oppB.location,
          players: playersB,
        },
        details: {
          venue: item.tournament?.country ? `Arena LAN Oficial (${item.tournament.country})` : 'Competición Oficial LAN / Online',
          tournamentStage: serieName
            ? tournamentName
              ? `${serieName} (${tournamentName})`
              : serieName
            : tournamentName || leagueName,
          bestOf: item.number_of_games || 3,
          roundOrMap: undefined,
          streams,
          gamesBreakdown,
          rosterA: playersA.length > 0 ? { teamName: oppA.name || 'Equipo A', players: playersA } : undefined,
          rosterB: playersB.length > 0 ? { teamName: oppB.name || 'Equipo B', players: playersB } : undefined,
        },
      });
    }

    return resultMatches;
  },

  async fetchFootball(token: string): Promise<Match[]> {
    const cleanToken = token.trim();
    if (!cleanToken) return [];

    let data: any = null;
    const isWeb = Platform.OS === 'web';

    // Rango dinámico de 9 días: desde 3 días atrás (resultados recientes) hasta 6 días adelante (próximos)
    const now = new Date();
    const pastDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const futureDate = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
    const dateFrom = pastDate.toISOString().split('T')[0];
    const dateTo = futureDate.toISOString().split('T')[0];

    const matchPath = `/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    // 1. En navegador web, consultar proxy local
    if (isWeb) {
      try {
        const proxyUrl = `/api/proxy/football?token=${encodeURIComponent(cleanToken)}&path=${encodeURIComponent(matchPath)}`;
        const res = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          data = await res.json();
        }
      } catch (proxyErr) {
        console.warn('Proxy local Football-Data falló:', proxyErr);
      }
    }

    // 2. Llamada directa si no estamos en web o si el proxy no respondió
    if (!data) {
      try {
        const res = await fetch(`https://api.football-data.org${matchPath}`, {
          signal: controller.signal,
          headers: {
            'X-Auth-Token': cleanToken,
            Accept: 'application/json',
          },
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          data = await res.json();
        }
      } catch (directErr) {
        console.warn('Llamada directa Football-Data falló:', directErr);
      }
    }

    let rawMatches = data && Array.isArray(data.matches) ? data.matches : [];

    // 3. Fallback inteligente de competición:
    // Si no hay partidos en la ventana de 9 días (p.ej. parón de selecciones o liga sin partidos hoy),
    // consultar los partidos de LaLiga EA Sports (PD) directamente para asegurar que siempre haya partidos reales.
    if (rawMatches.length === 0) {
      const laLigaPath = `/v4/competitions/PD/matches`;
      let laLigaData: any = null;

      if (isWeb) {
        try {
          const proxyUrl = `/api/proxy/football?token=${encodeURIComponent(cleanToken)}&path=${encodeURIComponent(laLigaPath)}`;
          const res = await fetch(proxyUrl);
          if (res.ok) laLigaData = await res.json();
        } catch {}
      }

      if (!laLigaData) {
        try {
          const res = await fetch(`https://api.football-data.org${laLigaPath}`, {
            headers: { 'X-Auth-Token': cleanToken, Accept: 'application/json' },
          });
          if (res.ok) laLigaData = await res.json();
        } catch {}
      }

      if (laLigaData && Array.isArray(laLigaData.matches)) {
        // Combinar partidos en vivo, los 15 más recientes finalizados y los 15 próximos
        const live = laLigaData.matches.filter((m: any) => m.status === 'IN_PLAY' || m.status === 'PAUSED');
        const finished = laLigaData.matches.filter((m: any) => m.status === 'FINISHED').slice(-15);
        const upcoming = laLigaData.matches.filter((m: any) => m.status === 'TIMED' || m.status === 'SCHEDULED').slice(0, 15);
        rawMatches = [...live, ...upcoming, ...finished];
      }
    }

    return rawMatches.map(mapFootballDataMatch);
  },

  /**
   * Descarga la temporada completa de una competición de fútbol concreta
   * (Football-Data.org) para la pestaña de partidos del torneo.
   */
  async fetchFootballCompetitionMatches(
    competitionCode: string,
    token: string,
    season?: string
  ): Promise<Match[]> {
    const cleanToken = token.trim();
    if (!cleanToken || !competitionCode) return [];

    const isWeb = Platform.OS === 'web';
    const seasonMatch = (season || '').match(/\b(20\d{2})\b/);
    const query = seasonMatch ? `?season=${seasonMatch[1]}` : '';
    const path = `/v4/competitions/${encodeURIComponent(competitionCode)}/matches${query}`;
    let data: any = null;

    if (isWeb) {
      try {
        const proxyUrl = `/api/proxy/football?token=${encodeURIComponent(cleanToken)}&path=${encodeURIComponent(path)}`;
        const res = await fetch(proxyUrl);
        if (res.ok) data = await res.json();
      } catch (e) {
        console.warn('Proxy local Football-Data (competición) falló:', e);
      }
    }

    if (!data) {
      try {
        const res = await fetch(`https://api.football-data.org${path}`, {
          headers: { 'X-Auth-Token': cleanToken, Accept: 'application/json' },
        });
        if (res.ok) data = await res.json();
      } catch (e) {
        console.warn('Llamada directa Football-Data (competición) falló:', e);
      }
    }

    const rawMatches = data && Array.isArray(data.matches) ? data.matches : [];
    return rawMatches.map(mapFootballDataMatch);
  },

  async fetchLiveVlrMatches(): Promise<Match[]> {
    const isWeb = Platform.OS === 'web';
    const baseUrl = isWeb ? '/api/proxy/vlr?url=' : '';
    const vlrMatchesUrl = isWeb
      ? `${baseUrl}${encodeURIComponent('https://www.vlr.gg/matches')}`
      : 'https://www.vlr.gg/matches';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(vlrMatchesUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      clearTimeout(timeoutId);

      if (!res.ok) return [];
      const html = await res.text();

      // Buscar bloques de partidos marcados como mod-live o LIVE
      const liveItems: { href: string; teams: string[]; league?: string }[] = [];
      const chunks = html.split(/<a[^>]+href="(\/[0-9]+\/[^"]+)"[^>]*class="[^"]*match-item[^"]*"[^>]*>/i);
      for (let i = 1; i < chunks.length; i += 2) {
        const href = chunks[i];
        const chunk = chunks[i + 1] || '';
        if (chunk.includes('mod-live') || chunk.includes('LIVE')) {
          const teams = [...chunk.matchAll(/<div class="match-item-vs-team-name"[^>]*>([\s\S]*?)<\/div>/g)]
            .map((m) => m[1].replace(/<[^>]+>/g, '').trim())
            .filter(Boolean);
          const eventMatch = chunk.match(/<div class="match-item-event[^"]*"[^>]*>([\s\S]*?)<\/div>/);
          const league = eventMatch
            ? eventMatch[1].replace(/<[^>]+>/g, '').replace(/&ndash;/g, '-').replace(/\s+/g, ' ').trim()
            : 'VCT Valorant';
          liveItems.push({ href, teams, league });
        }
      }

      if (liveItems.length === 0) return [];

      // Descargar detalles de las partidas en directo en paralelo (máximo 4 simultáneas)
      const detailPromises = liveItems.slice(0, 4).map(async (item) => {
        try {
          const detailUrl = isWeb
            ? `${baseUrl}${encodeURIComponent(`https://www.vlr.gg${item.href}`)}`
            : `https://www.vlr.gg${item.href}`;

          const dController = new AbortController();
          const dTimeout = setTimeout(() => dController.abort(), 3500);
          const dRes = await fetch(detailUrl, {
            signal: dController.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
              Accept: 'text/html',
            },
          });
          clearTimeout(dTimeout);
          if (!dRes.ok) return null;
          const dHtml = await dRes.text();

          let nameA = item.teams[0];
          let nameB = item.teams[1];
          if (!nameA || !nameB) {
            const teamAHeader = dHtml.match(/<a[^>]+class="match-header-link wf-link-hover mod-1"[^>]*>([\s\S]*?)<\/a>/i);
            const teamBHeader = dHtml.match(/<a[^>]+class="match-header-link wf-link-hover mod-2"[^>]*>([\s\S]*?)<\/a>/i);
            if (teamAHeader) nameA = teamAHeader[1].replace(/<[^>]+>/g, '').trim();
            if (teamBHeader) nameB = teamBHeader[1].replace(/<[^>]+>/g, '').trim();
          }
          if (!nameA || !nameB) return null;

          // Marcador de serie (mapas ganados)
          let seriesA = 0;
          let seriesB = 0;
          const scoreMatch = dHtml.match(
            /<div class="match-header-vs-score">[\s\S]*?<span[^>]*>\s*([0-9]+)\s*<\/span>[\s\S]*?<span class="match-header-vs-score-colon">[\s\S]*?<span[^>]*>\s*([0-9]+)\s*<\/span>/i
          );
          if (scoreMatch) {
            seriesA = parseInt(scoreMatch[1], 10) || 0;
            seriesB = parseInt(scoreMatch[2], 10) || 0;
          }

          // Mapas y marcadores de rondas
          const gameHeaders = dHtml.split(/class="vm-stats-game-header"/i);
          const gamesBreakdown: MatchMapGame[] = [];
          let currentLiveMap: { mapName: string; scoreA: number; scoreB: number; mapNumber: number } | null = null;

          for (let g = 1; g < gameHeaders.length; g++) {
            const gChunk = gameHeaders[g];
            const mapMatch = gChunk.match(/class="map"[^>]*>[\s\S]*?<span[^>]*>\s*([A-Za-z0-9]+)/i);
            const leftScore = gChunk.match(/<div class="team">[\s\S]*?<div class="score[^"]*"[^>]*>\s*([0-9]+)\s*<\/div>/i);
            const rightScore = gChunk.match(/<div class="team mod-right">[\s\S]*?<div class="score[^"]*"[^>]*>\s*([0-9]+)\s*<\/div>/i);

            const mapName = mapMatch ? mapMatch[1].trim() : `Mapa ${g}`;
            const sA = leftScore ? parseInt(leftScore[1], 10) : 0;
            const sB = rightScore ? parseInt(rightScore[1], 10) : 0;

            let mapStatus: 'finished' | 'running' | 'not_started' = 'not_started';
            let winnerTeam: 'A' | 'B' | undefined;

            if (sA >= 13 && sA - sB >= 2) {
              mapStatus = 'finished';
              winnerTeam = 'A';
            } else if (sB >= 13 && sB - sA >= 2) {
              mapStatus = 'finished';
              winnerTeam = 'B';
            } else if (sA > 0 || sB > 0 || (!currentLiveMap && g === 1)) {
              mapStatus = 'running';
              if (!currentLiveMap) {
                currentLiveMap = { mapName, scoreA: sA, scoreB: sB, mapNumber: g };
              }
            }

            gamesBreakdown.push({
              position: g,
              mapName,
              status: mapStatus,
              winnerTeam,
              scoreA: sA,
              scoreB: sB,
            });
          }

          // Computar victorias de mapa en la serie si el marcador de cabecera venía en 0 o incompleto
          const finishedA = gamesBreakdown.filter((g) => g.winnerTeam === 'A').length;
          const finishedB = gamesBreakdown.filter((g) => g.winnerTeam === 'B').length;
          seriesA = Math.max(seriesA, finishedA);
          seriesB = Math.max(seriesB, finishedB);

          if (!currentLiveMap && gamesBreakdown.length > 0) {
            const first = gamesBreakdown[0];
            const parsedA = typeof first.scoreA === 'number' ? first.scoreA : parseInt(String(first.scoreA), 10);
            const parsedB = typeof first.scoreB === 'number' ? first.scoreB : parseInt(String(first.scoreB), 10);
            currentLiveMap = {
              mapName: first.mapName || 'Mapa 1',
              scoreA: isNaN(parsedA) ? 0 : parsedA,
              scoreB: isNaN(parsedB) ? 0 : parsedB,
              mapNumber: 1,
            };
          }

          const liveScoreStr = currentLiveMap
            ? `${currentLiveMap.mapName}: ${currentLiveMap.scoreA}-${currentLiveMap.scoreB}`
            : 'En directo';

          const matchObj: Match = {
            id: `vlr-live-${item.href.replace(/[^a-zA-Z0-9]/g, '-')}`,
            game: 'VALORANT',
            league: item.league || 'VCT Valorant Champions Tour',
            status: 'LIVE',
            timeInfo: 'EN DIRECTO',
            startTimeIso: new Date().toISOString(),
            tier: 'S',
            region: resolveMatchRegion('VALORANT', item.league),
            masterTournamentId: resolveMasterTournamentId('VALORANT', item.league) || undefined,
            teamA: {
              name: nameA,
              shortName: nameA.slice(0, 4).toUpperCase(),
              score: seriesA,
              players: getKnownTeamRoster(nameA, 'VALORANT'),
            },
            teamB: {
              name: nameB,
              shortName: nameB.slice(0, 4).toUpperCase(),
              score: seriesB,
              players: getKnownTeamRoster(nameB, 'VALORANT'),
            },
            liveRoundScore: currentLiveMap
              ? {
                  scoreA: currentLiveMap.scoreA,
                  scoreB: currentLiveMap.scoreB,
                  mapName: currentLiveMap.mapName,
                  mapNumber: currentLiveMap.mapNumber,
                  roundOrTime: liveScoreStr,
                }
              : undefined,
            details: {
              tournamentStage: item.league,
              bestOf: gamesBreakdown.length || 3,
              roundOrMap: undefined,
              streams: getDefaultStreams('VALORANT', item.league),
              gamesBreakdown,
              rosterA: { teamName: nameA, players: getKnownTeamRoster(nameA, 'VALORANT') },
              rosterB: { teamName: nameB, players: getKnownTeamRoster(nameB, 'VALORANT') },
            },
          };
          return matchObj;
        } catch (err) {
          console.warn('Error fetching VLR match detail:', err);
          return null;
        }
      });

      const parsedMatches = (await Promise.all(detailPromises)).filter(Boolean) as Match[];
      return parsedMatches;
    } catch (e) {
      console.warn('Error fetching VLR live matches:', e);
      return [];
    }
  },

  // Métodos de diagnóstico para probar credenciales en la pestaña de APIs
  async testPandaScore(token: string): Promise<{ success: boolean; message: string; count?: number }> {
    try {
      const cleanToken = token.trim();
      if (!cleanToken) return { success: false, message: 'El token está vacío.' };

      let data: any = null;
      let status: number | null = null;

      try {
        const url = `https://api.pandascore.co/matches/upcoming?token=${encodeURIComponent(cleanToken)}&per_page=10`;
        const res = await fetch(url);
        status = res.status;
        if (res.ok) data = await res.json();
      } catch {}

      if (!data && Platform.OS === 'web') {
        try {
          const proxyUrl = `/api/proxy/pandascore?token=${encodeURIComponent(cleanToken)}&path=${encodeURIComponent('/matches/upcoming?per_page=10')}`;
          const res = await fetch(proxyUrl);
          status = res.status;
          if (res.ok) data = await res.json();
        } catch {}
      }

      if (data && Array.isArray(data)) {
        return {
          success: true,
          message: `Conexión verificada con PandaScore (${data.length} partidos próximos y en vivo activos).`,
          count: data.length,
        };
      }

      if (status === 401) return { success: false, message: 'Token de PandaScore no válido o revocado (HTTP 401).' };
      if (status === 403) return { success: false, message: 'Acceso no autorizado en PandaScore (HTTP 403).' };
      return { success: false, message: `Error HTTP ${status || 'desconocido'} al conectar con PandaScore.` };
    } catch (err: any) {
      return { success: false, message: `Error de red: ${err.message || 'No se pudo conectar'}` };
    }
  },

  async testFootball(token: string): Promise<{ success: boolean; message: string; count?: number }> {
    try {
      const cleanToken = token.trim();
      if (!cleanToken) return { success: false, message: 'El token está vacío.' };

      const now = new Date();
      const pastDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const futureDate = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
      const matchPath = `/v4/matches?dateFrom=${pastDate.toISOString().split('T')[0]}&dateTo=${futureDate.toISOString().split('T')[0]}`;

      let data: any = null;
      let status: number | null = null;

      if (Platform.OS === 'web') {
        try {
          const proxyUrl = `/api/proxy/football?token=${encodeURIComponent(cleanToken)}&path=${encodeURIComponent(matchPath)}`;
          const res = await fetch(proxyUrl);
          status = res.status;
          if (res.ok) data = await res.json();
        } catch {}
      }

      if (!data) {
        try {
          const res = await fetch(`https://api.football-data.org${matchPath}`, {
            headers: { 'X-Auth-Token': cleanToken, Accept: 'application/json' },
          });
          status = res.status;
          if (res.ok) data = await res.json();
        } catch {}
      }

      if (data && Array.isArray(data.matches)) {
        const count = data.matches.length;
        if (count > 0) {
          return {
            success: true,
            message: `Conexión verificada con Football-Data.org (${count} partidos de fútbol encontrados).`,
            count,
          };
        } else {
          return {
            success: true,
            message: `Token válido verificado (Sin partidos en la ventana actual, se cargará LaLiga de respaldo).`,
            count: 0,
          };
        }
      }

      if (status === 403) return { success: false, message: 'Token de Football-Data no válido o sin permisos (HTTP 403).' };
      if (status === 400) return { success: false, message: 'Petición rechazada por Football-Data (HTTP 400).' };
      return { success: false, message: `Error HTTP ${status || 'desconocido'} en Football-Data.` };
    } catch (err: any) {
      return { success: false, message: `Error de red: ${err.message || 'No se pudo conectar'}` };
    }
  },

  /**
   * Obtiene la plantilla oficial de jugadores de un equipo de PandaScore si no está en caché.
   */
  async fetchTeamRoster(teamId: number | string, token?: string): Promise<PlayerInfo[]> {
    if (!teamId) return [];
    if (ROSTER_CACHE.has(teamId)) {
      return ROSTER_CACHE.get(teamId)!;
    }
    const cleanToken = (token || '').trim();
    if (!cleanToken) return [];

    let data: any = null;
    const path = `/teams/${teamId}`;

    // 1. En web, probar proxy local
    if (Platform.OS === 'web') {
      try {
        const proxyUrl = `/api/proxy/pandascore?token=${encodeURIComponent(cleanToken)}&path=${encodeURIComponent(path)}`;
        const res = await fetch(proxyUrl);
        if (res.ok) data = await res.json();
      } catch {}
    }

    // 2. Fetch directo si no estamos en web o falló proxy
    if (!data) {
      try {
        const url = `https://api.pandascore.co${path}?token=${encodeURIComponent(cleanToken)}`;
        const res = await fetch(url);
        if (res.ok) data = await res.json();
      } catch {}
    }

    if (data && Array.isArray(data.players) && data.players.length > 0) {
      const players: PlayerInfo[] = data.players.map((p: any) => ({
        id: String(p.id),
        name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.name || 'Jugador',
        nickname: p.name || 'Player',
        role: p.role || undefined,
        nationality: p.nationality || undefined,
        photoUrl: p.image_url || undefined,
      }));
      ROSTER_CACHE.set(teamId, players);
      return players;
    }

    return [];
  },

  /**
   * Obtiene el catálogo de torneos filtrado por búsqueda, deporte, tier y región.
   */
  getTournamentsCatalog(filters?: {
    query?: string;
    game?: SportCategory | 'TODOS';
    tier?: TournamentTier | 'TODOS';
    region?: MatchRegion | 'TODOS';
    favorites?: string[];
  }): TournamentItem[] {
    const q = (filters?.query || '').toLowerCase().trim();
    const game = filters?.game || 'TODOS';
    const tier = filters?.tier || 'TODOS';
    const region = filters?.region || 'TODOS';
    const favs = filters?.favorites || [];

    return MASTER_TOURNAMENTS.map((t) => ({
      ...t,
      isFav: isTournamentItemFavorite(t, favs),
    })).filter((t) => {
      if (game !== 'TODOS' && t.game !== game) return false;
      if (tier !== 'TODOS' && t.tier !== tier) return false;
      if (region !== 'TODOS' && t.region !== region) return false;
      if (q) {
        const matchesName = t.name.toLowerCase().includes(q);
        const matchesShort = (t.shortName || '').toLowerCase().includes(q);
        const matchesDesc = (t.description || '').toLowerCase().includes(q);
        const matchesCountry = (t.country || '').toLowerCase().includes(q);
        if (!matchesName && !matchesShort && !matchesDesc && !matchesCountry) return false;
      }
      return true;
    });
  },

  /**
   * Obtiene el catálogo de equipos filtrado por búsqueda, deporte, región y favoritos.
   */
  getTeamsCatalog(filters?: {
    query?: string;
    game?: SportCategory | 'TODOS';
    region?: MatchRegion | 'TODOS';
    favorites?: string[];
  }): TeamCatalogItem[] {
    const q = (filters?.query || '').toLowerCase().trim();
    const game = filters?.game || 'TODOS';
    const region = filters?.region || 'TODOS';
    const favs = filters?.favorites || [];

    return MASTER_TEAMS.map((team) => ({
      ...team,
      isFav: isTeamFavorite(team.name, team.shortName, favs, team.id),
    })).filter((team) => {
      if (game !== 'TODOS' && team.game !== game) return false;
      if (region !== 'TODOS' && team.region !== region) return false;
      if (q) {
        const matchesName = team.name.toLowerCase().includes(q);
        const matchesShort = (team.shortName || '').toLowerCase().includes(q);
        const matchesLoc = (team.location || '').toLowerCase().includes(q);
        if (!matchesName && !matchesShort && !matchesLoc) return false;
      }
      return true;
    });
  },

  /**
   * Búsqueda en vivo de torneos / competiciones adicionales en PandaScore o Football-Data.
   */
  async searchOnlineTournaments(
    query: string,
    pandaToken?: string,
    footballToken?: string
  ): Promise<TournamentItem[]> {
    const q = (query || '').trim();
    if (!q || q.length < 2) return [];

    const results: TournamentItem[] = [];
    const cleanPanda = (pandaToken || '').trim();

    if (cleanPanda) {
      try {
        const path = `/leagues?search[name]=${encodeURIComponent(q)}&per_page=50`;
        let data: any = null;

        if (Platform.OS === 'web') {
          try {
            const proxyUrl = `/api/proxy/pandascore?token=${encodeURIComponent(cleanPanda)}&path=${encodeURIComponent(path)}`;
            const res = await fetch(proxyUrl);
            if (res.ok) data = await res.json();
          } catch {}
        }

        if (!data) {
          const url = `https://api.pandascore.co${path}&token=${encodeURIComponent(cleanPanda)}`;
          const res = await fetch(url);
          if (res.ok) data = await res.json();
        }

        if (data && Array.isArray(data)) {
          for (const item of data) {
            const category = detectEsportCategory(item.videogame?.slug, item.videogame?.name);
            if (category) {
              const tier = resolveTournamentTier(category, item.name);
              const region = resolveMatchRegion(category, item.name);

              let shortName = item.name.length <= 8 ? item.name : item.name.slice(0, 8);
              if (item.slug) {
                const cleanSlug = item.slug.replace(/^(league-of-legends|valorant|cs-go|cs2|rainbow-six|dota-2)-/, '');
                const firstPart = cleanSlug.split('-')?.[0];
                if (firstPart && firstPart.length >= 2) {
                  shortName = firstPart.toUpperCase();
                }
              }

              results.push({
                id: `panda-league-${item.id}`,
                name: item.name,
                shortName,
                slug: item.slug,
                logo: item.image_url || undefined,
                game: category,
                tier,
                region,
                leagueId: item.id,
                externalId: item.id,
                description: item.videogame?.name ? `Competición de ${item.videogame.name}` : undefined,
              });
            }
          }
        }
      } catch (err) {
        console.warn('Error searching PandaScore online leagues:', err);
      }
    }

    // Priorizar coincidencias exactas arriba
    const qLower = q.toLowerCase();
    results.sort((a, b) => {
      const aExact = a.name.toLowerCase() === qLower || (a.shortName && a.shortName.toLowerCase() === qLower);
      const bExact = b.name.toLowerCase() === qLower || (b.shortName && b.shortName.toLowerCase() === qLower);
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return 0;
    });

    return results;
  },

  /**
   * Búsqueda en vivo de equipos adicionales en PandaScore.
   */
  async searchOnlineTeams(
    query: string,
    pandaToken?: string
  ): Promise<TeamCatalogItem[]> {
    const q = (query || '').trim();
    if (!q || q.length < 2) return [];

    const results: TeamCatalogItem[] = [];
    const cleanPanda = (pandaToken || '').trim();

    if (cleanPanda) {
      try {
        const path = `/teams?search[name]=${encodeURIComponent(q)}&per_page=50`;
        let data: any = null;

        if (Platform.OS === 'web') {
          try {
            const proxyUrl = `/api/proxy/pandascore?token=${encodeURIComponent(cleanPanda)}&path=${encodeURIComponent(path)}`;
            const res = await fetch(proxyUrl);
            if (res.ok) data = await res.json();
          } catch {}
        }

        if (!data) {
          const url = `https://api.pandascore.co${path}&token=${encodeURIComponent(cleanPanda)}`;
          const res = await fetch(url);
          if (res.ok) data = await res.json();
        }

        if (data && Array.isArray(data)) {
          for (const item of data) {
            const category = detectEsportCategory(item.current_videogame?.slug, item.current_videogame?.name) || 'VALORANT';
            results.push({
              id: `panda-team-${item.id}`,
              name: item.name,
              shortName: item.acronym || item.name.slice(0, 4).toUpperCase(),
              logo: item.image_url || undefined,
              game: category,
              externalId: item.id,
              location: item.location || undefined,
            });
          }
        }
      } catch (err) {
        console.warn('Error searching online teams:', err);
      }
    }

    const qLower = q.toLowerCase();
    results.sort((a, b) => {
      const aExact = a.name.toLowerCase() === qLower || (a.shortName && a.shortName.toLowerCase() === qLower);
      const bExact = b.name.toLowerCase() === qLower || (b.shortName && b.shortName.toLowerCase() === qLower);
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return 0;
    });

    return results;
  },

  /**
   * Descarga los partidos exclusivos de un torneo específico bajo demanda.
   */
  async fetchMatchesForTournament(
    tournament: TournamentItem,
    tokens: { pandaToken?: string; footballToken?: string }
  ): Promise<Match[]> {
    // Fútbol: descargar la temporada completa de la competición oficial
    if (tournament.game === 'FÚTBOL' && tournament.externalId && tokens.footballToken) {
      const competitionMatches = await this.fetchFootballCompetitionMatches(
        String(tournament.externalId),
        tokens.footballToken,
        tournament.season
      );
      if (competitionMatches.length > 0) return competitionMatches;
    }

    const allMatches = await this.fetchAllMatches({
      pandaToken: tokens.pandaToken,
      footballToken: tokens.footballToken,
      favoriteTeams: [],
      enabledGames: {
        football: true,
        valorant: true,
        lol: true,
        cs2: true,
        r6: true,
        dota2: true,
      },
    });

    const tn = tournament.name.toLowerCase();
    const tShort = (tournament.shortName || '').toLowerCase();
    const tSlug = (tournament.slug || '').toLowerCase();
    return allMatches.filter((m) => {
      if (m.game !== tournament.game) return false;
      const ml = m.league.toLowerCase();
      const ms = (m.details?.tournamentStage || '').toLowerCase();
      if (ml.includes(tn) || tn.includes(ml) || (tShort && (ml.includes(tShort) || tShort.includes(ml))) || ms.includes(tn)) {
        return true;
      }
      if (tSlug && ml.includes(tSlug)) return true;
      if ((tournament.id === 'foot-PD' || tShort === 'laliga') && (ml.includes('laliga') || ml.includes('primera division'))) {
        return true;
      }
      if ((tournament.id === 'foot-CL' || tShort === 'champions') && (ml.includes('champions') || ml.includes('uefa'))) {
        return true;
      }
      if (tShort === 'lec' && ml.includes('lec')) return true;
      if (tn.includes('vct') && ml.includes('vct') && tShort && ml.includes(tShort)) return true;
      return false;
    });
  },

  // Métodos de ayuda para gestión de favoritos y juegos
  isGameCategoryEnabled,
  isTournamentFavorite,
  isTournamentItemFavorite,
  toggleTournamentFavorite,
  isTeamFavorite,
  toggleTeamFavorite,
  normalizeFavoriteTournaments,
  normalizeFavoriteTeams,
  resolveMasterTournamentId,
  getDefaultFavoriteTournaments,
};

