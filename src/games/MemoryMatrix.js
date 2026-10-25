// src/games/MemoryMatrix.js
// Motor 10 (slots 92-99): memoria. Retos de memoria y reflejos con luces y sonidos.
// Modos (Catalog99 config.mode):
//   simon    repite la secuencia de luces, que crece un paso por ronda
//   reverse  igual, pero hay que repetirla al revés
//   reflex   pulsa la dirección que se ilumina antes de que se apague
//   grid     memoriza las casillas encendidas de una matriz y señálalas
//   pairs    encuentra las parejas de símbolos ocultos
//   mixed    cada ronda es un modo distinto
// config.timeLimit son los segundos para cada respuesta (0 = sin límite), no de la partida.
//
// Controles: ▲ ▶ ▼ ◀ pulsar el botón de esa dirección; en matriz y parejas, flechas mover y A elegir.

import { BaseCartridge, ACTIONS } from './BaseCartridge.js';

const PAD_SIZE = 40;
const PAD_CELL = 8;
const PADS = [
  { action: ACTIONS.UP, x: 52, y: 34, color: 'green', sfx: 'blip1', arrow: ['..#..', '.###.', '#####'] },
  { action: ACTIONS.RIGHT, x: 96, y: 78, color: 'red', sfx: 'blip2', arrow: ['#..', '##.', '###', '##.', '#..'] },
  { action: ACTIONS.DOWN, x: 52, y: 122, color: 'yellow', sfx: 'blip3', arrow: ['#####', '.###.', '..#..'] },
  { action: ACTIONS.LEFT, x: 8, y: 78, color: 'blue', sfx: 'blip4', arrow: ['..#', '.##', '###', '.##', '..#'] }
];
const BOARD_TOP = 30;
const BOARD_SIZE = 128;
const SYMBOLS = [
  { rows: ['.###.', '#####', '#####', '#####', '.###.'], color: 'red' },
  { rows: ['#####', '#...#', '#...#', '#...#', '#####'], color: 'cyan' },
  { rows: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'], color: 'yellow' },
  { rows: ['..#..', '..#..', '#####', '..#..', '..#..'], color: 'green' },
  { rows: ['.#.#.', '#####', '#####', '.###.', '..#..'], color: 'magenta' },
  { rows: ['..#..', '.###.', '#####', '.###.', '..#..'], color: 'orange' },
  { rows: ['..#..', '.#.#.', '.#.#.', '#...#', '#####'], color: 'blue' },
  { rows: ['#.#.#', '.###.', '#####', '.###.', '#.#.#'], color: 'white' }
];
const MIXED_MODES = ['simon', 'reverse', 'reflex', 'grid'];
const MODE_TITLE = { simon: 'REPITE', reverse: 'AL REVES', reflex: 'REFLEJOS', grid: 'MATRIZ', pairs: 'PAREJAS' };
const DIR_ACTIONS = [ACTIONS.UP, ACTIONS.RIGHT, ACTIONS.DOWN, ACTIONS.LEFT];

export default class MemoryMatrix extends BaseCartridge {
  reset() {
    // config.timeLimit es el tiempo por respuesta, no de la partida.
    this.answerTime = this.config.timeLimit > 0 ? this.config.timeLimit : 0;
    this.timeLimit = this.config.sessionTime > 0 ? this.config.sessionTime : 0;
    this.padCount = Math.max(2, Math.min(4, this.config.colors || 4));
    this.round = 0;
    this.seq = [];
    this.mode = null;
    this.lit = -1;
    this.litTimer = 0;
    this.cursor = 0;
    this.aiTimer = 0;
    this.aiSeen = new Map();
    this._setPhase('ready', 1.1);
  }

  _setPhase(phase, timer = 0) {
    this.phase = phase;
    this.phaseTimer = timer;
  }

  _speed() {
    return (this.config.speed || 1) * (1 + Math.min(0.6, this.round * 0.03));
  }

  _light(pad, seconds) {
    this.lit = pad;
    this.litTimer = seconds;
    this.sound.sfx(PADS[pad].sfx);
  }

  // ---------- Rondas ----------

  _startRound() {
    this.round += 1;
    const mixed = this.config.mode === 'mixed';
    if (mixed) {
      const options = MIXED_MODES.filter((m) => m !== this.mode);
      this.mode = this.pick(options);
    } else {
      this.mode = this.config.mode || 'simon';
    }
    this.answerClock = this.answerTime;
    this.aiTimer = 0.5;

    if (this.mode === 'simon' || this.mode === 'reverse') {
      if (mixed) {
        const len = Math.min(9, 2 + Math.floor(this.round / 2));
        this.seq = Array.from({ length: len }, () => this.randInt(0, this.padCount - 1));
      } else if (this.seq.length === 0) {
        const len = Math.max(1, this.config.startLength || 1);
        this.seq = Array.from({ length: len }, () => this.randInt(0, this.padCount - 1));
      } else {
        this.seq.push(this.randInt(0, this.padCount - 1));
      }
      this.showIndex = 0;
      this.inputIndex = 0;
      this._setPhase('show', 0.6);
    } else if (this.mode === 'reflex') {
      this.reflexLeft = mixed ? 4 : Infinity;
      this.reflexHits = this.reflexHits || 0;
      this.reflexTarget = -1;
      this._setPhase('reflexWait', 0.7);
    } else if (this.mode === 'grid') {
      this.gridN = mixed ? 3 : Math.max(2, Math.min(5, this.config.gridSize || 3));
      const total = this.gridN * this.gridN;
      const count = Math.min(total - 1, this.gridN + Math.floor((this.round - 1) / 2) - (this.gridN === 2 ? 1 : 0));
      const cells = [...Array(total).keys()];
      for (let i = cells.length - 1; i > 0; i--) {
        const j = this.randInt(0, i);
        [cells[i], cells[j]] = [cells[j], cells[i]];
      }
      this.targets = new Set(cells.slice(0, Math.max(1, count)));
      this.found = new Set();
      this.cursor = Math.floor(total / 2);
      this._setPhase('show', (1.1 + count * 0.22) / (this.config.speed || 1));
    } else {
      this._newPairsBoard();
    }
  }

  _newPairsBoard() {
    this.gridN = Math.max(2, Math.min(4, this.config.gridSize || 4));
    const total = this.gridN * this.gridN;
    const pairs = Math.floor(total / 2);
    const deck = [];
    for (let i = 0; i < pairs; i++) deck.push(i % SYMBOLS.length, i % SYMBOLS.length);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = this.randInt(0, i);
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    this.cards = deck.map((symbol) => ({ symbol, open: false, matched: false }));
    this.flipped = [];
    this.misses = 0;
    this.maxMisses = Math.max(4, 10 - this.level);
    this.cursor = 0;
    this.aiSeen = new Map();
    this.cards.forEach((card, i) => this.aiSeen.set(i, card.symbol));
    this._setPhase('show', 1.6 / (this.config.speed || 1));
  }

  _roundDone() {
    this.addScore(1);
    if (this.mode === 'simon' || this.mode === 'reverse') this.peak('sequence', this.seq.length);
    this.sound.sfx('coin');
    this.input.vibrate('light');
    if (this.score % 5 === 0) this.levelUp();
    this._setPhase('good', 0.7);
  }

  _fail(message, pad = -1) {
    if (this.phase === 'fail') return;
    this.failMessage = message;
    this.failPad = pad;
    this.sound.sfx('error');
    this.input.vibrate('heavy');
    this.shake(2, 0.3);
    this._setPhase('fail', 1.4);
  }

  // ---------- Entrada ----------

  onInput({ action, pressed }) {
    if (!pressed) return;
    const dirIndex = DIR_ACTIONS.indexOf(action);
    if (this.mode === 'grid' || this.mode === 'pairs') {
      if (this.phase !== 'input') return;
      if (dirIndex >= 0) this._moveCursor(action);
      else if (action === ACTIONS.A) this._select();
      return;
    }
    if (dirIndex < 0 || dirIndex >= this.padCount) return;
    if (this.phase === 'input') this._answerPad(dirIndex);
    else if (this.phase === 'reflex') this._answerReflex(dirIndex);
  }

  _answerPad(pad) {
    const order = this.mode === 'reverse' ? this.seq.length - 1 - this.inputIndex : this.inputIndex;
    const expected = this.seq[order];
    if (pad !== expected) {
      this._fail('FALLO', expected);
      return;
    }
    this._light(pad, 0.22);
    this.inputIndex += 1;
    this.answerClock = this.answerTime;
    if (this.inputIndex >= this.seq.length) this._roundDone();
  }

  _answerReflex(pad) {
    if (pad !== this.reflexTarget) {
      this._fail('FALLO', this.reflexTarget);
      return;
    }
    this._light(pad, 0.12);
    this.reflexHits += 1;
    this.reflexLeft -= 1;
    this.addScore(1);
    this.track('reflex');
    if (this.reflexHits % 10 === 0) this.levelUp();
    this.reflexTarget = -1;
    if (this.reflexLeft <= 0) this._setPhase('good', 0.6);
    else this._setPhase('reflexWait', this.random(0.25, 0.6) / this._speed());
  }

  _moveCursor(action) {
    const n = this.gridN;
    let x = this.cursor % n;
    let y = Math.floor(this.cursor / n);
    if (action === ACTIONS.UP) y = (y + n - 1) % n;
    else if (action === ACTIONS.DOWN) y = (y + 1) % n;
    else if (action === ACTIONS.LEFT) x = (x + n - 1) % n;
    else x = (x + 1) % n;
    this.cursor = y * n + x;
    this.sound.sfx('move');
  }

  _select() {
    const i = this.cursor;
    if (this.mode === 'grid') {
      if (this.found.has(i)) return;
      if (!this.targets.has(i)) {
        this._fail('FALLO');
        return;
      }
      this.found.add(i);
      this.answerClock = this.answerTime;
      this.sound.sfx(PADS[this.found.size % 4].sfx);
      if (this.found.size >= this.targets.size) this._roundDone();
      return;
    }
    const card = this.cards[i];
    if (card.open || card.matched || this.flipped.length >= 2) return;
    card.open = true;
    this.flipped.push(i);
    this.answerClock = this.answerTime;
    this.sound.sfx(PADS[card.symbol % 4].sfx);
    if (this.flipped.length < 2) return;
    const [a, b] = this.flipped;
    if (this.cards[a].symbol === this.cards[b].symbol) {
      this.cards[a].matched = this.cards[b].matched = true;
      this.flipped = [];
      this.addScore(1);
      this.sound.sfx('coin');
      if (this.cards.every((c) => c.matched)) {
        this.addScore(2);
        this._setPhase('good', 0.9);
      }
    } else {
      this.misses += 1;
      this.sound.sfx('hit');
      this._setPhase('peek', 0.7 / (this.config.speed || 1));
    }
  }

  // ---------- Bucle ----------

  update(dt) {
    if (this.litTimer > 0) {
      this.litTimer -= dt;
      if (this.litTimer <= 0) this.lit = -1;
    }
    this.phaseTimer -= dt;

    switch (this.phase) {
      case 'ready':
        if (this.phaseTimer <= 0) this._startRound();
        break;
      case 'show':
        this._updateShow();
        break;
      case 'input':
        if (this.answerTime > 0) {
          this.answerClock -= dt;
          if (this.answerClock <= 0) this._fail('TIEMPO', this._expectedPad());
        }
        break;
      case 'reflexWait':
        if (this.phaseTimer <= 0) {
          let next = this.randInt(0, this.padCount - 1);
          if (next === this.reflexTarget) next = (next + 1) % this.padCount;
          this.reflexTarget = next;
          this._light(next, 9);
          const base = this.answerTime > 0 && this.answerTime < 5 ? this.answerTime : 2;
          this._setPhase('reflex', base * Math.max(0.4, 1 - this.reflexHits * 0.025));
          this.reflexWindow = this.phaseTimer;
        }
        break;
      case 'reflex':
        if (this.phaseTimer <= 0) this._fail('TARDE', this.reflexTarget);
        break;
      case 'peek':
        if (this.phaseTimer <= 0) {
          for (const i of this.flipped) this.cards[i].open = false;
          this.flipped = [];
          if (this.misses > this.maxMisses) this._fail('SIN INTENTOS');
          else this._setPhase('input');
        }
        break;
      case 'good':
        if (this.phaseTimer <= 0) {
          if (this.mode === 'reflex' && this.config.mode !== 'mixed') this._setPhase('reflexWait', 0.3);
          else if (this.mode === 'pairs') {
            this.levelUp();
            this.round += 1;
            this._newPairsBoard();
          } else this._startRound();
        }
        break;
      case 'fail':
        if (this.phaseTimer <= 0) this.gameOver({ message: this.failMessage });
        break;
      default:
        break;
    }
  }

  _updateShow() {
    if (this.mode === 'grid' || this.mode === 'pairs') {
      if (this.phaseTimer <= 0) {
        this.answerClock = this.answerTime;
        this._setPhase('input');
      }
      return;
    }
    if (this.phaseTimer > 0) return;
    if (this.showIndex >= this.seq.length) {
      this.answerClock = this.answerTime;
      this._setPhase('input');
      return;
    }
    const speed = this._speed();
    this._light(this.seq[this.showIndex], 0.42 / speed);
    this.showIndex += 1;
    this.phaseTimer = (0.42 + 0.16) / speed;
  }

  _expectedPad() {
    if (this.mode !== 'simon' && this.mode !== 'reverse') return -1;
    return this.seq[this.mode === 'reverse' ? this.seq.length - 1 - this.inputIndex : this.inputIndex];
  }

  // ---------- IA del modo demo ----------

  autopilot(dt) {
    this._autoHeld = null;
    this.aiTimer -= dt;
    if (this.aiTimer > 0) return;
    const press = (action) => this.handleInput({ action, pressed: true, repeat: false });
    if (this.phase === 'reflex') {
      if (this.reflexWindow - this.phaseTimer < 0.28) return;
      this.aiTimer = 0.1;
      press(DIR_ACTIONS[this.reflexTarget]);
      return;
    }
    if (this.phase !== 'input') return;
    this.aiTimer = this.random(0.22, 0.4);
    if (this.mode === 'simon' || this.mode === 'reverse') {
      press(DIR_ACTIONS[this._expectedPad()]);
      return;
    }
    let goal;
    if (this.mode === 'grid') {
      goal = [...this.targets].find((i) => !this.found.has(i));
    } else {
      goal = this._aiPairGoal();
    }
    if (goal === undefined || goal < 0) return;
    if (goal === this.cursor) {
      press(ACTIONS.A);
      return;
    }
    const n = this.gridN;
    const cx = this.cursor % n;
    const cy = Math.floor(this.cursor / n);
    const gx = goal % n;
    const gy = Math.floor(goal / n);
    this.aiTimer = 0.12;
    if (gx !== cx) press(gx < cx ? ACTIONS.LEFT : ACTIONS.RIGHT);
    else press(gy < cy ? ACTIONS.UP : ACTIONS.DOWN);
  }

  _aiPairGoal() {
    const hidden = this.cards.map((c, i) => i).filter((i) => !this.cards[i].matched && !this.cards[i].open);
    if (this.flipped.length === 1) {
      const symbol = this.cards[this.flipped[0]].symbol;
      return hidden.find((i) => this.aiSeen.get(i) === symbol) ?? hidden[0];
    }
    // De vez en cuando la IA "olvida" y gira una carta cualquiera, como una persona.
    return this.chance(0.2) ? this.pick(hidden) : hidden[0];
  }

  // ---------- Dibujo ----------

  draw(g) {
    g.clear();
    if (this.mode === 'grid' || this.mode === 'pairs') this._drawBoard(g);
    else this._drawPads(g);
    this._drawStatus(g);
    const center = this.timeLimit > 0 ? `T ${Math.ceil(this.timeLeft)}` : this.mode ? MODE_TITLE[this.mode] : 'MEMORIA';
    this.drawTopBar(g, { lives: false, center });
  }

  _drawPads(g) {
    for (let i = 0; i < this.padCount; i++) {
      const pad = PADS[i];
      const on = this.lit === i || (this.phase === 'fail' && this.failPad === i && Math.floor(this.time * 8) % 2 === 0);
      for (let y = 0; y < PAD_SIZE; y += PAD_CELL) {
        for (let x = 0; x < PAD_SIZE; x += PAD_CELL) g.cell(pad.x + x, pad.y + y, PAD_CELL, on ? pad.color : 'off');
      }
      g.frame(pad.x - 2, pad.y - 2, PAD_SIZE + 3, PAD_SIZE + 3, on ? 'ink' : 'mid');
      const aw = pad.arrow[0].length * 2;
      const ah = pad.arrow.length * 2;
      g.rect(pad.x + (PAD_SIZE - aw) / 2 - 2, pad.y + (PAD_SIZE - ah) / 2 - 2, aw + 4, ah + 4, 'bg');
      g.sprite(pad.arrow, pad.x + (PAD_SIZE - aw) / 2, pad.y + (PAD_SIZE - ah) / 2, { scale: 2, color: on ? 'ink' : 'mid' });
    }
    // Centro: número de ronda o progreso de la respuesta.
    const cx = 72;
    const cy = 96;
    if (this.mode === 'reflex') {
      g.text(String(this.reflexHits || 0), cx, cy - 6, { align: 'center', scale: 2 });
      if (this.phase === 'reflex') {
        const ratio = Math.max(0, this.phaseTimer / this.reflexWindow);
        g.rect(cx - 16, cy + 8, Math.round(32 * ratio), 2, ratio < 0.35 ? 'red' : 'green');
      }
    } else if (this.seq.length > 0) {
      g.text(String(this.seq.length), cx, cy - 6, { align: 'center', scale: 2 });
      if (this.phase === 'input') {
        const shown = Math.min(this.seq.length, 10);
        const done = Math.min(shown, this.inputIndex);
        for (let i = 0; i < shown; i++) g.rect(cx - shown * 2 + i * 4, cy + 9, 3, 3, i < done ? 'green' : 'ghost');
      }
    }
  }

  _drawBoard(g) {
    const n = this.gridN;
    const size = Math.floor(BOARD_SIZE / n);
    const ox = Math.floor((this.width - size * n) / 2);
    const showing = this.phase === 'show';
    const failed = this.phase === 'fail';
    for (let i = 0; i < n * n; i++) {
      const x = ox + (i % n) * size;
      const y = BOARD_TOP + Math.floor(i / n) * size;
      const inner = size - 4;
      if (this.mode === 'grid') {
        let state = 'off';
        if (showing && this.targets.has(i)) state = 'cyan';
        else if (this.found.has(i)) state = 'green';
        else if (failed && this.targets.has(i) && Math.floor(this.time * 6) % 2 === 0) state = 'red';
        const cellSize = inner / 2;
        for (let cy = 0; cy < 2; cy++) {
          for (let cx = 0; cx < 2; cx++) g.cell(x + 2 + cx * cellSize, y + 2 + cy * cellSize, cellSize, state);
        }
      } else {
        const card = this.cards[i];
        const faceUp = showing || card.open || card.matched || failed;
        g.frame(x + 2, y + 2, inner, inner, card.matched ? 'ghost' : 'mid');
        if (faceUp) {
          const sym = SYMBOLS[card.symbol];
          const scale = Math.max(2, Math.floor(inner / 7));
          const sw = 5 * scale;
          g.sprite(sym.rows, x + 2 + (inner - sw) / 2, y + 2 + (inner - sw) / 2, { scale, colors: { '#': card.matched ? 'mid' : sym.color } });
        } else {
          for (let py = 6; py < inner - 2; py += 6) {
            for (let px = 6; px < inner - 2; px += 6) g.px(x + 2 + px, y + 2 + py, 'mid');
          }
        }
      }
      if (this.phase === 'input' && i === this.cursor && Math.floor(this.time * 4) % 4 !== 0) {
        g.frame(x, y, size, size, 'ink', 2);
      }
    }
  }

  _drawStatus(g) {
    const y = 168;
    let text = '';
    if (this.phase === 'ready') text = 'LISTO';
    else if (this.phase === 'show') text = this.mode === 'pairs' ? 'MEMORIZA' : 'MIRA';
    else if (this.phase === 'input') text = this.mode === 'grid' ? `QUEDAN ${this.targets.size - this.found.size}` : this.mode === 'pairs' ? `FALLOS ${this.misses}/${this.maxMisses}` : 'TU TURNO';
    else if (this.phase === 'peek') text = `FALLOS ${this.misses}/${this.maxMisses}`;
    else if (this.phase === 'reflex' || this.phase === 'reflexWait') text = 'RAPIDO';
    else if (this.phase === 'good') text = 'BIEN';
    else if (this.phase === 'fail') text = this.failMessage;
    g.text(text, this.width / 2, y, { align: 'center', color: this.phase === 'fail' ? 'red' : 'ink' });
    if (this.answerTime > 0 && this.phase === 'input') {
      const ratio = Math.max(0, this.answerClock / this.answerTime);
      g.frame(20, y + 9, this.width - 40, 5, 'mid');
      g.rect(21, y + 10, Math.round((this.width - 42) * ratio), 3, ratio < 0.3 ? 'red' : 'green');
    }
  }
}
