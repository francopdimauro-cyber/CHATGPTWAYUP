import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const base=read('public/index.html');
const css=read('public/studio.css');
const theme=read('public/studio-theme.css');
const compact=read('public/compact-shell.css');
const precisionDark=read('public/precision-dark.css');
const commandPalette=read('public/command-palette.js');
const studioClient=read('public/studio.js');
const studioServer=read('src/studio.js');
const worker=read('src/worker.js');
if(!worker.includes('__WEBCREATOR_HTML__')||!worker.includes('/*__WEBCREATOR_STUDIO_SERVER__*/'))
  throw new Error('Faltan puntos de inserción de Studio');
if(!base.includes('id="downloadZip"')||!base.includes('id="preview"'))
  throw new Error('Faltan controles del constructor original');
const html=base.replace('</head>','<style>\n'+css+'\n'+theme+'\n'+compact+'\n'+precisionDark+'\n</style></head>')
  .replace('</body>','<script>\n'+studioClient+'\n</script><script>\n'+commandPalette+'\n</script></body>');
const built=worker.replace('/*__WEBCREATOR_STUDIO_SERVER__*/',studioServer)
  .replace('__WEBCREATOR_HTML__',JSON.stringify(html));
mkdirSync(new URL('../dist/',import.meta.url),{recursive:true});
writeFileSync(new URL('../dist/worker.js',import.meta.url),built);
console.log('Built WebCreator Studio + original Multi-IA generator');
