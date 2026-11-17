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

/** ¿Es un elemento «de texto» (sin bloques dentro)? Al escalarlo desde una esquina crece también la letra. */
function isTextLike(el: HTMLElement): boolean {
  const win = el.ownerDocument.defaultView;
  if (!win || /^(IMG|VIDEO|PICTURE|SVG|CANVAS|IFRAME|INPUT|TEXTAREA|SELECT)$/i.test(el.tagName)) return false;
  if (!(el.textContent || '').trim()) return false;
  return Array.from(el.children).every(c => /^(inline|inline-block|inline-flex|contents)$/.test(win.getComputedStyle(c).display) && !c.querySelector('img,video,picture,svg'));
}
const isMedia = (el: HTMLElement) => /^(IMG|VIDEO|PICTURE|SVG|CANVAS)$/i.test(el.tagName);
function readTranslatePx(v: string): { x: number; y: number } {
  const m = String(v || '').trim().match(/^(-?\d+(?:\.\d+)?)px(?:\s+(-?\d+(?:\.\d+)?)px)?/);
  return { x: m ? Number(m[1]) : 0, y: m && m[2] !== undefined ? Number(m[2]) : 0 };
}
type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const CURSOR: Record<Dir, string> = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' };
const POS: Record<Dir, string> = {
  n: 'top:-6px;left:50%;margin-left:-5px', s: 'bottom:-6px;left:50%;margin-left:-5px', e: 'right:-6px;top:50%;margin-top:-5px', w: 'left:-6px;top:50%;margin-top:-5px',
  ne: 'right:-6px;top:-6px', nw: 'left:-6px;top:-6px', se: 'right:-6px;bottom:-6px', sw: 'left:-6px;bottom:-6px'
};

/** Tiradores como en Figma: esquinas = escalar en proporción (en textos y botones también la letra y el relleno;
 *  Mayús = estirar libre); lados = estirar en una dirección. Se ve en vivo y se guarda al soltar (un paso de deshacer). */
