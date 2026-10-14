import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { FootballLineupPlayer, Match, PlayerInfo } from '../../services/types';
import { HtzCard } from '../htz';
import { htzTokens } from '../htz/tokens';
import { FootballMatchDetailState } from './useFootballMatchDetail';
import { buildContributions, contributionOf, ratingColor, translatePosition } from './helpers';
import { FootballPitch } from './FootballPitch';
import { FootballPlayerBadges } from './FootballPlayerBadges';
import { FootballLoading, TeamCrest } from './FootballShared';

interface FootballLineupsViewProps {
  match: Match;
  state: FootballMatchDetailState;
}

/** Página de alineaciones: medio campo con los titulares y lista de suplentes. */
export const FootballLineupsView: React.FC<FootballLineupsViewProps> = ({ match, state }) => {
  const { detail, loading, canFetch } = state;
  const [side, setSide] = useState<'A' | 'B'>('A');

  const contributions = useMemo(() => buildContributions(detail), [detail]);

  if (loading) return <FootballLoading />;

  const team = side === 'A' ? match.teamA : match.teamB;
  const lineup = side === 'A' ? detail?.lineupA : detail?.lineupB;
  const starters = lineup?.starters || [];
  const bench = lineup?.bench || [];
  const unavailable = lineup?.unavailable || [];
  const hasOfficial = starters.length > 0 || bench.length > 0;

  // Los rosters "conocidos" (semilla) solo valen para los partidos de demo: en
  // partidos reales, si la fuente no publica alineación, se dice y ya está.
  const fallbackRoster: PlayerInfo[] = hasOfficial || canFetch
    ? []
    : side === 'A'
    ? match.teamA.players || match.details?.rosterA?.players || []
    : match.teamB.players || match.details?.rosterB?.players || [];

  const renderPlayer = (p: FootballLineupPlayer, idx: number) => {
    const rating = typeof p.rating === 'number' ? p.rating : null;
    const contribution = contributionOf(contributions, p.name);
    return (
      <View key={`${p.id ?? p.name}-${idx}`} style={styles.playerRow}>
        <View style={styles.shirtPill}>
          <Text style={styles.shirtText}>{p.shirtNumber ?? '–'}</Text>
        </View>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName} numberOfLines={1}>
            {p.name}
          </Text>
          <View style={styles.playerMetaRow}>
            {p.position ? (
              <Text style={styles.playerPosition}>{translatePosition(p.position)}</Text>
            ) : null}
            <FootballPlayerBadges contribution={contribution} size={11} />
          </View>
        </View>
        {rating != null && (
          <View style={[styles.ratingChip, { backgroundColor: ratingColor(rating) }]}>
            <Text style={styles.ratingChipText}>{rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderRosterPlayer = (p: PlayerInfo, idx: number) => (
    <View key={`${p.id ?? p.name}-${idx}`} style={styles.playerRow}>
      <View style={styles.shirtPill}>
        <Text style={styles.shirtText}>{p.number ?? '–'}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName} numberOfLines={1}>
          {p.nickname || p.name}
        </Text>
        {p.role ? <Text style={styles.playerPosition}>{p.role}</Text> : null}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Selector de equipo: el campo muestra a un equipo a la vez */}
      <View style={styles.switchRow}>
        {(['A', 'B'] as const).map((s) => {
          const item = s === 'A' ? match.teamA : match.teamB;
          const active = side === s;
          return (
            <TouchableOpacity
              key={s}
              style={[styles.switchBtn, active && styles.switchBtnActive]}
              onPress={() => setSide(s)}
              accessibilityRole="button"
              accessibilityLabel={`Ver alineación de ${item.name}`}
            >
              <TeamCrest team={item} size={20} />
              <Text
                style={[styles.switchText, active && styles.switchTextActive]}
                numberOfLines={1}
              >
                {item.shortName || item.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <HtzCard style={styles.card}>
        <View style={styles.teamHeader}>
          <TeamCrest team={team} size={26} />
          <Text style={styles.teamName} numberOfLines={1}>
            {team.name}
          </Text>
          {lineup?.formation ? (
            <View style={styles.formationPill}>
              <Text style={styles.formationText}>{lineup.formation}</Text>
            </View>
          ) : null}
        </View>

        {lineup?.coach ? (
          <Text style={styles.coachText}>Entrenador: {lineup.coach}</Text>
        ) : null}

        {hasOfficial ? (
          <>
            {starters.length > 0 ? (
              <FootballPitch lineup={lineup} contributions={contributions} />
            ) : null}
            <Text style={styles.sectionLabel}>SUPLENTES</Text>
            {bench.length > 0 ? (
              bench.map(renderPlayer)
            ) : (
              <Text style={styles.note}>Sin suplentes publicados todavía.</Text>
            )}
            {unavailable.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>BAJAS</Text>
                {unavailable.map((u, idx) => (
                  <View key={`${u.name}-${idx}`} style={styles.unavailableRow}>
                    <AlertTriangle size={12} color="#F87171" />
                    <Text style={styles.unavailableText}>
                      {u.name}
                      {u.reason ? ` · ${u.reason}` : ''}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </>
        ) : fallbackRoster.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>PLANTILLA CONOCIDA</Text>
            {fallbackRoster.map(renderRosterPlayer)}
            <Text style={styles.note}>
              La alineación oficial todavía no está publicada; se muestra la plantilla del equipo.
            </Text>
          </>
        ) : (
          <Text style={styles.empty}>
            Alineación no disponible todavía. La fuente suele publicarla cerca del inicio del
            partido.
          </Text>
        )}
      </HtzCard>

      {hasOfficial ? (
        <Text style={styles.sourceNote}>
          Toca el escudo de arriba para ver la alineación del otro equipo.
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 2,
  },
  switchRow: {
    flexDirection: 'row',
    backgroundColor: htzTokens.colors.surface,
    padding: 4,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: htzTokens.colors.outline,
    gap: 4,
  },
  switchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  switchBtnActive: {
    backgroundColor: htzTokens.colors.primary,
  },
  switchText: {
    color: htzTokens.colors.outline,
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  switchTextActive: {
    color: htzTokens.colors.onPrimary,
  },
  card: {
    backgroundColor: htzTokens.colors.surface,
    borderColor: htzTokens.colors.outline,
    padding: 14,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  teamName: {
    flex: 1,
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '800',
  },
  formationPill: {
    backgroundColor: htzTokens.colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  formationText: {
    color: htzTokens.colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  coachText: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    marginBottom: 10,
  },
  sectionLabel: {
    color: htzTokens.colors.outline,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionLabelSpaced: {
    marginTop: 12,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  shirtPill: {
    width: 24,
    height: 22,
    borderRadius: 5,
    backgroundColor: htzTokens.colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shirtText: {
    color: htzTokens.colors.onSurface,
    fontSize: 10,
    fontWeight: '800',
  },
  playerInfo: {
    flex: 1,
    minWidth: 0,
  },
  playerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1,
  },
  playerName: {
    color: htzTokens.colors.onSurface,
    fontSize: 12,
    fontWeight: '700',
  },
  playerPosition: {
    color: htzTokens.colors.outline,
    fontSize: 10,
    marginTop: 1,
  },
  ratingChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    minWidth: 30,
    alignItems: 'center',
  },
  ratingChipText: {
    color: '#0F1A12',
    fontSize: 11,
    fontWeight: '900',
  },
  unavailableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
  },
  unavailableText: {
    color: htzTokens.colors.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  note: {
    color: htzTokens.colors.outline,
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 14,
  },
  empty: {
    color: htzTokens.colors.outline,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 17,
  },
  sourceNote: {
    color: htzTokens.colors.outline,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
});
