import test from 'node:test';
import assert from 'node:assert/strict';
import {wayupStudioWebCreatorBridge} from '../src/studio-next-webcreator-bridge.js';

const AUD='78890161c85752fcd44d08bde44510aac74aa51d9ee12371327fa6875ac6d8a6';
const EMAIL='owner@example.com';
const ORIGIN='https://studio.test';
const ctx={access:{aud:AUD,getIdentity:async()=>({email:EMAIL})}};
const BRIEFING='Centro ficticio de entrenamiento personal. Servicios: entrenamiento individual, grupos y online. Contacto: formulario.';
const STYLE='<style>'+'.b{color:#123}'.repeat(40)+'</style>';
const FULL='<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Prueba</title>'+STYLE+'</head><body><section id="inicio" data-wc-section="inicio"><h1>Hola</h1></section><form action="https://externo.test/x" method="post"><input name="n"></form></body></html>';

function sse(chunks){
  const enc=new TextEncoder();
  return new ReadableStream({start(c){for(const x of chunks)c.enqueue(enc.encode('data: '+JSON.stringify({response:x})+'\n\n'));c.enqueue(enc.encode('data: [DONE]\n\n'));c.close();}});
}
function fakeDb(){
  const calls=[];let used=0;
  return {calls,get used(){return used},prepare(sql){return {bind(...args){return {run:async()=>{
    calls.push(sql);
    if(sql.startsWith('UPDATE')&&sql.includes('used+1')){used++;return {meta:{changes:1}};}
    if(sql.startsWith('UPDATE')&&sql.includes('used-1')){used--;return {meta:{changes:1}};}
    return {meta:{changes:0}};
  }};}};}};
}
const PLAN='IDEA: movimiento con criterio. '+'SECCIONES: hero, marquee, lista numerada, bento, cifras, FAQ, CTA. '.repeat(4);
const isPlan=input=>String(input?.messages?.[0]?.content||'').startsWith('Eres director de arte');
// La pasada de planificación responde siempre un plan fijo; las pruebas controlan solo la generación del HTML.
async function generate(ai,{planFails=false}={}){
  const wrapped={run:async(model,input)=>{if(isPlan(input)){if(planFails)throw Error('plan caído');return sse([PLAN]);}return ai.run(model,input);}};
  const env={STUDIO_DB:fakeDb(),STUDIO_OWNER_EMAIL:EMAIL,AI:wrapped};
  const res=await wayupStudioWebCreatorBridge(new Request(ORIGIN+'/studio-api/webcreator/generate-stream',{
    method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({briefing:BRIEFING})}),env,ctx);
  const text=await res.text();
  const events=text.split('\n\n').filter(Boolean).map(b=>({event:/event: (\w+)/.exec(b)?.[1],data:JSON.parse(/data: (.*)/.exec(b)?.[1]||'{}')}));
  return {res,events,env,final:events.at(-1)};
}

