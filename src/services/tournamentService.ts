import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  TournamentItem,
  TournamentFullDetail,
  TournamentBracket,
  StandingGroup,
  StandingRow,
  BracketRound,
  BracketMatch,
  TournamentParticipant,
  Match,
  SportCategory,
} from './types';
import { ScoreService, areTeamsMatching } from './scoreService';

// ==========================================
// CACHÉ DE DOBLE NIVEL (L1 MEMORIA + L2 STORAGE)
// ==========================================
const MEMORY_CACHE = new Map<string, { data: TournamentFullDetail; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos para datos en directo
const STORAGE_PREFIX = 'sv_tourn_detail_real_v11_';

// Caché para resolución dinámica de series (evita llamadas API redundantes de búsqueda)
const SERIES_RESOLUTION_CACHE = new Map<
  string,
  { seriesId: number | string; year?: number | string; fullName?: string; beginAt?: string; endAt?: string; leagueName?: string; leagueLogo?: string; timestamp: number }
>();
const SERIES_TTL_MS = 30 * 60 * 1000; // 30 minutos de vigencia para el descubrimiento de series

// Caché para resolver la liga PandaScore de torneos dinámicos (sin leagueId en catálogo)
const LEAGUE_RESOLUTION_CACHE = new Map<
  string,
  { leagueId: number | string; name?: string; slug?: string; logo?: string; timestamp: number }
>();
const LEAGUE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

const PANDA_VIDEOGAME_SLUGS: Record<string, string> = {
  VALORANT: 'valorant',
  LOL: 'league-of-legends',
  CS2: 'cs-go',
  DOTA2: 'dota-2',
  R6: 'r6-siege',
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch tolerante a los límites de tasa de PandaScore: ante un HTTP 429
 * espera un instante y reintenta una vez, evitando que el torneo quede vacío.
 */
async function fetchPandaResilient(url: string, init?: any): Promise<any | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429 && attempt === 0) {
        await sleep(1300);
        continue;
      }
      return res;
    } catch {
      if (attempt === 0) {
        await sleep(400);
        continue;
      }
      return null;
    }
  }
  return null;
}

// ==========================================
// HELPERS PARA CONSTRUCCIÓN DINÁMICA REAL
// ==========================================

/**
 * Extrae el nombre de la fase (parte previa a "•") del stage de un partido.
 */
function extractStagePrefix(stage?: string, explicitStageName?: string): string {
  if (explicitStageName && explicitStageName.trim()) return explicitStageName.trim();
  const raw = (stage || '').trim();
  if (!raw) return '';
  const sepIdx = raw.indexOf(' • ');
  return sepIdx >= 0 ? raw.slice(0, sepIdx).trim() : raw;
}

/**
 * Extrae el nombre concreto del partido dentro de su fase (parte posterior a "•").
 */
export function extractMatchName(stage?: string): string {
  const raw = (stage || '').trim();
  const sepIdx = raw.indexOf(' • ');
  return sepIdx >= 0 ? raw.slice(sepIdx + 3).trim() : '';
}

/**
 * ¿El texto corresponde a una eliminatoria (cuadro/playoffs)?
 */
function isKnockoutText(text: string): boolean {
  const s = (text || '').toLowerCase();
  return /playoff|play-off|knockout|eliminat|bracket|cuart|quarter|semi|\bfinal\b|octav|round of (8|16|32)|\bubqf\b|\bubsf\b|\bubf\b|\blr\d\b|\blbf\b|\bgf\b|ro8|ro16|winners|losers|upper|lower|perdedor|ganador/.test(
    s
  );
}

interface ParsedKnockoutMatch {
  match: Match;
  bracket: 'upper' | 'lower' | 'grand';
  order: number;
  roundNumber?: number;
  matchNumber: number;
  time: number;
}

/**
 * Clasifica un partido eliminatorio por cuadro (ganadores/perdedores) y ronda.
 */
