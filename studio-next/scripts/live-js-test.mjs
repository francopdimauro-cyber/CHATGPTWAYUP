// Prueba de la vista «En vivo»: el JavaScript de la web se ejecuta aislado, sin red ni salir de la página.
// Uso: con el servidor de desarrollo en marcha →  node scripts/live-js-test.mjs [url]
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://localhost:3123/';
const HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Web ficticia JS</title>
<style>html.js .aparece{opacity:.5}</style></head><body><section id="hero"><h1>Titular</h1>
<button id="menu" aria-expanded="false">Menú</button><a id="fuera" href="https://example.com/">Externo</a></section>
<script>document.documentElement.classList.add('js');var b=document.getElementById('menu');
b.addEventListener('click',function(){b.setAttribute('aria-expanded','true');b.textContent='Abierto';});
window.__red='sin probar';try{fetch('https://example.com/').then(function(){window.__red='permitida'},function(){window.__red='bloqueada'});}catch(e){window.__red='bloqueada'}</script></body></html>`;
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const out = [];const check=(l,ok,x='')=>out.push((ok?'✔ ':'✘ ')+l+(x?' · '+x:''));
let paso='inicio';const P=n=>{paso=n};
try{
  await page.goto(URL);
  P('Empezar en blanco');  await page.getByRole('button', { name: /Empezar en blanco/ }).click();
  await page.getByRole('button', { name: 'Código' }).first().click();
  await page.getByLabel('Editor completo de HTML de la web').fill(HTML);
  P('Aplicar HTML');  await page.getByRole('button', { name: /Aplicar y ver resultado/ }).click();
  const edit = page.frameLocator('iframe[title^="Previsualizaci"]');
  await edit.locator('h1').waitFor();
  check('En el lienzo de edición el script NO se ejecuta', !(await edit.locator('html').getAttribute('class'))?.includes('js'));
  P('En vivo/ }).click();');  await page.getByRole('button', { name: /En vivo/ }).click();
  const live = page.frameLocator('iframe[title="Vista en vivo de la web"]');
  await live.locator('#menu').waitFor();
  check('En vivo el script se ejecuta', (await live.locator('html').getAttribute('class'))?.includes('js'));
  P("#menu').click");  await live.locator('#menu').click();
  check('Interacción del script (clic en menú)', (await live.locator('#menu').textContent())==='Abierto');
  await page.waitForTimeout(800);
  const frame = page.frames().find(f=>f.name()===''&&f!==page.mainFrame()&&f.url()==='about:srcdoc'&&f.parentFrame()===page.mainFrame()&&f!==null);
  const liveFrame = (await page.$('iframe[title="Vista en vivo de la web"]')).contentFrame();
  const red = await (await liveFrame).evaluate(()=>window.__red);
  check('La red está bloqueada', red==='bloqueada', red);
  const aislado = await (await liveFrame).evaluate(()=>{try{return String(window.parent.document.title)}catch{return 'aislado'}});
  check('No puede leer el editor', aislado==='aislado', aislado);
  P("#fuera').click");  await live.locator('#fuera').click();
  await page.waitForTimeout(500);
  check('Enlace externo no saca de la página', await live.locator('#menu').isVisible());
  // Script propio desde Código
  P('Volver a editar');  await page.getByRole('button', { name: /Volver a editar/ }).click();
  await page.getByRole('button', { name: 'Código' }).first().click();
  P("Script propio' })");  await page.getByRole('tab', { name: 'Script propio' }).click();
  await page.getByLabel('Script propio de la página').fill("document.querySelector('h1').textContent='Cambiado por script propio';");
  P('Aplicar y ver');  await page.getByRole('button', { name: /Aplicar y ver resultado/ }).click();
  await page.getByRole('button', { name: /En vivo/ }).click();
  await page.waitForTimeout(600);
  check('Script propio se ejecuta en vivo', (await page.frameLocator('iframe[title="Vista en vivo de la web"]').locator('h1').textContent())==='Cambiado por script propio');
  await page.screenshot({ path: process.env.SHOT || 'live-js.png' });
}catch(e){out.push('✘ ERROR en «'+paso+'»: '+e.message.split('\n')[0]);await page.screenshot({path:'live-error.png'});}
console.log(out.join('\n'));
await browser.close();
