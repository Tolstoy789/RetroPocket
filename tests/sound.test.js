// tests/sound.test.js
// Música y efectos (SoundChip.js): las pistas están bien escritas, cada motor tiene sus dos pistas, los
// nombres de efectos que usa el código existen y todo suena (con un Web Audio de mentira) en modo chip y
// en modo beeper, con todos los timbres de los temas.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { openConsole } from '../tools/autoplay.js';
import { installFakeAudio } from './fake-audio.js';

const DRUM_HITS = new Set(['k', 's', 'h', '-']);

let con;
let sound;
let catalog;
let BOOT_SCENES;

before(async () => {
  installFakeAudio();
  con = await openConsole();
  catalog = con.catalog;
  sound = await con.load('/src/core/SoundChip.js');
  ({ BOOT_SCENES } = await con.load('/src/core/BootScenes.js'));
});

after(() => con.close());

/** Todos los .js de src/, con su ruta. */
function sources(dir = new URL('../src/', import.meta.url)) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) files.push(...sources(url));
    else if (entry.name.endsWith('.js')) files.push({ name: url.pathname.split('/src/')[1], text: readFileSync(url, 'utf8') });
  }
  return files;
}

/** Hace sonar `seconds` segundos de música avanzando el reloj de audio como lo haría el navegador. */
function runMusic(chip, seconds) {
  for (let t = 0; t < seconds; t += 1 / 60) {
    chip.ctx.currentTime += 1 / 60;
    chip.updateMusic();
  }
}

test('pistas: 32 corcheas por voz, notas que existen y batería con k, s, h o -', () => {
  for (const [id, def] of Object.entries(sound.MUSIC_TRACKS)) {
    assert.ok(def.tempo >= 60 && def.tempo <= 240, `${id}: tempo ${def.tempo}`);
    for (const voice of ['lead', 'bass']) {
      const tokens = def[voice].trim().split(/\s+/);
      assert.equal(tokens.length, 32, `${id}.${voice} tiene ${tokens.length} pasos`);
      assert.notEqual(tokens[0], '_', `${id}.${voice} no puede empezar alargando una nota`);
      for (const token of tokens) {
        if (token === '-' || token === '_') continue;
        const freq = sound.noteToFreq(token);
        assert.ok(freq >= 30 && freq <= 4200, `${id}.${voice}: nota "${token}" (${freq} Hz)`);
      }
    }
    const drums = def.drums.trim().split(/\s+/);
    assert.equal(drums.length, 32, `${id}.drums tiene ${drums.length} pasos`);
    assert.ok(drums.every((d) => DRUM_HITS.has(d)), `${id}.drums: ${def.drums}`);
  }
});

test('cada motor tiene su pista y la segunda para los niveles pares', () => {
  for (const engine of catalog.engines) {
    assert.ok(sound.getTrack(engine.id), `falta la pista ${engine.id}`);
    assert.ok(sound.getTrack(`${engine.id}_b`), `falta la pista ${engine.id}_b`);
    assert.equal(sound.trackFor(engine.id, 1), engine.id);
    assert.equal(sound.trackFor(engine.id, 2), `${engine.id}_b`);
    assert.equal(sound.trackFor(engine.id, 7), engine.id);
  }
  assert.ok(sound.getTrack('menu'));
});

test('melodías con notas que existen', () => {
  for (const [id, def] of Object.entries(sound.MELODIES)) {
    assert.ok(def.notes.length > 0, id);
    for (const [note, beats] of def.notes) {
      assert.ok(beats > 0, `${id}: duración ${beats}`);
      if (note !== '-') assert.ok(sound.noteToFreq(note) > 0, `${id}: nota "${note}"`);
    }
  }
});

test('los efectos y melodías que pide el código existen', () => {
  const missing = [];
  for (const { name, text } of sources()) {
    for (const [, kind, id] of text.matchAll(/\b(sfx|melody)\(\s*['"]([\w-]+)['"]/g)) {
      const table = kind === 'sfx' ? sound.SFX : sound.MELODIES;
      if (!table[id]) missing.push(`${name}: ${kind}('${id}')`);
    }
  }
  for (const scene of BOOT_SCENES) if (!sound.SFX[scene.jingle]) missing.push(`jingle de arranque ${scene.jingle}`);
  for (const season of ['seasonAutumn', 'seasonWinter', 'seasonSpring', 'seasonSummer']) {
    if (!sound.SFX[season]) missing.push(`jingle de temporada ${season}`);
  }
  assert.deepEqual(missing, []);
});

test('todo suena en modo chip y en modo beeper, con todos los timbres', () => {
  const chip = new sound.SoundChip({ volumeLevel: 'high' });
  assert.ok(chip.ensureContext(), 'crea el contexto de audio');
  for (const beeper of [false, true]) {
    chip.setBeeper(beeper);
    for (const flavor of Object.keys(sound.FLAVORS)) {
      chip.setFlavor(flavor);
      for (const name of Object.keys(sound.SFX)) {
        const length = chip.sfx(name);
        assert.ok(length > 0 && length < 5, `${flavor}${beeper ? ' beeper' : ''}: sfx ${name} dura ${length}`);
      }
      for (const name of Object.keys(sound.MELODIES)) assert.ok(chip.melody(name) > 0, `melodía ${name}`);
      chip.stopAll();
    }
  }
  assert.ok(chip.ctx.voices > 1000, `solo arrancaron ${chip.ctx.voices} voces`);
});

test('la música avanza, cambia de pista al final de la frase y el analizador da 16 bandas', () => {
  const chip = new sound.SoundChip({ volumeLevel: 'high' });
  chip.ensureContext();
  for (const beeper of [false, true]) {
    chip.setBeeper(beeper);
    for (const id of Object.keys(sound.MUSIC_TRACKS)) {
      chip.playMusic(id);
      const before = chip.ctx.voices;
      runMusic(chip, 1.5);
      assert.equal(chip.music.id, id);
      assert.ok(chip.ctx.voices > before, `${id}${beeper ? ' beeper' : ''}: no sonó ninguna nota`);
      const pos = chip.musicPosition();
      assert.equal(pos.id, id);
      assert.ok(pos.step >= 0 && pos.step < pos.length, `${id}: paso ${pos.step} de ${pos.length}`);
    }
  }
  chip.setBeeper(false);
  chip.playMusic('blockdrop');
  runMusic(chip, 0.5);
  chip.queueMusic('blockdrop_b');
  assert.equal(chip.music.id, 'blockdrop', 'no corta la frase');
  runMusic(chip, 8);
  assert.equal(chip.music.id, 'blockdrop_b', 'cambia al empezar la siguiente mitad');
  const bands = chip.spectrum(16);
  assert.equal(bands.length, 16);
  assert.ok(bands.every((b) => b >= 0 && b <= 1), bands.join(','));
  chip.stopMusic();
  assert.ok(!chip.music.playing);
  for (let i = 0; i < 4; i++) chip.cycleVolume();
  chip.setBusLevels({ music: 0, sfx: 1 });
  chip.stopAll();
});
