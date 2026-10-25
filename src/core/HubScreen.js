// src/core/HubScreen.js
// Pantalla de START en el menú, con cinco pestañas (◀▶ cambian de pestaña, B o START vuelven):
//   JUEGOS  → favoritos y últimos juegos jugados (A abre PREPARADO);
//   CARRERA → mapa de las 99 etapas del modo carrera, con un jefe cada 10 (A juega la etapa);
//   LOGROS → vitrina de los logros con su icono, su progreso y su premio;
//   RACHA  → días seguidos con el desafío diario y calendario del mes (A juega el de hoy);
//   DATOS  → tiempo jugado (total y por motor), partidas, estrellas y contadores acumulados.

import { ACTIONS } from './InputManager.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from './ConsoleEngine.js';
import { ACHIEVEMENTS, achievementColor, getAchievement } from './Achievements.js';
import { getTheme, shellRewardFor } from './Themes.js';
import { todayKey, CAREER_BOSSES, CAREER_BOSS_SPEED } from './Catalog99.js';

export const HUB_TABS = ['games', 'career', 'achievements', 'streak', 'stats'];
const TAB_LABELS = { games: 'JUEGOS', career: 'CARRERA', achievements: 'LOGROS', streak: 'RACHA', stats: 'DATOS' };

const CONTENT_TOP = 17;
const HINT_Y = 173; // ayuda propia de cada pestaña; debajo va la común (◀▶ PESTAÑA  B SALIR)

// JUEGOS
const LIST_TOP = 22;
const LIST_ROW = 12;
const LIST_VISIBLE = 12;

// CARRERA: mapa de 10x10 casillas; la 100 es la meta
const MAP_COLS = 10;
const MAP_X = 7;
const MAP_Y = 27;
const MAP_W = 13;
const MAP_H = 12;
const TROPHY = getAchievement('perfect10').icon;

// LOGROS: rejilla de 7 columnas con el icono a escala 2
const GRID_COLS = 7;
const GRID_W = 18;
const GRID_H = 16;
const GRID_X = 9;
const GRID_Y = 26;

// RACHA: calendario de lunes a domingo
const CAL_X = 9;
const CAL_COL = 18;
const CAL_ROW = 12;
const CAL_Y = 74;
const MONTHS = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const FLAME = getAchievement('streak7').icon;
const STAR = getAchievement('firststar').icon;

// DATOS
const STATS_ROW = 9;
const STATS_VISIBLE = 17;
const COUNTERS = [
  ['LINEAS', 'total:lines'],
  ['FANTASMAS COMIDOS', 'total:ghosts'],
  ['BOCADOS', 'total:food'],
  ['LADRILLOS', 'total:bricks'],
  ['COCHES ADELANTADOS', 'total:overtakes'],
  ['TANQUES', 'total:tanks'],
  ['NAVES', 'total:ships'],
  ['RANAS A CASA', 'total:frogs'],
  ['TUBERIAS', 'total:pipes'],
  ['SERPIENTE MAS LARGA', 'best:length'],
  ['VELOCIDAD PUNTA', 'best:kmh', ' KM/H'],
  ['MEJOR SECUENCIA', 'best:sequence']
];

