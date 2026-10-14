import { useEffect, useState } from 'react';
import { FootballMatchDetail, Match } from '../../services/types';
import { FootballStatsService } from '../../services/footballStatsService';
import { ScoreService } from '../../services/scoreService';

export interface FootballMatchDetailState {
  /** Detalle real (FotMob o Football-Data); null si no está disponible. */
  detail: FootballMatchDetail | null;
  /** Primera consulta del partido en curso (aún no hay nada que pintar). */
  loading: boolean;
  /** La última consulta falló y no hay detalle previo. */
  error: boolean;
  /** El partido tiene id numérico y por tanto admite consulta a FotMob. */
  canFetch: boolean;
  /** Fuerza una recarga saltándose la caché. */
  onReload: () => void;
}

/**
 * Detalle ampliado de un partido de fútbol compartido por todas las páginas del
 * modal (Resumen, Alineaciones, Jugadores y Estadísticas): una sola consulta
 * por partido. Fuente principal FotMob (minuto, eventos, alineaciones, stats,
 * valoraciones); respaldo el detalle de Football-Data si hay token.
 */
export function useFootballMatchDetail(
  match: Match | null,
  footballToken?: string
): FootballMatchDetailState {
  const isFootball = match?.game === 'FÚTBOL';
  const rawId = (match?.id || '').replace(/^foot-/, '');
  // FotMob no necesita token: cualquier partido real puede consultarse.
  const canFetch = isFootball && /^\d+$/.test(rawId);
  const matchId = match?.id;

  const [loaded, setLoaded] = useState<{
    matchId?: string;
    nonce: number;
    detail: FootballMatchDetail | null;
    error: boolean;
  } | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const loadedForMatch = loaded && loaded.matchId === matchId ? loaded : null;

  useEffect(() => {
    if (!canFetch || !match) return;
    let cancelled = false;
    (async () => {
      const force = reloadNonce > 0;
      // 1) FotMob: minuto, goles, tarjetas, cambios, alineaciones y stats.
      let detail = await FootballStatsService.getMatchDetail(match, force);
      // 2) Respaldo: detalle de Football-Data (planes de pago traen eventos).
      if (!detail && footballToken && footballToken.trim().length > 5) {
        detail = await ScoreService.fetchFootballMatchDetail(rawId, footballToken, force);
      }
      if (cancelled) return;
      setLoaded({
        matchId: match.id,
        nonce: reloadNonce,
        detail,
        error: detail === null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [canFetch, rawId, match, footballToken, reloadNonce]);

  const loading = canFetch && !loadedForMatch;
  const error =
    canFetch && loadedForMatch?.error === true && loadedForMatch?.nonce === reloadNonce;

  return {
    detail: loadedForMatch?.detail ?? null,
    loading,
    error,
    canFetch,
    onReload: () => setReloadNonce((n) => n + 1),
  };
}
