/**
 * Entrega de notificaciones (Fase 1, sin servidor):
 * - Web: Notification API del navegador (pestaña abierta, aunque esté en segundo plano).
 * - Android/iOS: expo-notifications (notificaciones locales del sistema).
 *
 * La Fase 2 (push con la app cerrada) se enchufará aquí sin cambiar al llamador.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export type AppNotificationPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

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

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android' || channelReady) return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Alertas de partidos',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4A7C59',
    });
    channelReady = true;
  } catch (err) {
    console.warn('No se pudo crear el canal de notificaciones:', err);
  }
}

export const AppNotifications = {
  isSupported(): boolean {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' && 'Notification' in window;
    }
    return true;
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
  async notify(title: string, body: string, tag?: string): Promise<boolean> {
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
      await ensureAndroidChannel();
      await Notifications.scheduleNotificationAsync({
        identifier: tag,
        content: { title, body },
        trigger: null,
      });
      return true;
    } catch (err) {
      console.warn('No se pudo mostrar la notificación nativa:', err);
      return false;
    }
  },

  /** Programa una notificación a una hora concreta (solo nativo). */
  async scheduleAt(identifier: string, date: Date, title: string, body: string): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      ensureHandler();
      await ensureAndroidChannel();
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: { title, body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
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
