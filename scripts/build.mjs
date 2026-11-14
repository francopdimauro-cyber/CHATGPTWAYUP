import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const worker=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
if(!worker.includes('__WEBCREATOR_HTML__'))throw new Error('Missing HTML injection placeholder');
if(!html.includes('id="downloadZip"')||!html.includes('id="preview"'))throw new Error('Missing WebCreator controls');
mkdirSync(new URL('../dist/',import.meta.url),{recursive:true});
writeFileSync(new URL('../dist/worker.js',import.meta.url),worker.replace('__WEBCREATOR_HTML__',JSON.stringify(html)));
console.log('Built dist/worker.js including WebCreator V4 UI');
