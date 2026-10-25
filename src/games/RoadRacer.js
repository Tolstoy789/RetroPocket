// src/games/RoadRacer.js
// Motor 5 (slots 43-52): carreras en carriles. Cambia de carril para esquivar el tráfico.
// Variantes (Catalog99): velocidad inicial, 3 o 5 carriles, densidad de tráfico, aceleración,
// gasolina, noche (solo ves lo que alumbran los faros), coches en contramano y disparo.
//
// Controles: ◀ ▶ cambiar de carril, ▲ acelerar, ▼ frenar, A disparar (variante ARMADO).

import { BaseCartridge, ACTIONS } from './BaseCartridge.js';

const TOP = 16;
const ROAD_X = 14;
const ROAD_W = 116;
const CELL = 5;
const CAR_W = CELL * 3;
const CAR_H = CELL * 4;
const PLAYER_Y = 160;
const MAX_SPEED = 170;
const FUEL_BURN = 3.6;

/** Coche clásico de Brick Game: 3x4 celdas. */
const CAR = ['.#.', '###', '.#.', '#.#'];
const CAR_ONCOMING = ['#.#', '.#.', '###', '.#.'];
const FUEL_CAN = ['.##.', '####', '#..#', '####'];

export default class RoadRacer extends BaseCartridge {
  reset() {
    const c = this.config;
    this.lanes = c.lanes >= 5 ? 5 : 3;
    this.laneW = ROAD_W / this.lanes;
    this.lane = Math.floor(this.lanes / 2);
    this.px = this._laneX(this.lane);
    this.speed = 62 * c.speed;
    this.minSpeed = this.speed;
    this.distance = 0;
    this.extra = 0;
    this.scroll = 0;
    this.cars = [];
    this.cans = [];
    this.bullets = [];
    this.rowGap = 40;
    this.oncomingTimer = 2;
    this.canTimer = 6;
    this.fuel = 100;
    this.shotCooldown = 0;
    this.crash = null;
    this.nextLevelAt = 1500;
    this.aiTimer = 0;
    this.topKmh = 0;
  }

  _laneX(lane) {
    return ROAD_X + lane * this.laneW + (this.laneW - CAR_W) / 2;
  }

  _laneOf(x) {
    return Math.max(0, Math.min(this.lanes - 1, Math.round((x - ROAD_X - (this.laneW - CAR_W) / 2) / this.laneW)));
  }

  // ---------- Tráfico ----------

  /** Densidad efectiva del tráfico (sube un poco con cada nivel). */
  _density() {
    return this.config.traffic * (1 + (this.level - 1) * 0.08);
  }

  /**
   * El tráfico llega en filas, como en las consolas de ladrillos: cada fila deja al menos un
   * carril libre y entre dos filas siempre hay hueco para cambiar de carril. En las variantes
   * con contramano, el carril de la izquierda es el de los coches que vienen de frente.
   */
  _spawnRow() {
    const first = this.config.oncoming ? 1 : 0;
    const lanes = [];
    for (let l = first; l < this.lanes; l++) lanes.push(l);
    for (let i = lanes.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
    }
    const maxBlocked = Math.max(1, lanes.length - 1);
    let blocked = 1;
    const extra = Math.min(0.8, 0.3 * this._density());
    while (blocked < maxBlocked && this.rng() < extra) blocked++;
    for (let i = 0; i < blocked; i++) this._addCar(lanes[i], false, -CAR_H - this.rng() * 6);
  }

  _addCar(lane, oncoming, y) {
    this.cars.push({
      lane,
      x: this._laneX(lane),
      y,
      // Velocidad relativa respecto al jugador (los de contramano se acercan más rápido).
      rel: oncoming ? 1.35 : 0.5,
      oncoming,
      color: oncoming ? 'red' : this.pick(['cyan', 'magenta', 'orange', 'blue'])
    });
  }

  /** Distancia (en píxeles de pantalla) hasta la siguiente fila de tráfico. */
  _rowSpacing() {
    return Math.max(62, 120 / this._density()) + this.rng() * 24;
  }

  // ---------- Bucle ----------

