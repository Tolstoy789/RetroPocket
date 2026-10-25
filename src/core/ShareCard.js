// src/core/ShareCard.js
// Tarjeta PNG para compartir una puntuación (START en la pantalla de fin de partida).
// Dibuja la consola con su carcasa y su tema: el bisel con su rótulo, la pantalla con la última imagen de
// la partida y un panel con el juego, los puntos y las estrellas, la marca y los botones. Todo sale del
// canvas, sin imágenes ni fuentes externas. Los colores de la carcasa se leen de las variables CSS del tema
// activo (y del color de carcasa elegido), así que la tarjeta lleva la misma consola que se ve en pantalla.

import { Gfx, SCREEN_WIDTH, SCREEN_HEIGHT, APP_VERSION } from './ConsoleEngine.js';

const CARD_W = 720;
const CARD_H = 1040;
const LCD_SCALE = 3;
const BODY = { x: 48, y: 36, w: 624, h: 912, r: [36, 36, 120, 36] };
const BEZEL = { x: 96, y: 76, w: 528, h: 664, r: [18, 18, 60, 18] };
const LCD = { x: 144, y: 124 };
const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

// Temas cuya carcasa no sale de --shell (plástico oscuro con neón, cristal translúcido o metal).
const BODY_OVERRIDES = {
  future: [
    [0, '#1b1f38'],
    [0.55, '#0e1022'],
    [1, '#07080f']
  ],
  'retro:gold': [
    [0, '#fff1b8'],
    [0.22, '#e7b730'],
    [0.46, '#c08a12'],
    [0.64, '#f3cf5c'],
    [0.84, '#b88410'],
    [1, '#8e6306']
  ],
  'retro:platinum': [
    [0, '#ffffff'],
    [0.2, '#d6d9df'],
    [0.44, '#a9aeb7'],
    [0.62, '#eef0f3'],
    [0.82, '#a3a8b1'],
    [1, '#7d828b']
  ]
};

/** Colores de la consola tal como los pinta el CSS ahora mismo. */
function readSkin(theme, shell) {
  const root = getComputedStyle(document.documentElement);
  const v = (name, fallback) => root.getPropertyValue(name).trim() || fallback;
  const css = (selector, prop, fallback) => {
    const el = document.querySelector(selector);
    const value = el ? getComputedStyle(el)[prop] : '';
    return value && value !== 'rgba(0, 0, 0, 0)' ? value : fallback;
  };
  const skin = {
    page: [v('--page-light', '#2a2d42'), v('--page', '#1b1d2a')],
    body: [
      [0, v('--shell-light', '#f3d968')],
      [0.35, v('--shell', '#e5c33a')],
      [0.7, v('--shell', '#e5c33a')],
      [1, v('--shell-dark', '#b38f1c')]
    ],
    edge: v('--shell-dark', '#b38f1c'),
    bezel: [v('--bezel', '#2d3042'), v('--bezel-dark', '#1d1f2c')],
    bezelText: css('.bezel__label', 'color', v('--bezel-text', '#9aa0bd')),
    stripes: [v('--stripe-a', '#8a2b5c'), v('--stripe-b', '#2b4a8a')],
    led: v('--led-on', '#ff3b3b'),
    brand: css('.brand__name', 'color', v('--brand', '#283a8c')),
    model: css('.brand__model', 'color', v('--btn-red-dark', '#8f1d20')),
    tagBg: css('#brand-tag', 'backgroundColor', v('--tag-bg', '#ff2bd6')),
    tagFg: css('#brand-tag', 'color', v('--tag-fg', '#05050f')),
    button: [v('--btn-red', '#d6383b'), v('--btn-red-dark', '#8f1d20')],
    buttonRing: '',
    bezelStroke: '',
    dpad: v('--dpad', '#26283a'),
    glass: false
  };
  if (theme === 'future') {
    skin.page = ['#1a1240', '#05050f'];
    skin.edge = 'rgba(0, 240, 255, 0.45)';
    skin.bezel = ['#080914', '#03030a'];
    skin.button = ['#1d1f3a', '#0a0b18'];
    skin.buttonRing = '#ff2bd6';
    skin.dpad = '#171a33';
  } else if (theme === 'crystal') {
    skin.page = [v('--glass-page-a', '#3a2d5c'), v('--glass-page-b', '#140f22')];
    skin.body = [
      [0, v('--glass-hi', 'rgba(190, 160, 255, 0.55)')],
      [0.5, v('--glass-mid', 'rgba(120, 80, 200, 0.5)')],
      [1, v('--glass-low', 'rgba(70, 40, 130, 0.6)')]
    ];
    skin.edge = v('--glass-edge', 'rgba(50, 25, 100, 0.6)');
    skin.bezel = [v('--glass-bezel-a', 'rgba(40, 30, 70, 0.85)'), v('--glass-bezel-b', 'rgba(25, 18, 45, 0.9)')];
    skin.button = [v('--glass-btn', 'rgba(200, 170, 255, 0.6)'), v('--glass-btn-low', 'rgba(110, 70, 190, 0.75)')];
    skin.dpad = v('--glass-btn-low', 'rgba(110, 70, 190, 0.75)');
    skin.glass = true;
  } else if (theme === 'paper') {
    const paper = v('--paper', '#fbfaf4');
    const pen = v('--pen', '#1f3a9e');
    skin.edge = pen;
    skin.bezel = [paper, paper];
    skin.bezelStroke = pen;
    skin.button = [paper, paper];
    skin.buttonRing = pen;
    skin.dpad = pen;
  }
  skin.body = BODY_OVERRIDES[`${theme}:${shell}`] || BODY_OVERRIDES[theme] || skin.body;
  return skin;
}

