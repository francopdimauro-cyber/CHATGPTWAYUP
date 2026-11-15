import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('public/studio-next-agents-panel.js','utf8');
const start=source.indexOf('/* WAYUP_ZIP_HELPERS_BEGIN');
const end=source.indexOf('/* WAYUP_ZIP_HELPERS_END */');
assert.ok(start>=0&&end>start,'Helpers de ZIP presentes');
const fragment=source.slice(start,end)+'\n({wayupZipMake,wayupZipRead,wayupZipWithAgent})';
const helpers=vm.runInNewContext(fragment,{TextEncoder,TextDecoder,Uint8Array,Uint32Array,DataView,ArrayBuffer});
const enc=new TextEncoder(),dec=new TextDecoder();
const chat='479ea264-dee5-4b81-9477-8d9af08f5b24';
const snippet='<script src="https://agent-factory-free.francopdimauro.workers.dev/widget.js" data-chat="'+chat+'" defer></script>';
const files={
  'index.html':enc.encode('<!DOCTYPE html><html><head><title>Prueba</title></head><body><h1>Negocio</h1></body></html>'),
  'styles.css':enc.encode('body{color:#f00}'),
  'script.js':enc.encode('console.log("ok")'),
  'README.txt':enc.encode('Proyecto WebCreator')
};
test('fusiona el ZIP de WebCreator sin alterar el contenido y con widget real',()=>{
  const zip=helpers.wayupZipMake(files);
  const output=helpers.wayupZipWithAgent(zip.buffer,snippet);
  assert.deepEqual([...output.slice(0,4)],[0x50,0x4b,0x03,0x04]);
  const parsed=helpers.wayupZipRead(output.buffer);
  assert.ok(dec.decode(parsed['index.html']).includes(snippet));
  assert.ok(dec.decode(parsed['README.txt']).includes('AGENTE IA INTEGRADO'));
  assert.equal(dec.decode(parsed['styles.css']),'body{color:#f00}');
  assert.equal(dec.decode(parsed['script.js']),'console.log("ok")');
  assert.throws(()=>helpers.wayupZipWithAgent(output.buffer,snippet),/ya aparece/);
});
test('rechaza ZIP corruptos y scripts no autorizados',()=>{
  const zip=helpers.wayupZipMake(files);
  const corrupt=zip.slice();corrupt[40]=corrupt[40]^0xff;
  assert.throws(()=>helpers.wayupZipWithAgent(corrupt.buffer,snippet),/corrupto/);
  assert.throws(()=>helpers.wayupZipWithAgent(zip.buffer,'<script src="https://evil.example/a.js"></script>'),/no es válido/);
  assert.throws(()=>helpers.wayupZipRead(new Uint8Array([1,2,3]).buffer),/no es válido/);
});
test('se niega a modificar archivos que no sean una web HTML completa',()=>{
  const zip=helpers.wayupZipMake({'index.html':enc.encode('<div>sin cierre</div>')});
  assert.throws(()=>helpers.wayupZipWithAgent(zip.buffer,snippet),/no parece completo/);
});
