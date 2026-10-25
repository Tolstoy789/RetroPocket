// src/games/BrickBreaker.js
// Motor 4 (slots 33-42): rompe-ladrillos. Devuelve la bola con la paleta y limpia el muro.
// Variantes (Catalog99): velocidad de la bola, ancho de paleta, bolas iniciales, forma del muro
// (muro, pirámide, rombo, invasión que baja, aleatorio), golpes por ladrillo y potenciadores.
//
// Controles: ◀ ▶ mover la paleta (▲ la acelera), A lanzar la bola.

import { BaseCartridge, ACTIONS } from './BaseCartridge.js';

const TOP = 16;
const LEFT = 2;
const RIGHT = 142;
const BRICK_W = 16;
const BRICK_H = 8;
const BRICK_COLS = 8;
const BRICK_X = 8;
const BRICK_Y = TOP + 10;
const PADDLE_Y = 178;
const PADDLE_H = 4;
const PADDLE_SPEED = 120;
const BALL = 3;
const BASE_BALL_SPEED = 78;
const MAX_SPEED_FACTOR = 1.7;
const DESCEND_EVERY = 10;
const DANGER_Y = PADDLE_Y - 14;

const HIT_COLORS = ['cyan', 'yellow', 'red'];

/**
 * Power-ups que caen al romper ladrillos.
 * W = paleta ancha, M = multibola, S = bola lenta, + = vida extra.
 */
const POWERS = [
  { id: 'W', weight: 4, color: 'green' },
  { id: 'M', weight: 3, color: 'magenta' },
  { id: 'S', weight: 3, color: 'cyan' },
  { id: '+', weight: 1, color: 'red' }
];

export default class BrickBreaker extends BaseCartridge {
  reset() {
    this.paddle = { x: (LEFT + RIGHT) / 2, w: this.config.paddleWidth, wideTimer: 0 };
    this.slowTimer = 0;
    this.capsules = [];
    this.descendTimer = 0;
    this.offsetY = 0;
    this.speedFactor = 1;
    this.levelClear = null;
    this.dying = null;
    this._buildWall();
    this._serve(this.config.balls);
  }

  // ---------- Muro ----------

