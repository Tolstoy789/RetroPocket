// src/core/Screens.js
// Pantallas de sistema de la consola:
//   OptionsScreen  → menú de ajustes (tema, volúmenes, altavoz, jukebox, vibración, accesibilidad, copia de récords)
//   InitialsScreen → introducir 3 iniciales al entrar en el top 5 de un slot
//   AttractScreen  → modo atracción: logo, récords, galería de juegos y demos jugadas por la consola

import { ACTIONS } from './InputManager.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from './ConsoleEngine.js';

const YES_NO = (v) => (v ? 'SI' : 'NO');

// ---------------------------------------------------------------------------
// OptionsScreen
// ---------------------------------------------------------------------------

export class OptionsScreen {
  constructor(engine) {
    this.engine = engine;
    this.index = 0;
    this.time = 0;
    this.confirmErase = false;
    this.items = this._buildItems();
  }

  _buildItems() {
    const e = this.engine;
    const toggle = (key, after) => ({
      value: () => YES_NO(e.settings[key]),
      change: () => {
        e.updateSetting(key, !e.settings[key]);
        if (after) after(e.settings[key]);
      }
    });
    const level = (key) => ({
      level: () => e.settings[key],
      change: (dir) => {
        const next = Math.max(0, Math.min(3, e.settings[key] + dir));
        e.updateSetting(key, next);
      }
    });
    const choice = (key, values, labels) => ({
      value: () => labels[Math.max(0, values.indexOf(e.settings[key]))],
      change: (dir) => {
        const i = Math.max(0, values.indexOf(e.settings[key]));
        e.updateSetting(key, values[(i + dir + values.length) % values.length]);
      }
    });
    return [
      { label: 'TEMA', value: () => e.themeInfo.name, change: (dir) => e.cycleTheme(dir), action: () => this._openThemes(), hint: '◀▶ CAMBIAR  A GALERIA  B SALIR' },
      { label: 'MANO', ...choice('hand', ['right', 'left'], ['DIESTRO', 'ZURDO']) },
      {
        label: 'BOTONES',
        value: () => (e.settings.bigButtons ? 'GRANDES' : 'NORMAL'),
        change: () => e.updateSetting('bigButtons', !e.settings.bigButtons)
      },
      { label: 'REPETICION', ...choice('repeat', ['slow', 'normal', 'fast'], ['LENTA', 'NORMAL', 'RAPIDA']) },
      { label: 'GESTOS', ...toggle('gestures', (on) => on && e.toast('DESLIZA Y TOCA LA PANTALLA', 1.6)), hint: 'DESLIZAR = CRUCETA  TOCAR = A' },
      { label: 'AUTODISPARO', ...toggle('autoFire'), hint: 'MANTEN A PARA DISPARAR SIN PARAR' },
      { label: 'CONTRASTE', ...choice('contrast', ['normal', 'high'], ['NORMAL', 'ALTO']) },
      { label: 'ESTELA LCD', ...toggle('ghosting') },
      { label: 'MUSICA', ...level('music') },
      { label: 'EFECTOS', ...level('sfx') },
      { label: 'ALTAVOZ', ...choice('beeper', [false, true], ['CHIP', 'BEEPER']) },
      { label: 'JUKEBOX', action: () => this._openJukebox(), hint: 'A ESCUCHAR LA MUSICA  B SALIR' },
      { label: 'VIBRACION', ...toggle('haptics', (on) => on && e.input.vibrate('medium')) },
      { label: 'SACUDIDA', ...toggle('shake', (on) => on && e.fx.shake(3, 0.3)) },
      { label: 'DESTELLOS', ...toggle('flashes', (on) => on && e.fx.flash('white', 0.2, 0.5)) },
      { label: 'DALTONISMO', ...toggle('colorblind') },
      { label: 'DESCANSO 30M', ...toggle('breakReminder') },
      { label: 'ARRANQUE', ...choice('boot', ['auto', 'brick', 'neon', 'cartridge'], ['AUTO', 'LADRILLO', 'NEON', 'CARTUCHO']) },
      { label: 'DEMO', ...toggle('demo') },
      {
        label: 'PANT. COMPLETA',
        value: () => YES_NO(e.settings.fullscreen),
        change: () => {
          e.updateSetting('fullscreen', !e.settings.fullscreen);
          e.platform?.setFullscreen(e.settings.fullscreen, { fromGesture: true });
        }
      },
      { label: 'NO APAGAR PANT.', ...toggle('keepAwake') },
      {
        label: 'AHORRO BATERIA',
        ...choice('battery', ['auto', 'on', 'off'], ['AUTO', 'SI', 'NO']),
        hint: () => (e.settings.battery === 'auto' ? 'AUTO: CON MENOS DEL 20% DE CARGA' : '30 FPS Y SIN REDIBUJAR LO QUIETO')
      },
      { label: 'COPIAR RECORDS', action: () => this._exportCode() },
      { label: 'PEGAR RECORDS', action: () => this._importCode() },
      { label: 'BORRAR RECORDS', action: () => this._erase() },
      { label: 'VOLVER', action: () => this._exit() }
    ];
  }

