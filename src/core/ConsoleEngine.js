// src/core/ConsoleEngine.js
// Corazón de la consola: bucle de juego con paso fijo (deltaTime), máquina de estados,
// gestión del <canvas> (búfer de 144x192 escalado a toda la pantalla), la librería gráfica Gfx
// (con los temas de Themes.js), la capa de efectos FxLayer, las pantallas de sistema y el aviso de
// logros (Progress.js lleva las estadísticas, los logros y la racha del desafío diario).

import { ACTIONS } from './InputManager.js';
import { OptionsScreen, InitialsScreen, AttractScreen } from './Screens.js';
import { LaunchScreen } from './LaunchScreens.js';
import { HubScreen } from './HubScreen.js';
import { BOOT_DURATION, pickBootScene } from './BootScenes.js';
import { THEMES, getTheme, normalizeTheme, shellsFor } from './Themes.js';
import { ThemeGallery } from './ThemeGallery.js';
import { SEASON_JINGLE_TIME, trackFor } from './SoundChip.js';
import { Jukebox } from './Jukebox.js';
import { Progress } from './Progress.js';
import { achievementColor } from './Achievements.js';
import { renderShareCard } from './ShareCard.js';

/* global __APP_VERSION__ */
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'DEV';
export const SCREEN_WIDTH = 144;
export const SCREEN_HEIGHT = 192;
const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;

export const STATES = Object.freeze({
  BOOT: 'boot',
  MENU: 'menu',
  OPTIONS: 'options',
  THEMES: 'themes',
  JUKEBOX: 'jukebox',
  LAUNCH: 'launch',
  HUB: 'hub',
  ATTRACT: 'attract',
  DEMO: 'demo',
  INITIALS: 'initials',
  LOADING: 'loading',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAMEOVER: 'gameover',
  NOCART: 'nocart'
});

// ---------------------------------------------------------------------------
// Fuente de píxeles 3x5 dibujada por código.
// ---------------------------------------------------------------------------

const GLYPHS = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '..#', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '#.#', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '#.#', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  ' ': ['...', '...', '...', '...', '...'],
  '.': ['...', '...', '...', '...', '.#.'],
  ',': ['...', '...', '...', '.#.', '#..'],
  ':': ['...', '.#.', '...', '.#.', '...'],
  ';': ['...', '.#.', '...', '.#.', '#..'],
  '-': ['...', '...', '###', '...', '...'],
  '_': ['...', '...', '...', '...', '###'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '=': ['...', '###', '...', '###', '...'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  '¡': ['.#.', '...', '.#.', '.#.', '.#.'],
  '¿': ['.#.', '...', '.#.', '#..', '.##'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  "'": ['.#.', '.#.', '...', '...', '...'],
  '"': ['#.#', '#.#', '...', '...', '...'],
  '(': ['.#.', '#..', '#..', '#..', '.#.'],
  ')': ['.#.', '..#', '..#', '..#', '.#.'],
  '#': ['#.#', '###', '#.#', '###', '#.#'],
  '%': ['#.#', '..#', '.#.', '#..', '#.#'],
  '<': ['..#', '.#.', '#..', '.#.', '..#'],
  '>': ['#..', '.#.', '..#', '.#.', '#..'],
  '*': ['...', '#.#', '.#.', '#.#', '...'],
  '♥': ['...', '#.#', '###', '###', '.#.'],
  '▲': ['...', '.#.', '###', '###', '...'],
  '▼': ['...', '###', '###', '.#.', '...'],
  '◀': ['..#', '.##', '###', '.##', '..#'],
  '▶': ['#..', '##.', '###', '##.', '#..'],
  '♪': ['.##', '.#.', '.#.', '##.', '##.'],
  '×': ['...', '#.#', '.#.', '#.#', '...'],
  '★': ['.#.', '###', '###', '#.#', '...']
};

const GLYPH_W = 3;
const GLYPH_H = 5;

/** Quita acentos y pasa a mayúsculas para que todo el texto use la fuente 3x5. */
function normalizeText(text) {
  return String(text)
    .replace(/ñ/gi, 'N')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Gfx: primitivas de dibujo en coordenadas lógicas (144x192).
// ---------------------------------------------------------------------------

export class Gfx {
  constructor(ctx, width, height) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.theme = 'retro';
    this.themeDef = getTheme('retro');
    this.palette = this.themeDef.palette;
    this.colorblind = false;
    this.highContrast = false;
  }

  setTheme(theme) {
    this.theme = normalizeTheme(theme);
    this.themeDef = getTheme(this.theme);
    this._buildPalette();
  }

  /** Activa la paleta apta para daltonismo (solo afecta a los modos con color). */
  setColorblind(enabled) {
    this.colorblind = !!enabled;
    this._buildPalette();
  }

  /** Alto contraste: tinta más oscura/brillante y celdas apagadas más discretas. */
  setHighContrast(enabled) {
    this.highContrast = !!enabled;
    this._buildPalette();
  }

  _buildPalette() {
    const base = this.themeDef.palette;
    this.palette = {
      ...base,
      ...(this.colorblind && base.colorblind ? base.colorblind : {}),
      ...(this.highContrast && base.highContrast ? base.highContrast : {})
    };
  }

  /** Resuelve un nombre de paleta ("ink", "red"...) o devuelve el color CSS tal cual. */
  color(c) {
    if (!c) return this.palette.ink;
    return this.palette[c] || c;
  }

  clear(c = 'bg') {
    this.ctx.fillStyle = this.color(c);
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  px(x, y, c = 'ink') {
    this.ctx.fillStyle = this.color(c);
    this.ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
  }

  rect(x, y, w, h, c = 'ink') {
    this.ctx.fillStyle = this.color(c);
    this.ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }

  frame(x, y, w, h, c = 'ink', thickness = 1) {
    const t = thickness;
    this.rect(x, y, w, t, c);
    this.rect(x, y + h - t, w, t, c);
    this.rect(x, y + t, t, h - 2 * t, c);
    this.rect(x + w - t, y + t, t, h - 2 * t, c);
  }

  /** Línea con el algoritmo de Bresenham (píxeles duros, sin antialias). */
  line(x0, y0, x1, y1, c = 'ink') {
    x0 = Math.floor(x0);
    y0 = Math.floor(y0);
    x1 = Math.floor(x1);
    y1 = Math.floor(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    this.ctx.fillStyle = this.color(c);
    for (;;) {
      this.ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Círculo pixelado (relleno o contorno). */
  circle(cx, cy, r, c = 'ink', fill = true) {
    this.ctx.fillStyle = this.color(c);
    const rr = r * r;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = x * x + y * y;
        if (fill ? d <= rr + r * 0.8 : d <= rr + r * 0.8 && d >= rr - r * 1.2) {
          this.ctx.fillRect(Math.floor(cx + x), Math.floor(cy + y), 1, 1);
        }
      }
    }
  }

  /**
   * Celda de la matriz. El aspecto depende del estilo del tema:
   *   brick  → cuadro exterior + cuadro interior (Brick Game);
   *   neon   → bloque luminoso con brillo; apagada = punto tenue;
   *   solid  → bloque de píxeles con relieve; apagada = bloque tenue;
   *   sketch → trazo de bolígrafo con rayado; apagada = cuadrícula de libreta.
   * state: 'on' (encendida), 'off' (fantasma apagado), 'mid' (gris) o un nombre de color.
   */
  cell(x, y, size, state = 'on') {
    const c = state === 'on' ? this.palette.on : state === 'off' ? 'ghost' : state;
    const ctx = this.ctx;
    const style = this.palette.cellStyle;
    if (style === 'neon') {
      ctx.fillStyle = this.color(c);
      if (state === 'off') {
        const d = Math.max(1, Math.floor(size / 4));
        ctx.fillRect(x + Math.floor((size - 1 - d) / 2), y + Math.floor((size - 1 - d) / 2), d, d);
        return;
      }
      ctx.fillRect(x, y, size - 1, size - 1);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = this.palette.white;
      ctx.fillRect(x + 1, y + 1, size - 3, 1);
      ctx.fillRect(x + 1, y + 2, 1, size - 4);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + 1, y + size - 2, size - 2, 1);
      ctx.globalAlpha = 1;
      return;
    }
    if (style === 'solid') {
      ctx.fillStyle = this.color(c);
      ctx.fillRect(x, y, size - 1, size - 1);
      if (state === 'off' || size < 5) return;
      ctx.globalAlpha = this.palette.shine ?? 0.3;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 1, y + 1, size - 4, 1);
      ctx.fillRect(x + 1, y + 2, 1, size - 5);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + 1, y + size - 2, size - 2, 1);
      ctx.fillRect(x + size - 2, y + 1, 1, size - 3);
      ctx.globalAlpha = 1;
      return;
    }
    if (style === 'sketch') {
      ctx.fillStyle = this.color(c);
      if (state === 'off') {
        ctx.fillRect(x, y, size, 1);
        ctx.fillRect(x, y + 1, 1, size - 1);
        return;
      }
      this._sketchCell(x, y, size);
      return;
    }
    const inset = Math.max(1, Math.floor(size / 4));
    ctx.fillStyle = this.color(c);
    ctx.fillRect(x, y, size - 1, 1);
    ctx.fillRect(x, y + size - 2, size - 1, 1);
    ctx.fillRect(x, y + 1, 1, size - 3);
    ctx.fillRect(x + size - 2, y + 1, 1, size - 3);
    ctx.fillRect(x + inset, y + inset, size - 1 - inset * 2, size - 1 - inset * 2);
  }

  /**
   * Casilla rellenada a bolígrafo: contorno con una esquina sin cerrar, a veces un trazo que se pasa
   * y un rayado en diagonal. La variación sale de la posición, así que no parpadea entre fotogramas.
   */
  _sketchCell(x, y, size) {
    const ctx = this.ctx;
    const s = size - 1;
    if (s < 4) {
      ctx.fillRect(x, y, s, s);
      return;
    }
    const h = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663);
    const open = h & 3;
    ctx.fillRect(x + (open === 0 ? 1 : 0), y, s - (open === 0 || open === 1 ? 1 : 0), 1);
    ctx.fillRect(x + (open === 3 ? 1 : 0), y + s - 1, s - (open === 2 || open === 3 ? 1 : 0), 1);
    ctx.fillRect(x, y + 1, 1, s - 2);
    ctx.fillRect(x + s - 1, y + 1, 1, s - 2);
    if (h & 4) ctx.fillRect(x + s, h & 8 ? y : y + s - 1, 1, 1);
    const inner = s - 2;
    for (let k = 0; k < inner; k++) ctx.fillRect(x + 1 + k, y + s - 2 - k, 1, 1);
    for (let k = 0; k < inner - 2; k += 1) ctx.fillRect(x + 3 + k, y + s - 2 - k, 1, 1);
  }

  /** Rejilla de celdas apagadas, como el fondo de una pantalla Brick Game. */
  ghostGrid(x, y, cols, rows, size) {
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) this.cell(x + col * size, y + r * size, size, 'off');
    }
  }

  textWidth(text, scale = 1, spacing = 1) {
    const len = normalizeText(text).length;
    return len === 0 ? 0 : len * (GLYPH_W + spacing) * scale - spacing * scale;
  }

  /**
   * Texto con la fuente 3x5.
   * @param {object} [o] { color, align: 'left'|'center'|'right', scale, spacing, shadow }
   */
  text(text, x, y, o = {}) {
    const scale = o.scale || 1;
    const spacing = o.spacing ?? 1;
    const str = normalizeText(text);
    const w = this.textWidth(str, scale, spacing);
    let cx = Math.floor(o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x);
    const cy = Math.floor(y);
    if (o.shadow) this._drawText(str, cx + scale, cy + scale, scale, spacing, o.shadow);
    this._drawText(str, cx, cy, scale, spacing, o.color || 'ink');
    return w;
  }

  _drawText(str, x, y, scale, spacing, c) {
    this.ctx.fillStyle = this.color(c);
    let cx = x;
    for (const ch of str) {
      const glyph = GLYPHS[ch] || GLYPHS['?'];
      for (let row = 0; row < GLYPH_H; row++) {
        const line = glyph[row];
        for (let col = 0; col < GLYPH_W; col++) {
          if (line[col] === '#') this.ctx.fillRect(cx + col * scale, y + row * scale, scale, scale);
        }
      }
      cx += (GLYPH_W + spacing) * scale;
    }
  }

  /**
   * Sprite a partir de filas de texto. Cada carácter se traduce con colors[char];
   * '.' y ' ' son transparentes. Por defecto '#' = ink, '+' = mid.
   */
  sprite(rows, x, y, o = {}) {
    const scale = o.scale || 1;
    const colors = o.colors || { '#': o.color || 'ink', '+': 'mid' };
    const flipX = !!o.flipX;
    for (let r = 0; r < rows.length; r++) {
      const line = rows[r];
      for (let c = 0; c < line.length; c++) {
        const ch = line[flipX ? line.length - 1 - c : c];
        if (ch === '.' || ch === ' ') continue;
        const col = colors[ch];
        if (!col) continue;
        this.ctx.fillStyle = this.color(col);
        this.ctx.fillRect(Math.floor(x + c * scale), Math.floor(y + r * scale), scale, scale);
      }
    }
  }

  /** Dibuja otro canvas escalado (la miniatura del juego en el menú). `smooth` promedia al reducir. */
  image(source, x, y, w, h, { smooth = false } = {}) {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = smooth;
    if (smooth) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    ctx.imageSmoothingEnabled = false;
  }

  /** Velo semitransparente para menús superpuestos. */
  veil() {
    this.ctx.fillStyle = this.palette.overlay;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /** Recuadro con borde doble para diálogos. */
  panel(x, y, w, h) {
    this.rect(x, y, w, h, 'bg');
    this.frame(x, y, w, h, 'ink');
    this.frame(x + 2, y + 2, w - 4, h - 4, 'mid');
  }
}

