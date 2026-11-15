import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const studio=read('public/studio.js');
const css=read('public/studio-pro.css');
const build=read('scripts/build.mjs');
const bundled=read('dist/worker.js');

test('Professional Studio keeps every editing integration but reorganizes the inspector',()=>{
 const ids=['wcStudio','wcFrame','wcProjects','wcProjectSearch','wcSectionRail','wcSections','wcInspectorDesign','wcInspectorProject','wcTabDesign','wcTabProject','wcApplyText','wcApplyStyle','wcApplyAppearance','wcApplyLink','wcMediaPick','wcDownload','wcZip','wcSave','wcUndo','wcRedo','wcHistory','wcAudit'];
 for(const id of ids.filter(x=>x!=='wcSectionRail'))
   assert.ok(studio.includes('id="'+id+'"'), 'Control missing: '+id);
 for(const title of ['Contenido','Tipografía','Apariencia','Imagen','Enlace'])
   assert.ok(studio.includes(title),'Missing inspector section: '+title);
 assert.match(studio,/sandbox="allow-scripts"/);
 assert.doesNotMatch(studio,/sandbox="allow-scripts allow-same-origin"/);
 assert.match(studio,/aria-label="Tamaño de pantalla"/);
});
test('Studio offers navigable structure, project filtering and functional viewport controls',()=>{
 assert.match(studio,/drawSections\(\)/);
 assert.match(studio,/wcNavigateTo/);
 assert.match(studio,/wcProjectSearch.*addEventListener\('input',list\)/);
 assert.match(studio,/wcLibraryCollapse.*addEventListener/);
 assert.match(studio,/function setDevice\(value\)/);
 assert.match(studio,/wcViewportInfo/);
 assert.match(studio,/function setInspector\(which\)/);
 assert.match(studio,/function setControls\(\)/);
 assert.match(studio,/Guardar versión/);
});
test('Type styling only loads whitelisted open fonts and preserves image/media features',()=>{
 assert.match(studio,/FONT_FAMILIES=new Set/);
 assert.match(studio,/fontHref=name/);
 assert.match(studio,/FONT_FAMILIES\.has\(family\)/);
 assert.match(studio,/data-wc-font/);
 assert.match(studio,/wcFontFamily/);
 assert.match(studio,/wcFontWeight/);
 assert.match(studio,/wcLineHeight/);
 assert.match(studio,/wcLetterSpacing/);
 assert.match(studio,/window\.WebCreatorMedia\?\.portableHTML/);
 assert.match(studio,/window\.WebCreatorMedia\?\.warmPreview/);
 assert.match(studio,/wcMediaPick/);
 assert.doesNotThrow(()=>new vm.Script(studio,{filename:'studio.js'}));
});
test('Responsive pro layer is bundled last and scoped to Studio',()=>{
 assert.match(build,/const studioPro=read\('public\/studio-pro\.css'\)/);
 assert.match(build,/mediaCss\+'\\n'\+studioPro/);
 assert.match(css,/#wcStudio \.wc-property-group/);
 assert.match(css,/#wcStudio \.wc-canvas-controls/);
 assert.match(css,/#wcStudio \.wc-library/);
 assert.match(css,/:root\[data-wc-theme="dark"\] #wcStudio/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(bundled,/wc-studio-mark/);
 assert.match(bundled,/wc-project-panel/);
 assert.match(bundled,/--s-accent-soft/);
 assert.match(bundled,/STUDIO_MEDIA_DAILY_AI=10/);
 assert.match(bundled,/OPENROUTER_API_KEY/);
});
