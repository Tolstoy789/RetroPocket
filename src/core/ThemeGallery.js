// src/core/ThemeGallery.js
// Galería de temas (Opciones → TEMA → A). Con ◀▶ el tema se aplica al momento a toda la consola
// (carcasa, pantalla y sonido) como vista previa; en los temas con colores de carcasa (Retro y Cristal),
// ▲▼ los prueban. Los colores que regalan los logros se pueden mirar aunque estén bloqueados, pero
// solo se guardan si ya se consiguió el logro. A guarda y B vuelve a lo que había.

import { ACTIONS } from './InputManager.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from './ConsoleEngine.js';
import { THEMES, shellsFor, shellLabel } from './Themes.js';
import { getAchievement } from './Achievements.js';

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
    this.shellIndex = 0;
    this.time = 0;
  }

  onEnter() {
    this.index = Math.max(0, THEMES.indexOf(this.engine.theme));
    this._syncShell();
    this.time = 0;
  }

  get selectedId() {
    return THEMES[this.index];
  }

  get shells() {
    return shellsFor(this.selectedId);
  }

  get selectedShell() {
    return this.shells[this.shellIndex] || null;
  }

  /** ¿Se puede guardar el color de carcasa que se está viendo? */
  get shellLocked() {
    const shell = this.selectedShell;
    return !!shell && !this.engine.progress.isShellUnlocked(this.selectedId, shell.id);
  }

  /** Coloca el selector de carcasa en el color guardado del tema elegido. */
  _syncShell() {
    const saved = this.engine.savedShell(this.selectedId);
    this.shellIndex = Math.max(0, this.shells.findIndex((s) => s.id === saved));
  }

  _move(dir) {
    const e = this.engine;
    this.index = (this.index + dir + THEMES.length) % THEMES.length;
    this.time = 0;
    this._syncShell();
    e.setTheme(this.selectedId, this.selectedShell?.id);
    // Muestra del sonido del tema: el jingle de temporada en el estacional, un acorde en los demás.
    e.sound.stopEffects();
    e.sound.sfx(e.themeInfo.jingle || 'coin');
  }

  _moveShell(dir) {
    const e = this.engine;
    const list = this.shells;
    if (list.length < 2) return;
    this.shellIndex = (this.shellIndex + dir + list.length) % list.length;
    this.time = 0;
    e.setTheme(this.selectedId, this.selectedShell.id);
    e.sound.sfx(this.shellLocked ? 'bounce' : 'select');
  }

  _accept() {
    const e = this.engine;
    if (this.shellLocked) {
      e.sound.sfx('error');
      e.toast('CARCASA BLOQUEADA');
      return;
    }
    e.updateSetting('theme', this.selectedId);
    if (this.selectedShell) e.saveShell(this.selectedId, this.selectedShell.id);
    e.sound.sfx('confirm');
    e.toast(this.selectedShell && this.shellIndex > 0 ? shellLabel(this.selectedId, this.selectedShell) : `TEMA ${e.themeInfo.name}`);
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
        this._move(-1);
        break;
      case ACTIONS.RIGHT:
        this._move(1);
        break;
      case ACTIONS.UP:
      case ACTIONS.DOWN:
        // En los temas sin colores de carcasa, ▲▼ también cambian de tema.
        if (this.shells.length > 1) this._moveShell(action === ACTIONS.UP ? -1 : 1);
        else this._move(action === ACTIONS.UP ? -1 : 1);
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

  /** Lo que lee el lector de pantalla (ver Announcer.js): el tema, su carcasa y si está bloqueada. */
  describe() {
    const info = this.engine.themeInfo;
    const shell = this.selectedShell;
    const parts = [`TEMA ${info.name}`];
    if (shell) parts.push(shellLabel(this.selectedId, shell));
    if (this.shellLocked) {
      const reward = getAchievement(shell.unlock);
      parts.push('CARCASA BLOQUEADA', reward ? `LOGRO: ${reward.name}` : '');
    }
    return parts.filter(Boolean);
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

    const shells = this.shells;
    const shell = this.selectedShell;
    const lines = shell ? [shellLabel(this.selectedId, shell), ...info.blurb.slice(1)] : info.blurb;
    const small = g.tooWideForBig(lines, SCREEN_WIDTH - 2);
    lines.forEach((line, i) => g.text(line, cx, 117 + i * 8, { align: 'center', color: i === 0 ? 'ink' : 'mid', small }));

    // Colores de carcasa: el que se ve, más grande; los bloqueados, solo con el contorno.
    if (shells.length > 1) {
      const sw = shells.length * 10 - 3;
      const sx = Math.floor(cx - sw / 2);
      shells.forEach((s, i) => {
        const x = sx + i * 10;
        const unlocked = e.progress.isShellUnlocked(this.selectedId, s.id);
        if (i === this.shellIndex) g.frame(x - 2, 141, 11, 9, 'ink');
        if (unlocked) g.rect(x, 143, 7, 5, s.swatch);
        else g.frame(x, 143, 7, 5, 'mid');
      });
    }

    // Un punto por tema: el elegido, relleno; el guardado, con marco.
    const dotsW = THEMES.length * 8 - 3;
    const dx = Math.floor(cx - dotsW / 2);
    THEMES.forEach((id, i) => {
      const x = dx + i * 8;
      if (i === this.index) g.rect(x, 154, 5, 5, 'ink');
      else g.rect(x + 1, 155, 3, 3, 'mid');
      if (id === e.settings.theme && i !== this.index) g.frame(x - 1, 153, 7, 7, 'mid');
    });

    const blink = Math.floor(this.time * 2) % 2 === 0;
    if (this.shellLocked) {
      const reward = getAchievement(shell.unlock);
      g.text('CARCASA BLOQUEADA', cx, 164, { align: 'center', color: 'red' });
      g.text(`LOGRO: ${reward ? reward.name : '?'}`, cx, 172, { align: 'center', color: blink ? 'yellow' : 'mid' });
    } else {
      const saved = this.selectedId === e.settings.theme && (!shell || shell.id === (e.savedShell(this.selectedId) || shells[0].id));
      if (saved) g.text('TEMA EN USO', cx, 166, { align: 'center', color: 'mid' });
      else if (blink) g.text('A: USAR ESTE TEMA', cx, 166, { align: 'center' });
    }
    const help = shells.length > 1 ? '◀▶ TEMA ▲▼ CARCASA A USAR B SALIR' : '◀▶ VER  A USAR  B CANCELAR';
    g.text(help, cx, SCREEN_HEIGHT - 10, { align: 'center', color: 'mid' });
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

    // Imita el marcador de un juego: con la fuente 3x5 aunque TEXTO GRANDE esté activo.
    const rx = 70;
    g.text('PUNTOS', rx, 44, { color: 'mid', small: true });
    g.text('012500', rx, 52, { scale: 2 });
    g.text('NIVEL 05', rx, 66, { color: 'mid', small: true });
    g.text('★★★', rx + 38, 66, { color: 'yellow', small: true });
    g.text('♥ ♪ ▶', rx, 76, { color: 'red', small: true });
    SWATCHES.forEach((color, i) => {
      const x = rx + (i % 4) * (CELL + 2);
      const y = 88 + Math.floor(i / 4) * (CELL + 2);
      g.cell(x, y, CELL, color);
    });
    g.cell(rx + 44, 88, CELL, 'off');
    g.cell(rx + 44, 98, CELL, 'on');
  }
}
