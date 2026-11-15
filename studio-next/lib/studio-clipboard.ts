import type { StudioElement, ElementKind, ElementStyle } from './studio-types';

export const LAYER_CLIPBOARD_PREFIX = 'WAYAPP_STUDIO_LAYER_V1\n';
const KINDS: readonly ElementKind[] = ['titulo','subtitulo','parrafo','boton','contenedor'];
const clamp = (n: unknown, low: number, high: number, fallback: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.max(low, Math.min(high, n)) : fallback;
const safeCss = (s: unknown, fallback: string): string =>
  typeof s === 'string' && s.length <= 160 && !/[<>;{}\\]/.test(s) && !/url\s*\(/i.test(s)
    ? s : fallback;
const href = (s: unknown): string | undefined => {
  if (typeof s !== 'string' || !s || s.length > 2048) return undefined;
  if (/^#[\w-]+$/.test(s) || /^\/(?!\/)[^\s]*$/.test(s) ||
      /^https?:\/\//i.test(s) || /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(s) ||
      /^tel:\+?[\d\s().-]{6,22}$/i.test(s)) return s;
  return undefined;
};

/** Leer el portapapeles del SO no ejecuta ni interpreta HTML/CSS sin validarlo. */
export function parseStudioLayer(text: string): StudioElement | null {
  if (!text.startsWith(LAYER_CLIPBOARD_PREFIX) || text.length > 30000) return null;
  try {
    const raw = JSON.parse(text.slice(LAYER_CLIPBOARD_PREFIX.length)) as Record<string, unknown>;
    if (raw.version !== 1 || !raw.element || typeof raw.element !== 'object') return null;
    const o = raw.element as Record<string, unknown>;
    if (!KINDS.includes(o.kind as ElementKind) || typeof o.text !== 'string' ||
        o.text.length > 10000 || typeof o.label !== 'string' || o.label.length > 140 ||
        !o.style || typeof o.style !== 'object') return null;
    const style = o.style as Record<string, unknown>;
    const payload: ElementStyle = {
      x: clamp(style.x,-600,600,0), y: clamp(style.y,-600,600,0),
      fontSize:clamp(style.fontSize,10,250,16),
      fontWeight:clamp(style.fontWeight,100,900,400),
      fontFamily:safeCss(style.fontFamily,'Arial, sans-serif'),
      shadow:safeCss(style.shadow,'ninguna'),
      color:safeCss(style.color,'#f5f7f6'),
      background:safeCss(style.background,'transparent'),
      radius:clamp(style.radius,0,999,0),
      paddingX:clamp(style.paddingX,0,200,0),
      paddingY:clamp(style.paddingY,0,200,0),
      width:style.width==='auto'?'auto':clamp(style.width,10,2000,300),
    };
    if (typeof style.border === 'string') payload.border=safeCss(style.border,'transparent');
    return {
      id:'copied-layer',
      label:o.label,
      kind:o.kind as ElementKind,
      sectionId:'',
      text:o.text,
      ...(href(o.href)?{href:href(o.href)}:{}),
      style:payload,
    };
  } catch { return null; }
}

export function serializeStudioLayer(element: StudioElement): string {
  return LAYER_CLIPBOARD_PREFIX + JSON.stringify({
    version:1,
    element:{
      label:element.label,kind:element.kind,text:element.text,href:element.href,
      style:element.style,
    },
  });
}

export function cloneStudioLayer(
  source: StudioElement, sectionId: string, id: string, offset = 24,
): StudioElement {
  return {
    ...source, id, sectionId,
    label:source.label.replace(/ \(copia(?: \d+)?\)$/,'') + ' (copia)',
    style:{
      ...source.style,
      x:Math.max(-600,Math.min(600,source.style.x+offset)),
      y:Math.max(-600,Math.min(600,source.style.y+offset)),
    },
  };
}
