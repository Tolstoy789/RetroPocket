// src/core/LaunchScreens.js
// Pantallas entre el menú y la partida:
//   LaunchScreen  → "PREPARADO": controles del motor, VELOCIDAD (1-5) y NIVEL inicial (1-9) al estilo
//                   de las Brick Game originales, y marcar el juego como favorito.
//   MyGamesScreen → "MIS JUEGOS": favoritos y últimos juegos jugados, para volver a ellos rápido.

import { ACTIONS } from './InputManager.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from './ConsoleEngine.js';
import { LAUNCH_SPEEDS, MAX_START_LEVEL } from './Catalog99.js';

const ROW_SPEED = 0;
const ROW_LEVEL = 1;
const ROW_FAVORITE = 2;
const ROWS = 3;

export class LaunchScreen {
  constructor(engine) {
    this.engine = engine;
    this.slot = null;
    this.index = 0;
    this.time = 0;
    this.speed = 1;
    this.level = 1;
    this.favorite = false;
  }

  open(slot) {
    const { storage } = this.engine;
    this.slot = slot;
    this.index = 0;
    this.time = 0;
    const prefs = storage.getLaunchPrefs(slot.engine.id);
    this.speed = prefs.speed;
    this.level = prefs.level;
    this.favorite = storage.isFavorite(slot.number);
  }

  _change(dir) {
    const e = this.engine;
    if (this.index === ROW_SPEED) {
      this.speed = Math.max(1, Math.min(LAUNCH_SPEEDS.length, this.speed + dir));
    } else if (this.index === ROW_LEVEL) {
      this.level = Math.max(1, Math.min(MAX_START_LEVEL, this.level + dir));
    } else {
      this.favorite = e.storage.toggleFavorite(this.slot.number);
      e.toast(this.favorite ? 'AÑADIDO A FAVORITOS' : 'QUITADO DE FAVORITOS');
    }
    e.storage.setLaunchPrefs(this.slot.engine.id, { speed: this.speed, level: this.level });
    e.sound.sfx('select');
  }

  _play() {
    const e = this.engine;
    e.sound.sfx('confirm');
    e.launch(e.catalog.customizeSlot(this.slot, { speed: this.speed, level: this.level }));
  }

  handleAction({ action, pressed, repeat }) {
    if (!pressed) return;
    const e = this.engine;
    switch (action) {
      case ACTIONS.UP:
        this.index = (this.index + ROWS - 1) % ROWS;
        e.sound.sfx('move');
        break;
      case ACTIONS.DOWN:
        this.index = (this.index + 1) % ROWS;
        e.sound.sfx('move');
        break;
      case ACTIONS.LEFT:
      case ACTIONS.RIGHT:
        if (repeat && this.index === ROW_FAVORITE) return;
        this._change(action === ACTIONS.LEFT ? -1 : 1);
        break;
      case ACTIONS.A:
      case ACTIONS.START:
        if (!repeat && this.time > 0.15) this._play();
        break;
      case ACTIONS.B:
        if (!repeat) {
          e.sound.sfx('back');
          e.closeToMenu();
        }
        break;
      default:
        break;
    }
  }

  update(dt) {
    this.time += dt;
  }

  render(g) {
    const slot = this.slot;
    if (!slot) return;
    const engineDef = slot.engine;
    const cx = SCREEN_WIDTH / 2;
    g.clear();
    g.rect(0, 0, SCREEN_WIDTH, 13, 'ink');
    g.text(`JUEGO ${slot.code}`, 3, 4, { color: 'bg' });
    g.text('PREPARADO', SCREEN_WIDTH - 3, 4, { align: 'right', color: 'bg' });

    g.text(engineDef.name, cx, 19, { align: 'center', scale: 2, color: engineDef.color });
    g.text(`${slot.variantIndex + 1}/${engineDef.variants.length} ${slot.label}`, cx, 33, { align: 'center' });

    const frame = engineDef.icon[Math.floor(this.time * 2) % engineDef.icon.length];
    g.rect(cx - 15, 42, 30, 30, 'ghost');
    g.sprite(frame, cx - 12, 45, { scale: 3, colors: { '#': engineDef.color, '+': 'mid' } });

    g.text('CONTROLES', cx, 78, { align: 'center', color: 'mid' });
    (engineDef.controls || []).forEach((line, i) => g.text(line, cx, 87 + i * 8, { align: 'center' }));

    g.rect(8, 106, SCREEN_WIDTH - 16, 1, 'mid');
    const rows = [
      { label: 'VELOCIDAD', value: this.speed, max: LAUNCH_SPEEDS.length },
      { label: 'NIVEL', value: this.level, max: MAX_START_LEVEL },
      { label: 'FAVORITO', text: this.favorite ? 'SI ♥' : 'NO' }
    ];
    rows.forEach((row, i) => {
      const y = 113 + i * 13;
      const selected = i === this.index;
      if (selected) {
        g.rect(4, y - 3, SCREEN_WIDTH - 8, 11, 'ghost');
        g.text('▶', 7, y, { color: Math.floor(this.time * 4) % 2 ? 'ink' : 'mid' });
      }
      g.text(row.label, 15, y, { color: selected ? 'ink' : 'mid' });
      if (row.text) {
        g.text(row.text, SCREEN_WIDTH - 12, y, { align: 'right', color: this.favorite ? 'magenta' : 'ink' });
      } else if (row.max <= 5) {
        for (let k = 0; k < row.max; k++) {
          const bx = SCREEN_WIDTH - 60 + k * 10;
          if (k < row.value) g.rect(bx, y - 1, 8, 7, selected ? 'cyan' : 'ink');
          else g.frame(bx, y - 1, 8, 7, 'mid');
        }
      } else {
        g.text(String(row.value).padStart(2, '0'), SCREEN_WIDTH - 22, y, { align: 'right', color: selected ? 'cyan' : 'ink' });
      }
      if (selected) {
        g.text('◀', row.text ? SCREEN_WIDTH - 20 - g.textWidth(row.text) : row.max <= 5 ? SCREEN_WIDTH - 68 : SCREEN_WIDTH - 36, y, { color: 'mid' });
        g.text('▶', SCREEN_WIDTH - 9, y, { color: 'mid' });
      }
    });

    const multiplier = 1 + (this.speed - 1) * 0.25;
    const bonus = multiplier > 1 ? `PUNTOS X${multiplier.toFixed(2).replace(/0$/, '')}` : 'PUNTOS NORMALES';
    g.text(bonus, cx, 155, { align: 'center', color: multiplier > 1 ? 'yellow' : 'mid' });

    if (Math.floor(this.time * 2) % 2 === 0) g.text('A O START: ¡A JUGAR!', cx, 168, { align: 'center' });
    g.text('▲▼ ELEGIR  ◀▶ CAMBIAR  B VOLVER', cx, SCREEN_HEIGHT - 10, { align: 'center', color: 'mid' });
  }
}

