/**
 * WAY UP Studio Next — backend de proyectos aislado para PREVIEW.
 * Requiere bindings propios STUDIO_DB (D1), STUDIO_FILES (R2) y AGENT_BUILDER (service).
 * NO usar las tablas/bucket de WebCreator sin migración de propiedad por usuario.
 */
const NEXT_PROJECT_PREFIX='/studio-api/projects';
const NEXT_PROJECT_MAX_ZIP=25_000_000;
const NEXT_PROJECT_MAX_VERSIONS=50;
const NEXT_PROJECT_SERVICE_URL='https://agent-factory-free.francopdimauro.workers.dev/api/auth/me';
const NEXT_PROJECT_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function studioNextJson(value,status=200){
  return new Response(JSON.stringify(value),{status,headers:{
    'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'
  }});
}
function studioNextZipResponse(blob,name){
  const filename=String(name||'proyecto').replace(/[^a-z0-9_-]/gi,'-').slice(0,75)||'proyecto';
  return new Response(blob.body,{headers:{
    'Content-Type':'application/zip','Content-Disposition':'attachment; filename="'+filename+'.zip"',
    'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
    'Cross-Origin-Resource-Policy':'same-origin'
  }});
}
async function studioNextIdentity(request,env){
  if(!env?.AGENT_BUILDER?.fetch)return {error:'Conexión privada con cuentas no disponible.',status:503};
  const cookie=request.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('af_session='));
  if(!cookie)return {error:'Inicia sesión antes de acceder a los proyectos en la nube.',status:401};
  try{
    const headers=new Headers({'Accept':'application/json','Cookie':cookie});
    const ip=request.headers.get('CF-Connecting-IP');if(ip)headers.set('CF-Connecting-IP',ip);
    const response=await env.AGENT_BUILDER.fetch(new Request(NEXT_PROJECT_SERVICE_URL,{
      method:'GET',headers,redirect:'manual'
    }));
    if(!response.ok)return {error:'Sesión caducada o no autorizada.',status:401};
    const data=await response.json();
    const user=data?.user;
    if(typeof user?.id!=='string'||!NEXT_PROJECT_UUID.test(user.id))
      return {error:'Identidad no válida para proyectos.',status:401};
    return {ownerId:user.id};
  }catch{return {error:'No se pudo verificar la sesión.',status:503};}
}
async function studioNextBody(request){
  const declared=Number(request.headers.get('content-length')||0);
  if(declared>NEXT_PROJECT_MAX_ZIP)throw Object.assign(Error('ZIP demasiado grande.'),{status:413});
  if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/zip'))
    throw Object.assign(Error('Envía un ZIP del proyecto.'),{status:415});
  if(!request.body)throw Object.assign(Error('Falta el ZIP del proyecto.'),{status:400});
  let size=0;
  const parts=[];
  const reader=request.body.getReader();
  try{
    while(true){
      const {done,value}=await reader.read();if(done)break;
      size+=value.length;
      if(size>NEXT_PROJECT_MAX_ZIP)throw Object.assign(Error('ZIP demasiado grande.'),{status:413});
      parts.push(value);
    }
  }catch(error){await reader.cancel().catch(()=>{});throw error;}
  if(size<4)throw Object.assign(Error('ZIP inválido.'),{status:400});
  const output=new Uint8Array(size);let cursor=0;
  for(const part of parts){output.set(part,cursor);cursor+=part.length;}
  if(!(output[0]===80&&output[1]===75&&[3,5,7].includes(output[2])&&[4,6,8].includes(output[3])))
    throw Object.assign(Error('Se esperaba un ZIP real.'),{status:400});
  return output;
}
function studioNextObjectKey(owner,id,version){
  return 'studio/'+owner+'/'+id+'/v'+version+'.zip';
}
function studioNextProjectName(request){
  let value='Proyecto sin título';
  try{value=decodeURIComponent(request.headers.get('X-Project-Name')||value);}catch{}
  return value.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,120)||'Proyecto sin título';
}
function studioNextChanges(result){
  return Number(result?.meta?.changes??0);
}
/** Para incluir en el Worker estático compilado mediante el patcher de preview. */
export async function wayupStudioProjectsBridge(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(path!==NEXT_PROJECT_PREFIX&&!path.startsWith(NEXT_PROJECT_PREFIX+'/'))return null;
  if(!['GET','POST','PUT','DELETE'].includes(request.method))
    return studioNextJson({error:'Método no permitido.'},405);
  if(request.method!=='GET'&&request.headers.get('Origin')!==url.origin)
    return studioNextJson({error:'Origen no autorizado.'},403);
  if(!env?.STUDIO_DB||!env?.STUDIO_FILES)
    return studioNextJson({error:'Almacenamiento privado de Studio no configurado.'},503);
  const identity=await studioNextIdentity(request,env);
  if(!identity.ownerId)return studioNextJson({error:identity.error},identity.status);
  const owner=identity.ownerId,db=env.STUDIO_DB,bucket=env.STUDIO_FILES;
  const detail=path.slice(NEXT_PROJECT_PREFIX.length);
  const match=detail.match(/^\/([0-9a-f-]{36})(?:\/versions(?:\/(\d+))?)?$/i);
  const id=match?.[1],versionText=match?.[2];
  if(detail&&(!match||!NEXT_PROJECT_UUID.test(id)))return studioNextJson({error:'Ruta de proyecto no válida.'},404);
  try{
    if(!detail&&request.method==='GET'){
      const rows=await db.prepare('SELECT id,name,current_version AS version,updated_at FROM studio_next_projects WHERE owner_id=? AND deleted=0 ORDER BY updated_at DESC LIMIT 100').bind(owner).all();
      return studioNextJson({projects:rows.results||[]});
    }
    if(!detail&&request.method==='POST'){
      const count=await db.prepare('SELECT count(*) AS count FROM studio_next_projects WHERE owner_id=? AND deleted=0').bind(owner).first();
      if(Number(count?.count||0)>=50)return studioNextJson({error:'Límite de 50 proyectos alcanzado.'},429);
      const bytes=await studioNextBody(request);
      const projectId=crypto.randomUUID(),key=studioNextObjectKey(owner,projectId,1);
      const name=studioNextProjectName(request);
      await bucket.put(key,bytes,{httpMetadata:{contentType:'application/zip'}});
      try{
        await db.batch([
          db.prepare('INSERT INTO studio_next_projects(id,owner_id,name,current_version,deleted) VALUES(?,?,?,?,0)').bind(projectId,owner,name,1),
          db.prepare('INSERT INTO studio_next_versions(project_id,version,object_key) VALUES(?,?,?)').bind(projectId,1,key)
        ]);
      }catch(error){await bucket.delete(key).catch(()=>{});throw error;}
      return studioNextJson({id:projectId,name,version:1},201);
    }
    if(!id)return studioNextJson({error:'Método no permitido.'},405);
    const current=await db.prepare('SELECT id,name,current_version AS version FROM studio_next_projects WHERE id=? AND owner_id=? AND deleted=0').bind(id,owner).first();
    if(!current)return studioNextJson({error:'Proyecto no encontrado.'},404);
    if(request.method==='GET'){
      if(detail.endsWith('/versions')){
        const rows=await db.prepare('SELECT version,created_at FROM studio_next_versions WHERE project_id=? ORDER BY version DESC LIMIT 50').bind(id).all();
        return studioNextJson({versions:rows.results||[]});
      }
      const version=versionText?Number(versionText):Number(current.version);
      if(!Number.isSafeInteger(version)||version<1)return studioNextJson({error:'Versión inválida.'},400);
      const row=await db.prepare('SELECT object_key FROM studio_next_versions WHERE project_id=? AND version=?').bind(id,version).first();
      if(!row)return studioNextJson({error:'Versión no encontrada.'},404);
      const blob=await bucket.get(row.object_key);
      if(!blob)return studioNextJson({error:'Archivo no disponible.'},503);
      return studioNextZipResponse(blob,current.name);
    }
    if(detail.includes('/versions'))return studioNextJson({error:'Solo lectura para versiones.'},405);
    if(request.method==='DELETE'){
      await db.prepare('UPDATE studio_next_projects SET deleted=1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND deleted=0').bind(id,owner).run();
      return studioNextJson({deleted:true});
    }
    if(request.method==='PUT'){
      const expected=Number(request.headers.get('X-Expected-Version'));
      if(!Number.isSafeInteger(expected)||expected<1)return studioNextJson({error:'Falta la versión esperada.'},428);
      if(Number(current.version)!==expected)return studioNextJson({error:'Conflicto: la web tiene una versión más reciente.',currentVersion:current.version},409);
      if(expected>=NEXT_PROJECT_MAX_VERSIONS)return studioNextJson({error:'Límite de versiones alcanzado: exporta y crea otra copia.'},409);
      const bytes=await studioNextBody(request),next=expected+1;
      const key=studioNextObjectKey(owner,id,next);
      await bucket.put(key,bytes,{httpMetadata:{contentType:'application/zip'}});
      try{
        const results=await db.batch([
          db.prepare('UPDATE studio_next_projects SET current_version=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND current_version=? AND deleted=0').bind(next,id,owner,expected),
          db.prepare('INSERT INTO studio_next_versions(project_id,version,object_key) SELECT id,?,? FROM studio_next_projects WHERE id=? AND owner_id=? AND current_version=? AND deleted=0').bind(next,key,id,owner,next)
        ]);
        if(studioNextChanges(results?.[0])!==1){
          await bucket.delete(key).catch(()=>{});
          return studioNextJson({error:'Conflicto de versión. Recarga antes de guardar.'},409);
        }
      }catch(error){await bucket.delete(key).catch(()=>{});throw error;}
      return studioNextJson({id,version:next});
    }
    return studioNextJson({error:'Método no permitido.'},405);
  }catch(error){
    const status=Number(error?.status)||500;
    return studioNextJson({error:status!==500?error.message:'No se pudo completar la operación de proyectos.'},status);
  }
}
