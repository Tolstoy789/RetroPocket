// tests/catalog.test.js
// El mapa de los 99 slots: numeración, motores instalados, metas de estrellas, textos que caben en la
// pantalla con la fuente 3x5, desafío diario, carrera y la pantalla PREPARADO.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openConsole } from '../tools/autoplay.js';

let con;
let catalog;
let mod;
let missingGlyphs;
let gfx;

before(async () => {
  con = await openConsole();
  catalog = con.catalog;
  mod = await con.load('/src/core/Catalog99.js');
  ({ missingGlyphs } = await con.load('/src/core/ConsoleEngine.js'));
  gfx = con.newGfx();
});

after(() => con.close());

/** Comprueba que un texto se puede dibujar con la fuente y, si se da `maxWidth`, que cabe en ese ancho. */
function assertDrawable(text, where, maxWidth = 0) {
  assert.deepEqual(missingGlyphs(text), [], `${where}: "${text}" usa letras que la fuente no tiene`);
  if (maxWidth) assert.ok(gfx.textWidth(text) <= maxWidth, `${where}: "${text}" mide ${gfx.textWidth(text)} px (máximo ${maxWidth})`);
}

test('99 slots numerados del 01 al 99, repartidos entre los 10 motores', () => {
  assert.equal(catalog.slots.length, 99);
  assert.equal(catalog.engines.length, 10);
  catalog.slots.forEach((slot, i) => {
    assert.equal(slot.number, i + 1);
    assert.equal(slot.code, String(i + 1).padStart(2, '0'));
    assert.equal(catalog.getSlot(i + 1), slot);
  });
  for (const engine of catalog.engines) {
    const own = catalog.slots.filter((s) => s.engine === engine);
    assert.equal(own[0].number, engine.firstSlot);
    assert.equal(own.at(-1).number, engine.lastSlot);
    assert.equal(new Set(own.map((s) => s.label)).size, own.length, `${engine.name}: variantes con el mismo nombre`);
  }
  assert.equal(catalog.getSlot(0), null);
  assert.equal(catalog.getSlot(100), null);
});

test('los 10 motores están en src/games y se cargan', async () => {
  for (const engine of catalog.engines) {
    const slot = catalog.getSlot(engine.firstSlot);
    assert.ok(catalog.isInstalled(slot), `${engine.file}.js no está en src/games`);
    const Cartridge = await catalog.loadCartridge(slot);
    assert.equal(typeof Cartridge, 'function', `${engine.file}.js no exporta una clase`);
  }
  assert.equal(catalog.installedSlots().length, 99);
});

test('metas de estrellas: tres enteros positivos y crecientes en cada slot', () => {
  for (const slot of catalog.slots) {
    const where = `slot ${slot.code} ${slot.label}`;
    assert.equal(slot.stars.length, 3, where);
    assert.ok(slot.stars.every((n) => Number.isInteger(n) && n > 0), `${where}: ${slot.stars}`);
    assert.ok(slot.stars[0] < slot.stars[1] && slot.stars[1] < slot.stars[2], `${where}: ${slot.stars}`);
    assert.equal(catalog.starsFor(slot, 0), 0);
    assert.equal(catalog.starsFor(slot, slot.stars[0]), 1);
    assert.equal(catalog.starsFor(slot, slot.stars[1]), 2);
    assert.equal(catalog.starsFor(slot, slot.stars[2] * 10), 3);
  }
});

test('variantStars: un número escala las metas del motor y una lista las fija', () => {
  assert.deepEqual(mod.variantStars([1000, 5000, 15000], undefined), [1000, 5000, 15000]);
  assert.deepEqual(mod.variantStars([1000, 5000, 15000], 0.7), [700, 3500, 11000]);
  assert.deepEqual(mod.variantStars([1000, 5000, 15000], [10, 20, 30]), [10, 20, 30]);
});

