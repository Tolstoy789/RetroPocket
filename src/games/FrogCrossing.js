// src/games/FrogCrossing.js
// Motor 8 (slots 73-82): cruce de rana. Lleva cada rana desde la acera hasta un hueco libre
// en la orilla de arriba esquivando coches y saltando sobre troncos y tortugas.
// Variantes (Catalog99): velocidad y densidad del tráfico, fuerza de la corriente, solo
// carretera (el doble de carriles), solo río, tortugas que se sumergen, tiempo por rana,
// número de casas y vidas.
//
// Controles: ▲ ▼ ◀ ▶ saltar una casilla.

import { BaseCartridge, ACTIONS } from './BaseCartridge.js';

const TOP = 16;
const ROW = 12;
const ROWS = 13; // 0 casas · 1-5 zona alta · 6 mediana · 7-11 zona baja · 12 salida
const HOME_ROW = 0;
const MEDIAN_ROW = 6;
const START_ROW = 12;
const RING = 192; // los objetos recorren un anillo de 192 px (48 fuera de pantalla)
const OFF = 48;
const FROG_HALF = 4;
const MIN_X = 6;
const MAX_X = 138;
const TURTLE_CYCLE = 5; // segundos: 3 a flote, 1 hundiéndose, 1 bajo el agua

const FROG = [
  ['#...#', '.###.', '##.##', '.###.', '#...#'],
  ['.#.#.', '#####', '##.##', '#####', '.#.#.']
];
const SPLASH = ['#.#.#', '.#.#.', '#...#', '.#.#.', '#.#.#'];
const FLY = ['#.#', '.#.', '#.#'];
const CAR = ['.####.', '##..##', '######', '##..##', '.#..#.'];
const RACER = ['..###.', '.#####', '######', '.#####', '..#.#.'];
const TRUCK = ['.#########..', '##########.#', '############', '##########.#', '.##.....##..'];
const TURTLE = ['.###.', '#####', '#.#.#', '#####', '#...#'];

// Carriles de carretera y de río (de abajo arriba dentro de cada zona).
const ROAD_LANES = [
  { kind: 'car', speed: 16, count: 3 },
  { kind: 'truck', speed: 12, count: 2 },
  { kind: 'racer', speed: 34, count: 2 },
  { kind: 'car', speed: 22, count: 3 },
  { kind: 'truck', speed: 18, count: 2 }
];
const RIVER_LANES = [
  { kind: 'turtle', size: 3, speed: 18, count: 3 },
  { kind: 'log', w: 24, speed: 15, count: 4 },
  { kind: 'log', w: 48, speed: 24, count: 3 },
  { kind: 'turtle', size: 2, speed: 21, count: 4 },
  { kind: 'log', w: 36, speed: 17, count: 3 }
];
const KIND_W = { car: 12, racer: 12, truck: 24 };

function wrap(x) {
  return ((((x + OFF) % RING) + RING) % RING) - OFF;
}

export default class FrogCrossing extends BaseCartridge {
  reset() {
    // config.timeLimit es el tiempo de cada rana, no de la partida.
    this.frogTime = this.config.timeLimit > 0 ? this.config.timeLimit : 0;
    this.timeLimit = this.config.sessionTime > 0 ? this.config.sessionTime : 0;
    this.homes = this._makeHomes();
    this.fly = null;
    this.flyTimer = 6;
    this.aiTimer = 0;
    this._buildLanes();
    this._newFrog();
  }

  // ---------- Escenario ----------

  _makeHomes() {
    const n = Math.max(1, Math.min(5, this.config.homes || 5));
    const homes = [];
    for (let i = 0; i < n; i++) homes.push({ x: Math.round(((i + 0.5) * this.width) / n), filled: false });
    return homes;
  }

