// src/core/i18n.js
// Idioma de la consola (Opciones → IDIOMA: AUTO, ESPAÑOL o ENGLISH).
// Todo el código escribe sus textos en español y Gfx los traduce al dibujarlos con translate(), así que
// los motores y las pantallas no cambian: un texto nuevo solo necesita su traducción en src/core/lang/en.js
// (las pruebas juegan los 99 juegos y recorren la consola, y avisan si queda alguna palabra sin traducir).
// Lo que no se dibuja con la fuente de la consola (el mensaje al compartir, los avisos del navegador,
// las etiquetas para el lector de pantalla) elige su idioma con localize('español', 'english').
//
// Cómo se traduce un texto en inglés:
//   1. se normaliza como lo dibuja la fuente (mayúsculas, sin acentos, Ñ → N);
//   2. si está entero en el diccionario, se usa esa traducción;
//   3. si no, se prueban los patrones de EN_PATTERNS (textos con números o con otro orden de palabras);
//   4. si tampoco, se traduce cada trozo que esté en el diccionario, del más largo al más corto
//      ("05 SIN BORDES" → "05 NO WALLS"), y lo demás (números, nombres de los motores) se queda igual.

import { EN, EN_PATTERNS, EN_DOM } from './lang/en.js';

export const LANGUAGES = Object.freeze(['auto', 'es', 'en']);

/** Idiomas del sistema que pasan a español con AUTO; con cualquier otro, la consola se pone en inglés. */
const SPANISH_FAMILY = ['es', 'ca', 'gl', 'eu'];
const CACHE_LIMIT = 4000;

let current = 'es';
const cache = new Map();

/** Mayúsculas y sin acentos, como los dibuja la fuente 3x5 (la Ñ pasa a N). */
export function normalizeText(text) {
  return String(text)
    .replace(/ñ/gi, 'N')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}

const DICT = new Map(Object.entries(EN).map(([es, en]) => [normalizeText(es), en]));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Trozos del diccionario, del más largo al más corto, sin cortar palabras ni números.
const PHRASES = new RegExp(
  `(?<![A-Z0-9])(?:${[...DICT.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escapeRe)
    .join('|')})(?![A-Z0-9])`,
  'g'
);

/** 'es' o 'en' según los idiomas preferidos del navegador o del teléfono. */
export function systemLanguage(preferred = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : []) {
  const first = String(preferred.find(Boolean) || 'es').toLowerCase();
  return SPANISH_FAMILY.includes(first.split('-')[0]) ? 'es' : 'en';
}

/** Idioma que corresponde al ajuste ('auto' | 'es' | 'en'). */
export function resolveLanguage(setting, preferred) {
  return setting === 'es' || setting === 'en' ? setting : systemLanguage(preferred);
}

export function getLanguage() {
  return current;
}

/** Cambia el idioma de todo lo que se dibuja a partir de ahora (y el de la página, para el lector de pantalla). */
export function setLanguage(language) {
  const next = language === 'en' ? 'en' : 'es';
  if (next === current) return;
  current = next;
  cache.clear();
  if (typeof document !== 'undefined') translateDocument(document);
}

/** El texto en el idioma actual (para lo que no pasa por translate(): mensajes en minúsculas y etiquetas). */
export function localize(es, en) {
  return current === 'en' ? en : es;
}

/** Traduce un texto de la consola al idioma actual. En español lo devuelve tal cual. */
export function translate(text) {
  if (current === 'es' || text === '' || text === null || text === undefined) return text;
  const raw = String(text);
  let out = cache.get(raw);
  if (out === undefined) {
    out = toEnglish(raw);
    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(raw, out);
  }
  return out;
}

function toEnglish(raw) {
  const key = normalizeText(raw);
  const exact = DICT.get(key);
  if (exact !== undefined) return exact;
  for (const [pattern, replace] of EN_PATTERNS) {
    const match = key.match(pattern);
    if (match) return replace(match, toEnglish);
  }
  return key.replace(PHRASES, (piece) => DICT.get(piece));
}

/**
 * Etiquetas de la página (los botones para el lector de pantalla y la descripción): guarda el texto
 * en español la primera vez y pone el del idioma actual.
 */
export function translateDocument(doc) {
  doc.documentElement.lang = current;
  for (const el of doc.querySelectorAll('[aria-label]')) {
    if (!el.dataset.labelEs) el.dataset.labelEs = el.getAttribute('aria-label');
    const es = el.dataset.labelEs;
    el.setAttribute('aria-label', current === 'en' ? EN_DOM[es] || es : es);
  }
}
