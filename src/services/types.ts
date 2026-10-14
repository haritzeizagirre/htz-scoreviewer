export type SportCategory =
  | 'FÚTBOL'
  | 'VALORANT'
  | 'LOL'
  | 'CS2'
  | 'R6'
  | 'DOTA2';

export type TournamentTier = 'S' | 'A' | 'B' | 'C' | 'D';

export type MatchRegion = 'GLOBAL' | 'EMEA' | 'AMERICAS' | 'ASIA' | 'ESPAÑA';

export type MatchStatus = 'LIVE' | 'UPCOMING' | 'FINISHED';

/** Estado de cada fuente consultada al cargar partidos (para el indicador de frescura). */
export type MatchSourceState = 'ok' | 'error' | 'skipped';

export interface MatchSourceStatus {
  id: 'vlr' | 'pandascore' | 'football';
  label: string;
  state: MatchSourceState;
  count: number;
  /** Motivo cuando la fuente se omite: sin token o juego desactivado. */
  reason?: 'no-token' | 'disabled';
}

/** Resultado de un partido reciente de un equipo (para la forma reciente). */
export interface TeamFormEntry {
  dateIso: string;
  league?: string;
  opponentName: string;
  scoreFor: number | string;
  scoreAgainst: number | string;
  result: 'W' | 'L' | 'D';
}

/** Un enfrentamiento anterior entre los dos equipos (para el cara a cara). */
export interface HeadToHeadEntry {
  dateIso: string;
  league?: string;
  teamA: string;
  teamB: string;
  scoreA: number | string;
  scoreB: number | string;
}

/** Previa de un partido: forma reciente de ambos equipos + cara a cara. */
export interface MatchPreviewData {
  formA: TeamFormEntry[];
  formB: TeamFormEntry[];
  h2h: HeadToHeadEntry[];
}

/** Tipos de evento notificables. */
export type NotificationEventKey =
  | 'kickoff' // Inicio (fútbol y esports)
  | 'goal' // Gol (fútbol)
  | 'halfTime' // Descanso (fútbol)
  | 'fullTime' // Final del partido (fútbol)
  | 'redCard' // Roja / segunda amarilla (fútbol)
  | 'goalCancelled' // Gol anulado por el VAR (fútbol)
  | 'mapEnd' // Fin de mapa/juego (esports)
  | 'seriesEnd' // Resultado final de serie (esports)
  | 'reminder'; // Recordatorio previo

/** Interruptores por tipo de evento (matriz global o por favorito). */
export interface NotificationEventPrefs {
  kickoff: boolean;
  goal: boolean;
  halfTime: boolean;
  fullTime: boolean;
  redCard: boolean;
  goalCancelled: boolean;
  mapEnd: boolean;
  seriesEnd: boolean;
  reminder: boolean;
}

/**
 * Override de alertas de un favorito (torneo o equipo): además de personalizar
 * eventos concretos, `enabled: false` silencia TODAS las alertas de ese favorito
 * de una sola vez (el interruptor rápido de la lista).
 */
export type NotificationEventOverride = Partial<NotificationEventPrefs> & {
  enabled?: boolean;
};

/** Configuración del push con la app cerrada (Fase 2, servidor propio). */
export interface PushSettings {
  /** URL del worker desplegado (p. ej. https://score-viewer-push.xxx.workers.dev). */
  serverUrl: string;
  /** Clave compartida con el servidor (AUTH_KEY de wrangler.toml). */
  authKey: string;
  /** Conectado: el servidor envía los avisos (la app delega en él). */
  connected: boolean;
  /** Token Expo Push de este dispositivo. */
  deviceToken?: string;
}

/**
 * Configuración de alertas: valores generales + matriz por favorito.
 * Las claves de equipos son el nombre normalizado y las de torneos el id maestro
 * (o `dyn:<nombre>` para torneos dinámicos de la búsqueda online).
 */
export interface NotificationSettings {
  enabled: boolean;
  events: NotificationEventPrefs;
  teams: Record<string, NotificationEventOverride>;
  tournaments: Record<string, NotificationEventOverride>;
  reminderMinutes: number;
  /** Fase 2: push con la app cerrada (solo Android). */
  push?: PushSettings;
}

export interface PlayerInfo {
  id?: string | number;
  name: string;
  nickname?: string;
  role?: string;
  nationality?: string;
  photoUrl?: string;
  number?: number;
}

export interface TeamRoster {
  teamName: string;
  players: PlayerInfo[];
}

export interface MatchStream {
  name?: string;
  language: string;
  rawUrl: string;
  embedUrl?: string;
  official?: boolean;
  platform?: 'twitch' | 'youtube' | 'kick' | 'tv' | 'other';
}

