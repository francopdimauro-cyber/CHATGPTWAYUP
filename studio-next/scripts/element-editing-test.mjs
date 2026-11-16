// Pruebas de edición de elementos sobre HTML real (datos ficticios).
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {DOMParser} from 'linkedom';

globalThis.DOMParser=DOMParser;
const root=resolve(import.meta.dirname,'..');
const tmp=join(root,'.wayup-element-test-'+process.pid);
mkdirSync(tmp,{recursive:true});
const emit=name=>writeFileSync(join(tmp,name+'.mjs'),ts.transpileModule(readFileSync(join(root,'lib',name+'.ts'),'utf8'),
  {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '\.\/([\w-]+)'/g,"from './$1.mjs'"));
let E,F;
try{
  emit('web-project-files');emit('element-editing');
  F=await import(pathToFileURL(join(tmp,'web-project-files.mjs')).href);
  E=await import(pathToFileURL(join(tmp,'element-editing.mjs')).href);
}finally{rmSync(tmp,{recursive:true,force:true})}

const HTML=`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Web ficticia</title></head><body>
<header><a id="logo" href="#inicio">Marca Ficticia</a></header>
<main><section id="inicio"><h1>Hola <em>mundo</em></h1><p id="p1">Texto de prueba.</p><a href="#inicio">Ir</a><img src="foto.png" alt="Foto"></section></main>
</body></html>`;
const doc=html=>new DOMParser().parseFromString(html,'text/html');
const idx=(html,sel)=>{const d=doc(html);return F.editableHtmlNodes(d).indexOf(d.querySelector(sel));};

// Estilos válidos e inválidos
const p=idx(HTML,'#p1');
let r=E.setStyles(HTML,p,{'font-size':'22px','color':'rgba(10, 20, 30, 0.5)','letter-spacing':'0.04em','margin-top':'12px'});
let el=doc(r.html).querySelector('#p1');
assert.match(el.getAttribute('style'),/font-size: 22px/);
assert.match(el.getAttribute('style'),/letter-spacing/);
r=E.setStyles(r.html,p,{'font-size':''});
assert.doesNotMatch(doc(r.html).querySelector('#p1').getAttribute('style')||'',/font-size/,'Vacío elimina la propiedad');
for(const [prop,val] of [['color','red;background:url(x)'],['background-image','url(https://externo.test/a.png)'],['position','fixed'],['behavior','x'],['width','expression(alert(1))'],['opacity','3']])
  assert.throws(()=>E.setStyles(HTML,p,{[prop]:val}),undefined,prop+'='+val+' debe rechazarse');
assert.doesNotThrow(()=>E.setStyles(HTML,p,{'background-image':'url(wayup-media/abc-123.png)'}));
assert.doesNotThrow(()=>E.setStyles(HTML,p,{'background-image':'linear-gradient(90deg, #000, #fff)','box-shadow':'0 4px 12px rgba(0,0,0,.2)','display':'flex','gap':'16px'}));

// Texto en línea: conserva formato permitido y elimina lo peligroso
const h1=idx(HTML,'h1');
assert.equal(E.isTextEditable(doc(HTML).querySelector('h1')),true);
assert.equal(E.isTextEditable(doc(HTML).querySelector('section')),false);
r=E.setInlineContent(HTML,h1,'Nuevo <strong>título</strong><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)" onclick="x()">mal</a>');
el=doc(r.html).querySelector('h1');
assert.match(el.innerHTML,/<strong>título<\/strong>/);
assert.ok(!/script|onerror|onclick|javascript:|<img/i.test(el.innerHTML),'Sin código activo: '+el.innerHTML);
assert.throws(()=>E.setInlineContent(HTML,h1,'   '),/vacío/);
assert.throws(()=>E.setInlineContent(HTML,idx(HTML,'section'),'x'),/otros elementos/);

// Atributos
const link=idx(HTML,'section a');
r=E.setAttributes(HTML,link,{href:'https://ejemplo.test/contacto',target:'_blank'});
el=doc(r.html).querySelector('section a');
assert.equal(el.getAttribute('rel'),'noopener noreferrer');
assert.throws(()=>E.setAttributes(HTML,link,{href:'javascript:alert(1)'}));
assert.throws(()=>E.setAttributes(HTML,p,{id:'logo'}),/Ya existe/);
assert.throws(()=>E.setAttributes(HTML,idx(HTML,'img'),{alt:undefined,href:'#x'}),/no es un enlace/);

// Duplicar / copiar / pegar con IDs únicos y sin código activo
r=E.duplicateElement(HTML,p);
let ids=[...doc(r.html).querySelectorAll('[id]')].map(x=>x.id);
assert.equal(new Set(ids).size,ids.length,'IDs únicos tras duplicar');
assert.equal(doc(r.html).querySelectorAll('section p').length,2);
assert.ok(r.index>p,'Selecciona la copia');
const clip=E.copyElement(HTML.replace('<p id="p1">','<p id="p1" onclick="alert(1)">'),p);
assert.doesNotMatch(clip,/onclick/);
r=E.pasteElement(HTML,idx(HTML,'header'),clip,'inside');
ids=[...doc(r.html).querySelectorAll('[id]')].map(x=>x.id);
assert.equal(new Set(ids).size,ids.length,'IDs únicos tras pegar');
assert.ok(doc(r.html).querySelector('header p'),'Pegado dentro de la cabecera');
assert.throws(()=>E.pasteElement(HTML,idx(HTML,'img'),clip,'inside'));

// Mover, eliminar, ocultar, contenedor padre
r=E.moveElement(HTML,p,'up');
assert.equal(doc(r.html).querySelector('section').firstElementChild.id,'p1');
assert.throws(()=>E.moveElement(r.html,r.index,'up'),/primero/);
r=E.removeElement(HTML,p);
assert.equal(doc(r.html).querySelector('#p1'),null);
assert.equal(r.index,idx(r.html,'section'),'Selecciona el contenedor tras eliminar');
r=E.toggleHidden(HTML,p);
assert.ok(r.hidden&&doc(r.html).querySelector('#p1').hasAttribute('hidden'));
r=E.toggleHidden(r.html,p);
assert.ok(!r.hidden&&!doc(r.html).querySelector('#p1').hasAttribute('hidden'));
assert.equal(E.parentIndex(HTML,p),idx(HTML,'section'));

// SEO
let html=E.writeSeo(HTML,{title:'Web ficticia de pruebas para Studio',description:'Descripción ficticia suficientemente larga para pasar la comprobación de longitud recomendada.',lang:'es-ES',ogTitle:'OG',ogDescription:'',canonical:'https://ejemplo.test/',robots:'index, follow'});
const seo=E.readSeo(html);
assert.equal(seo.title,'Web ficticia de pruebas para Studio');
assert.equal(seo.lang,'es-ES');
assert.equal(seo.canonical,'https://ejemplo.test/');
assert.equal(doc(html).querySelectorAll('meta[name="description"]').length,1);
assert.throws(()=>E.writeSeo(HTML,{...seo,canonical:'javascript:alert(1)'}));
assert.ok(E.seoChecks(html).some(x=>/imagen|H1|título/.test(x))||E.seoChecks(html).length===0);
assert.ok(E.seoChecks('<!DOCTYPE html><html><head></head><body><h1>a</h1><h1>b</h1><img src=a></body></html>').length>=4);

// Vista previa: oculto atenuado en el editor y oculto en la exportación
const hiddenSite=F.siteFromHtml(E.toggleHidden(HTML,p).html,'Prueba');
assert.match(F.safePreview(hiddenSite).html,/data-wayup-hidden/);
assert.ok(doc(F.htmlForExport(hiddenSite)).querySelector('#p1').hasAttribute('hidden'),'Sigue oculto al exportar');

// Prioridad sobre !important del CSS original y texto con relleno degradado
r=E.setStyles(HTML,p,{color:'#123456'});
el=doc(r.html).querySelector('#p1');
assert.match(el.getAttribute('style'),/color:\s*#123456\s*!important/i,'El color del usuario gana a !important');
assert.match(el.getAttribute('style'),/-webkit-text-fill-color:\s*#123456/i,'Cubre textos con relleno degradado');
// Tipografía: Google Fonts enlazada una sola vez; las del sistema no se enlazan
r=E.setFont(HTML,p,'Playfair Display');
assert.match(doc(r.html).querySelector('#p1').getAttribute('style'),/font-family:\s*'Playfair Display', sans-serif/);
assert.equal(doc(r.html).querySelectorAll('link[data-wc-font]').length,1);
r=E.setFont(r.html,h1,'Playfair Display, serif');
assert.equal(doc(r.html).querySelectorAll('link[href*="Playfair+Display"]').length,1,'No duplica la hoja');
r=E.setFont(HTML,p,'Georgia, serif');
assert.equal(doc(r.html).querySelectorAll('link[data-wc-font]').length,0);
assert.throws(()=>E.setFont(HTML,p,'x"><script>'),/no válido/);
assert.match(F.safePreview(F.siteFromHtml(E.setFont(HTML,p,'Lora').html,'P')).html,/fonts\.googleapis\.com/,'La vista previa conserva Google Fonts');

console.log('Correcto: estilos validados, texto en línea seguro, atributos, copiar/pegar/duplicar, mover, ocultar, eliminar y SEO.');
