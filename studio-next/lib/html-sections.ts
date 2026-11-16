/**
 * Modelo de secciones sobre el HTML REAL del proyecto (no sobre capas de demostración).
 * Cada sección es un bloque de primer nivel del documento (hijo de <body> o de <main>)
 * identificado por un atributo estable data-wc-section. Todas las operaciones parten del
 * HTML serializado, modifican el DOM y devuelven HTML nuevo, de forma que el historial
 * (deshacer/rehacer), el guardado local/nube y la exportación reflejan exactamente el cambio.
 */
import {editableHtmlNodes} from './web-project-files';

export type SectionLayer={index:number;tag:string;label:string;depth:number};
export type HtmlSection={
  key:string;name:string;tag:string;
  /** Índice editable del propio bloque y rango [index,end] de sus descendientes en la vista. */
  index:number;end:number;
  container:boolean;children:SectionLayer[];
};
export type SectionPosition='before'|'after'|'inside'|'end';
export type SectionResult={html:string;key:string};

const SECTION_TAGS=new Set(['HEADER','NAV','SECTION','ARTICLE','ASIDE','FOOTER','DIV','FORM','FIGURE']);
const CONTAINER_TAGS=new Set(['SECTION','ARTICLE','ASIDE','DIV','HEADER','FOOTER','MAIN']);
const LAYER_TAGS=new Set(['HEADER','NAV','SECTION','ARTICLE','ASIDE','FOOTER','DIV','H1','H2','H3','H4','H5','H6','P','A','BUTTON','IMG','FORM','UL','OL','LI','FIGURE','BLOCKQUOTE','SPAN','LABEL','INPUT','TEXTAREA','PICTURE','VIDEO']);
const TAG_NAMES:Record<string,string>={HEADER:'Cabecera',NAV:'Navegación',FOOTER:'Pie de página',ASIDE:'Lateral',FORM:'Formulario',FIGURE:'Figura',ARTICLE:'Artículo',SECTION:'Sección',DIV:'Bloque'};
const KEY_ATTR='data-wc-section';
const NAME_ATTR='data-wc-name';

function parse(html:string):Document{
  const doc=new DOMParser().parseFromString(html,'text/html');
  if(!doc.body)throw Error('El documento no tiene <body>.');
  return doc;
}
function serialize(doc:Document):string{return '<!DOCTYPE html>\n'+doc.documentElement.outerHTML;}
function shortId():string{return crypto.randomUUID().replace(/-/g,'').slice(0,8);}
function slug(text:string):string{
  return text.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);
}
function clean(text:string|null|undefined,max=60):string{return (text||'').replace(/\s+/g,' ').trim().slice(0,max);}

