/**
 * Motor de alertas (lado app): valores por defecto, agrupación de favoritos,
 * resolución de la matriz de eventos por partido (general → torneo → equipo).
 */
import {
  Match,
  NotificationEventKey,
  NotificationEventOverride,
  NotificationEventPrefs,
  NotificationSettings,
  SportCategory,
} from './types';
import { MASTER_TOURNAMENTS, ScoreService, isTeamFavorite, isTournamentFavorite } from './scoreService';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false,
  events: {
    kickoff: true,
    goal: true,
    halfTime: false,
    fullTime: true,
    mapEnd: true,
    seriesEnd: true,
    reminder: true,
  },
  teams: {},
  tournaments: {},
  reminderMinutes: 15,
};

/** Etiquetas legibles de cada evento, agrupadas por deporte. */
export const NOTIFICATION_EVENT_LABELS: Record<NotificationEventKey, string> = {
  kickoff: 'Inicio',
  goal: 'Goles',
  halfTime: 'Descanso',
  fullTime: 'Final del partido',
  mapEnd: 'Fin de mapa/juego',
  seriesEnd: 'Resultado final',
  reminder: 'Recordatorio previo',
};

export const FOOTBALL_EVENT_KEYS: NotificationEventKey[] = [
  'kickoff',
  'goal',
  'halfTime',
  'fullTime',
];
export const ESPORTS_EVENT_KEYS: NotificationEventKey[] = [
  'kickoff',
  'mapEnd',
  'seriesEnd',
];
export const ALL_EVENT_KEYS: NotificationEventKey[] = [
  'kickoff',
  'goal',
  'halfTime',
  'fullTime',
  'mapEnd',
  'seriesEnd',
  'reminder',
];

/** Todos los eventos apagados (favorito silenciado). */
export const ALL_EVENTS_OFF: NotificationEventPrefs = {
  kickoff: false,
  goal: false,
  halfTime: false,
  fullTime: false,
  mapEnd: false,
  seriesEnd: false,
  reminder: false,
};

/** Todos los eventos encendidos (preset "Todo"). */
export const ALL_EVENTS_ON: NotificationEventPrefs = {
  kickoff: true,
  goal: true,
  halfTime: true,
  fullTime: true,
  mapEnd: true,
  seriesEnd: true,
  reminder: true,
};

/** Presets rápidos de la sección "Eventos generales". */
export const NOTIFICATION_EVENT_PRESETS: { id: string; label: string; events: NotificationEventPrefs }[] = [
  { id: 'all', label: 'Todo', events: ALL_EVENTS_ON },
  {
    id: 'recommended',
    label: 'Recomendado',
    events: {
      kickoff: true,
      goal: true,
      halfTime: false,
      fullTime: true,
      mapEnd: true,
      seriesEnd: true,
      reminder: true,
    },
  },
  {
    id: 'finals',
    label: 'Solo finales',
    events: {
      kickoff: false,
      goal: false,
      halfTime: false,
      fullTime: true,
      mapEnd: true,
      seriesEnd: true,
      reminder: false,
    },
  },
];

/** Extrae solo las claves de evento de un override (ignora `enabled`). */
function pickEventKeys(ov: NotificationEventOverride): Partial<NotificationEventPrefs> {
  const out: Partial<NotificationEventPrefs> = {};
  for (const key of ALL_EVENT_KEYS) {
    const value = ov[key];
    if (typeof value === 'boolean') out[key] = value;
  }
  return out;
}

export interface FavoriteGroup {
  key: string;
  label: string;
  members: string[];
  game?: SportCategory;
  shortName?: string;
  slug?: string;
}

/** Agrupa los favoritos de torneos (id + nombre) en una fila por torneo. */
export function groupFavoriteTournaments(favorites: string[]): FavoriteGroup[] {
  const groups = new Map<string, FavoriteGroup>();
  for (const fav of favorites || []) {
    const f = (fav || '').trim();
    if (!f) continue;
    const lower = f.toLowerCase();
    const master = MASTER_TOURNAMENTS.find(
      (mt) =>
        mt.id.toLowerCase() === lower ||
        mt.name.toLowerCase() === lower ||
        (mt.slug && mt.slug.toLowerCase() === lower)
    );
    const key = master ? master.id.toLowerCase() : `dyn:${lower}`;
    const existing = groups.get(key);
    if (existing) {
      existing.members.push(f);
    } else {
      groups.set(key, {
        key,
        label: master ? master.name : f,
        members: [f],
        game: master?.game,
        shortName: master?.shortName,
        slug: master?.slug,
      });
    }
  }
  return [...groups.values()];
}

