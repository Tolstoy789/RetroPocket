// src/games/FlappyPixel.js
// Motor 9 (slots 83-91): vuelo pixel. Un pájaro que solo sabe aletear cruza tuberías,
// cuevas o campos de rocas. Cada obstáculo superado vale un punto.
// Variantes (Catalog99): gravedad, fuerza del aleteo, tamaño del hueco, velocidad,
// tipo de obstáculo (tuberías, cueva, rocas), huecos móviles y techo mortal.
//
// Controles: A o ▲ aletear.

import { BaseCartridge, ACTIONS } from './BaseCartridge.js';

const TOP = 16;
const GROUND = 182;
const BIRD_X = 36;
const BIRD_R = 4;
const GRAVITY = 460;
const FLAP_V = -135;
const MAX_FALL = 220;
const BASE_SPEED = 52;
const PIPE_W = 16;
const PIPE_SPACING = 74;
const CAVE_STEP = 4;
const CAVE_GATE = 64; // cada 64 px de cueva cuentan como un obstáculo
const ROCK_SPACING = 66;
const MAX_STEP = 50; // diferencia máxima de altura entre dos huecos seguidos

const BIRD = [
  ['.###..', '#.#.#.', '######', '.####.', '..#...'],
  ['.###..', '##.#.#', '######', '####..', '..#...']
];
const BIRD_DEAD = ['.###..', '#.#.#.', '##.###', '.####.', '......'];

export default class FlappyPixel extends BaseCartridge {
  reset() {
    this.bird = { y: (TOP + GROUND) / 2, vy: 0, tilt: 0 };
    this.started = false;
    this.dead = 0;
    this.flapAnim = 0;
    this.scroll = 0;
    this.pipes = [];
    this.cave = [];
    this.caveGates = [];
    this.rocks = [];
    this.aiTimer = 0;
    this.caveCenter = (TOP + GROUND) / 2;
    if (this._type() === 'cave') this._fillCave();
  }

  _type() {
    return this.config.obstacle || 'pipes';
  }

  _gap() {
    return Math.max(28, this.config.gap || 48);
  }

  _speed() {
    return BASE_SPEED * (this.config.scrollSpeed || 1) * (1 + Math.min(30, this.score) * 0.008);
  }

  // ---------- Generación de obstáculos ----------

  /** A más velocidad, más separación: el tiempo para cambiar de altura se mantiene. */
  _spacing(base) {
    return Math.round(base * (1 + Math.max(0, (this.config.scrollSpeed || 1) - 1) * 0.5));
  }

  _spawnPipe(x) {
    const gap = this._gap();
    const margin = gap / 2 + 10;
    const prev = this.pipes[this.pipes.length - 1];
    this.pipes.push({ x, base: this._nextCenter(prev ? prev.base : null, margin), phase: this.random(0, Math.PI * 2), passed: false });
  }

  /** Centro del siguiente hueco: nunca a más de MAX_STEP del anterior, para que siempre se pueda llegar. */
  _nextCenter(prev, margin) {
    let lo = TOP + margin;
    let hi = GROUND - margin;
    if (prev !== null) {
      const step = this.config.moving ? MAX_STEP - 14 : MAX_STEP;
      lo = Math.max(lo, prev - step);
      hi = Math.min(hi, prev + step);
    }
    return this.random(lo, hi);
  }

  /** Centro del hueco de una tubería, `ahead` segundos en el futuro (los huecos móviles oscilan). */
  _pipeGapY(p, ahead = 0) {
    if (!this.config.moving) return p.base;
    const gap = this._gap();
    const room = Math.min(p.base - (TOP + gap / 2 + 4), GROUND - gap / 2 - 4 - p.base);
    const amp = Math.max(0, Math.min(14, room + 8));
    const y = p.base + Math.sin((this.time + ahead) * 1.25 + p.phase) * amp;
    return Math.max(TOP + gap / 2 + 4, Math.min(GROUND - gap / 2 - 4, y));
  }

