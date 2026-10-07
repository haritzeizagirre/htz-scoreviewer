import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { StandingGroup, StandingRow, SportCategory } from '../services/types';
import { HtzCard, HtzChip } from './htz';
import { htzTokens } from './htz/tokens';
import { Trophy, Shield } from 'lucide-react-native';
import { MarqueeText } from './MarqueeText';

interface TournamentStandingsTableProps {
  standings: StandingGroup[];
  game: SportCategory;
  onSelectTeam?: (teamName: string) => void;
}

export const TournamentStandingsTable: React.FC<TournamentStandingsTableProps> = ({
  standings,
  game,
  onSelectTeam,
}) => {
  const [selectedGroupIdx, setSelectedGroupIdx] = useState(0);

  if (!standings || standings.length === 0) {
    return (
      <HtzCard style={styles.emptyCard}>
        <Trophy size={28} color={htzTokens.colors.outline} />
        <Text style={styles.emptyTitle}>Sin tabla de clasificación</Text>
        <Text style={styles.emptySubtitle}>
          Esta competición se disputa por eliminatoria directa o aún no tiene una fase regular iniciada.
        </Text>
      </HtzCard>
    );
  }

  const activeGroup = standings[selectedGroupIdx] || standings[0];
  const isEsport = game !== 'FÚTBOL';

  // Leyenda contextual: solo se muestran las zonas presentes en la tabla activa
  const zoneLegend = [
    { key: 'champions', color: '#10B981', label: isEsport ? 'Playoff' : 'Champions League' },
    { key: 'playoff_upper', color: '#10B981', label: 'Playoff / Cuadro Ganadores' },
    { key: 'europa', color: '#3B82F6', label: 'Europa League' },
    { key: 'conference', color: '#F59E0B', label: 'Conference League' },
    { key: 'playoff_lower', color: '#F59E0B', label: 'Cuadro Perdedores' },
    { key: 'relegation', color: '#EF4444', label: 'Descenso' },
    { key: 'eliminated', color: '#EF4444', label: 'Eliminado' },
  ];
  const presentZones = new Set(
    activeGroup.table.map((r) => r.zone).filter((z): z is NonNullable<typeof z> => Boolean(z))
  );
  const legendItems = zoneLegend.filter((z) => presentZones.has(z.key as any));

  return (
    <View style={styles.container}>
      {/* Selector de Grupos / Fases si hay más de 1 */}
      {standings.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.groupsScroll}
          contentContainerStyle={styles.groupsScrollContent}
        >
          {standings.map((group, idx) => (
            <HtzChip
              key={idx}
              label={group.groupName}
              selected={idx === selectedGroupIdx}
              onPress={() => setSelectedGroupIdx(idx)}
              variant={idx === selectedGroupIdx ? 'primary' : 'secondary'}
            />
          ))}
        </ScrollView>
      )}

      {/* Tabla con scroll horizontal interno para garantizar que todas las columnas sean legibles */}
      <HtzCard style={styles.tableCard}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true} bounces={false}>
          <View style={styles.tableInner}>
            {/* Header de la Tabla */}
            <View style={styles.tableHeaderRow}>
              <View style={[styles.cellPos, styles.headerCell]}>
                <Text style={styles.headerText}>#</Text>
              </View>
              <View style={[styles.cellTeam, styles.headerCell]}>
                <Text style={styles.headerText}>EQUIPO</Text>
              </View>
              <View style={[styles.cellStat, styles.headerCell]}>
                <Text style={styles.headerText}>PJ</Text>
              </View>
              <View style={[styles.cellStat, styles.headerCell]}>
                <Text style={styles.headerText}>PG</Text>
              </View>
              {!isEsport && (
                <View style={[styles.cellStat, styles.headerCell]}>
                  <Text style={styles.headerText}>PE</Text>
                </View>
              )}
              <View style={[styles.cellStat, styles.headerCell]}>
                <Text style={styles.headerText}>PP</Text>
              </View>
              <View style={[styles.cellStatWide, styles.headerCell]}>
                <Text style={styles.headerText}>{isEsport ? 'DIF' : 'DG'}</Text>
              </View>
              <View style={[styles.cellPts, styles.headerCell]}>
                <Text style={[styles.headerText, styles.headerTextPts]}>PTS</Text>
              </View>
              <View style={[styles.cellForm, styles.headerCell]}>
                <Text style={styles.headerText}>FORMA</Text>
              </View>
            </View>

            {/* Filas de la Tabla */}
            {activeGroup.table.map((row, index) => {
              const isEven = index % 2 === 0;

              // Color de la barra de zona
              let zoneColor = 'transparent';
              if (row.zone === 'champions' || row.zone === 'playoff_upper') {
                zoneColor = '#10B981'; // Verde Champions / Upper
              } else if (row.zone === 'europa') {
                zoneColor = '#3B82F6'; // Azul Europa League
              } else if (row.zone === 'conference' || row.zone === 'playoff_lower') {
                zoneColor = '#F59E0B'; // Ámbar Conference / Lower
              } else if (row.zone === 'relegation' || row.zone === 'eliminated') {
                zoneColor = '#EF4444'; // Rojo Descenso / Eliminado
              }

              const diff =
                row.goalDifference !== undefined
                  ? row.goalDifference
                  : row.roundDifference !== undefined
                  ? row.roundDifference
                  : 0;

              return (
                <TouchableOpacity
                  key={row.position + (row.teamName || '')}
                  style={[styles.tableRow, isEven && styles.tableRowEven]}
                  activeOpacity={0.7}
                  onPress={() => onSelectTeam && onSelectTeam(row.teamName)}
                >
                  {/* Indicador de Zona */}
                  <View style={[styles.zoneIndicator, { backgroundColor: zoneColor }]} />

                  {/* Posición */}
                  <View style={styles.cellPos}>
                    <Text style={styles.posText}>{row.position}</Text>
                  </View>

                  {/* Equipo y Escudo */}
                  <View style={styles.cellTeam}>
                    <View style={styles.teamLogoWrapper}>
                      {row.teamLogo ? (
                        <Image source={{ uri: row.teamLogo }} style={styles.teamLogo} />
                      ) : (
                        <Shield size={16} color={htzTokens.colors.outline} />
                      )}
                    </View>
                    <MarqueeText
                      text={row.teamName}
                      textStyle={styles.teamNameText}
                      containerStyle={styles.teamNameMarquee}
                    />
                  </View>

                  {/* Estadísticas */}
                  <View style={styles.cellStat}>
                    <Text style={styles.statText}>{row.playedGames}</Text>
                  </View>
                  <View style={styles.cellStat}>
                    <Text style={styles.statText}>{row.won}</Text>
                  </View>
                  {!isEsport && (
                    <View style={styles.cellStat}>
                      <Text style={styles.statText}>{row.draw ?? 0}</Text>
                    </View>
                  )}
                  <View style={styles.cellStat}>
                    <Text style={styles.statText}>{row.lost}</Text>
                  </View>
                  <View style={styles.cellStatWide}>
                    <Text
                      style={[
                        styles.statText,
                        diff > 0 && styles.statTextPositive,
                        diff < 0 && styles.statTextNegative,
                      ]}
                    >
                      {diff > 0 ? `+${diff}` : diff}
                    </Text>
                  </View>
                  <View style={styles.cellPts}>
                    <Text style={styles.ptsText}>{row.points ?? row.won}</Text>
                  </View>

                  {/* Forma (Últimos partidos) */}
                  <View style={styles.cellForm}>
                    {row.form && row.form.length > 0 ? (
                      <View style={styles.formPillsRow}>
                        {row.form.slice(-5).map((f, fIdx) => (
                          <View
                            key={fIdx}
                            style={[
                              styles.formPill,
                              f === 'W'
                                ? styles.formPillWin
                                : f === 'D'
                                ? styles.formPillDraw
                                : styles.formPillLoss,
                            ]}
                          >
                            <Text style={styles.formPillText}>
                              {f === 'W' ? 'V' : f === 'D' ? 'E' : 'D'}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.emptyFormText}>-</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </HtzCard>

      {/* Leyenda de Zonas (según las zonas presentes en la tabla) */}
      {legendItems.length > 0 && (
        <View style={styles.legendRow}>
          {legendItems.map((z) => (
            <View key={z.key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: z.color }]} />
              <Text style={styles.legendText}>{z.label}</Text>
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
  groupsScroll: {
    marginBottom: 12,
  },
  groupsScrollContent: {
    gap: 8,
    paddingHorizontal: 4,
  },
  tableCard: {
    padding: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: htzTokens.colors.outline,
    backgroundColor: htzTokens.colors.surface,
  },
  tableInner: {
    minWidth: 480,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: htzTokens.colors.surfaceContainerHigh,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: htzTokens.colors.outlineVariant,
  },
  headerCell: {
    justifyContent: 'center',
  },
  headerText: {
    color: htzTokens.colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerTextPts: {
    color: htzTokens.colors.inversePrimary,
    fontWeight: '900',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    position: 'relative',
  },
  tableRowEven: {
    backgroundColor: 'rgba(255, 255, 255, 0.015)',
  },
  zoneIndicator: {
    position: 'absolute',
    left: 0,
    top: 4,
    bottom: 4,
    width: 3.5,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  cellPos: {
    width: 38,
    alignItems: 'center',
  },
  posText: {
    color: htzTokens.colors.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '800',
  },
  cellTeam: {
    width: 170,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  teamLogoWrapper: {
    width: 22,
    height: 22,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamLogo: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  teamNameText: {
    color: htzTokens.colors.onSurface,
    fontSize: 12,
    fontWeight: '700',
  },
  teamNameMarquee: {
    flex: 1,
    minWidth: 0,
  },
  cellStat: {
    width: 36,
    alignItems: 'center',
  },
  cellStatWide: {
    width: 44,
    alignItems: 'center',
  },
  statText: {
    color: htzTokens.colors.onSurface,
    fontSize: 12,
    fontWeight: '600',
  },
  statTextPositive: {
    color: '#10B981',
  },
  statTextNegative: {
    color: '#EF4444',
  },
  cellPts: {
    width: 44,
    alignItems: 'center',
  },
  ptsText: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '900',
  },
  cellForm: {
    width: 110,
    alignItems: 'center',
  },
  formPillsRow: {
    flexDirection: 'row',
    gap: 3,
  },
  formPill: {
    width: 16,
    height: 16,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formPillWin: {
    backgroundColor: '#10B981',
  },
  formPillDraw: {
    backgroundColor: '#6B7280',
  },
  formPillLoss: {
    backgroundColor: '#EF4444',
  },
  formPillText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  emptyFormText: {
    color: htzTokens.colors.outline,
    fontSize: 11,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingHorizontal: 8,
    paddingTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: htzTokens.colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '600',
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
