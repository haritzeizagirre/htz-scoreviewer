import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TournamentStage, SportCategory, BracketMatch, Match } from '../services/types';
import { TournamentStandingsTable } from './TournamentStandingsTable';
import { TournamentBracketView } from './TournamentBracketView';
import { TournamentSwissView } from './TournamentSwissView';
import { TournamentTeamsView } from './TournamentTeamsView';
import { MatchCard } from './MatchCard';
import { HtzCard } from './htz';
import { htzTokens } from './htz/tokens';
import { Trophy, Calendar } from 'lucide-react-native';

interface TournamentStageViewProps {
  stage: TournamentStage;
  game: SportCategory;
  onSelectMatch: (match: BracketMatch) => void;
  /** Selección de un partido real de la fase (fallback sin tabla ni cuadro). */
  onSelectStageMatch?: (match: Match) => void;
}

/**
 * Contenido de una fase interna del torneo. Cada fase se pinta con lo que
 * realmente se juega en ella: tabla (liga/grupos), rondas suizas o cuadro.
 */
export const TournamentStageView: React.FC<TournamentStageViewProps> = ({
  stage,
  game,
  onSelectMatch,
  onSelectStageMatch,
}) => {
  const hasSwiss = Boolean(stage.swissRounds && stage.swissRounds.length > 0);
  const hasStandings = Boolean(stage.standings && stage.standings.length > 0);
  const hasBracket = Boolean(
    stage.bracket && (stage.bracket.upperRounds?.length || stage.bracket.grandFinal)
  );
  const stageMatches = stage.matches || [];

  if (!hasSwiss && !hasStandings && !hasBracket) {
    // Fase sin tabla/cuadro: si los cruces aún no tienen equipos, se muestran
    // los equipos confirmados de la fase; si hay cruces reales, los partidos.
    const hasRealMatches = stageMatches.some(
      (m) => m.teamA.name !== 'TBD' && m.teamB.name !== 'TBD'
    );
    if (hasRealMatches && onSelectStageMatch) {
      return (
        <View style={styles.container}>
          <View style={styles.sectionHeader}>
            <Calendar size={14} color={htzTokens.colors.primary} />
            <Text style={styles.sectionTitle}>Partidos de la fase</Text>
          </View>
          <View style={{ gap: 8 }}>
            {stageMatches.map((m) => (
              <MatchCard key={m.id} match={m} onPress={() => onSelectStageMatch(m)} />
            ))}
          </View>
        </View>
      );
    }
    if (stage.participants && stage.participants.length > 0) {
      return (
        <View style={styles.container}>
          <View style={styles.sectionHeader}>
            <Trophy size={14} color={htzTokens.colors.primary} />
            <Text style={styles.sectionTitle}>Equipos confirmados de la fase</Text>
          </View>
          <TournamentTeamsView participants={stage.participants} game={game} />
        </View>
      );
    }
    return (
      <HtzCard style={styles.emptyCard}>
        <Trophy size={28} color={htzTokens.colors.outline} />
        <Text style={styles.emptyTitle}>Fase sin datos todavía</Text>
        <Text style={styles.emptySubtitle}>
          La clasificación o los cruces de {stage.name} se publicarán cuando la
          organización los confirme.
        </Text>
      </HtzCard>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fase suiza: cruces ronda a ronda + récords */}
      {hasSwiss && stage.swissRounds && (
        <TournamentSwissView
          rounds={stage.swissRounds}
          standings={stage.standings}
          game={game}
          onSelectMatch={onSelectMatch}
        />
      )}

      {/* Tabla de clasificación de la fase (grupos, liga, liguilla de play-in...) */}
      {!hasSwiss && hasStandings && stage.standings && (
        <TournamentStandingsTable standings={stage.standings} game={game} />
      )}

      {/* Cuadro de eliminatorias real de la fase */}
      {hasBracket && stage.bracket && (
        <View style={hasStandings || hasSwiss ? styles.bracketSection : undefined}>
          {(hasStandings || hasSwiss) && (
            <View style={styles.sectionHeader}>
              <Trophy size={14} color={htzTokens.colors.primary} />
              <Text style={styles.sectionTitle}>Cuadro de eliminatorias</Text>
            </View>
          )}
          <TournamentBracketView bracket={stage.bracket} onSelectMatch={onSelectMatch} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  bracketSection: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '800',
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
