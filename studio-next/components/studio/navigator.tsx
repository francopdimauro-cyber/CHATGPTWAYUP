'use client';

import { useMemo, useState } from 'react';
import {
  ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, Circle, FileCode2, Files, FolderOpen,
  Heading1, Layers3, PanelLeft, MousePointer2, Search, Square,
  TextCursor, Type, X, Plus, MoreHorizontal, Trash2, Copy, ArrowUp, ArrowDown, Pencil, Check
} from 'lucide-react';
import type { ProjectDoc, StudioElement } from '@/lib/studio-types';

interface NavigatorProps {
  doc: ProjectDoc;
  selectedId: string | null;
  onSelect(id: string | null): void;
  onContextMenu(x: number, y: number, layerId: string | null): void;
  onAddSection(label: string): void;
  onRemoveSection(id: string): void;
  onDuplicateSection(id: string): void;
  onMoveSection(id: string,direction:-1|1): void;
  onRenameSection(id: string,label:string): void;
  collapsed: boolean;
  onCollapse(): void;
  mobileOpen: boolean;
  onCloseMobile(): void;
}

const treeIcon = (node: StudioElement) => {
  if (node.kind === 'titulo') return Heading1;
  if (node.kind === 'subtitulo') return Type;
  if (node.kind === 'boton') return MousePointer2;
  if (node.kind === 'parrafo') return TextCursor;
  return Square;
};

