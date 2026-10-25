// src/core/Themes.js
// Temas visuales de la consola. Un tema es:
//   - una paleta para la pantalla (los juegos dibujan con nombres de color: 'ink', 'red', 'ghost'...;
//     `shine` opcional regula el brillo de las celdas 'solid'),
//   - un estilo de celda para Gfx.cell(): 'brick' (ladrillo LCD), 'neon' (luminosa), 'solid' (bloque de
//     píxeles) o 'sketch' (dibujada a bolígrafo),
//   - un timbre para SoundChip.setFlavor(),
//   - una piel de carcasa en console.css (atributo data-skin en <html>) con su rótulo y su etiqueta.
// La lógica de los juegos es la misma en todos. Dos marcas ayudan a los motores que dibujan distinto
// según la pantalla: `colorful` (los colores con nombre se distinguen entre sí) y `dark` (fondo oscuro).

// Okabe-Ito, distinguible con protanopía y deuteranopía.
const COLORBLIND_DARK = {
  red: '#ff7a1a',
  green: '#2fd3a8',
  blue: '#56b4e9',
  cyan: '#a6e3ff',
  yellow: '#f0e442',
  magenta: '#e08ac0',
  orange: '#e69f00'
};

const COLORBLIND_LIGHT = {
  red: '#c25400',
  green: '#007a5e',
  blue: '#0060a8',
  cyan: '#2a8ab8',
  yellow: '#9a7d00',
  magenta: '#a8507f',
  orange: '#b07000'
};

/** Paleta monocroma: los colores se reducen a dos tonos de tinta, como en una LCD de un solo color. */
function mono(base, ink, accent) {
  return {
    ...base,
    ink,
    red: ink,
    green: ink,
    blue: ink,
    white: ink,
    yellow: accent,
    cyan: accent,
    magenta: accent,
    orange: accent
  };
}

const PALETTE_RETRO = mono(
  {
    cellStyle: 'brick',
    colorful: false,
    dark: false,
    on: 'ink',
    bg: '#9ead86',
    ghost: '#8f9e78',
    mid: '#5d6b4f',
    overlay: 'rgba(158, 173, 134, 0.82)',
    highContrast: { bg: '#a9b991', ghost: '#a0b088', mid: '#3a4830', ink: '#081206', yellow: '#1f2c19', cyan: '#1f2c19', magenta: '#1f2c19', orange: '#1f2c19' }
  },
  '#1d2b1a',
  '#3b4a33'
);

const PALETTE_FUTURE = {
  cellStyle: 'neon',
  colorful: true,
  dark: true,
  on: 'cyan',
  bg: '#04040c',
  ghost: '#121633',
  mid: '#5a68b8',
  ink: '#eaf6ff',
  red: '#ff2e63',
  green: '#00ff9c',
  blue: '#2e8bff',
  yellow: '#f9f871',
  cyan: '#00f0ff',
  magenta: '#ff2bd6',
  orange: '#ff8a00',
  white: '#ffffff',
  overlay: 'rgba(4, 4, 12, 0.8)',
  colorblind: COLORBLIND_DARK,
  highContrast: { bg: '#000000', ghost: '#0a0c1c', mid: '#9aa6ff', ink: '#ffffff' }
};

const PALETTE_CRYSTAL = mono(
  {
    cellStyle: 'brick',
    colorful: false,
    dark: false,
    on: 'ink',
    bg: '#b7c2c8',
    ghost: '#a8b3ba',
    mid: '#66727c',
    overlay: 'rgba(183, 194, 200, 0.82)',
    highContrast: { bg: '#c6d0d5', ghost: '#bcc6cc', mid: '#46515b', ink: '#0d1029', yellow: '#262b45', cyan: '#262b45', magenta: '#262b45', orange: '#262b45' }
  },
  '#262b45',
  '#454b66'
);

// Cuatro tonos de verde oliva, como las portátiles de bolsillo de 1989.
const PALETTE_POCKET = mono(
  {
    cellStyle: 'solid',
    colorful: false,
    dark: false,
    on: 'ink',
    bg: '#9bbc0f',
    ghost: '#8cad0f',
    mid: '#306230',
    overlay: 'rgba(155, 188, 15, 0.84)',
    highContrast: { bg: '#a6c81a', ghost: '#9aba16', mid: '#1f4a1f', ink: '#051f05', yellow: '#1f4a1f', cyan: '#1f4a1f', magenta: '#1f4a1f', orange: '#1f4a1f' }
  },
  '#0f380f',
  '#306230'
);