function roundedPath(ctx, x, y, w, h, [tl, tr, br, bl]) {
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.arcTo(x + w, y, x + w, y + h, tr);
  ctx.arcTo(x + w, y + h, x, y + h, br);
  ctx.arcTo(x, y + h, x, y, bl);
  ctx.arcTo(x, y, x + w, y, tl);
  ctx.closePath();
}

/** Degradado lineal con el ángulo de CSS (0deg = hacia arriba, 90deg = hacia la derecha). */
function cssGradient(ctx, { x, y, w, h }, degrees, stops) {
  const a = (degrees * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const gradient = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  return gradient;
}

/** ¿Es claro un color CSS? (para que el pie de la tarjeta se lea sobre el fondo). */
function isLight(color) {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

/** Pantalla de 144x192: la última imagen del cartucho, velada, con el panel de la puntuación. */
function renderScreen(engine, slot, result, date) {
  const canvas = document.createElement('canvas');
  canvas.width = SCREEN_WIDTH;
  canvas.height = SCREEN_HEIGHT;
  const g = new Gfx(canvas.getContext('2d', { alpha: false }), SCREEN_WIDTH, SCREEN_HEIGHT);
  g.colorblind = engine.gfx.colorblind;
  g.highContrast = engine.gfx.highContrast;
  g.setTheme(engine.theme);
  g.clear();
  try {
    engine.cartridge?.render(g);
  } catch {
    g.clear();
  }

  const cx = SCREEN_WIDTH / 2;
  const career = result.career;
  g.veil();
  const x = 10;
  const y = 22;
  const w = SCREEN_WIDTH - 20;
  const h = 148;
  g.panel(x, y, w, h);

  let headline = 'MI PUNTUACION';
  let headColor = 'ink';
  if (result.isHighScore) {
    headline = '¡NUEVO RECORD!';
    headColor = 'yellow';
  } else if (career?.passed) {
    headline = career.finished ? '¡CARRERA COMPLETA!' : career.boss ? '¡JEFE DERROTADO!' : 'ETAPA SUPERADA';
    headColor = 'green';
  } else if (result.won) {
    headline = 'VICTORIA';
    headColor = 'green';
  }
  g.text(headline, cx, y + 8, { align: 'center', color: headColor });
  g.rect(x + 8, y + 17, w - 16, 1, 'mid');

  const where = slot.daily ? 'DESAFIO DIARIO' : career ? `CARRERA ETAPA ${career.stage}/${engine.catalog.slots.length}` : `JUEGO ${slot.code}`;
  g.text(where, cx, y + 23, { align: 'center', color: 'mid' });
  g.text(slot.engine.name, cx, y + 33, { align: 'center', scale: 2, color: slot.engine.color });
  const variant = slot.daily ? `${engine.catalog.getSlot(slot.baseNumber)?.label || ''} ${slot.label}` : slot.label;
  g.text(variant.trim(), cx, y + 47, { align: 'center', color: 'mid' });

  g.text(String(result.score), cx, y + 60, { align: 'center', scale: 3 });
  g.text('PUNTOS', cx, y + 79, { align: 'center', color: 'mid' });
  engine.drawStars(g, cx - 14, y + 89, result.stars, result.stars, 2);

  g.rect(x + 8, y + 104, w - 16, 1, 'mid');
  g.text(`NIVEL ${result.level || 1}`, x + 8, y + 110, { color: 'mid' });
  g.text(date, x + w - 8, y + 110, { align: 'right', color: 'mid' });
  if (career?.passed && result.isHighScore) {
    const stage = career.finished ? '¡CARRERA COMPLETA!' : career.boss ? '¡JEFE DERROTADO!' : 'ETAPA SUPERADA';
    g.text(stage, cx, y + 121, { align: 'center', color: 'green' });
  } else if (result.rank > 0) {
    g.text(`PUESTO ${result.rank} DEL TOP 5`, cx, y + 121, { align: 'center', color: 'cyan' });
  }
  g.text('RETROPOCKET 99 IN 1', cx, y + 134, { align: 'center', color: 'mid' });
  return canvas;
}

/** "2026-10-25" de hoy en formato "25/10/2026". */
function today() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function shareText(slot, result) {
  const game = `${slot.engine.name} ${slot.label}`;
  const where = slot.daily ? `el desafío diario (${game})` : `${game}, juego ${slot.code}`;
  const career = result.career;
  if (career?.passed) {
    if (career.finished) return `¡He completado las 99 etapas del modo carrera de RetroPocket 99-in-1! ${result.score} puntos en ${where}.`;
    return `Etapa ${career.stage}/99 superada en el modo carrera de RetroPocket 99-in-1: ${result.score} puntos en ${where}.`;
  }
  if (result.isHighScore) return `¡Nuevo récord en RetroPocket 99-in-1! ${result.score} puntos en ${where}.`;
  return `${result.score} puntos en ${where} de RetroPocket 99-in-1. ¿Me superas?`;
}

/**
 * Dibuja la tarjeta de la partida que acaba de terminar.
 * @param {import('./ConsoleEngine.js').ConsoleEngine} engine
 * @returns {{ canvas: HTMLCanvasElement, fileName: string, text: string }}
 */
export function renderShareCard(engine) {
  const slot = engine.currentSlot;
  const result = engine.result;
  const theme = engine.themeInfo;
  const skin = readSkin(engine.theme, engine.shell);
  const date = today();

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');

  // Fondo
  const page = ctx.createRadialGradient(CARD_W / 2, 280, 40, CARD_W / 2, 420, CARD_H);
  page.addColorStop(0, skin.page[0]);
  page.addColorStop(0.7, skin.page[1]);
  ctx.fillStyle = page;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Carcasa con sombra
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 20;
  roundedPath(ctx, BODY.x, BODY.y, BODY.w, BODY.h, BODY.r);
  ctx.fillStyle = skin.glass ? 'rgba(20, 12, 40, 0.35)' : skin.body[skin.body.length - 1][1];
  ctx.fill();
  ctx.restore();
  roundedPath(ctx, BODY.x, BODY.y, BODY.w, BODY.h, BODY.r);
  ctx.fillStyle = cssGradient(ctx, BODY, 160, skin.body);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fillRect(BODY.x, BODY.y, BODY.w, 3);
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = skin.edge;
  ctx.stroke();

  // Bisel
  roundedPath(ctx, BEZEL.x, BEZEL.y, BEZEL.w, BEZEL.h, BEZEL.r);
  const bezel = ctx.createLinearGradient(0, BEZEL.y, 0, BEZEL.y + BEZEL.h);
  bezel.addColorStop(0, skin.bezel[0]);
  bezel.addColorStop(1, skin.bezel[1]);
  ctx.fillStyle = bezel;
  ctx.fill();
  if (skin.bezelStroke) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = skin.bezelStroke;
    ctx.stroke();
  }

  // Rótulo del bisel: LED, texto del tema y franja de color
  const labelY = BEZEL.y + 25;
  ctx.save();
  ctx.shadowColor = skin.led;
  ctx.shadowBlur = 12;
  ctx.fillStyle = skin.led;
  ctx.beginPath();
  ctx.arc(LCD.x + 7, labelY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.font = `bold 17px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = skin.bezelText;
  const labelX = LCD.x + 26;
  ctx.fillText(theme.label, labelX, labelY + 1);
  const stripeX = labelX + ctx.measureText(theme.label).width + 12;
  const stripeEnd = LCD.x + SCREEN_WIDTH * LCD_SCALE;
  if (stripeEnd - stripeX > 20) {
    const mid = (stripeX + stripeEnd) / 2;
    ctx.fillStyle = skin.stripes[0];
    ctx.fillRect(stripeX, labelY - 1, mid - stripeX, 3);
    ctx.fillStyle = skin.stripes[1];
    ctx.fillRect(mid, labelY - 1, stripeEnd - mid, 3);
  }

  // Pantalla
  const screen = renderScreen(engine, slot, result, date);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(screen, LCD.x, LCD.y, SCREEN_WIDTH * LCD_SCALE, SCREEN_HEIGHT * LCD_SCALE);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.strokeRect(LCD.x + 2, LCD.y + 2, SCREEN_WIDTH * LCD_SCALE - 4, SCREEN_HEIGHT * LCD_SCALE - 4);

  // Marca
  const brandY = BEZEL.y + BEZEL.h + 62;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `italic 900 50px ${FONT}`;
  ctx.fillStyle = skin.brand;
  ctx.fillText('RetroPocket', BEZEL.x + 4, brandY);
  let bx = BEZEL.x + 4 + ctx.measureText('RetroPocket').width + 16;
  ctx.font = `bold 30px ${FONT}`;
  ctx.fillStyle = skin.model;
  ctx.fillText('99 in 1', bx, brandY);
  bx += ctx.measureText('99 in 1').width + 16;
  if (theme.tag) {
    ctx.font = `bold 16px ${FONT}`;
    const tw = ctx.measureText(theme.tag).width + 16;
    if (bx + tw <= BODY.x + BODY.w - 24) {
      ctx.fillStyle = skin.tagBg;
      ctx.fillRect(bx, brandY - 22, tw, 26);
      ctx.fillStyle = skin.tagFg;
      ctx.fillText(theme.tag, bx + 8, brandY - 3);
    }
  }

  // Cruceta y botones A/B
  const padX = 196;
  const padY = brandY + 76;
  ctx.fillStyle = skin.dpad;
  roundedPath(ctx, padX - 22, padY - 62, 44, 124, [8, 8, 8, 8]);
  ctx.fill();
  roundedPath(ctx, padX - 62, padY - 22, 124, 44, [8, 8, 8, 8]);
  ctx.fill();
  [
    ['B', 452, padY + 18],
    ['A', 548, padY - 18]
  ].forEach(([letter, x, y]) => {
    const button = ctx.createRadialGradient(x - 10, y - 10, 4, x, y, 34);
    button.addColorStop(0, skin.button[0]);
    button.addColorStop(1, skin.button[1]);
    ctx.fillStyle = button;
    ctx.beginPath();
    ctx.arc(x, y, 32, 0, Math.PI * 2);
    ctx.fill();
    if (skin.buttonRing) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = skin.buttonRing;
      ctx.stroke();
    }
    ctx.font = `bold 24px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = skin.buttonRing || 'rgba(255, 255, 255, 0.85)';
    ctx.fillText(letter, x, y + 1);
    ctx.textAlign = 'left';
  });

  // Pie
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const ink = isLight(skin.page[1]) ? '20, 22, 34' : '255, 255, 255';
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillStyle = `rgba(${ink}, 0.85)`;
  ctx.fillText(`${slot.engine.name} ${slot.label}  ·  ${result.score} PUNTOS`, CARD_W / 2, CARD_H - 50);
  ctx.font = `16px ${FONT}`;
  ctx.fillStyle = `rgba(${ink}, 0.55)`;
  ctx.fillText(`RetroPocket 99-in-1  ·  v${APP_VERSION}  ·  ${date}`, CARD_W / 2, CARD_H - 24);
  ctx.textAlign = 'left';

  const code = slot.daily ? 'hoy' : slot.code;
  return { canvas, fileName: `retropocket-${code}-${result.score}.png`, text: shareText(slot, result) };
}