  _fillCave() {
    let x = this.cave.length ? this.cave[this.cave.length - 1].x + CAVE_STEP : 0;
    while (x < this.width + CAVE_STEP * 2) {
      const width = Math.max(this._gap() + 4, this._gap() + 26 - this.score * 0.6);
      // Los primeros píxeles son una entrada recta para dar tiempo al jugador.
      if (x > BIRD_X + 40) {
        const drift = this.config.moving ? 4 : 2.6;
        this.caveCenter += this.random(-drift, drift);
      }
      const half = width / 2;
      this.caveCenter = Math.max(TOP + half + 2, Math.min(GROUND - half - 2, this.caveCenter));
      this.cave.push({ x, top: this.caveCenter - half, bottom: this.caveCenter + half });
      this.caveDist = (this.caveDist || 0) + CAVE_STEP;
      if (this.caveDist >= CAVE_GATE) {
        this.caveDist = 0;
        this.caveGates.push({ x, passed: false });
      }
      x += CAVE_STEP;
    }
  }

  _spawnRocks(x) {
    const gap = this._gap() + 4;
    const prev = this.rocks[this.rocks.length - 1];
    const center = this._nextCenter(prev ? prev.center : null, gap / 2 + 8);
    const rocks = [];
    // Pilas de rocas arriba y abajo del hueco, con algo de desorden.
    let y = center - gap / 2;
    while (y > TOP - 4) {
      const r = this.randInt(6, 9);
      rocks.push({ dx: this.random(-4, 4), y: y - r, r, bob: this.random(0, Math.PI * 2) });
      y -= r * 2 - 2;
    }
    y = center + gap / 2;
    while (y < GROUND + 4) {
      const r = this.randInt(6, 9);
      rocks.push({ dx: this.random(-4, 4), y: y + r, r, bob: this.random(0, Math.PI * 2) });
      y += r * 2 - 2;
    }
    this.rocks.push({ x, center, rocks, passed: false });
  }

  // ---------- Juego ----------

  onInput({ action, pressed }) {
    if (!pressed || this.dead > 0) return;
    if (action !== ACTIONS.A && action !== ACTIONS.UP) return;
    this._flap();
  }

  _flap() {
    if (!this.started) this.started = true;
    this.bird.vy = FLAP_V * (this.config.flap || 1);
    this.flapAnim = 0.15;
    this.sound.sfx('jump');
  }

  _pass() {
    this.addScore(1);
    if (this.score % 10 === 0) {
      this.levelUp();
    } else {
      this.sound.sfx('tick');
    }
  }

  _crash() {
    if (this.dead > 0) return;
    this.dead = 0.9;
    this.bird.vy = Math.min(this.bird.vy, -60);
    this.sound.sfx('explode');
    this.input.vibrate('heavy');
    this.shake(3, 0.3);
    this.flash('red', 0.18, 0.45);
    this.burst(BIRD_X, this.bird.y, { color: 'yellow', count: 16, speed: 45 });
  }

  update(dt) {
    const b = this.bird;
    if (this.flapAnim > 0) this.flapAnim -= dt;

    if (this.dead > 0) {
      this.dead -= dt;
      b.vy = Math.min(MAX_FALL, b.vy + GRAVITY * dt);
      b.y = Math.min(GROUND - BIRD_R, b.y + b.vy * dt);
      if (this.dead <= 0) this.gameOver({ message: 'CHOQUE' });
      return;
    }

    if (!this.started) {
      b.y = (TOP + GROUND) / 2 + Math.sin(this.time * 4) * 4;
      this.scroll += BASE_SPEED * 0.5 * dt;
      return;
    }

    b.vy = Math.min(MAX_FALL, b.vy + GRAVITY * (this.config.gravity || 1) * dt);
    b.y += b.vy * dt;
    if (b.y - BIRD_R < TOP) {
      if (this.config.ceiling !== false) {
        this._crash();
        return;
      }
      b.y = TOP + BIRD_R;
      b.vy = Math.max(0, b.vy);
    }
    if (b.y + BIRD_R >= GROUND) {
      b.y = GROUND - BIRD_R;
      this._crash();
      return;
    }

    const move = this._speed() * dt;
    this.scroll += move;
    const type = this._type();
    if (type === 'pipes') this._updatePipes(move);
    else if (type === 'cave') this._updateCave(move);
    else this._updateRocks(move);
  }