  update(dt) {
    if (this.crash) {
      this.crash.timer += dt;
      if (this.crash.timer >= 1.3) this.gameOver({ message: this.crash.message });
      return;
    }
    const c = this.config;

    // Velocidad: acelera sola con la distancia; ▲ empuja y ▼ frena.
    if (c.accelerate) this.minSpeed = Math.min(MAX_SPEED * c.speed, this.minSpeed + dt * 1.6);
    let target = this.minSpeed;
    if (this.isDown(ACTIONS.UP)) target = Math.min(MAX_SPEED * c.speed * 1.15, this.minSpeed * 1.45);
    if (this.isDown(ACTIONS.DOWN)) target = this.minSpeed * 0.6;
    if (c.fuel && this.fuel <= 0) target = 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 3);
    const kmh = Math.round(this.speed);
    if (kmh > this.topKmh) {
      this.topKmh = kmh;
      this.peak('kmh', kmh);
    }

    const move = this.speed * dt;
    this.distance += move;
    this.scroll = (this.scroll + move) % (CELL * 4);
    const total = Math.floor(this.distance / 8) + this.extra;
    if (total > this.score) this.addScore(total - this.score);

    if (this.distance >= this.nextLevelAt) {
      this.nextLevelAt += 1500;
      this.levelUp();
    }

    // Cambio de carril suave.
    const tx = this._laneX(this.lane);
    this.px += (tx - this.px) * Math.min(1, dt * 18);

    // Gasolina
    if (c.fuel) {
      this.fuel = Math.max(0, this.fuel - FUEL_BURN * dt);
      if (this.fuel <= 0 && this.speed < 4) {
        this._crash('SIN GASOLINA', false);
        return;
      }
      this.canTimer -= dt;
      if (this.canTimer <= 0) {
        this.canTimer = 5 + this.rng() * 4;
        const busy = new Set(this.cars.filter((car) => car.y < 40).map((car) => car.lane));
        const options = [];
        for (let l = 0; l < this.lanes; l++) if (!busy.has(l)) options.push(l);
        const lane = options.length ? options[Math.floor(this.rng() * options.length)] : Math.floor(this.rng() * this.lanes);
        this.cans.push({ lane, x: this._laneX(lane) + 1, y: -20 });
      }
    }

    // Las filas bajan a la mitad de la velocidad del jugador.
    this.rowGap -= move * 0.5;
    if (this.rowGap <= 0) {
      this.rowGap += this._rowSpacing();
      this._spawnRow();
    }
    if (c.oncoming) {
      this.oncomingTimer -= dt;
      if (this.oncomingTimer <= 0 && !this.cars.some((car) => car.lane === 0 && car.y < 70)) {
        this.oncomingTimer = (1.3 + this.rng() * 1.6) / this._density();
        this._addCar(0, true, -CAR_H);
      }
    }

    for (const car of this.cars) car.y += this.speed * car.rel * dt;
    const overtaken = this.cars.filter((car) => car.y >= this.height + 4 && !car.dead && !car.oncoming).length;
    if (overtaken) this.track('overtakes', overtaken);
    this.cars = this.cars.filter((car) => car.y < this.height + 4 && !car.dead);
    for (const can of this.cans) can.y += this.speed * dt;
    this.cans = this.cans.filter((can) => can.y < this.height && !can.taken);