  _buildWall() {
    const layout = this.config.layout;
    const hits = Math.max(1, Math.min(3, this.config.brickHits));
    const rows = layout === 'descending' ? 5 : 7;
    this.bricks = [];
    this.offsetY = 0;
    const add = (col, row, h = hits) => {
      this.bricks.push({ col, row, hits: h, maxHits: h });
    };
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        const mid = (BRICK_COLS - 1) / 2;
        switch (layout) {
          case 'pyramid':
            if (Math.abs(col - mid) <= row * 0.5 + 0.5) add(col, row);
            break;
          case 'diamond': {
            const r = Math.abs(row - (rows - 1) / 2);
            if (Math.abs(col - mid) + r <= 3.6) add(col, row);
            break;
          }
          case 'random':
            if (this.rng() < 0.55 + Math.min(0.3, this.level * 0.03)) add(col, row, 1 + Math.floor(this.rng() * hits));
            break;
          default:
            // 'wall' y 'descending': muro completo; las filas de arriba aguantan más en niveles altos.
            add(col, row, Math.min(3, hits + (this.level > 2 && row < 2 ? 1 : 0)));
            break;
        }
      }
    }
    if (this.bricks.length === 0) add(3, 0);
  }

  _brickRect(b) {
    return { x: BRICK_X + b.col * BRICK_W, y: BRICK_Y + b.row * BRICK_H + this.offsetY, w: BRICK_W, h: BRICK_H };
  }

  // ---------- Bolas ----------

  _serve(count = 1) {
    this.balls = [];
    for (let i = 0; i < Math.max(1, count); i++) {
      this.balls.push({ x: this.paddle.x, y: PADDLE_Y - BALL - 1, vx: 0, vy: 0, stuck: true, offset: (i - (count - 1) / 2) * 5 });
    }
  }

  _ballSpeed() {
    const slow = this.slowTimer > 0 ? 0.65 : 1;
    return BASE_BALL_SPEED * this.config.speed * this.speedFactor * (1 + (this.level - 1) * 0.06) * slow;
  }

  _launch() {
    let launched = false;
    for (const b of this.balls) {
      if (!b.stuck) continue;
      b.stuck = false;
      const angle = -Math.PI / 2 + (b.offset || 0) * 0.08 + (this.rng() - 0.5) * 0.5;
      const s = this._ballSpeed();
      b.vx = Math.cos(angle) * s;
      b.vy = Math.sin(angle) * s;
      launched = true;
    }
    if (launched) this.sound.sfx('shoot');
  }

  /** Mantiene la velocidad de cada bola acorde a la actual (aceleración, lentitud). */
  _normalize(b) {
    const s = this._ballSpeed();
    const len = Math.hypot(b.vx, b.vy) || 1;
    b.vx = (b.vx / len) * s;
    b.vy = (b.vy / len) * s;
    // Evita trayectorias casi horizontales que eternizan la partida.
    if (Math.abs(b.vy) < s * 0.25) {
      b.vy = Math.sign(b.vy || -1) * s * 0.25;
      b.vx = Math.sign(b.vx || 1) * Math.sqrt(s * s - b.vy * b.vy);
    }
  }

  // ---------- Bucle ----------

  update(dt) {
    if (this.dying) {
      this.dying.timer += dt;
      if (this.dying.timer >= 0.9) {
        this.dying = null;
        if (this.lives > 0) this._serve(1);
      }
      return;
    }
    if (this.levelClear) {
      this.levelClear.timer += dt;
      if (this.levelClear.timer >= 1.4) {
        this.levelClear = null;
        this.levelUp();
        this.speedFactor = 1;
        this.capsules = [];
        this._buildWall();
        this._serve(this.config.balls);
      }
      return;
    }

    // Paleta
    const turbo = this.isDown(ACTIONS.UP) ? 1.6 : 1;
    let dir = 0;
    if (this.isDown(ACTIONS.LEFT)) dir -= 1;
    if (this.isDown(ACTIONS.RIGHT)) dir += 1;
    const p = this.paddle;
    if (p.wideTimer > 0) {
      p.wideTimer -= dt;
      if (p.wideTimer <= 0) p.w = this.config.paddleWidth;
    }
    p.x = Math.max(LEFT + p.w / 2, Math.min(RIGHT - p.w / 2, p.x + dir * PADDLE_SPEED * turbo * dt));
    if (this.slowTimer > 0) this.slowTimer -= dt;

    // Invasión: el muro baja poco a poco.
    if (this.config.layout === 'descending') {
      this.descendTimer += dt;
      if (this.descendTimer >= Math.max(4, DESCEND_EVERY - this.level)) {
        this.descendTimer = 0;
        this.offsetY += 4;
        this.sound.sfx('tick');
        const lowest = Math.max(...this.bricks.map((b) => this._brickRect(b).y + BRICK_H));
        if (lowest >= DANGER_Y) {
          this.lives = 1;
          this._loseBall('INVADIDO');
          return;
        }
      }
    }

    // Bolas (con sub-pasos para no atravesar ladrillos).
    for (const b of this.balls) {
      if (b.stuck) {
        b.x = p.x + (b.offset || 0);
        b.y = PADDLE_Y - BALL - 1;
        continue;
      }
      this._normalize(b);
      const steps = 3;
      for (let i = 0; i < steps && !b.lost; i++) this._moveBall(b, dt / steps);
    }
    const before = this.balls.length;
    this.balls = this.balls.filter((b) => !b.lost);
    if (before > 0 && this.balls.length === 0) {
      this._loseBall('SIN BOLAS');
      return;
    }

    // Cápsulas
    for (const c of this.capsules) {
      c.y += 34 * dt;
      if (c.y + 5 >= PADDLE_Y && c.y <= PADDLE_Y + PADDLE_H && Math.abs(c.x - p.x) <= p.w / 2 + 4) {
        c.taken = true;
        this._applyPower(c.id);
      }
    }
    this.capsules = this.capsules.filter((c) => !c.taken && c.y < this.height);

    if (this.bricks.length === 0) this._startLevelClear();
  }

  _moveBall(b, dt) {
    // Eje X
    b.x += b.vx * dt;
    if (b.x < LEFT) {
      b.x = LEFT;
      b.vx = Math.abs(b.vx);
      this.sound.sfx('bounce');
    } else if (b.x + BALL > RIGHT) {
      b.x = RIGHT - BALL;
      b.vx = -Math.abs(b.vx);
      this.sound.sfx('bounce');
    }
    const hitX = this._hitBrick(b);
    if (hitX) {
      b.x -= b.vx * dt;
      b.vx = -b.vx;
    }

    // Eje Y
    b.y += b.vy * dt;
    if (b.y < TOP) {
      b.y = TOP;
      b.vy = Math.abs(b.vy);
      this.sound.sfx('bounce');
    }
    const hitY = this._hitBrick(b);
    if (hitY) {
      b.y -= b.vy * dt;
      b.vy = -b.vy;
    }

    // Paleta: el ángulo depende de dónde golpea la bola.
    const p = this.paddle;
    if (b.vy > 0 && b.y + BALL >= PADDLE_Y && b.y + BALL <= PADDLE_Y + PADDLE_H + 2) {
      const center = b.x + BALL / 2;
      if (center >= p.x - p.w / 2 - 1 && center <= p.x + p.w / 2 + 1) {
        const rel = Math.max(-1, Math.min(1, (center - p.x) / (p.w / 2)));
        const angle = -Math.PI / 2 + rel * 1.05;
        if (this.config.ballSpeedUp) this.speedFactor = Math.min(MAX_SPEED_FACTOR, this.speedFactor * 1.015);
        const s = this._ballSpeed();
        b.vx = Math.cos(angle) * s;
        b.vy = Math.sin(angle) * s;
        b.y = PADDLE_Y - BALL - 1;
        this.sound.sfx('bounce');
        this.input.vibrate('light');
      }
    }
    if (b.y > this.height) b.lost = true;
  }

  _hitBrick(b) {
    for (let i = 0; i < this.bricks.length; i++) {
      const brick = this.bricks[i];
      const r = this._brickRect(brick);
      if (b.x + BALL <= r.x || b.x >= r.x + r.w || b.y + BALL <= r.y || b.y >= r.y + r.h) continue;
      brick.hits--;
      if (brick.hits <= 0) {
        this.bricks.splice(i, 1);
        this.addScore(25 * brick.maxHits * this.level);
        this.track('bricks');
        this.sound.sfx('hit');
        this.burst(r.x + r.w / 2, r.y + r.h / 2, { color: HIT_COLORS[brick.maxHits - 1], count: 8, speed: 45 });
        this._maybeDropPower(r.x + r.w / 2, r.y + r.h);
      } else {
        this.addScore(5 * this.level);
        this.sound.sfx('bounce');
        this.shake(1, 0.06);
      }
      return true;
    }
    return false;
  }

  _maybeDropPower(x, y) {
    if (!this.config.powerUps || this.rng() > 0.16) return;
    const total = POWERS.reduce((a, p) => a + p.weight, 0);
    let roll = this.rng() * total;
    const power = POWERS.find((p) => (roll -= p.weight) < 0) || POWERS[0];
    this.capsules.push({ x, y, id: power.id, color: power.color });
  }

  _applyPower(id) {
    this.sound.sfx('powerup');
    this.input.vibrate('medium');
    this.addScore(50);
    switch (id) {
      case 'W':
        this.paddle.w = Math.min(48, this.config.paddleWidth * 1.6);
        this.paddle.wideTimer = 12;
        break;
      case 'M': {
        const source = this.balls.find((b) => !b.stuck) || this.balls[0];
        if (!source) break;
        for (const spin of [-0.5, 0.5]) {
          const angle = Math.atan2(source.vy || -1, source.vx) + spin;
          const s = this._ballSpeed();
          this.balls.push({ x: source.x, y: source.y, vx: Math.cos(angle) * s, vy: Math.sin(angle) * s, stuck: false });
        }
        break;
      }
      case 'S':
        this.slowTimer = 9;
        break;
      case '+':
        this.lives = Math.min(5, this.lives + 1);
        break;
      default:
        break;
    }
  }

  _loseBall(message) {
    this.capsules = [];
    this.paddle.w = this.config.paddleWidth;
    this.paddle.wideTimer = 0;
    this.slowTimer = 0;
    this.speedFactor = 1;
    this.balls = [];
    this.sound.sfx('explode');
    const left = this.loseLife(message);
    if (left > 0) this.dying = { timer: 0 };
  }

  _startLevelClear() {
    this.levelClear = { timer: 0 };
    this.addScore(500 * this.level);
    this.track('walls');
    this.sound.melody('start');
    this.flash('white', 0.3, 0.5);
    this.balls = [];
  }

  onInput({ action, pressed }) {
    if (!pressed) return;
    if (action === ACTIONS.A || action === ACTIONS.B) this._launch();
  }

  // ---------- IA del modo demo ----------

  autopilot(dt) {
    const p = this.paddle;
    if (this.balls.some((b) => b.stuck)) {
      this._autoTimer -= dt;
      if (this._autoTimer <= 0) {
        this._autoTimer = 0.6;
        this._launch();
      }
    }
    const falling = this.balls.filter((b) => !b.stuck && b.vy > 0);
    const target = falling.length
      ? falling.reduce((a, b) => (b.y > a.y ? b : a))
      : this.capsules[0] || this.balls[0] || { x: p.x };
    // Golpea un poco descentrado para dirigir la bola hacia el muro.
    const aim = target.x + BALL / 2 + (target === falling[0] ? Math.sin(this.time) * p.w * 0.25 : 0);
    let want = null;
    if (aim < p.x - 3) want = ACTIONS.LEFT;
    else if (aim > p.x + 3) want = ACTIONS.RIGHT;
    this._autoHeld = want;
  }

  // ---------- Dibujo ----------

  draw(g) {
    g.clear();
    g.text(String(this.score).padStart(6, '0'), 2, 2);
    g.text(`R ${String(Math.max(this.highScore, this.score)).padStart(6, '0')}`, 2, 8, { color: 'mid' });
    g.text(this.timeLimit > 0 ? `T ${Math.ceil(this.timeLeft)}` : `NV ${this.level}`, 72, 2, { align: 'center' });
    g.text('♥'.repeat(Math.max(0, Math.min(5, this.lives))), RIGHT, 2, { align: 'right', color: 'red' });
    g.text(`${this.slot.daily ? 'HOY' : this.slot.code} ${this.slot.label}`, RIGHT, 8, { align: 'right', color: 'mid' });
    g.rect(0, TOP - 2, this.width, 1, 'mid');
    g.rect(0, TOP - 1, LEFT, this.height, 'mid');
    g.rect(RIGHT, TOP - 1, this.width - RIGHT, this.height, 'mid');

    if (this.config.layout === 'descending') g.rect(LEFT, DANGER_Y, RIGHT - LEFT, 1, 'ghost');

    for (const b of this.bricks) {
      const r = this._brickRect(b);
      const color = HIT_COLORS[Math.max(0, b.hits - 1)];
      g.cell(r.x, r.y, BRICK_H, color);
      g.cell(r.x + BRICK_H, r.y, BRICK_H, color);
      // Ladrillos dañados: una grieta en el centro.
      if (b.hits < b.maxHits) g.rect(r.x + 7, r.y + 2, 1, 4, 'bg');
      if (b.hits > 1) g.rect(r.x + 3, r.y + 3, 2, 1, 'bg');
    }

    for (const c of this.capsules) {
      g.rect(c.x - 4, c.y, 9, 7, c.color);
      g.text(c.id, c.x - 1, c.y + 1, { color: 'bg' });
    }

    const p = this.paddle;
    const blink = this.dying && Math.floor(this.dying.timer * 10) % 2 === 1;
    if (!blink) {
      g.rect(p.x - p.w / 2, PADDLE_Y, p.w, PADDLE_H, p.wideTimer > 0 ? 'green' : 'ink');
      g.rect(p.x - p.w / 2 + 1, PADDLE_Y + 1, p.w - 2, 1, 'bg');
    }

    for (const b of this.balls) g.rect(b.x, b.y, BALL, BALL, this.slowTimer > 0 ? 'cyan' : 'white');

    if (this.balls.some((b) => b.stuck) && Math.floor(this.time * 2.5) % 2 === 0) {
      g.text('A: LANZAR', 72, 150, { align: 'center', color: 'mid' });
    }
    if (this.levelClear) {
      g.panel(22, 80, 100, 30);
      g.text('MURO ROTO', 72, 88, { align: 'center' });
      g.text(`+${500 * this.level}`, 72, 98, { align: 'center', color: 'yellow' });
    }
  }
}
