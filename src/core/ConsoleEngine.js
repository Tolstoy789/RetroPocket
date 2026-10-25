// src/core/ConsoleEngine.js
// Corazón de la consola: bucle de juego con paso fijo (deltaTime), máquina de estados,
// gestión del <canvas> (búfer de 144x192 escalado a toda la pantalla), la librería gráfica Gfx
// (modos Retro, Futurista y Cristal), la capa de efectos FxLayer y las pantallas de sistema.

import { ACTIONS } from './InputManager.js';
import { OptionsScreen, InitialsScreen, AttractScreen } from './Screens.js';
import { LaunchScreen, MyGamesScreen } from './LaunchScreens.js';
import { BOOT_DURATION, pickBootScene } from './BootScenes.js';

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
  LAUNCH: 'launch',
  MYGAMES: 'mygames',
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
// Modos visuales: los juegos usan nombres de color y la consola decide cómo se ven.
//   retro  → LCD verde con celdas de ladrillo, carcasa amarilla clásica.
//   future → pantalla neón a color con celdas luminosas, carcasa futurista oscura.
//   crystal → carcasa translúcida violeta con LCD gris azulado.
// La lógica de los juegos es idéntica en ambos modos.
// ---------------------------------------------------------------------------

export const PALETTES = {
  retro: {
    name: 'RETRO',
    cellStyle: 'brick',
    on: 'ink',
    bg: '#9ead86',
    ghost: '#8f9e78',
    mid: '#5d6b4f',
    ink: '#1d2b1a',
    red: '#1d2b1a',
    green: '#1d2b1a',
    blue: '#1d2b1a',
    yellow: '#3b4a33',
    cyan: '#3b4a33',
    magenta: '#3b4a33',
    orange: '#3b4a33',
    white: '#1d2b1a',
    overlay: 'rgba(158, 173, 134, 0.82)',
    highContrast: { bg: '#a9b991', ghost: '#a0b088', mid: '#3a4830', ink: '#081206', yellow: '#1f2c19', cyan: '#1f2c19', magenta: '#1f2c19', orange: '#1f2c19' }
  },
  future: {
    name: 'FUTURISTA',
    cellStyle: 'neon',
    on: 'cyan',
    bg: '#04040c',
    ghost: '#121633',
    mid: '#5a68b8',
    ink: '#eaf6ff',
    red: '#ff2e63',
    green: '#00ff9c',
    blue: '#2e8bff',
    yellow: '#f9f871',
    cyan: '#00f0ff',
    magenta: '#ff2bd6',
    orange: '#ff8a00',
    white: '#ffffff',
    overlay: 'rgba(4, 4, 12, 0.8)',
    // Paleta Okabe-Ito adaptada a fondo oscuro: distinguible con protanopía y deuteranopía.
    colorblind: {
      red: '#ff7a1a',
      green: '#2fd3a8',
      blue: '#56b4e9',
      cyan: '#a6e3ff',
      yellow: '#f0e442',
      magenta: '#e08ac0',
      orange: '#e69f00'
    },
    highContrast: { bg: '#000000', ghost: '#0a0c1c', mid: '#9aa6ff', ink: '#ffffff' }
  },
  crystal: {
    name: 'CRISTAL',
    cellStyle: 'brick',
    on: 'ink',
    bg: '#b7c2c8',
    ghost: '#a8b3ba',
    mid: '#66727c',
    ink: '#262b45',
    red: '#262b45',
    green: '#262b45',
    blue: '#262b45',
    yellow: '#454b66',
    cyan: '#454b66',
    magenta: '#454b66',
    orange: '#454b66',
    white: '#262b45',
    overlay: 'rgba(183, 194, 200, 0.82)',
    highContrast: { bg: '#c6d0d5', ghost: '#bcc6cc', mid: '#46515b', ink: '#0d1029', yellow: '#262b45', cyan: '#262b45', magenta: '#262b45', orange: '#262b45' }
  }
};

export const THEMES = Object.keys(PALETTES);
export const THEME_SOUND = { retro: 'retro', future: 'future', crystal: 'retro' };
export const THEME_CHROME = { retro: '#1b1d2a', future: '#05050f', crystal: '#2a1c3f' };

