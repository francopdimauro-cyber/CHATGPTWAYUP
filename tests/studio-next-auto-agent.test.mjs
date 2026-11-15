import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('public/studio-next-agents-panel.js','utf8');
const begin=source.indexOf('/* WAYUP_AUTO_AGENT_CONTEXT_BEGIN');
const end=source.indexOf('/* WAYUP_AUTO_AGENT_CONTEXT_END */');
assert.ok(begin>=0&&end>begin,'La función de extracción existe');
const fn=vm.runInNewContext(source.slice(begin,end)+'\nwayupAgentContextFromHtml');
const site='<!doctype html><html><head><title>Restaurante La Casona</title><style>.private{display:none} CLAVE-CSS </style><script>const secret="MI-CLAVE-DE-PRUEBA"</script></head><body><h1>Restaurante La Casona</h1><p>Ofrecemos cocina tradicional y reservas mediante teléfono. Abrimos de martes a domingo y tenemos menús de temporada para todos los visitantes de la zona.</p></body></html>';

test('crea prompt contextual con textos comerciales y sin scripts ni estilos',()=>{
 const result=fn(site);
 assert.ok(result.includes('Restaurante La Casona'));
 assert.ok(result.includes('cocina tradicional'));
 assert.ok(result.includes('No inventes horarios'));
 assert.ok(!result.includes('MI-CLAVE-DE-PRUEBA'));
 assert.ok(!result.includes('CLAVE-CSS'));
 assert.ok(result.length<2000);
});

test('no procesa documentos vacíos ni excesivos',()=>{
 assert.throws(()=>fn('<html><body>Hola</body></html>'),/suficiente/);
 assert.throws(()=>fn('x'.repeat(6_000_001)),/demasiado grande/);
});

test('el flujo exige acción del usuario y no duplica agentes en reintentos',()=>{
 assert.ok(source.includes('if(!confirm("¿Crear un agente'));
 assert.ok(source.includes('pendingAuto=state;'));
 assert.ok(source.includes('if(!state.agentId)'));
 assert.ok(source.includes('if(!state.chatId)'));
 assert.ok(source.includes('wayupZipWithAgent(buffer,snippet)'));
 assert.ok(source.includes('status("wa-auto-status","✓ Completado'));
 assert.ok(!source.includes('window.localStorage.setItem'));
});

test('la UI permite asociar agente automático solo con web y dominio elegidos',()=>{
 const html=readFileSync('public/studio-next-agents-panel.html','utf8');
 for(const id of ['wa-auto-zip','wa-auto-origin','wa-auto-create','wa-auto-status'])assert.ok(html.includes('id="'+id+'"'));
});
