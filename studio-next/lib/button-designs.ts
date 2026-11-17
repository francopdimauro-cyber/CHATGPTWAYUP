/** Diseños de botón de WAY UP Studio.
 *  Cada diseño es una regla CSS de la página para [data-wc-btn="id"] que usa dos variables del propio botón:
 *  --wcb-c (color de marca) y --wcb-t (color del texto). Así los botones tienen hover y foco reales,
 *  se adaptan a la marca y no se tocan sus clases, id ni atributos (el JavaScript de la web sigue funcionando). */

export type ButtonDesign = { id: string; name: string; hint: string; css: string };
export type ButtonSize = 's' | 'm' | 'l';

const S = (id: string) => '[data-wc-btn="' + id + '"]';
export const BUTTON_DESIGNS: ButtonDesign[] = [
  { id: 'solido', name: 'Sólido', hint: 'Relleno de marca', css:
    `${S('solido')}{background:var(--wcb-c)!important;color:var(--wcb-t)!important;border:0!important;border-radius:10px!important;box-shadow:none!important}` +
    `${S('solido')}:hover{transform:translateY(-2px);box-shadow:0 10px 22px color-mix(in srgb,var(--wcb-c) 35%,transparent)!important}` },
  { id: 'pastilla', name: 'Pastilla', hint: 'Redondeado total', css:
    `${S('pastilla')}{background:var(--wcb-c)!important;color:var(--wcb-t)!important;border:0!important;border-radius:999px!important;box-shadow:none!important}` +
    `${S('pastilla')}:hover{filter:brightness(1.08);transform:translateY(-2px)}` },
  { id: 'contorno', name: 'Contorno', hint: 'Borde y se rellena', css:
    `${S('contorno')}{background:transparent!important;color:var(--wcb-c)!important;border:2px solid var(--wcb-c)!important;border-radius:10px!important;box-shadow:none!important}` +
    `${S('contorno')}:hover{background:var(--wcb-c)!important;color:var(--wcb-t)!important}` },
  { id: 'suave', name: 'Suave', hint: 'Tono claro de marca', css:
    `${S('suave')}{background:color-mix(in srgb,var(--wcb-c) 14%,transparent)!important;color:var(--wcb-c)!important;border:0!important;border-radius:10px!important;box-shadow:none!important}` +
    `${S('suave')}:hover{background:color-mix(in srgb,var(--wcb-c) 24%,transparent)!important}` },
  { id: 'degradado', name: 'Degradado', hint: 'Color con brillo', css:
    `${S('degradado')}{background:linear-gradient(135deg,var(--wcb-c),color-mix(in srgb,var(--wcb-c) 55%,#ffffff))!important;color:var(--wcb-t)!important;border:0!important;border-radius:12px!important}` +
    `${S('degradado')}:hover{transform:translateY(-2px);box-shadow:0 12px 26px color-mix(in srgb,var(--wcb-c) 40%,transparent)!important}` },
  { id: 'elevado', name: 'Elevado', hint: 'Sombra de color', css:
    `${S('elevado')}{background:var(--wcb-c)!important;color:var(--wcb-t)!important;border:0!important;border-radius:14px!important;box-shadow:0 10px 24px color-mix(in srgb,var(--wcb-c) 40%,transparent)!important}` +
    `${S('elevado')}:hover{transform:translateY(-3px);box-shadow:0 16px 34px color-mix(in srgb,var(--wcb-c) 50%,transparent)!important}` },
  { id: 'flecha', name: 'Texto con flecha', hint: 'Enlace elegante', css:
    `${S('flecha')}{background:transparent!important;color:var(--wcb-c)!important;border:0!important;border-bottom:2px solid currentColor!important;border-radius:0!important;padding-left:0!important;padding-right:0!important;box-shadow:none!important}` +
    `${S('flecha')}::after{content:"→";transition:transform .25s cubic-bezier(.2,.8,.2,1)}${S('flecha')}:hover::after{transform:translateX(5px)}` +
    `${S('flecha')}:has([data-wc-btn-icon])::after{content:none}${S('flecha')}:hover [data-wc-btn-icon]{transform:translateX(5px)}${S('flecha')} [data-wc-btn-icon]{transition:transform .25s cubic-bezier(.2,.8,.2,1)}` },
  { id: 'bloque', name: 'Bloque', hint: 'Sombra dura', css:
    `${S('bloque')}{background:var(--wcb-c)!important;color:var(--wcb-t)!important;border:2px solid #111111!important;border-radius:6px!important;box-shadow:4px 4px 0 #111111!important}` +
    `${S('bloque')}:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 #111111!important}${S('bloque')}:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #111111!important}` },
  { id: 'cristal', name: 'Cristal', hint: 'Translúcido', css:
    `${S('cristal')}{background:color-mix(in srgb,var(--wcb-c) 18%,transparent)!important;color:var(--wcb-c)!important;border:1px solid color-mix(in srgb,var(--wcb-c) 45%,transparent)!important;border-radius:12px!important;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:none!important}` +
    `${S('cristal')}:hover{background:color-mix(in srgb,var(--wcb-c) 28%,transparent)!important}` },
  { id: 'subrayado', name: 'Subrayado', hint: 'Solo texto', css:
    `${S('subrayado')}{background:transparent!important;color:var(--wcb-c)!important;border:0!important;box-shadow:none!important;padding-left:0!important;padding-right:0!important;text-decoration:underline!important;text-decoration-thickness:1px!important;text-underline-offset:6px}` +
    `${S('subrayado')}:hover{text-decoration-thickness:3px!important}` },
];

