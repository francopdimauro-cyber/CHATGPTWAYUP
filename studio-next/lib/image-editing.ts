/** Utilidades de «Cambiar imagen»: recorte (en fracciones de la foto original), filtros CSS y exportación con canvas. */

export type Crop = { x: number; y: number; w: number; h: number };
export type Focus = { x: number; y: number };
export type ImageFilters = { brightness: number; contrast: number; saturate: number; grayscale: number; sepia: number };
export const NO_FILTERS: ImageFilters = { brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0 };

export const FILTER_PRESETS: { id: string; name: string; f: ImageFilters }[] = [
  { id: 'original', name: 'Original', f: NO_FILTERS },
  { id: 'vivo', name: 'Vivo', f: { brightness: 103, contrast: 110, saturate: 130, grayscale: 0, sepia: 0 } },
  { id: 'calido', name: 'Cálido', f: { brightness: 103, contrast: 102, saturate: 112, grayscale: 0, sepia: 18 } },
  { id: 'suave', name: 'Suave', f: { brightness: 108, contrast: 90, saturate: 90, grayscale: 0, sepia: 0 } },
  { id: 'contraste', name: 'Contraste', f: { brightness: 100, contrast: 125, saturate: 105, grayscale: 0, sepia: 0 } },
  { id: 'byn', name: 'Blanco y negro', f: { brightness: 102, contrast: 112, saturate: 100, grayscale: 100, sepia: 0 } },
  { id: 'antiguo', name: 'Antiguo', f: { brightness: 104, contrast: 95, saturate: 80, grayscale: 0, sepia: 45 } },
];

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function filterCss(f: ImageFilters): string {
  const parts: string[] = [];
  if (f.brightness !== 100) parts.push('brightness(' + (f.brightness / 100).toFixed(2) + ')');
  if (f.contrast !== 100) parts.push('contrast(' + (f.contrast / 100).toFixed(2) + ')');
  if (f.saturate !== 100) parts.push('saturate(' + (f.saturate / 100).toFixed(2) + ')');
  if (f.grayscale) parts.push('grayscale(' + (f.grayscale / 100).toFixed(2) + ')');
  if (f.sepia) parts.push('sepia(' + (f.sepia / 100).toFixed(2) + ')');
  return parts.join(' ');
}
export function parseFilterCss(css: string): ImageFilters {
  const f = { ...NO_FILTERS };
  for (const m of String(css || '').matchAll(/(brightness|contrast|saturate|grayscale|sepia)\(\s*([\d.]+)(%?)\s*\)/g)) {
    const n = Number(m[2]) * (m[3] ? 1 : 100);
    if (Number.isFinite(n)) f[m[1] as keyof ImageFilters] = Math.round(clamp(n, 0, 300));
  }
  return f;
}

export function parseCrop(s: string | null | undefined): Crop | null {
  const p = String(s || '').split(',').map(Number);
  if (p.length !== 4 || p.some(v => !Number.isFinite(v))) return null;
  const [x, y, w, h] = p;
  if (w <= 0 || h <= 0 || x < 0 || y < 0 || x + w > 1.0001 || y + h > 1.0001) return null;
  return { x, y, w, h };
}
export const cropAttr = (c: Crop) => [c.x, c.y, c.w, c.h].map(v => v.toFixed(4)).join(',');

export function parseFocus(s: string | null | undefined): Focus {
  const m = /^\s*([\d.]+)%\s+([\d.]+)%\s*$/.exec(String(s || ''));
  if (m) return { x: clamp(Number(m[1]), 0, 100), y: clamp(Number(m[2]), 0, 100) };
  const words: Record<string, number> = { left: 0, top: 0, center: 50, right: 100, bottom: 100 };
  const w = String(s || '').trim().split(/\s+/);
  if (w.length && w.every(x => x in words)) {
    const xs = w.find(x => x === 'left' || x === 'right'), ys = w.find(x => x === 'top' || x === 'bottom');
    return { x: xs ? words[xs] : 50, y: ys ? words[ys] : 50 };
  }
  return { x: 50, y: 50 };
}
export const focusCss = (f: Focus) => Math.round(f.x) + '% ' + Math.round(f.y) + '%';

/** Recorte más grande con la proporción `ratio` (ancho/alto) dentro de una foto W×H, ampliado `zoom` veces y centrado en (cx, cy) (fracciones). */
export function cropFor(W: number, H: number, ratio: number | null, zoom: number, cx: number, cy: number): Crop {
  const r = ratio && ratio > 0 ? ratio : W / H;
  let w = 1, h = 1;
  if (W / H > r) w = (H * r) / W; else h = W / r / H;
  const z = clamp(zoom, 1, 8);
  w /= z; h /= z;
  const x = clamp(cx - w / 2, 0, 1 - w), y = clamp(cy - h / 2, 0, 1 - h);
  return { x, y, w, h };
}

/** Exporta el recorte a un archivo nuevo. PNG si el original es PNG/GIF (transparencias), WebP en el resto. */
export async function renderCrop(img: HTMLImageElement, crop: Crop, sourceMime: string, maxSide = 2400): Promise<{ bytes: Uint8Array; ext: string; w: number; h: number }> {
  const W = img.naturalWidth, H = img.naturalHeight;
  const sw = crop.w * W, sh = crop.h * H;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); if (!g) throw Error('Tu navegador no permite recortar imágenes.');
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, crop.x * W, crop.y * H, sw, sh, 0, 0, w, h);
  const png = /png|gif/.test(sourceMime);
  let blob = await new Promise<Blob | null>(r => c.toBlob(r, png ? 'image/png' : 'image/webp', 0.88));
  let ext = png ? 'png' : 'webp';
  // Navegadores sin WebP en canvas devuelven PNG: entonces JPEG, que pesa menos.
  if (!png && blob && blob.type !== 'image/webp') { blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', 0.88)); ext = 'jpg'; }
  if (!blob) throw Error('No se pudo crear la imagen recortada.');
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ext, w, h };
}

export function mimeOf(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
  if (bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp';
  return 'application/octet-stream';
}
