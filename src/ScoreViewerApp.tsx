import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  BackHandler,
  Platform,
  AppState,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import type { ViewStyle, AppStateStatus } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Trophy,
  Radio,
  Watch,
  Star,
  Key,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Wifi,
  SlidersHorizontal,
  Compass,
  Gamepad2,
  X,
  RotateCcw,
  Eye,
  EyeOff,
  Bell,
} from 'lucide-react-native';
import { SubAppProps } from './types';
import {
  Match,
  MatchStatus,
  SportCategory,
  Gtr3ConfigState,
  MatchRegion,
  TournamentItem,
  TeamCatalogItem,
  MatchSourceStatus,
  NotificationEventPrefs,
  NotificationSettings,
} from './services/types';
import { ScoreService, isGameCategoryEnabled } from './services/scoreService';
import {
  MatchSnapshot,
  toMatchSnapshot,
  diffMatchEvents,
  findUpcomingReminders,
} from './services/matchEvents';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  createMatchPrefsResolver,
} from './services/notificationEngine';
import { AppNotifications } from './services/notificationService';
import { PushService } from './services/pushService';
import { NotificationsModal } from './components/NotificationsModal';
import { MatchGroup } from './components/MatchGroup';
import { MatchDetailModal } from './components/MatchDetailModal';
import { GameManagementModal } from './components/GameManagementModal';
import { WatchCompanionView } from './components/WatchCompanionView';
import { CatalogExplorerView } from './components/CatalogExplorerView';
import { TournamentHubView } from './components/TournamentHubView';
import { TournamentDetailView } from './components/TournamentDetailView';
import {
  CompetitionFiltersModal,
  TierFilterOption,
  RegionFilterOption,
  getTierShortLabel,
  getRegionShortLabel,
} from './components/CompetitionFiltersModal';
import {
  HtzButton,
  HtzCard,
  HtzInput,
  HtzSportChip,
  htzTokens,
} from './components/htz';

type MainTab = 'scores' | 'tournaments' | 'explore' | 'watch' | 'api';

const DEFAULT_ENABLED_GAMES = {
  football: true,
  valorant: true,
  lol: true,
  cs2: true,
  r6: true,
  dota2: true,
  rocket_league: false,
};

const DEFAULT_TEAMS = [
  'Real Madrid',
  'FC Barcelona',
  'Real Sociedad',
  'Athletic Club',
  'Movistar KOI',
  'Fnatic',
  'G2 Esports',
  'Team Heretics',
  'GiantX',
];

const DEFAULT_TOURNAMENTS = ScoreService.getDefaultFavoriteTournaments();

// Marca de migración: los torneos Élite (Tier S) se añaden a favoritos una única vez.
const ELITE_FAVORITES_MIGRATION_KEY = 'elite_favorites_seeded_v1';

const SPORT_OPTIONS: { id: 'TODOS' | SportCategory; label: string }[] = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'FÚTBOL', label: 'Fútbol' },
  { id: 'VALORANT', label: 'Valorant' },
  { id: 'LOL', label: 'LoL' },
  { id: 'CS2', label: 'CS2' },
  { id: 'R6', label: 'R6 Siege' },
  { id: 'DOTA2', label: 'Dota 2' },
];

const STATUS_TAB_LABELS: Record<MatchStatus, string> = {
  LIVE: 'En Directo',
  UPCOMING: 'Próximos',
  FINISHED: 'Finalizados',
};

const STATUS_EMPTY_TITLES: Record<MatchStatus, string> = {
  LIVE: 'No hay partidos en directo ahora',
  UPCOMING: 'No hay próximos partidos',
  FINISHED: 'No hay resultados recientes',
};

const STATUS_EMPTY_SUBTITLES: Record<MatchStatus, string> = {
  LIVE: 'Ninguno de tus clubes o torneos favoritos está jugando en este momento.',
  UPCOMING: 'No hay partidos programados de tus equipos o torneos favoritos en los próximos días.',
  FINISHED: 'No hay partidos finalizados recientes de tus equipos o torneos favoritos.',
};

