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
const isTeam=input=>/^Eres (el DIRECTOR|un DESARROLLADOR|el REVISOR|el REDACTOR)/.test(String(input?.messages?.[0]?.content||''));
async function generate(ai,{planFails=false,team=null}={}){
  // Por defecto el equipo responde algo inválido: así se prueba la vía de una pasada (sin marcar modelos como no disponibles).
  const wrapped={run:async(model,input)=>{
    if(isTeam(input))return team?team(model,input):sse(['sin bloques']);
    if(isPlan(input)){if(planFails)throw Error('plan caído');return sse([PLAN]);}
    return ai.run(model,input);}};
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
  const good='<script>function abrir(){return 1}document.documentElement.classList.add("js");const b=document.querySelector("button");b?.addEventListener("click",()=>b.classList.toggle("open"));</script>';
  const bad='<script>fetch("/robar")</script><script src="https://cdn.example/x.js"></script><script>window.open("x")</script>';
  const {final}=await generate({run:async()=>sse([FULL.replace('</body>',good+bad+'</body>')])});
  assert.equal(final.event,'complete');
  assert.match(final.data.html,/classList\.add\("js"\)/);
  assert.match(final.data.html,/function abrir/,'la palabra function no debe bloquear el script');
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

test('Equipo de modelos: director, constructores en paralelo y revisor montan una web completa con JavaScript propio',async()=>{
  const css='.x{color:#111}'.repeat(80);
  const director=['===META===','Centro ficticio | Entrenamiento personal a medida','===FUENTES===','https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700&family=Inter&display=swap',
    '===CSS===',':root{--a:#c00}'+css,'===SECCIONES===','cabecera | header | Marca | navegación | no','inicio | hero gráfico | Muévete con criterio | titular enorme | athlete stretching at dawn',
    'metodo | lista numerada | Cómo trabajamos | pasos | no','planes | bento | Elige tu ritmo | servicios | no','pie | footer | Marca | datos | no','===FIN==='].join('\n');
  const calls={director:0,builder:0,reviewer:0,copy:0};const builderInputs=[];
  const team=(model,input)=>{
    const sys=input.messages[0].content,user=input.messages[1].content;
    if(sys.startsWith('Eres el DIRECTOR')){calls.director++;return sse([director]);}
    if(sys.startsWith('Eres el REDACTOR')){calls.copy++;return sse(['===SECCION inicio===\nANTETÍTULO: Valladolid\nTITULAR: Muévete con *criterio*\nENTRADILLA: Texto del redactor para el hero.\n===SECCION metodo===\nTITULAR: Así trabajamos\n===FIN===']);}
    if(!sys.startsWith('Eres el REVISOR'))builderInputs.push(user);
    if(sys.startsWith('Eres el REVISOR')){calls.reviewer++;return sse(['===CSS===\n.hero h1{letter-spacing:-.03em}\n.btn:focus-visible{outline:2px solid red}\n===FIN===']);}
    calls.builder++;
    const id=/id="([a-z0-9-]+)"/.exec(user.split('TU ENCARGO')[1])?.[1];
    const html=/CABECERA/.test(user)?'<header class="site-header" data-header><a href="#inicio">Marca</a></header>':
      /el PIE/.test(user)?'<footer class="site-footer">© Marca</footer>':
      '<section id="'+id+'" data-wc-section="'+id+'"><h2 data-reveal>'+id+'</h2>'+(id==='inicio'?'<img data-wc-ai-image="athlete stretching at dawn" alt="Atleta">':'')+'<script>fetch("/x")</script></section>';
    return sse(['===HTML===\n'+html+'\n===CSS===\n#'+(id||'x')+'{padding:80px 0}\n===FIN===']);
  };
  const {final}=await generate({run:async()=>{throw Error('no debe usarse la vía de una pasada')}},{team});
  assert.equal(final.event,'complete');
  assert.equal(final.data.mode,'studio-team');
  assert.equal(calls.director,1);assert.equal(calls.builder,5);assert.equal(calls.reviewer,1);assert.equal(calls.copy,1);
  const heroInput=builderInputs.find(u=>/data-wc-section="inicio"/.test(u.split('TU ENCARGO')[1]||''));
  assert.match(heroInput,/TEXTOS DEFINITIVOS DEL REDACTOR[\s\S]*Muévete con \*criterio\*/,'el constructor recibe los textos del redactor');
  assert.match(heroInput,/EJEMPLO DE REFERENCIA del patrón «hero»/,'y el ejemplo de su patrón');
  assert.match(builderInputs.find(u=>/CABECERA/.test(u)),/EJEMPLO DE REFERENCIA del patrón «cabecera»/);
  const html=final.data.html;
  for(const id of ['inicio','metodo','planes'])assert.match(html,new RegExp('data-wc-section="'+id+'"'));
  assert.match(html,/<header class="site-header"/);assert.match(html,/<footer class="site-footer"/);
  assert.match(html,/fonts\.googleapis\.com\/css2\?family=Fraunces/);
  assert.match(html,/IntersectionObserver/,'lleva el JavaScript propio del equipo');
  assert.match(html,/letter-spacing:-\.03em/,'incluye la revisión');
  assert.match(html,/data-wc-ai-image="athlete stretching at dawn"/);
  assert.doesNotMatch(html,/fetch\(/,'los scripts de los constructores se descartan');
  assert.match(html,/<title>Centro ficticio<\/title>/);
});

test('Revisión visual: la captura va al modelo con visión y la corrección devuelve CSS limpio',async()=>{
  const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  let visionInput=null;
  const env={STUDIO_DB:fakeDb(),STUDIO_OWNER_EMAIL:EMAIL,AI:{run:async(model,input)=>{
    const c=input.messages?.[0]?.content;
    if(Array.isArray(c)){visionInput=c;return {response:'Problema: la cabecera ocupa tres filas → Arreglo: una fila con flex.'};}
    return sse(['===CSS===\n#inicio .site-header{flex-wrap:nowrap}\n.x{background:url(https://evil.example/a.png)}\n===FIN===']);
  }}};
  const call=(route,body)=>wayupStudioWebCreatorBridge(new Request(ORIGIN+'/studio-api/webcreator/'+route,{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json'},body:JSON.stringify(body)}),env,ctx);
  const shot=await call('review-shot',{id:'site-header',viewport:'móvil',dataUrl:PNG});
  assert.equal(shot.status,200);
  assert.match((await shot.json()).notes,/tres filas/);
  assert.match(visionInput[0].text,/MÓVIL/);assert.equal(visionInput[1].image_url.url,PNG);
  const bad=await call('review-shot',{id:'x',viewport:'escritorio',dataUrl:'data:text/html;base64,PGI+'});
  assert.equal(bad.status,400,'solo imágenes reales');
  const fix=await call('review-fix',{notes:[{id:'inicio',viewport:'escritorio',notes:'cabecera en tres filas'}],css:'.a{}',structure:'<header class="site-header"></header>'});
  const css=(await fix.json()).css;
  assert.match(css,/flex-wrap:nowrap/);
  assert.doesNotMatch(css,/evil\.example/,'sin recursos externos');
});
