// src/games/MazeMuncher.js
// Motor 2 (slots 13-22): laberinto come-puntos. Come todos los puntos sin que te atrapen
// los fantasmas; las píldoras grandes los asustan y puedes comértelos un rato.
// Variantes (Catalog99): velocidad, número y conducta de fantasmas, forma del laberinto
// (clásico, cruz, espiral o uno distinto por nivel), duración del poder, apagón, fruta y vidas.
//
// Controles: cruceta (puedes pulsar el giro antes de llegar al cruce).

import { BaseCartridge, ACTIONS } from './BaseCartridge.js';

const TILE = 7;
const TOP = 16;

/**
 * Laberintos de 19 columnas. '#' muro, 'X' vacío exterior, '.' punto, 'o' píldora de poder,
 * ' ' pasillo vacío, '-' puerta de la casa, 'H' casa de los fantasmas, 'P' inicio del jugador,
 * 'F' lugar de la fruta. Las filas con huecos en los bordes son túneles que cruzan la pantalla.
 */
const MAZES = {
  classic: [
    '###################',
    '#........#........#',
    '#o##.###.#.###.##o#',
    '#.................#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '####.### # ###.####',
    'XXX#.#   F   #.#XXX',
    '####.# ##-## #.####',
    '    .  #HHH#  .    ',
    '####.# ##### #.####',
    'XXX#.#       #.#XXX',
    '####.# ##### #.####',
    '#........#........#',
    '#o##.###.#.###.##o#',
    '#..#.....P.....#..#',
    '##.#.#.#####.#.#.##',
    '#....#...#...#....#',
    '#.######.#.######.#',
    '#.................#',
    '###################'
  ],
  cross: [
    '###################',
    '#o.......#.......o#',
    '#.#####..#..#####.#',
    '#.#XXX#.....#XXX#.#',
    '#.#XXX#.###.#XXX#.#',
    '#.#####..#..#####.#',
    '#........#........#',
    '####.###.#.###.####',
    '#....#       #....#',
    '#.##.# ##-## #.##.#',
    ' ...   #HHH#   ... ',
    '#.##.# ##### #.##.#',
    '#....#   F   #....#',
    '####.###.#.###.####',
    '#........P........#',
    '#.#####..#..#####.#',
    '#.#XXX#.....#XXX#.#',
    '#.#XXX#.###.#XXX#.#',
    '#.#####..#..#####.#',
    '#o.......#.......o#',
    '###################'
  ],
  spiral: [
    '###################',
    '#o.......F.......o#',
    '#.#######.#######.#',
    '#.#.............#.#',
    '#.#.#####.#####.#.#',
    '#...#.........#...#',
    '###.#.###-###.#.###',
    '#...#.#HHHHH#.#...#',
    '#.###.#######.###.#',
    '#.....#..P..#.....#',
    '#.#.###.###.###.#.#',
    '#.#.............#.#',
    '#.#######.#######.#',
    '#o...............o#',
    '###################'
  ]
};
const ROTATION = ['classic', 'cross', 'spiral'];

const DIRS = {
  [ACTIONS.UP]: { x: 0, y: -1 },
  [ACTIONS.LEFT]: { x: -1, y: 0 },
  [ACTIONS.DOWN]: { x: 0, y: 1 },
  [ACTIONS.RIGHT]: { x: 1, y: 0 }
};
const DIR_ORDER = [DIRS.UP, DIRS.LEFT, DIRS.DOWN, DIRS.RIGHT];

const GHOST_COLORS = ['red', 'magenta', 'cyan', 'orange', 'green', 'blue'];
const MODE_SCHEDULE = [
  ['scatter', 7],
  ['chase', 20],
  ['scatter', 7],
  ['chase', 20],
  ['scatter', 5],
  ['chase', Infinity]
];
const FRUIT_AT = [40, 100];
const FRUIT_TIME = 9;

