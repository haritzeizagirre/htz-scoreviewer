import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TournamentStage, SportCategory, BracketMatch } from '../services/types';
import { TournamentStandingsTable } from './TournamentStandingsTable';
import { TournamentBracketView } from './TournamentBracketView';
import { TournamentSwissView } from './TournamentSwissView';
import { HtzCard } from './htz';
import { htzTokens } from './htz/tokens';
import { Trophy } from 'lucide-react-native';

interface TournamentStageViewProps {
  stage: TournamentStage;
  game: SportCategory;
  onSelectMatch: (match: BracketMatch) => void;
}

/**
 * Contenido de una fase interna del torneo. Cada fase se pinta con lo que
 * realmente se juega en ella: tabla (liga/grupos), rondas suizas o cuadro.
 */
export const TournamentStageView: React.FC<TournamentStageViewProps> = ({
  stage,
  game,
  onSelectMatch,
}) => {
  const hasSwiss = Boolean(stage.swissRounds && stage.swissRounds.length > 0);
  const hasStandings = Boolean(stage.standings && stage.standings.length > 0);
  const hasBracket = Boolean(
    stage.bracket && (stage.bracket.upperRounds?.length || stage.bracket.grandFinal)
  );

  if (!hasSwiss && !hasStandings && !hasBracket) {
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
