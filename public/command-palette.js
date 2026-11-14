/* WAYUP / COMMAND PALETTE
 * Real keyboard-first command navigation, zero external libraries and no AI usage. */
(()=>{'use strict';
const q=id=>document.getElementById(id);
const trigger=q('cmdOpen');
if(!trigger)return;
const root=document.createElement('div');root.className='wc-command-root';root.id='wcCommandRoot';root.setAttribute('aria-hidden','true');
root.innerHTML=[
'<div class="wc-command-panel" role="dialog" aria-modal="true" aria-label="Comandos de WebCreator">',
' <div class="wc-command-search"><span aria-hidden="true">⌕</span>',
' <input id="wcCommandInput" type="search" autocomplete="off" spellcheck="false" placeholder="Buscar una acción..." aria-label="Buscar acción">',
' <span class="wc-coord" aria-hidden="true">CMD·01</span></div>',
' <div id="wcCommandItems" class="wc-command-items" role="listbox" aria-label="Acciones disponibles"></div>',
' <div class="wc-command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navegar</span><span><kbd>↵</kbd> Ejecutar</span><span><kbd>Esc</kbd> Cerrar</span></div>',
'</div>'
].join('');
document.body.append(root);
let previousFocus=null,selection=0,visible=[];
const commands=[
  {key:'studio',label:'Abrir WebCreator Studio',hint:'Biblioteca privada y editor visual',glyph:'▦',words:'proyectos mis webs editor canvas',run:()=>{window.WebCreatorStudio?.open()}},
  {key:'wizard',label:'Ir al generador',hint:'Volver al paso activo del formulario',glyph:'⌖',words:'formulario empezar crear web',run:()=>{
    const step=document.querySelector('.step.current');
    if(step){step.focus({preventScroll:true});if(!window.matchMedia('(min-width:900px) and (min-height:650px)').matches)step.scrollIntoView({block:'start',behavior:'smooth'})}
  }},
  {key:'next',label:'Siguiente paso',hint:'Continúa con el briefing',glyph:'→',words:'continuar avanzar formulario',run:()=>q('next')?.click(),available:()=>!q('next')?.disabled&&!q('navigation')?.classList.contains('hidden')},
  {key:'back',label:'Paso anterior',hint:'Regresa sin perder las respuestas',glyph:'←',words:'retroceder anterior formulario',run:()=>q('back')?.click(),available:()=>!q('back')?.disabled&&!q('navigation')?.classList.contains('hidden')},
  {key:'zip',label:'Descargar web en ZIP',hint:'Exportar el último proyecto generado',glyph:'↓',words:'zip exportar descargar codigo',run:()=>q('downloadZip')?.click(),available:()=>!q('resultPanel')?.classList.contains('hidden')},
  {key:'html',label:'Descargar HTML',hint:'Exportar la web generada',glyph:'⟩',words:'descargar codigo html',run:()=>q('downloadHtml')?.click(),available:()=>!q('resultPanel')?.classList.contains('hidden')}
];
function close(){
  root.classList.remove('open');root.setAttribute('aria-hidden','true');
  document.removeEventListener('keydown',onPaletteKey,true);
  const focus=previousFocus;previousFocus=null;
  if(focus?.isConnected)focus.focus({preventScroll:true});
  else trigger.focus({preventScroll:true});
}
function select(index){
  if(!visible.length)return;
  selection=(index+visible.length)%visible.length;
  const options=[...q('wcCommandItems').querySelectorAll('[role="option"]')];
  options.forEach((option,i)=>{const selected=i===selection;option.setAttribute('aria-selected',String(selected));option.tabIndex=selected?0:-1});
  options[selection]?.scrollIntoView({block:'nearest'});
}
function execute(command){
  if(!command)return;
  close();
  command.run();
}
function draw(){
  const term=q('wcCommandInput').value.trim().toLocaleLowerCase('es');
  visible=commands.filter(c=>(!c.available||c.available())&&(!term||(c.label+' '+c.hint+' '+c.words).toLocaleLowerCase('es').includes(term)));
  const container=q('wcCommandItems');container.replaceChildren();
  if(!visible.length){
    const empty=document.createElement('div');empty.className='wc-command-empty';empty.textContent='No se encontraron acciones.';container.append(empty);return;
  }
  for(const command of visible){
    const option=document.createElement('button');
    option.type='button';option.className='wc-command-item';option.setAttribute('role','option');
    const icon=document.createElement('span');icon.className='wc-command-icon';icon.setAttribute('aria-hidden','true');icon.textContent=command.glyph;
    const label=document.createElement('span');label.textContent=command.label;
    const hint=document.createElement('small');hint.textContent=command.hint;label.append(hint);
    option.append(icon,label);
    option.addEventListener('click',()=>execute(command));
    option.addEventListener('pointerenter',()=>select(visible.indexOf(command)));
    container.append(option);
  }
  select(0);
}
function open(){
  if(root.classList.contains('open'))return;
  previousFocus=document.activeElement;
  root.classList.add('open');root.setAttribute('aria-hidden','false');
  q('wcCommandInput').value='';draw();
  document.addEventListener('keydown',onPaletteKey,true);
  q('wcCommandInput').focus();
}
function onPaletteKey(event){
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return}
  if(event.key==='ArrowDown'){event.preventDefault();event.stopPropagation();select(selection+1)}
  if(event.key==='ArrowUp'){event.preventDefault();event.stopPropagation();select(selection-1)}
  if(event.key==='Enter'&&visible.length){event.preventDefault();event.stopPropagation();execute(visible[selection])}
  if(event.key==='Tab'){
    // Keep keyboard focus inside the accessible command dialog.
    const focusables=[q('wcCommandInput'),...q('wcCommandItems').querySelectorAll('button')];
    const at=focusables.indexOf(document.activeElement);
    const dest=event.shiftKey?(at<=0?focusables.length-1:at-1):(at>=focusables.length-1?0:at+1);
    event.preventDefault();focusables[dest]?.focus();
  }
}
trigger.addEventListener('click',()=>root.classList.contains('open')?close():open());
root.addEventListener('mousedown',event=>{if(event.target===root)close()});
q('wcCommandInput').addEventListener('input',draw);
document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&!event.altKey&&event.key.toLowerCase()==='k'){
    event.preventDefault();
    if(root.classList.contains('open'))close();else open();
  }
},true);
})();