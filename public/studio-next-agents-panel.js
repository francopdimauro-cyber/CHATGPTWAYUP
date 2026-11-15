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
 if(!$('wa-manager')||!$('wa-login'))return;
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
/* WAYUP_ZIP_HELPERS_BEGIN — ZIP STORE sin dependencias externas. */
const WAYUP_ZIP_ENCODER=new TextEncoder();
const WAYUP_ZIP_DECODER=new TextDecoder("utf-8",{fatal:true});
const WAYUP_CRC_TABLE=(()=>{
 const table=new Uint32Array(256);
 for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);table[i]=c>>>0;}
 return table;
})();
function wayupCrc32(b){
 let c=0xffffffff;for(const v of b)c=WAYUP_CRC_TABLE[(c^v)&255]^(c>>>8);
 return (c^0xffffffff)>>>0;
}
function wayupZipRead(buffer){
 const b=new Uint8Array(buffer),v=new DataView(buffer);
 if(b.byteLength>12_000_000||b.byteLength<22)throw Error("El ZIP no es válido o es demasiado grande (máximo 12 MB).");
 let end=-1;
 for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--){
  if(v.getUint32(i,true)===0x06054b50){end=i;break;}
 }
 if(end<0)throw Error("No se encuentra el directorio central del ZIP.");
 const total=v.getUint16(end+10,true);
 const directoryOffset=v.getUint32(end+16,true);
 const directorySize=v.getUint32(end+12,true);
 if(!total||total>80||directoryOffset+directorySize>end)throw Error("El ZIP contiene una estructura no admitida.");
 const files={};let pos=directoryOffset,sum=0;
 for(let i=0;i<total;i++){
  if(pos+46>b.length||v.getUint32(pos,true)!==0x02014b50)throw Error("Directorio ZIP incorrecto.");
  const flags=v.getUint16(pos+8,true);
  const method=v.getUint16(pos+10,true);
  const hash=v.getUint32(pos+16,true);
  const packed=v.getUint32(pos+20,true);
  const unpacked=v.getUint32(pos+24,true);
  const nameLen=v.getUint16(pos+28,true);
  const extra=v.getUint16(pos+30,true);
  const comment=v.getUint16(pos+32,true);
  const localPos=v.getUint32(pos+42,true);
  if(pos+46+nameLen+extra+comment>b.length)throw Error("Entrada ZIP truncada.");
  const name=WAYUP_ZIP_DECODER.decode(b.subarray(pos+46,pos+46+nameLen));
  if(!/^[a-zA-Z0-9_.\/-]+$/.test(name)||name.startsWith("/")||name.includes("//")||
     name.split("/").includes("..")||name.endsWith("/"))throw Error("Nombre de archivo del ZIP no permitido.");
  if(Object.prototype.hasOwnProperty.call(files,name))throw Error("Hay archivos duplicados en el ZIP.");
  if(flags&1||method!==0||packed!==unpacked||unpacked>6_000_000){
   throw Error("Se admite el ZIP sin compresión que exporta WebCreator.");
  }
  if(localPos+30>b.length||v.getUint32(localPos,true)!==0x04034b50)throw Error("Cabecera ZIP dañada.");
  const localName=v.getUint16(localPos+26,true);
  const localExtra=v.getUint16(localPos+28,true);
  const start=localPos+30+localName+localExtra;
  if(start+packed>b.length||sum+unpacked>12_000_000)throw Error("ZIP demasiado grande o incompleto.");
  const contents=b.slice(start,start+packed);
  if(wayupCrc32(contents)!==hash)throw Error("El ZIP tiene un archivo corrupto: "+name);
  files[name]=contents;sum+=unpacked;
  pos+=46+nameLen+extra+comment;
 }
 if(pos!==directoryOffset+directorySize)throw Error("Directorio del ZIP inconsistente.");
 return files;
}
function wayupZipMake(files){
 const chunks=[],central=[];let offset=0;
 const put16=(v,p,n)=>v.setUint16(p,n,true),put32=(v,p,n)=>v.setUint32(p,n>>>0,true);
 const names=Object.keys(files);
 if(!names.length||names.length>80)throw Error("Demasiados archivos.");
 for(const name of names){
  const data=files[name],filename=WAYUP_ZIP_ENCODER.encode(name);
  if(!(data instanceof Uint8Array))throw Error("Formato de archivo incorrecto.");
  const hash=wayupCrc32(data),start=offset;
  const local=new Uint8Array(30+filename.length),lv=new DataView(local.buffer);
  put32(lv,0,0x04034b50);put16(lv,4,20);put16(lv,6,0x0800);
  put32(lv,14,hash);put32(lv,18,data.length);put32(lv,22,data.length);
  put16(lv,26,filename.length);local.set(filename,30);
  chunks.push(local,data);offset+=local.length+data.length;
  const dir=new Uint8Array(46+filename.length),dv=new DataView(dir.buffer);
  put32(dv,0,0x02014b50);put16(dv,4,20);put16(dv,6,20);put16(dv,8,0x0800);
  put32(dv,16,hash);put32(dv,20,data.length);put32(dv,24,data.length);
  put16(dv,28,filename.length);put32(dv,42,start);dir.set(filename,46);
  central.push(dir);
 }
 const dirSize=central.reduce((n,v)=>n+v.length,0);
 const ending=new Uint8Array(22),e=new DataView(ending.buffer);
 put32(e,0,0x06054b50);put16(e,8,names.length);put16(e,10,names.length);
 put32(e,12,dirSize);put32(e,16,offset);
 const result=new Uint8Array(offset+dirSize+ending.length);
 let p=0;for(const c of [...chunks,...central,ending]){result.set(c,p);p+=c.length;}
 if(result.length>12_000_000)throw Error("El ZIP final supera 12 MB.");
 return result;
}
function wayupZipWithAgent(buffer,snippet){
 if(!/^<script src="https:\/\/agent-factory-free\.francopdimauro\.workers\.dev\/widget\.js" data-chat="[0-9a-f-]{36}" defer><\/script>$/.test(snippet)){
  throw Error("El código del agente no es válido.");
 }
 const files=wayupZipRead(buffer);
 if(!files["index.html"])throw Error("El ZIP no contiene index.html.");
 const page=WAYUP_ZIP_DECODER.decode(files["index.html"]);
 const idx=page.toLowerCase().lastIndexOf("</body>");
 if(idx<0||!page.includes("<html"))throw Error("El HTML no parece completo: falta el cierre del documento.");
 if(page.includes(snippet))throw Error("Este agente ya aparece en la web.");
 const patched=page.slice(0,idx)+"\n<!-- Asistente IA · WAYUP Studio -->\n"+snippet+"\n"+page.slice(idx);
 files["index.html"]=WAYUP_ZIP_ENCODER.encode(patched);
 const note="\n\nAGENTE IA INTEGRADO (WAYUP Studio)\nEl widget se carga desde Agent Builder.\nEl dominio publicado debe coincidir con el autorizado en Chat web.\nLa IA requiere que el agente siga activo y que su API esté disponible.\n";
 const old=files["README.txt"]?WAYUP_ZIP_DECODER.decode(files["README.txt"]):"WEB CREADA EN WAYUP\n";
 files["README.txt"]=WAYUP_ZIP_ENCODER.encode(old+note);
 return wayupZipMake(files);
}
/* WAYUP_ZIP_HELPERS_END */
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
 $("wa-combine").addEventListener("click",async()=>{
  if(!lastSnippet){status("wa-combine-status","Primero publica un chat para esta web.",true);return;}
  const file=$("wa-website-zip").files?.[0];
  if(!file){status("wa-combine-status","Selecciona el ZIP de WebCreator.",true);return;}
  const btn=$("wa-combine");btn.disabled=true;
  status("wa-combine-status","Uniendo web y agente localmente…");
  try{
   const bytes=wayupZipWithAgent(await file.arrayBuffer(),lastSnippet);
   const blob=new Blob([bytes],{type:"application/zip"});
   const url=URL.createObjectURL(blob),a=document.createElement("a");
   a.href=url;a.download="wayup-web-con-agente.zip";
   document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),2000);
   status("wa-combine-status","Proyecto completo descargado. El agente está integrado en index.html.");
  }catch(err){status("wa-combine-status",err.message,true)}
  finally{btn.disabled=false;}
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
