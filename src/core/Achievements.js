// src/core/Achievements.js
// Los 40 logros de la consola: 20 generales (3 del modo carrera) y 2 por motor.
// Cada logro mira una estadística de Progress (`stat`) y se desbloquea al llegar a `goal`:
//   games, playTime (segundos), engines, slots, stars, perfect, records, daily, streak, expert, career
//     → estadísticas generales que lleva la consola (career = etapas superadas del modo carrera);
//   total:<nombre> → suma de todas las partidas de un contador que envía el cartucho con this.track();
//   best:<nombre>  → mejor marca en una sola partida (this.track() acumulado o this.peak()).
// `icon` es un sprite de 7x7 para la vitrina ('#' color del logro, '+' gris).
// `engine` (opcional) liga el logro a un motor y le da su color.

import { ENGINES } from './Catalog99.js';

export const ACHIEVEMENTS = [
  // ---------- Generales ----------
  {
    id: 'firstgame',
    name: 'PRIMERA PARTIDA',
    desc: 'TERMINA TU PRIMERA PARTIDA',
    stat: 'games',
    goal: 1,
    icon: ['.#####.', '.#+++#.', '.#+++#.', '.#####.', '.#.#.#.', '.#####.', '.......']
  },
  {
    id: 'explorer',
    name: 'EXPLORADOR',
    desc: 'JUEGA A LOS 10 MOTORES',
    stat: 'engines',
    goal: 10,
    icon: ['...#...', '...#...', '..#+#..', '###+###', '..#+#..', '...#...', '...#...']
  },
  {
    id: 'collector',
    name: 'COLECCIONISTA',
    desc: 'JUEGA 50 SLOTS DISTINTOS',
    stat: 'slots',
    goal: 50,
    icon: ['#######', '#+++++#', '#######', '#+++++#', '#######', '#+++++#', '#######']
  },
  {
    id: 'all99',
    name: 'LOS 99',
    desc: 'JUEGA LOS 99 SLOTS',
    stat: 'slots',
    goal: 99,
    icon: ['.......', '###.###', '#.#.#.#', '###.###', '..#...#', '###.###', '.......']
  },
  {
    id: 'firststar',
    name: 'PRIMERA ESTRELLA',
    desc: 'GANA TU PRIMERA ESTRELLA',
    stat: 'stars',
    goal: 1,
    icon: ['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '.#...#.']
  },
  {
    id: 'stars30',
    name: '30 ESTRELLAS',
    desc: 'REUNE 30 ESTRELLAS',
    stat: 'stars',
    goal: 30,
    icon: ['.#...#.', '###.###', '.#...#.', '...#...', '..###..', '...#...', '.......']
  },
  {
    id: 'stars100',
    name: '100 ESTRELLAS',
    desc: 'REUNE 100 ESTRELLAS',
    stat: 'stars',
    goal: 100,
    icon: ['.......', '#..#..#', '##.#.##', '#######', '#+#+#+#', '#######', '.......']
  },
  {
    id: 'threestars',
    name: 'TRES ESTRELLAS',
    desc: 'CONSIGUE 3 ESTRELLAS EN UN SLOT',
    stat: 'perfect',
    goal: 1,
    icon: ['.#...#.', '..#.#..', '...#...', '..###..', '.#####.', '.##+##.', '..###..']
  },
  {
    id: 'perfect10',
    name: 'DIEZ PERFECTOS',
    desc: '3 ESTRELLAS EN 10 SLOTS',
    stat: 'perfect',
    goal: 10,
    icon: ['#######', '#.###.#', '.#####.', '..###..', '...#...', '..###..', '.#####.']
  },
  {
    id: 'record',
    name: 'NUEVO RECORD',
    desc: 'SUPERA UNO DE TUS RECORDS',
    stat: 'records',
    goal: 1,
    icon: ['...#...', '..###..', '.#####.', '...#...', '...#...', '...#...', '.#####.']
  },
  {
    id: 'marathon',
    name: 'MARATON',
    desc: 'JUEGA 1 HORA EN TOTAL',
    stat: 'playTime',
    goal: 3600,
    icon: ['..###..', '.#...#.', '#..#..#', '#..##.#', '#.....#', '.#...#.', '..###..']
  },
  {
    id: 'veteran',
    name: 'VETERANO',
    desc: 'JUEGA 10 HORAS EN TOTAL',
    stat: 'playTime',
    goal: 36000,
    icon: ['#######', '.#+++#.', '..#+#..', '...#...', '..#.#..', '.#+++#.', '#######']
  },
  {
    id: 'games100',
    name: 'CIEN PARTIDAS',
    desc: 'TERMINA 100 PARTIDAS',
    stat: 'games',
    goal: 100,
    icon: ['..###..', '..###..', '...#...', '...#...', '.#####.', '#######', '#######']
  },
  {
    id: 'daily',
    name: 'DESAFIO DIARIO',
    desc: 'JUEGA UN DESAFIO DIARIO',
    stat: 'daily',
    goal: 1,
    icon: ['.#...#.', '#######', '#.....#', '#.#.#.#', '#.....#', '#.#.#.#', '#######']
  },
  {
    id: 'streak7',
    name: 'RACHA DE 7',
    desc: '7 DIAS SEGUIDOS DE DESAFIO',
    stat: 'streak',
    goal: 7,
    icon: ['...#...', '..##...', '..###..', '.##+##.', '.#+++#.', '.#+++#.', '..###..']
  },
  {
    id: 'streak30',
    name: 'RACHA DE 30',
    desc: '30 DIAS SEGUIDOS DE DESAFIO',
    stat: 'streak',
    goal: 30,
    icon: ['.#...#.', '#######', '#..#..#', '#.###.#', '#..#..#', '#.#.#.#', '#######']
  },
  {
    id: 'expert',
    name: 'MODO EXPERTO',
    desc: 'JUEGA CON VELOCIDAD 5 Y NIVEL 9',
    stat: 'expert',
    goal: 1,
    icon: ['....##.', '...##..', '..##...', '.#####.', '...##..', '..##...', '.##....']
  },

  // ---------- Modo carrera ----------
  {
    id: 'career10',
    name: 'PRIMER JEFE',
    desc: 'SUPERA LA ETAPA 10 DE LA CARRERA',
    stat: 'career',
    goal: 10,
    icon: ['......#', '.....#.', '....#..', '#..#...', '.##....', '.##....', '#..#...']
  },
  {
    id: 'career50',
    name: 'MEDIA CARRERA',
    desc: 'SUPERA 50 ETAPAS DE LA CARRERA',
    stat: 'career',
    goal: 50,
    icon: ['...#++.', '...#+++', '...#...', '..###..', '.#####.', '#######', '.......']
  },
  {
    id: 'champion',
    name: 'CAMPEON',
    desc: 'COMPLETA LAS 99 ETAPAS',
    stat: 'career',
    goal: 99,
    icon: ['#+#+#+#', '+#+#+#+', '#+#+#+#', '#......', '#......', '#......', '#......']
  },

  // ---------- Block Drop ----------
  {
    id: 'tetris4',
    engine: 'blockdrop',
    name: 'CUATRO DE GOLPE',
    desc: 'LIMPIA 4 LINEAS A LA VEZ',
    stat: 'total:tetris',
    goal: 1,
    icon: ['..###..', '...#...', '.......', '#######', '#######', '#######', '#######']
  },
  {
    id: 'lines100',
    engine: 'blockdrop',
    name: 'CIEN LINEAS',
    desc: 'LIMPIA 100 LINEAS EN TOTAL',
    stat: 'total:lines',
    goal: 100,
    icon: ['....##.', '...##..', '.......', '#...###', '##..#..', '###.##.', '#######']
  },

  // ---------- Maze Muncher ----------
  {
    id: 'feast',
    engine: 'mazemuncher',
    name: 'FESTIN',
    desc: 'COME 4 FANTASMAS CON UN PODER',
    stat: 'best:ghostChain',
    goal: 4,
    icon: ['..###..', '.#####.', '##.#.##', '#######', '#######', '#######', '#.#.#.#']
  },
  {
    id: 'cleanmaze',
    engine: 'mazemuncher',
    name: 'LABERINTO LIMPIO',
    desc: 'VACIA UN LABERINTO ENTERO',
    stat: 'total:mazes',
    goal: 1,
    icon: ['..###..', '.#####.', '####...', '###..+.', '####...', '.#####.', '..###..']
  },

  // ---------- Cyber Snake ----------
  {
    id: 'longsnake',
    engine: 'cybersnake',
    name: 'SERPIENTE LARGA',
    desc: 'LLEGA A MEDIR 30 SEGMENTOS',
    stat: 'best:length',
    goal: 30,
    icon: ['######+', '#......', '######.', '.....#.', '.#####.', '.#.....', '.######']
  },
  {
    id: 'glutton',
    engine: 'cybersnake',
    name: 'GLOTONA',
    desc: 'COME 200 BOCADOS EN TOTAL',
    stat: 'total:food',
    goal: 200,
    icon: ['...#...', '..#....', '.##.##.', '#######', '#######', '#######', '.##.##.']
  },

  // ---------- Brick Breaker ----------
  {
    id: 'demolisher',
    engine: 'brickbreaker',
    name: 'DEMOLEDOR',
    desc: 'ROMPE 500 LADRILLOS',
    stat: 'total:bricks',
    goal: 500,
    icon: ['###.###', '.......', '#.###.#', '.......', '...+...', '.......', '.#####.']
  },
  {
    id: 'cleanwall',
    engine: 'brickbreaker',
    name: 'PANTALLA LIMPIA',
    desc: 'ROMPE TODOS LOS LADRILLOS',
    stat: 'total:walls',
    goal: 1,
    icon: ['#######', '#.....#', '#.....#', '#..+..#', '#.....#', '#.###.#', '.......']
  },

  // ---------- Road Racer ----------
  {
    id: 'overtakes',
    engine: 'roadracer',
    name: 'ADELANTAMIENTOS',
    desc: 'ADELANTA A 100 COCHES',
    stat: 'total:overtakes',
    goal: 100,
    icon: ['.#.....', '###....', '.#...#.', '#.#.###', '.....#.', '....#.#', '.......']
  },
  {
    id: 'speed200',
    engine: 'roadracer',
    name: '200 KM/H',
    desc: 'LLEGA A 200 KM/H',
    stat: 'best:kmh',
    goal: 200,
    icon: ['..###..', '.#...#.', '#....+#', '#...+.#', '#..#..#', '.......', '.......']
  },

  // ---------- Tank Battle ----------
  {
    id: 'gunner',
    engine: 'tankbattle',
    name: 'ARTILLERO',
    desc: 'DESTRUYE 50 TANQUES',
    stat: 'total:tanks',
    goal: 50,
    icon: ['...#...', '...#...', '##.#.##', '#######', '##+++##', '#######', '##...##']
  },
  {
    id: 'stage',
    engine: 'tankbattle',
    name: 'FASE SUPERADA',
    desc: 'DESTRUYE TODOS LOS TANQUES',
    stat: 'total:stages',
    goal: 1,
    icon: ['..#....', '..####.', '..#####', '..###..', '..#....', '..#....', '.###...']
  },

  // ---------- Space Shooter ----------
  {
    id: 'ace',
    engine: 'spaceshooter',
    name: 'AS DEL ESPACIO',
    desc: 'DERRIBA 300 NAVES',
    stat: 'total:ships',
    goal: 300,
    icon: ['.#...#.', '..#.#..', '.#####.', '##.#.##', '#######', '#.#.#.#', '.......']
  },
  {
    id: 'boss',
    engine: 'spaceshooter',
    name: 'JEFE CAIDO',
    desc: 'DERROTA A UN JEFE',
    stat: 'total:bosses',
    goal: 1,
    icon: ['.#####.', '##.#.##', '#######', '#######', '.#+#+#.', '.#...#.', '##...##']
  },

  // ---------- Frog Crossing ----------
  {
    id: 'allhomes',
    engine: 'frogcrossing',
    name: 'TODAS EN CASA',
    desc: 'LLENA LAS 5 CASAS DE LA ORILLA',
    stat: 'total:homesets',
    goal: 1,
    icon: ['...#...', '..###..', '.#####.', '#######', '.#...#.', '.#.+.#.', '.#####.']
  },
  {
    id: 'frogs100',
    engine: 'frogcrossing',
    name: 'CIEN RANAS',
    desc: 'LLEVA 100 RANAS A CASA',
    stat: 'total:frogs',
    goal: 100,
    icon: ['#.....#', '.#####.', '##.#.##', '#######', '.#####.', '#.#.#.#', '#.....#']
  },

  // ---------- Flappy Pixel ----------
  {
    id: 'pipes25',
    engine: 'flappypixel',
    name: '25 TUBERIAS',
    desc: 'CRUZA 25 TUBERIAS EN UNA PARTIDA',
    stat: 'best:pipes',
    goal: 25,
    icon: ['##...##', '##...##', '.......', '..+#...', '.......', '##...##', '##...##']
  },
  {
    id: 'pipes500',
    engine: 'flappypixel',
    name: '500 TUBERIAS',
    desc: 'CRUZA 500 TUBERIAS EN TOTAL',
    stat: 'total:pipes',
    goal: 500,
    icon: ['.......', '..###..', '.#+#.#.', '######.', '.####..', '..##...', '.......']
  },

  // ---------- Memory Matrix ----------
  {
    id: 'elephant',
    engine: 'memorymatrix',
    name: 'MEMORIA DE ELEFANTE',
    desc: 'REPITE UNA SECUENCIA DE 10',
    stat: 'best:sequence',
    goal: 10,
    icon: ['..###..', '..###..', '##...##', '##.+.##', '##...##', '..###..', '..###..']
  },
  {
    id: 'reflex',
    engine: 'memorymatrix',
    name: 'REFLEJOS FELINOS',
    desc: 'ACIERTA 30 REFLEJOS EN 1 PARTIDA',
    stat: 'best:reflex',
    goal: 30,
    icon: ['.......', '..###..', '.#...#.', '#..#..#', '.#...#.', '..###..', '.......']
  }
];

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function getAchievement(id) {
  return BY_ID.get(id) || null;
}

/** Color del logro en la vitrina y en el aviso: el de su motor, o amarillo los generales. */
export function achievementColor(a) {
  return (a.engine && ENGINES.find((e) => e.id === a.engine)?.color) || 'yellow';
}