export interface MatchMapGame {
  position: number;
  status: 'finished' | 'running' | 'not_started';
  mapName?: string;
  winnerTeam?: 'A' | 'B';
  scoreA?: number | string;
  scoreB?: number | string;
  duration?: string;
}

export interface PastH2HMatch {
  date: string;
  scoreA: number | string;
  scoreB: number | string;
  winner: string;
  tournament: string;
}

export interface MatchH2H {
  matchesPlayed: number;
  winsA: number;
  winsB: number;
  draws?: number;
  recentFormA?: ('W' | 'L' | 'D')[];
  recentFormB?: ('W' | 'L' | 'D')[];
  previousMatches?: PastH2HMatch[];
}

export interface FootballEvent {
  minute: number;
  type: 'goal' | 'card_yellow' | 'card_red' | 'sub';
  team: 'A' | 'B';
  player: string;
  detail?: string;
}

/** Gol real de un partido de fútbol, con goleador y minuto. */
export interface MatchGoal {
  /** Minuto reglamentario (sin el tiempo añadido). */
  minute: number;
  /** Minutos de añadido (ej. 45+2'). */
  injuryTime?: number | null;
  scorer?: string;
  assist?: string;
  /** REGULAR | PENALTY | OWN_GOAL */
  type?: string;
  team?: 'A' | 'B';
  scoreA?: number | string;
  scoreB?: number | string;
}

/** Amonestación o expulsión de un partido de fútbol. */
export interface FootballBooking {
  minute: number;
  injuryTime?: number | null;
  /** YELLOW | RED | YELLOW_RED (segunda amarilla). */
  card: 'YELLOW' | 'RED' | 'YELLOW_RED';
  player?: string;
  team?: 'A' | 'B';
}

/**
 * Gol anulado por el VAR. `key` es estable en la fuente (id del evento) para no
 * repetir el aviso entre cargas.
 */
export interface FootballGoalCancel {
  minute: number;
  injuryTime?: number | null;
  player?: string;
  team?: 'A' | 'B';
  key: string;
}

/** Sustitución de un partido de fútbol (Football-Data). */
export interface FootballSubstitution {
  minute: number;
  injuryTime?: number | null;
  playerIn?: string;
  playerOut?: string;
  team?: 'A' | 'B';
}

/** Jugador de la alineación titular o del banquillo (Football-Data). */
export interface FootballLineupPlayer {
  id?: number | string;
  name: string;
  position?: string;
  shirtNumber?: number | null;
  /** Valoración del jugador (0-10) si la fuente ya la publica. */
  rating?: number | null;
  /** Centro del jugador en el campo vertical (0 = banda izquierda, 1 = derecha). */
  pitchX?: number;
  /** Centro del jugador en el campo vertical (0 = su portería, 1 = portería rival). */
  pitchY?: number;
}

/** Baja de un equipo (lesión, sanción...) para la pestaña de alineaciones. */
export interface FootballUnavailablePlayer {
  name: string;
  /** Motivo en castellano ("Lesión", "Sanción"...), si se conoce. */
  reason?: string;
}

/** Alineación, banquillo, entrenador y dibujo de un equipo (Football-Data). */
export interface FootballTeamLineup {
  formation?: string;
  coach?: string;
  starters: FootballLineupPlayer[];
  bench: FootballLineupPlayer[];
  /** Bajas publicadas por la fuente (lesión, sanción...). */
  unavailable?: FootballUnavailablePlayer[];
}

/** Comparativa de estadísticas de equipo del partido (Football-Data). */
export interface FootballTeamStats {
  ballPossession?: number;
  shots?: number;
  shotsOnGoal?: number;
  shotsOffGoal?: number;
  fouls?: number;
  cornerKicks?: number;
  offsides?: number;
  saves?: number;
  yellowCards?: number;
  redCards?: number;
}

/**
 * Detalle ampliado de un partido de fútbol (`/v4/matches/{id}`): minuto de
 * juego, cronología completa (goles, tarjetas y cambios), alineaciones y
 * estadísticas de equipo. Es lo que alimenta la pestaña Stats de fútbol.
 */
export interface FootballMatchDetail {
  /** Estado crudo de Football-Data (IN_PLAY | PAUSED | FINISHED...). */
  status?: string;
  minute?: number | null;
  injuryTime?: number | null;
  /** Marcador al descanso, si la fuente lo trae. */
  halfTimeA?: number | null;
  halfTimeB?: number | null;
  /** REGULAR | EXTRA_TIME | PENALTY_SHOOTOUT */
  duration?: string;
  venue?: string;
  referee?: string;
  goals: MatchGoal[];
  bookings: FootballBooking[];
  substitutions: FootballSubstitution[];
  /** Goles anulados por el VAR (FotMob), para las alertas. */
  goalCancels?: FootballGoalCancel[];
  lineupA?: FootballTeamLineup;
  lineupB?: FootballTeamLineup;
  statsA?: FootballTeamStats;
  statsB?: FootballTeamStats;
}

