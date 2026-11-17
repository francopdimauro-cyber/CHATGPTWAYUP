/** Biblioteca de símbolos del editor (iconos Lucide, licencia ISC). El catálogo se descarga solo al abrir
 *  la pestaña «Símbolos» (public/simbolos/lucide.json, generado con scripts/build-symbols.mjs). */
export type SymbolNode = [string, Record<string, string>][];
export type SymbolEntry = { name: string; node: SymbolNode };

let cache: Promise<SymbolEntry[]> | null = null;
export function loadSymbols(): Promise<SymbolEntry[]> {
  cache ??= fetch('/simbolos/lucide.json', { cache: 'force-cache' })
    .then(r => { if (!r.ok) throw Error('No se pudo cargar la biblioteca de símbolos.'); return r.json(); })
    .then((j: { icons: [string, SymbolNode][] }) => j.icons.map(([name, node]) => ({ name, node })))
    .catch(e => { cache = null; throw e; });
  return cache;
}

/** Categorías pensadas para webs de negocio (nombres de Lucide; los que no existan se ignoran). */
export const SYMBOL_CATEGORIES: Record<string, string[]> = {
  Destacados: ['star', 'heart', 'sparkles', 'check', 'circle-check', 'badge-check', 'award', 'crown', 'gem', 'zap', 'flame', 'leaf', 'sun', 'moon', 'mountain', 'mountain-snow', 'map-pin', 'phone', 'mail', 'clock', 'calendar', 'arrow-right', 'arrow-up-right', 'quote', 'smile', 'thumbs-up', 'shield-check', 'rocket', 'target', 'lightbulb'],
  Contacto: ['phone', 'phone-call', 'smartphone', 'mail', 'map-pin', 'map', 'navigation', 'clock', 'calendar', 'calendar-check', 'message-circle', 'message-square', 'send', 'globe', 'at-sign', 'house', 'building-2', 'store', 'car', 'bus', 'train-front', 'plane', 'accessibility', 'wifi', 'circle-parking'],
  Restauración: ['utensils', 'utensils-crossed', 'chef-hat', 'cooking-pot', 'soup', 'salad', 'pizza', 'sandwich', 'hamburger', 'beef', 'fish', 'drumstick', 'egg', 'croissant', 'cake-slice', 'cookie', 'ice-cream-cone', 'coffee', 'cup-soda', 'wine', 'beer', 'martini', 'grape', 'apple', 'carrot', 'wheat', 'milk', 'flame', 'leaf', 'vegan'],
  Deporte: ['dumbbell', 'bike', 'footprints', 'heart-pulse', 'activity', 'timer', 'stopwatch', 'trophy', 'medal', 'target', 'flame', 'zap', 'mountain', 'tent', 'compass', 'waves', 'volleyball', 'person-standing', 'biceps-flexed', 'apple', 'droplet', 'calendar-check', 'users', 'user-round', 'goal'],
  Naturaleza: ['leaf', 'trees', 'tree-pine', 'flower', 'flower-2', 'sprout', 'mountain', 'mountain-snow', 'sun', 'sunrise', 'sunset', 'moon', 'cloud', 'cloud-sun', 'snowflake', 'droplet', 'waves', 'wind', 'rainbow', 'bird', 'fish', 'paw-print', 'dog', 'cat', 'recycle'],
  Comercio: ['shopping-bag', 'shopping-cart', 'store', 'gift', 'tag', 'tags', 'percent', 'badge-percent', 'credit-card', 'wallet', 'banknote', 'receipt', 'package', 'truck', 'box', 'handshake', 'shield-check', 'badge-check', 'star', 'thumbs-up', 'trending-up', 'chart-column', 'briefcase', 'scale', 'key'],
  Servicios: ['scissors', 'brush', 'paintbrush', 'palette', 'camera', 'image', 'music', 'headphones', 'stethoscope', 'pill', 'syringe', 'baby', 'bed', 'bath', 'sofa', 'hammer', 'wrench', 'drill', 'graduation-cap', 'book-open', 'laptop', 'code', 'pen-tool', 'hand-heart', 'heart-handshake'],
  Flechas: ['arrow-right', 'arrow-left', 'arrow-up', 'arrow-down', 'arrow-up-right', 'arrow-down-right', 'move-right', 'chevron-right', 'chevron-left', 'chevrons-right', 'chevron-down', 'corner-down-right', 'redo-2', 'undo-2', 'refresh-cw', 'external-link', 'circle-arrow-right', 'square-arrow-out-up-right', 'move', 'maximize-2'],
  Interfaz: ['menu', 'x', 'plus', 'minus', 'search', 'settings', 'user', 'users', 'lock', 'unlock', 'eye', 'bell', 'bookmark', 'share-2', 'download', 'upload', 'info', 'circle-help', 'triangle-alert', 'circle-check', 'circle-x', 'list', 'grid-3x3', 'filter', 'sliders-horizontal']
};

