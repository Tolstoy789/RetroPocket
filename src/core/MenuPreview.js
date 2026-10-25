// src/core/MenuPreview.js
// Miniatura animada del juego elegido en el menú: el cartucho real jugado por su IA del modo demo,
// dibujado en una pantalla aparte de 144x192 que el menú pinta a mitad de tamaño (72x96).
// El cartucho no hace ruido ni vibra, no guarda nada y no toca la pantalla de verdad: recibe una
// consola "de mentira" con sonido mudo, sus propios efectos y un fin de partida que la reinicia.

import { Gfx, FxLayer, SCREEN_WIDTH, SCREEN_HEIGHT } from './ConsoleEngine.js';

const SETTLE = 0.3; // segundos quieto en un slot antes de cargar su miniatura
const STEP = 1 / 60;
const MAX_STEPS = 4;
const RESTART_AFTER = 0.8; // pausa tras un fin de partida antes de volver a empezar

export class MenuPreview {
  /** @param {import('./ConsoleEngine.js').ConsoleEngine} engine */
  constructor(engine) {
    this.engine = engine;
    this.canvas = document.createElement('canvas');
    this.canvas.width = SCREEN_WIDTH;
    this.canvas.height = SCREEN_HEIGHT;
    this.gfx = new Gfx(this.canvas.getContext('2d', { alpha: false }), SCREEN_WIDTH, SCREEN_HEIGHT);
    this.fx = new FxLayer();
    this.fx.shakeEnabled = false;
    this.slot = null;
    this.cart = null;
    this.Cartridge = null;
    this.wait = 0;
    this.token = 0;
    this.ended = 0;
    this.accumulator = 0;
    const mute = () => 0;
    // Lo que usan los cartuchos de la consola (ver BaseCartridge).
    this.host = {
      sound: { sfx: mute, melody: mute },
      input: { isDown: () => false, vibrate: mute, vibratePattern: mute },
      storage: engine.storage,
      fx: this.fx,
      progress: null,
      endGame: () => {
        if (!this.ended) this.ended = RESTART_AFTER;
      }
    };
  }

  /** Elige el slot que se previsualiza; la miniatura se carga cuando el menú se queda quieto. */
  show(slot) {
    if (this.slot && slot && this.slot.key === slot.key) return;
    this.stop();
    this.slot = slot;
    this.wait = SETTLE;
  }

  /** Suelta el cartucho (al salir del menú). */
  stop() {
    this.token++;
    this._destroyCart();
    this.slot = null;
    this.Cartridge = null;
  }

  _destroyCart() {
    if (this.cart) {
      try {
        this.cart.destroy();
      } catch {
        // La miniatura nunca debe romper el menú.
      }
    }
    this.cart = null;
  }

  async _load(slot) {
    const token = ++this.token;
    let Cartridge = null;
    try {
      Cartridge = await this.engine.catalog.loadCartridge(slot);
    } catch {
      Cartridge = null;
    }
    if (token !== this.token || !Cartridge) return;
    this.Cartridge = Cartridge;
    this._start();
  }

  _start() {
    this._destroyCart();
    this.fx.reset();
    this.fx.flashEnabled = this.engine.fx.flashEnabled;
    this.ended = 0;
    this.accumulator = 0;
    try {
      this.cart = new this.Cartridge(this.host, this.slot);
      this.cart.demo = true;
      this.cart.init();
    } catch {
      this.cart = null;
      this.Cartridge = null;
    }
  }

  update(dt) {
    if (!this.slot) return;
    if (!this.Cartridge) {
      if (this.wait > 0) {
        this.wait -= dt;
        if (this.wait <= 0) this._load(this.slot);
      }
      return;
    }
    if (!this.cart) return;
    if (this.ended > 0) {
      this.ended -= dt;
      if (this.ended <= 0) this._start();
      return;
    }
    this.accumulator += dt;
    let steps = 0;
    try {
      while (this.accumulator >= STEP && steps < MAX_STEPS) {
        this.cart.autopilot(STEP);
        this.cart.tick(STEP);
        this.fx.update(STEP);
        this.accumulator -= STEP;
        steps++;
      }
    } catch {
      this._destroyCart();
      this.Cartridge = null;
      this.slot = null;
    }
    if (steps === MAX_STEPS) this.accumulator = 0;
  }

  /**
   * Pinta la miniatura en (x, y) a mitad de tamaño. Devuelve false si aún no hay miniatura
   * (el menú dibuja entonces el icono del motor).
   */
  render(g, x, y) {
    if (!this.cart) return false;
    const src = this.engine.gfx;
    const pg = this.gfx;
    if (pg.theme !== src.theme || pg.colorblind !== src.colorblind || pg.highContrast !== src.highContrast) {
      pg.colorblind = src.colorblind;
      pg.highContrast = src.highContrast;
      pg.setTheme(src.theme);
    }
    try {
      this.cart.render(pg);
      this.fx.render(pg);
    } catch {
      return false;
    }
    g.image(this.canvas, x, y, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, { smooth: true });
    return true;
  }
}
