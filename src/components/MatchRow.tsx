import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Star, ChevronRight } from 'lucide-react-native';
import { Match, MatchTeam } from '../services/types';
import { formatMatchSchedule } from '../services/dateUtils';
import {
  getCurrentMapNumber,
  isLiveRoundScoreFinished,
  toScoreNumber as toNumber,
} from '../services/matchScoreUtils';
import { GameLogo } from './GameLogo';
import { MarqueeText } from './MarqueeText';
import { htzTokens } from './htz';

interface MatchRowProps {
  match: Match;
  onPress: () => void;
  /** Oculta el separador inferior (última fila del grupo). */
  isLast?: boolean;
  /** Muestra el logo del juego/deporte (útil cuando el grupo mezcla competiciones). */
  showGame?: boolean;
}

/** Etiqueta compacta del momento de juego para partidos en directo. */
function getLiveLabel(match: Match): string {
  if (match.game === 'FÚTBOL') {
    return match.liveRoundScore?.roundOrTime || 'En vivo';
  }
  return `Mapa ${getCurrentMapNumber(match)}`;
}

const TeamLine: React.FC<{
  team: MatchTeam;
  score: number | string | null;
  winning: boolean;
  /** Rondas del mapa en curso (Valorant / CS2 / R6). */
  roundScore?: number | string;
}> = ({ team, score, winning, roundScore }) => {
  const [imgError, setImgError] = useState(false);
  const hasLogo = Boolean(team.logo) && !imgError;
  const hasRoundScore = roundScore !== undefined && roundScore !== null && roundScore !== '';

  return (
    <View style={styles.teamLine}>
      <View style={styles.teamLogoWrapper}>
        {hasLogo ? (
          <Image
            source={{ uri: team.logo }}
            style={styles.teamLogo}
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={styles.logoFallback}>
            <Text style={styles.fallbackText}>{team.shortName.slice(0, 3)}</Text>
          </View>
        )}
      </View>

      <View style={styles.teamNameWrap}>
        {team.isFav && <Star size={11} color="#FBBF24" fill="#FBBF24" style={styles.teamFav} />}
        <MarqueeText
          text={team.name}
          textStyle={[styles.teamName, winning && styles.winningTeam]}
          containerStyle={styles.teamNameMarquee}
        />
      </View>

      <View style={styles.scoreWrap}>
        {hasRoundScore && (
          <View style={styles.liveRoundBadge}>
            <Text style={styles.liveRoundBadgeText}>{roundScore}</Text>
          </View>
        )}
        <Text style={[styles.score, winning && styles.winningScore]}>{score ?? ''}</Text>
      </View>
    </View>
  );
};

/**
 * Fila compacta de un partido dentro de la tarjeta de su torneo.
 * Muestra la hora / momento de juego, los dos equipos con su marcador y el
 * estado en directo, sin una tarjeta propia.
 */
export const MatchRow: React.FC<MatchRowProps> = ({
  match,
  onPress,
  isLast = false,
  showGame = false,
}) => {
  const schedule = formatMatchSchedule(match.startTimeIso, match.status, match.timeInfo);

  const isLive = match.status === 'LIVE';
  const isUpcoming = match.status === 'UPCOMING';

  // Rondas del mapa en curso para shooters tácticos (Valorant, CS2 y R6):
  // se muestran como badge junto al marcador de la serie, igual que en MatchCard.
  const hasTacticalRoundScores =
    isLive &&
    (match.game === 'VALORANT' || match.game === 'CS2' || match.game === 'R6') &&
    match.liveRoundScore !== undefined &&
    !isLiveRoundScoreFinished(match);
  const liveRoundScoreA = hasTacticalRoundScores ? match.liveRoundScore!.scoreA : undefined;
  const liveRoundScoreB = hasTacticalRoundScores ? match.liveRoundScore!.scoreB : undefined;

  const numA = toNumber(match.teamA.score);
  const numB = toNumber(match.teamB.score);
  const isAWinning = !isLive && !isNaN(numA) && !isNaN(numB) && numA > numB;
  const isBWinning = !isLive && !isNaN(numA) && !isNaN(numB) && numB > numA;

  const leftLabel = isLive ? getLiveLabel(match) : schedule.timeText.replace(/h$/, '');

  // Muestra el día bajo la hora cuando el partido no es hoy ("Mañana", "Ayer",
  // "Jue 9 Oct"...). Para horas sin fecha real ("Reciente") no se añade nada.
  const dayLabel =
    !schedule.isToday &&
    (schedule.isTomorrow || schedule.isYesterday || /\d/.test(schedule.dateText))
      ? schedule.dateText
      : '';

  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowDivider]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.timeCol}>
        <View style={styles.timeRow}>
          {isLive && <View style={styles.liveDot} />}
          <MarqueeText
            text={leftLabel}
            textStyle={[styles.timeText, isLive && styles.liveTimeText]}
            containerStyle={styles.timeTextMarquee}
          />
        </View>
        {dayLabel ? (
          <MarqueeText text={dayLabel} textStyle={styles.timeDayText} />
        ) : null}
      </View>

      {showGame && (
        <View style={styles.gameBadge}>
          <GameLogo game={match.game} size={14} />
        </View>
      )}

      <View style={styles.teamsCol}>
        <TeamLine
          team={match.teamA}
          score={isUpcoming ? null : match.teamA.score}
          winning={isAWinning}
          roundScore={liveRoundScoreA}
        />
        <TeamLine
          team={match.teamB}
          score={isUpcoming ? null : match.teamB.score}
          winning={isBWinning}
          roundScore={liveRoundScoreB}
        />
      </View>

      <ChevronRight size={16} color={htzTokens.colors.outlineVariant} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: htzTokens.colors.surfaceVariant,
  },
  timeCol: {
    width: 62,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeTextMarquee: {
    flex: 1,
    minWidth: 0,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: htzTokens.colors.error,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '700',
    color: htzTokens.colors.onSurfaceVariant,
  },
  timeDayText: {
    fontSize: 10,
    fontWeight: '700',
    color: htzTokens.colors.outline,
  },
  liveTimeText: {
    color: htzTokens.colors.error,
    fontWeight: '800',
    fontSize: 11,
  },
  gameBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  teamsCol: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  teamLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamLogoWrapper: {
    width: 24,
    height: 24,
    marginRight: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamLogo: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  logoFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: htzTokens.colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#CBD5E1',
    fontSize: 8,
    fontWeight: '800',
  },
  teamNameWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamNameMarquee: {
    flex: 1,
    minWidth: 0,
  },
  teamFav: {
    marginRight: 4,
  },
  teamName: {
    fontSize: 15,
    fontWeight: '600',
    color: htzTokens.colors.onSurface,
  },
  winningTeam: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scoreWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  liveRoundBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  liveRoundBadgeText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '800',
  },
  score: {
    minWidth: 22,
    textAlign: 'right',
    fontSize: 16,
    fontWeight: '700',
    color: htzTokens.colors.onSurfaceVariant,
  },
  winningScore: {
    color: htzTokens.colors.inversePrimary,
    fontWeight: '800',
  },
});
