// src/core/StorageManager.js
// Persistencia local: récords por slot (top 5), ajustes, último juego elegido, favoritos,
// juegos recientes y la velocidad/nivel preferidos de cada motor.
// Usa localStorage con un espacio de nombres propio y tolera navegadores sin almacenamiento.

const NAMESPACE = 'retropocket99';
const SCHEMA_VERSION = 1;
const MAX_SCORES_PER_SLOT = 5;
const MAX_RECENT = 6;
const CODE_PREFIX = 'RP99-';

const DEFAULT_SETTINGS = Object.freeze({
  volume: 'high', // volumen general: 'off' | 'low' | 'high' (botón SOUND)
  music: 2, // 0..3
  sfx: 3, // 0..3
  haptics: true,
  shake: true, // sacudida de pantalla
  theme: 'retro', // tema visual (ver THEMES en Themes.js)
  shells: {}, // color de carcasa elegido por tema: { retro: 'red', crystal: 'ice' } (ver SHELLS)
  colorblind: false, // paleta apta para daltonismo
  bigButtons: false, // controles táctiles grandes
  demo: true, // modo demostración tras 20 s sin tocar el menú
  hand: 'right', // 'right' | 'left' (zurdo: cruceta a la derecha, A/B a la izquierda)
  repeat: 'normal', // auto-repetición de la cruceta: 'slow' | 'normal' | 'fast'
  contrast: 'normal', // 'normal' | 'high'
  flashes: true, // destellos de pantalla completa
  breakReminder: true, // aviso de descanso cada 30 min de juego
  boot: 'auto', // animación de arranque: 'auto' (cambia cada 2 días) | 'brick' | 'neon' | 'cartridge'
  fullscreen: true, // Android: oculta las barras del sistema
  keepAwake: true, // la pantalla no se apaga mientras se juega
  initials: 'AAA', // últimas iniciales usadas
  lastSlot: 1
});

class MemoryStore {
  constructor() {
    this.map = new Map();
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    this.map.set(key, String(value));
  }
  removeItem(key) {
    this.map.delete(key);
  }
}

function detectStore() {
  try {
    const probe = `${NAMESPACE}:probe`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return new MemoryStore();
  }
}

export class StorageManager {
  constructor() {
    this.store = detectStore();
    this.persistent = this.store !== null && !(this.store instanceof MemoryStore);
    this._migrate();
  }

  _key(name) {
    return `${NAMESPACE}:${name}`;
  }

