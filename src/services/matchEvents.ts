/**
 * Motor de eventos de partido para las alertas (Fase 1, sin servidor).
 *
 * Módulo PURO (solo depende de tipos): compara el estado de un partido entre
 * dos cargas consecutivas y produce notificaciones (inicio, gol, descanso,
 * final, fin de mapa, resultado de serie). Sin React, sin red, sin storage,
 * para poder testearlo de forma aislada.
 *
 * Reglas anti-ruido:
 * - Sin estado anterior no se genera nada (abrir la app a mitad de partido no
 *   dispara un aluvión de avisos).
 * - Con la foto anterior antigua (app en segundo plano, fuente caída...) los
 *   avisos "de momento" (inicio, gol, descanso, fin de mapa) se descartan: ya
 *   no aportan nada. Los resultados finales sí se avisan siempre.
 */
import {
  FootballBooking,
  Match,
  MatchGoal,
  MatchStatus,
  NotificationEventKey,
  NotificationEventPrefs,
  NotificationSettings,
  SportCategory,
} from './types';

/** Estado resumido de un partido en una carga concreta. */
export interface MatchSnapshot {
  status: MatchStatus;
  scoreA: number | string;
  scoreB: number | string;
  roundOrTime?: string;
  /** Mapas/juegos ya finalizados, por posición (con marcador si se conoce). */
  finishedMaps: Record<
    number,
    { mapName: string; winner?: 'A' | 'B'; scoreA?: number | string; scoreB?: number | string }
  >;
  /** Claves de incidencias ya vistas (rojas, goles anulados): evita repetir avisos. */
  incidents?: string[];
  /** Momento (epoch ms) en que se tomó esta foto; evita avisos tardíos. */
  seenAt?: number;
}

export interface PendingNotification {
  dedupeKey: string;
  event: NotificationEventKey;
  title: string;
  body: string;
  /** Deporte del partido: en Android elige el canal de notificación. */
  game?: SportCategory;
}

/** La foto anterior más antigua que esto ya no sirve para avisar del inicio. */
export const KICKOFF_MAX_AGE_MS = 12 * 60_000;
/**
 * Si el partido empezó hace más de esto cuando lo detectamos "en directo", el
 * aviso de inicio ya no aporta nada (caso típico: fuente con retraso y el
 * partido ya va 5-0). Se omite.
 */
export const KICKOFF_MAX_START_AGE_MS = 10 * 60_000;
/** La foto anterior más antigua que esto ya no sirve para avisos "en vivo". */
export const LIVE_EVENT_MAX_AGE_MS = 30 * 60_000;

function toNum(value: number | string): number | null {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  return isNaN(n) ? null : n;
}

/** Clave estable de una roja / segunda amarilla (para no repetir el aviso). */
export function redCardKey(b: FootballBooking): string {
  return `red:${b.minute}+${b.injuryTime || 0}:${b.player || '?'}`;
}

export function toMatchSnapshot(m: Match, nowMs: number = Date.now()): MatchSnapshot {
  const finishedMaps: MatchSnapshot['finishedMaps'] = {};
  for (const g of m.details?.gamesBreakdown || []) {
    if (g.status === 'finished') {
      finishedMaps[g.position] = {
        mapName: g.mapName || `Mapa ${g.position}`,
        winner: g.winnerTeam,
        scoreA: g.scoreA,
        scoreB: g.scoreB,
      };
    }
  }
  const incidents = [
    ...(m.details?.redCards || []).map(redCardKey),
    ...(m.details?.goalCancels || []).map((c) => c.key),
  ];
  return {
    status: m.status,
    scoreA: m.teamA.score,
    scoreB: m.teamB.score,
    roundOrTime: m.liveRoundScore?.roundOrTime,
    finishedMaps,
    incidents,
    seenAt: nowMs,
  };
}

/** "34'" o "45+2'" a partir del minuto y el añadido. */
function formatGoalMinute(g: MatchGoal): string {
  const extra = typeof g.injuryTime === 'number' && g.injuryTime > 0 ? `+${g.injuryTime}` : '';
  return `${g.minute}${extra}'`;
}

/** Marcador corto de un mapa si ambas cifras son numéricas (" · 13-10"). */
function mapScoreSuffix(map: { scoreA?: number | string; scoreB?: number | string }): string {
  const a = map.scoreA;
  const b = map.scoreB;
  const hasA = typeof a === 'number' || (typeof a === 'string' && a.trim() !== '');
  const hasB = typeof b === 'number' || (typeof b === 'string' && b.trim() !== '');
  if (!hasA || !hasB) return '';
  return ` · ${a}-${b}`;
}

/**
 * Compara el partido con su estado anterior y devuelve los eventos nuevos.
 * Si no hay estado anterior (primera vez que se ve el partido) no genera nada:
 * así abrir la app en mitad de un partido no dispara un aluvión de avisos.
 */
