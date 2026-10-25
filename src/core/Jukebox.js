// src/core/Jukebox.js
// Jukebox (Opciones → JUKEBOX): escucha las dos pistas de música de cada motor, la del menú, los jingles
// de arranque y de temporada y las fanfarrias. La pista que suena se dibuja como un rollo de pianola
// (melodía, bajo y batería) con el paso que se oye resaltado, y debajo un analizador de 16 bandas con lo
// que sale por el altavoz. ◀▶ cambia entre el chip de 8 bits y el modo beeper para compararlos.

import { ACTIONS } from './InputManager.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from './ConsoleEngine.js';
import { ENGINES } from './Catalog99.js';
import { BOOT_SCENES } from './BootScenes.js';
import { getTrack, noteToFreq } from './SoundChip.js';

const SEASON_JINGLES = [
  ['seasonAutumn', 'OTOÑO'],
  ['seasonWinter', 'INVIERNO'],
  ['seasonSpring', 'PRIMAVERA'],
  ['seasonSummer', 'VERANO']
];

const FANFARES = [
  ['melody', 'start', 'INICIO DE PARTIDA'],
  ['sfx', 'levelup', 'SUBIR DE NIVEL'],
  ['melody', 'record', 'RECORD NUEVO'],
  ['sfx', 'achievement', 'LOGRO'],
  ['melody', 'stage', 'ETAPA SUPERADA'],
  ['melody', 'boss', 'JEFE DERROTADO'],
  ['melody', 'gameover', 'FIN DE PARTIDA'],
  ['melody', 'nocart', 'SIN CARTUCHO']
];

const BANDS = 16;
const STEP_W = 4; // píxeles por corchea en la pianola (32 pasos = 128 px)
const PANEL = { x: 4, y: 43, w: 136, h: 57 };
const LEAD = { y: 46, h: 20 };
const BASS = { y: 68, h: 12 };
const DRUM_Y = 83;
const METER = { y: 87, h: 10 };
const LIST_TOP = 106;
const ROW_H = 9;
const VISIBLE = 7;

const midiOf = (note) => Math.round(69 + 12 * Math.log2(noteToFreq(note) / 440));

/** Notas de una voz de la pista como barras { step, steps, midi } y su tesitura. */
function voiceRoll(track, voice) {
  const notes = [];
  for (const cell of track.byStep) {
    const e = cell[voice];
    if (e) notes.push({ step: e.step, steps: e.steps, midi: midiOf(e.note) });
  }
  const pitches = notes.map((n) => n.midi);
  return { notes, low: Math.min(...pitches), high: Math.max(...pitches) };
}

function buildEntries() {
  const entries = [];
  const music = (id, name, color) => {
    const track = getTrack(id);
    if (!track) return;
    entries.push({
      kind: 'music',
      id,
      name,
      color,
      section: 'MUSICA',
      tempo: track.tempo,
      length: track.length,
      lead: voiceRoll(track, 'lead'),
      bass: voiceRoll(track, 'bass'),
      drums: track.byStep.map((cell) => cell.drum)
    });
  };
  music('menu', 'MENU', 'ink');
  for (const engine of ENGINES) {
    music(engine.id, `${engine.name} A`, engine.color);
    music(`${engine.id}_b`, `${engine.name} B`, engine.color);
  }
  for (const scene of BOOT_SCENES) entries.push({ kind: 'sfx', id: scene.jingle, name: `ARRANQUE ${scene.label}`, color: 'yellow', section: 'JINGLES' });
  for (const [id, name] of SEASON_JINGLES) entries.push({ kind: 'sfx', id, name: `TEMPORADA ${name}`, color: 'green', section: 'JINGLES' });
  for (const [kind, id, name] of FANFARES) entries.push({ kind, id, name, color: 'magenta', section: 'FANFARRIAS' });
  return entries;
}

export class Jukebox {
  /** @param {import('./ConsoleEngine.js').ConsoleEngine} engine */
  constructor(engine) {
    this.engine = engine;
    this.entries = buildEntries();
    this.index = 0;
    this.time = 0;
    this.playing = null;
    this.until = 0;
    this.levels = new Array(BANDS).fill(0);
    this.peaks = new Array(BANDS).fill(0);
  }

  onEnter() {
    this.time = 0;
    this.playing = null;
    this.levels.fill(0);
    this.peaks.fill(0);
    this.engine.sound.stopMusic();
  }

