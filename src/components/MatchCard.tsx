import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Star, Clock, Flame, CheckCircle2, Globe } from 'lucide-react-native';
import { Match, MatchRegion, SportCategory } from '../services/types';
import { formatMatchSchedule } from '../services/dateUtils';
import { HtzCard, HtzBadge, htzTokens } from './htz';
import { GameLogo } from './GameLogo';
import { MarqueeText } from './MarqueeText';

function getRegionBadge(region?: MatchRegion): string | null {
  switch (region) {
    case 'GLOBAL':
      return 'GLO';
    case 'EMEA':
      return 'EU';
    case 'ESPAÑA':
      return 'ES';
    case 'AMERICAS':
      return 'AME';
    case 'ASIA':
      return 'ASIA';
    default:
      return null;
  }
}

interface MatchCardProps {
  match: Match;
  onPress: () => void;
  onSelectTournament?: (
    leagueName: string,
    game?: SportCategory,
    masterTournamentId?: string,
    seriesId?: number | string
  ) => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, onPress, onSelectTournament }) => {
  const [imgErrorA, setImgErrorA] = useState(false);
  const [imgErrorB, setImgErrorB] = useState(false);

  const hasFavorite = Boolean(match.hasFav) || match.teamA.isFav || match.teamB.isFav;
  const schedule = formatMatchSchedule(match.startTimeIso, match.status, match.timeInfo);

  // Determine which team is winning (for highlighting score)
  const numScoreA = typeof match.teamA.score === 'number' ? match.teamA.score : parseInt(String(match.teamA.score), 10);
  const numScoreB = typeof match.teamB.score === 'number' ? match.teamB.score : parseInt(String(match.teamB.score), 10);
  const isAWinning = !isNaN(numScoreA) && !isNaN(numScoreB) && numScoreA > numScoreB;
  const isBWinning = !isNaN(numScoreA) && !isNaN(numScoreB) && numScoreB > numScoreA;

  // Fase y formato de serie combinados de forma concisa (ej: 'Champions (Group A) • Bo3')
  const stage = match.details?.tournamentStage;
  const bestOf = match.details?.bestOf;
  let stageText = stage || '';
  if (
    bestOf &&
    bestOf > 1 &&
    !stageText.toLowerCase().includes('bo') &&
    !stageText.toLowerCase().includes('mejor de')
  ) {
    stageText = stageText ? `${stageText} • Bo${bestOf}` : `Bo${bestOf}`;
  }

  // Limpiar texto de fase para no repetir (Juego X) ni Grieta del Invocador
  if (stageText) {
    stageText = stageText
      .replace(/\(Juego\s+\d+\)/gi, '')
      .replace(/Grieta del Invocador/gi, '')
      .replace(/\s+•\s*$/, '')
      .trim();
  }

  // Formato limpio del estado del partido en directo
  const getLiveScheduleText = () => {
    if (match.status !== 'LIVE') return schedule.fullText;
    if (match.game === 'FÚTBOL') {
      return match.liveRoundScore?.roundOrTime || 'En directo';
    }
    if (match.game === 'LOL') {
      const num = match.liveRoundScore?.mapNumber || 1;
      return `Juego ${num}`;
    }
    if (match.game === 'DOTA2') {
      const num = match.liveRoundScore?.mapNumber || 1;
      return `Partida ${num}`;
    }
    if (match.liveRoundScore?.mapName) {
      const cleanMap = match.liveRoundScore.mapName
        .replace(/^Mapa\s+\d+:\s*/i, '')
        .replace(/\(Juego\s+\d+\)/gi, '')
        .replace(/Grieta del Invocador/gi, '')
        .trim();
      if (cleanMap) {
        return `Mapa ${match.liveRoundScore.mapNumber || 1}: ${cleanMap}`;
      }
    }
    return `Mapa ${match.liveRoundScore?.mapNumber || 1}`;
  };

  // Solo mostrar desglose de rondas secundarias en shooters tácticos donde existan rondas dentro del mapa
  const hasTacticalRoundScores =
    (match.game === 'VALORANT' || match.game === 'CS2' || match.game === 'R6') &&
    match.liveRoundScore !== undefined &&
    match.status === 'LIVE';

  return (
    <HtzCard
      elevated
      onPress={onPress}
      style={[
        styles.card,
        hasFavorite && styles.favCardBorder,
      ]}
    >
      {/* Header of Match Card */}
      <View style={styles.header}>
        <View style={styles.leagueRow}>
          <View style={styles.gameLogoBadge}>
            <GameLogo game={match.game} size={14} />
          </View>

          {match.tier && (
            <View
              style={[
                styles.tierBadge,
                match.tier === 'S'
                  ? styles.tierBadgeS
                  : match.tier === 'A'
                  ? styles.tierBadgeA
                  : styles.tierBadgeOther,
              ]}
            >
              <Text
                style={[
                  styles.tierBadgeText,
                  match.tier === 'S'
                    ? styles.tierTextS
                    : match.tier === 'A'
                    ? styles.tierTextA
                    : styles.tierTextOther,
                ]}
              >
                {match.tier}
              </Text>
            </View>
          )}

          {match.region && (
            <View style={styles.regionBadge}>
              {match.region === 'GLOBAL' ? (
                <Globe size={11} color={htzTokens.colors.onSurfaceVariant} />
              ) : (
                <Text style={styles.regionBadgeText}>
                  {getRegionBadge(match.region)}
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.leagueNameWrapper}
            disabled={!onSelectTournament}
            onPress={(e) => {
              if (onSelectTournament) {
                const fullLeagueStr = match.details?.tournamentStage
                  ? `${match.league} • ${match.details.tournamentStage}`
                  : match.league;
                onSelectTournament(fullLeagueStr, match.game, match.masterTournamentId, match.seriesId);
              }
            }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <MarqueeText
              text={match.league}
              textStyle={[styles.leagueName, onSelectTournament && styles.leagueNameClickable]}
            />
          </TouchableOpacity>

          {match.isFavTournament && (
            <Star
              size={12}
              color="#FBBF24"
              fill="#FBBF24"
              style={{ marginLeft: 4, flexShrink: 0 }}
            />
          )}
        </View>

        {/* Status Badge using HtzBadge: Simple y directo, con contenedor flexShrink: 0 para evitar solapamientos */}
        <View style={styles.badgeWrapper}>
          {match.status === 'LIVE' && (
            <HtzBadge variant="error" dot label="EN DIRECTO" />
          )}
          {match.status === 'FINISHED' && (
            <HtzBadge variant="success" label="FINAL" />
          )}
          {match.status === 'UPCOMING' && (
            <HtzBadge variant="secondary" label={schedule.badgeText} />
          )}
        </View>
      </View>

      {/* Prominent Schedule & Date Bar */}
      <View style={styles.scheduleBar}>
        <View style={styles.scheduleLeft}>
          <Clock
            size={12}
            color={match.status === 'LIVE' ? htzTokens.colors.error : htzTokens.colors.inversePrimary}
          />
          <Text
            style={[
              styles.scheduleText,
              match.status === 'LIVE' && styles.liveScheduleText,
            ]}
          >
            {getLiveScheduleText()}
          </Text>
        </View>

        {stageText ? (
          <MarqueeText
            text={stageText}
            textStyle={styles.stageTag}
            containerStyle={styles.stageTagMarquee}
          />
        ) : null}
      </View>

      {/* Teams List (Vertical Stack - Clean 2-Row Format) */}
      <View style={styles.teamsListContainer}>
        {/* Team A Row */}
        <View style={styles.teamRow}>
          <View style={styles.teamLeft}>
            <View style={styles.teamLogoWrapper}>
              {match.teamA.logo && !imgErrorA ? (
                <Image
                  source={{ uri: match.teamA.logo }}
                  style={styles.teamLogo}
                  onError={() => setImgErrorA(true)}
                />
              ) : (
                <View style={[styles.logoFallback, { backgroundColor: '#1E293B' }]}>
                  <Text style={styles.fallbackText}>{match.teamA.shortName.slice(0, 3)}</Text>
                </View>
              )}
            </View>

            <View style={styles.nameBlock}>
              <View style={styles.nameAndFav}>
                {match.teamA.isFav && (
                  <Star size={13} color="#FBBF24" fill="#FBBF24" style={{ marginRight: 5 }} />
                )}
                <MarqueeText
                  text={match.teamA.name}
                  textStyle={[
                    styles.teamName,
                    isAWinning && styles.winningTeamName,
                  ]}
                  containerStyle={styles.teamNameMarquee}
                />
              </View>
              <Text style={styles.shortText}>{match.teamA.shortName}</Text>
            </View>
          </View>

          <View style={styles.scoreContainer}>
            {hasTacticalRoundScores && (
              <View style={styles.liveRoundBadge}>
                <Text style={styles.liveRoundBadgeText}>{match.liveRoundScore!.scoreA}</Text>
              </View>
            )}
            <Text
              style={[
                styles.scoreNumber,
                isAWinning && styles.winningScore,
                match.status === 'UPCOMING' && styles.upcomingScore,
              ]}
            >
              {match.status === 'UPCOMING' ? '-' : match.teamA.score}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.teamDivider} />

        {/* Team B Row */}
        <View style={styles.teamRow}>
          <View style={styles.teamLeft}>
            <View style={styles.teamLogoWrapper}>
              {match.teamB.logo && !imgErrorB ? (
                <Image
                  source={{ uri: match.teamB.logo }}
                  style={styles.teamLogo}
                  onError={() => setImgErrorB(true)}
                />
              ) : (
                <View style={[styles.logoFallback, { backgroundColor: '#1E293B' }]}>
                  <Text style={styles.fallbackText}>{match.teamB.shortName.slice(0, 3)}</Text>
                </View>
              )}
            </View>

            <View style={styles.nameBlock}>
              <View style={styles.nameAndFav}>
                {match.teamB.isFav && (
                  <Star size={13} color="#FBBF24" fill="#FBBF24" style={{ marginRight: 5 }} />
                )}
                <MarqueeText
                  text={match.teamB.name}
                  textStyle={[
                    styles.teamName,
                    isBWinning && styles.winningTeamName,
                  ]}
                  containerStyle={styles.teamNameMarquee}
                />
              </View>
              <Text style={styles.shortText}>{match.teamB.shortName}</Text>
            </View>
          </View>

          <View style={styles.scoreContainer}>
            {hasTacticalRoundScores && (
              <View style={styles.liveRoundBadge}>
                <Text style={styles.liveRoundBadgeText}>{match.liveRoundScore!.scoreB}</Text>
              </View>
            )}
            <Text
              style={[
                styles.scoreNumber,
                isBWinning && styles.winningScore,
                match.status === 'UPCOMING' && styles.upcomingScore,
              ]}
            >
              {match.status === 'UPCOMING' ? '-' : match.teamB.score}
            </Text>
          </View>
        </View>
      </View>

      {/* Match Subtitle / Stage / Details Footer (solo para partidos finalizados con desglose de mapas) */}
      {match.status === 'FINISHED' && match.details?.roundOrMap && !match.details.roundOrMap.startsWith('Al mejor') && (
        <View style={styles.footerRow}>
          <CheckCircle2 size={12} color={htzTokens.colors.primary} style={{ marginRight: 5 }} />
          <Text style={styles.roundText}>{match.details.roundOrMap}</Text>
        </View>
      )}
    </HtzCard>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  favCardBorder: {
    borderColor: 'rgba(251, 191, 36, 0.45)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  leagueNameWrapper: {
    flex: 1,
    minWidth: 0,
  },
  gameLogoBadge: {
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    flexShrink: 0,
  },
  tierBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginRight: 6,
    borderWidth: 1,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tierBadgeS: {
    backgroundColor: 'rgba(251, 191, 36, 0.18)',
    borderColor: 'rgba(251, 191, 36, 0.55)',
  },
  tierBadgeA: {
    backgroundColor: 'rgba(74, 124, 89, 0.22)',
    borderColor: 'rgba(74, 124, 89, 0.5)',
  },
  tierBadgeOther: {
    backgroundColor: 'rgba(115, 115, 115, 0.15)',
    borderColor: 'rgba(115, 115, 115, 0.35)',
  },
  tierBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  tierTextS: {
    color: '#FBBF24',
  },
  tierTextA: {
    color: htzTokens.colors.inversePrimary,
  },
  tierTextOther: {
    color: htzTokens.colors.outline,
  },
  regionBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    minHeight: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  regionBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: htzTokens.colors.onSurfaceVariant,
    letterSpacing: 0.2,
  },
  leagueName: {
    color: htzTokens.colors.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '600',
  },
  leagueNameClickable: {
    color: htzTokens.colors.onSurface,
  },
  badgeWrapper: {
    flexShrink: 0,
  },
  scheduleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  scheduleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  scheduleText: {
    fontSize: 11,
    fontWeight: '600',
    color: htzTokens.colors.onSurfaceVariant,
  },
  liveScheduleText: {
    color: htzTokens.colors.error,
    fontWeight: '700',
  },
  stageTag: {
    fontSize: 10,
    fontWeight: '600',
    color: htzTokens.colors.outline,
  },
  stageTagMarquee: {
    maxWidth: '48%',
    flexShrink: 1,
    marginLeft: 8,
  },
  teamsListContainer: {
    backgroundColor: htzTokens.colors.surfaceContainerLowest,
    borderRadius: htzTokens.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: htzTokens.colors.surfaceVariant,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  teamDivider: {
    height: 1,
    backgroundColor: htzTokens.colors.surfaceVariant,
  },
  teamLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  teamLogoWrapper: {
    width: 28,
    height: 28,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamLogo: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
  },
  logoFallback: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#CBD5E1',
    fontSize: 9,
    fontWeight: '800',
  },
  nameBlock: {
    flex: 1,
  },
  nameAndFav: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamNameMarquee: {
    flex: 1,
    minWidth: 0,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    color: htzTokens.colors.onSurface,
  },
  winningTeamName: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
  shortText: {
    fontSize: 10,
    color: htzTokens.colors.outline,
    marginTop: 1,
  },
  scoreContainer: {
    minWidth: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingLeft: 8,
  },
  liveRoundBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveRoundBadgeText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '800',
  },
  scoreNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: htzTokens.colors.onSurfaceVariant,
  },
  winningScore: {
    fontWeight: '800',
    color: htzTokens.colors.inversePrimary,
    fontSize: 17,
  },
  upcomingScore: {
    fontSize: 14,
    color: htzTokens.colors.outline,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  roundText: {
    color: htzTokens.colors.outline,
    fontSize: 11,
  },
});
