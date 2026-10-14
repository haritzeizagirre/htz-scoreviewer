import {
  FootballEvent,
  FootballLineupPlayer,
  FootballMatchDetail,
  FootballTeamLineup,
  Match,
  MatchGoal,
} from '../../services/types';

/** Tipo de incidencia de la cronología unificada. */
export type TimelineKind = 'goal' | 'yellow' | 'red' | 'yellow_red' | 'sub' | 'var';

export interface TimelineRow {
  key: string;
  minute?: number | null;
  injuryTime?: number | null;
  kind: TimelineKind;
  team?: 'A' | 'B';
  title: string;
  subtitle?: string;
  /** Marcador tras el gol ("1-0"), si la fuente lo trae. */
  score?: string;
}

export const CARD_LABEL: Record<string, string> = {
  YELLOW: 'Tarjeta amarilla',
  RED: 'Tarjeta roja',
  YELLOW_RED: 'Segunda amarilla · expulsión',
};

const GOAL_TYPE_LABEL: Record<string, string> = {
  PENALTY: 'Penalti',
  OWN_GOAL: 'En propia puerta',
};

/** Posiciones de Football-Data (inglés) al castellano. */
const POSITION_ES: Record<string, string> = {
  Goalkeeper: 'Portero',
  'Centre-Back': 'Defensa central',
  'Left-Back': 'Lateral izquierdo',
  'Right-Back': 'Lateral derecho',
  'Defensive Midfield': 'Pivote',
  'Central Midfield': 'Mediocentro',
  'Attacking Midfield': 'Mediapunta',
  'Left Midfield': 'Interior izquierdo',
  'Right Midfield': 'Interior derecho',
  'Left Winger': 'Extremo izquierdo',
  'Right Winger': 'Extremo derecho',
  'Left Wing-Back': 'Carrilero izquierdo',
  'Right Wing-Back': 'Carrilero derecho',
  'Centre-Forward': 'Delantero centro',
  Striker: 'Delantero',
  Offence: 'Delantero',
  Defence: 'Defensa',
  Midfield: 'Centrocampista',
};

export function translatePosition(pos?: string): string | undefined {
  if (!pos) return undefined;
  return POSITION_ES[pos] || pos;
}

/** "34'" o "45+2'" a partir del minuto y el añadido. */
export function formatMinute(minute?: number | null, injuryTime?: number | null): string {
  if (minute === undefined || minute === null) return '—';
  const extra = typeof injuryTime === 'number' && injuryTime > 0 ? `+${injuryTime}` : '';
  return `${minute}${extra}'`;
}

/** Gol -> fila de cronología (compartido por detalle real y respaldo). */
function goalToRow(g: MatchGoal, idx: number): TimelineRow {
  const bits: string[] = [];
  const typeLabel = g.type ? GOAL_TYPE_LABEL[g.type.toUpperCase()] : undefined;
  if (typeLabel) bits.push(typeLabel);
  if (g.assist) bits.push(`Asistencia de ${g.assist}`);
  return {
    key: `goal-${idx}-${g.minute}-${g.scorer || ''}`,
    minute: g.minute,
    injuryTime: g.injuryTime,
    kind: 'goal',
    team: g.team,
    title: g.scorer || 'Gol',
    subtitle: bits.join(' · ') || undefined,
    score:
      typeof g.scoreA === 'number' && typeof g.scoreB === 'number'
        ? `${g.scoreA}-${g.scoreB}`
        : undefined,
  };
}