  _zoneType(row) {
    if (row === HOME_ROW || row === MEDIAN_ROW || row === START_ROW) return 'safe';
    const upper = row < MEDIAN_ROW;
    if (upper) return this.config.river === false ? 'road' : 'river';
    return this.config.road === false ? 'river' : 'road';
  }

  _buildLanes() {
    const c = this.config;
    const levelBoost = 1 + (this.level - 1) * 0.12;
    this.lanes = [];
    let roadIdx = 0;
    let riverIdx = 0;
    for (let row = 0; row < ROWS; row++) {
      const type = this._zoneType(row);
      if (type === 'safe') {
        this.lanes[row] = { type, objects: [], v: 0 };
        continue;
      }
      // Los carriles se reparten de abajo arriba; la dirección alterna en cada uno.
      const dir = row % 2 === 0 ? 1 : -1;
      if (type === 'road') {
        const spec = ROAD_LANES[roadIdx++ % ROAD_LANES.length];
        const w = KIND_W[spec.kind];
        const maxCount = Math.floor(RING / (w + 30));
        const count = Math.max(1, Math.min(maxCount, Math.round(spec.count * (c.trafficDensity || 1) + (this.level - 1) * 0.25)));
        const speed = spec.speed * (c.trafficSpeed || 1) * levelBoost * (1 + (roadIdx > 5 ? 0.15 : 0));
        this.lanes[row] = { type, kind: spec.kind, v: speed * dir, objects: this._spread(count, w, 30) };
      } else {
        const spec = RIVER_LANES[riverIdx++ % RIVER_LANES.length];
        const w = spec.kind === 'log' ? spec.w : spec.size * ROW;
        const speed = spec.speed * (c.riverSpeed || 1) * levelBoost;
        const objects = this._spread(spec.count, w, 12);
        if (spec.kind === 'turtle') {
          objects.forEach((o, i) => {
            o.sinks = c.sinkingTurtles !== false && i % 2 === 1;
            o.phase = this.random(0, TURTLE_CYCLE);
          });
        }
        this.lanes[row] = { type, kind: spec.kind, v: speed * -dir, objects };
      }
    }
  }

  /** Reparte `count` objetos de ancho w por el anillo con al menos `minGap` px entre ellos. */
  _spread(count, w, minGap) {
    const spacing = RING / count;
    const slack = Math.max(0, spacing - w - minGap);
    const start = this.random(0, RING);
    const objects = [];
    for (let i = 0; i < count; i++) objects.push({ x: wrap(start + i * spacing + this.random(0, slack)), w });
    return objects;
  }

  _newFrog() {
    this.frog = { x: this.width / 2, row: START_ROW, best: START_ROW, hop: 0, facing: 0 };
    this.frogClock = this.frogTime;
    this.dying = 0;
  }

  // ---------- Consultas (también las usa la IA) ----------

  _submerged(obj, t = 0) {
    if (!obj.sinks) return false;
    const p = (((this.time + t + obj.phase) % TURTLE_CYCLE) + TURTLE_CYCLE) % TURTLE_CYCLE;
    return p >= 4;
  }

  _diving(obj) {
    if (!obj.sinks) return false;
    const p = (this.time + obj.phase) % TURTLE_CYCLE;
    return p >= 3 && p < 4;
  }

  /** Plataforma (tronco o tortugas a flote) bajo x dentro de t segundos. */
  _platformAt(lane, x, t = 0) {
    for (const o of lane.objects) {
      const ox = wrap(o.x + lane.v * t);
      if (x >= ox + 1 && x <= ox + o.w - 1 && !this._submerged(o, t)) return o;
    }
    return null;
  }

  _carAt(lane, x, t = 0) {
    for (const o of lane.objects) {
      const ox = wrap(o.x + lane.v * t);
      if (x + FROG_HALF > ox + 1 && x - FROG_HALF < ox + o.w - 1) return o;
    }
    return null;
  }

  _homeAt(x) {
    return this.homes.find((h) => Math.abs(h.x - x) <= 7) || null;
  }

