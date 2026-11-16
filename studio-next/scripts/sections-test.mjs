// Pruebas del modelo de secciones sobre HTML real (apartado 23 del prompt maestro).
// Flujo: crear → mover → duplicar → renombrar → eliminar → deshacer → guardar (ZIP) → reabrir → exportar.
// Datos 100 % ficticios.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {DOMParser} from 'linkedom';

globalThis.DOMParser=DOMParser;
const root=resolve(import.meta.dirname,'..');
const tmp=join(root,'.wayup-sections-test-'+process.pid);
mkdirSync(tmp,{recursive:true});
function emit(name){
  const source=readFileSync(join(root,'lib',name+'.ts'),'utf8');
  const out=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
    .replace(/from '\.\/([\w-]+)'/g,"from './$1.mjs'");
  writeFileSync(join(tmp,name+'.mjs'),out);
}
let S,F;
try{
  emit('web-project-files');emit('html-sections');
  F=await import(pathToFileURL(join(tmp,'web-project-files.mjs')).href);
  S=await import(pathToFileURL(join(tmp,'html-sections.mjs')).href);
}finally{rmSync(tmp,{recursive:true,force:true})}

const SAMPLE=`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Estudio Ficticio</title>
<style>body{font-family:sans-serif}</style></head><body>
<header id="top"><a href="#inicio">Estudio Ficticio</a><nav><a href="#servicios">Servicios</a></nav></header>
<main>
<section id="inicio"><h1>Bienvenida</h1><p>Texto de inicio.</p></section>
<section id="servicios"><h2>Servicios</h2><label for="campo">Campo</label><input id="campo"><a href="#servicios">Ancla</a></section>
<section id="contacto"><h2>Contacto</h2><form><input name="n"></form></section>
</main>
<footer><p>Pie ficticio</p></footer>
</body></html>`;

const names=html=>S.listSections(html).map(s=>s.name);
const keys=html=>S.listSections(html).map(s=>s.key);
const history=[];
const apply=(html,result)=>{history.push(html);return result.html;};

// Claves estables
let html=S.ensureSectionKeys(SAMPLE);
assert.deepEqual(names(html),['Cabecera','Bienvenida','Servicios','Contacto','Pie de página']);
assert.equal(new Set(keys(html)).size,5,'Claves únicas por sección');
assert.equal(S.ensureSectionKeys(html),html,'Normalizar dos veces no cambia nada');
const sections=S.listSections(html);
assert.ok(sections[2].children.some(c=>c.tag==='H2'),'Capas internas reales');
assert.equal(S.sectionForIndex(sections,sections[2].children[0].index).key,sections[2].key,'Canvas → sección');

// Crear antes / después / dentro / al final
const servicios=sections[2].key,contacto=sections[3].key;
let r=S.addSection(html,'after',servicios);html=apply(html,r);
assert.equal(S.listSections(html)[3].key,r.key,'Insertada después de Servicios');
r=S.addSection(html,'before',servicios);html=apply(html,r);
assert.equal(S.listSections(html)[2].key,r.key,'Insertada antes de Servicios');
r=S.addSection(html,'end');html=apply(html,r);
const list=S.listSections(html);
assert.equal(list[list.length-1].tag,'FOOTER','La sección nueva queda antes del pie (dentro de <main>)');
assert.equal(list[list.length-2].key,r.key);
const before=S.listSections(html).find(s=>s.key===contacto).children.length;
html=apply(html,S.addSection(html,'inside',contacto));
assert.ok(S.listSections(html).find(s=>s.key===contacto).children.length>before,'Bloque insertado dentro');
assert.throws(()=>S.addSection(html,'inside',S.listSections(html).find(s=>s.tag==='NAV')?.key||'no-existe'));
const count=S.listSections(html).length;

// Mover (orden real del DOM)
const prevOrder=keys(html),at=prevOrder.indexOf(contacto),above=prevOrder[at-1];
html=apply(html,S.moveSection(html,contacto,'up'));
let order=keys(html);
assert.equal(order.indexOf(contacto),at-1,'Sube una posición');
assert.equal(order.indexOf(above),at,'La vecina baja una posición');
const doc=new DOMParser().parseFromString(html,'text/html');
const domOrder=Array.from(doc.querySelectorAll('main > section')).map(x=>x.getAttribute('data-wc-section'));
assert.deepEqual(domOrder,order.filter(k=>domOrder.includes(k)),'El orden del árbol coincide con el DOM');
assert.throws(()=>S.moveSection(html,S.listSections(html)[0].key,'up'),/primera/);

// Duplicar con IDs y referencias coherentes
r=S.duplicateSection(html,servicios);html=apply(html,r);
const dup=new DOMParser().parseFromString(html,'text/html');
const ids=Array.from(dup.querySelectorAll('[id]')).map(x=>x.id);
assert.equal(new Set(ids).size,ids.length,'Sin IDs duplicados');
const copy=Array.from(dup.querySelectorAll('[data-wc-section]')).find(x=>x.getAttribute('data-wc-section')===r.key);
assert.ok(copy,'La copia tiene su propia clave');
const input=copy.querySelector('input');
assert.equal(copy.querySelector('label').getAttribute('for'),input.id,'label[for] apunta al input copiado');
assert.equal(copy.querySelector('a').getAttribute('href'),'#'+copy.id,'Ancla interna actualizada');
assert.match(S.listSections(html).find(s=>s.key===r.key).name,/\(copia\)$/);
assert.equal(S.listSections(html).length,count+1);

// Renombrar sin perder contenido
html=apply(html,S.renameSection(html,servicios,'Nuestros servicios'));
const renamed=S.listSections(html).find(s=>s.key===servicios);
assert.equal(renamed.name,'Nuestros servicios');
assert.ok(renamed.children.length>2,'Conserva su contenido');
assert.throws(()=>S.renameSection(html,servicios,'   '));

// Eliminar y deshacer
const beforeDelete=html;
r=S.removeSection(html,servicios);html=apply(html,r);
assert.ok(!keys(html).includes(servicios),'Sección eliminada con sus hijos');
assert.ok(!html.includes('id="campo"'),'Hijos eliminados');
assert.ok(r.key,'Propone la sección vecina para seleccionar');
html=history.pop();
assert.equal(html,beforeDelete,'Deshacer restaura exactamente el documento');
assert.throws(()=>S.removeSection(html,'clave-inexistente'),/ya no existe/);

// Guardar → reabrir → exportar (ZIP real del proyecto)
const site=F.siteFromHtml(html,'Estudio Ficticio');
const zip=F.siteZip(site);
const reopened=F.siteFromZip(zip);
assert.deepEqual(names(reopened.html),names(html),'Reabrir recupera la misma estructura');
assert.deepEqual(keys(reopened.html),keys(html));
const exported=F.htmlForExport(reopened);
assert.ok(exported.includes('Nuestros servicios'));
assert.ok(exported.includes('data-wc-section'));
assert.ok(!exported.includes('data-wayup-edit'),'La exportación no incluye marcas del editor');

// Seguridad: no se duplican bloques con código activo
const active=S.ensureSectionKeys('<!DOCTYPE html><html><head></head><body><section id="a"><h2>A</h2><script>alert(1)</script></section></body></html>');
assert.throws(()=>S.duplicateSection(active,S.listSections(active)[0].key),/código activo/);

console.log('Correcto: secciones reales — crear (antes/después/dentro/final), mover, duplicar, renombrar, eliminar, deshacer, reabrir y exportar.');
