import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubAppStorage } from '../types';

/**
 * Storage propio de Score Viewer.
 *
 * Usa el mismo prefijo de claves que el Hub usaba (`@app_score-viewer_`) para que,
 * al importar el backup JSON exportado desde el Hub, los datos caigan exactamente
 * donde esta app los lee. Al ser una app distinta, su AsyncStorage está aislado.
 */
const PREFIX = '@app_score-viewer_';

export const AppStorage: SubAppStorage = {
  async get<T = string>(key: string, defaultValue?: T): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(`${PREFIX}${key}`);
      if (raw === null) return defaultValue ?? null;
      try {
        return JSON.parse(raw);
      } catch {
        return raw as unknown as T;
      }
    } catch {
      return defaultValue ?? null;
    }
  },

  async set(key: string, value: any): Promise<void> {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      await AsyncStorage.setItem(`${PREFIX}${key}`, serialized);
    } catch (err) {
      console.warn(`Error guardando ${key} en Score Viewer:`, err);
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${PREFIX}${key}`);
    } catch (err) {
      console.warn(`Error eliminando ${key} en Score Viewer:`, err);
    }
  },

  async clear(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const appKeys = allKeys.filter((k) => k.startsWith(PREFIX));
      if (appKeys.length > 0) {
        await AsyncStorage.multiRemove(appKeys);
      }
    } catch (err) {
      console.warn('Error limpiando storage de Score Viewer:', err);
    }
  },
};
