// src/core/BootScenes.js
// Las tres animaciones de arranque de la consola. Se turnan solas cada 2 días
// (o se fija una en Opciones → Arranque). Cada escena dibuja la pantalla completa de 144x192
// con sus propios colores, sea cual sea el modo visual, y tiene su jingle en SoundChip.

const W = 144;
const H = 192;
const CELL = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
const NINE = ['###', '#.#', '###', '..#', '###'];

/** Duración de cada escena hasta pasar sola al menú (segundos). */
export const BOOT_DURATION = 5.2;

const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

/** Celda tipo ladrillo con un color fijo (no depende del modo visual). */
function brick(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, s - 1, 1);
  ctx.fillRect(x, y + s - 2, s - 1, 1);
  ctx.fillRect(x, y + 1, 1, s - 3);
  ctx.fillRect(x + s - 2, y + 1, 1, s - 3);
  const inset = Math.max(1, Math.floor(s / 4));
  ctx.fillRect(x + inset, y + inset, s - 1 - inset * 2, s - 1 - inset * 2);
}

function brickWall(ctx, color) {
  for (let r = 0; r < H / CELL; r++) {
    for (let c = 0; c < W / CELL; c++) brick(ctx, c * CELL, r * CELL, CELL, color);
  }
}

function blink(t, speed = 2.5) {
  return Math.floor(t * speed) % 2 === 0;
}

// ---------------------------------------------------------------------------
// A · Ladrillo clásico: los ladrillos caen columna a columna y forman un «99» gigante.
// ---------------------------------------------------------------------------
const NINE_CELLS = [];
[4, 11].forEach((ox) =>
  NINE.forEach((row, r) => [...row].forEach((ch, c) => ch === '#' && NINE_CELLS.push([ox + c, 5 + r])))
);
const NINE_COLUMNS = [...new Set(NINE_CELLS.map(([x]) => x))].sort((a, b) => a - b);

function drawBrick(g, t) {
  const ctx = g.ctx;
  const BG = '#9ead86';
  const GHOST = '#8f9e78';
  const INK = '#1d2b1a';
  const MID = '#5d6b4f';
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  brickWall(ctx, GHOST);

  const flash = t > 1.3 && t < 1.8 && Math.floor((t - 1.3) * 12) % 2 === 1;
  for (const [cx, cy] of NINE_CELLS) {
    const start = NINE_COLUMNS.indexOf(cx) * 0.08;
    if (t < start) continue;
    const p = ease((t - start) / 0.35);
    const y = Math.round((-2 + (cy + 2) * p) * CELL);
    brick(ctx, cx * CELL, y, CELL, flash ? GHOST : INK);
  }

  if (t > 1.8) {
    const p = ease((t - 1.8) / 0.6);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 108, W, 46);
    g.text('RETRO', -60 + (W / 2 + 60) * p, 114, { align: 'center', scale: 3, color: INK });
    g.text('POCKET', W + 70 - (W / 2 + 70) * p, 134, { align: 'center', scale: 3, color: INK });
  }
  if (t > 2.6 && blink(t)) {
    ctx.fillStyle = BG;
    ctx.fillRect(30, 162, 84, 11);
    g.text('PULSA START', W / 2, 165, { align: 'center', color: MID });
  }
}

// ---------------------------------------------------------------------------
// B · Neón synthwave: sale un sol a rayas sobre una cuadrícula y el «99» se dibuja en neón.
// ---------------------------------------------------------------------------
const SUN_COLORS = ['#ffe45e', '#ffc04d', '#ff9a4d', '#ff6f6f', '#ff4f9a', '#e43fd0'];