export interface MatchTeam {
  id?: string | number;
  name: string;
  shortName: string;
  score: number | string;
  logo?: string;
  location?: string;
  isFav?: boolean;
  players?: PlayerInfo[];
}

export interface LiveRoundScore {
  scoreA: number | string;
  scoreB: number | string;
  mapName?: string;
  mapNumber?: number;
  roundOrTime?: string;
}

export interface Match {
  id: string;
  game: SportCategory;
  league: string;
  status: MatchStatus;
  timeInfo: string;
  startTimeIso: string;
  tier?: TournamentTier;
  region?: MatchRegion;
  /** ID del torneo maestro del catálogo (MASTER_TOURNAMENTS) al que pertenece el partido. */
  masterTournamentId?: string;
  /** Serie exacta de PandaScore a la que pertenece el partido (edición concreta). */
  seriesId?: number | string;
  teamA: MatchTeam;
  teamB: MatchTeam;
  isFallback?: boolean;
  hasFav?: boolean;
  /** true si el torneo del partido está en favoritos (independientemente del equipo). */
  isFavTournament?: boolean;
  liveRoundScore?: LiveRoundScore;
  details?: {
    venue?: string;
    tournamentStage?: string;
    stageName?: string;
    stageId?: number | string;
    roundOrMap?: string;
    headToHead?: string;
    bestOf?: number;
    liveRoundScore?: LiveRoundScore;
    streams?: MatchStream[];
    gamesBreakdown?: MatchMapGame[];
    rosterA?: TeamRoster;
    rosterB?: TeamRoster;
    h2hData?: MatchH2H;
    footballEvents?: FootballEvent[];
    /** Goles reales consultados a la fuente de incidencias (para alertas y cronología). */
    goals?: MatchGoal[];
    /** Rojas / segundas amarillas (para las alertas). */
    redCards?: FootballBooking[];
    /** Goles anulados por el VAR (para las alertas). */
    goalCancels?: FootballGoalCancel[];
    broadcastTv?: string[];
  };
}

export interface Gtr3ConfigState {
  pandaToken: string;
  footballToken: string;
  enabledGames: Record<string, boolean>;
  favoriteTeams: string[];
  favoriteTournaments: string[];
  showUpcoming: boolean;
  showFavoriteRecentResults: boolean;
  showTeamLogos: boolean;
  maxMatches: number;
  /** Configuración de alertas (notificaciones) de la app. */
  notifications?: NotificationSettings;
}

export interface TournamentItem {
  id: string;
  name: string;
  shortName?: string;
  slug?: string;
  logo?: string;
  game: SportCategory;
  tier: TournamentTier;
  region: MatchRegion;
  isFav?: boolean;
  externalId?: number | string;
  leagueId?: number | string;
  /**
   * Serie exacta (edición) fijada al abrir el torneo desde un partido concreto.
   * Tiene prioridad sobre cualquier resolución por año o nombre.
   */
  pinnedSeriesId?: number | string;
  country?: string;
  description?: string;
  season?: string;
}

export interface TeamCatalogItem {
  id: string;
  name: string;
  shortName?: string;
  logo?: string;
  game: SportCategory;
  tier?: TournamentTier;
  region?: MatchRegion;
  isFav?: boolean;
  externalId?: number | string;
  location?: string;
}

export interface VlrPlayerStats {
  name: string;
  teamTag?: string;
  countryCode?: string;
  agentName?: string;
  agentIconUrl?: string;
  rating: string;
  acs: string;
  kills: string;
  deaths: string;
  assists: string;
  kdDiff: string;
  kast: string;
  adr: string;
  hsPercent: string;
  fk: string;
  fd: string;
}

export interface VlrMapData {
  mapNumber: number;
  mapName: string;
  scoreA?: string;
  scoreB?: string;
  teamAStats: VlrPlayerStats[];
  teamBStats: VlrPlayerStats[];
}

export interface VlrVetoRow {
  action: string;
  mapName: string;
  team?: string;
}

export interface VlrMatchData {
  vlrUrl: string;
  matchTitle?: string;
  patch?: string;
  vetoText?: string;
  vetoRows?: VlrVetoRow[];
  maps: VlrMapData[];
}

export interface R6PlayerStats {
  name: string;
  avatarUrl?: string;
  kills: string;
  deaths: string;
  kdDiff: string;
  entryKills: string;
  entryDeaths: string;
  entryDiff: string;
  kpr: string;
  hsPercent: string;
  kost: string;
  srv: string;
  eps: string;
}

export interface R6VetoRow {
  mapName: string;
  action: string;
  team?: string;
}