test('textos del menú y de PREPARADO: con la fuente de la consola y dentro de la pantalla', () => {
  for (const engine of catalog.engines) {
    assertDrawable(engine.name, `motor ${engine.id}`, 144);
    assert.equal(engine.controls.length, 2, `${engine.id}: dos líneas de controles`);
    for (const line of engine.controls) assertDrawable(line, `controles de ${engine.id}`, 140);
  }
  for (const slot of catalog.slots) {
    const where = `slot ${slot.code}`;
    assertDrawable(slot.label, where, 100);
    assertDrawable(slot.desc, where);
    assert.ok(mod.wrapText(slot.desc, 34).length <= 2, `${where}: la descripción ocupa más de 2 líneas`);
  }
});

test('desafío diario: el mismo todo el día, cambia con la fecha y su texto cabe', () => {
  const morning = catalog.dailyChallenge(new Date(2026, 9, 25, 8));
  const night = catalog.dailyChallenge(new Date(2026, 9, 25, 23, 59));
  assert.equal(morning.seed, night.seed);
  assert.equal(morning.baseNumber, night.baseNumber);
  assert.equal(morning.label, night.label);
  assert.equal(morning.key, 'D2026-10-25');
  assert.ok(morning.daily);
  const seen = new Set();
  for (let d = 1; d <= 60; d++) {
    const daily = catalog.dailyChallenge(new Date(2026, 0, d));
    seen.add(`${daily.baseNumber}:${daily.label}`);
    assertDrawable(daily.label, `giro ${daily.label}`, 100);
    assertDrawable(daily.desc, `desafío del ${daily.day}`);
    assert.ok(mod.wrapText(daily.desc, 34).length <= 2, `desafío del ${daily.day}: "${daily.desc}" ocupa más de 2 líneas`);
  }
  assert.ok(seen.size > 30, `solo ${seen.size} desafíos distintos en 60 días`);
});

test('PREPARADO: la velocidad acelera y da más puntos, el nivel se suma al inicial', () => {
  const slot = catalog.getSlot(1);
  assert.equal(catalog.customizeSlot(slot, { speed: 1, level: 1 }), slot);
  const fast = catalog.customizeSlot(slot, { speed: 5, level: 9 });
  assert.equal(fast.launchSpeed, 5);
  assert.equal(fast.launchLevel, 9);
  assert.equal(fast.variantConfig.scoreMultiplier, 2);
  assert.equal(fast.variantConfig.startLevel, slot.variantConfig.startLevel + 8);
  assert.ok(fast.variantConfig.speed > slot.variantConfig.speed);
  assert.equal(fast.key, slot.key, 'los récords se guardan en el mismo slot');
  const limits = catalog.customizeSlot(slot, { speed: 99, level: -3 });
  assert.equal(limits.launchSpeed, mod.LAUNCH_SPEEDS.length);
  assert.equal(limits.launchLevel, 1);
  const daily = catalog.dailyChallenge(new Date(2026, 9, 25));
  assert.equal(catalog.customizeSlot(daily, { speed: 3, level: 3 }), daily, 'el desafío diario no se cambia');
});

test('carrera: jefes en las etapas 10, 20... 90 y 99 a velocidad 2 y con 2 estrellas', () => {
  const bosses = catalog.slots.filter((s) => catalog.isCareerBoss(s.number)).map((s) => s.number);
  assert.deepEqual(bosses, [10, 20, 30, 40, 50, 60, 70, 80, 90, 99]);
  for (let stage = 1; stage <= 99; stage++) {
    const slot = catalog.careerSlot(stage);
    assert.equal(slot.number, stage);
    assert.equal(slot.career.stage, stage);
    if (slot.career.boss) {
      assert.equal(slot.career.need, 2);
      assert.equal(slot.launchSpeed, mod.CAREER_BOSS_SPEED);
    } else {
      assert.equal(slot.career.need, 1);
      assert.equal(slot.launchSpeed, undefined);
    }
  }
  assert.equal(catalog.careerSlot(100), null);
});
