// Prueba de la exportación de agentes en ZIP y de su inserción en una web ZIP.
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';

const root=resolve(import.meta.dirname,'..');
const tmp=join(root,'.wayup-agent-export-test-'+process.pid);
mkdirSync(join(tmp,'lib'),{recursive:true});
const build=(src,dest)=>writeFileSync(join(tmp,dest),ts.transpileModule(readFileSync(join(root,src),'utf8'),
  {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '\.\/web-project-files'/g,"from './web-project-files.mjs'"));
let mod;
try{
  build('lib/web-project-files.ts','lib/web-project-files.mjs');
  build('lib/agent-export.ts','lib/agent-export.mjs');
  mod=await import(pathToFileURL(join(tmp,'lib/agent-export.mjs')).href);
}finally{rmSync(tmp,{recursive:true,force:true});}

const CHAT='3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',OTHER='11111111-2222-4333-8444-555555555555';
const agent={id:'a1',name:'Asistente Ficticio <b>',role:'Atención',objective:'Resolver dudas',instructions:'Sé breve.',knowledge:'Horario: 9 a 14',tools:['text_generation','knowledge_lookup'],status:'active'};

// 1. ZIP del agente con chat publicado
const files=unzipSync(mod.agentZip(agent,{chatId:CHAT,origin:'https://negocio-ficticio.es'}));
assert.deepEqual(Object.keys(files).sort(),['LEEME.txt','agente.json','demo.html','insertar-en-tu-web.html']);
const json=JSON.parse(strFromU8(files['agente.json']));
assert.equal(json.formato,'wayup-agent-v1');assert.equal(json.agente.conocimiento,'Horario: 9 a 14');
assert.equal(json.chat_publicado.dominio_autorizado,'https://negocio-ficticio.es');
assert.match(strFromU8(files['insertar-en-tu-web.html']),new RegExp('data-chat="'+CHAT+'"'));
assert.doesNotMatch(strFromU8(files['demo.html']),/<b>/,'el nombre se escapa en el HTML de la demo');
assert.doesNotMatch(strFromU8(files['LEEME.txt'])+JSON.stringify(json),/gsk_|sk-or-|AIza|API_KEY/,'sin claves');
assert.equal(mod.agentZipName(agent),'agente-asistente-ficticio-b.zip');

// 2. Sin chat publicado: solo configuración y LÉEME
assert.deepEqual(Object.keys(unzipSync(mod.agentZip(agent,null))).sort(),['LEEME.txt','agente.json']);

// 3. Añadir el chat a todas las páginas de una web ZIP (una ya tenía otro asistente de WayUp)
const old='<!-- Asistente de WayUp -->\n<script src="https://agent-factory-free.francopdimauro.workers.dev/widget.js" data-chat="'+OTHER+'" defer></script>';
const web=zipSync({'index.html':strToU8('<!DOCTYPE html><html><body><h1>Inicio</h1></body></html>'),
  'blog/post/index.html':strToU8('<html><body><p>Post</p>'+old+'\n</body></html>'),
  'css/estilo.css':strToU8('body{color:red}')});
const r=mod.injectAgentIntoWebZip(web,CHAT,'Asistente Ficticio');
const out=unzipSync(r.zip);
assert.equal(r.pages,2);
for(const p of ['index.html','blog/post/index.html']){
  const h=strFromU8(out[p]);
  assert.equal((h.match(/widget\.js/g)||[]).length,1,'un único chat por página en '+p);
  assert.match(h,new RegExp('data-chat="'+CHAT+'"[^<]*</script>\\s*</body>'),'el chat va justo antes de </body> en '+p);
}
assert.equal(strFromU8(out['css/estilo.css']),'body{color:red}','el resto de archivos no se toca');
// Repetirlo no duplica
const again=mod.injectAgentIntoWebZip(r.zip,CHAT,'Asistente Ficticio');
assert.equal(again.pages,0);assert.equal(again.already,2);
assert.throws(()=>mod.injectAgentIntoWebZip(zipSync({'a.css':strToU8('x')}),CHAT,'x'),/no contiene páginas HTML/);
console.log('agent-export: ok');
