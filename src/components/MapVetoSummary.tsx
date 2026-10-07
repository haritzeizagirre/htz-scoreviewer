import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Target, Ban, ChevronDown, ChevronUp } from 'lucide-react-native';
import { MarqueeText } from './MarqueeText';
import { htzTokens } from './htz/tokens';

export interface MapVetoMap {
  mapName: string;
  scoreA?: string;
  scoreB?: string;
}

export interface MapVetoRow {
  action: string;
  mapName: string;
  team?: string;
}

interface MapVetoSummaryProps {
  maps: MapVetoMap[];
  vetoRows: MapVetoRow[];
  teamAName: string;
  teamBName: string;
  teamALogo?: string;
  teamBLogo?: string;
}

const norm = (s: string): string => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const TeamLogo: React.FC<{ logo?: string; name: string; size: number }> = ({ logo, name, size }) => {
  const [failed, setFailed] = useState(false);
  if (logo && !failed) {
    return (
      <Image
        source={{ uri: logo }}
        style={{ width: size, height: size }}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#333',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#FFF', fontSize: size * 0.42, fontWeight: '800' }}>
        {name.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
};

/**
 * Bloque "Mapas y veto": por cada mapa, quién lo eligió (PICK), quién lo ganó
 * (WIN, según el marcador), si es decider, y los baneos con su equipo. Plegable
 * y cerrado por defecto. Los equipos se muestran con su escudo.
 */
export const MapVetoSummary: React.FC<MapVetoSummaryProps> = ({
  maps,
  vetoRows,
  teamAName,
  teamBName,
  teamALogo,
  teamBLogo,
}) => {
  const [open, setOpen] = useState(false);

  const rows = vetoRows || [];
  if ((!maps || maps.length === 0) && rows.length === 0) return null;

  const resolveSide = (short?: string): 'A' | 'B' | undefined => {
    if (!short) return undefined;
    const s = norm(short);
    if (!s) return undefined;
    const a = norm(teamAName);
    const b = norm(teamBName);
    if (a && (a === s || a.includes(s) || s.includes(a))) return 'A';
    if (b && (b === s || b.includes(s) || s.includes(b))) return 'B';
    return undefined;
  };

  const logoFor = (side?: 'A' | 'B') => (side === 'A' ? teamALogo : side === 'B' ? teamBLogo : undefined);
  const nameFor = (side?: 'A' | 'B') => (side === 'A' ? teamAName : side === 'B' ? teamBName : '');

  const pickFor = (mapName: string) =>
    rows.find((r) => r.action === 'pick' && norm(r.mapName) === norm(mapName));
  const isDecider = (mapName: string) =>
    rows.some((r) => r.action === 'remain' && norm(r.mapName) === norm(mapName));
  const bans = rows.filter((r) => r.action === 'ban');

  const mapRows = maps.map((m) => {
    const sa = parseInt(m.scoreA || '', 10);
    const sb = parseInt(m.scoreB || '', 10);
    const hasScore =
      m.scoreA !== undefined && m.scoreB !== undefined && (m.scoreA !== '0' || m.scoreB !== '0');
    const winSide: 'A' | 'B' | undefined =
      hasScore && sa !== sb ? (sa > sb ? 'A' : 'B') : undefined;
    const pickSide = resolveSide(pickFor(m.mapName)?.team);
    return {
      ...m,
      hasScore,
      winSide,
      pickSide,
      decider: isDecider(m.mapName),
    };
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.headerRow}
        activeOpacity={0.7}
        onPress={() => setOpen((v) => !v)}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Target size={12} color={htzTokens.colors.primary} />
        <Text style={styles.headerText}>MAPAS Y VETO</Text>
        <View style={{ flex: 1 }} />
        {open ? (
          <ChevronUp size={16} color={htzTokens.colors.outline} />
        ) : (
          <ChevronDown size={16} color={htzTokens.colors.outline} />
        )}
      </TouchableOpacity>

      {open && (
        <View style={styles.body}>
          {mapRows.map((r, idx) => (
            <View key={idx} style={[styles.mapRow, idx % 2 === 1 && styles.mapRowAlt]}>
              <MarqueeText
                text={r.mapName}
                textStyle={styles.mapName}
                containerStyle={styles.mapNameMarquee}
              />
              {r.hasScore ? (
                <Text style={styles.score}>
                  {r.scoreA ?? '-'}-{r.scoreB ?? '-'}
                </Text>
              ) : (
                <Text style={styles.scoreMuted}>—</Text>
              )}
              <View style={styles.tags}>
                {r.decider ? <Text style={[styles.tag, styles.tagDecider]}>DECIDER</Text> : null}
                {r.pickSide ? (
                  <View style={styles.tagWithLogo}>
                    <Text style={styles.tagLabel}>PICK</Text>
                    <TeamLogo
                      logo={logoFor(r.pickSide)}
                      name={nameFor(r.pickSide)}
                      size={16}
                    />
                  </View>
                ) : null}
                {r.winSide ? (
                  <View style={styles.tagWithLogo}>
                    <Text style={[styles.tagLabel, styles.tagWinLabel]}>WIN</Text>
                    <TeamLogo logo={logoFor(r.winSide)} name={nameFor(r.winSide)} size={16} />
                  </View>
                ) : null}
              </View>
            </View>
          ))}

          {bans.length > 0 && (
            <View style={styles.bansRow}>
              <Ban size={11} color={htzTokens.colors.outline} />
              <Text style={styles.bansLabel}>BANEADOS:</Text>
              <View style={styles.bansList}>
                {bans.map((b, i) => {
                  const side = resolveSide(b.team);
                  return (
                    <View key={i} style={styles.banItem}>
                      <Text style={styles.banMap}>{b.mapName}</Text>
                      {side ? (
                        <TeamLogo logo={logoFor(side)} name={nameFor(side)} size={15} />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E1E1E',
    borderColor: htzTokens.colors.surfaceVariant,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  headerText: {
    color: htzTokens.colors.primary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  body: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  mapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  mapRowAlt: {
    backgroundColor: '#1A1A1A',
  },
  mapName: {
    color: htzTokens.colors.onSurface,
    fontSize: 12,
    fontWeight: '700',
  },
  mapNameMarquee: {
    flex: 1,
    minWidth: 0,
  },
  score: {
    color: htzTokens.colors.onSurface,
    fontSize: 12,
    fontWeight: '800',
    minWidth: 42,
    textAlign: 'center',
  },
  scoreMuted: {
    color: htzTokens.colors.outline,
    fontSize: 12,
    minWidth: 42,
    textAlign: 'center',
  },
  tags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  tag: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tagDecider: {
    color: '#FBBF24',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
  },
  tagWithLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tagLabel: {
    color: htzTokens.colors.outline,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  tagWinLabel: {
    color: '#4ADE80',
  },
  bansRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    flexWrap: 'wrap',
  },
  bansLabel: {
    color: htzTokens.colors.outline,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  bansList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    flex: 1,
  },
  banItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  banMap: {
    color: htzTokens.colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '600',
  },
});