function drawNeon(g, t) {
  const ctx = g.ctx;
  const HORIZON = 100;
  for (let y = 0; y < HORIZON; y++) {
    ctx.fillStyle = `rgb(${Math.round(10 + y * 0.5)},${Math.round(4 + y * 0.15)},${Math.round(26 + y * 0.6)})`;
    ctx.fillRect(0, y, W, 1);
  }
  ctx.fillStyle = '#05030f';
  ctx.fillRect(0, HORIZON, W, H - HORIZON);

  ctx.fillStyle = '#c9c4ff';
  for (let i = 0; i < 26; i++) {
    if ((Math.floor(t * 3) + i) % 5) ctx.fillRect((i * 53) % W, (i * 37) % 80, 1, 1);
  }

  const sunY = HORIZON - 34 * ease(t / 1.2);
  for (let y = -30; y <= 30; y++) {
    const yy = Math.round(sunY + y);
    if (yy >= HORIZON || yy < 0) continue;
    if (y > 4 && Math.floor(y / 3) % 2 === 1) continue;
    const half = Math.round(Math.sqrt(Math.max(0, 900 - y * y)));
    ctx.fillStyle = SUN_COLORS[Math.min(5, Math.floor((y + 30) / 10.2))];
    ctx.fillRect(W / 2 - half, yy, half * 2, 1);
  }

  ctx.fillStyle = '#00e5ff';
  ctx.fillRect(0, HORIZON, W, 1);
  const scroll = (t * 0.9) % 1;
  for (let i = 0; i < 9; i++) {
    const z = (i + scroll) / 9;
    ctx.fillStyle = `rgba(0,229,255,${0.25 + z * 0.6})`;
    ctx.fillRect(0, Math.round(HORIZON + Math.pow(z, 2.2) * 92), W, 1);
  }
  ctx.fillStyle = 'rgba(0,229,255,0.5)';
  for (let i = -8; i <= 8; i++) {
    for (let y = HORIZON + 1; y < H; y++) {
      const x = Math.round(W / 2 + i * (4 + (y - HORIZON) * 0.9));
      if (x >= 0 && x < W) ctx.fillRect(x, y, 1, 1);
    }
  }

  if (t > 1.2) {
    const p = clamp01((t - 1.2) / 0.6);
    const sc = 6;
    const top = 22;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, top + 30 * p + 1);
    ctx.clip();
    [W / 2 - 25, W / 2 + 3].forEach((x0) =>
      NINE.forEach((row, r) =>
        [...row].forEach((ch, c) => {
          if (ch !== '#') return;
          ctx.fillStyle = 'rgba(255,43,214,0.55)';
          ctx.fillRect(x0 + c * sc + 1, top + r * sc + 1, sc, sc);
          ctx.fillStyle = '#eafcff';
          ctx.fillRect(x0 + c * sc, top + r * sc, sc - 1, sc - 1);
        })
      )
    );
    ctx.restore();
    if (p < 1) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, Math.round(top + 30 * p), W, 1);
    }
  }

  if (t > 1.9) {
    const glitch = Math.max(0, 1 - (t - 1.9) / 0.6);
    const j = Math.round(Math.sin(t * 60) * 3 * glitch);
    ctx.fillStyle = 'rgba(5,3,15,0.7)';
    ctx.fillRect(10, 112, W - 20, 30);
    g.text('RETRO POCKET', W / 2 + j, 118, { align: 'center', scale: 2, color: '#ff2bd6' });
    g.text('RETRO POCKET', W / 2 - j, 118, { align: 'center', scale: 2, color: '#00e5ff' });
    if (glitch < 0.5) g.text('RETRO POCKET', W / 2, 118, { align: 'center', scale: 2, color: '#ffffff' });
    g.text('99 IN 1', W / 2, 132, { align: 'center', color: '#f9f871' });
  }
  if (t > 2.7 && blink(t)) {
    ctx.fillStyle = 'rgba(5,3,15,0.75)';
    ctx.fillRect(28, 160, 88, 11);
    g.text('PULSA START', W / 2, 163, { align: 'center', color: '#ff2bd6' });
  }
}