/** Cronología completa (goles, tarjetas, cambios y VAR) del detalle real. */
export function buildTimelineFromDetail(detail: FootballMatchDetail): TimelineRow[] {
  const rows: TimelineRow[] = [];

  detail.goals.forEach((g, idx) => rows.push(goalToRow(g, idx)));

  detail.bookings.forEach((b, idx) => {
    rows.push({
      key: `card-${idx}-${b.minute}-${b.player || ''}`,
      minute: b.minute,
      injuryTime: b.injuryTime,
      kind: b.card === 'RED' ? 'red' : b.card === 'YELLOW_RED' ? 'yellow_red' : 'yellow',
      team: b.team,
      title: b.player || CARD_LABEL[b.card],
      subtitle: CARD_LABEL[b.card],
    });
  });

  detail.substitutions.forEach((s, idx) => {
    rows.push({
      key: `sub-${idx}-${s.minute}-${s.playerIn || ''}`,
      minute: s.minute,
      injuryTime: s.injuryTime,
      kind: 'sub',
      team: s.team,
      title: s.playerIn || 'Cambio',
      subtitle: s.playerOut ? `Entra por ${s.playerOut}` : undefined,
    });
  });

  (detail.goalCancels || []).forEach((c, idx) => {
    rows.push({
      key: c.key || `var-${idx}-${c.minute}`,
      minute: c.minute,
      injuryTime: c.injuryTime,
      kind: 'var',
      team: c.team,
      title: c.player || 'Gol anulado',
      subtitle: 'Anulado por el VAR',
    });
  });

  return rows;
}

/** Cronología de respaldo con los datos que ya trae el partido (sin detalle). */
export function buildTimelineFallback(match: Match): TimelineRow[] {
  const goals = match.details?.goals || [];
  if (goals.length > 0) return goals.map(goalToRow);

  const events: FootballEvent[] = match.details?.footballEvents || [];
  return events.map((e, idx) => ({
    key: `evt-${idx}-${e.minute}-${e.player}`,
    minute: e.minute,
    kind:
      e.type === 'goal'
        ? 'goal'
        : e.type === 'card_red'
        ? 'red'
        : e.type === 'sub'
        ? 'sub'
        : 'yellow',
    team: e.team,
    title: e.player,
    subtitle: e.detail,
  }));
}

const KIND_ORDER: Record<TimelineKind, number> = {
  goal: 0,
  red: 1,
  yellow_red: 1,
  var: 1,
  yellow: 2,
  sub: 3,
};

export function sortTimeline(rows: TimelineRow[]): TimelineRow[] {
  return [...rows].sort((a, b) => {
    const ma = a.minute ?? Number.MAX_SAFE_INTEGER;
    const mb = b.minute ?? Number.MAX_SAFE_INTEGER;
    if (ma !== mb) return ma - mb;
    const ia = a.injuryTime || 0;
    const ib = b.injuryTime || 0;
    if (ia !== ib) return ia - ib;
    return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  });
}

// ---------------------------------------------------------------------------
// Aportación de jugadores (goles/asistencias/tarjetas por nombre)
// ---------------------------------------------------------------------------

export interface PlayerContribution {
  goals: number;
  assists: number;
  yellow: number;
  red: number;
}

const EMPTY_CONTRIBUTION: PlayerContribution = { goals: 0, assists: 0, yellow: 0, red: 0 };

