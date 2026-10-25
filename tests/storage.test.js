// tests/storage.test.js
// Récords (top 5 con iniciales), ajustes, favoritos, recientes y preferencias de PREPARADO (StorageManager.js).
// En Node no hay localStorage: cada StorageManager guarda en memoria, como en un navegador sin almacenamiento.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openConsole } from '../tools/autoplay.js';

let con;
let StorageManager;

before(async () => {
  con = await openConsole();
  ({ StorageManager } = await con.load('/src/core/StorageManager.js'));
});

after(() => con.close());

test('top 5 por slot: ordenado, con puesto y récord', () => {
  const storage = new StorageManager();
  assert.deepEqual(storage.submitScore(7, 0), { rank: 0, isHighScore: false, highScore: 0 }, 'cero puntos no entra');
  assert.equal(storage.submitScore(7, 500).rank, 1);
  const second = storage.submitScore(7, 300);
  assert.equal(second.rank, 2);
  assert.ok(!second.isHighScore);
  const best = storage.submitScore(7, 900.7, { level: 4 });
  assert.equal(best.rank, 1);
  assert.ok(best.isHighScore);
  assert.equal(best.highScore, 900);
  for (const score of [100, 200, 250]) storage.submitScore(7, score);
  const table = storage.getScores(7);
  assert.deepEqual(table.map((e) => e.score), [900, 500, 300, 250, 200]);
  assert.equal(table[0].level, 4);
  assert.equal(storage.submitScore(7, 50).rank, 0, 'por debajo del quinto no entra');
  assert.equal(storage.getHighScore(7), 900);
  assert.equal(storage.getHighScore(8), 0);
});

test('iniciales: se limpian, se guardan en la tabla y se recuerdan', () => {
  const storage = new StorageManager();
  storage.submitScore(3, 100);
  const { rank } = storage.submitScore(3, 200);
  assert.equal(storage.setEntryName(3, rank, 'e-l'), 'E L');
  assert.equal(storage.getScores(3)[0].name, 'E L');
  assert.equal(storage.getSetting('initials'), 'E L');
  storage.submitScore(3, 300);
  assert.equal(storage.getScores(3)[0].name, 'E L', 'la siguiente partida usa las últimas iniciales');
});

test('récords del desafío diario aparte de los slots normales', () => {
  const storage = new StorageManager();
  storage.submitScore('D2026-10-25', 800);
  storage.submitScore(1, 100);
  assert.deepEqual(storage.bestScores(), { 1: 100 });
  assert.deepEqual(storage.topOverall(5).map((r) => r.slot), ['D2026-10-25', '1']);
  storage.clearScores(1);
  assert.equal(storage.getHighScore(1), 0);
  assert.equal(storage.getHighScore('D2026-10-25'), 800);
  storage.clearScores();
  assert.deepEqual(storage.topOverall(), []);
});

test('ajustes: valores por defecto y cambios guardados', () => {
  const storage = new StorageManager();
  const settings = storage.getSettings();
  assert.equal(settings.theme, 'retro');
  assert.equal(settings.autoFire, true);
  assert.equal(settings.gestures, false);
  storage.setSetting('theme', 'amber');
  assert.equal(storage.getSetting('theme'), 'amber');
  assert.equal(storage.getSetting('music'), 2, 'el resto sigue con su valor');
});

test('favoritos, recientes y preferencias de PREPARADO', () => {
  const storage = new StorageManager();
  assert.ok(storage.toggleFavorite(12));
  assert.ok(storage.toggleFavorite(40));
  assert.ok(!storage.toggleFavorite(12));
  assert.deepEqual(storage.getFavorites(), [40]);
  for (const n of [1, 2, 3, 2, 4, 5, 6, 7, 8]) storage.pushRecent(n);
  assert.deepEqual(storage.getRecent(), [8, 7, 6, 5, 4, 2], 'seis como mucho, sin repetir, el último primero');
  storage.pushRecent('x');
  assert.equal(storage.getRecent().length, 6);
  assert.deepEqual(storage.getLaunchPrefs('blockdrop'), { speed: 1, level: 1 });
  storage.setLaunchPrefs('blockdrop', { speed: 4, level: 7 });
  assert.deepEqual(storage.getLaunchPrefs('blockdrop'), { speed: 4, level: 7 });
  storage.setLaunchPrefs('roadracer', { speed: 40, level: 0.5 });
  assert.deepEqual(storage.getLaunchPrefs('roadracer'), { speed: 5, level: 1 }, 'fuera de rango se ajusta y lo que no es entero vuelve al de serie');
});
