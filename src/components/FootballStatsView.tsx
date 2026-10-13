import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { AlertTriangle, Clock, RefreshCw, RotateCcw } from 'lucide-react-native';
import {
  FootballBooking,
  FootballEvent,
  FootballLineupPlayer,
  FootballMatchDetail,
  FootballTeamLineup,
  FootballTeamStats,
  Match,
  MatchGoal,
  PlayerInfo,
} from '../services/types';
import { ScoreService } from '../services/scoreService';
import { formatMatchSchedule } from '../services/dateUtils';
import { HtzCard } from './htz';
import { htzTokens } from './htz/tokens';
import { GameLogo } from './GameLogo';

interface FootballStatsViewProps {
  match: Match;
  footballToken?: string;
}

/** Tipo de incidencia de la cronología unificada. */
type TimelineKind = 'goal' | 'yellow' | 'red' | 'yellow_red' | 'sub';

interface TimelineRow {
  key: string;
  minute?: number | null;
  injuryTime?: number | null;
  kind: TimelineKind;
  team?: 'A' | 'B';
  title: string;
  subtitle?: string;
}

const CARD_LABEL: Record<FootballBooking['card'], string> = {
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

function translatePosition(pos?: string): string | undefined {
  if (!pos) return undefined;
  return POSITION_ES[pos] || pos;
}

/** "34'" o "45+2'" a partir del minuto y el añadido. */
function formatMinute(minute?: number | null, injuryTime?: number | null): string {
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
  if (typeof g.scoreA === 'number' && typeof g.scoreB === 'number') {
    bits.push(`(${g.scoreA}-${g.scoreB})`);
  }
  return {
    key: `goal-${idx}-${g.minute}-${g.scorer || ''}`,
    minute: g.minute,
    injuryTime: g.injuryTime,
    kind: 'goal',
    team: g.team,
    title: g.scorer || 'Gol',
    subtitle: bits.join(' · ') || undefined,
  };
}

/** Cronología completa (goles + tarjetas + cambios) del detalle real. */
function buildTimelineFromDetail(detail: FootballMatchDetail): TimelineRow[] {
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

  return rows;
}

/** Cronología de respaldo con los datos que ya trae el partido (sin detalle). */
function buildTimelineFallback(match: Match): TimelineRow[] {
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
  yellow: 2,
  sub: 3,
};

function sortTimeline(rows: TimelineRow[]): TimelineRow[] {
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

/** Filas de la comparativa de estadísticas (solo las que traigan datos). */
interface StatRow {
  key: keyof FootballTeamStats;
  label: string;
  suffix?: string;
}

const STAT_ROWS: StatRow[] = [
  { key: 'ballPossession', label: 'Posesión', suffix: '%' },
  { key: 'shots', label: 'Tiros' },
  { key: 'shotsOnGoal', label: 'Tiros a puerta' },
  { key: 'shotsOffGoal', label: 'Tiros fuera' },
  { key: 'cornerKicks', label: 'Córners' },
  { key: 'fouls', label: 'Faltas' },
  { key: 'offsides', label: 'Fueras de juego' },
  { key: 'saves', label: 'Paradas' },
  { key: 'yellowCards', label: 'Amarillas' },
  { key: 'redCards', label: 'Rojas' },
];

/** Tarjeta de alineación de un equipo (titulares + banquillo). */
const TeamLineupCard: React.FC<{
  teamName: string;
  teamLogo?: string;
  lineup?: FootballTeamLineup;
  fallbackPlayers: PlayerInfo[];
}> = ({ teamName, teamLogo, lineup, fallbackPlayers }) => {
  const starters = lineup?.starters || [];
  const bench = lineup?.bench || [];
  const hasOfficial = starters.length > 0 || bench.length > 0;
  const roster: PlayerInfo[] = fallbackPlayers || [];

  const renderPlayer = (p: FootballLineupPlayer, idx: number) => (
    <View key={`${p.id ?? p.name}-${idx}`} style={styles.playerRow}>
      <View style={styles.shirtPill}>
        <Text style={styles.shirtText}>{p.shirtNumber ?? '–'}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName} numberOfLines={1}>
          {p.name}
        </Text>
        {p.position ? <Text style={styles.playerPosition}>{translatePosition(p.position)}</Text> : null}
      </View>
    </View>
  );

  const renderRosterPlayer = (p: PlayerInfo, idx: number) => (
    <View key={`${p.id ?? p.name}-${idx}`} style={styles.playerRow}>
      <View style={styles.shirtPill}>
        <Text style={styles.shirtText}>{p.number ?? '–'}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName} numberOfLines={1}>
          {p.nickname || p.name}
        </Text>
        {p.role ? <Text style={styles.playerPosition}>{p.role}</Text> : null}
      </View>
    </View>
  );

  return (
    <HtzCard style={styles.lineupCard}>
      <View style={styles.lineupHeader}>
        {teamLogo ? (
          <Image source={{ uri: teamLogo }} style={styles.lineupLogo} resizeMode="contain" />
        ) : null}
        <Text style={styles.lineupTeam} numberOfLines={1}>
          {teamName}
        </Text>
        {lineup?.formation ? (
          <View style={styles.formationPill}>
            <Text style={styles.formationText}>{lineup.formation}</Text>
          </View>
        ) : null}
      </View>

      {lineup?.coach ? <Text style={styles.coachText}>Entrenador: {lineup.coach}</Text> : null}

      {hasOfficial ? (
        <>
          <Text style={styles.lineupSectionLabel}>XI INICIAL</Text>
          {starters.map(renderPlayer)}
          {bench.length > 0 && (
            <>
              <Text style={[styles.lineupSectionLabel, styles.lineupSectionLabelSpaced]}>
                SUPLENTES
              </Text>
              {bench.map(renderPlayer)}
            </>
          )}
        </>
      ) : roster.length > 0 ? (
        <>
          <Text style={styles.lineupSectionLabel}>PLANTILLA CONOCIDA</Text>
          {roster.map(renderRosterPlayer)}
          <Text style={styles.lineupNote}>
            La alineación oficial todavía no está publicada; se muestra la plantilla del equipo.
          </Text>
        </>
      ) : (
        <Text style={styles.lineupEmpty}>Alineación no publicada todavía.</Text>
      )}
    </HtzCard>
  );
};

