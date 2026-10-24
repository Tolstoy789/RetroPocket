// build/android-icons.js
// Escribe el icono de la app (propuesta A «Ladrillo clásico») en el proyecto Android de Capacitor:
// iconos clásicos cuadrados y redondos para cada densidad, y el icono adaptable (Android 8+)
// con la consola como capa frontal sobre el amarillo de la carcasa.
// Uso: node build/android-icons.js  (después de `npx cap add android`)

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { renderIcon, ICON_BACKGROUND } from './pwa-plugin.js';

const RES = join('android', 'app', 'src', 'main', 'res');

// Tamaño del icono clásico (48 dp) y de la capa adaptable (108 dp) en cada densidad.
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

// El lanzador solo enseña los 72 dp centrales de la capa de 108 dp y puede recortarla en círculo:
// el dibujo ocupa 58 dp para que la cruceta y los botones no se corten en ninguna máscara.
const ADAPTIVE_CONTENT = 58 / 108;
// En el icono redondo clásico el dibujo se reduce para que quepa entero dentro del círculo.
const ROUND_CONTENT = 0.74;

const ADAPTIVE_XML = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;

const BACKGROUND_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${ICON_BACKGROUND}</color>
</resources>
`;

function write(path, data) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, data);
}

if (!existsSync(RES)) {
  console.error('No existe el proyecto Android. Ejecuta antes: npx cap add android');
  process.exit(1);
}

for (const [density, factor] of Object.entries(DENSITIES)) {
  const dir = join(RES, `mipmap-${density}`);
  const legacy = Math.round(48 * factor);
  const layer = Math.round(108 * factor);
  write(join(dir, 'ic_launcher.png'), renderIcon(legacy));
  write(join(dir, 'ic_launcher_round.png'), renderIcon(legacy, { round: true, content: Math.round(legacy * ROUND_CONTENT), flat: true }));
  write(join(dir, 'ic_launcher_foreground.png'), renderIcon(layer, { content: Math.round(layer * ADAPTIVE_CONTENT), flat: true }));
}

write(join(RES, 'mipmap-anydpi-v26', 'ic_launcher.xml'), ADAPTIVE_XML);
write(join(RES, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), ADAPTIVE_XML);
write(join(RES, 'values', 'ic_launcher_background.xml'), BACKGROUND_XML);

console.log(`Iconos de Android escritos en ${RES} (fondo ${ICON_BACKGROUND}).`);
