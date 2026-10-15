import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  X,
  CloudUpload,
  Search,
} from 'lucide-react-native';
import {
  Gtr3ConfigState,
  NotificationEventKey,
  NotificationEventOverride,
  NotificationEventPrefs,
  NotificationSettings,
} from '../services/types';
import { AppNotifications, AppNotificationPermission } from '../services/notificationService';
import {
  ALL_EVENT_KEYS,
  DEFAULT_NOTIFICATION_SETTINGS,
  ESPORTS_EVENT_KEYS,
  FOOTBALL_EVENT_KEYS,
  NOTIFICATION_EVENT_LABELS,
  NOTIFICATION_EVENT_PRESETS,
  FavoriteGroup,
  groupFavoriteTeams,
  groupFavoriteTournaments,
  resolveTeamGame,
} from '../services/notificationEngine';
import { HtzButton, HtzCard, HtzChip, HtzInput, HtzToggle } from './htz';
import { htzTokens } from './htz/tokens';
import { PushService, PushServerStatus } from '../services/pushService';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  config: Gtr3ConfigState;
  onUpdateConfig: (next: Gtr3ConfigState) => void;
  /** Toast de la app para feedback (permiso, prueba, etc.). */
  onNotify: (message: string) => void;
}

const PERMISSION_TEXT: Record<AppNotificationPermission, string> = {
  granted: 'Permiso concedido',
  denied: 'Permiso denegado — actívalo en los ajustes del navegador/sistema',
  undetermined: 'Permiso sin conceder',
  unsupported: 'Este navegador no soporta notificaciones del sistema',
};

/** "hace X" compacto para el estado del servidor. */
function formatAgo(ts?: number): string {
  if (!ts) return 'sin datos';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'hace unos segundos';
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `hace ${min} min`;
  const hours = Math.floor(min / 60);
  return `hace ${hours} h`;
}

function eventKeysForGroup(group: FavoriteGroup): NotificationEventKey[] {
  if (group.game === 'FÚTBOL') return FOOTBALL_EVENT_KEYS;
  if (group.game) return ESPORTS_EVENT_KEYS;
  return [...FOOTBALL_EVENT_KEYS, ...ESPORTS_EVENT_KEYS];
}

/** ¿El favorito tiene personalizaciones (aparte del interruptor general)? */
function hasEventOverrides(override?: NotificationEventOverride): boolean {
  if (!override) return false;
  return ALL_EVENT_KEYS.some((k) => typeof override[k] === 'boolean');
}

