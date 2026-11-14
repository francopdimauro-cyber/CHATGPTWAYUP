/* WebCreator Studio: visual editing never invokes model APIs. */
(()=>{'use strict';
const el=id=>document.getElementById(id);
const selector='h1,h2,h3,h4,h5,h6,p,span,a,button,li,label,strong,em,small,blockquote,img,div,section,article,header,footer,nav,main,aside,figure,figcaption';
const state={id:'',name:'',version:0,doc:null,saved:'',selected:-1,dirty:false,undo:[],redo:[],objectUrl:'',code:false,mode:'edit',projects:[]};
const shell=[
'<div id="wcStudio" role="dialog" aria-modal="true" aria-label="WebCreator Studio" aria-hidden="true">',
'<div class="wc-top"><div class="wc-brand">WAY<b>UP</b> · WebCreator Studio <span class="wc-chip">Privado</span></div><div class="wc-tools">',
'<button id="wcImport">Importar HTML</button><input type="file" accept=".html,.htm,text/html" id="wcFile" class="wc-hidden">',
'<button id="wcRename">Renombrar</button><button id="wcUndo">↶ Deshacer</button><button id="wcRedo">↷ Rehacer</button><button id="wcSave" class="wc-primary">Guardar versión</button><button id="wcClose">✕ Cerrar</button></div></div>',
'<div class="wc-layout"><aside class="wc-sidebar"><div class="wc-sidebar-head"><h3>Mis webs</h3><small class="wc-hint">Tus proyectos privados guardados en Cloudflare</small><button id="wcReload">↻ Actualizar biblioteca</button></div><div class="wc-projects" id="wcProjects"></div></aside>',
'<section class="wc-area"><div class="wc-canvas-head"><strong id="wcTitle">Selecciona un proyecto</strong><div class="wc-tools"><button id="wcEditMode">✎ Editar</button><button id="wcPreviewMode">◉ Vista real</button><button id="wcCodeMode">{ } Código</button><button id="wcDesktop">Escritorio</button><button id="wcTablet">Tablet</button><button id="wcMobile">Móvil</button></div></div>',
'<div class="wc-canvas-shell"><div class="wc-blank" id="wcBlank">Selecciona una web para empezar.</div><iframe id="wcFrame" title="Editor visual aislado" sandbox="allow-scripts" referrerpolicy="no-referrer" class="wc-hidden"></iframe><textarea id="wcSourceCode" spellcheck="false" aria-label="Código HTML editable" class="wc-hidden" style="width:100%;height:100%;min-height:550px;padding:18px;font:12px/1.5 ui-monospace,monospace"></textarea></div><div id="wcStatus" class="wc-status" role="status" aria-live="polite">Abre una web para editarla sin usar IA.</div></section>',
'<aside class="wc-sidebar right"><div class="wc-sidebar-head"><h3>Propiedades</h3><small class="wc-hint">Selecciona un elemento en el Canvas</small></div><div class="wc-inspector">',
'<span class="wc-tag" id="wcTag">Sin selección</span>',
'<label id="wcTextWrap">Texto<textarea id="wcText" maxlength="9000"></textarea></label><button id="wcApplyText">Aplicar texto</button>',
'<div class="wc-color-grid"><label>Color del texto<input id="wcColor" type="color" value="#111111"></label><label>Fondo<input id="wcBackground" type="color" value="#ffffff"></label></div>',
'<label>Tamaño de letra (px)<input id="wcFont" type="number" min="8" max="160"></label>',
'<label>Alineación<select id="wcAlign"><option value="">Sin cambios</option><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option><option value="justify">Justificado</option></select></label><button id="wcApplyStyle">Aplicar estilos</button>',
'<label id="wcSrcWrap" class="wc-hidden">URL de imagen<input id="wcSrc" type="text"></label><label id="wcAltWrap" class="wc-hidden">Texto alternativo<input id="wcAlt" type="text"></label><button id="wcApplyImage" class="wc-hidden">Cambiar imagen</button>',
'<button id="wcMediaPick" class="wc-hidden wc-primary" type="button">▧ Elegir de mi biblioteca</button>',
'<label id="wcFitWrap" class="wc-hidden">Ajuste de imagen<select id="wcFit"><option value="">Automático</option><option value="cover">Rellenar y recortar</option><option value="contain">Ajustar entera</option><option value="fill">Estirar</option></select></label>',
'<label id="wcPositionWrap" class="wc-hidden">Posición del encuadre<select id="wcPosition"><option value="">Sin cambios</option><option value="center">Centro</option><option value="top">Arriba</option><option value="bottom">Abajo</option><option value="left">Izquierda</option><option value="right">Derecha</option></select></label>',
'<label id="wcWidthWrap" class="wc-hidden">Ancho máximo (px)<input id="wcWidth" type="number" min="40" max="2400" placeholder="Sin límite"></label><button id="wcImageStyle" class="wc-hidden">Aplicar encuadre</button>',
'<label id="wcHrefWrap" class="wc-hidden">Enlace<input id="wcHref" type="text"></label><button id="wcApplyLink" class="wc-hidden">Cambiar enlace</button>',
'<p class="wc-hint">Doble clic sobre un texto sencillo para editarlo directamente. También puedes seleccionar un elemento y cambiarlo desde este panel.</p>',
'<hr class="wc-divider"><h3>Proyecto</h3><button id="wcDownload">↓ Descargar HTML</button><button id="wcZip">↓ Descargar ZIP</button><button id="wcAudit">◎ Auditoría HTML · sin IA</button><div id="wcAuditResult" class="wc-history" role="status" aria-live="polite"></div><button id="wcHistory">Historial de versiones</button><div class="wc-history" id="wcVersions"></div><button id="wcArchive" style="color:#a12030">Archivar proyecto</button>',
'</div></aside></div></div>'
].join('');
document.body.insertAdjacentHTML('beforeend',shell);
const header=document.querySelector('.wrap > header');
if(header){const b=document.createElement('button');b.type='button';b.className='wc-open-btn';b.id='wcOpen';b.textContent='▦ Mis webs · Studio';header.append(b)}
const actions=document.querySelector('#resultPanel .footer-actions');
if(actions){const b=document.createElement('button');b.type='button';b.className='btn';b.id='wcOpenResult';b.textContent='✎ Editar en Studio';actions.append(b)}
const status=(text,error=false)=>{el('wcStatus').textContent=text;el('wcStatus').style.color=error?'#af2333':'#3150a7'};
const serialize=doc=>'<!DOCTYPE html>\n'+doc.documentElement.outerHTML;
const parse=text=>new DOMParser().parseFromString(text,'text/html');
const currentNode=()=>state.doc&&state.selected>=0?state.doc.querySelectorAll(selector)[state.selected]||null:null;
const filename=name=>String(name||'web').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]/gi,'-').slice(0,70);
async function api(path,options={}) {
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
  const data=await response.json().catch(()=>{throw Error('Respuesta no válida de Cloudflare Access')});
  if(!response.ok)throw Error(data.error||('Error HTTP '+response.status));
  return data;
}
const mutate=(path,method,body)=>api(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
function download(content,name,mime='text/html;charset=utf-8'){
  const obj=content instanceof Blob?content:new Blob([content],{type:mime});
  const url=URL.createObjectURL(obj),a=document.createElement('a');
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
}
function sync(){
  state.dirty=!!state.doc&&serialize(state.doc)!==state.saved;
  el('wcSave').disabled=!state.doc||!state.dirty;
  el('wcSave').textContent=state.dirty?'● Guardar cambios':'✓ Guardado';
  el('wcUndo').disabled=!state.undo.length;
  el('wcRedo').disabled=!state.redo.length;
  el('wcTitle').textContent=(state.name||'Selecciona una web')+(state.dirty?' · Sin guardar':state.id?' · v'+state.version:'');
}
function remember(){
  if(!state.doc)return;
  state.undo.push(serialize(state.doc));if(state.undo.length>30)state.undo.shift();state.redo=[];
}
function update(change,message){
  if(!state.doc)return;
  const old=serialize(state.doc);remember();change();
  if(serialize(state.doc)===old)state.undo.pop();
  sync();render();status(message||'Cambio aplicado. Guarda cuando termines.');
}
async function list(){
  try{
    const rows=(await api('/api/projects')).projects||[];
    state.projects=rows;
    const root=el('wcProjects');root.replaceChildren();
    if(!rows.length){const p=document.createElement('p');p.className='wc-empty';p.textContent='Sin webs todavía. Genera o importa un proyecto.';root.append(p)}
    for(const row of rows){
      const b=document.createElement('button');b.type='button';b.className='wc-project'+(row.id===state.id?' active':'');
      const icon=document.createElement('span');icon.className='wc-thumb';icon.textContent='▤';
      const text=document.createElement('span'),title=document.createElement('strong'),meta=document.createElement('small');
      title.textContent=row.name;meta.textContent='Versión '+row.version+' · '+String(row.updated_at||'').slice(0,16);
      text.append(title,meta);b.append(icon,text);b.addEventListener('click',()=>load(row.id));root.append(b);
    }
  }catch(e){status('Error en biblioteca: '+e.message,true)}
}
function bridge(){
  'use strict';
  let current=null;
  const nodes=()=>document.querySelectorAll('[data-wc-index]');
  const emit=(type,node,extra={})=>parent.postMessage({webCreatorCanvas:true,type,index:Number(node.getAttribute('data-wc-index')),...extra},'*');
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-wc-index]');
    if(!target)return;event.preventDefault();event.stopImmediatePropagation();emit('select',target);
  },true);
  document.addEventListener('submit',event=>event.preventDefault(),true);
  document.addEventListener('dblclick',event=>{
    const target=event.target.closest('[data-wc-index]');
    if(!target||target.children.length||target.tagName==='IMG')return;
    event.preventDefault();event.stopImmediatePropagation();
    const original=target.textContent;
    target.contentEditable='true';target.focus();
    target.addEventListener('blur',()=>{
      target.removeAttribute('contenteditable');
      if(target.textContent!==original)emit('text',target,{value:target.textContent.slice(0,9000)});
    },{once:true});
  },true);
  addEventListener('message',e=>{
    if(e.data?.wcHighlight===true){
      if(current)current.removeAttribute('data-wc-selected');
      current=nodes()[e.data.index]||null;
      if(current)current.setAttribute('data-wc-selected','');
    }
  });
}
function canvasHtml(){
  if(!state.doc)return '';
  if(state.mode==='preview')return serialize(state.doc);
  const clone=state.doc.cloneNode(true);
  clone.querySelectorAll('script,iframe,object,embed,base,meta[http-equiv="refresh"]').forEach(node=>node.remove());
  for(const node of clone.querySelectorAll('*')){
    for(const a of [...node.attributes])if(/^on/i.test(a.name)||a.name==='srcdoc')node.removeAttribute(a.name);
    node.removeAttribute('contenteditable');
  }
  clone.querySelectorAll('img[src^="/api/media/file/"]').forEach(img=>{const resolved=window.WebCreatorMedia?.previewURL(img.getAttribute('src'));if(resolved)img.src=resolved});
  clone.querySelectorAll(selector).forEach((node,index)=>node.setAttribute('data-wc-index',String(index)));
  const style=clone.createElement('style');
  style.textContent='[data-wc-index]:hover{outline:2px dashed #3061ef!important;outline-offset:2px!important;cursor:crosshair!important}[data-wc-selected]{outline:3px solid #2553ef!important;outline-offset:3px!important}[contenteditable="true"]{outline:2px solid #16a66c!important}';
  clone.head.append(style);
  const script=clone.createElement('script');script.textContent='('+bridge.toString()+')()';clone.body.append(script);
  return '<!DOCTYPE html>\n'+clone.documentElement.outerHTML;
}
function render(){
  const frame=el('wcFrame'),source=el('wcSourceCode'),blank=el('wcBlank');
  if(!state.doc){frame.classList.add('wc-hidden');source.classList.add('wc-hidden');blank.classList.remove('wc-hidden');return}
  blank.classList.add('wc-hidden');
  if(state.code){frame.classList.add('wc-hidden');source.classList.remove('wc-hidden');source.value=serialize(state.doc);return}
  source.classList.add('wc-hidden');frame.classList.remove('wc-hidden');
  const last=state.objectUrl;
  state.objectUrl=URL.createObjectURL(new Blob([canvasHtml()],{type:'text/html;charset=utf-8'}));
  frame.src=state.objectUrl;
  frame.addEventListener('load',()=>{if(last)URL.revokeObjectURL(last);highlight()},{once:true});
  el('wcEditMode').classList.toggle('wc-primary',state.mode==='edit');
  el('wcPreviewMode').classList.toggle('wc-primary',state.mode==='preview');
  status(state.mode==='edit'?'Edición: scripts de la web desactivados dentro del Canvas.':'Vista real aislada: se ejecutan los scripts de la página.');
}
function highlight(){try{el('wcFrame').contentWindow.postMessage({wcHighlight:true,index:state.selected},'*')}catch{}}
function selectIndex(index){
  const nodes=state.doc?.querySelectorAll(selector);
  if(!nodes||!Number.isInteger(index)||index<0||index>=nodes.length)return;
  state.selected=index;const node=nodes[index];
  el('wcTag').textContent=node.tagName.toLowerCase()+(node.id?' #'+node.id:'');
  const simple=node.children.length===0&&node.tagName!=='IMG';
  el('wcTextWrap').classList.toggle('wc-hidden',!simple);el('wcApplyText').classList.toggle('wc-hidden',!simple);
  el('wcText').value=simple?node.textContent:'';
  el('wcFont').value=parseInt(node.style.fontSize,10)||'';
  el('wcAlign').value=node.style.textAlign||'';
  const color=(v,d)=>/^#[\da-f]{6}$/i.test(v||'')?v:d;
  el('wcColor').value=color(node.style.color,'#111111');el('wcBackground').value=color(node.style.backgroundColor,'#ffffff');
  el('wcColor').dataset.touched='false';el('wcBackground').dataset.touched='false';
  const img=node.tagName==='IMG',link=node.tagName==='A';
  for(const id of ['wcSrcWrap','wcAltWrap','wcApplyImage','wcMediaPick','wcFitWrap','wcPositionWrap','wcWidthWrap','wcImageStyle'])el(id).classList.toggle('wc-hidden',!img);
  el('wcFit').value=img?(node.style.objectFit||''):'';
  el('wcPosition').value=img?(node.style.objectPosition||''):'';
  el('wcWidth').value=img?(parseInt(node.style.maxWidth,10)||''):'';
  for(const id of ['wcHrefWrap','wcApplyLink'])el(id).classList.toggle('wc-hidden',!link);
  el('wcSrc').value=img?node.getAttribute('src')||'':'';el('wcAlt').value=img?node.getAttribute('alt')||'':'';
  el('wcHref').value=link?node.getAttribute('href')||'':'';
  highlight();
}
addEventListener('message',e=>{
  if(e.source!==el('wcFrame').contentWindow||e.data?.webCreatorCanvas!==true||state.mode!=='edit')return;
  const idx=e.data.index;
  if(!Number.isInteger(idx)||idx<0||idx>=(state.doc?.querySelectorAll(selector).length||0))return;
  if(e.data.type==='select')selectIndex(idx);
  if(e.data.type==='text'&&typeof e.data.value==='string'&&e.data.value.length<=9000){
    selectIndex(idx);const node=currentNode();
    if(node&&node.children.length===0)update(()=>{node.textContent=e.data.value},'Texto modificado en Canvas.');
  }
});
function check(){if(state.id&&state.doc)return true;status('Abre un proyecto primero.',true);return false}
async function load(id){
  if(state.dirty&&!confirm('Hay cambios sin guardar. ¿Descartarlos y abrir otra web?'))return;
  try{
    const data=await api('/api/projects/'+id);
    state.id=data.id;state.name=data.name;state.version=data.version;
    state.doc=parse(data.html);state.saved=serialize(state.doc);state.selected=-1;state.undo=[];state.redo=[];state.mode='edit';state.code=false;
    sync();render();window.WebCreatorMedia?.warmPreview(serialize(state.doc),()=>{if(state.id===data.id&&!state.code)render()});await list();el('wcVersions').replaceChildren();el('wcTag').textContent='Sin selección';
    status('Abierto '+state.name+'. Puedes guardar nuevas versiones cuando quieras.');
  }catch(e){status('No se pudo abrir: '+e.message,true)}
}
function applyCode(){
  if(!state.code)return true;
  const html=el('wcSourceCode').value;
  if(html.length>300000||!/<html\b/i.test(html)||!/<\/html\s*>\s*$/i.test(html)){
    status('El código debe ser HTML completo (máximo 300.000 caracteres).',true);return false;
  }
  if(html!==serialize(state.doc)){remember();state.doc=parse(html);state.selected=-1;sync()}
  return true;
}
async function save(label='Edición en Studio'){
  if(!check()||!applyCode())return;
  if(!state.dirty)return status('No hay cambios pendientes.');
  const b=el('wcSave');b.disabled=true;
  try{
    const html=serialize(state.doc);
    const row=await mutate('/api/projects/'+state.id,'PATCH',{html,expectedVersion:state.version,label});
    state.version=row.version;state.saved=html;state.undo=[];state.redo=[];sync();await list();
    status('✓ Guardada versión '+state.version+'. Puedes continuar otro día.');
  }catch(e){sync();status('No se pudo guardar: '+e.message,true)}
}
async function open(id=''){
  el('wcStudio').classList.add('open');el('wcStudio').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
  await list();
  if(id)await load(id);
  else if(!state.doc&&state.projects.length)await load(state.projects[0].id);
  else if(state.doc)render();
}
function close(){
  if(state.dirty){
    if(!confirm('Cambios sin guardar. ¿Cerrar Studio y descartarlos?'))return;
    state.doc=parse(state.saved);state.undo=[];state.redo=[];state.selected=-1;state.code=false;sync();
  }
  el('wcStudio').classList.remove('open');el('wcStudio').setAttribute('aria-hidden','true');document.body.style.overflow='';
  if(state.objectUrl){URL.revokeObjectURL(state.objectUrl);state.objectUrl=''}
}
el('wcOpen')?.addEventListener('click',()=>open());
el('wcOpenResult')?.addEventListener('click',()=>dispatchEvent(new Event('wc-studio-current-request')));
el('wcClose').addEventListener('click',close);
el('wcReload').addEventListener('click',list);
el('wcUndo').addEventListener('click',()=>{if(!check()||!state.undo.length||!applyCode())return;state.redo.push(serialize(state.doc));state.doc=parse(state.undo.pop());state.selected=-1;sync();render()});
el('wcRedo').addEventListener('click',()=>{if(!check()||!state.redo.length||!applyCode())return;state.undo.push(serialize(state.doc));state.doc=parse(state.redo.pop());state.selected=-1;sync();render()});
el('wcSave').addEventListener('click',()=>save());
el('wcEditMode').addEventListener('click',()=>{if(!check()||!applyCode())return;state.mode='edit';state.code=false;render()});
el('wcPreviewMode').addEventListener('click',()=>{if(!check()||!applyCode())return;state.mode='preview';state.code=false;render()});
el('wcCodeMode').addEventListener('click',()=>{if(!check())return;if(state.code&&!applyCode())return;state.code=!state.code;render()});
el('wcDesktop').addEventListener('click',()=>el('wcFrame').className='');
el('wcTablet').addEventListener('click',()=>el('wcFrame').className='tablet');
el('wcMobile').addEventListener('click',()=>el('wcFrame').className='mobile');
el('wcApplyText').addEventListener('click',()=>{const node=currentNode();if(node&&!node.children.length)update(()=>{node.textContent=el('wcText').value},'Texto actualizado.')});
for(const id of ['wcColor','wcBackground'])el(id).addEventListener('input',()=>{el(id).dataset.touched='true'});
el('wcApplyStyle').addEventListener('click',()=>{const node=currentNode();if(!node)return;update(()=>{if(el('wcColor').dataset.touched==='true')node.style.color=el('wcColor').value;if(el('wcBackground').dataset.touched==='true')node.style.backgroundColor=el('wcBackground').value;const px=Number(el('wcFont').value);if(px>=8&&px<=160)node.style.fontSize=px+'px';if(el('wcAlign').value)node.style.textAlign=el('wcAlign').value},'Estilos aplicados sin IA.')});
el('wcApplyImage').addEventListener('click',()=>{
  const node=currentNode();if(node?.tagName!=='IMG')return;
  const src=el('wcSrc').value.trim();
  if(src.length>500000||!/^(https?:\/\/|\/(?!\/)|\.\/|\.\.\/|data:image\/(?:jpeg|png|webp);base64,)/i.test(src))return status('URL de imagen inválida o demasiado larga.',true);
  update(()=>{node.setAttribute('src',src);node.setAttribute('alt',el('wcAlt').value.slice(0,200))},'Imagen sustituida.');
});
el('wcMediaPick').addEventListener('click',()=>window.WebCreatorMedia?.open());
el('wcImageStyle').addEventListener('click',()=>{
  const node=currentNode();if(node?.tagName!=='IMG')return;
  update(()=>{
    if(el('wcFit').value)node.style.objectFit=el('wcFit').value;
    if(el('wcPosition').value)node.style.objectPosition=el('wcPosition').value;
    const width=Number(el('wcWidth').value);
    if(width>=40&&width<=2400){node.style.maxWidth=width+'px';node.style.width='100%'}
  },'Encuadre de imagen actualizado.');
});
el('wcApplyLink').addEventListener('click',()=>{
  const node=currentNode();if(node?.tagName!=='A')return;
  const href=el('wcHref').value.trim();
  if(!/^(https?:\/\/|\/(?!\/)|#|mailto:|tel:|\.\/|\.\.\/)/i.test(href))return status('Enlace inválido.',true);
  update(()=>node.setAttribute('href',href),'Enlace actualizado.');
});
el('wcRename').addEventListener('click',async()=>{
  if(!check())return;const name=prompt('Nombre del proyecto:',state.name);if(!name?.trim())return;
  try{await mutate('/api/projects/'+state.id+'/name','PATCH',{name});state.name=name.trim();sync();await list();status('Proyecto renombrado.')}catch(e){status(e.message,true)}
});
el('wcAudit').addEventListener('click',async()=>{
  if(!check())return;
  if(state.dirty){status('Guarda primero los cambios para auditar esa versión.',true);return}
  const report=el('wcAuditResult');report.replaceChildren();
  const title=document.createElement('strong');
  title.textContent='Comprobando estructura y accesibilidad básica…';
  report.append(title);
  try{
    const result=await api('/api/projects/'+state.id+'/quality');
    report.replaceChildren();
    const h=document.createElement('strong');
    h.textContent=result.issues.length?'Revisión requerida · '+result.issues.length+' aviso(s)':'Sin incidencias en las comprobaciones estáticas';
    report.append(h);
    if(result.issues.length){
      for(const warning of result.issues){
        const item=document.createElement('p');
        item.className='wc-hint';
        item.textContent='• '+warning;
        report.append(item);
      }
    }
    const note=document.createElement('p');note.className='wc-hint';
    note.textContent='Auditoría estática, no pruebas visuales o de navegador.';
    report.append(note);
    status(result.issues.length?'Informe de calidad generado sin IA. Revisa los avisos.':'Auditoría estática completada sin avisos; aún falta prueba en navegador.');
  }catch(e){report.replaceChildren();status('No se pudo auditar: '+e.message,true)}
});
el('wcHistory').addEventListener('click',async()=>{
  if(!check())return;
  try{
    const root=el('wcVersions');root.replaceChildren();
    const data=await api('/api/projects/'+state.id+'/versions');
    for(const v of data.versions){
      const row=document.createElement('div');row.className='wc-version';
      const label=document.createElement('span');label.textContent='v'+v.version+' · '+v.label;
      const btn=document.createElement('button');btn.textContent='Restaurar';btn.disabled=state.version===v.version;
      btn.addEventListener('click',async()=>{
        if(state.dirty&&!confirm('Descartar los cambios pendientes?'))return;
        if(!confirm('Restaurar versión '+v.version+' como una NUEVA versión?'))return;
        try{
          const old=await api('/api/projects/'+state.id+'/versions/'+v.version);
          const out=await mutate('/api/projects/'+state.id,'PATCH',{html:old.html,expectedVersion:state.version,label:'Restaurada v'+v.version});
          await load(state.id);status('Restaurada v'+v.version+' como versión '+out.version+'.');
        }catch(e){status(e.message,true)}
      });
      row.append(label,btn);root.append(row);
    }
  }catch(e){status('No se pudo leer el historial: '+e.message,true)}
});
el('wcArchive').addEventListener('click',async()=>{
  if(!check()||!confirm('Archivar este proyecto? Sus versiones no se borrarán.'))return;
  try{await api('/api/projects/'+state.id,{method:'DELETE'});state.id='';state.doc=null;state.name='';state.version=0;state.saved='';state.dirty=false;state.undo=[];state.redo=[];sync();render();await list();status('Proyecto archivado.')}
  catch(e){status(e.message,true)}
});
el('wcDownload').addEventListener('click',async()=>{
  if(!check()||!applyCode())return;
  try{const html=await (window.WebCreatorMedia?.portableHTML(serialize(state.doc))||serialize(state.doc));download(html,filename(state.name)+'.html')}
  catch(e){status('No se pudo preparar la exportación con imágenes: '+e.message,true)}
});
el('wcZip').addEventListener('click',async()=>{
  if(!check()||!applyCode())return;
  if(typeof window.webcreatorStudioMakeZip!=='function')return status('Exportador ZIP no disponible. Descarga el HTML.',true);
  try{
    const html=await (window.WebCreatorMedia?.portableHTML(serialize(state.doc))||serialize(state.doc));
    download(window.webcreatorStudioMakeZip(html),filename(state.name)+'.zip','application/zip');
  }catch(e){status('Error ZIP: '+e.message,true)}
});
el('wcImport').addEventListener('click',()=>el('wcFile').click());
el('wcFile').addEventListener('change',async()=>{
  const file=el('wcFile').files?.[0];if(!file)return;
  try{
    if(file.size>390000)throw Error('Archivo demasiado grande.');
    const html=await file.text();
    const res=await mutate('/api/projects','POST',{html,name:file.name.replace(/\.html?$/i,'')});
    await open(res.id);status('Web importada. Puedes editarla y guardar versiones.');
  }catch(e){status('Importación fallida: '+e.message,true)}
  el('wcFile').value='';
});
addEventListener('wc-studio-current-html',async event=>{
  const html=event.detail?.html,id=event.detail?.projectId;
  if(typeof html!=='string')return;
  try{
    if(id){await open(id);return}
    const newEntry=await mutate('/api/projects','POST',{html,name:'Web generada · '+new Date().toLocaleDateString('es-ES')});
    await open(newEntry.id);
  }catch(e){await open();status('No se pudo importar resultado: '+e.message,true)}
});
addEventListener('beforeunload',event=>{if(state.dirty&&el('wcStudio').classList.contains('open')){event.preventDefault();event.returnValue=''}});
window.WebCreatorStudio={
  open,refresh:list,
  hasProject:()=>Boolean(state.doc&&state.id),
  applyAsset:(src,label='Imagen')=>{
    if(!check()||typeof src!=='string'||!/^\/api\/media\/file\/[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(src))
      return false;
    const node=currentNode();
    if(node?.tagName==='IMG'){
      update(()=>{node.setAttribute('src',src);node.setAttribute('alt',label.slice(0,180))},'Imagen cambiada desde la biblioteca.');
    }else{
      const target=node?.closest('section,article,main,header,footer')||state.doc.querySelector('main')||state.doc.body;
      update(()=>{
        const img=state.doc.createElement('img');
        img.src=src;img.alt=label.slice(0,180);img.loading='lazy';
        img.style.cssText='display:block;width:100%;max-width:100%;height:auto;object-fit:cover';
        target.append(img);
      },'Imagen añadida a la sección del Canvas.');
    }
    return true;
  }
};
sync();
})();
