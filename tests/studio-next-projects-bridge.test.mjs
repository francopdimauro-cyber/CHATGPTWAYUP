import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {wayupStudioProjectsBridge} from '../src/studio-next-projects-bridge.js';

const ROOT='https://preview.test/studio-api/projects';
const AUD='78890161c85752fcd44d08bde44510aac74aa51d9ee12371327fa6875ac6d8a6';
const EMAIL='owner@example.com';
const OWNER='access:'+createHash('sha256').update('wayup-preview-access-identity-v1:'+EMAIL).digest('hex');
const ctx={access:{aud:AUD,getIdentity:async()=>({email:EMAIL})}};
const PROJECT='3208a443-5e7c-4228-9a84-a479e5cadf91';
const validZip=Uint8Array.from(Buffer.from('UEsDBBQAAAAIAK65b12z6AIzQgAAAFgAAAAKAAAAaW5kZXguaHRtbLNRTMlPLqksSFXIKMnNsbOBkqmJKXY2JZklOal2wSWlKZn5NvoQno0+RC4pP6USqM7QziM/JxEoaAiUgYjpg40AAFBLAQIUAxQAAAAIAK65b12z6AIzQgAAAFgAAAAKAAAAAAAAAAAAAACAAQAAAABpbmRleC5odG1sUEsFBgAAAAABAAEAOAAAAGoAAAAAAA==','base64'));

function environment(overrides={}){
  const statements=[];
  const db={
    prepare(sql){
      return {bind(...args){statements.push({sql,args});return {
        all:async()=>({results:[{id:PROJECT,name:'Web de prueba',version:1}]}),
        first:async()=>sql.startsWith('SELECT count')?{count:0}:
          sql.includes('FROM studio_next_projects')?{id:PROJECT,name:'Web de prueba',version:1}:
          {object_key:'studio/'+OWNER+'/'+PROJECT+'/v1.zip'},
        run:async()=>({meta:{changes:1}})
      };}};
    },
    batch:async()=>[{meta:{changes:1}},{meta:{changes:1}}]
  };
  const store={files:new Map(),put:async function(k,v){this.files.set(k,v);},get:async()=>({body:new Uint8Array([80,75,3,4])}),delete:async function(k){this.files.delete(k);}};
  return {STUDIO_DB:db,STUDIO_FILES:store,STUDIO_OWNER_EMAIL:EMAIL,statements,...overrides};
}
const req=(url,method='GET',headers={},body)=>new Request(url,{method,headers,body});

test('Fuera del prefijo no se interceptan rutas',async()=>{
  assert.equal(await wayupStudioProjectsBridge(req('https://preview.test/'),environment()),null);
});
test('CSRF impide mutaciones con otro origen',async()=>{
  const out=await wayupStudioProjectsBridge(req(ROOT,'POST',{'Origin':'https://atacante.test'}),environment());
  assert.equal(out.status,403);
});
test('Sin bindings no se simula persistencia cloud',async()=>{
  const out=await wayupStudioProjectsBridge(req(ROOT),{});
  assert.equal(out.status,503);
});
test('Sin sesión de Access no se filtran proyectos',async()=>{
  const out=await wayupStudioProjectsBridge(req(ROOT),environment());
  assert.equal(out.status,401);
});
test('Otra cuenta de Access o audiencia distinta no accede',async()=>{
  const intruder={access:{aud:AUD,getIdentity:async()=>({email:'intruso@example.com'})}};
  assert.equal((await wayupStudioProjectsBridge(req(ROOT),environment(),intruder)).status,403);
  const wrongAud={access:{aud:'otra',getIdentity:async()=>({email:EMAIL})}};
  assert.equal((await wayupStudioProjectsBridge(req(ROOT),environment(),wrongAud)).status,401);
});
test('La consulta de proyectos se filtra obligatoriamente por propietario',async()=>{
  const env=environment();
  const out=await wayupStudioProjectsBridge(req(ROOT,'GET',{}),env,ctx);
  assert.equal(out.status,200);
  assert.ok(env.statements.some(x=>x.sql.includes('owner_id=?')&&x.args.includes(OWNER)));
  assert.ok(Array.isArray((await out.json()).projects));
});
test('La descarga de versión sigue el propietario y no renderiza HTML activo',async()=>{
  const env=environment();
  const out=await wayupStudioProjectsBridge(req(ROOT+'/'+PROJECT,'GET',{}),env,ctx);
  assert.equal(out.status,200);
  assert.equal(out.headers.get('content-type'),'application/zip');
  assert.equal(out.headers.get('x-content-type-options'),'nosniff');
  assert.match(out.headers.get('content-disposition'),/attachment/);
});
test('Crear proyecto exige ZIP, sesión, origen y usa R2 privado',async()=>{
  const env=environment();
  const out=await wayupStudioProjectsBridge(req(ROOT,'POST',{
    'Origin':'https://preview.test','Content-Type':'application/zip'
  },validZip),env,ctx);
  assert.equal(out.status,201);
  assert.equal(env.STUDIO_FILES.files.size,1);
  assert.ok([...env.STUDIO_FILES.files.keys()][0].startsWith('studio/'+OWNER+'/'));
});
test('Rechazar HTML sin archivarlo como ZIP',async()=>{
  const env=environment();
  const out=await wayupStudioProjectsBridge(req(ROOT,'POST',{
    'Origin':'https://preview.test','Content-Type':'application/zip'
  },new TextEncoder().encode('<script>alert(1)</script>')),env,ctx);
  assert.equal(out.status,400);
  assert.equal(env.STUDIO_FILES.files.size,0);
});
test('No se almacena un ZIP con cabecera falsa aunque parezca comprimido',async()=>{
  const env=environment();
  const out=await wayupStudioProjectsBridge(req(ROOT,'POST',{
    'Origin':'https://preview.test','Content-Type':'application/zip'
  },new Uint8Array([80,75,3,4,0,0,0,0])),env,ctx);
  assert.equal(out.status,400);
  assert.equal(env.STUDIO_FILES.files.size,0);
});
test('Concurrencia optimista: una versión obsoleta devuelve 409',async()=>{
  const env=environment();
  const out=await wayupStudioProjectsBridge(req(ROOT+'/'+PROJECT,'PUT',{
    'Origin':'https://preview.test','Content-Type':'application/zip',
    'X-Expected-Version':'2'
  },validZip),env,ctx);
  assert.equal(out.status,409);
  assert.equal(env.STUDIO_FILES.files.size,0);
});