// ---------------------------------------------------------------------------
// Rejilla de fondo de las pantallas de sistema (las animaciones de arranque están en BootScenes.js).
// ---------------------------------------------------------------------------

const BOOT_CELL = 8;
const BOOT_COLS = SCREEN_WIDTH / BOOT_CELL;
const BOOT_ROWS = SCREEN_HEIGHT / BOOT_CELL;
const BOOT_LED_ON = 0.9; // el LED se enciende cuando arranca la escena

const DEMO_DURATION = 25;
const RESET_HOLD = 0.7; // segundos manteniendo RESET para salir de una partida
const BREAK_EVERY = 30 * 60; // aviso de descanso cada 30 minutos de juego
const MENU_IDLE_FOR_DEMO = 20;
const BANNER_TIME = 3; // segundos que se ve el aviso de logro
const BANNER_SLIDE = 0.18;

// ---------------------------------------------------------------------------
// FxLayer: sacudida de pantalla, destellos y partículas. Disponible para todos los cartuchos.
// ---------------------------------------------------------------------------

const MAX_PARTICLES = 320;

export class FxLayer {
  constructor() {
    this.shakeEnabled = true;
    this.flashEnabled = true;
    this.reset();
  }

  reset() {
    this.shakeTime = 0;
    this.shakeDur = 0;
    this.shakeMag = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.flashTime = 0;
    this.flashDur = 0;
    this.flashColor = 'white';
    this.flashAlpha = 0.6;
    this.particles = [];
  }

  /** Sacude la pantalla `magnitude` píxeles durante `duration` segundos. */
  shake(magnitude = 2, duration = 0.25) {
    if (!this.shakeEnabled) return;
    const current = this.shakeTime > 0 ? this.shakeMag * (this.shakeTime / this.shakeDur) : 0;
    this.shakeMag = Math.max(current, magnitude);
    this.shakeDur = duration;
    this.shakeTime = duration;
  }

  /** Destello de pantalla completa del color indicado (nombre de paleta o CSS). */
  flash(color = 'white', duration = 0.12, alpha = 0.6) {
    if (!this.flashEnabled) return;
    this.flashColor = color;
    this.flashDur = duration;
    this.flashTime = duration;
    this.flashAlpha = alpha;
  }

