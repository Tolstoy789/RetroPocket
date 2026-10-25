// tools/difficulty.js
// Informe de dificultad: juega cada slot varias veces con la IA del modo demo (en Node, sin navegador) y
// compara cada variante con la primera de su motor (la clásica): puntos (media geométrica), cuánto aguanta la IA y
// cuántas partidas pierde antes del tope de tiempo. Con eso propone cuánto escalar las metas de estrellas
// de cada variante (`stars` en ENGINES de Catalog99.js) y señala las variantes casi imposibles.
//
//   npm run difficulty                       → informe en la consola
//   npm run difficulty -- --write            → además lo guarda en docs/dificultad.md
//   npm run difficulty -- --runs 20 --seconds 240
//
// La IA no juega como una persona: reacciona al instante, no le afecta lo que no se ve (pieza invisible,
// noche, apagón) ni los controles en espejo, y en algunos motores es mucho mejor que nadie. Por eso solo
// se comparan variantes del mismo motor, la propuesta se suaviza (relación^0,6, entre ×0,4 y ×2), en las
// variantes rápidas nunca sube las metas, y donde la IA no ve la dificultad se ajusta a mano (MANUAL).

import { writeFileSync, mkdirSync } from 'node:fs';
import { openConsole, playSlot } from './autoplay.js';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};
const RUNS = option('runs', 40);
const SECONDS = option('seconds', 180);
const WRITE = args.includes('--write');

/** Multiplicadores posibles: la propuesta se redondea al más cercano (en escala logarítmica). */
const STEPS = [0.4, 0.5, 0.6, 0.7, 0.8, 1, 1.25, 1.5, 2];
const FAST = /RAPIDO|TURBO|ACELERA|VELOCES/;
/** Por debajo de estos segundos de media, la variante se marca como casi imposible para la IA. */
const TOO_HARD = 25;

/** Ajustes a mano donde la IA no nota la dificultad (o los puntos van en otra escala). */
export const MANUAL = {
  'blockdrop:INVISIBLE': 'La IA lee el tablero aunque las piezas no se vean; a una persona le cuesta mucho más.',
  'blockdrop:SPRINT 40': 'Acaba al completar 40 líneas, así que los puntos tienen techo: ★★ por terminar, ★★★ por terminar con muchas líneas de golpe.',
  'blockdrop:ESPEJO': 'La IA no nota los controles invertidos.',
  'blockdrop:CAOS': 'Sin sombra de caída, que la IA no necesita.',
  'mazemuncher:APAGON': 'La IA ve el laberinto a oscuras.',
  'brickbreaker:MINI PALA': 'La IA no falla con la pala pequeña; una persona sí.',
  'roadracer:NOCHE': 'La IA ve los coches de noche.',
  'spaceshooter:SIN ESCUDOS': 'La IA no se cubre con los escudos y gana al no tenerlos (no le tapan los disparos); a una persona le quitan la cobertura.',
  'flappypixel:ESTRECHO': 'La IA pasa los huecos estrechos sin fallar.',
  'memorymatrix:INVERSO': 'La IA invierte la secuencia sin esfuerzo.',
  'memorymatrix:REFLEJOS': 'Cada acierto vale un punto y llegan cada 1-2 s: es otra escala de puntos.'
};

/** Media geométrica: menos sensible que la media a las partidas excepcionales de la IA. */
const geomean = (values) => Math.exp(values.reduce((sum, v) => sum + Math.log(v + 1), 0) / values.length) - 1;

