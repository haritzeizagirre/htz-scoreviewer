import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import {
  ArrowLeft,
  Star,
  Shield,
  MapPin,
  Users,
  AlertCircle,
} from 'lucide-react-native';
import { Match, TeamCatalogItem } from '../services/types';
import { getKnownTeamRoster } from '../services/scoreService';
import { HtzCard, HtzBadge } from './htz';
import { htzTokens } from './htz/tokens';
import { GameLogo } from './GameLogo';

interface TeamDetailModalProps {
  team: TeamCatalogItem | null;
  visible: boolean;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (team: TeamCatalogItem) => void;
  /** Partidos del equipo ya cargados por la vista que abre la ficha. */
  matches: Match[];
  loading: boolean;
  hasPandaToken: boolean;
  hasFootballToken: boolean;
}

/**
 * Ficha de equipo del catálogo: identidad, plantilla conocida y sus partidos
 * recientes/próximos (cargados por el padre al abrir la ficha).
 */
export const TeamDetailModal: React.FC<TeamDetailModalProps> = ({
  team,
  visible,
  onClose,
  isFavorite,
  onToggleFavorite,
  matches,
  loading,
  hasPandaToken,
  hasFootballToken,
}) => {
  if (!team) return null;

  const roster = getKnownTeamRoster(team.name, team.game);
  const needsFootball = team.game === 'FÚTBOL' && !hasFootballToken;
  const needsPanda = team.game !== 'FÚTBOL' && !hasPandaToken;
  const missingTokenHint = needsFootball
    ? 'Configura tu token de Football-Data (pestaña APIs) para ver partidos de este equipo.'
    : needsPanda
    ? 'Configura tu token de PandaScore (pestaña APIs) para ver partidos de este equipo.'
    : null;

  // Orden: en directo primero, luego próximos por cercanía y por último resultados recientes.
  const ordered = [...matches].sort((a, b) => {
    const rank = (m: Match) => (m.status === 'LIVE' ? 0 : m.status === 'UPCOMING' ? 1 : 2);
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    const ta = new Date(a.startTimeIso).getTime() || 0;
    const tb = new Date(b.startTimeIso).getTime() || 0;
    return a.status === 'FINISHED' ? tb - ta : ta - tb;
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Cabecera */}
          <View style={styles.topHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.7}>
              <ArrowLeft size={18} color={htzTokens.colors.onSurface} />
              <Text style={styles.backBtnText}>Volver</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.favBtn, isFavorite && styles.favBtnActive]}
              onPress={() => onToggleFavorite(team)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={
                isFavorite
                  ? `Quitar ${team.name} de favoritos`
                  : `Añadir ${team.name} a favoritos`
              }
            >
              <Star
                size={18}
                color={isFavorite ? '#FBBF24' : htzTokens.colors.outline}
                fill={isFavorite ? '#FBBF24' : 'transparent'}
              />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
            {/* Tarjeta de identidad */}
            <HtzCard style={styles.heroCard}>
              <View style={styles.heroRow}>
                <View style={styles.heroLogoBox}>
                  {team.logo ? (
                    <Image source={{ uri: team.logo }} style={styles.heroLogo} />
                  ) : (
                    <Shield size={30} color={htzTokens.colors.primary} />
                  )}
                </View>

                <View style={styles.heroInfo}>
                  <Text style={styles.teamName}>{team.name}</Text>
                  <View style={styles.badgesRow}>
                    <View style={styles.gameBadge}>
                      <GameLogo game={team.game} size={12} />
                      <Text style={styles.gameBadgeText}>{team.game}</Text>
                    </View>
                    {team.shortName ? (
                      <HtzBadge variant="secondary" label={team.shortName} />
                    ) : null}
                    {team.region ? (
                      <View style={styles.regionBadge}>
                        <Text style={styles.regionBadgeText}>{team.region}</Text>
                      </View>
                    ) : null}
                  </View>
                  {team.location ? (
                    <View style={styles.locationRow}>
                      <MapPin size={12} color={htzTokens.colors.outline} />
                      <Text style={styles.locationText}>{team.location}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </HtzCard>

            {/* Plantilla conocida */}
            {roster.length > 0 && (
              <HtzCard style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Users size={15} color={htzTokens.colors.primary} />
                  <Text style={styles.sectionTitle}>Plantilla</Text>
                </View>
                {roster.map((player) => (
                  <View key={`${player.id ?? player.name}`} style={styles.playerRow}>
                    <Text style={styles.playerName}>{player.name}</Text>
                    {player.role ? <Text style={styles.playerRole}>{player.role}</Text> : null}
                    {typeof player.number === 'number' ? (
                      <Text style={styles.playerNumber}>#{player.number}</Text>
                    ) : null}
                  </View>
                ))}
              </HtzCard>
            )}

            {/* Partidos */}
            <HtzCard style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Partidos</Text>
                <Text style={styles.sectionCount}>
                  {loading ? '' : `(${ordered.length})`}
                </Text>
              </View>

              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={htzTokens.colors.primary} />
                  <Text style={styles.loadingText}>Cargando partidos…</Text>
                </View>
              ) : ordered.length === 0 ? (
                <View style={styles.emptyBox}>
                  <AlertCircle size={18} color={htzTokens.colors.outline} />
                  <Text style={styles.emptyText}>
                    {missingTokenHint ||
                      'No hay partidos recientes ni próximos de este equipo en este momento.'}
                  </Text>
                </View>
              ) : (
                ordered.slice(0, 12).map((m) => (
                  <View key={m.id} style={styles.matchRow}>
                    <View
                      style={[
                        styles.matchStatusDot,
                        m.status === 'LIVE'
                          ? styles.matchStatusLive
                          : m.status === 'UPCOMING'
                          ? styles.matchStatusUpcoming
                          : styles.matchStatusFinished,
                      ]}
                    />
                    <View style={styles.matchInfo}>
                      <Text style={styles.matchLeague} numberOfLines={1}>
                        {m.league}
                      </Text>
                      <Text style={styles.matchTeams} numberOfLines={1}>
                        {m.teamA.shortName || m.teamA.name} vs {m.teamB.shortName || m.teamB.name}
                      </Text>
                    </View>
                    <Text style={styles.matchWhen}>
                      {m.status === 'LIVE'
                        ? 'EN DIRECTO'
                        : m.status === 'FINISHED'
                        ? `${m.teamA.score} - ${m.teamB.score}`
                        : m.timeInfo}
                    </Text>
                  </View>
                ))
              )}
            </HtzCard>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: htzTokens.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: htzTokens.colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backBtnText: {
    color: htzTokens.colors.onSurface,
    fontSize: 14,
    fontWeight: '600',
  },
  favBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: htzTokens.colors.outlineVariant,
  },
  favBtnActive: {
    borderColor: 'rgba(251, 191, 36, 0.5)',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  heroCard: {
    padding: 14,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroLogoBox: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: htzTokens.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroLogo: {
    width: 46,
    height: 46,
    resizeMode: 'contain',
  },
  heroInfo: {
    flex: 1,
    gap: 6,
  },
  teamName: {
    color: htzTokens.colors.onSurface,
    fontSize: 17,
    fontWeight: '800',
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  gameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: htzTokens.colors.surfaceContainer,
  },
  gameBadgeText: {
    color: htzTokens.colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '700',
  },
  regionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: htzTokens.colors.outlineVariant,
  },
  regionBadgeText: {
    color: htzTokens.colors.outline,
    fontSize: 10,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    color: htzTokens.colors.outline,
    fontSize: 11,
  },
  sectionCard: {
    padding: 14,
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '800',
  },
  sectionCount: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    fontWeight: '600',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  playerName: {
    flex: 1,
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '600',
  },
  playerRole: {
    color: htzTokens.colors.outline,
    fontSize: 11,
  },
  playerNumber: {
    color: htzTokens.colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    color: htzTokens.colors.outline,
    fontSize: 12,
  },
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  emptyText: {
    flex: 1,
    color: htzTokens.colors.outline,
    fontSize: 12,
    lineHeight: 17,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  matchStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  matchStatusLive: {
    backgroundColor: '#F87171',
  },
  matchStatusUpcoming: {
    backgroundColor: htzTokens.colors.primary,
  },
  matchStatusFinished: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  matchInfo: {
    flex: 1,
    gap: 2,
  },
  matchLeague: {
    color: htzTokens.colors.outline,
    fontSize: 10,
    fontWeight: '600',
  },
  matchTeams: {
    color: htzTokens.colors.onSurface,
    fontSize: 12,
    fontWeight: '600',
  },
  matchWhen: {
    color: htzTokens.colors.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '700',
  },
});