/** Clave local (YYYY-MM-DD) de una fecha, para agrupar partidos por día. */
function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Etiqueta corta del día para la tira semanal: Hoy / Mañana / "Mié 9". */
function dayChipLabel(date: Date): string {
  const key = localDayKey(date);
  const today = new Date();
  if (key === localDayKey(today)) return 'Hoy';
  if (key === localDayKey(new Date(today.getTime() + 24 * 60 * 60 * 1000))) return 'Mañana';
  const label = date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "hace X" legible para el indicador de última actualización. */
function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  if (diffMs < 15_000) return 'ahora mismo';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `hace ${sec} s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hours = Math.floor(min / 60);
  return `hace ${hours} h`;
}

/** Descripción del estado de una fuente para lectores de pantalla. */
function describeSource(s: MatchSourceStatus): string {
  if (s.state === 'ok') return `${s.count} partidos`;
  if (s.state === 'error') return 'error de conexión';
  return s.reason === 'no-token' ? 'sin token' : 'desactivado';
}

/**
 * Agrupa los partidos por torneo (liga) conservando el orden de aparición, de modo
 * que cada torneo se muestre una sola vez con sus partidos justo debajo.
 */
function groupMatchesByLeague(matches: Match[]): { key: string; matches: Match[] }[] {
  const order: string[] = [];
  const groups = new Map<string, Match[]>();
  for (const m of matches) {
    const key = `${m.game}::${m.league || 'Otros'}`;
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = [];
      groups.set(key, bucket);
      order.push(key);
    }
    bucket.push(m);
  }
  return order.map((key) => ({ key, matches: groups.get(key)! }));
}

// En web, React Native Web no implementa snapToInterval/disableIntervalMomentum,
// así que el anclaje de página se hace con scroll-snap CSS. Estas propiedades CSS
// no están tipadas por React Native en ViewStyle, por eso se declaran aparte.
const WEB_PAGER_SNAP_STYLE = { scrollSnapType: 'x mandatory' } as unknown as ViewStyle;
const WEB_PAGE_SNAP_STYLE = {
  scrollSnapAlign: 'start',
  // Impide que un mismo gesto salte más de una página
  scrollSnapStop: 'always',
} as unknown as ViewStyle;

// Sin eventos de scroll durante este tiempo se considera que un gesto ha terminado
const SCROLL_GESTURE_GAP_MS = 180;

const BOTTOM_TABS: { id: MainTab; label: string; Icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { id: 'scores', label: 'Partidos', Icon: Radio },
  { id: 'tournaments', label: 'Torneos', Icon: Trophy },
  { id: 'explore', label: 'Explorar', Icon: Compass },
  { id: 'watch', label: 'Amazfit', Icon: Watch },
  { id: 'api', label: 'APIs', Icon: Key },
];

// Vistas de pestaña memoizadas: al cambiar de pestaña (o cualquier otro estado
// del contenedor) React reutiliza su árbol en lugar de volver a renderizarlo.
const MemoTournamentHubView = React.memo(TournamentHubView);
const MemoCatalogExplorerView = React.memo(CatalogExplorerView);
const MemoWatchCompanionView = React.memo(WatchCompanionView);
const MemoMatchGroup = React.memo(MatchGroup);

export const ScoreViewerApp: React.FC<SubAppProps> = ({ storage }) => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<MainTab>('scores');
  // Pestañas ya montadas: una vez visitadas (o precargadas en segundo plano) se
  // mantienen montadas y se ocultan con display:none. Volver a ellas es inmediato
  // porque no se reconstruye su árbol de vistas.
  const [mountedTabs, setMountedTabs] = useState<Record<MainTab, boolean>>({
    scores: true,
    tournaments: false,
    explore: false,
    watch: false,
    api: false,
  });
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // true cuando ya se ha leído la configuración persistida (tokens, favoritos...).
  // Hasta entonces no se lanza ninguna petición para no cargar con valores por defecto.
  const [configReady, setConfigReady] = useState(false);
  // Identificador de la última petición lanzada: evita que una respuesta antigua
  // sobrescriba datos más recientes.
  const requestSeqRef = useRef(0);
  // Momento del último fetch completado con éxito (para decidir si conviene refrescar).
  const lastLoadAtRef = useRef(0);
  // Momento en que arrancó la última carga (para el auto-refresco periódico).
  const lastLoadStartRef = useRef(0);
  // Auto-refresco: con directos se refresca más a menudo.
  const hasLiveRef = useRef(false);
  // Motor de alertas: estado anterior de cada partido y eventos ya notificados.
  const matchSnapshotsRef = useRef<Map<string, MatchSnapshot>>(new Map());
  const notifiedEventsRef = useRef<Set<string>>(new Set());
  const remindedEventsRef = useRef<Set<string>>(new Set());
  const notifEngineReadyRef = useRef(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<TournamentItem | null>(null);

  // Filters for Scores
  const [sportFilter, setSportFilter] = useState<'TODOS' | SportCategory>('TODOS');
  const [tierFilter, setTierFilter] = useState<TierFilterOption>('TODOS');
  const [regionFilter, setRegionFilter] = useState<RegionFilterOption>('TODOS');
  const [searchQuery, setSearchQuery] = useState('');
  // Día seleccionado en la tira semanal de la página "Próximos" (null = todos).
  const [weekDayFilter, setWeekDayFilter] = useState<string | null>(null);

  // Pestañas deslizables de estado del partido (Finalizados | En Directo | Próximos)
  const [statusTab, setStatusTab] = useState<MatchStatus>('UPCOMING');
  // Mientras sea true, la pestaña visible sigue automáticamente a la página por defecto
  // (En Directo si hay partidos vivos, si no Próximos). Se desactiva al navegar el usuario.
  const autoFollowStatusRef = useRef(true);
  const prevActiveTabRef = useRef(activeTab);
  // Cuando el cambio de página lo provoca el propio gesto del usuario, no hay que
  // "resituar" el paginador desde el efecto de sincronización (rompería el deslizamiento).
  const suppressPagerSyncRef = useRef(false);
  // Gesto de deslizamiento en curso: un mismo gesto no puede mover más de una página.
  // anchorXRef es la posición de reposo donde empezó el gesto actual.
  const anchorXRef = useRef(0);
  const lastScrollXRef = useRef(0);
  const lastScrollTimeRef = useRef(0);
  const pagerRef = useRef<ScrollView>(null);
  const [pagerWidth, setPagerWidth] = useState(0);
  const [pagerHeight, setPagerHeight] = useState(0);
  const { width: windowWidth } = useWindowDimensions();
  // Ancho de cada página: el medido en el contenedor y, si aún no se conoce, el de la ventana
  const pageWidth = pagerWidth > 0 ? pagerWidth : windowWidth;

  // Diagnostic states for API testing
  const [testingPanda, setTestingPanda] = useState(false);
  const [pandaTestResult, setPandaTestResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);
  const [testingFootball, setTestingFootball] = useState(false);
  const [footballTestResult, setFootballTestResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);

  // Watch Configuration state
  const [watchConfig, setWatchConfig] = useState<Gtr3ConfigState>({
    pandaToken: '', // Seguridad: no hardcodear tokens. Se configuran en la pestaña APIs y se guardan en storage.
    footballToken: '',
    enabledGames: DEFAULT_ENABLED_GAMES,
    favoriteTeams: DEFAULT_TEAMS,
    favoriteTournaments: DEFAULT_TOURNAMENTS,
    showUpcoming: true,
    showFavoriteRecentResults: true,
    showTeamLogos: true,
    maxMatches: 15,
    notifications: DEFAULT_NOTIFICATION_SETTINGS,
  });

  // Borradores locales de los tokens de la pestaña APIs. Se editan aquí y solo se
  // aplican a la configuración (y relanzan peticiones) al pulsar "Guardar y Aplicar Claves".
  const [pandaTokenDraft, setPandaTokenDraft] = useState('');
  const [footballTokenDraft, setFootballTokenDraft] = useState('');
  const [showPandaToken, setShowPandaToken] = useState(false);
  const [showFootballToken, setShowFootballToken] = useState(false);

  // Toast/snackbar propio: react-native-web no implementa Alert.alert (es un no-op).
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Indicador de frescura: cuándo se actualizó y estado de cada fuente consultada.
  const [sourceStatus, setSourceStatus] = useState<MatchSourceStatus[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(0);
  // Fuerza un re-render periódico para refrescar el "hace X".
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setClockTick((v) => v + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Modales
  const [gamesModalVisible, setGamesModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  // Panel plegable superior con los filtros de deporte / competición (plegado por
  // defecto: la cabecera se queda en una sola fila y se abre con un toque).
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);

  // Contador de filtros de competición activos (Tier / Región)
  const activeFiltersCount =
    (tierFilter !== 'TODOS' ? 1 : 0) +
    (regionFilter !== 'TODOS' ? 1 : 0);

  // ¿Hay algún token de API configurado? Si no, los estados vacíos lo explican y
  // ofrecen un acceso directo a la pestaña APIs.
  const hasAnyApiToken = Boolean(
    watchConfig.pandaToken.trim() || watchConfig.footballToken.trim()
  );

  // Explicación específica cuando el filtro de deporte activo no tiene fuente de
  // datos sin token (p. ej. R6 Siege, LoL, CS2 o Dota 2 sin clave de PandaScore).
  // Valorant siempre tiene el directo de VLR y el fútbol cae en el aviso genérico.
  const tokenHintForSport = (() => {
    if (sportFilter === 'TODOS') return null;
    if (sportFilter === 'FÚTBOL') {
      return watchConfig.footballToken.trim()
        ? null
        : 'El filtro Fútbol necesita tu token de Football-Data: configúralo en la pestaña APIs para ver partidos de fútbol.';
    }
    if (sportFilter === 'VALORANT') return null;
    return watchConfig.pandaToken.trim()
      ? null
      : `El filtro ${sportFilter} necesita tu token de PandaScore: sin él no hay fuente de datos para este juego.`;
  })();

  // Auto-reset del filtro de deporte si el seleccionado queda desactivado
  useEffect(() => {
    if (sportFilter !== 'TODOS' && !isGameCategoryEnabled(sportFilter, watchConfig.enabledGames)) {
      setSportFilter('TODOS');
    }
  }, [sportFilter, watchConfig.enabledGames]);

  // Manejo del botón / gesto atrás de Android para navegación interna sin salir al hub
  useEffect(() => {
    const handleHardwareBackPress = () => {
      // 0. Si hay un torneo seleccionado abierto, cerrarlo y volver a la vista anterior
      if (selectedTournament) {
        setSelectedTournament(null);
        return true;
      }
      // 1. Si hay un modal de partido abierto, cerrarlo
      if (selectedMatch) {
        setSelectedMatch(null);
        return true;
      }
      // 2. Si el modal de juegos está abierto, cerrarlo
      if (gamesModalVisible) {
        setGamesModalVisible(false);
        return true;
      }
      // 3. Si el modal de filtros está abierto, cerrarlo
      if (filterModalVisible) {
        setFilterModalVisible(false);
        return true;
      }
      // 4. Si estamos en una pestaña distinta a 'scores', volver a la principal
      if (activeTab !== 'scores') {
        setActiveTab('scores');
        return true;
      }
      // 5. Si estamos en la pestaña principal sin modales, NO salimos al hub
      // El usuario debe pulsar expresamente el botón 'Hub' en la barra superior
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBackPress);
    return () => subscription.remove();
  }, [selectedTournament, selectedMatch, gamesModalVisible, filterModalVisible, activeTab]);

  // Opciones de deportes filtradas según los juegos habilitados por el usuario
  const availableSports = React.useMemo(() => {
    return SPORT_OPTIONS.filter((s) => {
      if (s.id === 'TODOS') return true;
      return isGameCategoryEnabled(s.id, watchConfig.enabledGames);
    });
  }, [watchConfig.enabledGames]);

  // Load persisted configuration & normalize legacy entries
  useEffect(() => {
    (async () => {
      try {
        const storedConfig = await storage.get<Gtr3ConfigState>('watch_config');
        const alreadyMigrated = await storage.get<boolean>(ELITE_FAVORITES_MIGRATION_KEY);

        if (!storedConfig) {
          // Primera instalación: el estado inicial ya incluye los torneos Élite como favoritos.
          // Se marca la migración como hecha para que, si el usuario los quita, no vuelvan a aparecer.
          if (!alreadyMigrated) {
            await storage.set(ELITE_FAVORITES_MIGRATION_KEY, true);
          }
          return;
        }

        const existingTournaments = Array.isArray(storedConfig.favoriteTournaments)
          ? storedConfig.favoriteTournaments
          : [];
        const existingTeams = Array.isArray(storedConfig.favoriteTeams) ? storedConfig.favoriteTeams : [];

        // Migración única: los torneos Élite (Tier S) pasan a ser favoritos por defecto
        // para que aparezcan marcados y el usuario pueda quitarlos cuando quiera.
        let rawTournaments = existingTournaments;
        if (!alreadyMigrated) {
          const merged = [...existingTournaments];
          for (const entry of DEFAULT_TOURNAMENTS) {
            if (!merged.some((f) => f.toLowerCase().trim() === entry.toLowerCase().trim())) {
              merged.push(entry);
            }
          }
          rawTournaments = merged;
          await storage.set(ELITE_FAVORITES_MIGRATION_KEY, true);
        }

        const normalizedTournaments = ScoreService.normalizeFavoriteTournaments(rawTournaments);
        const normalizedTeams = ScoreService.normalizeFavoriteTeams(
          existingTeams.length > 0 ? existingTeams : DEFAULT_TEAMS
        );

        const nextConfig: Gtr3ConfigState = {
          ...storedConfig,
          favoriteTournaments: normalizedTournaments,
          favoriteTeams: normalizedTeams,
        };

        setWatchConfig((prev) => ({ ...prev, ...nextConfig }));
        // Los campos de token de la pestaña APIs se editan sobre borradores locales.
        setPandaTokenDraft(storedConfig.pandaToken || '');
        setFootballTokenDraft(storedConfig.footballToken || '');
        await storage.set('watch_config', nextConfig);
      } catch (err) {
        console.warn('Error loading storage:', err);
      } finally {
        // Continúe como continúe la lectura, la app ya puede empezar a cargar datos.
        setConfigReady(true);
      }
    })();
  }, []);

  // Marca como montada una pestaña la primera vez que se visita. Se hace en el
  // propio manejador (y en la precarga) para no provocar renders en cascada.
  const navigateToTab = useCallback((id: MainTab) => {
    setSelectedTournament(null);
    setActiveTab(id);
    setMountedTabs((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }, []);

  // Precarga en segundo plano las dos pestañas más pesadas (Torneos y Explorar)
  // poco después del arranque: así el primer cambio a ellas también es inmediato.
  useEffect(() => {
    if (!configReady) return;
    const timers = [
      setTimeout(
        () => setMountedTabs((prev) => (prev.tournaments ? prev : { ...prev, tournaments: true })),
        900
      ),
      setTimeout(
        () => setMountedTabs((prev) => (prev.explore ? prev : { ...prev, explore: true })),
        2000
      ),
    ];
    return () => timers.forEach(clearTimeout);
  }, [configReady]);

  // Última configuración aplicada. loadMatches lo lee de aquí para no depender del
  // objeto watchConfig: así teclear en los campos de token ya no relanza peticiones.
  const configRef = useRef(watchConfig);
  useEffect(() => {
    configRef.current = watchConfig;
  }, [watchConfig]);

  /** Reconciliación de recordatorios programados (solo nativo, app cerrada OK). */
  const reconcileNativeReminders = useCallback(
    async (
      data: Match[],
      settings: NotificationSettings,
      resolvePrefs: (m: Match) => { relevant: boolean; prefs: NotificationEventPrefs }
    ) => {
      if (Platform.OS === 'web') return;
      const perm = await AppNotifications.getPermission();
      if (perm !== 'granted') return;

      const now = Date.now();
      const dayAhead = 24 * 60 * 60 * 1000;
      const eligible = new Map<string, { date: Date; title: string; body: string }>();
      for (const m of data) {
        if (m.status !== 'UPCOMING') continue;
        const start = new Date(m.startTimeIso).getTime();
        if (isNaN(start)) continue;
        const remindAt = start - settings.reminderMinutes * 60_000;
        if (remindAt <= now || remindAt - now > dayAhead) continue; // solo próximas 24 h
        const { relevant, prefs } = resolvePrefs(m);
        if (!relevant || !prefs.reminder) continue;
        const shortA = m.teamA.shortName || m.teamA.name;
        const shortB = m.teamB.shortName || m.teamB.name;
        eligible.set(`reminder-${m.id}-${remindAt}`, {
          date: new Date(remindAt),
          title: `En ${settings.reminderMinutes} min: ${shortA} vs ${shortB}`,
          body: m.league,
        });
      }

      const scheduled = await AppNotifications.getScheduledIdentifiers();
      for (const id of scheduled.filter((i) => i.startsWith('reminder-'))) {
        if (!eligible.has(id)) await AppNotifications.cancelScheduled(id);
      }
      for (const [id, info] of eligible) {
        if (!scheduled.includes(id)) {
          await AppNotifications.scheduleAt(id, info.date, info.title, info.body);
        }
      }
    },
    []
  );

  /**
   * Motor de alertas: compara cada partido con su estado anterior y entrega los
   * eventos según la matriz de preferencias (general → torneo → equipo). Con las
   * notificaciones apagadas mantiene el aviso in-app de "nuevo directo".
   */
  const processMatchNotifications = useCallback(
    async (data: Match[]) => {
      const cfg = configRef.current;
      const settings = cfg.notifications ?? DEFAULT_NOTIFICATION_SETTINGS;

      // Fase 2: con el push conectado, el servidor es el único que envía avisos
      // (incluso con la app cerrada); la app no duplica. Al desconectar, el motor
      // local se reinicia en "primera carga" para no soltar eventos atrasados.
      const pushConnected =
        Platform.OS !== 'web' && Boolean(settings.push?.connected && settings.push?.serverUrl);
      if (pushConnected) {
        notifEngineReadyRef.current = false;
        return;
      }

      const firstRun = !notifEngineReadyRef.current;
      const resolvePrefs = createMatchPrefsResolver(
        settings,
        cfg.favoriteTeams,
        cfg.favoriteTournaments
      );

      if (!firstRun) {
        for (const m of data) {
          const prev = matchSnapshotsRef.current.get(m.id);
          const { relevant, prefs } = resolvePrefs(m);
          if (!relevant) continue;
          const effectivePrefs: NotificationEventPrefs = settings.enabled
            ? prefs
            : {
                kickoff: true,
                goal: false,
                halfTime: false,
                fullTime: false,
                mapEnd: false,
                seriesEnd: false,
                reminder: false,
              };
          for (const ev of diffMatchEvents(m, prev, effectivePrefs)) {
            if (notifiedEventsRef.current.has(ev.dedupeKey)) continue;
            notifiedEventsRef.current.add(ev.dedupeKey);
            if (settings.enabled) {
              const delivered = await AppNotifications.notify(ev.title, ev.body, ev.dedupeKey);
              if (!delivered) showToast(ev.title);
            } else {
              showToast(`${ev.title} · ${ev.body}`);
            }
          }
        }
      }
      for (const m of data) matchSnapshotsRef.current.set(m.id, toMatchSnapshot(m));

      // Recordatorios: en web se detectan al vuelo; en nativo se programan en el sistema.
      if (settings.enabled) {
        if (Platform.OS === 'web') {
          const reminders = findUpcomingReminders(
            data,
            settings,
            new Date(),
            remindedEventsRef.current,
            resolvePrefs
          );
          for (const r of reminders) {
            remindedEventsRef.current.add(r.dedupeKey);
            const delivered = await AppNotifications.notify(r.title, r.body, r.dedupeKey);
            if (!delivered) showToast(r.title);
          }
        } else {
          await reconcileNativeReminders(data, settings, resolvePrefs);
        }
      }

      notifEngineReadyRef.current = true;
    },
    [showToast, reconcileNativeReminders]
  );

  // Fetch matches
  const loadMatches = useCallback(async (forceRefresh = false, configOverride?: Gtr3ConfigState) => {
    const cfg = configOverride ?? configRef.current;
    const requestSeq = ++requestSeqRef.current;
    lastLoadStartRef.current = Date.now();
    try {
      const { matches: data, sources } = await ScoreService.fetchAllMatchesWithStatus({
        pandaToken: cfg.pandaToken,
        footballToken: cfg.footballToken,
        favoriteTeams: cfg.favoriteTeams,
        favoriteTournaments: cfg.favoriteTournaments,
        enabledGames: cfg.enabledGames,
        forceRefresh,
      });
      // Si mientras tanto se ha lanzado otra petición (p. ej. con la configuración
      // ya cargada), se descarta esta respuesta para no pisar datos más frescos.
      if (requestSeq !== requestSeqRef.current) return;
      lastLoadAtRef.current = Date.now();
      setLastUpdatedAt(lastLoadAtRef.current);
      setSourceStatus(sources);
      setMatches(data);

      // Motor de alertas: eventos (inicio, gol, descanso, final, mapa, serie) y
      // recordatorios, con la matriz de preferencias por favorito.
      processMatchNotifications(data);
    } catch (err) {
      if (requestSeq !== requestSeqRef.current) return;
      console.warn('Error loading matches:', err);
    } finally {
      if (requestSeq === requestSeqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [processMatchNotifications]);

  // Clave estable de lo que sí afecta a los partidos (favoritos y juegos activos).
  // Los tokens quedan fuera a propósito: se aplican al guardar y no al teclear.
  const matchesConfigKey = JSON.stringify({
    teams: watchConfig.favoriteTeams,
    tournaments: watchConfig.favoriteTournaments,
    enabledGames: watchConfig.enabledGames,
  });

  // Primera carga y recargas por cambios de favoritos/juegos. Las ráfagas de
  // cambios (varios toggles seguidos) se agrupan con un pequeño debounce para no
  // lanzar una descarga completa por cada uno.
  const reloadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!configReady) return;
    if (reloadDebounceRef.current) clearTimeout(reloadDebounceRef.current);
    reloadDebounceRef.current = setTimeout(() => {
      reloadDebounceRef.current = null;
      loadMatches();
    }, 600);
    return () => {
      if (reloadDebounceRef.current) clearTimeout(reloadDebounceRef.current);
    };
  }, [configReady, matchesConfigKey, loadMatches]);

  // Al volver a la app desde segundo plano, se recargan los datos automáticamente
  // (salvo que se acaben de actualizar hace menos de un minuto).
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;
      if (nextState !== 'active' || prevState === 'active') return;
      if (Date.now() - lastLoadAtRef.current < 60_000) return;
      loadMatches(true);
    });
    return () => subscription.remove();
  }, [loadMatches]);

  // Mantiene el flag de "hay directos" para que el auto-refresco elija el ritmo.
  useEffect(() => {
    hasLiveRef.current = matches.some((m) => m.status === 'LIVE');
  }, [matches]);

  // Auto-refresco inteligente: cada 30 s comprueba si toca recargar. Con partidos
  // en directo refresca ~cada 75 s; sin ellos, cada 3 minutos. Se salta si la app
  // está en segundo plano o si acaba de lanzarse una carga.
  useEffect(() => {
    if (!configReady) return;
    const AUTO_REFRESH_LIVE_MS = 75_000;
    const AUTO_REFRESH_IDLE_MS = 180_000;
    const timer = setInterval(() => {
      if (appStateRef.current !== 'active') return;
      const elapsed = Date.now() - lastLoadStartRef.current;
      const threshold = hasLiveRef.current ? AUTO_REFRESH_LIVE_MS : AUTO_REFRESH_IDLE_MS;
      if (elapsed >= threshold) loadMatches();
    }, 30_000);
    return () => clearInterval(timer);
  }, [configReady, loadMatches]);

  // Fase 2: con el push conectado, sube la configuración al servidor (tokens,
  // favoritos y matriz de eventos) con un pequeño debounce ante cambios.
  const pushSyncKey = JSON.stringify({
    push: watchConfig.notifications?.push ?? null,
    enabled: watchConfig.notifications?.enabled ?? false,
    events: watchConfig.notifications?.events ?? null,
    teams: watchConfig.notifications?.teams ?? null,
    tournaments: watchConfig.notifications?.tournaments ?? null,
    reminderMinutes: watchConfig.notifications?.reminderMinutes ?? null,
    pandaToken: watchConfig.pandaToken,
    footballToken: watchConfig.footballToken,
    favoriteTeams: watchConfig.favoriteTeams,
    favoriteTournaments: watchConfig.favoriteTournaments,
  });
  useEffect(() => {
    if (!configReady) return;
    const push = configRef.current.notifications?.push;
    if (!push?.connected || !push.serverUrl || !push.authKey) return;
    if (Platform.OS === 'web') return;
    const timer = setTimeout(() => {
      PushService.pushConfig(configRef.current).catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, [configReady, pushSyncKey]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadMatches(true); // bypass cache on manual refresh
  }, [loadMatches]);

  const handleUpdateConfig = useCallback(async (newConfig: Gtr3ConfigState) => {
    configRef.current = newConfig;
    setWatchConfig(newConfig);
    await storage.set('watch_config', newConfig);
  }, [storage]);

  const handleToggleTournament = useCallback(async (tournament: TournamentItem | string) => {
    // Se parte de la última configuración aplicada (no del render) para que
    // varios toggles rápidos seguidos no se pisen entre sí.
    const base = configRef.current;
    const updated = ScoreService.toggleTournamentFavorite(base.favoriteTournaments, tournament);
    const newConfig = { ...base, favoriteTournaments: updated };
    configRef.current = newConfig;
    setWatchConfig(newConfig);
    await storage.set('watch_config', newConfig);
  }, [storage]);

  const handleToggleTeam = useCallback(async (team: TeamCatalogItem | string) => {
    const base = configRef.current;
    const updated = ScoreService.toggleTeamFavorite(base.favoriteTeams, team);
    const newConfig = { ...base, favoriteTeams: updated };
    configRef.current = newConfig;
    setWatchConfig(newConfig);
    await storage.set('watch_config', newConfig);
  }, [storage]);

  const handleSelectTournament = useCallback((t: TournamentItem) => {
    setSelectedTournament(t);
  }, []);

  const handleSelectMatch = useCallback((m: Match) => {
    setSelectedMatch(m);
  }, []);

  const handleOpenTournamentByLeague = useCallback((
    leagueName: string,
    game?: SportCategory,
    masterTournamentId?: string,
    seriesId?: number | string
  ) => {
    // 1. Extraer temporada / año / split explícito si viene en la cadena original (ej. "Summer 2026")
    const yearMatch = leagueName.match(/\b(202\d)\b/);
    const splitMatch = leagueName.match(/\b(Summer|Spring|Winter|Autumn|Fall)\b/i);
    const targetSeason = yearMatch
      ? (splitMatch ? `${splitMatch[1]} ${yearMatch[1]}` : yearMatch[1])
      : undefined;

    // La serie exacta del partido se fija en el torneo abierto: así la página
    // muestra siempre la edición correcta y nunca la de otro año.
    const withMatchHints = (t: TournamentItem): TournamentItem => ({
      ...t,
      season: targetSeason || t.season,
      ...(seriesId !== undefined && seriesId !== null ? { pinnedSeriesId: seriesId } : {}),
    });

    const all = ScoreService.getTournamentsCatalog();

    // 2. Vía fiable: el partido ya conoce su torneo maestro (VCT Champions, Worlds...)
    if (masterTournamentId) {
      const byId = all.find((t) => t.id === masterTournamentId);
      if (byId) {
        setSelectedTournament(withMatchHints(byId));
        return;
      }
    }

    // 3. Resolver por reglas de juego (VCT Masters vs Champions, Worlds, LEC...)
    //    antes de cualquier coincidencia difusa por nombre.
    if (game) {
      const ruleId = ScoreService.resolveMasterTournamentId(game, leagueName);
      if (ruleId) {
        const byRule = all.find((t) => t.id === ruleId);
        if (byRule) {
          setSelectedTournament(withMatchHints(byRule));
          return;
        }
      }
    }

    const rawLower = leagueName.toLowerCase();
    const gamePool = game ? all.filter((t) => t.game === game) : all;

    // 4. Mejor torneo del catálogo cuyo nombre/shortName/slug aparezca en la
    //    cadena original. Se exige coincidencia de 4+ caracteres y gana la más
    //    larga (evita que un genérico como "VCT" abra VCT Masters).
    let bestRaw: { tournament: TournamentItem; length: number } | null = null;
    for (const t of gamePool) {
      const variants = [t.name, t.shortName, t.slug]
        .filter((v): v is string => Boolean(v))
        .map((v) => v.toLowerCase().trim())
        .filter((v) => v.length >= 4);
      for (const v of variants) {
        if (rawLower.includes(v) && (!bestRaw || v.length > bestRaw.length)) {
          bestRaw = { tournament: t, length: v.length };
        }
      }
    }
    if (bestRaw) {
      setSelectedTournament(withMatchHints(bestRaw.tournament));
      return;
    }

    // 5. Limpiar nombre del torneo quitando fases, splits o temporadas (ej: " • Summer 2026", " - Spring")
    const cleanLeague = leagueName
      .replace(/\s*•.*$/, '')
      .replace(/\s*-\s*(Summer|Spring|Winter|Autumn|Fall|Stage\s*\d+|202\d).*$/i, '')
      .replace(/\s*\(.*\)$/, '')
      .trim();
    const cleanLower = cleanLeague.toLowerCase();

    // Solo se intenta la coincidencia difusa si el nombre limpio es suficientemente
    // específico: un "VCT" a secas no debe abrir VCT Masters.
    if (cleanLower.length >= 5) {
      const candidates = gamePool.filter(
        (t) =>
          t.name.toLowerCase() === cleanLower ||
          (t.shortName && t.shortName.toLowerCase() === cleanLower) ||
          t.name.toLowerCase().includes(cleanLower) ||
          cleanLower.includes(t.name.toLowerCase())
      );
      if (candidates.length > 0) {
        candidates.sort((a, b) => b.name.length - a.name.length);
        setSelectedTournament(withMatchHints(candidates[0]));
        return;
      }
    }

    // 6. Si es un torneo dinámico de API online, crear objeto de torneo para poder abrirlo
    const dynTournament: TournamentItem = {
      id: `dyn-${cleanLower.replace(/[^a-z0-9]/g, '-')}`,
      name: cleanLeague,
      shortName: cleanLeague.length > 10 ? cleanLeague.slice(0, 10) : cleanLeague,
      game: game || 'VALORANT',
      tier: 'A',
      region: 'GLOBAL',
      season: targetSeason || String(new Date().getFullYear()),
      description: `Competición oficial de ${cleanLeague}`,
      ...(seriesId !== undefined && seriesId !== null ? { pinnedSeriesId: seriesId } : {}),
    };
    setSelectedTournament(dynTournament);
  }, []);

  const handleToggleGame = useCallback(async (gameKey: string) => {
    const base = configRef.current;
    const currentVal = base.enabledGames[gameKey] !== false;
    const newEnabled = {
      ...base.enabledGames,
      [gameKey]: !currentVal,
    };
    const newConfig = { ...base, enabledGames: newEnabled };
    configRef.current = newConfig;
    setWatchConfig(newConfig);
    await storage.set('watch_config', newConfig);
  }, [storage]);

  const handleSetGamePreset = useCallback(async (preset: 'all' | 'esports' | 'football') => {
    let newEnabled: Record<string, boolean> = {};
    if (preset === 'all') {
      newEnabled = {
        football: true,
        valorant: true,
        lol: true,
        cs2: true,
        r6: true,
        dota2: true,
        rocket_league: false,
      };
    } else if (preset === 'esports') {
      newEnabled = {
        football: false,
        valorant: true,
        lol: true,
        cs2: true,
        r6: true,
        dota2: true,
        rocket_league: false,
      };
    } else if (preset === 'football') {
      newEnabled = {
        football: true,
        valorant: false,
        lol: false,
        cs2: false,
        r6: false,
        dota2: false,
        rocket_league: false,
      };
    }
    const newConfig = { ...configRef.current, enabledGames: newEnabled };
    configRef.current = newConfig;
    setWatchConfig(newConfig);
    await storage.set('watch_config', newConfig);
  }, [storage]);

  // Run PandaScore diagnostic test
  const handleTestPanda = async () => {
    setTestingPanda(true);
    setPandaTestResult(null);
    try {
      const result = await ScoreService.testPandaScore(pandaTokenDraft.trim());
      setPandaTestResult(result);
    } catch (err: any) {
      setPandaTestResult({ success: false, message: err.message || 'Error inesperado' });
    } finally {
      setTestingPanda(false);
    }
  };

  // Run Football-Data diagnostic test
  const handleTestFootball = async () => {
    setTestingFootball(true);
    setFootballTestResult(null);
    try {
      const result = await ScoreService.testFootball(footballTokenDraft.trim());
      setFootballTestResult(result);
    } catch (err: any) {
      setFootballTestResult({ success: false, message: err.message || 'Error inesperado' });
    } finally {
      setTestingFootball(false);
    }
  };

  // Coincidencia con los filtros de deporte / competición / búsqueda (el estado se aplica aparte)
  const matchesActiveFilters = useCallback((m: Match) => {
    const matchesGameEnabled = isGameCategoryEnabled(m.game, watchConfig.enabledGames);
    if (!matchesGameEnabled) return false;

    // En la vista general (Todos los deportes) mostramos únicamente los partidos de
    // equipos o torneos favoritos. Los torneos Élite (Tier S) se añaden a favoritos
    // por defecto, de modo que aparecen marcados pero se pueden quitar.
    // Al filtrar por un deporte concreto se muestran todos los partidos de ese deporte.
    const matchesFav = Boolean(m.hasFav) || sportFilter !== 'TODOS';
    const matchesSport = sportFilter === 'TODOS' || m.game === sportFilter;

    let matchesTier = true;
    if (tierFilter === 'TIER_A_PLUS') {
      matchesTier = m.tier === 'S' || m.tier === 'A';
    } else if (tierFilter === 'TIER_S') {
      matchesTier = m.tier === 'S';
    } else if (tierFilter === 'TIER_A') {
      matchesTier = m.tier === 'A';
    } else if (tierFilter === 'TIER_B') {
      matchesTier = m.tier === 'B';
    }

    let matchesRegion = true;
    if (regionFilter === 'GLOBAL') {
      matchesRegion = m.region === 'GLOBAL';
    } else if (regionFilter === 'EMEA') {
      // Incluye EMEA y España (ya que España forma parte de la zona europea)
      matchesRegion = m.region === 'EMEA' || m.region === 'ESPAÑA';
    } else if (regionFilter === 'ESPAÑA') {
      matchesRegion = m.region === 'ESPAÑA';
    } else if (regionFilter === 'AMERICAS') {
      matchesRegion = m.region === 'AMERICAS';
    } else if (regionFilter === 'ASIA') {
      matchesRegion = m.region === 'ASIA';
    }

    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      m.teamA.name.toLowerCase().includes(q) ||
      m.teamB.name.toLowerCase().includes(q) ||
      m.league.toLowerCase().includes(q);
    return matchesFav && matchesSport && matchesTier && matchesRegion && matchesQuery;
  }, [watchConfig.enabledGames, sportFilter, tierFilter, regionFilter, searchQuery]);

  // Días con partidos próximos (para la tira semanal de la página "Próximos").
  // Se calculan sobre todos los próximos filtrados; el filtro de día se aplica después.
  const upcomingDays = React.useMemo(() => {
    const map = new Map<string, { key: string; date: Date; count: number }>();
    matches
      .filter(matchesActiveFilters)
      .filter((m) => m.status === 'UPCOMING')
      .forEach((m) => {
        const d = new Date(m.startTimeIso);
        if (isNaN(d.getTime())) return;
        const key = localDayKey(d);
        const entry = map.get(key);
        if (entry) entry.count += 1;
        else map.set(key, { key, date: d, count: 1 });
      });
    return [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [matches, matchesActiveFilters]);

  // Si el día filtrado desaparece de los datos (p. ej. tras un refresco), se ignora.
  const effectiveWeekDayFilter =
    weekDayFilter && upcomingDays.some((d) => d.key === weekDayFilter) ? weekDayFilter : null;

  // Partidos ya filtrados, agrupados por estado del partido
  const matchesByStatus = React.useMemo<Record<MatchStatus, Match[]>>(() => {
    const base = matches.filter(matchesActiveFilters);
    const upcoming = base.filter((m) => m.status === 'UPCOMING');
    const filteredUpcoming = effectiveWeekDayFilter
      ? upcoming.filter((m) => {
          const d = new Date(m.startTimeIso);
          return !isNaN(d.getTime()) && localDayKey(d) === effectiveWeekDayFilter;
        })
      : upcoming;
    return {
      LIVE: base.filter((m) => m.status === 'LIVE'),
      UPCOMING: filteredUpcoming,
      FINISHED: base.filter((m) => m.status === 'FINISHED'),
    };
  }, [matches, matchesActiveFilters, effectiveWeekDayFilter]);

  // Secciones de cada página (favoritos + grupos por torneo) memoizadas: mantienen
  // la identidad de sus arrays entre renders, de modo que los MatchGroup
  // memoizados no se vuelven a renderizar al cambiar de pestaña ni con otros
  // cambios de estado del contenedor.
  const sectionsByStatus = React.useMemo<
    Record<MatchStatus, { favorite: Match[]; groups: { key: string; matches: Match[] }[] }>
  >(() => {
    const result = {} as Record<
      MatchStatus,
      { favorite: Match[]; groups: { key: string; matches: Match[] }[] }
    >;
    (Object.keys(matchesByStatus) as MatchStatus[]).forEach((st) => {
      const pageMatches = matchesByStatus[st];
      const favorite = pageMatches.filter((m) => m.teamA.isFav || m.teamB.isFav);
      // Los partidos de equipos favoritos se muestran también dentro del grupo de
      // su torneo (además de en la sección destacada), para que un partido que
      // aparece en favoritos también aparezca en su competición.
      result[st] = { favorite, groups: groupMatchesByLeague(pageMatches) };
    });
    return result;
  }, [matchesByStatus]);

  // Páginas disponibles ordenadas de pasado a futuro: Finalizados | En Directo | Próximos.
  // La página de En Directo solo existe cuando hay algún partido jugándose ahora mismo.
  const statusPages = React.useMemo<MatchStatus[]>(() => {
    const pages: MatchStatus[] = ['FINISHED'];
    if (matchesByStatus.LIVE.length > 0) pages.push('LIVE');
    pages.push('UPCOMING');
    return pages;
  }, [matchesByStatus]);

  // Página por defecto: En Directo si hay partidos vivos; si no, Próximos
  const defaultStatusTab: MatchStatus = matchesByStatus.LIVE.length > 0 ? 'LIVE' : 'UPCOMING';
  // Si la página activa ya no existe (p.ej. terminan los directos), cae a la página por defecto
  const currentStatusTab = statusPages.includes(statusTab) ? statusTab : defaultStatusTab;
  const activeStatusIndex = Math.max(0, statusPages.indexOf(currentStatusTab));
  // Páginas vecinas: lo que aparece al deslizar hacia cada lado
  const leftPage = activeStatusIndex > 0 ? statusPages[activeStatusIndex - 1] : undefined;
  const rightPage =
    activeStatusIndex < statusPages.length - 1 ? statusPages[activeStatusIndex + 1] : undefined;

  // Al entrar en la pestaña Partidos se muestra la página por defecto. Hasta que el usuario
  // navegue (swipe o pulsando una pestaña), la vista sigue automáticamente a esa página.
  useEffect(() => {
    if (prevActiveTabRef.current !== activeTab) {
      prevActiveTabRef.current = activeTab;
      if (activeTab === 'scores') autoFollowStatusRef.current = true;
    }
    if (autoFollowStatusRef.current) setStatusTab(defaultStatusTab);
  }, [activeTab, defaultStatusTab]);

  // Mantiene sincronizada la posición del paginador horizontal con la pestaña activa
  const syncPagerToActiveTab = useCallback(() => {
    if (suppressPagerSyncRef.current) {
      suppressPagerSyncRef.current = false;
      return;
    }
    const x = activeStatusIndex * pageWidth;
    // Un salto programático fija su destino como origen del gesto, para que el
    // límite de una página por gesto no lo recorte
    anchorXRef.current = x;
    lastScrollTimeRef.current = Date.now();
    pagerRef.current?.scrollTo({ x, animated: false });
  }, [activeStatusIndex, pageWidth]);

  // Se ejecuta antes del pintado para evitar mostrar la página equivocada durante un frame
  useLayoutEffect(() => {
    syncPagerToActiveTab();
  }, [syncPagerToActiveTab, statusPages.length]);

  // El usuario cambia de página pulsando una de las indicaciones laterales.
  // El salto de página lo hace el efecto de sincronización (instantáneo: un salto animado
  // entraría en conflicto con el gesto de deslizamiento y con el scroll-snap en web).
  const handleSelectStatusTab = useCallback((st: MatchStatus) => {
    if (st === statusTab) return;
    autoFollowStatusRef.current = false;
    setStatusTab(st);
  }, [statusTab]);

  // Un gesto del usuario siempre empieza desde la posición de reposo actual
  const handlePagerTouchStart = useCallback(() => {
    anchorXRef.current = lastScrollXRef.current;
    lastScrollTimeRef.current = Date.now();
  }, []);

  const handlePagerScrollBeginDrag = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    anchorXRef.current = x;
    lastScrollXRef.current = x;
    lastScrollTimeRef.current = Date.now();
  }, []);

  // El usuario cambia de página deslizando horizontalmente.
  // Se usa onScroll (y no momentum) porque es el que se dispara también con rueda/trackpad.
  const handlePagerScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const now = Date.now();
    const rawX = e.nativeEvent.contentOffset.x;

    // Un estallido de scroll tras un periodo en reposo empieza un gesto nuevo
    // (rueda, trackpad o barra de desplazamiento no lanzan eventos de drag)
    if (now - lastScrollTimeRef.current > SCROLL_GESTURE_GAP_MS) {
      anchorXRef.current = lastScrollXRef.current;
    }
    lastScrollTimeRef.current = now;

    // Un mismo gesto no puede desplazarse más de una página
    let x = rawX;
    const delta = rawX - anchorXRef.current;
    if (pageWidth > 0 && Math.abs(delta) > pageWidth) {
      x = anchorXRef.current + Math.sign(delta) * pageWidth;
      pagerRef.current?.scrollTo({ x, animated: false });
    }
    lastScrollXRef.current = x;

    const idx = Math.round(x / pageWidth);
    const st = statusPages[idx];
    if (!st || st === statusTab) return;
    autoFollowStatusRef.current = false;
    suppressPagerSyncRef.current = true;
    setStatusTab(st);
  }, [pageWidth, statusPages, statusTab]);


  return (
    <View style={styles.container}>
      {/* Top Header: título (1 línea) + refrescar */}
      <View style={styles.header}>
        <Text style={styles.appTitle} numberOfLines={1} ellipsizeMode="tail">
          Score Viewer Pro
        </Text>

        <View style={styles.headerRightActions}>
          <HtzButton
            variant="secondary"
            size="sm"
            onPress={() => setNotificationsModalVisible(true)}
            accessibilityLabel="Configurar alertas"
            icon={
              <Bell
                size={15}
                color={
                  watchConfig.notifications?.enabled
                    ? htzTokens.colors.primary
                    : htzTokens.colors.onSurface
                }
              />
            }
          />
          <HtzButton
            variant="secondary"
            size="sm"
            onPress={onRefresh}
            disabled={refreshing}
            accessibilityLabel="Actualizar partidos"
            icon={
              refreshing ? (
                <ActivityIndicator size="small" color={htzTokens.colors.primary} />
              ) : (
                <RefreshCw size={15} color={htzTokens.colors.onSurface} />
              )
            }
          />
        </View>
      </View>

      {/* TAB CONTENT: cada pestaña se monta una vez y, cuando no está activa, se
          oculta con display:none. Volver a una pestaña ya visitada es inmediato
          porque no se reconstruye su árbol de vistas. */}
      <View style={styles.tabContent}>
        <View
          style={[
            styles.tabPane,
            (selectedTournament || activeTab !== 'scores') && styles.tabPaneHidden,
          ]}
        >
          <View style={styles.mainScoresContainer}>
          {/* Panel plegable: filtros de deporte, nivel y región. Su fila de título
              integra también la frescura ("hace X" + puntos de fuentes). */}
          <View style={styles.filtersPanel}>
            <TouchableOpacity
              style={styles.filtersPanelHeader}
              onPress={() => setFiltersPanelOpen((open) => !open)}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
            >
              <SlidersHorizontal size={14} color={htzTokens.colors.primary} />
              <Text style={styles.filtersPanelTitle}>Deportes y filtros</Text>
              {activeFiltersCount > 0 && (
                <View style={styles.filterCountBadge}>
                  <Text style={styles.filterCountText}>{activeFiltersCount}</Text>
                </View>
              )}

              {/* Frescura compacta: "hace X" + estado de cada fuente (solo puntos;
                  los nombres quedan en el accessibilityLabel) */}
              {lastUpdatedAt > 0 && (
                <View style={styles.freshnessInline}>
                  <Text style={styles.freshnessText} numberOfLines={1}>
                    {refreshing ? 'Actualizando…' : formatRelativeTime(lastUpdatedAt)}
                  </Text>
                  <View style={styles.sourceStatusList}>
                    {sourceStatus.map((s) => (
                      <View
                        key={s.id}
                        style={styles.sourceStatusItem}
                        accessibilityLabel={`${s.label}: ${describeSource(s)}`}
                      >
                        <View
                          style={[
                            styles.sourceDot,
                            s.state === 'ok'
                              ? styles.sourceDotOk
                              : s.state === 'error'
                              ? styles.sourceDotError
                              : styles.sourceDotSkipped,
                          ]}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {filtersPanelOpen ? (
                <ChevronUp size={16} color={htzTokens.colors.outline} />
              ) : (
                <ChevronDown size={16} color={htzTokens.colors.outline} />
              )}
            </TouchableOpacity>

            {filtersPanelOpen && (
              <View style={styles.filtersSection}>
                {/* Horizontal Sports Selector + Filters Trigger + Active Filter Pills */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.sportsScrollView}
                  contentContainerStyle={styles.sportsScrollContent}
                >
                  {availableSports.map((sport) => (
                    <HtzSportChip
                      key={sport.id}
                      id={sport.id}
                      label={sport.label}
                      selected={sportFilter === sport.id}
                      onPress={() => setSportFilter(sport.id)}
                    />
                  ))}

                  {/* Visual Divider */}
                  <View style={styles.filterDivider} />

                  {/* Competition Filters Modal Trigger Button */}
                  <TouchableOpacity
                    style={[
                      styles.filterTriggerBtn,
                      activeFiltersCount > 0 && styles.filterTriggerBtnActive,
                    ]}
                    onPress={() => setFilterModalVisible(true)}
                    activeOpacity={0.7}
                  >
                    <SlidersHorizontal
                      size={13}
                      color={activeFiltersCount > 0 ? '#ffffff' : htzTokens.colors.primary}
                    />
                    <Text
                      style={[
                        styles.filterTriggerText,
                        activeFiltersCount > 0 && styles.filterTriggerTextActive,
                      ]}
                    >
                      Filtros
                    </Text>
                    {activeFiltersCount > 0 && (
                      <View style={styles.filterCountBadge}>
                        <Text style={styles.filterCountText}>{activeFiltersCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Gestión rápida de deportes habilitados */}
                  <TouchableOpacity
                    style={styles.rowIconBtn}
                    onPress={() => setGamesModalVisible(true)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Gestionar deportes y juegos"
                  >
                    <Gamepad2 size={15} color={htzTokens.colors.primary} />
                  </TouchableOpacity>

                  {/* Removable Active Filter Pills (1-tap clear) */}
                  {tierFilter !== 'TODOS' && (
                    <TouchableOpacity
                      style={styles.activePill}
                      onPress={() => setTierFilter('TODOS')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.activePillLabel}>Nivel: </Text>
                      <Text style={styles.activePillVal}>{getTierShortLabel(tierFilter)}</Text>
                      <View style={styles.activePillClose}>
                        <X size={11} color={htzTokens.colors.outline} />
                      </View>
                    </TouchableOpacity>
                  )}

                  {regionFilter !== 'TODOS' && (
                    <TouchableOpacity
                      style={styles.activePill}
                      onPress={() => setRegionFilter('TODOS')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.activePillLabel}>Región: </Text>
                      <Text style={styles.activePillVal}>{getRegionShortLabel(regionFilter)}</Text>
                      <View style={styles.activePillClose}>
                        <X size={11} color={htzTokens.colors.outline} />
                      </View>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Indicación sutil de lo que hay al deslizar hacia cada lado */}
          <View style={styles.swipeHints}>
            {leftPage ? (
              <TouchableOpacity
                style={styles.swipeHint}
                onPress={() => handleSelectStatusTab(leftPage)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <ChevronLeft size={13} color={htzTokens.colors.outline} />
                <Text style={styles.swipeHintText}>{STATUS_TAB_LABELS[leftPage]}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.swipeHint} />
            )}

            {rightPage ? (
              <TouchableOpacity
                style={styles.swipeHint}
                onPress={() => handleSelectStatusTab(rightPage)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Text style={styles.swipeHintText}>{STATUS_TAB_LABELS[rightPage]}</Text>
                <ChevronRight size={13} color={htzTokens.colors.outline} />
              </TouchableOpacity>
            ) : (
              <View style={styles.swipeHint} />
            )}
          </View>

          {/* Matches List: páginas horizontales (swipe) por estado del partido */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={htzTokens.colors.primary} />
              <Text style={styles.loadingText}>Cargando marcadores en vivo...</Text>
            </View>
          ) : (
            <View
              style={styles.pagerWrap}
              onLayout={(e) => {
                const layout = e?.nativeEvent?.layout;
                if (!layout) return;
                setPagerWidth(layout.width);
                setPagerHeight(layout.height);
              }}
            >
              <ScrollView
                ref={pagerRef}
                horizontal
                snapToInterval={pageWidth}
                disableIntervalMomentum
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={handlePagerScroll}
                onScrollBeginDrag={handlePagerScrollBeginDrag}
                onTouchStart={handlePagerTouchStart}
                onContentSizeChange={syncPagerToActiveTab}
                style={[styles.pagerScroll, Platform.OS === 'web' && WEB_PAGER_SNAP_STYLE]}
              >
                {statusPages.map((st) => {
                  const pageMatches = matchesByStatus[st];
                  // Los partidos de equipos favoritos se muestran en una sección fija
                  // arriba del todo y no se repiten dentro de sus torneos.
                  const pageSections = sectionsByStatus[st];
                  return (
                    <View
                      key={st}
                      style={[
                        styles.pagerPage,
                        { width: pageWidth },
                        pagerHeight > 0 ? { height: pagerHeight } : null,
                        Platform.OS === 'web' && WEB_PAGE_SNAP_STYLE,
                      ]}
                    >
                      <ScrollView
                        style={styles.scoresList}
                        contentContainerStyle={styles.scoresListContent}
                        refreshControl={
                          <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={htzTokens.colors.primary}
                          />
                        }
                      >
                        {pageMatches.length > 0 ? (
                          <>
                            {/* Tira semanal (solo en Próximos y si hay más de un día).
                                Estilo ligero: texto + subrayado del día activo. */}
                            {st === 'UPCOMING' && upcomingDays.length >= 2 && (
                              <View style={styles.weekStripWrap}>
                                <ScrollView
                                  horizontal
                                  showsHorizontalScrollIndicator={false}
                                  contentContainerStyle={styles.weekStrip}
                                >
                                  <TouchableOpacity
                                    style={styles.weekDayBtn}
                                    onPress={() => setWeekDayFilter(null)}
                                    activeOpacity={0.7}
                                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Ver todos los próximos partidos"
                                  >
                                    <Text
                                      style={[
                                        styles.weekDayText,
                                        !effectiveWeekDayFilter && styles.weekDayTextActive,
                                      ]}
                                    >
                                      Todos
                                    </Text>
                                    {!effectiveWeekDayFilter ? (
                                      <View style={styles.weekDayUnderline} />
                                    ) : null}
                                  </TouchableOpacity>
                                  {upcomingDays.map((d) => {
                                    const selected = effectiveWeekDayFilter === d.key;
                                    return (
                                      <TouchableOpacity
                                        key={d.key}
                                        style={styles.weekDayBtn}
                                        onPress={() => setWeekDayFilter(d.key)}
                                        activeOpacity={0.7}
                                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${dayChipLabel(d.date)}: ${d.count} partidos`}
                                      >
                                        <Text
                                          style={[
                                            styles.weekDayText,
                                            selected && styles.weekDayTextActive,
                                          ]}
                                        >
                                          {dayChipLabel(d.date)}
                                          <Text style={styles.weekDayCount}> {d.count}</Text>
                                        </Text>
                                        {selected ? <View style={styles.weekDayUnderline} /> : null}
                                      </TouchableOpacity>
                                    );
                                  })}
                                </ScrollView>
                              </View>
                            )}
                            {pageSections.favorite.length > 0 && (
                              <MemoMatchGroup
                                key="__favorite_teams__"
                                matches={pageSections.favorite}
                                variant="favorites"
                                onSelectMatch={handleSelectMatch}
                              />
                            )}
                            {pageSections.groups.map((group) => (
                              <MemoMatchGroup
                                key={group.key}
                                matches={group.matches}
                                onSelectMatch={handleSelectMatch}
                                onSelectTournament={handleOpenTournamentByLeague}
                              />
                            ))}
                          </>
                        ) : (
                          <View style={styles.emptyContainer}>
                            <Trophy size={42} color={htzTokens.colors.outline} />
                            <Text style={styles.emptyTitle}>{STATUS_EMPTY_TITLES[st]}</Text>
                            <Text style={styles.emptySubtitle}>
                              {STATUS_EMPTY_SUBTITLES[st]}
                            </Text>
                            {tokenHintForSport ? (
                              <Text style={styles.emptyHint}>{tokenHintForSport}</Text>
                            ) : !hasAnyApiToken ? (
                              <Text style={styles.emptyHint}>
                                Configura tus tokens de API (PandaScore / Football-Data) para ver
                                también partidos en línea de tus favoritos.
                              </Text>
                            ) : null}
                            <View style={styles.emptyActionsRow}>
                              {(tierFilter !== 'TODOS' ||
                                regionFilter !== 'TODOS' ||
                                sportFilter !== 'TODOS') && (
                                <HtzButton
                                  variant="secondary"
                                  size="sm"
                                  icon={<RotateCcw size={13} color={htzTokens.colors.onSurface} />}
                                  onPress={() => {
                                    setSportFilter('TODOS');
                                    setTierFilter('TODOS');
                                    setRegionFilter('TODOS');
                                  }}
                                >
                                  Limpiar filtros
                                </HtzButton>
                              )}
                              {!hasAnyApiToken && (
                                <HtzButton
                                  variant="secondary"
                                  size="sm"
                                  icon={<Key size={13} color={htzTokens.colors.onSurface} />}
                                  onPress={() => navigateToTab('api')}
                                >
                                  Configurar APIs
                                </HtzButton>
                              )}
                              <HtzButton
                                variant="primary"
                                size="sm"
                                icon={<Compass size={14} color="#000000" />}
                                onPress={() => navigateToTab('explore')}
                              >
                                Explorar Catálogo
                              </HtzButton>
                            </View>
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
        </View>

        {mountedTabs.tournaments && (
          <View
            style={[
              styles.tabPane,
              (selectedTournament || activeTab !== 'tournaments') && styles.tabPaneHidden,
            ]}
          >
            <MemoTournamentHubView
              favoriteTournaments={watchConfig.favoriteTournaments}
              onToggleTournamentFavorite={handleToggleTournament}
              onSelectTournament={handleSelectTournament}
              enabledGames={watchConfig.enabledGames}
              pandaToken={watchConfig.pandaToken}
              footballToken={watchConfig.footballToken}
            />
          </View>
        )}

        {mountedTabs.explore && (
          <View
            style={[
              styles.tabPane,
              (selectedTournament || activeTab !== 'explore') && styles.tabPaneHidden,
            ]}
          >
            <MemoCatalogExplorerView
              favoriteTournaments={watchConfig.favoriteTournaments}
              favoriteTeams={watchConfig.favoriteTeams}
              onToggleTournament={handleToggleTournament}
              onToggleTeam={handleToggleTeam}
              pandaToken={watchConfig.pandaToken}
              footballToken={watchConfig.footballToken}
              enabledGames={watchConfig.enabledGames}
            />
          </View>
        )}

        {mountedTabs.watch && (
          <View
            style={[
              styles.tabPane,
              (selectedTournament || activeTab !== 'watch') && styles.tabPaneHidden,
            ]}
          >
            <MemoWatchCompanionView
              config={watchConfig}
              onUpdateConfig={handleUpdateConfig}
              onNotify={showToast}
            />
          </View>
        )}

      {/* TAB 4: AJUSTES DE API Y DIAGNÓSTICO */}
      {mountedTabs.api && (
        <View
          style={[
            styles.tabPane,
            (selectedTournament || activeTab !== 'api') && styles.tabPaneHidden,
          ]}
        >
        <ScrollView style={styles.apiScroll} contentContainerStyle={styles.apiContent}>
          <Text style={styles.apiSectionTitle}>Configuración de Conexiones API</Text>
          <Text style={styles.apiSectionDesc}>
            Ingresa y verifica tus claves de API para obtener marcadores oficiales en tiempo real en la app y en tu Amazfit GTR 3.
          </Text>

          {/* PandaScore Card */}
          <HtzCard elevated style={styles.apiCard}>
            <View style={styles.apiHeaderRow}>
              <Text style={styles.apiCardTitle}>PandaScore (Esports)</Text>
              <Text style={styles.apiCardSubtitle}>LoL, CS2, Valorant, R6, Dota 2</Text>
            </View>

            <HtzInput
              label="Token de Acceso PandaScore:"
              value={pandaTokenDraft}
              onChangeText={(val) => {
                setPandaTokenDraft(val);
                setPandaTestResult(null);
              }}
              placeholder="Pega aquí tu clave token de PandaScore"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              secureTextEntry={!showPandaToken}
              rightAccessory={
                <TouchableOpacity
                  onPress={() => setShowPandaToken((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={showPandaToken ? 'Ocultar token de PandaScore' : 'Mostrar token de PandaScore'}
                >
                  {showPandaToken ? (
                    <EyeOff size={16} color={htzTokens.colors.outline} />
                  ) : (
                    <Eye size={16} color={htzTokens.colors.outline} />
                  )}
                </TouchableOpacity>
              }
            />
            <Text style={styles.apiHelp}>
              Obtén tu clave gratuita registrándote en pandascore.co (Plan Hobbyist).
            </Text>

            <View style={styles.testRow}>
              <HtzButton
                variant="secondary"
                size="sm"
                onPress={handleTestPanda}
                disabled={testingPanda}
                icon={
                  testingPanda ? (
                    <ActivityIndicator size="small" color={htzTokens.colors.primary} />
                  ) : (
                    <Wifi size={14} color={htzTokens.colors.onSurface} />
                  )
                }
              >
                {testingPanda ? 'Probando...' : 'Probar Conexión'}
              </HtzButton>

              {pandaTestResult && (
                <View
                  style={[
                    styles.resultBadge,
                    pandaTestResult.success ? styles.resultSuccess : styles.resultError,
                  ]}
                >
                  {pandaTestResult.success ? (
                    <CheckCircle2 size={14} color="#a2cfae" />
                  ) : (
                    <AlertCircle size={14} color={htzTokens.colors.error} />
                  )}
                  <Text
                    style={[
                      styles.resultText,
                      pandaTestResult.success ? styles.resultTextSuccess : styles.resultTextError,
                    ]}
                  >
                    {pandaTestResult.message}
                  </Text>
                </View>
              )}
            </View>
          </HtzCard>

          <View style={{ height: 16 }} />

          {/* Football-Data Card */}
          <HtzCard elevated style={styles.apiCard}>
            <View style={styles.apiHeaderRow}>
              <Text style={styles.apiCardTitle}>Football-Data.org (Fútbol)</Text>
              <Text style={styles.apiCardSubtitle}>LaLiga EA Sports, Champions League, etc.</Text>
            </View>

            <HtzInput
              label="Token Football-Data.org:"
              value={footballTokenDraft}
              onChangeText={(val) => {
                setFootballTokenDraft(val);
                setFootballTestResult(null);
              }}
              placeholder="Pega aquí tu X-Auth-Token de Football-Data"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              secureTextEntry={!showFootballToken}
              rightAccessory={
                <TouchableOpacity
                  onPress={() => setShowFootballToken((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={showFootballToken ? 'Ocultar token de Football-Data' : 'Mostrar token de Football-Data'}
                >
                  {showFootballToken ? (
                    <EyeOff size={16} color={htzTokens.colors.outline} />
                  ) : (
                    <Eye size={16} color={htzTokens.colors.outline} />
                  )}
                </TouchableOpacity>
              }
            />
            <Text style={styles.apiHelp}>
              Obtén tu clave gratuita en football-data.org para marcadores oficiales de fútbol.
            </Text>

            <View style={styles.testRow}>
              <HtzButton
                variant="secondary"
                size="sm"
                onPress={handleTestFootball}
                disabled={testingFootball}
                icon={
                  testingFootball ? (
                    <ActivityIndicator size="small" color={htzTokens.colors.primary} />
                  ) : (
                    <Wifi size={14} color={htzTokens.colors.onSurface} />
                  )
                }
              >
                {testingFootball ? 'Probando...' : 'Probar Conexión'}
              </HtzButton>

              {footballTestResult && (
                <View
                  style={[
                    styles.resultBadge,
                    footballTestResult.success ? styles.resultSuccess : styles.resultError,
                  ]}
                >
                  {footballTestResult.success ? (
                    <CheckCircle2 size={14} color="#a2cfae" />
                  ) : (
                    <AlertCircle size={14} color={htzTokens.colors.error} />
                  )}
                  <Text
                    style={[
                      styles.resultText,
                      footballTestResult.success ? styles.resultTextSuccess : styles.resultTextError,
                    ]}
                  >
                    {footballTestResult.message}
                  </Text>
                </View>
              )}
            </View>
          </HtzCard>

          <View style={{ height: 24 }} />

          {/* Save Button */}
          <HtzButton
            variant="primary"
            size="md"
            accessibilityLabel="Guardar y aplicar claves de API"
            icon={<CheckCircle2 size={18} color="#FFFFFF" />}
            onPress={async () => {
              const nextConfig: Gtr3ConfigState = {
                ...watchConfig,
                pandaToken: pandaTokenDraft.trim(),
                footballToken: footballTokenDraft.trim(),
              };
              configRef.current = nextConfig;
              setWatchConfig(nextConfig);
              setPandaTokenDraft(nextConfig.pandaToken);
              setFootballTokenDraft(nextConfig.footballToken);
              await storage.set('watch_config', nextConfig);
              // Aplicar ya los tokens recién guardados sin esperar al siguiente render.
              loadMatches(true, nextConfig);
              showToast('Claves guardadas. Recargando partidos en vivo...');
              navigateToTab('scores');
            }}
          >
            Guardar y Aplicar Claves
          </HtzButton>
        </ScrollView>
        </View>
      )}

        {selectedTournament && (
          <View style={styles.tabPane}>
            <TournamentDetailView
              tournament={selectedTournament}
              onBack={() => setSelectedTournament(null)}
              isFavorite={ScoreService.isTournamentItemFavorite(
                selectedTournament,
                watchConfig.favoriteTournaments
              )}
              onToggleFavorite={handleToggleTournament}
              pandaToken={watchConfig.pandaToken}
              footballToken={watchConfig.footballToken}
              favoriteTeams={watchConfig.favoriteTeams}
              onSelectMatchExternal={handleSelectMatch}
              feedMatches={matches}
            />
          </View>
        )}
      </View>

      {/* Bottom Navigation Bar (Material 3): pill verde detrás del icono activo */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 0) }]}>
        {BOTTOM_TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <TouchableOpacity
              key={id}
              style={styles.bottomTab}
              activeOpacity={0.7}
              onPress={() => navigateToTab(id)}
            >
              <View style={styles.bottomTabIndicator}>
                {/* Fondo como capa aparte: se monta ya opaco, nunca cambia de
                    color. Evita el bug de Android que pierde el borderRadius al
                    pasar de fondo transparente a opaco (react-native#52415). */}
                {isActive && <View style={styles.bottomTabIndicatorBg} />}
                <Icon
                  size={17}
                  color={isActive ? htzTokens.colors.inversePrimary : htzTokens.colors.outline}
                />
              </View>
              <Text
                style={[styles.bottomTabLabel, isActive && styles.bottomTabLabelActive]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Toast/snackbar global: Alert.alert es un no-op en web, así que las
          confirmaciones se muestran aquí (cross-platform). */}
      {toast && (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={styles.toast}>
            <CheckCircle2 size={15} color={htzTokens.colors.primary} />
            <Text style={styles.toastText} numberOfLines={2}>
              {toast}
            </Text>
          </View>
        </View>
      )}

      {/* Match Detail Modal */}
      {selectedMatch && (
        <MatchDetailModal
          match={selectedMatch}
          visible={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          pandaToken={watchConfig.pandaToken}
          footballToken={watchConfig.footballToken}
          onSelectTournament={handleOpenTournamentByLeague}
        />
      )}

      {/* Game Management Modal */}
      <GameManagementModal
        visible={gamesModalVisible}
        onClose={() => setGamesModalVisible(false)}
        enabledGames={watchConfig.enabledGames}
        onToggleGame={handleToggleGame}
        onSetPreset={handleSetGamePreset}
      />

      {/* Alertas (notificaciones) */}
      <NotificationsModal
        key={notificationsModalVisible ? 'alerts-open' : 'alerts-closed'}
        visible={notificationsModalVisible}
        onClose={() => setNotificationsModalVisible(false)}
        config={watchConfig}
        onUpdateConfig={handleUpdateConfig}
        onNotify={showToast}
      />

      {/* Competition Filters Modal */}
      <CompetitionFiltersModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        tierFilter={tierFilter}
        onSelectTier={(val) => setTierFilter(val)}
        regionFilter={regionFilter}
        onSelectRegion={(val) => setRegionFilter(val)}
        onResetFilters={() => {
          setTierFilter('TODOS');
          setRegionFilter('TODOS');
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: htzTokens.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: htzTokens.colors.surfaceVariant,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appTitle: {
    flex: 1,
    marginHorizontal: 10,
    color: htzTokens.colors.onSurface,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  filtersPanel: {
    marginBottom: 8,
  },
  filtersPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 38,
  },
  filtersPanelTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: htzTokens.colors.onSurfaceVariant,
  },
  swipeHints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    minHeight: 26,
    marginBottom: 6,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 3,
  },
  swipeHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: htzTokens.colors.outline,
  },
  pagerWrap: {
    flex: 1,
  },
  pagerScroll: {
    flex: 1,
  },
  pagerPage: {
    flexShrink: 0,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: htzTokens.colors.surfaceContainer,
    borderTopWidth: 1,
    borderTopColor: htzTokens.colors.surfaceVariant,
  },
  bottomTab: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 2,
    gap: 3,
  },
  bottomTabIndicator: {
    width: 56,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabIndicatorBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 15,
    backgroundColor: 'rgba(74, 124, 89, 0.35)',
  },
  bottomTabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: htzTokens.colors.outline,
    textAlign: 'center',
    flexShrink: 1,
  },
  bottomTabLabelActive: {
    color: htzTokens.colors.onSurface,
    fontWeight: '700',
  },
  toastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 78,
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 30,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: htzTokens.colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(74, 124, 89, 0.45)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '96%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  toastText: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  mainScoresContainer: {
    flex: 1,
  },
  // Contenedor de las pestañas: cada una se queda montada y se oculta con
  // display:none cuando no está activa (cambio de pestaña instantáneo).
  tabContent: {
    flex: 1,
  },
  tabPane: {
    flex: 1,
  },
  tabPaneHidden: {
    display: 'none',
  },
  freshnessInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  freshnessText: {
    color: htzTokens.colors.outline,
    fontSize: 10,
    fontWeight: '600',
  },
  sourceStatusList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  sourceDotOk: {
    backgroundColor: '#4ADE80',
  },
  sourceDotError: {
    backgroundColor: '#F87171',
  },
  sourceDotSkipped: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  weekStripWrap: {
    marginBottom: 8,
  },
  weekStrip: {
    gap: 14,
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  weekDayBtn: {
    paddingVertical: 6,
  },
  weekDayText: {
    color: htzTokens.colors.outline,
    fontSize: 12,
    fontWeight: '700',
  },
  weekDayTextActive: {
    color: htzTokens.colors.primary,
  },
  weekDayCount: {
    color: htzTokens.colors.outline,
    fontSize: 9,
    fontWeight: '600',
  },
  weekDayUnderline: {
    marginTop: 3,
    height: 2,
    borderRadius: 1,
    backgroundColor: htzTokens.colors.primary,
  },
  liveNoticeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(74, 124, 89, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(74, 124, 89, 0.3)',
    paddingVertical: 5,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 6,
    borderRadius: 8,
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: htzTokens.colors.inversePrimary,
  },
  liveNoticeText: {
    color: htzTokens.colors.inversePrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  filtersSection: {
    marginBottom: 8,
  },
  sportsScrollView: {
    flexGrow: 0,
    maxHeight: 36,
    marginTop: 2,
  },
  sportsScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterDivider: {
    width: 1,
    height: 18,
    backgroundColor: htzTokens.colors.outlineVariant,
    marginHorizontal: 3,
  },
  filterTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    height: 30,
    borderRadius: htzTokens.radius.full,
    backgroundColor: htzTokens.colors.surfaceVariant,
    borderWidth: 1,
    borderColor: htzTokens.colors.outlineVariant,
  },
  filterTriggerBtnActive: {
    backgroundColor: 'rgba(74, 124, 89, 0.25)',
    borderColor: htzTokens.colors.primary,
  },
  rowIconBtn: {
    width: 34,
    height: 32,
    borderRadius: htzTokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: htzTokens.colors.surfaceVariant,
    borderWidth: 1,
    borderColor: htzTokens.colors.outlineVariant,
  },
  filterTriggerText: {
    fontSize: 12,
    fontWeight: '600',
    color: htzTokens.colors.onSurface,
  },
  filterTriggerTextActive: {
    color: htzTokens.colors.inversePrimary,
    fontWeight: '700',
  },
  filterCountBadge: {
    backgroundColor: htzTokens.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 6,
    height: 30,
    borderRadius: htzTokens.radius.full,
    backgroundColor: 'rgba(74, 124, 89, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(74, 124, 89, 0.4)',
  },
  activePillLabel: {
    fontSize: 11,
    color: htzTokens.colors.outline,
  },
  activePillVal: {
    fontSize: 11,
    fontWeight: '700',
    color: htzTokens.colors.inversePrimary,
  },
  activePillClose: {
    marginLeft: 3,
    padding: 2,
  },
  scoresList: {
    flex: 1,
  },
  scoresListContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: htzTokens.colors.outline,
    fontSize: 13,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: htzTokens.colors.outline,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  emptyHint: {
    color: htzTokens.colors.primary,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 8,
  },
  apiScroll: {
    flex: 1,
  },
  apiContent: {
    padding: 16,
    paddingBottom: 40,
  },
  apiSectionTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  apiSectionDesc: {
    color: htzTokens.colors.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  apiCard: {
    padding: 16,
  },
  apiHeaderRow: {
    marginBottom: 12,
  },
  apiCardTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 15,
    fontWeight: '700',
  },
  apiCardSubtitle: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    marginTop: 2,
  },
  apiHelp: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    marginTop: 6,
    marginBottom: 12,
  },
  testRow: {
    marginTop: 4,
    gap: 8,
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  resultSuccess: {
    backgroundColor: 'rgba(74, 124, 89, 0.2)',
    borderColor: 'rgba(74, 124, 89, 0.5)',
  },
  resultError: {
    backgroundColor: 'rgba(255, 180, 171, 0.15)',
    borderColor: 'rgba(255, 180, 171, 0.4)',
  },
  resultText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  resultTextSuccess: {
    color: '#a2cfae',
  },
  resultTextError: {
    color: htzTokens.colors.error,
  },
});