const median = (values) => {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

/** Multiplicador propuesto para las metas a partir de la relación de puntos con la variante clásica. */
export function suggestScale(ratio, label) {
  let scale = Math.max(ratio, 0.001) ** 0.6;
  if (FAST.test(label)) scale = Math.min(scale, 1);
  scale = Math.max(STEPS[0], Math.min(STEPS[STEPS.length - 1], scale));
  return STEPS.reduce((best, step) => (Math.abs(Math.log(step / scale)) < Math.abs(Math.log(best / scale)) ? step : best), 1);
}

const used = (slot) => (slot.starScale === null ? `[${slot.stars.join(', ')}]` : `×${slot.starScale}`);

const con = await openConsole();
const rows = [];
for (const slot of con.catalog.slots) {
  const Cartridge = await con.Cartridge(slot);
  const runs = [];
  for (let r = 0; r < RUNS; r++) runs.push(playSlot(con, Cartridge, slot, { seed: 1000 + r * 7919, seconds: SECONDS }));
  rows.push({
    slot,
    score: geomean(runs.map((r) => r.score)),
    seconds: median(runs.map((r) => r.seconds)),
    lost: runs.filter((r) => r.ended && !r.won).length / RUNS,
    won: runs.filter((r) => r.won).length / RUNS
  });
}
await con.close();

const lines = [];
const out = (text = '') => lines.push(text);
const notes = [];
const hard = [];
const differ = [];
for (const engine of con.catalog.engines) {
  const own = rows.filter((row) => row.slot.engine === engine);
  const base = Math.max(1, own[0].score);
  for (const row of own) {
    row.ratio = row.score / base;
    row.suggested = suggestScale(row.ratio, row.slot.label);
    row.manual = MANUAL[`${engine.id}:${row.slot.label}`] || '';
    if (row.manual) notes.push(row);
    if (row.lost === 1 && row.seconds < TOO_HARD) hard.push(row);
    if (!row.manual && row.slot.starScale !== row.suggested) differ.push(row);
  }
}

out('# Informe de dificultad');
out();
out(`Generado con \`npm run difficulty\`: ${RUNS} partidas por slot jugadas por la IA del modo demo, con un tope de ${SECONDS} s de juego cada una.`);
out();
out('- **Puntos**: media geométrica de las partidas. **Aguanta**: mediana de los segundos jugados.');
out('- **Relación**: puntos de la variante divididos por los de la primera variante del motor.');
out('- **Propuesta**: multiplicador para las metas de estrellas (relación^0,6 entre ×0,4 y ×2; en las variantes rápidas nunca más de ×1).');
out('- **Metas**: lo que usa hoy el slot (`stars` en Catalog99.js) y las puntuaciones de 1, 2 y 3 estrellas.');
out();
out('## Resumen');
out();
out(`- Variantes casi imposibles para la IA (pierde todas antes de ${TOO_HARD} s): ${hard.length ? hard.map((r) => `${r.slot.code} ${r.slot.engine.name} ${r.slot.label}`).join(', ') : 'ninguna'}. Sus metas están rebajadas.`);
out(`- Ajustes a mano: ${notes.length} (ver al final).`);
out(`- Metas que no siguen la propuesta sin estar en los ajustes a mano: ${differ.length ? differ.map((r) => `${r.slot.code} (${used(r.slot)} en vez de ×${r.suggested})`).join(', ') : 'ninguna'}.`);
out();
for (const engine of con.catalog.engines) {
  out(`## ${engine.name} (metas del motor ${engine.stars.join(' / ')})`);
  out();
  out('| Slot | Variante | Puntos | Relación | Aguanta | Pierde | Gana | Propuesta | Metas |');
  out('|---|---|---:|---:|---:|---:|---:|---:|---|');
  for (const row of rows.filter((r) => r.slot.engine === engine)) {
    const s = row.slot;
    const goals = `${used(s)}${row.manual ? ' (a mano)' : ''}: ${s.stars.join(' / ')}`;
    out(
      `| ${s.code} | ${s.label} | ${Math.round(row.score)} | ${row.ratio.toFixed(2)} | ${Math.round(row.seconds)} s | ${Math.round(row.lost * 100)} % | ${Math.round(row.won * 100)} % | ×${row.suggested} | ${goals} |`
    );
  }
  out();
}
out('## Ajustes a mano');
out();
for (const row of notes) out(`- **${row.slot.code} ${row.slot.engine.name} ${row.slot.label}** (${used(row.slot)}): ${row.manual}`);

const text = lines.join('\n');
console.log(text);
if (WRITE) {
  mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../docs/dificultad.md', import.meta.url), `${text}\n`);
  console.log('\nEscrito en docs/dificultad.md');
}
