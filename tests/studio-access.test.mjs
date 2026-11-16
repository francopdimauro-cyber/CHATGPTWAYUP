import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign} from 'node:crypto';
import {verifyAccessJwt,studioAccessContext,STUDIO_ACCESS_AUD} from '../src/studio-access.js';

const TEAM='https://equipo-ficticio.cloudflareaccess.com';
const env={STUDIO_ACCESS_TEAM_DOMAIN:TEAM};
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'kid-1',alg:'RS256'};
const fetcher=async()=>new Response(JSON.stringify({keys:[jwk]}),{headers:{'content-type':'application/json'}});
const b64=v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url');
function sign(payload,{kid='kid-1',key=privateKey}={}){
  const head=b64({alg:'RS256',kid,typ:'JWT'}),body=b64(payload);
  const s=createSign('RSA-SHA256');s.update(head+'.'+body);
  return head+'.'+body+'.'+s.sign(key).toString('base64url');
}
const now=Date.now(),t=Math.floor(now/1000);
const good={aud:[STUDIO_ACCESS_AUD],iss:TEAM,email:'Owner@Example.com',exp:t+600,nbf:t-10};
const req=token=>new Request('https://studio.test/studio-api/x',{headers:token?{'Cf-Access-Jwt-Assertion':token}:{}});

test('JWT válido devuelve el correo normalizado',async()=>{
  assert.deepEqual(await verifyAccessJwt(req(sign(good)),env,{fetcher,now}),{email:'owner@example.com'});
});
test('Sin cabecera, audiencia, emisor o caducidad incorrectos no hay identidad',async()=>{
  assert.equal(await verifyAccessJwt(req(''),env,{fetcher,now}),null);
  assert.equal(await verifyAccessJwt(req(sign({...good,aud:['otra-app']})),env,{fetcher,now}),null);
  assert.equal(await verifyAccessJwt(req(sign({...good,iss:'https://otro.cloudflareaccess.com'})),env,{fetcher,now}),null);
  assert.equal(await verifyAccessJwt(req(sign({...good,exp:t-600})),env,{fetcher,now}),null);
});
test('Firma de otra clave o token manipulado se rechaza',async()=>{
  const other=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey;
  assert.equal(await verifyAccessJwt(req(sign(good,{key:other})),env,{fetcher,now}),null);
  const [h,,s]=sign(good).split('.');
  assert.equal(await verifyAccessJwt(req(h+'.'+b64({...good,email:'intruso@example.com'})+'.'+s),env,{fetcher,now}),null);
});
test('Dominio de equipo no configurado desactiva la verificación',async()=>{
  assert.equal(await verifyAccessJwt(req(sign(good)),{},{fetcher,now}),null);
});
test('El contexto expone access.getIdentity para los puentes',async()=>{
  const ctx=await studioAccessContext(req(sign(good)),env,{},{fetcher,now});
  assert.equal(ctx.access.aud,STUDIO_ACCESS_AUD);
  assert.deepEqual(await ctx.access.getIdentity(),{email:'owner@example.com'});
  const none=await studioAccessContext(req(''),env,{},{fetcher,now});
  assert.equal(none.access,undefined);
});
