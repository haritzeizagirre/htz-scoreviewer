/**
 * Motor de alertas (lado app): valores por defecto, agrupación de favoritos,
 * resolución de la matriz de eventos por partido (general → torneo → equipo).
 */
import {
  Match,
  NotificationEventKey,
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
      groups.set(key, { key, label: f, members: [f] });
    }
  }
  return [...groups.values()];
}

/** Deporte de un equipo del catálogo (best-effort; undefined si no se encuentra). */
export function resolveTeamGame(label: string): SportCategory | undefined {
  try {
    const items = ScoreService.getTeamsCatalog({ query: label });
    const exact =
      items.find((t) => t.name.toLowerCase() === label.toLowerCase()) ||
      items.find((t) => t.name.toLowerCase().includes(label.toLowerCase()));
    return exact?.game;
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
        const ov = settings.tournaments[g.key];
        if (ov) prefs = { ...prefs, ...ov };
      }
    }

    for (const g of teamGroups) {
      const teamHit =
        isTeamFavorite(match.teamA.name, match.teamA.shortName, g.members) ||
        isTeamFavorite(match.teamB.name, match.teamB.shortName, g.members);
      if (teamHit) {
        relevant = true;
        const ov = settings.teams[g.key];
        if (ov) prefs = { ...prefs, ...ov };
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
