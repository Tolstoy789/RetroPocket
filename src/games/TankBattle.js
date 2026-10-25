// src/games/TankBattle.js
// Motor 6 (slots 53-62): batalla de tanques. Destruye a todos los tanques enemigos
// sin que alcancen tu base (el águila de abajo).
// Variantes (Catalog99): número de enemigos y cuántos a la vez, velocidad y cadencia enemiga,
// mapa (ladrillo, acero, bosque, arena abierta, laberinto) y modo supervivencia sin base.
//
// Controles: cruceta para moverte, A disparar.

import { BaseCartridge, ACTIONS } from './BaseCartridge.js';

const TILE = 8;
const COLS = 18;
const ROWS = 22;
const OX = 0;
const OY = 16;
const SIZE = 16;
const EMPTY = 0;
const BRICK = 1;
const STEEL = 2;
const FOREST = 3;

const DIRS = {
  [ACTIONS.UP]: { x: 0, y: -1 },
  [ACTIONS.DOWN]: { x: 0, y: 1 },
  [ACTIONS.LEFT]: { x: -1, y: 0 },
  [ACTIONS.RIGHT]: { x: 1, y: 0 }
};
const DIR_LIST = Object.values(DIRS);

const PLAYER_SPEED = 42;
const ENEMY_SPEED = 30;
const BULLET_SPEED = 145;
const ENEMY_BULLET_SPEED = 110;

/** Tanque de Brick Game (3x3 celdas) mirando hacia arriba. */
const TANK_PLAYER = ['.#.', '###', '#.#'];
const TANK_ENEMY = ['.#.', '###', '###'];
const BASE = ['#..##..#', '.######.', '..####..', '.##..##.', '########', '.#.##.#.', '..####..', '.#....#.'];
const BASE_RUIN = ['........', '........', '#..#..#.', '.#.##.#.', '########', '##.##.##', '.######.', '#.#..#.#'];

const BASE_TILE = { x: 8, y: 20 };
const PLAYER_SPAWN = { x: 4 * TILE, y: 20 * TILE };
const ENEMY_SPAWNS = [
  { x: 0, y: 0 },
  { x: 8 * TILE, y: 0 },
  { x: 16 * TILE, y: 0 }
];

function rotate(rows, dir) {
  const n = rows.length;
  const out = [];
  for (let y = 0; y < n; y++) {
    let line = '';
    for (let x = 0; x < n; x++) {
      if (dir.y === -1) line += rows[y][x];
      else if (dir.y === 1) line += rows[n - 1 - y][x];
      else if (dir.x === -1) line += rows[x][y];
      else line += rows[n - 1 - x][y];
    }
    out.push(line);
  }
  return out;
}

export default class TankBattle extends BaseCartridge {
  /** Constantes que el estado de la partida referencia (para guardar y cargar partidas). */
  static get saveConstants() {
    return { DIRS, DIR_LIST, TANK_PLAYER, TANK_ENEMY, BASE, BASE_RUIN, BASE_TILE, PLAYER_SPAWN, ENEMY_SPAWNS };
  }

  reset() {
    this._newStage();
  }

  // ---------- Mapa ----------

  _newStage() {
    this.map = this._buildMap(this.config.map);
    this.baseAlive = true;
    this.bullets = [];
    this.enemies = [];
    this.spawned = 0;
    this.destroyed = 0;
    this.spawnTimer = 0.5;
    this.spawnIndex = 0;
    this.stageClear = null;
    this.player = this._newPlayer();
    this.aiTimer = 0;
    this.lastDir = null;
  }

  _newPlayer() {
    return { x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y, dir: DIRS[ACTIONS.UP], shield: 2.5, cooldown: 0, dead: 0 };
  }

