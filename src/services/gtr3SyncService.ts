import { Gtr3ConfigState } from './types';

export const Gtr3SyncService = {
  generateConfigFileContent(config: Gtr3ConfigState): string {
    return `/**
 * Configuración global del Side Service (Smartphone / Amazfit GTR 3)
 * Autogenerada desde la app Score Viewer Pro en el Hub Móvil.
 * Última actualización: ${new Date().toLocaleString()}
 */

export const CONFIG = {
  // ==========================================
  // 1. CLAVES DE API
  // ==========================================
  PANDASCORE_TOKEN: "${config.pandaToken || ''}",
  FOOTBALL_DATA_TOKEN: "${config.footballToken || ''}",

  // ==========================================
  // 2. SELECCIÓN DE JUEGOS Y DEPORTES ACTIVOS
  // ==========================================
  ENABLED_GAMES: ${JSON.stringify(config.enabledGames, null, 4)},

  // ==========================================
  // 3. EQUIPOS Y CLUBES FAVORITOS
  // Se priorizan con estrella en el reloj
  // ==========================================
  FAVORITE_TEAMS: ${JSON.stringify(config.favoriteTeams, null, 4)},

  // ==========================================
  // 4. TORNEOS Y LIGAS FAVORITAS
  // ==========================================
  FAVORITE_TOURNAMENTS: ${JSON.stringify(config.favoriteTournaments, null, 4)},

  // ==========================================
  // 5. AJUSTES AVANZADOS DEL RELOJ
  // ==========================================
  SHOW_ONLY_FAVORITES: true,
  SHOW_UPCOMING: ${config.showUpcoming},
  SHOW_FAVORITE_RECENT_RESULTS: ${config.showFavoriteRecentResults},
  SHOW_TEAM_LOGOS: ${config.showTeamLogos},
  MAX_MATCHES: ${config.maxMatches || 15},
  CACHE_TTL_MS: 60000,
  FORCE_MOCK: false
};
`;
  },

  getInstallationSteps(): { step: number; title: string; desc: string; tip?: string }[] {
    return [
      {
        step: 1,
        title: 'Activar Modo Desarrollador en la app Zepp',
        desc: 'Abre la app Zepp en tu teléfono > Perfil > Ajustes > Acerca de > Pulsa 7 veces seguidas sobre el logo de Zepp OS.',
        tip: 'Aparecerá el aviso "Modo Desarrollador activado" en tu smartphone.',
      },
      {
        step: 2,
        title: 'Acceder a Modo de Desarrollador en Zepp',
        desc: 'Vuelve a la pantalla de Perfil en la app Zepp y entra en la nueva sección "Modo de desarrollador". Verás la opción de escanear código QR.',
      },
      {
        step: 3,
        title: 'Compilar y Generar el Código QR',
        desc: 'En tu ordenador, entra en la carpeta score-tracker-gtr3 y ejecuta en la terminal: zeus preview',
        tip: 'Se compilará la mini-app y se imprimirá un código QR en la consola.',
      },
      {
        step: 4,
        title: 'Escanear e Instalar en el Amazfit GTR 3',
        desc: 'Escanea el código QR desde la app Zepp de tu móvil. La aplicación se enviará por Bluetooth BLE a tu reloj y se instalará automáticamente.',
      },
    ];
  },
};
