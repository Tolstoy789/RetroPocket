// tests/i18n.test.js
// Idioma inglés (Opciones → IDIOMA): el traductor, y que tienen traducción completa todos los textos del
// catálogo (variantes, descripciones y controles), los desafíos diarios, los logros, los temas y carcasas,
// los avisos y todo lo que dibujan los 99 juegos mientras se juegan. Las pantallas de la consola las
// recorre la prueba en el navegador (tests/e2e/console.test.js).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openConsole, playSlot } from '../tools/autoplay.js';
import { translate, setLanguage, resolveLanguage, localize, normalizeText } from '../src/core/i18n.js';
import { checkTranslations, dictionaryClashes } from './i18n-check.js';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

let con;
let names;
let missingGlyphs;

before(async () => {
  con = await openConsole();
  ({ missingGlyphs } = await con.load('/src/core/ConsoleEngine.js'));
  names = con.catalog.engines.map((e) => e.name);
});

after(() => {
  setLanguage('es');
  return con.close();
});

const check = (texts, o = {}) => checkTranslations(texts, { names, missingGlyphs, ...o });

test('el traductor: español tal cual, inglés por frases, trozos y patrones', () => {
  setLanguage('es');
  assert.equal(translate('PAUSA'), 'PAUSA');
  setLanguage('en');
  assert.equal(translate('PAUSA'), 'PAUSE');
  assert.equal(translate('¡Nuevo récord!'), 'NEW RECORD!', 'da igual que lleve tildes o minúsculas');
  assert.equal(translate('05 SIN BORDES'), '05 NO WALLS', 'los trozos que están en el diccionario');
  assert.equal(translate('NV 12'), 'LV 12');
  assert.equal(translate('¡GANA EL JUGADOR 2!'), 'PLAYER 2 WINS!', 'los patrones cambian el orden');
  assert.equal(translate('META ★★ 4000 PUNTOS'), 'GOAL ★★ 4000 POINTS');
  assert.equal(translate('BLOCK DROP'), 'BLOCK DROP', 'los nombres de los motores no cambian');
  assert.equal(localize('Hola', 'Hello'), 'Hello');
  setLanguage('es');
  assert.equal(localize('Hola', 'Hello'), 'Hola');
});

test('AUTO elige el idioma del teléfono (español también para catalán, gallego y euskera)', () => {
  assert.equal(resolveLanguage('auto', ['es-ES', 'en']), 'es');
  assert.equal(resolveLanguage('auto', ['es-419']), 'es');
  assert.equal(resolveLanguage('auto', ['ca-ES']), 'es');
  assert.equal(resolveLanguage('auto', ['en-US', 'es']), 'en');
  assert.equal(resolveLanguage('auto', ['fr-FR']), 'en');
  assert.equal(resolveLanguage('auto', []), 'es');
  assert.equal(resolveLanguage('en', ['es-ES']), 'en');
  assert.equal(resolveLanguage('es', ['en-US']), 'es');
});

test('el diccionario no repite claves y solo usa letras de la fuente', async () => {
  assert.deepEqual(dictionaryClashes(), []);
  const { EN } = await import('../src/core/lang/en.js');
  const bad = Object.values(EN).filter((en) => missingGlyphs(en).length || en !== normalizeText(en));
  assert.deepEqual(bad, [], 'traducciones con letras que la fuente no tiene o en minúsculas');
});

test('catálogo: variantes, descripciones, controles y desafíos diarios', () => {
  const { catalog } = con;
  const labels = [];
  const descs = [];
  for (const slot of catalog.slots) {
    labels.push(slot.label, `${slot.code} ${slot.label}`, `${slot.engine.name} ${slot.label}`);
    descs.push(slot.desc);
  }
  for (const engine of catalog.engines) labels.push(...engine.controls);
  for (let day = 1; day <= 60; day++) {
    const daily = catalog.dailyChallenge(new Date(2026, 0, day));
    labels.push(daily.label);
    descs.push(daily.desc);
  }
  assert.deepEqual(check(labels), []);
  assert.deepEqual(check(descs, { lines: 2 }), [], 'las descripciones tienen que caber en las 2 líneas del menú');
});

test('logros, temas, carcasas y estaciones', async () => {
  const { ACHIEVEMENTS } = await con.load('/src/core/Achievements.js');
  const { THEMES, getTheme, shellsFor, shellLabel } = await con.load('/src/core/Themes.js');
  const texts = ACHIEVEMENTS.flatMap((a) => [a.name, a.desc]);
  for (const id of THEMES) {
    for (const month of [0, 3, 6, 9]) {
      const info = getTheme(id, new Date(2026, month, 15));
      texts.push(info.name, ...info.blurb, `TEMA ${info.name}`);
      if (info.seasonName) texts.push(info.seasonName, `AHORA: ${info.seasonName}`);
    }
    for (const shell of shellsFor(id)) texts.push(shellLabel(id, shell), shell.name);
  }
  assert.deepEqual(check(texts), []);
});

test('los avisos que salen arriba de la pantalla (toast)', () => {
  // Los textos literales de cada llamada a toast() en el código, y los que se montan con una variable.
  const texts = ['SONIDO OFF', 'SONIDO LOW', 'SONIDO HIGH'];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}${entry.name}`;
      if (entry.isDirectory()) walk(`${path}/`);
      else if (path.endsWith('.js')) {
        for (const call of readFileSync(path, 'utf8').matchAll(/toast\(([^)]*)\)/g)) {
          for (const literal of call[1].matchAll(/'([^']+)'/g)) texts.push(literal[1]);
        }
      }
    }
  };
  walk(SRC);
  assert.ok(texts.length > 15, `solo ${texts.length} avisos`);
  assert.deepEqual(check(texts), []);
});

test('todo lo que dibujan los 99 juegos (con la IA y al azar, en el desafío diario y en la carrera)', async () => {
  const { Gfx } = await con.load('/src/core/ConsoleEngine.js');
  const log = new Set();
  Gfx.textLog = log;
  try {
    const gfx = con.newGfx();
    for (const slot of con.catalog.slots) {
      const Cartridge = await con.Cartridge(slot);
      for (const input of ['ai', 'random']) playSlot(con, Cartridge, slot, { gfx, renderEvery: 3, seed: 3 + slot.number, seconds: 25, input });
    }
    for (let day = 1; day <= 14; day++) {
      const slot = con.catalog.dailyChallenge(new Date(2026, 10, day));
      playSlot(con, await con.Cartridge(slot), slot, { gfx, renderEvery: 3, seed: slot.seed, seconds: 30 });
    }
    for (const stage of [9, 10, 99]) {
      const slot = con.catalog.careerSlot(stage);
      playSlot(con, await con.Cartridge(slot), slot, { gfx, renderEvery: 3, seed: 5, seconds: 15 });
    }
  } finally {
    Gfx.textLog = null;
  }
  assert.ok(log.size > 1000, `solo se dibujaron ${log.size} textos`);
  assert.deepEqual(check([...log]), []);
});