  _buildMap(type) {
    const m = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
    const fill = (x, y, w, h, v) => {
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (j >= 0 && j < ROWS && i >= 0 && i < COLS) m[j][i] = v;
    };
    const pillars = (material) => {
      for (const cx of [2, 6, 10, 14]) {
        fill(cx, 3, 2, 5, material);
        fill(cx, 12, 2, 5, material);
      }
      for (const cx of [4, 12]) fill(cx, 9, 2, 2, BRICK);
      // Un bloque de acero en el centro: nadie baja en línea recta desde arriba hasta la base.
      fill(8, 9, 2, 2, STEEL);
      fill(0, 9, 2, 1, BRICK);
      fill(16, 9, 2, 1, BRICK);
    };
    switch (type) {
      case 'steel':
        pillars(STEEL);
        break;
      case 'forest':
        pillars(BRICK);
        for (let i = 0; i < 6; i++) {
          const x = 1 + Math.floor(this.rng() * (COLS - 5));
          const y = 2 + Math.floor(this.rng() * (ROWS - 8));
          fill(x, y, 4, 3, FOREST);
        }
        break;
      case 'open':
        for (const [x, y] of [[4, 6], [12, 6], [4, 14], [12, 14]]) fill(x, y, 2, 2, STEEL);
        break;
      case 'maze':
        for (const y of [4, 9, 14]) {
          fill(0, y, COLS, 1, BRICK);
          const gaps = new Set();
          while (gaps.size < 3) gaps.add(2 * Math.floor(this.rng() * (COLS / 2)));
          for (const gx of gaps) fill(gx, y, 2, 1, EMPTY);
          fill(Math.floor(this.rng() * 6) * 2 + 2, y + 1, 1, 3, STEEL);
        }
        break;
      default:
        pillars(BRICK);
        break;
    }
    // Zonas de aparición despejadas.
    for (const s of ENEMY_SPAWNS) fill(s.x / TILE, s.y / TILE, 2, 2, EMPTY);
    fill(PLAYER_SPAWN.x / TILE, PLAYER_SPAWN.y / TILE, 2, 2, EMPTY);
    // Base protegida por ladrillos.
    fill(BASE_TILE.x - 2, BASE_TILE.y - 2, 6, 4, EMPTY);
    if (this.config.protectBase) {
      // Muralla de dos ladrillos de grosor alrededor del águila.
      fill(BASE_TILE.x - 2, BASE_TILE.y - 2, 6, 2, BRICK);
      fill(BASE_TILE.x - 2, BASE_TILE.y, 2, 2, BRICK);
      fill(BASE_TILE.x + 2, BASE_TILE.y, 2, 2, BRICK);
    }
    return m;
  }

