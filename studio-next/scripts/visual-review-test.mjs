// Prueba de la revisión visual de principio a fin con el servidor simulado:
// generar → fotos IA → capturas reales de cada sección (escritorio y móvil) → notas → CSS de corrección.
// Uso: con el servidor de desarrollo en marcha →  node scripts/visual-review-test.mjs [url] [carpeta-capturas]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const URL = process.argv[2] || 'http://localhost:3123/';
const OUT = process.argv[3] || '';
const HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Gimnasio ficticio</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;700&display=swap">
<style>:root{--bg:#0f0c29;--accent:#8b7cff}body{margin:0;background:var(--bg);color:#fff;font-family:Inter,sans-serif}
.site-header{display:flex;flex-wrap:wrap;gap:20px;padding:20px 40px}.site-header nav{display:flex;gap:30px;width:100%}
.hero{min-height:100vh;display:grid;place-items:center;text-align:center;position:relative}.hero h1{font-family:Anton,sans-serif;font-size:9vw;margin:0}
.hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.35}
section{padding:80px 40px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.card{background:#1d1950;padding:30px;border-radius:16px}
footer{padding:40px;border-top:1px solid #333}</style></head><body>
<header class="site-header"><strong>Marca Ficticia</strong><nav><a href="#inicio">Inicio</a><a href="#servicios">Servicios</a><a href="#contacto">Contacto</a></nav><a class="btn" href="#contacto">Reserva</a></header>
<section id="inicio" data-wc-section="inicio" class="hero"><img data-wc-ai-image="athlete running at sunset on a track" alt="Atleta"><h1>Muévete con criterio</h1></section>
<section id="servicios" data-wc-section="servicios"><h2>Servicios</h2><div class="grid"><div class="card">Uno</div><div class="card">Dos</div><div class="card">Tres</div></div></section>
<footer class="site-footer">© Marca ficticia</footer>
<script>document.documentElement.classList.add('js')</script></body></html>`;
// JPEG mínimo válido (rojo) para la «foto IA».
const JPEG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const out = []; const check = (l, ok, x = '') => out.push((ok ? '✔ ' : '✘ ') + l + (x ? ' · ' + x : ''));
const shots = []; let fixBody = null;
await page.route('**/studio-api/webcreator/status', r => r.fulfill({ json: { configured: true, authorized: true, provider: 'Workers AI', model: 'simulado' } }));
await page.route('**/studio-api/webcreator/generate-stream', r => r.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' },
  body: 'event: status\ndata: {"message":"Director de arte…"}\n\nevent: complete\ndata: ' + JSON.stringify({ html: HTML, model: 'simulado' }) + '\n\n' }));
await page.route('**/studio-api/webcreator/image', r => r.fulfill({ json: { image: 'data:image/png;base64,' + JPEG } }));
await page.route('**/studio-api/webcreator/review-shot', async r => {
  const body = JSON.parse(r.request().postData() || '{}'); shots.push(body);
  r.fulfill({ json: { notes: body.id === 'site-header' || /header/.test(body.id) ? 'Problema: la cabecera ocupa varias filas → Arreglo: una sola fila con flex.' : 'SIN PROBLEMAS' } });
});
await page.route('**/studio-api/webcreator/review-fix', async r => { fixBody = JSON.parse(r.request().postData() || '{}'); r.fulfill({ json: { css: '.site-header{flex-wrap:nowrap!important}.site-header nav{width:auto!important}' } }); });
let paso = 'inicio';
try {
  await page.goto(URL);
  paso = 'asistente';
  await page.getByRole('button', { name: /Generar con IA/ }).first().click();
  await page.getByLabel(/Nombre del negocio/).fill('Gimnasio ficticio de prueba');
  await page.getByLabel(/Servicios y propuesta de valor/).fill('Entrenamiento personal y en grupos reducidos con seguimiento real.');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /^Siguiente/ }).click();
  paso = 'generar';
  await page.getByRole('button', { name: /Generar mi web con IA/ }).click();
  await page.getByText(/Revisión visual/).first().waitFor({ timeout: 30000 });
  check('El panel de progreso muestra la revisión visual', true);
  await page.locator('iframe[title^="Previsualizaci"]').first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(1500);
  paso = 'comprobar';
  const desk = shots.filter(s => s.viewport === 'escritorio'), mob = shots.filter(s => s.viewport === 'móvil');
  check('Capturas de escritorio de cada bloque', desk.length === 4, desk.map(s => s.id).join(', '));
  check('Capturas de móvil', mob.length >= 2, mob.map(s => s.id).join(', '));
  check('Las capturas son JPEG reales', shots.every(s => /^data:image\/jpeg;base64,/.test(s.dataUrl) && s.dataUrl.length > 3000), shots.map(s => Math.round(s.dataUrl.length / 1024) + 'KB').join(' '));
  check('La corrección recibe las notas, el CSS y la estructura', fixBody?.notes?.length >= 1 && /grid-template-columns/.test(fixBody.css) && /site-header/.test(fixBody.structure));
  const html = await page.evaluate(() => (document.querySelector('textarea[aria-label="Editor completo de HTML de la web"]') || null) && '');
  const frameHtml = await page.frameLocator('iframe[title^="Previsualizaci"]').locator('html').evaluate(e => e.outerHTML);
  check('La web final lleva el CSS de revisión', /data-wc-review/.test(frameHtml) && /flex-wrap:\s*nowrap/.test(frameHtml));
  if (OUT) { mkdirSync(OUT, { recursive: true }); shots.forEach((s, i) => writeFileSync(OUT + '/' + i + '-' + s.viewport + '-' + s.id + '.jpg', Buffer.from(s.dataUrl.split(',')[1], 'base64'))); }
} catch (e) { out.push('✘ ERROR en «' + paso + '»: ' + e.message.split('\n')[0]); await page.screenshot({ path: 'visual-error.png' }); }
console.log(out.join('\n'));
await browser.close();
