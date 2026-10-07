import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import {
  SwissRound,
  StandingGroup,
  SportCategory,
  BracketMatch,
  BracketMatchTeam,
} from '../services/types';
import { TournamentStandingsTable } from './TournamentStandingsTable';
import { MarqueeText } from './MarqueeText';
import { HtzCard, HtzChip } from './htz';
import { htzTokens } from './htz/tokens';
import { Flame, Shield } from 'lucide-react-native';

interface TournamentSwissViewProps {
  rounds: SwissRound[];
  standings?: StandingGroup[];
  game: SportCategory;
  onSelectMatch: (match: BracketMatch) => void;
}

/**
 * Vista de una fase suiza: cruces ronda a ronda (estilo cuadro) y tabla de
 * récords, donde se marcan los equipos que ya clasifican o están eliminados.
 */
export const TournamentSwissView: React.FC<TournamentSwissViewProps> = ({
  rounds,
  standings,
  game,
  onSelectMatch,
}) => {
  const hasTable = Boolean(standings && standings.length > 0);
  const [mode, setMode] = useState<'rounds' | 'table'>('rounds');
  const effectiveMode: 'rounds' | 'table' = hasTable ? mode : 'rounds';

  if (rounds.length === 0 && !hasTable) {
    return (
      <HtzCard style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Fase suiza sin datos</Text>
        <Text style={styles.emptySubtitle}>
          Los emparejamientos se publicarán cuando arranque la fase suiza.
        </Text>
      </HtzCard>
    );
  }

  return (
    <View style={styles.container}>
      {/* Selector Rondas / Récords */}
      {hasTable && rounds.length > 0 && (
        <View style={styles.controlsRow}>
          <HtzChip
            label="Rondas"
            selected={effectiveMode === 'rounds'}
            onPress={() => setMode('rounds')}
          />
          <HtzChip
            label="Récords"
            selected={effectiveMode === 'table'}
            onPress={() => setMode('table')}
            variant={effectiveMode === 'table' ? 'primary' : 'secondary'}
          />
        </View>
      )}

      {effectiveMode === 'table' && standings ? (
        <TournamentStandingsTable standings={standings} game={game} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={styles.roundsContent}
        >
          {rounds.map((round) => (
            <View key={`${round.roundNumber}-${round.roundName}`} style={styles.roundColumn}>
              <View style={styles.roundHeader}>
                <MarqueeText
                  text={round.roundName}
                  textStyle={styles.roundTitle}
                  align="center"
                />
                <Text style={styles.roundCount}>
                  {round.matches.length} {round.matches.length === 1 ? 'serie' : 'series'}
                </Text>
              </View>

              <View style={styles.roundMatches}>
                {round.matches.map((m) => (
                  <SwissMatchCard
                    key={m.id}
                    match={m}
                    onPress={() => onSelectMatch(m)}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const SwissMatchCard: React.FC<{ match: BracketMatch; onPress: () => void }> = ({
  match,
  onPress,
}) => {
  const isLive = match.status === 'LIVE';
  const isFinished = match.status === 'FINISHED';
  const aWon =
    match.teamA.winner || (isFinished && Number(match.teamA.score) > Number(match.teamB.score));
  const bWon =
    match.teamB.winner || (isFinished && Number(match.teamB.score) > Number(match.teamA.score));

  return (
    <TouchableOpacity
      style={[styles.matchCard, isLive && styles.matchCardLive]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={styles.matchHeader}>
        {isLive ? (
          <View style={styles.liveBadge}>
            <Flame size={10} color="#EF4444" />
            <Text style={styles.liveBadgeText}>VIVO</Text>
          </View>
        ) : (
          <MarqueeText
            text={match.scheduledTime || match.name}
            textStyle={styles.matchDate}
            containerStyle={styles.matchDateMarquee}
            align="right"
          />
        )}
      </View>

      <SwissTeamRow team={match.teamA} won={aWon} />
      <SwissTeamRow team={match.teamB} won={bWon} />
    </TouchableOpacity>
  );
};

const SwissTeamRow: React.FC<{ team: BracketMatchTeam; won: boolean }> = ({ team, won }) => (
  <View style={[styles.teamRow, won && styles.teamRowWinner]}>
    <View style={styles.teamInfoCol}>
      <View style={styles.teamLogoBox}>
        {team.logo ? (
          <Image source={{ uri: team.logo }} style={styles.teamLogoImg} />
        ) : (
          <Shield size={12} color={htzTokens.colors.outline} />
        )}
      </View>
      <MarqueeText
        text={team.name || 'TBD'}
        textStyle={[styles.teamName, won && styles.teamNameWinner]}
        containerStyle={styles.teamNameMarquee}
      />
      {team.record ? <Text style={styles.teamRecord}>{team.record}</Text> : null}
    </View>
    <View style={[styles.scoreBadge, won && styles.scoreBadgeWinner]}>
      <Text style={[styles.scoreText, won && styles.scoreTextWinner]}>
        {team.score !== undefined ? team.score : '-'}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  roundsContent: {
    flexDirection: 'row',
    paddingVertical: 4,
    gap: 16,
  },
  roundColumn: {
    width: 220,
  },
  roundHeader: {
    backgroundColor: htzTokens.colors.surfaceContainerHigh,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: htzTokens.colors.outlineVariant,
  },
  roundTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  roundCount: {
    color: htzTokens.colors.outline,
    fontSize: 9,
    textAlign: 'center',
    marginTop: 2,
  },
  roundMatches: {
    gap: 10,
  },
  matchCard: {
    backgroundColor: htzTokens.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: htzTokens.colors.outlineVariant,
    padding: 8,
  },
  matchCardLive: {
    borderColor: '#EF4444',
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  matchDate: {
    color: htzTokens.colors.outline,
    fontSize: 9,
    textAlign: 'right',
  },
  matchDateMarquee: {
    flex: 1,
    minWidth: 0,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  liveBadgeText: {
    color: '#EF4444',
    fontSize: 8,
    fontWeight: '900',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  teamRowWinner: {
    backgroundColor: 'rgba(74, 124, 89, 0.08)',
    borderRadius: 4,
    paddingHorizontal: 2,
  },
  teamInfoCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  teamLogoBox: {
    width: 18,
    height: 18,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamLogoImg: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
  },
  teamName: {
    color: htzTokens.colors.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '600',
  },
  teamNameMarquee: {
    flex: 1,
    minWidth: 0,
  },
  teamNameWinner: {
    color: htzTokens.colors.onSurface,
    fontWeight: '800',
  },
  teamRecord: {
    color: htzTokens.colors.outline,
    fontSize: 9,
    fontWeight: '800',
    marginLeft: 4,
  },
  scoreBadge: {
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  scoreBadgeWinner: {
    backgroundColor: 'rgba(74, 124, 89, 0.25)',
  },
  scoreText: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    fontWeight: '700',
  },
  scoreTextWinner: {
    color: htzTokens.colors.inversePrimary,
    fontWeight: '900',
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: htzTokens.colors.surface,
  },
  emptyTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
  },
  emptySubtitle: {
    color: htzTokens.colors.outline,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
