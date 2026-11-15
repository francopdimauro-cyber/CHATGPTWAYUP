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

/** Inspecciona el directorio ZIP sin descomprimir ni ejecutar contenidos. */
function studioNextValidateZip(bytes){
  const error=()=>{throw Object.assign(Error('ZIP no válido, peligroso o demasiado grande.'),{status:400});};
  if(bytes.byteLength<22)error();
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const u16=(offset)=>view.getUint16(offset,true);
  const u32=(offset)=>view.getUint32(offset,true);
  let eocd=-1;
  for(let i=bytes.byteLength-22;i>=Math.max(0,bytes.byteLength-22-65535);i--){
    if(u32(i)===0x06054b50&&i+22+u16(i+20)===bytes.byteLength){eocd=i;break;}
  }
  if(eocd<0||u16(eocd+4)!==0||u16(eocd+6)!==0)error();
  const count=u16(eocd+10);
  if(count<1||count>180||count!==u16(eocd+8))error();
  const size=u32(eocd+12),offset=u32(eocd+16);
  if(size===0xFFFFFFFF||offset===0xFFFFFFFF||offset+size!==eocd)error();
  let current=offset,total=0,hasEntry=false;
  const paths=new Set();
  const decoder=new TextDecoder('utf-8',{fatal:true});
  for(let i=0;i<count;i++){
    if(current+46>eocd||u32(current)!==0x02014b50)error();
    const flags=u16(current+8),method=u16(current+10);
    const packed=u32(current+20),unpacked=u32(current+24);
    const nameLen=u16(current+28),extraLen=u16(current+30),commentLen=u16(current+32);
    const external=u32(current+38),localOffset=u32(current+42);
    const length=46+nameLen+extraLen+commentLen;
    if(nameLen<1||nameLen>240||current+length>eocd||method!==0&&method!==8||
      flags&1||packed===0xFFFFFFFF||unpacked===0xFFFFFFFF||
      unpacked>9_000_000||total+unpacked>65_000_000||localOffset+30>offset)error();
    const fileType=(external>>>16)&0xF000;
    if(fileType===0xA000)error(); // Enlaces simbólicos ZIP no permitidos
    let name;
    try{name=decoder.decode(bytes.subarray(current+46,current+46+nameLen));}catch{error();}
    if(name.startsWith('/')||name.includes('\\')||name.includes('\0')||
      name.split('/').some(p=>!p||p==='.'||p==='..')||
      /^[A-Za-z]:/.test(name)||paths.has(name))error();
    paths.add(name);
    if(name==='index.html'||name.endsWith('/index.html'))hasEntry=true;
    if(u32(localOffset)!==0x04034b50)error();
    const dataStart=localOffset+30+u16(localOffset+26)+u16(localOffset+28);
    if(dataStart+packed>offset)error();
    total+=unpacked;
    current+=length;
  }
  if(current!==eocd||!hasEntry)error();
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
  studioNextValidateZip(output);
  return output;
}
function studioNextObjectKey(owner,id,version){
  // Sufijo aleatorio: dos PUT concurrentes nunca comparten objeto, aunque apunten a la misma versión.
  return 'studio/'+owner+'/'+id+'/v'+version+'-'+crypto.randomUUID()+'.zip';
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
