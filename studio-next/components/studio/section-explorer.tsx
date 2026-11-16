'use client';

import React,{useEffect,useMemo,useRef,useState,type MouseEvent as ReactMouseEvent} from 'react';
import {ArrowDown,ArrowUp,ChevronDown,ChevronRight,ChevronsLeft,ChevronsRight,Copy,CornerDownRight,FilePlus2,Layers3,MoreHorizontal,PanelTop,Pencil,Search,Trash2,X} from 'lucide-react';
import type {HtmlSection,SectionPosition} from '@/lib/html-sections';

export type SectionAction=
  |{type:'add';position:SectionPosition;key?:string}
  |{type:'duplicate'|'remove'|'up'|'down';key:string}
  |{type:'rename';key:string;name:string};

type Menu={key:string;x:number;y:number};
const MIN_W=200,MAX_W=440,DEFAULT_W=268,PREF_KEY='wayup-studio-explorer-v1';
function readPref():{width:number;collapsed:boolean}{
  try{const v=JSON.parse(localStorage.getItem(PREF_KEY)||'{}');
    return {width:Math.min(MAX_W,Math.max(MIN_W,Number(v.width)||DEFAULT_W)),collapsed:v.collapsed===true};}
  catch{return {width:DEFAULT_W,collapsed:false};}
}
function writePref(v:{width:number;collapsed:boolean}){try{localStorage.setItem(PREF_KEY,JSON.stringify(v));}catch{}}
const TAG_ICON_LABEL:Record<string,string>={H1:'H1',H2:'H2',H3:'H3',H4:'H4',P:'¶',A:'↗',BUTTON:'btn',IMG:'img',FORM:'form',UL:'ul',OL:'ol',LI:'li',INPUT:'in',LABEL:'lbl',SPAN:'txt',DIV:'div',NAV:'nav',FIGURE:'fig'};

