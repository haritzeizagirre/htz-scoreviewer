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
import { ExternalLink, Shield, Flame, Clock } from 'lucide-react-native';
import { R6MatchData, R6PlayerStats } from '../services/types';
import { R6StatsService } from '../services/r6StatsService';
import { MarqueeText } from './MarqueeText';
import { MapVetoSummary } from './MapVetoSummary';
import { HtzChip, HtzButton } from './htz';
import { htzTokens } from './htz/tokens';

interface R6ScoreboardViewProps {
  teamAName: string;
  teamBName: string;
  teamALogo?: string;
  teamBLogo?: string;
  gezzlyUrl?: string;
  startTimeIso?: string;
}

export const R6ScoreboardView: React.FC<R6ScoreboardViewProps> = ({
  teamAName,
  teamBName,
  teamALogo,
  teamBLogo,
  gezzlyUrl,
  startTimeIso,
}) => {
  const [selectedMapIndex, setSelectedMapIndex] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; data: R6MatchData | null } | null>(null);

  const requestKey = `${teamAName}|${teamBName}|${gezzlyUrl || ''}|${startTimeIso || ''}`;
  const data = loaded && loaded.key === requestKey ? loaded.data : null;
  const loading = !loaded || loaded.key !== requestKey;

  useEffect(() => {
    let mounted = true;

    R6StatsService.getMatchStats(teamAName, teamBName, gezzlyUrl, startTimeIso)
      .then((res) => {
        if (mounted) {
          setLoaded({ key: requestKey, data: res });
        }
      })
      .catch((err) => {
        console.warn('Error loading R6 stats:', err);
        if (mounted) {
          setLoaded({ key: requestKey, data: null });
        }
      });

    return () => {
      mounted = false;
    };
  }, [teamAName, teamBName, gezzlyUrl, startTimeIso, requestKey]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={htzTokens.colors.primary} />
        <Text style={styles.loadingText}>Extrayendo estadísticas oficiales de Ubisoft...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.emptyContainer}>
        <Shield size={36} color={htzTokens.colors.outline} />
        <Text style={styles.emptyTitle}>Estadísticas de R6 no disponibles</Text>
        <Text style={styles.emptySubtitle}>
          {R6StatsService.getLastError()
            ? `Motivo: ${R6StatsService.getLastError()}`
            : 'No se encontró la ficha detallada de este enfrentamiento o aún no se han publicado las estadísticas completas.'}
        </Text>
        <View style={{ height: 14 }} />
        <HtzButton
          variant="secondary"
          size="sm"
          icon={<ExternalLink size={14} color={htzTokens.colors.onSurface} />}
          onPress={() => Linking.openURL('https://www.gezzly.gg/matches')}
        >
          Buscar en Gezzly
        </HtzButton>
      </View>
    );
  }

  if (data.maps.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Flame size={36} color={htzTokens.colors.primary} />
        <Text style={styles.emptyTitle}>Ficha oficial del encuentro</Text>
        <Text style={styles.emptySubtitle}>
          El encuentro se encuentra en juego o en preparación. La ficha oficial ya está registrada pero las estadísticas aún no se han publicado.
        </Text>
        <View style={{ height: 14 }} />
        <HtzButton
          variant="primary"
          size="sm"
          icon={<ExternalLink size={14} color="#FFFFFF" />}
          onPress={() => Linking.openURL(data.gezzlyUrl)}
        >
          Ver ficha en Gezzly
        </HtzButton>
      </View>
    );
  }

  const currentMap = data.maps[selectedMapIndex] || data.maps[0];
  const hasSomeCombatStats =
    currentMap &&
    currentMap.teamAStats.length > 0 &&
    currentMap.teamAStats.some((p) => p.kills && p.kills !== '-');

  const isMapNotStarted =
    currentMap &&
    currentMap.mapNumber !== 0 &&
    (currentMap.scoreA === '0' || !currentMap.scoreA) &&
    (currentMap.scoreB === '0' || !currentMap.scoreB) &&
    !hasSomeCombatStats;

  return (
    <View style={styles.container}>
      {/* Mapas y veto: quién elige cada mapa, quién lo gana y los baneos */}
      <MapVetoSummary
        maps={data.maps
          .filter((m) => m.mapNumber !== 0)
          .map((m) => ({ mapName: m.mapName, scoreA: m.scoreA, scoreB: m.scoreB }))}
        vetoRows={data.vetoRows}
        teamAName={teamAName}
        teamBName={teamBName}
        teamALogo={teamALogo}
        teamBLogo={teamBLogo}
      />

      {/* Selector de mapa + enlace externo */}
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
              } else if (m.scoreA !== undefined && m.scoreB !== undefined) {
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
            style={styles.externalLinkMinimal}
            onPress={() => Linking.openURL(data.gezzlyUrl)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.externalLinkMinimalText}>Gezzly</Text>
            <ExternalLink size={12} color={htzTokens.colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Aviso de mapa sin comenzar */}
      {isMapNotStarted && (
        <View style={styles.livePendingNotice}>
          <Clock size={12} color="#FBBF24" />
          <Text style={styles.livePendingNoticeText}>Este mapa aún no ha comenzado.</Text>
        </View>
      )}

      {/* Tabla equipo A */}
      <View style={styles.teamSection}>
        <View style={styles.teamHeaderRow}>
          <Text style={styles.teamTitle}>{teamAName}</Text>
        </View>
        {renderPlayerTable(currentMap.teamAStats)}
      </View>

      <View style={{ height: 16 }} />

      {/* Tabla equipo B */}
      <View style={styles.teamSection}>
        <View style={styles.teamHeaderRow}>
          <Text style={styles.teamTitle}>{teamBName}</Text>
        </View>
        {renderPlayerTable(currentMap.teamBStats)}
      </View>
    </View>
  );
};

