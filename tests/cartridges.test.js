// tests/cartridges.test.js
// Los 99 cartuchos se juegan en Node (sin navegador) y se dibujan en un lienzo que no pinta pero comprueba
// las coordenadas: con la IA del modo demo, pulsando botones al azar como un jugador, con la misma semilla
// dos veces (tiene que salir la misma partida), en el desafío diario y a velocidad 5 desde el nivel 9.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openConsole, playSlot } from '../tools/autoplay.js';

let con;
let missingGlyphs;

before(async () => {
  con = await openConsole();
  ({ missingGlyphs } = await con.load('/src/core/ConsoleEngine.js'));
});

after(() => con.close());

/** Lienzo de pruebas que además apunta los textos con letras que la fuente no tiene. */
function checkedGfx(badText) {
  const gfx = con.newGfx();
  const text = gfx.text.bind(gfx);
  gfx.text = (str, ...rest) => {
    if (missingGlyphs(str).length) badText.add(String(str));
    return text(str, ...rest);
  };
  return gfx;
}

/** Juega y comprueba que el resultado tiene sentido. */
function play(slot, Cartridge, options, where) {
  const badText = new Set();
  let result;
  try {
    result = playSlot(con, Cartridge, slot, { gfx: checkedGfx(badText), renderEvery: 3, ...options });
  } catch (err) {
    err.message = `${where}: ${err.message}`;
    throw err;
  }
  assert.ok(Number.isInteger(result.score) && result.score >= 0, `${where}: puntos ${result.score}`);
  assert.ok(Number.isInteger(result.level) && result.level >= 1, `${where}: nivel ${result.level}`);
  assert.deepEqual([...badText], [], `${where}: textos con letras que la fuente no tiene`);
  return result;
}

const engines = () => con.catalog.engines;

test('los 99 slots con la IA del modo demo (30 s)', async () => {
  for (const slot of con.catalog.slots) {
    const Cartridge = await con.Cartridge(slot);
    play(slot, Cartridge, { seed: 11 + slot.number, seconds: 30 }, `slot ${slot.code} ${slot.label} (IA)`);
  }
});

test('los 99 slots pulsando botones al azar (30 s)', async () => {
  for (const slot of con.catalog.slots) {
    const Cartridge = await con.Cartridge(slot);
    play(slot, Cartridge, { seed: 500 + slot.number, seconds: 30, input: 'random' }, `slot ${slot.code} ${slot.label} (al azar)`);
  }
});

test('la misma semilla da la misma partida (desafío diario y dos jugadores)', async () => {
  for (const slot of con.catalog.slots) {
    const Cartridge = await con.Cartridge(slot);
    for (const input of ['ai', 'random']) {
      const where = `slot ${slot.code} ${slot.label} (${input})`;
      const a = playSlot(con, Cartridge, slot, { seed: 4242, seconds: 20, input });
      const b = playSlot(con, Cartridge, slot, { seed: 4242, seconds: 20, input });
      assert.deepEqual(b, a, `${where}: dos partidas con la misma semilla salieron distintas`);
    }
  }
});

test('desafío diario: 21 días seguidos con su giro de reglas', async () => {
  for (let day = 1; day <= 21; day++) {
    const slot = con.catalog.dailyChallenge(new Date(2026, 10, day));
    const Cartridge = await con.Cartridge(slot);
    const where = `desafío ${slot.day} (${slot.engine.name} ${slot.label})`;
    const result = play(slot, Cartridge, { seed: slot.seed, seconds: 70 }, where);
    if (slot.variantConfig.sessionTime > 0) {
      assert.ok(result.seconds <= slot.variantConfig.sessionTime + 0.1, `${where}: el contrarreloj no acabó a tiempo (${result.seconds} s)`);
    }
  }
});

test('PREPARADO al máximo: velocidad 5 desde el nivel 9 y jefes de la carrera', async () => {
  for (const engine of engines()) {
    for (let number = engine.firstSlot; number <= engine.lastSlot; number++) {
      const slot = con.catalog.customizeSlot(con.catalog.getSlot(number), { speed: 5, level: 9 });
      const Cartridge = await con.Cartridge(slot);
      const result = play(slot, Cartridge, { seed: 77, seconds: 15 }, `slot ${slot.code} ${slot.label} a velocidad 5 nivel 9`);
      assert.ok(result.level >= 9, `slot ${slot.code}: empezó en el nivel ${result.level}`);
    }
  }
  for (let stage = 10; stage <= 99; stage += stage === 90 ? 9 : 10) {
    const slot = con.catalog.careerSlot(stage);
    play(slot, await con.Cartridge(slot), { seed: 5, seconds: 15 }, `jefe de la etapa ${stage}`);
  }
});
