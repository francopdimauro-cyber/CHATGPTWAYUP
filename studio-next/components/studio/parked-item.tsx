'use client';
/** Elemento aparcado en la mesa de trabajo: se dibuja con los estilos reales de la web, en un marco aislado
 *  (sin scripts), en la posición donde se soltó. Se arrastra para moverlo por la mesa o devolverlo a la página. */
import { useState } from 'react';
import { Trash2 } from 'lucide-react';

export type Parked = { id: string; name: string; html: string; x?: number; y?: number; w?: number };

export function ParkedItem({ item, head, theme, onPointerDown, onDelete }: {
  item: Parked; head: string; theme: string;
  onPointerDown(e: React.PointerEvent<HTMLDivElement>): void; onDelete(): void;
}) {
  const [height, setHeight] = useState(80);
  const width = Math.max(120, Math.min(item.w || 320, 640));
  const doc = '<!DOCTYPE html><html data-theme="' + theme + '"><head>' + head +
    '<style>html,body{margin:0;background:transparent!important;overflow:hidden}body::before,body::after{display:none!important}</style></head><body>' + item.html + '</body></html>';
  return <div role="group" aria-label={'Elemento aparcado: ' + item.name} data-parked={item.id}
    onPointerDown={onPointerDown}
    className="group absolute cursor-grab touch-none select-none rounded-md outline outline-1 outline-dashed outline-stroke hover:outline-brand active:cursor-grabbing"
    style={{ left: item.x ?? 24, top: item.y ?? 24, width }}>
    <span className="pointer-events-none absolute -top-5 left-0 max-w-full truncate rounded bg-panel px-1.5 text-[10px] text-mist shadow-sm">{item.name}</span>
    <iframe title={'Vista de ' + item.name} srcDoc={doc} sandbox="allow-same-origin" tabIndex={-1} aria-hidden
      className="pointer-events-none block w-full border-0" style={{ height }}
      onLoad={e => { const b = e.currentTarget.contentDocument?.body; if (b) setHeight(Math.min(900, Math.max(24, b.scrollHeight))); }} />
    <button type="button" aria-label={'Eliminar ' + item.name} title="Eliminar de la mesa de trabajo"
      onPointerDown={e => e.stopPropagation()} onClick={onDelete}
      className="absolute -right-2.5 -top-2.5 hidden h-6 w-6 items-center justify-center rounded-full border border-stroke bg-panel text-mist shadow-sm hover:text-red-500 group-hover:inline-flex">
      <Trash2 size={12} /></button>
  </div>;
}
