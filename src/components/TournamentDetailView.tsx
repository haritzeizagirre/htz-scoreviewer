import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import {
  ArrowLeft,
  Trophy,
  Star,
  Globe,
  Calendar,
  Layers,
  Users,
  Flame,
  Clock,
  Info,
  Tv,
  ExternalLink,
  MapPin,
  Coins,
} from 'lucide-react-native';
import {
  TournamentItem,
  TournamentFullDetail,
  Match,
  BracketMatch,
} from '../services/types';
import { TournamentService } from '../services/tournamentService';
import { TournamentStandingsTable } from './TournamentStandingsTable';
import { TournamentBracketView } from './TournamentBracketView';
import { TournamentTeamsView } from './TournamentTeamsView';
import { TournamentLogo } from './TournamentLogo';
import { MatchCard } from './MatchCard';
import { MatchDetailModal } from './MatchDetailModal';
import { HtzCard, HtzTabs, HtzButton, TabItem } from './htz';
import { htzTokens } from './htz/tokens';

interface TournamentDetailViewProps {
  tournament: TournamentItem;
  onBack: () => void;
  isFavorite: boolean;
  onToggleFavorite: (t: TournamentItem) => void;
  pandaToken?: string;
  footballToken?: string;
  favoriteTeams?: string[];
  onSelectMatchExternal?: (m: Match) => void;
}