  onEnter() {
    this.index = 0;
    this.time = 0;
    this.confirmErase = false;
  }

  _exit() {
    this.engine.sound.sfx('back');
    this.engine.closeOptions();
  }

  _openThemes() {
    this.engine.sound.sfx('confirm');
    this.engine.openThemes();
  }

  _openJukebox() {
    this.engine.sound.sfx('confirm');
    this.engine.openJukebox();
  }

  /** Copia de seguridad: copia un código con récords, ajustes, favoritos y logros. */
  async _exportCode() {
    const e = this.engine;
    if (!e.platform) return;
    const code = e.storage.exportCode();
    e.sound.sfx('select');
    const copied = await e.platform.copyText(code, 'Copia este código y guárdalo (por ejemplo, en una nota):');
    e.input.releaseAll();
    e.toast(copied ? 'CODIGO COPIADO' : 'GUARDA EL CODIGO', 1.6);
  }

  /** Restaura una copia de seguridad pegando el código. */
  async _importCode() {
    const e = this.engine;
    if (!e.platform) return;
    e.sound.sfx('select');
    const text = await e.platform.readText('Pega aquí el código de RetroPocket (empieza por RP99-):');
    e.input.releaseAll();
    if (!text.trim()) return;
    if (e.storage.importCode(text)) {
      e.settings = e.storage.getSettings();
      e.applySettings();
      e.onDataImported?.();
      e.sound.sfx('levelup');
      e.toast('DATOS RESTAURADOS', 1.6);
    } else {
      e.sound.sfx('error');
      e.toast('CODIGO NO VALIDO', 1.6);
    }
  }

  _erase() {
    const e = this.engine;
    if (!this.confirmErase) {
      this.confirmErase = true;
      e.sound.sfx('error');
      return;
    }
    e.storage.clearScores();
    this.confirmErase = false;
    e.sound.sfx('explode');
    e.fx.shake(3, 0.4);
    e.toast('RECORDS BORRADOS');
  }

  handleAction({ action, pressed, repeat }) {
    if (!pressed) return;
    const e = this.engine;
    const item = this.items[this.index];
    switch (action) {
      case ACTIONS.UP:
        this.index = (this.index + this.items.length - 1) % this.items.length;
        this.confirmErase = false;
        e.sound.sfx('move');
        break;
      case ACTIONS.DOWN:
        this.index = (this.index + 1) % this.items.length;
        this.confirmErase = false;
        e.sound.sfx('move');
        break;
      case ACTIONS.LEFT:
      case ACTIONS.RIGHT:
        if (item.change) {
          item.change(action === ACTIONS.LEFT ? -1 : 1);
          e.sound.sfx('select');
        }
        break;
      case ACTIONS.A:
      case ACTIONS.START:
        if (repeat) return;
        if (item.action) item.action();
        else if (item.change) {
          item.change(1);
          e.sound.sfx('select');
        }
        break;
      case ACTIONS.B:
        if (!repeat) this._exit();
        break;
      default:
        break;
    }
  }

  update(dt) {
    this.time += dt;
  }

  render(g) {
    const cx = SCREEN_WIDTH / 2;
    g.clear();
    g.rect(0, 0, SCREEN_WIDTH, 13, 'ink');
    g.text('OPCIONES', cx, 4, { align: 'center', color: 'bg' });

    const top = 20;
    const rowH = 14;
    const visible = 10;
    const first = Math.max(0, Math.min(this.items.length - visible, this.index - Math.floor(visible / 2)));
    if (first > 0) g.text('▲', SCREEN_WIDTH - 6, 4, { align: 'right', color: 'bg' });
    if (first + visible < this.items.length) g.text('▼', SCREEN_WIDTH / 2, top + visible * rowH - 3, { align: 'center', color: 'mid' });
    this.items.forEach((item, i) => {
      if (i < first || i >= first + visible) return;
      const y = top + (i - first) * rowH;
      const selected = i === this.index;
      if (selected) {
        g.rect(4, y - 3, SCREEN_WIDTH - 8, rowH - 2, 'ghost');
        g.text('▶', 7, y, { color: Math.floor(this.time * 4) % 2 ? 'ink' : 'mid' });
      }
      const isErase = item.label === 'BORRAR RECORDS';
      const label = isErase && this.confirmErase && selected ? '¿SEGURO? PULSA A' : item.label;
      g.text(label, 15, y, { color: isErase && this.confirmErase ? 'red' : selected ? 'ink' : 'mid' });
      if (item.level) {
        const lv = item.level();
        for (let k = 0; k < 3; k++) {
          const bx = SCREEN_WIDTH - 36 + k * 10;
          if (k < lv) g.rect(bx, y - 1, 8, 7, selected ? 'cyan' : 'ink');
          else g.frame(bx, y - 1, 8, 7, 'mid');
        }
      } else if (item.value) {
        const text = item.value();
        g.text(text, SCREEN_WIDTH - 9, y, { align: 'right', color: selected ? 'cyan' : 'ink' });
        if (selected) {
          g.text('◀', SCREEN_WIDTH - 15 - g.textWidth(text), y, { color: 'mid' });
          g.text('▶', SCREEN_WIDTH - 7, y, { color: 'mid' });
        }
      }
    });

    const { hint } = this.items[this.index];
    g.text((typeof hint === 'function' ? hint() : hint) || '▲▼ ELEGIR  ◀▶ CAMBIAR  B SALIR', cx, SCREEN_HEIGHT - 10, { align: 'center', color: 'mid' });
  }
}

