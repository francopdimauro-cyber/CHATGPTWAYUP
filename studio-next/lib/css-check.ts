/** Editor CSS de WAY UP Studio: troceado (para colorear) y validación con mensajes en castellano.
 *  Modos: «declaraciones» (estilo de un elemento), «anidado» (bloque de una sección, admite reglas anidadas)
 *  y «hoja» (CSS global). */

export type CssMode = 'declaraciones' | 'anidado' | 'hoja';
export type CssTokenKind = 'comment' | 'selector' | 'at' | 'prop' | 'value' | 'num' | 'color' | 'punct' | 'string' | 'plain' | 'important';
export type CssToken = { text: string; kind: CssTokenKind };
export type CssIssue = { line: number; message: string; level: 'error' | 'aviso' };

type Piece = { kind: 'comment' | 'prelude' | 'decl' | 'open' | 'close' | 'semi' | 'space'; text: string; start: number; depth: number; inKeyframes: boolean };

/** Divide el texto en piezas respetando comentarios y cadenas. */
function pieces(src: string, mode: CssMode): { list: Piece[]; unclosed: { line: number }[]; extraClose: number[] } {
  const list: Piece[] = [];
  const stack: { keyframes: boolean; start: number }[] = [];
  const extraClose: number[] = [];
  let buf = '', bufStart = 0;
  const base = mode === 'hoja' ? 0 : 1; // en «declaraciones» y «anidado» ya estamos dentro de un bloque
  const depth = () => base + stack.length;
  const inKf = () => stack.some(s => s.keyframes);
  const flush = (as: 'decl' | 'prelude') => {
    if (!buf) return;
    const lead = /^\s*/.exec(buf)![0];
    if (lead) list.push({ kind: 'space', text: lead, start: bufStart, depth: depth(), inKeyframes: inKf() });
    const body = buf.slice(lead.length);
    if (body) list.push({ kind: as, text: body, start: bufStart + lead.length, depth: depth(), inKeyframes: inKf() });
    buf = '';
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (!buf) bufStart = i;
    if (c === '/' && src[i + 1] === '*') {
      flush(depth() > 0 ? 'decl' : 'prelude');
      const end = src.indexOf('*/', i + 2), stop = end < 0 ? src.length : end + 2;
      list.push({ kind: 'comment', text: src.slice(i, stop), start: i, depth: depth(), inKeyframes: inKf() });
      i = stop - 1; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1; while (j < src.length && src[j] !== c && src[j] !== '\n') { if (src[j] === '\\') j++; j++; }
      buf += src.slice(i, j + 1); i = j; continue;
    }
    if (c === '{') {
      flush('prelude');
      const prelude = list[list.length - 1]?.kind === 'prelude' ? list[list.length - 1].text : '';
      list.push({ kind: 'open', text: c, start: i, depth: depth(), inKeyframes: inKf() });
      stack.push({ keyframes: /^@(-\w+-)?keyframes\b/i.test(prelude), start: i });
      continue;
    }
    if (c === '}') {
      flush('decl');
      if (stack.length) stack.pop(); else extraClose.push(i);
      list.push({ kind: 'close', text: c, start: i, depth: depth(), inKeyframes: inKf() });
      continue;
    }
    if (c === ';') { flush(depth() > 0 ? 'decl' : 'prelude'); list.push({ kind: 'semi', text: c, start: i, depth: depth(), inKeyframes: inKf() }); continue; }
    buf += c;
  }
  // Lo que queda: declaración si estamos dentro de un bloque, o selector sin «{».
  const tail = buf; flush(depth() > 0 ? 'decl' : 'prelude');
  void tail;
  const lineOf = (pos: number) => src.slice(0, pos).split('\n').length;
  return { list, unclosed: stack.map(s => ({ line: lineOf(s.start) })), extraClose: extraClose.map(lineOf) };
}