export function diffMatchEvents(
  match: Match,
  prev: MatchSnapshot | undefined,
  prefs: NotificationEventPrefs,
  nowMs: number = Date.now()
): PendingNotification[] {
  const out: PendingNotification[] = [];
  if (!prev) return out;

  const isFootball = match.game === 'FÚTBOL';
  const shortA = match.teamA.shortName || match.teamA.name;
  const shortB = match.teamB.shortName || match.teamB.name;
  const league = match.league;

  // Antigüedad de la foto anterior: descarta avisos que llegan demasiado tarde
  // (app vuelta de segundo plano, fuente caída, servidor recuperado...).
  const prevAgeMs = typeof prev.seenAt === 'number' ? Math.max(0, nowMs - prev.seenAt) : 0;
  const kickoffFresh = prevAgeMs <= KICKOFF_MAX_AGE_MS;
  const liveFresh = prevAgeMs <= LIVE_EVENT_MAX_AGE_MS;

  // 1. Inicio del partido/serie (solo si acaba de empezar de verdad)
  const startMs = new Date(match.startTimeIso).getTime();
  const startAgeOk =
    isNaN(startMs) || startMs > nowMs || nowMs - startMs <= KICKOFF_MAX_START_AGE_MS;
  if (prefs.kickoff && kickoffFresh && startAgeOk && prev.status !== 'LIVE' && match.status === 'LIVE') {
    out.push({
      dedupeKey: `${match.id}:kickoff`,
      event: 'kickoff',
      game: match.game,
      title: `En directo: ${shortA} vs ${shortB}`,
      body: league,
    });
  }

  // 2. Gol (fútbol, solo con partido ya en juego para evitar falsos positivos)
  if (isFootball && prefs.goal && liveFresh && match.status === 'LIVE' && prev.status === 'LIVE') {
    const nA = toNum(match.teamA.score);
    const nB = toNum(match.teamB.score);
    const pA = toNum(prev.scoreA);
    const pB = toNum(prev.scoreB);
    if (nA !== null && nB !== null && pA !== null && pB !== null && (nA > pA || nB > pB)) {
      const minute = match.liveRoundScore?.roundOrTime ? ` · ${match.liveRoundScore.roundOrTime}` : '';
      const goals = match.details?.goals || [];
      // El gol nuevo es el último cuyo acumulado coincide con el marcador
      // actual: si la fuente va un gol por detrás, no se anuncia el anterior.
      const matching = goals.filter(
        (g) => toNum(g.scoreA ?? '') === nA && toNum(g.scoreB ?? '') === nB
      );
      const latestGoal = matching.length > 0 ? matching[matching.length - 1] : goals[goals.length - 1];
      const scorer = latestGoal?.scorer?.trim();
      if (scorer && latestGoal) {
        const goalType = (latestGoal.type || '').toUpperCase();
        const prefix =
          goalType === 'PENALTY'
            ? 'Penalti de'
            : goalType === 'OWN_GOAL'
            ? 'Gol en propia de'
            : 'Gol de';
        out.push({
          dedupeKey: `${match.id}:goal:${nA}-${nB}`,
          event: 'goal',
          game: match.game,
          title: `${prefix} ${scorer} (${formatGoalMinute(latestGoal)})`,
          body: `${shortA} ${nA}-${nB} ${shortB} · ${league}`,
        });
      } else {
        out.push({
          dedupeKey: `${match.id}:goal:${nA}-${nB}`,
          event: 'goal',
          game: match.game,
          title: `Gol: ${shortA} ${nA}-${nB} ${shortB}`,
          body: `${league}${minute}`,
        });
      }
    }
  }

  // 3. Roja / segunda amarilla (fútbol): se avisa cuando aparece una nueva
  //    incidencia que no estaba en la foto anterior.
  if (isFootball && prefs.redCard && liveFresh && match.status === 'LIVE' && prev.status === 'LIVE') {
    const seen = new Set(prev.incidents || []);
    for (const red of match.details?.redCards || []) {
      const key = redCardKey(red);
      if (seen.has(key)) continue;
      const player = red.player || 'Jugador';
      const label = red.card === 'YELLOW_RED' ? 'Segunda amarilla' : 'Roja directa';
      out.push({
        dedupeKey: `${match.id}:red:${key}`,
        event: 'redCard',
        game: match.game,
        title: `${label}: ${player} (${red.minute}${red.injuryTime ? `+${red.injuryTime}` : ''}')`,
        body: `${shortA} ${match.teamA.score}-${match.teamB.score} ${shortB} · ${league}`,
      });
    }
  }

  // 4. Gol anulado por el VAR (fútbol): igual que las rojas, solo la primera vez.
  if (isFootball && prefs.goalCancelled && liveFresh && match.status === 'LIVE' && prev.status === 'LIVE') {
    const seen = new Set(prev.incidents || []);
    for (const cancel of match.details?.goalCancels || []) {
      if (seen.has(cancel.key)) continue;
      const who = cancel.player ? `: ${cancel.player}` : '';
      out.push({
        dedupeKey: `${match.id}:cancel:${cancel.key}`,
        event: 'goalCancelled',
        game: match.game,
        title: `Gol anulado${who} (${cancel.minute}${cancel.injuryTime ? `+${cancel.injuryTime}` : ''}')`,
        body: `${shortA} ${match.teamA.score}-${match.teamB.score} ${shortB} · ${league}`,
      });
    }
  }

  // 5. Descanso (fútbol)
  if (isFootball && prefs.halfTime && liveFresh && match.status === 'LIVE' && prev.status === 'LIVE') {
    const nowHalf = (match.liveRoundScore?.roundOrTime || '').toLowerCase().includes('descanso');
    const wasHalf = (prev.roundOrTime || '').toLowerCase().includes('descanso');
    if (nowHalf && !wasHalf) {
      out.push({
        dedupeKey: `${match.id}:halfTime`,
        event: 'halfTime',
        game: match.game,
        title: `Descanso: ${shortA} ${match.teamA.score}-${match.teamB.score} ${shortB}`,
        body: league,
      });
    }
  }

  // 6. Fin de mapa/juego (esports), con el marcador de ESE mapa si se conoce.
  if (!isFootball && prefs.mapEnd && liveFresh) {
    for (const g of match.details?.gamesBreakdown || []) {
      if (g.status === 'finished' && !prev.finishedMaps[g.position]) {
        const winner = g.winnerTeam === 'A' ? shortA : g.winnerTeam === 'B' ? shortB : '';
        const mapName = g.mapName || `Mapa ${g.position}`;
        const score = mapScoreSuffix(g);
        out.push({
          dedupeKey: `${match.id}:map:${g.position}`,
          event: 'mapEnd',
          game: match.game,
          title: winner
            ? `${mapName} para ${winner}${score}`
            : `${mapName} finalizado${score}`,
          body: `Serie ${match.teamA.score}-${match.teamB.score} · ${shortA} vs ${shortB}`,
        });
      }
    }
  }

  // 7. Final (fútbol) / resultado de serie (esports)
  if (prev.status !== 'FINISHED' && match.status === 'FINISHED') {
    if (isFootball && prefs.fullTime) {
      out.push({
        dedupeKey: `${match.id}:fullTime`,
        event: 'fullTime',
        game: match.game,
        title: `Final: ${shortA} ${match.teamA.score}-${match.teamB.score} ${shortB}`,
        body: league,
      });
    }
    if (!isFootball && prefs.seriesEnd) {
      out.push({
        dedupeKey: `${match.id}:seriesEnd`,
        event: 'seriesEnd',
        game: match.game,
        title: `Resultado final: ${shortA} ${match.teamA.score}-${match.teamB.score} ${shortB}`,
        body: league,
      });
    }
  }

  return out;
}