  exit() {
    this._stop();
    this.engine.sound.sfx('back');
    this.engine.closeJukebox();
  }

  _play(entry) {
    const sound = this.engine.sound;
    sound.stopMusic();
    sound.stopEffects();
    this.playing = entry;
    if (entry.kind === 'music') {
      sound.playMusic(entry.id);
      this.until = Infinity;
      return;
    }
    const length = entry.kind === 'melody' ? sound.melody(entry.id) : sound.sfx(entry.id);
    this.until = this.time + length + 0.4;
  }

  _stop() {
    this.engine.sound.stopMusic();
    this.engine.sound.stopEffects();
    this.playing = null;
  }

  handleAction({ action, pressed, repeat }) {
    if (!pressed) return;
    const e = this.engine;
    const count = this.entries.length;
    switch (action) {
      case ACTIONS.UP:
      case ACTIONS.DOWN:
        this.index = (this.index + (action === ACTIONS.UP ? count - 1 : 1)) % count;
        if (!this.playing) e.sound.sfx('move');
        break;
      case ACTIONS.LEFT:
      case ACTIONS.RIGHT:
        if (repeat) return;
        e.updateSetting('beeper', !e.settings.beeper);
        // Un jingle se repite para oír la diferencia; la música sigue sola con el otro altavoz.
        if (this.playing && this.playing.kind !== 'music') this._play(this.playing);
        else if (!this.playing) e.sound.sfx('select');
        break;
      case ACTIONS.A:
      case ACTIONS.START: {
        if (repeat) return;
        const entry = this.entries[this.index];
        if (this.playing === entry) this._stop();
        else this._play(entry);
        break;
      }
      case ACTIONS.B:
        if (!repeat) this.exit();
        break;
      default:
        break;
    }
  }

  update(dt) {
    this.time += dt;
    if (this.playing && this.time >= this.until) this.playing = null;
    const raw = this.engine.sound.spectrum(BANDS);
    for (let b = 0; b < BANDS; b++) {
      this.levels[b] = Math.max(raw[b], this.levels[b] - dt * 2.5);
      this.peaks[b] = Math.max(this.levels[b], this.peaks[b] - dt * 0.7);
    }
  }

  // ---------- Dibujo ----------

  render(g) {
    const W = SCREEN_WIDTH;
    const e = this.engine;
    const entry = this.entries[this.index];
    const blink = Math.floor(this.time * 4) % 2 === 0;
    g.clear();
    g.rect(0, 0, W, 13, 'ink');
    g.text('JUKEBOX', W / 2, 4, { align: 'center', color: 'bg' });
    g.text('♪', 4, 4, { color: this.playing && blink ? 'ghost' : 'bg' });
    g.text(e.settings.beeper ? 'BEEPER' : 'CHIP', W - 4, 4, { align: 'right', color: 'bg' });

    g.text(`${String(this.index + 1).padStart(2, '0')}/${this.entries.length}`, 4, 17, { color: 'mid' });
    g.text(entry.section, W - 4, 17, { align: 'right', color: 'mid' });
    g.text(entry.name, W / 2, 26, { align: 'center', color: entry.color });
    g.text(this._subtitle(entry), W / 2, 35, { align: 'center', color: this._warning(entry) ? 'red' : 'mid' });

    g.frame(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 'mid');
    if (entry.kind === 'music') {
      this._renderRoll(g, entry);
      this._renderMeter(g, METER.y, METER.h, 2);
    } else {
      this._renderMeter(g, PANEL.y + 4, PANEL.h - 8, 3);
    }

    this._renderList(g, blink);
    g.text('▲▼ ELEGIR   A TOCAR / PARAR', W / 2, SCREEN_HEIGHT - 19, { align: 'center', color: 'mid' });
    g.text('◀▶ CHIP / BEEPER    B VOLVER', W / 2, SCREEN_HEIGHT - 10, { align: 'center', color: 'mid' });
  }

  _warning(entry) {
    const sound = this.engine.sound;
    if (sound.muted) return 'SONIDO APAGADO: PULSA SOUND';
    if (entry.kind === 'music' && sound.musicLevel === 0) return 'SUBE LA MUSICA EN OPCIONES';
    if (entry.kind !== 'music' && sound.sfxLevel === 0) return 'SUBE LOS EFECTOS EN OPCIONES';
    return '';
  }

