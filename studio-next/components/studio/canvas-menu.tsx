'use client';
import { useEffect, useRef } from 'react';
import { ArrowDown, ArrowUp, ClipboardPaste, Copy, CopyPlus, Eye, EyeOff, Scissors, SquareDashedMousePointer, Trash2, Type } from 'lucide-react';

export type CanvasCommand = 'edit-text' | 'copy' | 'cut' | 'paste' | 'paste-inside' | 'duplicate' | 'hide' | 'up' | 'down' | 'parent' | 'delete';
const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

/** Menú contextual del lienzo: solo muestra acciones aplicables al elemento seleccionado. */
export function CanvasMenu({ x, y, tag, canEditText, canPaste, hidden, hasParent, onCommand, onClose }: {
  x: number; y: number; tag: string; canEditText: boolean; canPaste: boolean; hidden: boolean; hasParent: boolean;
  onCommand(c: CanvasCommand): void; onClose(): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: Event) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) onClose(); };
    window.addEventListener('keydown', close); window.addEventListener('pointerdown', close, true); window.addEventListener('blur', onClose);
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    return () => { window.removeEventListener('keydown', close); window.removeEventListener('pointerdown', close, true); window.removeEventListener('blur', onClose); };
  }, [onClose]);
  const w = 236, h = 420;
  const left = Math.max(8, Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - w - 8));
  const top = Math.max(8, Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 800) - h - 8));
  const item = 'flex min-h-[32px] w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[12px] text-ink hover:bg-raised focus:bg-raised focus:outline-none disabled:opacity-35 disabled:hover:bg-transparent';
  const key = (k: string) => <span className="ml-auto font-mono text-[10px] text-faint">{k}</span>;
  const run = (c: CanvasCommand) => { onClose(); onCommand(c); };
  return <div ref={ref} role="menu" aria-label={'Acciones de ' + tag.toLowerCase()} className="fixed z-[130] w-[236px] rounded-lg border border-stroke bg-panel p-1.5 shadow-pop" style={{ left, top }}>
    <p className="px-2.5 pb-1 pt-0.5 font-mono text-[10px] uppercase tracking-wider text-faint">{tag.toLowerCase()}</p>
    {canEditText && <button type="button" role="menuitem" className={item} onClick={() => run('edit-text')}><Type size={14} /> Editar texto {key('Intro')}</button>}
    <button type="button" role="menuitem" className={item} onClick={() => run('copy')}><Copy size={14} /> Copiar {key(MOD + 'C')}</button>
    <button type="button" role="menuitem" className={item} onClick={() => run('cut')}><Scissors size={14} /> Cortar {key(MOD + 'X')}</button>
    <button type="button" role="menuitem" className={item} disabled={!canPaste} onClick={() => run('paste')}><ClipboardPaste size={14} /> Pegar después {key(MOD + 'V')}</button>
    <button type="button" role="menuitem" className={item} disabled={!canPaste || tag === 'IMG'} onClick={() => run('paste-inside')}><ClipboardPaste size={14} /> Pegar dentro</button>
    <button type="button" role="menuitem" className={item} onClick={() => run('duplicate')}><CopyPlus size={14} /> Duplicar {key(MOD + 'D')}</button>
    <div className="my-1 h-px bg-stroke" />
    <button type="button" role="menuitem" className={item} onClick={() => run('up')}><ArrowUp size={14} /> Mover arriba {key('Alt+↑')}</button>
    <button type="button" role="menuitem" className={item} onClick={() => run('down')}><ArrowDown size={14} /> Mover abajo {key('Alt+↓')}</button>
    <button type="button" role="menuitem" className={item} disabled={!hasParent} onClick={() => run('parent')}><SquareDashedMousePointer size={14} /> Seleccionar contenedor {key('Esc')}</button>
    <button type="button" role="menuitem" className={item} onClick={() => run('hide')}>{hidden ? <Eye size={14} /> : <EyeOff size={14} />} {hidden ? 'Mostrar' : 'Ocultar'} {key(MOD + 'H')}</button>
    <div className="my-1 h-px bg-stroke" />
    <button type="button" role="menuitem" className={item + ' text-red-500'} onClick={() => run('delete')}><Trash2 size={14} /> Eliminar {key('Supr')}</button>
  </div>;
}