/** Bloques de primer nivel: hijos de <body>, expandiendo <main> y envoltorios únicos. */
function sectionElements(doc:Document):HTMLElement[]{
  const out:HTMLElement[]=[];
  const visit=(parent:Element,depth:number)=>{
    for(const child of Array.from(parent.children) as HTMLElement[]){
      if(child.tagName==='MAIN'){visit(child,depth+1);continue;}
      if(!SECTION_TAGS.has(child.tagName))continue;
      // Envoltorio sin semántica que solo agrupa secciones: se recorre por dentro.
      const kids=Array.from(child.children);
      if(depth<2&&child.tagName==='DIV'&&!child.hasAttribute(KEY_ATTR)&&kids.length>1&&
        kids.filter(k=>['SECTION','HEADER','FOOTER','NAV','MAIN','ARTICLE'].includes(k.tagName)).length>=Math.ceil(kids.length/2)){
        visit(child,depth+1);continue;
      }
      out.push(child);
    }
  };
  visit(doc.body,0);
  return out;
}
/** Texto de un nodo separando hijos y saltos <br> con espacios («Norte<br>a tu manera» → «Norte a tu manera»). */
function spacedText(el:Element|null):string{
  if(!el)return '';
  return Array.from(el.childNodes).map(n=>n.nodeType===1?((n as Element).tagName==='BR'?' ':spacedText(n as Element)):n.textContent||'').join(' ');
}
function sectionName(el:HTMLElement):string{
  return clean(el.getAttribute(NAME_ATTR))||clean(el.getAttribute('aria-label'))||
    (['HEADER','NAV','FOOTER'].includes(el.tagName)?TAG_NAMES[el.tagName]:'')||
    clean(spacedText(el.querySelector('h1,h2,h3')))||
    (el.id?clean(el.id.replace(/[-_]+/g,' ')):'')||TAG_NAMES[el.tagName]||el.tagName;
}
function uniqueKey(doc:Document,base:string):string{
  let key=slug(base)||'seccion';
  const taken=(k:string)=>Array.from(doc.querySelectorAll('['+KEY_ATTR+'],[id]')).some(x=>x.getAttribute(KEY_ATTR)===k||x.id===k);
  if(taken(key))key=key+'-'+shortId();
  while(taken(key))key=slug(base)+'-'+shortId();
  return key;
}
function ensureKeysIn(doc:Document):boolean{
  let changed=false;
  const seen=new Set<string>();
  for(const el of sectionElements(doc)){
    let key=el.getAttribute(KEY_ATTR)||'';
    if(!key||seen.has(key)){
      el.removeAttribute(KEY_ATTR);
      key=uniqueKey(doc,el.id||sectionName(el));
      el.setAttribute(KEY_ATTR,key);changed=true;
    }
    seen.add(key);
  }
  return changed;
}
/** Asigna claves estables a los bloques que no las tienen. Devuelve el mismo HTML si no hace falta. */
export function ensureSectionKeys(html:string):string{
  const doc=parse(html);
  return ensureKeysIn(doc)?serialize(doc):html;
}
function find(doc:Document,key:string):HTMLElement{
  const el=sectionElements(doc).find(x=>x.getAttribute(KEY_ATTR)===key);
  if(!el)throw Error('La sección ya no existe en el documento.');
  return el;
}
function assertIntegrity(doc:Document):void{
  const ids=new Set<string>();
  for(const el of Array.from(doc.querySelectorAll('[id]'))){
    if(ids.has(el.id))throw Error('La operación generaría identificadores duplicados («'+el.id+'»). Se ha cancelado.');
    ids.add(el.id);
  }
  const keys=new Set<string>();
  for(const el of sectionElements(doc)){
    const k=el.getAttribute(KEY_ATTR)||'';
    if(!k||keys.has(k))throw Error('La estructura de secciones no es válida. Se ha cancelado la operación.');
    keys.add(k);
  }
}
function layerLabel(el:HTMLElement):string{
  return clean(el.getAttribute('aria-label')||el.getAttribute('alt')||
    (el.children.length===0?el.textContent:'')||el.getAttribute('placeholder')||el.id,48)||el.tagName.toLowerCase();
}

/** Lista las secciones con sus capas internas y los índices que usa la vista protegida. */
export function listSections(html:string):HtmlSection[]{
  const doc=parse(html);
  const nodes=editableHtmlNodes(doc);
  const position=new Map<Element,number>(nodes.map((n,i)=>[n,i]));
  return sectionElements(doc).map((el,i)=>{
    const index=position.get(el)??-1;
    let end=index;
    const children:SectionLayer[]=[];
    for(let j=index+1;j>0&&j<nodes.length&&el.contains(nodes[j]);j++){
      end=j;
      const node=nodes[j];
      if(!LAYER_TAGS.has(node.tagName)||children.length>=120)continue;
      if(node.tagName==='DIV'&&!node.id&&node.children.length>0&&!node.getAttribute('aria-label'))continue;
      let depth=0,parent=node.parentElement;
      while(parent&&parent!==el){depth++;parent=parent.parentElement;}
      children.push({index:j,tag:node.tagName,label:layerLabel(node),depth:Math.min(4,depth)});
    }
    return {key:el.getAttribute(KEY_ATTR)||'sin-clave-'+i,name:sectionName(el),tag:el.tagName,
      index,end,container:CONTAINER_TAGS.has(el.tagName),children};
  });
}

