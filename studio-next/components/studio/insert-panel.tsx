'use client';
/** Panel «Insertar»: biblioteca de bloques que se arrastran al lienzo o se insertan con un clic. */
import React, { useMemo, useState } from 'react';
import { Circle, Columns2, Image as ImageIcon, LayoutTemplate, MousePointerClick, Search, Shapes, Sparkles, Type, UtensilsCrossed, X } from 'lucide-react';
import { SymbolLibrary } from './symbol-library';
import { BLOCK_CATEGORIES, CANVAS_BLOCKS, type BlockCategory } from '@/lib/canvas-blocks';

const ICONS: Record<BlockCategory, typeof Type> = { Texto: Type, Acciones: MousePointerClick, Formas: Circle, Medios: ImageIcon, 'Diseño': Columns2, Elementos: Sparkles, Carta: UtensilsCrossed, Secciones: LayoutTemplate };
export const BLOCK_MIME = 'application/x-wayup-block';
export const SECTION_MIME = 'application/x-wayup-section';

/** Arrastre propio con eventos de puntero (igual en Firefox, Chrome, Edge y Safari): el navegador no interviene. */
export function InsertPanel({ onInsert, onClose, target, onDragBlock, onInsertHtml, onDragHtml }: { onInsert(id: string): void; onClose(): void; target: string;
  onDragBlock(id: string, e: React.PointerEvent<HTMLButtonElement>): void;
  onInsertHtml(name: string, html: string): void; onDragHtml(name: string, html: string, e: React.PointerEvent<HTMLButtonElement>): void }) {
  const [tab, setTab] = useState<'bloques' | 'simbolos'>('bloques');
  const [cat, setCat] = useState<BlockCategory | 'Todo'>('Todo');
  const [q, setQ] = useState('');
  const list = useMemo(() => CANVAS_BLOCKS.filter(b => (cat === 'Todo' || b.category === cat) &&
    (b.name + ' ' + b.hint + ' ' + b.category).toLowerCase().includes(q.trim().toLowerCase())), [cat, q]);
  return <aside aria-label="Insertar elementos" className="absolute left-3 top-3 z-20 flex max-h-[calc(100%-24px)] w-[272px] flex-col overflow-hidden rounded-xl border border-stroke bg-panel shadow-pop">
    <div className="border-b border-stroke p-3">
      <div className="flex items-center justify-between"><h2 className="text-[12.5px] font-semibold">Insertar</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar panel de insertar" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-mist hover:bg-raised"><X size={14} /></button></div>
      <div role="tablist" aria-label="Tipo de contenido" className="mt-2 grid grid-cols-2 gap-0.5 rounded-lg border border-stroke bg-elevated p-[3px]">
        {([['bloques', 'Bloques', LayoutTemplate], ['simbolos', 'Símbolos', Shapes]] as const).map(([id, label, Icon]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
          className={'inline-flex h-[26px] items-center justify-center gap-1.5 rounded-md text-[11px] font-medium ' + (tab === id ? 'bg-panel text-ink shadow-sm' : 'text-mist hover:text-ink')}><Icon size={12} />{label}</button>)}
      </div>
      <p className="mt-1.5 text-[10.5px] leading-4 text-faint">Arrastra a la web o haz clic para añadirlo {target}.{tab === 'simbolos' ? ' El color sigue a «Color del texto»; el tamaño, a los tiradores.' : ''}</p>
      <label className="relative mt-2 block"><Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={tab === 'simbolos' ? 'Buscar símbolo: luna, montaña, teléfono…' : 'Buscar bloque…'} aria-label={tab === 'simbolos' ? 'Buscar símbolo' : 'Buscar bloque'}
          className="w-full rounded-md border border-stroke bg-elevated py-1.5 pl-8 pr-2 text-[11.5px] text-ink outline-none focus:border-brand" /></label>
      {tab === 'bloques' && <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Categorías">
        {(['Todo', ...BLOCK_CATEGORIES] as const).map(c => <button key={c} type="button" aria-pressed={c === cat} onClick={() => setCat(c)}
          className={'rounded-full border px-2 py-0.5 text-[10.5px] ' + (c === cat ? 'border-brand bg-brandsoft text-brand' : 'border-stroke text-mist hover:text-ink')}>{c}</button>)}
      </div>}
    </div>
    {tab === 'simbolos' ? <SymbolLibrary query={q} onInsert={onInsertHtml} onDrag={onDragHtml} /> :
    <div className="scroll-subtle grid min-h-0 flex-1 grid-cols-2 gap-1.5 overflow-y-auto p-2.5">
      {list.map(b => { const Icon = ICONS[b.category]; return <button key={b.id} type="button" draggable={false}
        onPointerDown={e => { if (e.button === 0) onDragBlock(b.id, e); }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onInsert(b.id); } }} title={'Insertar ' + b.name}
        className="group flex cursor-grab flex-col items-start gap-1.5 rounded-lg border border-stroke bg-elevated p-2.5 text-left transition hover:border-brand/50 active:cursor-grabbing">
        <span className="flex h-8 w-full items-center justify-center rounded-md bg-panel text-mist group-hover:text-brand"><Icon size={16} /></span>
        <span className="w-full truncate text-[11px] font-medium text-ink">{b.name}</span>
        <span className="w-full truncate text-[10px] text-faint">{b.hint}</span>
      </button>; })}
      {!list.length && <p className="col-span-2 p-3 text-center text-[11px] text-faint">Sin resultados.</p>}
    </div>}
  </aside>;
}