/**
 * Pestaña "Stats" de fútbol: minuto de juego, cronología completa (goles,
 * amarillas, rojas y cambios), comparativa de estadísticas y alineaciones.
 * Se alimenta de `/v4/matches/{id}` de Football-Data y, si no hay token o la
 * consulta falla, cae a los datos que ya venga en el partido (goles/plantilla).
 */
export const FootballStatsView: React.FC<FootballStatsViewProps> = ({ match, footballToken }) => {
  const rawId = match.id.replace(/^foot-/, '');
  const hasNumericId = /^\d+$/.test(rawId);
  const canFetch = Boolean(footballToken && footballToken.trim().length > 5 && hasNumericId);

  const [loaded, setLoaded] = useState<{
    matchId: string;
    nonce: number;
    detail: FootballMatchDetail | null;
    error: boolean;
  } | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const loadedForMatch = loaded && loaded.matchId === match.id ? loaded : null;

  useEffect(() => {
    if (!canFetch) return;
    let cancelled = false;
    (async () => {
      const detail = await ScoreService.fetchFootballMatchDetail(
        rawId,
        footballToken!,
        reloadNonce > 0
      );
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
  }, [canFetch, rawId, match.id, footballToken, reloadNonce]);

  const loading = canFetch && !loadedForMatch;
  const detail = loadedForMatch?.detail ?? null;
  const fetchError =
    canFetch && loadedForMatch?.error === true && loadedForMatch?.nonce === reloadNonce;

  // 1. Primera consulta en curso (solo si no hay nada que mostrar)
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={htzTokens.colors.primary} />
        <Text style={styles.loadingText}>
          Consultando minuto, eventos y alineaciones en Football-Data...
        </Text>
      </View>
    );
  }

  const shortA = match.teamA.shortName || match.teamA.name;
  const shortB = match.teamB.shortName || match.teamB.name;
  const timeline = sortTimeline(
    detail ? buildTimelineFromDetail(detail) : buildTimelineFallback(match)
  );

  const statsA = detail?.statsA;
  const statsB = detail?.statsB;
  const statRows = STAT_ROWS.map((row) => ({
    ...row,
    a: statsA?.[row.key],
    b: statsB?.[row.key],
  })).filter((row) => row.a !== undefined || row.b !== undefined);

  const lineupA = detail?.lineupA;
  const lineupB = detail?.lineupB;
  const fallbackA = match.teamA.players || match.details?.rosterA?.players || [];
  const fallbackB = match.teamB.players || match.details?.rosterB?.players || [];

  // Estado/minuto del partido (el detalle manda; si no, lo que sepa el partido).
  const schedule = formatMatchSchedule(match.startTimeIso, match.status, match.timeInfo);
  const liveRoundText = (match.liveRoundScore?.roundOrTime || '').toLowerCase();
  let statusLabel: string;
  if (match.status === 'LIVE') {
    const paused = detail?.status === 'PAUSED' || liveRoundText.includes('descanso');
    if (paused) statusLabel = 'Descanso';
    else if (detail && detail.minute != null) {
      statusLabel = `En juego · ${formatMinute(detail.minute, detail.injuryTime)}`;
    } else if (match.liveRoundScore?.roundOrTime) {
      statusLabel = `En juego · ${match.liveRoundScore.roundOrTime}`;
    } else {
      statusLabel = 'En directo';
    }
  } else if (match.status === 'FINISHED') {
    statusLabel =
      detail?.duration === 'EXTRA_TIME'
        ? 'Finalizado tras prórroga'
        : detail?.duration === 'PENALTY_SHOOTOUT'
        ? 'Finalizado tras penaltis'
        : 'Finalizado';
  } else {
    statusLabel = `Por jugar · ${schedule.badgeText || match.timeInfo}`;
  }

  const metaBits: string[] = [];
  if (detail && detail.halfTimeA != null && detail.halfTimeB != null) {
    metaBits.push(`Descanso: ${detail.halfTimeA}-${detail.halfTimeB}`);
  }
  if (detail?.referee) metaBits.push(`Árbitro: ${detail.referee}`);
  const statusMeta = metaBits.join(' · ');

  return (
    <View style={styles.container}>
      {/* Estado del partido: minuto de juego, descanso y árbitro */}
      <HtzCard style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusLeft}>
            {match.status === 'LIVE' ? (
              <View style={styles.liveDot} />
            ) : (
              <Clock size={13} color={htzTokens.colors.outline} />
            )}
            <Text style={[styles.statusText, match.status === 'LIVE' && styles.statusLive]}>
              {statusLabel}
            </Text>
          </View>
          {canFetch && (
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => setReloadNonce((n) => n + 1)}
              accessibilityRole="button"
              accessibilityLabel="Actualizar datos del partido"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <RefreshCw size={12} color={htzTokens.colors.primary} />
              <Text style={styles.refreshText}>Actualizar</Text>
            </TouchableOpacity>
          )}
        </View>
        {statusMeta ? <Text style={styles.statusMeta}>{statusMeta}</Text> : null}
      </HtzCard>

      {/* Aviso cuando no hay token configurado (partidos reales, no demo) */}
      {hasNumericId && !canFetch ? (
        <View style={styles.notice}>
          <AlertTriangle size={13} color="#FBBF24" />
          <Text style={styles.noticeText}>
            Añade tu token de Football-Data en Ajustes para ver goles, tarjetas, cambios y
            alineaciones en directo.
          </Text>
        </View>
      ) : null}

      {/* Aviso de error de la fuente con opción de reintentar */}
      {fetchError && (
        <View style={styles.notice}>
          <AlertTriangle size={13} color="#FBBF24" />
          <Text style={styles.noticeText}>
            No se pudieron consultar los datos del partido. Se muestra la información disponible.
          </Text>
          <TouchableOpacity onPress={() => setReloadNonce((n) => n + 1)}>
            <Text style={styles.noticeRetry}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cronología: goles, tarjetas y cambios */}
      <Text style={styles.sectionHeader}>Cronología</Text>
      {timeline.length > 0 ? (
        <View style={styles.timelineList}>
          {timeline.map((row) => (
            <View key={row.key} style={styles.timelineItem}>
              <View style={styles.minutePill}>
                <Text style={styles.minuteText}>{formatMinute(row.minute, row.injuryTime)}</Text>
              </View>
              <View style={styles.eventIconContainer}>
                {row.kind === 'goal' && <GameLogo game="FÚTBOL" size={15} />}
                {row.kind === 'yellow' && <View style={styles.yellowCard} />}
                {row.kind === 'red' && <View style={styles.redCard} />}
                {row.kind === 'yellow_red' && (
                  <View style={styles.doubleCards}>
                    <View style={styles.yellowCard} />
                    <View style={[styles.redCard, styles.doubleCardSecond]} />
                  </View>
                )}
                {row.kind === 'sub' && <RotateCcw size={13} color="#60A5FA" />}
              </View>
              <View style={styles.eventDetails}>
                <Text style={styles.eventPlayer} numberOfLines={2}>
                  {row.title}
                </Text>
                {row.subtitle ? <Text style={styles.eventSubDetail}>{row.subtitle}</Text> : null}
              </View>
              {row.team ? (
                <View style={styles.eventTeamBadge}>
                  <Text style={styles.eventTeamText}>{row.team === 'A' ? shortA : shortB}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <HtzCard style={styles.emptyCard}>
          <Clock size={26} color={htzTokens.colors.outline} />
          <Text style={styles.emptyTitle}>Sin eventos registrados todavía</Text>
          <Text style={styles.emptySubtitle}>
            {match.status === 'UPCOMING'
              ? 'Los goles, tarjetas y cambios aparecerán en directo al comenzar el encuentro.'
              : 'La fuente no registró incidencias en este partido.'}
          </Text>
        </HtzCard>
      )}

      {/* Comparativa de estadísticas de equipo */}
      {statRows.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>Estadísticas</Text>
          <HtzCard style={styles.statsCard}>
            {statRows.map((row) => {
              const both = typeof row.a === 'number' && typeof row.b === 'number';
              return (
                <View key={row.key} style={styles.statRowWrap}>
                  <View style={styles.statRow}>
                    <Text style={styles.statValue}>
                      {row.a !== undefined ? `${row.a}${row.suffix || ''}` : '–'}
                    </Text>
                    <Text style={styles.statLabel}>{row.label}</Text>
                    <Text style={[styles.statValue, styles.statValueRight]}>
                      {row.b !== undefined ? `${row.b}${row.suffix || ''}` : '–'}
                    </Text>
                  </View>
                  {both && (
                    <View style={styles.statBar}>
                      <View style={[styles.statBarA, { flex: (row.a as number) || 0.0001 }]} />
                      <View style={[styles.statBarB, { flex: (row.b as number) || 0.0001 }]} />
                    </View>
                  )}
                </View>
              );
            })}
          </HtzCard>
        </>
      )}

      {/* Alineaciones */}
      <Text style={styles.sectionHeader}>Alineaciones</Text>
      <TeamLineupCard
        teamName={match.teamA.name}
        teamLogo={match.teamA.logo}
        lineup={lineupA}
        fallbackPlayers={fallbackA}
      />
      <View style={{ height: 10 }} />
      <TeamLineupCard
        teamName={match.teamB.name}
        teamLogo={match.teamB.logo}
        lineup={lineupB}
        fallbackPlayers={fallbackB}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  loadingText: {
    color: htzTokens.colors.outline,
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  statusCard: {
    backgroundColor: htzTokens.colors.surface,
    padding: 12,
    borderColor: htzTokens.colors.outline,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  statusText: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '800',
  },
  statusLive: {
    color: '#EF4444',
  },
  statusMeta: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    marginTop: 6,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  refreshText: {
    color: htzTokens.colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 10,
  },
  noticeText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    lineHeight: 15,
  },
  noticeRetry: {
    color: htzTokens.colors.inversePrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  sectionHeader: {
    color: htzTokens.colors.onSurface,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 10,
  },
  timelineList: {
    gap: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: htzTokens.colors.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: htzTokens.colors.outline,
  },
  minutePill: {
    backgroundColor: htzTokens.colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
    minWidth: 42,
    alignItems: 'center',
  },
  minuteText: {
    color: htzTokens.colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  eventIconContainer: {
    width: 24,
    alignItems: 'center',
    marginRight: 10,
  },
  yellowCard: {
    width: 12,
    height: 16,
    backgroundColor: '#FBBF24',
    borderRadius: 2,
  },
  redCard: {
    width: 12,
    height: 16,
    backgroundColor: '#EF4444',
    borderRadius: 2,
  },
  doubleCards: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doubleCardSecond: {
    marginLeft: -4,
    transform: [{ rotate: '12deg' }],
  },
  eventDetails: {
    flex: 1,
  },
  eventPlayer: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },
  eventSubDetail: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    marginTop: 2,
  },
  eventTeamBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  eventTeamText: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    fontWeight: '700',
  },
  statsCard: {
    backgroundColor: htzTokens.colors.surface,
    borderColor: htzTokens.colors.outline,
  },
  statRowWrap: {
    marginBottom: 10,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statLabel: {
    flex: 1,
    textAlign: 'center',
    color: htzTokens.colors.outline,
    fontSize: 11,
    fontWeight: '700',
  },
  statValue: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '800',
    minWidth: 46,
  },
  statValueRight: {
    textAlign: 'right',
  },
  statBar: {
    height: 6,
    borderRadius: 3,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 5,
  },
  statBarA: {
    backgroundColor: htzTokens.colors.primary,
  },
  statBarB: {
    backgroundColor: '#8B5CF6',
  },
  lineupCard: {
    backgroundColor: htzTokens.colors.surface,
    borderColor: htzTokens.colors.outline,
    padding: 14,
  },
  lineupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  lineupLogo: {
    width: 24,
    height: 24,
  },
  lineupTeam: {
    flex: 1,
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '800',
  },
  formationPill: {
    backgroundColor: htzTokens.colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  formationText: {
    color: htzTokens.colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  coachText: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    marginBottom: 4,
  },
  lineupSectionLabel: {
    color: htzTokens.colors.outline,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 4,
  },
  lineupSectionLabelSpaced: {
    marginTop: 12,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  shirtPill: {
    width: 24,
    height: 22,
    borderRadius: 5,
    backgroundColor: htzTokens.colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shirtText: {
    color: htzTokens.colors.onSurface,
    fontSize: 10,
    fontWeight: '800',
  },
  playerInfo: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    color: htzTokens.colors.onSurface,
    fontSize: 12,
    fontWeight: '700',
  },
  playerPosition: {
    color: htzTokens.colors.outline,
    fontSize: 10,
    marginTop: 1,
  },
  lineupNote: {
    color: htzTokens.colors.outline,
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 14,
  },
  lineupEmpty: {
    color: htzTokens.colors.outline,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 6,
  },
  emptyCard: {
    backgroundColor: htzTokens.colors.surface,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: htzTokens.colors.outline,
  },
  emptyTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
});
