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
  // Logro desbloqueado: arpegio rápido, destello agudo y acorde final con vibrato.
  achievement: [
    ...['E5', 'G#5', 'B5', 'E6'].map((freq, i) => ({ wave: 'pulse25', freq, duration: 0.07, delay: i * 0.06, volume: 0.45 })),
    { wave: 'pulse12', freq: 'B6', duration: 0.05, delay: 0.3, volume: 0.22 },
    { wave: 'pulse12', freq: 'E7', duration: 0.14, delay: 0.36, volume: 0.22 },
    { wave: 'triangle', freq: 'E6', duration: 0.45, delay: 0.3, volume: 0.55, vibrato: 8 },
    { wave: 'triangle', freq: 'E4', duration: 0.45, delay: 0.3, volume: 0.45 }
  ],
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
  blip4: [{ wave: 'pulse50', freq: 659, duration: 0.25, volume: 0.5 }],

  // Jingles del tema estacional (al encender y en la galería de temas).
  seasonAutumn: [
    ...['A4', 'C5', 'E5', 'D#5', 'D5', 'C#5'].map((freq, i) => ({ wave: 'pulse25', freq, duration: 0.14, delay: i * 0.12, volume: 0.4, vibrato: 6 })),
    { wave: 'triangle', freq: 'A2', duration: 0.7, delay: 0.76, volume: 0.6 },
    { wave: 'pulse12', freq: 'A5', duration: 0.6, delay: 0.76, volume: 0.3, vibrato: 5 }
  ],
  seasonWinter: [
    ...['G5', 'B5', 'D6', 'G6', 'D6', 'B5', 'D6'].map((freq, i) => ({ wave: 'triangle', freq, duration: 0.2, delay: i * 0.11, volume: 0.55 })),
    ...['G6', 'B6', 'D7'].map((freq, i) => ({ wave: 'pulse12', freq, duration: 0.08, delay: 0.1 + i * 0.22, volume: 0.15 })),
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ wave: 'noise', duration: 0.03, delay: i * 0.13, volume: 0.12, filter: 9500 })),
    { wave: 'triangle', freq: 'G6', duration: 0.6, delay: 0.82, volume: 0.5 },
    { wave: 'pulse12', freq: 'G5', duration: 0.6, delay: 0.82, volume: 0.2 }
  ],
  seasonSpring: [
    ...[0, 0.09, 0.32, 0.4].map((delay) => ({ wave: 'pulse12', freq: 2100, slideTo: 3300, duration: 0.06, delay, volume: 0.22 })),
    ...['C5', 'E5', 'G5', 'A5', 'G5'].map((freq, i) => ({ wave: 'pulse25', freq, duration: 0.13, delay: 0.55 + i * 0.12, volume: 0.4 })),
    { wave: 'pulse25', freq: 'C6', duration: 0.45, delay: 1.15, volume: 0.4 },
    { wave: 'triangle', freq: 'C4', duration: 0.45, delay: 1.15, volume: 0.5 }
  ],
  seasonSummer: [
    ...['C5', 'E5', 'G5', 'C6', 'G5', 'E5', 'G5'].map((freq, i) => ({ wave: 'triangle', freq, duration: 0.11, delay: i * 0.1, volume: 0.6 })),
    ...['C4', 'G4', 'C4', 'G4'].map((freq, i) => ({ wave: 'pulse50', freq, duration: 0.08, delay: i * 0.2, volume: 0.25 })),
    { wave: 'triangle', freq: 'C6', duration: 0.5, delay: 0.75, volume: 0.55 },
    { wave: 'pulse25', freq: 'E6', duration: 0.5, delay: 0.75, volume: 0.3 }
  ]
};

