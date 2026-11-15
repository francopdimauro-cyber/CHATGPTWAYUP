'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react';
import { Circle, Command } from 'lucide-react';
import { Canvas } from './canvas';
import { EditorContextMenu, type ContextSpot, type EditorCommand } from './context-menu';
import { serializeStudioLayer, parseStudioLayer, cloneStudioLayer } from '@/lib/studio-clipboard';
import { Inspector } from './inspector';
import { Navigator } from './navigator';
import { TopBar } from './top-bar';
import { DEMO_PROJECT } from '@/lib/demo-project';
import { loadLocalDemo, persistLocalDemo } from '@/lib/studio-service';
import { historyReducer } from '@/lib/studio-store';
import { ensureDocumentFont } from '@/lib/font-catalog';
import type { Device, ElementStyle, InspectorTab, Mode, StudioElement } from '@/lib/studio-types';

export function StudioApp() {
  const [history, dispatch] = useReducer(historyReducer, { past: [], present: DEMO_PROJECT, future: [] });
  const [selectedId, setSelectedId] = useState<string | null>('cta');
  const [mode, setMode] = useState<Mode>('diseno');
  const [device, setDevice] = useState<Device>('escritorio');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('diseno');
  const [zoom, setZoom] = useState(90);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [mobileInspector, setMobileInspector] = useState(false);
  const [savedContent, setSavedContent] = useState(JSON.stringify(DEMO_PROJECT));
  const [notice, setNotice] = useState('');
  const [theme, setTheme] = useState<'light'|'dark'>('dark');
  const [contextSpot, setContextSpot] = useState<ContextSpot | null>(null);
  const internalClipboard = useRef('');
  const doc = history.present;
  const dirty = useMemo(()=>JSON.stringify(doc) !== savedContent,[doc,savedContent]);

  useEffect(()=>{
    for(const element of Object.values(doc.elements))ensureDocumentFont(element.style.fontFamily);
  },[doc]);

  useEffect(()=>{
    if(window.innerWidth<=1024)setNavCollapsed(true);
    const stored=localStorage.getItem('wayup-studio-theme');
    if(stored==='light'||stored==='dark')setTheme(stored);
  }, []);
  useEffect(()=>{
    document.documentElement.dataset.studioTheme=theme;
    try { localStorage.setItem('wayup-studio-theme',theme); } catch {}
  },[theme]);

  useEffect(()=>{
    const restored = loadLocalDemo(DEMO_PROJECT);
    dispatch({ type: 'restaurar', doc: restored });
    setSavedContent(JSON.stringify(restored));
  }, []);

  const undo = useCallback(()=>dispatch({type:'deshacer'}),[]);
  const redo = useCallback(()=>dispatch({type:'rehacer'}),[]);

  const onSave = useCallback(()=>{
    try {
      persistLocalDemo(doc);
      setSavedContent(JSON.stringify(doc));
      setNotice('Cambios guardados en este navegador.');
    } catch {
      setNotice('No se han podido guardar los cambios en este navegador.');
    }
  },[doc]);

  const runCommand = useCallback(async(command:EditorCommand)=>{
    const selected = selectedId ? doc.elements[selectedId] : null;
    if (command === 'undo') { undo(); return; }
    if (command === 'redo') { redo(); return; }
    if (mode !== 'diseno') return;
    if (command === 'copy' || command === 'cut') {
      if (!selected) return;
      const payload = serializeStudioLayer(selected);
      internalClipboard.current = payload;
      try { await navigator.clipboard.writeText(payload); } catch { /* Fallback interno seguro. */ }
      if (command === 'cut') {
        dispatch({type:'eliminar',elementId:selected.id});
        setSelectedId(null);
        setNotice('Capa cortada. Ctrl + V para volver a pegarla.');
      } else setNotice('Capa copiada al portapapeles.');
      return;
    }
    if (command === 'delete') {
      if (!selected) return;
      dispatch({type:'eliminar',elementId:selected.id});
      setSelectedId(null);
      setNotice('Capa eliminada · Puedes deshacer el cambio.');
      return;
    }
    if (command === 'layer-up' || command === 'layer-down') {
      if (!selected) return;
      dispatch({type:'ordenar',elementId:selected.id,direction:command==='layer-up'?1:-1});
      setNotice('Orden de capas actualizado.');
      return;
    }
    if (command === 'paste' || command === 'duplicate') {
      let template = selected;
      if (command === 'paste') {
        let external = '';
        try { external = await navigator.clipboard.readText(); } catch { /* Sin permiso: copiar interno. */ }
        template = parseStudioLayer(external) || parseStudioLayer(internalClipboard.current);
        if (!template) {
          setNotice('No hay una capa de WayApp válida en el portapapeles.');
          return;
        }
      }
      if (!template) return;
      const firstSection = doc.sections.find(section=>section.id==='inicio' && section.children.length>=0)
        || doc.sections.find(section=>section.children.length>0) || doc.sections[0];
      const parent = selected?.sectionId || firstSection?.id;
      if (!parent) return;
      const id = crypto.randomUUID();
      const newLayer = cloneStudioLayer(template,parent,id,24);
      dispatch({type:'insertar',element:newLayer,afterId:selected?.sectionId===parent?selected.id:undefined});
      setSelectedId(id);
      setNotice(command==='duplicate'?'Capa duplicada.':'Capa pegada en el lienzo.');
    }
  },[doc,selectedId,mode,undo,redo]);

  const openContextMenu = useCallback((x:number,y:number,layerId:string|null)=>{
    if (mode!=='diseno') return;
    setSelectedId(layerId);
    setContextSpot({x,y,layerId});
  },[mode]);
  const closeContextMenu = useCallback(()=>setContextSpot(null),[]);

  useEffect(()=>{
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editing = ['INPUT','TEXTAREA','SELECT'].includes(target?.tagName) || target?.isContentEditable;
      if (event.key === 'Escape') { closeContextMenu(); return; }
      if (editing || mode !== 'diseno') {
        if (!editing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();onSave();
        }
        return;
      }
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        const action:Record<string,EditorCommand> = {c:'copy',x:'cut',v:'paste',d:'duplicate'};
        if (key==='z') {event.preventDefault();void runCommand(event.shiftKey?'redo':'undo');return;}
        if (key==='y') {event.preventDefault();void runCommand('redo');return;}
        if (key==='s') {event.preventDefault();onSave();return;}
        if (action[key]) {event.preventDefault();void runCommand(action[key]);return;}
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        if (event.key==='Delete' || event.key==='Backspace') {event.preventDefault();void runCommand('delete');}
        if (event.key===']') {event.preventDefault();void runCommand('layer-up');}
        if (event.key==='[') {event.preventDefault();void runCommand('layer-down');}
      }
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[mode,runCommand,onSave,closeContextMenu]);

  useEffect(()=>{
    if(!notice)return;
    const id = window.setTimeout(()=>setNotice(''),4200);
    return ()=>window.clearTimeout(id);
  },[notice]);

  const onStyle = (id: string, patch: Partial<ElementStyle>) => dispatch({type:'estilo',elementId:id,patch});
  const onElement = (id: string, patch: Partial<StudioElement>) => dispatch({type:'modificar',elementId:id,patch});
  const onMove = (id: string, x: number, y: number) => dispatch({type:'estilo',elementId:id,patch:{x,y}});
  const onSelect = (id: string | null) => {
    setSelectedId(id);setMobileNav(false);setContextSpot(null);
  };

  return <div className="studio-shell" style={{'--nav-width':navCollapsed?'64px':'264px'} as CSSProperties}>
    <TopBar project={doc} dirty={dirty} saving={false} canUndo={history.past.length>0} canRedo={history.future.length>0}
      onUndo={undo} onRedo={redo} onSave={onSave}
      canCopy={Boolean(selectedId && doc.elements[selectedId])}
      theme={theme} onTheme={()=>setTheme(v=>v==='dark'?'light':'dark')}
      onCreateWeb={()=>window.open('https://wayup-webcreator.francopdimauro.workers.dev/','_blank','noopener,noreferrer')}
      onCreateAgent={()=>{
        const trigger=document.getElementById('wayup-agent-open');
        if(trigger instanceof HTMLButtonElement)trigger.click();
        else setNotice('El panel de agentes no está disponible. Recarga la página e inténtalo de nuevo.');
      }}
      onCopy={()=>void runCommand('copy')} onCut={()=>void runCommand('cut')}
      onPaste={()=>void runCommand('paste')} onDuplicate={()=>void runCommand('duplicate')} onToggleLibrary={()=>{setNavCollapsed(false);setMobileNav(v=>!v)}} onToggleInspector={()=>setMobileInspector(v=>!v)}/>
    <Navigator doc={doc} selectedId={selectedId} onSelect={onSelect} onContextMenu={openContextMenu} collapsed={navCollapsed} onCollapse={()=>setNavCollapsed(v=>!v)} mobileOpen={mobileNav} onCloseMobile={()=>setMobileNav(false)}/>
    <Canvas doc={doc} mode={mode} device={device} zoom={zoom} selectedId={selectedId} onSelect={onSelect} onContextMenu={openContextMenu} onMode={setMode} onDevice={setDevice} onZoom={setZoom} onMove={onMove}/>
    <EditorContextMenu spot={contextSpot} canUndo={history.past.length>0} canRedo={history.future.length>0}
      canEdit={mode==='diseno'} onClose={closeContextMenu} onAction={runCommand}/>
    <Inspector doc={doc} selectedId={selectedId} tab={inspectorTab} onTab={setInspectorTab} onStyle={onStyle} onElement={onElement} mobileOpen={mobileInspector} onCloseMobile={()=>setMobileInspector(false)}/>
    {(mobileNav||mobileInspector)&&<button className="fixed inset-0 z-[30] bg-black/45 md:hidden" onClick={()=>{setMobileNav(false);setMobileInspector(false)}} aria-label="Cerrar paneles"/>}
    <footer className="studio-status z-10 flex items-center justify-between border-t border-white/[.07] bg-[#0e1116] px-4" role="status" aria-live="polite">
      <div className="flex min-w-0 items-center gap-3 text-[9px] text-[#738094]"><span className="inline-flex items-center gap-1.5"><Circle size={6} className="fill-emerald-400 text-emerald-400"/>Vista de diseño</span><span className="hidden truncate sm:block">{notice||'Prototipo local · No conectado a producción'}</span></div>
      <div className="flex shrink-0 items-center gap-3 font-mono text-[9px] tabular-nums text-[#748296]"><span>{doc.sections.length} secciones</span><span>{device==='escritorio'?'Escritorio':device==='tableta'?'Tableta':'Móvil'}</span><span>{zoom}%</span><span className="hidden items-center gap-1 sm:inline-flex"><Command size={10}/> + S</span></div>
    </footer>
  </div>;
}