/** Clave de nombre tolerante a acentos y mayúsculas para cruzar jugador y eventos. */
export function normalizePlayerName(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Goles, asistencias y tarjetas por jugador a partir del detalle real. */
export function buildContributions(
  detail: FootballMatchDetail | null
): Map<string, PlayerContribution> {
  const map = new Map<string, PlayerContribution>();
  if (!detail) return map;

  const contributionFor = (name?: string): PlayerContribution | null => {
    const key = normalizePlayerName(name || '');
    if (!key) return null;
    let entry = map.get(key);
    if (!entry) {
      entry = { ...EMPTY_CONTRIBUTION };
      map.set(key, entry);
    }
    return entry;
  };

  detail.goals.forEach((g) => {
    const scorer = contributionFor(g.scorer);
    if (scorer) scorer.goals += 1;
    const assist = contributionFor(g.assist);
    if (assist) assist.assists += 1;
  });

  detail.bookings.forEach((b) => {
    const entry = contributionFor(b.player);
    if (!entry) return;
    if (b.card === 'YELLOW') entry.yellow += 1;
    else if (b.card === 'RED') entry.red += 1;
    else {
      entry.yellow += 1;
      entry.red += 1;
    }
  });

  return map;
}

export function contributionOf(
  map: Map<string, PlayerContribution>,
  name: string
): PlayerContribution {
  return map.get(normalizePlayerName(name)) || EMPTY_CONTRIBUTION;
}

/** Color del chip de valoración (verde para notas altas, rojo para bajas). */
export function ratingColor(rating?: number | null): string {
  if (rating == null) return '#737373';
  if (rating >= 8) return '#22C55E';
  if (rating >= 7) return '#84CC16';
  if (rating >= 6) return '#FBBF24';
  return '#F87171';
}

/** "Tjark Ernst" -> "T. Ernst"; los nombres de una palabra se dejan igual. */
export function shortPlayerName(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

// ---------------------------------------------------------------------------
// Colocación de los jugadores en el campo
// ---------------------------------------------------------------------------

export interface PitchSpot {
  player: FootballLineupPlayer;
  /** 0 = banda izquierda, 1 = banda derecha (coordenada de pintado). */
  x: number;
  /** 0 = meta propia abajo, 1 = campo rival arriba (coordenada de pintado). */
  y: number;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

const GK_WORDS = /goalkeep|portero|goalie|keeper/i;
const MID_WORDS = /midfield|centrocamp|pivote|medio|volante|mediocentro|interior/i;
const DEF_WORDS = /defen|back|defensor|lateral|zagueiro|central|carrilero/i;
const ATT_WORDS = /forward|delantero|extrem|winger|striker|offence|attacker|punta|ariete/i;

/** Línea del jugador a partir de su posición (genérica o detallada). */
export function positionGroup(position?: string): 'GK' | 'DEF' | 'MID' | 'ATT' {
  const pos = (position || '').toLowerCase();
  if (!pos) return 'MID';
  if (GK_WORDS.test(pos)) return 'GK';
  if (MID_WORDS.test(pos)) return 'MID';
  if (DEF_WORDS.test(pos)) return 'DEF';
  if (ATT_WORDS.test(pos)) return 'ATT';
  return 'MID';
}

/** 0 = izquierda, 1 = centro, 2 = derecha (para ordenar cada línea). */
function sideHint(position?: string): number {
  const pos = (position || '').toLowerCase();
  if (/left|izquierd/.test(pos)) return 0;
  if (/right|derech/.test(pos)) return 2;
  return 1;
}

/** Reparto por líneas (portero abajo) cuando la fuente no trae coordenadas. */
function fallbackSpots(lineup: FootballTeamLineup): PitchSpot[] {
  const groups: Record<'GK' | 'DEF' | 'MID' | 'ATT', FootballLineupPlayer[]> = {
    GK: [],
    DEF: [],
    MID: [],
    ATT: [],
  };
  lineup.starters.forEach((p) => groups[positionGroup(p.position)].push(p));

  (Object.keys(groups) as (keyof typeof groups)[]).forEach((key) => {
    groups[key] = groups[key]
      .map((p, idx) => ({ p, idx }))
      .sort((a, b) => sideHint(a.p.position) - sideHint(b.p.position) || a.idx - b.idx)
      .map((entry) => entry.p);
  });

  const rows = [groups.GK, groups.DEF, groups.MID, groups.ATT].filter((row) => row.length > 0);
  const bottomY = 0.9;
  const topY = 0.18;
  const step = rows.length > 1 ? (bottomY - topY) / (rows.length - 1) : 0;

  const spots: PitchSpot[] = [];
  rows.forEach((row, rowIdx) => {
    const y = bottomY - rowIdx * step;
    row.forEach((p, idx) => {
      spots.push({ player: p, x: (idx + 1) / (row.length + 1), y });
    });
  });
  return spots;
}

/**
 * Posiciones de pintado de los titulares. Si la fuente publica coordenadas
 * (`pitchX`/`pitchY`, con 0 = portería propia) se usan tal cual invirtiendo el
 * eje vertical; si no, se reparten por líneas según la posición.
 */
export function computePitchSpots(lineup?: FootballTeamLineup): PitchSpot[] {
  const starters = lineup?.starters || [];
  if (starters.length === 0) return [];

  const allPlaced = starters.every(
    (p) => typeof p.pitchX === 'number' && typeof p.pitchY === 'number'
  );
  if (allPlaced) {
    return starters.map((p) => ({
      player: p,
      x: clamp01(p.pitchX as number),
      y: clamp01(1 - (p.pitchY as number)),
    }));
  }
  return fallbackSpots(lineup as FootballTeamLineup);
}
