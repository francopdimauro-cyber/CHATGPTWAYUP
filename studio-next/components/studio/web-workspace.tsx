'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bot, Check, ChevronRight, CodeXml, Download, FileArchive, FileCode2,
  FilePlus2, FileUp, FolderOpen, Globe, LoaderCircle, Monitor, Paintbrush, Redo2,
  Save, Smartphone, Sparkles, Undo2, X, Copy, Trash2, ArrowUp, ArrowDown, ImagePlus, Link2, Layers3, Move } from 'lucide-react';
import { parseColorCode } from '@/lib/color-codes';
import {cloudListSites,cloudLoadSite,cloudSaveSite,type CloudSiteSummary} from '@/lib/studio-cloud';
import { AgentSetup, type LinkedAgent } from './agent-setup';
import { starterHtml } from '@/lib/starter-web';
import { strFromU8, strToU8 } from 'fflate';
import { addHtmlSection, attachLocalImage, editHtmlStructure, htmlLayerOutline,
  downloadBytes, htmlForExport, listSavedSites, patchSelectedElement, safePreview,
  saveSite, siteFromHtml, siteFromZip, siteZip,
  type SiteBundle } from '@/lib/web-project-files';

type Stage='home'|'create'|'editor'|'agent'|'export';
type View='preview'|'code';
type BrowserEditorProps={
  onClose():void;
};
const cleanName=(value:string):string=>value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').slice(0,64)||'web';
const BASE='rounded-xl border border-stroke bg-elevated px-3 py-2.5 text-[12px] text-ink outline-none focus:border-brand';
const btn='inline-flex min-h-[36px] items-center justify-center gap-2 rounded-lg border border-stroke bg-elevated px-3 text-[11px] font-semibold text-ink transition hover:border-brand/50 hover:bg-raised disabled:opacity-40';
const primary='inline-flex min-h-[37px] items-center justify-center gap-2 rounded-lg bg-[#2855ee] px-4 text-[11px] font-bold text-white shadow-sm hover:bg-[#3e69f5] disabled:opacity-50';
const steps=[['01','Crear web'],['02','Editar web'],['03','Agente IA'],['04','Exportar']] as const;
function fileByte(bytes:Uint8Array):string{
  if(bytes.length>2_000_000)throw Error('El archivo HTML supera 2 MB.');
  return strFromU8(bytes);
}
function briefFrom(form:Record<string,string>):string{
  return [
    'CREA UNA WEB PROFESIONAL COMPLETA Y EDITABLE PARA ESTE NEGOCIO.',
    'Negocio: '+form.name,
    'Sector: '+form.industry,
    'Público objetivo: '+form.audience,
    'Objetivo principal: '+form.goal,
    'Dirección de arte: '+form.style,
    'Servicios, contenido y valores reales: '+form.services,
    'Datos proporcionados: '+form.contact,
    'Funciones solicitadas: '+form.features,
    'Marca y colores de referencia: '+form.palette,
    'REQUISITOS DEL EDITOR WAYUP: utiliza secciones semánticas con data-wc-section estable,',
    'títulos reales, navegación y botones funcionales con anclas válidas.',
    'Entrega HTML5 completo y responsivo, sin scripts ni imágenes externas inventadas.'
  ].join('\n');
}
async function streamGeneratedWeb(briefing:string,onProgress:(v:string)=>void):Promise<string>{
  const res=await fetch('/studio-api/webcreator/generate-stream',{
    method:'POST',headers:{'Content-Type':'application/json'},
    credentials:'same-origin',cache:'no-store',body:JSON.stringify({briefing})
  });
  if(!res.ok){
    const data=await res.json().catch(()=>({}));
    throw Error(data.error||'El motor de generación no está disponible en Studio (HTTP '+res.status+').');
  }
  if(!res.body)throw Error('El motor de generación no devolvió un flujo de datos.');
  const reader=res.body.getReader(),decoder=new TextDecoder();
  let carry='',html='',completed=false,event='message';
  function handle(raw:string){
    let payload='';
    for(const line of raw.split('\n')){
      if(line.startsWith('event:'))event=line.slice(6).trim();
      if(line.startsWith('data:'))payload+=line.slice(5).trim();
    }
    if(!payload)return;
    let data:Record<string,unknown>;
    try{data=JSON.parse(payload) as Record<string,unknown>;}catch{return;}
    if(event==='complete'){
      if(typeof data.html==='string'){html=data.html;completed=true;}
      onProgress('Web generada. Preparando editor…');
    }else if(event==='error')throw Error(String(data.error||data.message||'Ha fallado la generación.'));
    else if(event==='progress'||event==='status')onProgress(String(data.message||'Generando diseño y estructura…'));
    event='message';
  }
  while(true){
    const chunk=await reader.read();if(chunk.done)break;
    carry+=decoder.decode(chunk.value,{stream:true});
    const parts=carry.split(/\r?\n\r?\n/);carry=parts.pop()||'';
    for(const part of parts)handle(part);
  }
  if(carry.trim())handle(carry);
  if(!completed)throw Error('La generación terminó sin entregar un documento HTML completo.');
  return html;
}
export function WebWorkspace({onClose}:BrowserEditorProps){
  const [stage,setStage]=useState<Stage>('home');
  const [site,setSite]=useState<SiteBundle|null>(null);
  const [savedSites,setSavedSites]=useState<SiteBundle[]>([]);
  const [cloudItems,setCloudItems]=useState<CloudSiteSummary[]>([]);
  const [cloudInfo,setCloudInfo]=useState('Inicia sesión para sincronizar tus proyectos.');
  const [cloudBusy,setCloudBusy]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [fileError,setFileError]=useState('');
  const [view,setView]=useState<View>('preview');
  const [device,setDevice]=useState<'desktop'|'mobile'>('desktop');
  const [selected,setSelected]=useState<number|null>(null);
  const [moveMode,setMoveMode]=useState(false);
  const moveModeRef=useRef(false);
  const [selectedValues,setSelectedValues]=useState({text:'',color:'',background:'',fontSize:'',href:'',alt:'',width:'',height:'',padding:'',margin:'',radius:'',fontWeight:'',fontFamily:'',textAlign:'',posX:'0',posY:'0'});
  const [layerSearch,setLayerSearch]=useState('');
  const [draftHtml,setDraftHtml]=useState('');
  const [past,setPast]=useState<string[]>([]);
  const [future,setFuture]=useState<string[]>([]);
  const [dirty,setDirty]=useState(false);
  const [postSavePrompt,setPostSavePrompt]=useState(false);
  const [form,setForm]=useState<Record<string,string>>({
    name:'',industry:'',audience:'',goal:'Conseguir contactos y clientes',
    style:'Editorial, moderno, profesional y responsive',
    services:'',contact:'',features:'Formulario de contacto, WhatsApp opcional',
    palette:'Respetar la identidad corporativa disponible'
  });
  const fileInput=useRef<HTMLInputElement>(null);
  const previewFrame=useRef<HTMLIFrameElement>(null);
  const selectedRef=useRef<HTMLElement|null>(null);
  const preview=useMemo(()=>site?safePreview(site):null,[site]);
  useEffect(()=>{moveModeRef.current=moveMode;const doc=previewFrame.current?.contentDocument;if(doc?.body)doc.body.style.cursor=moveMode?'grab':'';},[moveMode]);
  const layers=useMemo(()=>site?htmlLayerOutline(site.html):[],[site]);
  const activeLayer=layers.find(layer=>layer.index===selected);
  const filteredLayers=layers.filter(layer=>(layer.tag+' '+layer.label+' '+layer.id).toLowerCase().includes(layerSearch.toLowerCase())).slice(0,250);
  useEffect(()=>()=>preview?.revoke(),[preview]);
  useEffect(()=>{void listSavedSites().then(setSavedSites).catch(()=>setNotice('No se pudo abrir la biblioteca local de proyectos.'));},[]);
  const changeHtml=useCallback((html:string)=>{
    if(!site||html===site.html)return;
    setPast(old=>[...old.slice(-49),site.html]);setFuture([]);
    setSite(old=>old?{...old,html,updatedAt:Date.now()}:old);
    setDraftHtml(html);setDirty(true);setSelected(null);selectedRef.current=null;
  },[site]);
  const changeSite=(value:SiteBundle)=>{
    setSite(value);setDraftHtml(value.html);setPast([]);setFuture([]);setDirty(false);
    setSelected(null);setNotice('');setPostSavePrompt(false);setView('preview');setStage('editor');
  };
  const undo=()=>{
    if(!site||!past.length)return;
    const previous=past[past.length-1];setPast(past.slice(0,-1));setFuture(v=>[site.html,...v]);
    setSite({...site,html:previous});setDraftHtml(previous);setDirty(true);setSelected(null);
  };
  const redo=()=>{
    if(!site||!future.length)return;
    const [next,...rest]=future;setFuture(rest);setPast(v=>[...v,site.html].slice(-50));
    setSite({...site,html:next});setDraftHtml(next);setDirty(true);setSelected(null);
  };
  async function importFile(file:File){
    setBusy(true);setFileError('');
    try{
      if(file.size>25_000_000)throw Error('El archivo supera el límite de 25 MB.');
      const buffer=await file.arrayBuffer();
      const site=file.name.toLowerCase().endsWith('.zip')?siteFromZip(new Uint8Array(buffer)):
        siteFromHtml(fileByte(new Uint8Array(buffer)),file.name.replace(/\.html?$/i,''));
      changeSite(site);
    }catch(error){setFileError(error instanceof Error?error.message:'No se pudo importar esta web.');}
    finally{setBusy(false);if(fileInput.current)fileInput.current.value='';}
  }
  async function onSave(){
    if(!site)return;
    setBusy(true);
    try{
      const saved=await saveSite(site);
      setSite(saved);setDirty(false);setNotice('Versión '+saved.version+' guardada en este dispositivo.');
      if(saved.version===1 && !saved.agent)setPostSavePrompt(true);
      setSavedSites(await listSavedSites());
    }catch{setNotice('No fue posible guardar la web. Descarga una copia ZIP para no perder cambios.');}
    finally{setBusy(false);}
  }
  async function refreshCloud(){
    setCloudBusy(true);
    try{const projects=await cloudListSites();setCloudItems(projects);setCloudInfo('Nube conectada · Proyectos privados de tu cuenta');}
    catch{setCloudItems([]);setCloudInfo('Nube no disponible: inicia sesión y comprueba los bindings de Studio.');}
    finally{setCloudBusy(false);}
  }
  async function openCloudSite(item:CloudSiteSummary){
    setBusy(true);
    try{changeSite(await cloudLoadSite(item));setNotice('Proyecto recuperado desde el almacenamiento privado.');}
    catch(error){setNotice(error instanceof Error?error.message:'No se pudo abrir la versión remota.');}
    finally{setBusy(false);}
  }
  async function onCloudSave(){
    if(!site)return;
    setBusy(true);
    try{
      const remote=await cloudSaveSite(site);
      const local=await saveSite(remote);
      setSite(local);setDirty(false);
      setSavedSites(await listSavedSites());
      await refreshCloud();
      setNotice('Proyecto guardado de forma privada en la nube · versión '+remote.cloud?.version+'.');
      if(!site.cloud&&!site.agent)setPostSavePrompt(true);
    }catch(error){setNotice(error instanceof Error?error.message:'No se pudo guardar en la nube. La copia local permanece disponible.');}
    finally{setBusy(false);}
  }
  function createLocalWeb(){
    setFileError('');
    try{
      const html=starterHtml(form as Parameters<typeof starterHtml>[0]);
      const draft=siteFromHtml(html,form.name.trim());
      changeSite({...draft,source:'generated'});
      setNotice('Web creada a partir de tu briefing. Puedes editar cada elemento, su código y exportar el ZIP.');
    }catch(error){setFileError(error instanceof Error?error.message:'No se pudo crear la web.');}
  }
  const [webAIReady,setWebAIReady]=useState(false);
  const [webAIReason,setWebAIReason]=useState('');
  const refreshWebAI=useCallback(async()=>{
    try{
      const response=await fetch('/studio-api/webcreator/status',{cache:'no-store',credentials:'same-origin'});
      const data=await response.json().catch(()=>null);
      setWebAIReady(response.ok&&data?.configured===true&&data?.authorized===true);
      setWebAIReason(String(data?.reason||'').slice(0,240));
    }catch{setWebAIReady(false);setWebAIReason('No se pudo comprobar el motor IA de Studio.');}
  },[]);
  useEffect(()=>{if(stage==='create')void refreshWebAI()},[stage,refreshWebAI]);
  async function createWeb(){
    if(form.name.trim().length<2||form.services.trim().length<20){
      setFileError('Introduce el nombre del negocio y al menos 20 caracteres sobre sus servicios.');return;
    }
    setFileError('');setBusy(true);setNotice('Generando la web con el motor IA conectado…');
    try{
      const html=await streamGeneratedWeb(briefFrom(form),setNotice);
      const generated=siteFromHtml(html,form.name.trim());
      changeSite({...generated,source:'generated'});
    }catch(error){
      setFileError(error instanceof Error?error.message:'Error al crear la web.');
      setNotice('El editor local sigue disponible. Comprueba el estado del motor IA y reintenta.');
    }finally{setBusy(false);}
  }

  function selectLayer(index:number,scroll=true){
    const element=previewFrame.current?.contentDocument?.querySelector<HTMLElement>('[data-wayup-edit="'+index+'"]');
    if(!element)return;
    selectedRef.current?.removeAttribute('data-wayup-selected');
    element.dataset.wayupSelected='true';
    selectedRef.current=element;
    setSelected(index);
    setSelectedValues({
      text:element.children.length?'':element.textContent?.slice(0,5000)||'',
      color:element.style.color||'#ffffff',
      background:element.style.backgroundColor||'transparent',
      fontSize:element.style.fontSize||'16px',
      href:element.getAttribute('href')||'',
      alt:element.getAttribute('alt')||'',
      width:element.style.width||'',height:element.style.height||'',
      padding:element.style.padding||'',margin:element.style.margin||'',
      radius:element.style.borderRadius||'',fontWeight:element.style.fontWeight||'',
      fontFamily:element.style.fontFamily||'',textAlign:element.style.textAlign||'',
      posX:element.style.translate.match(/^(-?\d+)px\s+(-?\d+)px$/)?.[1]||'0',
      posY:element.style.translate.match(/^(-?\d+)px\s+(-?\d+)px$/)?.[2]||'0'
    });
    if(scroll)element.scrollIntoView({block:'center',behavior:'smooth'});
  }
  function previewLoaded(){
    const doc=previewFrame.current?.contentDocument;
    if(!doc)return;
    if(doc.body)doc.body.style.cursor=moveModeRef.current?'grab':'';
    doc.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();
      const element=(event.target as Element).closest<HTMLElement>('[data-wayup-edit]');
      if(!element)return;
      const index=Number(element.dataset.wayupEdit);
      if(Number.isSafeInteger(index))selectLayer(index);
    },true);
    doc.addEventListener('submit',event=>event.preventDefault(),true);
    type Moving={element:HTMLElement;index:number;pointerId:number;clientX:number;clientY:number;x:number;y:number;moved:boolean};
    let moving:Moving|null=null;
    const clamp=(n:number)=>Math.max(-1200,Math.min(1200,Math.round(n)));
    doc.addEventListener('pointerdown',event=>{
      if(!moveModeRef.current||event.button!==0)return;
      const element=(event.target as Element).closest<HTMLElement>('[data-wayup-edit]');
      if(!element)return;
      const index=Number(element.dataset.wayupEdit);
      if(!Number.isSafeInteger(index))return;
      const position=element.style.translate.match(/^(-?\d+)px\s+(-?\d+)px$/);
      moving={element,index,pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY,
        x:Number(position?.[1]||0),y:Number(position?.[2]||0),moved:false};
      event.preventDefault();
      selectLayer(index,false);
      try{element.setPointerCapture(event.pointerId);}catch{}
    },true);
    doc.addEventListener('pointermove',event=>{
      if(!moving||event.pointerId!==moving.pointerId)return;
      const dx=event.clientX-moving.clientX,dy=event.clientY-moving.clientY;
      if(!moving.moved&&Math.hypot(dx,dy)<3)return;
      moving.moved=true;
      moving.element.style.translate=clamp(moving.x+dx)+'px '+clamp(moving.y+dy)+'px';
    },true);
    doc.addEventListener('pointerup',event=>{
      if(!moving||event.pointerId!==moving.pointerId)return;
      const state=moving;moving=null;
      try{state.element.releasePointerCapture(event.pointerId);}catch{}
      if(!state.moved)return;
      try{
        const x=clamp(state.x+event.clientX-state.clientX),y=clamp(state.y+event.clientY-state.clientY);
        if(!site)return;
        changeHtml(patchSelectedElement(site.html,state.index,{moveX:x,moveY:y}));
        setNotice('Elemento desplazado en el HTML real. Deshacer restaura su posición.');
      }catch(error){setNotice(error instanceof Error?error.message:'No se pudo mover el elemento.');}
    },true);
    doc.addEventListener('pointercancel',()=>{
      if(!moving)return;
      moving.element.style.translate=moving.x+'px '+moving.y+'px';
      moving=null;
    },true);
  }
  function modifyStructure(action:'duplicate'|'remove'|'up'|'down'){
    if(!site||selected===null)return;
    try{
      changeHtml(editHtmlStructure(site.html,selected,action));
      setNotice(action==='duplicate'?'Elemento duplicado en el HTML.':action==='remove'?'Elemento eliminado; puedes deshacerlo.':'Orden cambiado; puedes deshacerlo.');
    }catch(error){setNotice(error instanceof Error?error.message:'No se pudo modificar el bloque.');}
  }
  function insertSection(){
    if(!site)return;
    try{changeHtml(addHtmlSection(site.html));setNotice('Nueva sección añadida al documento real.');}
    catch(error){setNotice(error instanceof Error?error.message:'No se pudo añadir la sección.');}
  }
  async function changeImage(file:File){
    if(!site||selected===null)return;
    try{
      const image=attachLocalImage(site,selected,new Uint8Array(await file.arrayBuffer()));
      setPast(old=>[...old.slice(-49),site.html]);setFuture([]);
      setSite(image);setDraftHtml(image.html);setDirty(true);
      setSelected(null);selectedRef.current=null;
      setNotice('Imagen incorporada al proyecto y al ZIP. Guarda la versión para conservarla.');
    }catch(error){setNotice(error instanceof Error?error.message:'No se pudo adjuntar la imagen.');}
  }
  const patch=(changes:{text?:string;color?:string;background?:string;fontSize?:string;href?:string;alt?:string;width?:string;height?:string;padding?:string;margin?:string;radius?:string;fontWeight?:string;fontFamily?:string;textAlign?:string;moveX?:number;moveY?:number})=>{
    if(!site||selected===null)return;
    try{
      const next=patchSelectedElement(site.html,selected,changes);
      changeHtml(next);
      setNotice('Elemento actualizado en el HTML de la web.');
    }catch(error){setNotice(error instanceof Error?error.message:'No se pudo actualizar el elemento.');}
  };
  async function handleAgentLinked(agent:LinkedAgent){
    if(!site)return;
    const attached:SiteBundle={...site,agent,updatedAt:Date.now()};
    setSite(attached);setDirty(true);
    setNotice('El asistente se ha vinculado a esta web. Se añadirá al ZIP y HTML exportados.');
    try{
      let saved=attached;
      if(attached.cloud)saved=await cloudSaveSite(saved);
      saved=await saveSite(saved);
      setSite(saved);setDirty(false);
      setSavedSites(await listSavedSites());
      setNotice(saved.cloud?'Agente vinculado y guardado con la web en Cloudflare.':'Agente vinculado y guardado en este dispositivo.');
    }catch{
      setNotice('Agente vinculado en esta sesión, pero no se pudo guardar en este dispositivo. Descarga el ZIP ahora.');
    }
    setStage('export');setPostSavePrompt(false);
  }
  function exportHtml(){
    if(!site)return;
    const bytes=strToU8(htmlForExport(site));
    downloadBytes(bytes,cleanName(site.name)+'.html','text/html;charset=utf-8');
    setNotice('HTML descargado.');
  }
  function exportZip(){
    if(!site)return;
    try{
      const bytes=siteZip(site);
      downloadBytes(bytes,cleanName(site.name)+'.zip','application/zip');
      setNotice(site.agent?'ZIP descargado con web y agente vinculado.':'ZIP descargado con HTML y recursos actualizados.');
    }catch(error){setNotice(error instanceof Error?error.message:'No se pudo exportar.');}
  }
  const editInputs=(id:keyof typeof form,label:string,placeholder:string,required=false)=>(
    <label key={id} className="flex flex-col gap-1.5 text-[11px] text-mist">{label}
      <input className={BASE} value={form[id]} placeholder={placeholder}
        required={required} onChange={event=>setForm({...form,[id]:event.target.value})}/>
    </label>
  );
  return <div className="fixed inset-0 z-[60] flex min-h-0 flex-col overflow-hidden bg-app text-ink" role="dialog" aria-modal="true" aria-label="WayUp Studio — Crear y editar webs reales">
    <header className="flex h-[63px] shrink-0 items-center justify-between gap-3 border-b border-stroke bg-panel px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <img src="/wayup-logo.png" className="h-9 w-9 shrink-0 rounded-full object-contain" alt="WayUp"/>
        <div className="min-w-0"><div className="text-[13px] font-bold tracking-tight">WayUp Studio <span className="font-normal text-mist">/ Web Workspace</span></div>
          <div className="truncate text-[10px] text-faint">{site?site.name:'Proyectos · Creador · Editor · Agente IA'}</div></div>
      </div>
      <div className="hidden items-center gap-2 lg:flex">
        {steps.map(([number,label],index)=>(
          <div key={number} className="flex items-center gap-1.5">
            {index>0&&<ChevronRight size={12} className="text-faint"/>}
            <span className={'rounded-md px-2 py-1.5 text-[10px] font-semibold '+(
              (stage==='home'||stage==='create'?index===0:stage==='editor'?index===1:stage==='agent'?index===2:index===3)?
                'bg-brandsoft text-brand':'text-mist'
            )}>{number} · {label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {site&&<button onClick={()=>setStage('home')} className={btn}><FolderOpen size={14}/> Proyectos</button>}
        <button onClick={onClose} className={btn} title="Cerrar Web Workspace"><X size={15}/><span className="hidden sm:inline">Cerrar</span></button>
      </div>
    </header>
    {(notice||fileError)&&<div role="status" className={'shrink-0 border-b px-4 py-2 text-[11px] '+(fileError?'border-red-500/30 bg-red-500/10 text-red-400':'border-stroke bg-elevated text-mist')}>{fileError||notice}</div>}
    {(stage==='home'||stage==='create')&&<main className="scroll-subtle mx-auto w-full max-w-[1090px] flex-1 overflow-y-auto px-5 py-8 sm:px-9">
      <div className="mb-7 flex items-end justify-between gap-3">
        <div><div className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-brand">El estudio definitivo</div>
          <h1 className="text-[clamp(25px,3vw,38px)] font-semibold tracking-[-.055em]">Una web real. Tu diseño. Tu agente.</h1>
          <p className="mt-2 max-w-[600px] text-[12px] leading-6 text-mist">Crea una web con IA o abre cualquier proyecto HTML/ZIP para editar su código, diseño y exportación.</p></div>
        {stage==='create'&&<button onClick={()=>setStage('home')} className={btn}><ArrowLeft size={14}/> Volver</button>}
      </div>
      {stage==='home'?<>
        <div className="grid gap-4 md:grid-cols-3">
          <button onClick={()=>{setStage('create');setFileError('');}} className="group flex min-h-[175px] flex-col items-start gap-3 rounded-2xl border border-brand/30 bg-brandsoft p-5 text-left transition hover:border-brand">
            <Sparkles size={25} className="text-brand"/>
            <span className="text-[16px] font-bold">Generar con IA</span>
            <span className="text-[12px] leading-5 text-mist">Briefing profesional, motor WebCreator y apertura automática en el editor.</span>
            <span className="mt-auto text-[11px] font-semibold text-brand">Crear proyecto →</span>
          </button>
          <button onClick={()=>fileInput.current?.click()} className="flex min-h-[175px] flex-col items-start gap-3 rounded-2xl border border-stroke bg-panel p-5 text-left transition hover:border-brand/40">
            <FileUp size={25} className="text-brand"/>
            <span className="text-[16px] font-bold">Importar una web</span>
            <span className="text-[12px] leading-5 text-mist">HTML o ZIP completo. Conserva CSS, imágenes, fuentes y estructura.</span>
            <span className="mt-auto text-[11px] font-semibold text-brand">Elegir archivo →</span>
          </button>
          <button onClick={()=>{
            const title='Mi nuevo proyecto';
            changeSite(siteFromHtml('<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><style>body{font:16px system-ui;margin:0;background:#f8f9fc;color:#151a26}header{padding:26px 6%;background:#fff;border-bottom:1px solid #ddd}main{padding:90px 6%;max-width:900px;margin:auto}h1{font-size:clamp(38px,6vw,72px);line-height:1.07}p{line-height:1.8}</style></head><body><header>MI MARCA · INICIO · SERVICIOS · CONTACTO</header><main><h1>Tu próxima gran web comienza aquí</h1><p>Selecciona cualquier elemento del lienzo y empieza a personalizarlo desde el Inspector. También puedes editar el código HTML completo.</p></main></body></html>',title));
          }} className="flex min-h-[175px] flex-col items-start gap-3 rounded-2xl border border-stroke bg-panel p-5 text-left transition hover:border-brand/40">
            <FilePlus2 size={25} className="text-brand"/>
            <span className="text-[16px] font-bold">Empezar en blanco</span>
            <span className="text-[12px] leading-5 text-mist">Editor libre con código HTML y personalización de elementos reales.</span>
            <span className="mt-auto text-[11px] font-semibold text-brand">Nuevo lienzo →</span>
          </button>
        </div>
        <div className="mt-9 flex items-center justify-between"><h2 className="text-[14px] font-semibold">Tus proyectos guardados</h2><span className="font-mono text-[10px] text-faint">{savedSites.length} proyectos · guardados en este dispositivo</span></div>
        <div className="mt-3 grid gap-2">
          {savedSites.map(item=><button key={item.id} className="flex w-full items-center gap-3 rounded-xl border border-stroke bg-panel p-4 text-left hover:border-brand/50" onClick={()=>changeSite(item)}>
            <Globe size={20} className="text-brand"/><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-semibold">{item.name}</span><span className="text-[10px] text-faint">Versión {item.version} · {new Date(item.updatedAt).toLocaleString('es-ES')}</span></span><ChevronRight size={16} className="text-faint"/>
          </button>)}
          {!savedSites.length&&<div className="rounded-xl border border-dashed border-stroke px-5 py-7 text-center text-[12px] text-faint">Todavía no tienes webs guardadas. Genera una o importa un ZIP.</div>}
        </div>
        <div className="mt-8 border-t border-stroke pt-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold"><Globe size={15} className="text-brand"/> Tus proyectos en la nube</h2>
            <button disabled={cloudBusy} onClick={()=>void refreshCloud()} className={btn}>Actualizar nube</button>
          </div>
          <p className="mb-3 text-[10px] leading-5 text-faint">{cloudInfo}</p>
          <div className="grid gap-2">
            {cloudItems.map(item=><button key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-stroke bg-panel p-3 text-left hover:border-brand/40" onClick={()=>void openCloudSite(item)}>
              <span className="min-w-0 truncate text-[12px] font-semibold">{item.name}</span>
              <span className="shrink-0 font-mono text-[10px] text-mist">v{item.version}</span>
            </button>)}
          </div>
        </div>
        <input ref={fileInput} type="file" hidden accept=".zip,.html,.htm" onChange={e=>{const file=e.target.files?.[0];if(file)void importFile(file);}}/>
      </>:<div className="rounded-2xl border border-stroke bg-panel p-5 sm:p-7">
        <div className="mb-5 flex items-center justify-between"><h2 className="text-[17px] font-bold">Crear web con WebCreator</h2><span className="rounded-full bg-brandsoft px-3 py-1 text-[10px] text-brand">Formulario completo</span></div>
        <div className="grid gap-4 md:grid-cols-2">
          {editInputs('name','Nombre del negocio','Ej. Entrena-T Parquesol',true)}
          {editInputs('industry','Sector o actividad','Gimnasio, restaurante, clínica…',true)}
          {editInputs('audience','Público objetivo','Personas que buscan entrenamiento personal')}
          {editInputs('goal','Objetivo de la web','Conseguir reservas, contactos, ventas…')}
          {editInputs('style','Estilo visual','Minimalista, premium, editorial…')}
          {editInputs('palette','Colores e identidad de marca','Cobalto, marfil, logotipo existente…')}
        </div>
        <label className="mt-4 flex flex-col gap-1.5 text-[11px] text-mist">Servicios y propuesta de valor
          <textarea className={BASE+' min-h-[96px] resize-y'} value={form.services} placeholder="Describe de verdad qué hace tu negocio y por qué es diferente…" onChange={e=>setForm({...form,services:e.target.value})}/>
        </label>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {editInputs('contact','Ubicación, contacto y horarios','Solo información real')}
          {editInputs('features','Funciones necesarias','WhatsApp, formulario, mapa, reservas…')}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button disabled={busy} onClick={createLocalWeb} className={primary}><FilePlus2 size={15}/> Crear web editable desde el briefing</button>
          <button disabled={!webAIReady||busy} onClick={()=>void createWeb()} className={btn} title={webAIReady?'Motor de IA autorizado':'Verifica tu acceso por correo y la conexión de Workers AI'}>
            {busy?<LoaderCircle size={15} className="animate-spin"/>:<Sparkles size={15}/>} Generación IA {webAIReady?'':'(sin conexión)'}
          </button>
        </div>
        <div className="mt-4 rounded-xl border border-stroke bg-elevated p-4 text-[11px] leading-5 text-mist">
          <div className="flex items-center justify-between gap-2">
            <strong>Conexión del generador IA</strong>
            <button className={btn} onClick={()=>void refreshWebAI()}>Comprobar conexión</button>
          </div>
          <p className="mt-2">{webAIReady?(webAIReason||'Generador IA conectado.'):(webAIReason||'Comprueba tu sesión por correo y la conexión de Workers AI.')}</p>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-faint">La generación utiliza Workers AI y tu sesión de correo. No necesitas la contraseña antigua de WebCreator. El editor local funciona incluso cuando no hay IA.</p>
      </div>}
    </main>}
    {site&&stage==='editor'&&<main className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-stroke bg-panel px-4 py-2.5">
        <div className="flex items-center gap-2 text-[10px] text-mist">
          <span className="rounded-md bg-brandsoft px-2 py-1 font-bold text-brand">{site.source==='generated'?'GENERADA':'IMPORTADA'}</span>
          <span className="hidden sm:inline">{site.entry}</span>
          <span>{Object.keys(site.assets).length} recursos</span>
          {dirty&&<span className="text-amber-400">● Sin guardar</span>}
          {site.cloud&&<span className="text-brand">Nube · v{site.cloud.version}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={undo} disabled={!past.length} className={btn} title="Deshacer"><Undo2 size={14}/></button>
          <button onClick={redo} disabled={!future.length} className={btn} title="Rehacer"><Redo2 size={14}/></button>
          <button onClick={()=>setView('preview')} className={btn+(view==='preview'?' border-brand text-brand':'')}><Paintbrush size={14}/> Visual</button>
          <button onClick={()=>setMoveMode(v=>!v)} aria-pressed={moveMode} className={btn+(moveMode?' border-brand text-brand':'')} title="Activa para arrastrar elementos directamente en la web importada"><Move size={14}/> Mover</button>
          <button onClick={()=>setView('code')} className={btn+(view==='code'?' border-brand text-brand':'')}><CodeXml size={14}/> HTML</button>
          <button onClick={()=>void onSave()} disabled={busy} className={btn}><Save size={14}/> Guardar</button>
          <button onClick={()=>void onCloudSave()} disabled={busy} className={btn} title="Guardar versión en Cloudflare con sesión y control de concurrencia"><Globe size={14}/> Guardar nube</button>
          <button onClick={()=>setStage('agent')} className={primary}><Bot size={14}/> Siguiente: Agente IA</button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        {view==='preview'&&<aside className="hidden w-[232px] shrink-0 flex-col border-r border-stroke bg-panel xl:flex" aria-label="Navegador de capas HTML">
          <div className="border-b border-stroke px-3 py-3">
            <h2 className="flex items-center gap-2 text-[12px] font-semibold"><Layers3 size={14} className="text-brand"/> Estructura de la web</h2>
            <input className={BASE+' mt-3 w-full'} value={layerSearch} onChange={e=>setLayerSearch(e.target.value)} placeholder="Buscar sección o elemento…" aria-label="Buscar capas"/>
          </div>
          <div className="scroll-subtle min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {filteredLayers.map(layer=><button key={layer.index} type="button"
              onClick={()=>selectLayer(layer.index)} aria-pressed={selected===layer.index}
              style={{paddingLeft:8+layer.depth*11}}
              className={'mb-0.5 flex w-full items-center gap-2 rounded-md py-2 pr-2 text-left text-[10px] '+(selected===layer.index?'bg-brandsoft text-brand':'text-mist hover:bg-raised')}>
              <span className="shrink-0 font-mono text-[9px] text-faint">{layer.tag.toLowerCase()}</span>
              <span className="min-w-0 truncate">{layer.label}</span>
            </button>)}
            {!filteredLayers.length&&<p className="p-3 text-[11px] text-faint">No se encontraron capas.</p>}
          </div>
          <div className="grid grid-cols-2 gap-1.5 border-t border-stroke p-2">
            <button className={btn} onClick={insertSection} title="Añadir nueva sección"><FilePlus2 size={13}/> Sección</button>
            <button className={btn} onClick={()=>modifyStructure('duplicate')} disabled={selected===null} title="Duplicar elemento"><Copy size={13}/> Duplicar</button>
            <button className={btn} onClick={()=>modifyStructure('up')} disabled={selected===null} title="Mover arriba"><ArrowUp size={13}/> Subir</button>
            <button className={btn} onClick={()=>modifyStructure('down')} disabled={selected===null} title="Mover abajo"><ArrowDown size={13}/> Bajar</button>
            <button className={btn+' col-span-2'} onClick={()=>modifyStructure('remove')} disabled={selected===null} title="Eliminar y poder deshacer"><Trash2 size={13}/> Eliminar elemento</button>
          </div>
        </aside>}
        <div className="flex min-w-0 flex-1 flex-col bg-app">
          {view==='preview'?<>
            <div className="flex items-center justify-center gap-2 border-b border-stroke py-2">
              <button onClick={()=>setDevice('desktop')} aria-pressed={device==='desktop'} className={btn+(device==='desktop'?' border-brand':'')}><Monitor size={14}/> Escritorio</button>
              <button onClick={()=>setDevice('mobile')} aria-pressed={device==='mobile'} className={btn+(device==='mobile'?' border-brand':'')}><Smartphone size={14}/> Móvil</button>
            </div>
            <div className="scroll-subtle flex-1 overflow-auto p-3 sm:p-6">
              <div className="mx-auto h-full min-h-[480px] overflow-hidden rounded-lg border border-stroke bg-white shadow-panel"
                style={{maxWidth:device==='mobile'?390:1280}}>
                <iframe title="Previsualización segura de la web importada" ref={previewFrame} onLoad={previewLoaded}
                  sandbox="allow-same-origin" referrerPolicy="no-referrer" srcDoc={preview?.html||''}
                  className="h-full min-h-[620px] w-full border-0 bg-white"/>
              </div>
            </div>
          </>:<>
            <div className="flex items-center justify-between border-b border-stroke px-4 py-3 text-[11px] text-mist"><span><FileCode2 size={13} className="mr-2 inline text-brand"/> {site.entry}</span><span>{site.html.length.toLocaleString('es-ES')} caracteres · HTML editado directamente</span></div>
            <textarea aria-label="Editor completo de HTML de la web"
              className="scroll-subtle min-h-0 flex-1 resize-none bg-[#10141c] p-5 font-mono text-[12px] leading-6 text-[#dae6ff] outline-none"
              spellCheck={false} value={draftHtml} onChange={e=>setDraftHtml(e.target.value)}
              onBlur={()=>{if(draftHtml!==site.html)changeHtml(draftHtml)}}/>
            <div className="flex items-center justify-end border-t border-stroke p-2">
              <button onClick={()=>{if(draftHtml!==site.html)changeHtml(draftHtml);setView('preview')}} className={primary}><Check size={14}/> Aplicar HTML y ver resultado</button>
            </div>
          </>}
        </div>
        <aside className="scroll-subtle hidden w-[278px] shrink-0 overflow-y-auto border-l border-stroke bg-panel p-4 lg:block">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-[12px] font-semibold">Inspector HTML</h2><span className="font-mono text-[9px] text-faint">DOM</span></div>
          <p className="mb-4 text-[11px] leading-5 text-mist">Haz clic en un elemento de la web para editar sus propiedades. Los cambios se reflejan en el HTML exportado.</p>
          {selected===null?<div className="rounded-lg border border-dashed border-stroke p-4 text-[11px] text-faint">Selecciona un texto, título o botón del Canvas.</div>:<>
            <div className="mb-4 rounded-lg border border-stroke bg-elevated px-3 py-2 font-mono text-[10px] text-mist">{activeLayer?.tag||'Nodo'} · #{selected}</div>
            {activeLayer?.tag==='A'&&<label className="mb-3 block text-[11px] text-mist"><span className="flex items-center gap-1.5"><Link2 size={13}/> Destino del enlace</span>
              <input className={BASE+' mt-1 w-full'} value={selectedValues.href} onChange={e=>setSelectedValues({...selectedValues,href:e.target.value})} placeholder="https://… o #seccion"/>
              <button className={btn+' mt-2'} onClick={()=>patch({href:selectedValues.href})}>Guardar enlace</button>
            </label>}
            {['IMG','A','HEADER','DIV','SECTION','FIGURE'].includes(activeLayer?.tag||'')&&<div className="mb-4 rounded-lg border border-stroke p-3">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold"><ImagePlus size={15} className="text-brand"/> {activeLayer?.tag==='IMG'?'Sustituir imagen o logo':'Adjuntar logo o imagen'}</div>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Adjuntar imagen para reemplazar la seleccionada"
                className="block w-full text-[10px] text-mist" onChange={e=>{const file=e.target.files?.[0];if(file)void changeImage(file);e.currentTarget.value='';}}/>
              <p className="my-2 text-[10px] leading-4 text-faint">PNG, JPG, GIF o WebP. Máximo 5 MB. La imagen queda dentro del ZIP.</p>
              <label className="block text-[11px] text-mist">Texto alternativo
                <input className={BASE+' mt-1 w-full'} value={selectedValues.alt} onChange={e=>setSelectedValues({...selectedValues,alt:e.target.value})}/>
              </label>
              <button className={btn+' mt-2'} onClick={()=>patch({alt:selectedValues.alt})}>Guardar descripción</button>
            </div>}
            <label className="mb-3 block text-[11px] text-mist">Contenido de texto
              <textarea className={BASE+' mt-1 min-h-[90px] w-full resize-y'} value={selectedValues.text} placeholder="Selecciona un elemento sin hijos" onChange={e=>setSelectedValues({...selectedValues,text:e.target.value})}/>
              <button className={btn+' mt-2'} onClick={()=>patch({text:selectedValues.text})}>Aplicar texto</button>
            </label>
            {(['color','background','fontSize'] as const).map(field=><label key={field} className="mb-3 block text-[11px] text-mist">
              {field==='color'?'Color · RGB / HEX':field==='background'?'Fondo · RGB / HEX':'Tamaño · CSS'}
              <input className={BASE+' mt-1 w-full font-mono'} value={selectedValues[field]} onChange={e=>setSelectedValues({...selectedValues,[field]:e.target.value})}
                onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}/>
            </label>)}
            <button className={primary+' w-full'} onClick={()=>{
              const color=parseColorCode(selectedValues.color);
              const background=parseColorCode(selectedValues.background);
              const fontSize=/^\d{1,3}(?:\.\d+)?px$/.test(selectedValues.fontSize)?selectedValues.fontSize:undefined;
              if(!color||!background||!fontSize){setNotice('Revisa los códigos HEX/RGB o tamaño CSS.');return;}
              patch({color,background,fontSize});
            }}>Aplicar estilos</button>
            <div className="mt-5 border-t border-stroke pt-4">
              <h3 className="mb-3 text-[11px] font-semibold">Dimensiones y composición</h3>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['width','Ancho'],['height','Alto'],['padding','Relleno'],
                  ['margin','Margen'],['radius','Redondeo'],['fontWeight','Grosor de fuente'],
                  ['fontFamily','Tipografía']
                ] as const).map(([field,label])=><label key={field} className="text-[10px] text-mist">
                  {label}<input className={BASE+' mt-1 w-full'} placeholder={field==='fontFamily'?'Arial, sans-serif':field==='fontWeight'?'700':'24px'}
                    value={selectedValues[field]} onChange={e=>setSelectedValues({...selectedValues,[field]:e.target.value})}/>
                </label>)}
                <label className="text-[10px] text-mist">Alineación
                  <select className={BASE+' mt-1 w-full'} value={selectedValues.textAlign}
                    onChange={e=>setSelectedValues({...selectedValues,textAlign:e.target.value})}>
                    <option value="">Heredada</option>
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
                    <option value="right">Derecha</option>
                    <option value="justify">Justificada</option>
                  </select>
                </label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {([['posX','Posición X'],['posY','Posición Y']] as const).map(([key,label])=><label key={key} className="text-[10px] text-mist">{label}
                  <input type="number" min={-1200} max={1200} step={1} className={BASE+' mt-1 w-full'}
                    value={selectedValues[key]} onChange={e=>setSelectedValues({...selectedValues,[key]:e.target.value})}/>
                </label>)}
              </div>
              <button className={btn+' mt-2 w-full'} onClick={()=>patch({moveX:Number(selectedValues.posX),moveY:Number(selectedValues.posY)})}>Aplicar posición</button>
              <p className="mt-2 text-[10px] leading-4 text-faint">Medidas en px, o porcentaje para ancho y alto. Vacío restablece el valor heredado.</p>
              <button className={primary+' mt-3 w-full'} onClick={()=>patch({
                width:selectedValues.width,height:selectedValues.height,padding:selectedValues.padding,
                margin:selectedValues.margin,radius:selectedValues.radius,fontWeight:selectedValues.fontWeight,
                fontFamily:selectedValues.fontFamily,textAlign:selectedValues.textAlign
              })}>Aplicar medidas y tipografía</button>
            </div>
          </>}
          <div className="mt-7 border-t border-stroke pt-4 text-[10px] leading-5 text-faint">Vista de edición protegida: el JavaScript importado no se ejecuta dentro del editor. Los archivos originales se conservan para exportación.</div>
        </aside>
      </div>
    </main>}
    {site&&stage==='agent'&&<main className="scroll-subtle mx-auto w-full max-w-[790px] flex-1 overflow-y-auto px-6 py-10">
      <AgentSetup site={site} onBack={()=>setStage('editor')} onSkip={()=>setStage('export')} onLinked={agent=>void handleAgentLinked(agent)}/>
    </main>}
    {site&&stage==='export'&&<main className="scroll-subtle mx-auto w-full max-w-[730px] flex-1 overflow-y-auto px-6 py-10">
      <button onClick={()=>setStage('agent')} className={btn+' mb-7'}><ArrowLeft size={14}/> Volver al agente</button>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-brand">04 / ENTREGA</div>
      <h1 className="text-[30px] font-bold tracking-[-.04em]">Tu web, lista para llevar.</h1>
      <p className="mt-3 text-[13px] leading-6 text-mist">Descarga el HTML o el ZIP con la web real y sus recursos. {site.agent?'El asistente está vinculado y se incluye automáticamente.':'Puedes asociar un agente en cualquier momento.'}</p>
      {site.agent&&<div className="mt-5 rounded-xl border border-brand/30 bg-brandsoft p-4 text-[12px] leading-6 text-ink"><Bot size={16} className="mr-2 inline text-brand"/>Agente: <strong>{site.agent.title}</strong><div className="text-[10px] text-mist">Dominio autorizado: {site.agent.origin}</div></div>}
      <div className="mt-7 flex flex-col gap-3">
        <button onClick={exportZip} className={primary+' w-full justify-start py-4 text-[13px]'}><FileArchive size={19}/> Descargar {site.agent?'web + agente':'proyecto ZIP completo'}</button>
        <button onClick={exportHtml} className={btn+' w-full justify-start py-4 text-[13px]'}><FileCode2 size={19}/> Descargar HTML {site.agent?'con widget':'actualizado'}</button>
        <button onClick={()=>setStage('editor')} className={btn+' w-full justify-start py-4'}><Paintbrush size={17}/> Seguir editando</button>
      </div>
      <div className="mt-6 rounded-xl border border-stroke bg-elevated p-4 text-[11px] leading-5 text-mist">Los agentes necesitan un backend activo y deben publicarse en el dominio HTTPS autorizado. Si la web importada incluye scripts, revisa su procedencia antes de publicarlos.</div>
    </main>}
    {postSavePrompt&&stage==='editor'&&<div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setPostSavePrompt(false)}}>
      <div role="dialog" aria-modal="true" aria-labelledby="wayup-link-agent-question" className="w-full max-w-[470px] rounded-2xl border border-stroke bg-panel p-7 shadow-panel">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brandsoft text-brand"><Bot size={25}/></div>
        <h2 id="wayup-link-agent-question" className="text-[22px] font-semibold tracking-tight">¡Web guardada! ¿Le añadimos un agente IA?</h2>
        <p className="mt-3 text-[12px] leading-6 text-mist">Usaremos los contenidos de esta web para proponerte un rol, objetivo y capacidades. Podrás revisarlo todo antes de crear y publicar el agente.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className={primary} onClick={()=>{setPostSavePrompt(false);setStage('agent')}}><Bot size={15}/> Sí, configurar agente</button>
          <button className={btn} onClick={()=>{setPostSavePrompt(false);setStage('export')}}>No, exportar web</button>
          <button className={btn} onClick={()=>setPostSavePrompt(false)}>Seguir editando</button>
        </div>
      </div>
    </div>}
  </div>;
}
