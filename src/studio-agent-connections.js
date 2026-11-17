/* WayUp isolated agent connectors: Gmail OAuth + Meta WhatsApp Business.
   Connections are scoped to a single agent and encrypted with AGENT_CONNECTIONS_KEY (32-byte base64).
   Never expose access tokens, refresh tokens or encryption keys to a browser. */
const API='https://oauth2.googleapis.com/token';
const GMAIL='https://gmail.googleapis.com/gmail/v1/users/me';
const clean=(s,n=160)=>String(s??'').trim().slice(0,n);
export const CONNECTOR_REDIRECT='/studio-api/agents/google/callback';
function keyBytes(env){
 const s=String(env.AGENT_CONNECTIONS_KEY||'');
 if(!/^[A-Za-z0-9+/_=-]{40,80}$/.test(s))throw Error('Falta AGENT_CONNECTIONS_KEY.');
 const b=Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 if(b.length!==32)throw Error('La clave de cifrado debe tener 32 bytes.');
 return b;
}
async function cryptKey(env){return crypto.subtle.importKey('raw',keyBytes(env),'AES-GCM',false,['encrypt','decrypt']);}
const toB64=b=>btoa(String.fromCharCode(...b)).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
const fromB64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
export async function seal(env,plain,aad){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(aad)},
  await cryptKey(env),new TextEncoder().encode(plain));
 return toB64(iv)+'.'+toB64(new Uint8Array(data));
}
export async function unseal(env,value,aad){
 const [i,c]=String(value).split('.');if(!i||!c)throw Error('Credencial cifrada inválida.');
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(i),additionalData:new TextEncoder().encode(aad)},
  await cryptKey(env),fromB64(c));
 return new TextDecoder().decode(plain);
}
async function macKey(env){return crypto.subtle.importKey('raw',keyBytes(env),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
const stateMessage=(id,expiry,nonce)=>id+'|'+expiry+'|'+nonce;
export async function googleState(env,id){
 const exp=Date.now()+10*60*1000,nonce=crypto.randomUUID();
 const message=stateMessage(id,exp,nonce);
 const sig=await crypto.subtle.sign('HMAC',await macKey(env),new TextEncoder().encode(message));
 return toB64(new TextEncoder().encode(message))+'.'+toB64(new Uint8Array(sig));
}
export async function parseGoogleState(env,state){
 const [encoded,signature]=String(state||'').split('.');
 if(!encoded||!signature)return null;
 try{
  const raw=new TextDecoder().decode(fromB64(encoded));
  const [id,expiry,nonce]=raw.split('|');
  if(!/^[0-9a-f-]{36}$/i.test(id)||!nonce||!Number.isFinite(Number(expiry))||Date.now()>Number(expiry))return null;
  const ok=await crypto.subtle.verify('HMAC',await macKey(env),fromB64(signature),new TextEncoder().encode(raw));
  return ok?id:null;
 }catch{return null;}
}
function googleConfigured(env){return Boolean(env.GOOGLE_OAUTH_CLIENT_ID&&env.GOOGLE_OAUTH_CLIENT_SECRET&&env.AGENT_CONNECTIONS_KEY);}
export async function gmailAuthorization(env,agentId,origin){
 if(!googleConfigured(env))throw Error('Gmail pendiente de configurar: OAuth y cifrado.');
 const uri=origin+CONNECTOR_REDIRECT;
 const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 u.searchParams.set('client_id',env.GOOGLE_OAUTH_CLIENT_ID);
 u.searchParams.set('redirect_uri',uri);
 u.searchParams.set('response_type','code');
 u.searchParams.set('access_type','offline');
 u.searchParams.set('prompt','consent');
 u.searchParams.set('scope','https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send');
 u.searchParams.set('state',await googleState(env,agentId));
 return u.toString();
}
async function googleToken(env,fields,{fetcher=fetch}={}){
 if(!googleConfigured(env))throw Error('Gmail sin configurar.');
 const form=new URLSearchParams({client_id:env.GOOGLE_OAUTH_CLIENT_ID,client_secret:env.GOOGLE_OAUTH_CLIENT_SECRET,...fields});
 const r=await fetcher(API,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:form,redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('Google OAuth no pudo completar la autorización ('+r.status+').');
 return r.json();
}
export async function gmailCallback(env,db,agentId,code,origin,options){
 if(!/^[\w./-]{8,2200}$/.test(code))throw Error('Código OAuth incorrecto.');
 const token=await googleToken(env,{grant_type:'authorization_code',code,redirect_uri:origin+CONNECTOR_REDIRECT},options);
 if(!token.refresh_token)throw Error('Google no ha devuelto un token de renovación. Vuelve a conectar.');
 const refresh=await seal(env,token.refresh_token,agentId+':gmail:refresh');
 const access=await seal(env,token.access_token||'',agentId+':gmail:access');
 await db.prepare("INSERT INTO studio_agent_connections(agent_id,provider,account_label,access_cipher,refresh_cipher) VALUES (?,'gmail','Gmail autorizado',?,?) ON CONFLICT(agent_id,provider) DO UPDATE SET access_cipher=excluded.access_cipher,refresh_cipher=excluded.refresh_cipher,updated_at=CURRENT_TIMESTAMP")
  .bind(agentId,access,refresh).run();
 return {connected:true};
}
async function gmailAccess(env,db,agentId,options){
 const row=await db.prepare("SELECT refresh_cipher FROM studio_agent_connections WHERE agent_id=? AND provider='gmail'").bind(agentId).first();
 if(!row)throw Error('Este agente no tiene Gmail conectado.');
 const refresh_token=await unseal(env,row.refresh_cipher,agentId+':gmail:refresh');
 const token=await googleToken(env,{grant_type:'refresh_token',refresh_token},options);
 if(!token.access_token)throw Error('Google no devolvió credenciales de acceso.');
 return token.access_token;
}
async function gmailFetch(env,db,agentId,path,init={},options={}){
 const access=await gmailAccess(env,db,agentId,options);
 const r=await (options.fetcher||fetch)(GMAIL+path,{...init,headers:{Authorization:'Bearer '+access,...init.headers},
  signal:AbortSignal.timeout(12000),redirect:'error'});
 if(!r.ok)throw Error('Gmail respondió con error '+r.status+'.');
 return r.json();
}
export async function gmailSearch(env,db,agentId,q,options){
 const query=clean(q,180);
 const results=await gmailFetch(env,db,agentId,'/messages?maxResults=5&q='+encodeURIComponent(query),{},options);
 const ids=(results.messages||[]).slice(0,5);
 const items=await Promise.all(ids.map(async x=>{
  const m=await gmailFetch(env,db,agentId,'/messages/'+encodeURIComponent(x.id)+'?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date',{},options);
  const h=Object.fromEntries((m.payload?.headers||[]).map(v=>[v.name.toLowerCase(),clean(v.value,140)]));
  return {id:m.id,from:h.from||'',subject:h.subject||'',date:h.date||'',snippet:clean(m.snippet,250)};
 }));
 return items;
}
export async function gmailSend(env,db,agentId,{to,subject,body},options){
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to)||String(body||'').length>6000||!body)throw Error('Datos del correo incorrectos.');
 if(/[\r\n]/.test(to))throw Error('Destinatario inválido.');
 const enc=v=>/^[\x20-\x7e]*$/.test(v)?v:'=?UTF-8?B?'+btoa(unescape(encodeURIComponent(v)))+'?=';
 const raw='To: '+to+'\r\nSubject: '+enc(clean(subject,140))+'\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n'+clean(body,6000);
 const bytes=new TextEncoder().encode(raw);
 const encoded=toB64(bytes);
 return gmailFetch(env,db,agentId,'/messages/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({raw:encoded})},options);
}
export async function connectWhatsApp(env,db,agentId,{phoneId,token,verifyToken}){
 if(!/^\d{8,25}$/.test(String(phoneId))||!/^EAA[A-Za-z0-9]+$/.test(String(token))||String(verifyToken).length<24)
  throw Error('Datos de WhatsApp Business inválidos: Phone Number ID, token Meta y token de verificación.');
 const ciphertext=await seal(env,token,agentId+':whatsapp:access');
 const raw=new TextEncoder().encode(verifyToken);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
 await db.prepare("INSERT INTO studio_agent_connections(agent_id,provider,account_label,access_cipher,phone_id,verify_hash) VALUES (?,'whatsapp','WhatsApp Business',?,?,?) ON CONFLICT(agent_id,provider) DO UPDATE SET access_cipher=excluded.access_cipher,phone_id=excluded.phone_id,verify_hash=excluded.verify_hash,updated_at=CURRENT_TIMESTAMP")
  .bind(agentId,ciphertext,String(phoneId),hash).run();
 return {connected:true,phoneId:String(phoneId)};
}
export async function whatsappToken(env,row){return unseal(env,row.access_cipher,row.agent_id+':whatsapp:access');}
export async function disconnect(env,db,agentId,provider){
 if(!['gmail','whatsapp'].includes(provider))throw Error('Conector no permitido.');
 await db.prepare('DELETE FROM studio_agent_connections WHERE agent_id=? AND provider=?').bind(agentId,provider).run();
 return {disconnected:true};
}
export async function connectorStatus(db,agentId){
 const r=await db.prepare('SELECT provider,account_label,phone_id FROM studio_agent_connections WHERE agent_id=?').bind(agentId).all();
 return {connectors:(r.results||[]).map(x=>({provider:x.provider,label:x.account_label,phoneId:x.phone_id||undefined}))};
}
export async function auditAction(db,agentId,action,outcome){
 await db.prepare('INSERT INTO studio_agent_action_audit(id,agent_id,action,outcome) VALUES (?,?,?,?)')
  .bind(crypto.randomUUID(),agentId,action,outcome).run();
}
