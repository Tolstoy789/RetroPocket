// src/core/InputManager.js
// Entrada unificada: botones táctiles multitáctiles (Pointer Events), teclado, mandos (Gamepad API)
// y respuesta háptica (Capacitor Haptics en Android nativo, navigator.vibrate en web).

import { Capacitor } from '@capacitor/core';

export const ACTIONS = Object.freeze({
  UP: 'UP',
  DOWN: 'DOWN',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  A: 'A',
  B: 'B',
  C: 'C', // tercer botón (teclado y mando): guardar pieza en Block Drop; en táctil equivale a A+B
  START: 'START',
  SOUND: 'SOUND',
  RESET: 'RESET'
});

const ALL_ACTIONS = Object.values(ACTIONS);
const DIRECTIONS = [ACTIONS.UP, ACTIONS.DOWN, ACTIONS.LEFT, ACTIONS.RIGHT];

const DEFAULT_KEYMAP = {
  ArrowUp: ACTIONS.UP,
  KeyW: ACTIONS.UP,
  ArrowDown: ACTIONS.DOWN,
  KeyS: ACTIONS.DOWN,
  ArrowLeft: ACTIONS.LEFT,
  KeyA: ACTIONS.LEFT,
  ArrowRight: ACTIONS.RIGHT,
  KeyD: ACTIONS.RIGHT,
  KeyZ: ACTIONS.A,
  KeyJ: ACTIONS.A,
  Space: ACTIONS.A,
  KeyX: ACTIONS.B,
  KeyK: ACTIONS.B,
  KeyC: ACTIONS.C,
  KeyL: ACTIONS.C,
  ShiftLeft: ACTIONS.C,
  ShiftRight: ACTIONS.C,
  Enter: ACTIONS.START,
  KeyP: ACTIONS.START,
  KeyM: ACTIONS.SOUND,
  Backspace: ACTIONS.RESET,
  Escape: ACTIONS.RESET
};

// Mapeo "standard" de la Gamepad API.
const GAMEPAD_BUTTONS = {
  0: ACTIONS.A,
  1: ACTIONS.B,
  2: ACTIONS.B,
  3: ACTIONS.A,
  4: ACTIONS.C,
  5: ACTIONS.C,
  8: ACTIONS.SOUND,
  9: ACTIONS.START,
  12: ACTIONS.UP,
  13: ACTIONS.DOWN,
  14: ACTIONS.LEFT,
  15: ACTIONS.RIGHT,
  16: ACTIONS.RESET
};

/** Velocidades de auto-repetición de la cruceta: [retardo inicial, intervalo] en segundos. */
export const REPEAT_SPEEDS = {
  slow: [0.38, 0.12],
  normal: [0.26, 0.07],
  fast: [0.18, 0.045]
};
const DPAD_DEAD_ZONE = 0.15;
// Zona entre A y B (en proporción de la distancia B→A) donde el pulgar pulsa ambos a la vez.
const AB_BOTH_FROM = 0.36;
const AB_BOTH_TO = 0.64;