// Fósforo ámbar sobre negro, con brillo y líneas de barrido (estas en CSS).
const PALETTE_AMBER = mono(
  {
    cellStyle: 'neon',
    colorful: false,
    dark: true,
    on: 'ink',
    bg: '#0b0700',
    ghost: '#221600',
    mid: '#8a5c00',
    overlay: 'rgba(11, 7, 0, 0.82)',
    highContrast: { bg: '#000000', ghost: '#1a1100', mid: '#b37a00', ink: '#ffc640' }
  },
  '#ffb000',
  '#d98f00'
);

// Monitor de recreativa: colores primarios saturados sobre negro.
const PALETTE_ARCADE = {
  cellStyle: 'solid',
  colorful: true,
  dark: true,
  on: 'yellow',
  bg: '#07070d',
  ghost: '#16162a',
  mid: '#6e6e9e',
  ink: '#f4f4ff',
  red: '#ff2a2a',
  green: '#2aff4a',
  blue: '#3a5bff',
  yellow: '#ffe81a',
  cyan: '#1ae8ff',
  magenta: '#ff3ad8',
  orange: '#ff8a1a',
  white: '#ffffff',
  overlay: 'rgba(7, 7, 13, 0.8)',
  colorblind: COLORBLIND_DARK,
  highContrast: { bg: '#000000', ghost: '#0e0e1c', mid: '#a0a0d0', ink: '#ffffff' }
};

// LCD sepia cálido de los aparatos con imitación madera.
const PALETTE_WOOD = mono(
  {
    cellStyle: 'brick',
    colorful: false,
    dark: false,
    on: 'ink',
    bg: '#d7c29a',
    ghost: '#c8b188',
    mid: '#87674a',
    overlay: 'rgba(215, 194, 154, 0.84)',
    highContrast: { bg: '#e2cea8', ghost: '#d6bf95', mid: '#644630', ink: '#1e1008', yellow: '#3a2414', cyan: '#3a2414', magenta: '#3a2414', orange: '#3a2414' }
  },
  '#3a2414',
  '#5c3d22'
);

// Celdas pastel luminosas sobre violeta noche.
const PALETTE_VAPOR = {
  cellStyle: 'neon',
  colorful: true,
  dark: true,
  on: 'magenta',
  bg: '#1a0b30',
  ghost: '#2c1850',
  mid: '#9a7fd1',
  ink: '#fdf0ff',
  red: '#ff6b9d',
  green: '#7dffc7',
  blue: '#8ab4ff',
  yellow: '#fff59a',
  cyan: '#6ff3ff',
  magenta: '#ff8ae2',
  orange: '#ffb38a',
  white: '#ffffff',
  overlay: 'rgba(26, 11, 48, 0.8)',
  colorblind: COLORBLIND_DARK,
  highContrast: { bg: '#10051f', ghost: '#22103f', mid: '#c2aef0', ink: '#ffffff' }
};

// Negro puro y rojo tenue: no deslumbra a oscuras y apaga los píxeles de las pantallas OLED.
const PALETTE_OLED = mono(
  {
    cellStyle: 'solid',
    colorful: false,
    dark: true,
    shine: 0.1, // brillo de las celdas muy suave: no deslumbra a oscuras
    on: 'ink',
    bg: '#000000',
    ghost: '#0e0303',
    mid: '#5a1610',
    overlay: 'rgba(0, 0, 0, 0.84)',
    highContrast: { ghost: '#160505', mid: '#7a2016', ink: '#e0402e', yellow: '#b8301f', cyan: '#b8301f', magenta: '#b8301f', orange: '#b8301f' }
  },
  '#b3261e',
  '#8a1d16'
);

// Bolígrafos sobre papel cuadriculado: azul para casi todo y rojo, verde o negro para destacar.
const PALETTE_PAPER = {
  cellStyle: 'sketch',
  colorful: true,
  dark: false,
  on: 'ink',
  bg: '#f8f5ec',
  ghost: '#d9e1f0',
  mid: '#7d8cc0',
  ink: '#1f3a9e',
  red: '#c8302c',
  green: '#2b7d3a',
  blue: '#1f3a9e',
  yellow: '#b88a00',
  cyan: '#1a7896',
  magenta: '#9a2a7a',
  orange: '#c45a10',
  white: '#26262e',
  overlay: 'rgba(248, 245, 236, 0.86)',
  colorblind: { ...COLORBLIND_LIGHT, blue: '#1f3a9e' },
  highContrast: { ghost: '#c8d2e8', mid: '#4a5a96', ink: '#0c1f6e' }
};