  /** Explosión de partículas en (x, y). */
  burst(x, y, { color = 'ink', count = 12, speed = 45, life = 0.6, gravity = 60, spread = Math.PI * 2, angle = 0 } = {}) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = angle - spread / 2 + Math.random() * spread;
      const sp = speed * (0.35 + Math.random() * 0.65);
      const l = life * (0.6 + Math.random() * 0.4);
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: l, max: l, color, gravity });
    }
  }

  update(dt) {
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      const m = this.shakeMag * (this.shakeTime / this.shakeDur);
      this.offsetX = Math.round((Math.random() * 2 - 1) * m);
      this.offsetY = Math.round((Math.random() * 2 - 1) * m);
    } else {
      this.offsetX = 0;
      this.offsetY = 0;
    }
    if (this.flashTime > 0) this.flashTime = Math.max(0, this.flashTime - dt);
    if (this.particles.length) {
      for (const p of this.particles) {
        p.life -= dt;
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      this.particles = this.particles.filter((p) => p.life > 0);
    }
  }

  render(g) {
    for (const p of this.particles) {
      const size = p.life > p.max * 0.5 ? 2 : 1;
      g.rect(p.x, p.y, size, size, p.color);
    }
    if (this.flashTime > 0) {
      g.ctx.globalAlpha = this.flashAlpha * (this.flashTime / this.flashDur);
      g.rect(0, 0, g.width, g.height, this.flashColor);
      g.ctx.globalAlpha = 1;
    }
  }
}

// ---------------------------------------------------------------------------
// ConsoleEngine
// ---------------------------------------------------------------------------

