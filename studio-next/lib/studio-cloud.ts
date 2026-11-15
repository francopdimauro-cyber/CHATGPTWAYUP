import {siteFromZip,siteZip,type SiteBundle} from './web-project-files';

const ROOT='/studio-api/projects';
export type CloudSiteSummary={id:string;name:string;version:number;updated_at:string};
export type CloudStatus='ready'|'signin'|'unavailable';
async function errorBody(response:Response):Promise<Error>{
  const result=await response.json().catch(()=>({})) as {error?:string};
  return Error(typeof result.error==='string'?result.error:'Error del servidor ('+response.status+').');
}
export async function cloudListSites():Promise<CloudSiteSummary[]>{
  const response=await fetch(ROOT,{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw await errorBody(response);
  const data=await response.json() as {projects?:CloudSiteSummary[]};
  return Array.isArray(data.projects)?data.projects:[];
}
export async function cloudStatus():Promise<CloudStatus>{
  try{
    const response=await fetch(ROOT,{credentials:'same-origin',cache:'no-store'});
    return response.ok?'ready':response.status===401?'signin':'unavailable';
  }catch{return 'unavailable';}
}
export async function cloudSaveSite(site:SiteBundle):Promise<SiteBundle>{
  // Guardamos la web completa y sus recursos como ZIP privado. Nunca HTML ejecutable.
  const bytes=siteZip(site);
  const copy=new Uint8Array(bytes.byteLength);copy.set(bytes);
  const exists=Boolean(site.cloud);
  const response=await fetch(exists?ROOT+'/'+site.cloud!.id:ROOT,{
    method:exists?'PUT':'POST',credentials:'same-origin',cache:'no-store',
    headers:{
      'Content-Type':'application/zip',
      'X-Project-Name':encodeURIComponent(site.name),
      ...(exists?{'X-Expected-Version':String(site.cloud!.version)}:{})
    },
    body:new Blob([copy.buffer],{type:'application/zip'})
  });
  if(!response.ok)throw await errorBody(response);
  const json=await response.json() as {id:string;version:number};
  if(!json.id||!Number.isSafeInteger(json.version))
    throw Error('El servidor no confirmó el guardado en la nube.');
  return {...site,cloud:{id:json.id,version:json.version}};
}
export async function cloudLoadSite(item:CloudSiteSummary):Promise<SiteBundle>{
  const response=await fetch(ROOT+'/'+encodeURIComponent(item.id),{
    credentials:'same-origin',cache:'no-store'
  });
  if(!response.ok)throw await errorBody(response);
  const length=Number(response.headers.get('content-length')||0);
  if(length>25_000_000)throw Error('Archivo cloud demasiado grande para importar.');
  const binary=new Uint8Array(await response.arrayBuffer());
  const site=siteFromZip(binary); // Incluye verificación ZIP y límites de descompresión.
  return {...site,name:item.name,cloud:{id:item.id,version:item.version}};
}
