// src/games/SpaceShooter.js
// Motor 7 (slots 63-72): naves. Defiende el planeta de la flota alienígena.
// Variantes (Catalog99): formación (invasores que bajan, galaxia con ataques en picada,
// lluvia de meteoros, escuadrones que cruzan), filas, velocidad y cadencia enemiga, escudos,
// disparos simultáneos y nave nodriza al final de cada oleada.
//
// Controles: ◀ ▶ mover la nave, A disparar.

import { BaseCartridge, ACTIONS } from './BaseCartridge.js';

const TOP = 16;
const PLAYER_Y = 176;
const PLAYER_W = 9;
const PLAYER_SPEED = 85;
const SHOT_SPEED = 250;
const ENEMY_SHOT_SPEED = 75;
const COLS = 8;
const ROW_COLORS = ['magenta', 'cyan', 'green', 'yellow', 'orange'];

const SHIP = ['....#....', '...###...', '.#.###.#.', '#########', '###.#.###', '#.......#'];
const INVADER = [
  ['.#...#.', '..###..', '.#####.', '##.#.##', '#######', '.#...#.'],
  ['.#...#.', '#.###.#', '#######', '##.#.##', '.#####.', '#.....#']
];
const BUG = [
  ['...#...', '.#.#.#.', '.#####.', '##.#.##', '.#####.', '#.#.#.#'],
  ['...#...', '#..#..#', '.#####.', '##.#.##', '.#####.', '.#...#.']
];
const BOSS = ['.....#####.....', '...#########...', '..##.##.##.##..', '.#############.', '###.#######.###', '.##..#...#..##.', '..#.........#..'];
const ROCK_BIG = ['..####..', '.######.', '###.####', '########', '####.###', '########', '.######.', '..####..'];
const ROCK_SMALL = ['.###.', '#####', '##.##', '#####', '.###.'];

export default class SpaceShooter extends BaseCartridge {
  reset() {
    this.player = { x: this.width / 2, invuln: 1.5, dead: 0 };
    this.shots = [];
    this.enemyShots = [];
    this.enemies = [];
    this.rocks = [];
    this.shields = [];
    this.boss = null;
    this.waveClear = null;
    this.aiTimer = 0;
    this._startWave();
  }

  // ---------- Oleadas ----------

  _speedFactor() {
    return this.config.enemySpeed * (1 + (this.level - 1) * 0.08);
  }

