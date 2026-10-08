import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  BackHandler,
  TextInput,
} from 'react-native';
import {
  Search,
  X,
  Star,
  Trophy,
  Shield,
  Globe,
  Calendar,
  SlidersHorizontal,
  ChevronRight,
  MapPin,
} from 'lucide-react-native';
import {
  TournamentItem,
  TeamCatalogItem,
  SportCategory,
  TournamentTier,
  MatchRegion,
  Match,
} from '../services/types';
import { ScoreService, isGameCategoryEnabled } from '../services/scoreService';
import { TournamentDetailModal } from './TournamentDetailModal';
import { TournamentLogo } from './TournamentLogo';
import { MarqueeText } from './MarqueeText';
import { OnlineSearchBanner, OnlineSearchStatus } from './OnlineSearchBanner';
import { TeamDetailModal } from './TeamDetailModal';
import {
  HtzCard,
  HtzTabs,
  HtzChip,
  HtzButton,
  HtzSportChip,
  TabItem,
} from './htz';
import { htzTokens } from './htz/tokens';

interface CatalogExplorerViewProps {
  favoriteTournaments: string[];
  favoriteTeams: string[];
  onToggleTournament: (tournament: TournamentItem | string) => void;
  onToggleTeam: (team: TeamCatalogItem | string) => void;
  pandaToken?: string;
  footballToken?: string;
  enabledGames?: Record<string, boolean>;
}

const SPORT_CHIPS: { id: 'TODOS' | SportCategory; label: string }[] = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'FÚTBOL', label: 'Fútbol' },
  { id: 'VALORANT', label: 'Valorant' },
  { id: 'LOL', label: 'LoL' },
  { id: 'CS2', label: 'CS2' },
  { id: 'R6', label: 'R6 Siege' },
  { id: 'DOTA2', label: 'Dota 2' },
];

const TIER_CHIPS: { id: 'TODOS' | TournamentTier; label: string }[] = [
  { id: 'TODOS', label: 'Todos los Tiers' },
  { id: 'S', label: 'Solo Tier S' },
  { id: 'A', label: 'Tier A' },
  { id: 'B', label: 'Tier B' },
];

const REGION_CHIPS: { id: 'TODOS' | MatchRegion; label: string }[] = [
  { id: 'TODOS', label: 'Todas las Regiones' },
  { id: 'ESPAÑA', label: 'España' },
  { id: 'EMEA', label: 'EMEA' },
  { id: 'GLOBAL', label: 'Global' },
  { id: 'AMERICAS', label: 'Américas' },
  { id: 'ASIA', label: 'Asia' },
];

