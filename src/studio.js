// WebCreator Studio API — injected into worker at build time.
// Inherits the Worker's mandatory Cloudflare Access identity check.
const STUDIO_MAX_HTML = 300000;
function studioName(html,fallback='Nueva web') {
  const m=String(html||'').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return (m?m[1].replace(/<[^>]+>/g,'').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'"):fallback).trim().slice(0,120)||fallback;
}
function studioHtml(value) {
  if(typeof value!=='string'||value.length>STUDIO_MAX_HTML)return null;
  return inspectHtml(value).html;
}
async function saveProjectForJob(db,jobKey,html) {
  if(!db||!/^[a-f0-9]{64}$/.test(jobKey||'')||!studioHtml(html))return null;
  try {
    await db.prepare('INSERT OR IGNORE INTO webcreator_projects(id,name,html,source_job_key,current_version) VALUES(?,?,?,?,1)')
      .bind(crypto.randomUUID(),studioName(html),html,jobKey).run();
    const row=await db.prepare('SELECT id,html FROM webcreator_projects WHERE source_job_key=?').bind(jobKey).first();
    if(!row)return null;
    await db.prepare("INSERT OR IGNORE INTO webcreator_project_versions(project_id,version,html,label) VALUES(?,1,?,'Generación inicial')").bind(row.id,row.html).run();
    return row.id;
  }catch{return null}
}
async function studioRequestJson(request) {
  if(Number(request.headers.get('content-length')||0)>400000)throw Error('too_large');
  const text=await request.text();
  if(text.length>400000)throw Error('too_large');
  try{return JSON.parse(text)}catch{throw Error('invalid_json')}
}
async function handleStudio(request,env,url) {
  const db=env.USAGE_DB;
  if(!db)return send({error:'D1 no disponible'},503);
  const path=url.pathname;
  const match=path.match(/^\/api\/projects\/([a-f0-9-]{36})(?:\/(versions)(?:\/([0-9]+))?|\/(name)|\/(quality))?$/);
  const id=match?.[1],section=match?.[2],vText=match?.[3],rename=match?.[4],quality=match?.[5];
  if(path!=='/api/projects'&&!match)return send({error:'Ruta Studio no encontrada'},404);
  if(request.method!=='GET') {
    if(request.headers.get('origin')!==url.origin)return send({error:'Origen no autorizado'},403);
    if(request.method!=='DELETE'&&!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
      return send({error:'Se requiere JSON'},415);
  }
  try {
    if(path==='/api/projects'&&request.method==='GET') {
      const rows=await db.prepare('SELECT id,name,current_version AS version,created_at,updated_at,source_job_key IS NOT NULL AS generated FROM webcreator_projects WHERE archived=0 ORDER BY updated_at DESC LIMIT 150').all();
      return send({projects:rows.results||[]});
    }
    if(path==='/api/projects'&&request.method==='POST') {
      const body=await studioRequestJson(request);
      const html=studioHtml(body?.html);
      if(!html)return send({error:'Documento HTML incompleto o demasiado grande'},400);
      const name=String(body.name||studioName(html)).trim().slice(0,120);
      if(!name)return send({error:'Nombre obligatorio'},400);
      const id=crypto.randomUUID();
      await db.batch([
        db.prepare('INSERT INTO webcreator_projects(id,name,html,current_version) VALUES(?,?,?,1)').bind(id,name,html),
        db.prepare("INSERT INTO webcreator_project_versions(project_id,version,html,label) VALUES(?,1,?,'Importación')").bind(id,html)
      ]);
      return send({id,name,version:1},201);
    }
    if(!id)return send({error:'Método no permitido'},405);
    if(request.method==='GET'&&section==='versions'&&vText) {
      const v=Number(vText);
      if(!Number.isSafeInteger(v)||v<1)return send({error:'Versión inválida'},400);
      const row=await db.prepare('SELECT v.version,v.html,v.label,v.created_at FROM webcreator_project_versions v JOIN webcreator_projects p ON p.id=v.project_id WHERE v.project_id=? AND v.version=? AND p.archived=0').bind(id,v).first();
      return row?send(row):send({error:'Versión no encontrada'},404);
    }
    if(request.method==='GET'&&section==='versions') {
      const rows=await db.prepare('SELECT v.version,v.label,v.created_at,length(v.html) AS characters FROM webcreator_project_versions v JOIN webcreator_projects p ON p.id=v.project_id WHERE v.project_id=? AND p.archived=0 ORDER BY version DESC LIMIT 100').bind(id).all();
      return send({versions:rows.results||[]});
    }
    if(request.method==='GET'&&quality==='quality') {
      const row=await db.prepare('SELECT id,name,html,current_version AS version FROM webcreator_projects WHERE id=? AND archived=0').bind(id).first();
      if(!row)return send({error:'Proyecto no encontrado'},404);
      const issues=auditHtml(row.html);
      const clean=inspectHtml(row.html);
      return send({
        id:row.id,name:row.name,version:row.version,scope:'static',
        status:issues.length?'review':'pass',validStructure:Boolean(clean.html),
        issues,characters:row.html.length,
        images:(row.html.match(/<img\b/gi)||[]).length,
        sections:(row.html.match(/<section\b/gi)||[]).length,
        note:'Auditoría estática básica: no sustituye pruebas visuales, funcionales ni seguridad de publicación.'
      });
    }
    if(request.method==='GET'&&!section&&!rename) {
      const row=await db.prepare('SELECT id,name,html,current_version AS version,created_at,updated_at FROM webcreator_projects WHERE id=? AND archived=0').bind(id).first();
      return row?send(row):send({error:'Proyecto no encontrado'},404);
    }
    if(request.method==='PATCH'&&rename==='name') {
      const body=await studioRequestJson(request);
      const name=typeof body?.name==='string'?body.name.trim().slice(0,120):'';
      if(!name)return send({error:'Nombre obligatorio'},400);
      const row=await db.prepare('UPDATE webcreator_projects SET name=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND archived=0 RETURNING id,name').bind(name,id).first();
      return row?send(row):send({error:'Proyecto no encontrado'},404);
    }
    if(request.method==='PATCH'&&!section&&!rename) {
      const body=await studioRequestJson(request);
      const html=studioHtml(body?.html);
      const expected=Number(body?.expectedVersion);
      if(!html)return send({error:'HTML incompleto o demasiado largo'},400);
      if(!Number.isSafeInteger(expected)||expected<1)return send({error:'Versión anterior obligatoria'},400);
      const next=expected+1;
      const label=typeof body.label==='string'&&body.label.trim()?body.label.trim().slice(0,90):'Edición visual';
      const results=await db.batch([
        db.prepare('UPDATE webcreator_projects SET html=?,current_version=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND archived=0 AND current_version=? RETURNING current_version').bind(html,next,id,expected),
        db.prepare('INSERT INTO webcreator_project_versions(project_id,version,html,label) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM webcreator_projects WHERE id=? AND archived=0 AND current_version=?)').bind(id,next,html,label,id,next)
      ]);
      if(!results[0]?.results?.length)return send({error:'Este proyecto cambió desde que lo abriste. Recárgalo antes de sobrescribir.',code:'version_conflict'},409);
      return send({id,version:next});
    }
    if(request.method==='DELETE'&&!section&&!rename) {
      const row=await db.prepare('UPDATE webcreator_projects SET archived=1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND archived=0 RETURNING id').bind(id).first();
      return row?send({archived:true,id}):send({error:'Proyecto no encontrado'},404);
    }
    return send({error:'Método no permitido'},405);
  }catch(e) {
    if(e.message==='too_large')return send({error:'Solicitud demasiado grande'},413);
    if(e.message==='invalid_json')return send({error:'JSON inválido'},400);
    return send({error:'Operación Studio no disponible en este momento',code:'studio_db_error'},503);
  }
}
