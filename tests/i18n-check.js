// tests/i18n-check.js
// Comprobación de las traducciones al inglés que usan tests/i18n.test.js (textos del catálogo, los logros,
// los temas, los avisos y los que dibujan los 99 juegos) y tests/e2e/console.test.js (todos los que se ven
// en las pantallas de la consola). Para cada texto en español mira su traducción y avisa si:
//   · le queda alguna palabra en español (una palabra de los textos en español que no sale en ninguna
//     traducción ni es un nombre propio como BLOCK DROP);
//   · le quedan ¡ o ¿, o letras que la fuente 3x5 no tiene;
//   · ocupa más de dos letras más que el original (la pantalla mide 144 px) o no cabe en una línea.

import { translate, setLanguage, getLanguage, normalizeText } from '../src/core/i18n.js';
import { EN } from '../src/core/lang/en.js';

/** Palabras que se quedan igual en inglés aunque salgan en los textos en español. */
const NEUTRAL = ['RETRO', 'RETROPOCKET', 'JUKEBOX', 'JINGLES', 'ARCADE', 'VAPORWAVE', 'PENTA', 'INVISIBLE', 'INVASION', 'SPRINT', 'SIMON', 'LUNAR', 'ARENA', 'BPM', 'ESPANOL', 'ENGLISH'];
const MAX_CHARS = 36; // letras de 4 px en 144 px
const WRAP = 34; // letras por línea de las descripciones del menú (ver CatalogMenu)

/** Las líneas en que el menú parte un texto (como wrapText de Catalog99.js). */
function wrap(text) {
  const lines = [];
  let current = '';
  for (const word of text.split(' ')) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > WRAP && current) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines;
}

/** Palabras de un texto (sin números ni signos). */
export const wordsOf = (text) => normalizeText(text).split(/[^A-Z']+/).filter((w) => w.replace(/'/g, '').length > 1);

const englishWords = new Set([...Object.values(EN).flatMap(wordsOf), ...NEUTRAL]);
const spanishWords = new Set(Object.keys(EN).flatMap(wordsOf));

/**
 * Devuelve la lista de problemas (vacía si todo está bien).
 * @param {string[]} texts textos en español, tal como los dibuja el código
 * @param {{ names?: string[], missingGlyphs?: (text: string) => string[] }} [o] nombres propios que no se
 *   traducen (los de los motores), la función que dice qué letras no tiene la fuente y, para los textos
 *   que se parten en líneas de 34 letras como las descripciones del menú, cuántas líneas caben
 */
export function checkTranslations(texts, { names = [], missingGlyphs = null, lines = 0 } = {}) {
  const previous = getLanguage();
  setLanguage('en');
  const english = new Set([...englishWords, ...names.flatMap(wordsOf)]);
  const spanish = new Set([...spanishWords, ...texts.flatMap(wordsOf)]);
  const problems = [];
  for (const text of new Set(texts)) {
    const es = normalizeText(text);
    const en = normalizeText(translate(text));
    const left = wordsOf(en).filter((w) => spanish.has(w) && !english.has(w));
    if (left.length) problems.push(`"${es}" → "${en}": sin traducir ${left.join(', ')}`);
    if (/[¡¿]/.test(en)) problems.push(`"${es}" → "${en}": le quedan ¡ o ¿`);
    const missing = missingGlyphs ? missingGlyphs(en) : [];
    if (missing.length) problems.push(`"${es}" → "${en}": la fuente no tiene ${missing.join(' ')}`);
    if (lines) {
      // Texto que se parte en líneas (las descripciones del menú): tiene que caber en `lines` líneas.
      if (wrap(en).length > lines) problems.push(`"${es}" → "${en}": no cabe en ${lines} líneas`);
    } else if (en.length > Math.max(es.length + 2, 5) || (en.length > MAX_CHARS && en.length > es.length)) {
      problems.push(`"${es}" → "${en}": ${en.length} letras y el original tiene ${es.length}`);
    }
  }
  setLanguage(previous);
  return problems;
}

/** Claves del diccionario que, normalizadas, coinciden con otra y tienen distinta traducción. */
export function dictionaryClashes() {
  const seen = new Map();
  const clashes = [];
  for (const [es, en] of Object.entries(EN)) {
    const key = normalizeText(es);
    if (seen.has(key) && seen.get(key) !== en) clashes.push(`"${es}": "${seen.get(key)}" o "${en}"`);
    seen.set(key, en);
  }
  return clashes;
}