test('Sin identidad de Access no se genera',async()=>{
  const res=await wayupStudioWebCreatorBridge(new Request(ORIGIN+'/studio-api/webcreator/generate-stream',{
    method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({briefing:BRIEFING})}),
    {STUDIO_DB:fakeDb(),STUDIO_OWNER_EMAIL:EMAIL,AI:{run:async()=>{throw Error('no debe llamarse')}}},{});
  assert.equal(res.status,401);
});
test('Generación en streaming entrega HTML completo y formularios neutralizados',async()=>{
  const {final}=await generate({run:async()=>sse([FULL.slice(0,200),FULL.slice(200)])});
  assert.equal(final.event,'complete');
  assert.match(final.data.html,/<\/html>$/);
  assert.doesNotMatch(final.data.html,/externo\.test|method=/);
  assert.match(final.data.html,/data-wc-static-form="true"/);
});
test('Salida cortada se completa con una continuación acotada',async()=>{
  let n=0;const seen=[];
  const {final}=await generate({run:async(model,input)=>{seen.push(input.messages.length);return sse(n++===0?[FULL.slice(0,400)]:[FULL.slice(400)]);}});
  assert.equal(final.event,'complete');
  assert.equal(final.data.html.length>400,true);
  assert.deepEqual(seen,[2,4]);
});
test('Salida truncada sin recuperación no se guarda, informa y devuelve la cuota',async()=>{
  const {final,env}=await generate({run:async()=>sse([FULL.slice(0,300)])});
  assert.equal(final.event,'error');
  assert.equal(final.data.code,'truncated');
  assert.equal(env.STUDIO_DB.used,0);
});
test('Si el modelo principal falla se usa el alternativo',async()=>{
  const models=[];
  const {final}=await generate({run:async model=>{models.push(model);if(models.length===1)throw Error('5xx upstream');return sse([FULL]);}});
  assert.equal(final.event,'complete');
  assert.equal(models.length,2);
  assert.notEqual(models[0],models[1]);
  assert.equal(final.data.model,models[1]);
});
test('Límite del proveedor produce un error específico',async()=>{
  const {final}=await generate({run:async()=>{throw Error('429 Too Many Requests')}});
  assert.equal(final.event,'error');
  assert.equal(final.data.code,'provider_limit');
});
test('JavaScript propio y seguro se conserva; el peligroso o externo se quita',async()=>{
  const good='<script>document.documentElement.classList.add("js");const b=document.querySelector("button");b?.addEventListener("click",()=>b.classList.toggle("open"));</script>';
  const bad='<script>fetch("/robar")</script><script src="https://cdn.example/x.js"></script><script>window.open("x")</script>';
  const {final}=await generate({run:async()=>sse([FULL.replace('</body>',good+bad+'</body>')])});
  assert.equal(final.event,'complete');
  assert.match(final.data.html,/classList\.add\("js"\)/);
  assert.doesNotMatch(final.data.html,/fetch|cdn\.example|window\.open/);
});
test('HTML con iframes o eventos en atributos se rechaza sin probar otro modelo',async()=>{
  let calls=0;
  const {final}=await generate({run:async()=>{calls++;return sse([FULL.replace('</body>','<img src="a.png" onerror="alert(1)"></body>')]);}});
  assert.equal(final.event,'error');
  assert.equal(final.data.code,'active');
  assert.equal(calls,1);
});
test('Razonamiento <think> previo se descarta',async()=>{
  const {final}=await generate({run:async()=>sse(['<think>plan interno</think>\n'+FULL])});
  assert.equal(final.event,'complete');
  assert.doesNotMatch(final.data.html,/plan interno/);
});
test('El plan de diseño se pasa al generador; si falla, se genera igualmente',async()=>{
  let user='';
  const {final}=await generate({run:async(model,input)=>{user=input.messages[1].content;return sse([FULL]);}});
  assert.equal(final.event,'complete');
  assert.match(user,/PLAN DE DISEÑO APROBADO/);
  const again=await generate({run:async(model,input)=>{user=input.messages[1].content;return sse([FULL]);}},{planFails:true});
  assert.equal(again.final.event,'complete');
  assert.doesNotMatch(user,/PLAN DE DISEÑO/);
});
test('Solo se conservan los enlaces a Google Fonts; las imágenes remotas pierden su src',async()=>{
  const head='<link rel="preconnect" href="https://fonts.gstatic.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces&display=swap"><link rel="stylesheet" href="https://evil.example/x.css">';
  const body='<img data-wc-ai-image="runner at dawn" alt="Corredora"><img src="https://evil.example/a.jpg" alt="x">';
  const {final}=await generate({run:async()=>sse([FULL.replace('</head>',head+'</head>').replace('</body>',body+'</body>')])});
  assert.equal(final.event,'complete');
  assert.match(final.data.html,/fonts\.googleapis\.com\/css2\?family=Fraunces/);
  assert.match(final.data.html,/fonts\.gstatic\.com/);
  assert.match(final.data.html,/data-wc-ai-image="runner at dawn"/);
  assert.doesNotMatch(final.data.html,/evil\.example/);
});
test('Ruta de imágenes IA: devuelve una imagen JPEG y respeta el origen',async()=>{
  const env={STUDIO_DB:fakeDb(),STUDIO_OWNER_EMAIL:EMAIL,AI:{run:async(model,input)=>{assert.match(model,/flux/);assert.match(input.prompt,/runner/);return {image:'A'.repeat(2000)};}}};
  const call=origin=>wayupStudioWebCreatorBridge(new Request(ORIGIN+'/studio-api/webcreator/image',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({prompt:'runner at dawn by the river'})}),env,ctx);
  const ok=await call(ORIGIN);
  assert.equal(ok.status,200);
  assert.match((await ok.json()).image,/^data:image\/jpeg;base64,/);
  assert.equal((await call('https://otro.test')).status,403);
});