// ---------------------------------------------------------------------------
// InitialsScreen
// ---------------------------------------------------------------------------

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';

export class InitialsScreen {
  constructor(engine) {
    this.engine = engine;
    this.letters = ['A', 'A', 'A'];
    this.pos = 0;
    this.time = 0;
    this.result = null;
    this.onDone = null;
  }

  begin(result, onDone) {
    const saved = String(this.engine.settings.initials || 'AAA').padEnd(3, ' ').slice(0, 3);
    this.letters = saved.split('').map((c) => (CHARSET.includes(c) ? c : 'A'));
    this.pos = 0;
    this.time = 0;
    this.result = result;
    this.onDone = onDone;
  }

  _shift(dir) {
    const i = CHARSET.indexOf(this.letters[this.pos]);
    this.letters[this.pos] = CHARSET[(i + dir + CHARSET.length) % CHARSET.length];
    this.engine.sound.sfx('tick');
  }

  confirm() {
    const done = this.onDone;
    this.onDone = null;
    if (done) done(this.letters.join(''));
  }

  handleAction({ action, pressed, repeat }) {
    if (!pressed || this.time < 0.4) return;
    const sound = this.engine.sound;
    switch (action) {
      case ACTIONS.UP:
        this._shift(1);
        break;
      case ACTIONS.DOWN:
        this._shift(-1);
        break;
      case ACTIONS.LEFT:
      case ACTIONS.B:
        if (repeat && action === ACTIONS.B) return;
        if (this.pos > 0) {
          this.pos--;
          sound.sfx('move');
        }
        break;
      case ACTIONS.RIGHT:
        if (this.pos < 2) {
          this.pos++;
          sound.sfx('move');
        }
        break;
      case ACTIONS.A:
        if (repeat) return;
        if (this.pos < 2) {
          this.pos++;
          sound.sfx('select');
        } else {
          this.confirm();
        }
        break;
      case ACTIONS.START:
        if (!repeat) this.confirm();
        break;
      default:
        break;
    }
  }

  update(dt) {
    this.time += dt;
  }

  render(g) {
    const r = this.result || { rank: 1, score: 0 };
    const cx = SCREEN_WIDTH / 2;
    g.veil();
    const w = 120;
    const h = 112;
    const x = Math.floor((SCREEN_WIDTH - w) / 2);
    const y = Math.floor((SCREEN_HEIGHT - h) / 2);
    g.panel(x, y, w, h);
    g.text(r.isHighScore ? '¡NUEVO RECORD!' : `¡TOP ${r.rank}!`, cx, y + 8, { align: 'center', scale: 2, color: 'yellow' });
    g.text(`PUNTOS ${String(r.score).padStart(7, '0')}`, cx, y + 26, { align: 'center' });
    g.text('TUS INICIALES', cx, y + 38, { align: 'center', color: 'mid' });

    const letterW = 18;
    const startX = cx - (letterW * 3) / 2;
    for (let i = 0; i < 3; i++) {
      const lx = startX + i * letterW;
      const active = i === this.pos;
      g.text(this.letters[i] === ' ' ? '_' : this.letters[i], lx + 3, y + 52, { scale: 4, color: active ? 'cyan' : 'ink' });
      if (active && Math.floor(this.time * 3) % 2 === 0) {
        g.text('▲', lx + 6, y + 46, { color: 'mid' });
        g.rect(lx + 2, y + 74, 14, 2, 'cyan');
        g.text('▼', lx + 6, y + 77, { color: 'mid' });
      }
    }
    g.text('▲▼ LETRA  A SIGUIENTE', cx, y + h - 22, { align: 'center', color: 'mid' });
    g.text('START: GUARDAR', cx, y + h - 12, { align: 'center', color: 'mid' });
  }
}

// ---------------------------------------------------------------------------
// AttractScreen
// ---------------------------------------------------------------------------

