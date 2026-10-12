/**
 * Entrega de notificaciones (Fase 1, sin servidor):
 * - Web: Notification API del navegador (pestaña abierta, aunque esté en segundo plano).
 * - Android/iOS: expo-notifications (notificaciones locales del sistema).
 *
 * En Android cada deporte tiene su propio canal ("Fútbol", "Valorant"...), así
 * el usuario puede silenciar un juego entero desde los ajustes del sistema sin
 * tocar la app. El servidor de push (Fase 2) usa los mismos ids de canal.
 *
 * La Fase 2 (push con la app cerrada) se enchufa aquí sin cambiar al llamador.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SportCategory } from './types';

export type AppNotificationPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/** Canal Android por deporte (ids estables: los usa también el servidor push). */
export const GAME_CHANNELS: { game: SportCategory; id: string; name: string }[] = [
  { game: 'FÚTBOL', id: 'match_football', name: 'Fútbol' },
  { game: 'VALORANT', id: 'match_valorant', name: 'Valorant' },
  { game: 'LOL', id: 'match_lol', name: 'League of Legends' },
  { game: 'CS2', id: 'match_cs2', name: 'Counter-Strike 2' },
  { game: 'R6', id: 'match_r6', name: 'Rainbow Six Siege' },
  { game: 'DOTA2', id: 'match_dota2', name: 'Dota 2' },
];

export const DEFAULT_CHANNEL_ID = 'default';

/** Id del canal Android correspondiente a un deporte (o el genérico). */
export function channelIdForGame(game?: string): string {
  if (!game) return DEFAULT_CHANNEL_ID;
  const normalized = game.toUpperCase().trim();
  const found = GAME_CHANNELS.find((c) => c.game === normalized);
  return found ? found.id : DEFAULT_CHANNEL_ID;
}

let channelReady = false;
let handlerReady = false;

/** En primer plano, Android necesita un handler para mostrar la notificación. */
function ensureHandler() {
  if (Platform.OS === 'web' || handlerReady) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    handlerReady = true;
  } catch (err) {
    console.warn('No se pudo configurar el handler de notificaciones:', err);
  }
}

/** Crea el grupo "Partidos" y un canal por deporte en Android. */
async function ensureAndroidChannels() {
  if (Platform.OS !== 'android' || channelReady) return;
  try {
    await Notifications.setNotificationChannelGroupAsync('matches', { name: 'Partidos' });

    const channelInput = {
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4A7C59',
      sound: 'default',
      showBadge: true,
      enableVibrate: true,
      enableLights: true,
    };

    for (const channel of GAME_CHANNELS) {
      await Notifications.setNotificationChannelAsync(channel.id, {
        ...channelInput,
        name: channel.name,
        description: `Avisos de partidos de ${channel.name}`,
        groupId: 'matches',
      });
    }

    // Canal genérico (pruebas, recordatorios sin deporte conocido).
    await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
      ...channelInput,
      name: 'Alertas de partidos',
      groupId: 'matches',
    });
    channelReady = true;
  } catch (err) {
    console.warn('No se pudieron crear los canales de notificaciones:', err);
  }
}

export interface NotifyOptions {
  /** Deporte del aviso: elige el canal Android correspondiente. */
  game?: string;
}

export const AppNotifications = {
  isSupported(): boolean {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' && 'Notification' in window;
    }
    return true;
  },

  /** Crea (una vez) los canales Android; se llama al arrancar la app. */
  async ensureChannels(): Promise<void> {
    await ensureAndroidChannels();
  },

  async getPermission(): Promise<AppNotificationPermission> {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
      const p = window.Notification.permission;
      return p === 'default' ? 'undetermined' : (p as AppNotificationPermission);
    }
    try {
      const settings = await Notifications.getPermissionsAsync();
      if (settings.granted) return 'granted';
      return settings.canAskAgain ? 'undetermined' : 'denied';
    } catch {
      return 'unsupported';
    }
  },

  async requestPermission(): Promise<AppNotificationPermission> {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
      try {
        const p = await window.Notification.requestPermission();
        return p === 'default' ? 'undetermined' : (p as AppNotificationPermission);
      } catch {
        return 'denied';
      }
    }
    try {
      const settings = await Notifications.requestPermissionsAsync();
      return settings.granted ? 'granted' : 'denied';
    } catch {
      return 'unsupported';
    }
  },

  /** Notificación inmediata. Devuelve true si se entregó al sistema. */
  async notify(
    title: string,
    body: string,
    tag?: string,
    options?: NotifyOptions
  ): Promise<boolean> {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !('Notification' in window)) return false;
      if (window.Notification.permission !== 'granted') return false;
      try {
        new window.Notification(title, { body, tag });
        return true;
      } catch (err) {
        console.warn('No se pudo mostrar la notificación web:', err);
        return false;
      }
    }
    try {
      ensureHandler();
      await ensureAndroidChannels();
      await Notifications.scheduleNotificationAsync({
        identifier: tag,
        content: {
          title,
          body,
          color: '#4A7C59',
        },
        // En Android, un trigger solo con channelId muestra la notificación al
        // instante en ese canal; en iOS se usa el trigger inmediato estándar.
        trigger: Platform.OS === 'android' ? { channelId: channelIdForGame(options?.game) } : null,
      });
      return true;
    } catch (err) {
      console.warn('No se pudo mostrar la notificación nativa:', err);
      return false;
    }
  },

  /** Programa una notificación a una hora concreta (solo nativo). */
  async scheduleAt(
    identifier: string,
    date: Date,
    title: string,
    body: string,
    options?: NotifyOptions
  ): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      ensureHandler();
      await ensureAndroidChannels();
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title,
          body,
          color: '#4A7C59',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          ...(Platform.OS === 'android' ? { channelId: channelIdForGame(options?.game) } : {}),
        },
      });
      return true;
    } catch (err) {
      console.warn('No se pudo programar el recordatorio:', err);
      return false;
    }
  },

  async cancelScheduled(identifier: string): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
    } catch {
      // El identificador ya no existe: nada que cancelar
    }
  },

  async getScheduledIdentifiers(): Promise<string[]> {
    if (Platform.OS === 'web') return [];
    try {
      const list = await Notifications.getAllScheduledNotificationsAsync();
      return list.map((n) => n.identifier);
    } catch {
      return [];
    }
  },
};
