import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Trophy,
  MapPin,
  Calendar,
  Layers,
  Star,
  Flame,
  Clock,
  Globe,
  Tv,
  ExternalLink,
  ArrowLeft,
  RotateCcw,
  BarChart3,
  Info,
} from 'lucide-react-native';
import { Match, SportCategory } from '../services/types';
import { formatMatchSchedule } from '../services/dateUtils';
import { getCurrentMapNumber, isLiveRoundScoreFinished } from '../services/matchScoreUtils';
import { getDefaultStreams } from '../services/scoreService';
import { VlrScoreboardView } from './VlrScoreboardView';
import { R6ScoreboardView } from './R6ScoreboardView';
import { LolPicksBansView } from './LolPicksBansView';
import { MatchPreviewSection } from './MatchPreviewSection';
import { GameLogo } from './GameLogo';
import { MarqueeText } from './MarqueeText';
import {
  HtzCard,
  HtzBadge,
  HtzTabs,
  TabItem,
} from './htz';
import { htzTokens } from './htz/tokens';

interface MatchDetailModalProps {
  match: Match | null;
  visible: boolean;
  onClose: () => void;
  pandaToken?: string;
  footballToken?: string;
  onSelectTournament?: (
    leagueName: string,
    game?: SportCategory,
    masterTournamentId?: string,
    seriesId?: number | string
  ) => void;
}

/** Juegos con pestaña de estadísticas dedicada (gol.gg / VLR / R6). */
function gameHasStats(game?: SportCategory): boolean {
  return game === 'LOL' || game === 'R6' || game === 'VALORANT';
}

/** Pestaña que se muestra al abrir un partido: Stats si existe, si no el calendario/eventos. */
function defaultTabForGame(game?: SportCategory): string {
  return gameHasStats(game) ? 'stats' : 'mapas';
}

