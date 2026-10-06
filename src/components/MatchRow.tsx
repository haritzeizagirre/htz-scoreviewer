import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Star, ChevronRight } from 'lucide-react-native';
import { Match, MatchTeam } from '../services/types';
import { formatMatchSchedule } from '../services/dateUtils';
import { GameLogo } from './GameLogo';
import { htzTokens } from './htz';

interface MatchRowProps {
  match: Match;
  onPress: () => void;
  /** Oculta el separador inferior (última fila del grupo). */
  isLast?: boolean;
  /** Muestra el logo del juego/deporte (útil cuando el grupo mezcla competiciones). */
  showGame?: boolean;
}

function toNumber(value: number | string): number {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  return isNaN(n) ? NaN : n;
}

/**
 * Número del mapa que se está jugando ahora mismo:
 * 1) el mapa marcado como "running" en el desglose,
 * 2) el mapNumber explícito si es válido (> 1),
 * 3) los mapas ya decididos en la serie + 1.
 */
function getCurrentMapNumber(match: Match): number {
  const breakdown = match.details?.gamesBreakdown;
  const running = breakdown?.find((g) => g.status === 'running');
  if (running && running.position > 0) return running.position;

  const explicit = match.liveRoundScore?.mapNumber;
  let mapNumber = explicit && explicit > 1 ? explicit : 0;

  if (mapNumber === 0) {
    const numA = toNumber(match.teamA.score);
    const numB = toNumber(match.teamB.score);
    const decided = (isNaN(numA) ? 0 : numA) + (isNaN(numB) ? 0 : numB);
    mapNumber = decided + 1;
  }

  const bestOf = match.details?.bestOf;
  if (bestOf && bestOf > 0) mapNumber = Math.min(mapNumber, bestOf);

  return Math.max(1, mapNumber);
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
}> = ({ team, score, winning }) => {
  const [imgError, setImgError] = useState(false);
  const hasLogo = Boolean(team.logo) && !imgError;

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
        <Text style={[styles.teamName, winning && styles.winningTeam]} numberOfLines={1}>
          {team.name}
        </Text>
      </View>

      <Text style={[styles.score, winning && styles.winningScore]}>{score ?? ''}</Text>
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

  const numA = toNumber(match.teamA.score);
  const numB = toNumber(match.teamB.score);
  const isAWinning = !isLive && !isNaN(numA) && !isNaN(numB) && numA > numB;
  const isBWinning = !isLive && !isNaN(numA) && !isNaN(numB) && numB > numA;

  const leftLabel = isLive ? getLiveLabel(match) : schedule.timeText.replace(/h$/, '');

  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowDivider]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.timeCol}>
        {isLive && <View style={styles.liveDot} />}
        <Text
          style={[styles.timeText, isLive && styles.liveTimeText]}
          numberOfLines={1}
        >
          {leftLabel}
        </Text>
      </View>

      {showGame && (
        <View style={styles.gameBadge}>
          <GameLogo game={match.game} size={14} />
        </View>
      )}

      <View style={styles.teamsCol}>
        <TeamLine team={match.teamA} score={isUpcoming ? null : match.teamA.score} winning={isAWinning} />
        <TeamLine team={match.teamB} score={isUpcoming ? null : match.teamB.score} winning={isBWinning} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
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
  teamFav: {
    marginRight: 4,
  },
  teamName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: htzTokens.colors.onSurface,
  },
  winningTeam: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
  score: {
    minWidth: 22,
    textAlign: 'right',
    fontSize: 16,
    fontWeight: '700',
    color: htzTokens.colors.onSurfaceVariant,
    marginLeft: 8,
  },
  winningScore: {
    color: htzTokens.colors.inversePrimary,
    fontWeight: '800',
  },
});
