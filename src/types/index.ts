/**
 * Tipos mínimos que antes venían del Hub (`hub-app/src/types`).
 *
 * La app independiente ya no depende del Hub, así que define aquí su propio
 * contrato de storage. `appId` queda opcional por compatibilidad con el
 * componente `ScoreViewerApp` (que ya no lo necesita).
 */

export interface SubAppStorage {
  get: <T = string>(key: string, defaultValue?: T) => Promise<T | null>;
  set: (key: string, value: any) => Promise<void>;
  remove: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

export interface SubAppProps {
  appId?: string;
  onExitToHub: () => void;
  storage: SubAppStorage;
}