function newSection(doc:Document):HTMLElement{
  const section=doc.createElement('section');
  const key=uniqueKey(doc,'nueva-seccion');
  section.id=key;
  section.setAttribute(KEY_ATTR,key);
  section.setAttribute(NAME_ATTR,'Nueva sección');
  section.style.cssText='padding:64px 6%;max-width:1200px;margin:0 auto';
  const title=doc.createElement('h2');title.textContent='Nueva sección';
  const text=doc.createElement('p');text.textContent='Edita este contenido desde el inspector.';
  section.append(title,text);
  return section;
}
/** Añade una sección real: al final, antes/después de otra, o un bloque dentro de un contenedor compatible. */
export function addSection(html:string,position:SectionPosition='end',refKey?:string):SectionResult{
  const doc=parse(html);ensureKeysIn(doc);
  if(position==='end'||!refKey){
    const section=newSection(doc);
    const list=sectionElements(doc);
    const footer=[...list].reverse().find(x=>x.tagName==='FOOTER');
    const main=doc.querySelector('main');
    if(main)main.append(section);
    else if(footer&&footer.parentElement===doc.body)footer.before(section);
    else doc.body.append(section);
    assertIntegrity(doc);
    return {html:serialize(doc),key:section.getAttribute(KEY_ATTR)!};
  }
  const ref=find(doc,refKey);
  if(position==='inside'){
    if(!CONTAINER_TAGS.has(ref.tagName))throw Error('«'+sectionName(ref)+'» no admite contenido dentro.');
    const block=doc.createElement('div');
    block.style.cssText='margin:24px 0';
    const title=doc.createElement('h3');title.textContent='Nuevo bloque';
    const text=doc.createElement('p');text.textContent='Contenido del bloque.';
    block.append(title,text);
    ref.append(block);
    assertIntegrity(doc);
    return {html:serialize(doc),key:refKey};
  }
  const section=newSection(doc);
  if(position==='before')ref.before(section);else ref.after(section);
  assertIntegrity(doc);
  return {html:serialize(doc),key:section.getAttribute(KEY_ATTR)!};
}

export function removeSection(html:string,key:string):SectionResult{
  const doc=parse(html);ensureKeysIn(doc);
  const list=sectionElements(doc);
  const el=find(doc,key);
  const at=list.indexOf(el);
  el.remove();
  const next=list[at+1]||list[at-1];
  return {html:serialize(doc),key:next&&next!==el?next.getAttribute(KEY_ATTR)||'':''};
}

const REF_ATTRS=['for','aria-labelledby','aria-describedby','aria-controls','aria-owns','list','form','headers'];
/** Duplica una sección con identificadores únicos y referencias internas coherentes. */
export function duplicateSection(html:string,key:string):SectionResult{
  const doc=parse(html);ensureKeysIn(doc);
  const el=find(doc,key);
  if(el.querySelector('script,iframe,object,embed'))throw Error('Esta sección contiene código activo: revísala en HTML antes de duplicarla.');
  const copy=el.cloneNode(true) as HTMLElement;
  const suffix='-copia-'+shortId();
  const ids=new Map<string,string>();
  for(const item of [copy,...Array.from(copy.querySelectorAll<HTMLElement>('[id]'))]){
    if(item.id){const old=item.id;item.id=old+suffix;ids.set(old,item.id);}
  }
  for(const item of [copy,...Array.from(copy.querySelectorAll<HTMLElement>('*'))]){
    const href=item.getAttribute('href');
    if(href?.startsWith('#')&&ids.has(href.slice(1)))item.setAttribute('href','#'+ids.get(href.slice(1)));
    for(const attr of REF_ATTRS){
      const value=item.getAttribute(attr);
      if(value)item.setAttribute(attr,value.split(/\s+/).map(v=>ids.get(v)||v).join(' '));
    }
    if(item!==copy&&item.hasAttribute(KEY_ATTR))item.removeAttribute(KEY_ATTR);
  }
  const newKey=uniqueKey(doc,key+'-copia');
  copy.setAttribute(KEY_ATTR,newKey);
  copy.setAttribute(NAME_ATTR,(sectionName(el)+' (copia)').slice(0,80));
  el.after(copy);
  assertIntegrity(doc);
  return {html:serialize(doc),key:newKey};
}

/** Cambia el orden real en el DOM respecto a la sección vecina del mismo contenedor. */
export function moveSection(html:string,key:string,direction:'up'|'down'):SectionResult{
  const doc=parse(html);ensureKeysIn(doc);
  const el=find(doc,key);
  const siblings=sectionElements(doc).filter(x=>x.parentElement===el.parentElement);
  const at=siblings.indexOf(el);
  const other=siblings[direction==='up'?at-1:at+1];
  if(!other)throw Error(direction==='up'?'Ya es la primera sección de su contenedor.':'Ya es la última sección de su contenedor.');
  if(direction==='up')other.before(el);else other.after(el);
  return {html:serialize(doc),key};
}

export function renameSection(html:string,key:string,name:string):SectionResult{
  const value=clean(name,80);
  if(!value)throw Error('Escribe un nombre para la sección.');
  const doc=parse(html);ensureKeysIn(doc);
  find(doc,key).setAttribute(NAME_ATTR,value);
  return {html:serialize(doc),key};
}

/** Sección que contiene un índice editable de la vista (para sincronizar Canvas → Explorador). */
export function sectionForIndex(sections:HtmlSection[],index:number|null):HtmlSection|undefined{
  if(index===null)return undefined;
  return sections.find(s=>index>=s.index&&index<=s.end);
}
