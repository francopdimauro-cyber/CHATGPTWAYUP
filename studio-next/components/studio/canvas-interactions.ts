/** Interacciones directas sobre la vista protegida (iframe del mismo origen, sin scripts del cliente):
 *  indicador de soltar, cálculo de destino y tiradores de redimensionado. Solo dibuja en la vista;
 *  los cambios reales se aplican al HTML mediante lib/element-editing (con deshacer). */
export type DropTarget = { el: HTMLElement; index: number; position: 'before' | 'after' | 'inside' };

const NO_CHILDREN = new Set(['IMG', 'INPUT', 'BR', 'HR', 'TEXTAREA', 'SELECT', 'VIDEO', 'AUDIO', 'IFRAME', 'SVG', 'PICTURE', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A', 'BUTTON', 'SPAN', 'LABEL', 'LI']);
const SECTION_LEVEL = 'section,header,footer,nav,article,aside,[data-wc-section]';

/** Destino bajo el puntero: mitad superior → antes, inferior → después, zona central de un contenedor → dentro. */
export function computeDrop(doc: Document, x: number, y: number, opts: { exclude?: HTMLElement | null; sectionLevel?: boolean } = {}): DropTarget | null {
  let el = doc.elementFromPoint(x, y)?.closest<HTMLElement>('[data-wayup-edit]') || null;
  if (!el) return null;
  if (opts.exclude && (el === opts.exclude || opts.exclude.contains(el))) return null;
  if (opts.sectionLevel) {
    // Secciones completas: siempre entre secciones de primer nivel.
    let s: HTMLElement | null = el.closest<HTMLElement>(SECTION_LEVEL);
    while (s && s.parentElement && s.parentElement.closest(SECTION_LEVEL)) s = s.parentElement.closest<HTMLElement>(SECTION_LEVEL);
    if (!s || !s.dataset.wayupEdit) return null;
    const r = s.getBoundingClientRect();
    return { el: s, index: Number(s.dataset.wayupEdit), position: y < r.top + r.height / 2 ? 'before' : 'after' };
  }
  const r = el.getBoundingClientRect();
  const rel = (y - r.top) / Math.max(1, r.height);
  const container = !NO_CHILDREN.has(el.tagName);
  const empty = container && el.children.length === 0;
  const position = container && (empty || (rel > 0.3 && rel < 0.7)) ? 'inside' : rel < 0.5 ? 'before' : 'after';
  return { el, index: Number(el.dataset.wayupEdit), position };
}

function layer(doc: Document, id: string): HTMLElement {
  let el = doc.getElementById(id);
  if (!el) {
    el = doc.createElement('div'); el.id = id;
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:absolute;pointer-events:none;z-index:2147483646;display:none';
    doc.documentElement.append(el);
  }
  return el;
}
export function showIndicator(doc: Document, drop: DropTarget | null, label = ''): void {
  const ind = layer(doc, 'wayup-drop-indicator');
  if (!drop) { ind.style.display = 'none'; return; }
  const r = drop.el.getBoundingClientRect(), sx = doc.defaultView?.scrollX || 0, sy = doc.defaultView?.scrollY || 0;
  ind.style.display = 'block';
  if (drop.position === 'inside') {
    Object.assign(ind.style, { left: r.left + sx + 'px', top: r.top + sy + 'px', width: r.width + 'px', height: r.height + 'px',
      border: '2px dashed #3d5cff', background: 'rgba(61,92,255,.08)', borderRadius: '6px' });
  } else {
    Object.assign(ind.style, { left: r.left + sx + 'px', top: (drop.position === 'before' ? r.top : r.bottom) + sy - 2 + 'px', width: r.width + 'px', height: '4px',
      border: '0', background: '#3d5cff', borderRadius: '4px' });
  }
  ind.textContent = '';
  if (label) {
    const tag = doc.createElement('span');
    tag.textContent = label;
    tag.style.cssText = 'position:absolute;left:0;top:-22px;padding:2px 8px;border-radius:6px;background:#3d5cff;color:#fff;font:600 11px/16px system-ui;white-space:nowrap';
    ind.append(tag);
  }
}
export const hideIndicator = (doc: Document) => showIndicator(doc, null);

/** Tiradores para redimensionar el elemento seleccionado (derecha, abajo y esquina). */
export function drawHandles(doc: Document, el: HTMLElement | null, onEnd: (size: { width?: string; height?: string }) => void): void {
  const box = layer(doc, 'wayup-resize-box');
  box.textContent = '';
  if (!el || el === doc.body || el.dataset.wayupEditing) { box.style.display = 'none'; return; }
  const place = () => {
    const r = el.getBoundingClientRect(), sx = doc.defaultView?.scrollX || 0, sy = doc.defaultView?.scrollY || 0;
    Object.assign(box.style, { display: 'block', left: r.left + sx + 'px', top: r.top + sy + 'px', width: r.width + 'px', height: r.height + 'px' });
  };
  place();
  const label = doc.createElement('span');
  label.style.cssText = 'position:absolute;right:0;bottom:-22px;padding:1px 6px;border-radius:5px;background:#3d5cff;color:#fff;font:500 10px/16px ui-monospace,monospace;white-space:nowrap';
  const sizeText = () => { const r = el.getBoundingClientRect(); label.textContent = Math.round(r.width) + ' × ' + Math.round(r.height); };
  sizeText(); box.append(label);
  for (const dir of ['e', 's', 'se'] as const) {
    const h = doc.createElement('div');
    h.title = dir === 'e' ? 'Arrastra para cambiar el ancho' : dir === 's' ? 'Arrastra para cambiar el alto' : 'Arrastra para cambiar ancho y alto';
    h.style.cssText = 'position:absolute;width:10px;height:10px;background:#fff;border:2px solid #3d5cff;border-radius:3px;pointer-events:auto;touch-action:none;' +
      (dir === 'e' ? 'right:-6px;top:50%;margin-top:-5px;cursor:ew-resize' : dir === 's' ? 'bottom:-6px;left:50%;margin-left:-5px;cursor:ns-resize' : 'right:-6px;bottom:-6px;cursor:nwse-resize');
    h.addEventListener('pointerdown', ev => {
      ev.preventDefault(); ev.stopPropagation();
      const start = el.getBoundingClientRect(), x0 = ev.clientX, y0 = ev.clientY;
      let w = start.width, hgt = start.height;
      try { h.setPointerCapture(ev.pointerId); } catch {}
      const move = (m: PointerEvent) => {
        if (dir !== 's') { w = Math.max(16, Math.round(start.width + m.clientX - x0)); el.style.setProperty('width', w + 'px', 'important'); }
        if (dir !== 'e') { hgt = Math.max(8, Math.round(start.height + m.clientY - y0)); el.style.setProperty('height', hgt + 'px', 'important'); }
        place(); sizeText();
      };
      const up = () => {
        h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
        onEnd({ ...(dir !== 's' ? { width: w + 'px' } : {}), ...(dir !== 'e' ? { height: hgt + 'px' } : {}) });
      };
      h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
    });
    box.append(h);
  }
  doc.defaultView?.addEventListener('scroll', place, { passive: true });
}
export function clearHandles(doc: Document | null | undefined): void {
  const box = doc?.getElementById('wayup-resize-box');
  if (box) { box.style.display = 'none'; box.textContent = ''; }
}