export class InputManager {
  /**
   * @param {object} options
   * @param {HTMLElement} options.root Elemento que contiene los botones con atributo data-action.
   * @param {HTMLElement} [options.dpad] Contenedor de la cruceta (permite deslizar el dedo entre direcciones).
   * @param {HTMLElement} [options.actionsZone] Zona de A/B: toda el área cuenta, se puede deslizar
   *   el pulgar de un botón a otro y el punto medio pulsa los dos a la vez.
   * @param {boolean} [options.haptics] Activar vibración al pulsar.
   */
  constructor({ root, dpad = null, actionsZone = null, haptics = true } = {}) {
    this.root = root || document.body;
    this.dpad = dpad;
    this.actionsZone = actionsZone;
    this.repeatDelay = REPEAT_SPEEDS.normal[0];
    this.repeatRate = REPEAT_SPEEDS.normal[1];
    this.hapticsEnabled = haptics;
    this.keymap = { ...DEFAULT_KEYMAP };

    // Cada acción puede estar pulsada por varias fuentes a la vez (dedo, tecla, mando).
    this.sources = new Map(ALL_ACTIONS.map((a) => [a, new Set()]));
    this.pressedEdge = new Set();
    this.releasedEdge = new Set();
    this.repeatTimers = new Map();
    this.listeners = new Set();
    this.pointerActions = new Map();
    this.gamepadState = new Map();
    this.buttonElements = new Map();
    this.nativeHaptics = null;
    this.enabled = true;

    for (const el of this.root.querySelectorAll('[data-action]')) {
      const action = el.dataset.action;
      if (!this.buttonElements.has(action)) this.buttonElements.set(action, []);
      this.buttonElements.get(action).push(el);
    }

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._preventDefault = (e) => e.preventDefault();

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    this.root.addEventListener('pointerdown', this._onPointerDown);
    this.root.addEventListener('pointermove', this._onPointerMove);
    this.root.addEventListener('pointerup', this._onPointerUp);
    this.root.addEventListener('pointercancel', this._onPointerUp);
    this.root.addEventListener('lostpointercapture', this._onPointerUp);
    this.root.addEventListener('contextmenu', this._preventDefault);
    this.root.addEventListener('touchstart', this._preventDefault, { passive: false });

    this._loadNativeHaptics();
  }