/** Búsqueda en castellano: palabra → símbolos. Además se busca por el nombre original (inglés). */
const ES: Record<string, string[]> = {
  luna: ['moon', 'moon-star'], sol: ['sun', 'sunrise', 'sunset'], montaña: ['mountain', 'mountain-snow'], monte: ['mountain'], sierra: ['mountain-snow'],
  estrella: ['star', 'sparkles', 'star-half'], corazon: ['heart', 'heart-handshake', 'heart-pulse'], corazón: ['heart', 'heart-handshake', 'heart-pulse'],
  telefono: ['phone', 'phone-call', 'smartphone'], teléfono: ['phone', 'phone-call', 'smartphone'], movil: ['smartphone'], móvil: ['smartphone'],
  correo: ['mail', 'at-sign', 'send'], email: ['mail'], mapa: ['map', 'map-pin'], ubicacion: ['map-pin', 'navigation'], ubicación: ['map-pin', 'navigation'], direccion: ['map-pin'], dirección: ['map-pin'],
  reloj: ['clock', 'timer', 'stopwatch'], hora: ['clock'], horario: ['clock', 'calendar'], calendario: ['calendar', 'calendar-check'], cita: ['calendar-check'], reserva: ['calendar-check'],
  mensaje: ['message-circle', 'message-square'], chat: ['message-circle'], whatsapp: ['message-circle'], web: ['globe'], mundo: ['globe'],
  casa: ['house'], hogar: ['house'], tienda: ['store', 'shopping-bag'], compra: ['shopping-cart', 'shopping-bag'], carrito: ['shopping-cart'], regalo: ['gift'], oferta: ['percent', 'badge-percent', 'tag'], precio: ['tag', 'banknote'], pago: ['credit-card', 'wallet'], envio: ['truck', 'package'], envío: ['truck', 'package'],
  comida: ['utensils', 'utensils-crossed', 'chef-hat'], restaurante: ['utensils', 'utensils-crossed', 'chef-hat'], cocina: ['chef-hat', 'cooking-pot'], cocinero: ['chef-hat'], sopa: ['soup'], ensalada: ['salad'], pescado: ['fish'], carne: ['beef', 'drumstick'], pan: ['croissant', 'wheat'], pastel: ['cake-slice'], tarta: ['cake-slice'], helado: ['ice-cream-cone'], cafe: ['coffee'], café: ['coffee'], vino: ['wine', 'grape'], cerveza: ['beer'], copa: ['wine', 'martini'], uva: ['grape'], manzana: ['apple'], vegano: ['vegan', 'leaf'], fuego: ['flame'],
  gimnasio: ['dumbbell', 'biceps-flexed'], pesas: ['dumbbell'], entrenamiento: ['dumbbell', 'activity', 'timer'], deporte: ['trophy', 'dumbbell', 'bike'], bici: ['bike'], bicicleta: ['bike'], correr: ['footprints', 'person-standing'], salud: ['heart-pulse', 'stethoscope'], trofeo: ['trophy'], medalla: ['medal', 'award'], premio: ['award', 'trophy'], objetivo: ['target', 'goal'],
  hoja: ['leaf'], arbol: ['trees', 'tree-pine'], árbol: ['trees', 'tree-pine'], flor: ['flower', 'flower-2'], planta: ['sprout'], agua: ['droplet', 'waves'], mar: ['waves'], nieve: ['snowflake', 'mountain-snow'], nube: ['cloud'], viento: ['wind'], perro: ['dog', 'paw-print'], gato: ['cat'], mascota: ['paw-print'], pajaro: ['bird'], pájaro: ['bird'], ecologico: ['recycle', 'leaf'], ecológico: ['recycle', 'leaf'],
  flecha: ['arrow-right', 'arrow-up-right', 'move-right', 'chevron-right'], siguiente: ['arrow-right', 'chevron-right'], comprobado: ['check', 'circle-check', 'badge-check'], hecho: ['check'], verificado: ['badge-check', 'shield-check'], seguro: ['shield-check', 'lock'], seguridad: ['shield-check', 'lock'],
  cita2: ['quote'], comillas: ['quote'], opinion: ['quote', 'message-square'], opinión: ['quote', 'message-square'], equipo: ['users'], persona: ['user', 'user-round'], cliente: ['user-round', 'handshake'], acuerdo: ['handshake'],
  peluqueria: ['scissors', 'brush'], peluquería: ['scissors', 'brush'], foto: ['camera', 'image'], fotografia: ['camera', 'image'], fotografía: ['camera', 'image'], musica: ['music', 'headphones'], música: ['music', 'headphones'], medico: ['stethoscope', 'pill'], médico: ['stethoscope', 'pill'], bebe: ['baby'], bebé: ['baby'], cama: ['bed'], hotel: ['bed', 'key'], llave: ['key'], obra: ['hammer', 'wrench'], reforma: ['hammer', 'drill'], formacion: ['graduation-cap', 'book-open'], formación: ['graduation-cap', 'book-open'], curso: ['graduation-cap'], libro: ['book-open'], ordenador: ['laptop'], codigo: ['code'], código: ['code'], diseño: ['pen-tool', 'palette'], idea: ['lightbulb'], rapido: ['zap', 'rocket'], rápido: ['zap', 'rocket'], cohete: ['rocket'], coche: ['car'], aparcamiento: ['circle-parking'], parking: ['circle-parking'], accesible: ['accessibility'], wifi: ['wifi'],
  menu: ['menu'], menú: ['menu'], cerrar: ['x'], buscar: ['search'], ajustes: ['settings'], compartir: ['share-2'], descargar: ['download'], informacion: ['info'], información: ['info'], aviso: ['triangle-alert', 'bell'], campana: ['bell']
};

