import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { patchPreviewWorker } from '../scripts/patch-studio-next-agent-preview.mjs';

const bridge=readFileSync('src/studio-next-agents-bridge.js','utf8');
const client=readFileSync('public/studio-next-agents-panel.js','utf8');
const css=readFileSync('public/studio-next-agents-panel.css','utf8');
const html=readFileSync('public/studio-next-agents-panel.html','utf8');
const stub=(
 'const FILES = new Map(Object.entries({"/":["PGh0bWw+PC9odG1sPg==","text/html; charset=utf-8"]}));\n'+
 'function bytesFor(path){return new Uint8Array(0)}\n'+
 'export default {\n'+
 "  async fetch(request) {\n"+
 "    if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Método no permitido',{status:405,headers:{Allow:'GET, HEAD'}});\n"+
 "    const url=new URL(request.url);\n"+
 "    const path=url.pathname==='/'?'/':url.pathname;\n"+
 "    const data=request.method==='HEAD'?null:bytesFor(path);\n"+
 "    return new Response(data);\n"+
 '  }\n};\n'
).padEnd(1500,'\n');
test('preserva la maqueta estática y añade puente y panel',()=>{
 const output=patchPreviewWorker(stub,bridge,client,css,html);
 assert.ok(output.includes('WAYUP_STUDIO_AGENT_BRIDGE_V1'));
 assert.ok(output.includes('env.AGENT_BUILDER.fetch'));
 assert.ok(output.includes('wayupStudioAgentBridge(request,env)'));
 assert.ok(output.includes('studio-next-agents-panel.css'));
 assert.ok(output.includes('studio-next-agents-panel.js'));
 assert.ok(output.includes("new TextDecoder().decode(bytesFor(path)).replace('</body>'"));
 assert.ok(output.includes('const FILES = new Map(Object.entries('));
 assert.equal((output.match(/export default \{/g)||[]).length,1);
 assert.throws(()=>patchPreviewWorker(output,bridge,client,css,html),/ya contiene/);
});
test('si cambia la plantilla, bloquea el cambio',()=>{
 assert.throws(()=>patchPreviewWorker('x',bridge,client,css,html),/válido/);
 assert.throws(()=>patchPreviewWorker(stub.replace('const data=request.method', 'const payload=request.method'),bridge,client,css,html),/Falta marcador/);
});
test('API solo incluye endpoints explícitos y controla sesión',()=>{
 assert.ok(bridge.includes('WAYUP_AGENT_ROUTES'));
 assert.ok(bridge.includes('Origin'));
 assert.ok(bridge.includes('af_session='));
 assert.ok(!bridge.includes('Authorization: "Bearer'));
 assert.ok(!client.includes('localStorage'));
 assert.ok(!client.includes('NVIDIA_API_KEY'));
});
