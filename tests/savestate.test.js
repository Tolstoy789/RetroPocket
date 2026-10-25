// tests/savestate.test.js
// «Guardar la partida al salir» en los 99 slots: se juega un rato, se guarda (pasando por JSON, como en el
// almacenamiento), se carga en un cartucho nuevo y las dos partidas siguen con las mismas pulsaciones.
// Tienen que acabar exactamente iguales: si un motor guarda mal algo (o se olvida de algo), se separan.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openConsole, startSlot } from '../tools/autoplay.js';

let con;
let SaveState;

before(async () => {
  con = await openConsole();
  SaveState = await con.load('/src/core/SaveState.js');
});

after(() => con.close());

test('SaveState: Map, Set, undefined, NaN, Infinity, objetos compartidos, ciclos y constantes', () => {
  const DIRS = { UP: { x: 0, y: -1 }, DOWN: { x: 0, y: 1 } };
  const shared = { hp: 3 };
  const state = { a: shared, b: [shared, undefined, NaN, Infinity, -Infinity, -0], m: new Map([[1, 'uno'], ['k', new Set([2, 3])]]), dir: DIRS.UP };
  state.self = state;
  const data = JSON.parse(JSON.stringify(SaveState.encodeState(state, { constants: { DIRS } })));
  const back = SaveState.decodeState(data, { constants: { DIRS } });
  assert.equal(back.a, back.b[0], 'el objeto compartido sigue siendo uno');
  assert.equal(back.self, back, 'el ciclo se mantiene');
  assert.equal(back.dir, DIRS.UP, 'la constante es el mismo objeto');
  assert.equal(back.b[1], undefined);
  assert.ok(Number.isNaN(back.b[2]));
  assert.deepEqual(back.b.slice(3), [Infinity, -Infinity, 0]);
  assert.equal(back.m.get(1), 'uno');
  assert.deepEqual([...back.m.get('k')], [2, 3]);
  assert.throws(() => SaveState.encodeState({ f: () => 1 }), /f: no se puede guardar/);
  assert.throws(() => SaveState.encodeState({ when: new Date() }), /when: no se puede guardar un Date/);
  assert.throws(() => SaveState.decodeState({ nodes: [{ o: { x: { $c: 'NADA' } } }], root: { $r: 0 } }), /NADA/);
  assert.throws(() => SaveState.decodeState(null), /no válida/);
});

/** Juega `seconds` con un juego de startSlot. Devuelve false si la partida terminó. */
function run(game, seconds) {
  for (let i = 0; i < Math.round(seconds * 60); i++) if (!game.step()) return false;
  return true;
}

test('los 99 slots: una partida guardada y cargada sigue igual que la original', async () => {
  const gfx = con.newGfx();
  for (const slot of con.catalog.slots) {
    const Cartridge = await con.Cartridge(slot);
    for (const input of ['ai', 'random']) {
      const where = `slot ${slot.code} ${slot.label} (${input})`;
      // Se guarda a los 6 s de juego; si la partida ya ha terminado (pulsando al azar la serpiente choca
      // pronto), se prueba con otras semillas y antes.
      let original = null;
      for (const seconds of [6, 3, 1.5, 0.5]) {
        for (let seed = 1; seed <= 4 && !original; seed++) {
          const game = startSlot(con, Cartridge, slot, { seed: seed * 7919, input });
          if (run(game, seconds)) original = game;
        }
        if (original) break;
      }
      assert.ok(original, `${where}: ninguna partida llegó viva a los 0,5 s`);
      original.releaseAll();
      original.cart.onPause();
      let saved;
      try {
        saved = JSON.parse(JSON.stringify(original.cart.saveState()));
      } catch (err) {
        err.message = `${where}: ${err.message}`;
        throw err;
      }
      const restored = new Cartridge(original.cart.engine, original.cart.slot);
      restored.loadState(saved);
      restored.render(gfx);
      original.cart.onResume();
      restored.onResume();
      const a = startSlot(con, Cartridge, slot, { cart: original.cart, input, inputSeed: 99 });
      const b = startSlot(con, Cartridge, slot, { cart: restored, input, inputSeed: 99 });
      for (let i = 0; i < 600; i++) {
        const goingA = a.step();
        const goingB = b.step();
        assert.equal(goingB, goingA, `${where}: una partida terminó y la otra no (paso ${i})`);
        if (!goingA) break;
      }
      restored.render(gfx);
      assert.equal(b.cart.score, a.cart.score, `${where}: puntos distintos tras cargar`);
      assert.deepEqual(b.result(), a.result(), `${where}: final distinto tras cargar`);
      const sa = JSON.stringify(a.cart.saveState());
      const sb = JSON.stringify(b.cart.saveState());
      if (sa !== sb) {
        let i = 0;
        while (sa[i] === sb[i]) i++;
        assert.fail(`${where}: el estado se separó tras cargar\n  original: …${sa.slice(i - 120, i + 60)}\n  cargada:  …${sb.slice(i - 120, i + 60)}`);
      }
    }
  }
});
