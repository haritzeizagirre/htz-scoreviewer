/**
 * Motor de eventos de partido para las alertas (Fase 1, sin servidor).
 *
 * Módulo PURO (solo depende de tipos): compara el estado de un partido entre
 * dos cargas consecutivas y produce notificaciones (inicio, gol, descanso,
 * final, fin de mapa, resultado de serie). Sin React, sin red, sin storage,
 * para poder testearlo de forma aislada.
 */
import {
  Match,
  MatchStatus,
  NotificationEventKey,
  NotificationEventPrefs,
  NotificationSettings,
} from './types';

/** Estado resumido de un partido en una carga concreta. */
export interface MatchSnapshot {
  status: MatchStatus;
  scoreA: number | string;
  scoreB: number | string;
  roundOrTime?: string;
  /** Mapas/juegos ya finalizados, por posición. */
  finishedMaps: Record<number, { mapName: string; winner?: 'A' | 'B' }>;
}

export interface PendingNotification {
  dedupeKey: string;
  event: NotificationEventKey;
  title: string;
  body: string;
}

function toNum(value: number | string): number | null {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  return isNaN(n) ? null : n;
}

export function toMatchSnapshot(m: Match): MatchSnapshot {
  const finishedMaps: MatchSnapshot['finishedMaps'] = {};
  for (const g of m.details?.gamesBreakdown || []) {
    if (g.status === 'finished') {
      finishedMaps[g.position] = {
        mapName: g.mapName || `Mapa ${g.position}`,
        winner: g.winnerTeam,
      };
    }
  }
  return {
    status: m.status,
    scoreA: m.teamA.score,
    scoreB: m.teamB.score,
    roundOrTime: m.liveRoundScore?.roundOrTime,
    finishedMaps,
  };
}

/**
 * Compara el partido con su estado anterior y devuelve los eventos nuevos.
 * Si no hay estado anterior (primera vez que se ve el partido) no genera nada:
 * así abrir la app en mitad de un partido no dispara un aluvión de avisos.
 */
export function diffMatchEvents(
  match: Match,
  prev: MatchSnapshot | undefined,
  prefs: NotificationEventPrefs
): PendingNotification[] {
  const out: PendingNotification[] = [];
  if (!prev) return out;

  const isFootball = match.game === 'FÚTBOL';
  const shortA = match.teamA.shortName || match.teamA.name;
  const shortB = match.teamB.shortName || match.teamB.name;
  const league = match.league;

  // 1. Inicio del partido/serie
  if (prefs.kickoff && prev.status !== 'LIVE' && match.status === 'LIVE') {
    out.push({
      dedupeKey: `${match.id}:kickoff`,
      event: 'kickoff',
      title: `En directo: ${shortA} vs ${shortB}`,
      body: league,
    });
  }

  // 2. Gol (fútbol, solo con partido ya en juego para evitar falsos positivos)
  if (isFootball && prefs.goal && match.status === 'LIVE' && prev.status === 'LIVE') {
    const nA = toNum(match.teamA.score);
    const nB = toNum(match.teamB.score);
    const pA = toNum(prev.scoreA);
    const pB = toNum(prev.scoreB);
    if (nA !== null && nB !== null && pA !== null && pB !== null && (nA > pA || nB > pB)) {
      const minute = match.liveRoundScore?.roundOrTime ? ` · ${match.liveRoundScore.roundOrTime}` : '';
      out.push({
        dedupeKey: `${match.id}:goal:${nA}-${nB}`,
        event: 'goal',
        title: `Gol: ${shortA} ${nA}-${nB} ${shortB}`,
        body: `${league}${minute}`,
      });
    }
  }

  // 3. Descanso (fútbol)
  if (isFootball && prefs.halfTime && match.status === 'LIVE' && prev.status === 'LIVE') {
    const nowHalf = (match.liveRoundScore?.roundOrTime || '').toLowerCase().includes('descanso');
    const wasHalf = (prev.roundOrTime || '').toLowerCase().includes('descanso');
    if (nowHalf && !wasHalf) {
      out.push({
        dedupeKey: `${match.id}:halfTime`,
        event: 'halfTime',
        title: `Descanso: ${shortA} ${match.teamA.score}-${match.teamB.score} ${shortB}`,
        body: league,
      });
    }
  }

  // 4. Fin de mapa/juego (esports)
  if (!isFootball && prefs.mapEnd) {
    for (const g of match.details?.gamesBreakdown || []) {
      if (g.status === 'finished' && !prev.finishedMaps[g.position]) {
        const winner = g.winnerTeam === 'A' ? shortA : g.winnerTeam === 'B' ? shortB : '';
        const mapName = g.mapName || `Mapa ${g.position}`;
        out.push({
          dedupeKey: `${match.id}:map:${g.position}`,
          event: 'mapEnd',
          title: winner ? `${mapName} para ${winner}` : `${mapName} finalizado`,
          body: `Serie ${match.teamA.score}-${match.teamB.score} · ${shortA} vs ${shortB}`,
        });
      }
    }
  }

  // 5. Final (fútbol) / resultado de serie (esports)
  if (prev.status !== 'FINISHED' && match.status === 'FINISHED') {
    if (isFootball && prefs.fullTime) {
      out.push({
        dedupeKey: `${match.id}:fullTime`,
        event: 'fullTime',
        title: `Final: ${shortA} ${match.teamA.score}-${match.teamB.score} ${shortB}`,
        body: league,
      });
    }
    if (!isFootball && prefs.seriesEnd) {
      out.push({
        dedupeKey: `${match.id}:seriesEnd`,
        event: 'seriesEnd',
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
      title: `En ${mins} min: ${shortA} vs ${shortB}`,
      body: m.league,
    });
  }

  return out;
}