    // Disparos
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    for (const b of this.bullets) {
      b.y -= 220 * dt;
      for (const car of this.cars) {
        if (!car.dead && b.x >= car.x && b.x <= car.x + CAR_W && b.y >= car.y && b.y <= car.y + CAR_H) {
          car.dead = true;
          b.used = true;
          this.extra += 50;
          this.sound.sfx('hit');
          this.burst(car.x + CAR_W / 2, car.y + CAR_H / 2, { color: car.color, count: 12, speed: 50 });
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.used && b.y > TOP);

    // Colisiones
    const hit = (o, w, h) => o.x < this.px + CAR_W - 1 && o.x + w > this.px + 1 && o.y < PLAYER_Y + CAR_H - 1 && o.y + h > PLAYER_Y + 1;
    for (const can of this.cans) {
      if (hit(can, 13, 13)) {
        can.taken = true;
        this.fuel = Math.min(100, this.fuel + 45);
        this.extra += 20;
        this.sound.sfx('powerup');
        this.input.vibrate('light');
      }
    }
    for (const car of this.cars) {
      if (!car.dead && hit(car, CAR_W, CAR_H)) {
        this._crash('CHOQUE', true);
        return;
      }
    }
  }

  _crash(message, explode) {
    this.crash = { timer: 0, message };
    if (explode) {
      this.sound.sfx('explode');
      this.shake(4, 0.4);
      this.flash('red', 0.25, 0.5);
      this.burst(this.px + CAR_W / 2, PLAYER_Y + CAR_H / 2, { color: 'orange', count: 30, speed: 80 });
    } else {
      this.sound.sfx('error');
    }
    this.input.vibrate('heavy');
  }

  onInput({ action, pressed }) {
    if (!pressed || this.crash) return;
    if (action === ACTIONS.LEFT && this.lane > 0) {
      this.lane--;
      this.sound.sfx('move');
    } else if (action === ACTIONS.RIGHT && this.lane < this.lanes - 1) {
      this.lane++;
      this.sound.sfx('move');
    } else if (action === ACTIONS.A && this.config.shooting && this.shotCooldown <= 0) {
      this.shotCooldown = 0.3;
      this.bullets.push({ x: this.px + CAR_W / 2, y: PLAYER_Y - 2 });
      this.sound.sfx('shoot');
    }
  }

  // ---------- IA del modo demo ----------

  /** ¿Está libre la fila del jugador en ese carril dentro de t segundos? */
  _laneSafeAt(lane, t) {
    for (const car of this.cars) {
      if (car.dead || car.lane !== lane) continue;
      const y = car.y + this.speed * car.rel * t;
      if (y < PLAYER_Y + CAR_H + 3 && y + CAR_H > PLAYER_Y - 3) return false;
    }
    return true;
  }

  autopilot(dt) {
    this.aiTimer -= dt;
    this._autoHeld = null;
    if (this.crash || this.aiTimer > 0) return;
    this.aiTimer = 0.08;
    // Planificación por pasos de 0,15 s: qué carriles se pueden alcanzar sin chocar en los
    // próximos segundos (hasta ver los coches recién aparecidos). Se elige el primer movimiento
    // de un camino que sobreviva.
    const STEP = 0.15;
    const STEPS = Math.min(26, Math.ceil((PLAYER_Y + CAR_H) / Math.max(20, this.speed * 0.5) / STEP));
    const current = this.lane;
    let frontier = new Map([[current, 0]]); // carril → primer movimiento que lleva ahí
    let survivors = frontier; // si ningún camino llega al final, vale el que aguanta más
    const layers = [];
    for (let k = 0; k < STEPS && frontier.size; k++) {
      const next = new Map();
      for (const [lane, first] of frontier) {
        for (const d of [0, -1, 1]) {
          const to = lane + d;
          if (to < 0 || to >= this.lanes || next.has(to)) continue;
          let ok = true;
          for (let s = 0; s <= 3 && ok; s++) {
            const t = (k + s / 3) * STEP;
            if (!this._laneSafeAt(to, t) || (d !== 0 && !this._laneSafeAt(lane, t))) ok = false;
          }
          if (ok) next.set(to, k === 0 ? d : first);
        }
      }
      frontier = next;
      layers.push(frontier);
      if (frontier.size) survivors = frontier;
    }
    // Con poca gasolina, ir a por el bidón más cercano si se puede llegar a tiempo sin chocar.
    if (this.config.fuel && this.fuel < 85) {
      for (const can of this.cans) {
        if (can.taken || can.y > PLAYER_Y) continue;
        const k = Math.round((PLAYER_Y - can.y) / Math.max(20, this.speed) / STEP) - 1;
        const layer = layers[Math.max(0, Math.min(layers.length - 1, k))];
        if (layer && k < layers.length && layer.has(can.lane)) {
          const first = layer.get(can.lane);
          if (first < 0) this.handleInput({ action: ACTIONS.LEFT, pressed: true, repeat: false });
          else if (first > 0) this.handleInput({ action: ACTIONS.RIGHT, pressed: true, repeat: false });
          return;
        }
      }
    }
    let move = 0;
    frontier = survivors;
    if (frontier.size) {
      // Entre los carriles que sobreviven, el más cercano (o el de la gasolina si hace falta).
      let best = null;
      let bestScore = -Infinity;
      for (const [lane, first] of frontier) {
        let score = -Math.abs(lane - current) * 2 - (first !== 0 ? 1 : 0);
        if (score > bestScore) {
          bestScore = score;
          best = first;
        }
      }
      move = best;
    } else {
      // Sin salida limpia: al menos aparta el coche hacia el lado con más hueco.
      move = this._laneSafeAt(current - 1, 0.1) && current > 0 ? -1 : this._laneSafeAt(current + 1, 0.1) && current < this.lanes - 1 ? 1 : 0;
    }
    if (move < 0) this.handleInput({ action: ACTIONS.LEFT, pressed: true, repeat: false });
    else if (move > 0) this.handleInput({ action: ACTIONS.RIGHT, pressed: true, repeat: false });
    if (this.config.shooting && this.cars.some((car) => !car.dead && car.lane === this.lane && car.y < PLAYER_Y && car.y > PLAYER_Y - 90)) {
      this.handleInput({ action: ACTIONS.A, pressed: true, repeat: false });
    }
  }

  // ---------- Dibujo ----------

  draw(g) {
    g.clear();
    // Bordes de la carretera: columnas de celdas que se desplazan, como en las consolas de ladrillos.
    const offset = Math.floor(this.scroll);
    for (let y = TOP - CELL * 4 + offset; y < this.height; y += CELL * 4) {
      for (let i = 0; i < 3; i++) {
        g.cell(ROAD_X - CELL - 3, y + i * CELL, CELL, 'mid');
        g.cell(ROAD_X + ROAD_W + 3, y + i * CELL, CELL, 'mid');
      }
    }
    for (let l = 1; l < this.lanes; l++) {
      const x = Math.round(ROAD_X + l * this.laneW);
      for (let y = TOP - 16 + (offset % 16); y < this.height; y += 16) g.rect(x, y, 1, 8, 'ghost');
    }

    for (const can of this.cans) g.sprite(FUEL_CAN, can.x, can.y, { scale: 3, colors: { '#': 'green' } });
    for (const car of this.cars) {
      if (car.dead) continue;
      this._drawCar(g, car.x, car.y, car.oncoming ? CAR_ONCOMING : CAR, car.color);
    }
    for (const b of this.bullets) g.rect(b.x - 1, b.y, 2, 4, 'yellow');

    if (this.config.night && !this.crash) this._drawNight(g);

    const blink = this.crash && Math.floor(this.crash.timer * 10) % 2 === 1;
    if (!blink) this._drawCar(g, this.px, PLAYER_Y, CAR, this.crash ? 'red' : 'ink');

    this.drawTopBar(g, { lives: false, center: this.timeLimit > 0 ? `T ${Math.ceil(this.timeLeft)}` : `${Math.round(this.speed)} KM/H` });
    if (this.config.fuel) {
      g.text('GAS', 2, this.height - 8, { color: 'mid' });
      g.frame(16, this.height - 8, 42, 6, 'mid');
      const low = this.fuel < 25 && Math.floor(this.time * 4) % 2 === 0;
      g.rect(17, this.height - 7, Math.round(40 * (this.fuel / 100)), 4, low ? 'red' : 'green');
    }
    g.text(`NV ${this.level}`, this.width - 2, this.height - 8, { align: 'right', color: 'mid' });
  }

  _drawCar(g, x, y, rows, color) {
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c] === '#') g.cell(Math.round(x + c * CELL), Math.round(y + r * CELL), CELL, color);
      }
    }
  }

  /** Noche: todo a oscuras salvo el cono de los faros (el coche se dibuja encima). */
  _drawNight(g) {
    const ctx = g.ctx;
    const cx = this.px + CAR_W / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, TOP, this.width, this.height - TOP);
    ctx.moveTo(cx - 6, PLAYER_Y);
    ctx.lineTo(cx - 30, PLAYER_Y - 80);
    ctx.lineTo(cx + 30, PLAYER_Y - 80);
    ctx.lineTo(cx + 6, PLAYER_Y);
    ctx.closePath();
    ctx.fillStyle = g.color('bg');
    ctx.fill('evenodd');
    ctx.restore();
  }
}