const PAGE_LOGO = 0;
const PAGE_SCORES = 1;
const PAGE_GALLERY = 2;
const PAGE_DEMO = 3;
const PAGE_TIME = [5, 6, 7, 0];

export class AttractScreen {
  constructor(engine) {
    this.engine = engine;
    this.page = PAGE_LOGO;
    this.pageTime = 0;
    this.time = 0;
    this.top = [];
    this.stats = { completed: 0, stars: 0 };
  }

  onEnter() {
    this.pageTime = 0;
    this._refresh();
  }

  _refresh() {
    const { storage, catalog } = this.engine;
    this.top = storage.topOverall(5);
    this.stats = { completed: catalog.completedCount(storage), stars: catalog.totalStars(storage) };
  }

  _nextPage() {
    this.page = (this.page + 1) % PAGE_TIME.length;
    this.pageTime = 0;
    if (this.page === PAGE_SCORES) this._refresh();
    if (this.page === PAGE_DEMO) {
      const installed = this.engine.catalog.installedSlots();
      this.page = PAGE_LOGO;
      if (installed.length) {
        const slot = installed[Math.floor(Math.random() * installed.length)];
        this.engine.launch(slot, { demo: true });
      }
    }
  }

  update(dt) {
    this.time += dt;
    this.pageTime += dt;
    if (this.pageTime >= PAGE_TIME[this.page]) this._nextPage();
  }

  render(g) {
    switch (this.page) {
      case PAGE_SCORES:
        this._renderScores(g);
        break;
      case PAGE_GALLERY:
        this._renderGallery(g);
        break;
      default:
        this._renderLogo(g);
    }
    if (Math.floor(this.time * 2) % 2 === 0) {
      g.rect(0, SCREEN_HEIGHT - 12, SCREEN_WIDTH, 12, 'ink');
      g.text('PULSA UN BOTON', SCREEN_WIDTH / 2, SCREEN_HEIGHT - 9, { align: 'center', color: 'bg' });
    }
  }

  _renderLogo(g) {
    g.clear();
    this.engine.drawLogo(g);
    g.text('99 JUEGOS - 10 MOTORES', SCREEN_WIDTH / 2, 126, { align: 'center', color: 'mid' });
  }

  _renderScores(g) {
    const cx = SCREEN_WIDTH / 2;
    g.clear();
    g.text('MEJORES', cx, 14, { align: 'center', scale: 2, color: 'yellow' });
    g.text('PUNTUACIONES', cx, 28, { align: 'center', scale: 2, color: 'yellow' });
    for (let i = 0; i < 5; i++) {
      const row = this.top[i];
      const y = 52 + i * 14;
      g.text(`${i + 1}.`, 14, y, { color: 'mid' });
      if (row) {
        const slotLabel = /^\d+$/.test(row.slot) ? `J${String(row.slot).padStart(2, '0')}` : 'HOY';
        g.text(row.name || '---', 26, y, { color: i === 0 ? 'cyan' : 'ink' });
        g.text(String(row.score).padStart(7, '0'), 98, y, { align: 'right', color: i === 0 ? 'cyan' : 'ink' });
        g.text(slotLabel, SCREEN_WIDTH - 14, y, { align: 'right', color: 'mid' });
      } else {
        g.text('--- -------', 26, y, { color: 'mid' });
      }
    }
    g.rect(14, 126, SCREEN_WIDTH - 28, 1, 'mid');
    g.text(`★ ESTRELLAS ${this.stats.stars}/297`, cx, 134, { align: 'center', color: 'yellow' });
    g.text(`JUEGOS SUPERADOS ${this.stats.completed}/99`, cx, 146, { align: 'center' });
  }

  _renderGallery(g) {
    const cx = SCREEN_WIDTH / 2;
    const engines = this.engine.catalog.engines;
    const perEngine = PAGE_TIME[PAGE_GALLERY] / engines.length;
    const index = Math.min(engines.length - 1, Math.floor(this.pageTime / perEngine));
    const e = engines[index];
    g.clear();
    g.text('LOS 10 MOTORES', cx, 14, { align: 'center', color: 'mid' });
    const frame = e.icon[Math.floor(this.time * 3) % e.icon.length];
    g.sprite(frame, cx - 32, 36, { scale: 8, colors: { '#': e.color, '+': 'mid' } });
    g.text(e.name, cx, 112, { align: 'center', scale: 2, color: e.color });
    g.text(`JUEGOS ${String(e.firstSlot).padStart(2, '0')}-${String(e.lastSlot).padStart(2, '0')}`, cx, 130, { align: 'center' });
    for (let i = 0; i < engines.length; i++) {
      g.rect(cx - engines.length * 4 + i * 8, 146, 5, 5, i === index ? e.color : 'ghost');
    }
  }
}