// Estacional: una paleta por estación, con la carcasa a juego (data-season en <html>).
const SEASONS = {
  autumn: {
    name: 'OTONO',
    label: 'HARVEST EDITION · DOT MATRIX',
    tag: 'AUTUMN',
    chrome: '#3a1d0c',
    jingle: 'seasonAutumn',
    palette: {
      cellStyle: 'brick',
      colorful: true,
      dark: false,
      on: 'ink',
      bg: '#ebcf9f',
      ghost: '#ddbd89',
      mid: '#9a6a3a',
      ink: '#4a2610',
      red: '#b83a1c',
      green: '#5a7a22',
      blue: '#45457a',
      yellow: '#b8860b',
      cyan: '#3a6e66',
      magenta: '#8a2a4a',
      orange: '#d2601a',
      white: '#4a2610',
      overlay: 'rgba(235, 207, 159, 0.84)',
      colorblind: COLORBLIND_LIGHT,
      highContrast: { ghost: '#e2c591', mid: '#6e4422', ink: '#2a1206' }
    }
  },
  winter: {
    name: 'INVIERNO',
    label: 'SNOW EDITION · DOT MATRIX',
    tag: 'WINTER',
    chrome: '#14304f',
    jingle: 'seasonWinter',
    palette: {
      cellStyle: 'brick',
      colorful: true,
      dark: false,
      on: 'ink',
      bg: '#dce9f3',
      ghost: '#c9d9e6',
      mid: '#7b98b2',
      ink: '#183256',
      red: '#c1121f',
      green: '#21734f',
      blue: '#1d4e89',
      yellow: '#a87c10',
      cyan: '#2f86b0',
      magenta: '#7a3a8f',
      orange: '#c4561f',
      white: '#183256',
      overlay: 'rgba(220, 233, 243, 0.84)',
      colorblind: COLORBLIND_LIGHT,
      highContrast: { ghost: '#d0dfeb', mid: '#56718a', ink: '#0a1a33' }
    }
  },
  spring: {
    name: 'PRIMAVERA',
    label: 'BLOSSOM EDITION · DOT MATRIX',
    tag: 'SPRING',
    chrome: '#24401f',
    jingle: 'seasonSpring',
    palette: {
      cellStyle: 'brick',
      colorful: true,
      dark: false,
      on: 'ink',
      bg: '#e9f1d4',
      ghost: '#d9e4bf',
      mid: '#86a070',
      ink: '#2b4526',
      red: '#cf3f66',
      green: '#348a32',
      blue: '#4466aa',
      yellow: '#b8940f',
      cyan: '#228c8c',
      magenta: '#a8408f',
      orange: '#cf7020',
      white: '#2b4526',
      overlay: 'rgba(233, 241, 212, 0.84)',
      colorblind: COLORBLIND_LIGHT,
      highContrast: { ghost: '#dee8c6', mid: '#5f7a4a', ink: '#142812' }
    }
  },
  summer: {
    name: 'VERANO',
    label: 'SUNSHINE EDITION · DOT MATRIX',
    tag: 'SUMMER',
    chrome: '#0d4a66',
    jingle: 'seasonSummer',
    palette: {
      cellStyle: 'brick',
      colorful: true,
      dark: false,
      on: 'ink',
      bg: '#f8e3ad',
      ghost: '#ecd296',
      mid: '#b88f45',
      ink: '#0d4a66',
      red: '#d8402f',
      green: '#1f8a5e',
      blue: '#1a66a8',
      yellow: '#c4930a',
      cyan: '#118ea6',
      magenta: '#b83a80',
      orange: '#e07a12',
      white: '#0d4a66',
      overlay: 'rgba(248, 227, 173, 0.84)',
      colorblind: COLORBLIND_LIGHT,
      highContrast: { ghost: '#f0d99f', mid: '#8a6a2a', ink: '#052a3d' }
    }
  }
};