  // ---------- Juego ----------

  onInput({ action, pressed }) {
    if (!pressed || this.dying > 0) return;
    const f = this.frog;
    let row = f.row;
    let x = f.x;
    if (action === ACTIONS.UP) row -= 1;
    else if (action === ACTIONS.DOWN) row += 1;
    else if (action === ACTIONS.LEFT) x -= ROW;
    else if (action === ACTIONS.RIGHT) x += ROW;
    else return;
    if (row > START_ROW) return;
    f.facing = action;
    f.row = row;
    f.x = Math.max(MIN_X, Math.min(MAX_X, x));
    f.hop = 0.09;
    this.sound.sfx('jump');
    if (row < f.best) {
      f.best = row;
      this.addScore(10);
    }
    if (row === HOME_ROW) this._reachTop();
  }

  _reachTop() {
    const home = this._homeAt(this.frog.x);
    if (!home || home.filled) {
      this._die('ORILLA');
      return;
    }
    home.filled = true;
    let points = 50 + (this.frogTime > 0 ? 10 * Math.ceil(this.frogClock) : 0);
    if (this.fly && this.fly.home === home) {
      points += 200;
      this.fly = null;
      this.sound.sfx('powerup');
    }
    this.addScore(points);
    this.sound.sfx('coin');
    this.input.vibrate('light');
    this.burst(home.x, TOP + ROW / 2, { color: 'green', count: 14, speed: 35 });
    if (this.homes.every((h) => h.filled)) {
      this.addScore(1000);
      this.levelUp();
      this.homes = this._makeHomes();
      this.fly = null;
      this._buildLanes();
    }
    this._newFrog();
  }

  _die(reason) {
    if (this.dying > 0) return;
    this.dying = 1;
    this.deathReason = reason;
    this.sound.sfx(reason === 'AGUA' ? 'drop' : 'hit');
    this.burst(this.frog.x, TOP + this.frog.row * ROW + ROW / 2, { color: reason === 'AGUA' ? 'blue' : 'red', count: 12, speed: 30 });
    this.loseLife(reason === 'TIEMPO' ? 'SIN TIEMPO' : reason === 'AGUA' ? 'AL AGUA' : 'ATROPELLADA');
  }

  update(dt) {
    for (const lane of this.lanes) {
      if (!lane.v) continue;
      for (const o of lane.objects) o.x = wrap(o.x + lane.v * dt);
    }

    // Mosca de bonificación en una casa libre.
    this.flyTimer -= dt;
    if (this.flyTimer <= 0) {
      if (this.fly) {
        this.fly = null;
        this.flyTimer = this.random(5, 9);
      } else {
        const free = this.homes.filter((h) => !h.filled);
        if (free.length > 0) this.fly = { home: this.pick(free) };
        this.flyTimer = 4;
      }
    }

    const f = this.frog;
    if (this.dying > 0) {
      this.dying -= dt;
      if (this.dying <= 0) this._newFrog();
      return;
    }
    if (f.hop > 0) f.hop -= dt;

    if (this.frogTime > 0) {
      const before = Math.ceil(this.frogClock);
      this.frogClock -= dt;
      if (Math.ceil(this.frogClock) !== before && this.frogClock <= 5 && this.frogClock > 0) this.sound.sfx('tick');
      if (this.frogClock <= 0) {
        this._die('TIEMPO');
        return;
      }
    }

    const lane = this.lanes[f.row];
    if (lane.type === 'road') {
      if (this._carAt(lane, f.x)) this._die('COCHE');
    } else if (lane.type === 'river') {
      const platform = this._platformAt(lane, f.x);
      if (!platform) {
        this._die('AGUA');
        return;
      }
      f.x += lane.v * dt;
      if (f.x < 2 || f.x > this.width - 2) this._die('AGUA');
    }
  }

  // ---------- IA del modo demo ----------

