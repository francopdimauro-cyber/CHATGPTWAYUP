/* Studio Media: private R2 uploads + optional Workers AI image generation.
 * This module is injected AFTER the Zero Trust identity check in worker.js.
 * R2 and AI bindings are optional: fail closed and tell Studio what is missing. */
const STUDIO_MEDIA_PREFIX='studio/images/';
const STUDIO_MEDIA_MAX=5*1024*1024;
const STUDIO_MEDIA_MODEL='@cf/black-forest-labs/flux-1-schnell';
const STUDIO_MEDIA_DAILY_AI=5;
const STUDIO_MEDIA_TYPES=new Set(['image/jpeg','image/png','image/webp']);
const studioMediaKey=id=>STUDIO_MEDIA_PREFIX+id;
const studioMediaImageURL=id=>'/api/media/file/'+encodeURIComponent(id);
function studioMediaCheckType(bytes,type){
  if(type==='image/jpeg')return bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(type==='image/png')return bytes.length>=8&&[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x);
  if(type==='image/webp')return bytes.length>=12&&[82,73,70,70].every((x,i)=>bytes[i]===x)&&[87,69,66,80].every((x,i)=>bytes[8+i]===x);
  return false;
}
function studioMediaType(bytes){
  for(const type of STUDIO_MEDIA_TYPES)if(studioMediaCheckType(bytes,type))return type;
  return null;
}
function studioMediaItem(obj){
  const id=obj.key.slice(STUDIO_MEDIA_PREFIX.length);
  return {id,name:obj.customMetadata?.name||'Imagen',kind:obj.customMetadata?.kind||'upload',
    createdAt:obj.customMetadata?.created||obj.uploaded?.toISOString?.()||'',
    size:obj.size,url:studioMediaImageURL(id)};
}
async function handleStudioMedia(request,env,url){
  const path=url.pathname;
  const isJSON=(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json');
  const mutate=!['GET','HEAD'].includes(request.method);
  if(mutate&&request.headers.get('origin')!==url.origin)
    return send({error:'Origen no autorizado'},403);
  // This route is only reached after Cloudflare Access verifies the private account owner.
  if(path==='/api/media/status'&&request.method==='GET'){
    return send({storage:Boolean(env.STUDIO_ASSETS),generator:Boolean(env.STUDIO_ASSETS&&env.AI&&env.USAGE_DB),
      model:STUDIO_MEDIA_MODEL,imageLimitMB:5,dailyGenerationLimit:STUDIO_MEDIA_DAILY_AI});
  }
  if(!env.STUDIO_ASSETS)
    return send({error:'Biblioteca de imágenes pendiente de activar: habilita R2 y añade el binding STUDIO_ASSETS.',code:'r2_not_configured'},503);
  if(path==='/api/media'&&request.method==='GET'){
    const cursor=url.searchParams.get('cursor')||undefined;
    if(cursor&&cursor.length>1024)return send({error:'Paginación inválida'},400);
    try{
      const listed=await env.STUDIO_ASSETS.list({prefix:STUDIO_MEDIA_PREFIX,limit:100,cursor,include:['customMetadata']});
      return send({images:listed.objects.map(studioMediaItem),cursor:listed.truncated?listed.cursor:null});
    }catch{return send({error:'No se pudo consultar la biblioteca R2'},503)}
  }
  const fileMatch=path.match(/^\/api\/media\/file\/([a-f0-9-]{36}\.(?:jpg|png|webp))$/);
  if(fileMatch&&(request.method==='GET'||request.method==='HEAD')){
    try{
      const obj=await env.STUDIO_ASSETS.get(studioMediaKey(fileMatch[1]));
      if(!obj)return new Response('Imagen no encontrada',{status:404});
      const headers=new Headers({'Content-Type':obj.httpMetadata?.contentType||'application/octet-stream',
        'Cache-Control':'private, max-age=900','X-Content-Type-Options':'nosniff',
        'Content-Security-Policy':"default-src 'none'; sandbox", 'Content-Disposition':'inline'});
      headers.set('Content-Length',String(obj.size));
      return new Response(request.method==='HEAD'?null:obj.body,{status:200,headers});
    }catch{return send({error:'No se pudo recuperar la imagen'},503)}
  }
  if(path==='/api/media/upload'&&request.method==='POST'){
    const type=(request.headers.get('content-type')||'').toLowerCase().split(';')[0].trim();
    if(!STUDIO_MEDIA_TYPES.has(type))return send({error:'Solo JPEG, PNG o WebP (no SVG ni GIF).'},415);
    if(Number(request.headers.get('content-length')||0)>STUDIO_MEDIA_MAX)return send({error:'Imagen demasiado grande (máximo 5 MB).'},413);
    let data;
    try{data=new Uint8Array(await request.arrayBuffer())}catch{return send({error:'No se pudo leer el archivo'},400)}
    if(data.byteLength<16||data.byteLength>STUDIO_MEDIA_MAX||!studioMediaCheckType(data,type))
      return send({error:'Archivo de imagen inválido o demasiado grande'},400);
    const raw=request.headers.get('x-asset-name')||'';
    let name='Imagen';
    try{name=decodeURIComponent(raw).replace(/[<>]/g,'').trim().slice(0,100)||name}catch{}
    const id=crypto.randomUUID()+({['image/png']:'.png',['image/jpeg']:'.jpg',['image/webp']:'.webp'}[type]);
    try{
      await env.STUDIO_ASSETS.put(studioMediaKey(id),data,{
        httpMetadata:{contentType:type,cacheControl:'private, max-age=900'},
        customMetadata:{name,kind:'upload',created:new Date().toISOString()}
      });
      return send({image:{id,name,url:studioMediaImageURL(id),kind:'upload',size:data.byteLength}},201);
    }catch{return send({error:'No se pudo almacenar la imagen en R2'},503)}
  }
  const delMatch=path.match(/^\/api\/media\/([a-f0-9-]{36}\.(?:jpg|png|webp))$/);
  if(delMatch&&request.method==='DELETE'){
    try{await env.STUDIO_ASSETS.delete(studioMediaKey(delMatch[1]));return send({deleted:true})}
    catch{return send({error:'No se pudo eliminar el archivo'},503)}
  }
  if(path==='/api/media/generate'&&request.method==='POST'){
    if(!isJSON)return send({error:'Se requiere JSON'},415);
    if(!env.AI||!env.USAGE_DB)return send({error:'Falta vincular Workers AI y D1 para la generación de imágenes.',code:'ai_not_configured'},503);
    if(Number(request.headers.get('content-length')||0)>2400)return send({error:'Descripción demasiado larga'},413);
    let body;try{const txt=await request.text();if(txt.length>2400)throw Error();body=JSON.parse(txt)}catch{return send({error:'JSON inválido'},400)}
    const prompt=typeof body?.prompt==='string'?body.prompt.trim():'';
    if(prompt.length<12||prompt.length>500)return send({error:'Describe la imagen en 12-500 caracteres.'},400);
    const day=new Date().toISOString().slice(0,10);
    // Atomic, account-wide quota in D1: no image generation without a bounded allowance.
    let count;
    try{
      count=await env.USAGE_DB.prepare(
        'INSERT INTO studio_image_quota(day,used) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET used=used+1 WHERE used < ? RETURNING used'
      ).bind(day,STUDIO_MEDIA_DAILY_AI).first();
    }catch{return send({error:'Cuota de imágenes no preparada: aplica la migración 0003_studio_media.sql.',code:'migration_required'},503)}
    if(!count)return send({error:'Has alcanzado las '+STUDIO_MEDIA_DAILY_AI+' imágenes de hoy (UTC).',code:'daily_image_limit'},429);
    try{
      const result=await env.AI.run(STUDIO_MEDIA_MODEL,{prompt,steps:4});
      if(typeof result?.image!=='string'||result.image.length>STUDIO_MEDIA_MAX*1.4)
        throw Error('invalid_ai_image');
      const binary=atob(result.image);
      if(binary.length>STUDIO_MEDIA_MAX)throw Error('ai_image_too_large');
      const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
      const type=studioMediaType(bytes);
      if(!type)throw Error('unknown_ai_image_type');
      const ext=type==='image/png'?'.png':type==='image/webp'?'.webp':'.jpg';
      const id=crypto.randomUUID()+ext;
      await env.STUDIO_ASSETS.put(studioMediaKey(id),bytes,{
        httpMetadata:{contentType:type,cacheControl:'private, max-age=900'},
        customMetadata:{name:'Imagen IA · '+new Date().toISOString().slice(0,16),kind:'ai',created:new Date().toISOString(),model:'flux-1-schnell'}
      });
      return send({image:{id,name:'Imagen generada',url:studioMediaImageURL(id),kind:'ai',size:bytes.byteLength},used:count.used,dailyLimit:STUDIO_MEDIA_DAILY_AI},201);
    }catch{
      // Retry allowance on failure: a failing provider should not consume daily credits.
      try{await env.USAGE_DB.prepare('UPDATE studio_image_quota SET used=max(0,used-1) WHERE day=?').bind(day).run()}catch{}
      return send({error:'No se pudo generar y guardar la imagen; no se descontará de la cuota diaria.',code:'ai_generation_failed'},502);
    }
  }
  return send({error:'Operación multimedia no disponible'},405);
}