  _read(name, fallback) {
    try {
      const raw = this.store.getItem(this._key(name));
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  _write(name, value) {
    try {
      this.store.setItem(this._key(name), JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  _migrate() {
    const version = this._read('schema', 0);
    if (version === SCHEMA_VERSION) return;
    if (!this._read('scores', null)) this._write('scores', {});
    if (!this._read('settings', null)) this._write('settings', { ...DEFAULT_SETTINGS });
    this._write('schema', SCHEMA_VERSION);
  }

  // ---------- Ajustes ----------

  getSettings() {
    return { ...DEFAULT_SETTINGS, ...this._read('settings', {}) };
  }

  getSetting(key) {
    return this.getSettings()[key];
  }

  setSetting(key, value) {
    const settings = this.getSettings();
    settings[key] = value;
    this._write('settings', settings);
    return settings;
  }

  // ---------- Favoritos, recientes y preferencias de lanzamiento ----------

  _numberList(name) {
    const list = this._read(name, []);
    return Array.isArray(list) ? list.filter((n) => Number.isInteger(n) && n >= 1 && n <= 99) : [];
  }

  /** Slots favoritos (números 1..99) en el orden en que se marcaron. */
  getFavorites() {
    return this._numberList('favorites');
  }

  isFavorite(slot) {
    return this.getFavorites().includes(slot);
  }

  /** Marca o desmarca un favorito. Devuelve true si queda marcado. */
  toggleFavorite(slot) {
    const list = this.getFavorites();
    const i = list.indexOf(slot);
    if (i >= 0) list.splice(i, 1);
    else list.push(slot);
    this._write('favorites', list);
    return i < 0;
  }

  /** Últimos slots jugados, el más reciente primero. */
  getRecent() {
    return this._numberList('recent');
  }

  pushRecent(slot) {
    if (!Number.isInteger(slot)) return;
    const list = this.getRecent().filter((n) => n !== slot);
    list.unshift(slot);
    this._write('recent', list.slice(0, MAX_RECENT));
  }

  /** Velocidad (1-5) y nivel inicial (1-9) elegidos la última vez para un motor. */
  getLaunchPrefs(engineId) {
    const all = this._read('launch', {});
    const p = all && typeof all === 'object' ? all[engineId] : null;
    return {
      speed: Number.isInteger(p?.speed) ? Math.min(5, Math.max(1, p.speed)) : 1,
      level: Number.isInteger(p?.level) ? Math.min(9, Math.max(1, p.level)) : 1
    };
  }

  setLaunchPrefs(engineId, { speed, level }) {
    const all = this._read('launch', {});
    const next = all && typeof all === 'object' ? all : {};
    next[engineId] = { speed, level };
    this._write('launch', next);
  }

  // ---------- Récords ----------

  _allScores() {
    const scores = this._read('scores', {});
    return scores && typeof scores === 'object' ? scores : {};
  }

  /** Lista de récords del slot (número 1..99 o clave de desafío "D2026-10-24"): [{ score, level, date, name }]. */
  getScores(slot) {
    const list = this._allScores()[String(slot)];
    return Array.isArray(list) ? list.slice() : [];
  }

  /** Mejor puntuación del slot (0 si no hay). */
  getHighScore(slot) {
    const list = this.getScores(slot);
    return list.length ? list[0].score : 0;
  }

  /**
   * Registra una partida terminada.
   * @returns {{ rank: number, isHighScore: boolean, highScore: number }}
   *   rank es la posición 1..5 en la tabla, o 0 si no entró.
   */
  submitScore(slot, score, extra = {}) {
    const value = Math.max(0, Math.floor(Number(score) || 0));
    const previousHigh = this.getHighScore(slot);
    if (value <= 0) return { rank: 0, isHighScore: false, highScore: previousHigh };

    const all = this._allScores();
    const list = Array.isArray(all[String(slot)]) ? all[String(slot)] : [];
    const entry = {
      score: value,
      level: extra.level ?? 1,
      date: new Date().toISOString().slice(0, 10),
      name: extra.name || this.getSetting('initials') || 'AAA'
    };
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    const trimmed = list.slice(0, MAX_SCORES_PER_SLOT);
    all[String(slot)] = trimmed;
    this._write('scores', all);

    const rank = trimmed.indexOf(entry) + 1;
    return { rank, isHighScore: value > previousHigh, highScore: Math.max(previousHigh, value) };
  }

  /** Pone las iniciales a la entrada en la posición `rank` (1..5) y las recuerda para la próxima vez. */
  setEntryName(slot, rank, name) {
    const clean = String(name || 'AAA').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').slice(0, 3).padEnd(3, ' ');
    const all = this._allScores();
    const list = all[String(slot)];
    if (Array.isArray(list) && list[rank - 1]) {
      list[rank - 1].name = clean;
      this._write('scores', all);
    }
    this.setSetting('initials', clean);
    return clean;
  }

  /** Mejor puntuación de cada slot normal: { "1": 1200, "2": 0, ... }. */
  bestScores() {
    const all = this._allScores();
    const result = {};
    for (const [key, list] of Object.entries(all)) {
      if (/^\d+$/.test(key) && Array.isArray(list) && list.length) result[key] = list[0].score;
    }
    return result;
  }

  /** Las mejores partidas de toda la consola (para la pantalla de atracción). */
  topOverall(limit = 5) {
    const all = this._allScores();
    const rows = [];
    for (const [key, list] of Object.entries(all)) {
      if (!Array.isArray(list)) continue;
      for (const entry of list) rows.push({ ...entry, slot: key });
    }
    rows.sort((a, b) => b.score - a.score);
    return rows.slice(0, limit);
  }

  /** Borra los récords de un slot, o de todos si no se indica. */
  clearScores(slot) {
    if (slot === undefined) {
      this._write('scores', {});
      return;
    }
    const all = this._allScores();
    delete all[String(slot)];
    this._write('scores', all);
  }

  /** Exporta todo como texto JSON (copia de seguridad). */
  exportData() {
    return JSON.stringify({
      version: SCHEMA_VERSION,
      settings: this.getSettings(),
      scores: this._allScores(),
      favorites: this.getFavorites(),
      recent: this.getRecent(),
      launch: this._read('launch', {}),
      extras: this.exportExtras()
    });
  }

  /** Importa una copia de seguridad generada con exportData(). */
  importData(json) {
    try {
      const data = JSON.parse(json);
      if (!data || typeof data !== 'object') return false;
      if (!data.settings && !data.scores) return false;
      if (data.settings && typeof data.settings === 'object') this._write('settings', { ...DEFAULT_SETTINGS, ...data.settings });
      if (data.scores && typeof data.scores === 'object') this._write('scores', data.scores);
      if (Array.isArray(data.favorites)) this._write('favorites', data.favorites);
      if (Array.isArray(data.recent)) this._write('recent', data.recent);
      if (data.launch && typeof data.launch === 'object') this._write('launch', data.launch);
      if (data.extras && typeof data.extras === 'object') this.importExtras(data.extras);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Datos guardados por otros módulos con saveExtra() (logros, estadísticas...).
   * Se incluyen en la copia de seguridad.
   */
  exportExtras() {
    const extras = {};
    for (const name of this._read('extraKeys', [])) extras[name] = this._read(`x:${name}`, null);
    return extras;
  }

  importExtras(extras) {
    for (const [name, value] of Object.entries(extras)) {
      if (/^[a-z][a-zA-Z0-9]*$/.test(name)) this.saveExtra(name, value);
    }
  }

  /** Lee un bloque de datos propio de un módulo. */
  loadExtra(name, fallback) {
    const value = this._read(`x:${name}`, null);
    return value === null ? fallback : value;
  }

  /** Guarda un bloque de datos propio de un módulo (y lo registra para la copia de seguridad). */
  saveExtra(name, value) {
    const keys = this._read('extraKeys', []);
    if (!keys.includes(name)) {
      keys.push(name);
      this._write('extraKeys', keys);
    }
    return this._write(`x:${name}`, value);
  }

  /**
   * Código de copia de seguridad en una sola línea (texto seguro para copiar y pegar):
   * "RP99-" + JSON en base64.
   */
  exportCode() {
    const bytes = new TextEncoder().encode(this.exportData());
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return CODE_PREFIX + btoa(binary);
  }

  /** Importa un código de exportCode() (o el JSON en bruto). Devuelve true si funcionó. */
  importCode(text) {
    const clean = String(text || '').trim();
    if (!clean) return false;
    if (clean.startsWith('{')) return this.importData(clean);
    if (!clean.startsWith(CODE_PREFIX)) return false;
    try {
      const binary = atob(clean.slice(CODE_PREFIX.length).replace(/\s+/g, ''));
      const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
      return this.importData(new TextDecoder().decode(bytes));
    } catch {
      return false;
    }
  }
}
