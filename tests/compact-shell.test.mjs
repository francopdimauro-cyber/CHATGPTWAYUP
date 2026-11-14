import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const css=read('public/compact-shell.css');
const ui=read('public/index.html');
const build=read('scripts/build.mjs');
const worker=read('dist/worker.js');

test('desktop wizard is viewport-fitted and preserves internal navigation',()=>{
 assert.match(css,/@media\s*\(min-width:900px\)\s*and\s*\(min-height:650px\)/);
 assert.match(css,/height:100dvh/);
 assert.match(css,/grid-template-rows:auto\s+minmax\(0,1fr\)\s+auto/);
 assert.match(css,/\.step\.current\s*\{[^}]*overflow-x:hidden;overflow-y:auto/s);
 assert.match(css,/\.footer-actions#navigation\s*\{/);
 assert.match(css,/\.layout>\.aside\.panel\s*\{[^}]*overflow:auto/s);
 assert.match(ui,/sections\[step\]\.scrollTop=0/);
 assert.equal((ui.match(/<section class="step(?: current)?" tabindex="0"/g)||[]).length,6);
});
test('short and mobile displays retain natural scrolling instead of clipping content',()=>{
 assert.match(css,/@media\s*\(min-width:900px\)\s*and\s*\(max-height:649px\)/);
 assert.match(css,/@media\s*\(max-width:899px\)/);
 assert.match(css,/@media\s*\(max-width:520px\)/);
 assert.match(ui,/if\(!window\.matchMedia\('\(min-width:900px\) and \(min-height:650px\)'\)\.matches\)/);
});
test('compact shell styles are bundled after the premium theme',()=>{
 assert.match(build,/const compact=read\('public\/compact-shell\.css'\)/);
 assert.match(build,/theme\+'\\n'\+compact/);
 assert.ok(worker.includes('height:100dvh'));
 assert.ok(worker.includes('WAYUP / CREATIVE WORKSPACE'));
 assert.ok(worker.includes('id=\\"wcStudio\\"'));
});
