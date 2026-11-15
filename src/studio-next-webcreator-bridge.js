/*
 * WAY UP Studio ↔ WebCreator (preview)
 * Rutas exactas + identidad validada contra Agent Builder mediante binding privado.
 * Nunca permite que la API key ni cookies del proveedor salgan al navegador.
 * WebCreator debe autorizar expresamente la llamada: ctx.access NO se propaga.
 */
const STUDIO_WEB_PREFIX='/studio-api/webcreator';
const STUDIO_WEB_UPSTREAM='https://wayup-webcreator.francopdimauro.workers.dev';
const STUDIO_WEB_AGENT_IDENTITY='https://agent-factory-free.francopdimauro.workers.dev/api/auth/me';
const STUDIO_WEB_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function studioWebJson(value,status=200){
  return new Response(JSON.stringify(value),{status,headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
    'Cross-Origin-Resource-Policy':'same-origin'
  }});
}
async function studioWebIdentity(request,env){
  if(!env?.AGENT_BUILDER?.fetch)return false;
  const session=request.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('af_session='));
  if(!session)return false;
  try{
    const headers=new Headers({'Accept':'application/json','Cookie':session});
    const ip=request.headers.get('CF-Connecting-IP');
    if(ip)headers.set('CF-Connecting-IP',ip);
    const response=await env.AGENT_BUILDER.fetch(new Request(STUDIO_WEB_AGENT_IDENTITY,{
      method:'GET',headers,redirect:'manual'
    }));
    if(!response.ok)return false;
    const data=await response.json();
    return typeof data?.user?.id==='string'&&STUDIO_WEB_UUID.test(data.user.id);
  }catch{return false;}
}
async function studioWebProbe(env){
  if(!env?.WEB_CREATOR?.fetch)return {configured:false,authorized:false,reason:'El servicio WebCreator no está enlazado.'};
  try{
    const res=await env.WEB_CREATOR.fetch(new Request(STUDIO_WEB_UPSTREAM+'/api/health',{
      method:'GET',headers:{Accept:'application/json'},redirect:'manual'
    }));
    if(res.status===401||res.status===403)
      return {configured:true,authorized:false,reason:'WebCreator exige autorización Cloudflare Access adicional. La conexión privada no hereda esa identidad.'};
    if(!res.ok)return {configured:true,authorized:false,reason:'WebCreator no está preparado (HTTP '+res.status+').' };
    const data=await res.json().catch(()=>null);
    if(!data||data.status!=='ok'||data.configured!==true)
      return {configured:true,authorized:false,reason:'WebCreator no confirmó el proveedor IA.'};
    return {configured:true,authorized:true,provider:data.provider||'OpenRouter',quotaEnabled:data.quotaEnabled===true};
  }catch{return {configured:true,authorized:false,reason:'No se pudo conectar con WebCreator.'};}
}
export async function wayupStudioWebCreatorBridge(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(!path.startsWith(STUDIO_WEB_PREFIX+'/'))return null;
  const route=path.slice(STUDIO_WEB_PREFIX.length);
  if(!((route==='/status'&&request.method==='GET')||(route==='/generate-stream'&&request.method==='POST')))
    return studioWebJson({error:'Ruta WebCreator no permitida.'},405);
  if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)
    return studioWebJson({error:'Origen no autorizado.'},403);
  if(!(await studioWebIdentity(request,env)))
    return route==='/status'?studioWebJson({configured:Boolean(env?.WEB_CREATOR?.fetch),authorized:false,reason:'Inicia sesión para generar webs.'}):
      studioWebJson({error:'Inicia sesión en Studio para utilizar WebCreator.'},401);
  const availability=await studioWebProbe(env);
  if(route==='/status')return studioWebJson(availability);
  if(!availability.authorized)return studioWebJson({error:availability.reason||'WebCreator no está autorizado.'},503);
  if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
    return studioWebJson({error:'Envía un JSON válido.'},415);
  const declared=Number(request.headers.get('content-length')||0);
  if(declared>16000)return studioWebJson({error:'Solicitud demasiado grande.'},413);
  let raw;
  try{raw=await request.text();}catch{return studioWebJson({error:'No se pudo leer el mensaje.'},400)}
  if(raw.length>16000)return studioWebJson({error:'Solicitud demasiado grande.'},413);
  let data;
  try{data=JSON.parse(raw)}catch{return studioWebJson({error:'JSON no válido.'},400)}
  const briefing=data?.briefing;
  if(typeof briefing!=='string'||briefing.trim().length<50||briefing.length>15000)
    return studioWebJson({error:'El briefing debe tener entre 50 y 15.000 caracteres.'},400);
  try{
    const upstream=await env.WEB_CREATOR.fetch(new Request(STUDIO_WEB_UPSTREAM+'/api/generate-stream',{
      method:'POST',redirect:'manual',
      headers:{'Content-Type':'application/json','Accept':'text/event-stream','Origin':STUDIO_WEB_UPSTREAM},
      body:JSON.stringify({briefing:briefing.trim()})
    }));
    if(upstream.status===401||upstream.status===403)
      return studioWebJson({error:'WebCreator rechazó la autenticación interna. No se ha iniciado la generación.'},503);
    if(!upstream.ok){
      const detail=await upstream.json().catch(()=>({}));
      return studioWebJson({error:typeof detail.error==='string'?detail.error.slice(0,300):'Fallo de WebCreator.'},upstream.status===429?429:502);
    }
    if(!(upstream.headers.get('content-type')||'').toLowerCase().includes('text/event-stream'))
      return studioWebJson({error:'WebCreator no devolvió eventos de generación.'},502);
    return new Response(upstream.body,{status:200,headers:{
      'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store, no-transform',
      'X-Content-Type-Options':'nosniff','X-Accel-Buffering':'no','Cross-Origin-Resource-Policy':'same-origin'
    }});
  }catch{return studioWebJson({error:'No se pudo establecer el flujo de WebCreator.'},502);}
}