  /** ¿Puede la rana quedarse en (row, x) durante `horizon` segundos? */
  _safeFor(row, x, horizon) {
    if (x < MIN_X - 1 || x > MAX_X + 1) return false;
    const lane = this.lanes[row];
    if (row === HOME_ROW) {
      const home = this._homeAt(x);
      return !!home && !home.filled && Math.abs(home.x - x) <= 5;
    }
    if (lane.type === 'safe') return true;
    for (let t = 0; t <= horizon + 0.001; t += 0.08) {
      if (lane.type === 'road') {
        if (this._carAt(lane, x, t)) return false;
      } else {
        const xs = x + lane.v * t;
        if (xs < 4 || xs > this.width - 4) return false;
        if (!this._platformAt(lane, xs, t)) return false;
      }
    }
    return true;
  }

  autopilot(dt) {
    this._autoHeld = null;
    this.aiTimer -= dt;
    if (this.dying > 0 || this.aiTimer > 0) return;
    this.aiTimer = 0.1;
    const f = this.frog;
    const free = this.homes.filter((h) => !h.filled);
    const target = free.reduce((best, h) => (!best || Math.abs(h.x - f.x) < Math.abs(best.x - f.x) ? h : best), null);
    const tx = target ? target.x : this.width / 2;
    const press = (action) => this.handleInput({ action, pressed: true, repeat: false });
    const towards = tx < f.x ? ACTIONS.LEFT : ACTIONS.RIGHT;
    const away = towards === ACTIONS.LEFT ? ACTIONS.RIGHT : ACTIONS.LEFT;
    const sideX = (a) => f.x + (a === ACTIONS.LEFT ? -ROW : ROW);

    if (f.row === 1) {
      if (Math.abs(f.x - tx) <= 5) return press(ACTIONS.UP);
      const step = Math.abs(f.x - tx) >= 9 ? towards : null;
      if (step && this._safeFor(1, sideX(step), 0.3)) return press(step);
      if (this._safeFor(1, f.x, 0.3)) return;
    } else {
      const upHorizon = this.lanes[f.row - 1].type === 'river' ? 0.5 : 0.6;
      if (this._safeFor(f.row - 1, f.x, upHorizon)) return press(ACTIONS.UP);
      const lane = this.lanes[f.row];
      // En zonas seguras se recoloca hacia la casa elegida mientras espera.
      if (lane.type === 'safe' && Math.abs(f.x - tx) >= 12 && this.chance(0.25)) return press(towards);
      if (this._safeFor(f.row, f.x, 0.35)) return;
    }
    for (const a of [towards, away]) {
      if (this._safeFor(f.row, sideX(a), 0.35)) return press(a);
    }
    if (f.row < START_ROW && this._safeFor(f.row + 1, f.x, 0.4)) return press(ACTIONS.DOWN);
    if (f.row > 1 && this._safeFor(f.row - 1, f.x, 0.15)) press(ACTIONS.UP);
  }

  // ---------- Dibujo ----------

  draw(g) {
    g.clear();
    const colorful = g.palette.colorful;

    for (let row = 0; row < ROWS; row++) {
      const y = TOP + row * ROW;
      const lane = this.lanes[row];
      if (row === HOME_ROW) this._drawHomes(g, y);
      else if (lane.type === 'safe') {
        for (let x = 0; x < this.width; x += 6) g.cell(x, y + 3, 6, 'off');
      } else if (lane.type === 'road') {
        if (row > 0 && this.lanes[row - 1].type === 'road') {
          for (let x = 4; x < this.width; x += 16) g.rect(x, y, 8, 1, 'ghost');
        }
        this._drawCars(g, lane, y);
      } else {
        if (colorful) g.rect(0, y, this.width, ROW, 'ghost');
        const shift = Math.floor(this.time * 6) % 12;
        for (let x = -12 + shift; x < this.width; x += 12) {
          g.rect(x, y + 3, 4, 1, colorful ? 'blue' : 'ghost');
          g.rect(x + 6, y + 8, 4, 1, colorful ? 'blue' : 'ghost');
        }
        this._drawRiver(g, lane, y);
      }
    }

    const f = this.frog;
    const fy = TOP + f.row * ROW + 1;
    if (this.dying > 0) {
      if (Math.floor(this.dying * 10) % 2 === 0) g.sprite(SPLASH, Math.round(f.x) - 5, fy, { scale: 2, colors: { '#': this.deathReason === 'AGUA' ? 'blue' : 'red' } });
    } else {
      g.sprite(FROG[f.hop > 0 ? 1 : 0], Math.round(f.x) - 5, fy, { scale: 2, colors: { '#': 'green' } });
    }

    this._drawFooter(g);
    this.drawTopBar(g);
  }

