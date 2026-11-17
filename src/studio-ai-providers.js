/* WAY UP Studio · Proveedores de IA externos (Gemini, Groq, OpenRouter).
   Los modelos se configuran en variables del Worker (sin adivinar nombres en el código):
     GEMINI_MODEL, GROQ_MODEL, OPENROUTER_MODEL   → modelos por proveedor
     STUDIO_WEB_PROVIDERS, STUDIO_AGENT_PROVIDERS  → orden de preferencia por uso, p. ej. "gemini,openrouter"
   Las claves son secretos: GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY. Nunca se devuelven ni se registran. */

export class ProviderError extends Error{
  constructor(provider,status,message){super(message);this.provider=provider;this.status=status;this.code=status===429?'provider_limit':'provider';}
}
const TIMEOUT_MS=150000;
const clip=(v,n=300)=>String(v||'').replace(/\s+/g,' ').trim().slice(0,n);
// Los mensajes de error de los proveedores pueden repetir la clave en la URL: se enmascara cualquier cosa que lo parezca.
const scrub=v=>clip(v,400).replace(/(key=|Bearer\s+)[A-Za-z0-9._-]+/gi,'$1•••').replace(/\b(AIza|gsk_|sk-or-)[A-Za-z0-9._-]{8,}/g,'$1•••');

export const PROVIDERS={
  gemini:{label:'Google Gemini',secret:'GEMINI_API_KEY',modelVar:'GEMINI_MODEL'},
  groq:{label:'Groq',secret:'GROQ_API_KEY',modelVar:'GROQ_MODEL'},
  openrouter:{label:'OpenRouter',secret:'OPENROUTER_API_KEY',modelVar:'OPENROUTER_MODEL'}
};
export const providerModel=(env,name)=>clip(env?.[PROVIDERS[name]?.modelVar],120);
export const providerReady=(env,name)=>Boolean(PROVIDERS[name]&&env?.[PROVIDERS[name].secret]&&providerModel(env,name));
/** Proveedores externos listos para un uso («web» o «agent»), en el orden configurado. Devuelve referencias «proveedor:modelo». */
export function externalModels(env,use){
  const list=String((use==='agent'?env?.STUDIO_AGENT_PROVIDERS:env?.STUDIO_WEB_PROVIDERS)||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  return [...new Set(list)].filter(n=>providerReady(env,n)).map(n=>n+':'+providerModel(env,n));
}
export const isExternal=ref=>/^(gemini|groq|openrouter):/.test(String(ref||''));

async function timedFetch(url,init,ms=TIMEOUT_MS){
  const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),ms);
  try{return await fetch(url,{...init,signal:ctl.signal});}
  catch(e){throw new ProviderError('red',0,e?.name==='AbortError'?'Tiempo de espera agotado':'Error de red: '+clip(e?.message,120));}
  finally{clearTimeout(t);}
}
async function failure(name,res){
  let detail='';try{const j=await res.json();detail=j?.error?.message||j?.error?.status||j?.message||JSON.stringify(j).slice(0,200);}catch{try{detail=await res.text();}catch{}}
  return new ProviderError(name,res.status,PROVIDERS[name].label+' respondió '+res.status+(detail?': '+scrub(detail):''));
}

/** Llamada de chat a un proveedor externo. messages: [{role:'system'|'user'|'assistant',content:string}]. Devuelve {text,finish}. */
export async function callExternal(env,ref,messages,{maxTokens=8000,temperature=0.6,timeoutMs=TIMEOUT_MS}={}){
  const i=String(ref).indexOf(':');const name=ref.slice(0,i),model=ref.slice(i+1);
  const p=PROVIDERS[name];const key=p&&env?.[p.secret];
  if(!p||!key||!model)throw new ProviderError(name,0,(p?.label||name)+' no está configurado');
  if(name==='gemini'){
    const system=messages.filter(m=>m.role==='system').map(m=>m.content).join('\n\n');
    const contents=messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:String(m.content)}]}));
    const res=await timedFetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
      method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({...(system?{systemInstruction:{parts:[{text:system}]}}:{}),contents,generationConfig:{maxOutputTokens:maxTokens,temperature}})},timeoutMs);
    if(!res.ok)throw await failure(name,res);
    const j=await res.json();
    const cand=j?.candidates?.[0];
    const text=(cand?.content?.parts||[]).filter(x=>!x?.thought).map(x=>x?.text||'').join('');
    if(!text)throw new ProviderError(name,200,'Gemini no devolvió texto'+(j?.promptFeedback?.blockReason?' (bloqueado: '+j.promptFeedback.blockReason+')':cand?.finishReason?' ('+cand.finishReason+')':''));
    return {text,finish:cand?.finishReason==='MAX_TOKENS'?'length':String(cand?.finishReason||'')};
  }
  const url=name==='groq'?'https://api.groq.com/openai/v1/chat/completions':'https://openrouter.ai/api/v1/chat/completions';
  const headers={'Content-Type':'application/json',Authorization:'Bearer '+key};
  if(name==='openrouter')headers['X-Title']='WayUp Studio';
  const res=await timedFetch(url,{method:'POST',headers,body:JSON.stringify({model,messages,max_tokens:maxTokens,temperature})},timeoutMs);
  if(!res.ok)throw await failure(name,res);
  const j=await res.json();
  const text=String(j?.choices?.[0]?.message?.content||'');
  if(!text)throw new ProviderError(name,200,PROVIDERS[name].label+' no devolvió texto');
  return {text,finish:String(j?.choices?.[0]?.finish_reason||'')};
}

