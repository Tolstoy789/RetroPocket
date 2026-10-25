// src/core/Announcer.js
// Lectura por voz para quien usa un lector de pantalla (TalkBack, VoiceOver, NVDA...). La consola describe
// con unas frases lo que hay en pantalla (el juego elegido en el menú y su récord, la fila de Opciones, la
// puntuación al pausar o al terminar...) y el Announcer las escribe en una región aria-live invisible de
// index.html, que el lector lee en voz alta. Sin lector de pantalla no se oye nada.
//   · describe(): la descripción de la pantalla; se lee cuando lleva un momento sin cambiar, así que al pasar
//     deprisa por el menú solo se lee el juego en el que te paras.
//   · notice(): un aviso (los de arriba de la pantalla y los logros), que se lee enseguida y aparte.
// Los textos llegan en español, como los dibuja la consola, y se traducen con el idioma elegido.

import { translate } from './i18n.js';

/** Segundos que una descripción tiene que quedarse quieta antes de leerse. */
export const SETTLE = 0.35;

/** Los símbolos de la fuente (flechas, estrellas, corazón, notas) no se leen. */
const SYMBOLS = /[★♥▲▼◀▶♪×]/g;

/**
 * Frase para leer en voz alta: cada trozo traducido y en minúsculas (o tal cual si es { raw }), sin los
 * símbolos de la fuente y como una frase con su punto. En minúsculas porque algunos lectores deletrean
 * las palabras en mayúsculas como si fueran siglas.
 */
export function speakable(parts) {
  const sentences = [];
  for (const part of parts) {
    if (part === null || part === undefined) continue;
    const raw = typeof part === 'object';
    const text = (raw ? String(part.raw) : translate(String(part)).toLowerCase()).replace(SYMBOLS, ' ').replace(/\s+/g, ' ').trim();
    if (/[\p{L}\p{N}]/u.test(text)) sentences.push(sentence(text));
  }
  return sentences.join(' ');
}

/** Identifica una descripción para ver si ha cambiado. */
const keyOf = (parts) => parts.map((part) => (typeof part === 'object' && part !== null ? `=${part.raw}` : String(part))).join('\n');

/** "¡nuevo record!" → "¡Nuevo record!"; "puntos 120" → "Puntos 120." */
function sentence(text) {
  const first = text.search(/\p{L}/u);
  const capital = first < 0 ? text : text.slice(0, first) + text.charAt(first).toUpperCase() + text.slice(first + 1);
  return /[.!?:]$/.test(capital) ? capital : `${capital}.`;
}

export class Announcer {
  /** @param {Document|null} doc página con las regiones #announcer y #announcer-notice (si faltan, se crean) */
  constructor(doc = typeof document !== 'undefined' ? document : null) {
    this.screen = region(doc, 'announcer', 'polite');
    this.alert = region(doc, 'announcer-notice', 'assertive');
    this.key = ''; // descripción actual (los textos en español, sin traducir)
    this.wait = 0;
    this.spoken = false; // ya se ha leído (se vuelve a leer si cambia, aunque luego vuelva a ser la misma)
    this.history = []; // lo último que se ha leído (para las pruebas)
  }

  /** Descripción de la pantalla en este paso: una lista de textos en español (vacía si no hay nada que leer). */
  describe(parts, dt) {
    const key = keyOf(parts);
    if (key !== this.key) {
      this.key = key;
      this.wait = 0;
      this.spoken = false;
      return;
    }
    if (this.spoken || !parts.length) return;
    this.wait += dt;
    if (this.wait >= SETTLE) {
      this.spoken = true;
      this._write(this.screen, speakable(parts));
    }
  }

  /** Lee un aviso enseguida, aparte de la descripción de la pantalla. */
  notice(parts) {
    this._write(this.alert, speakable(Array.isArray(parts) ? parts : [parts]));
  }

  _write(el, text) {
    if (!text) return;
    this.history.push(text);
    if (this.history.length > 20) this.history.shift();
    if (!el) return;
    // Si el texto es igual al anterior el lector no lo repite: se vacía antes para que se vuelva a leer.
    if (el.textContent === text) el.textContent = '';
    el.textContent = text;
  }
}

/** La región aria-live con ese id (la de index.html o una nueva, invisible). */
function region(doc, id, live) {
  if (!doc || !doc.body) return null;
  let el = doc.getElementById(id);
  if (!el) {
    el = doc.createElement('div');
    el.id = id;
    el.className = 'sr-only';
    doc.body.appendChild(el);
  }
  el.setAttribute('aria-live', live);
  el.setAttribute('aria-atomic', 'true');
  if (live === 'polite') el.setAttribute('role', 'status');
  return el;
}
