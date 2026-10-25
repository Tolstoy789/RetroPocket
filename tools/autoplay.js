// tools/autoplay.js
// Juega slots con la IA del modo demo fuera del navegador, en Node, para las pruebas automáticas y el
// informe de dificultad. Vite carga los módulos del juego igual que en la app (import.meta.glob incluido);
// la consola es una de mentira: sin sonido, sin vibración, sin guardar nada y con un lienzo que no pinta.

import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const STEP = 1 / 60;

/** Contexto 2D que acepta todas las llamadas y no pinta nada (para probar que render() no falla). */
function nullContext(width, height) {
  const noop = () => {};
  const target = {
    canvas: { width, height },
    measureText: (text) => ({ width: String(text).length * 4 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) })
  };
  return new Proxy(target, {
    get: (obj, key) => (key in obj ? obj[key] : noop),
    set: (obj, key, value) => {
      obj[key] = value;
      return true;
    }
  });
}

/**
 * Arranca Vite en modo módulo (sin servidor HTTP) y carga lo que hace falta para jugar.
 * Devuelve { catalog, themes, newGfx(), Cartridge(slot), close() }.
 */
export async function openConsole() {
  const server = await createServer({
    root: ROOT,
    configFile: false,
    logLevel: 'error',
    appType: 'custom',
    define: { __APP_VERSION__: JSON.stringify('autoplay') },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }
  });
  const { Catalog99 } = await server.ssrLoadModule('/src/core/Catalog99.js');
  const { Gfx, FxLayer, SCREEN_WIDTH, SCREEN_HEIGHT } = await server.ssrLoadModule('/src/core/ConsoleEngine.js');
  const { THEMES } = await server.ssrLoadModule('/src/core/Themes.js');
  const catalog = new Catalog99();
  const classes = new Map();
  return {
    catalog,
    themes: THEMES,
    FxLayer,
    newGfx: () => new Gfx(nullContext(SCREEN_WIDTH, SCREEN_HEIGHT), SCREEN_WIDTH, SCREEN_HEIGHT),
    async Cartridge(slot) {
      if (!classes.has(slot.engine.id)) classes.set(slot.engine.id, await catalog.loadCartridge(slot));
      return classes.get(slot.engine.id);
    },
    close: () => server.close()
  };
}

/**
 * Juega una partida con la IA. `seconds` es el tope de tiempo de juego; `renderEvery` > 0 dibuja cada
 * N pasos en `gfx`. Devuelve { score, level, seconds, ended, won, message }.
 */
export function playSlot(con, Cartridge, slot, { seed = 1, seconds = 120, gfx = null, renderEvery = 0 } = {}) {
  const fx = new con.FxLayer();
  const mute = () => 0;
  let result = null;
  const host = {
    sound: { sfx: mute, melody: mute },
    input: { isDown: () => false, vibrate: mute, vibratePattern: mute },
    storage: { getHighScore: () => 0 },
    fx,
    progress: null,
    settings: {},
    endGame: (r) => {
      if (!result) result = r;
    }
  };
  const cart = new Cartridge(host, { ...slot, seed });
  cart.demo = true;
  cart.init();
  let steps = 0;
  const maxSteps = Math.round(seconds / STEP);
  while (!result && steps < maxSteps) {
    cart.autopilot(STEP);
    cart.tick(STEP);
    fx.update(STEP);
    steps++;
    if (gfx && renderEvery > 0 && steps % renderEvery === 0) {
      cart.render(gfx);
      fx.render(gfx);
    }
  }
  cart.destroy();
  return {
    score: Math.floor(result ? result.score : cart.score),
    level: result ? result.level : cart.level,
    seconds: steps * STEP,
    ended: !!result,
    won: !!result?.won,
    message: result?.message || ''
  };
}
