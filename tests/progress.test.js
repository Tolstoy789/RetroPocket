// tests/progress.test.js
// Logros, racha del desafío diario, estadísticas, carcasas desbloqueables, copia de seguridad y datos
// guardados corruptos (Progress.js, Achievements.js y StorageManager.js).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openConsole } from '../tools/autoplay.js';

let con;
let catalog;
let StorageManager;
let Progress;
let shiftDay;
let ACHIEVEMENTS;
let missingGlyphs;

before(async () => {
  con = await openConsole();
  catalog = con.catalog;
  ({ StorageManager } = await con.load('/src/core/StorageManager.js'));
  ({ Progress, shiftDay } = await con.load('/src/core/Progress.js'));
  ({ ACHIEVEMENTS } = await con.load('/src/core/Achievements.js'));
  ({ missingGlyphs } = await con.load('/src/core/ConsoleEngine.js'));
});

after(() => con.close());

/** Juega el desafío de un día: empieza, suma un segundo y termina con un récord. */
function playDaily(progress, date) {
  const slot = catalog.dailyChallenge(date);
  progress.onGameStart(slot);
  progress.onPlayTick(1);
  progress.onGameEnd(slot, { score: 10, isHighScore: true }, 0);
}

test('40 logros con id único, icono de 7x7 y textos que caben', () => {
  assert.equal(ACHIEVEMENTS.length, 40);
  const ids = new Set();
  for (const a of ACHIEVEMENTS) {
    assert.ok(!ids.has(a.id), `id repetido: ${a.id}`);
    ids.add(a.id);
    assert.equal(a.icon.length, 7, `icono de ${a.id}`);
    assert.ok(a.icon.every((row) => row.length === 7), `icono de ${a.id}`);
    assert.ok(a.name.length <= 20, `nombre largo: ${a.name}`);
    assert.ok(a.desc.length <= 34, `descripción larga: ${a.desc}`);
    assert.deepEqual(missingGlyphs(`${a.name} ${a.desc}`), [], `${a.id}: letras que la fuente no tiene`);
  }
});

test('shiftDay cruza meses, años y cambios de hora', () => {
  assert.equal(shiftDay('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftDay('2026-03-29', 1), '2026-03-30');
  assert.equal(shiftDay('2026-10-25', 1), '2026-10-26');
});

test('racha de 7 días, avisos de logros y carcasas', () => {
  const storage = new StorageManager();
  const p = new Progress(storage, catalog);
  assert.ok(!p.isShellUnlocked('retro', 'red'), 'la carcasa roja empieza bloqueada');
  assert.ok(p.isShellUnlocked('retro', 'yellow'), 'la amarilla es la de serie');

  for (let d = 20; d <= 26; d++) playDaily(p, new Date(2026, 9, d));
  let info = p.streakInfo(new Date(2026, 9, 26, 12));
  assert.equal(info.current, 7);
  assert.ok(info.playedToday);
  info = p.streakInfo(new Date(2026, 9, 27, 9));
  assert.equal(info.current, 7, 'la racha sigue viva al día siguiente sin jugar');
  assert.ok(!info.playedToday);
  info = p.streakInfo(new Date(2026, 9, 28, 9));
  assert.equal(info.current, 0, 'se rompe tras un día sin jugar');
  assert.equal(info.best, 7);

  for (const id of ['streak7', 'daily', 'firstgame']) assert.ok(p.isUnlocked(id), id);
  assert.equal(p.stats.records, 0, 'el primer récord de un slot no cuenta como récord batido');
  assert.ok(p.isShellUnlocked('crystal', 'ice'), 'la racha de 7 regala el tinte hielo');
  assert.ok(p.stats.slots.length >= 1, 'el desafío cuenta el slot base');
  const fresh = p.takeFresh().map((a) => a.id);
  assert.ok(fresh.includes('streak7') && fresh.includes('firstgame'), fresh.join(','));
  assert.equal(p.takeFresh().length, 0, 'los avisos se entregan una vez');
});

test('contadores y marcas solo durante la partida, y se guardan al salir', () => {
  const storage = new StorageManager();
  const p = new Progress(storage, catalog);
  p.track('lines', 50);
  assert.ok(!p.stats.counters.lines, 'fuera de partida no cuenta');
  p.onGameStart(catalog.getSlot(1));
  p.track('lines', 60);
  p.track('lines', 50);
  assert.ok(p.isUnlocked('lines100'));
  p.peak('kmh', 150);
  p.peak('kmh', 120);
  assert.equal(p.stats.bests.kmh, 150, 'peak guarda el máximo');
  p.endSession();
  assert.equal(storage.loadExtra('stats', {}).counters.lines, 110);

  p.onGameStart(catalog.customizeSlot(catalog.getSlot(1), { speed: 5, level: 9 }));
  assert.ok(p.isUnlocked('expert'), 'velocidad 5 y nivel 9 dan el logro experto');
  p.endSession();
});

test('la copia de seguridad (código RP99-) restaura logros, racha y récords', () => {
  const storage = new StorageManager();
  const p = new Progress(storage, catalog);
  for (let d = 20; d <= 26; d++) playDaily(p, new Date(2026, 9, d));
  storage.submitScore(5, 1234, { level: 3 });
  const code = storage.exportCode();
  assert.match(code, /^RP99-/);

  const other = new StorageManager();
  assert.ok(other.importCode(code));
  const p2 = new Progress(other, catalog);
  assert.equal(p2.unlockedCount(), p.unlockedCount());
  assert.equal(p2.streakInfo(new Date(2026, 9, 26)).current, 7);
  assert.equal(other.getHighScore(5), 1234);

  const untouched = new StorageManager();
  assert.ok(!untouched.importCode('RP99-esto no es un codigo'));
  assert.ok(!untouched.importCode(''));
  assert.equal(untouched.getHighScore(5), 0);
});

test('datos guardados corruptos no rompen la consola', () => {
  const storage = new StorageManager();
  storage.saveExtra('stats', {
    games: 'x',
    slots: [1, 'a', 500, 1],
    perEngine: { a: null, blockdrop: { time: -5, games: 2 } },
    counters: { lines: 'mucho', food: 3 }
  });
  storage.saveExtra('achievements', ['no', 'es', 'un', 'objeto']);
  storage.saveExtra('streak', { days: ['2026-10-01', 'ayer', 5, '2026-10-02'], best: 'x' });
  const p = new Progress(storage, catalog);
  assert.equal(p.stats.games, 0);
  assert.deepEqual(p.stats.slots, [1]);
  assert.deepEqual(Object.keys(p.stats.perEngine), ['blockdrop']);
  assert.equal(p.stats.perEngine.blockdrop.time, 0);
  assert.deepEqual(p.stats.counters, { food: 3 });
  assert.equal(p.unlockedCount(), 0);
  assert.equal(p.days.length, 2);
  assert.equal(p.bestStreak, 2);
});
