// src/core/SaveState.js
// Convierte el estado de una partida en datos JSON y al revés, para «Guardar la partida al salir».
// Además de lo que admite JSON, guarda Map, Set, undefined, NaN e Infinity, y respeta los objetos
// compartidos y los ciclos (si dos campos apuntan al mismo objeto, al cargar siguen apuntando al mismo).
// Solo acepta datos: si encuentra una función o un objeto de una clase (un lienzo, por ejemplo), lanza un
// error que dice dónde, para que el motor lo excluya con `static transient` (ver BaseCartridge).
// Las constantes del motor (direcciones, formas de piezas...) se guardan por su nombre ({ $c: 'DIRS.UP' })
// y al cargar vuelven a ser el mismo objeto, así que comparar con === o buscar con indexOf sigue funcionando.
//
// Formato: { nodes: [...], root } donde cada objeto es un nodo ({ a: [...] } lista, { o: {...} } objeto,
// { m: [[k, v]...] } Map, { s: [...] } Set) y se le apunta con { $r: índice }.

const SPECIAL_NUMBERS = { NaN: NaN, Infinity: Infinity, '-Infinity': -Infinity };

function isPlainObject(value) {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Todos los objetos que hay dentro de `constants` ({ DIRS, SHAPES }), con su ruta ('DIRS.UP'). */
function indexConstants(constants) {
  const byObject = new Map();
  const byPath = new Map();
  const visit = (value, path) => {
    if (value === null || typeof value !== 'object' || byObject.has(value)) return;
    byObject.set(value, path);
    byPath.set(path, value);
    for (const key of Object.keys(value)) visit(value[key], `${path}.${key}`);
  };
  for (const [name, value] of Object.entries(constants)) visit(value, name);
  return { byObject, byPath };
}

/**
 * Estado → datos JSON. `constants` son las constantes del módulo que el estado puede referenciar
 * (se guardan por nombre); `path` solo sirve para los mensajes de error.
 */
export function encodeState(root, { constants = {}, path = 'estado' } = {}) {
  const ids = new Map();
  const nodes = [];
  const { byObject } = indexConstants(constants);

  const encode = (value, where) => {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
    if (typeof value === 'number') {
      if (Number.isFinite(value)) return Object.is(value, -0) ? 0 : value;
      return { $n: String(value) };
    }
    if (value === undefined) return { $u: 1 };
    if (typeof value !== 'object') throw new TypeError(`${where}: no se puede guardar un valor de tipo ${typeof value}`);
    if (byObject.has(value)) return { $c: byObject.get(value) };
    if (ids.has(value)) return { $r: ids.get(value) };
    const id = nodes.length;
    ids.set(value, id);
    nodes.push(null);
    if (Array.isArray(value)) {
      nodes[id] = { a: value.map((item, i) => encode(item, `${where}[${i}]`)) };
    } else if (value instanceof Map) {
      nodes[id] = { m: [...value].map(([k, v], i) => [encode(k, `${where}.clave${i}`), encode(v, `${where}.valor${i}`)]) };
    } else if (value instanceof Set) {
      nodes[id] = { s: [...value].map((item, i) => encode(item, `${where}{${i}}`)) };
    } else if (isPlainObject(value)) {
      const fields = {};
      for (const key of Object.keys(value)) fields[key] = encode(value[key], `${where}.${key}`);
      nodes[id] = { o: fields };
    } else {
      throw new TypeError(`${where}: no se puede guardar un ${value.constructor?.name || 'objeto'}`);
    }
    return { $r: id };
  };

  const encodedRoot = encode(root, path);
  return { nodes, root: encodedRoot };
}

/** Datos JSON → estado (con los objetos compartidos, los ciclos y las constantes como estaban). */
export function decodeState(data, { constants = {} } = {}) {
  if (!data || !Array.isArray(data.nodes)) throw new TypeError('Partida guardada no válida');
  const { byPath } = indexConstants(constants);
  const made = data.nodes.map((node) => {
    if (!node || typeof node !== 'object') throw new TypeError('Partida guardada no válida');
    if ('a' in node) return [];
    if ('m' in node) return new Map();
    if ('s' in node) return new Set();
    if ('o' in node) return {};
    throw new TypeError('Partida guardada no válida');
  });
  const decode = (value) => {
    if (value === null || typeof value !== 'object') return value;
    if ('$r' in value) {
      if (!Number.isInteger(value.$r) || !made[value.$r]) throw new TypeError('Partida guardada no válida');
      return made[value.$r];
    }
    if ('$c' in value) {
      if (!byPath.has(value.$c)) throw new TypeError(`Partida guardada no válida: no existe la constante ${value.$c}`);
      return byPath.get(value.$c);
    }
    if ('$n' in value) return SPECIAL_NUMBERS[value.$n] ?? NaN;
    if ('$u' in value) return undefined;
    throw new TypeError('Partida guardada no válida');
  };
  data.nodes.forEach((node, i) => {
    const target = made[i];
    if ('a' in node) for (const item of node.a) target.push(decode(item));
    else if ('m' in node) for (const [k, v] of node.m) target.set(decode(k), decode(v));
    else if ('s' in node) for (const item of node.s) target.add(decode(item));
    else {
      for (const [key, value] of Object.entries(node.o)) {
        Object.defineProperty(target, key, { value: decode(value), writable: true, enumerable: true, configurable: true });
      }
    }
  });
  return decode(data.root);
}