  async _loadNativeHaptics() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const mod = await import('@capacitor/haptics');
      this.nativeHaptics = mod;
    } catch {
      this.nativeHaptics = null;
    }
  }

  // ---------- API pública ----------

  /** Suscribe un oyente: fn({ action, pressed, repeat }). Devuelve la función para desuscribirse. */
  onAction(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** ¿Está la acción pulsada ahora mismo? */
  isDown(action) {
    return this.sources.get(action)?.size > 0;
  }

  /** Devuelve true una sola vez por pulsación (se consume al leerla). */
  consume(action) {
    if (this.pressedEdge.has(action)) {
      this.pressedEdge.delete(action);
      return true;
    }
    return false;
  }

  /** Devuelve true una sola vez por liberación (se consume al leerla). */
  consumeRelease(action) {
    if (this.releasedEdge.has(action)) {
      this.releasedEdge.delete(action);
      return true;
    }
    return false;
  }

  /** Eje horizontal -1, 0, 1 según la cruceta. */
  get axisX() {
    return (this.isDown(ACTIONS.RIGHT) ? 1 : 0) - (this.isDown(ACTIONS.LEFT) ? 1 : 0);
  }

  /** Eje vertical -1, 0, 1 según la cruceta. */
  get axisY() {
    return (this.isDown(ACTIONS.DOWN) ? 1 : 0) - (this.isDown(ACTIONS.UP) ? 1 : 0);
  }

  /** Limpia las pulsaciones pendientes de consumir (al cambiar de pantalla o de juego). */
  clearEdges() {
    this.pressedEdge.clear();
    this.releasedEdge.clear();
  }

  /** Suelta todas las acciones (por ejemplo, cuando la app pasa a segundo plano). */
  releaseAll() {
    for (const action of ALL_ACTIONS) {
      if (this.isDown(action)) {
        this.sources.get(action).clear();
        this._emit(action, false, false);
      }
    }
    this.pointerActions.clear();
    this.repeatTimers.clear();
    this.clearEdges();
    this._refreshVisuals();
  }

  /** 'slow' | 'normal' | 'fast' */
  setRepeatSpeed(speed) {
    const [delay, rate] = REPEAT_SPEEDS[speed] || REPEAT_SPEEDS.normal;
    this.repeatDelay = delay;
    this.repeatRate = rate;
  }

  setHaptics(enabled) {
    this.hapticsEnabled = !!enabled;
  }

  /** Vibración corta. intensity: 'light' | 'medium' | 'heavy'. */
  vibrate(intensity = 'light') {
    if (!this.hapticsEnabled) return;
    const ms = intensity === 'heavy' ? 40 : intensity === 'medium' ? 22 : 10;
    if (this.nativeHaptics) {
      const style =
        intensity === 'heavy'
          ? this.nativeHaptics.ImpactStyle.Heavy
          : intensity === 'medium'
            ? this.nativeHaptics.ImpactStyle.Medium
            : this.nativeHaptics.ImpactStyle.Light;
      this.nativeHaptics.Haptics.impact({ style }).catch(() => {});
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(ms);
      } catch {
        // Algunos navegadores bloquean la vibración sin gesto del usuario.
      }
    }
  }

  /** Patrón de vibración largo (por ejemplo, al perder). */
  vibratePattern(pattern) {
    if (!this.hapticsEnabled) return;
    if (this.nativeHaptics) {
      const total = pattern.reduce((sum, v, i) => (i % 2 === 0 ? sum + v : sum), 0);
      this.nativeHaptics.Haptics.vibrate({ duration: Math.min(1000, total) }).catch(() => {});
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Sin soporte de vibración.
      }
    }
  }

  /** Avanza la auto-repetición y lee los mandos. Llamar una vez por frame con dt en segundos. */
  update(dt) {
    this._pollGamepads();
    for (const [action, timer] of this.repeatTimers) {
      if (!this.isDown(action)) {
        this.repeatTimers.delete(action);
        continue;
      }
      timer.time -= dt;
      while (timer.time <= 0) {
        timer.time += this.repeatRate;
        this._emit(action, true, true);
      }
    }
  }

  /** Simula una pulsación desde código (útil para el botón "atrás" de Android). */
  tap(action) {
    this._press(action, 'virtual');
    this._release(action, 'virtual');
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.root.removeEventListener('pointerdown', this._onPointerDown);
    this.root.removeEventListener('pointermove', this._onPointerMove);
    this.root.removeEventListener('pointerup', this._onPointerUp);
    this.root.removeEventListener('pointercancel', this._onPointerUp);
    this.root.removeEventListener('lostpointercapture', this._onPointerUp);
    this.root.removeEventListener('contextmenu', this._preventDefault);
    this.root.removeEventListener('touchstart', this._preventDefault);
    this.listeners.clear();
  }

  // ---------- Núcleo ----------

  _press(action, source) {
    if (!this.enabled || !this.sources.has(action)) return;
    const set = this.sources.get(action);
    const wasDown = set.size > 0;
    set.add(source);
    if (wasDown) return;
    this.pressedEdge.add(action);
    if (DIRECTIONS.includes(action)) this.repeatTimers.set(action, { time: this.repeatDelay });
    this.vibrate('light');
    this._emit(action, true, false);
    this._refreshVisuals();
  }

  _release(action, source) {
    if (!this.sources.has(action)) return;
    const set = this.sources.get(action);
    if (!set.delete(source) || set.size > 0) return;
    this.releasedEdge.add(action);
    this.repeatTimers.delete(action);
    this._emit(action, false, false);
    this._refreshVisuals();
  }

  _emit(action, pressed, repeat) {
    const event = { action, pressed, repeat };
    for (const fn of this.listeners) fn(event);
  }

  _refreshVisuals() {
    for (const [action, elements] of this.buttonElements) {
      const down = this.isDown(action);
      for (const el of elements) el.classList.toggle('is-pressed', down);
    }
  }

  // ---------- Teclado ----------

  _onKeyDown(e) {
    const action = this.keymap[e.code];
    if (!action) return;
    e.preventDefault();
    if (e.repeat) return;
    this._press(action, `key:${e.code}`);
  }

  _onKeyUp(e) {
    const action = this.keymap[e.code];
    if (!action) return;
    e.preventDefault();
    this._release(action, `key:${e.code}`);
  }

  _onBlur() {
    this.releaseAll();
  }

  // ---------- Táctil / ratón ----------

  _onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    let kind = null;
    let owner = null;
    if (this.dpad && this.dpad.contains(e.target)) {
      kind = 'dpad';
      owner = this.dpad;
    } else if (this.actionsZone && this.actionsZone.contains(e.target)) {
      kind = 'ab';
      owner = this.actionsZone;
    } else {
      owner = e.target.closest('[data-action]');
      if (owner) kind = 'button';
    }
    if (!kind) return;
    e.preventDefault();
    try {
      owner.setPointerCapture(e.pointerId);
    } catch {
      // El puntero ya no existe.
    }
    const entry = { kind, actions: [], button: kind === 'button' ? owner.dataset.action : null };
    this.pointerActions.set(e.pointerId, entry);
    this._setPointerActions(e.pointerId, entry, this._actionsAt(entry, e));
  }

  _onPointerMove(e) {
    const entry = this.pointerActions.get(e.pointerId);
    if (!entry || entry.kind === 'button') return;
    this._setPointerActions(e.pointerId, entry, this._actionsAt(entry, e));
  }

  _onPointerUp(e) {
    const entry = this.pointerActions.get(e.pointerId);
    if (!entry) return;
    this.pointerActions.delete(e.pointerId);
    this._setPointerActions(e.pointerId, entry, []);
  }

  _actionsAt(entry, e) {
    if (entry.kind === 'dpad') {
      const dir = this._dpadDirection(e);
      return dir ? [dir] : [];
    }
    if (entry.kind === 'ab') return this._abActions(e);
    return [entry.button];
  }

  /** Suelta las acciones que el dedo ya no toca y pulsa las nuevas. */
  _setPointerActions(pointerId, entry, next) {
    const source = `ptr:${pointerId}`;
    for (const action of entry.actions) if (!next.includes(action)) this._release(action, source);
    for (const action of next) if (!entry.actions.includes(action)) this._press(action, source);
    entry.actions = next;
  }

  /** Dirección dominante según la posición del dedo respecto al centro de la cruceta. */
  _dpadDirection(e) {
    const rect = this.dpad.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    if (Math.hypot(dx, dy) < DPAD_DEAD_ZONE) return null;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? ACTIONS.RIGHT : ACTIONS.LEFT;
    return dy > 0 ? ACTIONS.DOWN : ACTIONS.UP;
  }

  /** A, B o ambos según dónde cae el pulgar sobre la línea que une los dos botones. */
  _abActions(e) {
    const a = this.buttonElements.get(ACTIONS.A)?.[0];
    const b = this.buttonElements.get(ACTIONS.B)?.[0];
    if (!a || !b) return [];
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const ax = ra.left + ra.width / 2;
    const ay = ra.top + ra.height / 2;
    const bx = rb.left + rb.width / 2;
    const by = rb.top + rb.height / 2;
    const vx = ax - bx;
    const vy = ay - by;
    const len2 = vx * vx + vy * vy || 1;
    const t = ((e.clientX - bx) * vx + (e.clientY - by) * vy) / len2;
    if (t < AB_BOTH_FROM) return [ACTIONS.B];
    if (t > AB_BOTH_TO) return [ACTIONS.A];
    return [ACTIONS.A, ACTIONS.B];
  }

  // ---------- Mandos ----------

  _pollGamepads() {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
    const pads = navigator.getGamepads();
    for (const pad of pads) {
      if (!pad) continue;
      const current = new Set();
      pad.buttons.forEach((button, index) => {
        const action = GAMEPAD_BUTTONS[index];
        if (action && button.pressed) current.add(action);
      });
      const [ax = 0, ay = 0] = pad.axes;
      if (ax < -0.5) current.add(ACTIONS.LEFT);
      if (ax > 0.5) current.add(ACTIONS.RIGHT);
      if (ay < -0.5) current.add(ACTIONS.UP);
      if (ay > 0.5) current.add(ACTIONS.DOWN);

      const source = `pad:${pad.index}`;
      const previous = this.gamepadState.get(pad.index) || new Set();
      for (const action of current) if (!previous.has(action)) this._press(action, source);
      for (const action of previous) if (!current.has(action)) this._release(action, source);
      this.gamepadState.set(pad.index, current);
    }
  }
}
