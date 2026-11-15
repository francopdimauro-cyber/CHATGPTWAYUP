import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const paths = [];
function walk(dir) {
  for (const item of readdirSync(dir,{withFileTypes:true})) {
    if (item.isDirectory() && item.name !== 'node_modules' && item.name !== '.next') walk(join(dir,item.name));
    else if(item.isFile() && /\.(?:ts|tsx)$/.test(item.name) && !item.name.endsWith('.d.ts')) paths.push(join(dir,item.name));
  }
}
walk(root);
for(const file of paths){
  const result = ts.transpileModule(readFileSync(file, 'utf8'), {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, strict: true },
  });
  const errors = (result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,`${relative(root,file)}: ${errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('; ')}`);
}

async function loadTS(relativePath){
  const file = join(root,relativePath);
  const result = ts.transpileModule(readFileSync(file,'utf8'), {
    fileName: file, compilerOptions: {module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
  });
  return await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(result.outputText));
}
const { DEMO_PROJECT, BUTTON_PRESETS } = await loadTS('lib/demo-project.ts');
const { historyReducer } = await loadTS('lib/studio-store.ts');
assert.equal(BUTTON_PRESETS.length,21,'La biblioteca conserva los 21 diseños');
assert.equal(DEMO_PROJECT.name,'Entrena-T Parquesol');
const initial = {past:[],present:DEMO_PROJECT,future:[]};
const moved = historyReducer(initial,{type:'estilo',elementId:'subtitulo',patch:{x:32,y:-8}});
assert.equal(moved.present.elements.subtitulo.style.x,32);
assert.equal(moved.past.length,1);
const undone = historyReducer(moved,{type:'deshacer'});
assert.equal(undone.present.elements.subtitulo.style.x,0);
const redone = historyReducer(undone,{type:'rehacer'});
assert.equal(redone.present.elements.subtitulo.style.y,-8);
const text = historyReducer(redone,{type:'modificar',elementId:'cta',patch:{text:'Reserva ahora'}});
assert.equal(text.present.elements.cta.href,'#contacto','El contenido no altera el destino del botón');
const unknown = historyReducer(text,{type:'modificar',elementId:'nodo-desconocido',patch:{text:'N/A'}});
assert.equal(unknown,text,'Un nodo desconocido no modifica el estado');

const { cloneStudioLayer, serializeStudioLayer, parseStudioLayer } = await loadTS('lib/studio-clipboard.ts');
const origin = DEMO_PROJECT.elements.cta;
const serialized = serializeStudioLayer(origin);
const copied = parseStudioLayer(serialized);
assert.ok(copied,'El portapapeles debe aceptar una capa válida');
assert.equal(copied.text,origin.text);
assert.equal(copied.style.background,origin.style.background);
const cloned = cloneStudioLayer(copied,'inicio','copied-cta',24);
assert.equal(cloned.style.x,24,'Duplicar desplaza la posición para distinguir capas');
const inserted = historyReducer(initial,{type:'insertar',element:cloned,afterId:'cta'});
assert.ok(inserted.present.elements['copied-cta'],'Pegar debe crear una capa real');
assert.equal(inserted.present.sections.find(s=>s.id==='inicio').children.includes('copied-cta'),true);
const deleted = historyReducer(inserted,{type:'eliminar',elementId:'copied-cta'});
assert.equal(deleted.present.elements['copied-cta'],undefined,'Cortar/eliminar retira la capa');
assert.equal(deleted.present.sections.find(s=>s.id==='inicio').children.includes('copied-cta'),false);
const undoDelete = historyReducer(deleted,{type:'deshacer'});
assert.ok(undoDelete.present.elements['copied-cta'],'Deshacer debe restaurar una capa eliminada');
const redoDelete = historyReducer(undoDelete,{type:'rehacer'});
assert.equal(redoDelete.present.elements['copied-cta'],undefined,'Rehacer vuelve a eliminar');
const reordered = historyReducer(inserted,{type:'ordenar',elementId:'copied-cta',direction:-1});
assert.notDeepEqual(reordered.present.sections.find(s=>s.id==='inicio').children,
  inserted.present.sections.find(s=>s.id==='inicio').children,'Traer/enviar debe reordenar');
assert.equal(historyReducer(reordered,{type:'deshacer'}).present,inserted.present);
assert.equal(parseStudioLayer('texto cualquiera'),null,'No pegamos texto arbitrario como capa');
const malicious = serialized.replace('WAYAPP_STUDIO_LAYER_V1', 'OTRO_TIPO');
assert.equal(parseStudioLayer(malicious),null);
console.log('Correcto: copiar, pegar, cortar, duplicar, reordenar y deshacer cambios de capas.');

console.log(`Correcto: ${paths.length} archivos TypeScript/TSX, 21 estilos, historial, acciones y enlaces.`);