function sameEvents(a: NotificationEventPrefs, b: NotificationEventPrefs): boolean {
  return ALL_EVENT_KEYS.every((k) => a[k] === b[k]);
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  visible,
  onClose,
  config,
  onUpdateConfig,
  onNotify,
}) => {
  const settings: NotificationSettings = config.notifications ?? DEFAULT_NOTIFICATION_SETTINGS;
  const [permission, setPermission] = useState<AppNotificationPermission>('undetermined');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [teamQuery, setTeamQuery] = useState('');
  const [tournamentQuery, setTournamentQuery] = useState('');
  // Fase 2: push con la app cerrada
  const [pushUrlDraft, setPushUrlDraft] = useState(settings.push?.serverUrl ?? '');
  const [pushKeyDraft, setPushKeyDraft] = useState(settings.push?.authKey ?? '');
  const [pushBusy, setPushBusy] = useState(false);
  const [serverStatus, setServerStatus] = useState<PushServerStatus | null>(null);
  const pushSupported = PushService.isSupported();

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const p = await AppNotifications.getPermission();
      if (cancelled) return;
      setPermission(p);
      // Estado del servidor de push (si está conectado), solo tras el primer await.
      if (config.notifications?.push?.connected) {
        const status = await PushService.fetchStatus(config);
        if (!cancelled) setServerStatus(status);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const update = (next: NotificationSettings) => onUpdateConfig({ ...config, notifications: next });

  const setMaster = (v: boolean) => update({ ...settings, enabled: v });
  const setEvent = (key: NotificationEventKey, v: boolean) =>
    update({ ...settings, events: { ...settings.events, [key]: v } });
  const setReminderMinutes = (mins: number) => update({ ...settings, reminderMinutes: mins });
  const applyPreset = (events: NotificationEventPrefs) => update({ ...settings, events });

  const setOverride = (
    scope: 'teams' | 'tournaments',
    key: string,
    next: NotificationEventOverride | null
  ) => {
    const bucket = { ...settings[scope] };
    if (next === null || Object.keys(next).length === 0) delete bucket[key];
    else bucket[key] = next;
    update({ ...settings, [scope]: bucket });
  };

  /** Interruptor rápido: apaga/enciende TODAS las alertas de un favorito. */
  const setFavoriteEnabled = (scope: 'teams' | 'tournaments', key: string, enabled: boolean) => {
    const current = settings[scope][key];
    if (enabled) {
      if (!current) return;
      const { enabled: _ignored, ...rest } = current;
      setOverride(scope, key, Object.keys(rest).length > 0 ? rest : null);
    } else {
      setOverride(scope, key, { ...(current ?? {}), enabled: false });
    }
  };

  /** Acciones masivas de una sección ("Reactivar"/"Silenciar"). */
  const setBulkEnabled = (scope: 'teams' | 'tournaments', groups: FavoriteGroup[], enabled: boolean) => {
    const bucket = { ...settings[scope] };
    for (const g of groups) {
      const current = bucket[g.key];
      if (enabled) {
        if (!current) continue;
        const { enabled: _ignored, ...rest } = current;
        if (Object.keys(rest).length === 0) delete bucket[g.key];
        else bucket[g.key] = rest;
      } else {
        bucket[g.key] = { ...(current ?? {}), enabled: false };
      }
    }
    update({ ...settings, [scope]: bucket });
  };

  const requestPermission = async () => {
    const p = await AppNotifications.requestPermission();
    setPermission(p);
    if (p === 'granted') onNotify('Notificaciones activadas');
    else if (p === 'denied') onNotify('Permiso denegado: revisa los ajustes del navegador/sistema');
  };

  const testNotification = async () => {
    setTesting(true);
    const ok = await AppNotifications.notify(
      'Prueba de alerta',
      'Si ves esto, las notificaciones funcionan correctamente.',
      'test-alert'
    );
    setTesting(false);
    if (!ok) onNotify('No se pudo mostrar: revisa el permiso de notificaciones');
  };

  /** Fase 2: conecta este dispositivo al servidor de push. */
  const connectPush = async () => {
    const url = pushUrlDraft.trim();
    const key = pushKeyDraft.trim();
    if (!url || !key) {
      onNotify('Rellena la URL del servidor y la clave');
      return;
    }
    setPushBusy(true);
    try {
      const deviceToken = await PushService.getDevicePushToken();
      if (!deviceToken) {
        onNotify('No se pudo obtener el token push (necesitas la app Android con FCM configurado)');
        return;
      }
      const next: NotificationSettings = {
        ...settings,
        push: { serverUrl: url, authKey: key, connected: true, deviceToken },
      };
      const res = await PushService.pushConfig({ ...config, notifications: next }, deviceToken);
      if (!res.ok) {
        onNotify(`No se pudo conectar: ${res.error}`);
        return;
      }
      onUpdateConfig({ ...config, notifications: next });
      onNotify('Push conectado: los avisos llegarán con la app cerrada');
      const status = await PushService.fetchStatus({ ...config, notifications: next });
      setServerStatus(status);
    } finally {
      setPushBusy(false);
    }
  };

  /** Fase 2: desconecta este dispositivo del servidor. */
  const disconnectPush = async () => {
    setPushBusy(true);
    try {
      await PushService.removeDevice(config);
      onUpdateConfig({
        ...config,
        notifications: {
          ...settings,
          push: {
            serverUrl: pushUrlDraft.trim(),
            authKey: pushKeyDraft.trim(),
            connected: false,
          },
        },
      });
      setServerStatus(null);
      onNotify('Push desconectado');
    } finally {
      setPushBusy(false);
    }
  };

  /** Fase 2: prueba de extremo a extremo desde el servidor. */
  const testPush = async () => {
    setPushBusy(true);
    try {
      await PushService.pushConfig(config); // asegura que el servidor tiene la config fresca
      const res = await PushService.sendTest(config);
      if (res.ok) onNotify('Prueba enviada desde el servidor');
      else onNotify(`No se pudo probar: ${res.error}`);
    } finally {
      setPushBusy(false);
    }
  };

  const renderEventToggle = (
    key: NotificationEventKey,
    value: boolean,
    onChange: (v: boolean) => void
  ) => (
    <View key={key} style={styles.toggleRow}>
      <HtzToggle label={NOTIFICATION_EVENT_LABELS[key]} checked={value} onChange={onChange} />
    </View>
  );

  const renderFavoriteGroup = (group: FavoriteGroup, scope: 'teams' | 'tournaments') => {
    const override = settings[scope][group.key];
    const isMuted = override?.enabled === false;
    const hasCustom = hasEventOverrides(override);
    const expanded = expandedKey === `${scope}:${group.key}`;
    const game = scope === 'teams' ? group.game ?? resolveTeamGame(group.label) : group.game;
    const statusLabel = isMuted ? 'Silenciado' : hasCustom ? 'Personalizado' : 'General';

    /** Elimina por completo este favorito (todas sus variantes guardadas). */
    const removeFavorite = () => {
      const isMember = (value: string) =>
        group.members.some((m) => m.toLowerCase().trim() === value.toLowerCase().trim());
      if (scope === 'teams') {
        const nextTeams = (config.favoriteTeams || []).filter((t) => !isMember(t));
        const nextOverrides = { ...settings.teams };
        delete nextOverrides[group.key];
        onUpdateConfig({
          ...config,
          favoriteTeams: nextTeams,
          notifications: { ...settings, teams: nextOverrides },
        });
      } else {
        const nextTournaments = (config.favoriteTournaments || []).filter((t) => !isMember(t));
        const nextOverrides = { ...settings.tournaments };
        delete nextOverrides[group.key];
        onUpdateConfig({
          ...config,
          favoriteTournaments: nextTournaments,
          notifications: { ...settings, tournaments: nextOverrides },
        });
      }
      onNotify(`${group.label} eliminado de favoritos`);
    };

    return (
      <View key={`${scope}:${group.key}`} style={styles.favBlock}>
        <View style={styles.favRow}>
          <TouchableOpacity
            style={styles.favRowMain}
            onPress={() => setExpandedKey(expanded ? null : `${scope}:${group.key}`)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Alertas de ${group.label}`}
          >
            <Text style={[styles.favLabel, isMuted && styles.favLabelMuted]} numberOfLines={1}>
              {group.label}
            </Text>
            <Text
              style={[
                styles.favStatus,
                hasCustom && !isMuted && styles.favStatusCustom,
                isMuted && styles.favStatusMuted,
              ]}
            >
              {statusLabel}
            </Text>
            {expanded ? (
              <ChevronUp size={15} color={htzTokens.colors.outline} />
            ) : (
              <ChevronDown size={15} color={htzTokens.colors.outline} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.favRemoveBtn}
            onPress={removeFavorite}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Quitar ${group.label} de favoritos`}
          >
            <X size={16} color={htzTokens.colors.outline} />
          </TouchableOpacity>
          <Switch
            style={styles.favSwitch}
            trackColor={{
              false: htzTokens.colors.surfaceVariant,
              true: htzTokens.colors.primary,
            }}
            thumbColor="#FFFFFF"
            value={!isMuted}
            onValueChange={(v) => setFavoriteEnabled(scope, group.key, v)}
            accessibilityLabel={
              isMuted ? `Activar alertas de ${group.label}` : `Silenciar alertas de ${group.label}`
            }
          />
        </View>

        {expanded && (
          <View style={styles.favMatrix}>
            {isMuted ? (
              <Text style={styles.mutedHint}>
                Alertas silenciadas para este favorito. Activa el interruptor para elegir qué avisos
                quieres.
              </Text>
            ) : (
              <>
                {eventKeysForGroup({ ...group, game }).map((key) =>
                  renderEventToggle(key, override?.[key] ?? settings.events[key], (v) =>
                    setOverride(scope, group.key, { ...(override ?? {}), [key]: v })
                  )
                )}
                {renderEventToggle('reminder', override?.reminder ?? settings.events.reminder, (v) =>
                  setOverride(scope, group.key, { ...(override ?? {}), reminder: v })
                )}
              </>
            )}
            {hasCustom && (
              <TouchableOpacity
                style={styles.resetRow}
                onPress={() => setOverride(scope, group.key, null)}
                accessibilityRole="button"
                accessibilityLabel={`Usar valores generales para ${group.label}`}
              >
                <RotateCcw size={12} color={htzTokens.colors.primary} />
                <Text style={styles.resetText}>Usar valores generales</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const teamGroups = useMemo(() => groupFavoriteTeams(config.favoriteTeams), [config.favoriteTeams]);
  const tournamentGroups = useMemo(
    () => groupFavoriteTournaments(config.favoriteTournaments),
    [config.favoriteTournaments]
  );
  const filteredTeams = useMemo(() => {
    const q = teamQuery.trim().toLowerCase();
    return q ? teamGroups.filter((g) => g.label.toLowerCase().includes(q)) : teamGroups;
  }, [teamGroups, teamQuery]);
  const filteredTournaments = useMemo(() => {
    const q = tournamentQuery.trim().toLowerCase();
    return q
      ? tournamentGroups.filter((g) => g.label.toLowerCase().includes(q))
      : tournamentGroups;
  }, [tournamentGroups, tournamentQuery]);
  const mutedTeams = filteredTeams.filter((g) => settings.teams[g.key]?.enabled === false).length;
  const mutedTournaments = filteredTournaments.filter(
    (g) => settings.tournaments[g.key]?.enabled === false
  ).length;

  const renderFavoritesSection = (
    title: string,
    scope: 'teams' | 'tournaments',
    groups: FavoriteGroup[],
    filtered: FavoriteGroup[],
    query: string,
    setQuery: (v: string) => void,
    mutedCount: number
  ) => (
    <>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>{title}</Text>
        <View style={styles.sectionActions}>
          <HtzButton
            variant="ghost"
            size="sm"
            onPress={() => setBulkEnabled(scope, filtered, true)}
            textStyle={styles.bulkText}
          >
            Reactivar
          </HtzButton>
          <Text style={styles.bulkSeparator}>·</Text>
          <HtzButton
            variant="ghost"
            size="sm"
            onPress={() => setBulkEnabled(scope, filtered, false)}
            textStyle={styles.bulkText}
          >
            Silenciar
          </HtzButton>
        </View>
      </View>
      <HtzCard style={styles.card}>
        {groups.length === 0 ? (
          <Text style={styles.emptyText}>No tienes {title.toLowerCase()} todavía.</Text>
        ) : (
          <>
            {groups.length > 6 && (
              <HtzInput
                placeholder="Buscar…"
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                icon={<Search size={14} color={htzTokens.colors.outline} />}
                containerStyle={styles.searchInput}
              />
            )}
            {mutedCount > 0 && (
              <Text style={styles.mutedSummary}>
                {mutedCount} silenciado{mutedCount === 1 ? '' : 's'}
              </Text>
            )}
            {filtered.length === 0 ? (
              <Text style={styles.emptyText}>Sin resultados para «{query}».</Text>
            ) : (
              filtered.map((g) => renderFavoriteGroup(g, scope))
            )}
          </>
        )}
      </HtzCard>
    </>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* El modal vive en su propia ventana nativa: se necesita un SafeAreaProvider
          propio para que los insets sean los de esa ventana y la cabecera no quede
          bajo la barra de estado en Android. */}
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            {/* Cabecera */}
            <View style={styles.topHeader}>
              <View style={styles.titleRow}>
                <Bell size={18} color={htzTokens.colors.primary} />
                <Text style={styles.title}>Alertas</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <X size={20} color={htzTokens.colors.outline} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              {/* Permiso + prueba */}
              <HtzCard style={styles.card}>
                <View style={styles.permissionRow}>
                  {permission === 'granted' ? (
                    <Bell size={16} color={htzTokens.colors.primary} />
                  ) : (
                    <BellOff size={16} color={htzTokens.colors.outline} />
                  )}
                  <Text style={styles.permissionText}>{PERMISSION_TEXT[permission]}</Text>
                </View>
                <View style={styles.actionsRow}>
                  {permission !== 'granted' && permission !== 'unsupported' && (
                    <HtzButton variant="primary" size="sm" onPress={requestPermission}>
                      Permitir notificaciones
                    </HtzButton>
                  )}
                  <HtzButton
                    variant="secondary"
                    size="sm"
                    onPress={testNotification}
                    disabled={testing}
                  >
                    {testing ? 'Probando…' : 'Probar notificación'}
                  </HtzButton>
                </View>
                <Text style={styles.hint}>
                  En web funcionan con la pestaña abierta (aunque esté en segundo plano). En Android,
                  los recordatorios programados llegan incluso con la app cerrada.
                </Text>
              </HtzCard>

              {/* Interruptor maestro */}
              <HtzCard style={styles.card}>
                <HtzToggle
                  label="Notificaciones activadas"
                  sublabel="Apágalas para silenciarlo todo sin perder tu configuración"
                  checked={settings.enabled}
                  onChange={setMaster}
                />
              </HtzCard>

              {/* Eventos generales */}
              <Text style={styles.sectionHeader}>Eventos generales</Text>
              <HtzCard style={styles.card}>
                <View style={styles.presetsRow}>
                  {NOTIFICATION_EVENT_PRESETS.map((preset) => (
                    <HtzChip
                      key={preset.id}
                      label={preset.label}
                      selected={sameEvents(settings.events, preset.events)}
                      onPress={() => applyPreset(preset.events)}
                    />
                  ))}
                </View>
                <Text style={styles.presetsHint}>
                  Los presets rellenan la matriz general; luego puedes afinar torneo a torneo.
                </Text>
                <Text style={styles.groupLabel}>Fútbol</Text>
                {FOOTBALL_EVENT_KEYS.map((key) =>
                  renderEventToggle(key, settings.events[key], (v) => setEvent(key, v))
                )}
                <Text style={[styles.groupLabel, styles.groupLabelSpaced]}>Esports</Text>
                {ESPORTS_EVENT_KEYS.map((key) =>
                  renderEventToggle(key, settings.events[key], (v) => setEvent(key, v))
                )}
                <View style={styles.toggleRow}>
                  <Text style={styles.minutesLabel}>Recordatorio previo</Text>
                  <View style={styles.minutesChips}>
                    {[5, 15, 30].map((mins) => (
                      <HtzChip
                        key={mins}
                        label={`${mins} min`}
                        selected={settings.reminderMinutes === mins}
                        onPress={() => setReminderMinutes(mins)}
                      />
                    ))}
                  </View>
                </View>
              </HtzCard>

              {/* Matriz por favorito: interruptor rápido + búsqueda + acciones masivas */}
              {renderFavoritesSection(
                'Tus torneos favoritos',
                'tournaments',
                tournamentGroups,
                filteredTournaments,
                tournamentQuery,
                setTournamentQuery,
                mutedTournaments
              )}

              {renderFavoritesSection(
                'Tus equipos favoritos',
                'teams',
                teamGroups,
                filteredTeams,
                teamQuery,
                setTeamQuery,
                mutedTeams
              )}

              {/* Fase 2: push con la app cerrada */}
              <Text style={styles.sectionHeader}>Push con la app cerrada (Fase 2)</Text>
              <HtzCard style={styles.card}>
                {!pushSupported ? (
                  <Text style={styles.hint}>
                    Solo disponible en la app Android. En web, las alertas funcionan con la
                    pestaña abierta (Fase 1).
                  </Text>
                ) : settings.push?.connected ? (
                  <>
                    <View style={styles.permissionRow}>
                      <CloudUpload size={16} color={htzTokens.colors.primary} />
                      <Text style={styles.permissionText}>
                        Conectado a {settings.push.serverUrl}
                      </Text>
                    </View>
                    {serverStatus ? (
                      serverStatus.ok ? (
                        <Text style={styles.serverStatusText}>
                          Servidor OK · última pasada {formatAgo(serverStatus.lastRunAt)} ·{' '}
                          {serverStatus.devices ?? 0} dispositivo(s)
                          {serverStatus.lastError ? `\nÚltimo error: ${serverStatus.lastError}` : ''}
                        </Text>
                      ) : (
                        <Text style={styles.serverStatusText}>
                          No se pudo consultar el servidor: {serverStatus.error}
                        </Text>
                      )
                    ) : (
                      <Text style={styles.serverStatusText}>Consultando estado…</Text>
                    )}
                    <View style={styles.actionsRow}>
                      <HtzButton variant="secondary" size="sm" onPress={testPush} disabled={pushBusy}>
                        {pushBusy ? 'Enviando…' : 'Enviar prueba'}
                      </HtzButton>
                      <HtzButton
                        variant="secondary"
                        size="sm"
                        onPress={disconnectPush}
                        disabled={pushBusy}
                      >
                        Desconectar
                      </HtzButton>
                    </View>
                    <Text style={styles.hint}>
                      Con el push conectado, el servidor envía los avisos (incluso con la app
                      cerrada) y la app deja de duplicarlos. Respeta tus juegos activos y la matriz
                      de alertas: un torneo silenciado tampoco avisa desde el servidor.
                    </Text>
                  </>
                ) : (
                  <>
                    <HtzInput
                      label="URL del servidor"
                      placeholder="https://score-viewer-push.xxx.workers.dev"
                      value={pushUrlDraft}
                      onChangeText={setPushUrlDraft}
                      autoCapitalize="none"
                      autoCorrect={false}
                      spellCheck={false}
                    />
                    <HtzInput
                      label="Clave del servidor (AUTH_KEY)"
                      placeholder="tu clave secreta"
                      value={pushKeyDraft}
                      onChangeText={setPushKeyDraft}
                      autoCapitalize="none"
                      autoCorrect={false}
                      spellCheck={false}
                      secureTextEntry
                    />
                    <HtzButton variant="primary" size="sm" onPress={connectPush} disabled={pushBusy}>
                      {pushBusy ? 'Conectando…' : 'Conectar'}
                    </HtzButton>
                    <Text style={styles.hint}>
                      Despliega el servidor incluido en el proyecto (carpeta push-server, gratis en
                      Cloudflare) y pega aquí su URL y clave. Después, los avisos llegan con la app
                      cerrada.
                    </Text>
                  </>
                )}
                <Text style={styles.hint}>
                  Consejo: en Android cada juego tiene su propio canal (Fútbol, Valorant, LoL, CS2,
                  R6, Dota 2). Puedes silenciar un juego entero desde los ajustes de notificaciones
                  del sistema.
                </Text>
              </HtzCard>

              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: htzTokens.colors.outlineVariant,
    backgroundColor: htzTokens.colors.surface,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: htzTokens.colors.onSurface,
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
  },
  card: {
    padding: 14,
    marginBottom: 12,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  permissionText: {
    flex: 1,
    color: htzTokens.colors.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  hint: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
  },
  serverStatusText: {
    color: htzTokens.colors.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  sectionHeader: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bulkText: {
    color: htzTokens.colors.inversePrimary,
    fontSize: 11,
  },
  bulkSeparator: {
    color: htzTokens.colors.outline,
    fontSize: 12,
    marginHorizontal: 2,
  },
  groupLabel: {
    color: htzTokens.colors.outline,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  groupLabelSpaced: {
    marginTop: 10,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  presetsHint: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6,
    marginBottom: 10,
  },
  toggleRow: {
    paddingVertical: 2,
  },
  minutesLabel: {
    color: htzTokens.colors.onSurface,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  minutesChips: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    marginBottom: 6,
  },
  mutedSummary: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  favBlock: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  favRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  favRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  favSwitch: {
    marginLeft: 2,
  },
  favRemoveBtn: {
    padding: 4,
  },
  favLabel: {
    flex: 1,
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '600',
  },
  favLabelMuted: {
    color: htzTokens.colors.outline,
  },
  favStatus: {
    color: htzTokens.colors.outline,
    fontSize: 10,
    fontWeight: '700',
  },
  favStatusCustom: {
    color: htzTokens.colors.primary,
  },
  favStatusMuted: {
    color: htzTokens.colors.warning,
  },
  favMatrix: {
    paddingLeft: 8,
    paddingBottom: 8,
  },
  mutedHint: {
    color: htzTokens.colors.outline,
    fontSize: 12,
    lineHeight: 17,
    paddingVertical: 4,
  },
  resetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  resetText: {
    color: htzTokens.colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    color: htzTokens.colors.outline,
    fontSize: 12,
  },
});