  _updatePipes(move) {
    for (const p of this.pipes) p.x -= move;
    this.pipes = this.pipes.filter((p) => p.x + PIPE_W > -4);
    const last = this.pipes[this.pipes.length - 1];
    if (!last) this._spawnPipe(this.width + 30);
    else if (last.x < this.width - this._spacing(PIPE_SPACING) + PIPE_W) this._spawnPipe(last.x + this._spacing(PIPE_SPACING));

    const half = this._gap() / 2;
    const b = this.bird;
    for (const p of this.pipes) {
      const gy = this._pipeGapY(p);
      if (BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W) {
        if (b.y - BIRD_R + 1 < gy - half || b.y + BIRD_R - 1 > gy + half) {
          this._crash();
          return;
        }
      }
      if (!p.passed && p.x + PIPE_W < BIRD_X - BIRD_R) {
        p.passed = true;
        this._pass();
      }
    }
  }

  _updateCave(move) {
    for (const s of this.cave) s.x -= move;
    for (const gate of this.caveGates) gate.x -= move;
    this.cave = this.cave.filter((s) => s.x + CAVE_STEP > -2);
    this.caveGates = this.caveGates.filter((gate) => gate.x > -8);
    this._fillCave();
    const b = this.bird;
    for (const s of this.cave) {
      if (s.x + CAVE_STEP < BIRD_X - BIRD_R || s.x > BIRD_X + BIRD_R) continue;
      if (b.y - BIRD_R + 1 < s.top || b.y + BIRD_R - 1 > s.bottom) {
        this._crash();
        return;
      }
    }
    for (const gate of this.caveGates) {
      if (!gate.passed && gate.x < BIRD_X) {
        gate.passed = true;
        this._pass();
      }
    }
  }

  _updateRocks(move) {
    for (const col of this.rocks) col.x -= move;
    this.rocks = this.rocks.filter((col) => col.x > -20);
    const last = this.rocks[this.rocks.length - 1];
    if (!last) this._spawnRocks(this.width + 30);
    else if (last.x < this.width - this._spacing(ROCK_SPACING) + 10) this._spawnRocks(last.x + this._spacing(ROCK_SPACING));
    const b = this.bird;
    for (const col of this.rocks) {
      for (const r of col.rocks) {
        const ry = this._rockY(r);
        const dx = col.x + r.dx - BIRD_X;
        const dy = ry - b.y;
        const reach = r.r + BIRD_R - 2;
        if (dx * dx + dy * dy < reach * reach) {
          this._crash();
          return;
        }
      }
      if (!col.passed && col.x + 10 < BIRD_X - BIRD_R) {
        col.passed = true;
        this._pass();
      }
    }
  }

  _rockY(r) {
    return this.config.moving ? r.y + Math.sin(this.time * 2 + r.bob) * 3 : r.y;
  }

  // ---------- IA del modo demo ----------

  /** Hueco libre (arriba y abajo) por el que tiene que pasar el pájaro a continuación. */
  _window() {
    const type = this._type();
    const half = this._gap() / 2;
    if (type === 'pipes') {
      const next = this.pipes.find((p) => p.x + PIPE_W > BIRD_X - BIRD_R - 2);
      if (!next) return null;
      // Mira un poco hacia delante por si el hueco se mueve.
      const now = this._pipeGapY(next);
      const soon = this._pipeGapY(next, 0.15);
      return { top: Math.max(now, soon) - half, bottom: Math.min(now, soon) + half };
    }
    if (type === 'cave') {
      const ahead = this.cave.filter((s) => s.x >= BIRD_X - BIRD_R - 4 && s.x <= BIRD_X + 26);
      if (ahead.length === 0) return null;
      let top = -Infinity;
      let bottom = Infinity;
      for (const s of ahead) {
        top = Math.max(top, s.top);
        bottom = Math.min(bottom, s.bottom);
      }
      return { top, bottom };
    }
    const next = this.rocks.find((col) => col.x + 14 > BIRD_X - BIRD_R);
    if (!next) return null;
    const rockHalf = (this._gap() + 4) / 2;
    return { top: next.center - rockHalf, bottom: next.center + rockHalf };
  }