/** Agrupa los favoritos de equipos (deduplicado por nombre normalizado). */
export function groupFavoriteTeams(favorites: string[]): FavoriteGroup[] {
  const groups = new Map<string, FavoriteGroup>();
  for (const fav of favorites || []) {
    const f = (fav || '').trim();
    if (!f) continue;
    const key = f.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, { key, label: f, members: [f], game: resolveTeamGame(f) });
    }
  }
  return [...groups.values()];
}

/** Deporte de un equipo del catálogo (best-effort; undefined si no se encuentra o es ambiguo). */
export function resolveTeamGame(label: string): SportCategory | undefined {
  try {
    const items = ScoreService.getTeamsCatalog({ query: label });
    const lower = label.toLowerCase();
    const exact = items.filter((t) => t.name.toLowerCase() === lower);
    const pool =
      exact.length > 0 ? exact : items.filter((t) => t.name.toLowerCase().includes(lower));
    if (pool.length === 0) return undefined;
    // Si el mismo nombre existe en varios juegos (p. ej. G2 en LoL y CS2) no se
    // fuerza un deporte: el favorito vale para cualquiera de ellos.
    const games = [...new Set(pool.map((t) => t.game))];
    return games.length === 1 ? games[0] : undefined;
  } catch {
    return undefined;
  }
}

export interface ResolvedMatchPrefs {
  /** ¿El partido pertenece a algún equipo/torneo favorito? */
  relevant: boolean;
  prefs: NotificationEventPrefs;
}

/**
 * Crea un resolutor de preferencias con los favoritos ya agrupados: se calcula
 * una vez por carga (y no por partido) para que el motor sea barato con listas
 * grandes de partidos.
 */
export function createMatchPrefsResolver(
  settings: NotificationSettings,
  favoriteTeams: string[],
  favoriteTournaments: string[]
): (match: Match) => ResolvedMatchPrefs {
  const tournamentGroups = groupFavoriteTournaments(favoriteTournaments);
  const teamGroups = groupFavoriteTeams(favoriteTeams);

  return (match: Match): ResolvedMatchPrefs => {
    let prefs: NotificationEventPrefs = { ...settings.events };
    let relevant = false;

    /** Aplica un override encima de las preferencias efectivas. */
    const applyOverride = (ov?: NotificationEventOverride) => {
      if (!ov) return;
      if (ov.enabled === false) {
        // Interruptor rápido apagado: silencia TODOS los eventos del favorito.
        prefs = { ...ALL_EVENTS_OFF };
        return;
      }
      prefs = { ...prefs, ...pickEventKeys(ov) };
    };

    const masterId = match.masterTournamentId
      ? String(match.masterTournamentId).toLowerCase()
      : '';

    for (const g of tournamentGroups) {
      const byId = !g.key.startsWith('dyn:') && masterId.length > 0 && g.key === masterId;
      const byFuzzy =
        !byId &&
        isTournamentFavorite(
          match.league,
          match.details?.tournamentStage,
          g.members,
          match.masterTournamentId
        );
      if (byId || byFuzzy) {
        relevant = true;
        applyOverride(settings.tournaments[g.key]);
      }
    }

    for (const g of teamGroups) {
      const teamHit =
        isTeamFavorite(match.teamA.name, match.teamA.shortName, g.members) ||
        isTeamFavorite(match.teamB.name, match.teamB.shortName, g.members);
      if (teamHit) {
        relevant = true;
        applyOverride(settings.teams[g.key]);
      }
    }

    return { relevant, prefs };
  };
}

/**
 * Preferencias efectivas para un partido: parte de las generales y aplica los
 * overrides de sus torneos favoritos y, por encima, los de sus equipos favoritos.
 */
export function resolveMatchNotificationPrefs(
  match: Match,
  settings: NotificationSettings,
  favoriteTeams: string[],
  favoriteTournaments: string[]
): ResolvedMatchPrefs {
  return createMatchPrefsResolver(settings, favoriteTeams, favoriteTournaments)(match);
}