// ---------------------------------------------------------------------------
// C · Cartucho 99: el cartucho encaja, la pantalla se enciende y aparecen los 10 motores.
// ---------------------------------------------------------------------------
function drawCartridge(g, t, icons) {
  const ctx = g.ctx;
  ctx.fillStyle = '#0d0a1a';
  ctx.fillRect(0, 0, W, H);

  if (t < 0.9) {
    const p = ease(t / 0.75);
    const shakeY = t > 0.72 && t < 0.85 ? Math.round(Math.sin(t * 120) * 2) : 0;
    ctx.fillStyle = '#26203d';
    ctx.fillRect(30, 150, 84, 10);
    ctx.fillStyle = '#120e22';
    ctx.fillRect(34, 152, 76, 6);
    const y = Math.round(-110 + 150 * p + shakeY);
    ctx.fillStyle = '#b9bccb';
    ctx.fillRect(40, y, 64, 112);
    ctx.fillStyle = '#dfe1ea';
    ctx.fillRect(40, y, 64, 2);
    ctx.fillStyle = '#8b8ea0';
    ctx.fillRect(102, y, 2, 112);
    ctx.fillStyle = '#9a9db0';
    for (let x = 46; x < 96; x += 6) ctx.fillRect(x, y + 4, 2, 10);
    ctx.fillStyle = '#d6383b';
    ctx.fillRect(48, y + 22, 48, 56);
    g.text('99', 72, y + 32, { align: 'center', scale: 5, color: '#ffd23f' });
    g.text('IN 1', 72, y + 64, { align: 'center', color: '#ffe08a' });
    return;
  }

  const on = clamp01((t - 0.9) / 0.35);
  const h = Math.max(1, Math.round(H * ease(on)));
  ctx.fillStyle = '#b7c2c8';
  ctx.fillRect(0, Math.round((H - h) / 2), W, h);
  if (on < 1) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, H / 2 - 1, W, 2);
    return;
  }
  brickWall(ctx, '#a8b3ba');

  const INK = '#262b45';
  const p = clamp01((t - 1.3) / 1.2);
  if (p < 1) {
    const radius = 52 * (1 - ease(p));
    icons.forEach((rows, i) => {
      const a = (i / icons.length) * Math.PI * 2 + t * 2.4;
      const cx = Math.round(W / 2 + Math.cos(a) * radius - 8);
      const cy = Math.round(74 + Math.sin(a) * radius * 0.9 - 8);
      g.sprite(rows, cx, cy, { scale: 2, colors: { '#': INK, '+': INK } });
    });
    return;
  }

  ctx.fillStyle = '#b7c2c8';
  ctx.fillRect(10, 40, W - 20, 112);
  ctx.fillStyle = INK;
  ctx.fillRect(10, 40, W - 20, 1);
  ctx.fillRect(10, 151, W - 20, 1);
  ctx.fillRect(10, 40, 1, 112);
  ctx.fillRect(W - 11, 40, 1, 112);
  g.text('RETRO', W / 2, 52, { align: 'center', scale: 3, color: INK });
  g.text('POCKET', W / 2, 72, { align: 'center', scale: 3, color: INK });
  ctx.globalAlpha = ease((t - 2.5) / 0.4);
  g.text('99 JUEGOS EN 1', W / 2, 98, { align: 'center', color: '#454b66' });
  icons.forEach((rows, i) => g.sprite(rows, 18 + i * 11, 114, { colors: { '#': INK, '+': INK } }));
  ctx.globalAlpha = 1;
  if (t > 3 && blink(t)) g.text('PULSA START', W / 2, 136, { align: 'center', color: '#66727c' });
}

// ---------------------------------------------------------------------------

export const BOOT_SCENES = [
  { id: 'brick', label: 'LADRILLO', jingle: 'bootBrick', draw: drawBrick },
  { id: 'neon', label: 'NEON', jingle: 'bootNeon', draw: drawNeon },
  { id: 'cartridge', label: 'CARTUCHO', jingle: 'bootCartridge', draw: drawCartridge }
];

/** Escena del turno: cambia cada 2 días según la fecha local (igual para todos ese día). */
export function rotatingBootScene(date = new Date()) {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
  return BOOT_SCENES[Math.floor(day / 2) % BOOT_SCENES.length];
}

/** Escena que toca según el ajuste 'boot': 'auto' (turno de 2 días) o el id de una escena fija. */
export function pickBootScene(setting, date = new Date()) {
  return BOOT_SCENES.find((s) => s.id === setting) || rotatingBootScene(date);
}