/** Explorador de secciones del HTML real: menú ⋯ y clic derecho con las mismas acciones; usable con toque. */
export function SectionExplorer({sections,selectedIndex,onSelect,onAction,mobileOpen,onCloseMobile,onElementMenu}:{
  sections:HtmlSection[];selectedIndex:number|null;
  onSelect(index:number):void;onAction(action:SectionAction):void;
  mobileOpen:boolean;onCloseMobile():void;
  /** Clic derecho sobre un elemento interno: abre el menú de elemento del lienzo. */
  onElementMenu?(index:number,x:number,y:number):void;
}){
  const [search,setSearch]=useState('');
  const [expanded,setExpanded]=useState<Set<string>>(new Set());
  const [menu,setMenu]=useState<Menu|null>(null);
  const [renaming,setRenaming]=useState<{key:string;value:string}|null>(null);
  const [confirmDelete,setConfirmDelete]=useState<string|null>(null);
  const menuRef=useRef<HTMLDivElement>(null);
  // Ancho y plegado del panel en escritorio (en móvil es un panel deslizante a pantalla casi completa).
  const [width,setWidth]=useState(DEFAULT_W);
  const [collapsed,setCollapsed]=useState(false);
  const [resizing,setResizing]=useState(false);
  useEffect(()=>{const p=readPref();setWidth(p.width);setCollapsed(p.collapsed);},[]);
  const savePref=(w:number,c:boolean)=>writePref({width:w,collapsed:c});
  const toggleCollapsed=()=>setCollapsed(c=>{savePref(width,!c);return !c;});
  const startResize=(e:React.PointerEvent<HTMLDivElement>)=>{
    if(e.button!==0)return;
    e.preventDefault();
    const handle=e.currentTarget,startX=e.clientX,startW=width;
    try{handle.setPointerCapture(e.pointerId);}catch{}
    setResizing(true);
    let current=startW;
    const move=(ev:PointerEvent)=>{current=Math.min(MAX_W,Math.max(MIN_W,startW+ev.clientX-startX));setWidth(current);};
    const up=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',up);
      setResizing(false);savePref(current,false);};
    handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',up);
  };
  const keyResize=(e:React.KeyboardEvent<HTMLDivElement>)=>{
    const step=e.shiftKey?40:16;
    const next=e.key==='ArrowLeft'?width-step:e.key==='ArrowRight'?width+step:e.key==='Home'?MIN_W:e.key==='End'?MAX_W:null;
    if(next===null)return;
    e.preventDefault();const w=Math.min(MAX_W,Math.max(MIN_W,next));setWidth(w);savePref(w,false);
  };
  const active=sections.find(s=>selectedIndex!==null&&selectedIndex>=s.index&&selectedIndex<=s.end);

  useEffect(()=>{if(active)setExpanded(old=>old.has(active.key)?old:new Set(old).add(active.key));},[active?.key]);
  useEffect(()=>{
    if(!menu)return;
    const close=(e:Event)=>{if(e instanceof KeyboardEvent?e.key==='Escape':!menuRef.current?.contains(e.target as Node))setMenu(null);};
    window.addEventListener('keydown',close);window.addEventListener('pointerdown',close,true);
    menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    return()=>{window.removeEventListener('keydown',close);window.removeEventListener('pointerdown',close,true);};
  },[menu]);

  const q=search.trim().toLowerCase();
  const visible=useMemo(()=>sections.map(s=>{
    if(!q)return {s,children:s.children};
    const children=s.children.filter(c=>(c.label+' '+c.tag).toLowerCase().includes(q));
    return s.name.toLowerCase().includes(q)||children.length?{s,children}:null;
  }).filter(Boolean) as {s:HtmlSection;children:HtmlSection['children']}[],[sections,q]);

  const openMenu=(key:string,x:number,y:number)=>{
    const w=232,h=360;
    setMenu({key,x:Math.max(8,Math.min(x,window.innerWidth-w-8)),y:Math.max(8,Math.min(y,window.innerHeight-h-8))});
    setConfirmDelete(null);
  };
  const fromButton=(key:string,e:ReactMouseEvent<HTMLButtonElement>)=>{
    e.stopPropagation();
    const r=e.currentTarget.getBoundingClientRect();openMenu(key,r.right-232,r.bottom+4);
  };
  const run=(action:SectionAction)=>{setMenu(null);setConfirmDelete(null);onAction(action);};
  const menuSection=sections.find(s=>s.key===menu?.key);
  const position=menuSection?sections.indexOf(menuSection):-1;
  const item='flex min-h-[36px] w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[11.5px] text-ink hover:bg-raised focus:bg-raised focus:outline-none disabled:opacity-35 disabled:hover:bg-transparent';

  return <>
  {collapsed&&<aside aria-label="Explorador plegado" className="hidden w-11 shrink-0 flex-col items-center gap-1.5 border-r border-stroke bg-panel py-2.5 xl:flex">
    <button type="button" onClick={toggleCollapsed} title="Mostrar explorador" aria-label="Mostrar explorador"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-mist hover:bg-raised hover:text-ink"><ChevronsRight size={15}/></button>
    <button type="button" onClick={()=>run({type:'add',position:'end'})} title="Añadir una sección al final" aria-label="Añadir sección"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand hover:bg-raised"><FilePlus2 size={15}/></button>
    <Layers3 size={14} className="mt-2 text-faint" aria-hidden/>
    <span className="font-mono text-[9px] text-faint">{sections.length}</span>
  </aside>}
  <aside aria-label="Explorador de secciones" style={{'--explorer-w':width+'px'} as React.CSSProperties}
    className={'relative flex w-[268px] shrink-0 flex-col border-r border-stroke bg-panel xl:w-[var(--explorer-w)] max-xl:fixed max-xl:inset-y-0 max-xl:left-0 max-xl:z-[70] max-xl:w-[min(320px,88vw)] max-xl:shadow-2xl max-xl:transition-transform '+
      (mobileOpen?'max-xl:translate-x-0':'max-xl:-translate-x-full')+(collapsed?' xl:hidden':'')}>
    <div role="separator" aria-orientation="vertical" aria-label="Cambiar ancho del explorador" tabIndex={0}
      aria-valuemin={MIN_W} aria-valuemax={MAX_W} aria-valuenow={width}
      onPointerDown={startResize} onKeyDown={keyResize} onDoubleClick={()=>{setWidth(DEFAULT_W);savePref(DEFAULT_W,false);}}
      title="Arrastra para cambiar el ancho · Doble clic para restablecer"
      className={'group/handle absolute inset-y-0 -right-1.5 z-10 hidden w-3 cursor-col-resize touch-none focus:outline-none xl:block'}>
      <span className={'absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 transition-colors '+(resizing?'bg-brand':'bg-transparent group-hover/handle:bg-brand/60 group-focus/handle:bg-brand')}/>
    </div>
    <div className="border-b border-stroke px-3 pb-3 pt-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[12px] font-semibold"><Layers3 size={14} className="text-brand"/> Explorador</h2>
        <div className="flex items-center gap-1">
          <button type="button" onClick={()=>run({type:'add',position:'end'})} title="Añadir una sección al final"
            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-md bg-brand px-2.5 text-[11px] font-semibold text-white hover:brightness-110"><FilePlus2 size={13}/> Sección</button>
          <button type="button" onClick={toggleCollapsed} className="hidden h-8 w-8 items-center justify-center rounded-md text-mist hover:bg-raised hover:text-ink xl:inline-flex" title="Ocultar explorador" aria-label="Ocultar explorador"><ChevronsLeft size={15}/></button>
          <button type="button" onClick={onCloseMobile} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-mist hover:bg-raised xl:hidden" aria-label="Cerrar explorador"><X size={15}/></button>
        </div>
      </div>
      <label className="relative mt-3 block">
        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar sección o elemento…" aria-label="Buscar en el explorador"
          className="w-full rounded-md border border-stroke bg-elevated py-2 pl-8 pr-2 text-[11px] text-ink outline-none focus:border-brand"/>
      </label>
      <p className="mt-2 flex items-center justify-between text-[9.5px] font-semibold uppercase tracking-[.16em] text-faint"><span>Secciones del HTML</span><span className="font-mono">{sections.length}</span></p>
    </div>
    <ul className="scroll-subtle min-h-0 flex-1 overflow-y-auto px-1.5 py-2" role="tree" aria-label="Secciones de la web">
      {visible.map(({s,children})=>{
        const isOpen=expanded.has(s.key)||Boolean(q);
        const isActive=active?.key===s.key;
        const sectionSelected=selectedIndex===s.index;
        return <li key={s.key} role="treeitem" aria-expanded={isOpen} aria-selected={isActive} className="mb-0.5">
          <div onContextMenu={e=>{e.preventDefault();openMenu(s.key,e.clientX,e.clientY);}}
            className={'group flex min-h-[36px] items-center gap-1 rounded-md pr-1 '+(sectionSelected?'bg-brandsoft text-brand':isActive?'bg-raised text-ink':'text-ink hover:bg-raised')}>
            <button type="button" onClick={()=>setExpanded(old=>{const n=new Set(old);if(n.has(s.key))n.delete(s.key);else n.add(s.key);return n;})}
              className="inline-flex h-8 w-7 shrink-0 items-center justify-center text-faint" aria-label={(isOpen?'Contraer ':'Expandir ')+s.name}>
              {s.children.length?(isOpen?<ChevronDown size={13}/>:<ChevronRight size={13}/>):null}
            </button>
            {renaming?.key===s.key?<form className="min-w-0 flex-1" onSubmit={e=>{e.preventDefault();run({type:'rename',key:s.key,name:renaming.value});setRenaming(null);}}>
              <input autoFocus value={renaming.value} maxLength={80} aria-label="Nuevo nombre de la sección"
                onChange={e=>setRenaming({key:s.key,value:e.target.value})} onBlur={()=>setRenaming(null)}
                onKeyDown={e=>{if(e.key==='Escape')setRenaming(null);}}
                className="w-full rounded border border-brand bg-elevated px-1.5 py-1 text-[11.5px] text-ink outline-none"/>
            </form>:<button type="button" onClick={()=>onSelect(s.index)} onDoubleClick={()=>setRenaming({key:s.key,value:s.name})}
              className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-[12px] font-medium" title={s.name+' · '+s.tag.toLowerCase()}>
              <PanelTop size={13} className={sectionSelected?'text-brand':'text-faint'}/>
              <span className="truncate">{s.name}</span>
              <span className="ml-auto shrink-0 font-mono text-[9px] text-faint">{s.children.length||''}</span>
            </button>}
            <button type="button" onClick={e=>fromButton(s.key,e)} aria-haspopup="menu" aria-label={'Opciones de '+s.name}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-mist opacity-100 hover:bg-elevated hover:text-ink xl:opacity-40 xl:group-hover:opacity-100 xl:focus:opacity-100">
              <MoreHorizontal size={15}/>
            </button>
          </div>
          {isOpen&&children.length>0&&<ul role="group" className="mb-1">
            {children.map(c=><li key={c.index} role="treeitem" aria-selected={selectedIndex===c.index}>
              <button type="button" onClick={()=>onSelect(c.index)} style={{paddingLeft:30+c.depth*10}}
                onContextMenu={e=>{if(!onElementMenu)return;e.preventDefault();onSelect(c.index);onElementMenu(c.index,e.clientX,e.clientY);}}
                className={'flex min-h-[30px] w-full items-center gap-2 rounded-md pr-2 text-left text-[11px] '+(selectedIndex===c.index?'bg-brandsoft text-brand':'text-mist hover:bg-raised hover:text-ink')}>
                <span className="w-7 shrink-0 font-mono text-[9px] text-faint">{TAG_ICON_LABEL[c.tag]||c.tag.toLowerCase()}</span>
                <span className="truncate">{c.label}</span>
              </button>
            </li>)}
          </ul>}
        </li>;
      })}
      {!visible.length&&<li className="p-3 text-[11px] text-faint">{sections.length?'Sin resultados.':'Esta web no tiene secciones detectables. Añade la primera.'}</li>}
    </ul>
    <p className="border-t border-stroke px-3 py-2 text-[9.5px] leading-4 text-faint">Clic derecho o ⋯ para más opciones · Doble clic para renombrar · Todo se puede deshacer.</p>

    {menu&&menuSection&&<div ref={menuRef} role="menu" aria-label={'Opciones de '+menuSection.name}
      className="fixed z-[120] w-[232px] rounded-lg border border-stroke bg-panel p-1.5 shadow-2xl" style={{left:menu.x,top:menu.y}}>
      {confirmDelete===menuSection.key?<div className="p-2">
        <p className="text-[11.5px] leading-5 text-ink">¿Eliminar «{menuSection.name}» y todo su contenido?</p>
        <p className="mt-1 text-[10px] text-faint">Podrás deshacerlo.</p>
        <div className="mt-3 flex gap-2">
          <button type="button" role="menuitem" onClick={()=>run({type:'remove',key:menuSection.key})} className="inline-flex min-h-[34px] flex-1 items-center justify-center gap-1.5 rounded-md bg-red-600 px-2 text-[11px] font-semibold text-white hover:bg-red-500"><Trash2 size={13}/> Eliminar</button>
          <button type="button" role="menuitem" onClick={()=>setConfirmDelete(null)} className="inline-flex min-h-[34px] flex-1 items-center justify-center rounded-md border border-stroke text-[11px] text-ink hover:bg-raised">Cancelar</button>
        </div>
      </div>:<>
        <p className="truncate px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[.14em] text-faint">{menuSection.name}</p>
        <button type="button" role="menuitem" className={item} onClick={()=>run({type:'add',position:'before',key:menuSection.key})}><FilePlus2 size={14}/> Insertar sección antes</button>
        <button type="button" role="menuitem" className={item} onClick={()=>run({type:'add',position:'after',key:menuSection.key})}><FilePlus2 size={14}/> Insertar sección después</button>
        <button type="button" role="menuitem" className={item} disabled={!menuSection.container} title={menuSection.container?'':'Este elemento no admite contenido dentro'}
          onClick={()=>run({type:'add',position:'inside',key:menuSection.key})}><CornerDownRight size={14}/> Añadir bloque dentro</button>
        <div className="my-1 h-px bg-stroke"/>
        <button type="button" role="menuitem" className={item} onClick={()=>run({type:'duplicate',key:menuSection.key})}><Copy size={14}/> Duplicar</button>
        <button type="button" role="menuitem" className={item} onClick={()=>{setMenu(null);setRenaming({key:menuSection.key,value:menuSection.name});}}><Pencil size={14}/> Renombrar</button>
        <button type="button" role="menuitem" className={item} disabled={position<=0} onClick={()=>run({type:'up',key:menuSection.key})}><ArrowUp size={14}/> Subir</button>
        <button type="button" role="menuitem" className={item} disabled={position<0||position>=sections.length-1} onClick={()=>run({type:'down',key:menuSection.key})}><ArrowDown size={14}/> Bajar</button>
        <div className="my-1 h-px bg-stroke"/>
        <button type="button" role="menuitem" className={item+' text-red-400 hover:text-red-300'} onClick={()=>setConfirmDelete(menuSection.key)}><Trash2 size={14}/> Eliminar sección…</button>
      </>}
    </div>}
  </aside>
  {resizing&&<div className="fixed inset-0 z-[110] cursor-col-resize" aria-hidden/>}
  </>;
}
