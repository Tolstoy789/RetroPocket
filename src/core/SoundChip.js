// src/core/SoundChip.js
// Sintetizador 8-bit procedural con Web Audio API.
// Canales: 2 pulsos (cuadrada con duty cycle variable), 1 triangular y 1 de ruido blanco.
// No se carga ningún archivo de audio: todo se genera en tiempo real.

const NOTE_INDEX = { C: 0, 'C#': 1, DB: 1, D: 2, 'D#': 3, EB: 3, E: 4, F: 5, 'F#': 6, GB: 6, G: 7, 'G#': 8, AB: 8, A: 9, 'A#': 10, BB: 10, B: 11 };

/** Convierte "A4", "C#5", "Eb3" a frecuencia en Hz. Devuelve 0 para silencios ("-" o "R"). */
export function noteToFreq(note) {
  if (typeof note === 'number') return note;
  if (!note || note === '-' || note.toUpperCase() === 'R') return 0;
  const match = /^([A-Ga-g])([#bB]?)(-?\d)$/.exec(note.trim());
  if (!match) return 0;
  const name = (match[1] + (match[2] === '#' ? '#' : match[2] ? 'B' : '')).toUpperCase();
  const octave = parseInt(match[3], 10);
  const semitone = NOTE_INDEX[name];
  const midi = (octave + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Niveles de volumen que recorre el botón SOUND. */
export const VOLUME_LEVELS = [
  { id: 'off', label: 'OFF', gain: 0 },
  { id: 'low', label: 'LOW', gain: 0.12 },
  { id: 'high', label: 'HIGH', gain: 0.28 }
];

/** Efectos de sonido predefinidos. Cada uno es una lista de "voces" que se disparan a la vez o en secuencia. */
const SFX = {
  move: [{ wave: 'pulse25', freq: 660, duration: 0.03, volume: 0.5 }],
  rotate: [{ wave: 'pulse50', freq: 880, slideTo: 1320, duration: 0.05, volume: 0.45 }],
  select: [{ wave: 'pulse25', freq: 988, duration: 0.04, volume: 0.5 }, { wave: 'pulse25', freq: 1319, duration: 0.06, delay: 0.04, volume: 0.5 }],
  confirm: [
    { wave: 'pulse50', freq: 523, duration: 0.06, volume: 0.5 },
    { wave: 'pulse50', freq: 784, duration: 0.06, delay: 0.06, volume: 0.5 },
    { wave: 'pulse50', freq: 1047, duration: 0.12, delay: 0.12, volume: 0.5 }
  ],
  back: [{ wave: 'pulse50', freq: 660, slideTo: 330, duration: 0.12, volume: 0.45 }],
  drop: [{ wave: 'triangle', freq: 220, slideTo: 80, duration: 0.09, volume: 0.8 }, { wave: 'noise', duration: 0.05, volume: 0.25, filter: 1800 }],
  line: [
    { wave: 'pulse25', freq: 784, duration: 0.05, volume: 0.5 },
    { wave: 'pulse25', freq: 988, duration: 0.05, delay: 0.05, volume: 0.5 },
    { wave: 'pulse25', freq: 1175, duration: 0.05, delay: 0.1, volume: 0.5 },
    { wave: 'pulse25', freq: 1568, duration: 0.12, delay: 0.15, volume: 0.5 }
  ],
  coin: [{ wave: 'pulse25', freq: 988, duration: 0.05, volume: 0.5 }, { wave: 'pulse25', freq: 1319, duration: 0.18, delay: 0.05, volume: 0.5 }],
  eat: [{ wave: 'pulse50', freq: 440, slideTo: 880, duration: 0.05, volume: 0.45 }],
  powerup: [{ wave: 'pulse12', freq: 330, slideTo: 1320, duration: 0.35, volume: 0.45, vibrato: 18 }],
  shoot: [{ wave: 'pulse12', freq: 1400, slideTo: 300, duration: 0.1, volume: 0.35 }],
  hit: [{ wave: 'noise', duration: 0.12, volume: 0.55, filter: 3000 }, { wave: 'pulse50', freq: 180, slideTo: 90, duration: 0.1, volume: 0.35 }],
  explode: [{ wave: 'noise', duration: 0.45, volume: 0.8, filter: 1200, filterTo: 150 }, { wave: 'triangle', freq: 120, slideTo: 40, duration: 0.4, volume: 0.7 }],
  jump: [{ wave: 'pulse25', freq: 330, slideTo: 660, duration: 0.1, volume: 0.45 }],
  bounce: [{ wave: 'pulse50', freq: 520, duration: 0.03, volume: 0.4 }],
  error: [{ wave: 'pulse50', freq: 140, duration: 0.12, volume: 0.5 }, { wave: 'pulse50', freq: 110, duration: 0.18, delay: 0.13, volume: 0.5 }],
  pause: [{ wave: 'pulse25', freq: 1047, duration: 0.05, volume: 0.45 }, { wave: 'pulse25', freq: 784, duration: 0.08, delay: 0.06, volume: 0.45 }],
  levelup: [
    { wave: 'pulse50', freq: 523, duration: 0.07, volume: 0.45 },
    { wave: 'pulse50', freq: 659, duration: 0.07, delay: 0.07, volume: 0.45 },
    { wave: 'pulse50', freq: 784, duration: 0.07, delay: 0.14, volume: 0.45 },
    { wave: 'pulse50', freq: 1047, duration: 0.07, delay: 0.21, volume: 0.45 },
    { wave: 'triangle', freq: 1047, duration: 0.25, delay: 0.28, volume: 0.6 }
  ],
  tick: [{ wave: 'pulse12', freq: 2000, duration: 0.015, volume: 0.25 }],
  // Jingles de las tres animaciones de arranque (BootScenes.js), sincronizados con la imagen.
  bootBrick: [
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ wave: 'triangle', freq: 160, slideTo: 60, duration: 0.08, delay: 0.25 + i * 0.08, volume: 0.7 })),
    ...['C5', 'E5', 'G5', 'C6'].map((freq, i) => ({ wave: 'pulse25', freq, duration: 0.1, delay: 1.8 + i * 0.09, volume: 0.45 })),
    { wave: 'pulse25', freq: 'C6', duration: 0.35, delay: 2.2, volume: 0.45 },
    { wave: 'triangle', freq: 'C4', duration: 0.35, delay: 2.2, volume: 0.5 }
  ],
  bootNeon: [
    ...['A3', 'C#4', 'E4', 'A4', 'E4', 'C#4'].map((freq, i) => ({ wave: 'pulse12', freq, duration: 0.14, delay: i * 0.15, volume: 0.35 })),
    { wave: 'pulse12', freq: 220, slideTo: 880, duration: 0.6, delay: 1.2, volume: 0.3 },
    ...['A4', 'C#5', 'E5', 'A5'].map((freq, i) => ({ wave: 'pulse50', freq, duration: 0.25, delay: 1.9 + i * 0.07, volume: 0.3 }))
  ],
  bootCartridge: [
    { wave: 'noise', duration: 0.08, delay: 0.72, volume: 0.6, filter: 2500 },
    { wave: 'triangle', freq: 90, slideTo: 50, duration: 0.12, delay: 0.72, volume: 0.8 },
    { wave: 'triangle', freq: 60, slideTo: 900, duration: 0.4, delay: 0.9, volume: 0.35 },
    ...['G5', 'B5', 'E6'].map((freq, i) => ({ wave: 'triangle', freq, duration: 0.5, delay: 2.5 + i * 0.12, volume: 0.5 }))
  ],
  blip1: [{ wave: 'pulse50', freq: 330, duration: 0.25, volume: 0.5 }],
  blip2: [{ wave: 'pulse50', freq: 440, duration: 0.25, volume: 0.5 }],
  blip3: [{ wave: 'pulse50', freq: 554, duration: 0.25, volume: 0.5 }],
  blip4: [{ wave: 'pulse50', freq: 659, duration: 0.25, volume: 0.5 }]
};

/** Melodías cortas (nota, duración en tiempos). */
const MELODIES = {
  start: { tempo: 260, wave: 'pulse50', notes: [['G4', 0.5], ['C5', 0.5], ['E5', 0.5], ['G5', 1]] },
  gameover: { tempo: 150, wave: 'pulse50', notes: [['G4', 0.5], ['-', 0.1], ['E4', 0.5], ['-', 0.1], ['C4', 0.5], ['D4', 0.5], ['B3', 0.5], ['C4', 1.5]] },
  record: { tempo: 240, wave: 'pulse25', notes: [['C5', 0.5], ['C5', 0.5], ['G5', 0.5], ['G5', 0.5], ['A5', 0.5], ['A5', 0.5], ['G5', 1], ['E5', 0.5], ['C6', 1.5]] },
  nocart: { tempo: 180, wave: 'pulse12', notes: [['E5', 0.5], ['C5', 0.5], ['-', 0.25], ['E5', 0.5], ['C5', 0.5]] }
};

/** Niveles 0..3 para los buses de música y efectos (menú de ajustes). */
export const BUS_LEVELS = [0, 0.35, 0.7, 1];

const DRUMS_A = 'k - h - s - h - k - h k s - h - k - h - s - h - k - h k s - h -';
const DRUMS_B = 'k h h h s h h h k h k h s h h h k h h h s h h h k h k h s h s s';
const DRUMS_C = 'k - - - s - - - k - - - s - - - k - - - s - - - k - k - s - - -';

/**
 * Pistas de música en bucle (composiciones originales).
 * Cada pista tiene 32 pasos de corchea: nota ("A4"), "-" silencio, "_" mantiene la nota anterior.
 * drums: k = bombo, s = caja, h = charles.
 */
export const MUSIC_TRACKS = {
  menu: {
    tempo: 128,
    lead: 'E5 _ A5 _ C6 _ B5 A5 G5 _ E5 _ - - D5 E5 F5 _ A5 _ G5 F5 E5 _ D5 _ E5 _ _ _ - -',
    bass: 'A2 _ A3 A2 C3 _ C3 _ G2 _ G3 G2 E3 _ E2 _ F2 _ F3 F2 D3 _ D3 _ E2 _ E3 E2 G2 _ G#2 _',
    drums: DRUMS_A
  },
  blockdrop: {
    tempo: 150,
    lead: 'D5 _ F5 A5 G5 _ F5 E5 D5 _ - D5 E5 F5 E5 D5 C5 _ E5 G5 F5 _ E5 D5 C5 D5 E5 _ D5 _ - -',
    bass: 'D3 A2 D3 A2 D3 A2 D3 A2 Bb2 F2 Bb2 F2 Bb2 F2 Bb2 F2 C3 G2 C3 G2 C3 G2 C3 G2 A2 E2 A2 E2 A2 _ - -',
    drums: DRUMS_A
  },
  mazemuncher: {
    tempo: 160,
    lead: 'C5 E5 G5 E5 C6 _ G5 _ A5 G5 E5 G5 C5 _ - - D5 F5 A5 F5 D6 _ A5 _ B5 G5 F5 D5 C5 _ - -',
    bass: 'C3 _ G2 _ C3 _ G2 _ F2 _ C3 _ F2 _ C3 _ D3 _ A2 _ D3 _ A2 _ G2 _ D3 _ G2 _ C3 _',
    drums: DRUMS_A
  },
  cybersnake: {
    tempo: 170,
    lead: 'E5 - E5 G5 - E5 D5 - B4 _ - B4 D5 E5 _ - G5 - G5 A5 - G5 F#5 - E5 _ - D5 E5 _ _ -',
    bass: 'E2 E2 E3 E2 E2 E3 E2 E3 E2 E2 E3 E2 D2 D3 D2 D3 C2 C2 C3 C2 C2 C3 C2 C3 B1 B1 B2 B1 B1 B2 B1 B2',
    drums: DRUMS_B
  },
  brickbreaker: {
    tempo: 140,
    lead: 'G5 _ B5 _ D6 _ B5 _ C6 _ A5 _ F#5 _ D5 _ E5 _ G5 _ B5 _ A5 G5 F#5 _ A5 _ G5 _ - -',
    bass: 'G2 _ D3 _ G2 _ D3 _ A2 _ E3 _ D2 _ A2 _ C3 _ G2 _ E2 _ B2 _ D2 _ A2 _ G2 _ D3 _',
    drums: DRUMS_A
  },
  roadracer: {
    tempo: 180,
    lead: 'A4 C5 E5 A5 G5 E5 C5 E5 F5 _ E5 D5 C5 _ B4 _ A4 C5 E5 A5 B5 A5 G5 E5 F5 E5 D5 B4 A4 _ - -',
    bass: 'A2 A2 A3 A2 A2 A2 A3 A2 F2 F2 F3 F2 G2 G2 G3 G2 A2 A2 A3 A2 A2 A2 A3 A2 D2 D2 D3 D2 E2 E2 E3 E2',
    drums: DRUMS_B
  },
  tankbattle: {
    tempo: 132,
    lead: 'D5 _ D5 F5 A5 _ - A5 G5 _ F5 E5 D5 _ - - C5 _ C5 E5 G5 _ - G5 F5 _ E5 C#5 D5 _ - -',
    bass: 'D2 - D3 - D2 - D3 - Bb1 - Bb2 - Bb1 - Bb2 - C2 - C3 - C2 - C3 - A1 - A2 - A1 - A2 -',
    drums: DRUMS_C
  },
  spaceshooter: {
    tempo: 150,
    lead: 'F#5 _ C#6 _ A5 _ F#5 _ E5 _ G#5 _ B5 _ - - D5 _ A5 _ F#5 _ D5 _ C#5 _ E5 _ G#5 _ C#6 _',
    bass: 'F#2 F#3 F#2 F#3 F#2 F#3 F#2 F#3 E2 E3 E2 E3 E2 E3 E2 E3 D2 D3 D2 D3 D2 D3 D2 D3 C#2 C#3 C#2 C#3 C#2 C#3 C#2 C#3',
    drums: DRUMS_B
  },
  frogcrossing: {
    tempo: 145,
    lead: 'F5 A5 C6 A5 F5 _ C5 _ D5 F5 A5 F5 D5 _ - - Bb4 D5 F5 D5 Bb4 _ G5 _ C5 E5 G5 E5 F5 _ - -',
    bass: 'F2 _ C3 _ F2 _ C3 _ D2 _ A2 _ D2 _ A2 _ Bb1 _ F2 _ Bb1 _ F2 _ C2 _ G2 _ F2 _ C3 _',
    drums: DRUMS_A
  },
  flappypixel: {
    tempo: 120,
    lead: 'G5 _ E5 _ C5 _ E5 _ G5 _ C6 _ - - B5 _ A5 _ F5 _ A5 _ G5 _ E5 _ D5 _ - - - -',
    bass: 'C3 _ _ _ G2 _ _ _ A2 _ _ _ E2 _ _ _ F2 _ _ _ C3 _ _ _ D3 _ _ _ G2 _ _ _',
    drums: DRUMS_C
  },
  memorymatrix: {
    tempo: 110,
    lead: 'B4 _ D5 _ F#5 _ - - E5 _ G5 _ B5 _ - - A5 _ F#5 _ D5 _ - - C#5 _ E5 _ F#5 _ _ _',
    bass: 'B2 _ F#2 _ B2 _ F#2 _ E2 _ B2 _ E2 _ B2 _ D2 _ A2 _ D2 _ A2 _ F#2 _ C#3 _ F#2 _ C#3 _',
    drums: DRUMS_C
  }
};

/** Convierte una línea de texto en eventos { step, note, steps }. */
function parseLine(line) {
  const tokens = line.trim().split(/\s+/);
  const events = [];
  tokens.forEach((token, step) => {
    if (token === '_') {
      if (events.length) events[events.length - 1].steps++;
    } else if (token !== '-') {
      events.push({ step, note: token, steps: 1 });
    }
  });
  return { length: tokens.length, events };
}

function parseTrack(def) {
  const lead = parseLine(def.lead);
  const bass = parseLine(def.bass);
  const drums = def.drums ? def.drums.trim().split(/\s+/) : [];
  const length = Math.max(lead.length, bass.length, drums.length);
  const byStep = Array.from({ length }, () => ({ lead: null, bass: null, drum: null }));
  for (const e of lead.events) byStep[e.step].lead = e;
  for (const e of bass.events) byStep[e.step].bass = e;
  drums.forEach((d, i) => {
    if (d !== '-') byStep[i].drum = d;
  });
  return { tempo: def.tempo, length, byStep };
}

const PARSED_TRACKS = Object.fromEntries(Object.entries(MUSIC_TRACKS).map(([id, def]) => [id, parseTrack(def)]));

export class SoundChip {
  constructor({ volumeLevel = 'high' } = {}) {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.waves = {};
    this.activeNodes = new Set();
    const index = VOLUME_LEVELS.findIndex((v) => v.id === volumeLevel);
    this.volumeIndex = index >= 0 ? index : 2;
    this.unlocked = false;
    this.flavor = 'retro';
    this.echoWet = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.sfxLevel = 3;
    this.musicLevel = 2;
    this.music = { track: null, id: null, step: 0, nextTime: 0, playing: false };
    this._unlock = this._unlock.bind(this);
    window.addEventListener('pointerdown', this._unlock, { capture: true });
    window.addEventListener('keydown', this._unlock, { capture: true });
  }

  /** Los navegadores exigen un gesto del usuario antes de producir audio. */
  _unlock() {
    this.ensureContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && this.ctx.state === 'running') {
      this.unlocked = true;
      window.removeEventListener('pointerdown', this._unlock, { capture: true });
      window.removeEventListener('keydown', this._unlock, { capture: true });
    }
  }

  ensureContext() {
    if (this.ctx) return this.ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    this.ctx = new AudioCtx({ latencyHint: 'interactive' });

    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.1;
    compressor.connect(this.ctx.destination);

    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(compressor);

    // Buses separados para efectos y música (niveles del menú de ajustes).
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = BUS_LEVELS[this.sfxLevel];
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = BUS_LEVELS[this.musicLevel] * 0.55;
    this.musicBus.connect(this.master);

    // Eco para el modo futurista: master → delay ↺ feedback → wet → compresor.
    const delay = this.ctx.createDelay(1);
    delay.delayTime.value = 0.14;
    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.32;
    const tone = this.ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 3200;
    this.echoWet = this.ctx.createGain();
    this.echoWet.gain.value = 0;
    this.master.connect(delay);
    delay.connect(tone);
    tone.connect(feedback);
    feedback.connect(delay);
    tone.connect(this.echoWet);
    this.echoWet.connect(compressor);
    this._applyFlavor();

    this._buildWaves();
    this._buildNoise();
    return this.ctx;
  }

  /** Ondas de pulso con duty cycle 12.5%, 25% y 50% mediante series de Fourier. */
  _buildWaves() {
    const harmonics = 48;
    const build = (duty) => {
      const real = new Float32Array(harmonics);
      const imag = new Float32Array(harmonics);
      for (let n = 1; n < harmonics; n++) {
        real[n] = (4 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
        imag[n] = 0;
      }
      return this.ctx.createPeriodicWave(real, imag);
    };
    this.waves.pulse12 = build(0.125);
    this.waves.pulse25 = build(0.25);
    this.waves.pulse50 = build(0.5);
  }

  /** Ruido blanco "8-bit": muestras aleatorias retenidas para un timbre áspero tipo LFSR. */
  _buildNoise() {
    const length = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let lfsr = 0x7fff;
    let value = 1;
    const hold = Math.max(1, Math.round(this.ctx.sampleRate / 22050));
    for (let i = 0; i < length; i++) {
      if (i % hold === 0) {
        const bit = (lfsr ^ (lfsr >> 1)) & 1;
        lfsr = (lfsr >> 1) | (bit << 14);
        value = lfsr & 1 ? 1 : -1;
      }
      data[i] = value;
    }
  }

  /**
   * Timbre según el modo visual: 'retro' = pulso seco de 8 bits;
   * 'future' = mismas notas con eco espacial y ondas más suaves.
   */
  setFlavor(flavor) {
    this.flavor = flavor === 'future' ? 'future' : 'retro';
    this._applyFlavor();
  }

  _applyFlavor() {
    if (!this.echoWet || !this.ctx) return;
    this.echoWet.gain.setTargetAtTime(this.flavor === 'future' ? 0.45 : 0, this.ctx.currentTime, 0.02);
  }

  /** En modo futurista los pulsos estrechos se suavizan a pulso del 50%. */
  _wave(wave) {
    if (this.flavor === 'future' && (wave === 'pulse12' || wave === 'pulse25')) return 'pulse50';
    return wave;
  }

  /** Niveles 0..3 de música y efectos. */
  setBusLevels({ music, sfx } = {}) {
    if (Number.isInteger(music)) this.musicLevel = Math.max(0, Math.min(3, music));
    if (Number.isInteger(sfx)) this.sfxLevel = Math.max(0, Math.min(3, sfx));
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(BUS_LEVELS[this.sfxLevel], now, 0.02);
    this.musicBus.gain.setTargetAtTime(BUS_LEVELS[this.musicLevel] * 0.55, now, 0.02);
  }

  get volume() {
    return VOLUME_LEVELS[this.volumeIndex].gain;
  }

  get volumeLevel() {
    return VOLUME_LEVELS[this.volumeIndex];
  }

  get muted() {
    return this.volume === 0;
  }

  /** Avanza al siguiente nivel de volumen (OFF → LOW → HIGH → OFF). */
  cycleVolume() {
    this.volumeIndex = (this.volumeIndex + 1) % VOLUME_LEVELS.length;
    this._applyVolume();
    return this.volumeLevel;
  }

  setVolumeLevel(id) {
    const index = VOLUME_LEVELS.findIndex((v) => v.id === id);
    if (index >= 0) {
      this.volumeIndex = index;
      this._applyVolume();
    }
  }

  _applyVolume() {
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.01);
    }
    if (this.muted) this.stopAll();
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  /** El contexto de audio solo se crea tras el primer gesto del usuario (ver _unlock). */
  _ready() {
    if (this.muted || !this.ctx) return false;
    return this.ctx.state !== 'closed';
  }

  /**
   * Toca una voz.
   * @param {object} v
   * @param {'pulse12'|'pulse25'|'pulse50'|'square'|'triangle'|'sawtooth'|'noise'} v.wave
   * @param {number} [v.freq] Frecuencia en Hz (o nota "A4").
   * @param {number} [v.slideTo] Frecuencia final para barridos.
   * @param {number} v.duration Segundos.
   * @param {number} [v.volume] 0..1.
   * @param {number} [v.delay] Segundos de retardo.
   * @param {number} [v.vibrato] Velocidad del vibrato en Hz.
   * @param {number} [v.filter] Corte del filtro paso bajo (solo ruido).
   * @param {number} [v.filterTo] Corte final del filtro (solo ruido).
   * @param {number} [v.at] Instante absoluto (AudioContext.currentTime) en lugar de delay.
   * @param {'sfx'|'music'} [v.bus] Bus de salida.
   */
  tone(v) {
    if (!this._ready()) return;
    const ctx = this.ctx;
    const start = v.at !== undefined ? Math.max(ctx.currentTime, v.at) : ctx.currentTime + (v.delay || 0) + 0.005;
    const duration = Math.max(0.01, v.duration || 0.1);
    const end = start + duration;
    const peak = Math.max(0.0001, Math.min(1, v.volume ?? 0.5));

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.004);
    gain.gain.setValueAtTime(peak, Math.max(start + 0.005, end - 0.02));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    const isMusic = v.bus === 'music';
    gain.connect(isMusic ? this.musicBus : this.sfxBus);

    let source;
    let filter = null;
    if (v.wave === 'noise') {
      source = ctx.createBufferSource();
      source.buffer = this.noiseBuffer;
      source.loop = true;
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(v.filter || 4000, start);
      if (v.filterTo) filter.frequency.exponentialRampToValueAtTime(Math.max(20, v.filterTo), end);
      source.connect(filter);
      filter.connect(gain);
    } else {
      source = ctx.createOscillator();
      const wave = this._wave(v.wave);
      if (this.waves[wave]) {
        source.setPeriodicWave(this.waves[wave]);
      } else {
        source.type = wave === 'triangle' || wave === 'sawtooth' ? wave : 'square';
      }
      const freq = noteToFreq(v.freq) || 440;
      source.frequency.setValueAtTime(freq, start);
      if (v.slideTo) source.frequency.exponentialRampToValueAtTime(Math.max(20, noteToFreq(v.slideTo)), end);
      if (v.vibrato) {
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = v.vibrato;
        lfoGain.gain.value = freq * 0.03;
        lfo.connect(lfoGain);
        lfoGain.connect(source.frequency);
        lfo.start(start);
        lfo.stop(end);
      }
      source.connect(gain);
    }

    source.start(start);
    source.stop(end + 0.02);
    const entry = { source, gain, music: isMusic };
    this.activeNodes.add(entry);
    source.onended = () => {
      this.activeNodes.delete(entry);
      gain.disconnect();
      if (filter) filter.disconnect();
    };
  }

  /** Dispara un efecto predefinido por nombre (ver SFX). */
  sfx(name) {
    const voices = SFX[name];
    if (!voices) return;
    for (const voice of voices) this.tone(voice);
  }

  /** Lista de nombres de efectos disponibles. */
  get effects() {
    return Object.keys(SFX);
  }

  /**
   * Toca una melodía: por nombre predefinido o como objeto { tempo, wave, notes: [[nota, tiempos], ...] }.
   * Devuelve la duración total en segundos.
   */
  melody(nameOrDef, { volume = 0.45 } = {}) {
    const def = typeof nameOrDef === 'string' ? MELODIES[nameOrDef] : nameOrDef;
    if (!def) return 0;
    const beat = 60 / (def.tempo || 200);
    let t = 0;
    for (const [note, beats] of def.notes) {
      const duration = beats * beat;
      const freq = noteToFreq(note);
      if (freq > 0) {
        this.tone({ wave: def.wave || 'pulse50', freq, duration: duration * 0.9, volume, delay: t });
        this.tone({ wave: 'triangle', freq: freq / 2, duration: duration * 0.9, volume: volume * 0.6, delay: t });
      }
      t += duration;
    }
    return t;
  }

  // ---------- Música ----------

  /** Empieza a sonar una pista en bucle (ver MUSIC_TRACKS). Si ya suena, no hace nada. */
  playMusic(id) {
    const track = PARSED_TRACKS[id] || PARSED_TRACKS.menu;
    const trackId = PARSED_TRACKS[id] ? id : 'menu';
    if (this.music.playing && this.music.id === trackId) return;
    this.stopMusic();
    this.music = { track, id: trackId, step: 0, nextTime: 0, playing: true };
  }

  /** Detiene la música (las notas ya programadas se cortan). */
  stopMusic() {
    this.music.playing = false;
    this.music.id = null;
    this._stopNodes((entry) => entry.music);
  }

  pauseMusic() {
    if (!this.music.track) return;
    this.music.playing = false;
    this._stopNodes((entry) => entry.music);
  }

  resumeMusic() {
    if (!this.music.track || this.music.id === null) return;
    this.music.playing = true;
    this.music.nextTime = 0;
  }

  get musicTrackId() {
    return this.music.playing ? this.music.id : null;
  }

  /** Programa las notas de los próximos ~200 ms. Se llama una vez por frame. */
  updateMusic() {
    const m = this.music;
    if (!m.playing || !m.track || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const stepDur = 60 / m.track.tempo / 2;
    if (m.nextTime < now) m.nextTime = now + 0.05;
    if (this.muted || this.musicLevel === 0) {
      while (m.nextTime < now + 0.2) {
        m.step = (m.step + 1) % m.track.length;
        m.nextTime += stepDur;
      }
      return;
    }
    while (m.nextTime < now + 0.2) {
      const at = m.nextTime;
      const cell = m.track.byStep[m.step];
      if (cell.lead) {
        this.tone({ bus: 'music', at, wave: 'pulse25', freq: cell.lead.note, duration: cell.lead.steps * stepDur * 0.92, volume: 0.32 });
      }
      if (cell.bass) {
        this.tone({ bus: 'music', at, wave: 'triangle', freq: cell.bass.note, duration: cell.bass.steps * stepDur * 0.95, volume: 0.6 });
      }
      if (cell.drum === 'k') {
        this.tone({ bus: 'music', at, wave: 'triangle', freq: 150, slideTo: 45, duration: 0.09, volume: 0.75 });
      } else if (cell.drum === 's') {
        this.tone({ bus: 'music', at, wave: 'noise', duration: 0.08, volume: 0.32, filter: 5200 });
      } else if (cell.drum === 'h') {
        this.tone({ bus: 'music', at, wave: 'noise', duration: 0.025, volume: 0.14, filter: 9000 });
      }
      m.step = (m.step + 1) % m.track.length;
      m.nextTime += stepDur;
    }
  }

  _stopNodes(predicate) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const entry of [...this.activeNodes]) {
      if (!predicate(entry)) continue;
      try {
        entry.gain.gain.cancelScheduledValues(now);
        entry.gain.gain.setValueAtTime(0.0001, now);
        entry.source.stop(now + 0.01);
      } catch {
        // El nodo ya estaba detenido.
      }
      this.activeNodes.delete(entry);
    }
  }

  /** Detiene los efectos en curso (la música sigue). */
  stopEffects() {
    this._stopNodes((entry) => !entry.music);
  }

  /** Detiene inmediatamente todos los sonidos en curso, música incluida. */
  stopAll() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const { source, gain } of this.activeNodes) {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0.0001, now);
        source.stop(now + 0.01);
      } catch {
        // El nodo ya estaba detenido.
      }
    }
    this.activeNodes.clear();
  }
}