export class ConsoleEngine {
  /**
   * @param {object} o
   * @param {HTMLCanvasElement} o.canvas
   * @param {HTMLElement} o.screen Contenedor de la pantalla (para calcular la escala).
   * @param {HTMLElement} [o.led] LED de encendido.
   * @param {import('./InputManager.js').InputManager} o.input
   * @param {import('./SoundChip.js').SoundChip} o.sound
   * @param {import('./StorageManager.js').StorageManager} o.storage
   * @param {import('./Catalog99.js').Catalog99} o.catalog
   * @param {import('./PlatformBridge.js').PlatformBridge} [o.platform] Pantalla encendida, pantalla completa y portapapeles.
   */
  constructor({ canvas, screen, led = null, input, sound, storage, catalog, platform = null }) {
    this.canvas = canvas;
    this.screenEl = screen;
    this.led = led;
    this.input = input;
    this.sound = sound;
    this.storage = storage;
    this.catalog = catalog;
    this.platform = platform;

    // Todo se dibuja en un búfer de resolución lógica y se escala al canvas visible.
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.buffer = document.createElement('canvas');
    this.buffer.width = SCREEN_WIDTH;
    this.buffer.height = SCREEN_HEIGHT;
    this.gfx = new Gfx(this.buffer.getContext('2d', { alpha: false }), SCREEN_WIDTH, SCREEN_HEIGHT);
    this.fx = new FxLayer();
    this.scale = 1;
    // Estela de LCD: la imagen que se ve se acerca a la nueva poco a poco (ver _composeGhost).
    this.ghostCanvas = document.createElement('canvas');
    this.ghostCanvas.width = SCREEN_WIDTH;
    this.ghostCanvas.height = SCREEN_HEIGHT;
    this.ghostCtx = this.ghostCanvas.getContext('2d', { alpha: false });
    this.ghostFresh = true;
    // Brillo de los temas de tubo: copia difuminada de la pantalla que se suma encima (ver _renderCrt).
    this.bloomCanvas = document.createElement('canvas');
    this.bloomCanvas.width = SCREEN_WIDTH;
    this.bloomCanvas.height = SCREEN_HEIGHT;
    this.bloomCtx = this.bloomCanvas.getContext('2d');
    this.bloomSupported = typeof this.bloomCtx.filter === 'string';

    this.state = STATES.BOOT;
    this.stateTime = 0;
    this.time = 0;
    this.accumulator = 0;
    this.lastTimestamp = 0;
    this.running = false;
    this.rafId = 0;

    this.cartridge = null;
    this.currentSlot = null;
    this.loadToken = 0;
    this.result = null;
    this.match = null; // partida a 2 jugadores por turnos (ver startMatch)
    this.turnBadge = 0;
    this.toastText = '';
    this.toastTime = 0;
    this.pauseIndex = 0;
    this.menuIdle = 0;
    this.demoTime = 0;
    this.resetHold = 0;
    this.playTime = 0;
    this.breakNotice = false;
    this.achievementQueue = [];
    this.banner = null;
    this.sharing = false;

    this.progress = new Progress(storage, catalog);
    this.settings = storage.getSettings();
    this.applySettings();

    this.menu = catalog.createMenu(this, this.settings.lastSlot);
    this.options = new OptionsScreen(this);
    this.themeGallery = new ThemeGallery(this);
    this.jukebox = new Jukebox(this);
    this.launchScreen = new LaunchScreen(this);
    this.hub = new HubScreen(this);
    this.initials = new InitialsScreen(this);
    this.attract = new AttractScreen(this);

    this._frame = this._frame.bind(this);
    this._onVisibility = this._onVisibility.bind(this);
    this._resize = this._resize.bind(this);

    this.unsubscribeInput = input.onAction((e) => this._handleAction(e));
    document.addEventListener('visibilitychange', this._onVisibility);
    window.addEventListener('resize', this._resize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this._resize);
      this.resizeObserver.observe(this.screenEl);
    }
    this._resize();
  }

  // ---------- Ajustes ----------

  /** Aplica todos los ajustes guardados a la pantalla, el sonido y los controles. */
  applySettings() {
    const s = this.settings;
    this.gfx.setColorblind(s.colorblind);
    this.gfx.setHighContrast(s.contrast === 'high');
    this.setTheme(s.theme);
    this.sound.setVolumeLevel(s.volume);
    this.sound.setBusLevels({ music: s.music, sfx: s.sfx });
    this.sound.setBeeper(s.beeper);
    this.input.setHaptics(s.haptics);
    this.input.setGestures?.(s.gestures);
    this.fx.shakeEnabled = !!s.shake;
    this.fx.flashEnabled = !!s.flashes;
    this.input.setRepeatSpeed(s.repeat);
    document.documentElement.dataset.big = s.bigButtons ? '1' : '0';
    document.documentElement.dataset.fx = s.flashes ? 'on' : 'off';
    document.documentElement.dataset.hand = s.hand === 'left' ? 'left' : 'right';
    if (this.platform) {
      if (this.platform.native) this.platform.setFullscreen(s.fullscreen);
      this._syncKeepAwake();
    }
    requestAnimationFrame(() => this._resize());
  }

  /** La pantalla no se apaga mientras se juega (si el ajuste está activo). */
  _syncKeepAwake() {
    if (!this.platform) return;
    this.platform.setKeepAwake(this.settings.keepAwake && this.state === STATES.PLAYING);
  }

  /** Cambia un ajuste, lo guarda y lo aplica al momento. */
  updateSetting(key, value) {
    this.settings = this.storage.setSetting(key, value);
    this.applySettings();
    return this.settings;
  }

  // ---------- Ciclo de vida ----------

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = performance.now();
    this._setState(STATES.BOOT);
    this.rafId = requestAnimationFrame(this._frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  destroy() {
    this.stop();
    this._unloadCartridge();
    this.unsubscribeInput();
    document.removeEventListener('visibilitychange', this._onVisibility);
    window.removeEventListener('resize', this._resize);
    if (this.resizeObserver) this.resizeObserver.disconnect();
  }

  _frame(timestamp) {
    if (!this.running) return;
    let dt = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, 0.25);

    this.input.update(dt);
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= STEP && steps < MAX_STEPS_PER_FRAME) {
      this._update(STEP);
      this.accumulator -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;

    this.sound.updateMusic();
    this._render();
    this._present(dt);
    this.rafId = requestAnimationFrame(this._frame);
  }

  // ---------- Pantalla ----------

  /**
   * Ocupa todo el espacio disponible manteniendo la proporción 3:4.
   * Si una escala entera aprovecha al menos el 90% del espacio se usa (píxeles idénticos);
   * si no, se usa la escala exacta con vecino más cercano (sigue nítido, sin desenfoque).
   */
  _resize() {
    const rect = this.screenEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const fit = Math.min(rect.width / SCREEN_WIDTH, rect.height / SCREEN_HEIGHT) * dpr;
    const whole = Math.floor(fit);
    const scale = whole >= 1 && whole / fit >= 0.9 ? whole : Math.max(1, fit);
    this.scale = scale;
    const w = Math.round(SCREEN_WIDTH * scale);
    const h = Math.round(SCREEN_HEIGHT * scale);
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = `${w / dpr}px`;
    this.canvas.style.height = `${h / dpr}px`;
    this.ctx.imageSmoothingEnabled = false;
  }

  _present(dt) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.imageSmoothingEnabled = false;
    const ox = Math.round(this.fx.offsetX * this.scale);
    const oy = Math.round(this.fx.offsetY * this.scale);
    if (ox !== 0 || oy !== 0) {
      ctx.fillStyle = this.gfx.palette.bg;
      ctx.fillRect(0, 0, w, h);
    }
    const source = this._composeGhost(dt);
    ctx.drawImage(source, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, ox, oy, w, h);
    this._renderCrt(source, ox, oy, w, h);
  }

  /**
   * Estela de LCD (o de fósforo en las pantallas oscuras): lo que se enciende aparece al momento y lo
   * que se apaga se desvanece en `ghost` segundos (Themes.js). En las pantallas claras se queda el tono
   * más oscuro de los dos (darken) y en las oscuras el más claro (lighten).
   */
  _composeGhost(dt) {
    const tau = this.settings.ghosting ? this.themeInfo.ghost || 0 : 0;
    if (tau <= 0) {
      this.ghostFresh = true;
      return this.buffer;
    }
    const ctx = this.ghostCtx;
    if (this.ghostFresh) {
      ctx.drawImage(this.buffer, 0, 0);
      this.ghostFresh = false;
      return this.ghostCanvas;
    }
    ctx.globalAlpha = 1 - Math.exp(-Math.max(0, dt) / tau);
    ctx.drawImage(this.buffer, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = this.gfx.palette.dark ? 'lighten' : 'darken';
    ctx.drawImage(this.buffer, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    return this.ghostCanvas;
  }

  /** Temas de tubo (`crt` en Themes.js): brillo alrededor de lo encendido y una línea oscura por fila de píxeles. */
  _renderCrt(source, ox, oy, w, h) {
    const crt = this.themeInfo.crt;
    if (!crt || !this.settings.flashes) return;
    const ctx = this.ctx;
    if (crt.bloom > 0 && this.bloomSupported) {
      const b = this.bloomCtx;
      b.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      b.filter = 'blur(1.5px)';
      b.drawImage(source, 0, 0);
      b.filter = 'none';
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = crt.bloom;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.bloomCanvas, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, ox, oy, w, h);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    // Las líneas necesitan al menos 3 píxeles reales por fila para no comerse la imagen.
    if (crt.scan > 0 && this.scale >= 3) {
      const line = Math.max(1, Math.round(this.scale * 0.3));
      ctx.fillStyle = `rgba(0, 0, 0, ${crt.scan})`;
      for (let row = 1; row <= SCREEN_HEIGHT; row++) {
        ctx.fillRect(0, Math.round(oy + row * this.scale) - line, w, line);
      }
    }
  }

  /**
   * Aplica un tema a la pantalla, la carcasa (atributos data-skin, data-season y data-shell), los
   * rótulos de la carcasa y el sonido. No lo guarda: la galería lo usa para la vista previa.
   * @param {string} theme
   * @param {string} [shell] Color de carcasa (SHELLS en Themes.js); por defecto, el guardado.
   */
  setTheme(theme, shell = this.savedShell(theme)) {
    this.gfx.setTheme(theme);
    this.theme = this.gfx.theme;
    const def = this.gfx.themeDef;
    this.themeInfo = def;
    const root = document.documentElement;
    root.dataset.skin = this.theme;
    if (def.season) root.dataset.season = def.season;
    else delete root.dataset.season;
    const shells = shellsFor(this.theme);
    this.shell = shells.some((s) => s.id === shell) ? shell : shells[0]?.id || '';
    if (shells.length && this.shell !== shells[0].id) root.dataset.shell = this.shell;
    else delete root.dataset.shell;
    this.screenEl.style.background = this.gfx.palette.bg;
    this.sound.setFlavor(def.sound);
    const label = document.getElementById('bezel-text');
    if (label) label.textContent = def.label;
    const tag = document.getElementById('brand-tag');
    if (tag) {
      tag.textContent = def.tag;
      tag.hidden = !def.tag;
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', def.chrome);
  }

  /** Color de carcasa guardado para un tema ('' = el de serie; también si está bloqueado). */
  savedShell(theme) {
    const id = normalizeTheme(theme);
    const shell = this.settings?.shells?.[id];
    return shell && this.progress.isShellUnlocked(id, shell) ? shell : '';
  }

  /** Guarda el color de carcasa de un tema. */
  saveShell(theme, shell) {
    this.updateSetting('shells', { ...(this.settings.shells || {}), [normalizeTheme(theme)]: shell });
  }

  /** Tras restaurar una copia de seguridad: recarga logros y estadísticas y la carcasa elegida. */
  onDataImported() {
    this.progress.load();
    this.achievementQueue = [];
    this.banner = null;
    this.setTheme(this.settings.theme);
    this.menu.onEnter();
  }

  /** Pasa al tema siguiente o al anterior y lo guarda. */
  cycleTheme(direction = 1) {
    const next = THEMES[(THEMES.indexOf(this.theme) + direction + THEMES.length) % THEMES.length];
    this.updateSetting('theme', next);
    return next;
  }

  /** Mensaje breve en la parte superior de la pantalla. */
  toast(text, seconds = 1.2) {
    this.toastText = text;
    this.toastTime = seconds;
  }

  // ---------- Estados ----------

  _setState(state) {
    this.state = state;
    this.stateTime = 0;
    this.input.clearEdges();
    this.resetHold = 0;
    if (state === STATES.BOOT) {
      this.sound.stopMusic();
      this.bootScene = pickBootScene(this.settings.boot);
      this.sound.sfx(this.bootScene.jingle);
    }
    if (state === STATES.PAUSED) this.pauseIndex = 0;
    if (state === STATES.MENU) this.menuIdle = 0;
    else this.menu?.preview.stop();
    this._syncKeepAwake();
  }

  /** Vuelve al menú. Al terminar el arranque, el tema estacional toca antes su jingle de temporada. */
  goToMenu({ fromBoot = false } = {}) {
    this.match = null;
    this._unloadCartridge();
    this._restoreSfx();
    this.fx.reset();
    this.menu.onEnter();
    const jingle = fromBoot ? this.themeInfo.jingle : null;
    if (jingle) this.sound.sfx(jingle);
    this.sound.playMusic('menu', { delay: jingle ? SEASON_JINGLE_TIME : 0 });
    this._setState(STATES.MENU);
  }

  openOptions() {
    this.options.onEnter();
    this._setState(STATES.OPTIONS);
  }

  closeOptions() {
    this.menu.onEnter();
    this._setState(STATES.MENU);
  }

  /** Galería de temas con vista previa en la consola entera (se abre desde Opciones). */
  openThemes() {
    this.themeGallery.onEnter();
    this._setState(STATES.THEMES);
  }

  /** Vuelve a Opciones desde la galería, en la misma fila. */
  closeThemes() {
    this._setState(STATES.OPTIONS);
  }

  /** Jukebox con la música y los jingles (se abre desde Opciones). */
  openJukebox() {
    this.jukebox.onEnter();
    this._setState(STATES.JUKEBOX);
  }

  /** Vuelve a Opciones desde el jukebox, con la música del menú. */
  closeJukebox() {
    this.sound.playMusic('menu');
    this._setState(STATES.OPTIONS);
  }

  /** Pantalla PREPARADO: controles, velocidad, nivel y favorito antes de jugar. */
  openLaunch(slot) {
    this.launchScreen.open(slot);
    this._setState(STATES.LAUNCH);
  }

  /** START en el menú: JUEGOS (favoritos y recientes), CARRERA, LOGROS, RACHA y DATOS. */
  openHub(tab = 'games') {
    this.hub.open(tab);
    this._setState(STATES.HUB);
  }

  /** Sale de la partida a una pestaña de la pantalla de START (B tras una etapa de la carrera). */
  goToHub(tab) {
    this.match = null;
    this._unloadCartridge();
    this._restoreSfx();
    this.fx.reset();
    this.menu.onEnter();
    this.sound.playMusic('menu');
    this.openHub(tab);
  }

  /** Vuelve al menú sin tocar la música (desde PREPARADO o la pantalla de START). */
  closeToMenu() {
    this.menu.onEnter();
    this._setState(STATES.MENU);
  }

  /** Pantalla de atracción: se alternan logo, récords, juegos y demos jugadas por la consola. */
  startAttract() {
    this.match = null;
    this._unloadCartridge();
    this.fx.reset();
    this.sound.stopMusic();
    this.attract.onEnter();
    this._setState(STATES.ATTRACT);
  }

  /**
   * Carga e inicia un cartucho.
   * @param {number|object} slotRef Número 1..99 o un slot ya construido (por ejemplo, el desafío diario).
   * @param {{ demo?: boolean }} [options] demo = la consola juega sola y no guarda puntuaciones.
   */
  async launch(slotRef, { demo = false } = {}) {
    const slot = typeof slotRef === 'object' && slotRef ? slotRef : this.catalog.getSlot(slotRef);
    if (!slot) return;
    if (this.match && (demo || slot !== this.match.slot)) this.match = null;
    if (!demo) {
      this.storage.setSetting('lastSlot', slot.daily ? 0 : slot.number);
      if (!slot.daily) this.storage.pushRecent(slot.number);
    }
    this._unloadCartridge();
    this.fx.reset();
    this.currentSlot = slot;
    this._setState(STATES.LOADING);
    const token = ++this.loadToken;

    let CartridgeClass = null;
    try {
      CartridgeClass = await this.catalog.loadCartridge(slot);
    } catch (err) {
      console.error(`[RetroPocket] Error cargando ${slot.engine.file}:`, err);
      CartridgeClass = null;
    }
    if (token !== this.loadToken || this.state !== STATES.LOADING) return;

    if (!CartridgeClass) {
      if (demo) {
        this.startAttract();
        return;
      }
      this.sound.stopMusic();
      this.sound.melody('nocart');
      this._setState(STATES.NOCART);
      return;
    }

    try {
      this.cartridge = new CartridgeClass(this, slot);
      this.cartridge.demo = demo;
      this.cartridge.init();
    } catch (err) {
      console.error(`[RetroPocket] Error iniciando ${slot.engine.file}:`, err);
      this.cartridge = null;
      if (demo) {
        this.startAttract();
        return;
      }
      this.sound.sfx('error');
      this._setState(STATES.NOCART);
      return;
    }

    if (demo) {
      this.sound.setBusLevels({ sfx: 0 });
      this.sound.stopMusic();
      this.demoTime = 0;
      this._setState(STATES.DEMO);
      return;
    }
    this.progress.onGameStart(slot);
    this.turnBadge = this.match ? 2 : 0;
    this.sound.melody('start');
    this.sound.playMusic(trackFor(slot.engine.id, this.cartridge.level));
    this._setState(STATES.PLAYING);
  }

  restart() {
    if (this.currentSlot) this.launch(this.currentSlot);
  }

  /**
   * Dos jugadores por turnos («pasa la consola»): cada uno juega una partida del mismo slot con la misma
   * semilla (las mismas piezas, enemigos y obstáculos) y gana la mejor puntuación. Las partidas cuentan
   * para récords, logros y estadísticas como cualquier otra.
   */
  startMatch(slot) {
    this.match = { slot: this._matchSlot(slot), round: 1, scores: [], stars: [], wins: [0, 0] };
    this.launch(this.match.slot);
  }

  _matchSlot(slot) {
    return Object.freeze({ ...slot, seed: Math.floor(Math.random() * 2 ** 32) });
  }

  /** Turno siguiente o, si ya jugaron los dos, una revancha con otra semilla. */
  _nextTurn() {
    const m = this.match;
    if (m.scores.length >= 2) {
      m.round++;
      m.scores = [];
      m.stars = [];
      m.slot = this._matchSlot(m.slot);
    }
    this.launch(m.slot);
  }

  /** Apunta el resultado del turno; al acabar el segundo, suma la victoria (o nada si empatan). */
  _recordTurn(result) {
    const m = this.match;
    m.scores.push(result.score);
    m.stars.push(result.stars);
    if (m.scores.length === 2 && m.scores[0] !== m.scores[1]) m.wins[m.scores[0] > m.scores[1] ? 0 : 1]++;
  }

  pause() {
    if (this.state !== STATES.PLAYING) return;
    this.sound.sfx('pause');
    this.sound.pauseMusic();
    this.cartridge?.onPause();
    this._setState(STATES.PAUSED);
  }

  resume() {
    if (this.state !== STATES.PAUSED) return;
    this.breakNotice = false;
    this.sound.sfx('select');
    this.sound.resumeMusic();
    this.cartridge?.onResume();
    this._setState(STATES.PLAYING);
  }

  /**
   * Lo llaman los cartuchos cuando la partida termina.
   * @param {{ score: number, level?: number, won?: boolean, message?: string }} data
   */
  endGame({ score = 0, level = 1, won = false, message = '' } = {}) {
    if (this.state === STATES.DEMO) {
      this.startAttract();
      return;
    }
    if (this.state !== STATES.PLAYING || !this.currentSlot) return;
    const slot = this.currentSlot;
    const previousBest = this.storage.getHighScore(slot.key);
    const submit = this.storage.submitScore(slot.key, score, { level });
    this.result = {
      score: Math.floor(score),
      level,
      won,
      message,
      ...submit,
      stars: this.catalog.starsFor(slot, score),
      previousStars: this.catalog.starsFor(slot, previousBest),
      table: this.storage.getScores(slot.key)
    };
    this.result.career = this.progress.onGameEnd(slot, this.result, previousBest);
    if (this.match) this._recordTurn(this.result);
    const career = this.result.career;
    this.sound.stopMusic();
    if (career?.passed) {
      this.sound.melody(career.boss || career.finished ? 'boss' : 'stage');
      this.input.vibratePattern([30, 60, 30, 60, 80]);
      this.fx.flash(submit.isHighScore ? 'yellow' : 'green', 0.4, 0.5);
    } else if (submit.isHighScore) {
      this.sound.melody('record');
      this.input.vibratePattern([30, 60, 30, 60, 80]);
      this.fx.flash('yellow', 0.4, 0.5);
    } else {
      this.sound.melody('gameover');
      this.input.vibratePattern([80, 50, 120]);
    }
    if (submit.rank > 0) {
      this.initials.begin(this.result, (name) => this._finishInitials(name));
      this._setState(STATES.INITIALS);
    } else {
      this._setState(STATES.GAMEOVER);
    }
  }

  _finishInitials(name) {
    if (!this.result || !this.currentSlot) return;
    this.storage.setEntryName(this.currentSlot.key, this.result.rank, name);
    this.settings = this.storage.getSettings();
    this.result.table = this.storage.getScores(this.currentSlot.key);
    this.sound.sfx('confirm');
    this._setState(STATES.GAMEOVER);
  }

  _unloadCartridge() {
    this.loadToken++;
    if (this.cartridge) {
      try {
        this.cartridge.destroy();
      } catch (err) {
        console.error('[RetroPocket] Error al descargar el cartucho:', err);
      }
    }
    this.cartridge = null;
    this.result = null;
    this.progress.endSession();
    this.sound.stopEffects();
  }

  _restoreSfx() {
    this.sound.setBusLevels({ sfx: this.settings.sfx });
  }

  // ---------- Entrada ----------

  _handleAction(e) {
    const { action, pressed, repeat } = e;
    if (pressed) this.menuIdle = 0;

    // En demo o atracción, cualquier botón devuelve al menú.
    if (this.state === STATES.ATTRACT || this.state === STATES.DEMO) {
      if (pressed && !repeat) {
        this.sound.sfx('confirm');
        this.goToMenu();
      }
      return;
    }

    if (pressed && !repeat && action === ACTIONS.SOUND) {
      const level = this.sound.cycleVolume();
      this.updateSetting('volume', level.id);
      this.sound.sfx('select');
      this.toast(`SONIDO ${level.label}`);
      return;
    }

    if (action === ACTIONS.RESET) {
      // En plena partida hay que mantenerlo pulsado: evita salir por un roce accidental.
      if (this.state === STATES.PLAYING) {
        if (pressed && !repeat) this.resetHold = 0.0001;
        else if (!pressed) this.resetHold = 0;
        return;
      }
      if (!pressed || repeat) return;
      // La galería de temas solo muestra una vista previa: al salir con RESET vuelve el tema guardado.
      if (this.state === STATES.THEMES) this.setTheme(this.settings.theme);
      if (this.state === STATES.MENU || this.state === STATES.BOOT) {
        this._setState(STATES.BOOT);
      } else {
        this.sound.sfx('back');
        this.goToMenu();
      }
      return;
    }

    switch (this.state) {
      case STATES.BOOT:
        if (pressed && !repeat && this.stateTime > 0.3) {
          if (!this.themeInfo.jingle) this.sound.sfx('confirm');
          this.goToMenu({ fromBoot: true });
        }
        break;

      case STATES.MENU:
        this.menu.handleAction(e);
        break;

      case STATES.OPTIONS:
        this.options.handleAction(e);
        break;

      case STATES.THEMES:
        this.themeGallery.handleAction(e);
        break;

      case STATES.JUKEBOX:
        this.jukebox.handleAction(e);
        break;

      case STATES.LAUNCH:
        this.launchScreen.handleAction(e);
        break;

      case STATES.HUB:
        this.hub.handleAction(e);
        break;

      case STATES.INITIALS:
        this.initials.handleAction(e);
        break;

      case STATES.PLAYING:
        if (pressed && !repeat && action === ACTIONS.START) {
          this.pause();
          return;
        }
        this.cartridge?.handleInput(e);
        break;

      case STATES.PAUSED:
        if (!pressed) return;
        if (action === ACTIONS.UP) {
          this.pauseIndex = (this.pauseIndex + 2) % 3;
          this.sound.sfx('move');
        } else if (action === ACTIONS.DOWN) {
          this.pauseIndex = (this.pauseIndex + 1) % 3;
          this.sound.sfx('move');
        } else if (!repeat && action === ACTIONS.START) {
          this.resume();
        } else if (!repeat && action === ACTIONS.A) {
          if (this.pauseIndex === 0) this.resume();
          else if (this.pauseIndex === 1) {
            this.sound.sfx('confirm');
            this.restart();
          } else {
            this.sound.sfx('back');
            this.goToMenu();
          }
        } else if (!repeat && action === ACTIONS.B) {
          this.resume();
        }
        break;

      case STATES.GAMEOVER: {
        if (!pressed || repeat || this.stateTime < 0.8) return;
        const career = this.result?.career;
        if (this.match && action === ACTIONS.A) {
          this.sound.sfx('confirm');
          this._nextTurn();
        } else if (action === ACTIONS.A) {
          this.sound.sfx('confirm');
          if (career?.next) {
            this.menu.jumpTo(career.next);
            this.launch(this.catalog.careerSlot(career.next));
          } else {
            this.restart();
          }
        } else if (action === ACTIONS.START) {
          this.shareResult();
        } else if (action === ACTIONS.B) {
          this.sound.sfx('back');
          if (career) this.goToHub('career');
          else this.goToMenu();
        }
        break;
      }

      case STATES.NOCART:
        if (pressed && !repeat && this.stateTime > 0.3) {
          this.sound.sfx('back');
          this.goToMenu();
        }
        break;

      default:
        break;
    }
  }

  /** START en el fin de partida: tarjeta PNG con la consola y la puntuación, al menú de compartir. */
  async shareResult() {
    if (!this.platform || this.sharing || !this.result || !this.currentSlot) return;
    this.sharing = true;
    this.sound.sfx('select');
    this.toast('PREPARANDO IMAGEN...', 4);
    try {
      const card = renderShareCard(this);
      const outcome = await this.platform.shareImage(card.canvas, card.fileName, card.text);
      if (outcome === 'downloaded') this.toast('IMAGEN DESCARGADA', 1.6);
      else this.toastTime = 0;
    } catch (err) {
      console.error('[RetroPocket] Error al compartir:', err);
      this.sound.sfx('error');
      this.toast('NO SE PUDO COMPARTIR', 1.6);
    } finally {
      this.sharing = false;
    }
  }

  _onVisibility() {
    if (document.hidden) {
      this.input.releaseAll();
      this.pause();
      if (this.progress.dirty) this.progress.save();
      this.sound.suspend();
      this.platform?.suspend();
    } else {
      this.sound.resume();
      this.platform?.reapply();
      this.lastTimestamp = performance.now();
    }
  }

  /** Botón "atrás" de Android: pausa, vuelve al menú o devuelve false para salir de la app. */
  handleBackButton() {
    switch (this.state) {
      case STATES.PLAYING:
        this.pause();
        return true;
      case STATES.PAUSED:
        this.resume();
        return true;
      case STATES.OPTIONS:
        this.closeOptions();
        return true;
      case STATES.THEMES:
        this.themeGallery.cancel();
        return true;
      case STATES.JUKEBOX:
        this.jukebox.exit();
        return true;
      case STATES.LAUNCH:
      case STATES.HUB:
        this.closeToMenu();
        return true;
      case STATES.INITIALS:
        this.initials.confirm();
        return true;
      case STATES.GAMEOVER:
        if (this.result?.career) this.goToHub('career');
        else this.goToMenu();
        return true;
      case STATES.NOCART:
      case STATES.LOADING:
      case STATES.ATTRACT:
      case STATES.DEMO:
        this.goToMenu();
        return true;
      default:
        return false;
    }
  }

  // ---------- Actualización ----------

  _update(dt) {
    this.time += dt;
    this.stateTime += dt;
    if (this.toastTime > 0) this.toastTime = Math.max(0, this.toastTime - dt);
    if (this.state !== STATES.PAUSED) this.fx.update(dt);

    switch (this.state) {
      case STATES.BOOT:
        if (this.stateTime >= BOOT_DURATION) this.goToMenu({ fromBoot: true });
        break;
      case STATES.MENU:
        this.menu.update(dt);
        this.menuIdle += dt;
        if (this.settings.demo && this.menuIdle >= MENU_IDLE_FOR_DEMO) this.startAttract();
        break;
      case STATES.OPTIONS:
        this.options.update(dt);
        break;
      case STATES.THEMES:
        this.themeGallery.update(dt);
        break;
      case STATES.JUKEBOX:
        this.jukebox.update(dt);
        break;
      case STATES.LAUNCH:
        this.launchScreen.update(dt);
        break;
      case STATES.HUB:
        this.hub.update(dt);
        break;
      case STATES.INITIALS:
        this.initials.update(dt);
        break;
      case STATES.ATTRACT:
        this.attract.update(dt);
        break;
      case STATES.DEMO:
        this.demoTime += dt;
        if (this.demoTime >= DEMO_DURATION) {
          this.startAttract();
          break;
        }
        this._tickCartridge(dt, true);
        break;
      case STATES.PLAYING:
        this.turnBadge = Math.max(0, this.turnBadge - dt);
        this._tickCartridge(dt, false);
        // Segunda pista del motor en los niveles pares (cambia al acabar la frase en curso).
        if (this.cartridge) this.sound.queueMusic(trackFor(this.currentSlot.engine.id, this.cartridge.level));
        this.progress.onPlayTick(dt);
        if (this.resetHold > 0) {
          this.resetHold += dt;
          if (this.resetHold >= RESET_HOLD) {
            this.resetHold = 0;
            this.sound.sfx('back');
            this.goToMenu();
            break;
          }
        }
        this.playTime += dt;
        if (this.settings.breakReminder && this.playTime >= BREAK_EVERY) {
          this.playTime = 0;
          this.breakNotice = true;
          this.pause();
        }
        break;
      default:
        break;
    }

    this._updateBanner(dt);

    if (this.led) {
      const blink = this.state === STATES.PAUSED ? Math.floor(this.time * 2) % 2 === 0 : true;
      this.led.classList.toggle('is-on', this.state !== STATES.BOOT ? blink : this.stateTime > BOOT_LED_ON);
    }
  }

  /** Aviso de logro: los recién conseguidos se muestran de uno en uno con su sonido. */
  _updateBanner(dt) {
    const fresh = this.progress.takeFresh();
    if (fresh.length) this.achievementQueue.push(...fresh);
    if (this.banner) {
      this.banner.time += dt;
      if (this.banner.time >= BANNER_TIME) this.banner = null;
    }
    if (!this.banner && this.achievementQueue.length && this.state !== STATES.BOOT) {
      this.banner = { achievement: this.achievementQueue.shift(), time: 0 };
      this.sound.sfx('achievement');
      this.input.vibrate('light');
    }
  }

  _tickCartridge(dt, autopilot) {
    if (!this.cartridge) return;
    try {
      if (autopilot) this.cartridge.autopilot(dt);
      this.cartridge.tick(dt);
    } catch (err) {
      console.error('[RetroPocket] Error en update():', err);
      this.sound.sfx('error');
      this.goToMenu();
    }
  }

  // ---------- Dibujo ----------

  _render() {
    const g = this.gfx;
    switch (this.state) {
      case STATES.BOOT:
        this._renderBoot(g);
        break;
      case STATES.MENU:
        this.menu.render(g);
        break;
      case STATES.OPTIONS:
        this.options.render(g);
        break;
      case STATES.THEMES:
        this.themeGallery.render(g);
        break;
      case STATES.JUKEBOX:
        this.jukebox.render(g);
        break;
      case STATES.LAUNCH:
        this.launchScreen.render(g);
        break;
      case STATES.HUB:
        this.hub.render(g);
        break;
      case STATES.ATTRACT:
        this.attract.render(g);
        break;
      case STATES.DEMO:
        this._renderCartridge(g);
        this.fx.render(g);
        this._renderDemoBanner(g);
        break;
      case STATES.LOADING:
        this._renderLoading(g);
        break;
      case STATES.PLAYING:
        this._renderCartridge(g);
        this.fx.render(g);
        if (this.turnBadge > 0) this._renderTurnBadge(g);
        if (this.resetHold > 0) this._renderResetHold(g);
        break;
      case STATES.PAUSED:
        this._renderCartridge(g);
        this._renderPause(g);
        break;
      case STATES.INITIALS:
        this._renderCartridge(g);
        this.initials.render(g);
        break;
      case STATES.GAMEOVER:
        this._renderCartridge(g);
        this._renderGameOver(g);
        this.fx.render(g);
        break;
      case STATES.NOCART:
        this._renderNoCart(g);
        break;
      default:
        g.clear();
    }
    this._renderBanner(g);
    this._renderToast(g);
  }

  _renderCartridge(g) {
    if (!this.cartridge) {
      g.clear();
      return;
    }
    try {
      this.cartridge.render(g);
    } catch (err) {
      console.error('[RetroPocket] Error en render():', err);
      g.clear();
    }
  }

  _renderBoot(g) {
    if (!this.bootScene) this.bootScene = pickBootScene(this.settings.boot);
    const icons = this.menu.catalog.engines.map((engine) => engine.icon[0]);
    this.bootScene.draw(g, this.stateTime, icons);
    g.text(`V${APP_VERSION}`, SCREEN_WIDTH - 4, SCREEN_HEIGHT - 8, { align: 'right', color: '#7a7a8c' });
  }

  /** Logotipo de la consola (arranque y pantalla de atracción). */
  drawLogo(g) {
    g.ghostGrid(0, 0, BOOT_COLS, BOOT_ROWS, BOOT_CELL);
    g.rect(8, 48, SCREEN_WIDTH - 16, 92, 'bg');
    g.frame(8, 48, SCREEN_WIDTH - 16, 92, 'ink');
    g.frame(10, 50, SCREEN_WIDTH - 20, 88, 'mid');
    g.text('RETRO', SCREEN_WIDTH / 2, 60, { align: 'center', scale: 3, color: 'cyan' });
    g.text('POCKET', SCREEN_WIDTH / 2, 80, { align: 'center', scale: 3, color: 'magenta' });
    g.text('99 IN 1', SCREEN_WIDTH / 2, 104, { align: 'center', scale: 2, color: 'yellow' });
  }

  _renderLoading(g) {
    g.clear();
    const slot = this.currentSlot;
    let label = `JUEGO ${slot ? slot.code : '00'}`;
    if (slot?.daily) label = 'DESAFIO';
    else if (slot?.career) label = slot.career.boss ? `JEFE ${slot.code}` : `ETAPA ${slot.code}`;
    g.text(label, SCREEN_WIDTH / 2, 80, { align: 'center', scale: 2 });
    const dots = '.'.repeat(1 + (Math.floor(this.stateTime * 4) % 3));
    g.text(`CARGANDO${dots}`, SCREEN_WIDTH / 2 - g.textWidth('CARGANDO...') / 2, 104);
  }

  _renderResetHold(g) {
    const w = 104;
    const x = Math.floor((SCREEN_WIDTH - w) / 2);
    g.rect(x, 2, w, 14, 'ink');
    g.text('MANTEN RESET: MENU', SCREEN_WIDTH / 2, 4, { align: 'center', color: 'bg' });
    g.rect(x + 2, 11, Math.floor((w - 4) * Math.min(1, this.resetHold / RESET_HOLD)), 3, 'bg');
  }

  _renderDemoBanner(g) {
    g.rect(0, SCREEN_HEIGHT - 12, SCREEN_WIDTH, 12, 'ink');
    if (Math.floor(this.time * 2) % 2 === 0) {
      g.text('DEMO - PULSA UN BOTON', SCREEN_WIDTH / 2, SCREEN_HEIGHT - 9, { align: 'center', color: 'bg' });
    }
  }

  _renderPause(g) {
    g.veil();
    const w = 104;
    const h = 72;
    const x = (SCREEN_WIDTH - w) / 2;
    const y = (SCREEN_HEIGHT - h) / 2;
    g.panel(x, y, w, h);
    g.text('PAUSA', SCREEN_WIDTH / 2, y + 8, { align: 'center', scale: 2 });
    if (this.breakNotice) {
      g.panel(x - 8, y - 40, w + 16, 34);
      g.text('LLEVAS 30 MIN JUGANDO', SCREEN_WIDTH / 2, y - 32, { align: 'center', color: 'yellow' });
      g.text('ESTIRA MANOS Y VISTA', SCREEN_WIDTH / 2, y - 22, { align: 'center' });
      g.text('Y DESCANSA UN POCO', SCREEN_WIDTH / 2, y - 14, { align: 'center', color: 'mid' });
    }
    const options = ['CONTINUAR', 'REINICIAR', 'MENU'];
    options.forEach((label, i) => {
      const oy = y + 30 + i * 11;
      const selected = i === this.pauseIndex;
      if (selected) g.text('▶', x + 14, oy, { color: Math.floor(this.time * 4) % 2 ? 'ink' : 'mid' });
      g.text(label, x + 22, oy, { color: selected ? 'ink' : 'mid' });
    });
  }

  /** Fila de 3 estrellas; las nuevas parpadean. */
  drawStars(g, x, y, stars, previous = stars, scale = 1) {
    for (let i = 0; i < 3; i++) {
      const earned = i < stars;
      const isNew = earned && i >= previous;
      const visible = !isNew || Math.floor(this.time * 4) % 2 === 0;
      const empty = g.palette.dark ? 'mid' : 'ghost';
      g.text('★', x + i * 5 * scale, y, { color: earned && visible ? 'yellow' : empty, scale });
    }
  }

  _renderGameOver(g) {
    const r = this.result || { score: 0, highScore: 0, isHighScore: false, rank: 0, won: false, message: '', stars: 0, previousStars: 0, table: [] };
    g.veil();
    const w = 124;
    const h = 156;
    const x = Math.floor((SCREEN_WIDTH - w) / 2);
    const y = Math.floor((SCREEN_HEIGHT - h) / 2);
    g.panel(x, y, w, h);
    g.text(r.won ? 'VICTORIA' : 'GAME OVER', SCREEN_WIDTH / 2, y + 7, { align: 'center', scale: 2, color: r.won ? 'green' : 'red' });
    if (r.message) g.text(r.message, SCREEN_WIDTH / 2, y + 21, { align: 'center', color: 'mid' });
    g.text('PUNTOS', x + 8, y + 31);
    g.text(String(r.score).padStart(7, '0'), x + w - 8, y + 31, { align: 'right' });
    g.text('RECORD', x + 8, y + 40);
    g.text(String(r.highScore).padStart(7, '0'), x + w - 8, y + 40, { align: 'right' });
    this.drawStars(g, SCREEN_WIDTH / 2 - 14, y + 50, r.stars, r.previousStars, 2);
    if (r.isHighScore && Math.floor(this.stateTime * 3) % 2 === 0) {
      g.text('¡NUEVO RECORD!', SCREEN_WIDTH / 2, y + 64, { align: 'center', color: 'yellow' });
    }

    g.rect(x + 8, y + 73, w - 16, 1, 'mid');
    if (this.match) {
      this._renderMatchResult(g, x, y + 78, w);
    } else if (r.career) {
      this._renderCareerResult(g, r, y + 78);
    } else {
      g.text('TOP 5', SCREEN_WIDTH / 2, y + 77, { align: 'center', color: 'mid' });
      const table = r.table || [];
      for (let i = 0; i < 5; i++) {
        const row = table[i];
        const ry = y + 86 + i * 8;
        const highlight = i + 1 === r.rank && Math.floor(this.time * 3) % 2 === 0;
        const color = highlight ? 'yellow' : 'ink';
        g.text(`${i + 1}.`, x + 10, ry, { color: 'mid' });
        g.text(row ? row.name || '---' : '---', x + 22, ry, { color });
        g.text(row ? String(row.score).padStart(7, '0') : '-------', x + w - 10, ry, { align: 'right', color });
      }
    }

    if (this.stateTime >= 0.8) {
      const c = r.career;
      const blink = Math.floor(this.stateTime * 2) % 2 === 0;
      g.text('START: COMPARTIR', SCREEN_WIDTH / 2, y + h - 22, { align: 'center', color: r.isHighScore && blink ? 'yellow' : 'mid' });
      let keys = 'A: OTRA VEZ   B: MENU';
      if (this.match) keys = this.match.scores.length < 2 ? 'A: JUEGA J2   B: SALIR' : 'A: REVANCHA   B: SALIR';
      else if (c) keys = `${c.next ? 'A: SIGUIENTE' : c.passed ? 'A: OTRA VEZ' : 'A: REINTENTAR'}   B: CARRERA`;
      g.text(keys, SCREEN_WIDTH / 2, y + h - 12, { align: 'center' });
    }
  }

  /** Marcador de la partida a 2 jugadores (en lugar del TOP 5). */
  _renderMatchResult(g, x, y, w) {
    const m = this.match;
    const cx = SCREEN_WIDTH / 2;
    const blink = Math.floor(this.stateTime * 3) % 2 === 0;
    const done = m.scores.length >= 2;
    const winner = done && m.scores[0] !== m.scores[1] ? (m.scores[0] > m.scores[1] ? 0 : 1) : -1;
    g.text(`2 JUGADORES - RONDA ${m.round}`, cx, y, { align: 'center', color: 'mid' });
    for (let p = 0; p < 2; p++) {
      const ry = y + 10 + p * 10;
      const played = p < m.scores.length;
      const color = p === winner ? 'yellow' : played ? 'ink' : 'mid';
      g.text(`J${p + 1}`, x + 10, ry, { color: p === 0 ? 'cyan' : 'magenta' });
      if (played) this.drawStars(g, x + 24, ry - 1, m.stars[p]);
      g.text(played ? String(m.scores[p]).padStart(7, '0') : '-------', x + w - 10, ry, { align: 'right', color });
    }
    let line = 'PASA LA CONSOLA AL J2';
    let color = blink ? 'ink' : 'mid';
    if (done) {
      line = winner < 0 ? '¡EMPATE!' : `¡GANA EL JUGADOR ${winner + 1}!`;
      color = 'yellow';
    }
    g.text(line, cx, y + 33, { align: 'center', color });
    g.text(`VICTORIAS  J1 ${m.wins[0]} - ${m.wins[1]} J2`, cx, y + 43, { align: 'center', color: 'mid' });
  }

  /** Al empezar cada turno de 2 jugadores, quién juega. */
  _renderTurnBadge(g) {
    if (Math.floor(this.turnBadge * 4) % 2 === 1 && this.turnBadge < 0.8) return;
    const player = this.match ? this.match.scores.length + 1 : 1;
    const w = 76;
    const x = Math.floor((SCREEN_WIDTH - w) / 2);
    const y = 80;
    g.panel(x, y, w, 22);
    g.text(`JUGADOR ${player}`, SCREEN_WIDTH / 2, y + 5, { align: 'center', color: player === 1 ? 'cyan' : 'magenta' });
    g.text(`RONDA ${this.match?.round || 1}`, SCREEN_WIDTH / 2, y + 13, { align: 'center', color: 'mid' });
  }

  /** Resultado de una etapa del modo carrera (en lugar del TOP 5). */
  _renderCareerResult(g, r, y) {
    const c = r.career;
    const cx = SCREEN_WIDTH / 2;
    const blink = Math.floor(this.stateTime * 3) % 2 === 0;
    g.text(`CARRERA  ETAPA ${c.stage}/${this.catalog.slots.length}`, cx, y, { align: 'center', color: 'mid' });
    if (c.passed) {
      const title = c.finished ? '¡CARRERA COMPLETA!' : c.boss ? '¡JEFE DERROTADO!' : 'ETAPA SUPERADA';
      g.text(title, cx, y + 11, { align: 'center', color: c.boss || c.finished ? (blink ? 'yellow' : 'green') : 'green' });
    } else {
      g.text(c.boss ? 'EL JEFE GANA ESTA VEZ' : 'NO SUPERADA', cx, y + 11, { align: 'center', color: 'red' });
    }
    const slot = this.currentSlot;
    const goal = slot.stars[c.need - 1];
    g.text(`META ${'★'.repeat(c.need)} ${goal} PUNTOS`, cx, y + 22, { align: 'center', color: c.passed ? 'mid' : 'ink' });
    if (!c.passed) {
      g.text(`TE FALTAN ${Math.max(1, goal - r.score)}`, cx, y + 33, { align: 'center', color: 'yellow' });
    } else if (c.finished) {
      g.text('¡ERES CAMPEON DE LAS 99!', cx, y + 33, { align: 'center', color: 'yellow' });
    } else if (c.next) {
      const next = this.catalog.careerSlot(c.next);
      const label = next.career.boss ? '¡SIGUE UN JEFE!' : `SIGUE: ${next.code} ${next.engine.name}`;
      g.text(label, cx, y + 33, { align: 'center', color: next.career.boss ? 'red' : next.engine.color });
    }
  }

  _renderNoCart(g) {
    g.clear();
    const slot = this.currentSlot;
    g.ghostGrid(0, 0, BOOT_COLS, BOOT_ROWS, BOOT_CELL);
    g.panel(10, 52, SCREEN_WIDTH - 20, 88);
    g.text(slot && slot.daily ? 'DESAFIO' : `JUEGO ${slot ? slot.code : '00'}`, SCREEN_WIDTH / 2, 62, { align: 'center', scale: 2 });
    g.text(slot ? slot.engine.name : '', SCREEN_WIDTH / 2, 82, { align: 'center', color: 'mid' });
    g.text('CARTUCHO NO', SCREEN_WIDTH / 2, 98, { align: 'center', color: 'red' });
    g.text('INSERTADO', SCREEN_WIDTH / 2, 106, { align: 'center', color: 'red' });
    if (Math.floor(this.stateTime * 2) % 2 === 0) g.text('PULSA UN BOTON', SCREEN_WIDTH / 2, 124, { align: 'center' });
  }

  /** Aviso de logro: baja desde arriba con el icono y el nombre, y vuelve a subir. */
  _renderBanner(g) {
    const b = this.banner;
    if (!b) return;
    const a = b.achievement;
    const h = 22;
    const slide = Math.max(0, Math.min(1, b.time / BANNER_SLIDE, (BANNER_TIME - b.time) / BANNER_SLIDE));
    const x = 3;
    const y = Math.round(-h + slide * (h + 2));
    const w = SCREEN_WIDTH - 6;
    g.rect(x, y, w, h, 'bg');
    g.frame(x, y, w, h, 'yellow');
    g.frame(x + 2, y + 2, w - 4, h - 4, 'mid');
    g.sprite(a.icon, x + 5, y + 4, { scale: 2, colors: { '#': achievementColor(a), '+': 'mid' } });
    g.text('★ LOGRO DESBLOQUEADO', x + 23, y + 5, { color: 'yellow' });
    g.text(a.name, x + 23, y + 13);
  }

  _renderToast(g) {
    if (this.toastTime <= 0 || !this.toastText) return;
    const w = g.textWidth(this.toastText) + 10;
    const x = Math.floor((SCREEN_WIDTH - w) / 2);
    g.rect(x, 2, w, 11, 'ink');
    g.text(this.toastText, SCREEN_WIDTH / 2, 5, { align: 'center', color: 'bg' });
  }
}
