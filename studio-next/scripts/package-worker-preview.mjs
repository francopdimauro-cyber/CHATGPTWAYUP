import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { createHash } from 'node:crypto';

const project=join(import.meta.dirname,'..');
const folder=join(project,'out');
const destination=join(project,'..','preview-artifacts','wayapp-editor');
const LIMIT=180000;
const mime={
 '.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
 '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
 '.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.ico':'image/x-icon',
 '.txt':'text/plain; charset=utf-8','.map':'application/json'
};
const files=[];
function walk(directory) {
 for(const item of readdirSync(directory,{withFileTypes:true})) {
  const path=join(directory,item.name);
  if(item.isDirectory())walk(path);
  else if(item.isFile())files.push(path);
 }
}
if(!statSync(folder).isDirectory())throw Error('Falta la salida estática de Next');
walk(folder);
files.sort();
const content={};
for(const path of files) {
 const rel=relative(folder,path).split('\\').join('/');
 if(rel.startsWith('.')||rel.includes('..'))throw Error('Nombre inválido');
 const url=rel==='index.html'?'/':'/'+rel;
 const data=readFileSync(path);
 if(data.length>1500000)throw Error('Archivo demasiado grande: '+rel);
 content[url]=[data.toString('base64'),mime[extname(rel).toLowerCase()]||'application/octet-stream'];
}
if(!content['/']||!Object.keys(content).some(x=>x.startsWith('/_next/static/')))
 throw Error('No hay HTML de inicio o archivos Next.js');
const json=JSON.stringify(content);
const sum=createHash('sha256').update(json).digest('hex');
if(json.length>5000000)throw Error('Manifiesto incompatible con Worker Free: '+json.length);
rmSync(destination,{force:true,recursive:true});mkdirSync(destination,{recursive:true});
const chunks=[];
for(let pos=0;pos<json.length;pos+=LIMIT){
 const name='assets-'+String(chunks.length).padStart(3,'0')+'.txt';
 writeFileSync(join(destination,name),json.slice(pos,pos+LIMIT),'utf8');
 chunks.push(name);
}
writeFileSync(join(destination,'manifest.json'),JSON.stringify({
 format:'wayapp-next-static-v1',bytes:json.length,sha256:sum,
 count:Object.keys(content).length,chunks,generatedBy:'GitHub Actions / Next export'
},null,2));
console.log(JSON.stringify({files:Object.keys(content).length,chars:json.length,chunks:chunks.length,sha256:sum}));
