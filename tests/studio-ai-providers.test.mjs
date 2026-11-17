import test from 'node:test';
import assert from 'node:assert/strict';
import {callExternal,externalModels,diagnoseProviders,listModels,modelsFor} from '../src/studio-ai-providers.js';
import {wayupStudioWebCreatorBridge} from '../src/studio-next-webcreator-bridge.js';

const KEYS={GEMINI_API_KEY:'AIzaFAKEKEY1234567890',GROQ_API_KEY:'gsk_FAKEKEY1234567890',OPENROUTER_API_KEY:'sk-or-FAKEKEY1234567890'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
function withFetch(handler,fn){
  const original=globalThis.fetch;const calls=[];
  globalThis.fetch=async(url,init={})=>{calls.push({url:String(url),init});return handler(String(url),init);};
  return fn(calls).finally(()=>{globalThis.fetch=original;});
}

test('Solo se usan los proveedores con clave y modelo, en el orden configurado',()=>{
  const env={...KEYS,GEMINI_MODEL:'gemini-x',OPENROUTER_MODEL:'nvidia/nemotron-x',STUDIO_WEB_PROVIDERS:'gemini, openrouter, groq',STUDIO_AGENT_PROVIDERS:'groq,openrouter'};
  assert.deepEqual(externalModels(env,'web'),['gemini:gemini-x','openrouter:nvidia/nemotron-x'],'groq no tiene modelo configurado');
  assert.deepEqual(externalModels(env,'agent'),['openrouter:nvidia/nemotron-x']);
  assert.deepEqual(externalModels({},'web'),[]);
});

const sseRes=chunks=>new Response(chunks.map(c=>'data: '+JSON.stringify(c)+'\n\n').join(''),{status:200,headers:{'Content-Type':'text/event-stream'}});
test('Gemini: formato de petición correcto, clave en cabecera y texto de respuesta',()=>withFetch(
  (url)=>sseRes([{candidates:[{content:{parts:[{text:'pensando…',thought:true},{text:'Hola'}]}}]},{candidates:[{content:{parts:[{text:' mundo'}]},finishReason:'STOP'}]}]),
  async calls=>{
    const r=await callExternal({...KEYS},'gemini:gemini-x',[{role:'system',content:'Sistema'},{role:'user',content:'Pregunta'}],{maxTokens:100});
    assert.equal(r.text,'Hola mundo');
    const c=calls[0];const body=JSON.parse(c.init.body);
    assert.match(c.url,/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-x:streamGenerateContent\?alt=sse$/);
    assert.equal(c.init.headers['x-goog-api-key'],KEYS.GEMINI_API_KEY);
    assert.doesNotMatch(c.url,/key=/,'la clave no viaja en la URL');
    assert.doesNotMatch(r.text,/pensando/,'el razonamiento interno no se cuela en el texto');
    assert.equal(body.systemInstruction.parts[0].text,'Sistema');
    assert.equal(body.contents[0].parts[0].text,'Pregunta');
    assert.equal(body.generationConfig.maxOutputTokens,100);
  }));

test('Groq y OpenRouter usan el formato de chat con Bearer',()=>withFetch(
  ()=>json({choices:[{message:{content:'OK'},finish_reason:'stop'}]}),
  async calls=>{
    await callExternal({...KEYS},'groq:modelo-g',[{role:'user',content:'x'}]);
    await callExternal({...KEYS},'openrouter:nvidia/nemotron-x',[{role:'user',content:'x'}]);
    assert.equal(calls[0].url,'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(calls[0].init.headers.Authorization,'Bearer '+KEYS.GROQ_API_KEY);
    assert.equal(calls[1].url,'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(JSON.parse(calls[1].init.body).model,'nvidia/nemotron-x');
  }));

test('Los errores dicen el motivo real y nunca muestran la clave',()=>withFetch(
  ()=>json({error:{message:'models/gemini-hydrogen is not found for API version v1beta. key=AIzaFAKEKEY1234567890'}},404),
  async()=>{
    await assert.rejects(callExternal({...KEYS},'gemini:gemini-hydrogen',[{role:'user',content:'x'}]),e=>{
      assert.equal(e.status,404);assert.match(e.message,/not found/);assert.doesNotMatch(e.message,/FAKEKEY/);return true;});
  }));

test('La lista de modelos de Gemini devuelve solo los que generan texto y filtra',()=>withFetch(
  ()=>json({models:[{name:'models/gemini-a-hydrogen',supportedGenerationMethods:['generateContent']},{name:'models/embedding-1',supportedGenerationMethods:['embedContent']},{name:'models/gemini-b',supportedGenerationMethods:['generateContent']}]}),
  async()=>{
    assert.deepEqual((await listModels({...KEYS},'gemini')).models,['gemini-a-hydrogen','gemini-b']);
    assert.deepEqual((await listModels({...KEYS},'gemini','hydro')).models,['gemini-a-hydrogen']);
  }));

test('Diagnóstico: avisa si el modelo configurado no existe y si falta un secreto',()=>withFetch(
  (url)=>/models\?/.test(url)?json({models:[{name:'models/gemini-real',supportedGenerationMethods:['generateContent']}]}):
    /[gG]enerateContent/.test(url)?json({error:{message:'not found'}},404):json({data:[]}),
  async()=>{
    const d=await diagnoseProviders({GEMINI_API_KEY:KEYS.GEMINI_API_KEY,GEMINI_MODEL:'gemini-inventado'});
    assert.equal(d.gemini.prueba.ok,false);assert.equal(d.gemini.prueba.estado,404);
    assert.match(d.gemini.aviso,/no aparece/);
    assert.deepEqual(d.gemini.modelos_disponibles,['gemini-real']);
    assert.match(d.groq.secreto,/FALTA/);
    assert.doesNotMatch(JSON.stringify(d),/FAKEKEY/);
  }));

test('El equipo de webs usa primero el proveedor externo y, si falla, sigue con Workers AI',()=>withFetch(
  ()=>json({error:{message:'quota'}},429),
  async calls=>{
    const AUD='78890161c85752fcd44d08bde44510aac74aa51d9ee12371327fa6875ac6d8a6';
    const ctx={access:{aud:AUD,getIdentity:async()=>({email:'owner@example.com'})}};
    const db={prepare(){return {bind(){return {run:async()=>({meta:{changes:1}})};}};}};
    let workersAICalls=0;
    const env={...KEYS,GEMINI_MODEL:'gemini-x',STUDIO_WEB_PROVIDERS:'gemini',STUDIO_OWNER_EMAIL:'owner@example.com',STUDIO_DB:db,
      AI:{run:async()=>{workersAICalls++;throw Error('sin respuesta');}}};
    const res=await wayupStudioWebCreatorBridge(new Request('https://studio.test/studio-api/webcreator/generate-stream',{method:'POST',
      headers:{Origin:'https://studio.test','Content-Type':'application/json'},body:JSON.stringify({briefing:'Centro ficticio de entrenamiento personal con grupos reducidos y nutrición.'})}),env,ctx);
    await res.text();
    assert.ok(calls.some(c=>/generativelanguage/.test(c.url)),'se intentó Gemini');
    assert.ok(workersAICalls>0,'tras el 429 se pasó a Workers AI');
  }));

test('Listas por tarea: orden configurado, solo proveedores con clave y respaldo a la configuración anterior',()=>{
  const env={GROQ_API_KEY:KEYS.GROQ_API_KEY,OPENROUTER_API_KEY:KEYS.OPENROUTER_API_KEY,
    STUDIO_WEB_PLAN_MODELS:'gemini:gemini-4-hydrogen, openrouter:nvidia/nemotron-x:free ,groq:openai/gpt-oss-120b',
    STUDIO_WEB_BUILD_MODELS:'openrouter:nvidia/nemotron-x:free,openrouter:cohere/north-mini-code:free',
    STUDIO_AGENT_MODELS:'groq:openai/gpt-oss-120b,groq:qwen/qwen3.8-27b,nada:raro'};
  assert.deepEqual(modelsFor(env,'plan'),['openrouter:nvidia/nemotron-x:free','groq:openai/gpt-oss-120b'],'sin clave de Gemini se omite');
  assert.deepEqual(modelsFor(env,'build'),['openrouter:nvidia/nemotron-x:free','openrouter:cohere/north-mini-code:free']);
  assert.deepEqual(modelsFor(env,'agent'),['groq:openai/gpt-oss-120b','groq:qwen/qwen3.8-27b']);
  const legacy={...KEYS,GEMINI_MODEL:'g',OPENROUTER_MODEL:'o',STUDIO_WEB_PROVIDERS:'gemini,openrouter'};
  assert.deepEqual(modelsFor(legacy,'plan'),['gemini:g','openrouter:o']);
  assert.deepEqual(modelsFor(legacy,'build'),['openrouter:o'],'Gemini no construye secciones');
});
test('Gemini saturado (no empieza a responder) se corta y se informa',()=>withFetch(
  (url,init)=>new Promise((_,reject)=>init.signal.addEventListener('abort',()=>{const e=new Error('abort');e.name='AbortError';reject(e);})),
  async()=>{
    await assert.rejects(callExternal({...KEYS},'gemini:gemini-x',[{role:'user',content:'x'}],{timeoutMs:50}),e=>{assert.match(e.message,/no empezó a responder/);return true;});
  }));

test('Con STUDIO_WORKERS_AI="off" nunca se llama a Workers AI: texto, fotos y estado',()=>withFetch(
  (url)=>{
    if(/openrouter\.ai\/api\/v1\/chat/.test(url))return json({error:{message:'cupo'}},429);
    if(/pixabay\.com\/api/.test(url))return json({hits:[]});
    return json({},404);
  },
  async calls=>{
    const AUD='78890161c85752fcd44d08bde44510aac74aa51d9ee12371327fa6875ac6d8a6';
    const ctx={access:{aud:AUD,getIdentity:async()=>({email:'owner@example.com'})}};
    const db={prepare(){return {bind(){return {run:async()=>({meta:{changes:1}})};}};}};
    let workersAICalls=0;
    const env={...KEYS,PIXABAY_API_KEY:'px',STUDIO_WORKERS_AI:'off',STUDIO_OWNER_EMAIL:'owner@example.com',STUDIO_DB:db,
      STUDIO_WEB_PLAN_MODELS:'openrouter:nvidia/x:free',STUDIO_WEB_BUILD_MODELS:'openrouter:nvidia/x:free',
      AI:{run:async()=>{workersAICalls++;return {response:'no debería usarse'};}}};
    const call=(route,init)=>wayupStudioWebCreatorBridge(new Request('https://studio.test/studio-api/webcreator/'+route,init),env,ctx);
    const status=await (await call('status',{method:'GET'})).json();
    assert.equal(status.configured,true,'el motor está disponible sin Workers AI');
    assert.equal(status.workersAI,false);
    const gen=await call('generate-stream',{method:'POST',headers:{Origin:'https://studio.test','Content-Type':'application/json'},
      body:JSON.stringify({briefing:'Centro ficticio de entrenamiento personal con grupos reducidos y nutrición.'})});
    const text=await gen.text();
    assert.match(text,/event: error/,'si los externos fallan, informa del error');
    const img=await call('image',{method:'POST',headers:{Origin:'https://studio.test','Content-Type':'application/json'},body:JSON.stringify({prompt:'wooden table with fresh bread in a bakery'})});
    assert.equal(img.status,502,'sin foto en Pixabay y sin IA de imágenes → imagen pendiente');
    assert.ok(calls.some(c=>/pixabay\.com\/api/.test(c.url)),'un objeto (no persona) también se busca en Pixabay');
    assert.equal(workersAICalls,0,'Workers AI no se ha llamado ni una vez');
  }));

test('Claude: SDK oficial, system con caché, imágenes en base64, sin temperature y reserva en Opus 5.5',()=>{
  const sse=ev=>ev.map(e=>'event: '+e.type+'\ndata: '+JSON.stringify(e)+'\n\n').join('');
  const events=[
    {type:'message_start',message:{id:'m1',type:'message',role:'assistant',model:'claude-opus-5-5',content:[],stop_reason:null,usage:{input_tokens:10,output_tokens:0}}},
    {type:'content_block_start',index:0,content_block:{type:'text',text:''}},
    {type:'content_block_delta',index:0,delta:{type:'text_delta',text:'Hola '}},
    {type:'content_block_delta',index:0,delta:{type:'text_delta',text:'mundo'}},
    {type:'content_block_stop',index:0},
    {type:'message_delta',delta:{stop_reason:'end_turn'},usage:{output_tokens:2}},
    {type:'message_stop'}];
  return withFetch(()=>new Response(sse(events),{status:200,headers:{'content-type':'text/event-stream'}}),async calls=>{
    const env={ANTHROPIC_API_KEY:'sk-ant-prueba'};
    const r=await callExternal(env,'anthropic:claude-opus-5-5',[{role:'system',content:'Eres director.'},
      {role:'user',content:[{type:'text',text:'Mira'},{type:'image_url',image_url:{url:'data:image/png;base64,AAAA'}}]}],{maxTokens:900,temperature:0.6,effort:'high'});
    assert.equal(r.text,'Hola mundo');
    const body=JSON.parse(calls[0].init.body);
    assert.match(calls[0].url,/api\.anthropic\.com\/v1\/messages/);
    assert.equal(body.model,'claude-opus-5-5');assert.equal(body.max_tokens,900);assert.equal(body.temperature,undefined);
    assert.deepEqual(body.system[0].cache_control,{type:'ephemeral'});
    assert.equal(body.messages[0].content[1].source.media_type,'image/png');
    assert.equal(body.output_config.effort,'high');assert.equal(body.fallbacks,'default');
    assert.equal(modelsFor({...env,STUDIO_WEB_PLAN_MODELS:'anthropic:claude-opus-5-5,groq:x'},'plan')[0],'anthropic:claude-opus-5-5');
  });
});
