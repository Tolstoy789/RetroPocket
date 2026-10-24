// src/games/CyberSnake.js
// Motor 3 (slots 23-32): la serpiente. Come, crece y no choques contigo ni con los muros.
// Variantes (Catalog99): velocidad, bordes sólidos o atravesables, obstáculos (bloques, laberinto,
// al azar), crecimiento por bocado, varias comidas a la vez, aceleración y contrarreloj.
//
// Controles: cruceta para girar, A (mantener) para acelerar.

import { BaseCartridge, ACTIONS } from './BaseCartridge.js';

const CELL = 8;
const COLS = 18;
const ROWS = 22;
const FIELD_X = 0;
const FIELD_Y = 16;

const DIRS = {
  [ACTIONS.UP]: { x: 0, y: -1 },
  [ACTIONS.DOWN]: { x: 0, y: 1 },
  [ACTIONS.LEFT]: { x: -1, y: 0 },
  [ACTIONS.RIGHT]: { x: 1, y: 0 }
};
const DIR_LIST = Object.values(DIRS);

const FOODS_PER_LEVEL = 5;
const BONUS_LIFETIME = 6;

/** Muros interiores del modo LABERINTO (18x22, '#' = muro). */
const MAZE = [
  '..................',
  '..................',
  '..####......####..',
  '..#............#..',
  '..#............#..',
  '..................',
  '.......####.......',
  '..................',
  '....#........#....',
  '....#........#....',
  '....#........#....',
  '....#........#....',
  '....#........#....',
  '....#........#....',
  '..................',
  '.......####.......',
  '..................',
  '..#............#..',
  '..#............#..',
  '..####......####..',
  '..................',
  '..................'
];

/** Bloques del modo BLOQUES: [x, y, ancho, alto]. */
const BLOCKS = [
  [3, 4, 2, 2],
  [13, 4, 2, 2],
  [8, 10, 2, 2],
  [3, 16, 2, 2],
  [13, 16, 2, 2]
];

const key = (x, y) => y * COLS + x;

