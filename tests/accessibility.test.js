// tests/accessibility.test.js
// Accesibilidad (Opciones → VEL. JUEGO y TEXTO GRANDE, y la lectura por voz): la fuente grande de 5x7 y
// cuándo se usa, los 99 juegos al 70 % de velocidad y las frases del lector de pantalla (Announcer.js).
// Que la fuente grande no pisa otros textos en ninguna pantalla lo comprueba tests/e2e/console.test.js.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openConsole, startSlot, STEP } from '../tools/autoplay.js';
import { Announcer, speakable, SETTLE } from '../src/core/Announcer.js';
import { setLanguage } from '../src/core/i18n.js';

let con;

before(async () => {
  con = await openConsole();
});

after(() => {
  setLanguage('es');
  return con.close();
});

test('fuente grande: las mismas letras que la pequeña, de 5x7', async () => {
  const { FONTS } = await con.load('/src/core/ConsoleEngine.js');
  const small = Object.keys(FONTS.small.glyphs);
  assert.deepEqual(Object.keys(FONTS.big.glyphs).sort(), small.sort());
  for (const [ch, rows] of Object.entries(FONTS.big.glyphs)) {
    assert.equal(rows.length, 7, `"${ch}" tiene ${rows.length} filas`);
    for (const row of rows) assert.match(row, /^[.#]{5}$/, `"${ch}": fila "${row}"`);
  }
});

test('texto grande: solo en lo que cabe, a escala 1 y fuera de los juegos', () => {
  const g = con.newGfx();
  assert.equal(g.textBox('PAUSA', 72, 50, { align: 'center' }).big, false, 'sin TEXTO GRANDE, la fuente 3x5');
  g.bigText = true;
  const box = g.textBox('PAUSA', 72, 50, { align: 'center' });
  assert.deepEqual(box, { x: 57, y: 49, w: 29, h: 7, big: true }, '5 letras de 6 px, 1 px más arriba');
  assert.equal(g.textWidth('PAUSA'), 29);
  assert.equal(g.textBox('UNA FRASE MUCHO MAS LARGA QUE LA PANTALLA', 72, 50, { align: 'center' }).big, false, 'si no cabe, la pequeña');
  assert.equal(g.textBox('FIN', 140, 50).big, false, 'tampoco si se sale por la derecha');
  assert.equal(g.textBox('PAUSA', 72, 50, { scale: 2 }).big, false, 'los títulos a escala 2 no cambian');
  assert.equal(g.textBox('01', 20, 50, { small: true }).big, false, 'small: true la deja pequeña');
  assert.equal(g.textBox('BLOCK DROP', 4, 50, { max: 52 }).big, false, 'ni si pasa de max');
  // Dentro de un recuadro tiene que caber en él; clear() y veil() vuelven a toda la pantalla.
  g.panel(40, 40, 64, 40);
  assert.equal(g.textBox('CONTINUAR', 72, 50, { align: 'center' }).big, true);
  assert.equal(g.textBox('PARTIDA GUARDADA', 72, 50, { align: 'center' }).big, false);
  g.veil();
  assert.equal(g.textBox('PARTIDA GUARDADA', 72, 50, { align: 'center' }).big, true);
});

test('VEL. JUEGO al 70 %: los 99 juegos van más despacio y se pueden jugar enteros', async () => {
  const seconds = 20;
  const steps = Math.round(seconds / STEP);
  for (const slot of con.catalog.slots) {
    const Cartridge = await con.Cartridge(slot);
    for (const input of ['ai', 'random']) {
      const game = startSlot(con, Cartridge, slot, { seed: 7 + slot.number, input, pace: 0.7 });
      let n = 0;
      while (n < steps && game.step()) n++;
      const { cart } = game;
      assert.ok(Number.isFinite(cart.score) && cart.score >= 0, `${slot.code} (${input}): puntos ${cart.score}`);
      // cart.time es el reloj del juego: el que cuentan los temporizadores y el contrarreloj.
      if (!game.result()) assert.ok(Math.abs(cart.time - n * STEP * 0.7) < 1e-6, `${slot.code} (${input}): en ${n} pasos el juego avanzó ${cart.time} s`);
      cart.destroy();
    }
  }
});

test('lector de pantalla: frases traducidas, en minúsculas y sin símbolos', () => {
  setLanguage('es');
  assert.equal(speakable(['PAUSA', 'PUNTOS 120', 'NIVEL 3']), 'Pausa. Puntos 120. Nivel 3.');
  assert.equal(speakable(['¡NUEVO RECORD!', '★ LOGRO DESBLOQUEADO', '', null]), '¡Nuevo record! Logro desbloqueado.');
  assert.equal(speakable(['IDIOMA', { raw: 'ESPAÑOL' }]), 'Idioma. ESPAÑOL.', '{ raw } se lee tal cual');
  assert.equal(speakable(['◀▶', '★★★']), '', 'un trozo sin letras ni números no se lee');
  setLanguage('en');
  assert.equal(speakable(['PAUSA', 'PUNTOS 120', 'NIVEL 3']), 'Pause. Score 120. Level 3.');
  setLanguage('es');
});

test('lector de pantalla: lee la pantalla cuando se queda quieta, y los avisos enseguida', () => {
  const a = new Announcer(null);
  const step = 1 / 60;
  const run = (parts, seconds) => {
    for (let t = 0; t < seconds; t += step) a.describe(parts, step);
  };
  run(['JUEGO 01'], SETTLE / 2);
  run(['JUEGO 02'], SETTLE / 2);
  assert.deepEqual(a.history, [], 'al pasar deprisa por el menú no lee nada');
  run(['JUEGO 03'], SETTLE + 0.1);
  assert.deepEqual(a.history, ['Juego 03.']);
  run(['JUEGO 03'], 2);
  assert.deepEqual(a.history, ['Juego 03.'], 'y no lo repite mientras no cambie');
  a.notice('CODIGO COPIADO');
  assert.deepEqual(a.history, ['Juego 03.', 'Codigo copiado.']);
  run([], 1);
  run(['JUEGO 03'], SETTLE + 0.1);
  assert.equal(a.history.at(-1), 'Juego 03.', 'si vuelve después de otra pantalla, se lee otra vez');
  assert.equal(a.history.length, 3);
});