/** Busca símbolos por palabra (castellano o inglés) dentro del catálogo. */
export function searchSymbols(all: SymbolEntry[], query: string, category: string): SymbolEntry[] {
  const byName = new Map(all.map(s => [s.name, s]));
  const q = query.trim().toLowerCase();
  if (!q) {
    const names = SYMBOL_CATEGORIES[category];
    return names ? names.map(n => byName.get(n)).filter((s): s is SymbolEntry => Boolean(s)) : all;
  }
  const words = q.split(/\s+/);
  const fromEs = new Set<string>();
  for (const [word, names] of Object.entries(ES)) if (words.some(w => word.startsWith(w) && w.length >= 3)) names.forEach(n => fromEs.add(n));
  const first = [...fromEs].map(n => byName.get(n)).filter((s): s is SymbolEntry => Boolean(s));
  const rest = all.filter(s => !fromEs.has(s.name) && words.every(w => s.name.includes(w)));
  return [...first, ...rest];
}

const esc = (v: string) => v.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
/** SVG en línea del símbolo: usa currentColor (cambia con «Color del texto») y ocupa el 100 % de su caja. */
export function symbolSvg(entry: SymbolEntry, stroke = 2): string {
  const inner = entry.node.map(([tag, attrs]) => '<' + tag + Object.entries(attrs).map(([k, v]) => ' ' + k + '="' + esc(String(v)) + '"').join('') + '/>').join('');
  return '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="' + stroke +
    '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + inner + '</svg>';
}
/** HTML que se inserta en la web: un contenedor seleccionable, redimensionable y con color propio. */
export function symbolBlock(entry: SymbolEntry, opts: { stroke?: number; size?: number; style?: 'solo' | 'circulo' | 'cuadrado' } = {}): string {
  const size = opts.size ?? 48, style = opts.style ?? 'solo';
  const label = entry.name.replace(/-/g, ' ');
  const frame = style === 'solo' ? '' : 'padding:' + Math.round(size * 0.28) + 'px;border-radius:' + (style === 'circulo' ? '999px' : '14px') + ';background:color-mix(in srgb,currentColor 12%,transparent);';
  return '<span data-wc-name="Símbolo · ' + esc(label) + '" data-wc-symbol="' + esc(entry.name) + '" role="img" aria-label="' + esc(label) + '" style="display:inline-flex;align-items:center;justify-content:center;box-sizing:content-box;width:' + size + 'px;height:' + size + 'px;line-height:0;vertical-align:middle;' + frame + '">' +
    symbolSvg(entry, opts.stroke) + '</span>';
}