export default class CyberSnake extends BaseCartridge {
  reset() {
    const c = this.config;
    this.walls = new Set();
    if (c.obstacles === 'maze') {
      MAZE.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && this.walls.add(key(x, y))));
    } else if (c.obstacles === 'blocks') {
      for (const [bx, by, w, h] of BLOCKS) {
        for (let y = by; y < by + h; y++) for (let x = bx; x < bx + w; x++) this.walls.add(key(x, y));
      }
    }

    const length = Math.max(2, c.startLength);
    const startY = Math.floor(ROWS / 2) + 3;
    const startX = length + 1;
    this.snake = [];
    for (let i = 0; i < length; i++) this.snake.push({ x: startX - i, y: startY });
    this.dir = DIRS[ACTIONS.RIGHT];
    this.queue = [];
    this.pendingGrowth = 0;
    this.eaten = 0;
    this.stepTimer = 0;
    this.interval = 0.15 / Math.max(0.3, c.speed);
    this.foods = [];
    this.bonus = null;
    this.dead = null;
    this.ready = 1.2;

    if (c.obstacles === 'random') this._addRandomWalls(10);
    for (let i = 0; i < Math.max(1, c.foodCount); i++) this._spawnFood();
  }

  // ---------- Tablero ----------

  _occupied(x, y) {
    if (this.walls.has(key(x, y))) return true;
    return this.snake.some((s) => s.x === x && s.y === y);
  }

  /** Casillas a las que se puede llegar desde la cabeza sin atravesar muros. */
  _reachable() {
    const head = this.snake[0];
    const seen = new Set([key(head.x, head.y)]);
    const stack = [head];
    while (stack.length) {
      const c = stack.pop();
      for (const d of DIR_LIST) {
        const n = this._wrap(c.x + d.x, c.y + d.y);
        if (n.x < 0 || n.x >= COLS || n.y < 0 || n.y >= ROWS) continue;
        const k = key(n.x, n.y);
        if (seen.has(k) || this.walls.has(k)) continue;
        seen.add(k);
        stack.push(n);
      }
    }
    return seen;
  }

  _freeCell(minDistance = 0, reachableOnly = false) {
    const head = this.snake[0];
    const reachable = reachableOnly ? this._reachable() : null;
    for (let tries = 0; tries < 400; tries++) {
      const x = Math.floor(this.rng() * COLS);
      const y = Math.floor(this.rng() * ROWS);
      if (this._occupied(x, y)) continue;
      if (reachable && !reachable.has(key(x, y))) continue;
      if (this.foods.some((f) => f.x === x && f.y === y)) continue;
      if (this.bonus && this.bonus.x === x && this.bonus.y === y) continue;
      if (Math.abs(x - head.x) + Math.abs(y - head.y) < minDistance) continue;
      return { x, y };
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!this._occupied(x, y) && !this.foods.some((f) => f.x === x && f.y === y)) return { x, y };
      }
    }
    return null;
  }

  _spawnFood() {
    const cell = this._freeCell(0, true);
    if (cell) this.foods.push(cell);
  }

  /** Obstáculos al azar, siempre lejos de la cabeza para no encerrar a la serpiente. */
  _addRandomWalls(count) {
    for (let i = 0; i < count; i++) {
      const cell = this._freeCell(5);
      if (cell) this.walls.add(key(cell.x, cell.y));
    }
  }

  // ---------- Movimiento ----------

  _turn(action) {
    const d = DIRS[action];
    if (!d) return;
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if (d.x === -last.x && d.y === -last.y) return;
    if (d.x === last.x && d.y === last.y) return;
    if (this.queue.length < 2) this.queue.push(d);
  }

  _step() {
    if (this.queue.length) this.dir = this.queue.shift();
    const head = this.snake[0];
    let x = head.x + this.dir.x;
    let y = head.y + this.dir.y;

    if (this.config.walls === 'wrap') {
      x = (x + COLS) % COLS;
      y = (y + ROWS) % ROWS;
    } else if (x < 0 || x >= COLS || y < 0 || y >= ROWS) {
      this._die();
      return;
    }

    // La cola se mueve en este mismo paso, así que perseguirla no es choque (salvo si crece).
    const tailMoves = this.pendingGrowth === 0;
    const body = tailMoves ? this.snake.slice(0, -1) : this.snake;
    if (this.walls.has(key(x, y)) || body.some((s) => s.x === x && s.y === y)) {
      this._die();
      return;
    }

    this.snake.unshift({ x, y });
    if (this.pendingGrowth > 0) this.pendingGrowth--;
    else this.snake.pop();

    const foodIndex = this.foods.findIndex((f) => f.x === x && f.y === y);
    if (foodIndex >= 0) {
      this.foods.splice(foodIndex, 1);
      this._eat(10, false);
      this._spawnFood();
    } else if (this.bonus && this.bonus.x === x && this.bonus.y === y) {
      const points = 20 + Math.ceil(this.bonus.life) * 10;
      this.bonus = null;
      this._eat(points, true);
    }
  }

  _eat(points, isBonus) {
    const head = this.snake[0];
    this.addScore(points * this.level);
    this.pendingGrowth += Math.max(1, this.config.growth);
    this.sound.sfx(isBonus ? 'powerup' : 'eat');
    this.input.vibrate('light');
    this.burst(FIELD_X + head.x * CELL + 4, FIELD_Y + head.y * CELL + 4, { color: isBonus ? 'magenta' : 'green', count: isBonus ? 16 : 8, speed: 50 });
    if (isBonus) return;

    this.eaten++;
    if (this.config.accelerate) this.interval = Math.max(0.045, this.interval * 0.96);
    if (this.eaten % FOODS_PER_LEVEL === 0) {
      this.levelUp();
      this.interval = Math.max(0.045, this.interval * 0.95);
      if (this.config.obstacles === 'random') this._addRandomWalls(3);
    }
    if (!this.bonus && this.eaten % 4 === 0) {
      const cell = this._freeCell(4, true);
      if (cell) this.bonus = { ...cell, life: BONUS_LIFETIME };
    }
  }

  _die() {
    this.dead = { timer: 0 };
    this.sound.sfx('explode');
    this.shake(4, 0.4);
    this.flash('red', 0.25, 0.5);
    this.input.vibrate('heavy');
    const head = this.snake[0];
    this.burst(FIELD_X + head.x * CELL + 4, FIELD_Y + head.y * CELL + 4, { color: 'red', count: 24, speed: 80 });
  }

  update(dt) {
    if (this.dead) {
      this.dead.timer += dt;
      if (this.dead.timer >= 1.2) this.gameOver({ message: 'CHOQUE' });
      return;
    }
    if (this.ready > 0) {
      this.ready -= dt;
      return;
    }
    if (this.bonus) {
      this.bonus.life -= dt;
      if (this.bonus.life <= 0) this.bonus = null;
    }
    const boost = this.isDown(ACTIONS.A) ? 0.5 : 1;
    this.stepTimer += dt;
    while (this.stepTimer >= this.interval * boost && !this.dead) {
      this.stepTimer -= this.interval * boost;
      this._step();
    }
  }

  onInput({ action, pressed }) {
    if (!pressed || this.dead) return;
    this._turn(action);
  }

  // ---------- IA del modo demo ----------

  _passable(x, y, body) {
    if (this.config.walls === 'wrap') {
      x = (x + COLS) % COLS;
      y = (y + ROWS) % ROWS;
    } else if (x < 0 || x >= COLS || y < 0 || y >= ROWS) {
      return false;
    }
    return !this.walls.has(key(x, y)) && !body.has(key(x, y));
  }

  _wrap(x, y) {
    return this.config.walls === 'wrap' ? { x: (x + COLS) % COLS, y: (y + ROWS) % ROWS } : { x, y };
  }

  /** Celdas alcanzables desde (x, y): sirve para no meterse en un callejón. */
  _space(x, y, body, limit = 120) {
    const seen = new Set([key(x, y)]);
    const stack = [{ x, y }];
    while (stack.length && seen.size < limit) {
      const c = stack.pop();
      for (const d of DIR_LIST) {
        const n = this._wrap(c.x + d.x, c.y + d.y);
        const k = key(n.x, n.y);
        if (seen.has(k) || !this._passable(n.x, n.y, body)) continue;
        seen.add(k);
        stack.push(n);
      }
    }
    return seen.size;
  }

  autopilot() {
    if (this.dead || this.queue.length) return;
    const head = this.snake[0];
    const body = new Set(this.snake.slice(0, -1).map((s) => key(s.x, s.y)));
    const targets = this.bonus ? [...this.foods, this.bonus] : this.foods;

    // Camino más corto (BFS) hasta la comida más cercana.
    const prev = new Map([[key(head.x, head.y), null]]);
    const queue = [head];
    let found = null;
    while (queue.length && !found) {
      const c = queue.shift();
      for (const d of DIR_LIST) {
        const n = this._wrap(c.x + d.x, c.y + d.y);
        const k = key(n.x, n.y);
        if (prev.has(k) || !this._passable(n.x, n.y, body)) continue;
        prev.set(k, { cell: c, dir: d });
        if (targets.some((t) => t.x === n.x && t.y === n.y)) {
          found = n;
          break;
        }
        queue.push(n);
      }
    }

    let choice = null;
    if (found) {
      let k = key(found.x, found.y);
      let step = prev.get(k);
      while (step && !(step.cell.x === head.x && step.cell.y === head.y)) {
        k = key(step.cell.x, step.cell.y);
        step = prev.get(k);
      }
      if (step) {
        const n = this._wrap(head.x + step.dir.x, head.y + step.dir.y);
        if (this._space(n.x, n.y, body) > this.snake.length) choice = step.dir;
      }
    }
    if (!choice) {
      let bestSpace = -1;
      for (const d of DIR_LIST) {
        if (d.x === -this.dir.x && d.y === -this.dir.y) continue;
        const n = this._wrap(head.x + d.x, head.y + d.y);
        if (!this._passable(n.x, n.y, body)) continue;
        const space = this._space(n.x, n.y, body);
        if (space > bestSpace) {
          bestSpace = space;
          choice = d;
        }
      }
    }
    if (!choice || (choice.x === this.dir.x && choice.y === this.dir.y)) return;
    const action = Object.keys(DIRS).find((a) => DIRS[a] === choice);
    this.handleInput({ action, pressed: true, repeat: false });
  }

  // ---------- Dibujo ----------

  draw(g) {
    g.clear();
    g.rect(0, 0, this.width, FIELD_Y - 2, 'bg');
    g.text(String(this.score).padStart(6, '0'), 2, 2);
    g.text(`R ${String(Math.max(this.highScore, this.score)).padStart(6, '0')}`, 2, 8, { color: 'mid' });
    const right = this.timeLimit > 0 ? `T ${Math.ceil(this.timeLeft)}` : `NV ${this.level}`;
    g.text(right, this.width - 2, 2, { align: 'right' });
    g.text(`${this.slot.daily ? 'HOY' : this.slot.code} ${this.slot.label}`, this.width - 2, 8, { align: 'right', color: 'mid' });
    g.rect(0, FIELD_Y - 2, this.width, 1, 'mid');

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        g.cell(FIELD_X + x * CELL, FIELD_Y + y * CELL, CELL, this.walls.has(key(x, y)) ? 'mid' : 'off');
      }
    }

    const blink = Math.floor(this.time * 6) % 2 === 0;
    for (const f of this.foods) g.cell(FIELD_X + f.x * CELL, FIELD_Y + f.y * CELL, CELL, blink ? 'yellow' : 'orange');
    if (this.bonus && (this.bonus.life > 2 || blink)) {
      g.cell(FIELD_X + this.bonus.x * CELL, FIELD_Y + this.bonus.y * CELL, CELL, 'magenta');
    }

    const deadBlink = this.dead && Math.floor(this.dead.timer * 10) % 2 === 1;
    this.snake.forEach((s, i) => {
      if (deadBlink) return;
      const color = i === 0 ? (this.dead ? 'red' : 'cyan') : 'green';
      g.cell(FIELD_X + s.x * CELL, FIELD_Y + s.y * CELL, CELL, color);
    });
    if (!this.dead) {
      // Ojos en la cabeza para ver hacia dónde va.
      const h = this.snake[0];
      const cx = FIELD_X + h.x * CELL + 3 + this.dir.x * 2;
      const cy = FIELD_Y + h.y * CELL + 3 + this.dir.y * 2;
      g.rect(cx, cy, 1, 1, 'bg');
    }
    if (this.ready > 0 && blink) g.text('LISTO', this.width / 2, FIELD_Y + 40, { align: 'center', color: 'yellow' });
  }
}