/** Convierte valores guardados por versiones anteriores ("lcd", "crt") al modo actual. */
export function normalizeTheme(theme) {
  if (theme === 'lcd') return 'retro';
  if (theme === 'crt') return 'future';
  return PALETTES[theme] ? theme : 'retro';
}

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
    this.palette = PALETTES.retro;
    this.theme = 'retro';
    this.colorblind = false;
    this.highContrast = false;
  }

  setTheme(theme) {
    this.theme = normalizeTheme(theme);
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
    const base = PALETTES[this.theme];
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
   * Celda estilo Brick Game: cuadro exterior + cuadro interior.
   * state: 'on' (encendida), 'off' (fantasma apagado), 'mid' (gris) o un nombre de color.
   */
  cell(x, y, size, state = 'on') {
    const c = state === 'on' ? this.palette.on : state === 'off' ? 'ghost' : state;
    const ctx = this.ctx;
    if (this.palette.cellStyle === 'neon') {
      // Celda luminosa: bloque sólido con brillo superior; apagada = punto tenue.
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
    const inset = Math.max(1, Math.floor(size / 4));
    ctx.fillStyle = this.color(c);
    ctx.fillRect(x, y, size - 1, 1);
    ctx.fillRect(x, y + size - 2, size - 1, 1);
    ctx.fillRect(x, y + 1, 1, size - 3);
    ctx.fillRect(x + size - 2, y + 1, 1, size - 3);
    ctx.fillRect(x + inset, y + inset, size - 1 - inset * 2, size - 1 - inset * 2);
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
    this.toastText = '';
    this.toastTime = 0;
    this.pauseIndex = 0;
    this.menuIdle = 0;
    this.demoTime = 0;
    this.resetHold = 0;
    this.playTime = 0;
    this.breakNotice = false;

    this.settings = storage.getSettings();
    this.applySettings();

    this.menu = catalog.createMenu(this, this.settings.lastSlot);
    this.options = new OptionsScreen(this);
    this.launchScreen = new LaunchScreen(this);
    this.myGames = new MyGamesScreen(this);
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
    this.input.setHaptics(s.haptics);
    this.fx.shakeEnabled = !!s.shake;
    this.fx.flashEnabled = !!s.flashes;
    this.input.setRepeatSpeed(s.repeat);
    document.documentElement.dataset.big = s.bigButtons ? '1' : '0';
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
    this._present();
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

  _present() {
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
    ctx.drawImage(this.buffer, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, ox, oy, w, h);
  }

  /** Aplica un modo visual a la pantalla, la carcasa (atributo data-skin) y el sonido. */
  setTheme(theme) {
    this.gfx.setTheme(theme);
    this.theme = this.gfx.theme;
    document.documentElement.dataset.skin = this.theme;
    this.screenEl.style.background = this.gfx.palette.bg;
    this.sound.setFlavor(THEME_SOUND[this.theme]);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_CHROME[this.theme]);
  }

  /** Pasa al siguiente modo visual (Retro → Futurista → Cristal). */
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
    this._syncKeepAwake();
  }

  goToMenu() {
    this._unloadCartridge();
    this._restoreSfx();
    this.fx.reset();
    this.menu.onEnter();
    this.sound.playMusic('menu');
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

  /** Pantalla PREPARADO: controles, velocidad, nivel y favorito antes de jugar. */
  openLaunch(slot) {
    this.launchScreen.open(slot);
    this._setState(STATES.LAUNCH);
  }

  /** MIS JUEGOS: favoritos y recientes. */
  openMyGames() {
    this.myGames.onEnter();
    this._setState(STATES.MYGAMES);
  }

  /** Vuelve al menú sin tocar la música (desde PREPARADO o MIS JUEGOS). */
  closeToMenu() {
    this.menu.onEnter();
    this._setState(STATES.MENU);
  }

  /** Pantalla de atracción: se alternan logo, récords, juegos y demos jugadas por la consola. */
  startAttract() {
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
    this.sound.melody('start');
    this.sound.playMusic(slot.engine.id);
    this._setState(STATES.PLAYING);
  }

  restart() {
    if (this.currentSlot) this.launch(this.currentSlot);
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
    this.sound.stopMusic();
    if (submit.isHighScore) {
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
          this.sound.sfx('confirm');
          this.goToMenu();
        }
        break;

      case STATES.MENU:
        this.menu.handleAction(e);
        break;

      case STATES.OPTIONS:
        this.options.handleAction(e);
        break;

      case STATES.LAUNCH:
        this.launchScreen.handleAction(e);
        break;

      case STATES.MYGAMES:
        this.myGames.handleAction(e);
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

      case STATES.GAMEOVER:
        if (!pressed || repeat || this.stateTime < 0.8) return;
        if (action === ACTIONS.A || action === ACTIONS.START) {
          this.sound.sfx('confirm');
          this.restart();
        } else if (action === ACTIONS.B) {
          this.sound.sfx('back');
          this.goToMenu();
        }
        break;

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

  _onVisibility() {
    if (document.hidden) {
      this.input.releaseAll();
      this.pause();
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
      case STATES.LAUNCH:
      case STATES.MYGAMES:
        this.closeToMenu();
        return true;
      case STATES.INITIALS:
        this.initials.confirm();
        return true;
      case STATES.GAMEOVER:
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
        if (this.stateTime >= BOOT_DURATION) this.goToMenu();
        break;
      case STATES.MENU:
        this.menu.update(dt);
        this.menuIdle += dt;
        if (this.settings.demo && this.menuIdle >= MENU_IDLE_FOR_DEMO) this.startAttract();
        break;
      case STATES.OPTIONS:
        this.options.update(dt);
        break;
      case STATES.LAUNCH:
        this.launchScreen.update(dt);
        break;
      case STATES.MYGAMES:
        this.myGames.update(dt);
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
        this._tickCartridge(dt, false);
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

    if (this.led) {
      const blink = this.state === STATES.PAUSED ? Math.floor(this.time * 2) % 2 === 0 : true;
      this.led.classList.toggle('is-on', this.state !== STATES.BOOT ? blink : this.stateTime > BOOT_LED_ON);
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
      case STATES.LAUNCH:
        this.launchScreen.render(g);
        break;
      case STATES.MYGAMES:
        this.myGames.render(g);
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
    const label = slot && slot.daily ? 'DESAFIO' : `JUEGO ${slot ? slot.code : '00'}`;
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
      const empty = g.palette.cellStyle === 'neon' ? 'mid' : 'ghost';
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

    if (this.stateTime >= 0.8) {
      g.text('A: OTRA VEZ   B: MENU', SCREEN_WIDTH / 2, y + h - 12, { align: 'center' });
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

  _renderToast(g) {
    if (this.toastTime <= 0 || !this.toastText) return;
    const w = g.textWidth(this.toastText) + 10;
    const x = Math.floor((SCREEN_WIDTH - w) / 2);
    g.rect(x, 2, w, 11, 'ink');
    g.text(this.toastText, SCREEN_WIDTH / 2, 5, { align: 'center', color: 'bg' });
  }
}
