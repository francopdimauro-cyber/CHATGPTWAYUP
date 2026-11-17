// Prueba de «dos direcciones»: el asistente pide A y B a la vez, las muestra y deja elegir una.
// Uso: con el servidor de desarrollo en marcha →  node scripts/directions-test.mjs [url] [captura.png]
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://localhost:3123/';
const dir = (v) => ({ resumen: v === 'A' ? 'Editorial calmada con mucho aire' : 'Energía nocturna y contraste lima', estilo: v === 'A' ? 'Editorial sobrio' : 'Deportivo oscuro', tono: 'Cercano',
  paleta: v === 'A' ? { fondo: '#f6f3ee', superficie: '#ffffff', texto: '#1c1a17', acento: '#9a3b2e', secundario: '#8a8478' } : { fondo: '#0d0b26', superficie: '#17143a', texto: '#eceaff', acento: '#cfff00', secundario: '#5ee6ff' },
  tipografia: { titulares: v === 'A' ? 'Serif editorial' : 'Display condensada', texto: 'Sans neutra', razon: '' }, composicion: '', secciones: [{ titulo: 'Inicio', objetivo: '' }, { titulo: 'Servicios', objetivo: '' }], cta: 'Reserva', imagenes: '' });
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const out = []; const check = (l, ok, x = '') => out.push((ok ? '✔ ' : '✘ ') + l + (x ? ' · ' + x : ''));
const variants = [];
await page.route('**/studio-api/webcreator/status', r => r.fulfill({ json: { configured: true, authorized: true } }));
await page.route('**/studio-api/webcreator/direction', r => { const v = JSON.parse(r.request().postData() || '{}').variant; variants.push(v); r.fulfill({ json: { direction: dir(v) } }); });
try {
  await page.goto(URL);
  await page.getByRole('button', { name: /Generar con IA/ }).first().click();
  await page.getByLabel(/Nombre del negocio/).fill('Gimnasio ficticio');
  await page.getByLabel(/Servicios y propuesta de valor/).fill('Entrenamiento personal y en grupos reducidos con seguimiento real.');
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: /^Siguiente/ }).click();
  await page.getByRole('button', { name: /Proponer dos direcciones/ }).click();
  const radios = page.getByRole('radio');
  await radios.first().waitFor();
  check('Se piden las variantes A y B', variants.sort().join('') === 'AB', variants.join(','));
  check('Se muestran dos opciones', (await radios.count()) === 2);
  check('Aún no hay ninguna elegida', (await page.getByLabel('Concepto').count()) === 0);
  await radios.nth(1).click();
  check('Al elegir B se puede editar', (await page.getByLabel('Concepto').inputValue()) === 'Energía nocturna y contraste lima');
  check('B queda marcada como elegida', (await radios.nth(1).getAttribute('aria-checked')) === 'true');
  if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
} catch (e) { out.push('✘ ERROR: ' + e.message.split('\n')[0]); }
console.log(out.join('\n'));
await browser.close();
