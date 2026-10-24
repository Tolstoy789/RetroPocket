// build/pwa-plugin.js
// Plugin de Vite que genera por código (sin archivos de imagen) los iconos PNG de la app
// y el service worker que deja la consola funcionando 100% offline.

import { deflateSync } from 'node:zlib';

// ---------- Codificador PNG mínimo (RGBA, sin dependencias) ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---------- Diseño del icono: 32x32 píxeles lógicos ----------

const COLORS = {
  Y: [229, 195, 58], // carcasa
  H: [243, 217, 104], // brillo superior de la carcasa
  S: [179, 143, 28], // sombra inferior de la carcasa
  D: [45, 48, 66], // bisel
  L: [158, 173, 134], // LCD
  I: [29, 43, 26], // píxeles encendidos
  K: [59, 74, 51], // brillo de los píxeles encendidos
  G: [143, 158, 120], // píxeles fantasma
  R: [214, 56, 59], // botones
  r: [240, 107, 109], // brillo de los botones
  P: [38, 40, 58] // cruceta
};

const DIGIT_9 = ['###', '#.#', '###', '..#', '###'];

/** Icono «Ladrillo clásico» (propuesta A): consola amarilla con un «99» de ladrillos en la LCD. */
function iconPixels() {
  const grid = Array.from({ length: 32 }, () => Array(32).fill('Y'));
  const fill = (x, y, w, h, c) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) grid[j][i] = c;
  };
  fill(0, 0, 32, 1, 'H');
  fill(0, 31, 32, 1, 'S');
  fill(4, 3, 24, 19, 'D');
  fill(6, 5, 20, 15, 'L');
  // "99" con celdas de 2x2: encendidas con brillo en la esquina, apagadas en gris fantasma
  [8, 17].forEach((ox) => {
    DIGIT_9.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        const x = ox + c * 2;
        const y = 6 + r * 2;
        fill(x, y, 2, 2, ch === '#' ? 'I' : 'G');
        if (ch === '#') grid[y][x] = 'K';
      });
    });
  });
  fill(6, 17, 20, 1, 'G');
  // Cruceta
  fill(7, 24, 2, 6, 'P');
  fill(5, 26, 6, 2, 'P');
  // Botones B y A con brillo
  fill(19, 26, 4, 4, 'R');
  fill(24, 24, 4, 4, 'R');
  grid[26][19] = 'r';
  grid[24][24] = 'r';
  return grid;
}

/**
 * Genera el icono como PNG.
 * - content: tamaño en píxeles del dibujo de 32x32 dentro del lienzo (el resto queda transparente).
 * - flat: sin brillo ni sombra en los bordes (para la capa frontal de los iconos adaptables de Android).
 * - round: recorta en círculo y rellena con el color de la carcasa (ic_launcher_round de Android).
 */
export function renderIcon(size, { content = size, flat = false, round = false } = {}) {
  const grid = iconPixels();
  const offset = Math.floor((size - content) / 2);
  const radius = size / 2;
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = Math.floor(((x - offset) * 32) / content);
      const gy = Math.floor(((y - offset) * 32) / content);
      const inside = gx >= 0 && gx < 32 && gy >= 0 && gy < 32;
      const inCircle = !round || (x + 0.5 - radius) ** 2 + (y + 0.5 - radius) ** 2 <= radius * radius;
      if (!inCircle || (!inside && !round)) continue;
      let key = inside ? grid[gy][gx] : 'Y';
      if (flat && (key === 'H' || key === 'S')) key = 'Y';
      const c = COLORS[key];
      const o = (y * size + x) * 4;
      rgba[o] = c[0];
      rgba[o + 1] = c[1];
      rgba[o + 2] = c[2];
      rgba[o + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

/** Color de fondo de la carcasa, en hexadecimal (fondo del icono adaptable de Android). */
export const ICON_BACKGROUND = '#' + COLORS.Y.map((v) => v.toString(16).padStart(2, '0')).join('');

export const ICON_SIZES = [192, 512];

// ---------- Service worker ----------

function serviceWorkerSource(version, files) {
  return `// sw.js generado en cada build por build/pwa-plugin.js
const CACHE = 'retropocket-${version}';
const PRECACHE = ${JSON.stringify(files, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => (request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
    )
  );
});
`;
}

export function retroPocketPwa() {
  return {
    name: 'retropocket-pwa',

    // En desarrollo (npm run dev) los iconos se sirven al vuelo.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = /\/icon-(\d+)\.png$/.exec(req.url || '');
        if (!match || !ICON_SIZES.includes(Number(match[1]))) return next();
        res.setHeader('Content-Type', 'image/png');
        res.end(renderIcon(Number(match[1])));
      });
    },

    generateBundle(_options, bundle) {
      for (const size of ICON_SIZES) {
        this.emitFile({ type: 'asset', fileName: `icon-${size}.png`, source: renderIcon(size) });
      }
      const files = [
        './',
        './index.html',
        './manifest.json',
        ...ICON_SIZES.map((s) => `./icon-${s}.png`),
        ...Object.keys(bundle)
          .filter((name) => name !== 'index.html' && !name.endsWith('.map'))
          .map((name) => `./${name}`)
      ];
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorkerSource(Date.now().toString(36), [...new Set(files)]) });
    }
  };
}
