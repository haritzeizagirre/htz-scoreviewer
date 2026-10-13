/* Descarga los iconos Material Symbols (Apache 2.0) como vector drawables de
 * Android para las notificaciones. Ejecutar una vez: node scripts/fetch-notification-icons.js
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'plugins', 'notification-icons');

const MAP = {
  ic_notif_kickoff: 'play_circle',
  ic_notif_goal: 'sports_soccer',
  ic_notif_halftime: 'pause_circle',
  ic_notif_fulltime: 'scoreboard',
  ic_notif_redcard: 'rectangle',
  ic_notif_goal_cancelled: 'cancel',
  ic_notif_map: 'map',
  ic_notif_series: 'emoji_events',
  ic_notif_reminder: 'alarm',
};

const BASE =
  'https://raw.githubusercontent.com/google/material-design-icons/master/symbols/android';

(async () => {
  fs.mkdirSync(dir, { recursive: true });
  for (const [file, name] of Object.entries(MAP)) {
    const url = `${BASE}/${name}/materialsymbolsrounded/${name}_fill1_24px.xml`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    let xml = await res.text();
    // El tinte de tema no aplica a las notificaciones (el sistema tiñe el icono).
    xml = xml.replace(/\s*android:tint="[^"]*"/, '');
    fs.writeFileSync(path.join(dir, `${file}.xml`), `${xml.trim()}\n`, 'utf8');
    console.log(`guardado ${file}.xml (${xml.length} bytes)`);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
