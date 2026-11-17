import test from 'node:test';
import assert from 'node:assert/strict';
import {callExternal,externalModels,diagnoseProviders,listModels} from '../src/studio-ai-providers.js';
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

test('Gemini: formato de petición correcto, clave en cabecera y texto de respuesta',()=>withFetch(
  (url)=>json({candidates:[{content:{parts:[{text:'Hola',thought:false},{text:' mundo'}]},finishReason:'STOP'}]}),
  async calls=>{
    const r=await callExternal({...KEYS},'gemini:gemini-x',[{role:'system',content:'Sistema'},{role:'user',content:'Pregunta'}],{maxTokens:100});
    assert.equal(r.text,'Hola mundo');
    const c=calls[0];const body=JSON.parse(c.init.body);
    assert.match(c.url,/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-x:generateContent$/);
    assert.equal(c.init.headers['x-goog-api-key'],KEYS.GEMINI_API_KEY);
    assert.doesNotMatch(c.url,/key=/,'la clave no viaja en la URL');
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
    /generateContent/.test(url)?json({error:{message:'not found'}},404):json({data:[]}),
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
