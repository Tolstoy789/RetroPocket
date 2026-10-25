// src/core/Catalog99.js
// Mapa de los 99 slots de la consola: 10 motores de juego × variantes de reglas/dificultad.
// Cada slot entrega a su motor un `variantConfig` = defaults del motor + overrides de la variante,
// así que los juegos siempre reciben todas las claves documentadas aquí.
// También contiene el desafío diario, las estrellas por slot y el menú interactivo (CatalogMenu)
// para elegir del 00 (desafío diario) al 99.

import { ACTIONS } from './InputManager.js';
import { SCREEN_WIDTH } from './ConsoleEngine.js';

// Vite incluye solo los motores que existan en src/games/. Si un archivo todavía no está,
// el slot aparece en el menú como "PRÓXIMAMENTE" y la consola muestra "CARTUCHO NO INSERTADO".
const GAME_MODULES = import.meta.glob(['../games/*.js', '!../games/BaseCartridge.js']);

/**
 * Definición de motores.
 * - file: nombre del archivo en src/games/ (y de la clase exportada).
 * - defaults: todas las claves de variantConfig que el motor debe leer.
 * - variants: overrides por slot (en orden; los números de slot se asignan consecutivamente).
 * - controls: dos líneas de ayuda que se ven antes de jugar.
 */