/** 3725 s → "1H 02M"; 125 s → "2M 05S". */
export function formatTime(seconds) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}H ${String(m).padStart(2, '0')}M`;
  if (m > 0) return `${m}M ${String(s % 60).padStart(2, '0')}S`;
  return `${s}S`;
}

/** "2026-10-25" → "25/10/2026". */
function formatDay(day) {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

export class HubScreen {
  constructor(engine) {
    this.engine = engine;
    this.tab = 'games';
    this.time = 0;
    this.items = [];
    this.gameIndex = 0;
    this.achIndex = 0;
    this.statsRows = [];
    this.statsScroll = 0;
    this.month = 0;
    this.careerStage = 1;
  }

  open(tab = 'games') {
    this.tab = HUB_TABS.includes(tab) ? tab : 'games';
    this.time = 0;
    this._loadGames();
    this.gameIndex = 0;
    this.careerStage = this.engine.progress.careerInfo().current;
    this.statsScroll = 0;
    const now = new Date();
    this.month = now.getFullYear() * 12 + now.getMonth();
    this._buildStats();
  }

  _loadGames() {
    const { storage, catalog } = this.engine;
    const favorites = storage.getFavorites();
    const recent = storage.getRecent().filter((n) => !favorites.includes(n));
    this.items = [
      ...favorites.map((n) => ({ slot: catalog.getSlot(n), favorite: true })),
      ...recent.map((n) => ({ slot: catalog.getSlot(n), favorite: false }))
    ].filter((item) => item.slot);
  }

  // ---------- Entrada ----------

  handleAction({ action, pressed, repeat }) {
    if (!pressed) return;
    const e = this.engine;
    if (action === ACTIONS.LEFT || action === ACTIONS.RIGHT) {
      const i = HUB_TABS.indexOf(this.tab);
      const dir = action === ACTIONS.LEFT ? -1 : 1;
      this.tab = HUB_TABS[(i + dir + HUB_TABS.length) % HUB_TABS.length];
      if (this.tab === 'stats') this._buildStats();
      e.sound.sfx('rotate');
      return;
    }
    if (action === ACTIONS.B || action === ACTIONS.START) {
      if (repeat) return;
      e.sound.sfx('back');
      e.closeToMenu();
      return;
    }
    const dir = action === ACTIONS.UP ? -1 : action === ACTIONS.DOWN ? 1 : 0;
    switch (this.tab) {
      case 'games':
        if (dir && this.items.length) {
          this.gameIndex = (this.gameIndex + dir + this.items.length) % this.items.length;
          e.sound.sfx('move');
        } else if (action === ACTIONS.A && !repeat && this.items.length) {
          const { slot } = this.items[this.gameIndex];
          e.sound.sfx('confirm');
          e.menu.jumpTo(slot.number);
          e.openLaunch(slot);
        }
        break;
      case 'career': {
        const info = e.progress.careerInfo();
        const last = info.finished ? info.total : info.current;
        if (dir) {
          const next = Math.max(1, Math.min(last, this.careerStage + dir));
          if (next !== this.careerStage) {
            this.careerStage = next;
            e.sound.sfx('move');
          }
        } else if (action === ACTIONS.A && !repeat) {
          e.sound.sfx('confirm');
          e.menu.jumpTo(this.careerStage);
          e.launch(e.catalog.careerSlot(this.careerStage));
        }
        break;
      }
      case 'achievements':
        if (dir) {
          this.achIndex = (this.achIndex + dir + ACHIEVEMENTS.length) % ACHIEVEMENTS.length;
          e.sound.sfx('move');
        }
        break;
      case 'streak':
        if (dir) {
          const { min, max } = this._monthRange();
          const next = Math.max(min, Math.min(max, this.month + dir));
          if (next !== this.month) {
            this.month = next;
            e.sound.sfx('move');
          }
        } else if (action === ACTIONS.A && !repeat) {
          e.sound.sfx('confirm');
          e.menu.jumpTo(0);
          e.launch(e.catalog.dailyChallenge());
        }
        break;
      case 'stats':
        if (dir) {
          const max = Math.max(0, this.statsRows.length - STATS_VISIBLE);
          const next = Math.max(0, Math.min(max, this.statsScroll + dir));
          if (next !== this.statsScroll) {
            this.statsScroll = next;
            e.sound.sfx('move');
          }
        }
        break;
      default:
        break;
    }
  }

  update(dt) {
    this.time += dt;
  }

  // ---------- Dibujo ----------

  render(g) {
    g.clear();
    this._renderTabs(g);
    if (this.tab === 'games') this._renderGames(g);
    else if (this.tab === 'career') this._renderCareer(g);
    else if (this.tab === 'achievements') this._renderAchievements(g);
    else if (this.tab === 'streak') this._renderStreak(g);
    else this._renderStats(g);
    g.text('◀▶ PESTAÑA    B SALIR', SCREEN_WIDTH / 2, SCREEN_HEIGHT - 10, { align: 'center', color: 'mid' });
  }

  /** Pestañas de ancho variable: cada una mide su texto más una parte igual del espacio sobrante. */
  _renderTabs(g) {
    g.rect(0, 0, SCREEN_WIDTH, 13, 'ink');
    const widths = HUB_TABS.map((id) => g.textWidth(TAB_LABELS[id]));
    const pad = (SCREEN_WIDTH - widths.reduce((sum, w) => sum + w, 0)) / HUB_TABS.length;
    let x = 0;
    HUB_TABS.forEach((id, i) => {
      const left = Math.round(x);
      x += widths[i] + pad;
      const right = Math.round(x);
      const selected = id === this.tab;
      if (selected) g.rect(left + 1, 1, right - left - 2, 12, 'bg');
      g.text(TAB_LABELS[id], Math.round((left + right) / 2), 4, { align: 'center', color: selected ? 'ink' : 'bg' });
    });
  }

  _hint(g, text) {
    g.text(text, SCREEN_WIDTH / 2, HINT_Y, { align: 'center', color: 'mid' });
  }

  _blink(speed = 4) {
    return Math.floor(this.time * speed) % 2 === 0;
  }

  // JUEGOS

  _renderGames(g) {
    const cx = SCREEN_WIDTH / 2;
    if (!this.items.length) {
      g.text('TODAVIA NO HAY NADA', cx, 64, { align: 'center' });
      g.text('LOS JUEGOS QUE JUEGUES', cx, 82, { align: 'center', color: 'mid' });
      g.text('APARECEN AQUI. PARA FIJAR', cx, 90, { align: 'center', color: 'mid' });
      g.text('UNO, MARCALO FAVORITO EN', cx, 98, { align: 'center', color: 'mid' });
      g.text('LA PANTALLA PREPARADO.', cx, 106, { align: 'center', color: 'mid' });
      return;
    }
    const first = Math.max(0, Math.min(this.items.length - LIST_VISIBLE, this.gameIndex - Math.floor(LIST_VISIBLE / 2)));
    const favoritesCount = this.items.filter((item) => item.favorite).length;
    this.items.forEach((item, i) => {
      if (i < first || i >= first + LIST_VISIBLE) return;
      const y = LIST_TOP + (i - first) * LIST_ROW;
      const selected = i === this.gameIndex;
      if (selected) {
        g.rect(4, y - 3, SCREEN_WIDTH - 8, LIST_ROW - 1, 'ghost');
        g.text('▶', 7, y, { color: this._blink() ? 'ink' : 'mid' });
      }
      const { slot } = item;
      g.text(item.favorite ? '♥' : ' ', 14, y, { color: 'magenta' });
      g.text(slot.code, 21, y, { color: slot.engine.color });
      g.text(`${slot.engine.name} ${slot.label}`, 32, y, { color: selected ? 'ink' : 'mid' });
      if (i === favoritesCount && favoritesCount > 0) g.rect(14, y - 4, SCREEN_WIDTH - 28, 1, 'mid');
    });
    this._hint(g, '▲▼ ELEGIR  A JUGAR  ♥ FAVORITO');
  }

  // CARRERA

  _renderCareer(g) {
    const e = this.engine;
    const info = e.progress.careerInfo();
    const cx = SCREEN_WIDTH / 2;
    g.text(`CARRERA ${info.cleared}/${info.total}`, 4, CONTENT_TOP + 1);
    g.text(`JEFES ${info.bosses}/${CAREER_BOSSES}`, SCREEN_WIDTH - 4, CONTENT_TOP + 1, { align: 'right', color: 'red' });

    for (let stage = 1; stage <= info.total; stage++) {
      const idx = stage - 1;
      const x = MAP_X + (idx % MAP_COLS) * MAP_W;
      const y = MAP_Y + Math.floor(idx / MAP_COLS) * MAP_H;
      const boss = e.catalog.isCareerBoss(stage);
      const label = String(stage).padStart(2, '0');
      const tx = x + Math.floor(MAP_W / 2) + 1;
      if (stage <= info.cleared) {
        g.rect(x + 1, y, MAP_W - 2, MAP_H - 2, boss ? 'red' : 'ink');
        g.text(label, tx, y + 3, { align: 'center', color: 'bg' });
      } else if (stage === info.current) {
        g.rect(x + 1, y, MAP_W - 2, MAP_H - 2, 'ghost');
        if (boss) g.frame(x + 1, y, MAP_W - 2, MAP_H - 2, 'red');
        g.text(label, tx, y + 3, { align: 'center', color: 'ink' });
      } else {
        if (boss) g.frame(x + 1, y, MAP_W - 2, MAP_H - 2, 'mid');
        g.text(label, tx, y + 3, { align: 'center', color: boss ? 'mid' : 'ghost' });
      }
      if (stage === this.careerStage) g.frame(x, y - 1, MAP_W, MAP_H, this._blink() ? 'yellow' : 'ink');
    }
    // Casilla 100: la meta, con el trofeo encendido al completar la carrera.
    const tx = MAP_X + (info.total % MAP_COLS) * MAP_W;
    const ty = MAP_Y + Math.floor(info.total / MAP_COLS) * MAP_H;
    g.sprite(TROPHY, tx + 3, ty + 1, { colors: { '#': info.finished ? 'yellow' : 'ghost' } });

    const slot = e.catalog.careerSlot(this.careerStage);
    const { boss, need } = slot.career;
    const y = MAP_Y + MAP_COLS * MAP_H + 4;
    g.text(`${slot.code} ${slot.engine.name} ${slot.label}`, cx, y, { align: 'center', color: slot.engine.color });
    let line;
    let color = 'mid';
    if (this.careerStage <= info.cleared) {
      line = boss ? '★ JEFE DERROTADO ★' : 'ETAPA SUPERADA';
      color = 'green';
    } else {
      const goal = `${'★'.repeat(need)} ${slot.engine.stars[need - 1]}`;
      line = boss ? `JEFE VEL ${CAREER_BOSS_SPEED} - META ${goal}` : `META ${goal} PUNTOS`;
      if (boss) color = 'red';
    }
    if (info.finished && this.careerStage === info.total) {
      line = '¡CARRERA COMPLETA!';
      color = this._blink(2) ? 'yellow' : 'green';
    }
    g.text(line, cx, y + 9, { align: 'center', color });
    this._hint(g, info.cleared === 0 ? '▲▼ ETAPA   A EMPEZAR' : '▲▼ ETAPA   A JUGAR');
  }

  // LOGROS

  _renderAchievements(g) {
    const p = this.engine.progress;
    const cx = SCREEN_WIDTH / 2;
    const done = p.unlockedCount();
    g.text(`LOGROS ${done}/${ACHIEVEMENTS.length}`, 4, CONTENT_TOP + 1);
    const barX = 72;
    const barW = SCREEN_WIDTH - barX - 4;
    g.frame(barX, CONTENT_TOP + 1, barW, 5, 'mid');
    g.rect(barX + 1, CONTENT_TOP + 2, Math.round(((barW - 2) * done) / ACHIEVEMENTS.length), 3, 'yellow');

    ACHIEVEMENTS.forEach((a, i) => {
      const x = GRID_X + (i % GRID_COLS) * GRID_W;
      const y = GRID_Y + Math.floor(i / GRID_COLS) * GRID_H;
      const unlocked = p.isUnlocked(a.id);
      const colors = unlocked ? { '#': achievementColor(a), '+': 'mid' } : { '#': 'ghost', '+': 'ghost' };
      g.sprite(a.icon, x + 2, y + 1, { scale: 2, colors });
      if (i === this.achIndex) g.frame(x, y - 1, GRID_W, GRID_H, this._blink() ? 'ink' : 'mid');
    });

    const a = ACHIEVEMENTS[this.achIndex];
    const unlocked = p.isUnlocked(a.id);
    const y = GRID_Y + Math.ceil(ACHIEVEMENTS.length / GRID_COLS) * GRID_H + 3;
    g.text(a.name, cx, y, { align: 'center', color: unlocked ? achievementColor(a) : 'ink' });
    g.text(a.desc, cx, y + 9, { align: 'center', color: 'mid' });
    if (unlocked) {
      g.text(`CONSEGUIDO EL ${formatDay(p.unlockedOn(a.id))}`, cx, y + 19, { align: 'center', color: 'green' });
    } else {
      const { value, goal } = p.progressOf(a);
      const time = a.stat === 'playTime';
      const label = time ? `${Math.floor(value / 60)}/${goal / 60} MIN` : `${value}/${goal}`;
      const bw = 70;
      const bx = 8;
      g.frame(bx, y + 19, bw, 5, 'mid');
      g.rect(bx + 1, y + 20, Math.round(((bw - 2) * value) / goal), 3, 'cyan');
      g.text(label, SCREEN_WIDTH - 8, y + 19, { align: 'right' });
    }
    const reward = shellRewardFor(a.id);
    if (reward) {
      g.text(`PREMIO: CARCASA ${getTheme(reward.theme).name} ${reward.shell.name}`, cx, y + 29, { align: 'center', color: 'yellow' });
    } else if (a.engine) {
      const engineDef = this.engine.catalog.engines.find((en) => en.id === a.engine);
      if (engineDef) g.text(engineDef.name, cx, y + 29, { align: 'center', color: engineDef.color });
    }
    this._hint(g, '▲▼ VER LOGROS');
  }

  // RACHA

  /** Meses que se pueden ver: desde el del primer desafío jugado hasta el actual. */
  _monthRange() {
    const now = new Date();
    const max = now.getFullYear() * 12 + now.getMonth();
    const first = this.engine.progress.streakInfo(now).first;
    const [y, m] = first.split('-').map(Number);
    return { min: Math.min(max, y * 12 + (m - 1)), max };
  }

  _renderStreak(g) {
    const p = this.engine.progress;
    const info = p.streakInfo();
    const cx = SCREEN_WIDTH / 2;

    g.sprite(FLAME, 6, CONTENT_TOP + 1, { scale: 3, colors: { '#': info.current > 0 ? 'orange' : 'ghost', '+': info.current > 0 ? 'yellow' : 'ghost' } });
    g.text(String(info.current), 32, CONTENT_TOP + 2, { scale: 3 });
    g.text(info.current === 1 ? 'DIA SEGUIDO' : 'DIAS SEGUIDOS', 32, CONTENT_TOP + 20, { color: 'mid' });

    // Estrellas especiales de los 7 y los 30 días.
    [
      ['streak7', '7', 102],
      ['streak30', '30', 126]
    ].forEach(([id, label, x]) => {
      const lit = p.isUnlocked(id);
      g.sprite(STAR, x - 7, CONTENT_TOP + 1, { scale: 2, colors: { '#': lit ? 'yellow' : 'ghost' } });
      g.text(label, x, CONTENT_TOP + 17, { align: 'center', color: lit ? 'yellow' : 'mid' });
    });

    g.text(`MEJOR RACHA ${info.best}   JUGADOS ${info.total}`, cx, CONTENT_TOP + 29, { align: 'center', color: 'mid' });

    // Mes
    const year = Math.floor(this.month / 12);
    const month = this.month % 12;
    const { min, max } = this._monthRange();
    const titleY = 55;
    g.text(`${MONTHS[month]} ${year}`, cx, titleY, { align: 'center' });
    g.text('▲', 8, titleY, { color: this.month > min ? 'mid' : 'ghost' });
    g.text('▼', SCREEN_WIDTH - 11, titleY, { color: this.month < max ? 'mid' : 'ghost' });
    WEEKDAYS.forEach((d, i) => g.text(d, CAL_X + i * CAL_COL + CAL_COL / 2, 65, { align: 'center', color: i >= 5 ? 'cyan' : 'mid' }));

    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const idx = offset + d - 1;
      const x = CAL_X + (idx % 7) * CAL_COL;
      const y = CAL_Y + Math.floor(idx / 7) * CAL_ROW;
      const key = todayKey(new Date(year, month, d));
      const played = p.hasPlayedDaily(key);
      const isToday = key === info.today;
      let color = key > info.today ? 'ghost' : 'mid';
      if (played) {
        g.rect(x + 2, y - 2, CAL_COL - 4, CAL_ROW - 3, 'ink');
        color = 'bg';
      } else if (isToday) {
        color = 'ink';
      }
      if (isToday) g.frame(x + 1, y - 3, CAL_COL - 2, CAL_ROW - 1, this._blink(2) ? 'yellow' : 'ink');
      g.text(String(d), x + CAL_COL / 2, y, { align: 'center', color });
    }

    const statusY = 149;
    if (info.playedToday) {
      g.text('HOY: DESAFIO HECHO ★', cx, statusY, { align: 'center', color: 'green' });
      g.text('VUELVE MAÑANA A POR OTRO', cx, statusY + 10, { align: 'center', color: 'mid' });
    } else {
      if (this._blink(2)) g.text('A: JUGAR EL DESAFIO DE HOY', cx, statusY, { align: 'center', color: 'yellow' });
      g.text(info.current > 0 ? '¡QUE NO SE ROMPA LA RACHA!' : 'JUEGALO CADA DIA', cx, statusY + 10, { align: 'center', color: info.current > 0 ? 'red' : 'mid' });
    }
    this._hint(g, '▲▼ MES   A DESAFIO DE HOY');
  }

  // DATOS

  _buildStats() {
    const e = this.engine;
    const p = e.progress;
    const st = p.stats;
    const engines = e.catalog.engines;
    const { stars } = p.starStats();
    const streak = p.streakInfo();
    const rows = [];
    rows.push({ head: 'GENERAL' });
    rows.push({ label: 'TIEMPO JUGADO', value: formatTime(st.playTime) });
    rows.push({ label: 'PARTIDAS', value: st.games });
    rows.push({ label: 'RECORDS BATIDOS', value: st.records });
    rows.push({ label: 'ESTRELLAS', value: `${stars}/${e.catalog.slots.length * 3}` });
    rows.push({ label: 'SLOTS JUGADOS', value: `${st.slots.length}/${e.catalog.slots.length}` });
    const career = p.careerInfo();
    rows.push({ label: 'CARRERA', value: `${career.cleared}/${career.total}` });
    rows.push({ label: 'JEFES DERROTADOS', value: `${career.bosses}/${CAREER_BOSSES}` });
    rows.push({ label: 'LOGROS', value: `${p.unlockedCount()}/${ACHIEVEMENTS.length}` });
    rows.push({ label: 'DESAFIOS JUGADOS', value: streak.total });
    rows.push({ label: 'MEJOR RACHA', value: streak.best });
    const favorite = engines.find((en) => en.id === p.favoriteEngine());
    rows.push({ label: 'MOTOR FAVORITO', value: favorite ? favorite.name : '-', color: favorite ? favorite.color : 'mid' });

    rows.push({ gap: true });
    rows.push({ head: 'TIEMPO POR MOTOR' });
    const maxTime = Math.max(1, ...engines.map((en) => st.perEngine[en.id]?.time || 0));
    for (const en of engines) {
      const time = st.perEngine[en.id]?.time || 0;
      rows.push({ bar: true, label: en.name, color: en.color, frac: time / maxTime, value: time > 0 ? formatTime(time) : '-' });
    }

    rows.push({ gap: true });
    rows.push({ head: 'CONTADORES' });
    for (const [label, stat, suffix = ''] of COUNTERS) {
      const value = p.value(stat);
      rows.push({ label, value: value > 0 ? `${value}${suffix}` : '-' });
    }
    this.statsRows = rows;
    this.statsScroll = Math.min(this.statsScroll, Math.max(0, rows.length - STATS_VISIBLE));
  }

  _renderStats(g) {
    const rows = this.statsRows;
    const right = SCREEN_WIDTH - 6;
    for (let i = 0; i < STATS_VISIBLE; i++) {
      const row = rows[this.statsScroll + i];
      if (!row || row.gap) continue;
      const y = CONTENT_TOP + 2 + i * STATS_ROW;
      if (row.head) {
        g.text(row.head, 4, y, { color: 'yellow' });
        g.rect(g.textWidth(row.head) + 8, y + 2, right - g.textWidth(row.head) - 8, 1, 'mid');
      } else if (row.bar) {
        g.text(row.label, 4, y, { color: row.color });
        const bx = 58;
        const bw = 42;
        g.rect(bx, y + 1, bw, 3, 'ghost');
        if (row.frac > 0) g.rect(bx, y + 1, Math.max(1, Math.round(bw * row.frac)), 3, row.color);
        g.text(row.value, right, y, { align: 'right' });
      } else {
        g.text(row.label, 4, y, { color: 'mid' });
        g.text(String(row.value), right, y, { align: 'right', color: row.color || 'ink' });
      }
    }
    if (this.statsScroll > 0) g.text('▲', SCREEN_WIDTH - 4, CONTENT_TOP, { color: 'mid' });
    if (this.statsScroll < rows.length - STATS_VISIBLE) g.text('▼', SCREEN_WIDTH - 4, HINT_Y - 8, { color: 'mid' });
    this._hint(g, '▲▼ DESPLAZAR');
  }
}
