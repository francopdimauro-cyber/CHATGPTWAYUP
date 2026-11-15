/* WAY UP Studio Next · controles funcionales de agentes (sin credenciales en localStorage). */
(() => {
"use strict";
if (document.getElementById("wayup-agent-workspace")) return;
const ROOT="/studio-api/agents";
const HOST="https://agent-factory-free.francopdimauro.workers.dev";
const $=id=>document.getElementById(id);
let agents=[],chats=[],selectedAgent="",lastSnippet="";
const button=document.createElement("button");
button.id="wayup-agent-open";button.type="button";button.textContent="✦ Agentes IA";
button.setAttribute("aria-label","Abrir gestión de agentes IA");
const h=document.querySelector(".studio-header");
if(h?.lastElementChild)h.lastElementChild.prepend(button);else{document.body.append(button);button.style.position="fixed";button.style.top="12px";button.style.right="12px";button.style.zIndex="9999";}
const root=document.createElement("div");root.id="wayup-agent-workspace";root.dataset.open="false";
document.body.append(root);
async function http(method,path,payload){
 const res=await fetch(ROOT+path,{
  method,credentials:"same-origin",cache:"no-store",
  headers:payload===undefined?{}:{"Content-Type":"application/json"},
  body:payload===undefined?undefined:JSON.stringify(payload)
 });
 const out=await res.json().catch(()=>({}));
 if(!res.ok)throw new Error(out.error||"Error HTTP "+res.status);
 return out;
}
const status=(id,message,error=false)=>{
 const el=$(id);if(!el)return;
 el.textContent=message||"";el.dataset.error=error?"true":"false";
};
function originFrom(s){
 let u;try{u=new URL(s.trim())}catch{throw Error("Introduce la URL completa con https://");}
 if(u.protocol!=="https:"||u.username||u.password||u.hash||u.search||u.pathname!=="/"){
  throw Error("El dominio debe ser HTTPS, sin rutas ni parámetros.");
 }
 return u.origin;
}
function close(){root.dataset.open="false";button.focus();}
async function refresh(){
 const [r,c]=await Promise.all([http("GET","/agents"),http("GET","/public-chats")]);
 agents=Array.isArray(r.agents)?r.agents:[];chats=Array.isArray(c.chats)?c.chats:[];
 const select=$("wa-agent-list");select.replaceChildren();
 const available=agents.filter(a=>a.status==="active");
 if(!available.length){const o=document.createElement("option");o.value="";o.textContent="No hay agentes activos";select.append(o);}
 for(const a of available){const o=document.createElement("option");o.value=a.id;o.textContent=a.name;select.append(o);}
 if(available.some(a=>a.id===selectedAgent))select.value=selectedAgent;else selectedAgent=select.value;
 status("wa-list-status",available.length+" agentes activos · "+chats.length+" chats publicados");
}
async function signInState(){
 try{
  const x=await http("GET","/auth/me");
  $("wa-login").hidden=true;$("wa-manager").hidden=false;
  $("wa-user").textContent="Conectado: "+(x.user?.display_name||x.user?.email||"Administrador");
  await refresh();
 }catch{
  $("wa-manager").hidden=true;$("wa-login").hidden=false;
 }
}
button.addEventListener("click",()=>{
 root.dataset.open="true";
 signInState();
 $("wa-close")?.focus();
});
fetch("/studio-next-agents-panel.html",{cache:"no-store"})
.then(r=>{if(!r.ok)throw Error("No se pudo cargar el panel de agentes.");return r.text()})
.then(html=>{
 root.innerHTML=html;
 const stop=e=>{if(e.target===root)e.stopPropagation()};
 root.querySelector("[data-wa-close]").addEventListener("click",close);
 $("wa-close").addEventListener("click",close);
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&root.dataset.open==="true")close()});
 $("wa-login-form").addEventListener("submit",async e=>{
  e.preventDefault();status("wa-login-status","Iniciando sesión…");
  try{
   await http("POST","/auth/login",{email:$("wa-email").value.trim(),password:$("wa-password").value});
   $("wa-password").value="";
   status("wa-login-status","");
   await signInState();
  }catch(err){status("wa-login-status",err.message,true);}
 });
 $("wa-logout").addEventListener("click",async()=>{
  try{await http("POST","/auth/logout",{})}catch{}
  agents=[];chats=[];lastSnippet="";
  $("wa-manager").hidden=true;$("wa-login").hidden=false;$("wa-result").hidden=true;
 });
 $("wa-reload").addEventListener("click",async()=>{try{await refresh()}catch(err){status("wa-list-status",err.message,true)}});
 $("wa-agent-list").addEventListener("change",e=>{selectedAgent=e.target.value});
 $("wa-create").addEventListener("click",async()=>{
  const prompt=$("wa-prompt").value.trim(),btn=$("wa-create");
  if(prompt.length<20){status("wa-create-status","Describe el agente con al menos 20 caracteres.",true);return}
  if(!confirm("Esto creará un agente nuevo en Agent Builder, sin modificar los existentes. ¿Continuar?"))return;
  btn.disabled=true;status("wa-create-status","Generando con IA…");
  try{
   const draft=await http("POST","/agents/generate",{prompt});
   const config={
    ...draft.config,tools:["text_generation"],
    limits:{maxOutputTokens:1200,timeoutSeconds:45,reasoning:"off"}
   };
   if(config.requiresApproval)throw Error("Este agente requiere aprobación humana. Revísalo en Agent Builder.");
   if(!config.role||!config.objective||!config.instructions)throw Error("La IA no completó la configuración. Describe mejor el agente.");
   const created=await http("POST","/agents",{config,source:"ai"});
   selectedAgent=created.id;
   status("wa-create-status","Activando el nuevo agente…");
   await http("POST","/agents/"+encodeURIComponent(created.id)+"/status",{status:"active"});
   await refresh();$("wa-agent-list").value=created.id;
   status("wa-create-status","Agente creado y activo. Puedes publicarlo para una web.");
  }catch(err){status("wa-create-status",err.message,true)}
  finally{btn.disabled=false}
 });
 $("wa-publish").addEventListener("click",async()=>{
  const agentId=$("wa-agent-list").value,btn=$("wa-publish");
  if(!agentId){status("wa-publish-status","Selecciona un agente activo.",true);return;}
  let origin;
  try{origin=originFrom($("wa-site").value)}catch(e){status("wa-publish-status",e.message,true);return}
  const agent=agents.find(a=>a.id===agentId);
  const title=$("wa-chat-title").value.trim()||agent?.name||"Asistente IA";
  const greeting=$("wa-greeting").value.trim()||"¡Hola! ¿En qué puedo ayudarte?";
  if(!confirm("Se publicará un chat para "+origin+" con "+(agent?.name||"el agente")+". ¿Continuar?"))return;
  btn.disabled=true;$("wa-result").hidden=true;
  status("wa-publish-status","Publicando chat…");
  try{
   const existing=chats.find(c=>c.agentId===agentId&&c.enabled&&c.allowedOrigins?.includes(origin));
   const result=existing?{id:existing.id}:await http("POST","/public-chats",{
    agentId,title,greeting,suggestions:[],allowedOrigins:[origin],
    privacyNotice:"Asistente de inteligencia artificial. No compartas datos personales sensibles.",
    perVisitorLimit:15,dailyLimit:500,enabled:true
   });
   if(!/^[0-9a-f-]{36}$/i.test(result.id||""))throw Error("ID del chat inválido.");
   lastSnippet='<script src="'+HOST+'/widget.js" data-chat="'+result.id+'" defer></'+'script>';
   $("wa-script").value=lastSnippet;$("wa-result").hidden=false;
   status("wa-publish-status",existing?"Chat existente reutilizado.":"Chat publicado. Copia el código a tu web.");
   await refresh();
  }catch(err){status("wa-publish-status",err.message,true)}
  finally{btn.disabled=false}
 });
 $("wa-copy").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText(lastSnippet);status("wa-publish-status","Código copiado.");}
  catch{$("wa-script").focus();$("wa-script").select();status("wa-publish-status","Selecciona y copia el código manualmente.");}
 });
 $("wa-download").addEventListener("click",()=>{
  if(!lastSnippet)return;
  const blob=new Blob(["<!-- Agente WAYUP Studio -->\n"+lastSnippet+"\n"],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="wayup-integracion-agente.txt";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 if(root.dataset.open==="true")signInState();
})
.catch(err=>{
 root.textContent="No se pudo cargar el panel de agentes. Recarga esta página.";
 console.error("wayup_agents_panel_load_error",err?.message);
});
})();
