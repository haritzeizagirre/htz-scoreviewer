/**
 * Cliente del servidor de push (Fase 2): registra el dispositivo, sube la
 * configuración de alertas (tokens, favoritos y matriz de eventos) y consulta
 * el estado. El servidor se encarga de enviar los avisos con la app cerrada.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Gtr3ConfigState } from './types';
import { groupFavoriteTeams, groupFavoriteTournaments } from './notificationEngine';

/** Project ID de EAS del proyecto (app.json → extra.eas.projectId). */
const EAS_PROJECT_ID = '97f5e3bc-b920-4d46-8dd8-11ef5be3543d';

export interface PushRequestResult {
  ok: boolean;
  error?: string;
  devices?: number;
}

export interface PushServerStatus {
  ok: boolean;
  error?: string;
  configured?: boolean;
  enabled?: boolean;
  devices?: number;
  lastRunAt?: number;
  lastRunSummary?: string;
  lastError?: string | null;
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function authHeaders(authKey: string): Record<string, string> {
  return { 'content-type': 'application/json', 'x-auth-key': authKey };
}

export const PushService = {
  /** El push con la app cerrada solo existe en la app nativa (Android). */
  isSupported(): boolean {
    return Platform.OS !== 'web';
  },

  /** Obtiene (pidiendo permiso si hace falta) el token Expo Push del dispositivo. */
  async getDevicePushToken(): Promise<string | null> {
    if (Platform.OS === 'web') return null;
    try {
      const current = await Notifications.getPermissionsAsync();
      if (!current.granted) {
        const asked = await Notifications.requestPermissionsAsync();
        if (!asked.granted) return null;
      }
      const token = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
      return token?.data || null;
    } catch (err) {
      console.warn('No se pudo obtener el token push:', err);
      return null;
    }
  },

  /** Payload que sube la app: tokens, favoritos (patrones) y matriz de eventos. */
  buildPayload(config: Gtr3ConfigState, deviceToken?: string) {
    const settings = config.notifications;
    if (!settings) return null;

    const unique = (values: (string | undefined)[]) =>
      [...new Set(values.filter((v): v is string => Boolean(v && v.trim())))];

    // Palabras demasiado genéricas como para usarlas solas como patrón.
    const GENERIC = new Set([
      'champions',
      'masters',
      'major',
      'league',
      'cup',
      'series',
      'open',
      'final',
      'finals',
      'playoffs',
      'pro',
    ]);
    const safePattern = (value?: string) => {
      const v = (value || '').trim();
      if (!v) return undefined;
      return GENERIC.has(v.toLowerCase()) ? undefined : v;
    };

    return {
      settings: {
        enabled: settings.enabled,
        events: settings.events,
        teams: settings.teams,
        tournaments: settings.tournaments,
        reminderMinutes: settings.reminderMinutes,
      },
      teamFavorites: groupFavoriteTeams(config.favoriteTeams).map((g) => ({
        key: g.key,
        game: g.game,
        patterns: unique([...g.members, g.label]),
      })),
      tournamentFavorites: groupFavoriteTournaments(config.favoriteTournaments).map((g) => ({
        key: g.key,
        game: g.game,
        patterns: unique([
          ...g.members,
          g.label,
          g.key,
          safePattern(g.shortName),
          safePattern(g.slug),
        ]),
      })),
      pandaToken: config.pandaToken,
      footballToken: config.footballToken,
      ...(deviceToken ? { deviceToken } : {}),
    };
  },

  /** Sube la configuración al servidor (y registra el dispositivo si se pasa). */
  async pushConfig(config: Gtr3ConfigState, deviceToken?: string): Promise<PushRequestResult> {
    const push = config.notifications?.push;
    if (!push?.serverUrl || !push?.authKey) return { ok: false, error: 'servidor sin configurar' };

    const payload = this.buildPayload(config, deviceToken);
    if (!payload) return { ok: false, error: 'sin configuración de alertas' };

    try {
      const res = await fetch(`${normalizeUrl(push.serverUrl)}/config`, {
        method: 'PUT',
        headers: authHeaders(push.authKey),
        body: JSON.stringify(payload),
      });
      const json: any = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, error: json?.error || `HTTP ${res.status}` };
      return { ok: true, devices: json?.devices };
    } catch (err) {
      return { ok: false, error: String(err).slice(0, 140) };
    }
  },

  /** Elimina este dispositivo del servidor. */
  async removeDevice(config: Gtr3ConfigState): Promise<PushRequestResult> {
    const push = config.notifications?.push;
    if (!push?.serverUrl || !push?.authKey) return { ok: false, error: 'servidor sin configurar' };
    try {
      const res = await fetch(`${normalizeUrl(push.serverUrl)}/device`, {
        method: 'DELETE',
        headers: authHeaders(push.authKey),
        body: JSON.stringify({ deviceToken: push.deviceToken }),
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err).slice(0, 140) };
    }
  },

  /** Estado del servidor (última pasada, dispositivos, último error). */
  async fetchStatus(config: Gtr3ConfigState): Promise<PushServerStatus> {
    const push = config.notifications?.push;
    if (!push?.serverUrl || !push?.authKey) return { ok: false, error: 'servidor sin configurar' };
    try {
      const res = await fetch(`${normalizeUrl(push.serverUrl)}/status`, {
        headers: authHeaders(push.authKey),
      });
      const json: any = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, error: json?.error || `HTTP ${res.status}` };
      return { ok: true, ...json };
    } catch (err) {
      return { ok: false, error: String(err).slice(0, 140) };
    }
  },

  /** Envía una notificación de prueba desde el servidor. */
  async sendTest(config: Gtr3ConfigState): Promise<PushRequestResult> {
    const push = config.notifications?.push;
    if (!push?.serverUrl || !push?.authKey) return { ok: false, error: 'servidor sin configurar' };
    try {
      const res = await fetch(`${normalizeUrl(push.serverUrl)}/test`, {
        method: 'POST',
        headers: authHeaders(push.authKey),
      });
      const json: any = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) return { ok: false, error: json?.error || `HTTP ${res.status}` };
      return { ok: true, devices: json?.sent };
    } catch (err) {
      return { ok: false, error: String(err).slice(0, 140) };
    }
  },
};
