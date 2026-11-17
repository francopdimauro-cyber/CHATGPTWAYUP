/**
 * Operaciones de edición sobre elementos del HTML REAL (no capas de demostración).
 * Todas parten del HTML serializado y devuelven HTML nuevo + el índice editable resultante,
 * así participan en deshacer/rehacer, guardado y exportación. Las entradas se validan:
 * nada de scripts, manejadores on*, url() externas ni expresiones CSS peligrosas.
 */
import {editableHtmlNodes,safeSiteLink} from './web-project-files';

export type EditResult={html:string;index:number|null};

function parse(html:string):Document{return new DOMParser().parseFromString(html,'text/html');}
function serialize(doc:Document):string{return '<!DOCTYPE html>\n'+doc.documentElement.outerHTML;}
function nodeAt(doc:Document,index:number):HTMLElement{
  const node=Number.isSafeInteger(index)&&index>=0?editableHtmlNodes(doc)[index]:undefined;
  if(!node)throw Error('El elemento seleccionado ya no existe.');
  return node;
}
function indexOf(doc:Document,node:Element|null):number|null{
  if(!node)return null;
  const i=editableHtmlNodes(doc).indexOf(node as HTMLElement);
  return i>=0?i:null;
}
function shortId():string{return crypto.randomUUID().replace(/-/g,'').slice(0,6);}

