/** Auditoría automática de una web generada (sin IA): la pinta en un marco oculto a un ancho dado y MIDE
 *  problemas reales — desbordes horizontales, textos que se salen, cabecera en varias filas, contraste
 *  insuficiente, imágenes deformadas, letra o botones demasiado pequeños en móvil. Las notas usan el mismo
 *  formato que la revisión visual («Problema: … → Arreglo: …») para que el corrector las resuelva con CSS. */

export type AuditNote = { id: string; viewport: 'escritorio' | 'móvil'; notes: string };
export type AuditResult = { notes: AuditNote[]; overflow: boolean; issues: number };

const BLOCK = 'header,section[data-wc-section],section[id],footer';
function blockId(el: Element): string {
  const b = el.closest(BLOCK);
  return b ? (b.id || b.getAttribute('data-wc-section') || b.tagName.toLowerCase()) : 'pagina';
}
function describe(el: Element): string {
  const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean)[0];
  return el.tagName.toLowerCase() + (el.id ? '#' + el.id : cls ? '.' + cls : '');
}
const short = (t: string | null, n = 40) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };

type RGBA = [number, number, number, number];
function parseColor(c: string): RGBA | null {
  const m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/.exec(c);
  if (!m) return null;
  const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return [+m[1], +m[2], +m[3], a];
}
const lum = ([r, g, b]: RGBA) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const blend = (top: RGBA, under: RGBA): RGBA => [0, 1, 2].map(i => top[i] * top[3] + under[i] * (1 - top[3])).concat(1) as RGBA;
/** Fondo efectivo detrás de un elemento; null si hay una imagen o degradado (no se puede saber sin píxeles). */
function backgroundOf(el: Element, win: Window): RGBA | null {
  const layers: RGBA[] = [];
  for (let n: Element | null = el; n; n = n.parentElement) {
    const cs = win.getComputedStyle(n);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
    const c = parseColor(cs.backgroundColor);
    if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
  }
  let out: RGBA = [255, 255, 255, 1];
  for (const l of layers.reverse()) out = blend(l, out);
  return out;
}