// ---------- Sprites 7x7 ----------
const PLAYER_FRAMES = [
  ['..###..', '.#####.', '#######', '#######', '#######', '.#####.', '..###..'],
  ['..###..', '.#####.', '#####..', '###....', '#####..', '.#####.', '..###..'],
  ['..###..', '.####..', '####...', '###....', '####...', '.####..', '..###..']
];
const GHOST_FRAMES = [
  ['..###..', '.#####.', '#o#o###', '#######', '#######', '#######', '#.#.#.#'],
  ['..###..', '.#####.', '#o#o###', '#######', '#######', '#######', '.#.#.#.']
];
const SCARED_FRAMES = [
  ['..###..', '.#####.', '##.#.##', '#######', '#.#.#.#', '#######', '#.#.#.#'],
  ['..###..', '.#####.', '##.#.##', '#######', '#.#.#.#', '#######', '.#.#.#.']
];
const EYES = ['.......', '.......', '.oo.oo.', '.oo.oo.', '.......', '.......', '.......'];
const FRUIT = ['....#..', '...#...', '..#.#..', '.#...#.', '###.###', '###.###', '.#...#.'];

/** Gira un sprite que mira a la derecha para que mire en otra dirección. */
function orient(rows, dir) {
  const n = rows.length;
  const at = (x, y) => rows[y][x];
  const out = [];
  for (let y = 0; y < n; y++) {
    let line = '';
    for (let x = 0; x < n; x++) {
      if (dir.x === 1) line += at(x, y);
      else if (dir.x === -1) line += at(n - 1 - x, y);
      else if (dir.y === -1) line += at(n - 1 - y, x);
      else line += at(y, x);
    }
    out.push(line);
  }
  return out;
}

const same = (a, b) => a && b && a.x === b.x && a.y === b.y;
const opposite = (a, b) => a && b && a.x === -b.x && a.y === -b.y;

export default class MazeMuncher extends BaseCartridge {
  reset() {
    this.mazeIndex = 0;
    this._loadMaze();
    this._resetActors();
  }

  // ---------- Laberinto ----------

  _mazeName() {
    const m = this.config.maze;
    if (m === 'rotate') return ROTATION[this.mazeIndex % ROTATION.length];
    return MAZES[m] ? m : 'classic';
  }