  _startWave() {
    const c = this.config;
    this.enemies = [];
    this.rocks = [];
    this.boss = null;
    this.enemyShots = [];
    this.fireTimer = 1.5;
    this.diveTimer = 2.5;
    this.marchDir = 1;
    this.marchTimer = 0;
    this.marchVx = 0;
    this.frame = 0;
    this.destroyedInWave = 0;
    this.squadsLeft = 0;
    this.squadTimer = 0;

    if (c.formation === 'asteroids') {
      this.rockTimer = 0.5;
      this.rocksToClear = 20 + this.level * 5;
    } else if (c.formation === 'waves') {
      this.squadsLeft = 5 + this.level;
      this.squadTimer = 0.5;
    } else {
      const rows = Math.max(1, Math.min(5, c.rows));
      const startY = c.formation === 'galaxy' ? 28 : 26 + Math.min(4, this.level - 1) * 4;
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < COLS; col++) {
          const hx = 14 + col * 15;
          const hy = startY + r * 11;
          this.enemies.push({ x: hx, y: hy, hx, hy, w: 7, h: 6, row: r, state: 'formation', t: 0, points: (rows - r) * 10 + 10 });
        }
      }
    }
    if (c.shields && this.shields.length === 0) this._buildShields();
  }

  _buildShields() {
    this.shields = [];
    for (let i = 0; i < 4; i++) {
      const x0 = 14 + i * 34;
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 9; x++) {
          if ((y === 0 && (x === 0 || x === 8)) || (y >= 3 && x >= 3 && x <= 5)) continue;
          this.shields.push({ x: x0 + x * 2, y: 150 + y * 2 });
        }
      }
    }
  }

  _spawnSquad() {
    const fromLeft = this.rng() < 0.5;
    const baseY = 28 + this.rng() * 50;
    const kind = this.rng() < 0.5 ? 0 : 1;
    for (let i = 0; i < 5; i++) {
      this.enemies.push({
        x: fromLeft ? -10 - i * 14 : this.width + 4 + i * 14,
        y: baseY,
        baseY,
        vx: (fromLeft ? 1 : -1) * 48 * this._speedFactor(),
        w: 7,
        h: 6,
        row: kind + 1,
        state: 'squad',
        t: i * 0.4,
        points: 40
      });
    }
  }

  _spawnBoss() {
    this.boss = { x: this.width / 2 - 15, y: 24, w: 30, h: 14, hp: 20 + this.level * 6, maxHp: 20 + this.level * 6, t: 0, fire: 1.2 };
    this.sound.sfx('powerup');
  }

  // ---------- Bucle ----------

  update(dt) {
    if (this.waveClear) {
      this.waveClear.timer += dt;
      if (this.waveClear.timer >= 1.6) {
        this.waveClear = null;
        this.levelUp();
        this._startWave();
      }
      return;
    }

    this._updatePlayer(dt);
    this._updateEnemies(dt);
    this._updateShots(dt);
    if (this.finished) return;
    this._checkWaveEnd();
  }

  _updatePlayer(dt) {
    const p = this.player;
    if (p.dead > 0) {
      p.dead -= dt;
      if (p.dead <= 0) {
        p.invuln = 2;
        p.x = this.width / 2;
      }
      return;
    }
    p.invuln = Math.max(0, p.invuln - dt);
    let dir = 0;
    if (this.isDown(ACTIONS.LEFT)) dir -= 1;
    if (this.isDown(ACTIONS.RIGHT)) dir += 1;
    p.x = Math.max(PLAYER_W / 2 + 2, Math.min(this.width - PLAYER_W / 2 - 2, p.x + dir * PLAYER_SPEED * dt));
  }

  _updateEnemies(dt) {
    const c = this.config;
    const speed = this._speedFactor();
    const alive = this.enemies.filter((e) => !e.dead);

    if (c.formation === 'invaders' || (c.formation !== 'galaxy' && alive.some((e) => e.state === 'formation'))) {
      // Marcha clásica: pasos que se aceleran cuantos menos invasores quedan.
      const total = Math.max(1, Math.min(5, c.rows)) * COLS;
      const interval = Math.max(0.035, (0.55 * (alive.length / total)) / speed);
      this.marchTimer += dt;
      this.marchVx = (3 * this.marchDir) / interval;
      if (this.marchTimer >= interval && alive.length) {
        this.marchTimer = 0;
        this.frame ^= 1;
        const minX = Math.min(...alive.map((e) => e.x));
        const maxX = Math.max(...alive.map((e) => e.x + e.w));
        if ((this.marchDir > 0 && maxX + 3 > this.width - 2) || (this.marchDir < 0 && minX - 3 < 2)) {
          this.marchDir = -this.marchDir;
          for (const e of alive) e.y += 3;
        } else {
          for (const e of alive) e.x += 3 * this.marchDir;
        }
        if (alive.some((e) => e.y + e.h >= 158) && this.player.dead <= 0) {
          this.lives = 1;
          this._hitPlayer('INVASION');
          for (const e of alive) e.y -= 20;
        }
      }
    }

    for (const e of alive) {
      e.t += dt;
      switch (e.state) {
        case 'formation':
          if (c.formation === 'galaxy') {
            // La formación se balancea en lo alto.
            e.x = e.hx + Math.sin(this.time * 0.8 * speed) * 10;
            e.y = e.hy + Math.sin(this.time * 1.6 + e.hx * 0.1) * 1.5;
            this.frame = Math.floor(this.time * 3) % 2;
          }
          break;
        case 'dive': {
          const p = this.player;
          e.vx += Math.sign(p.x - (e.x + e.w / 2)) * 60 * dt;
          e.vx = Math.max(-45, Math.min(45, e.vx));
          e.x += e.vx * dt + Math.sin(e.t * 5) * 0.6;
          e.y += 70 * speed * dt;
          if (!e.shot && e.y > 60 && this.rng() < 0.03 * c.enemyFireRate) {
            e.shot = true;
            this._enemyFire(e.x + e.w / 2, e.y + e.h);
          }
          if (e.y > this.height + 4) {
            if (c.formation === 'waves') e.dead = true;
            else {
              e.y = TOP - 8;
              e.state = 'return';
            }
          }
          break;
        }
        case 'return': {
          const tx = c.formation === 'galaxy' ? e.hx + Math.sin(this.time * 0.8 * speed) * 10 : e.hx;
          e.x += Math.sign(tx - e.x) * Math.min(Math.abs(tx - e.x), 60 * dt);
          e.y += Math.sign(e.hy - e.y) * Math.min(Math.abs(e.hy - e.y), 50 * dt);
          if (Math.abs(e.x - tx) < 1 && Math.abs(e.y - e.hy) < 1) {
            e.state = 'formation';
            e.shot = false;
          }
          break;
        }
        case 'squad':
          e.x += e.vx * dt;
          e.y = e.baseY + Math.sin(e.t * 3) * 14;
          if (c.divers && e.x > 20 && e.x < this.width - 20 && this.rng() < 0.004) {
            e.state = 'dive';
            e.vx = 0;
            e.t = 0;
          }
          if ((e.vx > 0 && e.x > this.width + 80) || (e.vx < 0 && e.x < -80)) e.dead = true;
          break;
        default:
          break;
      }
    }

    // Ataques en picada.
    if (c.divers && c.formation === 'galaxy') {
      this.diveTimer -= dt * speed;
      if (this.diveTimer <= 0) {
        this.diveTimer = 1.6 + this.rng() * 1.6;
        const candidates = alive.filter((e) => e.state === 'formation');
        const count = this.level > 2 ? 2 : 1;
        for (let i = 0; i < count && candidates.length; i++) {
          const e = candidates.splice(Math.floor(this.rng() * candidates.length), 1)[0];
          e.state = 'dive';
          e.vx = 0;
          e.t = 0;
          this.sound.sfx('jump');
        }
      }
    }

    // Disparos enemigos desde la fila más baja de cada columna.
    this.fireTimer -= dt * c.enemyFireRate * (1 + (this.level - 1) * 0.1);
    if (this.fireTimer <= 0) {
      this.fireTimer = 0.9 + this.rng() * 1.0;
      const shooters = alive.filter((e) => e.state !== 'return' && !alive.some((o) => o !== e && Math.abs(o.x - e.x) < 4 && o.y > e.y));
      if (shooters.length) {
        const s = shooters[Math.floor(this.rng() * shooters.length)];
        this._enemyFire(s.x + s.w / 2, s.y + s.h);
      }
    }

    // Meteoros
    if (c.formation === 'asteroids') {
      this.rockTimer -= dt;
      if (this.rockTimer <= 0 && this.rocksToClear > 0) {
        this.rockTimer = Math.max(0.35, 1.1 - this.level * 0.06) / speed;
        const big = this.rng() < 0.45;
        const size = big ? 16 : 10;
        this.rocks.push({ x: 4 + this.rng() * (this.width - 8 - size), y: TOP - size, size, big, vx: (this.rng() - 0.5) * 30, vy: (28 + this.rng() * 22) * speed, hp: big ? 3 : 1 });
      }
      for (const r of this.rocks) {
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        if (r.x < 0 || r.x + r.size > this.width) r.vx = -r.vx;
        if (r.y > this.height) r.gone = true;
        if (!r.gone && this.player.dead <= 0 && this.player.invuln <= 0 && this._overlapPlayer(r.x, r.y, r.size, r.size)) {
          r.gone = true;
          this._hitPlayer('IMPACTO');
        }
      }
      this.rocks = this.rocks.filter((r) => !r.gone);
    }

    // Escuadrones
    if (c.formation === 'waves' && this.squadsLeft > 0) {
      this.squadTimer -= dt;
      if (this.squadTimer <= 0) {
        this.squadTimer = Math.max(1.6, 3.4 - this.level * 0.2);
        this.squadsLeft--;
        this._spawnSquad();
      }
    }

    // Nave nodriza
    if (this.boss) {
      const b = this.boss;
      b.t += dt;
      b.x = this.width / 2 - b.w / 2 + Math.sin(b.t * 0.9 * speed) * 50;
      b.fire -= dt * c.enemyFireRate;
      if (b.fire <= 0) {
        b.fire = 1.3;
        for (const vx of [-30, 0, 30]) this._enemyFire(b.x + b.w / 2, b.y + b.h, vx);
      }
    }

    // Choques directos con la nave.
    if (this.player.dead <= 0 && this.player.invuln <= 0) {
      for (const e of alive) {
        if (!e.dead && this._overlapPlayer(e.x, e.y, e.w, e.h)) {
          e.dead = true;
          this._hitPlayer('COLISION');
          break;
        }
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  _enemyFire(x, y, vx = 0) {
    this.enemyShots.push({ x, y, vx });
  }

  _overlapPlayer(x, y, w, h) {
    const px = this.player.x - PLAYER_W / 2;
    return x < px + PLAYER_W - 1 && x + w > px + 1 && y < PLAYER_Y + 6 && y + h > PLAYER_Y + 1;
  }

  /** Rompe el escudo en (x, y). Los disparos del jugador abren un agujero más grande. */
  _hitShield(x, y, radius = 0) {
    const i = this.shields.findIndex((s) => x >= s.x - 1 && x <= s.x + 2 && y >= s.y - 1 && y <= s.y + 2);
    if (i < 0) return false;
    if (radius <= 0) this.shields.splice(i, 1);
    else this.shields = this.shields.filter((s) => Math.abs(s.x + 1 - x) > radius || Math.abs(s.y + 1 - y) > radius);
    return true;
  }

  _updateShots(dt) {
    for (const s of this.shots) {
      s.y -= SHOT_SPEED * dt;
      if (s.y < TOP) s.done = true;
      if (!s.done && this._hitShield(s.x, s.y, 3)) s.done = true;
      for (const e of this.enemies) {
        if (s.done || e.dead) continue;
        if (s.x >= e.x - 1 && s.x <= e.x + e.w && s.y >= e.y && s.y <= e.y + e.h) {
          s.done = true;
          e.dead = true;
          this.destroyedInWave++;
          const bonus = e.state === 'dive' ? 2 : 1;
          this.addScore(e.points * bonus * this.level);
          this.track('ships');
          this.sound.sfx('hit');
          this.burst(e.x + e.w / 2, e.y + e.h / 2, { color: ROW_COLORS[e.row % ROW_COLORS.length], count: 10, speed: 45 });
        }
      }
      for (const r of this.rocks) {
        if (s.done || r.gone) continue;
        if (s.x >= r.x && s.x <= r.x + r.size && s.y >= r.y && s.y <= r.y + r.size) {
          s.done = true;
          r.hp--;
          if (r.hp > 0) {
            this.sound.sfx('bounce');
            continue;
          }
          r.gone = true;
          this.rocksToClear--;
          this.addScore((r.big ? 30 : 20) * this.level);
          this.sound.sfx('hit');
          this.burst(r.x + r.size / 2, r.y + r.size / 2, { color: 'orange', count: r.big ? 14 : 8, speed: 45 });
          if (r.big) {
            for (const vx of [-25, 25]) this.rocks.push({ x: r.x + 3, y: r.y + 3, size: 10, big: false, vx, vy: r.vy * 0.9, hp: 1 });
          }
        }
      }
      const b = this.boss;
      if (b && !s.done && s.x >= b.x && s.x <= b.x + b.w && s.y >= b.y && s.y <= b.y + b.h) {
        s.done = true;
        b.hp--;
        this.sound.sfx('bounce');
        this.burst(s.x, s.y, { color: 'red', count: 4, speed: 30 });
        if (b.hp <= 0) {
          this.boss = null;
          this.addScore(1000 * this.level);
          this.track('bosses');
          this.sound.sfx('explode');
          this.shake(5, 0.6);
          this.flash('white', 0.3, 0.6);
          this.burst(b.x + b.w / 2, b.y + b.h / 2, { color: 'magenta', count: 40, speed: 90 });
        }
      }
    }
    this.shots = this.shots.filter((s) => !s.done);

    for (const s of this.enemyShots) {
      s.y += ENEMY_SHOT_SPEED * (1 + (this.level - 1) * 0.05) * dt;
      s.x += s.vx * dt;
      if (s.y > this.height) s.done = true;
      if (!s.done && this._hitShield(s.x, s.y)) s.done = true;
      if (!s.done && this.player.dead <= 0 && this.player.invuln <= 0 && this._overlapPlayer(s.x - 1, s.y, 2, 4)) {
        s.done = true;
        this._hitPlayer('DERRIBADO');
      }
    }
    this.enemyShots = this.enemyShots.filter((s) => !s.done);
    this.rocks = this.rocks.filter((r) => !r.gone);
  }

  _hitPlayer(message) {
    const p = this.player;
    if (p.dead > 0 || this.finished) return;
    p.dead = 1.2;
    this.enemyShots = [];
    this.burst(p.x, PLAYER_Y + 3, { color: 'yellow', count: 26, speed: 70 });
    this.sound.sfx('explode');
    this.loseLife(message);
  }

  _checkWaveEnd() {
    const c = this.config;
    if (this.boss) return;
    let done;
    if (c.formation === 'asteroids') done = this.rocksToClear <= 0 && this.rocks.length === 0;
    else if (c.formation === 'waves') done = this.squadsLeft === 0 && this.enemies.length === 0;
    else done = this.enemies.length === 0;
    if (!done) return;
    if (c.boss && !this.bossBeaten) {
      this.bossBeaten = true;
      this._spawnBoss();
      return;
    }
    this.bossBeaten = false;
    this.waveClear = { timer: 0 };
    this.addScore(300 * this.level);
    this.enemyShots = [];
    this.shots = [];
    this.sound.melody('start');
  }

  onInput({ action, pressed }) {
    if (!pressed || this.player.dead > 0 || this.waveClear) return;
    if (action === ACTIONS.A || action === ACTIONS.B || action === ACTIONS.UP) {
      const max = Math.max(1, this.config.playerShots);
      if (this.shots.length >= max) return;
      this.shots.push({ x: this.player.x, y: PLAYER_Y - 2 });
      this.sound.sfx('shoot');
    }
  }

  // ---------- IA del modo demo ----------

  /** Peligro de quedarse en x durante el próximo medio segundo (balas, enemigos en picada y rocas). */
  _danger(x) {
    const shotSpeed = ENEMY_SHOT_SPEED * (1 + (this.level - 1) * 0.05);
    let danger = 0;
    for (const s of this.enemyShots) {
      const t = (PLAYER_Y - s.y) / shotSpeed;
      if (t < -0.05 || t > 0.7) continue;
      if (Math.abs(s.x + s.vx * Math.max(0, t) - x) < PLAYER_W / 2 + 3) danger += 1 + (0.7 - t);
    }
    for (const e of this.enemies) {
      if (e.state !== 'dive' && e.state !== 'squad' && e.y + e.h < 150) continue;
      if (e.y > PLAYER_Y + 8 || e.y + e.h < PLAYER_Y - 50) continue;
      if (Math.abs(e.x + e.w / 2 - x) < e.w / 2 + PLAYER_W / 2 + 4) danger += 2;
    }
    for (const r of this.rocks) {
      if (r.y + r.size < PLAYER_Y - 60 || r.y > PLAYER_Y + 8) continue;
      const t = Math.max(0, (PLAYER_Y - (r.y + r.size)) / Math.max(10, r.vy));
      const rx = r.x + r.vx * t;
      if (x > rx - PLAYER_W / 2 - 4 && x < rx + r.size + PLAYER_W / 2 + 4) danger += 2;
    }
    return danger;
  }

  autopilot(dt) {
    const p = this.player;
    this._autoHeld = null;
    if (p.dead > 0 || this.waveClear) return;
    const targets = [...this.enemies, ...this.rocks.map((r) => ({ x: r.x, y: r.y, w: r.size, h: r.size, vx: r.vx })), ...(this.boss ? [this.boss] : [])].filter((t) => t.y + t.h < PLAYER_Y - 12);
    let tx = this.width / 2;
    if (targets.length) {
      // El objetivo más bajo al que no tapen los escudos.
      const blocked = (t) => this.shields.some((s) => Math.abs(s.x + 1 - (t.x + t.w / 2)) < 3 && s.y > t.y);
      const open = targets.filter((t) => !blocked(t));
      const pool = open.length ? open : targets;
      const t = pool.reduce((a, b) => (b.y > a.y ? b : a));
      // Apunta adonde estará cuando llegue el disparo.
      const lead = (PLAYER_Y - (t.y + t.h)) / SHOT_SPEED;
      const vx = t.vx ?? (t.state === 'formation' && this.config.formation !== 'galaxy' ? this.marchVx || 0 : 0);
      tx = t.x + t.w / 2 + vx * lead;
    }
    // Elige la posición cercana más segura, prefiriendo la que está bajo el objetivo.
    let best = p.x;
    let bestScore = -Infinity;
    for (let x = p.x - 36; x <= p.x + 36; x += 3) {
      if (x < PLAYER_W / 2 + 2 || x > this.width - PLAYER_W / 2 - 2) continue;
      // Para llegar hay que cruzar el camino: se suma el peligro del punto intermedio.
      const danger = this._danger(x) + this._danger((x + p.x) / 2) * 0.5;
      const score = -danger * 100 - Math.abs(x - tx) * 0.6 - Math.abs(x - p.x) * 0.2;
      if (score > bestScore) {
        bestScore = score;
        best = x;
      }
    }
    if (best < p.x - 1.5) this._autoHeld = ACTIONS.LEFT;
    else if (best > p.x + 1.5) this._autoHeld = ACTIONS.RIGHT;
    this.aiTimer -= dt;
    if (this.aiTimer <= 0 && Math.abs(tx - p.x) < 8) {
      this.aiTimer = 0.12;
      this.handleInput({ action: ACTIONS.A, pressed: true, repeat: false });
    }
  }

  // ---------- Dibujo ----------

  draw(g) {
    g.clear();
    // Estrellas de fondo
    for (let i = 0; i < 24; i++) {
      const x = (i * 53) % this.width;
      const y = TOP + ((i * 37 + this.time * (8 + (i % 3) * 6)) % (this.height - TOP));
      g.rect(x, y, 1, 1, 'ghost');
    }

    for (const s of this.shields) g.rect(s.x, s.y, 2, 2, 'green');

    for (const e of this.enemies) {
      const frames = e.row % 2 === 0 ? INVADER : BUG;
      const color = ROW_COLORS[e.row % ROW_COLORS.length];
      g.sprite(frames[this.frame % 2], Math.round(e.x), Math.round(e.y), { colors: { '#': color } });
    }
    for (const r of this.rocks) g.sprite(r.big ? ROCK_BIG : ROCK_SMALL, Math.round(r.x), Math.round(r.y), { scale: 2, colors: { '#': r.hp > 1 ? 'orange' : 'mid' } });
    if (this.boss) {
      const b = this.boss;
      g.sprite(BOSS, Math.round(b.x), b.y, { scale: 2, colors: { '#': 'red' } });
      g.rect(b.x, b.y - 4, b.w, 2, 'ghost');
      g.rect(b.x, b.y - 4, Math.round(b.w * (b.hp / b.maxHp)), 2, 'red');
    }

    for (const s of this.shots) g.rect(s.x - 0.5, s.y, 1, 4, 'yellow');
    for (const s of this.enemyShots) {
      const zig = Math.floor(this.time * 12) % 2;
      g.rect(s.x - 1 + zig, s.y, 1, 2, 'red');
      g.rect(s.x - zig, s.y + 2, 1, 2, 'red');
    }

    const p = this.player;
    if (p.dead <= 0 && (p.invuln <= 0 || Math.floor(this.time * 12) % 2 === 0)) {
      g.sprite(SHIP, Math.round(p.x - PLAYER_W / 2), PLAYER_Y, { colors: { '#': 'cyan' } });
    }
    g.rect(0, this.height - 6, this.width, 1, 'mid');

    this.drawTopBar(g);
    if (this.waveClear) {
      g.panel(22, 80, 100, 30);
      g.text(`OLEADA ${this.level}`, 72, 88, { align: 'center' });
      g.text('SUPERADA', 72, 98, { align: 'center', color: 'yellow' });
    }
  }
}