/** Estación según el mes: otoño sep-nov, invierno dic-feb, primavera mar-may y verano jun-ago. */
export function currentSeason(date = new Date()) {
  const month = date.getMonth() + 1;
  if (month >= 9 && month <= 11) return 'autumn';
  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'spring';
  return 'summer';
}

/**
 * Definición de cada tema. `label` es el rótulo del bisel, `tag` la etiqueta junto a la marca
 * (vacía = sin etiqueta), `chrome` el color de la barra del navegador y `blurb` las 3 líneas que
 * describen el tema en la galería (carcasa, pantalla, sonido).
 */
const THEME_DEFS = {
  retro: {
    name: 'RETRO',
    palette: PALETTE_RETRO,
    sound: 'retro',
    chrome: '#1b1d2a',
    label: 'DOT MATRIX WITH STEREO SOUND',
    tag: '',
    blurb: ['CARCASA AMARILLA', 'LCD VERDE DE LADRILLOS', 'PULSO 8 BITS SECO']
  },
  future: {
    name: 'FUTURISTA',
    palette: PALETTE_FUTURE,
    sound: 'future',
    chrome: '#05050f',
    label: 'HOLO MATRIX · QUANTUM SOUND',
    tag: 'NEO',
    blurb: ['OSCURA CON BORDES NEON', 'CELDAS LUMINOSAS A COLOR', 'CON ECO ESPACIAL']
  },
  crystal: {
    name: 'CRISTAL',
    palette: PALETTE_CRYSTAL,
    sound: 'retro',
    chrome: '#2a1c3f',
    label: 'CLEAR CASE · DOT MATRIX',
    tag: 'CLEAR',
    blurb: ['VIOLETA TRANSLUCIDA', 'LCD GRIS AZULADO', 'PULSO SECO']
  },
  pocket: {
    name: 'BOLSILLO',
    palette: PALETTE_POCKET,
    sound: 'deep',
    chrome: '#262624',
    label: 'POCKET LCD · 4 SHADES OF GREEN',
    tag: 'CLASSIC',
    blurb: ['GRIS CLARO Y BOTONES GRANATE', '4 TONOS DE VERDE OLIVA', 'SECO Y MAS GRAVE']
  },
  amber: {
    name: 'FOSFORO AMBAR',
    palette: PALETTE_AMBER,
    sound: 'hum',
    chrome: '#0b0b0b',
    label: 'PHOSPHOR TERMINAL · MONO SOUND',
    tag: 'AMBER',
    blurb: ['METAL NEGRO CON TORNILLOS', 'AMBAR CON BRILLO Y BARRIDO', 'SECO CON ZUMBIDO LEVE']
  },
  arcade: {
    name: 'ARCADE',
    palette: PALETTE_ARCADE,
    sound: 'hall',
    chrome: '#120b07',
    label: 'INSERT COIN · 1 OR 2 PLAYERS',
    tag: 'ARCADE',
    blurb: ['MUEBLE DE MADERA Y VINILO', 'MONITOR A COLOR CURVO', 'ECO CORTO DE SALA']
  },
  wood: {
    name: 'MADERA 80S',
    palette: PALETTE_WOOD,
    sound: 'retro',
    chrome: '#2e1a0e',
    label: 'WOODGRAIN DELUXE · DOT MATRIX',
    tag: '1984',
    blurb: ['MADERA, FRANJA NARANJA', 'LCD SEPIA CALIDO', 'BOTONES CROMADOS, SECO']
  },
  vapor: {
    name: 'VAPORWAVE',
    palette: PALETTE_VAPOR,
    sound: 'dreamy',
    chrome: '#2b1055',
    label: 'AESTHETIC MATRIX · DREAM SOUND',
    tag: 'VAPOR',
    blurb: ['ROSA Y TURQUESA CON REJILLA', 'CELDAS PASTEL LUMINOSAS', 'CON ECO Y MAS LENTO']
  },
  oled: {
    name: 'OLED NOCTURNO',
    palette: PALETTE_OLED,
    sound: 'soft',
    chrome: '#000000',
    label: 'NIGHT MODE',
    tag: '',
    blurb: ['NEGRO PURO SIN ADORNOS', 'ROJO TENUE PARA LA NOCHE', 'VOLUMEN MAS BAJO']
  },
  paper: {
    name: 'PAPEL',
    palette: PALETTE_PAPER,
    sound: 'retro',
    chrome: '#e9e4d6',
    label: 'HAND DRAWN · BALLPOINT MATRIX',
    tag: 'SKETCH',
    blurb: ['LIBRETA DE RAYAS', 'TINTA DE BOLIGRAFO', 'PULSO SECO']
  },
  seasonal: {
    name: 'ESTACIONAL',
    palette: null, // depende de la estación
    sound: 'retro',
    chrome: '',
    label: '',
    tag: '',
    blurb: ['CAMBIA SOLA CADA ESTACION', 'PALETA DE LA TEMPORADA', 'JINGLE AL ENCENDER']
  }
};

