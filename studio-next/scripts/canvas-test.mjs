// Pruebas del Canvas: biblioteca de bloques, inserción por posición y mover arrastrando (datos ficticios).
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {DOMParser} from 'linkedom';

globalThis.DOMParser=DOMParser;
const root=resolve(import.meta.dirname,'..');
const tmp=join(root,'.wayup-canvas-test-'+process.pid);
mkdirSync(tmp,{recursive:true});
const emit=name=>writeFileSync(join(tmp,name+'.mjs'),ts.transpileModule(readFileSync(join(root,'lib',name+'.ts'),'utf8'),
  {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '\.\/([\w-]+)'/g,"from './$1.mjs'"));
let E,F,B,S;
try{
  for(const n of ['web-project-files','element-editing','canvas-blocks','html-sections'])emit(n);
  F=await import(pathToFileURL(join(tmp,'web-project-files.mjs')).href);
  E=await import(pathToFileURL(join(tmp,'element-editing.mjs')).href);
  B=await import(pathToFileURL(join(tmp,'canvas-blocks.mjs')).href);
  S=await import(pathToFileURL(join(tmp,'html-sections.mjs')).href);
}finally{rmSync(tmp,{recursive:true,force:true})}

const HTML=`<!DOCTYPE html><html lang="es"><head><title>Ficticia</title></head><body><main>
<section id="a" data-wc-section="a"><h2 id="t">Título</h2><p id="p">Texto</p><div id="caja"></div></section>
<section id="b" data-wc-section="b"><h2>Otra</h2></section></main></body></html>`;
const doc=h=>new DOMParser().parseFromString(h,'text/html');
const idx=(h,sel)=>{const d=doc(h);return F.editableHtmlNodes(d).indexOf(d.querySelector(sel));};

// Todos los bloques son HTML válido, sin código activo y con nombre editable
assert.ok(B.CANVAS_BLOCKS.length>=30,'Biblioteca amplia');
for(const b of B.CANVAS_BLOCKS){
  assert.doesNotMatch(b.html,/<script|\son\w+=|javascript:|<iframe|https?:\/\/(?!fonts)/i,b.id+' sin código activo ni recursos externos');
  const r=E.insertSnippet(HTML,idx(HTML,'#p'),b.html,'after');
  const el=F.editableHtmlNodes(doc(r.html))[r.index];
  assert.ok(el,b.id+' queda seleccionado');
  assert.ok(el.getAttribute('data-wc-name')||el.getAttribute('data-wc-section'),b.id+' tiene nombre');
}
for(const c of B.BLOCK_CATEGORIES)assert.ok(B.CANVAS_BLOCKS.some(b=>b.category===c),'Categoría '+c);

// Insertar antes / después / dentro
let r=E.insertSnippet(HTML,idx(HTML,'#p'),B.blockById('boton').html,'before');
assert.equal(doc(r.html).querySelector('#p').previousElementSibling.tagName,'A');
r=E.insertSnippet(HTML,idx(HTML,'#caja'),B.blockById('circulo').html,'inside');
assert.equal(doc(r.html).querySelector('#caja').children.length,1);
assert.throws(()=>E.insertSnippet(HTML,idx(HTML,'#p'),B.blockById('circulo').html,'inside'),/dentro/,'No dentro de un párrafo');

// Insertar dos veces la misma sección: IDs y claves únicas, y aparece en el Explorador
let h=E.insertSnippet(HTML,idx(HTML,'#b'),B.blockById('sec-hero').html,'after').html;
h=E.insertSnippet(h,idx(h,'#b'),B.blockById('sec-hero').html,'after').html;
const ids=[...doc(h).querySelectorAll('[id]')].map(x=>x.id);
assert.equal(new Set(ids).size,ids.length,'IDs únicos');
const keys=S.listSections(S.ensureSectionKeys(h)).map(s=>s.key);
assert.equal(new Set(keys).size,keys.length,'Claves de sección únicas');
assert.equal(S.listSections(h).filter(s=>s.name==='Portada').length,2);

// Mover arrastrando
r=E.moveElementTo(HTML,idx(HTML,'#p'),idx(HTML,'#b h2'),'after');
assert.equal(doc(r.html).querySelector('#b').lastElementChild.id,'p');
r=E.moveElementTo(HTML,idx(HTML,'#t'),idx(HTML,'#caja'),'inside');
assert.equal(doc(r.html).querySelector('#caja').firstElementChild.id,'t');
assert.throws(()=>E.moveElementTo(HTML,idx(HTML,'#a'),idx(HTML,'#p'),'after'),/sí mismo/);
assert.throws(()=>E.moveElementTo(HTML,idx(HTML,'#caja'),idx(HTML,'#t'),'inside'),/dentro/);
assert.equal(E.canContain(doc(HTML).querySelector('#caja')),true);
assert.equal(E.canContain(doc(HTML).querySelector('#t')),false);

// Editar una forma insertada conserva sus propiedades especiales (clip-path) al cambiar otras
h=E.insertSnippet(HTML,idx(HTML,'#p'),B.blockById('triangulo').html,'after');
h=E.setStyles(h.html,h.index,{width:'200px'});
assert.match(doc(h.html).querySelector('[data-wc-name="Triángulo"]').getAttribute('style'),/clip-path: polygon/);

console.log('Correcto: '+B.CANVAS_BLOCKS.length+' bloques seguros, insertar antes/después/dentro, secciones únicas y mover arrastrando.');

// Agrupar y separar
{
  const H=`<!DOCTYPE html><html><head><title>g</title></head><body><main><section id="s"><h2 id="a">A</h2><p id="b">B</p><p id="c">C</p></section></main></body></html>`;
  const i=(h,sel)=>{const d=doc(h);return F.editableHtmlNodes(d).indexOf(d.querySelector(sel));};
  let g=E.groupElements(H,[i(H,'#c'),i(H,'#a')]);
  let d=doc(g.html);
  const grp=d.querySelector('[data-wc-group]');
  assert.ok(grp,'Se crea el grupo');
  assert.deepEqual([...grp.children].map(x=>x.id),['a','c'],'Orden de documento');
  assert.equal(d.querySelector('#s').firstElementChild,grp,'En la posición del primero');
  assert.equal(F.editableHtmlNodes(d)[g.index],grp,'Queda seleccionado el grupo');
  assert.throws(()=>E.groupElements(H,[i(H,'#a')]),/al menos dos/);
  assert.throws(()=>E.groupElements(H,[i(H,'#s'),i(H,'#a')]),/uno dentro del otro/);
  const u=E.ungroupElement(g.html,g.index);
  d=doc(u.html);
  assert.equal(d.querySelector('[data-wc-group]'),null,'El contenedor desaparece');
  assert.deepEqual([...d.querySelector('#s').children].map(x=>x.id),['a','c','b'],'Los elementos quedan en su sitio');
  assert.throws(()=>E.ungroupElement(H,i(H,'#a')),/no está en un grupo/);
  console.log('Correcto: agrupar (orden y posición) y separar.');
}
