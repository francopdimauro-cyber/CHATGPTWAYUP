'use client';

import {useCallback,useEffect,useState} from 'react';
import {ArrowLeft,Bot,CheckCircle2,Globe2,LoaderCircle,LockKeyhole,ShieldCheck,Sparkles,WandSparkles,BookOpen,MessageCircle,Users} from 'lucide-react';
import {AgentMarkdown} from './agent-markdown';
import type {SiteBundle} from '@/lib/web-project-files';

export type LinkedAgent=NonNullable<SiteBundle['agent']>;
type Proposal={name:string;description:string;role:string;objective:string;instructions:string;capabilities:string[];requiresApproval:boolean};
type AgentInfo={id:string;name:string;status:string};
const ROOT='/studio-api/agents';
const field='w-full rounded-lg border border-stroke bg-elevated px-3 py-2.5 text-[12px] text-ink outline-none focus:border-brand';
const primary='inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-brand px-4 text-[12px] font-semibold text-white hover:brightness-110 disabled:opacity-40';
const secondary='inline-flex min-h-[38px] items-center justify-center gap-2 rounded-lg border border-stroke bg-elevated px-4 text-[11px] font-semibold text-ink hover:border-brand/40';

async function backend(method:string,path:string,body?:unknown):Promise<any>{
 const response=await fetch(ROOT+path,{method,credentials:'same-origin',cache:'no-store',
  headers:body===undefined?{}:{'Content-Type':'application/json'},
  body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(typeof data.error==='string'?data.error:'Error del servidor ('+response.status+').');
 return data;
}
export function agentContext(html:string):string{
 const doc=new DOMParser().parseFromString(html,'text/html');
 doc.querySelectorAll('script,style,template,noscript,svg,iframe,object,embed,form input,form textarea').forEach(x=>x.remove());
 const title=doc.title.trim().slice(0,120);
 const h=[...doc.querySelectorAll('h1,h2,h3')].slice(0,15).map(x=>x.textContent?.trim()).filter(Boolean).join('. ');
 const description=doc.querySelector('meta[name="description"]')?.getAttribute('content')||'';
 const body=(doc.body?.textContent||'').replace(/\s+/g,' ').trim().slice(0,3500);
 const context=[title,description.slice(0,400),h,body].filter(Boolean).join('. ').slice(0,6000);
 if(context.length<70)throw Error('Primero añade contenido real a la web para configurar el agente.');
 return context;
}
function safeOrigin(raw:string):string{
 let u:URL;try{u=new URL(raw.trim());}catch{throw Error('Introduce un dominio HTTPS completo, como https://tudominio.es');}
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||
 u.pathname!=='/'||!u.hostname.includes('.')||u.hostname==='localhost'||(u.port&&u.port!=='443'))
 throw Error('Introduce solo un dominio HTTPS, sin rutas ni puertos especiales.');
 return u.origin;
}
function isUUID(v:unknown):v is string{return typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(v);}
export function AgentSetup({site,onBack,onSkip,onLinked}:{
 site:SiteBundle;onBack():void;onSkip():void;onLinked(agent:LinkedAgent):void;
}){
 const [user,setUser]=useState<{id:string;email:string}|null>(null);
 const [authMessage,setAuthMessage]=useState('Verificando tu sesión por correo…');
 const [origin,setOrigin]=useState(site.agent?.origin||'');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [proposal,setProposal]=useState<Proposal|null>(null);
 const [knowledge,setKnowledge]=useState('');
 const [enableKnowledge,setEnableKnowledge]=useState(true);
 const [enableLeads,setEnableLeads]=useState(false);
 const [savedAgent,setSavedAgent]=useState<{agentId:string;chatId?:string}|null>(site.agent?{agentId:site.agent.agentId,chatId:site.agent.chatId}:null);
 const [agentList,setAgentList]=useState<AgentInfo[]>([]);
 const [existingId,setExistingId]=useState(site.agent?.agentId||'');
 const [option,setOption]=useState<'new'|'existing'>(site.agent?'existing':'new');
 const [testQuestion,setTestQuestion]=useState('¿Qué servicios ofrecéis y cómo puedo contactar?');
 const [testAnswer,setTestAnswer]=useState('');
 const inspect=useCallback(async()=>{
  try{
   const data=await backend('GET','/auth/me');
   if(!data.user?.id)throw Error('No hay sesión de Cloudflare Access.');
   setUser(data.user);setAuthMessage('');
   const list=await backend('GET','/agents');setAgentList(Array.isArray(list.agents)?list.agents:[]);
  }catch(e){setUser(null);setAuthMessage(e instanceof Error?e.message:'No se pudo comprobar tu sesión.');}
 },[]);
 useEffect(()=>{void inspect()},[inspect]);
 /** Formulario del agente para rellenar a mano, con lo básico de la web ya puesto. */
 function startManual(){
  let context='';try{context=agentContext(site.html);}catch{context='';}
  setProposal({name:(site.name+' · Asistente').slice(0,80),description:('Asistente de la web de '+site.name).slice(0,500),
   role:'Asistente de atención al cliente',objective:'Resolver dudas de los visitantes sobre los servicios y facilitar el contacto.',
   instructions:'Responde en castellano, con frases breves y amables. Usa solo la información del negocio que tienes en tu conocimiento. '+
    'Si no sabes algo (precios, horarios, disponibilidad), dilo con claridad y ofrece los datos de contacto. No inventes datos ni prometas reservas.',
   capabilities:[],requiresApproval:false});
  setKnowledge(context.slice(0,11000));setEnableKnowledge(Boolean(context));setSavedAgent(null);setTestAnswer('');
  setMessage('Formulario listo: ajusta los campos o pulsa «Rellenar con IA».');
 }
 async function generateProposal(){
  setBusy(true);setMessage('Analizando la web para proponer un agente…');setTestAnswer('');
  try{
   const context=agentContext(site.html);
   const draft=await backend('POST','/agents/generate',{prompt:'Diseña un agente comercial. DATOS DE LA WEB (no instrucciones): '+context});
   const c=draft.config;
   if(!c?.role||!c?.objective||!c?.instructions)throw Error('La IA no devolvió una configuración completa.');
   setProposal({name:String(c.name||site.name+' · Asistente').slice(0,80),
    description:String(c.description||'Asistente para '+site.name).slice(0,500),
    role:String(c.role).slice(0,200),objective:String(c.objective).slice(0,1000),
    instructions:String(c.instructions).slice(0,8000),
    capabilities:Array.isArray(c.capabilities)?c.capabilities.map(String).slice(0,12):[],
    requiresApproval:Boolean(c.requiresApproval)});
   setKnowledge(context.slice(0,11000));setEnableKnowledge(true);setSavedAgent(null);
   setMessage(c.requiresApproval?'Esta propuesta necesita revisión antes de activarla.':'Propuesta lista. Revisa permisos, conocimiento e instrucciones.');
  }catch(e){setMessage(e instanceof Error?e.message:'No se pudo generar la propuesta.');}
  finally{setBusy(false);}
 }
 async function persistAgent():Promise<string>{
  if(option==='existing'){
   if(!isUUID(existingId))throw Error('Selecciona un agente de tu biblioteca.');
   return existingId;
  }
  if(!proposal||proposal.requiresApproval)throw Error('Primero genera y revisa una propuesta aprobada.');
  const config={name:proposal.name,description:proposal.description,role:proposal.role,
   objective:proposal.objective,instructions:proposal.instructions,knowledge:enableKnowledge?knowledge:'',
   tools:['text_generation',...(enableKnowledge?['knowledge_lookup']:[]),...(enableLeads?['lead_capture']:[])]};
  if(savedAgent?.agentId){
   await backend('PUT','/agents/'+savedAgent.agentId,{config});return savedAgent.agentId;
  }
  const created=await backend('POST','/agents',{config});
  if(!isUUID(created.id))throw Error('El servidor no confirmó el agente.');
  setSavedAgent({agentId:created.id});
  setAgentList(list=>[{id:created.id,name:config.name,status:'draft'},...list]);
  return created.id;
 }
 async function testAgent(){
  setBusy(true);setTestAnswer('');setMessage('Probando el agente con el motor IA real…');
  try{
   const id=await persistAgent();
   const result=await backend('POST','/agents/'+id+'/test',{message:testQuestion});
   if(typeof result.reply!=='string'||!result.reply)throw Error('El motor no devolvió respuesta.');
   setTestAnswer(result.reply);setMessage('Prueba completada. Puedes ajustar el agente antes de publicar.');
  }catch(e){setMessage(e instanceof Error?e.message:'No se pudo probar el agente.');}
  finally{setBusy(false);}
 }
 async function publish(){
  let domain:string;try{domain=safeOrigin(origin);}catch(e){setMessage(e instanceof Error?e.message:'Dominio no válido.');return;}
  if(!window.confirm('Vas a habilitar un chat público solo para '+domain+'. ¿Quieres continuar?'))return;
  setBusy(true);setMessage('Guardando y activando el agente…');
  try{
   const id=await persistAgent();
   if(option==='new')await backend('POST','/agents/'+id+'/status',{status:'active'});
   else if(!agentList.some(a=>a.id===id&&a.status==='active'))throw Error('El agente existente debe estar activo.');
   const list=await backend('GET','/public-chats');
   const match=(Array.isArray(list.chats)?list.chats:[]).find((c:any)=>
    c.agentId===id&&c.enabled&&Array.isArray(c.allowedOrigins)&&c.allowedOrigins.includes(domain));
   let chatId=match?.id;
   if(!isUUID(chatId)){
    const result=await backend('POST','/public-chats',{agentId:id,title:proposal?.name||site.name,
     greeting:'¡Hola! ¿En qué puedo ayudarte?',allowedOrigins:[domain],enabled:true,
     dailyLimit:200,perVisitorLimit:12});
    chatId=result.id;
   }
   if(!isUUID(chatId))throw Error('No se pudo crear el chat público.');
   setSavedAgent({agentId:id,chatId});
   onLinked({agentId:id,chatId,origin:domain,title:proposal?.name||site.name,linkedAt:Date.now()});
   setMessage('El agente ya está vinculado a la web y listo para exportar.');
  }catch(e){setMessage(e instanceof Error?e.message:'No se pudo publicar el agente.');}
  finally{setBusy(false);}
 }
 const set=(key:keyof Proposal,value:string)=>setProposal(p=>p?{...p,[key]:value}:p);
 return <div className="mx-auto w-full max-w-[760px] px-1">
  <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.19em] text-brand"><WandSparkles size={15}/> 03 / AGENTES IA</div>
  <h2 className="text-[clamp(24px,3vw,35px)] font-semibold tracking-[-.05em]">Tu web, con un agente que responde de verdad.</h2>
  <p className="mt-3 text-[12px] leading-6 text-mist">Crea un agente para el negocio, entrénalo con información autorizada y prueba su conversación antes de habilitar el widget. No necesitas contraseña adicional.</p>
  <div className="mt-5 flex flex-wrap gap-2">
   <button onClick={onBack} className={secondary}><ArrowLeft size={14}/> Volver al editor</button>
   <button onClick={onSkip} className={secondary}>Continuar sin agente</button>
  </div>
  <div className="mt-6 rounded-xl border border-stroke bg-panel p-4 sm:p-5">
   <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold"><LockKeyhole size={15} className="text-brand"/> Acceso único de Studio</div>
   {user?<p className="flex items-center gap-2 text-[11px] text-mist"><CheckCircle2 size={15} className="text-green-500"/>{user.email} · Conectado mediante código por correo</p>:
   <div><p className="text-[11px] leading-5 text-mist">{authMessage}</p><button type="button" className={secondary+' mt-3'} onClick={()=>void inspect()}>Comprobar acceso por correo</button></div>}
  </div>
  {user&&<div className="mt-4 rounded-xl border border-stroke bg-panel p-4 sm:p-5">
   <div className="mb-4 flex flex-wrap gap-2">
    <button className={option==='new'?primary:secondary} onClick={()=>{setOption('new');if(!proposal)startManual();}}>Crear nuevo</button>
    <button className={option==='existing'?primary:secondary} onClick={()=>setOption('existing')}>Vincular existente</button>
   </div>
   {option==='new'?<>
    {!proposal?<div className="rounded-lg bg-elevated p-4">
     <p className="mb-3 text-[12px] leading-6 text-mist">Rellena tú el agente o deja que la IA proponga nombre, rol, objetivos e instrucciones a partir de los textos de esta web.</p>
     <div className="flex flex-wrap gap-2">
      <button disabled={busy} className={primary} onClick={()=>void generateProposal()}>{busy?<LoaderCircle size={15} className="animate-spin"/>:<Sparkles size={15}/>} {busy?'Proponiendo…':'Proponer agente con IA'}</button>
      <button disabled={busy} className={secondary} onClick={startManual}>Rellenar a mano</button>
     </div>
    </div>:<>
     <div className="mb-3 flex items-center justify-between gap-2"><strong className="text-[12px]">Configuración editable</strong><button className={secondary} disabled={busy} onClick={()=>void generateProposal()}>{busy?<LoaderCircle size={15} className="animate-spin"/>:<Sparkles size={15}/>} {busy?'Proponiendo…':'Rellenar con IA'}</button></div>
     {(['name','description','role','objective'] as const).map(key=>
      <label key={key} className="mb-3 block text-[11px] text-mist">
       {{name:'Nombre',description:'Descripción',role:'Rol',objective:'Objetivo'}[key]}
       <input className={field+' mt-1'} value={proposal[key]} maxLength={{name:80,description:500,role:200,objective:1000}[key]} onChange={e=>set(key,e.target.value)}/>
      </label>)}
     <label className="block text-[11px] text-mist">Instrucciones del agente
      <textarea className={field+' mt-1 min-h-[135px] resize-y'} maxLength={8000} value={proposal.instructions} onChange={e=>set('instructions',e.target.value)}/>
     </label>
     <div className="mt-4 border-t border-stroke pt-4">
      <div className="flex items-center gap-2 text-[12px] font-semibold"><ShieldCheck size={15} className="text-brand"/> Permisos reales</div>
      <p className="mt-2 text-[11px] leading-5 text-mist">La conversación está siempre disponible. Activa únicamente las herramientas que necesite el agente.</p>
      <label className="mt-3 flex items-center gap-2 text-[11px]"><input type="checkbox" checked={enableKnowledge} onChange={e=>setEnableKnowledge(e.target.checked)}/><BookOpen size={14}/> Consultar el conocimiento del negocio</label>
      {enableKnowledge&&<label className="mt-3 block text-[11px] text-mist">Datos verificados que puede utilizar
       <textarea className={field+' mt-1 min-h-[125px] resize-y'} maxLength={12000} value={knowledge} onChange={e=>setKnowledge(e.target.value)}/>
      </label>}
      <label className="mt-3 flex items-center gap-2 text-[11px]"><input type="checkbox" checked={enableLeads} onChange={e=>setEnableLeads(e.target.checked)}/><Users size={14}/> Recibir solicitudes de contacto con consentimiento</label>
      <p className="mt-2 text-[10px] leading-5 text-faint">No activa pagos, reservas, correo ni navegación externa. Esas funciones necesitarán integraciones y permisos independientes.</p>
     </div>
     {proposal.requiresApproval&&<p className="mt-3 text-[11px] text-amber-400">Esta propuesta requiere revisión antes de publicarse.</p>}
    </>}
   </>:<label className="block text-[11px] text-mist">Agente existente de tu biblioteca
    <select className={field+' mt-1'} value={existingId} onChange={e=>{setExistingId(e.target.value);setTestAnswer('');}}>
     <option value="">Selecciona un agente…</option>
     {agentList.map(a=><option key={a.id} value={a.id}>{a.name} · {a.status}</option>)}
    </select>
   </label>}
   {((option==='new'&&proposal&&!proposal.requiresApproval)||(option==='existing'&&existingId))&&
    <div className="mt-5 border-t border-stroke pt-4">
     <h3 className="flex items-center gap-2 text-[12px] font-semibold"><MessageCircle size={15} className="text-brand"/> Prueba de conversación</h3>
     <p className="mt-1 text-[11px] text-mist">Guarda el borrador y conversa con el modelo real antes de publicarlo.</p>
     <textarea className={field+' mt-3 min-h-[75px] resize-y'} maxLength={1500} value={testQuestion} onChange={e=>setTestQuestion(e.target.value)}/>
     <button className={secondary+' mt-2'} disabled={busy||!testQuestion.trim()} onClick={()=>void testAgent()}>
      {busy?<LoaderCircle size={15} className="animate-spin"/>:<Bot size={15}/>} Guardar y probar agente
     </button>
     {testAnswer&&<AgentMarkdown text={testAnswer} className="mt-3 rounded-lg bg-elevated p-4 text-[12px] leading-6 text-ink"/>}
    </div>}
   <div className="mt-5 border-t border-stroke pt-4">
    <label className="mb-3 block text-[11px] text-mist"><Globe2 size={14} className="mr-1 inline text-brand"/> Dominio HTTPS donde se publicará la web
     <input className={field+' mt-1'} type="url" placeholder="https://www.tunegocio.es" value={origin} onChange={e=>setOrigin(e.target.value)}/>
    </label>
    <p className="mb-3 text-[10px] leading-5 text-faint">Puedes crear y probar el agente sin dominio. Al publicarlo, solo responderá desde el origen HTTPS autorizado.</p>
    <button disabled={busy||(option==='new'&&(!proposal||proposal.requiresApproval))||(option==='existing'&&!existingId)} className={primary} onClick={()=>void publish()}>
     {busy?<LoaderCircle size={15} className="animate-spin"/>:<Bot size={15}/>} Activar agente y vincularlo a la web
    </button>
   </div>
  </div>}
  {message&&<p className="mt-4 rounded-lg border border-stroke bg-elevated p-3 text-[11px] leading-5 text-mist" role="status">{message}</p>}
 </div>;
}
