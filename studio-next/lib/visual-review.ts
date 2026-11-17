/** Revisión visual de una web generada: el navegador la pinta sin mostrarla, saca una captura de cada sección
 *  (escritorio y móvil), un modelo con visión apunta los problemas y otro devuelve CSS de corrección.
 *  Las capturas se hacen con el propio motor del navegador (SVG foreignObject): sin servicios externos.
 *  Si cualquier paso falla, la web se entrega sin revisión. */
import { assetMime } from './web-project-files';

export type Shot = { id: string; viewport: 'escritorio' | 'móvil'; dataUrl: string };

const VIEW_H = 900; // altura de ventana de referencia (las unidades vh se fijan a ella)
const toBase64 = (bytes: Uint8Array) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
async function fetchDataUrl(url: string, timeout = 6000): Promise<string | null> {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
    const r = await fetch(url, { signal: ctl.signal, mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' }); clearTimeout(t);
    if (!r.ok) return null;
    const type = r.headers.get('content-type') || 'application/octet-stream';
    return 'data:' + type.split(';')[0] + ';base64,' + toBase64(new Uint8Array(await r.arrayBuffer()));
  } catch { return null; }
}
/** En una imagen SVG, «100vh» sería la página entera: se fija a la altura de ventana de referencia. */
const fixViewportUnits = (css: string) => css.replace(/(-?\d*\.?\d+)(?:s|d|l)?vh\b/g, (_, n) => (parseFloat(n) * VIEW_H / 100).toFixed(1) + 'px');

/** Documento autocontenido para capturar: imágenes y fuentes en línea, sin scripts ni animaciones. */
export async function captureHtml(html: string, assets: Record<string, Uint8Array>): Promise<string> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,iframe,object,embed,noscript,base,meta[http-equiv]').forEach(n => n.remove());
  for (const img of Array.from(doc.querySelectorAll('img'))) {
    img.removeAttribute('srcset'); img.removeAttribute('loading');
    const src = img.getAttribute('src') || '';
    const bytes = assets[src.replace(/^\.\//, '')];
    if (bytes) img.setAttribute('src', 'data:' + assetMime(src) + ';base64,' + toBase64(bytes));
    else if (!src.startsWith('data:')) img.removeAttribute('src');
  }
  // Google Fonts: se descargan la hoja y los archivos de fuente para que la captura use la tipografía real.
  let fontCss = '';
  for (const link of Array.from(doc.querySelectorAll('link'))) {
    const href = link.getAttribute('href') || '';
    if (/^https:\/\/fonts\.googleapis\.com\/css2?\?/.test(href) && /stylesheet/i.test(link.getAttribute('rel') || '')) {
      try {
        const r = await fetch(href, { mode: 'cors', credentials: 'omit' });
        if (r.ok) {
          let css = await r.text();
          // Solo latín (las fuentes «latin» y «latin-ext») para no descargar de más.
          const blocks = css.split('}').filter(b => /@font-face/.test(b) && (/U\+0000-00FF/.test(b) || !/unicode-range/.test(b)));
          css = blocks.map(b => b + '}').join('\n');
          const urls = Array.from(new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)'"\s]+/g) || [])).slice(0, 12);
          for (const u of urls) { const d = await fetchDataUrl(u); if (d) css = css.split(u).join(d); }
          fontCss += css;
        }
      } catch { /* sin fuente real: se usa la de respaldo */ }
    }
    link.remove();
  }
  for (const s of Array.from(doc.querySelectorAll('style'))) s.textContent = fixViewportUnits(s.textContent || '');
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>('[style]'))) el.setAttribute('style', fixViewportUnits(el.getAttribute('style') || ''));
  const extra = doc.createElement('style');
  extra.textContent = fontCss + '\n*,*::before,*::after{animation:none!important;transition:none!important}[data-reveal]{opacity:1!important;transform:none!important;filter:none!important}html{scroll-behavior:auto!important}';
  doc.head.append(extra);
  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}