/* ── Estilos ─────────────────────────────────────────────────────────────── */
/** Propiedades CSS que el Inspector puede modificar en línea. */
export const EDITABLE_STYLE_PROPS=[
  'color','background-color','background-image','background-size','background-position','background-repeat',
  'font-family','font-size','font-weight','font-style','line-height','letter-spacing','text-align','text-transform','text-decoration-line',
  'border-width','border-style','border-color','border-radius','border-top-left-radius','border-top-right-radius','border-bottom-left-radius','border-bottom-right-radius',
  'box-shadow','opacity',
  'margin-top','margin-right','margin-bottom','margin-left','padding-top','padding-right','padding-bottom','padding-left',
  'width','height','min-width','max-width','min-height','max-height',
  'display','flex-direction','flex-wrap','justify-content','align-items','gap','grid-template-columns','grid-template-rows',
  'position','top','right','bottom','left','z-index','translate','overflow','object-fit','object-position','aspect-ratio'
] as const;
export type StyleProp=typeof EDITABLE_STYLE_PROPS[number];
const ALLOWED=new Set<string>(EDITABLE_STYLE_PROPS);
const ENUMS:Partial<Record<StyleProp,string[]>>={
  'font-style':['normal','italic'],'text-align':['left','center','right','justify','start','end'],
  'text-transform':['none','uppercase','lowercase','capitalize'],'text-decoration-line':['none','underline','line-through','overline'],
  'border-style':['none','solid','dashed','dotted','double'],'background-size':['auto','cover','contain'],
  'background-repeat':['repeat','no-repeat','repeat-x','repeat-y'],
  'display':['block','inline','inline-block','flex','inline-flex','grid','none'],
  'flex-direction':['row','row-reverse','column','column-reverse'],'flex-wrap':['nowrap','wrap'],
  'justify-content':['flex-start','center','flex-end','space-between','space-around','space-evenly','start','end'],
  'align-items':['stretch','flex-start','center','flex-end','baseline','start','end'],
  'position':['static','relative','absolute','sticky'],'overflow':['visible','hidden','auto','clip'],
  'object-fit':['fill','contain','cover','none','scale-down']
};
/** Valida un valor CSS antes de escribirlo. Devuelve el valor normalizado o lanza un error en castellano. */
export function validateStyle(prop:string,raw:string):string{
  if(!ALLOWED.has(prop))throw Error('Propiedad no editable: '+prop);
  const value=raw.trim();
  if(value==='')return '';
  if(value.length>300||/[;{}<>\\]|expression\s*\(|javascript:|@import|var\s*\(/i.test(value))
    throw Error('Valor no permitido para '+prop+'.');
  const allowed=ENUMS[prop as StyleProp];
  if(allowed&&!allowed.includes(value))throw Error('Valor no permitido para '+prop+'.');
  if(/url\s*\(/i.test(value)){
    // Solo imágenes del propio proyecto (copiadas al ZIP); nunca recursos externos.
    if(prop!=='background-image'||!/^url\(\s*["']?wayup-media\/[\w-]+\.(?:png|jpe?g|webp|gif)["']?\s*\)$/i.test(value))
      throw Error('Solo se admiten imágenes de la biblioteca del proyecto.');
  }
  if(prop==='font-weight'&&!/^(?:[1-9]00|normal|bold)$/.test(value))throw Error('Grosor no válido (100–900).');
  if(prop==='opacity'&&!(Number(value)>=0&&Number(value)<=1))throw Error('La opacidad va de 0 a 1.');
  if(prop==='z-index'&&!/^-?\d{1,4}$/.test(value))throw Error('Capa (z-index) no válida.');
  if(typeof CSS!=='undefined'&&typeof CSS.supports==='function'&&!CSS.supports(prop,value))
    throw Error('«'+value+'» no es un valor válido para '+prop+'.');
  return value;
}
/** Lee el atributo style como mapa propiedad → valor (sin !important). */
function readInline(node:HTMLElement):Map<string,string>{
  const map=new Map<string,string>();
  for(const decl of (node.getAttribute('style')||'').split(';')){
    const at=decl.indexOf(':');if(at<0)continue;
    const prop=decl.slice(0,at).trim().toLowerCase(),value=decl.slice(at+1).replace(/!\s*important\s*$/i,'').trim();
    if(prop&&value)map.set(prop,value);
  }
  return map;
}
export function setStyles(html:string,index:number,styles:Record<string,string>):EditResult{
  const doc=parse(html);const node=nodeAt(doc,index);
  const inline=readInline(node);
  for(const [prop,raw] of Object.entries(styles)){
    const value=validateStyle(prop,raw);
    if(value)inline.set(prop,value);else inline.delete(prop);
    // Texto con relleno degradado (background-clip:text): el color visible lo marca -webkit-text-fill-color.
    if(prop==='color'){if(value)inline.set('-webkit-text-fill-color',value);else inline.delete('-webkit-text-fill-color');}
  }
  // Prioridad «important»: el cambio del usuario gana a reglas !important o muy específicas del CSS original.
  // Los valores ya están validados (sin «;», llaves ni comentarios), así que la reconstrucción es segura.
  const text=[...inline].map(([p,v])=>p+': '+v+' !important').join('; ');
  if(text)node.setAttribute('style',text);else node.removeAttribute('style');
  return {html:serialize(doc),index};
}

/* ── Tipografías ─────────────────────────────────────────────────────────── */
const SYSTEM_FAMILIES=new Set(['serif','sans-serif','monospace','cursive','fantasy','system-ui','ui-sans-serif','ui-serif','ui-monospace','-apple-system',
  'arial','helvetica','helvetica neue','georgia','times new roman','times','verdana','tahoma','trebuchet ms','courier new','segoe ui','palatino','palatino linotype',
  'garamond','century gothic','impact','iowan old style','avenir','avenir next','menlo','consolas','sf mono','gill sans','optima','didot','baskerville']);
/** Primera familia de un valor CSS font-family, sin comillas. */
export function primaryFamily(css:string):string{return (css.split(',')[0]||'').trim().replace(/^["']|["']$/g,'');}
/** Aplica una tipografía y, si es de Google Fonts (licencia libre), enlaza su hoja para que se vea igual en el editor y al exportar. */
export function setFont(html:string,index:number,familyCss:string):EditResult{
  const family=primaryFamily(familyCss);
  if(!family||family.length>60||!/^[\p{L}\p{N} ._-]+$/u.test(family))throw Error('Nombre de tipografía no válido.');
  const rest=familyCss.split(',').slice(1).map(x=>x.trim()).filter(Boolean).join(', ');
  const value=(/\s/.test(family)?"'"+family+"'":family)+', '+(rest||'sans-serif');
  const styled=setStyles(html,index,{'font-family':value});
  if(SYSTEM_FAMILIES.has(family.toLowerCase())||family.startsWith('WAYUP '))return styled;
  const doc=parse(styled.html);
  const href='https://fonts.googleapis.com/css2?family='+encodeURIComponent(family).replace(/%20/g,'+')+':ital,wght@0,400;0,700;1,400&display=swap';
  const exists=Array.from(doc.head.querySelectorAll('link[rel="stylesheet"]')).some(l=>(l.getAttribute('href')||'').includes('family='+encodeURIComponent(family).replace(/%20/g,'+')));
  if(!exists){
    const link=doc.createElement('link');link.setAttribute('rel','stylesheet');link.setAttribute('href',href);link.setAttribute('data-wc-font',family);
    doc.head.append(link);
  }
  return {html:serialize(doc),index};
}

/* ── Texto enriquecido en línea ──────────────────────────────────────────── */
const INLINE_TAGS=new Set(['B','STRONG','I','EM','U','S','BR','SPAN','A','SMALL','SUP','SUB','MARK','CODE']);
/** ¿Se puede editar este elemento como texto directo? (sin bloques ni medios dentro) */
export function isTextEditable(el:Element):boolean{
  if(['IMG','INPUT','TEXTAREA','SELECT','VIDEO','PICTURE','SVG','IFRAME','FORM'].includes(el.tagName))return false;
  if(!(el.textContent||'').trim())return false;
  return Array.from(el.querySelectorAll('*')).every(x=>INLINE_TAGS.has(x.tagName));
}
function sanitizeInline(doc:Document,source:string):DocumentFragment{
  const holder=doc.createElement('div');holder.innerHTML=source.slice(0,20000);
  const walk=(el:Element)=>{
    for(const child of Array.from(el.children)){
      if(!INLINE_TAGS.has(child.tagName)){child.replaceWith(doc.createTextNode(child.textContent||''));continue;}
      for(const attr of Array.from(child.attributes)){
        const keep=(child.tagName==='A'&&(attr.name==='href'&&safeSiteLink(attr.value)||attr.name==='target'||attr.name==='rel'))||attr.name==='class';
        if(!keep)child.removeAttribute(attr.name);
      }
      if(child.tagName==='A'&&child.getAttribute('target')==='_blank')child.setAttribute('rel','noopener noreferrer');
      walk(child);
    }
  };
  walk(holder);
  const frag=doc.createDocumentFragment();
  while(holder.firstChild)frag.append(holder.firstChild);
  return frag;
}
export function setInlineContent(html:string,index:number,content:string):EditResult{
  const doc=parse(html);const node=nodeAt(doc,index);
  if(!isTextEditable(node))throw Error('Este bloque contiene otros elementos: edita cada texto por separado.');
  node.replaceChildren(sanitizeInline(doc,content));
  if(!(node.textContent||'').trim())throw Error('El texto no puede quedar vacío. Usa «Eliminar» si quieres quitar el elemento.');
  return {html:serialize(doc),index};
}

/* ── Atributos ───────────────────────────────────────────────────────────── */
export function setAttributes(html:string,index:number,attrs:{href?:string;target?:'_self'|'_blank';title?:string;ariaLabel?:string;alt?:string;id?:string}):EditResult{
  const doc=parse(html);const node=nodeAt(doc,index);
  if(attrs.href!==undefined){
    if(node.tagName!=='A')throw Error('Este elemento no es un enlace.');
    if(!safeSiteLink(attrs.href))throw Error('Enlace no permitido: usa https://, mailto:, tel:, un ancla (#) o una ruta del proyecto.');
    node.setAttribute('href',attrs.href.trim());
  }
  if(attrs.target!==undefined){
    if(node.tagName!=='A')throw Error('Este elemento no es un enlace.');
    if(attrs.target==='_blank'){node.setAttribute('target','_blank');node.setAttribute('rel','noopener noreferrer');}
    else{node.removeAttribute('target');}
  }
  const text=(v:string,max:number)=>v.replace(/[\u0000-\u001f]/g,'').slice(0,max);
  if(attrs.title!==undefined){if(attrs.title.trim())node.setAttribute('title',text(attrs.title,200));else node.removeAttribute('title');}
  if(attrs.ariaLabel!==undefined){if(attrs.ariaLabel.trim())node.setAttribute('aria-label',text(attrs.ariaLabel,200));else node.removeAttribute('aria-label');}
  if(attrs.alt!==undefined){if(node.tagName!=='IMG')throw Error('Este elemento no es una imagen.');node.setAttribute('alt',text(attrs.alt,250));}
  if(attrs.id!==undefined){
    const id=attrs.id.trim();
    if(id&&!/^[A-Za-z][\w-]{0,63}$/.test(id))throw Error('Identificador no válido: letras, números, guiones; empieza por letra.');
    if(id&&doc.getElementById(id)&&doc.getElementById(id)!==node)throw Error('Ya existe otro elemento con el identificador «'+id+'».');
    if(id)node.id=id;else node.removeAttribute('id');
  }
  return {html:serialize(doc),index};
}

/* ── Estructura: portapapeles, duplicar, ocultar, ordenar ────────────────── */
function stripActive(root:Element):void{
  for(const el of [root,...Array.from(root.querySelectorAll('*'))]){
    if(['SCRIPT','IFRAME','OBJECT','EMBED','BASE','META','LINK'].includes(el.tagName)){el.remove();continue;}
    for(const attr of Array.from(el.attributes)){
      if(/^on/i.test(attr.name)||attr.name==='srcdoc'||/^\s*javascript:/i.test(attr.value))el.removeAttribute(attr.name);
      if(attr.name.startsWith('data-wayup-'))el.removeAttribute(attr.name);
    }
  }
}
function uniquifyIds(doc:Document,root:Element):void{
  const suffix='-'+shortId(),map=new Map<string,string>();
  for(const el of [root,...Array.from(root.querySelectorAll('[id]'))]){
    if(el.id&&doc.getElementById(el.id)){const n=el.id+suffix;map.set(el.id,n);el.id=n;}
  }
  for(const el of [root,...Array.from(root.querySelectorAll('*'))]){
    const href=el.getAttribute('href');
    if(href?.startsWith('#')&&map.has(href.slice(1)))el.setAttribute('href','#'+map.get(href.slice(1)));
    for(const a of ['for','aria-labelledby','aria-describedby','aria-controls']){
      const v=el.getAttribute(a);if(v)el.setAttribute(a,v.split(/\s+/).map(x=>map.get(x)||x).join(' '));
    }
    if(el!==root&&el.hasAttribute('data-wc-section'))el.removeAttribute('data-wc-section');
  }
  if(root.hasAttribute('data-wc-section'))root.setAttribute('data-wc-section',(root.getAttribute('data-wc-section')||'seccion')+suffix);
}
/** HTML del elemento para el portapapeles interno (sin código activo). */
export function copyElement(html:string,index:number):string{
  const doc=parse(html);const node=nodeAt(doc,index);
  const copy=node.cloneNode(true) as HTMLElement;stripActive(copy);
  return copy.outerHTML;
}
export type DropPosition='before'|'after'|'inside';
/** Elementos que nunca pueden contener otros (vacíos o de texto/medios). */
const NO_CHILDREN=new Set(['IMG','INPUT','BR','HR','TEXTAREA','SELECT','VIDEO','AUDIO','IFRAME','SVG','PICTURE','SOURCE']);
export function canContain(el:Element):boolean{return !NO_CHILDREN.has(el.tagName)&&!['P','H1','H2','H3','H4','H5','H6','A','BUTTON','SPAN','LABEL','LI'].includes(el.tagName);}
function place(doc:Document,piece:Element,targetIndex:number|null,position:DropPosition):void{
  if(targetIndex===null){(doc.querySelector('main')||doc.body).append(piece);return;}
  const target=nodeAt(doc,targetIndex);
  if(position==='inside'){
    if(!canContain(target))throw Error('No se puede colocar dentro de este elemento: elige antes o después.');
    target.append(piece);
  }else if(position==='before')target.before(piece);else target.after(piece);
}
/** Inserta un fragmento HTML (pegado o de la biblioteca) saneado y con IDs únicos. */
export function insertSnippet(html:string,targetIndex:number|null,snippet:string,position:DropPosition='after'):EditResult{
  if(!snippet||snippet.length>400000)throw Error('No hay nada que insertar.');
  const doc=parse(html);
  const holder=doc.createElement('div');holder.innerHTML=snippet;
  const piece=holder.firstElementChild;
  if(!piece)throw Error('El contenido no es válido.');
  stripActive(piece);
  uniquifyIds(doc,piece);
  place(doc,piece,targetIndex,position);
  return {html:serialize(doc),index:indexOf(doc,piece)};
}
export function pasteElement(html:string,targetIndex:number|null,clip:string,position:'after'|'inside'='after'):EditResult{
  if(!clip)throw Error('No hay nada que pegar.');
  return insertSnippet(html,targetIndex,clip,position);
}
/** Mueve un elemento a otra posición del documento (arrastrar para reordenar). */
export function moveElementTo(html:string,index:number,targetIndex:number,position:DropPosition):EditResult{
  const doc=parse(html);const node=nodeAt(doc,index);const target=nodeAt(doc,targetIndex);
  if(node===target||node.contains(target))throw Error('No se puede mover un elemento dentro de sí mismo.');
  if(position==='inside'&&!canContain(target))throw Error('No se puede colocar dentro de este elemento.');
  if(position==='inside')target.append(node);else if(position==='before')target.before(node);else target.after(node);
  return {html:serialize(doc),index:indexOf(doc,node)};
}
export function duplicateElement(html:string,index:number):EditResult{
  const doc=parse(html);const node=nodeAt(doc,index);
  if(node===doc.body)throw Error('No se puede duplicar el documento.');
  if(node.querySelector('script,iframe,object,embed'))throw Error('Contiene código activo: revísalo en Código antes de duplicarlo.');
  const copy=node.cloneNode(true) as HTMLElement;
  uniquifyIds(doc,copy);
  node.after(copy);
  return {html:serialize(doc),index:indexOf(doc,copy)};
}
export function removeElement(html:string,index:number):EditResult{
  const doc=parse(html);const node=nodeAt(doc,index);
  const parent=node.parentElement;
  node.remove();
  return {html:serialize(doc),index:parent&&parent!==doc.body?indexOf(doc,parent):null};
}
export function moveElement(html:string,index:number,direction:'up'|'down'):EditResult{
  const doc=parse(html);const node=nodeAt(doc,index);
  const sibling=direction==='up'?node.previousElementSibling:node.nextElementSibling;
  if(!sibling)throw Error(direction==='up'?'Ya es el primero de su contenedor.':'Ya es el último de su contenedor.');
  if(direction==='up')sibling.before(node);else sibling.after(node);
  return {html:serialize(doc),index:indexOf(doc,node)};
}
/** Ocultar/mostrar sin perder el elemento: atributo hidden estándar + marca para el editor. */
export function toggleHidden(html:string,index:number):EditResult&{hidden:boolean}{
  const doc=parse(html);const node=nodeAt(doc,index);
  const hidden=!node.hasAttribute('data-wc-hidden');
  if(hidden){node.setAttribute('data-wc-hidden','true');node.setAttribute('hidden','');}
  else{node.removeAttribute('data-wc-hidden');node.removeAttribute('hidden');}
  return {html:serialize(doc),index,hidden};
}
export function parentIndex(html:string,index:number):number|null{
  const doc=parse(html);const node=nodeAt(doc,index);
  return node.parentElement&&node.parentElement!==doc.body?indexOf(doc,node.parentElement):null;
}

/* ── SEO de la página ────────────────────────────────────────────────────── */
export type PageSeo={title:string;description:string;lang:string;ogTitle:string;ogDescription:string;canonical:string;robots:string};
export function readSeo(html:string):PageSeo{
  const doc=parse(html);
  const meta=(sel:string)=>doc.head.querySelector(sel)?.getAttribute('content')||'';
  return {title:doc.title||'',description:meta('meta[name="description"]'),lang:doc.documentElement.lang||'',
    ogTitle:meta('meta[property="og:title"]'),ogDescription:meta('meta[property="og:description"]'),
    canonical:doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href')||'',robots:meta('meta[name="robots"]')};
}
export function writeSeo(html:string,seo:PageSeo):string{
  const doc=parse(html);
  const clean=(v:string,max:number)=>v.replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,max);
  if(seo.lang&&!/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(seo.lang))throw Error('Idioma no válido (ej. es, es-ES, en).');
  if(seo.canonical&&!/^https:\/\/[^\s"'<>]+$/.test(seo.canonical))throw Error('La URL canónica debe empezar por https://');
  if(seo.robots&&!/^(?:index|noindex)(?:,\s*(?:follow|nofollow))?$/.test(seo.robots))throw Error('Valor de robots no válido.');
  let title=doc.head.querySelector('title');
  if(!title){title=doc.createElement('title');doc.head.append(title);}
  title.textContent=clean(seo.title,70);
  const upsert=(attr:'name'|'property',key:string,value:string)=>{
    let el=doc.head.querySelector(`meta[${attr}="${key}"]`);
    if(!value){el?.remove();return;}
    if(!el){el=doc.createElement('meta');el.setAttribute(attr,key);doc.head.append(el);}
    el.setAttribute('content',value);
  };
  upsert('name','description',clean(seo.description,180));
  upsert('property','og:title',clean(seo.ogTitle,90));
  upsert('property','og:description',clean(seo.ogDescription,200));
  upsert('name','robots',seo.robots);
  let link=doc.head.querySelector('link[rel="canonical"]');
  if(seo.canonical){if(!link){link=doc.createElement('link');link.setAttribute('rel','canonical');doc.head.append(link);}link.setAttribute('href',seo.canonical);}
  else link?.remove();
  if(seo.lang)doc.documentElement.lang=seo.lang;
  return serialize(doc);
}
/** Avisos SEO deterministas (sin IA): longitud de título/descripción, un único H1, imágenes sin alt. */
export function seoChecks(html:string):string[]{
  const doc=parse(html),out:string[]=[];
  const t=(doc.title||'').trim().length,d=(doc.head.querySelector('meta[name="description"]')?.getAttribute('content')||'').trim().length;
  if(!t)out.push('Falta el título de la página.');else if(t<20||t>65)out.push('El título tiene '+t+' caracteres (recomendado 20–65).');
  if(!d)out.push('Falta la metadescripción.');else if(d<70||d>165)out.push('La metadescripción tiene '+d+' caracteres (recomendado 70–165).');
  const h1=doc.querySelectorAll('h1').length;
  if(h1===0)out.push('No hay ningún título principal (H1).');else if(h1>1)out.push('Hay '+h1+' títulos H1; lo recomendable es uno.');
  const noAlt=Array.from(doc.querySelectorAll('img')).filter(i=>!i.hasAttribute('alt')).length;
  if(noAlt)out.push(noAlt+' imagen(es) sin texto alternativo.');
  if(!doc.documentElement.lang)out.push('Falta el idioma del documento (lang).');
  return out;
}

/* ── Agrupar y separar ───────────────────────────────────────────────────── */
/** Agrupa varios elementos en un contenedor «Grupo», en la posición del primero y en su orden de documento. */
export function groupElements(html:string,indices:number[]):EditResult{
  const unique=Array.from(new Set(indices)).filter(i=>Number.isSafeInteger(i));
  if(unique.length<2)throw Error('Selecciona al menos dos elementos para agrupar (Mayús + clic).');
  const doc=parse(html);
  let nodes=unique.map(i=>nodeAt(doc,i));
  // Si se seleccionó un elemento y también algo que contiene, se queda solo el exterior.
  nodes=nodes.filter(n=>!nodes.some(o=>o!==n&&o.contains(n)));
  if(nodes.some(n=>n===doc.body))throw Error('No se puede agrupar el documento completo.');
  if(nodes.length<2)throw Error('Los elementos seleccionados están uno dentro del otro.');
  nodes.sort((a,b)=>a.compareDocumentPosition(b)&4?-1:1);
  const group=doc.createElement('div');
  group.setAttribute('data-wc-group','true');
  group.setAttribute('data-wc-name','Grupo');
  nodes[0].before(group);
  for(const n of nodes)group.append(n);
  return {html:serialize(doc),index:indexOf(doc,group)};
}
/** Separa un grupo: sus elementos vuelven al sitio del grupo y el contenedor desaparece. */
export function ungroupElement(html:string,index:number):EditResult{
  const doc=parse(html);const node=nodeAt(doc,index);
  const group=node.hasAttribute('data-wc-group')?node:node.closest('[data-wc-group]');
  if(!group)throw Error('El elemento seleccionado no está en un grupo.');
  const first=group.firstElementChild;
  while(group.firstChild)group.before(group.firstChild);
  group.remove();
  return {html:serialize(doc),index:indexOf(doc,first)};
}

/* ── Botones: «Cambiar botón» ────────────────────────────────────────────── */
/** Cambia el diseño, color, tamaño e icono de un botón sin tocar sus clases, id ni atributos de comportamiento.
 *  design: id de BUTTON_DESIGNS o null para volver al diseño original de la web. icon: SVG en línea propio o null. */
export function changeButton(html:string,index:number,opts:{design?:string|null;color?:string;textColor?:string;size?:'s'|'m'|'l';
  icon?:string|null;iconPosition?:'before'|'after';text?:string;css:string}):EditResult{
  const doc=parse(html);const node=nodeAt(doc,index);
  if(opts.design!==undefined){
    if(opts.design===null){
      node.removeAttribute('data-wc-btn');node.removeAttribute('data-wc-btn-size');
      node.style.removeProperty('--wcb-c');node.style.removeProperty('--wcb-t');
      node.querySelectorAll('[data-wc-btn-icon]').forEach(n=>n.remove());
      if(!node.getAttribute('style')?.trim())node.removeAttribute('style');
      return {html:serialize(doc),index:indexOf(doc,node)??index};
    }
    if(!/^[a-z]{3,20}$/.test(opts.design))throw Error('Diseño de botón no válido.');
    node.setAttribute('data-wc-btn',opts.design);
  }
  const hex=(v:string|undefined,what:string)=>{if(v===undefined)return undefined;if(!/^#[\da-f]{6}$/i.test(v))throw Error('Color '+what+' no válido (usa #rrggbb).');return v.toLowerCase();};
  const c=hex(opts.color,'del botón'),t=hex(opts.textColor,'del texto');
  if(c)node.style.setProperty('--wcb-c',c);
  if(t)node.style.setProperty('--wcb-t',t);
  if(opts.size){if(!['s','m','l'].includes(opts.size))throw Error('Tamaño no válido.');node.setAttribute('data-wc-btn-size',opts.size);}
  if(opts.text!==undefined){
    const text=opts.text.replace(/[ -]/g,' ').trim().slice(0,120);
    if(!text)throw Error('El botón necesita un texto.');
    // Se conserva el icono propio; el resto del contenido se sustituye por el texto nuevo.
    const icons=Array.from(node.querySelectorAll('[data-wc-btn-icon]'));
    const before=icons.length>0&&node.firstElementChild===icons[0];
    node.textContent=text;
    for(const ic of icons){if(before)node.prepend(ic);else node.append(ic);}
  }
  if(opts.icon!==undefined){
    node.querySelectorAll('[data-wc-btn-icon]').forEach(n=>n.remove());
    if(opts.icon){
      if(!/^<svg[\s>]/i.test(opts.icon.trim())||opts.icon.length>8000)throw Error('Icono no válido.');
      const holder=doc.createElement('span');holder.innerHTML=opts.icon;
      const svg=holder.querySelector('svg');if(!svg)throw Error('Icono no válido.');
      stripActive(svg);
      const wrap=doc.createElement('span');wrap.setAttribute('data-wc-btn-icon','');wrap.setAttribute('aria-hidden','true');wrap.append(svg);
      if(opts.iconPosition==='before')node.prepend(wrap);else node.append(wrap);
    }
  }
  // Hoja de estilos de los diseños: una sola vez en el <head>, regenerada si cambia de versión.
  let sheet=doc.head.querySelector<HTMLStyleElement>('style[data-wc-buttons]');
  if(!sheet){sheet=doc.createElement('style');sheet.setAttribute('data-wc-buttons','');doc.head.append(sheet);}
  if(sheet.textContent!==opts.css)sheet.textContent=opts.css;
  return {html:serialize(doc),index:indexOf(doc,node)??index};
}
/** Convierte un <button> en enlace <a> conservando su contenido, clases, id y atributos (salvo los propios de formulario). */
export function buttonToLink(html:string,index:number):EditResult{
  const doc=parse(html);const node=nodeAt(doc,index);
  if(node.tagName==='A')return {html,index};
  if(node.tagName!=='BUTTON')throw Error('Este elemento no es un botón.');
  if(node.closest('form')&&(node.getAttribute('type')||'submit')==='submit')throw Error('Es el botón de envío de un formulario: convertirlo lo dejaría sin enviar.');
  const a=doc.createElement('a');
  for(const attr of Array.from(node.attributes))if(!/^(type|form\w*|disabled|name|value)$/i.test(attr.name))a.setAttribute(attr.name,attr.value);
  a.setAttribute('href','#');
  while(node.firstChild)a.append(node.firstChild);
  node.replaceWith(a);
  return {html:serialize(doc),index:indexOf(doc,a)??index};
}

/* ── Símbolos: «Cambiar símbolo» ─────────────────────────────────────────── */
/** Sustituye el dibujo SVG de un símbolo o icono conservando su tamaño en pantalla, clases y estilo.
 *  size: tamaño renderizado del SVG original (px); color: color visible del original (si lo tenía fijado dentro del SVG). */
export function replaceSymbol(html:string,index:number,opts:{svg:string;name:string;size?:{w:number;h:number};color?:string}):EditResult{
  const doc=parse(html);const node=nodeAt(doc,index);
  const old=node.tagName.toLowerCase()==='svg'?node:node.querySelector('svg');
  if(!old)throw Error('Este elemento no contiene ningún símbolo.');
  if(!/^<svg[\s>]/i.test(opts.svg.trim())||opts.svg.length>8000)throw Error('Símbolo no válido.');
  const holder=doc.createElement('span');holder.innerHTML=opts.svg;
  const svg=holder.querySelector('svg');if(!svg)throw Error('Símbolo no válido.');
  stripActive(svg);
  // Se conservan las clases y el estilo del SVG original (tamaño, márgenes, animaciones de la web…).
  for(const a of ['class','style'])if(old.getAttribute(a))svg.setAttribute(a,old.getAttribute(a)!);
  const w=opts.size?.w,h=opts.size?.h;
  const ok=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<2000;
  if(ok(w)&&ok(h)){svg.setAttribute('width',String(Math.round(w!)));svg.setAttribute('height',String(Math.round(h!)));}
  else{for(const a of ['width','height'])if(old.getAttribute(a))svg.setAttribute(a,old.getAttribute(a)!);}
  // Los símbolos son de trazo: se fija en línea para que las reglas «fill» de la web no los rellenen.
  svg.style.setProperty('fill','none');svg.style.setProperty('stroke','currentColor');
  if(opts.color&&/^#[\da-f]{6}$/i.test(opts.color))svg.style.setProperty('color',opts.color);
  svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  old.replaceWith(svg);
  if(node.hasAttribute('data-wc-symbol')){
    const label=opts.name.replace(/[^a-z0-9-]/gi,'').slice(0,60);
    node.setAttribute('data-wc-symbol',label);node.setAttribute('aria-label',label.replace(/-/g,' '));
    node.setAttribute('data-wc-name','Símbolo · '+label.replace(/-/g,' '));
  }
  return {html:serialize(doc),index:indexOf(doc,node)??index};
}

/** «Cambiar imagen»: sustituye la foto de un <img> (o solo ajusta encuadre y filtros) sin tocar sus clases, id ni
 *  el resto de atributos. La caja se mantiene fijando aspect-ratio + object-fit; el encuadre móvil va en una regla
 *  propia de la página para esa imagen. */
export type ImageChange={src?:string;original?:string|null;crop?:string|null;aspect?:number|null;fit?:'cover'|'contain';
  position:string;positionMobile?:string|null;filter:string;alt?:string;credit?:{text:string;link:string}|null};
const POS_RE=/^\d{1,3}% \d{1,3}%$/;
const FILTER_RE=/^(?:(?:brightness|contrast|saturate|grayscale|sepia)\(\d+(?:\.\d+)?\)\s*){0,5}$/;
const ASSET_RE=/^[\w\-./]+\.(?:png|jpe?g|webp|gif)$/i;
export function changeImage(html:string,index:number,o:ImageChange):EditResult{
  const doc=parse(html);const node=nodeAt(doc,index);
  if(node.tagName!=='IMG')throw Error('Selecciona una imagen.');
  if(o.src!==undefined){
    if(!ASSET_RE.test(o.src)||o.src.includes('..'))throw Error('Ruta de imagen no válida.');
    node.setAttribute('src',o.src);
    // srcset/sizes y las <source> de <picture> harían que el navegador siguiera mostrando la foto antigua.
    node.removeAttribute('srcset');node.removeAttribute('sizes');node.removeAttribute('data-wc-ai-image');
    if(node.parentElement?.tagName==='PICTURE')for(const s of Array.from(node.parentElement.querySelectorAll(':scope > source')))s.remove();
    // original: ruta → se guarda; null → se quita; sin indicar → se conserva el que hubiera.
    if(o.original===null)node.removeAttribute('data-wc-img-original');
    else if(o.original!==undefined){if(!ASSET_RE.test(o.original)||o.original.includes('..'))throw Error('Ruta de imagen no válida.');node.setAttribute('data-wc-img-original',o.original);}
    if(o.credit===null||o.credit===undefined){node.removeAttribute('data-wc-credit');node.removeAttribute('data-wc-credit-link');}
  }
  if(o.credit){
    node.setAttribute('data-wc-credit',o.credit.text.replace(/[<>]/g,'').slice(0,120));
    if(/^https:\/\//.test(o.credit.link))node.setAttribute('data-wc-credit-link',o.credit.link.slice(0,300));
  }
  if(o.crop===null)node.removeAttribute('data-wc-crop');
  else if(o.crop&&/^[\d.]+,[\d.]+,[\d.]+,[\d.]+$/.test(o.crop))node.setAttribute('data-wc-crop',o.crop);
  if(typeof o.aspect==='number'&&Number.isFinite(o.aspect)&&o.aspect>0.05&&o.aspect<20){
    node.style.setProperty('aspect-ratio',String(Number(o.aspect.toFixed(4))));
  }
  node.style.setProperty('object-fit',o.fit==='contain'?'contain':'cover');
  if(!POS_RE.test(o.position))throw Error('Encuadre no válido.');
  if(o.position==='50% 50%')node.style.removeProperty('object-position');else node.style.setProperty('object-position',o.position);
  const filter=o.filter.trim();
  if(!FILTER_RE.test(filter))throw Error('Filtro no válido.');
  if(filter)node.style.setProperty('filter',filter);else node.style.removeProperty('filter');
  if(o.alt!==undefined)node.setAttribute('alt',o.alt.replace(/\s+/g,' ').trim().slice(0,200));
  // Encuadre propio en móvil.
  let id=node.getAttribute('data-wc-img')||'';
  const oldRule=id?doc.head.querySelector('style[data-wc-img-style="'+id+'"]'):null;
  if(o.positionMobile&&POS_RE.test(o.positionMobile)&&o.positionMobile!==o.position){
    if(!/^[a-z0-9]{6}$/.test(id)){id=shortId();node.setAttribute('data-wc-img',id);}
    const rule=oldRule||doc.createElement('style');
    rule.setAttribute('data-wc-img-style',id);
    rule.textContent='@media (max-width:640px){img[data-wc-img="'+id+'"]{object-position:'+o.positionMobile+'!important}}';
    if(!oldRule)doc.head.append(rule);
  }else if(oldRule)oldRule.remove();
  return {html:serialize(doc),index:indexOf(doc,node)??index};
}
/** Encuadre móvil guardado para una imagen (o null). */
export function mobilePosition(html:string,index:number):string|null{
  const doc=parse(html);const node=nodeAt(doc,index);const id=node.getAttribute('data-wc-img');
  if(!id)return null;
  const m=/object-position:(\d{1,3}% \d{1,3}%)/.exec(doc.head.querySelector('style[data-wc-img-style="'+id+'"]')?.textContent||'');
  return m?m[1]:null;
}