export function Navigator({ doc, selectedId, onSelect, onContextMenu, onAddSection, onRemoveSection, onDuplicateSection, onMoveSection, onRenameSection, collapsed, onCollapse, mobileOpen, onCloseMobile }: NavigatorProps) {
  const [tab, setTab] = useState<'capas' | 'proyectos'>('capas');
  const [search, setSearch] = useState('');
  const [closed, setClosed] = useState<string[]>([]);
  const [adding,setAdding] = useState(false);
  const [newLabel,setNewLabel] = useState('Nueva sección');
  const [sectionMenu,setSectionMenu] = useState<string|null>(null);
  const [renaming,setRenaming] = useState<string|null>(null);
  const [renameLabel,setRenameLabel] = useState('');
  const addSection=()=>{
    const label=newLabel.trim().slice(0,65);
    if(!label)return;
    onAddSection(label);setAdding(false);setNewLabel('Nueva sección');setSearch('');
  };
  const removeSection=(id:string,label:string)=>{
    if(!window.confirm('¿Eliminar la sección «'+label+'» y todos sus elementos? Puedes deshacerlo.'))return;
    onRemoveSection(id);setSectionMenu(null);setClosed(list=>list.filter(item=>item!==id));
  };
  const sections = useMemo(() => doc.sections.filter(section =>
    !search || section.label.toLowerCase().includes(search.toLowerCase()) || section.children.some(id =>
      doc.elements[id]?.label.toLowerCase().includes(search.toLowerCase())
    )), [doc, search]);

  return (
    <aside data-mobile-open={mobileOpen} className="studio-left flex flex-col overflow-hidden border-r border-white/[.065] bg-panel" aria-label="Biblioteca y estructura de la página">
      <div className="flex h-[57px] shrink-0 items-center justify-between border-b border-white/[.06] px-3.5">
        {!collapsed ? <div className="flex items-center gap-2"><Layers3 size={14} className="text-brand"/><span className="text-[12px] font-[730]">Explorador</span></div> : <Layers3 size={16} className="mx-auto text-brand"/>}
        <div className="flex items-center gap-1">
          <button className="ui-icon h-7! w-7!" title={collapsed ? 'Expandir biblioteca' : 'Contraer biblioteca'} aria-label={collapsed ? 'Expandir biblioteca' : 'Contraer biblioteca'} onClick={onCollapse}>
            {collapsed ? <ChevronsRight size={16}/> : <ChevronsLeft size={16}/>}</button>
          <button onClick={onCloseMobile} className="ui-icon h-7! w-7! md:hidden" aria-label="Cerrar biblioteca"><X size={15}/></button>
        </div>
      </div>
      {!collapsed && <>
        <div className="px-3 pb-3 pt-3">
          <div className="ui-segment flex w-full" role="group" aria-label="Contenido del explorador">
            <button className="min-w-0 flex-1" onClick={() => setTab('capas')} aria-pressed={tab === 'capas'}><Layers3 size={13}/> Capas</button>
            <button className="min-w-0 flex-1" onClick={() => setTab('proyectos')} aria-pressed={tab === 'proyectos'}><FolderOpen size={13}/> Proyecto</button>
          </div>
          {tab === 'capas' && <div className="mt-3 flex h-9 items-center gap-2 rounded-lg border border-white/[.075] bg-app px-3 text-faint">
            <Search size={14}/><input className="min-w-0 flex-1 bg-transparent text-[11px] text-ink outline-none placeholder:text-[#667184]" placeholder="Buscar elementos…" value={search} onChange={e=>setSearch(e.target.value)} aria-label="Buscar elementos"/>
          </div>}
        </div>
        <div className="scroll-subtle flex-1 overflow-y-auto px-2.5 pb-4">
          {tab === 'capas' ? <>
            <div className="mb-2 flex items-center justify-between gap-2 px-2">
              <span className="panel-kicker">Estructura · {doc.sections.length}</span>
              <button type="button" onClick={()=>{setAdding(v=>!v);setSectionMenu(null);}}
                className="inline-flex min-h-[35px] items-center gap-1.5 rounded-lg border border-brand/40 bg-brandsoft px-3 text-[11px] font-semibold text-brand hover:border-brand"
                title="Añadir una sección real al lienzo" aria-label="Añadir sección"><Plus size={14}/> Sección</button>
            </div>
            {adding&&<div className="mb-3 rounded-lg border border-brand/35 bg-elevated p-3">
              <label htmlFor="studio-new-section" className="mb-2 block text-[11px] text-mist">Nombre de la sección</label>
              <input id="studio-new-section" autoFocus value={newLabel} maxLength={65}
                onChange={e=>setNewLabel(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addSection();if(e.key==='Escape')setAdding(false);}}
                className="w-full rounded-lg border border-stroke bg-app px-3 py-2 text-[12px] text-ink outline-none focus:border-brand"/>
              <div className="mt-2 flex gap-2">
                <button type="button" className="inline-flex min-h-[36px] items-center gap-1 rounded-md bg-brand px-3 text-[11px] font-semibold text-white disabled:opacity-50"
                  disabled={!newLabel.trim()||doc.sections.length>=35} onClick={addSection}><Plus size={13}/> Añadir al lienzo</button>
                <button type="button" className="rounded-md px-3 text-[11px] text-mist" onClick={()=>setAdding(false)}>Cancelar</button>
              </div>
            </div>}
            <button className="panel-row mb-1 flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[11px] font-semibold text-[#d3dbe7]" onClick={()=>onSelect(null)}><FileCode2 size={15} className="text-[#9ea8bc]"/><span>Página de inicio</span></button>
            {sections.map(section=>{
              const folded = closed.includes(section.id) && !search;
              return <div key={section.id} className="mb-[2px]">
                <div className="group flex min-h-[36px] items-center rounded-md hover:bg-raised">
                  <button type="button" className="panel-row flex min-h-[36px] min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 text-left text-[11px] text-[#aeb6c4]"
                    aria-expanded={!folded} onClick={()=>setClosed(items=>folded?items.filter(x=>x!==section.id):[...items,section.id])}>
                    {folded?<ChevronRight size={13} className="shrink-0 text-faint"/>:<ChevronDown size={13} className="shrink-0 text-faint"/>}
                    <PanelLeft size={13} className="shrink-0 text-[#73839b]"/><span className="min-w-0 flex-1 truncate">{section.label}</span>
                    {section.children.length>0&&<span className="font-mono text-[9px] text-faint">{section.children.length}</span>}
                  </button>
                  <button type="button" onClick={()=>{setSectionMenu(v=>v===section.id?null:section.id);setRenaming(null);}}
                    aria-expanded={sectionMenu===section.id} aria-label={'Acciones de la sección '+section.label} title="Menú contextual de sección"
                    className="mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-mist hover:bg-brandsoft hover:text-brand"><MoreHorizontal size={17}/></button>
                </div>
                {sectionMenu===section.id&&<div className="mb-2 ml-5 rounded-lg border border-stroke bg-elevated p-1.5" aria-label={'Opciones de '+section.label}>
                  {renaming===section.id?<div className="flex gap-1 p-1">
                    <input value={renameLabel} maxLength={65} autoFocus
                      onChange={e=>setRenameLabel(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'){if(renameLabel.trim())onRenameSection(section.id,renameLabel);setRenaming(null);setSectionMenu(null);}if(e.key==='Escape')setRenaming(null);}}
                      className="min-w-0 flex-1 rounded border border-stroke bg-app px-2 py-1 text-[11px] text-ink"/>
                    <button aria-label="Guardar nombre" onClick={()=>{if(renameLabel.trim()){onRenameSection(section.id,renameLabel);setRenaming(null);setSectionMenu(null);}}} className="p-2 text-brand"><Check size={14}/></button>
                  </div>:<button type="button" className="flex min-h-[34px] w-full items-center gap-2 rounded-md px-2 text-left text-[11px] text-mist hover:bg-raised" onClick={()=>{setRenaming(section.id);setRenameLabel(section.label);}}><Pencil size={13}/> Renombrar sección</button>}
                  <button type="button" className="flex min-h-[34px] w-full items-center gap-2 rounded-md px-2 text-left text-[11px] text-mist hover:bg-raised" onClick={()=>{onDuplicateSection(section.id);setSectionMenu(null);}}><Copy size={13}/> Duplicar sección</button>
                  <button type="button" disabled={doc.sections[0]?.id===section.id} className="flex min-h-[34px] w-full items-center gap-2 rounded-md px-2 text-left text-[11px] text-mist hover:bg-raised disabled:opacity-30" onClick={()=>{onMoveSection(section.id,-1);setSectionMenu(null);}}><ArrowUp size={13}/> Subir sección</button>
                  <button type="button" disabled={doc.sections.at(-1)?.id===section.id} className="flex min-h-[34px] w-full items-center gap-2 rounded-md px-2 text-left text-[11px] text-mist hover:bg-raised disabled:opacity-30" onClick={()=>{onMoveSection(section.id,1);setSectionMenu(null);}}><ArrowDown size={13}/> Bajar sección</button>
                  <button type="button" disabled={doc.sections.length<=1} className="flex min-h-[36px] w-full items-center gap-2 rounded-md px-2 text-left text-[11px] font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-30" onClick={()=>removeSection(section.id,section.label)}><Trash2 size={13}/> Eliminar sección</button>
                </div>}
                {!folded && section.children.filter(id=>!search||doc.elements[id]?.label.toLowerCase().includes(search.toLowerCase())||section.label.toLowerCase().includes(search.toLowerCase())).map(id=>{
                  const node=doc.elements[id];if(!node)return null;
                  const Icon=treeIcon(node);
                  return <button key={id} className="panel-row ml-4 flex h-[30px] w-[calc(100%-16px)] items-center gap-2 rounded-md pl-4 pr-2 text-left text-[10.5px] text-[#8591a4]" data-selected={selectedId===id} onClick={()=>onSelect(id)} onContextMenu={event=>{event.preventDefault();onContextMenu(event.clientX,event.clientY,id);}}>
                    <Icon size={13} className="shrink-0 opacity-75"/><span className="min-w-0 flex-1 truncate">{node.label}</span>
                    {selectedId===id&&<span className="h-1 w-1 rounded-full bg-[#8ca5ff]"/>}
                  </button>;
                })}
              </div>;
            })}
            {!sections.length&&<p className="px-3 pt-5 text-center text-[11px] text-faint">No se han encontrado elementos.</p>}
          </>:<div className="px-1"><span className="panel-kicker">Biblioteca privada</span>
            <button className="mt-3 w-full rounded-xl border border-[#839dff32] bg-[#607fff13] p-3 text-left transition-colors hover:bg-[#607fff23]" onClick={()=>setTab('capas')}>
              <div className="flex items-center gap-2"><Files size={17} className="text-brand"/><span className="truncate text-[11.5px] font-[710] text-[#dbe3f6]">{doc.name}</span></div>
              <div className="mt-2 pl-6 font-mono text-[10px] text-mist">Versión {doc.version} · {doc.lastEdited}</div>
            </button>
            <p className="mt-4 px-2 text-[10.5px] leading-5 text-faint">La biblioteca completa de proyectos se conectará al servicio de almacenamiento de WAYUP.</p>
          </div>}
        </div>
        <div className="flex shrink-0 items-center justify-between border-t border-white/[.065] px-4 py-3 text-[10px] text-faint"><span className="inline-flex items-center gap-2"><Circle size={7} className="fill-emerald-400 text-emerald-400"/> Edición local</span><span className="font-mono">{doc.sections.length} secciones</span></div>
      </>}
    </aside>
  );
}