/** Melodías cortas (nota, duración en tiempos). */
const MELODIES = {
  start: { tempo: 260, wave: 'pulse50', notes: [['G4', 0.5], ['C5', 0.5], ['E5', 0.5], ['G5', 1]] },
  gameover: { tempo: 150, wave: 'pulse50', notes: [['G4', 0.5], ['-', 0.1], ['E4', 0.5], ['-', 0.1], ['C4', 0.5], ['D4', 0.5], ['B3', 0.5], ['C4', 1.5]] },
  record: { tempo: 240, wave: 'pulse25', notes: [['C5', 0.5], ['C5', 0.5], ['G5', 0.5], ['G5', 0.5], ['A5', 0.5], ['A5', 0.5], ['G5', 1], ['E5', 0.5], ['C6', 1.5]] },
  nocart: { tempo: 180, wave: 'pulse12', notes: [['E5', 0.5], ['C5', 0.5], ['-', 0.25], ['E5', 0.5], ['C5', 0.5]] },
  // Modo carrera: etapa superada y jefe derrotado (o carrera completa).
  stage: { tempo: 260, wave: 'pulse25', notes: [['E5', 0.5], ['G5', 0.5], ['C6', 0.5], ['-', 0.1], ['G5', 0.5], ['C6', 1.5]] },
  boss: {
    tempo: 220,
    wave: 'pulse50',
    notes: [['C5', 0.5], ['E5', 0.5], ['G5', 0.5], ['C6', 1], ['-', 0.1], ['A5', 0.5], ['B5', 0.5], ['C6', 0.5], ['D6', 0.5], ['E6', 2]]
  }
};

/**
 * Timbres de los temas (Themes.js). Cada uno cambia, sobre el pulso seco de 8 bits:
 *   echo/delay/feedback → eco (nivel, retardo en s y realimentación);
 *   smooth → los pulsos estrechos suenan como pulso del 50% (más suave);
 *   pitch → multiplica todas las frecuencias; tempo → multiplica el tempo de la música;
 *   gain → multiplica el volumen general; hum → zumbido de red eléctrica de fondo (nivel).
 */
const FLAVOR_DEFAULTS = Object.freeze({ echo: 0, delay: 0.14, feedback: 0.32, smooth: false, pitch: 1, tempo: 1, gain: 1, hum: 0 });

export const FLAVORS = {
  retro: {},
  future: { echo: 0.45, smooth: true },
  deep: { pitch: 0.84 },
  hum: { hum: 0.05 },
  hall: { echo: 0.3, delay: 0.06, feedback: 0.18 },
  dreamy: { echo: 0.5, delay: 0.24, feedback: 0.38, smooth: true, pitch: 0.94, tempo: 0.88 },
  soft: { gain: 0.5 }
};

/** Duración aproximada de los jingles de temporada, para esperar antes de la música del menú. */
export const SEASON_JINGLE_TIME = 1.6;

/** Niveles 0..3 para los buses de música y efectos (menú de ajustes). */
export const BUS_LEVELS = [0, 0.35, 0.7, 1];

const DRUMS_A = 'k - h - s - h - k - h k s - h - k - h - s - h - k - h k s - h -';
const DRUMS_B = 'k h h h s h h h k h k h s h h h k h h h s h h h k h k h s h s s';
const DRUMS_C = 'k - - - s - - - k - - - s - - - k - - - s - - - k - k - s - - -';
const DRUMS_D = 'k - h k s - h - k - h k s - h h k - h k s - h - k k h - s s s s';
const DRUMS_E = 'k h k h s h k h k h k h s h k h k h k h s h k h k h k h s s s s';
const DRUMS_F = 'k - s s k - s - k - s s k - s - k - s s k - s - k k s s k s s s';
const DRUMS_G = 'k - - - - - h - s - - - - - h - k - - - - - h - s - - - k - h h';

