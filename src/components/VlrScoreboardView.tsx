import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import {
  Trophy,
  ExternalLink,
  Layers,
  Sparkles,
  Shield,
  Flame,
  Globe,
  Clock,
} from 'lucide-react-native';
import { VlrMatchData, VlrMapData, VlrPlayerStats } from '../services/types';
import { VlrScraperService } from '../services/vlrScraperService';
import { MarqueeText } from './MarqueeText';
import { HtzCard, HtzChip, HtzButton, HtzBadge } from './htz';
import { htzTokens } from './htz/tokens';
import { MapVetoSummary } from './MapVetoSummary';

interface VlrScoreboardViewProps {
  teamAName: string;
  teamBName: string;
  teamALogo?: string;
  teamBLogo?: string;
  vlrUrl?: string;
}



export const VlrScoreboardView: React.FC<VlrScoreboardViewProps> = ({
  teamAName,
  teamBName,
  teamALogo,
  teamBLogo,
  vlrUrl,
}) => {
  const [data, setData] = useState<VlrMatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMapIndex, setSelectedMapIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    VlrScraperService.getMatchStats(teamAName, teamBName, vlrUrl)
      .then((res) => {
        if (mounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          console.warn('Error loading VLR stats:', err);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [teamAName, teamBName, vlrUrl]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={htzTokens.colors.primary} />
        <Text style={styles.loadingText}>Extrayendo estadísticas oficiales de VLR.gg...</Text>
      </View>
    );
  }

  if (!data) {
    const searchUrl = `https://www.vlr.gg/search/?q=${encodeURIComponent(
      `${teamAName} ${teamBName}`
    )}`;
    return (
      <View style={styles.emptyContainer}>
        <Shield size={36} color={htzTokens.colors.outline} />
        <Text style={styles.emptyTitle}>Estadísticas de VLR.gg no disponibles</Text>
        <Text style={styles.emptySubtitle}>
          No se encontró la ficha detallada de este enfrentamiento o aún no se han publicado las estadísticas completas.
        </Text>
        <View style={{ height: 14 }} />
        <HtzButton
          variant="secondary"
          size="sm"
          icon={<ExternalLink size={14} color={htzTokens.colors.onSurface} />}
          onPress={() => Linking.openURL(searchUrl)}
        >
          Buscar en VLR.gg
        </HtzButton>
      </View>
    );
  }

  if (data.maps.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Flame size={36} color={htzTokens.colors.primary} />
        <Text style={styles.emptyTitle}>Ficha oficial en VLR.gg</Text>
        <Text style={styles.emptySubtitle}>
          El encuentro se encuentra en juego o en preparación. La ficha oficial ya está registrada pero los mapas y alineaciones aún no se han publicado por la organización.
        </Text>
        <View style={{ height: 14 }} />
        <HtzButton
          variant="primary"
          size="sm"
          icon={<ExternalLink size={14} color="#FFFFFF" />}
          onPress={() => Linking.openURL(data.vlrUrl)}
        >
          Ver directo en VLR.gg
        </HtzButton>
      </View>
    );
  }

  const currentMap = data.maps[selectedMapIndex] || data.maps[0];
  const hasSomeCombatStats =
    currentMap &&
    currentMap.teamAStats.length > 0 &&
    currentMap.teamAStats.some(
      (p) => (p.kills && p.kills !== '-') || (p.acs && p.acs !== '-')
    );

  const isMapNotStarted =
    currentMap &&
    currentMap.mapNumber !== 0 &&
    (currentMap.scoreA === '0' || !currentMap.scoreA) &&
    (currentMap.scoreB === '0' || !currentMap.scoreB) &&
    !hasSomeCombatStats;

  const isLiveStatsPending =
    currentMap &&
    !isMapNotStarted &&
    !hasSomeCombatStats &&
    currentMap.teamAStats.length > 0;

  return (
    <View style={styles.container}>
      {/* Mapas y veto: quién elige cada mapa, quién lo gana y los baneos */}
      <MapVetoSummary
        maps={data.maps
          .filter((m) => m.mapNumber !== 0)
          .map((m) => ({ mapName: m.mapName, scoreA: m.scoreA, scoreB: m.scoreB }))}
        vetoRows={data.vetoRows || []}
        teamAName={teamAName}
        teamBName={teamBName}
        teamALogo={teamALogo}
        teamBLogo={teamBLogo}
      />

      {/* Map Switcher Pills + Compact External Link */}
      {data.maps.length > 1 && (
        <View style={styles.mapSwitcherRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.mapsScroll}
            contentContainerStyle={styles.mapsScrollContent}
          >
            {data.maps.map((m, idx) => {
              let label = m.mapName;
              if (m.mapNumber === 0) {
                label = 'Todos';
              } else if (m.scoreA !== undefined && m.scoreB !== undefined && (m.scoreA !== '0' || m.scoreB !== '0')) {
                label = `${m.mapName} (${m.scoreA}-${m.scoreB})`;
              }
              return (
                <HtzChip
                  key={idx}
                  label={label}
                  selected={selectedMapIndex === idx}
                  onPress={() => setSelectedMapIndex(idx)}
                />
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={styles.vlrLinkMinimal}
            onPress={() => Linking.openURL(data.vlrUrl)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.vlrLinkMinimalText}>VLR.gg</Text>
            <ExternalLink size={12} color={htzTokens.colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Notice if map has not started yet */}
      {isMapNotStarted && (
        <View style={styles.livePendingNotice}>
          <Clock size={12} color="#FBBF24" />
          <Text style={styles.livePendingNoticeText}>
            Este mapa aún no ha comenzado.
          </Text>
        </View>
      )}

      {/* Notice if stats are pending for a live map without combat events yet */}
      {isLiveStatsPending && (
        <View style={styles.livePendingNotice}>
          <Clock size={12} color="#FBBF24" />
          <Text style={styles.livePendingNoticeText}>
            Encuentro en directo: Estadísticas en vivo registrándose en VLR.gg.
          </Text>
        </View>
      )}

      {/* Team A Table */}
      <View style={styles.teamSection}>
        <View style={styles.teamHeaderRow}>
          <Text style={styles.teamTitle}>{teamAName}</Text>
        </View>
        {renderPlayerTable(currentMap.teamAStats)}
      </View>

      <View style={{ height: 16 }} />

      {/* Team B Table */}
      <View style={styles.teamSection}>
        <View style={styles.teamHeaderRow}>
          <Text style={styles.teamTitle}>{teamBName}</Text>
        </View>
        {renderPlayerTable(currentMap.teamBStats)}
      </View>
    </View>
  );
};

function renderPlayerTable(players: VlrPlayerStats[]) {
  if (!players || players.length === 0) {
    return (
      <View style={styles.noDataRow}>
        <Text style={styles.noDataText}>Sin datos para este mapa</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
      <View style={styles.table}>
        {/* Table Header */}
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.thCell, styles.colPlayer, styles.thPlayerText]}>JUGADOR</Text>
          <Text style={[styles.thCell, styles.colAgent]}>AGENTE</Text>
          <Text style={[styles.thCell, styles.colStat]}>R</Text>
          <Text style={[styles.thCell, styles.colStat]}>ACS</Text>
          <Text style={[styles.thCell, styles.colKda]}>K / D / A</Text>
          <Text style={[styles.thCell, styles.colStat]}>+/-</Text>
          <Text style={[styles.thCell, styles.colStat]}>KAST</Text>
          <Text style={[styles.thCell, styles.colStat]}>ADR</Text>
          <Text style={[styles.thCell, styles.colStat]}>HS%</Text>
          <Text style={[styles.thCell, styles.colStat]}>FK</Text>
          <Text style={[styles.thCell, styles.colStat]}>FD</Text>
        </View>

        {/* Player Rows */}
        {players.map((p, idx) => {
          const isPositive = p.kdDiff.startsWith('+');
          const isNegative = p.kdDiff.startsWith('-');

          return (
            <View
              key={idx}
              style={[
                styles.tableRow,
                idx % 2 === 1 && styles.tableRowAlt,
                idx === players.length - 1 && styles.tableRowLast,
              ]}
            >
              {/* Player Name & Country */}
              <View style={[styles.colPlayer, styles.playerInfoCell]}>
                {p.countryCode ? (
                  <View style={styles.countryCodePill}>
                    <Text style={styles.countryCodePillText}>{p.countryCode.toUpperCase()}</Text>
                  </View>
                ) : null}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <MarqueeText text={p.name} textStyle={styles.playerName} />
                  {p.teamTag ? (
                    <Text style={styles.playerTag}>{p.teamTag}</Text>
                  ) : null}
                </View>
              </View>

              {/* Agent */}
              <View style={[styles.colAgent, styles.agentCell]}>
                {p.agentIconUrl ? (
                  <Image source={{ uri: p.agentIconUrl }} style={styles.agentImage} />
                ) : (
                  <View style={styles.agentPlaceholder}>
                    <Text style={styles.agentPlaceholderText}>
                      {p.agentName?.slice(0, 3).toUpperCase() || '-'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Rating */}
              <Text style={[styles.tdCell, styles.colStat, styles.ratingText]}>
                {p.rating}
              </Text>

              {/* ACS */}
              <Text style={[styles.tdCell, styles.colStat, styles.acsText]}>
                {p.acs}
              </Text>

              {/* KDA */}
              <Text style={[styles.tdCell, styles.colKda, styles.kdaText]}>
                {p.kills} <Text style={styles.kdaSlash}>/</Text> {p.deaths}{' '}
                <Text style={styles.kdaSlash}>/</Text> {p.assists}
              </Text>

              {/* +/- */}
              <View style={[styles.colStat, styles.diffBadge]}>
                <Text
                  style={[
                    styles.diffText,
                    isPositive && styles.diffPositive,
                    isNegative && styles.diffNegative,
                  ]}
                >
                  {p.kdDiff}
                </Text>
              </View>

              {/* KAST */}
              <Text style={[styles.tdCell, styles.colStat]}>{p.kast}</Text>

              {/* ADR */}
              <Text style={[styles.tdCell, styles.colStat]}>{p.adr}</Text>

              {/* HS% */}
              <Text style={[styles.tdCell, styles.colStat]}>{p.hsPercent}</Text>

              {/* FK */}
              <Text style={[styles.tdCell, styles.colStat]}>{p.fk}</Text>

              {/* FD */}
              <Text style={[styles.tdCell, styles.colStat]}>{p.fd}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  loadingText: {
    color: htzTokens.colors.outline,
    fontSize: 12,
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: htzTokens.colors.outline,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  vetoBanner: {
    backgroundColor: '#1E1E1E',
    borderColor: htzTokens.colors.surfaceVariant,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  patchBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  patchText: {
    color: htzTokens.colors.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  vetoText: {
    color: htzTokens.colors.onSurfaceVariant,
    fontSize: 11,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  vetoLabel: {
    color: htzTokens.colors.outline,
    fontWeight: '800',
    fontStyle: 'normal',
  },
  mapsScroll: {
    marginBottom: 12,
  },
  mapsScrollContent: {
    gap: 8,
  },
  officialHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badgeOfficial: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: htzTokens.colors.inversePrimary,
  },
  badgeOfficialText: {
    color: htzTokens.colors.inversePrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  externalLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  externalLinkText: {
    color: htzTokens.colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  teamSection: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    overflow: 'hidden',
  },
  teamHeaderRow: {
    backgroundColor: '#222222',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  teamTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  noDataRow: {
    padding: 16,
    alignItems: 'center',
  },
  noDataText: {
    color: htzTokens.colors.outline,
    fontSize: 12,
  },
  tableScroll: {
    flexGrow: 0,
  },
  table: {
    minWidth: 540,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#242424',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  thCell: {
    color: htzTokens.colors.outline,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  thPlayerText: {
    textAlign: 'left',
  },
  colPlayer: {
    width: 120,
    paddingLeft: 4,
  },
  colAgent: {
    width: 44,
  },
  colStat: {
    width: 38,
  },
  colKda: {
    width: 74,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#282828',
  },
  tableRowAlt: {
    backgroundColor: '#1C1C1C',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tdCell: {
    color: htzTokens.colors.onSurface,
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  playerInfoCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flagEmoji: {
    fontSize: 12,
  },
  playerName: {
    color: htzTokens.colors.onSurface,
    fontSize: 11,
    fontWeight: '700',
  },
  playerTag: {
    color: htzTokens.colors.outline,
    fontSize: 9,
    fontWeight: '600',
  },
  agentCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentImage: {
    width: 22,
    height: 22,
    borderRadius: 4,
  },
  agentPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentPlaceholderText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '700',
  },
  ratingText: {
    fontWeight: '700',
    color: '#E0E0E0',
  },
  acsText: {
    fontWeight: '700',
    color: htzTokens.colors.primary,
  },
  kdaText: {
    fontWeight: '600',
    fontSize: 10,
  },
  kdaSlash: {
    color: htzTokens.colors.outline,
    fontWeight: '400',
  },
  diffBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  diffText: {
    fontSize: 10,
    fontWeight: '700',
  },
  diffPositive: {
    color: '#4ADE80',
  },
  diffNegative: {
    color: '#F87171',
  },
  livePendingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
    gap: 8,
  },
  livePendingNoticeText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    lineHeight: 15,
  },
  mapSwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  vlrLinkMinimal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  vlrLinkMinimalText: {
    fontSize: 11,
    fontWeight: '700',
    color: htzTokens.colors.primary,
  },
  countryCodePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginRight: 6,
  },
  countryCodePillText: {
    color: htzTokens.colors.outline,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