/** Pinta el documento a un ancho dado y devuelve una captura JPEG por bloque (cabecera, secciones, pie). */
export async function captureBlocks(html: string, width: number, viewport: Shot['viewport'], opts: { scale: number; maxBlocks: number }): Promise<Shot[]> {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-same-origin');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;left:-30000px;top:0;width:' + width + 'px;height:' + VIEW_H + 'px;border:0;visibility:hidden;pointer-events:none';
  document.body.append(frame);
  try {
    await new Promise<void>((resolve, reject) => { const t = setTimeout(() => reject(Error('La vista para capturas no cargó.')), 15000); frame.onload = () => { clearTimeout(t); resolve(); }; frame.srcdoc = html; });
    const doc = frame.contentDocument!;
    await Promise.race([doc.fonts?.ready, new Promise(r => setTimeout(r, 4000))]);
    await Promise.all(Array.from(doc.images).map(i => i.decode?.().catch(() => undefined)));
    const H = Math.min(doc.documentElement.scrollHeight, 14000);
    const sel = 'header,section[data-wc-section],section[id],footer';
    const blocks = Array.from(doc.body.querySelectorAll<HTMLElement>(sel)).filter(el => !el.parentElement?.closest(sel)).slice(0, opts.maxBlocks);
    const rects = blocks.map(el => { const r = el.getBoundingClientRect(); return { id: el.id || el.getAttribute('data-wc-section') || el.tagName.toLowerCase(), top: r.top + doc.defaultView!.scrollY, height: Math.min(r.height, 1700) }; })
      .filter(r => r.height > 24);
    // Documento entero como imagen SVG (foreignObject) → lienzo → recortes por bloque.
    const xhtml = new XMLSerializer().serializeToString(doc.documentElement);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + H + '"><foreignObject x="0" y="0" width="100%" height="100%">' + xhtml + '</foreignObject></svg>';
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(Error('El navegador no pudo pintar la captura.')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    const s = opts.scale;
    const shots: Shot[] = [];
    for (const r of rects) {
      const c = document.createElement('canvas');
      c.width = Math.round(width * s); c.height = Math.round(r.height * s);
      const g = c.getContext('2d'); if (!g) continue;
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, r.top, width, r.height, 0, 0, c.width, c.height);
      shots.push({ id: r.id, viewport, dataUrl: c.toDataURL('image/jpeg', 0.74) }); // lanza si el lienzo quedó «contaminado»
    }
    return shots;
  } finally { frame.remove(); }
}

/** Revisión completa: capturas → notas del modelo con visión → CSS de corrección. Devuelve el HTML con la corrección. */
export async function visualReview(html: string, assets: Record<string, Uint8Array>, onProgress: (m: string) => void): Promise<{ html: string; notes: number; fixed: boolean }> {
  onProgress('Revisión visual: preparando capturas de cada sección…');
  const doc = await captureHtml(html, assets);
  // Solo las 4 capturas que más pesan en la primera impresión (cabecera y portada, en escritorio y móvil):
  // los modelos externos con visión tienen cupos diarios pequeños.
  const shots = [...await captureBlocks(doc, 1280, 'escritorio', { scale: 0.6, maxBlocks: 2 }),
    ...await captureBlocks(doc, 390, 'móvil', { scale: 1, maxBlocks: 2 })];
  if (!shots.length) return { html, notes: 0, fixed: false };
  const notes: { id: string; viewport: string; notes: string }[] = [];
  let done = 0;
  const one = async (s: Shot) => {
    try {
      const r = await fetch('/studio-api/webcreator/review-shot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-store', body: JSON.stringify(s) });
      const d = await r.json().catch(() => ({})) as { notes?: string };
      if (r.ok && d.notes && !/^SIN PROBLEMAS/i.test(d.notes.trim())) notes.push({ id: s.id, viewport: s.viewport, notes: d.notes });
    } catch { /* una captura sin revisar no detiene el resto */ }
    done++; onProgress('Revisión visual: el director de arte revisa ' + done + '/' + shots.length + ' capturas…');
  };
  for (let i = 0; i < shots.length; i += 3) await Promise.all(shots.slice(i, i + 3).map(one));
  if (!notes.length) return { html, notes: 0, fixed: false };
  onProgress('Revisión visual: corrigiendo ' + notes.length + ' bloque(s) con problemas…');
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const css = Array.from(parsed.querySelectorAll('style')).map(s => s.textContent || '').join('\n').slice(0, 45000);
  parsed.querySelectorAll('style,script,svg').forEach(n => n.remove());
  const structure = parsed.body.innerHTML.replace(/>\s*([^<]{60,})</g, (_, t: string) => '>' + t.slice(0, 50) + '…<').replace(/\s(?:alt|data-wc-ai-prompt|src)="[^"]*"/g, '').slice(0, 26000);
  const r = await fetch('/studio-api/webcreator/review-fix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-store', body: JSON.stringify({ notes, css, structure }) });
  const d = await r.json().catch(() => ({})) as { css?: string };
  if (!r.ok || !d.css || d.css.length < 20) return { html, notes: notes.length, fixed: false };
  const out = new DOMParser().parseFromString(html, 'text/html');
  const style = out.createElement('style'); style.setAttribute('data-wc-review', 'true');
  style.textContent = '/* Revisión visual automática */\n' + d.css;
  out.head.append(style);
  return { html: '<!DOCTYPE html>\n' + out.documentElement.outerHTML, notes: notes.length, fixed: true };
}
