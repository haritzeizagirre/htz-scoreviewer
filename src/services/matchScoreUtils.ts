import { Match } from './types';

/** Convierte un marcador (número o texto) a número; NaN si no es válido. */
export function toScoreNumber(value: number | string | undefined | null): number {
  if (value === undefined || value === null) return NaN;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  return isNaN(n) ? NaN : n;
}

/**
 * ¿El marcador de rondas en directo pertenece ya a un mapa terminado?
 *
 * Cuando un mapa de Valorant/CS2/R6 llega a su puntuación de victoria (13-8, 7-3...),
 * el tanteo de rondas ya no debe mostrarse junto al marcador de mapas de la serie
 * (1-0 + 13-8 confunde): se oculta hasta que arranque el siguiente mapa.
 */
export function isLiveRoundScoreFinished(match: Match): boolean {
  const round = match.liveRoundScore;
  if (!round) return false;

  // 1. El propio tanteo: un mapa no puede seguir "en juego" con la puntuación de
  //    victoria ya alcanzada (13-x en Valorant/CS2, 7-x en R6 con ventaja de 2).
  const a = toScoreNumber(round.scoreA);
  const b = toScoreNumber(round.scoreB);
  if (!isNaN(a) && !isNaN(b)) {
    if (match.game === 'VALORANT' || match.game === 'CS2') {
      if ((a >= 13 && a - b >= 2) || (b >= 13 && b - a >= 2)) return true;
    } else if (match.game === 'R6') {
      if ((a >= 7 && a - b >= 2) || (b >= 7 && b - a >= 2)) return true;
    }
  }

  // 2. El desglose de mapas dice si el mapa del marcador ya terminó.
  const breakdown = match.details?.gamesBreakdown;
  if (breakdown && breakdown.length > 0 && typeof round.mapNumber === 'number') {
    const map = breakdown.find((g) => g.position === round.mapNumber);
    if (map) return map.status === 'finished';
  }

  return false;
}

/**
 * Número del mapa que se está jugando ahora mismo (o el siguiente por empezar):
 * 1) el mapa marcado como "running" en el desglose,
 * 2) el mapNumber explícito si es válido (> 1),
 * 3) los mapas ya decididos en la serie + 1.
 */
export function getCurrentMapNumber(match: Match): number {
  const breakdown = match.details?.gamesBreakdown;
  const running = breakdown?.find((g) => g.status === 'running');
  if (running && running.position > 0) return running.position;

  const explicit = match.liveRoundScore?.mapNumber;
  let mapNumber = explicit && explicit > 1 ? explicit : 0;

  if (mapNumber === 0) {
    const numA = toScoreNumber(match.teamA.score);
    const numB = toScoreNumber(match.teamB.score);
    const decided = (isNaN(numA) ? 0 : numA) + (isNaN(numB) ? 0 : numB);
    mapNumber = decided + 1;
  }

  const bestOf = match.details?.bestOf;
  if (bestOf && bestOf > 0) mapNumber = Math.min(mapNumber, bestOf);

  return Math.max(1, mapNumber);
}