  _drawHomes(g, y) {
    for (let x = 0; x < this.width; x += 6) {
      if (this.homes.some((h) => Math.abs(h.x - (x + 3)) <= 8)) continue;
      g.cell(x, y, 6, 'green');
      g.cell(x, y + 6, 6, 'green');
    }
    for (const h of this.homes) {
      g.frame(h.x - 7, y, 14, ROW, 'mid');
      if (h.filled) g.sprite(FROG[0], h.x - 5, y + 1, { scale: 2, colors: { '#': 'green' } });
      else if (this.fly && this.fly.home === h) g.sprite(FLY, h.x - 3, y + 3, { scale: 2, colors: { '#': 'yellow' } });
    }
  }

  _drawCars(g, lane, y) {
    const sprite = lane.kind === 'truck' ? TRUCK : lane.kind === 'racer' ? RACER : CAR;
    const color = lane.kind === 'truck' ? 'orange' : lane.kind === 'racer' ? 'magenta' : 'red';
    for (const o of lane.objects) {
      if (o.x >= this.width || o.x + o.w <= 0) continue;
      g.sprite(sprite, Math.round(o.x), y + 1, { scale: 2, colors: { '#': color }, flipX: lane.v < 0 });
    }
  }

  _drawRiver(g, lane, y) {
    for (const o of lane.objects) {
      if (o.x >= this.width || o.x + o.w <= 0) continue;
      const x = Math.round(o.x);
      if (lane.kind === 'log') {
        for (let cx = 0; cx < o.w; cx += 6) {
          g.cell(x + cx, y, 6, 'orange');
          g.cell(x + cx, y + 6, 6, 'orange');
        }
        continue;
      }
      if (this._submerged(o)) {
        for (let cx = 0; cx < o.w; cx += ROW) g.frame(x + cx + 3, y + 4, 6, 4, 'ghost');
        continue;
      }
      if (this._diving(o) && Math.floor(this.time * 8) % 2 === 0) {
        for (let cx = 0; cx < o.w; cx += ROW) g.frame(x + cx + 2, y + 3, 8, 6, 'mid');
        continue;
      }
      for (let cx = 0; cx < o.w; cx += ROW) g.sprite(TURTLE, x + cx + 1, y + 1, { scale: 2, colors: { '#': 'cyan' }, flipX: lane.v > 0 });
    }
  }

  _drawFooter(g) {
    const y = TOP + ROWS * ROW + 3;
    if (this.frogTime > 0) {
      const ratio = Math.max(0, this.frogClock) / this.frogTime;
      g.text('TIEMPO', 2, y + 1, { color: 'mid' });
      g.frame(28, y, this.width - 30, 7, 'mid');
      const low = ratio < 0.3;
      if (!low || Math.floor(this.time * 6) % 2 === 0) g.rect(30, y + 2, Math.round((this.width - 34) * ratio), 3, low ? 'red' : 'green');
    } else {
      const filled = this.homes.filter((h) => h.filled).length;
      g.text(`CASAS ${filled}/${this.homes.length}`, 2, y + 1, { color: 'mid' });
    }
  }
}
