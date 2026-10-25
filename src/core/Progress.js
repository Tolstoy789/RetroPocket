// src/core/Progress.js
// Estadísticas, logros, racha del desafío diario y avance del modo carrera.
// La consola avisa del inicio y el fin de cada partida y del tiempo jugado; los cartuchos envían sus
// contadores con this.track('lines', 4) (se suman) y this.peak('kmh', 180) (se guarda el máximo).
// Todo se guarda con StorageManager.saveExtra(), así que entra en la copia de seguridad (RP99-).

import { ACHIEVEMENTS } from './Achievements.js';
import { todayKey } from './Catalog99.js';
import { shellsFor } from './Themes.js';

const SAVE_EVERY = 10; // segundos de juego entre guardados automáticos
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function numberMap(value) {
  const out = {};
  if (!isObject(value)) return out;
  for (const [key, n] of Object.entries(value)) if (Number.isFinite(n) && n > 0) out[key] = n;
  return out;
}

function count(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Día siguiente o anterior de una fecha "AAAA-MM-DD" (en hora local). */
export function shiftDay(day, delta) {
  const [y, m, d] = day.split('-').map(Number);
  return todayKey(new Date(y, m - 1, d + delta));
}

/** Racha más larga dentro de una lista ordenada de días. */
function longestRun(days) {
  let best = 0;
  let run = 0;
  let prev = null;
  for (const day of days) {
    run = prev && shiftDay(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

// Índice de logros por estadística: al llegar un contador solo se revisan los que lo usan.
const BY_STAT = new Map();
for (const a of ACHIEVEMENTS) {
  if (!BY_STAT.has(a.stat)) BY_STAT.set(a.stat, []);
  BY_STAT.get(a.stat).push(a);
}

export class Progress {
  /**
   * @param {import('./StorageManager.js').StorageManager} storage
   * @param {import('./Catalog99.js').Catalog99} catalog
   */
  constructor(storage, catalog) {
    this.storage = storage;
    this.catalog = catalog;
    this.session = null;
    this.fresh = [];
    this.load();
  }

  // ---------- Guardado ----------

  /** Lee (o vuelve a leer, tras restaurar una copia) los datos guardados. */
  load() {
    const s = this.storage.loadExtra('stats', null);
    const raw = isObject(s) ? s : {};
    const perEngine = {};
    if (isObject(raw.perEngine)) {
      for (const engine of this.catalog.engines) {
        const e = raw.perEngine[engine.id];
        if (isObject(e)) perEngine[engine.id] = { time: count(e.time), games: count(e.games) };
      }
    }
    this.stats = {
      games: count(raw.games),
      playTime: count(raw.playTime),
      records: count(raw.records),
      expert: count(raw.expert),
      slots: Array.isArray(raw.slots) ? [...new Set(raw.slots.filter((n) => Number.isInteger(n) && n >= 1 && n <= 99))] : [],
      perEngine,
      counters: numberMap(raw.counters),
      bests: numberMap(raw.bests)
    };
    const unlocked = this.storage.loadExtra('achievements', {});
    this.unlocked = {};
    if (isObject(unlocked)) {
      for (const a of ACHIEVEMENTS) if (typeof unlocked[a.id] === 'string') this.unlocked[a.id] = unlocked[a.id];
    }
    const streak = this.storage.loadExtra('streak', null);
    const days = isObject(streak) && Array.isArray(streak.days) ? streak.days.filter((d) => typeof d === 'string' && DAY_RE.test(d)) : [];
    this.days = [...new Set(days)].sort();
    this.daySet = new Set(this.days);
    this.bestStreak = Math.max(isObject(streak) ? count(streak.best) : 0, longestRun(this.days));
    const career = this.storage.loadExtra('career', null);
    const cleared = isObject(career) && Number.isInteger(career.cleared) ? career.cleared : 0;
    this.career = {
      cleared: Math.max(0, Math.min(this.catalog.slots.length, cleared)),
      completedOn: isObject(career) && typeof career.completedOn === 'string' && DAY_RE.test(career.completedOn) ? career.completedOn : ''
    };
    this.session = null;
    this.saveClock = 0;
    this.dirty = false;
  }

  save() {
    this.storage.saveExtra('stats', this.stats);
    this.storage.saveExtra('achievements', this.unlocked);
    this.storage.saveExtra('streak', { days: this.days, best: this.bestStreak });
    this.storage.saveExtra('career', this.career);
    this.dirty = false;
  }

  // ---------- Avisos de la consola ----------

  /** Empieza una partida de verdad (no se llama en el modo demo). */
  onGameStart(slot) {
    const engineId = slot.engine.id;
    this.session = { engineId, counters: {} };
    const number = slot.daily ? slot.baseNumber : slot.number;
    if (Number.isInteger(number) && !this.stats.slots.includes(number)) this.stats.slots.push(number);
    if (!this.stats.perEngine[engineId]) this.stats.perEngine[engineId] = { time: 0, games: 0 };
    if (slot.launchSpeed === 5 && slot.launchLevel === 9) this.stats.expert++;
    this.dirty = true;
    this._checkAll(['engines', 'slots', 'expert']);
  }

  /** Sigue una partida guardada («Continuar»): vuelve la sesión con sus contadores, sin contarla como nueva. */
  resumeSession(slot, counters = {}) {
    const engineId = slot.engine.id;
    if (!this.stats.perEngine[engineId]) this.stats.perEngine[engineId] = { time: 0, games: 0 };
    const clean = {};
    if (isObject(counters)) {
      for (const [name, value] of Object.entries(counters)) if (Number.isFinite(value) && value > 0) clean[name] = value;
    }
    this.session = { engineId, counters: clean };
  }

  /** Tiempo jugado (solo mientras se juega: no cuenta la pausa). */
  onPlayTick(dt) {
    if (!this.session) return;
    this.stats.playTime += dt;
    this.stats.perEngine[this.session.engineId].time += dt;
    this.dirty = true;
    this.saveClock += dt;
    if (this.saveClock >= SAVE_EVERY) {
      this.saveClock = 0;
      this._checkAll(['playTime']);
      this.save();
    }
  }

  /**
   * Fin de partida (derrota o victoria).
   * @param {object} slot
   * @param {{ score: number, isHighScore: boolean }} result
   * @param {number} previousBest Récord del slot antes de esta partida.
   * @returns {object|null} En el modo carrera, el resultado de la etapa (ver _careerResult).
   */
  onGameEnd(slot, result, previousBest) {
    if (!this.session) return null;
    const career = slot.career ? this._careerResult(slot, result.score) : null;
    this.stats.games++;
    this.stats.perEngine[this.session.engineId].games++;
    if (result.isHighScore && previousBest > 0) this.stats.records++;
    if (slot.daily && slot.day && !this.daySet.has(slot.day)) {
      this.daySet.add(slot.day);
      this.days = [...this.daySet].sort();
      this.bestStreak = Math.max(this.bestStreak, longestRun(this.days));
    }
    this.session = null;
    this._checkAll();
    this.save();
    return career;
  }

  /** Se sale de la partida (al menú, reinicio o fin): guarda lo pendiente. */
  endSession() {
    this.session = null;
    if (this.dirty) this.save();
  }

  // ---------- Contadores de los cartuchos ----------

  /** Suma `amount` al contador de la partida y al total. */
  track(name, amount = 1) {
    const s = this.session;
    if (!s || !(amount > 0)) return;
    const value = (s.counters[name] || 0) + amount;
    s.counters[name] = value;
    this.stats.counters[name] = (this.stats.counters[name] || 0) + amount;
    if (value > (this.stats.bests[name] || 0)) this.stats.bests[name] = value;
    this.dirty = true;
    this._checkStat(`total:${name}`);
    this._checkStat(`best:${name}`);
  }

  /** Guarda `value` si supera la mejor marca de `name`. */
  peak(name, value) {
    if (!this.session || !(value > (this.stats.bests[name] || 0))) return;
    this.stats.bests[name] = value;
    this.dirty = true;
    this._checkStat(`best:${name}`);
  }

  // ---------- Logros ----------

  /** Valor actual de una estadística (ver Achievements.js). */
  value(stat) {
    const st = this.stats;
    switch (stat) {
      case 'games':
        return st.games;
      case 'playTime':
        return Math.floor(st.playTime);
      case 'engines':
        return Object.keys(st.perEngine).length;
      case 'slots':
        return st.slots.length;
      case 'stars':
        return this.starStats().stars;
      case 'perfect':
        return this.starStats().perfect;
      case 'records':
        return st.records;
      case 'daily':
        return this.days.length;
      case 'streak':
        return this.bestStreak;
      case 'expert':
        return st.expert;
      case 'career':
        return this.career.cleared;
      default: {
        const [kind, name] = stat.split(':');
        if (kind === 'total') return st.counters[name] || 0;
        if (kind === 'best') return st.bests[name] || 0;
        return 0;
      }
    }
  }

  /** Estrellas totales y slots con 3 estrellas, a partir de los récords. */
  starStats() {
    const best = this.storage.bestScores();
    let stars = 0;
    let perfect = 0;
    for (const slot of this.catalog.slots) {
      const s = this.catalog.starsFor(slot, best[String(slot.number)] || 0);
      stars += s;
      if (s === 3) perfect++;
    }
    return { stars, perfect };
  }

  isUnlocked(id) {
    return !!this.unlocked[id];
  }

  /** Fecha (AAAA-MM-DD) en que se consiguió el logro, o ''. */
  unlockedOn(id) {
    return this.unlocked[id] || '';
  }

  unlockedCount() {
    return ACHIEVEMENTS.reduce((n, a) => n + (this.unlocked[a.id] ? 1 : 0), 0);
  }

  /** Progreso de un logro: { value, goal } (value nunca pasa de goal). */
  progressOf(a) {
    return { value: Math.min(a.goal, this.value(a.stat)), goal: a.goal };
  }

  /** Logros conseguidos desde la última llamada (la consola los anuncia). */
  takeFresh() {
    if (!this.fresh.length) return this.fresh;
    const list = this.fresh;
    this.fresh = [];
    return list;
  }

  _unlock(a) {
    this.unlocked[a.id] = todayKey();
    this.fresh.push(a);
    this.dirty = true;
  }

  _checkStat(stat) {
    const list = BY_STAT.get(stat);
    if (!list) return;
    let value = null;
    let unlocked = false;
    for (const a of list) {
      if (this.unlocked[a.id]) continue;
      if (value === null) value = this.value(stat);
      if (value >= a.goal) {
        this._unlock(a);
        unlocked = true;
      }
    }
    // Un logro se guarda en el momento: no se pierde aunque se cierre la app a mitad de partida.
    if (unlocked) this.save();
  }

  /** Revisa los logros de las estadísticas indicadas (todas si no se indica). */
  _checkAll(stats = null) {
    for (const stat of stats || BY_STAT.keys()) this._checkStat(stat);
  }

  // ---------- Racha del desafío diario ----------

  hasPlayedDaily(day) {
    return this.daySet.has(day);
  }

  /**
   * Racha actual: días seguidos con el desafío jugado que acaban hoy, o ayer si hoy aún no se ha jugado
   * (la racha sigue viva hasta que termina el día).
   */
  streakInfo(date = new Date()) {
    const today = todayKey(date);
    const playedToday = this.daySet.has(today);
    let day = playedToday ? today : shiftDay(today, -1);
    let current = 0;
    while (this.daySet.has(day)) {
      current++;
      day = shiftDay(day, -1);
    }
    return { current, best: Math.max(this.bestStreak, current), total: this.days.length, playedToday, today, first: this.days[0] || today };
  }

  // ---------- Modo carrera ----------

  /**
   * Una etapa se supera con las estrellas que pide (1, o 2 los jefes). Superar la siguiente etapa
   * pendiente desbloquea la otra; las ya superadas se pueden repetir sin perder nada.
   */
  _careerResult(slot, score) {
    const { stage, boss, need } = slot.career;
    const total = this.catalog.slots.length;
    const stars = this.catalog.starsFor(slot, score);
    const passed = stars >= need;
    const first = passed && stage === this.career.cleared + 1;
    if (first) {
      this.career.cleared = stage;
      if (stage === total) this.career.completedOn = todayKey();
    }
    return { stage, boss, need, stars, passed, first, next: passed && stage < total ? stage + 1 : 0, finished: first && stage === total };
  }

  /** Avance de la carrera: etapas superadas, la que toca jugar y jefes derrotados. */
  careerInfo() {
    const total = this.catalog.slots.length;
    const { cleared, completedOn } = this.career;
    let bosses = 0;
    for (let stage = 1; stage <= cleared; stage++) if (this.catalog.isCareerBoss(stage)) bosses++;
    return { cleared, total, current: Math.min(total, cleared + 1), bosses, finished: cleared >= total, completedOn };
  }

  // ---------- Carcasas ----------

  /** ¿Se puede usar ese color de carcasa? (los de serie siempre). */
  isShellUnlocked(themeId, shellId) {
    const shell = shellsFor(themeId).find((s) => s.id === shellId);
    if (!shell) return false;
    return !shell.unlock || this.isUnlocked(shell.unlock);
  }

  // ---------- Datos para la pantalla DATOS ----------

  /** Motor con más tiempo jugado (id) o null. */
  favoriteEngine() {
    let best = null;
    let time = 0;
    for (const [id, e] of Object.entries(this.stats.perEngine)) {
      if (e.time > time) {
        best = id;
        time = e.time;
      }
    }
    return best;
  }
}
