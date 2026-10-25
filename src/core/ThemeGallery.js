// src/core/ThemeGallery.js
// Galería de temas (Opciones → TEMA → A). Al moverse con la cruceta, el tema se aplica al momento a
// toda la consola (carcasa, pantalla y sonido) como vista previa; A lo guarda y B vuelve al anterior.

import { ACTIONS } from './InputManager.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from './ConsoleEngine.js';
import { THEMES } from './Themes.js';

// Pozo de muestra (6x8 celdas): 0 = apagada; el resto, índice en SAMPLE_COLORS.
const SAMPLE_WELL = [
  '000000',
  '000300',
  '000333',
  '000000',
  '100000',
  '110045',
  '612245',
  '662275'
];
const SAMPLE_COLORS = ['on', 'cyan', 'yellow', 'magenta', 'orange', 'red', 'green', 'blue'];
const SWATCHES = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'magenta', 'mid'];

const CELL = 8;
const WELL_X = 12;
const WELL_Y = 44;

export class ThemeGallery {
  constructor(engine) {
    this.engine = engine;
    this.index = 0;
    this.time = 0;
  }

  onEnter() {
    this.index = Math.max(0, THEMES.indexOf(this.engine.theme));
    this.time = 0;
  }

  get selectedId() {
    return THEMES[this.index];
  }

  _move(dir) {
    const e = this.engine;
    this.index = (this.index + dir + THEMES.length) % THEMES.length;
    this.time = 0;
    e.setTheme(this.selectedId);
    // Muestra del sonido del tema: el jingle de temporada en el estacional, un acorde en los demás.
    e.sound.stopEffects();
    e.sound.sfx(e.themeInfo.jingle || 'coin');
  }

  _accept() {
    const e = this.engine;
    e.updateSetting('theme', this.selectedId);
    e.sound.sfx('confirm');
    e.toast(`TEMA ${e.themeInfo.name}`);
    e.closeThemes();
  }

  /** Sale sin guardar: vuelve el tema que había. */
  cancel() {
    const e = this.engine;
    e.setTheme(e.settings.theme);
    e.sound.sfx('back');
    e.closeThemes();
  }

  handleAction({ action, pressed, repeat }) {
    if (!pressed) return;
    switch (action) {
      case ACTIONS.LEFT:
      case ACTIONS.UP:
        this._move(-1);
        break;
      case ACTIONS.RIGHT:
      case ACTIONS.DOWN:
        this._move(1);
        break;
      case ACTIONS.A:
      case ACTIONS.START:
        if (!repeat) this._accept();
        break;
      case ACTIONS.B:
        if (!repeat) this.cancel();
        break;
      default:
        break;
    }
  }

  update(dt) {
    this.time += dt;
  }

  render(g) {
    const e = this.engine;
    const info = e.themeInfo;
    const cx = SCREEN_WIDTH / 2;
    g.clear();
    g.rect(0, 0, SCREEN_WIDTH, 13, 'ink');
    g.text('TEMAS', 3, 4, { color: 'bg' });
    g.text(`${this.index + 1}/${THEMES.length}`, SCREEN_WIDTH - 3, 4, { align: 'right', color: 'bg' });

    g.text(info.name, cx, 19, { align: 'center', scale: 2 });
    if (info.season) g.text(`AHORA: ${info.seasonName}`, cx, 33, { align: 'center', color: 'mid' });

    this._renderSample(g);

    info.blurb.forEach((line, i) => g.text(line, cx, 120 + i * 9, { align: 'center', color: i === 0 ? 'ink' : 'mid' }));

    // Un punto por tema: el elegido, relleno; el guardado, con marco.
    const dotsW = THEMES.length * 8 - 3;
    const dx = Math.floor(cx - dotsW / 2);
    THEMES.forEach((id, i) => {
      const x = dx + i * 8;
      if (i === this.index) g.rect(x, 152, 5, 5, 'ink');
      else g.rect(x + 1, 153, 3, 3, 'mid');
      if (id === e.settings.theme && i !== this.index) g.frame(x - 1, 151, 7, 7, 'mid');
    });

    const saved = this.selectedId === e.settings.theme;
    if (saved) g.text('TEMA EN USO', cx, 164, { align: 'center', color: 'mid' });
    else if (Math.floor(this.time * 2) % 2 === 0) g.text('A: USAR ESTE TEMA', cx, 164, { align: 'center' });
    g.text('◀▶ VER  A USAR  B CANCELAR', cx, SCREEN_HEIGHT - 10, { align: 'center', color: 'mid' });
  }

  /** Muestra de la pantalla con el tema: pozo con piezas, texto, iconos y muestras de color. */
  _renderSample(g) {
    g.frame(WELL_X - 2, WELL_Y - 2, 6 * CELL + 3, 8 * CELL + 3, 'mid');
    SAMPLE_WELL.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const v = Number(row[c]);
        g.cell(WELL_X + c * CELL, WELL_Y + r * CELL, CELL, v === 0 ? 'off' : SAMPLE_COLORS[v - 1]);
      }
    });
    // Pieza cayendo: baja una fila por segundo dentro de las tres primeras.
    const drop = Math.floor(this.time) % 3;
    g.cell(WELL_X + 1 * CELL, WELL_Y + drop * CELL, CELL, 'on');
    g.cell(WELL_X + 2 * CELL, WELL_Y + drop * CELL, CELL, 'on');

    const rx = 70;
    g.text('PUNTOS', rx, 44, { color: 'mid' });
    g.text('012500', rx, 52, { scale: 2 });
    g.text('NIVEL 05', rx, 66, { color: 'mid' });
    g.text('★★★', rx + 38, 66, { color: 'yellow' });
    g.text('♥ ♪ ▶', rx, 76, { color: 'red' });
    SWATCHES.forEach((color, i) => {
      const x = rx + (i % 4) * (CELL + 2);
      const y = 88 + Math.floor(i / 4) * (CELL + 2);
      g.cell(x, y, CELL, color);
    });
    g.cell(rx + 44, 88, CELL, 'off');
    g.cell(rx + 44, 98, CELL, 'on');
  }
}
