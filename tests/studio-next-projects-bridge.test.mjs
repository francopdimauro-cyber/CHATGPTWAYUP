import test from 'node:test';
import assert from 'node:assert/strict';
import {wayupStudioProjectsBridge} from '../src/studio-next-projects-bridge.js';

const ROOT='https://preview.test/studio-api/projects';
const OWNER='6f29a13c-849e-4b41-b343-5c5e11a96b73';
const PROJECT='3208a443-5e7c-4228-9a84-a479e5cadf91';
const cookie='af_session=token-de-prueba';
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
  return {STUDIO_DB:db,STUDIO_FILES:store,AGENT_BUILDER:{
    fetch:async request=>{
      assert.equal(request.headers.get('Cookie'),cookie,'Solo cookie privada de sesión');
      return new Response(JSON.stringify({user:{id:OWNER}}),{headers:{'content-type':'application/json'}});
    }
  },statements,...overrides};
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
test('Sin sesión no se filtran proyectos',async()=>{
  const out=await wayupStudioProjectsBridge(req(ROOT),environment());
  assert.equal(out.status,401);
});
test('La consulta de proyectos se filtra obligatoriamente por propietario',async()=>{
  const env=environment();
  const out=await wayupStudioProjectsBridge(req(ROOT,'GET',{'Cookie':cookie}),env);
  assert.equal(out.status,200);
  assert.ok(env.statements.some(x=>x.sql.includes('owner_id=?')&&x.args.includes(OWNER)));
  assert.ok(Array.isArray((await out.json()).projects));
});
test('La descarga de versión sigue el propietario y no renderiza HTML activo',async()=>{
  const env=environment();
  const out=await wayupStudioProjectsBridge(req(ROOT+'/'+PROJECT,'GET',{'Cookie':cookie}),env);
  assert.equal(out.status,200);
  assert.equal(out.headers.get('content-type'),'application/zip');
  assert.equal(out.headers.get('x-content-type-options'),'nosniff');
  assert.match(out.headers.get('content-disposition'),/attachment/);
});
test('Crear proyecto exige ZIP, sesión, origen y usa R2 privado',async()=>{
  const env=environment();
  const out=await wayupStudioProjectsBridge(req(ROOT,'POST',{
    'Cookie':cookie,'Origin':'https://preview.test','Content-Type':'application/zip'
  },new Uint8Array([80,75,3,4,0,0,0,0])),env);
  assert.equal(out.status,201);
  assert.equal(env.STUDIO_FILES.files.size,1);
  assert.ok([...env.STUDIO_FILES.files.keys()][0].startsWith('studio/'+OWNER+'/'));
});
test('Rechazar HTML sin archivarlo como ZIP',async()=>{
  const env=environment();
  const out=await wayupStudioProjectsBridge(req(ROOT,'POST',{
    'Cookie':cookie,'Origin':'https://preview.test','Content-Type':'application/zip'
  },new TextEncoder().encode('<script>alert(1)</script>')),env);
  assert.equal(out.status,400);
  assert.equal(env.STUDIO_FILES.files.size,0);
});
test('Concurrencia optimista: una versión obsoleta devuelve 409',async()=>{
  const env=environment();
  const out=await wayupStudioProjectsBridge(req(ROOT+'/'+PROJECT,'PUT',{
    'Cookie':cookie,'Origin':'https://preview.test','Content-Type':'application/zip',
    'X-Expected-Version':'2'
  },new Uint8Array([80,75,3,4,0,0,0,0])),env);
  assert.equal(out.status,409);
  assert.equal(env.STUDIO_FILES.files.size,0);
});
