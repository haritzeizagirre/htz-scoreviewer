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

export interface BracketMatch {
  id: string;
  name: string;
  stage?: string;
  status: 'FINISHED' | 'LIVE' | 'UPCOMING';
  scheduledTime?: string;
  teamA: {
    id?: string | number;
    name: string;
    shortName?: string;
    logo?: string;
    score?: number | string;
    winner?: boolean;
    seed?: number;
  };
  teamB: {
    id?: string | number;
    name: string;
    shortName?: string;
    logo?: string;
    score?: number | string;
    winner?: boolean;
    seed?: number;
  };
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
  season?: string;
  dates?: string;
  location?: string;
  prizePool?: string;
  description?: string;
  officialStreamUrl?: string;
  standings?: StandingGroup[];
  bracket?: TournamentBracket;
  participants: TournamentParticipant[];
  matches: Match[];
}
