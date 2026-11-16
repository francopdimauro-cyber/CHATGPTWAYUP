/* WAY UP Studio · verificación de identidad de Cloudflare Access.
 * Access firma cada petición autenticada con un JWT (cabecera Cf-Access-Jwt-Assertion).
 * Lo validamos con las claves públicas del equipo (RS256), la audiencia, el emisor y la caducidad.
 * Nunca se confía en cabeceras de correo enviadas por el navegador. */
export const STUDIO_ACCESS_AUD='78890161c85752fcd44d08bde44510aac74aa51d9ee12371327fa6875ac6d8a6';

let jwksCache={url:'',at:0,keys:[]};
function b64urlBytes(s){
  const pad=s.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((s.length+3)%4);
  return Uint8Array.from(atob(pad),c=>c.charCodeAt(0));
}
function b64urlJson(s){return JSON.parse(new TextDecoder().decode(b64urlBytes(s)));}
async function loadKeys(teamDomain,fetcher,force){
  const url=teamDomain+'/cdn-cgi/access/certs';
  if(!force&&jwksCache.url===url&&Date.now()-jwksCache.at<10*60*1000)return jwksCache.keys;
  const res=await fetcher(url,{cf:{cacheTtl:600}});
  if(!res.ok)throw Error('jwks '+res.status);
  const data=await res.json();
  jwksCache={url,at:Date.now(),keys:Array.isArray(data?.keys)?data.keys:[]};
  return jwksCache.keys;
}

/** Devuelve {email} si el JWT de Access es válido para esta aplicación; si no, null. */
export async function verifyAccessJwt(request,env,{fetcher=fetch,now=Date.now()}={}){
  const teamDomain=String(env?.STUDIO_ACCESS_TEAM_DOMAIN||'').replace(/\/+$/,'');
  if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(teamDomain))return null;
  const token=request.headers.get('Cf-Access-Jwt-Assertion')||'';
  const parts=token.split('.');
  if(parts.length!==3)return null;
  let header,payload;
  try{header=b64urlJson(parts[0]);payload=b64urlJson(parts[1]);}catch{return null;}
  if(header?.alg!=='RS256'||typeof header.kid!=='string')return null;
  const aud=Array.isArray(payload?.aud)?payload.aud:[payload?.aud];
  if(!aud.includes(STUDIO_ACCESS_AUD))return null;
  if(payload?.iss!==teamDomain)return null;
  const t=Math.floor(now/1000);
  if(typeof payload.exp!=='number'||payload.exp<t-30)return null;
  if(typeof payload.nbf==='number'&&payload.nbf>t+30)return null;
  if(typeof payload.email!=='string'||!payload.email.includes('@'))return null;
  let keys=await loadKeys(teamDomain,fetcher,false);
  let jwk=keys.find(k=>k.kid===header.kid);
  if(!jwk){keys=await loadKeys(teamDomain,fetcher,true);jwk=keys.find(k=>k.kid===header.kid);}
  if(!jwk)return null;
  const key=await crypto.subtle.importKey('jwk',{kty:jwk.kty,n:jwk.n,e:jwk.e,alg:'RS256',ext:true},
    {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const ok=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,b64urlBytes(parts[2]),
    new TextEncoder().encode(parts[0]+'.'+parts[1]));
  return ok?{email:payload.email.trim().toLowerCase()}:null;
}

/** Contexto de Access para los puentes: usa ctx.access si la plataforma lo ofrece y, si no, el JWT verificado. */
export async function studioAccessContext(request,env,ctx,options){
  if(ctx?.access?.aud===STUDIO_ACCESS_AUD&&typeof ctx.access.getIdentity==='function')return ctx;
  let identity=null;
  try{identity=await verifyAccessJwt(request,env,options);}catch(error){
    console.warn('studio-access verify failed',String(error instanceof Error?error.message:error).slice(0,120));
  }
  if(!identity)return ctx;
  return {waitUntil:ctx?.waitUntil?.bind(ctx),passThroughOnException:ctx?.passThroughOnException?.bind(ctx),
    access:{aud:STUDIO_ACCESS_AUD,getIdentity:async()=>identity}};
}