function renderPlayerTable(players: R6PlayerStats[]) {
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
        {/* Cabecera de la tabla */}
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.thCell, styles.colPlayer, styles.thPlayerText]}>JUGADOR</Text>
          <Text style={[styles.thCell, styles.colKda]}>K / D</Text>
          <Text style={[styles.thCell, styles.colStat]}>+/-</Text>
          <Text style={[styles.thCell, styles.colEntry]}>EK / ED</Text>
          <Text style={[styles.thCell, styles.colStat]}>KPR</Text>
          <Text style={[styles.thCell, styles.colStat]}>HS%</Text>
          <Text style={[styles.thCell, styles.colStat]}>KOST</Text>
          <Text style={[styles.thCell, styles.colStat]}>SRV</Text>
          <Text style={[styles.thCell, styles.colStat]}>EPS</Text>
        </View>

        {/* Filas de jugadores */}
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
              {/* Jugador + avatar */}
              <View style={[styles.colPlayer, styles.playerInfoCell]}>
                {p.avatarUrl ? (
                  <Image source={{ uri: p.avatarUrl }} style={styles.playerAvatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarPlaceholderText}>
                      {p.name.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
                <MarqueeText
                  text={p.name}
                  textStyle={styles.playerName}
                  containerStyle={styles.playerNameMarquee}
                />
              </View>

              {/* K / D */}
              <Text style={[styles.tdCell, styles.colKda, styles.kdaText]}>
                {p.kills} <Text style={styles.kdaSlash}>/</Text> {p.deaths}
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

              {/* EK / ED */}
              <Text style={[styles.tdCell, styles.colEntry]}>
                {p.entryKills} <Text style={styles.kdaSlash}>/</Text> {p.entryDeaths}
              </Text>

              {/* KPR */}
              <Text style={[styles.tdCell, styles.colStat]}>{p.kpr}</Text>

              {/* HS% */}
              <Text style={[styles.tdCell, styles.colStat]}>{p.hsPercent}</Text>

              {/* KOST */}
              <Text style={[styles.tdCell, styles.colStat, styles.kostText]}>{p.kost}</Text>

              {/* SRV */}
              <Text style={[styles.tdCell, styles.colStat]}>{p.srv}</Text>

              {/* EPS */}
              <Text style={[styles.tdCell, styles.colStat, styles.epsText]}>{p.eps}</Text>
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
  vetoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  vetoTitle: {
    color: htzTokens.colors.primary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    minWidth: 500,
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
  colKda: {
    width: 52,
  },
  colStat: {
    width: 42,
  },
  colEntry: {
    width: 58,
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
  playerAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#333',
  },
  avatarPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '700',
  },
  playerName: {
    color: htzTokens.colors.onSurface,
    fontSize: 11,
    fontWeight: '700',
  },
  playerNameMarquee: {
    flex: 1,
    minWidth: 0,
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
  kostText: {
    fontWeight: '700',
    color: '#E0E0E0',
  },
  epsText: {
    fontWeight: '700',
    color: htzTokens.colors.primary,
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
  externalLinkMinimal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  externalLinkMinimalText: {
    fontSize: 11,
    fontWeight: '700',
    color: htzTokens.colors.primary,
  },
});
