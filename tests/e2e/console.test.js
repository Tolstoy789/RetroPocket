// tests/e2e/console.test.js
// La consola entera en Chromium (Playwright) con el servidor de desarrollo de Vite, manejada con el
// teclado como un jugador: arranque, menú, PREPARADO, una partida de cada motor con pausa, fin de partida
// con iniciales, opciones, galería de temas, jukebox, juegos y logros, desafío diario, carrera, modo demo,
// dos jugadores, ahorro de batería, guardar la partida al salir y giro de pantalla. Falla si la página
// registra cualquier error.
//
//   npm run test:e2e   (la primera vez: npx playwright install chromium)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

let server;
let browser;
let page;
const errors = [];

before(async () => {
  server = await createServer({ root: ROOT, logLevel: 'error', server: { host: '127.0.0.1', port: 5300, strictPort: false } });
  await server.listen();
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  // Consola recién estrenada, sin el modo demo (que saltaría a los 20 s de no tocar nada).
  await page.addInitScript(() => {
    if (sessionStorage.getItem('e2e')) return;
    sessionStorage.setItem('e2e', '1');
    localStorage.clear();
    localStorage.setItem('retropocket99:settings', JSON.stringify({ demo: false, initials: 'E2E' }));
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.retropocket?.state === 'boot', null, { timeout: 15000 });
});

after(async () => {
  await browser?.close();
  await server?.close();
});

const engine = (fn, arg) => page.evaluate(fn, arg);
const state = () => engine(() => window.retropocket.state);
const waitState = (name, timeout = 6000) =>
  page.waitForFunction((s) => window.retropocket.state === s, name, { timeout }).catch(async () => {
    throw new Error(`se esperaba el estado "${name}" y la consola está en "${await state()}"`);
  });
async function press(key, wait = 120) {
  await page.keyboard.press(key);
  await page.waitForTimeout(wait);
}
async function hold(key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}
async function toMenu() {
  await engine(() => window.retropocket.goToMenu());
  await waitState('menu');
}

/** Cada paso falla también si la página ha registrado errores mientras se ejecutaba. */
function step(name, fn) {
  test(name, async () => {
    const before = errors.length;
    await fn();
    assert.deepEqual(errors.slice(before), [], 'errores en la página');
  });
}

step('arranca, la animación se salta con un botón y llega al menú', async () => {
  await page.waitForTimeout(500);
  await press('Enter');
  await waitState('menu');
});

step('el menú recorre los slots y salta de motor', async () => {
  await engine(() => window.retropocket.menu.jumpTo(1));
  await press('ArrowRight');
  await press('ArrowRight');
  assert.equal(await engine(() => window.retropocket.menu.index), 3);
  await press('ArrowDown');
  assert.equal(await engine(() => window.retropocket.menu.slot.engine.id), 'mazemuncher');
  await press('ArrowUp');
  await press('ArrowUp');
  assert.equal(await engine(() => window.retropocket.menu.index), 0, 'antes del primer motor está el desafío diario');
});

step('los 10 motores: PREPARADO, partida, pausa y vuelta al menú', async () => {
  const firsts = await engine(() => window.retropocket.catalog.engines.map((e) => e.firstSlot));
  for (const first of firsts) {
    await engine((n) => window.retropocket.menu.jumpTo(n), first);
    await press('KeyZ');
    await waitState('launch');
    await page.waitForTimeout(250);
    await press('KeyZ');
    await waitState('playing');
    assert.equal(await engine(() => window.retropocket.currentSlot.number), first);
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyZ', 'ArrowDown', 'KeyX']) await hold(key, 120);
    if ((await state()) === 'playing') {
      await press('Enter');
      await waitState('paused');
      await press('ArrowDown');
      await press('ArrowDown');
      await press('KeyZ');
    } else {
      await toMenu();
    }
    await waitState('menu');
  }
});

step('fin de partida: récord con iniciales, tabla y otra partida', async () => {
  await engine(() => window.retropocket.menu.jumpTo(23));
  await press('KeyZ', 250);
  await press('KeyZ');
  await waitState('playing');
  await engine(() => {
    const cart = window.retropocket.cartridge;
    cart.score = 450;
    cart.gameOver({ message: 'PRUEBA' });
  });
  await waitState('initials');
  await page.waitForTimeout(500);
  await press('ArrowUp');
  await press('Enter');
  await waitState('gameover');
  const top = await engine(() => window.retropocket.storage.getScores(23)[0]);
  assert.equal(top.score, 450);
  assert.equal(top.name, 'F2E', 'la flecha arriba cambió la primera letra');
  await page.waitForTimeout(900);
  await press('KeyZ');
  await waitState('playing');
  await hold('Backspace', 900);
  await waitState('menu');
});

step('opciones: se recorren todas y un ajuste cambia y se guarda', async () => {
  await press('KeyX');
  await waitState('options');
  const count = await engine(() => window.retropocket.options.items.length);
  for (let i = 0; i < count; i++) await press('ArrowDown', 40);
  assert.equal(await engine(() => window.retropocket.options.index), 0, 'la lista da la vuelta');
  await engine(() => {
    const o = window.retropocket.options;
    o.index = o.items.findIndex((item) => item.label === 'GESTOS');
  });
  await press('ArrowRight');
  assert.equal(await engine(() => window.retropocket.storage.getSetting('gestures')), true);
  await press('ArrowLeft');
  assert.equal(await engine(() => window.retropocket.settings.gestures), false);
  await press('KeyX');
  await waitState('menu');
});

step('galería de temas y los 11 temas en una partida', async () => {
  await press('KeyX');
  await waitState('options');
  await press('KeyZ');
  await waitState('themes');
  for (let i = 0; i < 3; i++) await press('ArrowRight', 200);
  await press('KeyX');
  await waitState('options');
  await press('KeyX');
  await waitState('menu');
  const themes = await engine(async () => (await import('/src/core/Themes.js')).THEMES);
  assert.equal(themes.length, 11);
  await engine(() => window.retropocket.launch(window.retropocket.catalog.getSlot(63)));
  await waitState('playing');
  for (const theme of themes) {
    await engine((t) => window.retropocket.updateSetting('theme', t), theme);
    await page.waitForTimeout(150);
  }
  await engine(() => window.retropocket.updateSetting('theme', 'retro'));
  await toMenu();
});

step('jukebox: elegir, tocar, chip o beeper y salir', async () => {
  await press('KeyX');
  await waitState('options');
  await engine(() => {
    const o = window.retropocket.options;
    o.index = o.items.findIndex((item) => item.label === 'JUKEBOX');
  });
  await press('KeyZ');
  await waitState('jukebox');
  await press('ArrowDown');
  await press('ArrowDown');
  await press('KeyZ', 600);
  await press('ArrowRight', 400);
  await press('ArrowRight');
  await press('KeyZ');
  await press('KeyX');
  await waitState('options');
  await press('KeyX');
  await waitState('menu');
});

step('juegos, carrera, logros, racha y datos (START en el menú)', async () => {
  await press('Enter');
  await waitState('hub');
  const tabs = [];
  for (let i = 0; i < 5; i++) {
    tabs.push(await engine(() => window.retropocket.hub.tab));
    await press('ArrowRight', 250);
    await press('ArrowDown');
  }
  assert.deepEqual(tabs, ['games', 'career', 'achievements', 'streak', 'stats']);
  await press('KeyX');
  await waitState('menu');
});

step('desafío diario y primera etapa de la carrera', async () => {
  await engine(() => window.retropocket.menu.jumpTo(0));
  await press('KeyZ');
  await waitState('playing');
  assert.ok(await engine(() => window.retropocket.currentSlot.daily), 'el desafío se juega sin pasar por PREPARADO');
  await toMenu();
  await engine(() => window.retropocket.openHub('career'));
  await waitState('hub');
  await press('KeyZ');
  await waitState('playing');
  assert.equal(await engine(() => window.retropocket.currentSlot.career?.stage), 1);
  await toMenu();
});

step('modo demo: juega solo y un botón vuelve al menú', async () => {
  await engine(() => window.retropocket.startAttract());
  await waitState('attract');
  await page.waitForTimeout(3000);
  await press('KeyZ');
  await waitState('menu');
});

step('dos jugadores por turnos', async () => {
  await engine(() => window.retropocket.menu.jumpTo(43));
  await press('KeyZ');
  await waitState('launch');
  await press('ArrowDown');
  await press('ArrowDown');
  await press('ArrowRight', 250);
  await press('KeyZ');
  await waitState('playing');
  assert.equal(await engine(() => window.retropocket.turnBadge > 0), true, 'cartel del jugador 1');
  await engine(() => window.retropocket.cartridge.gameOver({ message: 'J1' }));
  await page.waitForFunction(() => ['initials', 'gameover'].includes(window.retropocket.state));
  if ((await state()) === 'initials') {
    await page.waitForTimeout(500);
    await press('Enter');
  }
  await waitState('gameover');
  assert.equal(await engine(() => window.retropocket.match.scores.length), 1);
  await page.waitForTimeout(900);
  await press('KeyZ');
  await waitState('playing');
  await toMenu();
  assert.equal(await engine(() => window.retropocket.match), null);
});

step('ahorro de batería: dibuja a 30 fps y no repite imágenes iguales', async () => {
  await engine(() => window.retropocket.updateSetting('battery', 'on'));
  await page.waitForTimeout(300);
  const a = await engine(() => ({ ...window.retropocket.frames }));
  await page.waitForTimeout(2000);
  const b = await engine(() => ({ ...window.retropocket.frames }));
  const rendered = b.rendered - a.rendered;
  const shown = b.shown - a.shown;
  assert.ok(rendered <= 66, `dibujó ${rendered} fotogramas en 2 s`);
  assert.ok(shown <= rendered, `mostró ${shown} de ${rendered}`);
  await engine(() => window.retropocket.updateSetting('battery', 'off'));
});

step('guardar la partida al salir: se cierra en pausa y al volver se continúa', async () => {
  await engine(() => window.retropocket.menu.jumpTo(1));
  await press('KeyZ', 250);
  await press('KeyZ');
  await waitState('playing');
  await hold('ArrowLeft', 300);
  await page.waitForTimeout(1500);
  await press('Enter');
  await waitState('paused');
  const paused = await engine(() => ({ score: window.retropocket.cartridge.score, time: window.retropocket.cartridge.time, saved: window.retropocket.saved }));
  assert.ok(paused.saved, 'se guardó al pausar');
  assert.ok(await engine(() => window.retropocket.storage.getSuspended() !== null));

  // Se cierra la app con la partida en pausa (recargar la página es lo mismo para la consola).
  await page.reload();
  await page.waitForFunction(() => window.retropocket?.state === 'boot', null, { timeout: 15000 });
  await page.waitForTimeout(500);
  await press('Enter');
  await waitState('resume');
  await page.waitForTimeout(400);
  await press('KeyZ');
  await waitState('paused');
  const back = await engine(() => ({ number: window.retropocket.currentSlot.number, score: window.retropocket.cartridge.score, time: window.retropocket.cartridge.time }));
  assert.equal(back.number, 1);
  assert.equal(back.score, paused.score);
  assert.equal(back.time, paused.time, 'la partida sigue en el mismo instante');
  await press('Enter');
  await waitState('playing');
  assert.equal(await engine(() => window.retropocket.storage.getSuspended()), null, 'al seguir jugando se borra');

  // Descartar: B pide confirmación y la segunda B la borra.
  await press('Enter');
  await waitState('paused');
  await page.reload();
  await page.waitForFunction(() => window.retropocket?.state === 'boot', null, { timeout: 15000 });
  await page.waitForTimeout(500);
  await press('Enter');
  await waitState('resume');
  await page.waitForTimeout(400);
  await press('KeyX');
  assert.equal(await state(), 'resume', 'la primera B solo pregunta');
  await press('KeyX');
  await waitState('menu');
  assert.equal(await engine(() => window.retropocket.storage.getSuspended()), null);

  // Salir al menú desde la pausa también la borra.
  await engine(() => window.retropocket.launch(window.retropocket.catalog.getSlot(63)));
  await waitState('playing');
  await press('Enter');
  await waitState('paused');
  await press('ArrowDown');
  await press('ArrowDown');
  await press('KeyZ');
  await waitState('menu');
  assert.equal(await engine(() => window.retropocket.storage.getSuspended()), null);
});

step('girar la pantalla y volver', async () => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(400);
  await press('ArrowRight');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  assert.equal(await state(), 'menu');
});
