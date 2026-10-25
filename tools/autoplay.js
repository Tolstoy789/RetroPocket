// tools/autoplay.js
// Juega slots fuera del navegador, en Node, con la IA del modo demo o pulsando botones al azar, para las
// pruebas automáticas (npm test) y el informe de dificultad. Vite carga los módulos del juego igual que en la app (import.meta.glob incluido);
// la consola es una de mentira: sin sonido, sin vibración, sin guardar nada y con un lienzo que no pinta.

import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const STEP = 1 / 60;

/** Llamadas de dibujo que no deben recibir coordenadas NaN o infinitas (el navegador las ignoraría sin avisar). */
const CHECKED = new Set(['fillRect', 'strokeRect', 'clearRect', 'drawImage', 'moveTo', 'lineTo', 'arc', 'rect', 'fillText', 'translate', 'scale']);

/**
 * Contexto 2D que acepta todas las llamadas y no pinta nada (para probar que render() no falla).
 * Si una llamada de dibujo recibe un número no finito, lanza un error que dice cuál.
 */
function nullContext(width, height) {
  const noop = () => {};
  const checked = (name) => (...args) => {
    if (args.some((a) => typeof a === 'number' && !Number.isFinite(a))) throw new RangeError(`${name}(${args.join(', ')}) con un número no finito`);
  };
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
    get: (obj, key) => (key in obj ? obj[key] : CHECKED.has(key) ? checked(key) : noop),
    set: (obj, key, value) => {
      obj[key] = value;
      return true;
    }
  });
}

/**
 * Arranca Vite en modo módulo (sin servidor HTTP) y carga lo que hace falta para jugar.
 * Devuelve { catalog, themes, actions, FxLayer, newGfx(), Cartridge(slot), load(path), close() }.
 * `load('/src/core/Progress.js')` carga cualquier otro módulo del juego.
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
  const { ACTIONS } = await server.ssrLoadModule('/src/core/InputManager.js');
  const catalog = new Catalog99();
  const classes = new Map();
  return {
    catalog,
    themes: THEMES,
    actions: ACTIONS,
    FxLayer,
    newGfx: () => new Gfx(nullContext(SCREEN_WIDTH, SCREEN_HEIGHT), SCREEN_WIDTH, SCREEN_HEIGHT),
    async Cartridge(slot) {
      if (!classes.has(slot.engine.id)) classes.set(slot.engine.id, await catalog.loadCartridge(slot));
      return classes.get(slot.engine.id);
    },
    load: (path) => server.ssrLoadModule(path),
    close: () => server.close()
  };
}

/** Generador pseudoaleatorio pequeño (mulberry32) para que las pulsaciones al azar se repitan igual. */
function randomSource(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Juega una partida. `seconds` es el tope de tiempo de juego; `renderEvery` > 0 dibuja cada N pasos en `gfx`.
 * Con `input: 'ai'` juega la IA del modo demo; con `input: 'random'` se pulsan y sueltan botones al azar
 * (como un jugador, sin modo demo) y de vez en cuando se pausa y se reanuda.
 * Devuelve { score, level, seconds, ended, won, message }.
 */
export function playSlot(con, Cartridge, slot, { seed = 1, seconds = 120, gfx = null, renderEvery = 0, input = 'ai' } = {}) {
  const fx = new con.FxLayer();
  const mute = () => 0;
  const held = new Set();
  let result = null;
  const host = {
    sound: { sfx: mute, melody: mute },
    input: { isDown: (action) => held.has(action), vibrate: mute, vibratePattern: mute },
    storage: { getHighScore: () => 0 },
    fx,
    progress: { track: mute, peak: mute },
    settings: {},
    endGame: (r) => {
      if (!result) result = r;
    }
  };
  const cart = new Cartridge(host, { ...slot, seed });
  const random = input === 'random' ? randomSource(seed ^ 0x9e3779b9) : null;
  const buttons = con.actions ? [con.actions.UP, con.actions.DOWN, con.actions.LEFT, con.actions.RIGHT, con.actions.A, con.actions.B, con.actions.C] : [];
  cart.demo = !random;
  cart.init();
  let steps = 0;
  const maxSteps = Math.round(seconds / STEP);
  while (!result && steps < maxSteps) {
    if (random) {
      if (random() < 0.12) {
        const action = buttons[Math.floor(random() * buttons.length)];
        const pressed = !held.has(action);
        if (pressed) held.add(action);
        else held.delete(action);
        cart.handleInput({ action, pressed, repeat: false });
      } else if (held.size && random() < 0.05) {
        const action = [...held][Math.floor(random() * held.size)];
        cart.handleInput({ action, pressed: true, repeat: true });
      }
      if (random() < 0.002) {
        cart.onPause();
        cart.onResume();
      }
    } else {
      cart.autopilot(STEP);
    }
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