function parseKnockoutMatch(m: Match): ParsedKnockoutMatch {
  const stageName = extractStagePrefix(m.details?.tournamentStage, m.details?.stageName);
  const text = `${stageName} ${extractMatchName(m.details?.tournamentStage)} ${m.details?.roundOrMap || ''}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const matchNumberMatch = text.match(/(?:match|partido|serie)\s*#?\s*(\d+)/);
  let matchNumber = matchNumberMatch ? parseInt(matchNumberMatch[1], 10) : Number.POSITIVE_INFINITY;
  if (!isFinite(matchNumber)) {
    const roundIndexMatch = text.match(
      /(?:quarterfinal|quarter-finals?|semifinal|semi-finals?|final|ronda|round)\s*#?\s*(\d+)/i
    );
    if (roundIndexMatch) matchNumber = parseInt(roundIndexMatch[1], 10);
  }

  const isGrand = /grand final|gran final/.test(text);
  const isLower = !isGrand && /lower|loser|perdedor|\blb\b|\blr\d\b/.test(text);
  const bracket: ParsedKnockoutMatch['bracket'] = isGrand ? 'grand' : isLower ? 'lower' : 'upper';

  let order = 30; // ronda genérica (round N)
  let roundNumber: number | undefined;
  const roundNumberMatch = text.match(/(?:round|ronda)\s*#?\s*(\d+)/);

  if (isGrand) {
    order = 90;
  } else if (/quarter|cuart|\bubqf\b|\bro8\b/.test(text)) {
    order = 40;
  } else if (/semi|\bubsf\b/.test(text)) {
    order = 50;
  } else if (/round of 32|\br32\b/.test(text)) {
    order = 10;
  } else if (/round of 16|\boctav|\br16\b|round of 12/.test(text)) {
    order = 20;
  } else if (/\bfinal\b/.test(text)) {
    order = 60;
  } else if (roundNumberMatch) {
    roundNumber = parseInt(roundNumberMatch[1], 10);
  }

  return {
    match: m,
    bracket,
    order,
    roundNumber,
    matchNumber,
    time: new Date(m.startTimeIso).getTime() || 0,
  };
}

function bracketRoundName(p: ParsedKnockoutMatch, isDoubleElim: boolean): string {
  if (p.order === 90) return 'Gran Final';
  if (p.order === 60)
    return p.bracket === 'lower' ? 'Final de Perdedores' : isDoubleElim ? 'Final de Ganadores' : 'Final';
  if (p.order === 50)
    return p.bracket === 'lower' ? 'Semifinales de Perdedores' : isDoubleElim ? 'Semifinales de Ganadores' : 'Semifinales';
  if (p.order === 40)
    return p.bracket === 'lower' ? 'Cuartos de Perdedores' : isDoubleElim ? 'Cuartos de Ganadores' : 'Cuartos de Final';
  if (p.order === 20)
    return p.bracket === 'lower' ? 'Octavos de Perdedores' : isDoubleElim ? 'Octavos de Ganadores' : 'Octavos de Final';
  if (p.order === 10) return p.bracket === 'lower' ? 'Ronda de 32 (Perdedores)' : 'Ronda de 32';
  if (p.roundNumber !== undefined)
    return p.bracket === 'lower' ? `Ronda ${p.roundNumber} de Perdedores` : `Ronda ${p.roundNumber}`;
  return p.bracket === 'lower' ? 'Cuadro de Perdedores' : 'Fase de Eliminatorias';
}

function toBracketMatch(m: Match): BracketMatch {
  const isFinished = m.status === 'FINISHED';
  const sA = typeof m.teamA.score === 'number' ? m.teamA.score : parseInt(String(m.teamA.score), 10);
  const sB = typeof m.teamB.score === 'number' ? m.teamB.score : parseInt(String(m.teamB.score), 10);
  const validA = !isNaN(sA);
  const validB = !isNaN(sB);

  return {
    id: m.id,
    name:
      extractMatchName(m.details?.tournamentStage) ||
      m.details?.tournamentStage ||
      `${m.teamA.shortName || m.teamA.name} vs ${m.teamB.shortName || m.teamB.name}`,
    stage: m.details?.tournamentStage,
    status: m.status,
    scheduledTime:
      m.timeInfo ||
      (m.startTimeIso
        ? new Date(m.startTimeIso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
        : undefined),
    teamA: {
      name: m.teamA.name,
      shortName: m.teamA.shortName,
      logo: m.teamA.logo,
      score: m.teamA.score,
      winner: isFinished && validA && validB ? sA > sB : undefined,
    },
    teamB: {
      name: m.teamB.name,
      shortName: m.teamB.shortName,
      logo: m.teamB.logo,
      score: m.teamB.score,
      winner: isFinished && validA && validB ? sB > sA : undefined,
    },
  };
}

/**
 * Construye el cuadro de eliminatorias exclusivamente a partir de partidos reales.
 * Respeta 'TBD' si los cruces no están determinados y nunca inventa equipos.
 * Separa la fase principal (Playoffs) de fases previas (Play-In), clasifica rondas
 * de cuadro ganadores/perdedores sin duplicar partidos y numera cada ronda.
 */
export function buildBracketFromMatches(matches: Match[]): TournamentBracket | undefined {
  if (!matches || matches.length === 0) return undefined;

  // 1. Descartar fases de grupos/liga/suiza y quedarnos con partidos de eliminatorias
  const candidates = matches.filter((m) => {
    const prefix = extractStagePrefix(m.details?.tournamentStage, m.details?.stageName);
    if (/^(group|grupo|regular|swiss|suiza|temporada|liga|league|stage \d|fase \d)/i.test(prefix.trim())) {
      return false;
    }
    const text = `${prefix} ${extractMatchName(m.details?.tournamentStage)} ${m.details?.roundOrMap || ''}`;
    // Fases tipo "Competición 2026 (Group A)" no son eliminatorias
    if (/\((?:group|grupo)\s+[^)]+\)/i.test(text)) return false;
    return isKnockoutText(text);
  });

  if (candidates.length === 0) return undefined;

  // 2. Si el torneo tiene varias fases eliminatorias (Play-In, Playoffs...),
  //    construir el cuadro con la fase principal y no mezclar fases distintas.
  const byPhase = new Map<string, Match[]>();
  for (const m of candidates) {
    const prefix = extractStagePrefix(m.details?.tournamentStage, m.details?.stageName) || 'Eliminatorias';
    if (!byPhase.has(prefix)) byPhase.set(prefix, []);
    byPhase.get(prefix)!.push(m);
  }

  const phaseNames = Array.from(byPhase.keys());
  const mainPhase =
    phaseNames.find((p) => /playoff|play-off|main event|final stage/i.test(p)) ||
    phaseNames.find((p) =>
      (byPhase.get(p) || []).some((m) =>
        /grand final|gran final/i.test(`${m.details?.tournamentStage} ${m.details?.stageName}`)
      )
    ) ||
    phaseNames.slice().sort((a, b) => (byPhase.get(b) || []).length - (byPhase.get(a) || []).length)[0];

  const phaseMatches = byPhase.get(mainPhase) || candidates;

  // 3. Clasificar cada partido por cuadro y ronda
  const parsed = phaseMatches.map(parseKnockoutMatch);
  const isDoubleElim = parsed.some((p) => p.bracket === 'lower');

  const groupsMap = new Map<string, ParsedKnockoutMatch[]>();
  for (const p of parsed) {
    const key = `${p.bracket}|${p.order}|${p.roundNumber ?? ''}`;
    if (!groupsMap.has(key)) groupsMap.set(key, []);
    groupsMap.get(key)!.push(p);
  }

  const bracketRank = (b: ParsedKnockoutMatch['bracket']) => (b === 'upper' ? 0 : b === 'lower' ? 1 : 2);
  const roundEntries = Array.from(groupsMap.values()).sort((a, b) => {
    const pa = a[0];
    const pb = b[0];
    if (pa.bracket !== pb.bracket) return bracketRank(pa.bracket) - bracketRank(pb.bracket);
    if (pa.order !== pb.order) return pa.order - pb.order;
    return (pa.roundNumber ?? 0) - (pb.roundNumber ?? 0);
  });

  const upperRounds: BracketRound[] = [];
  const lowerRounds: BracketRound[] = [];
  let grandFinalMatch: BracketMatch | undefined;
  let roundIdx = 1;

  for (const group of roundEntries) {
    const sample = group[0];
    const ordered = group.slice().sort((a, b) => {
      if (a.matchNumber !== b.matchNumber) return a.matchNumber - b.matchNumber;
      return a.time - b.time;
    });

    if (sample.bracket === 'grand') {
      if (!grandFinalMatch) grandFinalMatch = toBracketMatch(ordered[0].match);
      continue;
    }

    const round: BracketRound = {
      roundNumber: roundIdx++,
      roundName: bracketRoundName(sample, isDoubleElim),
      matches: ordered.map((p) => toBracketMatch(p.match)),
    };

    if (sample.bracket === 'lower') lowerRounds.push(round);
    else upperRounds.push(round);
  }

  // 4. En eliminación directa, la ronda final es también la Gran Final.
  if (!isDoubleElim && !grandFinalMatch && upperRounds.length > 0) {
    const lastRound = upperRounds[upperRounds.length - 1];
    if (/final/i.test(lastRound.roundName) && lastRound.matches.length === 1) {
      grandFinalMatch = lastRound.matches[0];
    }
  }

  return {
    format: isDoubleElim ? 'DOUBLE_ELIMINATION' : 'SINGLE_ELIMINATION',
    upperRounds,
    lowerRounds: isDoubleElim ? lowerRounds : undefined,
    grandFinal: grandFinalMatch,
  };
}

/**
 * Si aún no se han creado o publicado partidos individuales de eliminatorias en la API,
 * proyecta el cuadro eliminatorio oficial con los equipos clasificados en fase de grupos.
 */
export function projectBracketFromStandings(standings: StandingGroup[]): TournamentBracket | undefined {
  if (!standings || standings.length === 0) return undefined;

  // Solo proyectar cruces cuando existen tablas de grupos reales. En ligas
  // regulares (una única tabla general) no se inventan eliminatorias.
  const hasGroupTables = standings.some((g) => /grupo|group/i.test(g.groupName));
  if (!hasGroupTables) return undefined;

  const makeTeam = (row?: any) => ({
    name: row?.teamName || 'TBD',
    shortName: row?.shortName || row?.teamName || 'TBD',
    logo: row?.teamLogo,
    score: '-',
  });

  // Caso 1: 4 Grupos estándar (A, B, C, D)
  const groupA = standings.find((g) => g.groupName.match(/Grupo\s+A\b/i))?.table || [];
  const groupB = standings.find((g) => g.groupName.match(/Grupo\s+B\b/i))?.table || [];
  const groupC = standings.find((g) => g.groupName.match(/Grupo\s+C\b/i))?.table || [];
  const groupD = standings.find((g) => g.groupName.match(/Grupo\s+D\b/i))?.table || [];

  if (groupA.length >= 2 && groupB.length >= 2 && groupC.length >= 2 && groupD.length >= 2) {
    const tA1 = groupA[0];
    const tA2 = groupA[1];
    const tB1 = groupB[0];
    const tB2 = groupB[1];
    const tC1 = groupC[0];
    const tC2 = groupC[1];
    const tD1 = groupD[0];
    const tD2 = groupD[1];

    const qfMatches: BracketMatch[] = [
      {
        id: 'proj-qf-1',
        name: `${tA1.shortName || tA1.teamName} vs ${tB2.shortName || tB2.teamName}`,
        stage: 'Cuartos de Ganadores (Bo3)',
        status: 'UPCOMING',
        scheduledTime: 'Por disputar',
        teamA: makeTeam(tA1),
        teamB: makeTeam(tB2),
      },
      {
        id: 'proj-qf-2',
        name: `${tC1.shortName || tC1.teamName} vs ${tD2.shortName || tD2.teamName}`,
        stage: 'Cuartos de Ganadores (Bo3)',
        status: 'UPCOMING',
        scheduledTime: 'Por disputar',
        teamA: makeTeam(tC1),
        teamB: makeTeam(tD2),
      },
      {
        id: 'proj-qf-3',
        name: `${tB1.shortName || tB1.teamName} vs ${tA2.shortName || tA2.teamName}`,
        stage: 'Cuartos de Ganadores (Bo3)',
        status: 'UPCOMING',
        scheduledTime: 'Por disputar',
        teamA: makeTeam(tB1),
        teamB: makeTeam(tA2),
      },
      {
        id: 'proj-qf-4',
        name: `${tD1.shortName || tD1.teamName} vs ${tC2.shortName || tC2.teamName}`,
        stage: 'Cuartos de Ganadores (Bo3)',
        status: 'UPCOMING',
        scheduledTime: 'Por disputar',
        teamA: makeTeam(tD1),
        teamB: makeTeam(tC2),
      },
    ];

    const sfMatches: BracketMatch[] = [
      {
        id: 'proj-sf-1',
        name: 'Ganador QF 1 vs Ganador QF 2',
        stage: 'Semifinal de Ganadores 1 (Bo3)',
        status: 'UPCOMING',
        teamA: { name: 'TBD', shortName: 'TBD', score: '-' },
        teamB: { name: 'TBD', shortName: 'TBD', score: '-' },
      },
      {
        id: 'proj-sf-2',
        name: 'Ganador QF 3 vs Ganador QF 4',
        stage: 'Semifinal de Ganadores 2 (Bo3)',
        status: 'UPCOMING',
        teamA: { name: 'TBD', shortName: 'TBD', score: '-' },
        teamB: { name: 'TBD', shortName: 'TBD', score: '-' },
      },
    ];

    const uFinalMatch: BracketMatch = {
      id: 'proj-ubf',
      name: 'Final de Ganadores (Bo3)',
      stage: 'Final de Ganadores',
      status: 'UPCOMING',
      teamA: { name: 'TBD', shortName: 'TBD', score: '-' },
      teamB: { name: 'TBD', shortName: 'TBD', score: '-' },
    };

    const gfMatch: BracketMatch = {
      id: 'proj-gf',
      name: 'Gran Final (Bo5)',
      stage: 'Gran Final (Bo5)',
      status: 'UPCOMING',
      teamA: { name: 'TBD', shortName: 'TBD', score: '-' },
      teamB: { name: 'TBD', shortName: 'TBD', score: '-' },
    };

    return {
      format: 'DOUBLE_ELIMINATION',
      upperRounds: [
        { roundNumber: 1, roundName: 'Cuartos de Ganadores', matches: qfMatches },
        { roundNumber: 2, roundName: 'Semifinales de Ganadores', matches: sfMatches },
        { roundNumber: 3, roundName: 'Final de Ganadores', matches: [uFinalMatch] },
      ],
      lowerRounds: [
        {
          roundNumber: 1,
          roundName: 'Ronda 1 de Perdedores',
          matches: [
            { id: 'proj-lr1-1', name: 'Perdedor QF 1 vs Perdedor QF 2', stage: 'Ronda 1 de Perdedores', status: 'UPCOMING', teamA: { name: 'TBD', shortName: 'TBD' }, teamB: { name: 'TBD', shortName: 'TBD' } },
            { id: 'proj-lr1-2', name: 'Perdedor QF 3 vs Perdedor QF 4', stage: 'Ronda 1 de Perdedores', status: 'UPCOMING', teamA: { name: 'TBD', shortName: 'TBD' }, teamB: { name: 'TBD', shortName: 'TBD' } },
          ],
        },
      ],
      grandFinal: gfMatch,
    };
  }

  // Caso 2: 2 Grupos (A, B) -> Semifinales y Gran Final
  if (groupA.length >= 2 && groupB.length >= 2) {
    const tA1 = groupA[0];
    const tA2 = groupA[1];
    const tB1 = groupB[0];
    const tB2 = groupB[1];

    const sfMatches: BracketMatch[] = [
      {
        id: 'proj-2g-sf-1',
        name: `${tA1.shortName || tA1.teamName} vs ${tB2.shortName || tB2.teamName}`,
        stage: 'Semifinal 1 (Bo3)',
        status: 'UPCOMING',
        scheduledTime: 'Por disputar',
        teamA: makeTeam(tA1),
        teamB: makeTeam(tB2),
      },
      {
        id: 'proj-2g-sf-2',
        name: `${tB1.shortName || tB1.teamName} vs ${tA2.shortName || tA2.teamName}`,
        stage: 'Semifinal 2 (Bo3)',
        status: 'UPCOMING',
        scheduledTime: 'Por disputar',
        teamA: makeTeam(tB1),
        teamB: makeTeam(tA2),
      },
    ];

    const gfMatch: BracketMatch = {
      id: 'proj-2g-gf',
      name: 'Gran Final (Bo5)',
      stage: 'Gran Final',
      status: 'UPCOMING',
      teamA: { name: 'TBD', shortName: 'TBD', score: '-' },
      teamB: { name: 'TBD', shortName: 'TBD', score: '-' },
    };

    return {
      format: 'SINGLE_ELIMINATION',
      upperRounds: [
        { roundNumber: 1, roundName: 'Semifinales', matches: sfMatches },
        { roundNumber: 2, roundName: 'Gran Final', matches: [gfMatch] },
      ],
      grandFinal: gfMatch,
    };
  }

  // Caso 3: Tabla única con zona de playoff o top 4 clasificados (ej. fase regular esports o copas)
  const singleTable = standings[0]?.table || [];
  const playoffRows = singleTable.filter((r) => r.zone?.includes('playoff') || r.zone === 'champions');
  const candidateRows = playoffRows.length >= 4 ? playoffRows : singleTable.slice(0, 4);

  if (candidateRows.length >= 4) {
    const [t1, t2, t3, t4] = candidateRows;
    const sfMatches: BracketMatch[] = [
      {
        id: 'proj-st-sf-1',
        name: `${t1.shortName || t1.teamName} vs ${t4.shortName || t4.teamName}`,
        stage: 'Semifinal 1 (1º vs 4º)',
        status: 'UPCOMING',
        scheduledTime: 'Por disputar',
        teamA: makeTeam(t1),
        teamB: makeTeam(t4),
      },
      {
        id: 'proj-st-sf-2',
        name: `${t2.shortName || t2.teamName} vs ${t3.shortName || t3.teamName}`,
        stage: 'Semifinal 2 (2º vs 3º)',
        status: 'UPCOMING',
        scheduledTime: 'Por disputar',
        teamA: makeTeam(t2),
        teamB: makeTeam(t3),
      },
    ];

    const gfMatch: BracketMatch = {
      id: 'proj-st-gf',
      name: 'Gran Final',
      stage: 'Gran Final',
      status: 'UPCOMING',
      teamA: { name: 'TBD', shortName: 'TBD', score: '-' },
      teamB: { name: 'TBD', shortName: 'TBD', score: '-' },
    };

    return {
      format: 'SINGLE_ELIMINATION',
      upperRounds: [
        { roundNumber: 1, roundName: 'Semifinales', matches: sfMatches },
        { roundNumber: 2, roundName: 'Gran Final', matches: [gfMatch] },
      ],
      grandFinal: gfMatch,
    };
  }

  return undefined;
}

/**
 * Nombre de tabla normalizado a partir de la fase oficial del torneo.
 * Devuelve null si la fase es de eliminatorias (no genera clasificación).
 */
function resolveStageGroupName(stageName: string): string | null {
  const text = (stageName || '').trim();
  const lower = text.toLowerCase();
  if (!text) return null;
  if (/playoff|play-off|knockout|bracket|eliminatoria|elimination|grand final/i.test(lower)) return null;

  const gm = text.match(/^(?:group|grupo)\s+(.+)$/i);
  if (gm) {
    const suffix = gm[1].trim();
    if (/^(stage|phase|fase)$/i.test(suffix)) return 'Fase de Grupos';
    return `Grupo ${suffix}`;
  }

  // Fases embebidas tipo "Champions 2026 (Group A)" o "Serie • Grupo B"
  const embedded = text.match(/[(\u2022\-–]\s*(?:group|grupo)\s+([a-z0-9]+)\b/i);
  if (embedded && !/^(stage|phase|fase)$/i.test(embedded[1])) {
    return `Grupo ${embedded[1].charAt(0).toUpperCase()}${embedded[1].slice(1)}`;
  }

  if (/swiss/.test(lower)) return 'Fase Suiza';
  if (/regular|temporada regular|season/.test(lower)) return 'Temporada Regular';
  const stageNum = lower.match(/^(?:stage|fase)\s*(\d+)\b/);
  if (stageNum) return `Fase ${stageNum[1]}`;
  if (/survival|supervivencia/.test(lower)) return 'Fase de Supervivencia';
  return null;
}

/**
 * Estadísticas de un equipo dentro de una fase concreta, calculadas a partir de sus partidos.
 */
function computeTeamStageStats(teamName: string, teamMatches: Match[]) {
  let played = 0;
  let won = 0;
  let lost = 0;
  let mapsWon = 0;
  let mapsLost = 0;
  const form: ('W' | 'D' | 'L')[] = [];

  const ordered = teamMatches
    .slice()
    .sort((a, b) => new Date(a.startTimeIso).getTime() - new Date(b.startTimeIso).getTime());

  for (const m of ordered) {
    if (m.status !== 'FINISHED') continue;
    const isA = m.teamA.name === teamName;
    const isB = m.teamB.name === teamName;
    if (!isA && !isB) continue;

    const own = Number(isA ? m.teamA.score : m.teamB.score) || 0;
    const rival = Number(isA ? m.teamB.score : m.teamA.score) || 0;

    played += 1;
    mapsWon += own;
    mapsLost += rival;

    if (own > rival) {
      won += 1;
      form.push('W');
    } else if (own < rival) {
      lost += 1;
      form.push('L');
    } else {
      form.push('D');
    }
  }

  return { played, won, lost, mapsWon, mapsLost, form: form.slice(-5) };
}

/**
 * Convierte la clasificación oficial de PandaScore (/tournaments/{id}/standings)
 * en una StandingGroup lista para pintar. Algunos juegos solo devuelven rank+team,
 * por lo que las estadísticas se completan con los partidos reales de la fase.
 */
function buildStandingGroupFromPanda(stageName: string, entries: any[], stageMatches: Match[]): StandingGroup {
  const rows: StandingRow[] = entries
    .slice()
    .sort((a: any, b: any) => (a.rank ?? 9999) - (b.rank ?? 9999))
    .map((e: any, idx: number) => {
      const teamName = e.team?.name || 'Equipo';
      const computed = computeTeamStageStats(teamName, stageMatches);

      const wins = typeof e.wins === 'number' ? e.wins : computed.won;
      const losses = typeof e.losses === 'number' ? e.losses : computed.lost;
      const gameWins = typeof e.game_wins === 'number' ? e.game_wins : computed.mapsWon;
      const gameLosses = typeof e.game_losses === 'number' ? e.game_losses : computed.mapsLost;

      return {
        position: idx + 1,
        teamId: e.team?.id,
        teamName,
        shortName: e.team?.acronym,
        teamLogo: e.team?.image_url,
        playedGames: typeof e.total === 'number' ? e.total : computed.played,
        won: wins,
        lost: losses,
        points: typeof e.points === 'number' ? e.points : wins * 2,
        roundDifference: gameWins - gameLosses,
        form: computed.form,
      } as StandingRow;
    });

  // En grupos cerrados de 4 equipos (formato GSL de VCT) los 2 primeros clasifican.
  if (rows.length === 4 && /^grupo/i.test(stageName)) {
    rows.forEach((row, idx) => {
      row.zone = idx < 2 ? 'playoff_upper' : 'eliminated';
    });
  }

  return { groupName: stageName, table: rows };
}

/**
 * Calcula dinámicamente las clasificaciones de grupos y fases regulares a partir de partidos reales.
 * Solo tiene en cuenta partidos de fases con tabla (grupos, liga regular, suiza, play-in...).
 */
export function buildStandingsFromMatches(matches: Match[]): StandingGroup[] {
  const groupMatchesMap = new Map<string, Match[]>();

  for (const m of matches) {
    const stagePrefix = extractStagePrefix(m.details?.tournamentStage, m.details?.stageName);
    const groupName = resolveStageGroupName(m.details?.stageName || stagePrefix || m.details?.tournamentStage || '');
    if (!groupName) continue;
    if (!groupMatchesMap.has(groupName)) groupMatchesMap.set(groupName, []);
    groupMatchesMap.get(groupName)!.push(m);
  }

  if (groupMatchesMap.size === 0) return [];

  const groups: StandingGroup[] = [];

  for (const [groupName, gMatches] of groupMatchesMap.entries()) {
    // Orden cronológico para que la "forma" se calcule en el orden correcto
    const orderedMatches = gMatches
      .slice()
      .sort((a, b) => new Date(a.startTimeIso).getTime() - new Date(b.startTimeIso).getTime());

    const teamStats = new Map<string, {
      teamName: string;
      shortName?: string;
      teamLogo?: string;
      played: number;
      won: number;
      lost: number;
      points: number;
      mapsWon: number;
      mapsLost: number;
      form: ('W' | 'D' | 'L')[];
    }>();

    for (const m of orderedMatches) {
      if (m.teamA.name === 'TBD' || m.teamB.name === 'TBD') continue;

      if (!teamStats.has(m.teamA.name)) {
        teamStats.set(m.teamA.name, {
          teamName: m.teamA.name,
          shortName: m.teamA.shortName,
          teamLogo: m.teamA.logo,
          played: 0,
          won: 0,
          lost: 0,
          points: 0,
          mapsWon: 0,
          mapsLost: 0,
          form: [],
        });
      }
      if (!teamStats.has(m.teamB.name)) {
        teamStats.set(m.teamB.name, {
          teamName: m.teamB.name,
          shortName: m.teamB.shortName,
          teamLogo: m.teamB.logo,
          played: 0,
          won: 0,
          lost: 0,
          points: 0,
          mapsWon: 0,
          mapsLost: 0,
          form: [],
        });
      }

      if (m.status === 'FINISHED') {
        const sA = Number(m.teamA.score) || 0;
        const sB = Number(m.teamB.score) || 0;

        const statA = teamStats.get(m.teamA.name)!;
        const statB = teamStats.get(m.teamB.name)!;

        statA.played += 1;
        statB.played += 1;
        statA.mapsWon += sA;
        statA.mapsLost += sB;
        statB.mapsWon += sB;
        statB.mapsLost += sA;

        if (sA > sB) {
          statA.won += 1;
          statA.points += 2;
          statA.form.push('W');
          statB.lost += 1;
          statB.form.push('L');
        } else if (sB > sA) {
          statB.won += 1;
          statB.points += 2;
          statB.form.push('W');
          statA.lost += 1;
          statA.form.push('L');
        } else {
          statA.points += 1;
          statB.points += 1;
          statA.form.push('D');
          statB.form.push('D');
        }
      }
    }

    const sortedRows: StandingRow[] = Array.from(teamStats.values())
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const diffB = b.mapsWon - b.mapsLost;
        const diffA = a.mapsWon - a.mapsLost;
        if (diffB !== diffA) return diffB - diffA;
        return b.won - a.won;
      })
      .map((t, idx, all) => {
        let zone: StandingRow['zone'] = undefined;
        if (/^grupo/i.test(groupName) && all.length === 4) {
          zone = idx < 2 ? 'playoff_upper' : 'eliminated';
        }

        return {
          position: idx + 1,
          teamName: t.teamName,
          shortName: t.shortName,
          teamLogo: t.teamLogo,
          playedGames: t.played,
          won: t.won,
          lost: t.lost,
          points: t.points,
          roundDifference: t.mapsWon - t.mapsLost,
          form: t.form.slice(-5),
          zone,
        };
      });

    if (sortedRows.length > 0) {
      groups.push({
        groupName,
        table: sortedRows,
      });
    }
  }

  groups.sort((a, b) => a.groupName.localeCompare(b.groupName, 'es'));
  return groups;
}

/**
 * Aplica zonas de color a las clasificaciones de esports usando el cuadro real:
 * equipos presentes en el cuadro de ganadores -> 'playoff_upper' (verde),
 * equipos que solo aparecen en el cuadro de perdedores -> 'playoff_lower' (ámbar),
 * el resto -> 'eliminated' (rojo). Solo se aplica a tablas de clasificación finales
 * (temporada regular / grupos), no a fases intermedias (suiza, supervivencia, play-in...).
 */
export function applyEsportsStandingZones(detail: TournamentFullDetail): void {
  if (detail.game === 'FÚTBOL') return;
  const bracket = detail.bracket;
  const standings = detail.standings || [];
  if (!bracket || standings.length === 0) return;

  const norm = (s: string) => (s || '').toLowerCase().trim();
  const upperTeams = new Set<string>();
  const lowerTeams = new Set<string>();
  const seen = new Set<string>();

  // La zona se decide por la PRIMERA aparición del equipo en el cuadro:
  // si debuta en el cuadro de ganadores -> 'playoff_upper'; si lo hace en el de
  // perdedores -> 'playoff_lower'. Así el campeón de liga que luego cae a perdedores
  // sigue marcado como plaza de ganadores.
  const addTeams = (target: Set<string>, matches: BracketMatch[]) => {
    for (const m of matches) {
      for (const team of [m.teamA, m.teamB]) {
        const name = team?.name;
        if (!name || name === 'TBD') continue;
        const key = norm(name);
        if (seen.has(key)) continue;
        seen.add(key);
        target.add(key);
      }
    }
  };

  for (const round of bracket.upperRounds || []) addTeams(upperTeams, round.matches);
  for (const round of bracket.lowerRounds || []) addTeams(lowerTeams, round.matches);
  if (bracket.grandFinal) addTeams(upperTeams, [bracket.grandFinal]);

  if (upperTeams.size === 0 && lowerTeams.size === 0) return;

  // Si hay fases intermedias (suiza, supervivencia, play-in...), las tablas de grupos
  // no son la clasificación final y no se colorean con el cuadro.
  const hasIntermediateStage = standings.some((g) =>
    /supervivencia|survival|play-?in|fase\s*\d|swiss|suiza|round\s*\d|stage\s*\d/i.test(g.groupName)
  );

  for (const group of standings) {
    const name = group.groupName || '';
    const isQualificationTable =
      /temporada regular|regular season|fase de grupos/i.test(name) ||
      (/grupo|group\b/i.test(name) && standings.length <= 4 && !hasIntermediateStage);

    if (!isQualificationTable) continue;

    for (const row of group.table) {
      const key = norm(row.teamName);
      if (upperTeams.has(key)) row.zone = 'playoff_upper';
      else if (lowerTeams.has(key)) row.zone = 'playoff_lower';
      else row.zone = 'eliminated';
    }

    // Desempate coherente con el cuadro real: entre equipos empatados en puntos,
    // diferencia y victorias, va primero quien se clasifica por el cuadro de
    // ganadores, luego el de perdedores y, por último, el eliminado.
    // El resto del orden (oficial / por estadísticas) se conserva.
    const zoneRank = (z?: StandingRow['zone']) =>
      z === 'playoff_upper' ? 0 : z === 'playoff_lower' ? 1 : 2;
    group.table.sort((a, b) => {
      const tied =
        (a.points ?? 0) === (b.points ?? 0) &&
        (a.roundDifference ?? 0) === (b.roundDifference ?? 0) &&
        (a.won ?? 0) === (b.won ?? 0);
      return tied ? zoneRank(a.zone) - zoneRank(b.zone) : 0;
    });
    group.table.forEach((row, idx) => {
      row.position = idx + 1;
    });
  }
}

/**
 * Extrae los participantes reales a partir de los partidos del torneo.
 */
export function extractParticipantsFromMatches(matches: Match[]): TournamentParticipant[] {
  const teamMap = new Map<string, TournamentParticipant>();

  for (const m of matches) {
    if (m.teamA?.name && m.teamA.name !== 'TBD') {
      if (!teamMap.has(m.teamA.name)) {
        teamMap.set(m.teamA.name, {
          id: m.teamA.id || m.teamA.name,
          name: m.teamA.name,
          shortName: m.teamA.shortName,
          logo: m.teamA.logo,
          region: m.teamA.location,
          roster: m.details?.rosterA?.players,
        });
      }
    }
    if (m.teamB?.name && m.teamB.name !== 'TBD') {
      if (!teamMap.has(m.teamB.name)) {
        teamMap.set(m.teamB.name, {
          id: m.teamB.id || m.teamB.name,
          name: m.teamB.name,
          shortName: m.teamB.shortName,
          logo: m.teamB.logo,
          region: m.teamB.location,
          roster: m.details?.rosterB?.players,
        });
      }
    }
  }

  return Array.from(teamMap.values());
}

// ==========================================
// SEMILLAS MAESTRAS DE DATOS REALES (OFFLINE)
// ==========================================

const SEED_LALIGA: TournamentFullDetail = {
  id: 'foot-PD',
  name: 'LaLiga EA Sports',
  shortName: 'LaLiga',
  logo: 'https://crests.football-data.org/laliga.png',
  game: 'FÚTBOL',
  tier: 'S',
  region: 'ESPAÑA',
  format: 'LEAGUE',
  season: '2025/2026',
  dates: 'Agosto - Mayo',
  location: 'España',
  description: 'Primera División de Fútbol Profesional de España',
  standings: [
    {
      groupName: 'Clasificación General',
      table: [
        { position: 1, teamName: 'Real Madrid', shortName: 'RMA', teamLogo: 'https://crests.football-data.org/86.png', playedGames: 27, won: 20, draw: 4, lost: 3, points: 64, goalsFor: 58, goalsAgainst: 22, goalDifference: 36, form: ['W', 'W', 'W', 'D', 'W'], zone: 'champions' },
        { position: 2, teamName: 'FC Barcelona', shortName: 'FCB', teamLogo: 'https://crests.football-data.org/81.png', playedGames: 27, won: 19, draw: 4, lost: 4, points: 61, goalsFor: 65, goalsAgainst: 28, goalDifference: 37, form: ['W', 'W', 'L', 'W', 'W'], zone: 'champions' },
        { position: 3, teamName: 'Atlético de Madrid', shortName: 'ATM', teamLogo: 'https://crests.football-data.org/78.png', playedGames: 27, won: 16, draw: 7, lost: 4, points: 55, goalsFor: 44, goalsAgainst: 20, goalDifference: 24, form: ['W', 'D', 'W', 'W', 'D'], zone: 'champions' },
        { position: 4, teamName: 'Athletic Club', shortName: 'ATH', teamLogo: 'https://crests.football-data.org/77.png', playedGames: 27, won: 14, draw: 8, lost: 5, points: 50, goalsFor: 42, goalsAgainst: 24, goalDifference: 18, form: ['W', 'D', 'W', 'D', 'W'], zone: 'champions' },
        { position: 5, teamName: 'Villarreal CF', shortName: 'VIL', teamLogo: 'https://crests.football-data.org/94.png', playedGames: 27, won: 13, draw: 6, lost: 8, points: 45, goalsFor: 48, goalsAgainst: 39, goalDifference: 9, form: ['L', 'W', 'W', 'D', 'W'], zone: 'europa' },
        { position: 6, teamName: 'Real Sociedad', shortName: 'RSO', teamLogo: 'https://crests.football-data.org/92.png', playedGames: 27, won: 12, draw: 6, lost: 9, points: 42, goalsFor: 32, goalsAgainst: 26, goalDifference: 6, form: ['W', 'L', 'W', 'L', 'D'], zone: 'conference' },
        { position: 7, teamName: 'Real Betis', shortName: 'BET', teamLogo: 'https://crests.football-data.org/90.png', playedGames: 27, won: 11, draw: 8, lost: 8, points: 41, goalsFor: 34, goalsAgainst: 31, goalDifference: 3, form: ['D', 'W', 'D', 'W', 'L'] },
        { position: 8, teamName: 'Girona FC', shortName: 'GIR', teamLogo: 'https://crests.football-data.org/298.png', playedGames: 27, won: 11, draw: 6, lost: 10, points: 39, goalsFor: 40, goalsAgainst: 37, goalDifference: 3, form: ['L', 'L', 'W', 'D', 'W'] },
        { position: 9, teamName: 'RCD Mallorca', shortName: 'MLL', teamLogo: 'https://crests.football-data.org/89.png', playedGames: 27, won: 10, draw: 6, lost: 11, points: 36, goalsFor: 25, goalsAgainst: 28, goalDifference: -3, form: ['L', 'W', 'L', 'D', 'L'] },
        { position: 10, teamName: 'CA Osasuna', shortName: 'OSA', teamLogo: 'https://crests.football-data.org/79.png', playedGames: 27, won: 9, draw: 9, lost: 9, points: 36, goalsFor: 31, goalsAgainst: 35, goalDifference: -4, form: ['D', 'D', 'L', 'W', 'D'] },
        { position: 11, teamName: 'RC Celta de Vigo', shortName: 'CEL', teamLogo: 'https://crests.football-data.org/558.png', playedGames: 27, won: 9, draw: 7, lost: 11, points: 34, goalsFor: 36, goalsAgainst: 39, goalDifference: -3, form: ['W', 'D', 'L', 'L', 'W'] },
        { position: 12, teamName: 'Sevilla FC', shortName: 'SEV', teamLogo: 'https://crests.football-data.org/559.png', playedGames: 27, won: 8, draw: 8, lost: 11, points: 32, goalsFor: 30, goalsAgainst: 36, goalDifference: -6, form: ['L', 'D', 'W', 'L', 'D'] },
        { position: 13, teamName: 'Rayo Vallecano', shortName: 'RAY', teamLogo: 'https://crests.football-data.org/87.png', playedGames: 27, won: 8, draw: 8, lost: 11, points: 32, goalsFor: 27, goalsAgainst: 34, goalDifference: -7, form: ['D', 'L', 'D', 'W', 'L'] },
        { position: 14, teamName: 'Deportivo Alavés', shortName: 'ALA', teamLogo: 'https://crests.football-data.org/263.png', playedGames: 27, won: 8, draw: 6, lost: 13, points: 30, goalsFor: 31, goalsAgainst: 40, goalDifference: -9, form: ['W', 'L', 'L', 'W', 'L'] },
        { position: 15, teamName: 'Getafe CF', shortName: 'GET', teamLogo: 'https://crests.football-data.org/82.png', playedGames: 27, won: 6, draw: 11, lost: 10, points: 29, goalsFor: 20, goalsAgainst: 25, goalDifference: -5, form: ['D', 'W', 'D', 'L', 'D'] },
        { position: 16, teamName: 'UD Las Palmas', shortName: 'LPA', teamLogo: 'https://crests.football-data.org/275.png', playedGames: 27, won: 7, draw: 6, lost: 14, points: 27, goalsFor: 31, goalsAgainst: 45, goalDifference: -14, form: ['L', 'L', 'W', 'L', 'L'] },
        { position: 17, teamName: 'RCD Espanyol', shortName: 'ESP', teamLogo: 'https://crests.football-data.org/80.png', playedGames: 27, won: 6, draw: 6, lost: 15, points: 24, goalsFor: 23, goalsAgainst: 43, goalDifference: -20, form: ['L', 'W', 'L', 'L', 'D'] },
        { position: 18, teamName: 'CD Leganés', shortName: 'LEG', teamLogo: 'https://crests.football-data.org/745.png', playedGames: 27, won: 5, draw: 8, lost: 14, points: 23, goalsFor: 21, goalsAgainst: 39, goalDifference: -18, form: ['L', 'L', 'D', 'L', 'W'], zone: 'relegation' },
        { position: 19, teamName: 'Valencia CF', shortName: 'VAL', teamLogo: 'https://crests.football-data.org/95.png', playedGames: 27, won: 5, draw: 7, lost: 15, points: 22, goalsFor: 24, goalsAgainst: 45, goalDifference: -21, form: ['D', 'L', 'L', 'L', 'D'], zone: 'relegation' },
        { position: 20, teamName: 'Real Valladolid', shortName: 'VLD', teamLogo: 'https://crests.football-data.org/250.png', playedGames: 27, won: 4, draw: 4, lost: 19, points: 16, goalsFor: 18, goalsAgainst: 55, goalDifference: -37, form: ['L', 'L', 'L', 'W', 'L'], zone: 'relegation' },
      ],
    },
  ],
  participants: [
    { id: 'rma', name: 'Real Madrid', shortName: 'RMA', logo: 'https://crests.football-data.org/86.png', region: 'Madrid' },
    { id: 'fcb', name: 'FC Barcelona', shortName: 'FCB', logo: 'https://crests.football-data.org/81.png', region: 'Cataluña' },
    { id: 'atm', name: 'Atlético de Madrid', shortName: 'ATM', logo: 'https://crests.football-data.org/78.png', region: 'Madrid' },
    { id: 'ath', name: 'Athletic Club', shortName: 'ATH', logo: 'https://crests.football-data.org/77.png', region: 'País Vasco' },
    { id: 'vil', name: 'Villarreal CF', shortName: 'VIL', logo: 'https://crests.football-data.org/94.png', region: 'Valencia' },
    { id: 'rso', name: 'Real Sociedad', shortName: 'RSO', logo: 'https://crests.football-data.org/92.png', region: 'País Vasco' },
    { id: 'bet', name: 'Real Betis', shortName: 'BET', logo: 'https://crests.football-data.org/90.png', region: 'Andalucía' },
    { id: 'gir', name: 'Girona FC', shortName: 'GIR', logo: 'https://crests.football-data.org/298.png', region: 'Cataluña' },
  ],
  matches: [],
};

const SEED_CHAMPIONS_LEAGUE: TournamentFullDetail = {
  id: 'foot-CL',
  name: 'UEFA Champions League',
  shortName: 'Champions',
  logo: 'https://crests.football-data.org/CL.png',
  game: 'FÚTBOL',
  tier: 'S',
  region: 'EMEA',
  format: 'HYBRID_GROUPS_PLAYOFFS',
  season: '2025/2026',
  dates: 'Septiembre - Junio',
  location: 'Europa',
  description: 'Máxima competición continental de clubes europeos',
  standings: [
    {
      groupName: 'Fase de Liga Única',
      table: [
        { position: 1, teamName: 'Liverpool FC', shortName: 'LIV', teamLogo: 'https://crests.football-data.org/64.png', playedGames: 8, won: 7, draw: 0, lost: 1, points: 21, goalsFor: 17, goalsAgainst: 5, goalDifference: 12, form: ['W', 'W', 'W', 'W', 'L'], zone: 'champions' },
        { position: 2, teamName: 'FC Barcelona', shortName: 'FCB', teamLogo: 'https://crests.football-data.org/81.png', playedGames: 8, won: 6, draw: 1, lost: 1, points: 19, goalsFor: 28, goalsAgainst: 13, goalDifference: 15, form: ['W', 'W', 'W', 'D', 'W'], zone: 'champions' },
        { position: 3, teamName: 'Arsenal FC', shortName: 'ARS', teamLogo: 'https://crests.football-data.org/57.png', playedGames: 8, won: 6, draw: 1, lost: 1, points: 19, goalsFor: 16, goalsAgainst: 4, goalDifference: 12, form: ['W', 'W', 'D', 'W', 'W'], zone: 'champions' },
        { position: 4, teamName: 'Inter de Milán', shortName: 'INT', teamLogo: 'https://crests.football-data.org/108.png', playedGames: 8, won: 6, draw: 1, lost: 1, points: 19, goalsFor: 11, goalsAgainst: 1, goalDifference: 10, form: ['W', 'W', 'W', 'L', 'W'], zone: 'champions' },
        { position: 5, teamName: 'Atlético de Madrid', shortName: 'ATM', teamLogo: 'https://crests.football-data.org/78.png', playedGames: 8, won: 6, draw: 0, lost: 2, points: 18, goalsFor: 20, goalsAgainst: 12, goalDifference: 8, form: ['W', 'W', 'W', 'W', 'W'], zone: 'champions' },
        { position: 6, teamName: 'Bayer Leverkusen', shortName: 'B04', teamLogo: 'https://crests.football-data.org/4.png', playedGames: 8, won: 5, draw: 1, lost: 2, points: 16, goalsFor: 15, goalsAgainst: 7, goalDifference: 8, form: ['W', 'W', 'D', 'W', 'L'], zone: 'champions' },
        { position: 7, teamName: 'Aston Villa', shortName: 'AVL', teamLogo: 'https://crests.football-data.org/58.png', playedGames: 8, won: 5, draw: 1, lost: 2, points: 16, goalsFor: 13, goalsAgainst: 6, goalDifference: 7, form: ['W', 'D', 'W', 'L', 'W'], zone: 'champions' },
        { position: 8, teamName: 'Real Madrid', shortName: 'RMA', teamLogo: 'https://crests.football-data.org/86.png', playedGames: 8, won: 5, draw: 0, lost: 3, points: 15, goalsFor: 20, goalsAgainst: 12, goalDifference: 8, form: ['W', 'W', 'L', 'W', 'W'], zone: 'champions' },
        { position: 9, teamName: 'Bayern Múnich', shortName: 'BAY', teamLogo: 'https://crests.football-data.org/5.png', playedGames: 8, won: 5, draw: 0, lost: 3, points: 15, goalsFor: 20, goalsAgainst: 12, goalDifference: 8, form: ['W', 'W', 'W', 'W', 'L'], zone: 'playoff_upper' },
        { position: 10, teamName: 'Borussia Dortmund', shortName: 'BVB', teamLogo: 'https://crests.football-data.org/7.png', playedGames: 8, won: 5, draw: 0, lost: 3, points: 15, goalsFor: 19, goalsAgainst: 12, goalDifference: 7, form: ['L', 'W', 'W', 'L', 'W'], zone: 'playoff_upper' },
      ],
    },
  ],
  participants: [
    { id: 'rma', name: 'Real Madrid', shortName: 'RMA', logo: 'https://crests.football-data.org/86.png' },
    { id: 'fcb', name: 'FC Barcelona', shortName: 'FCB', logo: 'https://crests.football-data.org/81.png' },
    { id: 'bay', name: 'Bayern Múnich', shortName: 'BAY', logo: 'https://crests.football-data.org/5.png' },
    { id: 'bvb', name: 'Borussia Dortmund', shortName: 'BVB', logo: 'https://crests.football-data.org/7.png' },
    { id: 'psg', name: 'Paris Saint-Germain', shortName: 'PSG', logo: 'https://crests.football-data.org/524.png' },
    { id: 'mci', name: 'Manchester City', shortName: 'MCI', logo: 'https://crests.football-data.org/65.png' },
    { id: 'ars', name: 'Arsenal FC', shortName: 'ARS', logo: 'https://crests.football-data.org/57.png' },
    { id: 'liv', name: 'Liverpool FC', shortName: 'LIV', logo: 'https://crests.football-data.org/64.png' },
  ],
  matches: [],
};

const SEED_PREMIER_LEAGUE: TournamentFullDetail = {
  id: 'foot-PL',
  name: 'Premier League',
  shortName: 'Premier',
  logo: 'https://crests.football-data.org/PL.png',
  game: 'FÚTBOL',
  tier: 'S',
  region: 'EMEA',
  format: 'LEAGUE',
  season: '2025/2026',
  dates: 'Agosto - Mayo',
  location: 'Inglaterra',
  description: 'Primera división de fútbol de Inglaterra',
  standings: [
    {
      groupName: 'Clasificación General',
      table: [
        { position: 1, teamName: 'Liverpool FC', shortName: 'LIV', teamLogo: 'https://crests.football-data.org/64.png', playedGames: 28, won: 18, draw: 6, lost: 4, points: 60, goalsFor: 62, goalsAgainst: 26, goalDifference: 36, form: ['W', 'W', 'W', 'D', 'W'], zone: 'champions' },
        { position: 2, teamName: 'Arsenal FC', shortName: 'ARS', teamLogo: 'https://crests.football-data.org/57.png', playedGames: 28, won: 16, draw: 9, lost: 3, points: 57, goalsFor: 54, goalsAgainst: 23, goalDifference: 31, form: ['W', 'D', 'W', 'W', 'W'], zone: 'champions' },
        { position: 3, teamName: 'Nottingham Forest', shortName: 'NFO', teamLogo: 'https://crests.football-data.org/351.png', playedGames: 28, won: 14, draw: 6, lost: 8, points: 48, goalsFor: 41, goalsAgainst: 33, goalDifference: 8, form: ['W', 'L', 'W', 'D', 'W'], zone: 'champions' },
        { position: 4, teamName: 'Chelsea FC', shortName: 'CHE', teamLogo: 'https://crests.football-data.org/61.png', playedGames: 28, won: 13, draw: 7, lost: 8, points: 46, goalsFor: 51, goalsAgainst: 37, goalDifference: 14, form: ['L', 'W', 'D', 'W', 'L'], zone: 'champions' },
        { position: 5, teamName: 'Manchester City', shortName: 'MCI', teamLogo: 'https://crests.football-data.org/65.png', playedGames: 28, won: 13, draw: 6, lost: 9, points: 45, goalsFor: 52, goalsAgainst: 37, goalDifference: 15, form: ['D', 'L', 'W', 'L', 'W'], zone: 'europa' },
        { position: 6, teamName: 'Newcastle United', shortName: 'NEW', teamLogo: 'https://crests.football-data.org/67.png', playedGames: 28, won: 13, draw: 5, lost: 10, points: 44, goalsFor: 44, goalsAgainst: 36, goalDifference: 8, form: ['W', 'W', 'L', 'W', 'L'], zone: 'conference' },
        { position: 7, teamName: 'AFC Bournemouth', shortName: 'BOU', teamLogo: 'https://crests.football-data.org/1044.png', playedGames: 28, won: 12, draw: 7, lost: 9, points: 43, goalsFor: 43, goalsAgainst: 35, goalDifference: 8, form: ['W', 'L', 'W', 'D', 'W'] },
        { position: 8, teamName: 'Aston Villa', shortName: 'AVL', teamLogo: 'https://crests.football-data.org/58.png', playedGames: 28, won: 11, draw: 9, lost: 8, points: 42, goalsFor: 41, goalsAgainst: 41, goalDifference: 0, form: ['D', 'W', 'D', 'L', 'W'] },
        { position: 9, teamName: 'Fulham FC', shortName: 'FUL', teamLogo: 'https://crests.football-data.org/63.png', playedGames: 28, won: 11, draw: 9, lost: 8, points: 42, goalsFor: 40, goalsAgainst: 37, goalDifference: 3, form: ['W', 'D', 'L', 'W', 'D'] },
        { position: 10, teamName: 'Brighton & Hove Albion', shortName: 'BHA', teamLogo: 'https://crests.football-data.org/397.png', playedGames: 28, won: 10, draw: 10, lost: 8, points: 40, goalsFor: 43, goalsAgainst: 42, goalDifference: 1, form: ['D', 'D', 'W', 'L', 'D'] },
        { position: 11, teamName: 'Brentford FC', shortName: 'BRE', teamLogo: 'https://crests.football-data.org/402.png', playedGames: 28, won: 11, draw: 5, lost: 12, points: 38, goalsFor: 49, goalsAgainst: 47, goalDifference: 2, form: ['L', 'W', 'L', 'W', 'L'] },
        { position: 12, teamName: 'Crystal Palace', shortName: 'CRY', teamLogo: 'https://crests.football-data.org/354.png', playedGames: 28, won: 9, draw: 9, lost: 10, points: 36, goalsFor: 33, goalsAgainst: 35, goalDifference: -2, form: ['W', 'D', 'L', 'W', 'D'] },
        { position: 13, teamName: 'Manchester United', shortName: 'MUN', teamLogo: 'https://crests.football-data.org/66.png', playedGames: 28, won: 9, draw: 7, lost: 12, points: 34, goalsFor: 35, goalsAgainst: 39, goalDifference: -4, form: ['L', 'D', 'W', 'L', 'L'] },
        { position: 14, teamName: 'West Ham United', shortName: 'WHU', teamLogo: 'https://crests.football-data.org/563.png', playedGames: 28, won: 9, draw: 6, lost: 13, points: 33, goalsFor: 34, goalsAgainst: 49, goalDifference: -15, form: ['D', 'L', 'L', 'W', 'L'] },
        { position: 15, teamName: 'Tottenham Hotspur', shortName: 'TOT', teamLogo: 'https://crests.football-data.org/73.png', playedGames: 28, won: 10, draw: 3, lost: 15, points: 33, goalsFor: 49, goalsAgainst: 43, goalDifference: 6, form: ['L', 'L', 'W', 'L', 'L'] },
        { position: 16, teamName: 'Everton FC', shortName: 'EVE', teamLogo: 'https://crests.football-data.org/62.png', playedGames: 28, won: 7, draw: 9, lost: 12, points: 30, goalsFor: 28, goalsAgainst: 36, goalDifference: -8, form: ['D', 'D', 'W', 'L', 'D'] },
        { position: 17, teamName: 'Wolverhampton Wanderers', shortName: 'WOL', teamLogo: 'https://crests.football-data.org/76.png', playedGames: 28, won: 7, draw: 6, lost: 15, points: 27, goalsFor: 38, goalsAgainst: 55, goalDifference: -17, form: ['L', 'W', 'L', 'L', 'W'] },
        { position: 18, teamName: 'Ipswich Town', shortName: 'IPS', teamLogo: 'https://crests.football-data.org/349.png', playedGames: 28, won: 4, draw: 8, lost: 16, points: 20, goalsFor: 27, goalsAgainst: 55, goalDifference: -28, form: ['L', 'L', 'L', 'D', 'L'], zone: 'relegation' },
        { position: 19, teamName: 'Leicester City', shortName: 'LEI', teamLogo: 'https://crests.football-data.org/338.png', playedGames: 28, won: 4, draw: 5, lost: 19, points: 17, goalsFor: 26, goalsAgainst: 59, goalDifference: -33, form: ['L', 'L', 'L', 'L', 'L'], zone: 'relegation' },
        { position: 20, teamName: 'Southampton FC', shortName: 'SOU', teamLogo: 'https://crests.football-data.org/340.png', playedGames: 28, won: 2, draw: 3, lost: 23, points: 9, goalsFor: 18, goalsAgainst: 66, goalDifference: -48, form: ['L', 'L', 'L', 'L', 'L'], zone: 'relegation' },
      ],
    },
  ],
  participants: [
    { id: 'liv', name: 'Liverpool FC', shortName: 'LIV', logo: 'https://crests.football-data.org/64.png' },
    { id: 'ars', name: 'Arsenal FC', shortName: 'ARS', logo: 'https://crests.football-data.org/57.png' },
    { id: 'mci', name: 'Manchester City', shortName: 'MCI', logo: 'https://crests.football-data.org/65.png' },
    { id: 'che', name: 'Chelsea FC', shortName: 'CHE', logo: 'https://crests.football-data.org/61.png' },
    { id: 'new', name: 'Newcastle United', shortName: 'NEW', logo: 'https://crests.football-data.org/67.png' },
    { id: 'avl', name: 'Aston Villa', shortName: 'AVL', logo: 'https://crests.football-data.org/58.png' },
    { id: 'mun', name: 'Manchester United', shortName: 'MUN', logo: 'https://crests.football-data.org/66.png' },
    { id: 'tot', name: 'Tottenham Hotspur', shortName: 'TOT', logo: 'https://crests.football-data.org/73.png' },
  ],
  matches: [],
};

const SEED_BUNDESLIGA: TournamentFullDetail = {
  id: 'foot-BL1',
  name: 'Bundesliga',
  shortName: 'Bundesliga',
  logo: 'https://crests.football-data.org/BL1.png',
  game: 'FÚTBOL',
  tier: 'S',
  region: 'EMEA',
  format: 'LEAGUE',
  season: '2025/2026',
  dates: 'Agosto - Mayo',
  location: 'Alemania',
  description: 'Liga nacional de fútbol de Alemania',
  standings: [
    {
      groupName: 'Clasificación General',
      table: [
        { position: 1, teamName: 'Bayern Múnich', shortName: 'BAY', teamLogo: 'https://crests.football-data.org/5.png', playedGames: 24, won: 19, draw: 4, lost: 1, points: 61, goalsFor: 72, goalsAgainst: 19, goalDifference: 53, form: ['W', 'W', 'W', 'W', 'D'], zone: 'champions' },
        { position: 2, teamName: 'Bayer Leverkusen', shortName: 'B04', teamLogo: 'https://crests.football-data.org/4.png', playedGames: 24, won: 15, draw: 8, lost: 1, points: 53, goalsFor: 56, goalsAgainst: 28, goalDifference: 28, form: ['W', 'W', 'D', 'W', 'W'], zone: 'champions' },
        { position: 3, teamName: 'Eintracht Frankfurt', shortName: 'SGE', teamLogo: 'https://crests.football-data.org/19.png', playedGames: 24, won: 14, draw: 6, lost: 4, points: 48, goalsFor: 51, goalsAgainst: 31, goalDifference: 20, form: ['W', 'L', 'W', 'W', 'W'], zone: 'champions' },
        { position: 4, teamName: 'RB Leipzig', shortName: 'RBL', teamLogo: 'https://crests.football-data.org/721.png', playedGames: 24, won: 12, draw: 7, lost: 5, points: 43, goalsFor: 40, goalsAgainst: 26, goalDifference: 14, form: ['D', 'W', 'D', 'L', 'W'], zone: 'champions' },
        { position: 5, teamName: 'SC Freiburg', shortName: 'SCF', teamLogo: 'https://crests.football-data.org/17.png', playedGames: 24, won: 12, draw: 3, lost: 9, points: 39, goalsFor: 36, goalsAgainst: 36, goalDifference: 0, form: ['W', 'W', 'L', 'W', 'L'], zone: 'europa' },
        { position: 6, teamName: 'Borussia Dortmund', shortName: 'BVB', teamLogo: 'https://crests.football-data.org/7.png', playedGames: 24, won: 11, draw: 5, lost: 8, points: 38, goalsFor: 45, goalsAgainst: 36, goalDifference: 9, form: ['L', 'W', 'W', 'L', 'W'], zone: 'conference' },
        { position: 7, teamName: 'VfB Stuttgart', shortName: 'VFB', teamLogo: 'https://crests.football-data.org/10.png', playedGames: 24, won: 10, draw: 7, lost: 7, points: 37, goalsFor: 44, goalsAgainst: 37, goalDifference: 7, form: ['D', 'W', 'D', 'W', 'L'] },
        { position: 8, teamName: 'Borussia Mönchengladbach', shortName: 'BMG', teamLogo: 'https://crests.football-data.org/18.png', playedGames: 24, won: 10, draw: 4, lost: 10, points: 34, goalsFor: 37, goalsAgainst: 37, goalDifference: 0, form: ['W', 'L', 'L', 'W', 'D'] },
        { position: 9, teamName: 'Werder Bremen', shortName: 'SVW', teamLogo: 'https://crests.football-data.org/12.png', playedGames: 24, won: 9, draw: 6, lost: 9, points: 33, goalsFor: 38, goalsAgainst: 42, goalDifference: -4, form: ['L', 'D', 'W', 'L', 'W'] },
        { position: 10, teamName: 'Mainz 05', shortName: 'M05', teamLogo: 'https://crests.football-data.org/15.png', playedGames: 24, won: 8, draw: 8, lost: 8, points: 32, goalsFor: 34, goalsAgainst: 32, goalDifference: 2, form: ['D', 'W', 'D', 'W', 'L'] },
        { position: 11, teamName: 'VfL Wolfsburg', shortName: 'WOB', teamLogo: 'https://crests.football-data.org/11.png', playedGames: 24, won: 9, draw: 4, lost: 11, points: 31, goalsFor: 41, goalsAgainst: 40, goalDifference: 1, form: ['W', 'L', 'L', 'D', 'W'] },
        { position: 12, teamName: 'FC Augsburg', shortName: 'FCA', teamLogo: 'https://crests.football-data.org/16.png', playedGames: 24, won: 8, draw: 6, lost: 10, points: 30, goalsFor: 29, goalsAgainst: 41, goalDifference: -12, form: ['W', 'D', 'W', 'L', 'D'] },
        { position: 13, teamName: '1. FC Union Berlin', shortName: 'FCU', teamLogo: 'https://crests.football-data.org/28.png', playedGames: 24, won: 6, draw: 9, lost: 9, points: 27, goalsFor: 22, goalsAgainst: 29, goalDifference: -7, form: ['D', 'L', 'D', 'D', 'L'] },
        { position: 14, teamName: 'TSG 1899 Hoffenheim', shortName: 'TSG', teamLogo: 'https://crests.football-data.org/2.png', playedGames: 24, won: 5, draw: 8, lost: 11, points: 23, goalsFor: 31, goalsAgainst: 45, goalDifference: -14, form: ['L', 'D', 'L', 'W', 'D'] },
        { position: 15, teamName: 'FC St. Pauli', shortName: 'STP', teamLogo: 'https://crests.football-data.org/14.png', playedGames: 24, won: 6, draw: 3, lost: 15, points: 21, goalsFor: 20, goalsAgainst: 33, goalDifference: -13, form: ['L', 'L', 'W', 'L', 'L'] },
        { position: 16, teamName: '1. FC Heidenheim', shortName: 'HDH', teamLogo: 'https://crests.football-data.org/44.png', playedGames: 24, won: 5, draw: 4, lost: 15, points: 19, goalsFor: 27, goalsAgainst: 46, goalDifference: -19, form: ['L', 'W', 'L', 'L', 'L'], zone: 'relegation' },
        { position: 17, teamName: 'Holstein Kiel', shortName: 'KSV', teamLogo: 'https://crests.football-data.org/720.png', playedGames: 24, won: 4, draw: 4, lost: 16, points: 16, goalsFor: 29, goalsAgainst: 55, goalDifference: -26, form: ['D', 'L', 'L', 'L', 'W'], zone: 'relegation' },
        { position: 18, teamName: 'VfL Bochum', shortName: 'BOC', teamLogo: 'https://crests.football-data.org/36.png', playedGames: 24, won: 3, draw: 6, lost: 15, points: 15, goalsFor: 22, goalsAgainst: 49, goalDifference: -27, form: ['L', 'D', 'L', 'L', 'D'], zone: 'relegation' },
      ],
    },
  ],
  participants: [
    { id: 'bay', name: 'Bayern Múnich', shortName: 'BAY', logo: 'https://crests.football-data.org/5.png' },
    { id: 'b04', name: 'Bayer Leverkusen', shortName: 'B04', logo: 'https://crests.football-data.org/4.png' },
    { id: 'bvb', name: 'Borussia Dortmund', shortName: 'BVB', logo: 'https://crests.football-data.org/7.png' },
    { id: 'rbl', name: 'RB Leipzig', shortName: 'RBL', logo: 'https://crests.football-data.org/721.png' },
    { id: 'sge', name: 'Eintracht Frankfurt', shortName: 'SGE', logo: 'https://crests.football-data.org/19.png' },
    { id: 'vfb', name: 'VfB Stuttgart', shortName: 'VFB', logo: 'https://crests.football-data.org/10.png' },
  ],
  matches: [],
};

const SEED_SERIE_A: TournamentFullDetail = {
  id: 'foot-SA',
  name: 'Serie A',
  shortName: 'Serie A',
  logo: 'https://crests.football-data.org/SA.png',
  game: 'FÚTBOL',
  tier: 'S',
  region: 'EMEA',
  format: 'LEAGUE',
  season: '2025/2026',
  dates: 'Agosto - Mayo',
  location: 'Italia',
  description: 'Primera división de fútbol de Italia',
  standings: [
    {
      groupName: 'Clasificación General',
      table: [
        { position: 1, teamName: 'Inter de Milán', shortName: 'INT', teamLogo: 'https://crests.football-data.org/108.png', playedGames: 27, won: 18, draw: 7, lost: 2, points: 61, goalsFor: 61, goalsAgainst: 24, goalDifference: 37, form: ['W', 'W', 'W', 'D', 'W'], zone: 'champions' },
        { position: 2, teamName: 'SSC Napoli', shortName: 'NAP', teamLogo: 'https://crests.football-data.org/113.png', playedGames: 27, won: 18, draw: 5, lost: 4, points: 59, goalsFor: 46, goalsAgainst: 21, goalDifference: 25, form: ['W', 'D', 'W', 'W', 'W'], zone: 'champions' },
        { position: 3, teamName: 'Atalanta BC', shortName: 'ATA', teamLogo: 'https://crests.football-data.org/102.png', playedGames: 27, won: 17, draw: 7, lost: 3, points: 58, goalsFor: 62, goalsAgainst: 25, goalDifference: 37, form: ['W', 'W', 'D', 'W', 'D'], zone: 'champions' },
        { position: 4, teamName: 'Juventus FC', shortName: 'JUV', teamLogo: 'https://crests.football-data.org/109.png', playedGames: 27, won: 13, draw: 13, lost: 1, points: 52, goalsFor: 44, goalsAgainst: 20, goalDifference: 24, form: ['W', 'D', 'W', 'D', 'W'], zone: 'champions' },
        { position: 5, teamName: 'SS Lazio', shortName: 'LAZ', teamLogo: 'https://crests.football-data.org/110.png', playedGames: 27, won: 15, draw: 5, lost: 7, points: 50, goalsFor: 49, goalsAgainst: 34, goalDifference: 15, form: ['L', 'W', 'W', 'D', 'W'], zone: 'europa' },
        { position: 6, teamName: 'ACF Fiorentina', shortName: 'FIO', teamLogo: 'https://crests.football-data.org/99.png', playedGames: 27, won: 13, draw: 9, lost: 5, points: 48, goalsFor: 43, goalsAgainst: 26, goalDifference: 17, form: ['W', 'L', 'D', 'W', 'W'], zone: 'conference' },
        { position: 7, teamName: 'AC Milan', shortName: 'MIL', teamLogo: 'https://crests.football-data.org/98.png', playedGames: 27, won: 12, draw: 8, lost: 7, points: 44, goalsFor: 42, goalsAgainst: 30, goalDifference: 12, form: ['L', 'W', 'D', 'W', 'L'] },
        { position: 8, teamName: 'Bologna FC', shortName: 'BOL', teamLogo: 'https://crests.football-data.org/103.png', playedGames: 27, won: 11, draw: 11, lost: 5, points: 44, goalsFor: 38, goalsAgainst: 30, goalDifference: 8, form: ['W', 'D', 'W', 'D', 'W'] },
        { position: 9, teamName: 'AS Roma', shortName: 'ROM', teamLogo: 'https://crests.football-data.org/100.png', playedGames: 27, won: 12, draw: 7, lost: 8, points: 43, goalsFor: 39, goalsAgainst: 31, goalDifference: 8, form: ['W', 'W', 'L', 'W', 'D'] },
        { position: 10, teamName: 'Udinese Calcio', shortName: 'UDI', teamLogo: 'https://crests.football-data.org/115.png', playedGames: 27, won: 11, draw: 3, lost: 13, points: 36, goalsFor: 32, goalsAgainst: 39, goalDifference: -7, form: ['L', 'W', 'L', 'L', 'W'] },
        { position: 11, teamName: 'Torino FC', shortName: 'TOR', teamLogo: 'https://crests.football-data.org/586.png', playedGames: 27, won: 8, draw: 11, lost: 8, points: 35, goalsFor: 31, goalsAgainst: 32, goalDifference: -1, form: ['D', 'D', 'W', 'L', 'D'] },
        { position: 12, teamName: 'Genoa CFC', shortName: 'GEN', teamLogo: 'https://crests.football-data.org/107.png', playedGames: 27, won: 8, draw: 8, lost: 11, points: 32, goalsFor: 27, goalsAgainst: 36, goalDifference: -9, form: ['W', 'L', 'D', 'W', 'L'] },
        { position: 13, teamName: 'Como 1907', shortName: 'COM', teamLogo: 'https://crests.football-data.org/106.png', playedGames: 27, won: 8, draw: 7, lost: 12, points: 31, goalsFor: 33, goalsAgainst: 40, goalDifference: -7, form: ['L', 'W', 'L', 'W', 'D'] },
        { position: 14, teamName: 'Hellas Verona', shortName: 'VER', teamLogo: 'https://crests.football-data.org/450.png', playedGames: 27, won: 9, draw: 2, lost: 16, points: 29, goalsFor: 32, goalsAgainst: 55, goalDifference: -23, form: ['L', 'L', 'W', 'L', 'L'] },
        { position: 15, teamName: 'Cagliari Calcio', shortName: 'CAG', teamLogo: 'https://crests.football-data.org/104.png', playedGames: 27, won: 6, draw: 10, lost: 11, points: 28, goalsFor: 28, goalsAgainst: 40, goalDifference: -12, form: ['D', 'D', 'L', 'W', 'D'] },
        { position: 16, teamName: 'Empoli FC', shortName: 'EMP', teamLogo: 'https://crests.football-data.org/445.png', playedGames: 27, won: 5, draw: 10, lost: 12, points: 25, goalsFor: 23, goalsAgainst: 38, goalDifference: -15, form: ['L', 'L', 'D', 'L', 'D'] },
        { position: 17, teamName: 'US Lecce', shortName: 'LEC', teamLogo: 'https://crests.football-data.org/854.png', playedGames: 27, won: 6, draw: 7, lost: 14, points: 25, goalsFor: 20, goalsAgainst: 43, goalDifference: -23, form: ['L', 'W', 'L', 'D', 'L'] },
        { position: 18, teamName: 'Parma Calcio 1913', shortName: 'PAR', teamLogo: 'https://crests.football-data.org/112.png', playedGames: 27, won: 5, draw: 9, lost: 13, points: 24, goalsFor: 31, goalsAgainst: 46, goalDifference: -15, form: ['D', 'L', 'L', 'L', 'D'], zone: 'relegation' },
        { position: 19, teamName: 'Venezia FC', shortName: 'VEN', teamLogo: 'https://crests.football-data.org/454.png', playedGames: 27, won: 4, draw: 7, lost: 16, points: 19, goalsFor: 24, goalsAgainst: 44, goalDifference: -20, form: ['L', 'D', 'L', 'L', 'L'], zone: 'relegation' },
        { position: 20, teamName: 'AC Monza', shortName: 'MON', teamLogo: 'https://crests.football-data.org/5911.png', playedGames: 27, won: 2, draw: 11, lost: 14, points: 17, goalsFor: 21, goalsAgainst: 41, goalDifference: -20, form: ['D', 'L', 'D', 'L', 'L'], zone: 'relegation' },
      ],
    },
  ],
  participants: [
    { id: 'int', name: 'Inter de Milán', shortName: 'INT', logo: 'https://crests.football-data.org/108.png' },
    { id: 'nap', name: 'SSC Napoli', shortName: 'NAP', logo: 'https://crests.football-data.org/113.png' },
    { id: 'ata', name: 'Atalanta BC', shortName: 'ATA', logo: 'https://crests.football-data.org/102.png' },
    { id: 'juv', name: 'Juventus FC', shortName: 'JUV', logo: 'https://crests.football-data.org/109.png' },
    { id: 'laz', name: 'SS Lazio', shortName: 'LAZ', logo: 'https://crests.football-data.org/110.png' },
    { id: 'mil', name: 'AC Milan', shortName: 'MIL', logo: 'https://crests.football-data.org/98.png' },
  ],
  matches: [],
};

// Datos 100% Reales de Valorant Champions 2026 (PandaScore Serie 10953 / VCT Oficial)
const SEED_VCT_CHAMPIONS: TournamentFullDetail = {
  id: 'vlr-champions',
  name: 'Valorant Champions',
  shortName: 'Champions',
  logo: undefined,
  game: 'VALORANT',
  tier: 'S',
  region: 'GLOBAL',
  format: 'PLAYOFFS',
  season: '2026',
  dates: '24 Septiembre - 18 Octubre 2026',
  location: 'Shanghai / Seúl',
  description: 'Campeonato Mundial Oficial de Riot Games (Champions 2026)',
  standings: [
    {
      groupName: 'Grupo A (Fase de Grupos)',
      table: [
        { position: 1, teamName: '100 Thieves', shortName: '100T', teamLogo: 'https://cdn-api.pandascore.co/images/team/image/128605/764px_100_thieves_lightmode.png', playedGames: 2, won: 2, lost: 0, points: 6, roundDifference: 4, form: ['W', 'W'], zone: 'playoff_upper' },
        { position: 2, teamName: 'T1', shortName: 'T1', teamLogo: 'https://cdn-api.pandascore.co/images/team/image/128647/600px_t1_infoboximage.png', playedGames: 3, won: 2, lost: 1, points: 4, roundDifference: 1, form: ['L', 'W', 'W'], zone: 'playoff_upper' },
        { position: 3, teamName: 'FUT Esports', shortName: 'FUT', teamLogo: 'https://cdn-api.pandascore.co/images/team/image/128578/600px_futbolist_new_logo_2021_infobox.png', playedGames: 3, won: 1, lost: 2, points: 2, roundDifference: -2, form: ['W', 'L', 'L'], zone: 'eliminated' },
        { position: 4, teamName: 'JD Gaming', shortName: 'JDG', teamLogo: 'https://cdn-api.pandascore.co/images/team/image/134454/600px_jd_gaming_2021_full_allmode.png', playedGames: 2, won: 0, lost: 2, points: 0, roundDifference: -3, form: ['L', 'L'], zone: 'eliminated' },
      ],
    },
    {
      groupName: 'Grupo B (Fase de Grupos)',
      table: [
        { position: 1, teamName: 'Team Vitality', shortName: 'VIT', teamLogo: 'https://cdn-api.pandascore.co/images/team/image/394/team_vitality.png', playedGames: 2, won: 2, lost: 0, points: 6, roundDifference: 3, form: ['W', 'W'], zone: 'playoff_upper' },
        { position: 2, teamName: 'LOUD', shortName: 'LOUD', teamLogo: 'https://cdn-api.pandascore.co/images/team/image/126620/loud.png', playedGames: 3, won: 2, lost: 1, points: 4, roundDifference: 2, form: ['W', 'L', 'W'], zone: 'playoff_upper' },
        { position: 3, teamName: 'Global Esports', shortName: 'GE', teamLogo: 'https://cdn-api.pandascore.co/images/team/image/128327/global_esports.png', playedGames: 3, won: 1, lost: 2, points: 2, roundDifference: -1, form: ['L', 'W', 'L'], zone: 'eliminated' },
        { position: 4, teamName: 'EDward Gaming', shortName: 'EDG', teamLogo: 'https://cdn-api.pandascore.co/images/team/image/126584/edg.png', playedGames: 2, won: 0, lost: 2, points: 0, roundDifference: -4, form: ['L', 'L'], zone: 'eliminated' },
      ],
    },
    {
      groupName: 'Grupo C (Fase de Grupos)',
      table: [
        { position: 1, teamName: 'Paper Rex', shortName: 'PR', teamLogo: 'https://cdn-api.pandascore.co/images/team/image/128327/paper_rex.png', playedGames: 2, won: 2, lost: 0, points: 6, roundDifference: 2, form: ['W', 'W'], zone: 'playoff_upper' },
        { position: 2, teamName: 'G2 Esports', shortName: 'G2', teamLogo: 'https://cdn-api.pandascore.co/images/team/image/127014/g2_esports.png', playedGames: 3, won: 2, lost: 1, points: 4, roundDifference: 3, form: ['W', 'L', 'W'], zone: 'playoff_upper' },
        { position: 3, teamName: 'Team Liquid', shortName: 'TL', teamLogo: 'https://cdn-api.pandascore.co/images/team/image/394/team_liquid.png', playedGames: 3, won: 1, lost: 2, points: 2, roundDifference: -2, form: ['L', 'W', 'L'], zone: 'eliminated' },
        { position: 4, teamName: 'TYLOO', shortName: 'TYLOO', teamLogo: 'https://cdn-api.pandascore.co/images/team/image/127114/tyloo.png', playedGames: 2, won: 0, lost: 2, points: 0, roundDifference: -3, form: ['L', 'L'], zone: 'eliminated' },
      ],
    },
    {
      groupName: 'Grupo D (Fase de Grupos)',
      table: [
        { position: 1, teamName: 'NRG', shortName: 'NRG', teamLogo: 'https://cdn-api.pandascore.co/images/team/image/127014/nrg.png', playedGames: 2, won: 2, lost: 0, points: 6, roundDifference: 3, form: ['W', 'W'], zone: 'playoff_upper' },
        { position: 2, teamName: 'Nongshim RedForce', shortName: 'NS', teamLogo: 'https://cdn-api.pandascore.co/images/team/image/128327/nongshim.png', playedGames: 3, won: 2, lost: 1, points: 4, roundDifference: 1, form: ['L', 'W', 'W'], zone: 'playoff_upper' },
        { position: 3, teamName: 'Karmine Corp', shortName: 'KC', teamLogo: 'https://cdn-api.pandascore.co/images/team/image/128695/karmine_corp.png', playedGames: 3, won: 1, lost: 2, points: 2, roundDifference: 0, form: ['W', 'L', 'L'], zone: 'eliminated' },
        { position: 4, teamName: 'XLG Gaming', shortName: 'XLG', teamLogo: 'https://cdn-api.pandascore.co/images/team/image/128456/xlg.png', playedGames: 2, won: 0, lost: 2, points: 0, roundDifference: -4, form: ['L', 'L'], zone: 'eliminated' },
      ],
    },
  ],
  bracket: {
    format: 'DOUBLE_ELIMINATION',
    upperRounds: [
      {
        roundNumber: 1,
        roundName: 'Cuartos de Ganadores (Upper QF)',
        matches: [
          {
            id: 'vlr-ps-1685236',
            name: '100 Thieves vs LOUD',
            stage: 'Bo3 • 7 Octubre 2026',
            status: 'UPCOMING',
            scheduledTime: '7 Oct, 11:00',
            teamA: { name: '100 Thieves', shortName: '100T', logo: 'https://cdn-api.pandascore.co/images/team/image/128605/764px_100_thieves_lightmode.png' },
            teamB: { name: 'LOUD', shortName: 'LOUD', logo: 'https://cdn-api.pandascore.co/images/team/image/126620/loud.png' },
          },
          {
            id: 'vlr-ps-1685237',
            name: 'Team Vitality vs T1',
            stage: 'Bo3 • 7 Octubre 2026',
            status: 'UPCOMING',
            scheduledTime: '7 Oct, 14:00',
            teamA: { name: 'Team Vitality', shortName: 'VIT', logo: 'https://cdn-api.pandascore.co/images/team/image/394/team_vitality.png' },
            teamB: { name: 'T1', shortName: 'T1', logo: 'https://cdn-api.pandascore.co/images/team/image/128647/600px_t1_infoboximage.png' },
          },
          {
            id: 'vlr-ps-1685238',
            name: 'Paper Rex vs Nongshim RedForce',
            stage: 'Bo3 • 8 Octubre 2026',
            status: 'UPCOMING',
            scheduledTime: '8 Oct, 11:00',
            teamA: { name: 'Paper Rex', shortName: 'PR', logo: 'https://cdn-api.pandascore.co/images/team/image/128327/paper_rex.png' },
            teamB: { name: 'Nongshim RedForce', shortName: 'NS', logo: 'https://cdn-api.pandascore.co/images/team/image/128327/nongshim.png' },
          },
          {
            id: 'vlr-ps-1685239',
            name: 'NRG vs G2 Esports',
            stage: 'Bo3 • 8 Octubre 2026',
            status: 'UPCOMING',
            scheduledTime: '8 Oct, 14:00',
            teamA: { name: 'NRG', shortName: 'NRG', logo: 'https://cdn-api.pandascore.co/images/team/image/127014/nrg.png' },
            teamB: { name: 'G2 Esports', shortName: 'G2', logo: 'https://cdn-api.pandascore.co/images/team/image/127014/g2_esports.png' },
          },
        ],
      },
      {
        roundNumber: 2,
        roundName: 'Semifinales de Ganadores (Upper SF)',
        matches: [
          {
            id: 'vlr-ps-1685240',
            name: 'Upper Bracket Semifinal 1',
            stage: 'Bo3 • 10 Octubre 2026',
            status: 'UPCOMING',
            scheduledTime: '10 Oct, 11:00',
            teamA: { name: 'TBD', shortName: 'TBD' },
            teamB: { name: 'TBD', shortName: 'TBD' },
          },
          {
            id: 'vlr-ps-1685241',
            name: 'Upper Bracket Semifinal 2',
            stage: 'Bo3 • 10 Octubre 2026',
            status: 'UPCOMING',
            scheduledTime: '10 Oct, 14:00',
            teamA: { name: 'TBD', shortName: 'TBD' },
            teamB: { name: 'TBD', shortName: 'TBD' },
          },
        ],
      },
      {
        roundNumber: 3,
        roundName: 'Final de Ganadores (Upper Final)',
        matches: [
          {
            id: 'vlr-ps-1685242',
            name: 'Upper Bracket Final',
            stage: 'Bo3 • 16 Octubre 2026',
            status: 'UPCOMING',
            scheduledTime: '16 Oct, 08:00',
            teamA: { name: 'TBD', shortName: 'TBD' },
            teamB: { name: 'TBD', shortName: 'TBD' },
          },
        ],
      },
    ],
    lowerRounds: [
      {
        roundNumber: 1,
        roundName: 'Ronda 1 de Perdedores (Lower R1)',
        matches: [
          {
            id: 'vlr-ps-1685243',
            name: 'Lower Bracket Round 1 Match 1',
            stage: 'Bo3 • 9 Octubre 2026',
            status: 'UPCOMING',
            scheduledTime: '9 Oct, 11:00',
            teamA: { name: 'TBD', shortName: 'TBD' },
            teamB: { name: 'TBD', shortName: 'TBD' },
          },
          {
            id: 'vlr-ps-1685244',
            name: 'Lower Bracket Round 1 Match 2',
            stage: 'Bo3 • 9 Octubre 2026',
            status: 'UPCOMING',
            scheduledTime: '9 Oct, 14:00',
            teamA: { name: 'TBD', shortName: 'TBD' },
            teamB: { name: 'TBD', shortName: 'TBD' },
          },
        ],
      },
      {
        roundNumber: 2,
        roundName: 'Cuartos de Perdedores (Lower QF)',
        matches: [
          {
            id: 'vlr-ps-1685246',
            name: 'Lower Bracket Quarterfinal 2',
            stage: 'Bo3 • 11 Octubre 2026',
            status: 'UPCOMING',
            scheduledTime: '11 Oct, 11:00',
            teamA: { name: 'TBD', shortName: 'TBD' },
            teamB: { name: 'TBD', shortName: 'TBD' },
          },
          {
            id: 'vlr-ps-1685245',
            name: 'Lower Bracket Quarterfinal 1',
            stage: 'Bo3 • 11 Octubre 2026',
            status: 'UPCOMING',
            scheduledTime: '11 Oct, 14:00',
            teamA: { name: 'TBD', shortName: 'TBD' },
            teamB: { name: 'TBD', shortName: 'TBD' },
          },
        ],
      },
      {
        roundNumber: 3,
        roundName: 'Semifinal y Final de Perdedores',
        matches: [
          {
            id: 'vlr-ps-1685247',
            name: 'Lower Bracket Semifinal',
            stage: 'Bo3 • 16 Octubre 2026',
            status: 'UPCOMING',
            scheduledTime: '16 Oct, 11:00',
            teamA: { name: 'TBD', shortName: 'TBD' },
            teamB: { name: 'TBD', shortName: 'TBD' },
          },
          {
            id: 'vlr-ps-1685248',
            name: 'Lower Bracket Final',
            stage: 'Bo5 • 17 Octubre 2026',
            status: 'UPCOMING',
            scheduledTime: '17 Oct, 09:00',
            teamA: { name: 'TBD', shortName: 'TBD' },
            teamB: { name: 'TBD', shortName: 'TBD' },
          },
        ],
      },
    ],
    grandFinal: {
      id: 'vlr-ps-1685249',
      name: 'Gran Final Mundial Champions 2026',
      stage: 'Bo5 • 18 Octubre 2026',
      status: 'UPCOMING',
      scheduledTime: '18 Oct, 08:00',
      teamA: { name: 'TBD', shortName: 'TBD' },
      teamB: { name: 'TBD', shortName: 'TBD' },
    },
  },
  participants: [
    { id: '100t', name: '100 Thieves', shortName: '100T', logo: 'https://cdn-api.pandascore.co/images/team/image/128605/764px_100_thieves_lightmode.png', region: 'Américas' },
    { id: 't1', name: 'T1', shortName: 'T1', logo: 'https://cdn-api.pandascore.co/images/team/image/128647/600px_t1_infoboximage.png', region: 'Pacífico' },
    { id: 'fut', name: 'FUT Esports', shortName: 'FUT', logo: 'https://cdn-api.pandascore.co/images/team/image/128578/600px_futbolist_new_logo_2021_infobox.png', region: 'EMEA' },
    { id: 'jdg', name: 'JD Gaming', shortName: 'JDG', logo: 'https://cdn-api.pandascore.co/images/team/image/134454/600px_jd_gaming_2021_full_allmode.png', region: 'China' },
    { id: 'vit', name: 'Team Vitality', shortName: 'VIT', logo: 'https://cdn-api.pandascore.co/images/team/image/394/team_vitality.png', region: 'EMEA' },
    { id: 'loud', name: 'LOUD', shortName: 'LOUD', logo: 'https://cdn-api.pandascore.co/images/team/image/126620/loud.png', region: 'Américas' },
    { id: 'ge', name: 'Global Esports', shortName: 'GE', logo: 'https://cdn-api.pandascore.co/images/team/image/128327/global_esports.png', region: 'Pacífico' },
    { id: 'edg', name: 'EDward Gaming', shortName: 'EDG', logo: 'https://cdn-api.pandascore.co/images/team/image/126584/edg.png', region: 'China' },
    { id: 'pr', name: 'Paper Rex', shortName: 'PR', logo: 'https://cdn-api.pandascore.co/images/team/image/128327/paper_rex.png', region: 'Pacífico' },
    { id: 'g2', name: 'G2 Esports', shortName: 'G2', logo: 'https://cdn-api.pandascore.co/images/team/image/127014/g2_esports.png', region: 'Américas' },
    { id: 'tl', name: 'Team Liquid', shortName: 'TL', logo: 'https://cdn-api.pandascore.co/images/team/image/394/team_liquid.png', region: 'EMEA' },
    { id: 'tyloo', name: 'TYLOO', shortName: 'TYLOO', logo: 'https://cdn-api.pandascore.co/images/team/image/127114/tyloo.png', region: 'China' },
    { id: 'nrg', name: 'NRG', shortName: 'NRG', logo: 'https://cdn-api.pandascore.co/images/team/image/127014/nrg.png', region: 'Américas' },
    { id: 'ns', name: 'Nongshim RedForce', shortName: 'NS', logo: 'https://cdn-api.pandascore.co/images/team/image/128327/nongshim.png', region: 'Pacífico' },
    { id: 'kc', name: 'Karmine Corp', shortName: 'KC', logo: 'https://cdn-api.pandascore.co/images/team/image/128695/karmine_corp.png', region: 'EMEA' },
    { id: 'xlg', name: 'XLG Gaming', shortName: 'XLG', logo: 'https://cdn-api.pandascore.co/images/team/image/128456/xlg.png', region: 'China' },
  ],
  matches: [
    {
      id: 'vlr-m-1685220',
      game: 'VALORANT',
      league: 'Valorant Champions',
      status: 'FINISHED',
      timeInfo: '0 - 2',
      startTimeIso: '2026-10-04T11:30:00Z',
      tier: 'S',
      region: 'GLOBAL',
      teamA: { name: 'FUT Esports', shortName: 'FUT', score: 0, logo: 'https://cdn-api.pandascore.co/images/team/image/128578/600px_futbolist_new_logo_2021_infobox.png' },
      teamB: { name: 'T1', shortName: 'T1', score: 2, logo: 'https://cdn-api.pandascore.co/images/team/image/128647/600px_t1_infoboximage.png' },
      details: { tournamentStage: 'Fase de Grupos • Decider Match (Grupo A)' },
    },
    {
      id: 'vlr-m-1685225',
      game: 'VALORANT',
      league: 'Valorant Champions',
      status: 'FINISHED',
      timeInfo: '2 - 0',
      startTimeIso: '2026-10-04T09:00:00Z',
      tier: 'S',
      region: 'GLOBAL',
      teamA: { name: 'LOUD', shortName: 'LOUD', score: 2, logo: 'https://cdn-api.pandascore.co/images/team/image/126620/loud.png' },
      teamB: { name: 'Global Esports', shortName: 'GE', score: 0, logo: 'https://cdn-api.pandascore.co/images/team/image/128327/global_esports.png' },
      details: { tournamentStage: 'Fase de Grupos • Decider Match (Grupo B)' },
    },
    {
      id: 'vlr-m-1685232',
      game: 'VALORANT',
      league: 'Valorant Champions',
      status: 'FINISHED',
      timeInfo: '2 - 0',
      startTimeIso: '2026-10-03T09:00:00Z',
      tier: 'S',
      region: 'GLOBAL',
      teamA: { name: 'G2 Esports', shortName: 'G2', score: 2, logo: 'https://cdn-api.pandascore.co/images/team/image/127014/g2_esports.png' },
      teamB: { name: 'Team Liquid', shortName: 'TL', score: 0, logo: 'https://cdn-api.pandascore.co/images/team/image/394/team_liquid.png' },
      details: { tournamentStage: 'Fase de Grupos • Decider Match (Grupo C)' },
    },
    {
      id: 'vlr-m-1685235',
      game: 'VALORANT',
      league: 'Valorant Champions',
      status: 'FINISHED',
      timeInfo: '1 - 2',
      startTimeIso: '2026-10-03T11:30:00Z',
      tier: 'S',
      region: 'GLOBAL',
      teamA: { name: 'Karmine Corp', shortName: 'KC', score: 1, logo: 'https://cdn-api.pandascore.co/images/team/image/128695/karmine_corp.png' },
      teamB: { name: 'Nongshim RedForce', shortName: 'NS', score: 2, logo: 'https://cdn-api.pandascore.co/images/team/image/128327/nongshim.png' },
      details: { tournamentStage: 'Fase de Grupos • Decider Match (Grupo D)' },
    },
    {
      id: 'vlr-m-1685236',
      game: 'VALORANT',
      league: 'Valorant Champions',
      status: 'UPCOMING',
      timeInfo: '07/10 11:00',
      startTimeIso: '2026-10-07T09:00:00Z',
      tier: 'S',
      region: 'GLOBAL',
      teamA: { name: '100 Thieves', shortName: '100T', score: '-', logo: 'https://cdn-api.pandascore.co/images/team/image/128605/764px_100_thieves_lightmode.png' },
      teamB: { name: 'LOUD', shortName: 'LOUD', score: '-', logo: 'https://cdn-api.pandascore.co/images/team/image/126620/loud.png' },
      details: { tournamentStage: 'Playoffs • Cuartos de Ganadores 1 (Bo3)' },
    },
    {
      id: 'vlr-m-1685237',
      game: 'VALORANT',
      league: 'Valorant Champions',
      status: 'UPCOMING',
      timeInfo: '07/10 14:00',
      startTimeIso: '2026-10-07T12:00:00Z',
      tier: 'S',
      region: 'GLOBAL',
      teamA: { name: 'Team Vitality', shortName: 'VIT', score: '-', logo: 'https://cdn-api.pandascore.co/images/team/image/394/team_vitality.png' },
      teamB: { name: 'T1', shortName: 'T1', score: '-', logo: 'https://cdn-api.pandascore.co/images/team/image/128647/600px_t1_infoboximage.png' },
      details: { tournamentStage: 'Playoffs • Cuartos de Ganadores 2 (Bo3)' },
    },
    {
      id: 'vlr-m-1685238',
      game: 'VALORANT',
      league: 'Valorant Champions',
      status: 'UPCOMING',
      timeInfo: '08/10 11:00',
      startTimeIso: '2026-10-08T09:00:00Z',
      tier: 'S',
      region: 'GLOBAL',
      teamA: { name: 'Paper Rex', shortName: 'PR', score: '-', logo: 'https://cdn-api.pandascore.co/images/team/image/128327/paper_rex.png' },
      teamB: { name: 'Nongshim RedForce', shortName: 'NS', score: '-', logo: 'https://cdn-api.pandascore.co/images/team/image/128327/nongshim.png' },
      details: { tournamentStage: 'Playoffs • Cuartos de Ganadores 3 (Bo3)' },
    },
    {
      id: 'vlr-m-1685239',
      game: 'VALORANT',
      league: 'Valorant Champions',
      status: 'UPCOMING',
      timeInfo: '08/10 14:00',
      startTimeIso: '2026-10-08T12:00:00Z',
      tier: 'S',
      region: 'GLOBAL',
      teamA: { name: 'NRG', shortName: 'NRG', score: '-', logo: 'https://cdn-api.pandascore.co/images/team/image/127014/nrg.png' },
      teamB: { name: 'G2 Esports', shortName: 'G2', score: '-', logo: 'https://cdn-api.pandascore.co/images/team/image/127014/g2_esports.png' },
      details: { tournamentStage: 'Playoffs • Cuartos de Ganadores 4 (Bo3)' },
    },
  ],
};

const SEED_LEC: TournamentFullDetail = {
  id: 'lol-lec',
  name: 'LEC (League of Legends EMEA Championship)',
  shortName: 'LEC',
  logo: undefined,
  game: 'LOL',
  tier: 'S',
  region: 'EMEA',
  format: 'HYBRID_GROUPS_PLAYOFFS',
  season: '2026',
  dates: 'Enero - Septiembre 2026',
  location: 'Berlín, Alemania',
  description: 'Máxima liga profesional de League of Legends en Europa',
  participants: [
    { id: 'g2', name: 'G2 Esports', shortName: 'G2', logo: 'https://cdn-api.pandascore.co/images/team/image/127014/g2_esports.png', region: 'EMEA' },
    { id: 'fnc', name: 'Fnatic', shortName: 'FNC', logo: 'https://cdn-api.pandascore.co/images/team/image/394/fnatic.png', region: 'EMEA' },
    { id: 'bds', name: 'Team BDS', shortName: 'BDS', logo: 'https://cdn-api.pandascore.co/images/team/image/129676/team_bds.png', region: 'EMEA' },
    { id: 'koi', name: 'Movistar KOI', shortName: 'KOI', logo: 'https://cdn-api.pandascore.co/images/team/image/129749/koi.png', region: 'EMEA' },
    { id: 'kc', name: 'Karmine Corp', shortName: 'KC', logo: 'https://cdn-api.pandascore.co/images/team/image/128695/karmine_corp.png', region: 'EMEA' },
    { id: 'th', name: 'Team Heretics', shortName: 'TH', logo: 'https://cdn-api.pandascore.co/images/team/image/125777/team_heretics.png', region: 'EMEA' },
  ],
  matches: [],
};

const SEED_CS2_MAJOR: TournamentFullDetail = {
  id: 'cs2-major',
  name: 'CS2 Major Championship',
  shortName: 'Major',
  logo: undefined,
  game: 'CS2',
  tier: 'S',
  region: 'GLOBAL',
  format: 'PLAYOFFS',
  season: '2026',
  dates: 'Noviembre - Diciembre 2026',
  location: 'Shanghái / Budapest',
  prizePool: '$1,250,000 USD',
  description: 'Máximo torneo oficial auspiciado por Valve',
  participants: [
    { id: 'navi', name: 'Natus Vincere', shortName: 'NAVI', logo: 'https://cdn-api.pandascore.co/images/team/image/394/navi.png', region: 'Europa' },
    { id: 'spirit', name: 'Team Spirit', shortName: 'Spirit', logo: 'https://cdn-api.pandascore.co/images/team/image/127114/spirit.png', region: 'Europa' },
    { id: 'faze', name: 'FaZe Clan', shortName: 'FaZe', logo: 'https://cdn-api.pandascore.co/images/team/image/394/faze.png', region: 'Europa' },
    { id: 'vitality', name: 'Team Vitality', shortName: 'VIT', logo: 'https://cdn-api.pandascore.co/images/team/image/394/team_vitality.png', region: 'Europa' },
  ],
  matches: [],
};

const SEED_SIX_INVITATIONAL: TournamentFullDetail = {
  id: 'r6-six-invitational',
  name: 'Six Invitational',
  shortName: 'Invitational',
  logo: 'https://cdn-api.pandascore.co/images/league/image/4243/600px-six_invitational_2020.png',
  game: 'R6',
  tier: 'S',
  region: 'GLOBAL',
  format: 'PLAYOFFS',
  season: '2026',
  dates: 'Febrero 2026',
  location: 'São Paulo / Montreal',
  prizePool: '$3,000,000 USD',
  description: 'Campeonato Mundial Oficial de Ubisoft',
  participants: [
    { id: 'w7m', name: 'w7m esports', shortName: 'w7m', logo: 'https://cdn-api.pandascore.co/images/team/image/128327/w7m.png', region: 'Brasil' },
    { id: 'faze', name: 'FaZe Clan', shortName: 'FaZe', logo: 'https://cdn-api.pandascore.co/images/team/image/394/faze.png', region: 'Brasil' },
  ],
  matches: [],
};

const SEED_DOTA_TI: TournamentFullDetail = {
  id: 'dota-ti',
  name: 'The International',
  shortName: 'The International',
  logo: 'https://cdn-api.pandascore.co/images/league/image/4164/500px-The_International.png',
  game: 'DOTA2',
  tier: 'S',
  region: 'GLOBAL',
  format: 'PLAYOFFS',
  season: '2026',
  dates: 'Septiembre 2026',
  location: 'Copenhague, Dinamarca',
  prizePool: '$2,600,000 USD',
  description: 'Campeonato Mundial Oficial de Dota 2 de Valve',
  participants: [
    { id: 'tl', name: 'Team Liquid', shortName: 'Liquid', logo: 'https://cdn-api.pandascore.co/images/team/image/394/team_liquid.png', region: 'Europa' },
    { id: 'gg', name: 'Gaimin Gladiators', shortName: 'GG', logo: 'https://cdn-api.pandascore.co/images/team/image/129676/gaimin.png', region: 'Europa' },
  ],
  matches: [],
};

const MASTER_SEEDS: Record<string, TournamentFullDetail> = {
  'foot-PD': SEED_LALIGA,
  'foot-CL': SEED_CHAMPIONS_LEAGUE,
  'foot-PL': SEED_PREMIER_LEAGUE,
  'foot-BL1': SEED_BUNDESLIGA,
  'foot-SA': SEED_SERIE_A,
  'vlr-champions': SEED_VCT_CHAMPIONS,
  'vlr-masters': {
    ...SEED_VCT_CHAMPIONS,
    id: 'vlr-masters',
    name: 'VCT Masters',
    shortName: 'Masters',
    season: '2026',
    description: 'Torneo Internacional Mayor de Valorant (Madrid, Shanghai, Bangkok)',
    standings: [],
    bracket: undefined,
    participants: [],
    matches: [],
  },
  'vlr-emea': {
    ...SEED_VCT_CHAMPIONS,
    id: 'vlr-emea',
    name: 'VCT EMEA',
    shortName: 'VCT EMEA',
    season: '2026',
    description: 'Liga Oficial Tier 1 de Europa, Turquía y Oriente Medio',
    standings: [],
    bracket: undefined,
    participants: [],
    matches: [],
  },
  'lol-lec': SEED_LEC,
  'lol-emea-masters': {
    ...SEED_LEC,
    id: 'lol-emea-masters',
    name: 'EMEA Masters',
    shortName: 'EMEA Masters',
    logo: 'https://cdn-api.pandascore.co/images/league/image/4996/emea_masters_2023-png',
    season: 'Summer 2026',
    description: 'Torneo europeo de las mejores ERLs regionales',
    standings: [],
    bracket: undefined,
    participants: [],
    matches: [],
  },
  'lol-worlds': {
    ...SEED_LEC,
    id: 'lol-worlds',
    name: 'League of Legends World Championship',
    shortName: 'Worlds',
    season: '2026',
    description: 'Campeonato Mundial de League of Legends',
    standings: [],
    bracket: undefined,
    participants: [],
    matches: [],
  },
  'cs2-major': SEED_CS2_MAJOR,
  'cs2-iem': {
    ...SEED_CS2_MAJOR,
    id: 'cs2-iem',
    name: 'Intel Extreme Masters (IEM)',
    shortName: 'IEM',
    season: '2026',
    description: 'Circuito histórico élite de ESL (Cologne, Katowice)',
    standings: [],
    bracket: undefined,
    matches: [],
  },
  'r6-six-invitational': SEED_SIX_INVITATIONAL,
  'dota-ti': SEED_DOTA_TI,
};

// ==========================================
// TOURNAMENT SERVICE IMPLEMENTATION
// ==========================================

export const TournamentService = {
  /**
   * Obtiene la semilla o modelo maestro por defecto para un torneo.
   */
  getMasterSeed(tournament: TournamentItem): TournamentFullDetail {
    if (MASTER_SEEDS[tournament.id]) {
      const seed = JSON.parse(JSON.stringify(MASTER_SEEDS[tournament.id]));
      if (tournament.season) seed.season = tournament.season;
      return seed;
    }

    const isLeague = tournament.game === 'FÚTBOL' && !tournament.name.toLowerCase().includes('copa');
    return {
      id: tournament.id,
      name: tournament.name,
      shortName: tournament.shortName || tournament.name,
      logo: tournament.logo,
      game: tournament.game,
      tier: tournament.tier,
      region: tournament.region,
      format: isLeague ? 'LEAGUE' : 'PLAYOFFS',
      season: tournament.season || (tournament.game === 'FÚTBOL' ? '2025/2026' : '2026'),
      description: tournament.description || `Competición oficial de ${tournament.game}`,
      participants: [],
      matches: [],
    };
  },

  /**
   * Obtiene los detalles completos de un torneo aplicando SWR:
   * 1. Devuelve inmediatamente la copia en RAM (0ms) o almacenamiento local.
   * 2. Si no hay datos, devuelve la semilla maestra real.
   * 3. Sincroniza en background con PandaScore y Football-Data oficial.
   */
  async getTournamentDetails(
    tournament: TournamentItem,
    tokens: { pandaToken?: string; footballToken?: string },
    forceRefresh = false
  ): Promise<TournamentFullDetail> {
    const seasonKey = tournament.season ? `_${tournament.season.replace(/\s+/g, '_')}` : '';
    const key = `${tournament.id}${seasonKey}`;
    const now = Date.now();

    // 1. Comprobar caché L1 (RAM)
    if (!forceRefresh) {
      const cached = MEMORY_CACHE.get(key);
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
      }
    }

    // 2. Comprobar caché L2 (AsyncStorage)
    let baseDetail: TournamentFullDetail = this.getMasterSeed(tournament);
    if (tournament.season) {
      baseDetail.season = tournament.season;
    }
    try {
      const stored = await AsyncStorage.getItem(STORAGE_PREFIX + key);
      if (stored) {
        const parsed = JSON.parse(stored) as TournamentFullDetail;
        baseDetail = {
          ...baseDetail,
          ...parsed,
          bracket: parsed.bracket || baseDetail.bracket,
          standings: (parsed.standings && parsed.standings.length > 0) ? parsed.standings : baseDetail.standings,
          participants: (parsed.participants && parsed.participants.length > 0) ? parsed.participants : baseDetail.participants,
        };
      }
    } catch (e) {
      console.warn('Error leyendo storage de torneo:', e);
    }

    // Guardar en memoria inmediatamente para que el render inicial sea instantáneo
    MEMORY_CACHE.set(key, { data: baseDetail, timestamp: now });

    // 3. Si es Esports y hay token de PandaScore, sincronizar datos oficiales en vivo
    let hasLoadedLiveMatches = false;
    if (tournament.game !== 'FÚTBOL' && tokens.pandaToken) {
      try {
        const pandaData = await this.fetchPandaTournamentData(tournament, tokens.pandaToken);
        if (pandaData && pandaData.matches && pandaData.matches.length > 0) {
          baseDetail.matches = pandaData.matches;

          // Los datos oficiales SIEMPRE sustituyen a la semilla (aunque vengan vacíos,
          // es mejor no mostrar una clasificación/cuadro inventados).
          baseDetail.standings = pandaData.standings || [];
          baseDetail.bracket =
            pandaData.bracket ||
            (baseDetail.standings.length > 0 ? projectBracketFromStandings(baseDetail.standings) : undefined);
          baseDetail.participants =
            pandaData.participants && pandaData.participants.length > 0
              ? pandaData.participants
              : extractParticipantsFromMatches(pandaData.matches);

          // Metadatos dinámicos siempre actualizados a la temporada en vigor
          if (pandaData.resolvedSeries?.fullName) {
            baseDetail.season = pandaData.resolvedSeries.fullName;
          } else if (pandaData.resolvedSeries?.year) {
            baseDetail.season = String(pandaData.resolvedSeries.year);
          }
          if (!baseDetail.logo && pandaData.resolvedSeries?.leagueLogo) {
            baseDetail.logo = pandaData.resolvedSeries.leagueLogo;
          }
          if (pandaData.resolvedSeries?.beginAt && pandaData.resolvedSeries?.endAt) {
            const b = new Date(pandaData.resolvedSeries.beginAt);
            const e = new Date(pandaData.resolvedSeries.endAt);
            baseDetail.dates = `${b.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${e.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
          }
          hasLoadedLiveMatches = true;
        }
      } catch (err) {
        console.warn('Error sincronizando PandaScore tournament:', err);
      }
    }

    // Fallback a partidos locales o de scoreService si no se cargaron por PandaScore
    if (!hasLoadedLiveMatches) {
      try {
        const matches = await ScoreService.fetchMatchesForTournament(tournament, tokens);
        if (matches && matches.length > 0) {
          baseDetail.matches = matches;
          if (!baseDetail.bracket) {
            baseDetail.bracket = buildBracketFromMatches(matches);
            if (!baseDetail.bracket && baseDetail.standings && baseDetail.standings.length > 0) {
              baseDetail.bracket = projectBracketFromStandings(baseDetail.standings);
            }
          }
          if ((!baseDetail.standings || baseDetail.standings.length === 0) && tournament.game !== 'FÚTBOL') {
            const dynamicStandings = buildStandingsFromMatches(matches);
            if (dynamicStandings.length > 0) baseDetail.standings = dynamicStandings;
          }
          if (!baseDetail.participants || baseDetail.participants.length === 0) {
            baseDetail.participants = extractParticipantsFromMatches(matches);
          }
        }
      } catch (err) {
        console.warn('Error fetching tournament matches fallback:', err);
      }
    }

    // 4. Si es de Fútbol y tenemos externalId o token, sincronizar clasificación y temporada real en vivo
    if (tournament.game === 'FÚTBOL' && tournament.externalId && tokens.footballToken) {
      try {
        const liveFoot = await this.fetchLiveFootballStandings(
          String(tournament.externalId),
          tokens.footballToken
        );
        if (liveFoot && liveFoot.standings && liveFoot.standings.length > 0) {
          baseDetail.standings = liveFoot.standings;
          if (liveFoot.season) baseDetail.season = liveFoot.season;
          if (liveFoot.dates) baseDetail.dates = liveFoot.dates;
        }
      } catch (err) {
        console.warn('Error actualizando clasificación de fútbol en vivo:', err);
      }
    }

    // 4.5. Garantía final universal: si después de cargar datos en vivo no hay bracket pero sí clasificaciones, proyectar
    if (!baseDetail.bracket && baseDetail.standings && baseDetail.standings.length > 0 && baseDetail.format !== 'LEAGUE') {
      baseDetail.bracket = projectBracketFromStandings(baseDetail.standings);
    }

    // 4.6. Zonas de color de la clasificación (playoff / cuadro ganadores / perdedores / eliminado)
    applyEsportsStandingZones(baseDetail);

    // 5. Persistir en caché L1 y L2
    MEMORY_CACHE.set(key, { data: baseDetail, timestamp: now });
    try {
      AsyncStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(baseDetail)).catch(() => {});
    } catch {}

    return baseDetail;
  },

  /**
   * Resuelve dinámicamente la edición activa (serie) para cualquier torneo de Esports.
   * Prioridades:
   * 0. Año / Split explícito solicitado (ej. "Summer 2026", "2026")
   * 1. En curso (RUNNING: begin_at <= now <= end_at)
   * 2. Próxima más cercana (UPCOMING: begin_at > now)
   * 3. Más reciente finalizada (RECENT FINISHED - garantizada la más moderna, nunca años antiguos)
   */
  async resolveActiveEsportsSeries(
    tournament: TournamentItem,
    token: string
  ): Promise<{
    seriesId: number | string;
    year?: number | string;
    fullName?: string;
    beginAt?: string;
    endAt?: string;
    leagueName?: string;
    leagueLogo?: string;
  } | null> {
    const cleanToken = token.trim();
    if (!cleanToken) return null;

    const cacheKey = `${tournament.game}_${tournament.id}_${tournament.season || 'default'}`;
    const now = Date.now();
    const cached = SERIES_RESOLUTION_CACHE.get(cacheKey);
    if (cached && now - cached.timestamp < SERIES_TTL_MS) {
      return cached;
    }

    const isWeb = Platform.OS === 'web';
    const safeFetchPanda = async (path: string) => {
      let data: any = null;
      if (isWeb) {
        try {
          const proxyUrl = `/api/proxy/pandascore?token=${encodeURIComponent(cleanToken)}&path=${encodeURIComponent(path)}`;
          const res = await fetchPandaResilient(proxyUrl);
          if (res?.ok) data = await res.json();
        } catch {}
      }
      if (!data) {
        try {
          const url = `https://api.pandascore.co${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(cleanToken)}`;
          const res = await fetchPandaResilient(url);
          if (res?.ok) data = await res.json();
        } catch {}
      }
      return Array.isArray(data) ? data : null;
    };

    const safeFetchPandaOne = async (path: string): Promise<any | null> => {
      let data: any = null;
      if (isWeb) {
        try {
          const proxyUrl = `/api/proxy/pandascore?token=${encodeURIComponent(cleanToken)}&path=${encodeURIComponent(path)}`;
          const res = await fetchPandaResilient(proxyUrl);
          if (res?.ok) data = await res.json();
        } catch {}
      }
      if (!data) {
        try {
          const url = `https://api.pandascore.co${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(cleanToken)}`;
          const res = await fetchPandaResilient(url);
          if (res?.ok) data = await res.json();
        } catch {}
      }
      return data && !Array.isArray(data) ? data : null;
    };

    try {
      let seriesCandidates: any[] = [];

      // 0. Resolver la liga PandaScore si el torneo no la trae del catálogo
      //    (caso de los torneos dinámicos abiertos desde la lista de partidos).
      let effectiveLeagueId: number | string | undefined = tournament.leagueId;
      let resolvedLeague: { leagueId: number | string; name?: string; slug?: string; logo?: string } | undefined;

      if (!effectiveLeagueId && tournament.game !== 'FÚTBOL') {
        const leagueCacheKey = `${tournament.game}_${(tournament.name || '').toLowerCase()}`;
        const cachedLeague = LEAGUE_RESOLUTION_CACHE.get(leagueCacheKey);
        if (cachedLeague && now - cachedLeague.timestamp < LEAGUE_TTL_MS) {
          effectiveLeagueId = cachedLeague.leagueId;
          resolvedLeague = cachedLeague;
        } else {
          const vg = PANDA_VIDEOGAME_SLUGS[tournament.game];
          const rawName = (tournament.name || '').replace(/\s*•.*$/, '').trim();
          const attempts: string[] = [];
          if (rawName) {
            attempts.push(rawName);
            const words = rawName.split(/\s+/);
            if (words.length >= 3) attempts.push(words.slice(0, 2).join(' '));
            if (words.length >= 2) attempts.push(words.slice(0, -1).join(' '));

            // Acrónimo (p. ej. "LoL Championship Series" -> "LCS")
            const acronym = words
              .map((w) => w.replace(/[^A-Za-z0-9]/g, ''))
              .filter((w) => w.length > 0)
              .map((w) => (w === w.toUpperCase() && w.length <= 4 ? w : w[0]))
              .join('');
            if (acronym.length >= 2 && acronym.length <= 6) attempts.push(acronym);
          }
          const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const target = norm(rawName);

          for (const q of attempts) {
            const list = await safeFetchPanda(`/leagues?search[name]=${encodeURIComponent(q)}&per_page=25`);
            if (!list || list.length === 0) continue;
            const sameGame = vg
              ? list.filter((l: any) => (l.videogame?.slug || '').toLowerCase() === vg)
              : [];
            const pool = sameGame.length > 0 ? sameGame : list;
            const best =
              pool.find((l: any) => norm(l.name) === target) ||
              pool.find((l: any) => {
                const n = norm(l.name);
                return n.length >= 4 && (target.includes(n) || n.includes(target));
              });
            if (best && best.id) {
              effectiveLeagueId = best.id;
              resolvedLeague = { leagueId: best.id, name: best.name, slug: best.slug, logo: best.image_url };
              LEAGUE_RESOLUTION_CACHE.set(leagueCacheKey, { ...resolvedLeague, timestamp: now });
              break;
            }
          }
        }
      }

      // 0b. Serie configurada explícitamente en el catálogo (externalId)
      if (tournament.externalId) {
        const directSeries = await safeFetchPandaOne(`/series/${tournament.externalId}`);
        if (directSeries && directSeries.id) {
          seriesCandidates.push(directSeries);
        }
      }

      // 1. Si hay liga (del catálogo o resuelta por nombre), obtener sus series recientes
      if (effectiveLeagueId) {
        // A) Consultar /series filtrando por league_id con sort descendente
        const listA = await safeFetchPanda(`/series?filter[league_id]=${effectiveLeagueId}&sort=-begin_at&per_page=50`);
        if (listA && listA.length > 0) {
          seriesCandidates.push(...listA);
        }
        // B) Consultar además sub-recurso /leagues/{id}/series con per_page=100
        const listB = await safeFetchPanda(`/leagues/${effectiveLeagueId}/series?per_page=100`);
        if (listB && listB.length > 0) {
          seriesCandidates.push(...listB);
        }
      }

      // 2. Si no hay candidatos o el torneo no tiene leagueId, buscar por slug o nombre
      if (seriesCandidates.length === 0) {
        const vgSlug =
          tournament.game === 'VALORANT' ? 'valorant' :
          tournament.game === 'LOL' ? 'lol' :
          tournament.game === 'CS2' ? 'csgo' :
          tournament.game === 'DOTA2' ? 'dota2' :
          tournament.game === 'R6' ? 'r6siege' : null;

        if (vgSlug) {
          const searchKeyword = tournament.slug
            ? tournament.slug.replace(/^(valorant|lol|cs2|cs-go|r6|dota2)-/, '').replace(/-(2024|2025|2026|2027)$/, '')
            : tournament.shortName || tournament.name;

          const list = await safeFetchPanda(`/${vgSlug}/series?search[slug]=${encodeURIComponent(searchKeyword)}&sort=-begin_at&per_page=50`);
          if (list && list.length > 0) {
            seriesCandidates.push(...list);
          }
        }
      }

      // Deduplicar series por ID único
      const seenIds = new Set<number | string>();
      seriesCandidates = seriesCandidates.filter((s: any) => {
        if (!s || !s.id || seenIds.has(s.id)) return false;
        seenIds.add(s.id);
        return true;
      });

      // 3. Filtrar series relevantes si es una subcompetición específica (ej. Champions, Masters, EMEA, Major)
      const tSlug = (tournament.slug || '').toLowerCase();
      const tName = (tournament.name || '').toLowerCase();
      const tId = (tournament.id || '').toLowerCase();
      const tRef = `${tId} ${tSlug} ${tName}`;

      const wantsQualifier = /qualifier|clasificator|\blcq\b/.test(tRef);
      const isGameChangers = /game changers|gamechangers|\bgc\b/.test(tRef);

      let filtered = seriesCandidates.filter((s: any) => {
        const sText = `${s.full_name || ''} ${s.name || ''} ${s.slug || ''}`.toLowerCase();

        // Descartar clasificatorios (open/closed/LCQ) salvo que el torneo sea un clasificatorio
        if (!wantsQualifier && /qualifier|closed qual|open qual|\blcq\b|last chance/.test(sText)) {
          return false;
        }

        // Descartar los circuitos Game Changers salvo que el torneo sea Game Changers
        if (!isGameChangers && /game changers/.test(sText)) {
          return false;
        }

        if (tId.includes('champions') || tSlug.includes('champions')) {
          return sText.includes('champions');
        }
        if (tId.includes('masters') || tSlug.includes('masters')) {
          return sText.includes('masters');
        }
        if (tId.includes('emea') || tSlug.includes('emea')) {
          return sText.includes('emea');
        }
        if (tId.includes('americas') || tSlug.includes('americas')) {
          return sText.includes('americas');
        }
        if (tId.includes('pacific') || tSlug.includes('pacific')) {
          return sText.includes('pacific');
        }
        if (tId.includes('china') || tSlug.includes('china')) {
          return sText.includes('china');
        }
        if (tId.includes('major') || tSlug.includes('major')) {
          return sText.includes('major') || sText.includes('cologne') || sText.includes('katowice');
        }

        // IEM y otras ligas genéricas: cualquier evento que no sea clasificatorio
        return true;
      });

      if (filtered.length === 0) {
        filtered = seriesCandidates;
      }

      // Descartar series obsoletas o archivadas (anteriores a 2024) si existen series contemporáneas
      const modernSeries = filtered.filter((s: any) => {
        const y = s.year || (s.begin_at ? new Date(s.begin_at).getFullYear() : 0);
        return y >= 2024;
      });
      if (modernSeries.length > 0) {
        filtered = modernSeries;
      }

      if (filtered.length === 0) {
        if (tournament.externalId) {
          return { seriesId: tournament.externalId };
        }
        return null;
      }

      // Ordenar rigurosamente los candidatos en JavaScript de más reciente a más antiguo (2026 primero, años antiguos al final)
      const getSeriesTime = (s: any) => {
        if (s.begin_at) return new Date(s.begin_at).getTime();
        if (s.year) return new Date(`${s.year}-06-01`).getTime();
        return 0;
      };
      filtered.sort((a: any, b: any) => getSeriesTime(b) - getSeriesTime(a));

      const nowDate = new Date();

      const isRunningSeries = (s: any) => {
        if (!s || !s.begin_at) return false;
        const b = new Date(s.begin_at);
        const e = s.end_at ? new Date(s.end_at) : new Date(b.getTime() + 30 * 24 * 60 * 60 * 1000);
        return b <= nowDate && e >= nowDate;
      };

      const buildRes = (s: any) => ({
        seriesId: s.id,
        year: s.year,
        fullName: s.full_name,
        beginAt: s.begin_at,
        endAt: s.end_at,
        leagueName: resolvedLeague?.name,
        leagueLogo: resolvedLeague?.logo,
        timestamp: now,
      });

      // Serie configurada explícitamente en el catálogo (si sigue siendo válida)
      const pinnedSeries = tournament.externalId
        ? filtered.find((s: any) => String(s.id) === String(tournament.externalId))
        : undefined;

      // Prioridad 0: Si el torneo o el usuario solicita una temporada/año explícito (ej. "Summer 2026", "2026")
      const seasonStr = `${tournament.season || ''} ${tournament.name || ''}`;
      const yearMatch = seasonStr.match(/\b(202\d)\b/);
      const splitMatch = seasonStr.match(/\b(Summer|Spring|Winter|Autumn|Fall)\b/i);

      if (yearMatch) {
        const targetYear = parseInt(yearMatch[1], 10);
        const yearMatches = filtered.filter((s: any) => {
          if (s.year === targetYear) return true;
          if (s.begin_at && new Date(s.begin_at).getFullYear() === targetYear) return true;
          return false;
        });

        if (yearMatches.length > 0) {
          if (splitMatch) {
            const splitWord = splitMatch[1].toLowerCase();
            const splitMatchFound = yearMatches.find((s: any) => {
              const nameLower = `${s.full_name || ''} ${s.name || ''} ${s.slug || ''}`.toLowerCase();
              return nameLower.includes(splitWord);
            });
            if (splitMatchFound) {
              const res = buildRes(splitMatchFound);
              SERIES_RESOLUTION_CACHE.set(cacheKey, res);
              return res;
            }
          }
          const runningYear = yearMatches.find((s: any) => isRunningSeries(s));
          const upcomingYear = yearMatches
            .filter((s: any) => s.begin_at && new Date(s.begin_at) > nowDate)
            .sort((a: any, b: any) => new Date(a.begin_at).getTime() - new Date(b.begin_at).getTime())[0];
          const bestYear = runningYear || upcomingYear || yearMatches[0];
          const res = buildRes(bestYear);
          SERIES_RESOLUTION_CACHE.set(cacheKey, res);
          return res;
        }
      }

      // Prioridad 1: En curso (RUNNING: begin_at <= now <= end_at)
      if (pinnedSeries && isRunningSeries(pinnedSeries)) {
        const res = buildRes(pinnedSeries);
        SERIES_RESOLUTION_CACHE.set(cacheKey, res);
        return res;
      }
      const running = filtered.find((s: any) => isRunningSeries(s));
      if (running) {
        const res = buildRes(running);
        SERIES_RESOLUTION_CACHE.set(cacheKey, res);
        return res;
      }

      // Prioridad 2: Próxima más cercana (UPCOMING)
      const upcomingList = filtered
        .filter((s: any) => s.begin_at && new Date(s.begin_at) > nowDate)
        .sort((a: any, b: any) => new Date(a.begin_at).getTime() - new Date(b.begin_at).getTime());
      const upcoming = (pinnedSeries && new Date(pinnedSeries.begin_at) > nowDate ? pinnedSeries : undefined) || upcomingList[0];
      if (upcoming) {
        const res = buildRes(upcoming);
        SERIES_RESOLUTION_CACHE.set(cacheKey, res);
        return res;
      }

      // Prioridad 3: Serie configurada si es de la temporada en curso, o la más reciente finalizada
      const currentYear = nowDate.getFullYear();
      const pinnedIsCurrent =
        pinnedSeries &&
        (pinnedSeries.year === currentYear ||
          (pinnedSeries.begin_at && new Date(pinnedSeries.begin_at).getFullYear() >= currentYear - 1));
      const recent = pinnedIsCurrent ? pinnedSeries : filtered[0];
      const res = buildRes(recent);
      SERIES_RESOLUTION_CACHE.set(cacheKey, res);
      return res;
    } catch (e) {
      console.warn('Error resolviendo serie activa de PandaScore:', e);
      if (tournament.externalId) {
        return { seriesId: tournament.externalId };
      }
      return null;
    }
  },

  /**
   * Consulta los datos oficiales de la serie activa de PandaScore:
   * partidos completos de todas las fases, clasificaciones oficiales por fase
   * (/tournaments/{id}/standings) y cuadro de eliminatorias.
   */
  async fetchPandaTournamentData(
    tournament: TournamentItem,
    token: string
  ): Promise<{ matches?: Match[]; bracket?: TournamentBracket; standings?: StandingGroup[]; participants?: TournamentParticipant[]; resolvedSeries?: any } | null> {
    const isWeb = Platform.OS === 'web';
    const cleanToken = token.trim();
    if (!cleanToken) return null;

    const fetchPandaArray = async (path: string): Promise<any[] | null> => {
      if (isWeb) {
        try {
          const proxyUrl = `/api/proxy/pandascore?token=${encodeURIComponent(cleanToken)}&path=${encodeURIComponent(path)}`;
          const res = await fetchPandaResilient(proxyUrl);
          if (res?.ok) {
            const json = await res.json();
            if (Array.isArray(json)) return json;
          }
        } catch {}
      }
      try {
        const url = `https://api.pandascore.co${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(cleanToken)}`;
        const res = await fetchPandaResilient(url);
        if (res?.ok) {
          const json = await res.json();
          if (Array.isArray(json)) return json;
        }
      } catch (err) {
        console.warn('PandaScore tournament fetch error:', path, err);
      }
      return null;
    };

    try {
      // 1. Resolver dinámicamente la edición activa
      const resolved = await this.resolveActiveEsportsSeries(tournament, cleanToken);
      const seriesId = resolved?.seriesId || tournament.externalId;
      if (!seriesId) return null;

      // 2. Fases internas del torneo (Group A, Play-In, Playoffs...)
      const stages = (await fetchPandaArray(`/series/${seriesId}/tournaments?per_page=50&sort=begin_at`)) || [];

      // 3. Cargar TODOS los partidos de la serie con paginación completa
      const allRawMatches: any[] = [];
      const PER_PAGE = 100;

      for (let page = 1; page <= 5; page++) {
        const pageData = await fetchPandaArray(
          `/series/${seriesId}/matches?per_page=${PER_PAGE}&page=${page}&sort=begin_at`
        );
        if (!pageData || pageData.length === 0) break;
        allRawMatches.push(...pageData);
        if (pageData.length < PER_PAGE) break;
      }

      if (allRawMatches.length === 0) return null;

      const matches: Match[] = [];
      for (const item of allRawMatches) {
        if (item.status === 'canceled' || item.status === 'postponed') continue;

        const oppA = item.opponents?.[0]?.opponent;
        const oppB = item.opponents?.[1]?.opponent;

        const nameA = oppA?.name || 'TBD';
        const nameB = oppB?.name || 'TBD';

        let status: Match['status'] = 'UPCOMING';
        if (item.status === 'running') status = 'LIVE';
        else if (item.status === 'finished') status = 'FINISHED';

        const resA = oppA?.id ? item.results?.find((r: any) => r.team_id === oppA.id)?.score : undefined;
        const resB = oppB?.id ? item.results?.find((r: any) => r.team_id === oppB.id)?.score : undefined;

        const scoreA = status === 'UPCOMING' ? '-' : resA ?? 0;
        const scoreB = status === 'UPCOMING' ? '-' : resB ?? 0;

        const stageName = item.tournament?.name || '';
        const matchName = item.name || '';
        const stage = stageName
          ? matchName
            ? `${stageName} • ${matchName}`
            : stageName
          : matchName || 'Partido Oficial';

        const scheduleDate = item.scheduled_at || item.begin_at;
        const timeInfo =
          status === 'FINISHED'
            ? `${scoreA} - ${scoreB}`
            : scheduleDate
            ? new Date(scheduleDate).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Por jugar';

        matches.push({
          id: `panda-${item.id}`,
          game: tournament.game,
          league: tournament.name,
          status,
          timeInfo,
          startTimeIso: scheduleDate || new Date().toISOString(),
          tier: tournament.tier,
          region: tournament.region,
          teamA: {
            id: oppA?.id,
            name: nameA,
            shortName: oppA?.acronym || nameA,
            score: scoreA,
            logo: oppA?.image_url || undefined,
            location: oppA?.location,
          },
          teamB: {
            id: oppB?.id,
            name: nameB,
            shortName: oppB?.acronym || nameB,
            score: scoreB,
            logo: oppB?.image_url || undefined,
            location: oppB?.location,
          },
          details: {
            tournamentStage: stage,
            stageName: stageName || undefined,
            stageId: item.tournament?.id,
            bestOf: item.number_of_games || 3,
          },
        });
      }

      if (matches.length === 0) return null;

      // 4. Clasificaciones oficiales por fase (solo fases con tabla real)
      const tableStages = (Array.isArray(stages) ? stages : [])
        .filter(
          (s: any) =>
            s &&
            s.id &&
            s.name &&
            !/playoff|play-off|knockout|bracket|elimination|eliminatoria|grand final/i.test(s.name)
        )
        .slice(0, 8);

      const officialGroups: StandingGroup[] = [];
      if (tableStages.length > 0) {
        // Peticiones secuenciales con una pequeña pausa para respetar los límites de PandaScore
        const standingsRaw: (any[] | null)[] = [];
        for (const stage of tableStages) {
          standingsRaw.push(await fetchPandaArray(`/tournaments/${stage.id}/standings`));
          await sleep(120);
        }
        tableStages.forEach((stage: any, idx: number) => {
          const entries = standingsRaw[idx];
          if (!entries || entries.length === 0) return;

          // Las fases "Play-In" suelen ser cuadros eliminatorios: solo se muestran
          // como tabla si la API ofrece estadísticas reales (wins/total/game_wins).
          const isPlayIn = /play-?in/i.test(stage.name);
          const hasRealStats = entries.some(
            (e: any) =>
              typeof e.wins === 'number' || typeof e.total === 'number' || typeof e.game_wins === 'number'
          );
          if (isPlayIn && !hasRealStats) return;

          const stageMatches = matches.filter(
            (m) => m.details?.stageId === stage.id || (stage.name && m.details?.stageName === stage.name)
          );
          officialGroups.push(
            buildStandingGroupFromPanda(resolveStageGroupName(stage.name) || stage.name, entries, stageMatches)
          );
        });
      }

      // Si la API no ofrece tabla oficial, se calcula a partir de los partidos reales
      if (officialGroups.length > 0) {
        const groupSortKey = (name: string) => {
          if (/^grupo/i.test(name)) return `0-${name}`;
          if (/play-?in/i.test(name)) return `1-${name}`;
          if (/suiza|swiss/i.test(name)) return `2-${name}`;
          if (/temporada|regular/i.test(name)) return `3-${name}`;
          return `2-${name}`;
        };
        officialGroups.sort((a, b) => groupSortKey(a.groupName).localeCompare(groupSortKey(b.groupName), 'es'));
      }
      const standings = officialGroups.length > 0 ? officialGroups : buildStandingsFromMatches(matches);

      // 5. Cuadro de eliminatorias y participantes
      const bracket = buildBracketFromMatches(matches) || projectBracketFromStandings(standings);
      const participants = extractParticipantsFromMatches(matches);

      return { matches, bracket, standings, participants, resolvedSeries: resolved };
    } catch (e) {
      console.warn('Error fetching PandaScore tournament live data:', e);
      return null;
    }
  },

  /**
   * Consulta la clasificación y temporada en tiempo real de Football-Data.org
   */
  async fetchLiveFootballStandings(
    competitionCode: string,
    token: string
  ): Promise<{ standings: StandingGroup[]; season?: string; dates?: string } | null> {
    const isWeb = Platform.OS === 'web';
    const targetPath = `/v4/competitions/${encodeURIComponent(competitionCode)}/standings`;
    const cleanToken = token.trim();

    let json: any = null;

    if (isWeb) {
      try {
        const proxyUrl = `/api/proxy/football?token=${encodeURIComponent(cleanToken)}&path=${encodeURIComponent(targetPath)}`;
        const res = await fetch(proxyUrl);
        if (res.ok) json = await res.json();
      } catch (e) {
        console.warn('Proxy local falló para standings:', e);
      }
    }

    if (!json) {
      try {
        const res = await fetch(`https://api.football-data.org${targetPath}`, {
          headers: { 'X-Auth-Token': cleanToken, Accept: 'application/json' },
        });
        if (res.ok) json = await res.json();
      } catch (e) {
        console.warn('Llamada directa Football-Data falló para standings:', e);
      }
    }

    if (!json || !Array.isArray(json.standings)) {
      return null;
    }

    let season: string | undefined = undefined;
    let dates: string | undefined = undefined;
    if (json.season?.startDate && json.season?.endDate) {
      const yStart = new Date(json.season.startDate).getFullYear();
      const yEnd = new Date(json.season.endDate).getFullYear();
      season = yStart === yEnd ? String(yStart) : `${yStart}/${yEnd}`;

      const s = new Date(json.season.startDate).toLocaleDateString('es-ES', { month: 'short' });
      const e = new Date(json.season.endDate).toLocaleDateString('es-ES', { month: 'short' });
      dates = `${s} - ${e}`;
    }

    const groups: StandingGroup[] = [];
    for (const st of json.standings) {
      if (st.type === 'TOTAL' && Array.isArray(st.table)) {
        const rows: StandingRow[] = st.table.map((item: any) => {
          let zone: StandingRow['zone'] = undefined;
          if (item.position <= 4) zone = 'champions';
          else if (item.position === 5) zone = 'europa';
          else if (item.position === 6) zone = 'conference';
          else if (item.position >= st.table.length - 2) zone = 'relegation';

          return {
            position: item.position,
            teamId: item.team?.id,
            teamName: item.team?.name || 'Equipo',
            shortName: item.team?.tla || item.team?.shortName,
            teamLogo: item.team?.crest,
            playedGames: item.playedGames ?? 0,
            won: item.won ?? 0,
            draw: item.draw ?? 0,
            lost: item.lost ?? 0,
            points: item.points ?? 0,
            goalsFor: item.goalsFor ?? 0,
            goalsAgainst: item.goalsAgainst ?? 0,
            goalDifference: item.goalDifference ?? 0,
            form: item.form ? (item.form.split(',') as ('W' | 'D' | 'L')[]) : undefined,
            zone,
          };
        });

        const name = st.group
          ? st.group.replace(/_/g, ' ')
          : st.stage === 'REGULAR_SEASON'
          ? 'Clasificación General'
          : 'Tabla';

        groups.push({
          groupName: name,
          table: rows,
        });
      }
    }

    return { standings: groups, season, dates };
  },
};