  _subtitle(entry) {
    const warning = this._warning(entry);
    if (warning) return warning;
    if (entry.kind !== 'music') return entry.section === 'JINGLES' ? 'JINGLE' : 'FANFARRIA';
    const part = entry.id === 'menu' ? 'MENU' : entry.id.endsWith('_b') ? 'NIVELES PARES' : 'NIVELES IMPARES';
    return `${part}  ${entry.tempo} BPM`;
  }

  /** Pianola: melodía arriba, bajo debajo y batería en una fila; el paso que suena va resaltado. */
  _renderRoll(g, entry) {
    const x0 = PANEL.x + 4;
    const pos = this.playing === entry ? this.engine.sound.musicPosition() : null;
    const step = pos && pos.id === entry.id ? pos.step : -1;
    if (step >= 0) g.rect(x0 + step * STEP_W, PANEL.y + 1, STEP_W, DRUM_Y + 3 - PANEL.y, 'ghost');
    const voice = (roll, area, lit) => {
      const range = Math.max(1, roll.high - roll.low);
      const scale = Math.min(2, (area.h - 2) / range);
      for (const n of roll.notes) {
        const y = Math.round(area.y + (roll.high - n.midi) * scale);
        // La nota que suena se ve más gruesa (y en color si el tema lo tiene).
        const on = step >= n.step && step < n.step + n.steps;
        g.rect(x0 + n.step * STEP_W, on ? y - 1 : y, n.steps * STEP_W - 1, on ? 4 : 2, on ? lit : 'ink');
      }
    };
    voice(entry.lead, LEAD, entry.color === 'ink' ? 'cyan' : entry.color);
    if (!this.engine.settings.beeper) voice(entry.bass, BASS, 'yellow');
    else g.text('SIN BAJO', PANEL.x + PANEL.w / 2, BASS.y + 3, { align: 'center', color: 'ghost' });
    entry.drums.forEach((d, i) => {
      if (!d) return;
      const on = i === step;
      const x = x0 + i * STEP_W;
      if (d === 'k') g.rect(x, DRUM_Y, 3, 2, on ? 'red' : 'ink');
      else if (d === 's') g.rect(x, DRUM_Y, 3, 2, on ? 'red' : 'mid');
      else g.rect(x + 1, DRUM_Y + 1, 1, 1, on ? 'red' : 'mid');
    });
  }

  /** Analizador de 16 bandas en celdas de LCD, con la marca del pico de cada una. */
  _renderMeter(g, top, height, cell) {
    const x0 = PANEL.x + 4;
    const barW = 128 / BANDS;
    const rows = Math.floor(height / cell);
    for (let b = 0; b < BANDS; b++) {
      const x = x0 + b * barW;
      const lit = Math.round(this.levels[b] * rows);
      for (let r = 0; r < rows; r++) {
        const y = top + height - (r + 1) * cell;
        const color = r < lit ? (r >= rows * 0.8 ? 'red' : r >= rows * 0.55 ? 'yellow' : 'green') : 'ghost';
        g.rect(x, y, barW - 1, cell - 1, color);
      }
      const peak = Math.round(this.peaks[b] * rows);
      if (peak > 0) g.rect(x, top + height - peak * cell, barW - 1, 1, 'ink');
    }
  }

  _renderList(g, blink) {
    const W = SCREEN_WIDTH;
    const first = Math.max(0, Math.min(this.entries.length - VISIBLE, this.index - Math.floor(VISIBLE / 2)));
    for (let row = 0; row < VISIBLE; row++) {
      const i = first + row;
      const entry = this.entries[i];
      if (!entry) break;
      const y = LIST_TOP + row * ROW_H;
      const selected = i === this.index;
      if (selected) {
        g.rect(4, y - 2, W - 8, ROW_H, 'ghost');
        g.text('▶', 7, y, { color: blink ? 'ink' : 'mid' });
      }
      g.text(String(i + 1).padStart(2, '0'), 14, y, { color: 'mid' });
      g.text(entry.name, 25, y, { color: selected ? entry.color : 'mid' });
      if (this.playing === entry) g.text('♪', W - 9, y, { color: blink ? entry.color : 'ink' });
    }
    // Barra de desplazamiento a la derecha de la lista.
    const top = LIST_TOP - 2;
    const height = VISIBLE * ROW_H;
    const total = this.entries.length;
    g.rect(W - 3, top, 1, height, 'ghost');
    g.rect(W - 3, top + Math.round((first / total) * height), 1, Math.max(2, Math.round((VISIBLE / total) * height)), 'mid');
  }
}