const VALUE_RE = /(#[\da-f]{3,8}\b)|(-?\d*\.?\d+(?:[a-z%]+)?)|(!important)|("[^"]*"|'[^']*')|([^#\d!"'-]+|.)/gi;
function valueTokens(text: string): CssToken[] {
  const out: CssToken[] = [];
  for (const m of text.matchAll(VALUE_RE)) {
    out.push({ text: m[0], kind: m[1] ? 'color' : m[2] ? 'num' : m[3] ? 'important' : m[4] ? 'string' : 'value' });
  }
  return out;
}

/** Fichas para colorear el texto (la concatenación de sus textos es exactamente el original). */
export function tokenizeCss(src: string, mode: CssMode): CssToken[] {
  const out: CssToken[] = [];
  let pos = 0;
  for (const p of pieces(src, mode).list) {
    if (p.start > pos) out.push({ text: src.slice(pos, p.start), kind: 'plain' });
    if (p.kind === 'comment') out.push({ text: p.text, kind: 'comment' });
    else if (p.kind === 'prelude') out.push({ text: p.text, kind: p.text.startsWith('@') ? 'at' : 'selector' });
    else if (p.kind === 'open' || p.kind === 'close' || p.kind === 'semi') out.push({ text: p.text, kind: 'punct' });
    else if (p.kind === 'space') out.push({ text: p.text, kind: 'plain' });
    else {
      const colon = p.text.indexOf(':');
      if (colon < 0 || p.text.startsWith('@')) out.push({ text: p.text, kind: p.text.startsWith('@') ? 'at' : 'prop' });
      else { out.push({ text: p.text.slice(0, colon), kind: 'prop' }, { text: ':', kind: 'punct' }, ...valueTokens(p.text.slice(colon + 1))); }
    }
    pos = p.start + p.text.length;
  }
  if (pos < src.length) out.push({ text: src.slice(pos), kind: 'plain' });
  return out;
}

/** Patrones que nunca se aceptan (rompen la página o cargan cosas de fuera). */
export function forbiddenCss(src: string): string | null {
  if (/<\/?\s*style/i.test(src)) return 'No se puede escribir «</style>» dentro del CSS.';
  if (/@import\b/i.test(src)) return '@import no está permitido: añade las fuentes desde Propiedades › Tipografía.';
  if (/url\(\s*['"]?\s*(?:https?:|\/\/|javascript:|data:text)/i.test(src)) return 'Las imágenes de fondo deben ser archivos del proyecto (no direcciones de internet).';
  if (/expression\s*\(|-moz-binding|behavior\s*:/i.test(src)) return 'Ese CSS no está permitido por seguridad.';
  return null;
}

let knownProps: string[] | null = null;
function propertyNames(): string[] {
  if (knownProps) return knownProps;
  try {
    const s = getComputedStyle(document.documentElement);
    knownProps = Array.from({ length: s.length }, (_, i) => s[i]);
  } catch { knownProps = []; }
  return knownProps;
}
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function suggest(prop: string): string {
  let best = '', score = 3;
  for (const p of propertyNames()) { if (Math.abs(p.length - prop.length) > 2) continue; const s = distance(prop, p); if (s < score) { score = s; best = p; } }
  return best ? ' ¿Querías decir «' + best + '»?' : '';
}
const supports = (prop: string, value: string) => { try { return CSS.supports(prop, value); } catch { return true; } };
const supportsSelector = (sel: string) => { try { return CSS.supports('selector(' + sel + ')'); } catch { return true; } };

/** Revisa el CSS y devuelve errores y avisos con su línea. */
export function checkCss(src: string, mode: CssMode): CssIssue[] {
  const issues: CssIssue[] = [];
  const lineOf = (pos: number) => src.slice(0, pos).split('\n').length;
  const bad = forbiddenCss(src);
  if (bad) issues.push({ line: 1, message: bad, level: 'error' });
  const { list, unclosed, extraClose } = pieces(src, mode);
  for (const u of unclosed) issues.push({ line: u.line, message: 'Falta cerrar la llave «{» abierta aquí con «}».', level: 'error' });
  for (const l of extraClose) issues.push({ line: l, message: 'Sobra una llave «}».', level: 'error' });
  if (/\/\*(?![\s\S]*\*\/)/.test(src)) issues.push({ line: lineOf(src.lastIndexOf('/*')), message: 'Comentario sin cerrar: falta «*/».', level: 'error' });
  for (let k = 0; k < list.length; k++) {
    const p = list[k], line = lineOf(p.start);
    if (p.kind === 'prelude') {
      const next = list[k + 1];
      if (p.text.startsWith('@')) {
        if (!/^@(media|supports|container|keyframes|-webkit-keyframes|font-face|layer)\b/i.test(p.text)) issues.push({ line, message: 'Regla «' + p.text.split(/\s/)[0] + '» no admitida aquí.', level: 'aviso' });
        continue;
      }
      if (!next || next.kind !== 'open') { issues.push({ line, message: 'Falta «{» después del selector «' + p.text.trim().slice(0, 40) + '».', level: 'error' }); continue; }
      if (mode === 'declaraciones') { issues.push({ line, message: 'En «Elemento» solo van propiedades (p. ej. «color: red;»), sin selectores.', level: 'error' }); continue; }
      if (!p.inKeyframes) {
        const sel = p.text.trim().replace(/&/g, ':scope');
        for (const part of sel.split(',')) if (part.trim() && !supportsSelector(part.trim()))
          issues.push({ line, message: 'Selector no válido: «' + part.trim().slice(0, 60) + '».', level: 'error' });
      }
      continue;
    }
    if (p.kind !== 'decl') continue;
    const text = p.text.trim();
    if (!text) continue;
    if (p.inKeyframes && !text.includes(':')) continue;
    const colon = text.indexOf(':');
    if (colon < 0) { issues.push({ line, message: 'A «' + text.slice(0, 40) + '» le faltan los dos puntos y un valor (p. ej. «color: red;»).', level: 'error' }); continue; }
    const prop = text.slice(0, colon).trim().toLowerCase();
    const value = text.slice(colon + 1).trim().replace(/\s*!important$/i, '');
    if (!value) { issues.push({ line, message: 'A «' + prop + '» le falta el valor.', level: 'error' }); continue; }
    if (prop.startsWith('--')) continue;
    if (!/^-?[a-z][a-z-]*$/.test(prop)) { issues.push({ line, message: 'Nombre de propiedad no válido: «' + prop + '».', level: 'error' }); continue; }
    if (!supports(prop, 'inherit')) { issues.push({ line, message: 'Propiedad desconocida «' + prop + '».' + suggest(prop), level: prop.startsWith('-') ? 'aviso' : 'error' }); continue; }
    if (!/var\(|env\(|attr\(/i.test(value) && !supports(prop, value)) issues.push({ line, message: 'Valor no válido para «' + prop + '»: «' + value.slice(0, 60) + '».', level: 'error' });
    const next = list[k + 1];
    if (next && next.kind !== 'semi' && next.kind !== 'close') issues.push({ line, message: 'Falta «;» al final de «' + prop + '».', level: 'error' });
  }
  return issues.sort((a, b) => a.line - b.line);
}

/** Estilo en línea → una declaración por línea (para el modo «Elemento»). */
export function prettyDeclarations(style: CSSStyleDeclaration): string {
  const out: string[] = [];
  for (let i = 0; i < style.length; i++) {
    const p = style[i];
    out.push(p + ': ' + style.getPropertyValue(p) + (style.getPropertyPriority(p) ? ' !important' : '') + ';');
  }
  return out.join('\n');
}
