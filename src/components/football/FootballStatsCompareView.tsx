import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BarChart3 } from 'lucide-react-native';
import { FootballTeamStats, Match } from '../../services/types';
import { HtzCard } from '../htz';
import { htzTokens } from '../htz/tokens';
import { FootballMatchDetailState } from './useFootballMatchDetail';
import { FootballLoading, TeamCrest } from './FootballShared';

interface FootballStatsCompareViewProps {
  match: Match;
  state: FootballMatchDetailState;
}

/** Filas de la comparativa (solo las que traigan datos). */
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

/** Página de estadísticas: comparativa de equipo con escudos y barras. */
export const FootballStatsCompareView: React.FC<FootballStatsCompareViewProps> = ({
  match,
  state,
}) => {
  const { detail, loading } = state;

  if (loading) return <FootballLoading />;

  const statsA = detail?.statsA;
  const statsB = detail?.statsB;
  const statRows = STAT_ROWS.map((row) => ({
    ...row,
    a: statsA?.[row.key],
    b: statsB?.[row.key],
  })).filter((row) => row.a !== undefined || row.b !== undefined);

  if (statRows.length === 0) {
    return (
      <HtzCard style={styles.emptyCard}>
        <BarChart3 size={26} color={htzTokens.colors.outline} />
        <Text style={styles.emptyTitle}>Sin estadísticas todavía</Text>
        <Text style={styles.emptySubtitle}>
          {match.status === 'UPCOMING'
            ? 'La posesión, los tiros y el resto de la comparativa aparecerán en directo al comenzar el encuentro.'
            : 'La fuente no publicó estadísticas de equipo en este partido.'}
        </Text>
      </HtzCard>
    );
  }

  return (
    <View style={styles.container}>
      <HtzCard style={styles.card}>
        {/* Cabecera con los dos equipos */}
        <View style={styles.headerRow}>
          <View style={styles.headerTeam}>
            <TeamCrest team={match.teamA} size={24} />
            <Text style={styles.headerName} numberOfLines={1}>
              {match.teamA.shortName || match.teamA.name}
            </Text>
          </View>
          <Text style={styles.headerVs}>vs</Text>
          <View style={[styles.headerTeam, styles.headerTeamRight]}>
            <Text style={[styles.headerName, styles.headerNameRight]} numberOfLines={1}>
              {match.teamB.shortName || match.teamB.name}
            </Text>
            <TeamCrest team={match.teamB} size={24} />
          </View>
        </View>

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 2,
  },
  card: {
    backgroundColor: htzTokens.colors.surface,
    borderColor: htzTokens.colors.outline,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerTeam: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minWidth: 0,
  },
  headerTeamRight: {
    justifyContent: 'flex-end',
  },
  headerName: {
    color: htzTokens.colors.onSurface,
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 1,
  },
  headerNameRight: {
    textAlign: 'right',
  },
  headerVs: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    fontWeight: '700',
    marginHorizontal: 10,
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