export const ENGINES = [
  {
    id: 'blockdrop',
    file: 'BlockDrop',
    name: 'BLOCK DROP',
    color: 'cyan',
    controls: ['◀▶ MOVER  ▼ BAJAR  ▲ CAER', 'A/B GIRAR   A+B GUARDAR'],
    defaults: {
      speed: 1, // multiplicador de la velocidad de caída
      startLevel: 1, // nivel inicial (1-10)
      pieceSet: 'classic', // 'classic' (4 celdas) | 'mini' (1-3 celdas) | 'penta' (5 celdas)
      garbageRows: 0, // filas de basura iniciales
      risingGarbage: 0, // segundos entre filas de basura que suben (0 = desactivado)
      invisible: false, // las piezas fijadas se vuelven invisibles
      goalLines: 0, // líneas para ganar (0 = sin fin)
      mirror: false, // controles izquierda/derecha invertidos
      cascade: false, // los bloques sueltos caen tras limpiar líneas
      ghost: true, // mostrar la sombra de caída
      hold: true // guardar pieza con A+B (o C)
    },
    variants: [
      { label: 'CLASICO', desc: 'Encaja piezas y completa lineas.' },
      { label: 'TURBO', desc: 'La gravedad casi se duplica.', config: { speed: 1.8 } },
      { label: 'NIVEL 5', desc: 'Empieza directamente en el nivel 5.', config: { startLevel: 5 } },
      { label: 'BASURA', desc: '6 filas de escombros desde el inicio.', config: { garbageRows: 6 } },
      { label: 'MAREA', desc: 'Sube una fila de basura cada 20 s.', config: { risingGarbage: 20 } },
      { label: 'MINI', desc: 'Piezas pequenas de 1 a 3 bloques.', config: { pieceSet: 'mini' } },
      { label: 'PENTA', desc: 'Piezas gigantes de 5 bloques.', config: { pieceSet: 'penta' } },
      { label: 'INVISIBLE', desc: 'Las piezas desaparecen al caer.', config: { invisible: true } },
      { label: 'SPRINT 40', desc: 'Limpia 40 lineas lo antes posible.', config: { goalLines: 40 } },
      { label: 'ESPEJO', desc: 'Izquierda y derecha invertidas.', config: { mirror: true } },
      { label: 'CASCADA', desc: 'Los bloques sueltos se desploman.', config: { cascade: true } },
      { label: 'CAOS', desc: 'Turbo, basura y sin sombra.', config: { speed: 1.4, garbageRows: 4, risingGarbage: 30, ghost: false } }
    ],
    icon: [
      ['...#....', '..###...', '........', '........', '#......#', '##....##', '###.####', '########'],
      ['........', '........', '...#....', '..###...', '#......#', '##....##', '###.####', '########']
    ]
  },
  {
    id: 'mazemuncher',
    file: 'MazeMuncher',
    name: 'MAZE MUNCHER',
    color: 'yellow',
    controls: ['CRUCETA: MOVERTE', 'PULSA EL GIRO ANTES DEL CRUCE'],
    defaults: {
      speed: 1, // velocidad del jugador
      ghostSpeed: 1, // velocidad de los fantasmas
      ghostCount: 4, // número de fantasmas (1-6)
      ghostAI: 'mixed', // 'mixed' | 'chase' | 'random'
      maze: 'classic', // 'classic' | 'cross' | 'spiral' | 'rotate' (cambia cada nivel)
      powerDuration: 6, // segundos de súper poder
      darkMaze: false, // solo se ve el entorno cercano
      fruit: true, // aparece fruta bonus
      lives: 3
    },
    variants: [
      { label: 'CLASICO', desc: 'Come todos los puntos del laberinto.' },
      { label: 'RAPIDO', desc: 'Todo se mueve un 40% mas rapido.', config: { speed: 1.4, ghostSpeed: 1.4 } },
      { label: 'CRUZ', desc: 'Laberinto en forma de cruz.', config: { maze: 'cross' } },
      { label: 'ESPIRAL', desc: 'Laberinto en espiral.', config: { maze: 'spiral' } },
      { label: 'CAZADORES', desc: 'Seis fantasmas que persiguen.', config: { ghostCount: 6, ghostAI: 'chase', ghostSpeed: 1.1 } },
      { label: 'POCO PODER', desc: 'El poder dura solo 2 segundos.', config: { powerDuration: 2 } },
      { label: 'APAGON', desc: 'Solo ves lo que te rodea.', config: { darkMaze: true } },
      { label: 'UNA VIDA', desc: 'Un error y se acabo.', config: { lives: 1, ghostAI: 'chase' } },
      { label: 'TRANQUILO', desc: 'Dos fantasmas lentos.', config: { ghostCount: 2, ghostSpeed: 0.8, ghostAI: 'random' } },
      { label: 'MARATON', desc: 'El laberinto cambia cada nivel.', config: { maze: 'rotate' } }
    ],
    icon: [
      ['..###...', '.#####..', '####....', '###..#.#', '####....', '.#####..', '..###...', '........'],
      ['..###...', '.#####..', '#######.', '#######.', '#######.', '.#####..', '..###...', '........']
    ]
  },
  {
    id: 'cybersnake',
    file: 'CyberSnake',
    name: 'CYBER SNAKE',
    color: 'green',
    controls: ['CRUCETA: GIRAR', 'MANTEN A: ACELERAR'],
    defaults: {
      speed: 1, // pasos por segundo relativos
      walls: 'solid', // 'solid' (chocar = perder) | 'wrap' (atraviesa los bordes)
      obstacles: 'none', // 'none' | 'blocks' | 'maze' | 'random'
      growth: 1, // segmentos que crece por comida
      foodCount: 1, // comidas simultáneas
      accelerate: false, // acelera con cada comida
      startLength: 3,
      timeLimit: 0 // segundos (0 = sin límite)
    },
    variants: [
      { label: 'CLASICO', desc: 'Come y crece sin chocar.' },
      { label: 'SIN BORDES', desc: 'Atraviesa las paredes.', config: { walls: 'wrap' } },
      { label: 'RAPIDO', desc: 'La serpiente va a toda velocidad.', config: { speed: 1.6 } },
      { label: 'ACELERA', desc: 'Cada bocado te hace mas rapido.', config: { accelerate: true } },
      { label: 'BLOQUES', desc: 'Obstaculos fijos en el campo.', config: { obstacles: 'blocks' } },
      { label: 'LABERINTO', desc: 'Muros interiores en todo el campo.', config: { obstacles: 'maze' } },
      { label: 'GLOTON', desc: 'Creces 3 segmentos por bocado.', config: { growth: 3 } },
      { label: 'BANQUETE', desc: 'Tres comidas a la vez.', config: { foodCount: 3 } },
      { label: 'RELOJ', desc: 'Maxima puntuacion en 90 s.', config: { timeLimit: 90, walls: 'wrap' } },
      { label: 'EXTREMO', desc: 'Obstaculos al azar y aceleracion.', config: { obstacles: 'random', speed: 1.3, accelerate: true } }
    ],
    icon: [
      ['........', '##....#.', '........', '#######.', '......#.', '..#####.', '..#.....', '..###...'],
      ['........', '##....#.', '........', '.######.', '......#.', '..#####.', '..#.....', '..####..']
    ]
  },
  {
    id: 'brickbreaker',
    file: 'BrickBreaker',
    name: 'BRICK BREAKER',
    color: 'magenta',
    controls: ['◀▶ MOVER LA PALETA  ▲ RAPIDO', 'A: LANZAR LA BOLA'],
    defaults: {
      speed: 1, // velocidad de la bola
      paddleWidth: 24, // ancho de la paleta en píxeles
      balls: 1, // bolas al iniciar
      layout: 'wall', // 'wall' | 'pyramid' | 'diamond' | 'descending' | 'random'
      brickHits: 1, // golpes por ladrillo
      powerUps: true,
      ballSpeedUp: true, // la bola acelera con cada golpe
      lives: 3
    },
    variants: [
      { label: 'CLASICO', desc: 'Rompe el muro de ladrillos.' },
      { label: 'PIRAMIDE', desc: 'Ladrillos en forma de piramide.', config: { layout: 'pyramid' } },
      { label: 'FORTALEZA', desc: 'Cada ladrillo aguanta 2 golpes.', config: { brickHits: 2 } },
      { label: 'RAPIDO', desc: 'La bola sale disparada.', config: { speed: 1.4 } },
      { label: 'MINI PALA', desc: 'Una paleta muy estrecha.', config: { paddleWidth: 14 } },
      { label: 'MULTIBOLA', desc: 'Empieza con tres bolas.', config: { balls: 3 } },
      { label: 'SIN AYUDAS', desc: 'No caen potenciadores.', config: { powerUps: false } },
      { label: 'DIAMANTE', desc: 'Muro en forma de rombo.', config: { layout: 'diamond' } },
      { label: 'INVASION', desc: 'El muro baja poco a poco.', config: { layout: 'descending' } },
      { label: 'ACERO', desc: 'Muro aleatorio de 3 golpes.', config: { layout: 'random', brickHits: 3 } }
    ],
    icon: [
      ['########', '#.##.##.', '########', '........', '....#...', '........', '........', '..####..'],
      ['########', '#.##.##.', '########', '........', '........', '........', '...#....', '..####..']
    ]
  },
  {
    id: 'roadracer',
    file: 'RoadRacer',
    name: 'ROAD RACER',
    color: 'red',
    controls: ['◀▶ CARRIL  ▲ ACELERA  ▼ FRENA', 'A: DISPARAR (MODO ARMADO)'],
    defaults: {
      speed: 1, // velocidad inicial
      lanes: 3, // carriles (3 o 5)
      traffic: 1, // densidad de tráfico
      accelerate: true, // la velocidad aumenta con la distancia
      fuel: false, // hay que recoger gasolina
      night: false, // visibilidad reducida
      oncoming: false, // coches en sentido contrario
      shooting: false // el botón A dispara
    },
    variants: [
      { label: 'CLASICO', desc: 'Esquiva coches en 3 carriles.' },
      { label: 'RAPIDO', desc: 'Sales a velocidad de autopista.', config: { speed: 1.5 } },
      { label: 'ATASCO', desc: 'Muchisimo mas trafico.', config: { traffic: 1.6 } },
      { label: '5 CARRILES', desc: 'Una autopista mas ancha.', config: { lanes: 5 } },
      { label: 'GASOLINA', desc: 'Recoge bidones o te quedas parado.', config: { fuel: true } },
      { label: 'NOCHE', desc: 'Solo ves lo que alumbran tus faros.', config: { night: true } },
      { label: 'CONTRAMANO', desc: 'Coches que vienen de frente.', config: { oncoming: true } },
      { label: 'ARMADO', desc: 'Dispara a los coches con A.', config: { shooting: true } },
      { label: 'CRUCERO', desc: 'Velocidad constante.', config: { accelerate: false, speed: 1.2 } },
      { label: 'EXTREMO', desc: 'Rapido, denso y de frente.', config: { speed: 1.4, traffic: 1.4, oncoming: true } }
    ],
    icon: [
      ['#......#', '#..#...#', '#.###..#', '#..#...#', '#.#.#..#', '#......#', '#....#.#', '#...###.'],
      ['#......#', '#......#', '#..#...#', '#.###..#', '#..#...#', '#.#.#..#', '#......#', '#....#.#']
    ]
  },
  {
    id: 'tankbattle',
    file: 'TankBattle',
    name: 'TANK BATTLE',
    color: 'orange',
    controls: ['CRUCETA: MOVERTE', 'A: DISPARAR'],
    defaults: {
      enemyCount: 10, // tanques enemigos por nivel
      maxOnScreen: 3, // enemigos simultáneos
      enemySpeed: 1,
      enemyFireRate: 1,
      playerFireRate: 1,
      map: 'bricks', // 'bricks' | 'steel' | 'forest' | 'open' | 'maze'
      protectBase: true, // si destruyen la base, pierdes
      lives: 3
    },
    variants: [
      { label: 'CLASICO', desc: 'Defiende tu base de 10 tanques.' },
      { label: 'HORDA', desc: '20 tanques, 4 a la vez.', config: { enemyCount: 20, maxOnScreen: 4 } },
      { label: 'ACERO', desc: 'Muros de acero indestructibles.', config: { map: 'steel' } },
      { label: 'BOSQUE', desc: 'Arboles que ocultan los tanques.', config: { map: 'forest' } },
      { label: 'VELOCES', desc: 'Enemigos un 50% mas rapidos.', config: { enemySpeed: 1.5 } },
      { label: 'FRANCOTIRO', desc: 'Los enemigos disparan el doble.', config: { enemyFireRate: 2 } },
      { label: 'SUPERVIVE', desc: 'Sin base: solo sobrevive.', config: { protectBase: false, enemyCount: 25 } },
      { label: 'ARENA', desc: 'Campo abierto sin coberturas.', config: { map: 'open' } },
      { label: 'LABERINTO', desc: 'Pasillos estrechos de ladrillo.', config: { map: 'maze' } },
      { label: 'GUERRA', desc: '30 tanques rapidos y agresivos.', config: { enemyCount: 30, maxOnScreen: 5, enemySpeed: 1.3, enemyFireRate: 1.5 } }
    ],
    icon: [
      ['...#....', '...#....', '.#####..', '.##.##..', '.#####..', '.#...#..', '........', '........'],
      ['...#....', '........', '...#....', '.#####..', '.##.##..', '.#####..', '.#...#..', '........']
    ]
  },
  {
    id: 'spaceshooter',
    file: 'SpaceShooter',
    name: 'SPACE SHOOTER',
    color: 'green',
    controls: ['◀▶ MOVER LA NAVE', 'A: DISPARAR'],
    defaults: {
      formation: 'invaders', // 'invaders' | 'galaxy' | 'asteroids' | 'waves'
      rows: 4, // filas de enemigos
      enemySpeed: 1,
      enemyFireRate: 1,
      shields: true, // escudos protectores
      divers: false, // enemigos que se lanzan en picada
      playerShots: 1, // disparos simultáneos del jugador
      boss: false, // jefe al final de cada oleada
      lives: 3
    },
    variants: [
      { label: 'INVASORES', desc: 'Detén la flota que desciende.' },
      { label: 'INVASORES+', desc: 'Cinco filas y mas velocidad.', config: { rows: 5, enemySpeed: 1.3 } },
      { label: 'SIN ESCUDOS', desc: 'Nada te protege.', config: { shields: false } },
      { label: 'GALAXIA', desc: 'Formacion que ataca en picada.', config: { formation: 'galaxy', divers: true, shields: false } },
      { label: 'PICADA', desc: 'Galaxia rapida y agresiva.', config: { formation: 'galaxy', divers: true, shields: false, enemySpeed: 1.4 } },
      { label: 'DOBLE TIRO', desc: 'Puedes disparar dos veces.', config: { playerShots: 2 } },
      { label: 'METEOROS', desc: 'Destruye la lluvia de rocas.', config: { formation: 'asteroids', shields: false } },
      { label: 'JEFE', desc: 'Una nave nodriza en cada oleada.', config: { boss: true } },
      { label: 'LLUVIA', desc: 'Los enemigos disparan sin parar.', config: { enemyFireRate: 2.2 } },
      { label: 'OLEADAS', desc: 'Escuadrones que cruzan la pantalla.', config: { formation: 'waves', shields: false, divers: true } }
    ],
    icon: [
      ['..#..#..', '...##...', '..####..', '.##..##.', '########', '#.####.#', '#.#..#.#', '..#..#..'],
      ['..#..#..', '#..##..#', '#.####.#', '###..###', '########', '..####..', '.#....#.', '#......#']
    ]
  },
  {
    id: 'frogcrossing',
    file: 'FrogCrossing',
    name: 'FROG CROSSING',
    color: 'green',
    controls: ['CRUCETA: UN SALTO POR TOQUE', 'LLEGA A LAS CASAS DE ARRIBA'],
    defaults: {
      trafficSpeed: 1,
      trafficDensity: 1,
      riverSpeed: 1,
      road: true, // hay carretera
      river: true, // hay río
      sinkingTurtles: true, // tortugas que se sumergen
      timeLimit: 30, // segundos por rana
      homes: 5, // casillas de llegada
      lives: 3
    },
    variants: [
      { label: 'CLASICO', desc: 'Cruza la carretera y el rio.' },
      { label: 'RAPIDO', desc: 'Todo va mas deprisa.', config: { trafficSpeed: 1.4, riverSpeed: 1.3 } },
      { label: 'HORA PUNTA', desc: 'Trafico muy denso.', config: { trafficDensity: 1.6 } },
      { label: 'CARRETERA', desc: 'Solo carretera, el doble de carriles.', config: { river: false } },
      { label: 'RIO', desc: 'Solo troncos y tortugas.', config: { road: false } },
      { label: 'CONTRARRELOJ', desc: '15 segundos por rana.', config: { timeLimit: 15 } },
      { label: '3 CASAS', desc: 'Solo tres huecos de llegada.', config: { homes: 3 } },
      { label: 'CORRIENTE', desc: 'El rio arrastra con fuerza.', config: { riverSpeed: 1.5 } },
      { label: 'UNA VIDA', desc: 'Una sola rana.', config: { lives: 1 } },
      { label: 'EXTREMO', desc: 'Rapido, denso y 20 s por rana.', config: { trafficSpeed: 1.4, riverSpeed: 1.4, trafficDensity: 1.4, timeLimit: 20 } }
    ],
    icon: [
      ['#......#', '.#.##.#.', '..####..', '.######.', '..####..', '.#.##.#.', '#......#', '........'],
      ['........', '#.#..#.#', '.######.', '..####..', '.######.', '#.#..#.#', '........', '........']
    ]
  },
  {
    id: 'flappypixel',
    file: 'FlappyPixel',
    name: 'FLAPPY PIXEL',
    color: 'yellow',
    controls: ['A O ▲: ALETEAR', 'NO TOQUES LOS OBSTACULOS'],
    defaults: {
      gravity: 1,
      flap: 1, // fuerza del aleteo
      gap: 48, // hueco entre obstáculos en píxeles
      scrollSpeed: 1,
      obstacle: 'pipes', // 'pipes' | 'cave' | 'rocks'
      moving: false, // los huecos se mueven arriba y abajo
      ceiling: true // tocar el techo cuenta como choque
    },
    variants: [
      { label: 'CLASICO', desc: 'Aletea entre las tuberias.' },
      { label: 'ESTRECHO', desc: 'Huecos mucho mas pequenos.', config: { gap: 36 } },
      { label: 'RAPIDO', desc: 'El mundo avanza mas deprisa.', config: { scrollSpeed: 1.5 } },
      { label: 'LUNAR', desc: 'Gravedad baja, saltos largos.', config: { gravity: 0.55, flap: 0.75 } },
      { label: 'PLOMO', desc: 'Gravedad alta, aletea sin parar.', config: { gravity: 1.5, flap: 1.25 } },
      { label: 'MOVILES', desc: 'Los huecos suben y bajan.', config: { moving: true } },
      { label: 'CUEVA', desc: 'Una cueva sinuosa sin fin.', config: { obstacle: 'cave' } },
      { label: 'ROCAS', desc: 'Esquiva rocas flotantes.', config: { obstacle: 'rocks' } },
      { label: 'EXTREMO', desc: 'Estrecho, rapido y movil.', config: { gap: 38, scrollSpeed: 1.4, moving: true } }
    ],
    icon: [
      ['......##', '......##', '..##....', '.####...', '..##....', '........', '......##', '......##'],
      ['......##', '......##', '........', '..##....', '.####...', '..##....', '......##', '......##']
    ]
  },
  {
    id: 'memorymatrix',
    file: 'MemoryMatrix',
    name: 'MEMORY MATRIX',
    color: 'blue',
    controls: ['CRUCETA: PULSA LOS BOTONES', 'MATRIZ: CRUCETA MUEVE, A ELIGE'],
    defaults: {
      mode: 'simon', // 'simon' | 'reverse' | 'reflex' | 'grid' | 'pairs' | 'mixed'
      startLength: 1, // longitud inicial de la secuencia
      speed: 1, // velocidad de reproducción
      gridSize: 2, // casillas por lado en modo 'grid'
      timeLimit: 0, // segundos para responder (0 = sin límite)
      colors: 4 // botones distintos en modo 'simon'
    },
    variants: [
      { label: 'SIMON', desc: 'Repite la secuencia de luces.' },
      { label: 'SIMON TURBO', desc: 'La secuencia va al doble.', config: { speed: 1.6, startLength: 3 } },
      { label: 'INVERSO', desc: 'Repitela al reves.', config: { mode: 'reverse' } },
      { label: 'REFLEJOS', desc: 'Pulsa la direccion que se ilumine.', config: { mode: 'reflex', timeLimit: 2 } },
      { label: 'MATRIZ 3X3', desc: 'Memoriza casillas encendidas.', config: { mode: 'grid', gridSize: 3 } },
      { label: 'MATRIZ 4X4', desc: 'Mas casillas, mas memoria.', config: { mode: 'grid', gridSize: 4 } },
      { label: 'PAREJAS', desc: 'Encuentra las parejas ocultas.', config: { mode: 'pairs', gridSize: 4 } },
      { label: 'MARATON', desc: 'Todos los modos mezclados.', config: { mode: 'mixed', timeLimit: 5 } }
    ],
    icon: [
      ['###..+++', '###..+++', '###..+++', '........', '+++..+++', '+++..+++', '+++..+++', '........'],
      ['+++..+++', '+++..+++', '+++..+++', '........', '+++..###', '+++..###', '+++..###', '........']
    ]
  }
];

