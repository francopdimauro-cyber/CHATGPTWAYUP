import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/studio-creator-research.js';
import {wayupStudioWebCreatorBridge} from '../src/studio-next-webcreator-bridge.js';

const AUD='78890161c85752fcd44d08bde44510aac74aa51d9ee12371327fa6875ac6d8a6';
const ctx={access:{aud:AUD,getIdentity:async()=>({email:'owner@example.com'})}};
const ORIGIN='https://studio.test';
const PNG='data:image/png;base64,'+Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]).toString('base64');
const db=()=>({prepare(){return {bind(){return {run:async()=>({meta:{changes:1}})};}};}});

test('Solo URLs públicas http(s): se bloquean redes privadas, localhost, IPs, puertos y credenciales',()=>{
  for(const bad of ['ftp://web.test','http://localhost/','http://127.0.0.1/','http://10.0.0.5/','http://192.168.1.1/','http://169.254.169.254/latest/meta-data',
    'https://user:pass@web.test/','https://web.test:8080/','http://intranet/','http://[::1]/','https://servicio.internal/','javascript:alert(1)'])
    assert.throws(()=>C.safePublicUrl(bad),C.CreatorError,bad);
  assert.equal(C.safePublicUrl('https://ejemplo-ficticio.test/ruta#x').toString(),'https://ejemplo-ficticio.test/ruta');
});
test('Cada redirección se vuelve a validar (no se puede saltar a una red privada)',async()=>{
  const fetcher=async url=>url.startsWith('https://ejemplo-ficticio.test')?new Response(null,{status:302,headers:{location:'http://169.254.169.254/'}}):new Response('x');
  await assert.rejects(C.safeFetch('https://ejemplo-ficticio.test/',{fetcher}),/pública/);
});
test('Web protegida o que no es HTML: error honesto',async()=>{
  await assert.rejects(C.safeFetch('https://ejemplo-ficticio.test/',{fetcher:async()=>new Response('no',{status:403})}),/no permite/);
  await assert.rejects(C.safeFetch('https://ejemplo-ficticio.test/',{fetcher:async()=>new Response('%PDF',{headers:{'content-type':'application/pdf'}})}),/HTML/);
});
test('Respuestas enormes se recortan al límite',async()=>{
  const big='<p>'+'a'.repeat(3_000_000)+'</p>';
  const r=await C.safeFetch('https://ejemplo-ficticio.test/',{fetcher:async()=>new Response(big,{headers:{'content-type':'text/html'}})});
  assert.ok(r.text.length<=1_500_000);
});
test('Colores y tipografías reales del CSS',()=>{
  const css='body{color:#222;background:#FAF9F6}a{color:#0029ff}.b{background:rgb(0,41,255)} h1{font-family:"Playfair Display",serif} p{font-family:Inter,Arial}';
  const colors=C.extractColors(css).map(c=>c.hex);
  assert.equal(colors[0],'#0029ff','El más repetido primero');
  assert.ok(colors.includes('#faf9f6'));
  assert.deepEqual(C.extractFonts(css,['https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400']).slice(0,2),['Cormorant Garamond','Playfair Display']);
});
test('Imágenes: se valida el contenido real, no la extensión',()=>{
  assert.equal(C.decodeImage(PNG).mime,'image/png');
  assert.throws(()=>C.decodeImage('data:image/png;base64,'+Buffer.from('<svg onload=alert(1)>').toString('base64')),/no es una imagen/);
  assert.throws(()=>C.decodeImage('data:image/svg+xml;base64,AAAA'),/no admitido/);
});
test('Dirección creativa: se normaliza y nunca acepta valores peligrosos',()=>{
  const d=C.sanitizeDirection({paleta:{fondo:'red;}body{x',acento:'#0029FF'},tipografia:{titulares:'Comic Sans',texto:'Sans neutra'},secciones:[{titulo:'Inicio'}]});
  assert.equal(d.paleta.fondo,'#faf9f6');
  assert.equal(d.paleta.acento,'#0029ff');
  assert.equal(d.tipografia.titulares,'Serif editorial','Solo pilas disponibles');
  assert.equal(d.tipografia.texto,'Sans neutra');
  const brief=C.directionBrief(d);
  assert.match(brief,/Google Fonts.*Inter Tight.*respaldo: system-ui/);
  assert.match(brief,/Inicio/);
});
test('Propuesta de dirección con IA (respuesta simulada del modelo) y conservación pedida',async()=>{
  let sent='';
  const env={AI:{run:async(model,input)=>{sent=JSON.stringify(input);return {response:'<think>x</think> Aquí va: {"resumen":"Editorial cálido","paleta":{"fondo":"#101010","acento":"#c8a45a"},"tipografia":{"titulares":"Serif clásica","texto":"Sans humanista"},"secciones":[{"titulo":"Carta","objetivo":"Mostrar platos reales"}]}'};}}};
  const d=await C.proposeDirection(env,{brief:'Restaurante ficticio',analysis:{title:'Web ficticia',colors:[{hex:'#c8a45a'}],fonts:['Lora'],nav:[],headings:[]},preserve:['colores','x'],freedom:'atrevido'});
  assert.equal(d.resumen,'Editorial cálido');
  assert.equal(d.secciones[0].titulo,'Carta');
  assert.match(sent,/CONSERVAR: colores/);
  assert.doesNotMatch(sent,/CONSERVAR: colores, x/,'Solo opciones válidas');
  await assert.rejects(C.proposeDirection({AI:{run:async()=>({response:'sin json'})}},{brief:'x'}),/no devolvió/);
});
test('Análisis de imagen con modelo de visión (simulado) y fallo honesto del proveedor',async()=>{
  const ok={AI:{run:async(model,input)=>{assert.equal(model,C.VISION_MODEL);assert.equal(input.messages[0].content[1].type,'image_url');
    return {response:'{"composicion":"Hero a dos columnas","colores":["#112233","nope"],"elementos_destacados":["tipografía grande"]}'};}}};
  const r=await C.analyzeReferenceImage(ok,{image:PNG,role:'estructura',note:'Me gusta el hero'});
  assert.equal(r.composicion,'Hero a dos columnas');
  assert.deepEqual(r.colores,['#112233']);
  await assert.rejects(C.analyzeReferenceImage({AI:{run:async()=>{throw Error('500')}}},{image:PNG}),/no está disponible/);
});
test('Rutas del creador: requieren identidad, mismo origen y validan entradas',async()=>{
  const env={STUDIO_DB:db(),STUDIO_OWNER_EMAIL:'owner@example.com',AI:{run:async()=>({response:'{}'})}};
  const req=(path,body,origin=ORIGIN)=>new Request(ORIGIN+'/studio-api/webcreator'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await wayupStudioWebCreatorBridge(req('/analyze-url',{url:'https://ejemplo-ficticio.test'}),env,{})).status,401);
  assert.equal((await wayupStudioWebCreatorBridge(req('/analyze-url',{url:'https://ejemplo-ficticio.test'},'https://otro.test'),env,ctx)).status,403);
  const bad=await wayupStudioWebCreatorBridge(req('/analyze-url',{url:'http://127.0.0.1/'}),env,ctx);
  assert.equal(bad.status,400);assert.match((await bad.json()).error,/pública/);
  const img=await wayupStudioWebCreatorBridge(req('/analyze-image',{image:'data:text/html;base64,PGh0bWw+'}),env,ctx);
  assert.equal(img.status,400);
  const dir=await wayupStudioWebCreatorBridge(req('/direction',{brief:'Negocio ficticio'}),env,ctx);
  assert.equal(dir.status,200);assert.ok((await dir.json()).direction.paleta.acento);
});

