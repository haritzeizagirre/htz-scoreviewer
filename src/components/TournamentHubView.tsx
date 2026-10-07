import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native';
import {
  Trophy,
  Search,
  Star,
  Globe,
  ChevronRight,
  SlidersHorizontal,
  Flame,
  X,
} from 'lucide-react-native';
import {
  TournamentItem,
  SportCategory,
  TournamentTier,
  MatchRegion,
} from '../services/types';
import { ScoreService, isGameCategoryEnabled } from '../services/scoreService';
import { GameLogo } from './GameLogo';
import { TournamentLogo } from './TournamentLogo';
import { MarqueeText } from './MarqueeText';
import { HtzCard, HtzChip, HtzButton } from './htz';
import { htzTokens } from './htz/tokens';

interface TournamentHubViewProps {
  favoriteTournaments: string[];
  onToggleTournamentFavorite: (t: TournamentItem | string) => void;
  onSelectTournament: (t: TournamentItem) => void;
  enabledGames?: Record<string, boolean>;
  pandaToken?: string;
  footballToken?: string;
}

const SPORT_OPTIONS: { id: 'TODOS' | SportCategory; label: string }[] = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'FÚTBOL', label: 'Fútbol' },
  { id: 'VALORANT', label: 'Valorant' },
  { id: 'LOL', label: 'LoL' },
  { id: 'CS2', label: 'CS2' },
  { id: 'R6', label: 'R6' },
  { id: 'DOTA2', label: 'Dota 2' },
];

