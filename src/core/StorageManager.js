// src/core/StorageManager.js
// Persistencia local: récords por slot (top 5), ajustes y último juego elegido.
// Usa localStorage con un espacio de nombres propio y tolera navegadores sin almacenamiento.

const NAMESPACE = 'retropocket99';
const SCHEMA_VERSION = 1;
const MAX_SCORES_PER_SLOT = 5;

const DEFAULT_SETTINGS = Object.freeze({
  volume: 'high', // volumen general: 'off' | 'low' | 'high' (botón SOUND)
  music: 2, // 0..3
  sfx: 3, // 0..3
  haptics: true,
  shake: true, // sacudida de pantalla
  theme: 'retro', // 'retro' | 'future' | 'crystal'
  colorblind: false, // paleta apta para daltonismo
  bigButtons: false, // controles táctiles grandes
  demo: true, // modo demostración tras 20 s sin tocar el menú
  hand: 'right', // 'right' | 'left' (zurdo: cruceta a la derecha, A/B a la izquierda)
  repeat: 'normal', // auto-repetición de la cruceta: 'slow' | 'normal' | 'fast'
  contrast: 'normal', // 'normal' | 'high'
  flashes: true, // destellos de pantalla completa
  breakReminder: true, // aviso de descanso cada 30 min de juego
  boot: 'auto', // animación de arranque: 'auto' (cambia cada 2 días) | 'brick' | 'neon' | 'cartridge'
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
    return JSON.stringify({ version: SCHEMA_VERSION, settings: this.getSettings(), scores: this._allScores() });
  }

  /** Importa una copia de seguridad generada con exportData(). */
  importData(json) {
    try {
      const data = JSON.parse(json);
      if (!data || typeof data !== 'object') return false;
      if (data.settings && typeof data.settings === 'object') this._write('settings', { ...DEFAULT_SETTINGS, ...data.settings });
      if (data.scores && typeof data.scores === 'object') this._write('scores', data.scores);
      return true;
    } catch {
      return false;
    }
  }
}