// ---------------------------------------------------------------------------
// MyGamesScreen
// ---------------------------------------------------------------------------

const LIST_TOP = 22;
const LIST_ROW = 12;
const LIST_VISIBLE = 12;

export class MyGamesScreen {
  constructor(engine) {
    this.engine = engine;
    this.items = [];
    this.index = 0;
    this.time = 0;
  }

  onEnter() {
    const { storage, catalog } = this.engine;
    const favorites = storage.getFavorites();
    const recent = storage.getRecent().filter((n) => !favorites.includes(n));
    this.items = [
      ...favorites.map((n) => ({ slot: catalog.getSlot(n), favorite: true })),
      ...recent.map((n) => ({ slot: catalog.getSlot(n), favorite: false }))
    ].filter((item) => item.slot);
    this.index = 0;
    this.time = 0;
  }

  handleAction({ action, pressed, repeat }) {
    if (!pressed) return;
    const e = this.engine;
    const count = this.items.length;
    switch (action) {
      case ACTIONS.UP:
        if (count) this.index = (this.index + count - 1) % count;
        e.sound.sfx('move');
        break;
      case ACTIONS.DOWN:
        if (count) this.index = (this.index + 1) % count;
        e.sound.sfx('move');
        break;
      case ACTIONS.A:
        if (repeat || !count) return;
        e.sound.sfx('confirm');
        e.menu.jumpTo(this.items[this.index].slot.number);
        e.openLaunch(this.items[this.index].slot);
        break;
      case ACTIONS.B:
      case ACTIONS.START:
        if (repeat) return;
        e.sound.sfx('back');
        e.closeToMenu();
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
    g.text('MIS JUEGOS', cx, 4, { align: 'center', color: 'bg' });

    if (!this.items.length) {
      g.text('TODAVIA NO HAY NADA', cx, 70, { align: 'center' });
      g.text('LOS JUEGOS QUE JUEGUES', cx, 88, { align: 'center', color: 'mid' });
      g.text('APARECEN AQUI. PARA FIJAR', cx, 96, { align: 'center', color: 'mid' });
      g.text('UNO, MARCALO FAVORITO EN', cx, 104, { align: 'center', color: 'mid' });
      g.text('LA PANTALLA PREPARADO.', cx, 112, { align: 'center', color: 'mid' });
      g.text('B VOLVER', cx, SCREEN_HEIGHT - 10, { align: 'center', color: 'mid' });
      return;
    }

    const first = Math.max(0, Math.min(this.items.length - LIST_VISIBLE, this.index - Math.floor(LIST_VISIBLE / 2)));
    const favoritesCount = this.items.filter((item) => item.favorite).length;
    this.items.forEach((item, i) => {
      if (i < first || i >= first + LIST_VISIBLE) return;
      const y = LIST_TOP + (i - first) * LIST_ROW;
      const selected = i === this.index;
      if (selected) {
        g.rect(4, y - 3, SCREEN_WIDTH - 8, LIST_ROW - 1, 'ghost');
        g.text('▶', 7, y, { color: Math.floor(this.time * 4) % 2 ? 'ink' : 'mid' });
      }
      const { slot } = item;
      g.text(item.favorite ? '♥' : ' ', 14, y, { color: 'magenta' });
      g.text(slot.code, 21, y, { color: slot.engine.color });
      g.text(`${slot.engine.name} ${slot.label}`, 32, y, { color: selected ? 'ink' : 'mid' });
      if (i === favoritesCount && favoritesCount > 0) g.rect(14, y - 4, SCREEN_WIDTH - 28, 1, 'mid');
    });
    g.text('♥ FAVORITOS   RESTO: RECIENTES', cx, SCREEN_HEIGHT - 20, { align: 'center', color: 'mid' });
    g.text('▲▼ ELEGIR  A JUGAR  B VOLVER', cx, SCREEN_HEIGHT - 10, { align: 'center', color: 'mid' });
  }
}
