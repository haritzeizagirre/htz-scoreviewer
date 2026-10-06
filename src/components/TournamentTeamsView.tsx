import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { TournamentParticipant, SportCategory, PlayerInfo } from '../services/types';
import { HtzCard, HtzInput, HtzBadge } from './htz';
import { htzTokens } from './htz/tokens';
import { Shield, ChevronDown, ChevronUp, User, Globe, Search } from 'lucide-react-native';

interface TournamentTeamsViewProps {
  participants: TournamentParticipant[];
  game: SportCategory;
  onSelectTeam?: (team: TournamentParticipant) => void;
}

export const TournamentTeamsView: React.FC<TournamentTeamsViewProps> = ({
  participants,
  game,
  onSelectTeam,
}) => {
  const [expandedTeamId, setExpandedTeamId] = useState<string | number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return participants;
    const q = searchQuery.toLowerCase().trim();
    return participants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.shortName && t.shortName.toLowerCase().includes(q)) ||
        (t.region && t.region.toLowerCase().includes(q)) ||
        (t.roster && t.roster.some((p) => p.name.toLowerCase().includes(q) || (p.nickname && p.nickname.toLowerCase().includes(q))))
    );
  }, [participants, searchQuery]);

  if (!participants || participants.length === 0) {
    return (
      <HtzCard style={styles.emptyCard}>
        <Shield size={28} color={htzTokens.colors.outline} />
        <Text style={styles.emptyTitle}>Sin lista de equipos definida</Text>
        <Text style={styles.emptySubtitle}>
          Los participantes de este torneo aún no han sido confirmados oficialmente.
        </Text>
      </HtzCard>
    );
  }

  const toggleExpand = (teamId: string | number) => {
    setExpandedTeamId((prev) => (prev === teamId ? null : teamId));
  };

  return (
    <View style={styles.container}>
      {/* Search Bar for Teams */}
      {participants.length > 6 && (
        <View style={styles.searchBox}>
          <Search size={16} color={htzTokens.colors.outline} style={styles.searchIcon} />
          <HtzInput
            placeholder="Buscar equipo o jugador..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      )}

      {/* Grid / List of Teams */}
      <View style={styles.teamsList}>
        {filteredTeams.map((team) => {
          const isExpanded = expandedTeamId === team.id;
          const hasRoster = team.roster && team.roster.length > 0;

          return (
            <HtzCard key={String(team.id)} style={styles.teamCard}>
              <TouchableOpacity
                style={styles.teamHeader}
                activeOpacity={0.8}
                onPress={() => {
                  if (hasRoster) toggleExpand(team.id);
                  if (onSelectTeam) onSelectTeam(team);
                }}
              >
                <View style={styles.logoWrapper}>
                  {team.logo ? (
                    <Image source={{ uri: team.logo }} style={styles.logoImg} />
                  ) : (
                    <Shield size={22} color={htzTokens.colors.primary} />
                  )}
                </View>

                <View style={styles.teamMainInfo}>
                  <View style={styles.teamTitleRow}>
                    <Text style={styles.teamName}>{team.name}</Text>
                    {team.shortName && team.shortName !== team.name && (
                      <Text style={styles.teamShortName}>({team.shortName})</Text>
                    )}
                  </View>

                  <View style={styles.teamMetaRow}>
                    {team.region && (
                      <View style={styles.regionBadge}>
                        <Globe size={10} color={htzTokens.colors.outline} />
                        <Text style={styles.regionText}>{team.region}</Text>
                      </View>
                    )}
                    {hasRoster && (
                      <View style={styles.rosterCountBadge}>
                        <User size={10} color={htzTokens.colors.inversePrimary} />
                        <Text style={styles.rosterCountText}>{team.roster!.length} jugadores</Text>
                      </View>
                    )}
                  </View>
                </View>

                {hasRoster && (
                  <View style={styles.expandIconBox}>
                    {isExpanded ? (
                      <ChevronUp size={18} color={htzTokens.colors.primary} />
                    ) : (
                      <ChevronDown size={18} color={htzTokens.colors.outline} />
                    )}
                  </View>
                )}
              </TouchableOpacity>

              {/* Roster / Players Accordion */}
              {isExpanded && hasRoster && (
                <View style={styles.rosterContainer}>
                  <View style={styles.rosterHeader}>
                    <Text style={styles.rosterTitle}>Plantilla Oficial</Text>
                  </View>
                  <View style={styles.playersGrid}>
                    {team.roster!.map((player, pIdx) => (
                      <View key={pIdx} style={styles.playerItem}>
                        <View style={styles.playerAvatar}>
                          <User size={14} color={htzTokens.colors.primary} />
                        </View>
                        <View style={styles.playerDetails}>
                          <View style={styles.playerNameRow}>
                            <Text style={styles.playerNickname}>
                              {player.nickname || player.name}
                            </Text>
                            {player.nationality && (
                              <Text style={styles.playerNat}>({player.nationality})</Text>
                            )}
                          </View>
                          {player.nickname && player.name !== player.nickname && (
                            <Text style={styles.playerRealName}>{player.name}</Text>
                          )}
                          {player.role && (
                            <Text style={styles.playerRole}>{player.role}</Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </HtzCard>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  searchBox: {
    position: 'relative',
    marginBottom: 12,
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    top: 14,
    zIndex: 1,
  },
  teamsList: {
    gap: 10,
  },
  teamCard: {
    backgroundColor: htzTokens.colors.surface,
    padding: 12,
    borderWidth: 1,
    borderColor: htzTokens.colors.outlineVariant,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoWrapper: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: htzTokens.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  logoImg: {
    width: 34,
    height: 34,
    resizeMode: 'contain',
  },
  teamMainInfo: {
    flex: 1,
  },
  teamTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamName: {
    color: htzTokens.colors.onSurface,
    fontSize: 14,
    fontWeight: '800',
  },
  teamShortName: {
    color: htzTokens.colors.outline,
    fontSize: 12,
    fontWeight: '700',
  },
  teamMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: htzTokens.colors.surfaceContainerHigh,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  regionText: {
    color: htzTokens.colors.outline,
    fontSize: 10,
    fontWeight: '600',
  },
  rosterCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(74, 124, 89, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rosterCountText: {
    color: htzTokens.colors.inversePrimary,
    fontSize: 10,
    fontWeight: '700',
  },
  expandIconBox: {
    padding: 6,
  },
  rosterContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  rosterHeader: {
    marginBottom: 8,
  },
  rosterTitle: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  playersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: htzTokens.colors.surfaceContainerHigh,
    padding: 8,
    borderRadius: 6,
    width: '48%',
    minWidth: 140,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  playerAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: htzTokens.colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  playerDetails: {
    flex: 1,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playerNickname: {
    color: htzTokens.colors.onSurface,
    fontSize: 12,
    fontWeight: '800',
  },
  playerNat: {
    color: htzTokens.colors.outline,
    fontSize: 9,
  },
  playerRealName: {
    color: htzTokens.colors.outline,
    fontSize: 10,
  },
  playerRole: {
    color: htzTokens.colors.primary,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
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
