// src/games/BlockDrop.js
// Motor 1 (slots 01-12): bloques que caen. Encaja piezas en un pozo de 10x20 y completa líneas.
// Variantes (Catalog99): velocidad, nivel inicial, juegos de piezas (clásico, mini, penta),
// basura inicial o que sube, piezas invisibles, sprint de 40 líneas, controles espejo,
// cascada de bloques sueltos y sombra de caída.
//
// Controles: ◀ ▶ mover, ▼ bajar rápido, ▲ caída instantánea, A girar a la derecha, B girar a la izquierda.

import { BaseCartridge, ACTIONS } from './BaseCartridge.js';

const COLS = 10;
const ROWS = 20;
const CELL = 8;
const FIELD_X = 4;
const FIELD_Y = 16;
const HUD_X = 90;

const COLORS = ['cyan', 'yellow', 'magenta', 'green', 'red', 'blue', 'orange'];

/** Formas en texto: '#' = bloque. Se normalizan a listas de celdas [x, y]. */
const SHAPES = {
  classic: [
    ['####'],
    ['##', '##'],
    ['.#.', '###'],
    ['.##', '##.'],
    ['##.', '.##'],
    ['#..', '###'],
    ['..#', '###']
  ],
  mini: [['#'], ['##'], ['###'], ['#.', '##']],
  penta: [
    ['#####'],
    ['##', '##', '#.'],
    ['.##', '##.', '.#.'],
    ['##.', '.##', '.#.'],
    ['###', '.#.', '.#.'],
    ['#.#', '###'],
    ['#..', '#..', '###'],
    ['#..', '##.', '.##'],
    ['.#.', '###', '.#.'],
    ['#...', '####'],
    ['...#', '####'],
    ['.#..', '####']
  ]
};

const LINE_POINTS = [0, 100, 300, 500, 800, 1200];
const LOCK_DELAY = 0.4;
const MAX_LOCK_RESETS = 12;
const CLEAR_TIME = 0.3;
const SOFT_DROP_INTERVAL = 0.035;
const KICKS = [0, -1, 1, -2, 2];

function parseShape(rows) {
  const cells = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && cells.push([x, y])));
  return cells;
}

/** Gira las celdas 90° (dir = 1 horario, -1 antihorario) y las vuelve a pegar arriba a la izquierda. */
function rotateCells(cells, dir) {
  const rotated = cells.map(([x, y]) => (dir > 0 ? [-y, x] : [y, -x]));
  const minX = Math.min(...rotated.map((c) => c[0]));
  const minY = Math.min(...rotated.map((c) => c[1]));
  return rotated.map(([x, y]) => [x - minX, y - minY]);
}

function shapeSize(cells) {
  return {
    w: Math.max(...cells.map((c) => c[0])) + 1,
    h: Math.max(...cells.map((c) => c[1])) + 1
  };
}

export default class BlockDrop extends BaseCartridge {
  reset() {
    const c = this.config;
    this.shapes = (SHAPES[c.pieceSet] || SHAPES.classic).map(parseShape);
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.seenUntil = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    this.lines = 0;
    this.combo = 0;
    this.bag = [];
    this.piece = null;
    this.next = this._takeFromBag();
    this.clearing = null;
    this.dying = null;
    this.gravityTimer = 0;
    this.softTimer = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.risingTimer = 0;
    this.aiPlan = null;
    this.aiTimer = 0;

    for (let i = 0; i < c.garbageRows; i++) this._pushGarbageRow();
    this._spawn();
  }

  // ---------- Piezas ----------