/** Orden de los temas en Opciones y en la galería. */
export const THEMES = Object.freeze(Object.keys(THEME_DEFS));

/** Convierte valores guardados por versiones anteriores ("lcd", "crt") o desconocidos a un tema válido. */
export function normalizeTheme(theme) {
  if (theme === 'lcd') return 'retro';
  if (theme === 'crt') return 'future';
  return THEME_DEFS[theme] ? theme : 'retro';
}

/**
 * Tema listo para aplicar. El estacional se resuelve con la fecha: devuelve la paleta, el rótulo y
 * la etiqueta de la estación, y su nombre (`season`) para la piel de la carcasa.
 */
export function getTheme(id, date = new Date()) {
  const themeId = normalizeTheme(id);
  const def = THEME_DEFS[themeId];
  if (themeId !== 'seasonal') {
    return { id: themeId, ...def, palette: { name: def.name, ...def.palette }, season: null, seasonName: '', jingle: null };
  }
  const season = currentSeason(date);
  const s = SEASONS[season];
  return {
    id: themeId,
    ...def,
    palette: { name: def.name, ...s.palette },
    chrome: s.chrome,
    label: s.label,
    tag: s.tag,
    season,
    seasonName: s.name,
    jingle: s.jingle
  };
}

/**
 * Colores de carcasa que se desbloquean con logros (solo CSS: html[data-shell] en console.css).
 * El primero de cada lista es el de serie. `unlock` es el id del logro que lo regala (Achievements.js)
 * y `swatch` el color de muestra en la galería.
 */
export const SHELLS = Object.freeze({
  retro: [
    { id: 'yellow', name: 'AMARILLA', swatch: '#e5c33a' },
    { id: 'red', name: 'ROJA', swatch: '#d8443a', unlock: 'firststar' },
    { id: 'blue', name: 'AZUL', swatch: '#3a6fd8', unlock: 'explorer' },
    { id: 'green', name: 'VERDE', swatch: '#4fae4a', unlock: 'stars30' },
    { id: 'white', name: 'BLANCA', swatch: '#ebe8e1', unlock: 'games100' },
    { id: 'black', name: 'NEGRA', swatch: '#2a2b31', unlock: 'stars100' },
    { id: 'gold', name: 'DORADA', swatch: '#f0c14a', unlock: 'all99' },
    { id: 'platinum', name: 'PLATINO', swatch: '#d6d9df', unlock: 'champion' }
  ],
  crystal: [
    { id: 'violet', name: 'VIOLETA', swatch: '#8f66d9' },
    { id: 'ice', name: 'HIELO', swatch: '#7cc8ec', unlock: 'streak7' },
    { id: 'mint', name: 'MENTA', swatch: '#5fd39b', unlock: 'marathon' },
    { id: 'fire', name: 'FUEGO', swatch: '#ee7a44', unlock: 'perfect10' },
    { id: 'smoke', name: 'HUMO', swatch: '#8a8a99', unlock: 'streak30' }
  ]
});

/** Carcasas del tema (lista vacía si no tiene variantes). */
export function shellsFor(themeId) {
  return SHELLS[themeId] || [];
}

/** Texto de la carcasa en la galería: "CARCASA ROJA", "CRISTAL HIELO". */
export function shellLabel(themeId, shell) {
  return `${themeId === 'crystal' ? 'CRISTAL' : 'CARCASA'} ${shell.name}`;
}

/** Carcasa que regala un logro: { theme, shell } o null. */
export function shellRewardFor(achievementId) {
  for (const [theme, list] of Object.entries(SHELLS)) {
    const shell = list.find((s) => s.unlock === achievementId);
    if (shell) return { theme, shell };
  }
  return null;
}
