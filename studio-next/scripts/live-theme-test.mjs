// Prueba: la vista «En vivo» respeta el tema elegido en el editor aunque el sistema esté en modo oscuro
// y la web elija su tema con JavaScript (matchMedia / localStorage).
// Uso: con el servidor de desarrollo en marcha →  node scripts/live-theme-test.mjs [url]
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://localhost:3123/';
const HTML = `<!DOCTYPE html><html lang="es" data-theme="light"><head><meta charset="utf-8"><title>Tema ficticio</title>
<style>html[data-theme=light] body{background:#f6f1e8;color:#222}html[data-theme=dark] body{background:#111;color:#eee}</style></head>
<body><h1 id="t">Titular</h1><button id="sol">Cambiar tema</button>
<script>var saved=null;try{saved=localStorage.getItem('tema');}catch(e){}
document.documentElement.dataset.theme=saved||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
document.getElementById('sol').addEventListener('click',function(){var n=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=n;try{localStorage.setItem('tema',n);}catch(e){}});</script></body></html>`;
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, colorScheme: 'dark' });
const out = []; const check = (l, ok, x = '') => out.push((ok ? '✔ ' : '✘ ') + l + (x ? ' · ' + x : ''));
try {
  await page.goto(URL);
  await page.getByRole('button', { name: /Empezar en blanco/ }).click();
  await page.getByRole('button', { name: 'Código' }).first().click();
  await page.getByLabel('Editor completo de HTML de la web').fill(HTML);
  await page.getByRole('button', { name: /Aplicar y ver resultado/ }).click();
  await page.getByRole('button', { name: 'Web clara' }).click();
  await page.getByRole('button', { name: /En vivo/ }).click();
  const live = page.frameLocator('iframe[title="Vista en vivo de la web"]');
  await live.locator('#t').waitFor();
  check('Sistema oscuro + «Web clara» → la vista en vivo sale clara', (await live.locator('html').getAttribute('data-theme')) === 'light');
  await live.locator('#sol').click();
  check('El botón de tema de la propia web sigue funcionando', (await live.locator('html').getAttribute('data-theme')) === 'dark');
  await page.getByRole('button', { name: /Volver a editar/ }).click();
  await page.getByRole('button', { name: 'Web oscura' }).click();
  await page.getByRole('button', { name: /En vivo/ }).click();
  await live.locator('#t').waitFor();
  check('«Web oscura» → la vista en vivo sale oscura', (await live.locator('html').getAttribute('data-theme')) === 'dark');
} catch (e) { out.push('✘ ERROR: ' + e.message.split('\n')[0]); }
console.log(out.join('\n'));
await browser.close();
