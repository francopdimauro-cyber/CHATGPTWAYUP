/* WAY UP Studio — gestor ligero de agentes con acceso por correo (sin segundo login). */
(()=>{
'use strict';
if(document.getElementById('wayup-own-agent-open'))return;
const ROOT='/studio-api/agents';
const styles=document.createElement('style');
styles.textContent='#wayup-own-agent-open{border:1px solid #476be5;background:#2855ee;color:#fff;padding:9px 13px;border-radius:9px;font-weight:700;cursor:pointer}#wayup-own-agent-panel{position:fixed;inset:0;z-index:2147483000;background:#0009;display:none;align-items:center;justify-content:center;padding:14px;font-family:system-ui}#wayup-own-agent-panel.open{display:flex}#wayup-own-agent-sheet{background:#0d1325;color:#e7ecfa;width:min(720px,100%);max-height:calc(100dvh - 28px);overflow:auto;border:1px solid #303a56;border-radius:18px;padding:23px;box-shadow:0 20px 65px #0008}#wayup-own-agent-sheet header{display:flex;align-items:center;justify-content:space-between;gap:14px}#wayup-own-agent-sheet h2{font-size:21px;margin:0}#wayup-own-agent-sheet p{color:#aeb9d6;line-height:1.6;font-size:12px}#wayup-own-agent-sheet label{display:block;margin:13px 0;font-size:12px;color:#ccd6f2}#wayup-own-agent-sheet select,#wayup-own-agent-sheet input,#wayup-own-agent-sheet textarea{display:block;width:100%;background:#1b2640;color:#fff;border:1px solid #35415e;border-radius:8px;padding:10px;margin-top:6px}#wayup-own-agent-sheet button{background:#2855ee;color:#fff;border:0;border-radius:8px;padding:10px 13px;font-size:12px;font-weight:700;cursor:pointer}#wayup-own-agent-sheet button:disabled{opacity:.5;cursor:not-allowed}#wayup-own-agent-sheet button.secondary{background:#26334e}#wayup-own-agent-sheet .actions{display:flex;gap:9px;flex-wrap:wrap}#wayup-own-agent-sheet pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;border-radius:8px;background:#151d32;font-size:12px;line-height:1.5}#wayup-own-agent-sheet .subtle{font-size:11px;color:#aeb9d6}';
document.head.append(styles);
const open=document.createElement('button');open.type='button';open.id='wayup-own-agent-open';open.textContent='✦ Agentes IA';open.setAttribute('aria-label','Gestionar agentes IA de Studio');
(document.querySelector('.studio-header')?.lastElementChild||document.body).append(open);
const panel=document.createElement('div');panel.id='wayup-own-agent-panel';panel.innerHTML='<div id="wayup-own-agent-sheet" role="dialog" aria-modal="true" aria-label="Administrar agentes"><header><h2>Agentes IA de Studio</h2><button type="button" class="secondary" id="wayup-own-agent-close" aria-label="Cerrar">✕</button></header><p>Tu acceso por correo gestiona estos agentes. No hay segunda contraseña ni conexión con los agentes antiguos.</p><p id="wayup-own-agent-state" role="status">Cargando sesión…</p><div id="wayup-own-agent-private" hidden><label>Mis agentes<select id="wayup-own-agent-list"></select></label><div class="actions"><button type="button" id="wayup-own-agent-refresh" class="secondary">Actualizar</button><button type="button" id="wayup-own-agent-activate">Activar</button><button type="button" id="wayup-own-agent-pause" class="secondary">Pausar</button></div><p id="wayup-own-agent-detail" class="subtle"></p><label>Pregunta de prueba<textarea id="wayup-own-agent-question" rows="3" maxlength="1500">¿Qué puedes contarme de este negocio?</textarea></label><div class="actions"><button type="button" id="wayup-own-agent-test">Probar conversación</button><button type="button" id="wayup-own-agent-leads" class="secondary">Ver contactos</button></div><pre id="wayup-own-agent-result" aria-live="polite"></pre></div><p class="subtle">Para crear un agente nuevo, abre una web en el editor y selecciona Agente IA.</p></div>';
document.body.append(panel);
const $=id=>document.getElementById(id);let agents=[],chats=[];
async function api(method,path,body){
 const r=await fetch(ROOT+path,{method,credentials:'same-origin',cache:'no-store',
  headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'Error HTTP '+r.status);return data;
}
function state(message){$('wayup-own-agent-state').textContent=message;}
function selected(){return $('wayup-own-agent-list').value;}
async function refresh(){
 try{
  const user=await api('GET','/auth/me');
  const results=await Promise.all([api('GET','/agents'),api('GET','/public-chats')]);
  agents=Array.isArray(results[0].agents)?results[0].agents:[];chats=Array.isArray(results[1].chats)?results[1].chats:[];
  const list=$('wayup-own-agent-list'),previous=list.value;list.replaceChildren();
  for(const a of agents){const opt=document.createElement('option');opt.value=a.id;opt.textContent=a.name+' · '+a.status;list.append(opt);}
  if(agents.some(a=>a.id===previous))list.value=previous;
  $('wayup-own-agent-private').hidden=false;state('Conectado: '+user.user.email+' · '+agents.length+' agentes');
  detail();
 }catch(e){$('wayup-own-agent-private').hidden=true;state(e.message||'No se pudo conectar. Vuelve a iniciar sesión por correo.');}
}
function detail(){
 const id=selected(),agent=agents.find(a=>a.id===id),count=chats.filter(c=>c.agentId===id).length;
 $('wayup-own-agent-detail').textContent=agent?('Estado: '+agent.status+' · Widgets publicados: '+count):'Todavía no hay agentes. Crea uno desde el editor.';
 $('wayup-own-agent-activate').disabled=!agent;
 $('wayup-own-agent-pause').disabled=!agent;
 $('wayup-own-agent-test').disabled=!agent;
 $('wayup-own-agent-leads').disabled=!agent;
}
async function act(fn){try{$('wayup-own-agent-result').textContent='Procesando…';await fn();await refresh();}catch(e){$('wayup-own-agent-result').textContent=e.message;}}
open.addEventListener('click',()=>{panel.classList.add('open');void refresh();$('wayup-own-agent-close').focus()});
$('wayup-own-agent-close').addEventListener('click',()=>{panel.classList.remove('open');open.focus()});
panel.addEventListener('click',e=>{if(e.target===panel)panel.classList.remove('open')});
document.addEventListener('keydown',e=>{if(e.key==='Escape')panel.classList.remove('open')});
$('wayup-own-agent-list').addEventListener('change',detail);
$('wayup-own-agent-refresh').addEventListener('click',()=>void refresh());
$('wayup-own-agent-activate').addEventListener('click',()=>void act(()=>api('POST','/agents/'+selected()+'/status',{status:'active'})));
$('wayup-own-agent-pause').addEventListener('click',()=>void act(()=>api('POST','/agents/'+selected()+'/status',{status:'paused'})));
$('wayup-own-agent-test').addEventListener('click',()=>void act(async()=>{
 const question=$('wayup-own-agent-question').value.trim();if(!question)throw Error('Introduce una pregunta.');
 const r=await api('POST','/agents/'+selected()+'/test',{message:question});
 $('wayup-own-agent-result').textContent=r.reply||'No hay respuesta.';
}));
$('wayup-own-agent-leads').addEventListener('click',()=>void act(async()=>{
 const r=await api('GET','/agents/'+selected()+'/leads');
 $('wayup-own-agent-result').textContent=(r.leads||[]).map(x=>x.name+' · '+x.email+'\n'+x.message).join('\n\n')||'Todavía no hay contactos.';
}));
})();