/**
 * Pistas de música en bucle (composiciones originales).
 * Cada pista tiene 32 pasos de corchea: nota ("A4"), "-" silencio, "_" mantiene la nota anterior.
 * drums: k = bombo, s = caja, h = charles.
 * Cada motor tiene dos pistas: la suya (id del motor) y una segunda (`<id>_b`) para los niveles pares
 * (ver trackFor). El jukebox de Opciones las toca todas.
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
  blockdrop_b: {
    tempo: 156,
    lead: 'F5 _ A5 _ C6 _ A5 _ Bb5 _ G5 _ E5 _ C5 _ D5 F5 A5 _ G5 F5 E5 _ F5 _ D5 _ A4 _ - -',
    bass: 'F2 C3 F2 C3 F2 C3 F2 C3 G2 D3 G2 D3 C3 G2 C3 G2 D3 A2 D3 A2 Bb2 F2 Bb2 F2 A2 E3 A2 E3 D3 _ - -',
    drums: DRUMS_B
  },
  mazemuncher: {
    tempo: 160,
    lead: 'C5 E5 G5 E5 C6 _ G5 _ A5 G5 E5 G5 C5 _ - - D5 F5 A5 F5 D6 _ A5 _ B5 G5 F5 D5 C5 _ - -',
    bass: 'C3 _ G2 _ C3 _ G2 _ F2 _ C3 _ F2 _ C3 _ D3 _ A2 _ D3 _ A2 _ G2 _ D3 _ G2 _ C3 _',
    drums: DRUMS_A
  },
  mazemuncher_b: {
    tempo: 160,
    lead: 'A5 _ E5 A5 C6 _ B5 A5 G5 _ D5 G5 B5 _ A5 G5 F5 _ C5 F5 A5 _ G5 F5 E5 G5 B5 _ E6 _ - -',
    bass: 'A2 _ E3 _ A2 _ E3 _ G2 _ D3 _ G2 _ D3 _ F2 _ C3 _ F2 _ C3 _ E2 _ B2 _ E2 _ G#2 _',
    drums: DRUMS_A
  },
  cybersnake: {
    tempo: 170,
    lead: 'E5 - E5 G5 - E5 D5 - B4 _ - B4 D5 E5 _ - G5 - G5 A5 - G5 F#5 - E5 _ - D5 E5 _ _ -',
    bass: 'E2 E2 E3 E2 E2 E3 E2 E3 E2 E2 E3 E2 D2 D3 D2 D3 C2 C2 C3 C2 C2 C3 C2 C3 B1 B1 B2 B1 B1 B2 B1 B2',
    drums: DRUMS_B
  },
  cybersnake_b: {
    tempo: 170,
    lead: 'B4 - B4 D5 - E5 G5 - A5 _ G5 E5 D5 _ - - C5 - C5 E5 - G5 A5 - B5 _ A5 G5 F#5 _ E5 _',
    bass: 'G2 G2 G3 G2 G2 G3 G2 G3 D2 D2 D3 D2 D2 D3 D2 D3 C2 C2 C3 C2 C2 C3 C2 C3 B1 B1 B2 B1 B1 B2 B1 B2',
    drums: DRUMS_D
  },
  brickbreaker: {
    tempo: 140,
    lead: 'G5 _ B5 _ D6 _ B5 _ C6 _ A5 _ F#5 _ D5 _ E5 _ G5 _ B5 _ A5 G5 F#5 _ A5 _ G5 _ - -',
    bass: 'G2 _ D3 _ G2 _ D3 _ A2 _ E3 _ D2 _ A2 _ C3 _ G2 _ E2 _ B2 _ D2 _ A2 _ G2 _ D3 _',
    drums: DRUMS_A
  },
  brickbreaker_b: {
    tempo: 140,
    lead: 'E5 _ G5 _ B5 _ E6 _ D6 _ B5 _ G5 _ A5 _ C6 _ B5 _ A5 _ G5 _ F#5 _ D5 _ E5 _ - -',
    bass: 'E2 _ B2 _ E2 _ B2 _ G2 _ D3 _ D2 _ A2 _ C3 _ G2 _ C3 _ G2 _ D2 _ A2 _ E2 _ B2 _',
    drums: DRUMS_C
  },
  roadracer: {
    tempo: 180,
    lead: 'A4 C5 E5 A5 G5 E5 C5 E5 F5 _ E5 D5 C5 _ B4 _ A4 C5 E5 A5 B5 A5 G5 E5 F5 E5 D5 B4 A4 _ - -',
    bass: 'A2 A2 A3 A2 A2 A2 A3 A2 F2 F2 F3 F2 G2 G2 G3 G2 A2 A2 A3 A2 A2 A2 A3 A2 D2 D2 D3 D2 E2 E2 E3 E2',
    drums: DRUMS_B
  },
  roadracer_b: {
    tempo: 180,
    lead: 'E5 G5 C6 E6 D6 C6 B5 G5 A5 _ C6 A5 G5 _ E5 _ F5 A5 C6 F6 E6 D6 C6 A5 B5 G5 D6 B5 C6 _ - -',
    bass: 'C2 C2 C3 C2 C2 C2 C3 C2 A1 A1 A2 A1 E2 E2 E3 E2 F2 F2 F3 F2 F2 F2 F3 F2 G2 G2 G3 G2 C2 C2 C3 C2',
    drums: DRUMS_E
  },
  tankbattle: {
    tempo: 132,
    lead: 'D5 _ D5 F5 A5 _ - A5 G5 _ F5 E5 D5 _ - - C5 _ C5 E5 G5 _ - G5 F5 _ E5 C#5 D5 _ - -',
    bass: 'D2 - D3 - D2 - D3 - Bb1 - Bb2 - Bb1 - Bb2 - C2 - C3 - C2 - C3 - A1 - A2 - A1 - A2 -',
    drums: DRUMS_C
  },
  tankbattle_b: {
    tempo: 132,
    lead: 'A4 _ A4 C5 F5 _ - F5 E5 _ D5 C5 Bb4 _ - - G4 _ G4 Bb4 D5 _ - D5 C5 _ Bb4 G4 A4 _ - -',
    bass: 'F2 - F3 - F2 - F3 - C2 - C3 - C2 - C3 - G1 - G2 - G1 - G2 - A1 - A2 - A1 - A2 -',
    drums: DRUMS_F
  },
  spaceshooter: {
    tempo: 150,
    lead: 'F#5 _ C#6 _ A5 _ F#5 _ E5 _ G#5 _ B5 _ - - D5 _ A5 _ F#5 _ D5 _ C#5 _ E5 _ G#5 _ C#6 _',
    bass: 'F#2 F#3 F#2 F#3 F#2 F#3 F#2 F#3 E2 E3 E2 E3 E2 E3 E2 E3 D2 D3 D2 D3 D2 D3 D2 D3 C#2 C#3 C#2 C#3 C#2 C#3 C#2 C#3',
    drums: DRUMS_B
  },
  spaceshooter_b: {
    tempo: 150,
    lead: 'A5 _ F#5 _ D5 _ F#5 A5 B5 _ G#5 _ E5 _ - - F#5 _ C#6 _ A5 _ F#5 _ G#5 _ F5 _ C#5 _ - -',
    bass: 'D2 D3 D2 D3 D2 D3 D2 D3 E2 E3 E2 E3 E2 E3 E2 E3 F#2 F#3 F#2 F#3 F#2 F#3 F#2 F#3 C#2 C#3 C#2 C#3 C#2 C#3 C#2 C#3',
    drums: DRUMS_E
  },
  frogcrossing: {
    tempo: 145,
    lead: 'F5 A5 C6 A5 F5 _ C5 _ D5 F5 A5 F5 D5 _ - - Bb4 D5 F5 D5 Bb4 _ G5 _ C5 E5 G5 E5 F5 _ - -',
    bass: 'F2 _ C3 _ F2 _ C3 _ D2 _ A2 _ D2 _ A2 _ Bb1 _ F2 _ Bb1 _ F2 _ C2 _ G2 _ F2 _ C3 _',
    drums: DRUMS_A
  },
  frogcrossing_b: {
    tempo: 145,
    lead: 'D5 F5 Bb5 F5 D5 _ Bb4 _ C5 Eb5 G5 Eb5 C5 _ - - F5 A5 C6 A5 F5 _ D5 _ E5 G5 C6 G5 F5 _ - -',
    bass: 'Bb1 _ F2 _ Bb1 _ F2 _ C2 _ G2 _ C2 _ G2 _ F2 _ C3 _ F2 _ C3 _ C2 _ G2 _ F2 _ C3 _',
    drums: DRUMS_A
  },
  flappypixel: {
    tempo: 120,
    lead: 'G5 _ E5 _ C5 _ E5 _ G5 _ C6 _ - - B5 _ A5 _ F5 _ A5 _ G5 _ E5 _ D5 _ - - - -',
    bass: 'C3 _ _ _ G2 _ _ _ A2 _ _ _ E2 _ _ _ F2 _ _ _ C3 _ _ _ D3 _ _ _ G2 _ _ _',
    drums: DRUMS_C
  },
  flappypixel_b: {
    tempo: 120,
    lead: 'A5 _ F5 _ C5 _ F5 _ A5 _ C6 _ - - G5 _ E5 _ C5 _ E5 _ G5 _ Bb5 _ A5 _ - - - -',
    bass: 'F2 _ _ _ C3 _ _ _ F2 _ _ _ A2 _ _ _ C3 _ _ _ G2 _ _ _ C3 _ _ _ F2 _ _ _',
    drums: DRUMS_C
  },
  memorymatrix: {
    tempo: 110,
    lead: 'B4 _ D5 _ F#5 _ - - E5 _ G5 _ B5 _ - - A5 _ F#5 _ D5 _ - - C#5 _ E5 _ F#5 _ _ _',
    bass: 'B2 _ F#2 _ B2 _ F#2 _ E2 _ B2 _ E2 _ B2 _ D2 _ A2 _ D2 _ A2 _ F#2 _ C#3 _ F#2 _ C#3 _',
    drums: DRUMS_C
  },
  memorymatrix_b: {
    tempo: 110,
    lead: 'D5 _ G5 _ B5 _ - - A5 _ F#5 _ D5 _ - - E5 _ G5 _ B5 _ - - A#5 _ F#5 _ C#5 _ _ _',
    bass: 'G2 _ D3 _ G2 _ D3 _ F#2 _ D3 _ F#2 _ A2 _ E2 _ B2 _ E2 _ B2 _ F#2 _ C#3 _ F#2 _ A#2 _',
    drums: DRUMS_G
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

/** Pista de un motor según el nivel: la principal en los niveles impares y la segunda en los pares. */
export function trackFor(engineId, level = 1) {
  const alt = `${engineId}_b`;
  return level % 2 === 0 && PARSED_TRACKS[alt] ? alt : engineId;
}