test('Búsqueda real: sin clave no se simula nada',async()=>{
  await assert.rejects(C.researchReferences({},{industry:'restaurante'}),/no está configurada/);
});
test('Búsqueda real: resultados verificables, sin redes sociales, sin duplicados ni URLs privadas',async()=>{
  const calls=[];
  const fetcher=async(url,init)=>{calls.push({url,auth:init.headers.Authorization,body:JSON.parse(init.body)});
    return new Response(JSON.stringify({results:[
      {url:'https://restaurante-ficticio.test/carta',title:'Restaurante Ficticio',content:'Cocina de montaña'},
      {url:'https://www.instagram.com/x',title:'IG',content:''},
      {url:'https://restaurante-ficticio.test/otra',title:'Duplicado',content:''},
      {url:'http://127.0.0.1/admin',title:'Interna',content:''},
      {url:'https://otra-web.test/',title:'Otra',content:'Diseño editorial'}]}),{headers:{'content-type':'application/json'}});};
  const r=await C.researchReferences({TAVILY_API_KEY:'clave-de-prueba'},{industry:'restaurante',style:'editorial'},{fetcher});
  assert.equal(calls[0].url,'https://api.tavily.com/search');
  assert.equal(calls[0].auth,'Bearer clave-de-prueba');
  assert.ok(calls[0].body.query.includes('restaurante'));
  assert.deepEqual(r.results.map(x=>x.host),['restaurante-ficticio.test','otra-web.test']);
  assert.equal(r.provider,'Tavily');
});
test('Búsqueda real: límite gratuito y clave inválida con mensajes claros',async()=>{
  await assert.rejects(C.researchReferences({TAVILY_API_KEY:'k'},{industry:'x'},{fetcher:async()=>new Response('',{status:432})}),/límite gratuito/);
  await assert.rejects(C.researchReferences({TAVILY_API_KEY:'k'},{industry:'x'},{fetcher:async()=>new Response('',{status:401})}),/no es válida/);
});

test('Dirección: JSON cortado se recupera y si no, se usa el segundo modelo',async()=>{
  const cut='{"resumen":"Editorial","paleta":{"fondo":"#101010","acento":"#c8a45a"},"secciones":[{"titulo":"Carta","objetivo":"Mostrar pla';
  assert.equal(C.repairJson(cut).resumen,'Editorial');
  const models=[];
  const env={AI:{run:async model=>{models.push(model);return {response:models.length===1?'Lo siento, no puedo':'{"resumen":"Plan B"}'};}}};
  const d=await C.proposeDirection(env,{brief:'Negocio ficticio'});
  assert.equal(d.resumen,'Plan B');
  assert.deepEqual(models,[C.DIRECTION_MODEL,C.DIRECTION_FALLBACK_MODEL]);
});