/** Modelos que ofrece cada proveedor con tu clave (para saber el nombre exacto). filter: texto a buscar. */
export async function listModels(env,name,filter=''){
  const p=PROVIDERS[name];const key=p&&env?.[p.secret];
  if(!key)return {ok:false,error:'Falta el secreto '+p.secret,models:[]};
  try{
    let res,ids=[];
    if(name==='gemini'){
      res=await timedFetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',{headers:{'x-goog-api-key':key}},20000);
      if(!res.ok)throw await failure(name,res);
      ids=((await res.json())?.models||[]).filter(m=>(m?.supportedGenerationMethods||[]).includes('generateContent')).map(m=>String(m.name||'').replace(/^models\//,''));
    }else{
      res=await timedFetch(name==='groq'?'https://api.groq.com/openai/v1/models':'https://openrouter.ai/api/v1/models',{headers:{Authorization:'Bearer '+key}},20000);
      if(!res.ok)throw await failure(name,res);
      ids=((await res.json())?.data||[]).map(m=>String(m?.id||''));
    }
    const f=String(filter||'').toLowerCase();
    return {ok:true,models:ids.filter(Boolean).filter(id=>!f||id.toLowerCase().includes(f)).sort().slice(0,80)};
  }catch(e){return {ok:false,error:scrub(e?.message||e),models:[]};}
}

/** Prueba rápida de varios modelos a la vez («proveedor:modelo», máx. 8): responde, tiempo y error exacto.
 *  Pide algo de criterio (no solo «OK») para comparar también la calidad de la respuesta. */
export async function probeModels(env,refs){
  const list=[...new Set(String(refs||'').split(',').map(s=>s.trim()).filter(r=>/^(gemini|groq|openrouter):[\w./:-]{2,120}$/.test(r)))].slice(0,8);
  const out={};
  await Promise.all(list.map(async ref=>{
    const t0=Date.now();
    try{
      const x=await callExternal(env,ref,[{role:'user',content:'En una sola frase de máximo 25 palabras, escribe un titular publicitario original para un gimnasio de entrenamiento personal en Valladolid.'}],{maxTokens:400,temperature:0.7,timeoutMs:45000});
      out[ref]={ok:true,ms:Date.now()-t0,respuesta:clip(x.text,220)};
    }catch(e){out[ref]={ok:false,ms:Date.now()-t0,estado:e?.status??null,error:scrub(e?.message||e)};}
  }));
  return out;
}
/** Diagnóstico de los tres proveedores: configuración, modelos disponibles y una llamada mínima real. */
export async function diagnoseProviders(env,filters={}){
  const out={};
  // Los tres proveedores se comprueban a la vez para que la página responda rápido.
  await Promise.all(Object.keys(PROVIDERS).map(async name=>{
    const p=PROVIDERS[name];const model=providerModel(env,name);
    const r={proveedor:p.label,secreto:env?.[p.secret]?'presente':'FALTA ('+p.secret+')',modelo:model||'sin configurar ('+p.modelVar+')'};
    const listed=await listModels(env,name,filters[name]||'');
    r.modelos_disponibles=listed.ok?listed.models:[];
    if(!listed.ok)r.error_lista=listed.error;
    if(model&&env?.[p.secret]){
      const t0=Date.now();
      try{const x=await callExternal(env,name+':'+model,[{role:'user',content:'Responde solo con la palabra: OK'}],{maxTokens:200,temperature:0,timeoutMs:40000});
        r.prueba={ok:true,ms:Date.now()-t0,respuesta:clip(x.text,40)};}
      catch(e){r.prueba={ok:false,ms:Date.now()-t0,estado:e?.status??null,error:scrub(e?.message||e)};}
      if(listed.ok&&listed.models.length&&!filters[name]&&!listed.models.includes(model))r.aviso='El modelo configurado no aparece en la lista del proveedor: revisa el nombre.';
    }
    out[name]=r;
  }));
  out.uso={webs:externalModels(env,'web'),agentes:externalModels(env,'agent'),
    nota:'Orden configurado en STUDIO_WEB_PROVIDERS y STUDIO_AGENT_PROVIDERS. Si un proveedor falla, se pasa al siguiente y por último a Workers AI.'};
  return out;
}
