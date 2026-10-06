import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Plus, Trash2, Star, Trophy, Shield, Check } from 'lucide-react-native';
import {
  HtzCard,
  HtzButton,
  HtzInput,
  HtzChip,
  HtzTabs,
} from './htz';
import { htzTokens } from './htz/tokens';

interface FavoritesManagerViewProps {
  favoriteTeams: string[];
  favoriteTournaments: string[];
  onUpdateTeams: (teams: string[]) => void;
  onUpdateTournaments: (tournaments: string[]) => void;
}

const POPULAR_SUGGESTIONS = [
  // Fútbol
  'Real Madrid',
  'Barcelona',
  'Real Sociedad',
  'Athletic Club',
  'Eibar',
  'Mirandes',
  'Atlético de Madrid',
  'Manchester City',
  // Esports
  'Movistar KOI',
  'Fnatic',
  'G2 Esports',
  'Team Heretics',
  'Giantx',
  'NAVI',
  'Sentinels',
  'Karmine Corp',
];

const POPULAR_TOURNAMENTS = [
  'LaLiga',
  'Champions League',
  'Premier League',
  'Copa del Rey',
  'VCT',
  'LEC',
  'Six Invitational',
  'Major',
  'Worlds',
];

export const FavoritesManagerView: React.FC<FavoritesManagerViewProps> = ({
  favoriteTeams,
  favoriteTournaments,
  onUpdateTeams,
  onUpdateTournaments,
}) => {
  const [teamInput, setTeamInput] = useState('');
  const [activeTab, setActiveTab] = useState<'teams' | 'tournaments'>('teams');

  const handleAddTeam = (nameToAdd?: string) => {
    const target = (nameToAdd || teamInput).trim();
    if (!target) return;
    if (favoriteTeams.some((t) => t.toLowerCase() === target.toLowerCase())) {
      Alert.alert('Ya añadido', `El equipo "${target}" ya está en tus favoritos.`);
      return;
    }
    const updated = [...favoriteTeams, target];
    onUpdateTeams(updated);
    if (!nameToAdd) setTeamInput('');
  };

  const handleRemoveTeam = (teamName: string) => {
    const updated = favoriteTeams.filter((t) => t !== teamName);
    onUpdateTeams(updated);
  };

  const handleToggleTournament = (tournament: string) => {
    let updated: string[];
    if (favoriteTournaments.includes(tournament)) {
      updated = favoriteTournaments.filter((t) => t !== tournament);
    } else {
      updated = [...favoriteTournaments, tournament];
    }
    onUpdateTournaments(updated);
  };

  const favTabs = [
    {
      id: 'teams',
      label: `Equipos (${favoriteTeams.length})`,
      icon: (
        <Shield
          size={16}
          color={activeTab === 'teams' ? htzTokens.colors.primary : htzTokens.colors.outline}
        />
      ),
    },
    {
      id: 'tournaments',
      label: `Torneos (${favoriteTournaments.length})`,
      icon: (
        <Trophy
          size={16}
          color={activeTab === 'tournaments' ? htzTokens.colors.primary : htzTokens.colors.outline}
        />
      ),
    },
  ];

  return (
    <View style={styles.container}>
      {/* Top Toggle using HtzTabs */}
      <View style={styles.tabsWrapper}>
        <HtzTabs
          tabs={favTabs}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as 'teams' | 'tournaments')}
        />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'teams' && (
          <View>
            {/* Input to add */}
            <Text style={styles.sectionHeader}>Añadir Equipo Personalizado</Text>
            <View style={styles.addRow}>
              <View style={{ flex: 1 }}>
                <HtzInput
                  placeholder="Escribe el nombre o siglas..."
                  value={teamInput}
                  onChangeText={setTeamInput}
                  onSubmitEditing={() => handleAddTeam()}
                />
              </View>
              <HtzButton
                variant="primary"
                icon={<Plus size={20} color="#FFFFFF" />}
                onPress={() => handleAddTeam()}
                style={styles.addBtn}
              />
            </View>

            {/* Quick Suggestions */}
            <Text style={styles.sectionHeader}>Sugerencias Rápidas Populares</Text>
            <View style={styles.suggestionsWrapper}>
              {POPULAR_SUGGESTIONS.map((sug) => {
                const isAlready = favoriteTeams.some(
                  (t) => t.toLowerCase() === sug.toLowerCase()
                );
                return (
                  <HtzChip
                    key={sug}
                    label={sug}
                    icon={isAlready ? <Check size={12} color="#4ADE80" /> : <Plus size={12} color={htzTokens.colors.outline} />}
                    selected={isAlready}
                    variant={isAlready ? 'success' : 'outline'}
                    onPress={isAlready ? undefined : () => handleAddTeam(sug)}
                  />
                );
              })}
            </View>

            {/* Current Teams List */}
            <Text style={styles.sectionHeader}>Tus Equipos Monitorizados</Text>
            <HtzCard style={styles.listCard}>
              {favoriteTeams.length === 0 ? (
                <View style={styles.emptyTeams}>
                  <Text style={styles.emptyTeamsText}>
                    No has añadido equipos todavía. Toca una sugerencia arriba o escribe uno.
                  </Text>
                </View>
              ) : (
                favoriteTeams.map((team, idx) => (
                  <View
                    key={team}
                    style={[
                      styles.teamRow,
                      idx === favoriteTeams.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={styles.teamRowLeft}>
                      <Star size={16} color="#FBBF24" fill="#FBBF24" />
                      <Text style={styles.teamName}>{team}</Text>
                    </View>
                    <HtzButton
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 size={16} color={htzTokens.colors.error} />}
                      onPress={() => handleRemoveTeam(team)}
                    />
                  </View>
                ))
              )}
            </HtzCard>
          </View>
        )}

        {activeTab === 'tournaments' && (
          <View>
            <Text style={styles.sectionHeader}>Ligas y Competiciones Destacadas</Text>
            <Text style={styles.sectionSub}>
              Los partidos de estas competiciones se destacarán automáticamente tanto en tu móvil como en el Amazfit GTR 3.
            </Text>

            <HtzCard style={styles.listCard}>
              {POPULAR_TOURNAMENTS.map((tour, idx) => {
                const isSelected = favoriteTournaments.includes(tour);
                return (
                  <TouchableOpacity
                    key={tour}
                    activeOpacity={0.7}
                    style={[
                      styles.teamRow,
                      idx === POPULAR_TOURNAMENTS.length - 1 && { borderBottomWidth: 0 },
                    ]}
                    onPress={() => handleToggleTournament(tour)}
                  >
                    <View style={styles.teamRowLeft}>
                      <Trophy
                        size={16}
                        color={isSelected ? htzTokens.colors.primary : htzTokens.colors.outline}
                      />
                      <Text
                        style={[
                          styles.teamName,
                          isSelected && { color: htzTokens.colors.primary, fontWeight: '700' },
                        ]}
                      >
                        {tour}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        isSelected && styles.checkboxActive,
                      ]}
                    >
                      {isSelected && <Star size={12} color="#FFFFFF" fill="#FFFFFF" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </HtzCard>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsWrapper: {
    backgroundColor: htzTokens.colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: htzTokens.colors.outline,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    color: htzTokens.colors.onSurface,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 8,
  },
  sectionSub: {
    color: htzTokens.colors.outline,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  addBtn: {
    height: 44,
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  listCard: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  emptyTeams: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyTeamsText: {
    color: htzTokens.colors.outline,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: htzTokens.colors.outline,
  },
  teamRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  teamName: {
    color: htzTokens.colors.onSurface,
    fontSize: 14,
    fontWeight: '500',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: htzTokens.colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: htzTokens.colors.primary,
    borderColor: htzTokens.colors.primary,
  },
});