export const MatchDetailModal: React.FC<MatchDetailModalProps> = ({
  match,
  visible,
  onClose,
  pandaToken,
  footballToken,
  onSelectTournament,
}) => {
  const [activeTab, setActiveTab] = useState<string>(defaultTabForGame(match?.game));
  // El modal es full-screen y queda fuera del SafeAreaView, así que respetamos
  // el notch/barra de estado manualmente para que el header no se solape.
  const insets = useSafeAreaInsets();

  // Al abrir un partido, mostrar siempre primero la pestaña de estadísticas
  // (o el calendario/eventos en los juegos que no tienen stats).
  useEffect(() => {
    if (!match) return;
    setActiveTab(defaultTabForGame(match.game));
  }, [match?.id, match?.game]);

  if (!match) return null;

  const schedule = formatMatchSchedule(match.startTimeIso, match.status, match.timeInfo);

  const tabs: TabItem[] = [
    ...(gameHasStats(match.game)
      ? [
          {
            id: 'stats',
            label: 'Stats',
            icon: (
              <BarChart3
                size={13}
                color={
                  activeTab === 'stats'
                    ? htzTokens.colors.onPrimary
                    : htzTokens.colors.outline
                }
              />
            ),
          },
        ]
      : []),
    ...(gameHasStats(match.game)
      ? []
      : [
          {
            id: 'mapas',
            label: match.game === 'FÚTBOL' ? 'Eventos' : 'Mapas',
            icon: (
              <Layers
                size={13}
                color={activeTab === 'mapas' ? htzTokens.colors.onPrimary : htzTokens.colors.outline}
              />
            ),
          },
        ]),
    {
      id: 'info',
      label: 'Info',
      icon: <Info size={13} color={activeTab === 'info' ? htzTokens.colors.onPrimary : htzTokens.colors.outline} />,
    },
  ];

  // Canales del partido. Si la fuente no trae retransmisiones (p. ej. fútbol de
  // Football-Data), se usan los canales oficiales por defecto del juego/liga solo
  // mientras el partido está en directo o por jugar (en finalizados sería ruido).
  const streams =
    match.details?.streams && match.details.streams.length > 0
      ? match.details.streams
      : match.status === 'LIVE' || match.status === 'UPCOMING'
      ? getDefaultStreams(match.game, match.league)
      : [];

  const mainStream = streams.find((s) => s.official) || streams[0];

  // Canales adicionales para la tarjeta "Dónde verlo" (máx. 3, sin repetir el principal).
  const otherStreams = streams.filter((s) => s !== mainStream).slice(0, 3);

  const openUrl = (url?: string) => {
    if (url) {
      Linking.openURL(url).catch((err) => console.warn('No se pudo abrir el enlace:', err));
    }
  };

  // Puntos BO (Best Of) para mostrar mapa a mapa el progreso
  const bestOf = match.details?.bestOf || (match.game === 'FÚTBOL' ? undefined : 3);
  const mapsNeededToWin = bestOf ? Math.ceil(bestOf / 2) : 0;
  const scoreNumA = typeof match.teamA.score === 'number' ? match.teamA.score : 0;
  const scoreNumB = typeof match.teamB.score === 'number' ? match.teamB.score : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.fullScreenPage}>
        {/* Header Superior: Barra de navegación completa */}
        <View style={[styles.topAppBar, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ArrowLeft size={20} color={htzTokens.colors.onSurface} />
            <Text style={styles.backButtonText}>Partidos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.appBarCenter}
            disabled={!onSelectTournament}
            onPress={() => {
              if (onSelectTournament && match) {
                onClose();
                onSelectTournament(match.league, match.game, match.masterTournamentId, match.seriesId);
              }
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MarqueeText
              text={match.league}
              textStyle={styles.appBarTitle}
              containerStyle={styles.appBarTitleMarquee}
              align="center"
            />
          </TouchableOpacity>

          <View style={styles.appBarRight}>
            {match.tier && (
              <View
                style={[
                  styles.tierBadge,
                  match.tier === 'S'
                    ? styles.tierBadgeS
                    : match.tier === 'A'
                    ? styles.tierBadgeA
                    : styles.tierBadgeOther,
                ]}
              >
                <Text
                  style={[
                    styles.tierBadgeText,
                    match.tier === 'S'
                      ? styles.tierTextS
                      : match.tier === 'A'
                      ? styles.tierTextA
                      : styles.tierTextOther,
                  ]}
                >
                  {match.tier}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Marcador Principal Minimalista */}
        <View style={styles.minimalScoreboard}>
          {/* Equipo A */}
          <View style={styles.minTeamCol}>
            <View style={styles.minLogoCircle}>
              {match.teamA.logo ? (
                <Image source={{ uri: match.teamA.logo }} style={styles.minLogo} />
              ) : (
                <Text style={styles.minFallback}>{match.teamA.shortName.slice(0, 3)}</Text>
              )}
            </View>
            <View style={styles.minNameRow}>
              {match.teamA.isFav && <Star size={11} color="#FBBF24" fill="#FBBF24" />}
              <MarqueeText
                text={match.teamA.name}
                textStyle={styles.minTeamName}
                containerStyle={styles.minTeamNameMarquee}
                align="center"
              />
            </View>
          </View>

          {/* Centro: Tanteo y Estado Único */}
          <View style={styles.minScoreCenter}>
            <Text style={styles.minBigScore}>
              {match.status === 'UPCOMING' ? 'vs' : `${match.teamA.score}  -  ${match.teamB.score}`}
            </Text>

            {match.status === 'LIVE' ? (
              <View style={styles.minLiveBadge}>
                <View style={styles.minLiveDot} />
                <Text style={styles.minLiveBadgeText}>
                  {match.liveRoundScore && !isLiveRoundScoreFinished(match)
                    ? match.liveRoundScore.mapName
                      ? `${match.liveRoundScore.mapName}: ${match.liveRoundScore.scoreA}-${match.liveRoundScore.scoreB}`
                      : match.liveRoundScore.roundOrTime || 'EN DIRECTO'
                    : match.game === 'VALORANT' || match.game === 'CS2' || match.game === 'R6'
                    ? `EN DIRECTO • Mapa ${getCurrentMapNumber(match)}`
                    : 'EN DIRECTO'}
                </Text>
              </View>
            ) : match.status === 'FINISHED' ? (
              <Text style={styles.minSubStatus}>
                Finalizado{bestOf ? ` • Bo${bestOf}` : ''}
              </Text>
            ) : (
              <Text style={styles.minSubStatus}>
                {schedule.badgeText}{bestOf ? ` • Bo${bestOf}` : ''}
              </Text>
            )}
          </View>

          {/* Equipo B */}
          <View style={styles.minTeamCol}>
            <View style={styles.minLogoCircle}>
              {match.teamB.logo ? (
                <Image source={{ uri: match.teamB.logo }} style={styles.minLogo} />
              ) : (
                <Text style={styles.minFallback}>{match.teamB.shortName.slice(0, 3)}</Text>
              )}
            </View>
            <View style={styles.minNameRow}>
              <MarqueeText
                text={match.teamB.name}
                textStyle={styles.minTeamName}
                containerStyle={styles.minTeamNameMarquee}
                align="center"
              />
              {match.teamB.isFav && <Star size={11} color="#FBBF24" fill="#FBBF24" />}
            </View>
          </View>
        </View>

        {/* Navegación por Pestañas con desplazamiento horizontal */}
        <View style={styles.tabsContainer}>
          <HtzTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} scrollable />
        </View>

        {/* Contenido de la Pestaña Activa */}
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* 1. INFO */}
            {activeTab === 'info' && (
              <View style={styles.tabContent}>
                {/* Tarjeta de Datos Clave */}
                <Text style={styles.sectionHeader}>Información del Encuentro</Text>
                <HtzCard style={styles.detailsBlock}>
                  <View style={styles.detailItem}>
                    <Clock size={16} color={htzTokens.colors.primary} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.detailLabel}>Fecha y Horario</Text>
                      <Text style={styles.detailValue}>
                        {schedule.detailText || schedule.fullText}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.detailItem, styles.detailItemBorder]}>
                    <Calendar size={16} color={htzTokens.colors.primary} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.detailLabel}>Competición & Fase</Text>
                      <Text style={styles.detailValue}>
                        {match.league} {match.details?.tournamentStage ? `• ${match.details.tournamentStage}` : ''}
                      </Text>
                    </View>
                  </View>

                  {match.tier && (
                    <View style={[styles.detailItem, styles.detailItemBorder]}>
                      <Trophy size={16} color={match.tier === 'S' ? '#FBBF24' : htzTokens.colors.primary} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.detailLabel}>Nivel del Torneo (Tier)</Text>
                        <Text style={[styles.detailValue, match.tier === 'S' && { color: '#FBBF24', fontWeight: '700' }]}>
                          {match.tier === 'S'
                            ? '⭐ Tier S (Circuito Élite Oficial)'
                            : match.tier === 'A'
                            ? 'Tier A (Liga Principal Profesional)'
                            : match.tier === 'B'
                            ? 'Tier B (Competición Regional)'
                            : `Tier ${match.tier}`}
                        </Text>
                      </View>
                    </View>
                  )}

                  {match.region && (
                    <View style={[styles.detailItem, styles.detailItemBorder]}>
                      <Globe size={16} color={htzTokens.colors.primary} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.detailLabel}>Región / Circuito</Text>
                        <Text style={styles.detailValue}>
                          {match.region === 'GLOBAL'
                            ? 'Internacional / Global (Mundial)'
                            : match.region === 'EMEA'
                            ? 'EMEA (Europa, Oriente Medio y África)'
                            : match.region === 'ESPAÑA'
                            ? 'España (Nacional)'
                            : match.region === 'AMERICAS'
                            ? 'Américas (Norteamérica y Sudamérica)'
                            : 'Asia-Pacífico'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {match.details?.venue && (
                    <View style={[styles.detailItem, styles.detailItemBorder]}>
                      <MapPin size={16} color={htzTokens.colors.primary} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.detailLabel}>Sede / Estadio</Text>
                        <Text style={styles.detailValue}>{match.details.venue}</Text>
                      </View>
                    </View>
                  )}

                  {match.details?.roundOrMap && (
                    <View style={[styles.detailItem, styles.detailItemBorder]}>
                      <Layers size={16} color={htzTokens.colors.secondary} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.detailLabel}>Ronda o Mapa Actual</Text>
                        <Text style={styles.detailValue}>{match.details.roundOrMap}</Text>
                      </View>
                    </View>
                  )}
                </HtzCard>

                {/* Previa: forma reciente + cara a cara (solo si hay fuente aplicable) */}
                <MatchPreviewSection
                  key={match.id}
                  match={match}
                  pandaToken={pandaToken}
                  footballToken={footballToken}
                />

                {/* Retransmisión principal */}
                {mainStream || (match.details?.broadcastTv && match.details.broadcastTv.length > 0) ? (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.sectionHeader}>Dónde verlo</Text>
                    <HtzCard style={styles.tvCard}>
                      <View style={styles.tvHeader}>
                        <Tv size={18} color={htzTokens.colors.primary} />
                        <Text style={styles.tvTitle}>Retransmisión principal</Text>
                      </View>

                      {match.details?.broadcastTv && match.details.broadcastTv.length > 0 && (
                        <View style={styles.tvPillsRow}>
                          {match.details.broadcastTv.map((channel, cIdx) => (
                            <View key={`tv-${cIdx}`} style={styles.tvPill}>
                              <Text style={styles.tvPillText}>{channel}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {mainStream && (
                        <TouchableOpacity
                          style={styles.openStreamBtn}
                          onPress={() => openUrl(mainStream.rawUrl || mainStream.embedUrl)}
                          accessibilityRole="button"
                          accessibilityLabel={`Abrir retransmisión principal: ${mainStream.name}`}
                        >
                          <Text style={styles.openStreamText}>Ver en directo</Text>
                          <ExternalLink size={14} color={htzTokens.colors.primary} />
                        </TouchableOpacity>
                      )}

                      {/* Canales alternativos (Twitch/YouTube/TV) */}
                      {otherStreams.length > 0 && (
                        <View style={styles.otherStreamsWrap}>
                          {otherStreams.map((s, sIdx) => (
                            <TouchableOpacity
                              key={`stream-${sIdx}`}
                              style={styles.otherStreamRow}
                              onPress={() => openUrl(s.rawUrl || s.embedUrl)}
                              accessibilityRole="button"
                              accessibilityLabel={`Abrir canal ${s.name}`}
                            >
                              <Tv size={13} color={htzTokens.colors.secondary} />
                              <Text style={styles.otherStreamName} numberOfLines={1}>
                                {s.name}
                              </Text>
                              {s.language ? (
                                <Text style={styles.otherStreamLang}>
                                  {s.language.toUpperCase()}
                                </Text>
                              ) : null}
                              <ExternalLink size={12} color={htzTokens.colors.outline} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </HtzCard>
                  </View>
                ) : null}
              </View>
            )}

            {/* 2. MAPAS O EVENTOS */}
            {activeTab === 'mapas' && (
              <View style={styles.tabContent}>
                {match.game === 'FÚTBOL' ? (
                  // Timeline de Fútbol
                  <View>
                    <Text style={styles.sectionHeader}>Cronología del Partido</Text>
                    {match.details?.footballEvents && match.details.footballEvents.length > 0 ? (
                      <View style={styles.timelineList}>
                        {match.details.footballEvents.map((evt, idx) => (
                          <View key={`event-${idx}`} style={styles.timelineItem}>
                            <View style={styles.minutePill}>
                              <Text style={styles.minuteText}>{evt.minute}'</Text>
                            </View>
                            <View style={styles.eventIconContainer}>
                              {evt.type === 'goal' && <GameLogo game="FÚTBOL" size={15} />}
                              {evt.type === 'card_yellow' && <View style={styles.yellowCard} />}
                              {evt.type === 'card_red' && <View style={styles.redCard} />}
                              {evt.type === 'sub' && <RotateCcw size={13} color="#60A5FA" />}
                            </View>
                            <View style={styles.eventDetails}>
                              <Text style={styles.eventPlayer}>{evt.player}</Text>
                              {evt.detail && <Text style={styles.eventSubDetail}>{evt.detail}</Text>}
                            </View>
                            <View style={styles.eventTeamBadge}>
                              <Text style={styles.eventTeamText}>
                                {evt.team === 'A' ? match.teamA.shortName : match.teamB.shortName}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <HtzCard style={styles.emptyCard}>
                        <Clock size={28} color={htzTokens.colors.outline} />
                        <Text style={styles.emptyTitle}>Sin eventos registrados todavía</Text>
                        <Text style={styles.emptySubtitle}>
                          {match.status === 'UPCOMING'
                            ? 'Los goles, amonestaciones y sustituciones aparecerán en directo al comenzar el encuentro.'
                            : 'No se registraron incidencias en este partido.'}
                        </Text>
                      </HtzCard>
                    )}
                  </View>
                ) : (
                  // Desglose de Mapas para Esports
                  <View>
                    <Text style={styles.sectionHeader}>
                      Desglose de Partidas ({bestOf ? `BO${bestOf}` : 'Mapas'})
                    </Text>
                    {match.details?.gamesBreakdown && match.details.gamesBreakdown.length > 0 ? (
                      <View style={{ gap: 10 }}>
                        {match.details.gamesBreakdown.map((g, idx) => {
                          const isFinished = g.status === 'finished';
                          const isRunning = g.status === 'running';
                          const winnerName =
                            g.winnerTeam === 'A'
                              ? match.teamA.name
                              : g.winnerTeam === 'B'
                              ? match.teamB.name
                              : undefined;

                          return (
                            <HtzCard key={`game-${idx}`} style={styles.mapCard}>
                              <View style={styles.mapCardHeader}>
                                <View style={styles.mapPositionBadge}>
                                  <Text style={styles.mapPositionText}>Mapa {g.position}</Text>
                                </View>
                                <Text style={styles.mapNameTitle}>{g.mapName || `Mapa ${g.position}`}</Text>
                                {isRunning && (
                                  <HtzBadge variant="error" icon={<Flame size={10} color="#FFFFFF" />} label="EN JUEGO" />
                                )}
                                {isFinished && (
                                  <HtzBadge variant="success" label="COMPLETADO" />
                                )}
                                {!isFinished && !isRunning && (
                                  <HtzBadge variant="secondary" label="POR JUGAR" />
                                )}
                              </View>

                              {(isFinished || isRunning) && (g.scoreA !== undefined || g.scoreB !== undefined) && (
                                <View style={styles.mapScoreRow}>
                                  <Text style={[styles.mapScoreTeam, (g.winnerTeam === 'A' || (isRunning && (Number(g.scoreA) || 0) > (Number(g.scoreB) || 0))) && styles.winningTeamText]}>
                                    {match.teamA.shortName} {g.scoreA !== undefined ? `(${g.scoreA})` : ''}
                                  </Text>
                                  <Text style={styles.mapVs}>vs</Text>
                                  <Text style={[styles.mapScoreTeam, (g.winnerTeam === 'B' || (isRunning && (Number(g.scoreB) || 0) > (Number(g.scoreA) || 0))) && styles.winningTeamText]}>
                                    {match.teamB.shortName} {g.scoreB !== undefined ? `(${g.scoreB})` : ''}
                                  </Text>
                                </View>
                              )}

                              <View style={styles.mapFooter}>
                                {winnerName ? (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                    <Trophy size={13} color={htzTokens.colors.primary} />
                                    <Text style={styles.mapWinnerText}>
                                      Ganador: <Text style={{ color: htzTokens.colors.primary, fontWeight: '700' }}>{winnerName}</Text>
                                    </Text>
                                  </View>
                                ) : isRunning && (g.scoreA !== undefined || g.scoreB !== undefined) ? (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' }} />
                                    <Text style={[styles.mapPendingText, { color: '#EF4444', fontWeight: '700' }]}>
                                      En curso: {g.scoreA ?? 0} - {g.scoreB ?? 0}
                                    </Text>
                                  </View>
                                ) : (
                                  <Text style={styles.mapPendingText}>
                                    {isRunning ? 'Partida en curso...' : 'Se jugará si es necesario según el formato'}
                                  </Text>
                                )}
                                {g.duration && (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Clock size={11} color={htzTokens.colors.outline} />
                                    <Text style={styles.mapDurationText}>{g.duration}</Text>
                                  </View>
                                )}
                              </View>
                            </HtzCard>
                          );
                        })}
                      </View>
                    ) : (
                      <HtzCard style={styles.emptyCard}>
                        <Layers size={28} color={htzTokens.colors.outline} />
                        <Text style={styles.emptyTitle}>Mapas aún por determinar</Text>
                        <Text style={styles.emptySubtitle}>
                          El veto y elección de mapas se realiza pocos minutos antes del inicio de la serie.
                        </Text>
                      </HtzCard>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* 2. STATS (BOXSCORE / PICKS SEGÚN EL JUEGO) */}
            {activeTab === 'stats' && (
              <View style={styles.tabContent}>
                {match.game === 'VALORANT' && (
                  <VlrScoreboardView
                    teamAName={match.teamA.name}
                    teamBName={match.teamB.name}
                    teamALogo={match.teamA.logo}
                    teamBLogo={match.teamB.logo}
                  />
                )}
                {match.game === 'R6' && (
                  <R6ScoreboardView
                    teamAName={match.teamA.name}
                    teamBName={match.teamB.name}
                    teamALogo={match.teamA.logo}
                    teamBLogo={match.teamB.logo}
                    startTimeIso={match.startTimeIso}
                  />
                )}
                {match.game === 'LOL' && (
                  <LolPicksBansView
                    teamAName={match.teamA.name}
                    teamBName={match.teamB.name}
                    startTimeIso={match.startTimeIso}
                    leagueName={`${match.league} ${match.details?.tournamentStage || ''}`.trim()}
                  />
                )}
              </View>
            )}

            <View style={{ height: 28 }} />
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const styles = StyleSheet.create({
    fullScreenPage: {
      flex: 1,
      backgroundColor: htzTokens.colors.background,
      width: '100%',
      height: '100%',
    },
    topAppBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#242424',
      backgroundColor: htzTokens.colors.surface,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
      paddingRight: 8,
    },
    backButtonText: {
      color: htzTokens.colors.onSurface,
      fontSize: 13,
      fontWeight: '700',
    },
    appBarCenter: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 8,
    },
    appBarTitle: {
      color: htzTokens.colors.onSurface,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
    },
    appBarTitleMarquee: {
      alignSelf: 'stretch',
    },
    appBarRight: {
      minWidth: 50,
      alignItems: 'flex-end',
    },
    minimalScoreboard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: htzTokens.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: '#242424',
    },
    minTeamCol: {
      flex: 1,
      alignItems: 'center',
      maxWidth: 110,
    },
    minLogoCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: htzTokens.colors.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
      overflow: 'hidden',
    },
    minLogo: {
      width: 34,
      height: 34,
      resizeMode: 'contain',
    },
    minFallback: {
      color: htzTokens.colors.onSurface,
      fontSize: 13,
      fontWeight: '800',
    },
    minNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      justifyContent: 'center',
      width: '100%',
    },
    minTeamName: {
      fontSize: 12,
      fontWeight: '700',
      color: htzTokens.colors.onSurface,
      textAlign: 'center',
    },
    minTeamNameMarquee: {
      flex: 1,
      minWidth: 0,
    },
    minScoreCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    minBigScore: {
      fontSize: 28,
      fontWeight: '900',
      color: '#FFFFFF',
      letterSpacing: 1,
    },
    minLiveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      borderWidth: 1,
      borderColor: '#EF4444',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
      gap: 5,
      marginTop: 4,
    },
    minLiveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#EF4444',
    },
    minLiveBadgeText: {
      color: '#EF4444',
      fontSize: 11,
      fontWeight: '800',
    },
    minSubStatus: {
      fontSize: 11,
      color: htzTokens.colors.outline,
      fontWeight: '600',
      marginTop: 4,
    },
    tabsContainer: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: htzTokens.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: '#242424',
    },
  body: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  tabContent: {
    paddingBottom: 16,
  },
  sectionHeader: {
    color: htzTokens.colors.onSurface,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  subSectionHeader: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  viewMoreText: {
    color: htzTokens.colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  detailsBlock: {
    backgroundColor: htzTokens.colors.surface,
    borderColor: htzTokens.colors.outline,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  detailItemBorder: {
    borderTopWidth: 1,
    borderTopColor: htzTokens.colors.outline,
  },
  detailLabel: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    marginBottom: 2,
  },
  detailValue: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '600',
  },
  miniH2hCard: {
    backgroundColor: htzTokens.colors.surface,
    padding: 14,
    borderColor: htzTokens.colors.outline,
  },
  miniH2hRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  miniH2hTeam: {
    color: htzTokens.colors.onSurface,
    fontSize: 14,
    fontWeight: '700',
  },
  miniH2hScoreBox: {
    alignItems: 'center',
  },
  miniH2hScore: {
    color: htzTokens.colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  miniH2hSub: {
    color: htzTokens.colors.outline,
    fontSize: 10,
    marginTop: 2,
  },
  timelineList: {
    gap: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: htzTokens.colors.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: htzTokens.colors.outline,
  },
  minutePill: {
    backgroundColor: htzTokens.colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
  },
  minuteText: {
    color: htzTokens.colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  eventIconContainer: {
    width: 24,
    alignItems: 'center',
    marginRight: 10,
  },
  yellowCard: {
    width: 12,
    height: 16,
    backgroundColor: '#FBBF24',
    borderRadius: 2,
  },
  redCard: {
    width: 12,
    height: 16,
    backgroundColor: '#EF4444',
    borderRadius: 2,
  },
  eventDetails: {
    flex: 1,
  },
  eventPlayer: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },
  eventSubDetail: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    marginTop: 2,
  },
  eventTeamBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  eventTeamText: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    fontWeight: '700',
  },
  mapCard: {
    backgroundColor: htzTokens.colors.surface,
    padding: 14,
    borderColor: htzTokens.colors.outline,
  },
  mapCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  mapPositionBadge: {
    backgroundColor: htzTokens.colors.surfaceVariant,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mapPositionText: {
    color: htzTokens.colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  mapNameTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  mapScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  mapScoreTeam: {
    color: htzTokens.colors.outline,
    fontSize: 14,
    fontWeight: '700',
  },
  winningTeamText: {
    color: htzTokens.colors.onSurface,
    fontWeight: '900',
  },
  mapVs: {
    color: htzTokens.colors.outline,
    fontSize: 12,
  },
  mapFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: htzTokens.colors.outline,
    paddingTop: 8,
    marginTop: 6,
  },
  mapWinnerText: {
    color: htzTokens.colors.outline,
    fontSize: 11,
  },
  mapPendingText: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    fontStyle: 'italic',
  },
  mapDurationText: {
    color: htzTokens.colors.outline,
    fontSize: 11,
  },
  teamSwitchContainer: {
    flexDirection: 'row',
    backgroundColor: htzTokens.colors.surface,
    padding: 4,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: htzTokens.colors.outline,
  },
  teamSwitchBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  teamSwitchActive: {
    backgroundColor: htzTokens.colors.primary,
  },
  teamSwitchText: {
    color: htzTokens.colors.outline,
    fontSize: 12,
    fontWeight: '700',
  },
  teamSwitchTextActive: {
    color: htzTokens.colors.onPrimary,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: htzTokens.colors.outline,
    fontSize: 12,
  },
  playersList: {
    gap: 8,
  },
  playerCard: {
    backgroundColor: htzTokens.colors.surface,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: htzTokens.colors.outline,
  },
  playerAvatarContainer: {
    position: 'relative',
    marginRight: 10,
  },
  playerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: htzTokens.colors.surfaceVariant,
  },
  playerAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(74, 124, 89, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(74, 124, 89, 0.4)',
  },
  playerAvatarFallbackText: {
    color: htzTokens.colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  playerNumberBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: htzTokens.colors.surfaceVariant,
    paddingHorizontal: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: htzTokens.colors.outline,
  },
  playerNumberText: {
    color: htzTokens.colors.onSurface,
    fontSize: 9,
    fontWeight: '800',
  },
  playerInfo: {
    flex: 1,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerNickname: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },
  playerCountryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  playerCountryText: {
    color: htzTokens.colors.outline,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  playerFullName: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    marginTop: 1,
  },
  rolePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  roleText: {
    color: htzTokens.colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '600',
  },
  h2hSummaryCard: {
    backgroundColor: htzTokens.colors.surface,
    padding: 16,
    borderColor: htzTokens.colors.outline,
  },
  h2hTeamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  h2hTeamTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 12,
    fontWeight: '700',
  },
  h2hWinsNumber: {
    color: htzTokens.colors.primary,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  h2hDrawsTitle: {
    color: htzTokens.colors.outline,
    fontSize: 11,
  },
  h2hDrawsNumber: {
    color: htzTokens.colors.outline,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressSegmentA: {
    backgroundColor: htzTokens.colors.primary,
  },
  progressSegmentDraw: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  progressSegmentB: {
    backgroundColor: '#8B5CF6',
  },
  formStreakCard: {
    backgroundColor: htzTokens.colors.surface,
    padding: 14,
    borderColor: htzTokens.colors.outline,
  },
  formTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  formTeamName: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '700',
    width: 80,
  },
  streakPills: {
    flexDirection: 'row',
    gap: 6,
  },
  streakCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakWin: {
    backgroundColor: 'rgba(74, 124, 89, 0.3)',
    borderWidth: 1,
    borderColor: htzTokens.colors.primary,
  },
  streakLoss: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  streakDraw: {
    backgroundColor: 'rgba(251, 191, 36, 0.25)',
    borderWidth: 1,
    borderColor: '#FBBF24',
  },
  streakText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  prevMatchCard: {
    backgroundColor: htzTokens.colors.surface,
    padding: 12,
    borderColor: htzTokens.colors.outline,
  },
  prevMatchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  prevMatchDate: {
    color: htzTokens.colors.outline,
    fontSize: 11,
  },
  prevMatchTournament: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    fontWeight: '600',
  },
  prevMatchScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  prevMatchTeam: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  prevMatchScore: {
    color: htzTokens.colors.primary,
    fontSize: 16,
    fontWeight: '800',
    paddingHorizontal: 12,
  },
  prevMatchWinnerRow: {
    borderTopWidth: 1,
    borderTopColor: htzTokens.colors.outline,
    paddingTop: 6,
    marginTop: 4,
  },
  prevMatchWinnerText: {
    color: htzTokens.colors.outline,
    fontSize: 10,
    textAlign: 'center',
  },
  tvCard: {
    backgroundColor: htzTokens.colors.surface,
    padding: 14,
    borderColor: htzTokens.colors.outline,
  },
  tvHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  tvTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },
  tvPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tvPill: {
    backgroundColor: htzTokens.colors.surfaceVariant,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: htzTokens.colors.outline,
  },
  tvPillText: {
    color: htzTokens.colors.onSurface,
    fontSize: 12,
    fontWeight: '600',
  },
  streamCard: {
    backgroundColor: htzTokens.colors.surface,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: htzTokens.colors.outline,
  },
  streamIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: htzTokens.colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  streamInfo: {
    flex: 1,
  },
  streamTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streamName: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },
  streamMeta: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    marginTop: 2,
  },
  openStreamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(74, 124, 89, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(74, 124, 89, 0.45)',
  },
  openStreamText: {
    color: htzTokens.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  otherStreamsWrap: {
    marginTop: 10,
    gap: 6,
  },
  otherStreamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  otherStreamName: {
    flex: 1,
    color: htzTokens.colors.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '600',
  },
  otherStreamLang: {
    color: htzTokens.colors.outline,
    fontSize: 10,
    fontWeight: '700',
  },
  legalNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 8,
  },
  legalNoticeText: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
  emptyCard: {
    backgroundColor: htzTokens.colors.surface,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: htzTokens.colors.outline,
    marginVertical: 10,
  },
  emptyTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: htzTokens.colors.outline,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
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
    letterSpacing: 0.3,
  },
  tierTextS: {
    color: '#FBBF24',
  },
  tierTextA: {
    color: htzTokens.colors.inversePrimary,
  },
  tierTextOther: {
    color: htzTokens.colors.outline,
  },
  vlrShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  vlrShortcutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  vlrShortcutTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },
  vlrShortcutSubtitle: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    marginTop: 2,
  },
});