export async function auditLayout(html: string, width: number, viewport: AuditNote['viewport']): Promise<AuditResult> {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-same-origin');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;left:-30000px;top:0;width:' + width + 'px;height:900px;border:0;visibility:hidden;pointer-events:none';
  document.body.append(frame);
  const found = new Map<string, string[]>();
  const add = (id: string, note: string) => { const l = found.get(id) || []; if (l.length < 6 && !l.includes(note)) l.push(note); found.set(id, l); };
  let overflow = false;
  try {
    await new Promise<void>((resolve, reject) => { const t = setTimeout(() => reject(Error('La vista de auditoría no cargó.')), 15000); frame.onload = () => { clearTimeout(t); resolve(); }; frame.srcdoc = html; });
    const doc = frame.contentDocument!, win = frame.contentWindow!;
    await Promise.race([doc.fonts?.ready, new Promise(r => setTimeout(r, 3000))]);
    await Promise.all(Array.from(doc.images).map(i => i.complete && i.naturalWidth ? undefined : new Promise(r => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); setTimeout(r, 3000); })));
    const all = Array.from(doc.body.querySelectorAll<HTMLElement>('*')).filter(el => !el.closest('svg') && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE');
    const visible = (el: HTMLElement) => { const r = el.getBoundingClientRect(); const cs = win.getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const clipped = (el: Element) => { for (let n = el.parentElement; n && n !== doc.body; n = n.parentElement) { const o = win.getComputedStyle(n).overflowX; if (o === 'hidden' || o === 'clip' || o === 'auto' || o === 'scroll') return true; } return false; };

    // 1. Desborde horizontal de la página: los culpables más profundos.
    if (doc.documentElement.scrollWidth > width + 2) {
      const out = all.filter(el => { const r = el.getBoundingClientRect(); return (r.right > width + 2 || r.left < -2) && r.width > 0 && !clipped(el); });
      const leaves = out.filter(el => !out.some(o => o !== el && el.contains(o))).slice(0, 4);
      overflow = leaves.length > 0;
      for (const el of leaves) add(blockId(el), 'Problema: «' + describe(el) + '» se sale por el lateral (la página tiene scroll horizontal a ' + width + ' px) → Arreglo: max-width:100%, min-width:0 en sus contenedores flex/grid, rejilla que pase a 1 columna o tamaño de letra con clamp().');
    }
    // 2. Textos que no caben en su caja (titulares y botones).
    for (const el of all.filter(e => /^(H1|H2|H3|A|BUTTON)$/.test(e.tagName) && visible(e))) {
      if (el.scrollWidth > el.clientWidth + 3 && win.getComputedStyle(el).overflowX === 'visible' && el.clientWidth > 0)
        add(blockId(el), 'Problema: el texto «' + short(el.textContent) + '» (' + describe(el) + ') no cabe en su caja → Arreglo: font-size con clamp() más bajo, overflow-wrap:anywhere o text-wrap:balance.');
    }
    // 3. Cabecera.
    const header = doc.body.querySelector<HTMLElement>('header');
    if (header && visible(header)) {
      const h = header.getBoundingClientRect().height;
      if (viewport === 'escritorio' && h > 130) add(blockId(header), 'Problema: la cabecera mide ' + Math.round(h) + ' px de alto (se parte en varias filas) → Arreglo: una sola fila con display:flex; align-items:center; justify-content:space-between; menos enlaces o letra del menú más pequeña; flex-wrap:nowrap.');
      if (viewport === 'móvil' && h > 110) add(blockId(header), 'Problema: en móvil la cabecera mide ' + Math.round(h) + ' px (el menú no se recoge) → Arreglo: ocultar .nav-panel por debajo de 900px salvo .is-open y mostrar el botón .nav-toggle.');
    }
    // 4. Contraste (AA): texto propio de cada elemento contra su fondo efectivo.
    let contrastCount = 0;
    for (const el of all) {
      if (contrastCount >= 8) break;
      const own = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent || '').join('').trim();
      if (own.length < 3 || !visible(el)) continue;
      const cs = win.getComputedStyle(el);
      if (parseFloat(cs.opacity) < 0.3) continue;
      const fg = parseColor(cs.color), bg = backgroundOf(el, win);
      if (!fg || !bg) continue;
      const color = blend(fg, bg);
      const L1 = lum(color), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const size = parseFloat(cs.fontSize), large = size >= 24 || (size >= 18.6 && parseInt(cs.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5)) {
        contrastCount++;
        add(blockId(el), 'Problema: contraste insuficiente (' + ratio.toFixed(1) + ':1) en «' + short(own, 30) + '» (' + describe(el) + ', color ' + cs.color + ' sobre ' + 'rgb(' + bg.slice(0, 3).map(Math.round).join(', ') + ')) → Arreglo: oscurecer o aclarar el color del texto hasta ' + (large ? '3' : '4,5') + ':1 como mínimo.');
      }
    }
    // 5. Imágenes deformadas.
    for (const img of Array.from(doc.images)) {
      if (!img.naturalWidth || !visible(img)) continue;
      const r = img.getBoundingClientRect(), fit = win.getComputedStyle(img).objectFit;
      const box = r.width / r.height, nat = img.naturalWidth / img.naturalHeight;
      if ((fit === 'fill' || !fit) && Math.abs(box - nat) / nat > 0.08) add(blockId(img), 'Problema: la imagen ' + describe(img) + ' está deformada (caja ' + Math.round(r.width) + '×' + Math.round(r.height) + ') → Arreglo: object-fit:cover y aspect-ratio fijo.');
    }
    // 6. Móvil: letra y botones demasiado pequeños.
    if (viewport === 'móvil') {
      const tiny = all.filter(el => /^(P|LI|A|SPAN|LABEL)$/.test(el.tagName) && (el.textContent || '').trim().length > 20 && visible(el) && parseFloat(win.getComputedStyle(el).fontSize) < 12.5).slice(0, 2);
      for (const el of tiny) add(blockId(el), 'Problema: letra de ' + win.getComputedStyle(el).fontSize + ' en móvil (' + describe(el) + ') → Arreglo: mínimo 14px para texto de lectura.');
      const small = all.filter(el => (el.tagName === 'BUTTON' || /\bbtn\b/.test(el.className)) && visible(el) && el.getBoundingClientRect().height < 36).slice(0, 2);
      for (const el of small) add(blockId(el), 'Problema: el botón «' + short(el.textContent, 25) + '» mide ' + Math.round(el.getBoundingClientRect().height) + ' px de alto en móvil → Arreglo: min-height:44px y más padding.');
    }
  } catch { /* sin auditoría: la revisión visual sigue */ }
  finally { frame.remove(); }
  const notes = Array.from(found.entries()).map(([id, list]) => ({ id, viewport, notes: list.join('\n') }));
  return { notes, overflow, issues: notes.reduce((n, x) => n + x.notes.split('\n').length, 0) };
}

/** Red de seguridad si, tras la corrección, sigue habiendo scroll horizontal en móvil. */
export const OVERFLOW_SAFETY_CSS = '/* Red de seguridad móvil (auditoría) */\nhtml,body{overflow-x:clip}img,svg,video,canvas{max-width:100%}' +
  '@media (max-width:560px){h1,h2,h3,.display{overflow-wrap:anywhere;hyphens:auto}[class*="grid"]>*{min-width:0}}';
