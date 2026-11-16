import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {strFromU8,strToU8,zipSync,unzipSync} from 'fflate';
const root=resolve(import.meta.dirname,'..');
async function loadTyped(path){
  const input=readFileSync(join(root,path),'utf8');
  const built=ts.transpileModule(input,{
    fileName:path,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
  });
  const file=join(root,'.wayup-studio-test-'+process.pid+'.mjs');
  try{
    writeFileSync(file,built.outputText);
    return await import(pathToFileURL(file).href+'?path='+encodeURIComponent(path));
  }finally{unlinkSync(file)}
}
const starter=await loadTyped('lib/starter-web.ts');
const files=await loadTyped('lib/web-project-files.ts');
const brief={
  name:'Estudio Norte Ficticio',
  industry:'Centro deportivo',
  audience:'Personas que buscan entrenamientos personalizados',
  goal:'Solicitar información',
  style:'Deportivo, sobrio',
  services:'Entrenamiento personal; Entrenamiento de fuerza; Clases guiadas',
  contact:'Calle Ejemplo 23, Valladolid, España',
  features:'Formulario de contacto',
  palette:'Verde'
};
const html=starter.starterHtml(brief);
assert.match(html,/<html lang="es">/);
assert.match(html,/data-wc-section="cabecera"/);
assert.match(html,/data-wc-section="servicios"/);
assert.match(html,/Estudio Norte Ficticio/);
assert.ok(!html.includes('info@ejemplo.invalid'),'No inventa correo');
assert.ok(!html.includes('<script'),'No introduce scripts al crear base local');
const malicious=starter.starterHtml({...brief,name:'<img src=x onerror=alert(1)>',services:'<script>alert(1)</script> prestación profesional'});
assert.ok(!malicious.includes('<img src=x'));
assert.ok(!malicious.includes('<script>alert(1)</script>'));
assert.match(malicious,/&lt;img/,'Escapa correctamente briefing no confiable');
assert.throws(()=>starter.starterHtml({...brief,services:'corto'}),/20 caracteres/);

const fixture='<!DOCTYPE html><html lang="es"><head><title>Prueba ZIP</title></head><body><h1>Hola mundo</h1><img src="images/logo.png"></body></html>';
const fakeLogo=new Uint8Array([137,80,78,71,13,10,26,10,10,20,30,40]);
const zipped=zipSync({'index.html':strToU8(fixture),'css/base.css':strToU8('h1{color:red}'),'images/logo.png':fakeLogo});
const imported=files.siteFromZip(zipped);
assert.equal(imported.entry,'index.html');
assert.deepEqual(imported.assets['images/logo.png'],fakeLogo);
assert.equal(strFromU8(imported.assets['css/base.css']),'h1{color:red}');
const replaced=files.siteWithNewHtml(imported,fixture.replace('Hola mundo','Web editada'));
const exported=unzipSync(files.siteZip(replaced));
assert.match(strFromU8(exported['index.html']),/Web editada/);
assert.deepEqual(exported['images/logo.png'],fakeLogo);
assert.equal(strFromU8(exported['css/base.css']),'h1{color:red}');
assert.equal(files.safePath('../evil.html'),false);
assert.equal(files.safePath('/private.txt'),false);
assert.equal(files.safePath('css/base.css'),true);
const bad=zipSync({'../../private.txt':strToU8('x'),'index.html':strToU8(fixture)});
assert.throws(()=>files.siteFromZip(bad),/ruta insegura/);
const agent={agentId:'e08f2514-0e9e-4fb3-b1d4-0beebdf87a75',chatId:'479ea264-dee5-4b81-9477-8d9af08f5b24',origin:'https://cliente.example',title:'Prueba',linkedAt:Date.now()};
const withAgent={...replaced,agent};
const out=unzipSync(files.siteZip(withAgent));
const doc=strFromU8(out['index.html']);
assert.equal((doc.match(/data-chat=/g)||[]).length,1,'El widget aparece una vez');
assert.ok(doc.includes(agent.chatId));
assert.match(doc,/wayup-studio-agent-preview\.francopdimauro\.workers\.dev\/widget\.js/,'El widget apunta al runtime propio de Studio');
assert.match(strFromU8(out['WAYUP_AGENT_SETUP.txt']),/dominio HTTPS autorizado/i);
const restored=files.siteFromZip(files.siteZip(withAgent));
assert.equal(restored.agent?.agentId,agent.agentId,'Agente restaurado tras guardar ZIP');
assert.equal(restored.agent?.chatId,agent.chatId,'Chat restaurado tras guardar ZIP');
assert.equal(restored.agent?.origin,agent.origin,'Dominio autorizado restaurado');
assert.ok(!('WAYUP_STUDIO_PROJECT.json' in restored.assets),'Manifiesto interno no aparece como recurso público');

const already={...withAgent,html:files.htmlForExport(withAgent)};
const again=strFromU8(unzipSync(files.siteZip(already))['index.html']);
assert.equal((again.match(/data-chat=/g)||[]).length,1,'La reexportación no duplica el agente');
assert.equal((files.htmlForExport(replaced).match(/widget\.js/g)||[]).length,0,'Sin agente, nada embebido');
assert.throws(()=>files.agentSnippet('invalid'),/inválido/);

assert.equal(files.safeSiteLink('https://example.test/contacto'),true,'HTTPS permitido');
assert.equal(files.safeSiteLink('#contacto'),true,'Anclas permitidas');
assert.equal(files.safeSiteLink('contacto.html'),true,'Rutas relativas permitidas');
assert.equal(files.safeSiteLink('mailto:info@example.test'),true,'Correo permitido');
for(const unsafe of ['javascript:alert(1)','data:text/html,hi','vbscript:msgbox(1)','http://example.test','//example.test','../secret','ftp://example.test']){
  assert.equal(files.safeSiteLink(unsafe),false,'No aceptar URL insegura: '+unsafe);
}
assert.equal(files.detectSafeImage(fakeLogo)?.ext,'png','Detección mediante cabecera real');
assert.equal(files.detectSafeImage(strToU8('<script>alert(1)</script>')),null,'No aceptar HTML disfrazado de imagen');
assert.equal(files.detectSafeImage(new Uint8Array(5_000_001)),null,'Limitar peso de imágenes');
console.log('Correcto: enlaces bloqueados por esquema y subidas de imágenes con firma y tamaño controlados.');

console.log('Correcto: generador HTML seguro, ZIP importado/exportado sin pérdidas, rutas y agente único.');