export interface R6MapData {
  mapNumber: number;
  mapName: string;
  scoreA?: string;
  scoreB?: string;
  teamAStats: R6PlayerStats[];
  teamBStats: R6PlayerStats[];
}

export interface R6MatchData {
  gezzlyUrl: string;
  matchTitle?: string;
  league?: string;
  vetoRows: R6VetoRow[];
  maps: R6MapData[];
}

export interface LolPick {
  champion: string;
  championIconUrl?: string;
  playerName?: string;
  kills?: string;
  deaths?: string;
  assists?: string;
  gold?: string;
  cs?: string;
  damage?: string;
}

export interface LolTeamGame {
  teamName: string;
  won: boolean;
  kills?: string;
  gold?: string;
  picks: LolPick[];
  bans: LolPick[];
}

export interface LolGameData {
  gameNumber: number;
  gameLength?: string;
  patch?: string;
  teamA: LolTeamGame;
  teamB: LolTeamGame;
}

export interface LolMatchData {
  matchId?: string;
  tournament?: string;
  teamAName: string;
  teamBName: string;
  scoreA?: string;
  scoreB?: string;
  bestOf?: string;
  mvp?: string;
  mvpPoints?: string;
  games: LolGameData[];
}

export type TournamentFormat = 'LEAGUE' | 'PLAYOFFS' | 'HYBRID_GROUPS_PLAYOFFS' | 'SWISS';

export interface StandingRow {
  position: number;
  teamId?: string | number;
  teamName: string;
  shortName?: string;
  teamLogo?: string;
  playedGames: number;
  won: number;
  draw?: number;
  lost: number;
  points?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDifference?: number;
  roundDifference?: number;
  form?: ('W' | 'D' | 'L')[];
  zone?: 'champions' | 'europa' | 'conference' | 'relegation' | 'playoff_upper' | 'playoff_lower' | 'eliminated';
}

export interface StandingGroup {
  groupName: string;
  table: StandingRow[];
}

export interface BracketMatchTeam {
  id?: string | number;
  name: string;
  shortName?: string;
  logo?: string;
  score?: number | string;
  winner?: boolean;
  seed?: number;
  /** Récord de la fase suiza en el momento del cruce (ej. "3-1"). */
  record?: string;
}

export interface BracketMatch {
  id: string;
  name: string;
  stage?: string;
  status: 'FINISHED' | 'LIVE' | 'UPCOMING';
  scheduledTime?: string;
  teamA: BracketMatchTeam;
  teamB: BracketMatchTeam;
}

export interface BracketRound {
  roundNumber: number;
  roundName: string;
  matches: BracketMatch[];
}

export interface TournamentBracket {
  format: 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'SWISS';
  upperRounds: BracketRound[];
  lowerRounds?: BracketRound[];
  grandFinal?: BracketMatch;
}

/** Naturaleza de cada fase del torneo (Play-In, Suiza, Grupos, Playoffs...). */
export type TournamentStageFormat = 'LEAGUE' | 'GROUPS' | 'SWISS' | 'PLAY_IN' | 'KNOCKOUT';

/** Ronda de una fase suiza: cada equipo juega una serie por ronda. */
export interface SwissRound {
  roundNumber: number;
  roundName: string;
  matches: BracketMatch[];
}

/**
 * Fase interna de un torneo (Play-In, Fase Suiza, Playoffs...). Cada fase se
 * pinta con su propia tabla y/o cuadro, sin mezclar formatos distintos.
 */
export interface TournamentStage {
  id: string;
  name: string;
  format: TournamentStageFormat;
  standings?: StandingGroup[];
  bracket?: TournamentBracket;
  /** Cruces ronda a ronda cuando la fase es suiza. */
  swissRounds?: SwissRound[];
  matches: Match[];
}

export interface TournamentParticipant {
  id: string | number;
  name: string;
  shortName?: string;
  logo?: string;
  region?: string;
  seed?: number;
  group?: string;
  roster?: PlayerInfo[];
}

export interface TournamentFullDetail {
  id: string;
  name: string;
  shortName: string;
  logo?: string;
  game: SportCategory;
  tier: TournamentTier;
  region: MatchRegion;
  format: TournamentFormat;
  /** 'seed' = contenido de ejemplo del catálogo; 'live' = sincronizado con APIs. */
  dataSource?: 'seed' | 'live';
  season?: string;
  dates?: string;
  location?: string;
  prizePool?: string;
  description?: string;
  officialStreamUrl?: string;
  standings?: StandingGroup[];
  bracket?: TournamentBracket;
  /** Fases internas del torneo (Play-In, Suiza, Playoffs...) con su formato real. */
  stages?: TournamentStage[];
  participants: TournamentParticipant[];
  matches: Match[];
}