export function drawHandles(doc: Document, el: HTMLElement | null, onEnd: (styles: Record<string, string>) => void): void {
  if (el) { drawHandlesV2(doc, el, onEnd); return; }
  const box = layer(doc, 'wayup-resize-box');
  box.textContent = ''; box.style.display = 'none';
}
function drawHandlesV2(doc: Document, el: HTMLElement, onEnd: (styles: Record<string, string>) => void): void {
  const box = layer(doc, 'wayup-resize-box');
  box.textContent = '';
  if (el === doc.body || el.dataset.wayupEditing) { box.style.display = 'none'; return; }
  const win = doc.defaultView!;
  const place = () => {
    const r = el.getBoundingClientRect(), sx = win.scrollX || 0, sy = win.scrollY || 0;
    Object.assign(box.style, { display: 'block', left: r.left + sx + 'px', top: r.top + sy + 'px', width: r.width + 'px', height: r.height + 'px' });
  };
  place();
  const label = doc.createElement('span');
  label.style.cssText = 'position:absolute;right:0;bottom:-22px;padding:1px 6px;border-radius:5px;background:#3d5cff;color:#fff;font:500 10px/16px ui-monospace,monospace;white-space:nowrap';
  const sizeText = (extra = '') => { const r = el.getBoundingClientRect(); label.textContent = Math.round(r.width) + ' × ' + Math.round(r.height) + extra; };
  sizeText(); box.append(label);
  for (const dir of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as Dir[]) {
    const corner = dir.length === 2;
    const h = doc.createElement('div');
    h.title = corner ? 'Arrastra para escalar en proporción (Mayús: libre)' : dir === 'e' || dir === 'w' ? 'Arrastra para cambiar el ancho' : 'Arrastra para cambiar el alto';
    h.style.cssText = 'position:absolute;width:10px;height:10px;background:#fff;border:2px solid #3d5cff;border-radius:' + (corner ? '3px' : '50%') + ';pointer-events:auto;touch-action:none;cursor:' + CURSOR[dir] + ';' + POS[dir];
    h.addEventListener('pointerdown', ev => {
      if (ev.button !== 0) return;
      ev.preventDefault(); ev.stopPropagation();
      const cs = win.getComputedStyle(el);
      const start = el.getBoundingClientRect(), x0 = ev.clientX, y0 = ev.clientY, id = ev.pointerId;
      const t0 = readTranslatePx(cs.translate === 'none' ? '' : cs.translate);
      const text = isTextLike(el), media = isMedia(el);
      const font0 = parseFloat(cs.fontSize) || 16, ls0 = parseFloat(cs.letterSpacing) || 0;
      const pad0 = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
      const east = dir.includes('e'), west = dir.includes('w'), south = dir.includes('s'), north = dir.includes('n');
      const fit = cs.objectFit && cs.objectFit !== 'fill' ? cs.objectFit : 'cover';
      let out: Record<string, string> = {};
      try { h.setPointerCapture(id); } catch {}
      const set = (prop: string, value: string) => { el.style.setProperty(prop, value, 'important'); out[prop] = value; };
      // Se escucha en todo el documento: funciona aunque el navegador no respete la captura del puntero.
      const move = (m: PointerEvent) => {
        if (m.pointerId !== id) return;
        m.preventDefault();
        const dx = m.clientX - x0, dy = m.clientY - y0;
        let w = start.width + (east ? dx : west ? -dx : 0);
        let hh = start.height + (south ? dy : north ? -dy : 0);
        out = {};
        if (corner && !m.shiftKey) {
          // Escala proporcional: manda el eje que más se ha movido.
          const kx = w / start.width, ky = hh / start.height;
          const k = Math.max(0.1, Math.abs(kx - 1) >= Math.abs(ky - 1) ? kx : ky);
          w = start.width * k; hh = start.height * k;
          if (text) {
            set('font-size', Math.round(font0 * k * 10) / 10 + 'px');
            if (ls0) set('letter-spacing', Math.round(ls0 * k * 100) / 100 + 'px');
            if (pad0.t || pad0.r || pad0.b || pad0.l) {
              set('padding-top', Math.round(pad0.t * k) + 'px'); set('padding-right', Math.round(pad0.r * k) + 'px');
              set('padding-bottom', Math.round(pad0.b * k) + 'px'); set('padding-left', Math.round(pad0.l * k) + 'px');
            }
            // En un texto la altura la marca la letra: solo se fija el ancho para que no cambie cómo se parte.
            set('width', Math.max(16, Math.round(w)) + 'px'); set('max-width', 'none');
            sizeText(' · letra ' + Math.round(font0 * k) + 'px');
          } else {
            set('width', Math.max(16, Math.round(w)) + 'px'); set('max-width', 'none');
            set('height', Math.max(8, Math.round(hh)) + 'px');
            if (media) set('object-fit', fit);
            sizeText();
          }
        } else {
          if (east || west) { set('width', Math.max(16, Math.round(w)) + 'px'); set('max-width', 'none'); }
          if (north || south) set('height', Math.max(8, Math.round(hh)) + 'px');
          if (media) set('object-fit', fit);
          sizeText();
        }
        // Al tirar desde la izquierda o desde arriba, el borde contrario se queda quieto (como en Figma).
        if (west || north) {
          const nr = el.getBoundingClientRect();
          const ox = west ? start.right - nr.right : 0, oy = north ? start.bottom - nr.bottom : 0;
          const inline = el.style.getPropertyValue('translate');
          const cur = inline ? readTranslatePx(inline) : t0;
          set('translate', Math.round(cur.x + ox) + 'px ' + Math.round(cur.y + oy) + 'px');
        }
        place();
      };
      const up = (u: PointerEvent) => {
        if (u.pointerId !== id) return;
        doc.removeEventListener('pointermove', move, true); doc.removeEventListener('pointerup', up, true); doc.removeEventListener('pointercancel', up, true);
        try { h.releasePointerCapture(id); } catch {}
        if (Object.keys(out).length) onEnd(out);
      };
      doc.addEventListener('pointermove', move, true); doc.addEventListener('pointerup', up, true); doc.addEventListener('pointercancel', up, true);
    });
    box.append(h);
  }
  win.addEventListener('scroll', place, { passive: true });
}
export function clearHandles(doc: Document | null | undefined): void {
  const box = doc?.getElementById('wayup-resize-box');
  if (box) { box.style.display = 'none'; box.textContent = ''; }
}
