import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertTriangle, Clock, RefreshCw, RotateCcw } from 'lucide-react-native';
import { Match } from '../../services/types';
import { formatMatchSchedule } from '../../services/dateUtils';
import { HtzCard } from '../htz';
import { htzTokens } from '../htz/tokens';
import { GameLogo } from '../GameLogo';
import { FootballMatchDetailState } from './useFootballMatchDetail';
import {
  TimelineRow,
  buildTimelineFallback,
  buildTimelineFromDetail,
  formatMinute,
  sortTimeline,
} from './helpers';
import { FootballLoading, TeamCrest } from './FootballShared';

interface FootballSummaryViewProps {
  match: Match;
  state: FootballMatchDetailState;
}

/** Primera página del partido: minuto de juego, estado y cronología completa. */
export const FootballSummaryView: React.FC<FootballSummaryViewProps> = ({ match, state }) => {
  const { detail, loading, error, canFetch, onReload } = state;

  if (loading) return <FootballLoading />;

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

  const timeline = sortTimeline(
    detail ? buildTimelineFromDetail(detail) : buildTimelineFallback(match)
  );

  const renderEventIcon = (row: TimelineRow) => (
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
      {row.kind === 'var' && (
        <View style={styles.varPill}>
          <Text style={styles.varPillText}>VAR</Text>
        </View>
      )}
    </View>
  );

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
              onPress={onReload}
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

      {/* Aviso de error de la fuente con opción de reintentar */}
      {error && (
        <View style={styles.notice}>
          <AlertTriangle size={13} color="#FBBF24" />
          <Text style={styles.noticeText}>
            No se pudieron consultar los datos del partido. Se muestra la información disponible.
          </Text>
          <TouchableOpacity onPress={onReload}>
            <Text style={styles.noticeRetry}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cronología: cada equipo desde su lado (A a la izquierda, B a la derecha) */}
      <Text style={styles.sectionHeader}>Cronología</Text>
      {timeline.length > 0 ? (
        <View style={styles.timelineList}>
          {timeline.map((row) => {
            const isHome = row.team !== 'B';
            const team = isHome ? match.teamA : match.teamB;
            const minutePill = (
              <View style={styles.minutePill}>
                <Text style={styles.minuteText}>{formatMinute(row.minute, row.injuryTime)}</Text>
              </View>
            );
            return (
              <View
                key={row.key}
                style={[
                  styles.timelineItem,
                  isHome ? styles.timelineItemHome : styles.timelineItemAway,
                ]}
              >
                <View style={styles.eventHeader}>
                  {isHome ? (
                    <>
                      {minutePill}
                      {renderEventIcon(row)}
                      <TeamCrest team={team} size={18} />
                      {row.score ? (
                        <View style={[styles.scorePill, styles.scorePillHome]}>
                          <Text style={styles.scoreText}>{row.score}</Text>
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {row.score ? (
                        <View style={[styles.scorePill, styles.scorePillAway]}>
                          <Text style={styles.scoreText}>{row.score}</Text>
                        </View>
                      ) : null}
                      <TeamCrest team={team} size={18} />
                      {renderEventIcon(row)}
                      {minutePill}
                    </>
                  )}
                </View>
                <Text
                  style={[styles.eventPlayer, !isHome && styles.eventTextRight]}
                  numberOfLines={2}
                >
                  {row.title}
                </Text>
                {row.subtitle ? (
                  <Text
                    style={[styles.eventSubDetail, !isHome && styles.eventTextRight]}
                    numberOfLines={2}
                  >
                    {row.subtitle}
                  </Text>
                ) : null}
              </View>
            );
          })}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 2,
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
    backgroundColor: htzTokens.colors.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: htzTokens.colors.outline,
  },
  // Acento del lado de cada equipo: verde para el A (izquierda) y violeta para
  // el B (derecha), los mismos colores que la comparativa de estadísticas.
  timelineItemHome: {
    borderLeftWidth: 3,
    borderLeftColor: htzTokens.colors.primary,
  },
  timelineItemAway: {
    borderRightWidth: 3,
    borderRightColor: '#8B5CF6',
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  scorePill: {
    backgroundColor: htzTokens.colors.surfaceVariant,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  scorePillHome: {
    marginLeft: 'auto',
  },
  scorePillAway: {
    marginRight: 'auto',
  },
  scoreText: {
    color: htzTokens.colors.onSurface,
    fontSize: 11,
    fontWeight: '800',
  },
  minutePill: {
    backgroundColor: htzTokens.colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
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
  varPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  varPillText: {
    color: '#EF4444',
    fontSize: 8,
    fontWeight: '900',
  },
  eventPlayer: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },
  eventTextRight: {
    textAlign: 'right',
  },
  eventSubDetail: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    marginTop: 2,
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