  autopilot(dt) {
    this._autoHeld = null;
    if (this.dead > 0) return;
    this.aiTimer -= dt;
    if (!this.started) {
      if (this.time > 0.8) this.handleInput({ action: ACTIONS.A, pressed: true, repeat: false });
      return;
    }
    if (this.aiTimer > 0) return;
    const b = this.bird;
    const win = this._window() || { top: (TOP + GROUND) / 2 - 20, bottom: (TOP + GROUND) / 2 + 20 };
    // Aletea lo más tarde posible: justo antes de salirse por abajo del hueco.
    const flapLine = Math.min(GROUND - 8, win.bottom - BIRD_R - 2);
    if (b.y + b.vy * (2 / 60) >= flapLine) {
      this.handleInput({ action: ACTIONS.A, pressed: true, repeat: false });
      this.aiTimer = 0.14;
    }
  }

  // ---------- Dibujo ----------

  draw(g) {
    g.clear();
    const colorful = g.palette.colorful;
    const type = this._type();
    const half = this._gap() / 2;

    if (type === 'pipes') {
      for (const p of this.pipes) {
        const gy = this._pipeGapY(p);
        const x = Math.round(p.x);
        for (let y = gy - half - 8; y > TOP - 8; y -= 8) {
          g.cell(x, Math.round(y), 8, 'green');
          g.cell(x + 8, Math.round(y), 8, 'green');
        }
        for (let y = gy + half; y < GROUND; y += 8) {
          g.cell(x, Math.round(y), 8, 'green');
          g.cell(x + 8, Math.round(y), 8, 'green');
        }
        g.rect(x - 2, Math.round(gy - half) - 2, PIPE_W + 4, 2, 'ink');
        g.rect(x - 2, Math.round(gy + half), PIPE_W + 4, 2, 'ink');
      }
    } else if (type === 'cave') {
      const fill = colorful ? 'blue' : 'mid';
      for (const s of this.cave) {
        const x = Math.round(s.x);
        g.rect(x, TOP, CAVE_STEP, Math.round(s.top) - TOP, fill);
        g.rect(x, Math.round(s.bottom), CAVE_STEP, GROUND - Math.round(s.bottom), fill);
        g.rect(x, Math.round(s.top) - 1, CAVE_STEP, 1, 'ink');
        g.rect(x, Math.round(s.bottom), CAVE_STEP, 1, 'ink');
      }
      for (const gate of this.caveGates) {
        if (gate.passed) continue;
        const s = this.cave.find((seg) => Math.abs(seg.x - gate.x) < CAVE_STEP);
        if (s) for (let y = s.top + 3; y < s.bottom - 2; y += 4) g.px(Math.round(gate.x), Math.round(y), 'ghost');
      }
    } else {
      for (const col of this.rocks) {
        for (const r of col.rocks) {
          const cx = Math.round(col.x + r.dx);
          const cy = Math.round(this._rockY(r));
          g.circle(cx, cy, r.r, colorful ? 'orange' : 'ink');
          g.circle(cx - 2, cy - 2, Math.max(1, Math.floor(r.r / 3)), colorful ? 'yellow' : 'mid');
        }
      }
    }

    // Suelo que se desplaza.
    g.rect(0, GROUND, this.width, 1, 'ink');
    const off = Math.floor(this.scroll) % 8;
    for (let x = -off; x < this.width; x += 8) g.cell(x, GROUND + 2, 8, 'mid');

    const b = this.bird;
    const sprite = this.dead > 0 ? BIRD_DEAD : BIRD[this.flapAnim > 0 || Math.floor(this.time * 6) % 2 === 0 ? 1 : 0];
    g.sprite(sprite, BIRD_X - 6, Math.round(b.y) - 5, { scale: 2, colors: { '#': 'yellow' } });

    if (!this.started) {
      g.text('PULSA A', this.width / 2, 120, { align: 'center' });
      g.text('PARA ALETEAR', this.width / 2, 128, { align: 'center', color: 'mid' });
    }
    g.text(String(this.score), this.width / 2, 24, { align: 'center', scale: 2 });
    this.drawTopBar(g, { lives: false });
  }
}