export const TournamentHubView: React.FC<TournamentHubViewProps> = ({
  favoriteTournaments,
  onToggleTournamentFavorite,
  onSelectTournament,
  enabledGames,
}) => {
  const [sportFilter, setSportFilter] = useState<'TODOS' | SportCategory>('TODOS');
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'TODOS' | TournamentTier>('TODOS');
  const [regionFilter, setRegionFilter] = useState<'TODOS' | MatchRegion>('TODOS');

  // Filtrar deportes disponibles según enabledGames
  const availableSports = useMemo(() => {
    return SPORT_OPTIONS.filter((s) => {
      if (s.id === 'TODOS') return true;
      return isGameCategoryEnabled(s.id, enabledGames);
    });
  }, [enabledGames]);

  // Si el deporte seleccionado queda deshabilitado, resetear
  React.useEffect(() => {
    if (sportFilter !== 'TODOS' && !isGameCategoryEnabled(sportFilter, enabledGames)) {
      setSportFilter('TODOS');
    }
  }, [sportFilter, enabledGames]);

  // Obtener catálogo maestro de torneos con filtros
  const allTournaments = useMemo(() => {
    const list = ScoreService.getTournamentsCatalog({
      query: searchQuery,
      game: sportFilter,
      tier: tierFilter,
      region: regionFilter,
      favorites: favoriteTournaments,
    });
    if (enabledGames) {
      return list.filter((t) => isGameCategoryEnabled(t.game, enabledGames));
    }
    return list;
  }, [searchQuery, sportFilter, tierFilter, regionFilter, favoriteTournaments, enabledGames]);

  const favTournaments = useMemo(() => {
    return allTournaments.filter((t) =>
      ScoreService.isTournamentFavorite(t.name, t.shortName, favoriteTournaments, t.id)
    );
  }, [allTournaments, favoriteTournaments]);

  const tierSTournaments = useMemo(() => {
    // Los torneos Élite ya aparecen en "Tus Torneos Favoritos"; aquí solo se listan
    // los que el usuario haya quitado de favoritos, para no duplicarlos.
    return allTournaments.filter(
      (t) =>
        t.tier === 'S' &&
        !ScoreService.isTournamentItemFavorite(t, favoriteTournaments)
    );
  }, [allTournaments, favoriteTournaments]);

  const renderTournamentCard = (item: TournamentItem) => {
    const isFav = ScoreService.isTournamentItemFavorite(item, favoriteTournaments);

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.cardTouchable}
        activeOpacity={0.7}
        onPress={() => onSelectTournament(item)}
      >
        <HtzCard style={styles.card}>
          <View style={styles.cardContent}>
            {/* Logo */}
            <View style={styles.logoBox}>
              <TournamentLogo
                logo={item.logo}
                game={item.game}
                tier={item.tier}
                size={42}
                name={item.name}
              />
            </View>

            {/* Info */}
            <View style={styles.infoCol}>
              <View style={styles.titleRow}>
                <MarqueeText
                  text={item.name}
                  textStyle={styles.tournamentName}
                  containerStyle={styles.tournamentNameWrap}
                />
                {item.shortName && item.shortName !== item.name && (
                  <Text style={styles.shortNameText}>({item.shortName})</Text>
                )}
              </View>

              {item.description ? (
                <MarqueeText text={item.description} textStyle={styles.descText} />
              ) : null}

              {/* Badges */}
              <View style={styles.cardBadges}>
                <View style={styles.gameBadge}>
                  <Text style={styles.gameBadgeText}>{item.game}</Text>
                </View>

                <View
                  style={[
                    styles.tierBadge,
                    item.tier === 'S'
                      ? styles.tierBadgeS
                      : item.tier === 'A'
                      ? styles.tierBadgeA
                      : styles.tierBadgeOther,
                  ]}
                >
                  <Text
                    style={[
                      styles.tierBadgeText,
                      item.tier === 'S'
                        ? styles.tierTextS
                        : item.tier === 'A'
                        ? styles.tierTextA
                        : styles.tierTextOther,
                    ]}
                  >
                    {item.tier === 'S' ? '⭐ TIER S' : `TIER ${item.tier}`}
                  </Text>
                </View>

                <View style={styles.regionBadge}>
                  <Globe size={9} color={htzTokens.colors.outline} />
                  <Text style={styles.regionBadgeText}>{item.region}</Text>
                </View>
              </View>
            </View>

            {/* Actions: Favorite Star & Chevron */}
            <View style={styles.cardRightCol}>
              <TouchableOpacity
                style={[styles.favBtn, isFav && styles.favBtnActive]}
                onPress={() => onToggleTournamentFavorite(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Star
                  size={16}
                  color={isFav ? '#FBBF24' : htzTokens.colors.outline}
                  fill={isFav ? '#FBBF24' : 'transparent'}
                />
              </TouchableOpacity>
              <ChevronRight size={18} color={htzTokens.colors.outline} />
            </View>
          </View>
        </HtzCard>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Input Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={16} color={htzTokens.colors.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar torneo (Champions, LaLiga, VCT, LEC, Major...)"
            placeholderTextColor={htzTokens.colors.outline}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={16} color={htzTokens.colors.outline} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Horizontal Sports Filter with vector icons */}
      <View style={styles.sportsSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sportsScroll}
        >
          {availableSports.map((sport) => {
            const isSelected = sportFilter === sport.id;
            return (
              <TouchableOpacity
                key={sport.id}
                style={[styles.sportChip, isSelected && styles.sportChipSelected]}
                onPress={() => setSportFilter(sport.id)}
                activeOpacity={0.7}
              >
                {sport.id === 'TODOS' ? (
                  <Trophy
                    size={13}
                    color={isSelected ? '#ffffff' : htzTokens.colors.outline}
                  />
                ) : (
                  <GameLogo game={sport.id} size={14} />
                )}
                <Text
                  style={[
                    styles.sportChipText,
                    isSelected && styles.sportChipTextSelected,
                  ]}
                >
                  {sport.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Tournaments List ScrollView */}
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* SECCIÓN 1: MIS TORNEOS FAVORITOS */}
        {favTournaments.length > 0 && !searchQuery.trim() && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Star size={14} color="#FBBF24" fill="#FBBF24" />
              <Text style={styles.sectionTitle}>Tus Torneos Favoritos</Text>
              <Text style={styles.sectionCount}>({favTournaments.length})</Text>
            </View>
            <View style={styles.cardsStack}>
              {favTournaments.map(renderTournamentCard)}
            </View>
          </View>
        )}

        {/* SECCIÓN 2: TORNEOS ÉLITE (TIER S) */}
        {tierSTournaments.length > 0 && !searchQuery.trim() && tierFilter === 'TODOS' && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Flame size={14} color="#FBBF24" />
              <Text style={styles.sectionTitle}>Grandes Competiciones Élite (Tier S)</Text>
              <Text style={styles.sectionCount}>({tierSTournaments.length})</Text>
            </View>
            <View style={styles.cardsStack}>
              {tierSTournaments.slice(0, 6).map(renderTournamentCard)}
            </View>
          </View>
        )}

        {/* SECCIÓN 3: TODOS LOS TORNEOS */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Trophy size={14} color={htzTokens.colors.primary} />
            <Text style={styles.sectionTitle}>
              {searchQuery.trim()
                ? `Resultados de "${searchQuery}"`
                : sportFilter !== 'TODOS'
                ? `Torneos de ${sportFilter}`
                : 'Todas las Competiciones'}
            </Text>
            <Text style={styles.sectionCount}>({allTournaments.length})</Text>
          </View>

          {allTournaments.length > 0 ? (
            <View style={styles.cardsStack}>
              {allTournaments.map(renderTournamentCard)}
            </View>
          ) : (
            <HtzCard style={styles.emptyCard}>
              <Trophy size={28} color={htzTokens.colors.outline} />
              <Text style={styles.emptyTitle}>No se encontraron torneos</Text>
              <Text style={styles.emptySubtitle}>
                Prueba a cambiar los filtros o el término de búsqueda para ver más resultados.
              </Text>
            </HtzCard>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
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
  sportsSection: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  sportsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  sportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: htzTokens.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: htzTokens.colors.outlineVariant,
  },
  sportChipSelected: {
    backgroundColor: htzTokens.colors.primary,
    borderColor: htzTokens.colors.primary,
  },
  sportChipText: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    fontWeight: '700',
  },
  sportChipTextSelected: {
    color: '#FFFFFF',
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    padding: 16,
    gap: 20,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  cardsStack: {
    gap: 8,
  },
  cardTouchable: {
    borderRadius: 12,
  },
  card: {
    backgroundColor: htzTokens.colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: htzTokens.colors.outlineVariant,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBox: {
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
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  infoCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tournamentName: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '800',
  },
  tournamentNameWrap: {
    flex: 1,
    minWidth: 0,
  },
  shortNameText: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    fontWeight: '600',
  },
  descText: {
    color: htzTokens.colors.outline,
    fontSize: 10,
    marginTop: 2,
    marginBottom: 4,
  },
  cardBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  gameBadge: {
    backgroundColor: 'rgba(74, 124, 89, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  gameBadgeText: {
    color: htzTokens.colors.primary,
    fontSize: 9,
    fontWeight: '800',
  },
  tierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  tierBadgeS: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  tierBadgeA: {
    backgroundColor: 'rgba(74, 124, 89, 0.15)',
    borderColor: 'rgba(74, 124, 89, 0.4)',
  },
  tierBadgeOther: {
    backgroundColor: 'rgba(115, 115, 115, 0.15)',
    borderColor: 'rgba(115, 115, 115, 0.3)',
  },
  tierBadgeText: {
    fontSize: 8,
    fontWeight: '800',
  },
  tierTextS: { color: '#FBBF24' },
  tierTextA: { color: htzTokens.colors.inversePrimary },
  tierTextOther: { color: htzTokens.colors.outline },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: htzTokens.colors.surfaceContainerHigh,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  regionBadgeText: {
    color: htzTokens.colors.outline,
    fontSize: 8,
    fontWeight: '600',
  },
  cardRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 8,
  },
  favBtn: {
    padding: 6,
    borderRadius: 6,
  },
  favBtnActive: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
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
