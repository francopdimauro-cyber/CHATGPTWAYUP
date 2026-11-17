'use client';
/** Diálogo «Cambiar símbolo»: galería de símbolos con búsqueda en castellano. El nuevo ocupa el mismo
 *  tamaño en pantalla que el actual y conserva su color (o el que elijas). */
import { useEffect, useState } from 'react';
import { Search, Shapes, X } from 'lucide-react';
import { symbolSvg, type SymbolEntry } from '@/lib/symbols';
import { SymbolLibrary } from './symbol-library';
import type { ElementInfo } from './property-panel';

export type SymbolChange = { svg: string; name: string; size: { w: number; h: number }; color?: string };

export function SymbolDialog({ info, onApply, onClose }: { info: ElementInfo; onApply(change: SymbolChange): void; onClose(): void }) {
  const sym = info.symbol!;
  const [query, setQuery] = useState('');
  const [pick, setPick] = useState<{ entry: SymbolEntry; stroke: number } | null>(null);
  const [keepColor, setKeepColor] = useState(true);
  const [color, setColor] = useState(sym.color || '#111111');
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const box = Math.max(24, Math.min(120, Math.max(sym.w, sym.h)));
  const shown = keepColor ? sym.color : color;
  // El símbolo actual se muestra como imagen (un SVG dentro de <img> no ejecuta código aunque venga de una web importada).
  const currentSrc = (() => {
    let s = String(sym.svg || '').replace(/currentColor/g, sym.color || '#111111');
    if (!/^<svg[\s>]/i.test(s)) return '';
    if (!/\sxmlns=/.test(s.slice(0, s.indexOf('>')))) s = s.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  })();
  function apply() {
    if (!pick) return;
    onApply({ svg: symbolSvg(pick.entry, pick.stroke), name: pick.entry.name, size: { w: sym.w, h: sym.h }, color: shown });
    onClose();
  }
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-3" role="dialog" aria-modal="true" aria-label="Cambiar símbolo" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="flex h-[88vh] max-h-[760px] w-full max-w-[820px] flex-col overflow-hidden rounded-2xl border border-stroke bg-panel shadow-2xl">
      <header className="flex items-center justify-between border-b border-stroke px-5 py-3">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold"><Shapes size={16} className="text-brand" /> Cambiar símbolo</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-mist hover:bg-elevated"><X size={16} /></button>
      </header>
      <div className="grid min-h-0 flex-1 md:grid-cols-[1fr_250px]">
        <div className="flex min-h-0 flex-col">
          <label className="relative m-3 mb-0 block"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar: luna, montaña, teléfono, pesas…" aria-label="Buscar símbolo"
              className="w-full rounded-lg border border-stroke bg-elevated py-2 pl-9 pr-3 text-[12px] text-ink outline-none focus:border-brand" /></label>
          <SymbolLibrary query={query} selected={pick?.entry.name} onPick={(entry, stroke) => setPick({ entry, stroke })} />
        </div>
        <aside className="space-y-4 border-t border-stroke bg-elevated p-5 md:border-l md:border-t-0">
          <h3 className="text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Vista previa (tamaño real)</h3>
          <div className="grid grid-cols-2 gap-2 text-center text-[10.5px] text-mist">
            <div><div className="flex h-[140px] items-center justify-center rounded-xl bg-panel">{currentSrc ? <img src={currentSrc} alt="Símbolo actual" width={box} height={box * (sym.h / Math.max(1, sym.w))} /> : <span className="text-faint">{sym.w}×{sym.h} px</span>}</div><p className="mt-1">Actual · {sym.w}×{sym.h} px</p></div>
            <div><div className="flex h-[140px] items-center justify-center rounded-xl bg-panel" style={{ color: shown }}>
              {pick ? <span style={{ width: box, height: box * (sym.h / Math.max(1, sym.w)), display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: symbolSvg(pick.entry, pick.stroke) }} />
                : <span className="px-2 text-faint">Elige uno de la galería</span>}
            </div><p className="mt-1">{pick ? pick.entry.name.replace(/-/g, ' ') : 'Nuevo'}</p></div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[11.5px] text-ink"><input type="checkbox" checked={keepColor} onChange={e => setKeepColor(e.target.checked)} />
              Mantener el color actual <span className="inline-block h-3.5 w-3.5 rounded-full border border-stroke" style={{ background: sym.color }} /></label>
            {!keepColor && <div className="flex items-center gap-2"><input type="color" value={color} onChange={e => setColor(e.target.value)} aria-label="Color del símbolo" className="h-8 w-12 cursor-pointer rounded-md border border-stroke" /><span className="font-mono text-[11px] text-mist">{color}</span></div>}
          </div>
          <p className="text-[10.5px] leading-5 text-faint">El nuevo símbolo ocupa el mismo espacio ({sym.w}×{sym.h} px) y conserva las clases y el estilo del actual, así que el diseño no se mueve. El grosor del trazo se elige en la galería.</p>
        </aside>
      </div>
      <footer className="flex items-center justify-end gap-2 border-t border-stroke px-5 py-3">
        <button type="button" onClick={onClose} className="rounded-lg border border-stroke px-4 py-2 text-[12px] text-ink hover:bg-elevated">Cancelar</button>
        <button type="button" disabled={!pick} onClick={apply} className="rounded-lg bg-brand px-4 py-2 text-[12px] font-semibold text-white hover:brightness-110 disabled:opacity-40">Cambiar símbolo</button>
      </footer>
    </div>
  </div>;
}