/** Hoja de estilos de todos los diseños (se guarda una vez en el <head> de la web). */
export const BUTTON_CSS_VERSION = '1';
export function buttonDesignsCss(): string {
  return [
    '/* Botones de WAY UP Studio · v' + BUTTON_CSS_VERSION + ' (no editar: se regenera desde el editor) */',
    '[data-wc-btn]{display:inline-flex!important;align-items:center;justify-content:center;gap:.55em;cursor:pointer;font-weight:600;line-height:1.15;' +
      'text-decoration:none;padding:var(--wcb-py,.85em) var(--wcb-px,1.5em)!important;font-size:var(--wcb-fs,inherit)!important;' +
      'transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s,background-color .25s,color .25s,border-color .25s,filter .25s}',
    '[data-wc-btn]:focus-visible{outline:3px solid color-mix(in srgb,var(--wcb-c) 55%,transparent);outline-offset:3px}',
    '[data-wc-btn-size="s"]{--wcb-py:.6em;--wcb-px:1.1em;--wcb-fs:14px}[data-wc-btn-size="m"]{--wcb-py:.85em;--wcb-px:1.5em;--wcb-fs:15px}[data-wc-btn-size="l"]{--wcb-py:1.05em;--wcb-px:2em;--wcb-fs:17px}',
    '[data-wc-btn] [data-wc-btn-icon]{display:inline-flex;width:1.15em;height:1.15em;flex:none;line-height:0}',
    ...BUTTON_DESIGNS.map(d => d.css),
    '@media (prefers-reduced-motion:reduce){[data-wc-btn]{transition:none}[data-wc-btn]:hover{transform:none}}',
  ].join('\n');
}

/** Color de texto legible sobre un color de marca (#rrggbb). */
export function contrastText(hex: string): string {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const lin = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255);
  return L > 0.45 ? '#111111' : '#ffffff';
}
/** Pasa un color calculado del navegador (rgb/rgba/#hex) a #rrggbb; null si es transparente. */
export function toHexColor(color: string): string | null {
  const c = String(color || '').trim();
  if (/^#[\da-f]{6}$/i.test(c)) return c.toLowerCase();
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m || (m[4] !== undefined && Number(m[4]) < 0.2)) return null;
  return '#' + [m[1], m[2], m[3]].map(v => Number(v).toString(16).padStart(2, '0')).join('');
}

/** Destinos de un botón (comportamiento). */
export type ButtonAction =
  | { kind: 'seccion'; value: string } | { kind: 'telefono'; value: string } | { kind: 'whatsapp'; value: string; text?: string }
  | { kind: 'email'; value: string } | { kind: 'enlace'; value: string; newTab?: boolean };
export function actionHref(a: ButtonAction): { href: string; newTab: boolean } {
  const v = a.value.trim();
  switch (a.kind) {
    case 'seccion': if (!/^[\w\-:.]+$/.test(v.replace(/^#/, ''))) throw Error('Elige una sección.'); return { href: '#' + v.replace(/^#/, ''), newTab: false };
    case 'telefono': { const d = v.replace(/[^\d+]/g, ''); if (d.replace(/\D/g, '').length < 6) throw Error('Escribe un teléfono válido.'); return { href: 'tel:' + d, newTab: false }; }
    case 'whatsapp': { const d = v.replace(/\D/g, ''); if (d.length < 8) throw Error('Escribe el número con prefijo de país (p. ej. 34600111222).');
      return { href: 'https://wa.me/' + d + (a.text?.trim() ? '?text=' + encodeURIComponent(a.text.trim().slice(0, 300)) : ''), newTab: true }; }
    case 'email': if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v)) throw Error('Escribe un correo válido.'); return { href: 'mailto:' + v, newTab: false };
    case 'enlace': if (!/^https:\/\//i.test(v)) throw Error('El enlace debe empezar por https://'); return { href: v, newTab: Boolean(a.newTab) };
  }
}
/** Interpreta el href actual para mostrarlo en el diálogo. */
export function parseAction(href: string, target: string): ButtonAction {
  const h = String(href || '');
  if (h.startsWith('#')) return { kind: 'seccion', value: h.slice(1) };
  if (/^tel:/i.test(h)) return { kind: 'telefono', value: h.slice(4) };
  if (/^mailto:/i.test(h)) return { kind: 'email', value: h.slice(7).split('?')[0] };
  const wa = /^https:\/\/wa\.me\/(\d+)(?:\?text=(.*))?$/i.exec(h);
  if (wa) return { kind: 'whatsapp', value: wa[1], text: wa[2] ? decodeURIComponent(wa[2]) : '' };
  return { kind: 'enlace', value: h, newTab: target === '_blank' };
}