export const TOTAL_SLOTS = 99;

/** Puntuaciones para ganar 1, 2 y 3 estrellas en cada motor. */
export const STAR_THRESHOLDS = {
  blockdrop: [1000, 5000, 15000],
  mazemuncher: [2000, 8000, 20000],
  cybersnake: [300, 1000, 2500],
  brickbreaker: [1500, 5000, 12000],
  roadracer: [2000, 6000, 15000],
  tankbattle: [1000, 4000, 10000],
  spaceshooter: [1500, 6000, 15000],
  frogcrossing: [1000, 4000, 9000],
  flappypixel: [10, 30, 60],
  memorymatrix: [10, 25, 50]
};

const SPEED_KEYS = ['speed', 'ghostSpeed', 'enemySpeed', 'trafficSpeed', 'riverSpeed', 'scrollSpeed'];

/** VELOCIDAD 1-5 de la pantalla PREPARADO: multiplica las velocidades de la variante. */
export const LAUNCH_SPEEDS = [1, 1.15, 1.3, 1.45, 1.6];
/** NIVEL inicial máximo que se puede elegir antes de jugar. */
export const MAX_START_LEVEL = 9;
/** VELOCIDAD a la que se juegan los jefes del modo carrera. */
export const CAREER_BOSS_SPEED = 2;
/** Jefes de la carrera: etapas 10, 20... 90 y 99. */
export const CAREER_BOSSES = 10;