/** Pista ya convertida en pasos (para dibujarla en el jukebox). */
export function getTrack(id) {
  return PARSED_TRACKS[id] || null;
}

/**
 * Modo beeper: una sola voz. De las voces de un efecto que se pisan, se queda con la primera que empieza
 * (el resto se tocaría a la vez y un altavoz piezo de 1 bit no puede).
 */
function monoVoices(voices) {
  const sorted = voices.map((v, i) => ({ v, i, start: v.delay || 0 })).sort((a, b) => a.start - b.start || a.i - b.i);
  const kept = [];
  let free = 0;
  for (const { v, start } of sorted) {
    if (start < free - 0.001) continue;
    kept.push(v);
    free = start + (v.duration || 0.1);
  }
  return kept;
}

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
    this.flavorDef = { ...FLAVOR_DEFAULTS };
    this.echoWet = null;
    this.echoDelay = null;
    this.echoFeedback = null;
    this.hum = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.sfxLevel = 3;
    this.musicLevel = 2;
    this.music = { track: null, id: null, step: 0, nextTime: 0, playing: false, next: null };
    this.beeper = false;
    this.compressor = null;
    this.analyser = null;
    this.piezo = null;
    this.spectrumData = null;
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

    this.compressor = compressor;

    // Salida: master → analizador (barras del jukebox) → [altavoz piezo en modo beeper] → compresor.
    this.master = this.ctx.createGain();
    this.master.gain.value = this._masterLevel();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -25;
    this.analyser.smoothingTimeConstant = 0.55;
    this.master.connect(this.analyser);
    this.piezo = this._buildPiezo(compressor);
    this._route();

    // Buses separados para efectos y música (niveles del menú de ajustes).
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = BUS_LEVELS[this.sfxLevel];
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = BUS_LEVELS[this.musicLevel] * 0.55;
    this.musicBus.connect(this.master);

    // Eco de los temas que lo usan: master → delay ↺ feedback → wet → compresor.
    const delay = this.ctx.createDelay(1);
    delay.delayTime.value = this.flavorDef.delay;
    const feedback = this.ctx.createGain();
    feedback.gain.value = this.flavorDef.feedback;
    this.echoDelay = delay;
    this.echoFeedback = feedback;
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

    this._buildWaves();
    this._buildNoise();
    this._applyFlavor();
    return this.ctx;
  }

  /** Altavoz piezoeléctrico de las maquinitas: sin graves, con una resonancia chillona hacia 3 kHz. */
  _buildPiezo(destination) {
    const ctx = this.ctx;
    const lowCut = ctx.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.frequency.value = 520;
    lowCut.Q.value = 0.8;
    const resonance = ctx.createBiquadFilter();
    resonance.type = 'peaking';
    resonance.frequency.value = 3100;
    resonance.Q.value = 1.4;
    resonance.gain.value = 7;
    const highCut = ctx.createBiquadFilter();
    highCut.type = 'lowpass';
    highCut.frequency.value = 7000;
    const level = ctx.createGain();
    level.gain.value = 0.85;
    lowCut.connect(resonance);
    resonance.connect(highCut);
    highCut.connect(level);
    level.connect(destination);
    return lowCut;
  }

  _route() {
    if (!this.analyser) return;
    this.analyser.disconnect();
    this.analyser.connect(this.beeper ? this.piezo : this.compressor);
  }

  /**
   * Modo beeper: imita el altavoz piezo de las maquinitas de bolsillo. Todo suena con onda cuadrada y una
   * sola voz (la música pierde el bajo, la batería se vuelve chasquidos y los efectos cortan la música),
   * sin eco ni zumbido.
   */
  setBeeper(on) {
    const next = !!on;
    if (next === this.beeper) return;
    this.beeper = next;
    if (!this.ctx) return;
    this.stopAll();
    if (this.music.playing) this.music.nextTime = 0;
    this._route();
    this._applyFlavor();
    this.setBusLevels({});
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

  /** Timbre del tema (ver FLAVORS): las mismas notas con otro eco, tono, tempo o volumen. */
  setFlavor(flavor) {
    this.flavor = FLAVORS[flavor] ? flavor : 'retro';
    this.flavorDef = { ...FLAVOR_DEFAULTS, ...FLAVORS[this.flavor] };
    this._applyFlavor();
  }

  _applyFlavor() {
    if (!this.echoWet || !this.ctx) return;
    const now = this.ctx.currentTime;
    const f = this.flavorDef;
    this.echoWet.gain.setTargetAtTime(this.beeper ? 0 : f.echo, now, 0.02);
    this.echoDelay.delayTime.setTargetAtTime(f.delay, now, 0.02);
    this.echoFeedback.gain.setTargetAtTime(f.feedback, now, 0.02);
    this.master.gain.setTargetAtTime(this._masterLevel(), now, 0.02);
    this._syncHum();
  }

  /** Zumbido grave y continuo de los aparatos con tubo (tema Fósforo ámbar). Va por el bus de efectos. */
  _syncHum() {
    const ctx = this.ctx;
    const level = this.beeper ? 0 : this.flavorDef.hum;
    if (level > 0 && !this.hum) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 60;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxBus);
      osc.start();
      this.hum = { osc, filter, gain };
    }
    if (!this.hum) return;
    const now = ctx.currentTime;
    if (level > 0) {
      this.hum.gain.gain.setTargetAtTime(level, now, 0.3);
      return;
    }
    const { osc, filter, gain } = this.hum;
    this.hum = null;
    gain.gain.setTargetAtTime(0.0001, now, 0.1);
    osc.stop(now + 0.6);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  _masterLevel() {
    return this.volume * this.flavorDef.gain;
  }

  /** Con el timbre suave los pulsos estrechos se convierten en pulso del 50%; en modo beeper, todo. */
  _wave(wave) {
    if (this.beeper && wave !== 'noise') return 'pulse50';
    if (this.flavorDef.smooth && (wave === 'pulse12' || wave === 'pulse25')) return 'pulse50';
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
      this.master.gain.setTargetAtTime(this._masterLevel(), this.ctx.currentTime, 0.01);
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
      const pitch = this.flavorDef.pitch;
      const freq = (noteToFreq(v.freq) || 440) * pitch;
      source.frequency.setValueAtTime(freq, start);
      if (v.slideTo) source.frequency.exponentialRampToValueAtTime(Math.max(20, noteToFreq(v.slideTo) * pitch), end);
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

  /** Dispara un efecto predefinido por nombre (ver SFX). Devuelve su duración en segundos. */
  sfx(name) {
    const voices = SFX[name];
    if (!voices) return 0;
    if (this.beeper && this._ready()) this.stopEffects();
    let length = 0;
    for (const voice of this.beeper ? monoVoices(voices) : voices) {
      this.tone(voice);
      length = Math.max(length, (voice.delay || 0) + (voice.duration || 0.1));
    }
    if (this.beeper) this._duckMusic(length);
    return length;
  }

  /** En modo beeper solo hay una voz: un efecto o un jingle corta la música mientras suena. */
  _duckMusic(seconds) {
    if (!this._ready() || seconds <= 0) return;
    const now = this.ctx.currentTime;
    const gain = this.musicBus.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(0, now);
    gain.setValueAtTime(BUS_LEVELS[this.musicLevel] * 0.55, now + seconds);
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
    const beat = 60 / ((def.tempo || 200) * this.flavorDef.tempo);
    let t = 0;
    for (const [note, beats] of def.notes) {
      const duration = beats * beat;
      const freq = noteToFreq(note);
      if (freq > 0) {
        this.tone({ wave: def.wave || 'pulse50', freq, duration: duration * 0.9, volume, delay: t });
        if (!this.beeper) this.tone({ wave: 'triangle', freq: freq / 2, duration: duration * 0.9, volume: volume * 0.6, delay: t });
      }
      t += duration;
    }
    if (this.beeper) this._duckMusic(t);
    return t;
  }

  // ---------- Música ----------

  /**
   * Empieza a sonar una pista en bucle (ver MUSIC_TRACKS). Si ya suena, no hace nada.
   * `delay` (s) deja sonar antes un jingle.
   */
  playMusic(id, { delay = 0 } = {}) {
    const track = PARSED_TRACKS[id] || PARSED_TRACKS.menu;
    const trackId = PARSED_TRACKS[id] ? id : 'menu';
    if (this.music.playing && this.music.id === trackId) {
      this.music.next = null;
      return;
    }
    this.stopMusic();
    const waitUntil = delay > 0 ? performance.now() + delay * 1000 : 0;
    this.music = { track, id: trackId, step: 0, nextTime: 0, playing: true, waitUntil, next: null };
  }

  /**
   * Pasa a otra pista sin cortar la frase: el cambio se hace al empezar la siguiente mitad del bucle
   * (cada 16 corcheas). Si ya suena o ya está en cola, no hace nada.
   */
  queueMusic(id) {
    const m = this.music;
    if (!PARSED_TRACKS[id] || m.id === null) return;
    m.next = m.id === id ? null : id;
  }

  /** Detiene la música (las notas ya programadas se cortan). */
  stopMusic() {
    this.music.playing = false;
    this.music.id = null;
    this.music.next = null;
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

  _stepDuration(track) {
    return 60 / (track.tempo * this.flavorDef.tempo) / 2;
  }

  /** Paso de la pista que se oye ahora (las notas se programan unos 0,2 s antes); null si no suena nada. */
  musicPosition() {
    const m = this.music;
    if (!m.playing || !m.track || !this.ctx || m.waitUntil) return null;
    const ahead = Math.max(0, Math.ceil((m.nextTime - this.ctx.currentTime) / this._stepDuration(m.track)));
    const length = m.track.length;
    return { id: m.id, step: (((m.step - ahead) % length) + length) % length, length };
  }

  /** Niveles 0..1 de lo que suena en `bands` bandas de 80 Hz a 8 kHz (escala logarítmica). */
  spectrum(bands = 16) {
    const levels = new Array(bands).fill(0);
    if (!this.analyser || this.ctx.state !== 'running') return levels;
    if (!this.spectrumData) this.spectrumData = new Uint8Array(this.analyser.frequencyBinCount);
    const data = this.spectrumData;
    this.analyser.getByteFrequencyData(data);
    const binHz = this.ctx.sampleRate / this.analyser.fftSize;
    const low = 80;
    const high = 8000;
    for (let b = 0; b < bands; b++) {
      const from = Math.max(1, Math.floor((low * (high / low) ** (b / bands)) / binHz));
      const to = Math.max(from + 1, Math.ceil((low * (high / low) ** ((b + 1) / bands)) / binHz));
      let peak = 0;
      for (let i = from; i < to && i < data.length; i++) peak = Math.max(peak, data[i]);
      levels[b] = peak / 255;
    }
    return levels;
  }

  /** Programa las notas de los próximos ~200 ms. Se llama una vez por frame. */
  updateMusic() {
    const m = this.music;
    if (!m.playing || !m.track || !this.ctx || this.ctx.state !== 'running') return;
    if (m.waitUntil) {
      if (performance.now() < m.waitUntil) return;
      m.waitUntil = 0;
    }
    const now = this.ctx.currentTime;
    if (m.nextTime < now) m.nextTime = now + 0.05;
    const silent = this.muted || this.musicLevel === 0;
    while (m.nextTime < now + 0.2) {
      if (m.next && m.step % 16 === 0) {
        m.track = PARSED_TRACKS[m.next];
        m.id = m.next;
        m.next = null;
        m.step = 0;
      }
      const stepDur = this._stepDuration(m.track);
      if (!silent) this._playStep(m.track.byStep[m.step], m.nextTime, stepDur);
      m.step = (m.step + 1) % m.track.length;
      m.nextTime += stepDur;
    }
  }

  _playStep(cell, at, stepDur) {
    if (this.beeper) {
      // Una voz: la melodía, y la batería como chasquidos del altavoz.
      if (cell.lead) this.tone({ bus: 'music', at, wave: 'pulse50', freq: cell.lead.note, duration: cell.lead.steps * stepDur * 0.85, volume: 0.3 });
      if (cell.drum === 'k') this.tone({ bus: 'music', at, wave: 'pulse50', freq: 110, duration: 0.012, volume: 0.4 });
      else if (cell.drum === 's') this.tone({ bus: 'music', at, wave: 'noise', duration: 0.02, volume: 0.25, filter: 6000 });
      return;
    }
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
