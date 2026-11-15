'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  ArrowDown, ArrowUp, Clipboard, Copy, Files, Scissors, Trash2,
  Undo2, Redo2, MousePointer2, Command
} from 'lucide-react';

export type EditorCommand =
  | 'undo' | 'redo' | 'copy' | 'cut' | 'paste' | 'duplicate'
  | 'delete' | 'layer-up' | 'layer-down';
export type ContextSpot = { x: number; y: number; layerId: string | null };
type Item = { id: EditorCommand; label: string; hint?: string; icon: typeof Copy; disabled?: boolean; danger?: boolean };

export function EditorContextMenu({
  spot, canUndo, canRedo, canEdit, onClose, onAction
}: {
  spot: ContextSpot | null;
  canUndo: boolean;
  canRedo: boolean;
  canEdit: boolean;
  onClose(): void;
  onAction(action: EditorCommand): void | Promise<void>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({left:0,top:0});
  const selected = Boolean(spot?.layerId);
  const primary = (typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)) ? '⌘' : 'Ctrl+';
  const groups: Item[][] = [
    [
      {id:'undo',label:'Deshacer',hint:primary+'Z',icon:Undo2,disabled:!canUndo},
      {id:'redo',label:'Rehacer',hint:primary+'⇧Z',icon:Redo2,disabled:!canRedo},
    ],
    [
      {id:'copy',label:'Copiar',hint:primary+'C',icon:Copy,disabled:!selected||!canEdit},
      {id:'cut',label:'Cortar',hint:primary+'X',icon:Scissors,disabled:!selected||!canEdit},
      {id:'paste',label:'Pegar',hint:primary+'V',icon:Clipboard,disabled:!canEdit},
      {id:'duplicate',label:'Duplicar',hint:primary+'D',icon:Files,disabled:!selected||!canEdit},
    ],
    [
      {id:'layer-up',label:'Traer adelante',hint:']',icon:ArrowUp,disabled:!selected||!canEdit},
      {id:'layer-down',label:'Enviar atrás',hint:'[',icon:ArrowDown,disabled:!selected||!canEdit},
    ],
    [{id:'delete',label:'Eliminar capa',hint:'Supr',icon:Trash2,danger:true,disabled:!selected||!canEdit}],
  ];

  useEffect(()=>{
    if(!spot)return;
    const frame=requestAnimationFrame(()=>{
      const box=ref.current?.getBoundingClientRect();
      const width=box?.width??254, height=box?.height??350, margin=10;
      setPosition({
        left:Math.max(margin,Math.min(spot.x,window.innerWidth-width-margin)),
        top:Math.max(margin,Math.min(spot.y,window.innerHeight-height-margin))
      });
      const first=ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)');
      first?.focus({preventScroll:true});
    });
    return ()=>cancelAnimationFrame(frame);
  },[spot]);

  useEffect(()=>{
    if(!spot)return;
    const outside=(event:PointerEvent)=>{
      if(!ref.current?.contains(event.target as Node))onClose();
    };
    const dismiss=()=>onClose();
    window.addEventListener('pointerdown',outside,true);
    window.addEventListener('resize',dismiss);
    window.addEventListener('scroll',dismiss,true);
    return ()=>{
      window.removeEventListener('pointerdown',outside,true);
      window.removeEventListener('resize',dismiss);
      window.removeEventListener('scroll',dismiss,true);
    };
  },[spot,onClose]);

  if(!spot)return null;
  function keyboard(event:KeyboardEvent<HTMLDivElement>) {
    if(event.key==='Escape'){event.preventDefault();onClose();return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();
    const active=Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);
    if(!active.length)return;
    const at=active.indexOf(document.activeElement as HTMLButtonElement);
    const next=event.key==='Home'?0:event.key==='End'?active.length-1:
      (at+(event.key==='ArrowDown'?1:-1)+active.length)%active.length;
    active[next]?.focus();
  }
  return <div ref={ref} role="menu" tabIndex={-1} onKeyDown={keyboard}
    aria-label="Menú contextual del editor"
    className="wayapp-context-menu fixed z-[100] w-[254px] overflow-hidden rounded-[13px] p-[5px] text-[#e9eaf2]"
    style={{left:position.left,top:position.top}}>
    <div className="flex items-center gap-2 px-3 pb-[10px] pt-[10px] text-[10px] tracking-[.06em] text-[#83899b]">
      <MousePointer2 size={12} className="text-[#ab9aff]"/>
      {selected?'CAPA SELECCIONADA':'LIENZO DE DISEÑO'}
      <Command size={11} className="ml-auto opacity-60"/>
    </div>
    {groups.map((items, group)=>(
      <div key={group} className={group?'border-t border-white/[.075] py-[5px]':'pb-[5px]'}>
        {items.map(item=>{
          const Icon=item.icon;
          return <button key={item.id} type="button" role="menuitem"
            disabled={item.disabled}
            onClick={()=>{void onAction(item.id);onClose();}}
            className={'wayapp-context-item flex h-[34px] w-full items-center gap-2.5 rounded-[7px] px-[10px] text-left text-[11.5px] '+(item.danger?'text-[#ffa6a6]':'text-[#d9dce8]')}>
            <Icon size={14} strokeWidth={1.75} className="shrink-0 opacity-80"/>
            <span className="flex-1">{item.label}</span>
            {item.hint&&<kbd className="font-mono text-[10px] font-normal text-[#798193]">{item.hint}</kbd>}
          </button>;
        })}
      </div>
    ))}
    <div className="border-t border-white/[.07] px-3 py-[9px] text-[9px] text-[#666f81]">WAYAPP / STUDIO TOOLS</div>
  </div>;
}