export const CatalogExplorerView: React.FC<CatalogExplorerViewProps> = ({
  favoriteTournaments,
  favoriteTeams,
  onToggleTournament,
  onToggleTeam,
  pandaToken,
  footballToken,
  enabledGames,
}) => {
  const [activeCatalogTab, setActiveCatalogTab] = useState<'tournaments' | 'teams'>('tournaments');
  const [searchQuery, setSearchQuery] = useState('');
  const [sportFilter, setSportFilter] = useState<'TODOS' | SportCategory>('TODOS');
  const [tierFilter, setTierFilter] = useState<'TODOS' | TournamentTier>('TODOS');
  const [regionFilter, setRegionFilter] = useState<'TODOS' | MatchRegion>('TODOS');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Online search state
  const [searchingOnline, setSearchingOnline] = useState(false);
  const [onlineTournaments, setOnlineTournaments] = useState<TournamentItem[]>([]);
  const [onlineTeams, setOnlineTeams] = useState<TeamCatalogItem[]>([]);
  // Estado de la última búsqueda online: sin tokens, sin resultados o resultados.
  const [onlineSearchStatus, setOnlineSearchStatus] = useState<OnlineSearchStatus>('idle');
  const [onlineSearchCount, setOnlineSearchCount] = useState(0);

  const resetOnlineSearchStatus = () => {
    setOnlineSearchStatus('idle');
    setOnlineSearchCount(0);
  };

  // Tournament drilldown modal state
  const [selectedTournament, setSelectedTournament] = useState<TournamentItem | null>(null);

  // Ficha de equipo: los partidos se cargan al abrirla (desde el propio handler,
  // para no hacer setState síncrono dentro de un efecto).
  const [selectedTeam, setSelectedTeam] = useState<TeamCatalogItem | null>(null);
  const [teamMatches, setTeamMatches] = useState<Match[]>([]);
  const [teamMatchesLoading, setTeamMatchesLoading] = useState(false);
  const teamRequestSeqRef = React.useRef(0);

  const handleOpenTeam = async (team: TeamCatalogItem) => {
    const requestSeq = ++teamRequestSeqRef.current;
    setSelectedTeam(team);
    setTeamMatches([]);
    setTeamMatchesLoading(true);
    try {
      const res = await ScoreService.fetchTeamMatches(team, { pandaToken, footballToken });
      if (requestSeq !== teamRequestSeqRef.current) return;
      setTeamMatches(res);
    } catch (err) {
      if (requestSeq !== teamRequestSeqRef.current) return;
      console.warn('Error cargando partidos del equipo:', err);
      setTeamMatches([]);
    } finally {
      if (requestSeq === teamRequestSeqRef.current) {
        setTeamMatchesLoading(false);
      }
    }
  };

  // Interceptar botón atrás de Android para cerrar el modal de detalle del torneo
  React.useEffect(() => {
    if (!selectedTournament) return;
    const backAction = () => {
      setSelectedTournament(null);
      return true; // Consumido: no salir al hub
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [selectedTournament]);

  // Si el deporte filtrado queda desactivado en la app, volver a TODOS
  React.useEffect(() => {
    if (sportFilter !== 'TODOS' && !isGameCategoryEnabled(sportFilter, enabledGames)) {
      setSportFilter('TODOS');
    }
  }, [sportFilter, enabledGames]);

  // Chips de deportes disponibles filtrados según enabledGames
  const availableSportChips = useMemo(() => {
    return SPORT_CHIPS.filter((chip) => {
      if (chip.id === 'TODOS') return true;
      return isGameCategoryEnabled(chip.id, enabledGames);
    });
  }, [enabledGames]);

  // Catálogos locales maestros
  const localTournaments = useMemo(() => {
    return ScoreService.getTournamentsCatalog({
      query: searchQuery,
      game: sportFilter,
      tier: tierFilter,
      region: regionFilter,
      favorites: favoriteTournaments,
    });
  }, [searchQuery, sportFilter, tierFilter, regionFilter, favoriteTournaments]);

  const localTeams = useMemo(() => {
    return ScoreService.getTeamsCatalog({
      query: searchQuery,
      game: sportFilter,
      region: regionFilter,
      favorites: favoriteTeams,
    });
  }, [searchQuery, sportFilter, regionFilter, favoriteTeams]);

  // Lista combinada con resultados online si existen y filtrada por enabledGames
  const displayedTournaments = useMemo(() => {
    let list = [...localTournaments];
    if (onlineTournaments.length > 0) {
      for (const ot of onlineTournaments) {
        const otId = (ot.id || '').toLowerCase();
        const otLeagueId = ot.leagueId;
        const otName = (ot.name || '').toLowerCase().trim();
        const otGame = ot.game;

        // Buscar si ya existe este torneo en la lista local (mismo ID, mismo leagueId de PandaScore, o mismo nombre y juego)
        const existingIdx = list.findIndex(
          (t) =>
            (t.id && t.id.toLowerCase() === otId) ||
            (otLeagueId && t.leagueId && t.leagueId === otLeagueId) ||
            (t.game === otGame && t.name.toLowerCase().trim() === otName) ||
            (ot.slug && t.slug && t.slug.toLowerCase() === ot.slug.toLowerCase())
        );

        if (existingIdx >= 0) {
          // Si ya existe, enriquecer el logo o detalles oficiales si faltaban
          if (!list[existingIdx].logo && ot.logo) {
            list[existingIdx] = { ...list[existingIdx], logo: ot.logo };
          }
          if (!list[existingIdx].leagueId && ot.leagueId) {
            list[existingIdx] = { ...list[existingIdx], leagueId: ot.leagueId };
          }
        } else {
          // Es un torneo verdaderamente nuevo
          list.push(ot);
        }
      }
    }
    if (enabledGames) {
      list = list.filter((t) => isGameCategoryEnabled(t.game, enabledGames));
    }
    // Re-evaluar reactivamente isFav para TODOS los torneos (locales y online)
    const enriched = list.map((t) => ({
      ...t,
      isFav: ScoreService.isTournamentItemFavorite(t, favoriteTournaments),
    }));
    if (onlyFavorites) {
      return enriched.filter((t) => t.isFav);
    }
    return enriched;
  }, [localTournaments, onlineTournaments, favoriteTournaments, onlyFavorites, enabledGames]);

  const displayedTeams = useMemo(() => {
    let list = [...localTeams];
    if (onlineTeams.length > 0) {
      const existingIds = new Set(list.map((t) => t.id));
      for (const ot of onlineTeams) {
        if (!existingIds.has(ot.id)) list.push(ot);
      }
    }
    if (enabledGames) {
      list = list.filter((t) => isGameCategoryEnabled(t.game, enabledGames));
    }
    // Re-evaluar reactivamente isFav para TODOS los equipos (locales y online)
    const enriched = list.map((team) => ({
      ...team,
      isFav: ScoreService.isTeamFavorite(team.name, team.shortName, favoriteTeams, team.id),
    }));
    if (onlyFavorites) {
      return enriched.filter((t) => t.isFav);
    }
    return enriched;
  }, [localTeams, onlineTeams, favoriteTeams, onlyFavorites, enabledGames]);

  // Búsqueda en APIs remotas bajo demanda
  const handleSearchOnline = async () => {
    if (!searchQuery.trim() || searchingOnline) return;

    const hasPanda = Boolean(pandaToken?.trim());
    const hasFootball = Boolean(footballToken?.trim());
    const canSearch =
      activeCatalogTab === 'tournaments' ? hasPanda || hasFootball : hasPanda;

    if (!canSearch) {
      // Sin tokens no se puede consultar: avisar en vez de dejar la pantalla igual.
      setOnlineTournaments([]);
      setOnlineTeams([]);
      setOnlineSearchCount(0);
      setOnlineSearchStatus('no-token');
      return;
    }

    setSearchingOnline(true);
    setOnlineSearchStatus('idle');
    try {
      if (activeCatalogTab === 'tournaments') {
        const res = await ScoreService.searchOnlineTournaments(searchQuery, pandaToken, footballToken);
        setOnlineTournaments(res);
        setOnlineSearchCount(res.length);
        setOnlineSearchStatus(res.length > 0 ? 'results' : 'empty');
      } else {
        const res = await ScoreService.searchOnlineTeams(searchQuery, pandaToken);
        setOnlineTeams(res);
        setOnlineSearchCount(res.length);
        setOnlineSearchStatus(res.length > 0 ? 'results' : 'empty');
      }
    } catch (err) {
      console.warn('Error en búsqueda online:', err);
      setOnlineSearchCount(0);
      setOnlineSearchStatus('empty');
    } finally {
      setSearchingOnline(false);
    }
  };

  const catalogTabs: TabItem[] = [
    {
      id: 'tournaments',
      label: `Torneos (${displayedTournaments.length})`,
      icon: (
        <Trophy
          size={14}
          color={activeCatalogTab === 'tournaments' ? htzTokens.colors.onPrimary : htzTokens.colors.outline}
        />
      ),
    },
    {
      id: 'teams',
      label: `Equipos (${displayedTeams.length})`,
      icon: (
        <Shield
          size={14}
          color={activeCatalogTab === 'teams' ? htzTokens.colors.onPrimary : htzTokens.colors.outline}
        />
      ),
    },
  ];

  return (
    <View style={styles.container}>
      {/* Buscador Principal */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={18} color={htzTokens.colors.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder={
              activeCatalogTab === 'tournaments'
                ? 'Buscar torneo (ej. Champions, VCT, LaLiga, LEC...)'
                : 'Buscar equipo (ej. Real Madrid, KOI, Fnatic, G2...)'
            }
            placeholderTextColor={htzTokens.colors.outline}
            value={searchQuery}
            onChangeText={(txt) => {
              setSearchQuery(txt);
              if (onlineTournaments.length > 0) setOnlineTournaments([]);
              if (onlineTeams.length > 0) setOnlineTeams([]);
              resetOnlineSearchStatus();
            }}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                resetOnlineSearchStatus();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Limpiar búsqueda"
            >
              <X size={18} color={htzTokens.colors.outline} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Pestañas: Torneos / Equipos */}
      <View style={styles.tabsSection}>
        <HtzTabs
          tabs={catalogTabs}
          activeTab={activeCatalogTab}
          onChange={(id) => {
            setActiveCatalogTab(id as any);
            resetOnlineSearchStatus();
          }}
        />
      </View>

      {/* Barra de Filtros Rápidos */}
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          {/* Toggle Solo Favoritos */}
          <HtzChip
            label={onlyFavorites ? 'Solo Favoritos' : 'Ver Favoritos'}
            selected={onlyFavorites}
            onPress={() => setOnlyFavorites((prev) => !prev)}
          />

          {/* Deportes */}
          {availableSportChips.map((chip) => (
            <HtzSportChip
              key={chip.id}
              id={chip.id}
              label={chip.label}
              selected={sportFilter === chip.id}
              onPress={() => setSportFilter(chip.id)}
            />
          ))}

          {/* Tiers (solo en torneos) */}
          {activeCatalogTab === 'tournaments' &&
            TIER_CHIPS.map((chip) => (
              <HtzChip
                key={chip.id}
                label={chip.label}
                selected={tierFilter === chip.id}
                onPress={() => setTierFilter(chip.id)}
              />
            ))}

          {/* Regiones */}
          {REGION_CHIPS.map((chip) => (
            <HtzChip
              key={chip.id}
              label={chip.label}
              selected={regionFilter === chip.id}
              onPress={() => setRegionFilter(chip.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Lista de Resultados */}
      <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
        {/* Banner de Búsqueda Online + estado de la última consulta */}
        <OnlineSearchBanner
          query={searchQuery}
          searching={searchingOnline}
          status={onlineSearchStatus}
          count={onlineSearchCount}
          onPress={handleSearchOnline}
        />

        {/* 1. SECCIÓN DE TORNEOS */}
        {activeCatalogTab === 'tournaments' && (
          <View style={styles.cardsContainer}>
            {displayedTournaments.length > 0 ? (
              displayedTournaments.map((tournament) => (
                <HtzCard key={tournament.id} style={styles.itemCard}>
                  <TouchableOpacity
                    style={styles.cardMainClickable}
                    onPress={() => setSelectedTournament(tournament)}
                    activeOpacity={0.75}
                  >
                    {/* Logo / Escudo */}
                    <View style={styles.itemLogoBox}>
                      <TournamentLogo
                        logo={tournament.logo}
                        game={tournament.game}
                        tier={tournament.tier}
                        size={44}
                        name={tournament.name}
                      />
                    </View>

                    {/* Información */}
                    <View style={styles.itemInfo}>
                      <MarqueeText text={tournament.name} textStyle={styles.itemTitle} />
                      {tournament.description ? (
                        <MarqueeText text={tournament.description} textStyle={styles.itemSubtitle} />
                      ) : null}

                      <View style={styles.itemBadgesRow}>
                        {/* Tier */}
                        <View
                          style={[
                            styles.itemTierBadge,
                            tournament.tier === 'S'
                              ? styles.tierBadgeS
                              : tournament.tier === 'A'
                              ? styles.tierBadgeA
                              : styles.tierBadgeOther,
                          ]}
                        >
                          <Text
                            style={[
                              styles.itemTierText,
                              tournament.tier === 'S'
                                ? styles.tierTextS
                                : tournament.tier === 'A'
                                ? styles.tierTextA
                                : styles.tierTextOther,
                            ]}
                          >
                            {tournament.tier}
                          </Text>
                        </View>

                        {/* Región */}
                        <View style={styles.itemRegionBadge}>
                          <Globe size={10} color={htzTokens.colors.primary} />
                          <Text style={styles.itemRegionText}>{tournament.region}</Text>
                        </View>

                        {/* Temporada (año o curso, p. ej. 2026 o 2025/2026) */}
                        {tournament.season ? (
                          <View style={styles.itemSeasonBadge}>
                            <Calendar size={10} color={htzTokens.colors.outline} />
                            <Text style={styles.itemSeasonText}>{tournament.season}</Text>
                          </View>
                        ) : null}

                        {/* Deporte */}
                        <View style={styles.itemGameBadge}>
                          <Text style={styles.itemGameText}>{tournament.game}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Botón Estrella Favorito */}
                  <TouchableOpacity
                    style={styles.starBtn}
                    onPress={() => onToggleTournament(tournament)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={
                      tournament.isFav
                        ? `Quitar ${tournament.name} de favoritos`
                        : `Añadir ${tournament.name} a favoritos`
                    }
                  >
                    <Star
                      size={22}
                      color={tournament.isFav ? '#FBBF24' : htzTokens.colors.outline}
                      fill={tournament.isFav ? '#FBBF24' : 'transparent'}
                    />
                  </TouchableOpacity>
                </HtzCard>
              ))
            ) : (
              <HtzCard style={styles.emptyCard}>
                <Trophy size={32} color={htzTokens.colors.outline} />
                <Text style={styles.emptyTitle}>No se encontraron torneos</Text>
                <Text style={styles.emptySubtitle}>
                  Prueba a ajustar los filtros o utiliza el buscador para consultar otras competiciones.
                </Text>
              </HtzCard>
            )}
          </View>
        )}

        {/* 2. SECCIÓN DE EQUIPOS */}
        {activeCatalogTab === 'teams' && (
          <View style={styles.cardsContainer}>
            {displayedTeams.length > 0 ? (
              displayedTeams.map((team) => (
                <HtzCard key={team.id} style={styles.itemCard}>
                  <TouchableOpacity
                    style={styles.cardMainClickable}
                    onPress={() => handleOpenTeam(team)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={`Ver ficha de ${team.name}`}
                  >
                    {/* Logo / Escudo */}
                    <View style={styles.itemLogoBox}>
                      {team.logo ? (
                        <Image source={{ uri: team.logo }} style={styles.itemLogo} />
                      ) : (
                        <Shield size={24} color={htzTokens.colors.primary} />
                      )}
                    </View>

                    {/* Información */}
                    <View style={styles.itemInfo}>
                      <MarqueeText text={team.name} textStyle={styles.itemTitle} />
                      {team.location ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <MapPin size={11} color={htzTokens.colors.outline} />
                          <MarqueeText
                            text={team.location}
                            textStyle={styles.itemSubtitle}
                            containerStyle={styles.itemSubtitleFlex}
                          />
                        </View>
                      ) : null}

                      <View style={styles.itemBadgesRow}>
                        {team.shortName && (
                          <View style={styles.itemGameBadge}>
                            <Text style={styles.itemGameText}>{team.shortName}</Text>
                          </View>
                        )}
                        <View style={styles.itemGameBadge}>
                          <Text style={styles.itemGameText}>{team.game}</Text>
                        </View>
                        {team.region && (
                          <View style={styles.itemRegionBadge}>
                            <Globe size={10} color={htzTokens.colors.primary} />
                            <Text style={styles.itemRegionText}>{team.region}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Botón Estrella Favorito */}
                  <TouchableOpacity
                    style={styles.starBtn}
                    onPress={() => onToggleTeam(team)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={
                      team.isFav
                        ? `Quitar ${team.name} de favoritos`
                        : `Añadir ${team.name} a favoritos`
                    }
                  >
                    <Star
                      size={22}
                      color={team.isFav ? '#FBBF24' : htzTokens.colors.outline}
                      fill={team.isFav ? '#FBBF24' : 'transparent'}
                    />
                  </TouchableOpacity>
                </HtzCard>
              ))
            ) : (
              <HtzCard style={styles.emptyCard}>
                <Shield size={32} color={htzTokens.colors.outline} />
                <Text style={styles.emptyTitle}>No se encontraron equipos</Text>
                <Text style={styles.emptySubtitle}>
                  Prueba con otro término de búsqueda o limpia los filtros activos.
                </Text>
              </HtzCard>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal de Detalle de Torneo Bajo Demanda */}
      {selectedTournament && (
        <TournamentDetailModal
          tournament={selectedTournament}
          visible={!!selectedTournament}
          onClose={() => setSelectedTournament(null)}
          isFavorite={
            ScoreService.isTournamentItemFavorite(
              selectedTournament,
              favoriteTournaments
            )
          }
          onToggleFavorite={onToggleTournament}
          pandaToken={pandaToken}
          footballToken={footballToken}
          favoriteTeams={favoriteTeams}
        />
      )}

      {/* Ficha de Equipo con sus partidos recientes/próximos */}
      {selectedTeam && (
        <TeamDetailModal
          team={selectedTeam}
          visible={!!selectedTeam}
          onClose={() => setSelectedTeam(null)}
          isFavorite={ScoreService.isTeamFavorite(
            selectedTeam.name,
            selectedTeam.shortName,
            favoriteTeams,
            selectedTeam.id
          )}
          onToggleFavorite={onToggleTeam}
          matches={teamMatches}
          loading={teamMatchesLoading}
          hasPandaToken={Boolean(pandaToken?.trim())}
          hasFootballToken={Boolean(footballToken?.trim())}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: htzTokens.colors.background,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: htzTokens.colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    borderWidth: 1,
    borderColor: htzTokens.colors.outline,
  },
  searchInput: {
    flex: 1,
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    paddingVertical: 10,
  },
  tabsSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filtersWrapper: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: htzTokens.colors.outline,
  },
  chipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  resultsList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  cardsContainer: {
    gap: 10,
  },
  itemCard: {
    backgroundColor: htzTokens.colors.surface,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: htzTokens.colors.outline,
  },
  cardMainClickable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemLogoBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: htzTokens.colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: htzTokens.colors.outline,
  },
  itemLogo: {
    width: 38,
    height: 38,
    resizeMode: 'contain',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  itemSubtitle: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    marginBottom: 6,
  },
  itemSubtitleFlex: {
    flex: 1,
    minWidth: 0,
  },
  itemBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemTierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  tierBadgeS: {
    backgroundColor: 'rgba(251, 191, 36, 0.18)',
    borderColor: 'rgba(251, 191, 36, 0.55)',
  },
  tierBadgeA: {
    backgroundColor: 'rgba(74, 124, 89, 0.22)',
    borderColor: 'rgba(74, 124, 89, 0.5)',
  },
  tierBadgeOther: {
    backgroundColor: 'rgba(115, 115, 115, 0.15)',
    borderColor: 'rgba(115, 115, 115, 0.35)',
  },
  itemTierText: {
    fontSize: 9,
    fontWeight: '800',
  },
  tierTextS: { color: '#FBBF24' },
  tierTextA: { color: htzTokens.colors.inversePrimary },
  tierTextOther: { color: htzTokens.colors.outline },
  itemRegionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: htzTokens.colors.surfaceVariant,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: htzTokens.colors.outline,
  },
  itemRegionText: {
    color: htzTokens.colors.onSurfaceVariant,
    fontSize: 9,
    fontWeight: '700',
  },
  itemSeasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: htzTokens.colors.surfaceVariant,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: htzTokens.colors.outline,
  },
  itemSeasonText: {
    color: htzTokens.colors.onSurfaceVariant,
    fontSize: 9,
    fontWeight: '700',
  },
  itemGameBadge: {
    backgroundColor: 'rgba(74, 124, 89, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(74, 124, 89, 0.3)',
  },
  itemGameText: {
    color: htzTokens.colors.primary,
    fontSize: 9,
    fontWeight: '800',
  },
  starBtn: {
    padding: 8,
    marginLeft: 8,
  },
  emptyCard: {
    backgroundColor: htzTokens.colors.surface,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: htzTokens.colors.outline,
    marginTop: 20,
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
});