/**
 * Recordatorios previos ("empieza en X min") para partidos próximos.
 * El resolutor de preferencias se inyecta para que el módulo siga siendo puro:
 * la app pasa el resolutor real (con favoritos y matriz por favorito).
 */
export function findUpcomingReminders(
  matches: Match[],
  settings: NotificationSettings,
  now: Date,
  alreadyNotified: Set<string>,
  resolvePrefs: (m: Match) => { relevant: boolean; prefs: NotificationEventPrefs }
): PendingNotification[] {
  if (!settings.enabled) return [];
  const out: PendingNotification[] = [];
  const windowMs = Math.max(1, settings.reminderMinutes) * 60_000;

  for (const m of matches) {
    if (m.status !== 'UPCOMING') continue;
    const start = new Date(m.startTimeIso).getTime();
    if (isNaN(start)) continue;
    const delta = start - now.getTime();
    if (delta <= 0 || delta > windowMs) continue;

    const dedupeKey = `${m.id}:reminder`;
    if (alreadyNotified.has(dedupeKey)) continue;

    const { relevant, prefs } = resolvePrefs(m);
    if (!relevant || !prefs.reminder) continue;

    const mins = Math.max(1, Math.round(delta / 60_000));
    const shortA = m.teamA.shortName || m.teamA.name;
    const shortB = m.teamB.shortName || m.teamB.name;
    out.push({
      dedupeKey,
      event: 'reminder',
      game: m.game,
      title: `En ${mins} min: ${shortA} vs ${shortB}`,
      body: m.league,
    });
  }

  return out;
}
