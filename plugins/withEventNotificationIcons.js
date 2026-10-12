/**
 * Config plugin: copia los iconos Material Symbols (Apache 2.0) de
 * `plugins/notification-icons/` a los recursos Android como vector drawables.
 *
 * El servidor de push usa estos nombres (por ejemplo `ic_notif_goal`) en el
 * campo `icon` del mensaje Expo para que cada tipo de aviso tenga su propio
 * icono en la barra de estado y en la notificación.
 *
 * Se aplican con `npx expo prebuild -p android` (o al generar un build).
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, 'notification-icons');

module.exports = function withEventNotificationIcons(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const drawableDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'drawable'
      );
      fs.mkdirSync(drawableDir, { recursive: true });
      for (const file of fs.readdirSync(ICONS_DIR)) {
        if (!file.endsWith('.xml')) continue;
        fs.copyFileSync(path.join(ICONS_DIR, file), path.join(drawableDir, file));
      }
      return cfg;
    },
  ]);
};
