import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export type SiteBundle = {
  id: string;
  name: string;
  html: string;
  entry: string;
  assets: Record<string, Uint8Array>;
  version: number;
  updatedAt: number;
  source: 'generated'|'imported';
  agent?: {agentId:string;chatId:string;origin:string;title:string;linkedAt:number};
  versions: { number:number; html:string; savedAt:number }[];
};
export const MAX_IMPORT_BYTES=25_000_000;
const MAX_FILE_BYTES=9_000_000;
const MAX_UNPACKED_BYTES=65_000_000;
const MAX_FILES=180;
export function safePath(path:string):boolean {
  return Boolean(path)&&path.length<240&&!path.startsWith('/')&&!/[\u0000-\u001f\\]/.test(path)&&
    !path.split('/').some(s=>s==='..'||s==='.'||s==='')&&!/^[A-Za-z]:/.test(path);
}
export function assetMime(path:string):string {
  const ext=path.split('.').pop()?.toLowerCase()||'';
  const types:Record<string,string>={html:'text/html',htm:'text/html',css:'text/css',js:'text/javascript',
    jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',
    svg:'image/svg+xml',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',ico:'image/x-icon',
    json:'application/json',avif:'image/avif',txt:'text/plain',webmanifest:'application/manifest+json'};
  return types[ext]||'application/octet-stream';
}
function validateDocument(html:string):void {
  if(html.length<40||html.length>3_000_000||!/<html[\s>]/i.test(html)||!/<body[\s>]/i.test(html))
    throw Error('Necesitamos una página HTML completa con <html> y <body>.');
}
export function siteTitle(html:string):string{
  const doc=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'';
  return doc.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().slice(0,90)||'Web sin título';
}
export function siteFromHtml(html:string,name?:string):SiteBundle {
  validateDocument(html);
  return {id:crypto.randomUUID(),name:name||siteTitle(html),html,entry:'index.html',assets:{},
    version:0,updatedAt:Date.now(),source:'imported',versions:[]};
}
export function siteFromZip(input:Uint8Array):SiteBundle {
  if(input.length>MAX_IMPORT_BYTES)throw Error('El ZIP supera 25 MB.');
  let sum=0,count=0;
  const output=unzipSync(input,{
    filter(file){
      const name=file.name;
      if(name.endsWith('/'))return false;
      if(!safePath(name))throw Error('Archivo con ruta insegura: '+name.slice(0,80));
      count++;
      if(count>MAX_FILES)throw Error('El ZIP contiene demasiados archivos (máximo 180).');
      if(file.originalSize>MAX_FILE_BYTES||sum+file.originalSize>MAX_UNPACKED_BYTES)
        throw Error('El ZIP contiene archivos demasiado grandes.');
      sum+=file.originalSize;
      return true;
    }
  });
  const files=Object.keys(output);
  const entry=files.includes('index.html')?'index.html':files.find(x=>/(^|\/)index\.html$/i.test(x));
  if(!entry)throw Error('El ZIP necesita un archivo index.html.');
  const html=strFromU8(output[entry]);
  validateDocument(html);
  delete output[entry];
  return {id:crypto.randomUUID(),name:siteTitle(html),html,entry,assets:output,
    version:0,updatedAt:Date.now(),source:'imported',versions:[]};
}
export function agentSnippet(chatId:string):string {
  if(!/^[0-9a-f-]{36}$/i.test(chatId))throw Error('Identificador de chat inválido.');
  return '<script src="https://agent-factory-free.francopdimauro.workers.dev/widget.js" data-chat="'+chatId+'" defer></'+'script>';
}
export function htmlForExport(site:SiteBundle,additionalSnippet?:string):string {
  let html=site.html;
  const snippet=additionalSnippet||(site.agent?agentSnippet(site.agent.chatId):undefined);
  if(snippet){
    if(!/^<script src="https:\/\/agent-factory-free\.francopdimauro\.workers\.dev\/widget\.js" data-chat="[a-f0-9-]{36}" defer><\/script>$/i.test(snippet))
      throw Error('Código de agente no autorizado.');
    // Si el cliente reemplaza el agente, no deben publicarse dos widgets activos.
    html=html.replace(/\s*<!--\s*Asistente de WayUp\s*-->\s*<script src="https:\/\/agent-factory-free\.francopdimauro\.workers\.dev\/widget\.js" data-chat="[a-f0-9-]{36}" defer><\/script>/gi,'');
    if(!html.includes(snippet))html=html.replace(/<\/body>/i,'\n<!-- Asistente de WayUp -->\n'+snippet+'\n</body>');
  }
  return html;
}
export function siteZip(site:SiteBundle,additionalSnippet?:string):Uint8Array {
  const archive:Record<string,Uint8Array>={...site.assets};
  const html=htmlForExport(site,additionalSnippet);
  archive[site.entry]=strToU8(html);
  if(site.agent){
    const notice='WayUp Studio — asistente IA vinculado\n\nOrigen autorizado: '+site.agent.origin+'\nTítulo: '+site.agent.title+'\n\nEl chat requiere que el agente esté activo y conectado al backend.\nAl publicar, utiliza exactamente el dominio HTTPS autorizado.\nNunca incluyas claves privadas de IA en el HTML o ZIP.\n';
    archive['WAYUP_AGENT_SETUP.txt']=strToU8(notice);
  }
  if(Object.keys(archive).length>MAX_FILES)throw Error('El proyecto contiene demasiados archivos para exportar.');
  return zipSync(archive,{level:5});
}
export function downloadBytes(bytes:Uint8Array,filename:string,mime:string):void {
  const copy=new Uint8Array(bytes.length);
  copy.set(bytes);
  const url=URL.createObjectURL(new Blob([copy.buffer],{type:mime}));
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function siteWithNewHtml(site:SiteBundle,html:string):SiteBundle {
  validateDocument(html);
  return {...site,html,updatedAt:Date.now()};
}
const DB_NAME='wayup-studio-web-projects-v1';
const STORE='projects';
function openDB():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'});};
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>resolve(request.result);
  });
}
export async function listSavedSites():Promise<SiteBundle[]>{
  const db=await openDB();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly');const request=tx.objectStore(STORE).getAll();
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>resolve((request.result as SiteBundle[]).sort((a,b)=>b.updatedAt-a.updatedAt));
  });}finally{db.close()}
}
export async function saveSite(site:SiteBundle):Promise<SiteBundle>{
  const updated={...site,version:site.version+1,updatedAt:Date.now(),
    versions:[...site.versions,{number:site.version+1,html:site.html,savedAt:Date.now()}].slice(-15)};
  const db=await openDB();
  try{
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');
      tx.objectStore(STORE).put(updated);
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
    return updated;
  }finally{db.close()}
}
export function safePreview(site:SiteBundle):{html:string;revoke():void}{
  const urls:string[]=[];
  const assets:Record<string,string>={};
  for(const [path,data] of Object.entries(site.assets)){
    if(!/\.(?:css|png|jpe?g|webp|gif|ico|avif|woff2?|ttf)$/i.test(path))continue;
    const copy=new Uint8Array(data.length);copy.set(data);
    const url=URL.createObjectURL(new Blob([copy.buffer],{type:assetMime(path)}));
    assets[path]=url;urls.push(url);
  }
  const doc=new DOMParser().parseFromString(site.html,'text/html');
  const eligible=Array.from(doc.body.querySelectorAll<HTMLElement>('*'))
    .filter(node=>!['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','TEMPLATE','LINK','META'].includes(node.tagName));
  eligible.forEach((node,i)=>node.dataset.wayupEdit=String(i));
  for(const node of Array.from(doc.querySelectorAll('script,iframe,object,embed,base,meta[http-equiv],template'))){
    node.remove();
  }
  for(const node of Array.from(doc.querySelectorAll<HTMLElement>('*'))){
    for(const attr of Array.from(node.attributes)){
      if(/^on/i.test(attr.name)||attr.name==='srcdoc')node.removeAttribute(attr.name);
    }
  }
  const lookup=(value:string):string|undefined=>{
    if(/^(?:[a-z]+:|\/\/|#)/i.test(value))return undefined;
    const relative=value.split('?')[0].replace(/^\.\//,'');
    const folder=site.entry.includes('/')?site.entry.slice(0,site.entry.lastIndexOf('/')+1):'';
    return assets[folder+relative]||assets[relative];
  };
  for(const node of Array.from(doc.querySelectorAll('img[src],source[src]'))){
    const url=lookup(node.getAttribute('src')||'');
    if(url)node.setAttribute('src',url);
    else node.removeAttribute('src');
  }
  for(const link of Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))){
    const href=link.getAttribute('href')||'';
    const path=href.split('?')[0].replace(/^\.\//,'');
    const folder=site.entry.includes('/')?site.entry.slice(0,site.entry.lastIndexOf('/')+1):'';
    const bytes=site.assets[folder+path]||site.assets[path];
    if(bytes&&bytes.length<1_000_000){
      const inline=doc.createElement('style');
      inline.textContent=strFromU8(bytes).replace(/@import[^;]+;/gi,'');
      link.replaceWith(inline);
    }else link.remove();
  }
  const csp=doc.createElement('meta');
  csp.httpEquiv='Content-Security-Policy';
  csp.content="default-src 'none'; img-src blob: data:; style-src 'unsafe-inline' blob:; font-src blob: data:; connect-src 'none'; form-action 'none'; object-src 'none'; script-src 'none'; frame-src 'none'; base-uri 'none'";
  doc.head.prepend(csp);
  const previewStyles=doc.createElement('style');
  previewStyles.textContent='[data-wayup-edit]:hover{outline:1px dashed #668dff!important;outline-offset:2px;cursor:crosshair}[data-wayup-edit][data-wayup-selected="true"]{outline:2px solid #4e79ff!important;outline-offset:2px}';
  doc.head.append(previewStyles);
  return {html:'<!DOCTYPE html>\n'+doc.documentElement.outerHTML,revoke:()=>urls.forEach(url=>URL.revokeObjectURL(url))};
}
export const selectableHtmlNode=(doc:Document,index:number):HTMLElement|null=>{
  const elements=Array.from(doc.body.querySelectorAll<HTMLElement>('*'))
    .filter(node=>!['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','TEMPLATE','LINK','META'].includes(node.tagName));
  return elements[index]||null;
};
export function patchSelectedElement(html:string,index:number,changes:{text?:string;color?:string;background?:string;fontSize?:string}):string{
  const doc=new DOMParser().parseFromString(html,'text/html');
  const node=selectableHtmlNode(doc,index);
  if(!node)throw Error('El elemento seleccionado ya no existe.');
  if(changes.text!==undefined){
    if(node.children.length>0)throw Error('Para editar un bloque con elementos internos, selecciona el texto concreto.');
    node.textContent=changes.text.slice(0,5000);
  }
  if(changes.color!==undefined)node.style.color=changes.color;
  if(changes.background!==undefined)node.style.backgroundColor=changes.background;
  if(changes.fontSize!==undefined)node.style.fontSize=changes.fontSize;
  return '<!DOCTYPE html>\n'+doc.documentElement.outerHTML;
}
