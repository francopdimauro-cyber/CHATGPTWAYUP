import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=file('public/index.html');
const css=file('public/precision-dark.css');
const palette=file('public/command-palette.js');
const bundle=file('dist/worker.js');
const build=file('scripts/build.mjs');

test('precision dark system has coherent layered surfaces and tight corners',()=>{
 for(const token of ['#09090b','#121215','#18181b','rgba(255,255,255,.09)','--surface-0','--surface-1','--surface-2'])
   assert.ok(css.toLowerCase().includes(token),'missing design token: '+token);
 assert.match(css,/font-variant-numeric:tabular-nums/);
 assert.match(css,/letter-spacing/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/#wcStudio/);
 assert.match(css,/\.wc-command-root/);
 assert.match(css,/\.option\.selected/);
 assert.match(css,/#engineElapsed/);
 assert.doesNotMatch(css,/border-radius:\s*9999px/);
});
test('command palette supports actual keyboard shortcuts and real actions',()=>{
 assert.match(html,/id="cmdOpen"/);
 assert.match(palette,/event\.ctrlKey\|\|event\.metaKey/);
 assert.match(palette,/wcCommandInput/);
 assert.match(palette,/role="dialog"/);
 assert.match(palette,/aria-modal="true"/);
 assert.match(palette,/window\.WebCreatorStudio\?\.open/);
 assert.match(palette,/q\('downloadZip'\)\?\.click/);
 assert.match(palette,/q\('next'\)\?\.click/);
 assert.match(palette,/key==='Escape'/);
 assert.match(palette,/key==='Tab'/);
 assert.doesNotThrow(()=>new vm.Script(palette,{filename:'command-palette.js'}));
});
test('theme and palette are included in deployed Worker bundle',()=>{
 assert.match(build,/precision-dark\.css/);
 assert.match(build,/command-palette\.js/);
 assert.match(bundle,/--surface-0:#09090b/);
 assert.match(bundle,/wcCommandRoot/);
 assert.match(bundle,/cmdOpen/);
 assert.match(bundle,/WebCreator Studio/);
 assert.match(bundle,/OPENROUTER_API_KEY/);
});
test('AI engine and Studio remain unchanged in the new UI design branch',()=>{
 const worker=file('src/worker.js');
 const server=file('src/studio.js');
 for(const route of ['/api/generate-stream','/api/refine-stream','/api/projects'])
   assert.ok((worker+server).includes(route));
 assert.match(html,/id="preview"/);
 assert.match(html,/id="generate"/);
 assert.match(html,/id="recoverProject"/);
 assert.match(html,/id="downloadZip"/);
});