  _loadMaze() {
    const rows = MAZES[this._mazeName()];
    this.rows = rows;
    this.W = rows[0].length;
    this.H = rows.length;
    this.ox = Math.floor((this.width - this.W * TILE) / 2);
    this.oy = TOP + Math.floor((this.height - TOP - this.H * TILE) / 2);
    this.dots = new Map();
    this.house = [];
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        const ch = rows[y][x];
        if (ch === '.') this.dots.set(this._k(x, y), 'dot');
        else if (ch === 'o') this.dots.set(this._k(x, y), 'power');
        else if (ch === 'P') this.start = { x, y };
        else if (ch === 'F') this.fruitSpot = { x, y };
        else if (ch === '-') this.door = { x, y };
        else if (ch === 'H') this.house.push({ x, y });
      }
    }
    this.exit = { x: this.door.x, y: this.door.y - 1 };
    this.houseCenter = this.house[Math.floor(this.house.length / 2)];
    this.dotsEaten = 0;
    this.fruit = null;
    this.fruitsShown = 0;
  }

  _k(x, y) {
    return y * 64 + x;
  }

  _tile(x, y) {
    if (y < 0 || y >= this.H) return '#';
    return this.rows[y][((x % this.W) + this.W) % this.W];
  }

  _open(x, y) {
    const t = this._tile(x, y);
    return t !== '#' && t !== 'X' && t !== '-' && t !== 'H';
  }

  // ---------- Actores ----------

  _resetActors() {
    const levelBoost = 1 + (this.level - 1) * 0.04;
    this.player = { x: this.start.x, y: this.start.y, dir: DIRS.LEFT, want: DIRS.LEFT, speed: 5.4 * this.config.speed * Math.min(1.25, levelBoost), mouth: 0 };
    const count = Math.max(1, Math.min(6, this.config.ghostCount));
    this.ghosts = [];
    for (let i = 0; i < count; i++) {
      const spot = this.house[i % this.house.length];
      const g = {
        index: i,
        color: GHOST_COLORS[i],
        x: i === 0 ? this.exit.x : spot.x,
        y: i === 0 ? this.exit.y : spot.y,
        dir: DIRS.LEFT,
        state: i === 0 ? 'active' : 'house',
        release: i === 0 ? 0 : 1.5 + i * 2.5,
        frightened: 0,
        bob: i * 0.7
      };
      this.ghosts.push(g);
    }
    this.modeStep = 0;
    this.modeTimer = 0;
    this.mode = this.config.ghostAI === 'chase' ? 'chase' : MODE_SCHEDULE[0][0];
    this.eatChain = 0;
    this.dying = null;
    this.levelClear = null;
    this.ready = 1.2;
    this.aiTimer = 0;
  }

  _ghostSpeed(g) {
    const base = 4.8 * this.config.ghostSpeed * Math.min(1.3, 1 + (this.level - 1) * 0.05);
    if (g.state === 'eyes') return 11;
    if (g.frightened > 0) return 2.8;
    if (this._tile(Math.round(g.x), Math.round(g.y)) === ' ' && (Math.round(g.x) <= 0 || Math.round(g.x) >= this.W - 1)) return base * 0.6;
    return base;
  }

  /**
   * Avanza un actor `dist` casillas por la rejilla, parando en cada centro de casilla
   * para que decide() elija la siguiente dirección.
   */
  _advance(a, dist, decide) {
    let guard = 0;
    while (dist > 1e-6 && guard++ < 8) {
      if (!a.dir) {
        decide(a);
        if (!a.dir) return;
      }
      const nx = a.dir.x > 0 ? Math.floor(a.x + 1e-6) + 1 : a.dir.x < 0 ? Math.ceil(a.x - 1e-6) - 1 : a.x;
      const ny = a.dir.y > 0 ? Math.floor(a.y + 1e-6) + 1 : a.dir.y < 0 ? Math.ceil(a.y - 1e-6) - 1 : a.y;
      const remaining = Math.abs(nx - a.x) + Math.abs(ny - a.y);
      if (dist < remaining) {
        a.x += a.dir.x * dist;
        a.y += a.dir.y * dist;
        return;
      }
      a.x = nx;
      a.y = ny;
      dist -= remaining;
      // Túnel: al salir por un borde aparece por el otro.
      if (a.x < 0) a.x += this.W;
      else if (a.x >= this.W) a.x -= this.W;
      decide(a);
    }
  }

  // ---------- Jugador ----------

  _decidePlayer(p) {
    if (p.want && this._open(p.x + p.want.x, p.y + p.want.y)) p.dir = p.want;
    else if (p.dir && !this._open(p.x + p.dir.x, p.y + p.dir.y)) p.dir = null;
    this._eatAt(p.x, p.y);
  }

  _eatAt(x, y) {
    const k = this._k(x, y);
    const item = this.dots.get(k);
    if (!item) return;
    this.dots.delete(k);
    this.dotsEaten++;
    if (item === 'power') {
      this.addScore(50);
      this.sound.sfx('powerup');
      this.input.vibrate('medium');
      this._frighten();
    } else {
      this.addScore(10);
      this.sound.sfx('tick');
    }
    if (this.config.fruit && this.fruitsShown < FRUIT_AT.length && this.dotsEaten >= FRUIT_AT[this.fruitsShown]) {
      this.fruitsShown++;
      this.fruit = { ...this.fruitSpot, timer: FRUIT_TIME };
    }
    if (this.dots.size === 0) this._startLevelClear();
  }

  _frighten() {
    this.eatChain = 0;
    const duration = Math.max(1, this.config.powerDuration - (this.level - 1) * 0.3);
    for (const g of this.ghosts) {
      if (g.state === 'eyes') continue;
      g.frightened = duration;
      if (g.state === 'active') g.dir = { x: -g.dir.x, y: -g.dir.y };
    }
  }

  // ---------- Fantasmas ----------

  _scatterTarget(i) {
    const corners = [
      { x: this.W - 2, y: -2 },
      { x: 1, y: -2 },
      { x: this.W - 1, y: this.H + 1 },
      { x: 0, y: this.H + 1 },
      { x: Math.floor(this.W / 2), y: -2 },
      { x: Math.floor(this.W / 2), y: this.H + 1 }
    ];
    return corners[i % corners.length];
  }

  _chaseTarget(g) {
    const p = this.player;
    const px = Math.round(p.x);
    const py = Math.round(p.y);
    const d = p.dir || p.want || DIRS.LEFT;
    switch (g.index) {
      case 1:
        return { x: px + d.x * 4, y: py + d.y * 4 };
      case 2: {
        const lead = this.ghosts[0];
        const vx = px + d.x * 2;
        const vy = py + d.y * 2;
        return { x: vx * 2 - Math.round(lead.x), y: vy * 2 - Math.round(lead.y) };
      }
      case 3:
        return Math.hypot(g.x - px, g.y - py) > 7 ? { x: px, y: py } : this._scatterTarget(3);
      case 4:
        return { x: px - d.x * 3, y: py - d.y * 3 };
      case 5:
        return { x: px + d.x * 2, y: py + d.y * 2 };
      default:
        return { x: px, y: py };
    }
  }

  _decideGhost(g) {
    if (g.state === 'eyes' && g.x === this.exit.x && g.y === this.exit.y) {
      g.state = 'entering';
      g.dir = null;
      return;
    }
    const options = DIR_ORDER.filter((d) => !opposite(d, g.dir) && this._open(g.x + d.x, g.y + d.y));
    if (options.length === 0) {
      g.dir = { x: -g.dir.x, y: -g.dir.y };
      return;
    }
    const randomMove = g.frightened > 0 || (this.config.ghostAI === 'random' && g.state !== 'eyes');
    if (randomMove) {
      g.dir = options[Math.floor(this.rng() * options.length)];
      return;
    }
    let target;
    if (g.state === 'eyes') target = this.exit;
    else if (this.mode === 'scatter') target = this._scatterTarget(g.index);
    else target = this._chaseTarget(g);
    let best = options[0];
    let bestDist = Infinity;
    for (const d of options) {
      const dist = (g.x + d.x - target.x) ** 2 + (g.y + d.y - target.y) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    g.dir = best;
  }

  /** Movimiento sin rejilla dentro y alrededor de la casa (salir, volver a entrar). */
  _moveToward(g, tx, ty, dist) {
    const dx = tx - g.x;
    const dy = ty - g.y;
    if (Math.abs(dx) > 1e-6) {
      const step = Math.min(Math.abs(dx), dist);
      g.x += Math.sign(dx) * step;
      return false;
    }
    if (Math.abs(dy) > 1e-6) {
      const step = Math.min(Math.abs(dy), dist);
      g.y += Math.sign(dy) * step;
      return false;
    }
    return true;
  }

  _updateGhost(g, dt) {
    if (g.frightened > 0) g.frightened = Math.max(0, g.frightened - dt);
    switch (g.state) {
      case 'house':
        g.release -= dt;
        g.bob += dt * 4;
        if (g.release <= 0) {
          g.state = 'leaving';
          g.y = Math.round(g.y);
        }
        break;
      case 'leaving':
        if (this._moveToward(g, this.exit.x, this.exit.y, 3 * dt)) {
          g.state = 'active';
          g.x = this.exit.x;
          g.y = this.exit.y;
          g.dir = this.rng() < 0.5 ? DIRS.LEFT : DIRS.RIGHT;
        }
        break;
      case 'entering':
        if (this._moveToward(g, this.houseCenter.x, this.houseCenter.y, 6 * dt)) {
          g.state = 'house';
          g.release = 0.8;
          g.frightened = 0;
        }
        break;
      default:
        this._advance(g, this._ghostSpeed(g) * dt, (a) => this._decideGhost(a));
        break;
    }
  }

  _updateMode(dt) {
    if (this.config.ghostAI !== 'mixed') return;
    if (this.ghosts.some((g) => g.frightened > 0)) return;
    this.modeTimer += dt;
    const [, duration] = MODE_SCHEDULE[this.modeStep];
    if (this.modeTimer < duration) return;
    this.modeTimer = 0;
    this.modeStep = Math.min(MODE_SCHEDULE.length - 1, this.modeStep + 1);
    this.mode = MODE_SCHEDULE[this.modeStep][0];
    for (const g of this.ghosts) if (g.state === 'active') g.dir = { x: -g.dir.x, y: -g.dir.y };
  }

  _checkCollisions() {
    const p = this.player;
    for (const g of this.ghosts) {
      if (g.state !== 'active') continue;
      let dx = Math.abs(g.x - p.x);
      dx = Math.min(dx, this.W - dx);
      if (dx + Math.abs(g.y - p.y) > 0.65) continue;
      if (g.frightened > 0) {
        this.eatChain++;
        const points = 200 * 2 ** Math.min(3, this.eatChain - 1);
        this.addScore(points);
        this.track('ghosts');
        this.peak('ghostChain', this.eatChain);
        this.sound.sfx('coin');
        this.input.vibrate('medium');
        this.burst(this.ox + g.x * TILE + 3, this.oy + g.y * TILE + 3, { color: g.color, count: 12, speed: 50 });
        g.state = 'eyes';
        g.frightened = 0;
        this.popup = { text: String(points), x: g.x, y: g.y, timer: 1 };
      } else {
        this._startDying();
        return;
      }
    }
    if (this.fruit && Math.round(p.x) === this.fruit.x && Math.round(p.y) === this.fruit.y) {
      const points = 100 * this.level + 100;
      this.addScore(points);
      this.sound.sfx('coin');
      this.popup = { text: String(points), x: this.fruit.x, y: this.fruit.y, timer: 1 };
      this.fruit = null;
    }
  }

  _startDying() {
    this.dying = { timer: 0 };
    this.sound.sfx('explode');
    this.shake(3, 0.3);
    this.input.vibrate('heavy');
  }

  _startLevelClear() {
    this.levelClear = { timer: 0 };
    this.addScore(500 * this.level);
    this.track('mazes');
    this.sound.melody('start');
  }

  // ---------- Bucle ----------

  update(dt) {
    if (this.popup) {
      this.popup.timer -= dt;
      if (this.popup.timer <= 0) this.popup = null;
    }
    if (this.levelClear) {
      this.levelClear.timer += dt;
      if (this.levelClear.timer >= 1.8) {
        this.levelUp();
        this.mazeIndex++;
        this._loadMaze();
        this._resetActors();
      }
      return;
    }
    if (this.dying) {
      this.dying.timer += dt;
      if (this.dying.timer >= 1.4) {
        this.dying = null;
        if (this.loseLife('ATRAPADO') > 0) this._resetActors();
      }
      return;
    }
    if (this.ready > 0) {
      this.ready -= dt;
      return;
    }

    const p = this.player;
    const before = { x: p.x, y: p.y };
    this._advance(p, p.speed * dt, (a) => this._decidePlayer(a));
    if (p.x !== before.x || p.y !== before.y) p.mouth += dt * 14;

    this._updateMode(dt);
    for (const g of this.ghosts) this._updateGhost(g, dt);
    if (this.fruit) {
      this.fruit.timer -= dt;
      if (this.fruit.timer <= 0) this.fruit = null;
    }
    this._checkCollisions();
  }

  onInput({ action, pressed }) {
    if (!pressed) return;
    const d = DIRS[action];
    if (!d) return;
    const p = this.player;
    p.want = d;
    // Dar media vuelta es inmediato; si está parado arranca en cuanto puede.
    if (opposite(d, p.dir) || (!p.dir && this._open(Math.round(p.x) + d.x, Math.round(p.y) + d.y))) p.dir = d;
  }

  // ---------- IA del modo demo ----------

  autopilot(dt) {
    this.aiTimer -= dt;
    if (this.aiTimer > 0 || this.dying || this.levelClear) return;
    this.aiTimer = 0.08;
    const p = this.player;
    // Se planifica desde la próxima casilla a la que llega: así no cambia de idea a medio camino.
    const d0 = p.dir;
    let sx = d0 ? (d0.x > 0 ? Math.floor(p.x + 1e-6) + 1 : d0.x < 0 ? Math.ceil(p.x - 1e-6) - 1 : Math.round(p.x)) : Math.round(p.x);
    const sy = d0 ? (d0.y > 0 ? Math.floor(p.y + 1e-6) + 1 : d0.y < 0 ? Math.ceil(p.y - 1e-6) - 1 : Math.round(p.y)) : Math.round(p.y);
    sx = ((sx % this.W) + this.W) % this.W;
    const danger = new Set();
    for (const g of this.ghosts) {
      if (g.state !== 'active' || g.frightened > 1) continue;
      const gx = Math.round(g.x);
      const gy = Math.round(g.y);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2) danger.add(this._k(gx + dx, gy + dy));
    }
    if (d0 && danger.has(this._k(sx, sy))) {
      // Un fantasma espera delante: media vuelta ya.
      const back = DIR_ORDER.find((d) => opposite(d, d0));
      const action = Object.keys(DIRS).find((a) => DIRS[a] === back);
      this.handleInput({ action, pressed: true, repeat: false });
      return;
    }
    const isGoal = (x, y) =>
      this.dots.has(this._k(x, y)) ||
      (this.fruit && this.fruit.x === x && this.fruit.y === y) ||
      this.ghosts.some((g) => g.state === 'active' && g.frightened > 1.5 && Math.round(g.x) === x && Math.round(g.y) === y);

    const firstStep = new Map([[this._k(sx, sy), null]]);
    const queue = [{ x: sx, y: sy }];
    let goal = null;
    while (queue.length && !goal) {
      const c = queue.shift();
      for (const d of DIR_ORDER) {
        const x = (((c.x + d.x) % this.W) + this.W) % this.W;
        const y = c.y + d.y;
        const k = this._k(x, y);
        if (firstStep.has(k) || !this._open(x, y) || danger.has(k)) continue;
        firstStep.set(k, firstStep.get(this._k(c.x, c.y)) || d);
        if (isGoal(x, y)) {
          goal = k;
          break;
        }
        queue.push({ x, y });
      }
    }
    let dir = goal !== null ? firstStep.get(goal) : null;
    if (!dir) {
      // Sin camino seguro: aléjate del fantasma más cercano.
      let best = -1;
      for (const d of DIR_ORDER) {
        if (!this._open(sx + d.x, sy + d.y)) continue;
        const nearest = Math.min(...this.ghosts.filter((g) => g.state === 'active').map((g) => Math.abs(g.x - sx - d.x) + Math.abs(g.y - sy - d.y)), 99);
        if (nearest > best) {
          best = nearest;
          dir = d;
        }
      }
    }
    if (!dir || same(dir, p.want)) return;
    // Pedir media vuelta la haría al instante; solo se permite huyendo (ya resuelto arriba).
    if (opposite(dir, p.dir) && goal !== null) {
      p.want = dir;
      return;
    }
    const action = Object.keys(DIRS).find((a) => DIRS[a] === dir);
    this.handleInput({ action, pressed: true, repeat: false });
  }

  // ---------- Dibujo ----------

  draw(g) {
    g.clear();
    const { ox, oy } = this;
    const flashWalls = this.levelClear && Math.floor(this.levelClear.timer * 6) % 2 === 1;

    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        const t = this.rows[y][x];
        const px = ox + x * TILE;
        const py = oy + y * TILE;
        if (t === '#') g.cell(px, py, TILE, flashWalls ? 'white' : 'mid');
        else if (t === '-') g.rect(px, py + 3, TILE, 1, 'magenta');
      }
    }
    const blink = Math.floor(this.time * 4) % 2 === 0;
    for (const [k, item] of this.dots) {
      const x = k % 64;
      const y = Math.floor(k / 64);
      const px = ox + x * TILE;
      const py = oy + y * TILE;
      if (item === 'power') {
        if (blink || this.ready > 0) g.circle(px + 3, py + 3, 2, 'yellow');
      } else {
        g.rect(px + 3, py + 3, 1, 1, 'ink');
        g.rect(px + 2, py + 3, 1, 1, 'mid');
      }
    }
    if (this.fruit && (this.fruit.timer > 2 || blink)) {
      g.sprite(FRUIT, ox + this.fruit.x * TILE, oy + this.fruit.y * TILE, { colors: { '#': 'red' } });
    }

    if (!this.levelClear) this._drawGhosts(g);
    this._drawPlayer(g);

    if (this.popup) {
      g.text(this.popup.text, ox + this.popup.x * TILE + 3, oy + this.popup.y * TILE - 6, { align: 'center', color: 'cyan' });
    }

    if (this.config.darkMaze && !this.finished && !this.levelClear) this._drawDarkness(g);

    // Marcador superior.
    g.rect(0, 0, this.width, TOP - 2, 'bg');
    g.text(String(this.score).padStart(6, '0'), 2, 2);
    g.text(`R ${String(Math.max(this.highScore, this.score)).padStart(6, '0')}`, 2, 8, { color: 'mid' });
    g.text(this.timeLimit > 0 ? `T ${Math.ceil(this.timeLeft)}` : `NV ${this.level}`, 72, 2, { align: 'center' });
    g.text('♥'.repeat(Math.max(0, Math.min(5, this.lives))), this.width - 2, 2, { align: 'right', color: 'red' });
    g.text(`${this.slot.daily ? 'HOY' : this.slot.code} ${this.slot.label}`, this.width - 2, 8, { align: 'right', color: 'mid' });
    g.rect(0, TOP - 2, this.width, 1, 'mid');

    if (this.ready > 0 && !this.dying) g.text('LISTO', 72, oy + (this.exit.y + 2) * TILE, { align: 'center', color: 'yellow' });
    if (this.levelClear) g.text('NIVEL SUPERADO', 72, oy + (this.exit.y + 2) * TILE, { align: 'center', color: 'yellow' });
  }

  _drawPlayer(g) {
    const p = this.player;
    const x = this.ox + p.x * TILE;
    const y = this.oy + p.y * TILE;
    if (this.dying) {
      // Se encoge hasta desaparecer.
      const r = Math.max(0, 3 - Math.floor(this.dying.timer * 3));
      if (r > 0) g.circle(x + 3, y + 3, r, 'yellow');
      return;
    }
    const frame = PLAYER_FRAMES[Math.floor(p.mouth) % PLAYER_FRAMES.length];
    g.sprite(orient(frame, p.dir || p.want || DIRS.LEFT), x, y, { colors: { '#': 'yellow' } });
  }

  _drawGhosts(g) {
    const frame = Math.floor(this.time * 6) % 2;
    for (const gh of this.ghosts) {
      const x = this.ox + gh.x * TILE;
      const y = this.oy + (gh.state === 'house' ? gh.y + Math.sin(gh.bob) * 0.25 : gh.y) * TILE;
      if (gh.state === 'eyes' || gh.state === 'entering') {
        g.sprite(EYES, x, y, { colors: { o: 'white' } });
        continue;
      }
      if (gh.frightened > 0) {
        const ending = gh.frightened < 1.5 && Math.floor(this.time * 8) % 2 === 0;
        g.sprite(SCARED_FRAMES[frame], x, y, { colors: { '#': ending ? 'white' : 'blue' } });
        continue;
      }
      g.sprite(GHOST_FRAMES[frame], x, y, { colors: { '#': gh.color, o: 'bg' } });
    }
  }

  /** Apagón: solo se ve un círculo alrededor del jugador. */
  _drawDarkness(g) {
    const ctx = g.ctx;
    const cx = this.ox + this.player.x * TILE + 3.5;
    const cy = this.oy + this.player.y * TILE + 3.5;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, TOP, this.width, this.height - TOP);
    ctx.arc(cx, cy, 24, 0, Math.PI * 2, true);
    ctx.fillStyle = g.color('bg');
    ctx.fill('evenodd');
    ctx.restore();
  }
}