export const TournamentDetailView: React.FC<TournamentDetailViewProps> = ({
  tournament,
  onBack,
  isFavorite,
  onToggleFavorite,
  pandaToken,
  footballToken,
  favoriteTeams = [],
  onSelectMatchExternal,
}) => {
  const [detail, setDetail] = useState<TournamentFullDetail>(() =>
    TournamentService.getMasterSeed(tournament)
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<string>('standings');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  // Inicializar sub-pestaña por defecto según formato del torneo
  useEffect(() => {
    const isPlayoffs =
      tournament.game !== 'FÚTBOL' ||
      tournament.name.toLowerCase().includes('cup') ||
      tournament.name.toLowerCase().includes('copa') ||
      tournament.name.toLowerCase().includes('champions');
    setActiveSubTab(isPlayoffs ? 'bracket' : 'standings');
  }, [tournament.id]);

  // Carga SWR: instantánea desde semilla/caché + revalidación en segundo plano
  const loadData = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) setRefreshing(true);
      try {
        const res = await TournamentService.getTournamentDetails(
          tournament,
          { pandaToken, footballToken },
          forceRefresh
        );
        setDetail(res);
      } catch (err) {
        console.warn('Error cargando detalles del torneo:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [tournament, pandaToken, footballToken]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    loadData(true);
  };

  // Manejo de clic en partido desde el bracket
  const handleBracketMatchPress = (bm: BracketMatch) => {
    // Intentar buscar partido completo en la lista de partidos del torneo
    const fullMatch = detail.matches?.find(
      (m) =>
        m.id === bm.id ||
        (m.teamA.name === bm.teamA.name && m.teamB.name === bm.teamB.name)
    );
    if (fullMatch) {
      if (onSelectMatchExternal) onSelectMatchExternal(fullMatch);
      else setSelectedMatch(fullMatch);
    } else {
      // Crear objeto Match temporal para previsualizar en el modal
      const syntheticMatch: Match = {
        id: bm.id,
        game: tournament.game,
        league: tournament.name,
        status: bm.status,
        timeInfo: bm.scheduledTime || (bm.status === 'LIVE' ? 'EN DIRECTO' : 'FINALIZADO'),
        startTimeIso: new Date().toISOString(),
        tier: tournament.tier,
        region: tournament.region,
        teamA: {
          name: bm.teamA.name,
          shortName: bm.teamA.shortName || bm.teamA.name.slice(0, 3).toUpperCase(),
          score: bm.teamA.score ?? '-',
          logo: bm.teamA.logo,
        },
        teamB: {
          name: bm.teamB.name,
          shortName: bm.teamB.shortName || bm.teamB.name.slice(0, 3).toUpperCase(),
          score: bm.teamB.score ?? '-',
          logo: bm.teamB.logo,
        },
        details: {
          tournamentStage: bm.name || bm.stage,
        },
      };
      if (onSelectMatchExternal) onSelectMatchExternal(syntheticMatch);
      else setSelectedMatch(syntheticMatch);
    }
  };

  // Definición de pestañas disponibles según los datos
  const hasStandings = Boolean(detail.standings && detail.standings.length > 0);
  const hasBracket = Boolean(
    detail.bracket && (detail.bracket.upperRounds?.length || detail.bracket.grandFinal)
  );

  const subTabs: TabItem[] = [
    ...(hasStandings || !hasBracket
      ? [
          {
            id: 'standings',
            label: 'Clasificación',
            icon: (
              <Trophy
                size={13}
                color={
                  activeSubTab === 'standings'
                    ? htzTokens.colors.onPrimary
                    : htzTokens.colors.outline
                }
              />
            ),
          },
        ]
      : []),
    ...(hasBracket || !hasStandings
      ? [
          {
            id: 'bracket',
            label: 'Cuadro',
            icon: (
              <Layers
                size={13}
                color={
                  activeSubTab === 'bracket'
                    ? htzTokens.colors.onPrimary
                    : htzTokens.colors.outline
                }
              />
            ),
          },
        ]
      : []),
    {
      id: 'teams',
      label: `Equipos (${detail.participants?.length || 0})`,
      icon: (
        <Users
          size={13}
          color={
            activeSubTab === 'teams'
              ? htzTokens.colors.onPrimary
              : htzTokens.colors.outline
          }
        />
      ),
    },
    {
      id: 'matches',
      label: `Partidos (${detail.matches?.length || 0})`,
      icon: (
        <Calendar
          size={13}
          color={
            activeSubTab === 'matches'
              ? htzTokens.colors.onPrimary
              : htzTokens.colors.outline
          }
        />
      ),
    },
    {
      id: 'info',
      label: 'Info',
      icon: (
        <Info
          size={13}
          color={
            activeSubTab === 'info'
              ? htzTokens.colors.onPrimary
              : htzTokens.colors.outline
          }
        />
      ),
    },
  ];

  const liveMatches = (detail.matches || []).filter((m) => m.status === 'LIVE');
  const byStartAsc = (a: Match, b: Match) =>
    new Date(a.startTimeIso).getTime() - new Date(b.startTimeIso).getTime();
  const byStartDesc = (a: Match, b: Match) =>
    new Date(b.startTimeIso).getTime() - new Date(a.startTimeIso).getTime();
  const upcomingMatches = (detail.matches || []).filter((m) => m.status === 'UPCOMING').sort(byStartAsc);
  const finishedMatches = (detail.matches || []).filter((m) => m.status === 'FINISHED').sort(byStartDesc);

  return (
    <View style={styles.container}>
      {/* Top Header con botón Atrás y Favorito */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={18} color={htzTokens.colors.onSurface} />
          <Text style={styles.backBtnText}>Volver</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.favBtn, isFavorite && styles.favBtnActive]}
          onPress={() => onToggleFavorite(tournament)}
          activeOpacity={0.7}
        >
          <Star
            size={18}
            color={isFavorite ? '#FBBF24' : htzTokens.colors.outline}
            fill={isFavorite ? '#FBBF24' : 'transparent'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={htzTokens.colors.primary}
          />
        }
      >
        {/* HERO CARD DEL TORNEO */}
        <HtzCard style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroLogoBox}>
              <TournamentLogo
                logo={detail.logo}
                game={detail.game}
                tier={detail.tier}
                size={54}
                name={detail.name}
              />
            </View>

            <View style={styles.heroInfo}>
              <Text style={styles.tournamentTitle}>{detail.name}</Text>
              {detail.description ? (
                <Text style={styles.tournamentSubtitle}>{detail.description}</Text>
              ) : null}

              {/* Insignias de Juego, Tier, Región */}
              <View style={styles.badgesRow}>
                <View style={styles.gameBadge}>
                  <Text style={styles.gameBadgeText}>{detail.game}</Text>
                </View>

                <View
                  style={[
                    styles.tierBadge,
                    detail.tier === 'S'
                      ? styles.tierBadgeS
                      : detail.tier === 'A'
                      ? styles.tierBadgeA
                      : styles.tierBadgeOther,
                  ]}
                >
                  <Text
                    style={[
                      styles.tierBadgeText,
                      detail.tier === 'S'
                        ? styles.tierTextS
                        : detail.tier === 'A'
                        ? styles.tierTextA
                        : styles.tierTextOther,
                    ]}
                  >
                    {detail.tier === 'S' ? '⭐ TIER S' : `TIER ${detail.tier}`}
                  </Text>
                </View>

                <View style={styles.regionBadge}>
                  <Globe size={10} color={htzTokens.colors.outline} />
                  <Text style={styles.regionBadgeText}>{detail.region}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Quick Metrics Bar */}
          <View style={styles.metricsBar}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Temporada</Text>
              <Text style={styles.metricValue}>
                {detail.season || (detail.game === 'FÚTBOL' ? '2025/2026' : '2026')}
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Equipos</Text>
              <Text style={styles.metricValue}>{detail.participants?.length || 0}</Text>
            </View>
            {detail.prizePool ? (
              <>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Premios</Text>
                  <Text style={styles.metricValueHighlight}>{detail.prizePool}</Text>
                </View>
              </>
            ) : null}
          </View>
        </HtzCard>

        {/* SUB-TABS NAVIGATION */}
        <View style={styles.tabsWrapper}>
          <HtzTabs
            tabs={subTabs}
            activeTab={activeSubTab}
            onChange={(tabId) => setActiveSubTab(tabId)}
          />
        </View>

        {/* TAB 1: CLASIFICACIÓN */}
        {activeSubTab === 'standings' && (
          <TournamentStandingsTable
            standings={detail.standings || []}
            game={detail.game}
          />
        )}

        {/* TAB 2: BRACKETS / CUADRO */}
        {activeSubTab === 'bracket' && (
          <TournamentBracketView
            bracket={detail.bracket}
            onSelectMatch={handleBracketMatchPress}
          />
        )}

        {/* TAB 3: EQUIPOS Y ROSTERS */}
        {activeSubTab === 'teams' && (
          <TournamentTeamsView
            participants={detail.participants || []}
            game={detail.game}
          />
        )}

        {/* TAB 4: PARTIDOS Y CALENDARIO */}
        {activeSubTab === 'matches' && (
          <View style={styles.matchesTabContainer}>
            {detail.matches && detail.matches.length > 0 ? (
              <View style={{ gap: 12 }}>
                {liveMatches.length > 0 && (
                  <View>
                    <View style={styles.subCategoryHeader}>
                      <Flame size={14} color="#EF4444" />
                      <Text style={styles.subCategoryTitle}>
                        En Directo ({liveMatches.length})
                      </Text>
                    </View>
                    <View style={{ gap: 8 }}>
                      {liveMatches.map((m) => (
                        <MatchCard
                          key={m.id}
                          match={m}
                          onPress={() => setSelectedMatch(m)}
                        />
                      ))}
                    </View>
                  </View>
                )}

                {upcomingMatches.length > 0 && (
                  <View style={{ marginTop: 6 }}>
                    <View style={styles.subCategoryHeader}>
                      <Clock size={14} color={htzTokens.colors.primary} />
                      <Text style={styles.subCategoryTitle}>
                        Próximos Partidos ({upcomingMatches.length})
                      </Text>
                    </View>
                    <View style={{ gap: 8 }}>
                      {upcomingMatches.map((m) => (
                        <MatchCard
                          key={m.id}
                          match={m}
                          onPress={() => setSelectedMatch(m)}
                        />
                      ))}
                    </View>
                  </View>
                )}

                {finishedMatches.length > 0 && (
                  <View style={{ marginTop: 6 }}>
                    <View style={styles.subCategoryHeader}>
                      <Calendar size={14} color={htzTokens.colors.outline} />
                      <Text style={styles.subCategoryTitle}>
                        Resultados Recientes ({finishedMatches.length})
                      </Text>
                    </View>
                    <View style={{ gap: 8 }}>
                      {finishedMatches.map((m) => (
                        <MatchCard
                          key={m.id}
                          match={m}
                          onPress={() => setSelectedMatch(m)}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <HtzCard style={styles.emptyCard}>
                <Calendar size={28} color={htzTokens.colors.outline} />
                <Text style={styles.emptyTitle}>Sin partidos activos</Text>
                <Text style={styles.emptySubtitle}>
                  No hay partidos programados en la ventana actual para esta competición.
                </Text>
              </HtzCard>
            )}
          </View>
        )}

        {/* TAB 5: INFORMACIÓN TÉCNICA */}
        {activeSubTab === 'info' && (
          <View style={styles.infoTabContainer}>
            <HtzCard style={styles.infoCard}>
              <Text style={styles.infoCardHeader}>Ficha Técnica de la Competición</Text>

              <View style={styles.infoRow}>
                <View style={styles.infoIconBox}>
                  <Trophy size={16} color={htzTokens.colors.primary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoItemLabel}>Formato Oficial</Text>
                  <Text style={styles.infoItemValue}>
                    {detail.format === 'LEAGUE'
                      ? 'Liga regular todos contra todos por puntos'
                      : detail.format === 'PLAYOFFS'
                      ? 'Fase eliminatoria de Playoffs con cuadro directo / doble eliminación'
                      : 'Fase de grupos / liga previa + Cuadro de eliminatorias'}
                  </Text>
                </View>
              </View>

              {detail.dates && (
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}>
                    <Calendar size={16} color={htzTokens.colors.primary} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoItemLabel}>Calendario</Text>
                    <Text style={styles.infoItemValue}>{detail.dates}</Text>
                  </View>
                </View>
              )}

              {detail.location && (
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}>
                    <MapPin size={16} color={htzTokens.colors.primary} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoItemLabel}>Sede / Lugar</Text>
                    <Text style={styles.infoItemValue}>{detail.location}</Text>
                  </View>
                </View>
              )}

              {detail.prizePool && (
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}>
                    <Coins size={16} color="#FBBF24" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoItemLabel}>Bolsa de Premios</Text>
                    <Text style={[styles.infoItemValue, { color: '#FBBF24', fontWeight: '800' }]}>
                      {detail.prizePool}
                    </Text>
                  </View>
                </View>
              )}
            </HtzCard>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal de Detalle de Partido */}
      {selectedMatch && (
        <MatchDetailModal
          match={selectedMatch}
          visible={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          pandaToken={pandaToken}
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: htzTokens.colors.outlineVariant,
    backgroundColor: htzTokens.colors.surface,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingRight: 10,
  },
  backBtnText: {
    color: htzTokens.colors.onSurface,
    fontSize: 14,
    fontWeight: '700',
  },
  favBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  favBtnActive: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  heroCard: {
    backgroundColor: htzTokens.colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: htzTokens.colors.outlineVariant,
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroLogoBox: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: htzTokens.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: htzTokens.colors.outlineVariant,
  },
  heroLogoImg: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
  },
  heroInfo: {
    flex: 1,
  },
  tournamentTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 16,
    fontWeight: '900',
  },
  tournamentSubtitle: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    marginTop: 2,
    marginBottom: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  gameBadge: {
    backgroundColor: 'rgba(74, 124, 89, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(74, 124, 89, 0.3)',
  },
  gameBadgeText: {
    color: htzTokens.colors.primary,
    fontSize: 9,
    fontWeight: '800',
  },
  tierBadge: {
    paddingHorizontal: 7,
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
  tierBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  tierTextS: { color: '#FBBF24' },
  tierTextA: { color: htzTokens.colors.inversePrimary },
  tierTextOther: { color: htzTokens.colors.outline },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: htzTokens.colors.surfaceContainerHigh,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  regionBadgeText: {
    color: htzTokens.colors.outline,
    fontSize: 9,
    fontWeight: '700',
  },
  metricsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: htzTokens.colors.surfaceContainerHigh,
    borderRadius: 10,
    marginTop: 14,
    paddingVertical: 8,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    color: htzTokens.colors.outline,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: htzTokens.colors.onSurface,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  metricValueHighlight: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabsWrapper: {
    marginBottom: 14,
  },
  matchesTabContainer: {
    paddingVertical: 4,
  },
  subCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  subCategoryTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 12,
    fontWeight: '800',
  },
  infoTabContainer: {
    paddingVertical: 4,
  },
  infoCard: {
    backgroundColor: htzTokens.colors.surface,
    padding: 16,
    gap: 16,
  },
  infoCardHeader: {
    color: htzTokens.colors.onSurface,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: htzTokens.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoItemLabel: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    fontWeight: '700',
  },
  infoItemValue: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 18,
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
