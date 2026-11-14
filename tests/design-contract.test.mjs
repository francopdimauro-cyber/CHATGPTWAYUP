import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=file('public/index.html');
const studio=file('public/studio.js');
const studioCss=file('public/studio.css');
const theme=file('public/studio-theme.css');
const worker=file('src/worker.js');
const built=file('dist/worker.js');

test('constructor retains generation and recovery controls',()=>{
  for(const id of ['downloadZip','downloadHtml','preview','generate','refine','back','next','recoverProject','checkProvider','progress'])
    assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(worker,/\/api\/generate-stream/);
  assert.match(worker,/\/api\/recovery/);
});
test('premium frontend uses original components and responsive styles',()=>{
  assert.match(html,/class="intro-visual"/);
  assert.match(html,/id="hero-title"/);
  assert.match(theme,/\.intro-visual/);
  assert.match(theme,/@media\(max-width:550px\)/);
  assert.match(theme,/prefers-reduced-motion/);
  assert.match(theme,/#wcStudio/);
  assert.ok(theme.length>2000,'Style should not be a placeholder');
});
test('studio maintains canvas isolation, storage, history and undo controls',()=>{
  assert.match(studio,/sandbox="allow-scripts"/);
  assert.doesNotMatch(studio,/sandbox="allow-scripts allow-same-origin"/);
  assert.match(studio,/\/api\/projects/);
  for(const id of ['wcStudio','wcSave','wcUndo','wcRedo','wcFrame','wcHistory','wcProjects'])
    assert.match(studio,new RegExp('id="'+id+'"'));
  assert.match(studioCss,/#wcStudio/);
});
test('agent includes a client-specific original art direction and editability contract',()=>{
  for(const text of ['director creativo','CSS','data-wc-section','no inventes','Sin','<!DOCTYPE html>']){
    assert.ok(worker.toLowerCase().includes(text.toLowerCase()),'Missing art direction: '+text);
  }
});
test('bundled Worker includes Studio, theme and original application',()=>{
  assert.match(built,/handleStudio/);
  assert.match(built,/vis-main/);
  assert.match(built,/--ink-2/);
  assert.match(built,/cloudflare-zero-trust/);
  assert.match(built,/OPENROUTER_API_KEY/);
  assert.doesNotThrow(()=>new vm.Script(built.replace('export default {','const worker = {'),{filename:'dist/worker.js'}));
});
test('inline frontend and Studio scripts parse without JavaScript errors',()=>{
  const re=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  for(const code of [html,studio]) {
    if(code===studio) assert.doesNotThrow(()=>new vm.Script(studio));
    else for(const match of code.matchAll(re))assert.doesNotThrow(()=>new vm.Script(match[1]));
  }
});

test('no-token project quality report remains wired to Studio and API',()=>{
  const server=file('src/studio.js');
  assert.match(studio,/id="wcAudit"/);
  assert.match(studio,/id="wcAuditResult"/);
  assert.match(studio,/\/api\/projects\/.*quality/);
  assert.match(server,/quality==='quality'/);
  assert.match(worker,/IDs duplicados/);
  assert.match(worker,/sin atributo alt/);
});
