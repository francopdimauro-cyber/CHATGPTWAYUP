/* WebCreator Studio Media — R2 library, Canvas placement and bounded Workers AI images.
 * Private media URLs never leave the workspace; portable exports embed selected assets. */
(()=>{'use strict';
const E=id=>document.getElementById(id),API='/api/media',MAX=5*1024*1024;
const host=E('wcStudio');if(!host)return;
const images=new Map(); // data URLs only for assets already needed in Canvas
let items=[],cursor=null,active='library',pending=false,previousFocus=null;
const modal=document.createElement('div');modal.id='wcMediaModal';modal.className='wc-media-overlay wc-hidden';
modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Biblioteca multimedia');
modal.innerHTML=[
'<div class="wc-media-panel"><div class="wc-media-header"><div><strong>Biblioteca de imágenes</strong><small>Fotos, logos y recursos · Almacenamiento privado</small></div>',
'<button type="button" id="wcMediaClose" aria-label="Cerrar">✕</button></div>',
'<div class="wc-media-tabs" role="tablist">',
'<button type="button" id="wcMediaLibrary" role="tab">Mis imágenes</button>',
'<button type="button" id="wcMediaUpload" role="tab">Subir archivos</button>',
'<button type="button" id="wcMediaGenerate" role="tab">Generar con IA</button></div>',
'<div id="wcMediaLibraryPanel" class="wc-media-page"><p class="wc-media-help">Selecciona una imagen para cambiar la que tengas marcada en Canvas o añadirla a la sección seleccionada.</p>',
'<div id="wcMediaGallery" class="wc-media-gallery"></div><button type="button" id="wcMediaMore" class="wc-hidden">Cargar más imágenes</button></div>',
'<div id="wcMediaUploadPanel" class="wc-media-page wc-hidden">',
'<label class="wc-media-drop" for="wcMediaFile"><span aria-hidden="true">↑</span><strong>Subir fotografías o logos</strong>',
'<small>JPEG, PNG y WebP · Máximo 5 MB por archivo</small></label>',
'<input id="wcMediaFile" type="file" accept="image/jpeg,image/png,image/webp" multiple class="wc-hidden">',
'<p class="wc-media-help">Usa material que sea tuyo o tengas permiso para publicar. Las imágenes se almacenan en Cloudflare R2, nunca en OpenRouter.</p></div>',
'<div id="wcMediaGeneratePanel" class="wc-media-page wc-hidden">',
'<label for="wcMediaPrompt" class="wc-media-field">Describe la imagen que necesitas</label>',
'<textarea id="wcMediaPrompt" rows="5" maxlength="500" placeholder="Fotografía editorial de un gimnasio moderno, luz natural, perspectiva angular, tonos azul oscuro, sin texto ni logotipos."></textarea>',
'<p class="wc-media-help">Cloudflare Workers AI · FLUX.1 Schnell. Hasta <b>10 imágenes diarias</b> (UTC), sujeto a disponibilidad y cuota del proveedor. Se genera una imagen por petición.</p>',
'<button id="wcMediaRunAI" type="button" class="wc-primary">✦ Generar y guardar</button></div>',
'<div id="wcMediaStatus" class="wc-media-status" role="status" aria-live="polite">Elige una herramienta.</div></div>'
].join('');
host.append(modal);
const actions=host.querySelector('.wc-top .wc-tools');
if(actions){const b=document.createElement('button');b.id='wcMediaOpen';b.type='button';b.textContent='▧ Imágenes';actions.insertBefore(b,actions.firstChild)}
const gallery=E('wcMediaGallery'),notice=(message,error=false)=>{
 E('wcMediaStatus').textContent=message;
 E('wcMediaStatus').classList.toggle('wc-media-error',error);
};
const validURL=s=>/^\/api\/media\/file\/[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(s);
async function request(path,options={}){
 const res=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
 let data;try{data=await res.json()}catch{throw Error('Respuesta de Cloudflare no válida')}
 if(!res.ok)throw Error(data.error||'Error HTTP '+res.status);
 return data;
}
function tab(name){
 active=name;
 for(const key of ['library','upload','generate']){
  const cap=key[0].toUpperCase()+key.slice(1);
  E('wcMedia'+cap+'Panel').classList.toggle('wc-hidden',key!==name);
  E('wcMedia'+cap).setAttribute('aria-selected',String(key===name));
 }
 if(name==='library')paint();
}
async function dataURL(path){
 if(images.has(path))return images.get(path);
 if(!validURL(path))throw Error('Ruta de imagen no permitida');
 const res=await fetch(path,{credentials:'same-origin',cache:'no-store'});
 if(!res.ok)throw Error('Imagen no disponible en R2 (HTTP '+res.status+')');
 const blob=await res.blob();
 if(blob.size>MAX||!/^image\/(png|webp|jpeg)$/.test(blob.type))throw Error('Imagen de formato o tamaño no permitido');
 const data=await new Promise((ok,no)=>{
  const reader=new FileReader();reader.onload=()=>ok(String(reader.result));reader.onerror=()=>no(Error('Error leyendo imagen'));reader.readAsDataURL(blob);
 });
 images.set(path,data);return data;
}
function paint(){
 gallery.replaceChildren();
 if(!items.length){const hint=document.createElement('div');hint.className='wc-media-empty';hint.textContent='Tu biblioteca está vacía. Sube imágenes o genera una con IA.';gallery.append(hint)}
 for(const item of items){
  const card=document.createElement('div');card.className='wc-media-card';
  const img=document.createElement('img');img.src=item.url;img.loading='lazy';img.alt=item.name;img.decoding='async';
  const name=document.createElement('strong');name.textContent=item.name;
  const meta=document.createElement('small');meta.textContent=(item.kind==='ai'?'Generada con IA':'Subida')+' · '+Math.ceil(item.size/1024)+' KB';
  const buttons=document.createElement('div');buttons.className='wc-media-actions';
  const apply=document.createElement('button');apply.type='button';apply.textContent='Usar en Canvas';
  apply.onclick=async()=>{
   if(!window.WebCreatorStudio?.hasProject())return notice('Abre un proyecto antes de usar imágenes.',true);
   try{notice('Preparando imagen...');await dataURL(item.url);
    if(!window.WebCreatorStudio.applyAsset(item.url,item.name))throw Error('No se ha podido insertar');
    close();
   }catch(e){notice(e.message,true)}
  };
  const remove=document.createElement('button');remove.type='button';remove.textContent='Eliminar';remove.className='wc-media-danger';
  remove.onclick=async()=>{
   if(!confirm('¿Eliminar "'+item.name+'"? Dejará de estar disponible en las webs que la usen.'))return;
   try{await request(API+'/'+item.id,{method:'DELETE'});images.delete(item.url);items=items.filter(x=>x.id!==item.id);paint();notice('Imagen eliminada.')}
   catch(e){notice(e.message,true)}
  };
  buttons.append(apply,remove);card.append(img,name,meta,buttons);gallery.append(card);
 }
 E('wcMediaMore').classList.toggle('wc-hidden',!cursor);
}
async function load(append=false){
 if(pending)return;
 pending=true;
 try{
  notice('Leyendo imágenes de R2…');
  const result=await request(API+(append&&cursor?'?cursor='+encodeURIComponent(cursor):''));
  items=append?[...items,...result.images]:result.images;
  cursor=result.cursor;
  paint();notice(items.length+' imagen(es) disponibles.');
 }catch(e){notice(e.message,true)}
 finally{pending=false}
}
async function open(){
 if(!host.classList.contains('open'))return;
 previousFocus=document.activeElement;
 modal.classList.remove('wc-hidden');tab('library');
 try{
  const state=await request(API+'/status');
  if(!state.storage){
    gallery.replaceChildren();items=[];cursor=null;
    E('wcMediaRunAI').disabled=true;
    notice('R2 no está activado en Cloudflare. Habilita R2 y conecta el binding STUDIO_ASSETS.',true);
  }else{
    E('wcMediaRunAI').disabled=!state.generator;
    await load();
    if(!state.generator)notice('R2 está listo; para generar imágenes aún falta el binding AI.');
  }
 }catch(e){notice(e.message,true)}
 E('wcMediaClose').focus();
}
function close(){
 modal.classList.add('wc-hidden');
 if(previousFocus?.isConnected)previousFocus.focus();
 previousFocus=null;
}
E('wcMediaOpen')?.addEventListener('click',open);
E('wcMediaClose').addEventListener('click',close);
modal.addEventListener('mousedown',e=>{if(e.target===modal)close()});
modal.addEventListener('keydown',e=>{
 if(e.key==='Escape'){e.preventDefault();close()}
 if(e.key==='Tab'){
  const active=[...modal.querySelectorAll('button:not(:disabled),textarea')]
   .filter(x=>x.getClientRects().length>0);
  if(!active.length)return;
  if(e.shiftKey&&document.activeElement===active[0]){e.preventDefault();active.at(-1).focus()}
  else if(!e.shiftKey&&document.activeElement===active.at(-1)){e.preventDefault();active[0].focus()}
 }
});
E('wcMediaLibrary').onclick=()=>tab('library');
E('wcMediaUpload').onclick=()=>tab('upload');
E('wcMediaGenerate').onclick=()=>tab('generate');
E('wcMediaMore').onclick=()=>load(true);
E('wcMediaFile').addEventListener('change',async()=>{
 const uploaded=[...E('wcMediaFile').files||[]].slice(0,15);
 E('wcMediaFile').value='';
 if(!uploaded.length)return;
 let success=0;
 for(const file of uploaded){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>MAX||!file.size){
   notice('Archivo omitido: '+file.name+' (solo JPEG/PNG/WebP hasta 5 MB).',true);continue;
  }
  try{
   const res=await request(API+'/upload',{method:'POST',headers:{'Content-Type':file.type,'X-Asset-Name':encodeURIComponent(file.name)},body:file});
   items.unshift(res.image);success++;notice(success+' de '+uploaded.length+' archivo(s) subido(s).');
  }catch(e){notice(file.name+': '+e.message,true)}
 }
 if(success){tab('library');paint()}
});
E('wcMediaRunAI').onclick=async()=>{
 if(pending)return;
 const prompt=E('wcMediaPrompt').value.trim();
 if(prompt.length<12||prompt.length>500)return notice('Introduce una descripción de 12 a 500 caracteres.',true);
 if(!confirm('Se generará 1 imagen y se consumirá 1 de las 10 generaciones diarias disponibles. ¿Continuar?'))return;
 pending=true;E('wcMediaRunAI').disabled=true;notice('Generando imagen con Workers AI…');
 try{
  const res=await request(API+'/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})});
  items.unshift(res.image);tab('library');paint();
  notice('Imagen guardada. Generadas hoy: '+res.used+'/'+res.dailyLimit+'.');
 }catch(e){notice(e.message,true)}
 finally{pending=false;E('wcMediaRunAI').disabled=false}
};
async function portableHTML(html){
 const paths=[...new Set((String(html).match(/\/api\/media\/file\/[a-f0-9-]{36}\.(?:jpg|png|webp)/g)||[]))];
 if(paths.length>25)throw Error('Demasiadas imágenes vinculadas para exportar en un único HTML.');
 let size=0,output=html;
 for(const path of paths){
  const data=await dataURL(path);
  size+=data.length;
  if(size>28*1024*1024)throw Error('La exportación superaría 28 MB de imágenes. Reduce recursos antes de exportar.');
  output=output.split(path).join(data);
 }
 return output;
}
async function warmPreview(html,done){
 const paths=[...new Set((String(html).match(/\/api\/media\/file\/[a-f0-9-]{36}\.(?:jpg|png|webp)/g)||[]))].slice(0,20);
 let changed=false;
 for(const path of paths){
  if(images.has(path))continue;
  try{await dataURL(path);changed=true}catch{}
 }
 if(changed&&typeof done==='function')done();
}
window.WebCreatorMedia={open,previewURL:url=>images.get(url)||null,portableHTML,warmPreview};
})();