  /** Bolsa con todas las piezas barajadas: evita rachas largas sin la pieza que necesitas. */
  _takeFromBag() {
    if (this.bag.length === 0) {
      this.bag = this.shapes.map((_, i) => i);
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    const index = this.bag.pop();
    return { index, cells: this.shapes[index], color: COLORS[index % COLORS.length] };
  }

  _spawn() {
    const { index, cells, color } = this.next;
    this.next = this._takeFromBag();
    const { w } = shapeSize(cells);
    this.piece = { index, cells, color, x: Math.floor((COLS - w) / 2), y: 0 };
    this.lockTimer = 0;
    this.lockResets = 0;
    this.gravityTimer = 0;
    this.aiPlan = null;
    if (!this._fits(this.piece.cells, this.piece.x, this.piece.y)) {
      this.piece.y = -1;
      if (!this._fits(this.piece.cells, this.piece.x, this.piece.y)) this._startDying();
    }
  }

  _fits(cells, px, py) {
    for (const [cx, cy] of cells) {
      const x = px + cx;
      const y = py + cy;
      if (x < 0 || x >= COLS || y >= ROWS) return false;
      if (y >= 0 && this.grid[y][x]) return false;
    }
    return true;
  }

  _dropDistance(cells = this.piece.cells, x = this.piece.x, y = this.piece.y) {
    let d = 0;
    while (this._fits(cells, x, y + d + 1)) d++;
    return d;
  }

  _move(dx) {
    if (!this.piece) return false;
    if (!this._fits(this.piece.cells, this.piece.x + dx, this.piece.y)) return false;
    this.piece.x += dx;
    this._touchLock();
    this.sound.sfx('move');
    return true;
  }

  _rotate(dir) {
    if (!this.piece) return false;
    const cells = rotateCells(this.piece.cells, dir);
    for (const kick of KICKS) {
      for (const up of [0, -1]) {
        if (this._fits(cells, this.piece.x + kick, this.piece.y + up)) {
          this.piece.cells = cells;
          this.piece.x += kick;
          this.piece.y += up;
          this._touchLock();
          this.sound.sfx('rotate');
          return true;
        }
      }
    }
    return false;
  }

  /** Mover o girar sobre el suelo da un poco más de tiempo antes de fijar la pieza. */
  _touchLock() {
    if (this.lockTimer > 0 && this.lockResets < MAX_LOCK_RESETS) {
      this.lockTimer = 0;
      this.lockResets++;
    }
  }

  _softStep() {
    if (!this.piece) return;
    if (this._fits(this.piece.cells, this.piece.x, this.piece.y + 1)) {
      this.piece.y++;
      this.addScore(1);
      this.gravityTimer = 0;
    }
  }

  _hardDrop() {
    if (!this.piece) return;
    const d = this._dropDistance();
    this.piece.y += d;
    this.addScore(d * 2);
    if (d > 0) this.shake(1, 0.08);
    this._lock();
  }

  _lock() {
    const p = this.piece;
    if (!p) return;
    for (const [cx, cy] of p.cells) {
      const x = p.x + cx;
      const y = p.y + cy;
      if (y < 0) {
        this.piece = null;
        this._startDying();
        return;
      }
      this.grid[y][x] = p.color;
      this.seenUntil[y][x] = this.time + 1.2;
    }
    this.piece = null;
    this.sound.sfx('drop');
    this.input.vibrate('light');
    this._checkLines();
  }

  // ---------- Líneas ----------

  _fullRows() {
    const rows = [];
    for (let y = 0; y < ROWS; y++) if (this.grid[y].every(Boolean)) rows.push(y);
    return rows;
  }

  _checkLines() {
    const rows = this._fullRows();
    if (rows.length === 0) {
      this.combo = 0;
      this._afterClear();
      return;
    }
    this.combo++;
    const points = (LINE_POINTS[Math.min(rows.length, LINE_POINTS.length - 1)] + (this.combo - 1) * 50) * this.level;
    this.addScore(points);
    this.clearing = { rows, timer: CLEAR_TIME };
    for (const y of rows) {
      this.burst(FIELD_X + (COLS * CELL) / 2, FIELD_Y + y * CELL + 4, { color: 'yellow', count: 10, speed: 70, spread: Math.PI * 2 });
    }
    if (rows.length >= 4) {
      this.sound.sfx('levelup');
      this.shake(3, 0.3);
      this.flash('white', 0.2, 0.5);
      this.input.vibrate('heavy');
    } else {
      this.sound.sfx('line');
      this.input.vibrate('medium');
    }
  }

  _finishClear() {
    const rows = this.clearing.rows;
    this.clearing = null;
    this.grid = this.grid.filter((_, y) => !rows.includes(y));
    this.seenUntil = this.seenUntil.filter((_, y) => !rows.includes(y));
    while (this.grid.length < ROWS) {
      this.grid.unshift(Array(COLS).fill(null));
      this.seenUntil.unshift(Array(COLS).fill(0));
    }
    const before = this.lines;
    this.lines += rows.length;

    if (this.config.goalLines > 0 && this.lines >= this.config.goalLines) {
      const bonus = Math.max(0, Math.round(6000 - this.time * 25));
      this.addScore(bonus);
      this.win({ message: `${this.config.goalLines} LINEAS` });
      return;
    }
    if (this.config.goalLines === 0 && Math.floor(this.lines / 10) > Math.floor(before / 10)) this.levelUp();

    if (this.config.cascade && this._collapseLoose()) {
      this._checkLines();
      return;
    }
    this._afterClear();
  }

  /** Cascada: cada bloque cae hasta apoyarse en algo. Devuelve true si algo se movió. */
  _collapseLoose() {
    let moved = false;
    for (let x = 0; x < COLS; x++) {
      let write = ROWS - 1;
      for (let y = ROWS - 1; y >= 0; y--) {
        if (!this.grid[y][x]) continue;
        if (y !== write) {
          this.grid[write][x] = this.grid[y][x];
          this.seenUntil[write][x] = this.time + 1.2;
          this.grid[y][x] = null;
          moved = true;
        }
        write--;
      }
    }
    return moved;
  }

  _afterClear() {
    if (!this.finished && !this.dying) this._spawn();
  }

  // ---------- Basura ----------

  _garbageRow() {
    const hole = Math.floor(this.rng() * COLS);
    return Array.from({ length: COLS }, (_, x) => (x === hole ? null : 'mid'));
  }

  _pushGarbageRow() {
    if (this.grid[0].some(Boolean)) {
      this._startDying();
      return;
    }
    this.grid.shift();
    this.seenUntil.shift();
    this.grid.push(this._garbageRow());
    this.seenUntil.push(Array(COLS).fill(Infinity));
  }

  _risingGarbage() {
    this._pushGarbageRow();
    this.sound.sfx('hit');
    this.shake(2, 0.2);
    if (this.piece && !this._fits(this.piece.cells, this.piece.x, this.piece.y)) {
      this.piece.y--;
      if (!this._fits(this.piece.cells, this.piece.x, this.piece.y)) {
        this.piece = null;
        this._startDying();
      }
    }
  }

  // ---------- Fin de partida ----------

  _startDying() {
    if (this.dying) return;
    this.piece = null;
    this.clearing = null;
    this.dying = { timer: 0 };
    this.sound.sfx('explode');
    this.shake(4, 0.4);
    this.input.vibrate('heavy');
  }

  // ---------- Bucle ----------

  _gravityInterval() {
    const base = Math.max(0.06, 0.85 * Math.pow(0.85, this.level - 1));
    return base / Math.max(0.2, this.config.speed);
  }

  update(dt) {
    if (this.dying) {
      this.dying.timer += dt;
      if (this.dying.timer >= 1.1) this.gameOver({ message: 'POZO LLENO' });
      return;
    }

    if (this.config.risingGarbage > 0) {
      this.risingTimer += dt;
      if (this.risingTimer >= this.config.risingGarbage) {
        this.risingTimer = 0;
        this._risingGarbage();
        if (this.dying) return;
      }
    }

    if (this.clearing) {
      this.clearing.timer -= dt;
      if (this.clearing.timer <= 0) this._finishClear();
      return;
    }
    if (!this.piece) return;

    if (this.isDown(ACTIONS.DOWN)) {
      this.softTimer += dt;
      while (this.softTimer >= SOFT_DROP_INTERVAL) {
        this.softTimer -= SOFT_DROP_INTERVAL;
        this._softStep();
      }
    } else {
      this.softTimer = 0;
    }

    const grounded = !this._fits(this.piece.cells, this.piece.x, this.piece.y + 1);
    if (grounded) {
      this.lockTimer += dt;
      if (this.lockTimer >= LOCK_DELAY) this._lock();
      return;
    }
    this.lockTimer = 0;
    this.gravityTimer += dt;
    const interval = this._gravityInterval();
    while (this.gravityTimer >= interval && this.piece) {
      this.gravityTimer -= interval;
      if (this._fits(this.piece.cells, this.piece.x, this.piece.y + 1)) this.piece.y++;
    }
  }

  onInput({ action, pressed }) {
    if (!pressed || this.dying || this.clearing || !this.piece) return;
    const mirror = this.config.mirror ? -1 : 1;
    switch (action) {
      case ACTIONS.LEFT:
        this._move(-mirror);
        break;
      case ACTIONS.RIGHT:
        this._move(mirror);
        break;
      case ACTIONS.DOWN:
        this._softStep();
        this.softTimer = 0;
        break;
      case ACTIONS.UP:
        this._hardDrop();
        break;
      case ACTIONS.A:
        this._rotate(1);
        break;
      case ACTIONS.B:
        this._rotate(-1);
        break;
      default:
        break;
    }
  }

  // ---------- IA del modo demo ----------

  /** Busca la mejor posición (giro + columna) con una heurística clásica de alturas y huecos. */
  _planMove() {
    const p = this.piece;
    let best = null;
    let cells = p.cells;
    for (let rot = 0; rot < 4; rot++) {
      const { w } = shapeSize(cells);
      for (let x = -2; x <= COLS - w + 2; x++) {
        if (!this._fits(cells, x, p.y)) continue;
        const y = p.y + this._dropDistance(cells, x, p.y);
        const score = this._evaluate(cells, x, y);
        if (!best || score > best.score) best = { score, rot, x };
      }
      cells = rotateCells(cells, 1);
    }
    return best;
  }

  _evaluate(cells, px, py) {
    const grid = this.grid.map((row) => row.slice());
    for (const [cx, cy] of cells) if (py + cy >= 0) grid[py + cy][px + cx] = 'x';
    let lines = 0;
    for (const row of grid) if (row.every(Boolean)) lines++;
    const heights = [];
    let holes = 0;
    for (let x = 0; x < COLS; x++) {
      let top = ROWS;
      for (let y = 0; y < ROWS; y++) {
        if (grid[y][x]) {
          if (top === ROWS) top = y;
        } else if (top < ROWS) {
          holes++;
        }
      }
      heights.push(ROWS - top);
    }
    const aggregate = heights.reduce((a, b) => a + b, 0);
    let bump = 0;
    for (let x = 1; x < COLS; x++) bump += Math.abs(heights[x] - heights[x - 1]);
    return lines * 0.76 - aggregate * 0.51 - holes * 0.36 - bump * 0.18;
  }

  autopilot(dt) {
    if (!this.piece || this.clearing || this.dying) return;
    if (!this.aiPlan) this.aiPlan = this._planMove() || { rot: 0, x: this.piece.x };
    this.aiTimer -= dt;
    if (this.aiTimer > 0) return;
    this.aiTimer = 0.09;
    const press = (action) => this.handleInput({ action, pressed: true, repeat: false });
    if (this.aiPlan.rot > 0) {
      if (this._rotate(1)) this.aiPlan.rot--;
      else this.aiPlan.rot = 0;
      return;
    }
    const mirror = this.config.mirror ? -1 : 1;
    if (this.piece.x !== this.aiPlan.x) {
      const dir = this.aiPlan.x > this.piece.x ? 1 : -1;
      const before = this.piece.x;
      press(dir * mirror > 0 ? ACTIONS.RIGHT : ACTIONS.LEFT);
      if (this.piece && this.piece.x === before) this.aiPlan.x = before;
      return;
    }
    press(ACTIONS.UP);
  }

  // ---------- Dibujo ----------

  _cellVisible(x, y) {
    if (!this.config.invisible || this.finished || this.dying) return true;
    return this.time < this.seenUntil[y][x];
  }

  draw(g) {
    g.clear();
    g.frame(FIELD_X - 2, FIELD_Y - 2, COLS * CELL + 3, ROWS * CELL + 3, 'mid');

    const flashOn = this.clearing && Math.floor(this.clearing.timer * 20) % 2 === 0;
    for (let y = 0; y < ROWS; y++) {
      const clearingRow = this.clearing && this.clearing.rows.includes(y);
      for (let x = 0; x < COLS; x++) {
        const v = this.grid[y][x];
        let state = 'off';
        if (v && this._cellVisible(x, y)) state = v === 'mid' ? 'mid' : v;
        if (clearingRow) state = flashOn ? 'white' : 'off';
        g.cell(FIELD_X + x * CELL, FIELD_Y + y * CELL, CELL, state);
      }
    }

    // Animación de fin: el pozo se llena de abajo arriba.
    if (this.dying) {
      const filled = Math.floor((this.dying.timer / 1) * ROWS);
      for (let i = 0; i < Math.min(ROWS, filled); i++) {
        const y = ROWS - 1 - i;
        for (let x = 0; x < COLS; x++) g.cell(FIELD_X + x * CELL, FIELD_Y + y * CELL, CELL, 'on');
      }
    }

    const p = this.piece;
    if (p) {
      if (this.config.ghost) {
        const gy = p.y + this._dropDistance();
        if (gy !== p.y) {
          for (const [cx, cy] of p.cells) {
            if (gy + cy >= 0) g.cell(FIELD_X + (p.x + cx) * CELL, FIELD_Y + (gy + cy) * CELL, CELL, 'mid');
          }
        }
      }
      for (const [cx, cy] of p.cells) {
        if (p.y + cy >= 0) g.cell(FIELD_X + (p.x + cx) * CELL, FIELD_Y + (p.y + cy) * CELL, CELL, p.color);
      }
    }

    g.text(this.slot.engine.name, FIELD_X - 2, 4, { color: 'mid' });
    const extra = [[this.config.goalLines > 0 ? 'FALTAN' : 'LINEAS', String(this.config.goalLines > 0 ? Math.max(0, this.config.goalLines - this.lines) : this.lines)]];
    const nextRows = this._previewRows(this.next.cells);
    this.drawHud(g, HUD_X, 16, {
      showLives: false,
      extra,
      next: nextRows,
      nextScale: nextRows[0].length > 3 ? 3 : 4,
      nextColors: { '#': this.next.color }
    });
  }

  _previewRows(cells) {
    const { w, h } = shapeSize(cells);
    const rows = Array.from({ length: h }, () => Array(w).fill('.'));
    for (const [x, y] of cells) rows[y][x] = '#';
    return rows.map((r) => r.join(''));
  }
}
