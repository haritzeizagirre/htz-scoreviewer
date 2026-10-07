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
  TournamentBracket,
  BracketRound,
  BracketMatch,
  Match,
} from '../services/types';
import { HtzCard, HtzChip, HtzButton } from './htz';
import { htzTokens } from './htz/tokens';
import { MarqueeText } from './MarqueeText';
import { Trophy, LayoutGrid, ListFilter, Shield, ChevronRight, Flame } from 'lucide-react-native';

interface TournamentBracketViewProps {
  bracket?: TournamentBracket;
  onSelectMatch?: (match: BracketMatch) => void;
}

export const TournamentBracketView: React.FC<TournamentBracketViewProps> = ({
  bracket,
  onSelectMatch,
}) => {
  const [viewMode, setViewMode] = useState<'visual' | 'list'>('visual');
  const [bracketSection, setBracketSection] = useState<'upper' | 'lower' | 'final'>('upper');

  if (!bracket || (!bracket.upperRounds?.length && !bracket.grandFinal)) {
    return (
      <HtzCard style={styles.emptyCard}>
        <Trophy size={28} color={htzTokens.colors.outline} />
        <Text style={styles.emptyTitle}>Cuadro de playoffs no disponible</Text>
        <Text style={styles.emptySubtitle}>
          Esta competición aún no ha definido sus cruces eliminatorios o se juega íntegramente en formato de liga regular.
        </Text>
      </HtzCard>
    );
  }

  const hasLower = Boolean(bracket.lowerRounds && bracket.lowerRounds.length > 0);
  const hasGrandFinal = Boolean(bracket.grandFinal);

  // Determinar rondas activas según sección seleccionada
  let activeRounds: BracketRound[] = [];
  if (bracketSection === 'upper') {
    const upper = bracket.upperRounds || [];
    // En eliminación directa la Gran Final no tiene pestaña propia: se añade como columna final.
    const gf = bracket.grandFinal;
    const gfAlreadyShown = Boolean(gf && upper.some((r) => r.matches.some((m) => m.id === gf.id)));
    activeRounds =
      gf && !hasLower && !gfAlreadyShown
        ? [...upper, { roundNumber: 99, roundName: 'Gran Final', matches: [gf] }]
        : upper;
  } else if (bracketSection === 'lower') {
    activeRounds = bracket.lowerRounds || [];
  } else if (bracketSection === 'final' && bracket.grandFinal) {
    activeRounds = [
      {
        roundNumber: 99,
        roundName: 'Gran Final',
        matches: [bracket.grandFinal],
      },
    ];
  }

  const renderMatchCard = (m: BracketMatch, compact = false) => {
    const isLive = m.status === 'LIVE';
    const isFinished = m.status === 'FINISHED';

    const aWon = m.teamA.winner || (isFinished && Number(m.teamA.score) > Number(m.teamB.score));
    const bWon = m.teamB.winner || (isFinished && Number(m.teamB.score) > Number(m.teamA.score));

    return (
      <TouchableOpacity
        key={m.id}
        style={[styles.matchCard, compact && styles.matchCardCompact, isLive && styles.matchCardLive]}
        activeOpacity={0.8}
        onPress={() => onSelectMatch && onSelectMatch(m)}
      >
        {/* Match Header / Stage */}
        <View style={styles.matchCardHeader}>
          <MarqueeText
            text={m.name || m.stage || 'Partido'}
            textStyle={styles.matchStageText}
            containerStyle={styles.matchStageMarquee}
          />
          {isLive ? (
            <View style={styles.liveBadge}>
              <Flame size={10} color="#EF4444" />
              <Text style={styles.liveBadgeText}>VIVO</Text>
            </View>
          ) : m.scheduledTime ? (
            <Text style={styles.matchDateText}>{m.scheduledTime}</Text>
          ) : null}
        </View>

        {/* Team A */}
        <View style={[styles.teamRow, aWon && styles.teamRowWinner]}>
          <View style={styles.teamInfoCol}>
            <View style={styles.teamLogoBox}>
              {m.teamA.logo ? (
                <Image source={{ uri: m.teamA.logo }} style={styles.teamLogoImg} />
              ) : (
                <Shield size={12} color={htzTokens.colors.outline} />
              )}
            </View>
            <MarqueeText
              text={m.teamA.name || 'TBD'}
              textStyle={[styles.teamNameText, aWon && styles.teamTextWinner]}
              containerStyle={styles.teamNameMarquee}
            />
          </View>
          <View style={[styles.scoreBadge, aWon && styles.scoreBadgeWinner]}>
            <Text style={[styles.scoreText, aWon && styles.scoreTextWinner]}>
              {m.teamA.score !== undefined ? m.teamA.score : '-'}
            </Text>
          </View>
        </View>

        {/* Team B */}
        <View style={[styles.teamRow, bWon && styles.teamRowWinner]}>
          <View style={styles.teamInfoCol}>
            <View style={styles.teamLogoBox}>
              {m.teamB.logo ? (
                <Image source={{ uri: m.teamB.logo }} style={styles.teamLogoImg} />
              ) : (
                <Shield size={12} color={htzTokens.colors.outline} />
              )}
            </View>
            <MarqueeText
              text={m.teamB.name || 'TBD'}
              textStyle={[styles.teamNameText, bWon && styles.teamTextWinner]}
              containerStyle={styles.teamNameMarquee}
            />
          </View>
          <View style={[styles.scoreBadge, bWon && styles.scoreBadgeWinner]}>
            <Text style={[styles.scoreText, bWon && styles.scoreTextWinner]}>
              {m.teamB.score !== undefined ? m.teamB.score : '-'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Controls: Section Tabs (Upper/Lower/Final) & View Mode Switcher */}
      <View style={styles.controlsRow}>
        {/* Selector de Sección si es Doble Eliminación */}
        {hasLower ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionTabs}>
            <HtzChip
              label="Cuadro Ganadores"
              selected={bracketSection === 'upper'}
              onPress={() => setBracketSection('upper')}
              variant={bracketSection === 'upper' ? 'primary' : 'secondary'}
            />
            <HtzChip
              label="Cuadro Perdedores"
              selected={bracketSection === 'lower'}
              onPress={() => setBracketSection('lower')}
              variant={bracketSection === 'lower' ? 'warning' : 'secondary'}
            />
            {hasGrandFinal && (
              <HtzChip
                label="Gran Final"
                selected={bracketSection === 'final'}
                onPress={() => setBracketSection('final')}
                variant={bracketSection === 'final' ? 'primary' : 'secondary'}
              />
            )}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>
            <Text style={styles.singleBracketTitle}>Cuadro de Eliminación Directa</Text>
          </View>
        )}

        {/* Conmutador de modo: Gráfico vs Lista */}
        <View style={styles.viewToggleGroup}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'visual' && styles.toggleBtnActive]}
            onPress={() => setViewMode('visual')}
          >
            <LayoutGrid size={14} color={viewMode === 'visual' ? '#FFFFFF' : htzTokens.colors.outline} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <ListFilter size={14} color={viewMode === 'list' ? '#FFFFFF' : htzTokens.colors.outline} />
          </TouchableOpacity>
        </View>
      </View>

      {/* VISTA 1: CUADRO VISUAL HORIZONTAL */}
      {viewMode === 'visual' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={styles.visualBracketContent}
        >
          {activeRounds.map((round, rIdx) => (
            <View key={round.roundNumber + round.roundName} style={styles.roundColumn}>
              {/* Encabezado de la Ronda */}
              <View style={styles.roundColumnHeader}>
                <MarqueeText
                  text={round.roundName}
                  textStyle={styles.roundColumnTitle}
                  align="center"
                />
                <Text style={styles.roundMatchesCount}>
                  {round.matches.length} {round.matches.length === 1 ? 'partido' : 'partidos'}
                </Text>
              </View>

              {/* Lista de Partidos de esta ronda */}
              <View style={styles.roundMatchesCol}>
                {round.matches.map((m) => renderMatchCard(m, true))}
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        /* VISTA 2: LISTA VERTICAL AGRUPADA POR RONDAS */
        <View style={styles.listBracketContainer}>
          {activeRounds.map((round) => (
            <View key={round.roundNumber + round.roundName} style={styles.listRoundGroup}>
              <View style={styles.listRoundHeader}>
                <Trophy size={14} color={htzTokens.colors.primary} />
                <Text style={styles.listRoundTitle}>{round.roundName}</Text>
              </View>
              <View style={styles.listMatchesStack}>
                {round.matches.map((m) => renderMatchCard(m, false))}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  sectionTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  singleBracketTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },
  viewToggleGroup: {
    flexDirection: 'row',
    backgroundColor: htzTokens.colors.surfaceContainerHigh,
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: htzTokens.colors.outlineVariant,
  },
  toggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: htzTokens.colors.primary,
  },
  visualBracketContent: {
    flexDirection: 'row',
    paddingVertical: 8,
    gap: 16,
  },
  roundColumn: {
    width: 230,
  },
  roundColumnHeader: {
    backgroundColor: htzTokens.colors.surfaceContainerHigh,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: htzTokens.colors.outlineVariant,
  },
  roundColumnTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  roundMatchesCount: {
    color: htzTokens.colors.outline,
    fontSize: 9,
    textAlign: 'center',
    marginTop: 2,
  },
  roundMatchesCol: {
    gap: 12,
    justifyContent: 'space-around',
    flex: 1,
  },
  matchCard: {
    backgroundColor: htzTokens.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: htzTokens.colors.outlineVariant,
    padding: 10,
    overflow: 'hidden',
  },
  matchCardCompact: {
    padding: 8,
  },
  matchCardLive: {
    borderColor: '#EF4444',
  },
  matchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  matchStageText: {
    color: htzTokens.colors.outline,
    fontSize: 10,
    fontWeight: '700',
  },
  matchStageMarquee: {
    flex: 1,
    minWidth: 0,
    marginRight: 6,
  },
  matchDateText: {
    color: htzTokens.colors.outline,
    fontSize: 9,
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
  teamNameText: {
    color: htzTokens.colors.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '600',
  },
  teamNameMarquee: {
    flex: 1,
    minWidth: 0,
  },
  teamTextWinner: {
    color: htzTokens.colors.onSurface,
    fontWeight: '800',
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
  listBracketContainer: {
    gap: 16,
  },
  listRoundGroup: {
    gap: 8,
  },
  listRoundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  listRoundTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '800',
  },
  listMatchesStack: {
    gap: 8,
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