  _solidTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
    const t = this.map[ty][tx];
    return t === BRICK || t === STEEL;
  }

  _baseRect() {
    return { x: BASE_TILE.x * TILE, y: BASE_TILE.y * TILE, w: SIZE, h: SIZE };
  }

  // ---------- Movimiento ----------

  _rectFree(x, y, self) {
    if (x < 0 || y < 0 || x + SIZE > COLS * TILE || y + SIZE > ROWS * TILE) return false;
    const x0 = Math.floor(x / TILE);
    const y0 = Math.floor(y / TILE);
    const x1 = Math.floor((x + SIZE - 1) / TILE);
    const y1 = Math.floor((y + SIZE - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this._solidTile(tx, ty)) return false;
    if (this.config.protectBase) {
      const b = this._baseRect();
      if (x < b.x + b.w && x + SIZE > b.x && y < b.y + b.h && y + SIZE > b.y) return false;
    }
    const tanks = [this.player, ...this.enemies];
    for (const t of tanks) {
      if (t === self || t.dead || t.spawning > 0) continue;
      if (x < t.x + SIZE && x + SIZE > t.x && y < t.y + SIZE && y + SIZE > t.y) {
        // Si ya se solapaban (al aparecer), deja que se separen.
        if (self && Math.abs(self.x - t.x) < SIZE && Math.abs(self.y - t.y) < SIZE) continue;
        return false;
      }
    }
    return true;
  }

  /** Mueve un tanque; al girar se alinea a la rejilla de medio tanque, como en el clásico. */
  _drive(t, dir, speed, dt) {
    if (dir.x !== t.dir.x || dir.y !== t.dir.y) {
      if (dir.x !== 0) t.y = Math.round(t.y / TILE) * TILE;
      else t.x = Math.round(t.x / TILE) * TILE;
      t.dir = dir;
    }
    const nx = t.x + dir.x * speed * dt;
    const ny = t.y + dir.y * speed * dt;
    if (this._rectFree(nx, ny, t)) {
      t.x = nx;
      t.y = ny;
      return true;
    }
    return false;
  }

  _fire(t, owner) {
    const cx = t.x + SIZE / 2 - 1 + t.dir.x * (SIZE / 2);
    const cy = t.y + SIZE / 2 - 1 + t.dir.y * (SIZE / 2);
    this.bullets.push({ x: cx, y: cy, dir: t.dir, owner, from: t });
    if (owner === 'player') this.sound.sfx('shoot');
  }

  // ---------- Enemigos ----------

  _spawnEnemy() {
    const c = this.config;
    const alive = this.enemies.filter((e) => !e.dead).length;
    if (this.spawned >= c.enemyCount || alive >= c.maxOnScreen) return;
    for (let i = 0; i < ENEMY_SPAWNS.length; i++) {
      const s = ENEMY_SPAWNS[(this.spawnIndex + i) % ENEMY_SPAWNS.length];
      if (!this._rectFree(s.x, s.y, null)) continue;
      this.spawnIndex = (this.spawnIndex + i + 1) % ENEMY_SPAWNS.length;
      this.enemies.push({
        x: s.x,
        y: s.y,
        dir: DIRS[ACTIONS.DOWN],
        spawning: 0.8,
        turn: 1 + this.rng() * 2,
        fire: 1 + this.rng() * 1.5,
        dead: 0
      });
      this.spawned++;
      return;
    }
  }

  _enemyThink(e, dt) {
    const c = this.config;
    const speed = ENEMY_SPEED * c.enemySpeed * Math.min(1.4, 1 + (this.level - 1) * 0.05);
    e.turn -= dt;
    const moved = this._drive(e, e.dir, speed, dt);
    if (!moved || e.turn <= 0) {
      e.turn = 0.8 + this.rng() * 2.2;
      const goal = this.config.protectBase && this.rng() < 0.35 ? this._baseRect() : this.player;
      const toward = [];
      if (goal.x > e.x + 4) toward.push(DIRS[ACTIONS.RIGHT]);
      if (goal.x < e.x - 4) toward.push(DIRS[ACTIONS.LEFT]);
      if (goal.y > e.y + 4) toward.push(DIRS[ACTIONS.DOWN]);
      if (goal.y < e.y - 4) toward.push(DIRS[ACTIONS.UP]);
      const options = this.rng() < 0.55 && toward.length ? toward : DIR_LIST;
      e.dir = options[Math.floor(this.rng() * options.length)];
      if (!moved && this.rng() < 0.5) e.fire = Math.min(e.fire, 0.1);
    }
    e.fire -= dt * c.enemyFireRate;
    const p = this.player;
    const aligned = !p.dead && ((Math.abs(p.x - e.x) < 6 && Math.sign(p.y - e.y) === e.dir.y && e.dir.y !== 0) || (Math.abs(p.y - e.y) < 6 && Math.sign(p.x - e.x) === e.dir.x && e.dir.x !== 0));
    // Al ver al jugador en línea reacciona, pero no al instante.
    if (aligned && !e.spotted) {
      e.spotted = true;
      e.fire = Math.min(e.fire, 0.35 + this.rng() * 0.4);
    } else if (!aligned) e.spotted = false;
    if (e.fire <= 0 && !this.bullets.some((b) => b.from === e)) {
      e.fire = 1.6 + this.rng() * 1.8;
      this._fire(e, 'enemy');
    }
  }

  // ---------- Balas ----------

  _updateBullets(dt) {
    for (const b of this.bullets) {
      const steps = 2;
      for (let i = 0; i < steps && !b.done; i++) {
        const v = b.owner === 'player' ? BULLET_SPEED : ENEMY_BULLET_SPEED;
        b.x += b.dir.x * v * (dt / steps);
        b.y += b.dir.y * v * (dt / steps);
        this._bulletHits(b);
      }
    }
    // Balas que chocan entre sí se anulan.
    for (const a of this.bullets) {
      for (const b of this.bullets) {
        if (a === b || a.done || b.done || a.owner === b.owner) continue;
        if (Math.abs(a.x - b.x) < 4 && Math.abs(a.y - b.y) < 4) {
          a.done = true;
          b.done = true;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.done);
  }

  _bulletHits(b) {
    const bx = b.x + 1;
    const by = b.y + 1;
    if (bx < 0 || by < 0 || bx >= COLS * TILE || by >= ROWS * TILE) {
      b.done = true;
      return;
    }
    const tx = Math.floor(bx / TILE);
    const ty = Math.floor(by / TILE);
    const tile = this.map[ty][tx];
    if (tile === BRICK || tile === STEEL) {
      b.done = true;
      if (tile === BRICK) {
        // Rompe el ladrillo y su vecino: abre un hueco del ancho de una bala.
        this.map[ty][tx] = EMPTY;
        const nx = tx + (b.dir.y !== 0 ? (bx % TILE < TILE / 2 ? -1 : 1) : 0);
        const ny = ty + (b.dir.x !== 0 ? (by % TILE < TILE / 2 ? -1 : 1) : 0);
        if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && this.map[ny][nx] === BRICK) this.map[ny][nx] = EMPTY;
        if (b.owner === 'player') this.sound.sfx('bounce');
      } else if (b.owner === 'player') {
        this.sound.sfx('tick');
      }
      return;
    }
    if (this.config.protectBase && this.baseAlive) {
      const r = this._baseRect();
      if (bx >= r.x && bx < r.x + r.w && by >= r.y && by < r.y + r.h) {
        // Las balas propias rebotan en el águila: solo el enemigo puede destruirla.
        b.done = true;
        if (b.owner === 'enemy') this._destroyBase();
        return;
      }
    }
    const inside = (t) => bx >= t.x && bx < t.x + SIZE && by >= t.y && by < t.y + SIZE;
    if (b.owner === 'player') {
      for (const e of this.enemies) {
        if (e.dead || e.spawning > 0 || !inside(e)) continue;
        b.done = true;
        e.dead = 0.5;
        this.destroyed++;
        this.addScore(100 * this.level);
        this.track('tanks');
        this.sound.sfx('explode');
        this.shake(2, 0.2);
        this.input.vibrate('medium');
        this.burst(e.x + SIZE / 2, OY + e.y + SIZE / 2, { color: 'orange', count: 16, speed: 55 });
        return;
      }
    } else {
      const p = this.player;
      if (!p.dead && inside(p)) {
        b.done = true;
        if (p.shield > 0) {
          this.sound.sfx('bounce');
          return;
        }
        p.dead = 1.2;
        this.burst(p.x + SIZE / 2, OY + p.y + SIZE / 2, { color: 'yellow', count: 24, speed: 70 });
        this.sound.sfx('explode');
        this.loseLife('DERRIBADO');
      }
    }
  }

  _destroyBase() {
    this.baseAlive = false;
    const r = this._baseRect();
    this.burst(r.x + SIZE / 2, OY + r.y + SIZE / 2, { color: 'red', count: 40, speed: 80 });
    this.sound.sfx('explode');
    this.shake(5, 0.6);
    this.flash('red', 0.4, 0.6);
    this.input.vibrate('heavy');
    this.after(1.2, 'gameOver', { message: 'BASE DESTRUIDA' });
  }

  // ---------- Bucle ----------

  update(dt) {
    if (!this.baseAlive) return;
    if (this.stageClear) {
      this.stageClear.timer += dt;
      if (this.stageClear.timer >= 1.8) {
        this.levelUp();
        this._newStage();
      }
      return;
    }

    // Jugador
    const p = this.player;
    if (p.dead > 0) {
      p.dead -= dt;
      if (p.dead <= 0 && this.lives > 0) Object.assign(p, this._newPlayer());
    } else {
      p.shield = Math.max(0, p.shield - dt);
      p.cooldown = Math.max(0, p.cooldown - dt);
      const dir = this._heldDir();
      if (dir) this._drive(p, dir, PLAYER_SPEED, dt);
    }

    // Enemigos
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.8;
      this._spawnEnemy();
    }
    for (const e of this.enemies) {
      if (e.dead) {
        e.dead -= dt;
        continue;
      }
      if (e.spawning > 0) {
        e.spawning -= dt;
        continue;
      }
      this._enemyThink(e, dt);
    }
    this.enemies = this.enemies.filter((e) => !e.dead || e.dead > 0);

    this._updateBullets(dt);

    if (this.destroyed >= this.config.enemyCount && !this.stageClear && this.baseAlive) {
      this.stageClear = { timer: 0 };
      this.addScore(1000 * this.level);
      this.track('stages');
      this.sound.melody('start');
    }
  }

  /** Dirección pulsada; si hay varias, gana la última que se pulsó. */
  _heldDir() {
    if (this.lastDir && this.isDown(this.lastDir)) return DIRS[this.lastDir];
    for (const a of Object.keys(DIRS)) if (this.isDown(a)) return DIRS[a];
    return null;
  }

  get autoFire() {
    return true;
  }

  onInput({ action, pressed }) {
    if (!pressed) return;
    if (DIRS[action]) this.lastDir = action;
    const p = this.player;
    if (action === ACTIONS.A && !p.dead && p.cooldown <= 0) {
      const mine = this.bullets.filter((b) => b.owner === 'player').length;
      if (mine < (this.config.playerFireRate >= 2 ? 2 : 1)) {
        p.cooldown = 0.25 / Math.max(0.5, this.config.playerFireRate);
        this._fire(p, 'player');
      }
    }
  }

  // ---------- IA del modo demo ----------

  /** ¿Un disparo del tanque en su dirección actual daría en la muralla de la base? */
  _aimsAtOwnWall(t) {
    if (!this.config.protectBase) return false;
    const x0 = (BASE_TILE.x - 2) * TILE;
    const x1 = (BASE_TILE.x + 4) * TILE;
    const y0 = (BASE_TILE.y - 2) * TILE;
    const y1 = ROWS * TILE;
    let x = t.x + SIZE / 2;
    let y = t.y + SIZE / 2;
    for (let i = 0; i < 40; i++) {
      x += t.dir.x * 4;
      y += t.dir.y * 4;
      if (x < 0 || y < 0 || x >= COLS * TILE || y >= ROWS * TILE) return false;
      if (x >= x0 && x < x1 && y >= y0 && y < y1) return true;
      const tile = this.map[Math.floor(y / TILE)][Math.floor(x / TILE)];
      if (tile === STEEL || tile === BRICK) return false;
    }
    return false;
  }

  autopilot(dt) {
    const p = this.player;
    if (p.dead || this.stageClear) {
      this._autoHeld = null;
      return;
    }
    this.aiTimer -= dt;
    const targets = this.enemies.filter((e) => !e.dead && e.spawning <= 0);
    // Nunca dispara contra la muralla de su propia base.
    const fire = () => {
      if (!this._aimsAtOwnWall(p)) this.handleInput({ action: ACTIONS.A, pressed: true, repeat: false });
    };
    if (targets.length === 0) {
      this._autoHeld = null;
      return;
    }
    // Balas enemigas que vienen derechas: devolver el disparo (se anulan) o apartarse.
    const threat = this.bullets.find((b) => {
      if (b.owner !== 'enemy') return false;
      const rx = p.x + SIZE / 2 - (b.x + 1);
      const ry = p.y + SIZE / 2 - (b.y + 1);
      if (b.dir.y !== 0) return Math.abs(rx) < SIZE / 2 + 2 && Math.sign(ry) === b.dir.y && Math.abs(ry) < 72;
      return Math.abs(ry) < SIZE / 2 + 2 && Math.sign(rx) === b.dir.x && Math.abs(rx) < 72;
    });
    if (threat && p.shield <= 0) {
      const facing = p.dir.x === -threat.dir.x && p.dir.y === -threat.dir.y;
      const lined = threat.dir.y !== 0 ? Math.abs(p.x + SIZE / 2 - 1 - threat.x) < 3 : Math.abs(p.y + SIZE / 2 - 1 - threat.y) < 3;
      if (facing && lined && p.cooldown <= 0) {
        fire();
        return;
      }
      const sides = threat.dir.y !== 0 ? [ACTIONS.LEFT, ACTIONS.RIGHT] : [ACTIONS.UP, ACTIONS.DOWN];
      const free = sides.filter((a) => this._rectFree(p.x + DIRS[a].x * 4, p.y + DIRS[a].y * 4, p));
      if (free.length) {
        const dodge = this._autoHeld && free.includes(this._autoHeld) ? this._autoHeld : free[0];
        if (this._autoHeld !== dodge) this.lastDir = dodge;
        this._autoHeld = dodge;
        this.aiTimer = 0.25;
        return;
      }
    }
    // Primero los que amenazan la base; si no, todos.
    const base = this._baseRect();
    const nearBase = this.config.protectBase ? targets.filter((e) => Math.hypot(e.x - base.x, e.y - base.y) < 72) : [];
    const pool = nearBase.length ? nearBase : targets;
    const plan = this._planShot(p, pool);
    if (!plan) {
      this._autoHeld = null;
      return;
    }
    const want = plan.dir;
    if (this._autoHeld !== want) this.lastDir = want;
    this._autoHeld = want;
    if (plan.ready && p.dir === DIRS[want] && p.cooldown <= 0) fire();
  }

  /** Casilla de 8 px libre para un tanque (2x2 casillas), sin contar otros tanques. */
  _cellFree(cx, cy) {
    if (cx < 0 || cy < 0 || cx > COLS - 2 || cy > ROWS - 2) return false;
    for (let y = cy; y < cy + 2; y++) for (let x = cx; x < cx + 2; x++) if (this._solidTile(x, y)) return false;
    if (this.config.protectBase) {
      const b = this._baseRect();
      const x = cx * TILE;
      const y = cy * TILE;
      if (x < b.x + b.w && x + SIZE > b.x && y < b.y + b.h && y + SIZE > b.y) return false;
    }
    return true;
  }

  /** ¿Se puede disparar desde la casilla (cx, cy) al tanque e en línea recta? */
  _lineTo(cx, cy, e) {
    const ex = Math.round(e.x / TILE);
    const ey = Math.round(e.y / TILE);
    let dir = null;
    if (Math.abs(ex - cx) <= 0 && ey !== cy) dir = ey < cy ? ACTIONS.UP : ACTIONS.DOWN;
    else if (Math.abs(ey - cy) <= 0 && ex !== cx) dir = ex < cx ? ACTIONS.LEFT : ACTIONS.RIGHT;
    if (!dir) return null;
    const d = DIRS[dir];
    const steps = Math.abs(ex - cx) + Math.abs(ey - cy);
    let bricks = 0;
    for (let i = 1; i < steps; i++) {
      const x = cx + d.x * i;
      const y = cy + d.y * i;
      for (let k = 0; k < 2; k++) {
        const tx = d.x !== 0 ? x + (d.x > 0 ? 1 : 0) : x + k;
        const ty = d.y !== 0 ? y + (d.y > 0 ? 1 : 0) : y + k;
        if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return null;
        const t = this.map[ty][tx];
        if (t === STEEL) return null;
        if (t === BRICK) {
          if (this.config.protectBase && tx >= BASE_TILE.x - 2 && tx < BASE_TILE.x + 4 && ty >= BASE_TILE.y - 2) return null;
          bricks++;
        }
      }
    }
    return bricks <= 2 ? dir : null;
  }

  /**
   * Busca (en anchura) la casilla más cercana desde la que hay tiro limpio a algún objetivo.
   * Devuelve la dirección a pulsar y si ya está en posición de disparo.
   */
  _planShot(p, targets) {
    const sx = Math.round(p.x / TILE);
    const sy = Math.round(p.y / TILE);
    const key = (x, y) => y * COLS + x;
    const first = new Map([[key(sx, sy), null]]);
    const queue = [[sx, sy]];
    const order = [ACTIONS.UP, ACTIONS.LEFT, ACTIONS.RIGHT, ACTIONS.DOWN];
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const e of targets) {
        const dir = this._lineTo(x, y, e);
        if (!dir) continue;
        if (x === sx && y === sy) return { dir, ready: true };
        return { dir: first.get(key(x, y)), ready: false };
      }
      for (const a of order) {
        const nx = x + DIRS[a].x;
        const ny = y + DIRS[a].y;
        const k = key(nx, ny);
        if (first.has(k) || !this._cellFree(nx, ny)) continue;
        first.set(k, x === sx && y === sy ? a : first.get(key(x, y)));
        queue.push([nx, ny]);
      }
    }
    return null;
  }

  // ---------- Dibujo ----------

  draw(g) {
    g.clear();
    const colorful = g.palette.colorful;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = this.map[y][x];
        const px = OX + x * TILE;
        const py = OY + y * TILE;
        if (t === BRICK) g.cell(px, py, TILE, 'orange');
        else if (t === STEEL) {
          g.rect(px, py, TILE - 1, TILE - 1, 'mid');
          g.rect(px + 2, py + 2, TILE - 5, TILE - 5, 'white');
        }
      }
    }

    const base = this._baseRect();
    if (this.config.protectBase) g.sprite(this.baseAlive ? BASE : BASE_RUIN, OX + base.x, OY + base.y, { scale: 2, colors: { '#': this.baseAlive ? 'yellow' : 'mid' } });

    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.spawning > 0) {
        if (Math.floor(e.spawning * 10) % 2 === 0) g.frame(OX + e.x + 2, OY + e.y + 2, SIZE - 4, SIZE - 4, 'mid');
        continue;
      }
      this._drawTank(g, e, TANK_ENEMY, colorful ? 'red' : 'mid');
    }
    const p = this.player;
    if (!p.dead && (p.shield <= 0 || Math.floor(this.time * 12) % 2 === 0)) this._drawTank(g, p, TANK_PLAYER, 'yellow');
    if (!p.dead && p.shield > 0) g.frame(OX + p.x - 1, OY + p.y - 1, SIZE + 2, SIZE + 2, 'cyan');

    for (const b of this.bullets) g.rect(OX + b.x, OY + b.y, 2, 2, b.owner === 'player' ? 'yellow' : 'red');

    // El bosque tapa los tanques.
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (this.map[y][x] !== FOREST) continue;
        const px = OX + x * TILE;
        const py = OY + y * TILE;
        g.rect(px, py, TILE, TILE, 'bg');
        for (let j = 0; j < TILE; j += 2) for (let i = (j / 2) % 2; i < TILE; i += 2) g.rect(px + i, py + j, 1, 1, 'green');
      }
    }

    const remaining = Math.max(0, this.config.enemyCount - this.destroyed);
    this.drawTopBar(g, { center: this.timeLimit > 0 ? `T ${Math.ceil(this.timeLeft)}` : `EN ${remaining} NV ${this.level}` });

    if (this.stageClear) {
      g.panel(22, 80, 100, 30);
      g.text('ZONA LIMPIA', 72, 88, { align: 'center' });
      g.text(`+${1000 * this.level}`, 72, 98, { align: 'center', color: 'yellow' });
    }
  }

  _drawTank(g, t, rows, color) {
    const sprite = rotate(rows, t.dir);
    const cell = 5;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (sprite[r][c] === '#') g.cell(Math.round(OX + t.x + c * cell), Math.round(OY + t.y + r * cell), cell, color);
      }
    }
  }
}