/** Giros del desafío diario: se aplican sobre el variantConfig del slot elegido. */
export const DAILY_TWISTS = [
  {
    label: 'TURBO',
    desc: 'todo un 25% mas rapido.',
    apply: (c) => {
      for (const key of SPEED_KEYS) if (typeof c[key] === 'number') c[key] = +(c[key] * 1.25).toFixed(2);
    }
  },
  {
    label: 'UNA VIDA',
    desc: 'sin segundas oportunidades.',
    apply: (c) => {
      if ('lives' in c) c.lives = 1;
      else if (typeof c.speed === 'number') c.speed = +(c.speed * 1.15).toFixed(2);
    }
  },
  {
    label: 'CONTRARRELOJ',
    desc: 'lo maximo en 60 segundos.',
    apply: (c) => {
      // Duración de la partida; los motores con tiempo por turno conservan su config.timeLimit.
      c.sessionTime = 60;
    }
  },
  {
    label: 'MISMA SUERTE',
    desc: 'todos juegan la misma partida.',
    apply: () => {}
  }
];

/** Fecha local en formato AAAA-MM-DD. */
export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Hash FNV-1a de 32 bits para convertir la fecha en semilla. */
function hashString(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class Catalog99 {
  constructor(engines = ENGINES) {
    this.engines = engines;
    this.slots = [];
    let number = 1;
    engines.forEach((engine, engineIndex) => {
      engine.firstSlot = number;
      engine.index = engineIndex;
      engine.stars = STAR_THRESHOLDS[engine.id] || [1000, 5000, 10000];
      engine.variants.forEach((variant, variantIndex) => {
        this.slots.push(
          Object.freeze({
            number,
            key: number,
            code: String(number).padStart(2, '0'),
            engine,
            engineIndex,
            variantIndex,
            label: variant.label,
            desc: variant.desc,
            daily: false,
            seed: null,
            variantConfig: Object.freeze({ ...engine.defaults, ...(variant.config || {}) })
          })
        );
        number++;
      });
      engine.lastSlot = number - 1;
    });
    if (this.slots.length !== TOTAL_SLOTS) {
      throw new Error(`Catalog99 debe tener ${TOTAL_SLOTS} slots y tiene ${this.slots.length}.`);
    }
  }

  getSlot(number) {
    return this.slots[number - 1] || null;
  }

  /** ¿Existe el archivo del motor en src/games/? */
  isInstalled(slot) {
    return `../games/${slot.engine.file}.js` in GAME_MODULES;
  }

  /** Slots cuyo motor ya está en src/games/. */
  installedSlots() {
    return this.slots.filter((slot) => this.isInstalled(slot));
  }

  /** Carga dinámicamente el motor del slot. Devuelve la clase o null si no está instalado. */
  async loadCartridge(slot) {
    const loader = GAME_MODULES[`../games/${slot.engine.file}.js`];
    if (!loader) return null;
    const mod = await loader();
    return mod.default || mod[slot.engine.file] || null;
  }

  /** Estrellas (0-3) que vale una puntuación en el slot. */
  starsFor(slot, score) {
    const thresholds = slot.engine.stars;
    let stars = 0;
    for (const t of thresholds) if (score >= t) stars++;
    return stars;
  }

  /** Cuántos slots tienen al menos una estrella. */
  completedCount(storage) {
    const best = storage.bestScores();
    let count = 0;
    for (const slot of this.slots) {
      if (this.starsFor(slot, best[String(slot.number)] || 0) > 0) count++;
    }
    return count;
  }

  /** Estrellas totales conseguidas (máximo 297). */
  totalStars(storage) {
    const best = storage.bestScores();
    return this.slots.reduce((sum, slot) => sum + this.starsFor(slot, best[String(slot.number)] || 0), 0);
  }

  /**
   * Desafío del día: un slot y un giro de reglas elegidos con la fecha como semilla.
   * Todos los jugadores obtienen el mismo desafío (y la misma secuencia aleatoria) el mismo día.
   */
  dailyChallenge(date = new Date()) {
    const day = todayKey(date);
    const seed = hashString(`retropocket-${day}`);
    const pool = this.installedSlots();
    const candidates = pool.length ? pool : this.slots;
    const base = candidates[seed % candidates.length];
    const twist = DAILY_TWISTS[(seed >>> 8) % DAILY_TWISTS.length];
    const config = { ...base.variantConfig };
    twist.apply(config);
    return Object.freeze({
      ...base,
      key: `D${day}`,
      code: 'HOY',
      label: twist.label,
      desc: `${base.engine.name} ${base.label}: ${twist.desc}`,
      daily: true,
      day,
      seed,
      baseNumber: base.number,
      variantConfig: Object.freeze(config)
    });
  }

  /**
   * Slot con la VELOCIDAD (1-5) y el NIVEL inicial (1-9) elegidos en la pantalla PREPARADO.
   * Más velocidad da más puntos (x1,25 por punto de velocidad); el nivel ya multiplica los puntos en cada motor.
   * Los récords se guardan en el mismo slot. El desafío diario no se modifica.
   */
  customizeSlot(slot, { speed = 1, level = 1 } = {}) {
    const s = Math.max(1, Math.min(LAUNCH_SPEEDS.length, Math.round(speed)));
    const l = Math.max(1, Math.min(MAX_START_LEVEL, Math.round(level)));
    if (slot.daily || (s === 1 && l === 1)) return slot;
    const factor = LAUNCH_SPEEDS[s - 1];
    const config = { ...slot.variantConfig };
    for (const key of SPEED_KEYS) if (typeof config[key] === 'number') config[key] = +(config[key] * factor).toFixed(2);
    config.startLevel = (Number.isFinite(config.startLevel) ? config.startLevel : 1) + (l - 1);
    config.scoreMultiplier = 1 + (s - 1) * 0.25;
    return Object.freeze({ ...slot, launchSpeed: s, launchLevel: l, variantConfig: Object.freeze(config) });
  }

  /** Las etapas 10, 20... 90 y la 99 son jefes: más velocidad y más estrellas para superarlas. */
  isCareerBoss(stage) {
    return stage % 10 === 0 || stage === TOTAL_SLOTS;
  }

  /**
   * Etapa del modo carrera: el slot del mismo número con su meta de estrellas.
   * Los jefes se juegan a VELOCIDAD 2 y piden 2 estrellas; el resto, 1 estrella a velocidad normal.
   */
  careerSlot(stage) {
    const base = this.getSlot(stage);
    if (!base) return null;
    const boss = this.isCareerBoss(stage);
    const slot = boss ? this.customizeSlot(base, { speed: CAREER_BOSS_SPEED }) : base;
    return Object.freeze({ ...slot, career: Object.freeze({ stage, boss, need: boss ? 2 : 1 }) });
  }

  createMenu(engine, initialSlot = 1) {
    return new CatalogMenu(engine, this, initialSlot);
  }
}

// ---------------------------------------------------------------------------
// Menú de selección 00-99 (00 = desafío diario)
// ---------------------------------------------------------------------------

function wrapText(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

const POSITIONS = TOTAL_SLOTS + 1;
// Llama de la racha del desafío diario (el mismo dibujo que el logro RACHA DE 7).
const STREAK_FLAME = ['...#...', '..##...', '..###..', '.##+##.', '.#+++#.', '.#+++#.', '..###..'];

export class CatalogMenu {
  constructor(engine, catalog, initialSlot = 1) {
    this.engine = engine;
    this.catalog = catalog;
    const start = Number(initialSlot);
    this.index = Number.isInteger(start) && start >= 0 && start <= TOTAL_SLOTS ? start : 1;
    this.time = 0;
    this.arrowFlash = { left: 0, right: 0, up: 0, down: 0 };
    this.slide = 0;
    this._refresh();
  }

  /** Slot seleccionado (en la posición 0 es el desafío diario). */
  get slot() {
    return this.index === 0 ? this.daily : this.catalog.slots[this.index - 1];
  }

  onEnter() {
    this.time = 0;
    this._refresh();
  }

  _refresh() {
    const storage = this.engine.storage;
    this.daily = this.catalog.dailyChallenge();
    const slot = this.slot;
    const best = storage.getScores(slot.key)[0];
    this.highScore = best ? best.score : 0;
    this.highName = best ? best.name || '' : '';
    this.stars = this.catalog.starsFor(slot, this.highScore);
    this.installed = this.catalog.isInstalled(slot);
    this.descLines = wrapText(slot.desc, 34).slice(0, 2);
    this.completed = this.catalog.completedCount(storage);
    this.favorite = !slot.daily && storage.isFavorite(slot.number);
    this.streak = slot.daily && this.engine.progress ? this.engine.progress.streakInfo() : null;
  }

  /** Coloca el menú en un slot (por ejemplo, al elegirlo en la pestaña JUEGOS). */
  jumpTo(number) {
    this.index = Math.max(0, Math.min(TOTAL_SLOTS, number));
    this.slide = 0;
    this._refresh();
  }

  select(index, direction) {
    const next = ((index % POSITIONS) + POSITIONS) % POSITIONS;
    if (next === this.index) return;
    this.index = next;
    this.slide = direction * 6;
    this._refresh();
  }

  handleAction({ action, pressed }) {
    if (!pressed) return;
    const sound = this.engine.sound;
    const slot = this.slot;
    const engines = this.catalog.engines;
    switch (action) {
      case ACTIONS.LEFT:
        this.arrowFlash.left = 0.15;
        this.select(this.index - 1, -1);
        sound.sfx('move');
        break;
      case ACTIONS.RIGHT:
        this.arrowFlash.right = 0.15;
        this.select(this.index + 1, 1);
        sound.sfx('move');
        break;
      case ACTIONS.UP: {
        this.arrowFlash.up = 0.15;
        if (this.index === 0) {
          this.select(engines[engines.length - 1].firstSlot, -1);
        } else if (slot.engineIndex === 0) {
          this.select(0, -1);
        } else {
          this.select(engines[slot.engineIndex - 1].firstSlot, -1);
        }
        sound.sfx('rotate');
        break;
      }
      case ACTIONS.DOWN: {
        this.arrowFlash.down = 0.15;
        if (this.index === 0) {
          this.select(engines[0].firstSlot, 1);
        } else if (slot.engineIndex === engines.length - 1) {
          this.select(0, 1);
        } else {
          this.select(engines[slot.engineIndex + 1].firstSlot, 1);
        }
        sound.sfx('rotate');
        break;
      }
      case ACTIONS.A:
        sound.sfx('confirm');
        // El desafío diario es igual para todos: se juega sin cambiar velocidad ni nivel.
        if (slot.daily || !this.installed) this.engine.launch(slot);
        else this.engine.openLaunch(slot);
        break;
      case ACTIONS.START:
        sound.sfx('select');
        this.engine.openHub();
        break;
      case ACTIONS.B:
        sound.sfx('select');
        this.engine.openOptions();
        break;
      default:
        break;
    }
  }

  update(dt) {
    this.time += dt;
    for (const key of Object.keys(this.arrowFlash)) {
      this.arrowFlash[key] = Math.max(0, this.arrowFlash[key] - dt);
    }
    if (this.slide !== 0) {
      const step = dt * 60;
      this.slide = Math.abs(this.slide) <= step ? 0 : this.slide - Math.sign(this.slide) * step;
    }
  }

  render(g) {
    const slot = this.slot;
    const engineDef = slot.engine;
    const cx = SCREEN_WIDTH / 2;
    const blink = Math.floor(this.time * 2) % 2 === 0;

    g.clear();

    // Cabecera: progreso, título y volumen
    g.rect(0, 0, SCREEN_WIDTH, 13, 'ink');
    g.text(`★${this.completed}/99`, 3, 4, { color: 'bg' });
    g.text('ELIGE JUEGO', cx + 4, 4, { align: 'center', color: 'bg' });
    const vol = this.engine.sound.volumeLevel;
    g.text(vol.id === 'off' ? '♪×' : vol.id === 'low' ? '♪' : '♪♪', SCREEN_WIDTH - 3, 4, { align: 'right', color: 'bg' });

    // Número de slot grande con flechas
    const numberY = 20;
    g.text(slot.code, cx + Math.round(this.slide), numberY, { align: 'center', scale: 5, color: slot.daily ? 'yellow' : engineDef.color });
    g.text('◀', 12, numberY + 6, { scale: 2, color: this.arrowFlash.left > 0 ? 'ink' : 'mid' });
    g.text('▶', SCREEN_WIDTH - 18, numberY + 6, { scale: 2, color: this.arrowFlash.right > 0 ? 'ink' : 'mid' });

    // Racha del desafío diario junto al número
    if (this.streak && this.streak.current > 0) {
      const sx = SCREEN_WIDTH - 24;
      g.sprite(STREAK_FLAME, sx, numberY + 18, { colors: { '#': 'orange', '+': 'yellow' } });
      g.text(String(this.streak.current), sx + 3, numberY + 27, { align: 'center', color: this.streak.playedToday ? 'ink' : 'mid' });
    }

    // Nombre del motor y variante
    if (slot.daily) {
      g.text(blink ? 'DESAFIO DIARIO' : `DESAFIO ${slot.day.slice(5).replace('-', '/')}`, cx, 50, { align: 'center', color: 'yellow' });
      g.text(`${engineDef.name} + ${slot.label}`, cx, 59, { align: 'center' });
    } else {
      g.text(engineDef.name, cx, 50, { align: 'center', color: engineDef.color });
      g.text(`${slot.variantIndex + 1}/${engineDef.variants.length} ${slot.label}`, cx, 59, { align: 'center' });
      if (this.favorite) g.text('♥', SCREEN_WIDTH - 22, numberY + 22, { color: 'magenta', scale: 2 });
    }

    // Vista previa animada
    const boxSize = 56;
    const bx = Math.floor(cx - boxSize / 2);
    const by = 70;
    g.rect(bx, by, boxSize, boxSize, 'ghost');
    g.frame(bx - 2, by - 2, boxSize + 4, boxSize + 4, slot.daily && blink ? 'yellow' : 'ink');
    g.text('▲', bx - 12, by + boxSize / 2 - 8, { color: this.arrowFlash.up > 0 ? 'ink' : 'mid' });
    g.text('▼', bx - 12, by + boxSize / 2 + 3, { color: this.arrowFlash.down > 0 ? 'ink' : 'mid' });
    const frame = engineDef.icon[Math.floor(this.time * 2) % engineDef.icon.length];
    g.sprite(frame, bx + 4, by + 4, { scale: 6, colors: { '#': engineDef.color, '+': 'mid' } });

    // Descripción
    this.descLines.forEach((line, i) => {
      g.text(line, cx, 132 + i * 8, { align: 'center', color: 'mid' });
    });

    // Estrellas y récord, o aviso de cartucho ausente
    if (this.installed) {
      this.engine.drawStars(g, cx - 7, 149, this.stars);
      const name = this.highName ? ` ${this.highName}` : '';
      g.text(`RECORD ${String(this.highScore).padStart(7, '0')}${name}`, cx, 157, { align: 'center' });
    } else if (blink) {
      g.text('PROXIMAMENTE', cx, 153, { align: 'center', color: 'red' });
    }

    // Barra de posición 00-99
    const barX = Math.floor((SCREEN_WIDTH - POSITIONS) / 2);
    const barY = 167;
    g.rect(barX, barY, POSITIONS, 1, 'mid');
    g.rect(barX, barY - 1, 1, 3, 'yellow');
    for (const e of this.catalog.engines) g.rect(barX + e.firstSlot, barY - 1, 1, 3, 'mid');
    g.rect(barX + this.index - 1, barY - 2, 3, 5, 'ink');

    // Ayuda de controles
    g.text('◀▶ JUEGO   ▲▼ MOTOR   A JUGAR', cx, 175, { align: 'center', color: 'mid' });
    g.text('B OPCIONES  START CARRERA Y LOGROS', cx, 184, { align: 'center', color: 'mid' });
  }
}
