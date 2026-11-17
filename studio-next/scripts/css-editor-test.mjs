// Prueba del Editor CSS: Elemento, Sección y Global, vista en vivo, errores en castellano y deshacer.
// Uso: con el servidor de desarrollo en marcha →  node scripts/css-editor-test.mjs [url] [captura.png]
// NAVEGADOR=firefox (y FIREFOX_PATH si hace falta) para probar en Firefox.
import { chromium, firefox } from 'playwright';
const URL = process.argv[2] || 'http://localhost:3123/';
const HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>CSS ficticio</title>
<style>body{font-family:Arial;margin:0;padding:40px 40px 40px 460px;background:#fff}h2{letter-spacing:0}</style></head><body>
<section id="servicios" data-wc-section="servicios"><h2>Servicios</h2><p id="intro">Texto de prueba</p></section>
<section id="otra" data-wc-section="otra"><h2>Otra</h2></section>
</body></html>`;
const browser = process.env.NAVEGADOR === 'firefox' ? await firefox.launch(process.env.FIREFOX_PATH ? { executablePath: process.env.FIREFOX_PATH } : {}) : await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const out = []; const check = (l, ok, x = '') => out.push((ok ? '✔ ' : '✘ ') + l + (x ? ' · ' + x : ''));
let paso = 'inicio';
try {
  await page.goto(URL);
  await page.getByRole('button', { name: /Empezar en blanco/ }).click();
  await page.getByRole('button', { name: 'Código' }).first().click();
  await page.getByLabel('Editor completo de HTML de la web').fill(HTML);
  await page.getByRole('button', { name: /Aplicar y ver resultado/ }).click();
  await page.getByTitle('Volver al 100 %').first().click();
  const fl = page.frameLocator('iframe[title^="Previsualizaci"]');
  await fl.locator('#intro').waitFor();
  const ed = page.getByRole('dialog', { name: 'Editor CSS' });
  const cs = (sel, prop) => fl.locator(sel).first().evaluate((e, p) => getComputedStyle(e)[p], prop);

  paso = 'elemento';
  await fl.locator('#intro').click();
  await page.getByRole('button', { name: /Editar CSS/ }).click();
  const ta = ed.getByLabel('CSS de elemento');
  await ta.fill('colr: red;');
  check('Error en castellano con sugerencia', await ed.getByText(/Propiedad desconocida «colr».*«color»/).isVisible());
  check('No deja aplicar con errores', await ed.getByRole('button', { name: 'Aplicar CSS' }).isDisabled());
  await ta.fill('color: rgb(200, 0, 0);\npadding: 12px;');
  await page.waitForTimeout(500);
  check('Vista en vivo antes de aplicar', await cs('#intro', 'color') === 'rgb(200, 0, 0)');
  if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
  await ed.getByRole('button', { name: 'Aplicar CSS' }).click();
  await page.waitForTimeout(1000);
  check('Aplicado al estilo del elemento', /color: rgb\(200, 0, 0\)/.test(await fl.locator('#intro').getAttribute('style') || ''));
  { const v = await ed.getByLabel('CSS de elemento').inputValue(); check('El editor sigue en el elemento tras aplicar', v.includes('padding: 12px'), JSON.stringify(v)); }

  paso = 'sección';
  await ed.getByRole('tab', { name: /Sección/ }).click();
  await ed.getByLabel('CSS de sección').fill('padding-top: 30px;\nh2 { letter-spacing: 5px; }');
  await page.waitForTimeout(500);
  check('Vista en vivo de la sección', await cs('#servicios h2', 'letterSpacing') === '5px');
  await ed.getByRole('button', { name: 'Aplicar CSS' }).click();
  await page.waitForTimeout(1000);
  check('CSS de sección solo en su sección', await cs('#servicios h2', 'letterSpacing') === '5px' && await cs('#otra h2', 'letterSpacing') !== '5px',
    await cs('#otra h2', 'letterSpacing'));

  paso = 'global';
  await ed.getByRole('tab', { name: 'Global' }).click();
  await ed.getByLabel('CSS de toda la web').fill('body { background: rgb(1, 2, 3); }\n.x { color: red;');
  check('Detecta la llave sin cerrar', await ed.getByText(/Falta cerrar la llave/).isVisible());
  await ed.getByLabel('CSS de toda la web').fill('body { background: rgb(1, 2, 3); }');
  await ed.getByRole('button', { name: 'Aplicar CSS' }).click();
  await page.waitForTimeout(1000);
  check('CSS global aplicado', await cs('body', 'backgroundColor') === 'rgb(1, 2, 3)');
  check('@import bloqueado', await (async () => { await ed.getByLabel('CSS de toda la web').fill('@import url(https://x.y/a.css);'); return ed.getByText(/@import no está permitido/).isVisible(); })());
  await ed.getByRole('button', { name: 'Descartar' }).click();

  paso = 'deshacer';
  await ed.getByRole('button', { name: 'Cerrar editor CSS' }).click();
  await page.getByRole('button', { name: 'Deshacer' }).click(); await page.waitForTimeout(1000);
  check('Deshacer quita el CSS global', await cs('body', 'backgroundColor') === 'rgb(255, 255, 255)');
  check('…y conserva el de la sección', await cs('#servicios h2', 'letterSpacing') === '5px');
} catch (e) { out.push('✘ ERROR en «' + paso + '»: ' + e.message.split('\n')[0]); await page.screenshot({ path: 'css-error.png' }); }
console.log(out.join('\n'));
await browser.close();
