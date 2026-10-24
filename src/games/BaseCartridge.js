// src/games/BaseCartridge.js
// Clase base de todos los motores de juego ("cartuchos").
//
// Contrato que ConsoleEngine usa con cada cartucho:
//   new Cartridge(engine, slot)   slot = { number, code, label, engine, variantConfig }
//   init()                         se llama una vez al insertar el cartucho
//   tick(dt)                       paso fijo de 1/60 s mientras el estado es PLAYING
//   render(gfx)                    dibuja el frame (también durante PAUSA y GAME OVER)
//   handleInput({ action, pressed, repeat })
//   onPause() / onResume()
//   destroy()
//
// Los juegos sobrescriben los "ganchos": reset(), update(dt), draw(gfx), onInput(event)
// y opcionalmente onPause(), onResume(), onDestroy() y autopilot(dt) (IA del modo demo).
//
// Efectos disponibles para todos: this.shake(), this.flash(), this.burst() (ver FxLayer).
// En el desafío diario this.rng usa la semilla del día: misma partida para todos.

import { ACTIONS } from '../core/InputManager.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../core/ConsoleEngine.js';

export { ACTIONS, SCREEN_WIDTH, SCREEN_HEIGHT };

/** Generador pseudoaleatorio con semilla (mulberry32): partidas reproducibles si se desea. */
export function createRng(seed = Date.now()) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class BaseCartridge {
  /**
   * @param {import('../core/ConsoleEngine.js').ConsoleEngine} engine
   * @param {object} slot Entrada de Catalog99 con variantConfig.
   */
  constructor(engine, slot) {
    this.engine = engine;
    this.slot = slot;
    this.config = slot.variantConfig;
    this.sound = engine.sound;
    this.input = engine.input;
    this.storage = engine.storage;
    this.width = SCREEN_WIDTH;
    this.height = SCREEN_HEIGHT;

    this.score = 0;
    this.level = 1;
    this.lives = 1;
    this.time = 0;
    this.finished = false;
    this.highScore = this.storage.getHighScore(slot.key ?? slot.number);
    this.beatHighScore = false;
    this.demo = false;
    this.rng = createRng(slot.seed ?? Date.now());
    this._timers = [];
    this._autoHeld = null;
    this._autoTimer = 0;
  }

  // ---------- Contrato con ConsoleEngine (no sobrescribir) ----------

  init() {
    this.score = 0;
    this.time = 0;
    this.finished = false;
    this.beatHighScore = false;
    this._timers = [];
    this.rng = createRng(this.slot.seed ?? Date.now());
    this.lives = Number.isFinite(this.config.lives) ? this.config.lives : 1;
    this.level = Number.isFinite(this.config.startLevel) ? this.config.startLevel : 1;
    this.reset();
  }

  tick(dt) {
    if (this.finished) return;
    this.time += dt;
    this._runTimers(dt);
    if (this.finished) return;
    this.update(dt);
  }

  render(gfx) {
    this.draw(gfx);
  }

  handleInput(event) {
    if (this.finished) return;
    this.onInput(event);
  }

  destroy() {
    this._timers = [];
    this.onDestroy();
  }

  // ---------- Ganchos para los juegos ----------

  /** Prepara una partida nueva (tablero, posiciones, etc.). */
  reset() {}

  /** Lógica del juego. dt en segundos (paso fijo 1/60). */
  update(dt) {
    void dt;
  }

  /** Dibuja el juego completo. */
  draw(gfx) {
    gfx.clear();
  }

  /** Eventos de botones: { action, pressed, repeat }. START y SOUND/RESET los gestiona la consola. */
  onInput(event) {
    void event;
  }

  onPause() {}

  onResume() {}

  onDestroy() {}

  /**
   * IA del modo demo. Por defecto mantiene direcciones al azar y pulsa A de vez en cuando;
   * los motores pueden sobrescribirla con una IA específica que llame a this.handleInput().
   */
  autopilot(dt) {
    this._autoTimer -= dt;
    if (this._autoTimer > 0) return;
    this._autoTimer = this.random(0.15, 0.6);
    if (this._autoHeld) {
      this.handleInput({ action: this._autoHeld, pressed: false, repeat: false });
      this._autoHeld = null;
    }
    if (this.chance(0.3)) {
      this.handleInput({ action: ACTIONS.A, pressed: true, repeat: false });
      this.handleInput({ action: ACTIONS.A, pressed: false, repeat: false });
    }
    if (this.chance(0.7)) {
      this._autoHeld = this.pick([ACTIONS.LEFT, ACTIONS.RIGHT, ACTIONS.UP, ACTIONS.DOWN]);
      this.handleInput({ action: this._autoHeld, pressed: true, repeat: false });
    }
  }

  /** ¿Está pulsada la acción? Funciona también con la IA del modo demo. */
  isDown(action) {
    return this.demo ? this._autoHeld === action : this.input.isDown(action);
  }

  // ---------- Efectos (sacudida, destellos, partículas) ----------

  shake(magnitude = 2, duration = 0.25) {
    this.engine.fx.shake(magnitude, duration);
  }

  flash(color = 'white', duration = 0.12, alpha = 0.6) {
    this.engine.fx.flash(color, duration, alpha);
  }

  /** Partículas en (x, y). options: { color, count, speed, life, gravity, spread, angle } */
  burst(x, y, options = {}) {
    this.engine.fx.burst(x, y, options);
  }

  // ---------- Utilidades de partida ----------

  addScore(points) {
    this.score = Math.max(0, Math.floor(this.score + points));
    if (!this.beatHighScore && this.highScore > 0 && this.score > this.highScore) {
      this.beatHighScore = true;
      this.sound.sfx('coin');
    }
    return this.score;
  }

  /** Resta una vida. Devuelve las vidas restantes; si llega a 0 termina la partida. */
  loseLife(message = '') {
    this.lives = Math.max(0, this.lives - 1);
    this.input.vibrate('heavy');
    this.shake(3, 0.35);
    this.flash('red', 0.2, 0.5);
    if (this.lives <= 0) this.gameOver({ message });
    return this.lives;
  }

  levelUp() {
    this.level += 1;
    this.sound.sfx('levelup');
    this.input.vibrate('medium');
    this.flash('white', 0.25, 0.45);
    return this.level;
  }

  /** Termina la partida como derrota. */
  gameOver({ message = '' } = {}) {
    if (this.finished) return;
    this.finished = true;
    this.engine.endGame({ score: this.score, level: this.level, won: false, message });
  }

  /** Termina la partida como victoria (por ejemplo, en modos con objetivo). */
  win({ message = '' } = {}) {
    if (this.finished) return;
    this.finished = true;
    this.engine.endGame({ score: this.score, level: this.level, won: true, message });
  }

  // ---------- Temporizadores (avanzan solo mientras se juega) ----------

  /** Ejecuta fn tras `seconds`. Devuelve un id para cancelar. */
  after(seconds, fn) {
    const timer = { remaining: seconds, interval: 0, fn, id: Symbol('timer') };
    this._timers.push(timer);
    return timer.id;
  }

  /** Ejecuta fn cada `seconds`. Devuelve un id para cancelar. */
  every(seconds, fn) {
    const timer = { remaining: seconds, interval: seconds, fn, id: Symbol('timer') };
    this._timers.push(timer);
    return timer.id;
  }

  cancelTimer(id) {
    this._timers = this._timers.filter((t) => t.id !== id);
  }

  _runTimers(dt) {
    if (this._timers.length === 0) return;
    const due = [];
    for (const timer of this._timers) {
      timer.remaining -= dt;
      if (timer.remaining <= 0) due.push(timer);
    }
    for (const timer of due) {
      if (timer.interval > 0) {
        timer.remaining += timer.interval;
      } else {
        this._timers = this._timers.filter((t) => t !== timer);
      }
      timer.fn();
    }
  }

  // ---------- Azar ----------

  random(min = 0, max = 1) {
    return min + this.rng() * (max - min);
  }

  randInt(min, max) {
    return Math.floor(min + this.rng() * (max - min + 1));
  }

  pick(list) {
    return list[Math.floor(this.rng() * list.length)];
  }

  chance(probability) {
    return this.rng() < probability;
  }

  // ---------- Utilidades de dibujo ----------

  /**
   * Tablero de celdas estilo Brick Game.
   * @param {Array<Array<any>>} grid grid[fila][columna]; valor falsy = apagada, true = 'on', string = color.
   */
  drawGrid(gfx, grid, x, y, size) {
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r];
      for (let c = 0; c < row.length; c++) {
        const v = row[c];
        gfx.cell(x + c * size, y + r * size, size, v ? (v === true ? 'on' : v) : 'off');
      }
    }
  }

  /**
   * Panel lateral clásico: puntos, récord, nivel, vidas y mini-vista opcional.
   * @param {object} [o] { width, next: string[] (sprite), nextLabel, extra: [[label, value], ...] }
   */
  drawHud(gfx, x, y, o = {}) {
    const width = o.width || 50;
    let cy = y;
    const line = (label, value) => {
      gfx.text(label, x, cy, { color: 'mid' });
      gfx.text(String(value), x + width, cy + 7, { align: 'right' });
      cy += 17;
    };
    line('PUNTOS', String(this.score).padStart(6, '0'));
    line('RECORD', String(Math.max(this.highScore, this.score)).padStart(6, '0'));
    line('NIVEL', String(this.level).padStart(2, '0'));
    if (o.showLives !== false) {
      gfx.text('VIDAS', x, cy, { color: 'mid' });
      gfx.text('♥'.repeat(Math.min(5, this.lives)) || '-', x + width, cy + 7, { align: 'right', color: 'red' });
      cy += 17;
    }
    if (o.extra) {
      for (const [label, value] of o.extra) line(label, value);
    }
    if (o.next) {
      gfx.text(o.nextLabel || 'SIGUIENTE', x, cy, { color: 'mid' });
      gfx.sprite(o.next, x + 4, cy + 8, { scale: o.nextScale || 4, colors: o.nextColors });
      cy += 8 + o.next.length * (o.nextScale || 4) + 4;
    }
    gfx.text(this.slot.daily ? 'HOY' : this.slot.code, x, this.height - 10, { color: 'mid' });
    gfx.text(this.slot.label, x + width, this.height - 10, { align: 'right', color: 'mid' });
    return cy;
  }
}

export default BaseCartridge;
