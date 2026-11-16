// Prueba de extremo a extremo del editor con ratón y teclado reales en Firefox y Chromium.
// Uso: con el servidor de desarrollo en marcha →  node scripts/e2e-browsers.mjs [firefox|chromium|all] [url]
import { firefox, chromium } from 'playwright';

const which = process.argv[2] || 'all';
const URL = process.argv[3] || 'http://localhost:3123/';
const HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Web ficticia E2E</title>
<style>body{margin:0;font-family:Georgia,serif;background:#f6f3ee;color:#222}section{padding:40px 6%}
h1{font-size:56px;margin:0 0 16px;color:#222 !important}.btn{display:inline-block;padding:12px 20px;background:#b33 !important;color:#fff;text-decoration:none;border-radius:8px}
.caja{min-height:80px;border:1px dashed #999}</style></head><body><main>
<section id="hero"><h1>Titular de prueba</h1><p id="p1">Párrafo de prueba para editar.</p><a class="btn" href="#contacto">Botón de prueba</a><img alt="Imagen" src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==" style="width:60px;height:60px"><div class="caja" id="caja"></div></section>
<section id="contacto"><h2>Contacto</h2><p>Texto de contacto.</p></section></main></body></html>`;

async function run(name, type) {
  const browser = await type.launch(type === chromium ? { channel: 'msedge' } : {});
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const results = [];
  const check = (label, ok, extra = '') => { results.push([ok ? '✔' : '✘', label, extra]); };
  try {
    await page.goto(URL);
    await page.getByRole('button', { name: /Empezar en blanco/ }).click();
    await page.getByRole('button', { name: 'Código', exact: false }).filter({ hasText: 'Código' }).first().click();
    await page.getByLabel('Editor completo de HTML de la web').fill(HTML);
    await page.getByRole('button', { name: /Aplicar HTML/ }).click();
    const frame = page.frameLocator('iframe[title^="Previsualizaci"]');
    const fr = () => page.frames().find(f => f !== page.mainFrame());
    await frame.locator('h1').waitFor();

    // Seleccionar + Propiedades
    await frame.locator('#p1').click();
    check('Seleccionar muestra Propiedades', await page.getByLabel('Inspector de propiedades').getByText('Tipografía').isVisible());

    // Color con !important (campo HEX)
    await frame.locator('h1').click();
    const hex = page.getByLabel('Color del texto en HEX o RGB');
    await hex.fill('#1144aa'); await hex.press('Enter');
    await page.waitForTimeout(900);
    check('Color gana a !important', (await fr().$eval('h1', e => getComputedStyle(e).color)) === 'rgb(17, 68, 170)');

    // Doble clic: editar texto
    await frame.locator('#p1').dblclick();
    await page.keyboard.press('Control+A'); await page.keyboard.type('Texto editado en el navegador');
    await page.keyboard.press('Enter'); await page.waitForTimeout(900);
    check('Edición de texto con doble clic', (await fr().$eval('#p1', e => e.textContent)) === 'Texto editado en el navegador');

    // Clic derecho: menú del editor (no el del navegador)
    await frame.locator('#p1').click({ button: 'right' });
    check('Clic derecho abre el menú del editor', await page.getByRole('menu').isVisible());
    await page.keyboard.press('Escape');

    // Mover (ordenar) con ratón real: botón arrastrado encima del h1
    await page.getByRole('button', { name: 'Mover' }).first().click();
    const b = await frame.locator('.btn').boundingBox(); const h = await frame.locator('h1').boundingBox();
    await page.mouse.move(b.x + 10, b.y + 8); await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(b.x + 10 + (h.x + 20 - b.x - 10) * i / 12, b.y + 8 + (h.y + 4 - b.y - 8) * i / 12);
    const follows = await fr().$eval('.btn', e => e.style.translate || '');
    await page.mouse.up(); await page.waitForTimeout(900);
    check('El elemento sigue al cursor al arrastrar', follows !== '' && follows !== '0px 0px', follows);
    check('Mover (ordenar) cambia el orden real', (await fr().$eval('h1', e => e.previousElementSibling?.className)) === 'btn');

    // Mover (libre)
    await page.getByRole('button', { name: 'Libre' }).click();
    const p = await frame.locator('#p1').boundingBox();
    await page.mouse.move(p.x + 10, p.y + 5); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(p.x + 10 + 10 * i, p.y + 5 + 5 * i);
    await page.mouse.up(); await page.waitForTimeout(900);
    check('Mover (libre) desplaza el elemento', /80px 40px/.test(await fr().$eval('#p1', e => e.getAttribute('style') || '')), await fr().$eval('#p1', e => e.getAttribute('style') || ''));
    await page.getByRole('button', { name: 'Ordenar' }).click();

    // Redimensionar con tirador
    await page.getByRole('button', { name: 'Seleccionar' }).first().click();
    await frame.locator('img').click();
    const handle = frame.locator('#wayup-resize-box div[title="Arrastra para cambiar ancho y alto"]');
    const hb = await handle.boundingBox();
    await page.mouse.move(hb.x + 4, hb.y + 4); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(hb.x + 4 + 5 * i, hb.y + 4 + 5 * i);
    await page.mouse.up(); await page.waitForTimeout(900);
    const w = await fr().$eval('img', e => Math.round(e.getBoundingClientRect().width));
    check('Redimensionar con tiradores', w >= 95 && w <= 105, w + 'px');

    // Insertar con clic y con arrastre desde el panel
    await page.getByRole('button', { name: 'Insertar' }).first().click();
    await frame.locator('#caja').click();
    await page.getByTitle('Insertar Círculo').click(); await page.waitForTimeout(900);
    check('Insertar con clic (dentro del contenedor vacío)', (await fr().$eval('#caja', e => e.children.length)) === 1);
    await fr().$eval('#contacto', e => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(300);
    const src = await page.getByTitle('Insertar Botón', { exact: true }).boundingBox();
    const dst = await frame.locator('#contacto h2').boundingBox();
    await page.mouse.move(src.x + 20, src.y + 20); await page.mouse.down();
    for (let i = 1; i <= 15; i++) await page.mouse.move(src.x + 20 + (dst.x + dst.width / 2 - src.x - 20) * i / 15, src.y + 20 + (dst.y + dst.height - 3 - src.y - 20) * i / 15);
    await page.mouse.up(); await page.waitForTimeout(1200);
    check('Arrastrar bloque del panel a la web', (await fr().$eval('#contacto h2', e => e.nextElementSibling?.getAttribute('data-wc-name'))) === 'Botón');

    // Deshacer con teclado
    const before = await fr().$$eval('[data-wc-name="Botón"]', l => l.length);
    await page.keyboard.press('Control+z'); await page.waitForTimeout(900);
    check('Ctrl+Z deshace', (await fr().$$eval('[data-wc-name="Botón"]', l => l.length)) === before - 1);
  } catch (e) { check('Sin excepciones en la prueba', false, String(e).slice(0, 300)); }
  check('Sin errores de JavaScript en la página', errors.length === 0, errors.join(' | ').slice(0, 300));
  await browser.close();
  console.log('\n=== ' + name + ' ===');
  for (const [mark, label, extra] of results) console.log(mark + ' ' + label + (extra ? '  · ' + extra : ''));
  return results.every(r => r[0] === '✔');
}

const list = which === 'all' ? [['Firefox', firefox], ['Chromium', chromium]] : [[which, which === 'firefox' ? firefox : chromium]];
let ok = true;
for (const [n, t] of list) ok = (await run(n, t)) && ok;
process.exit(ok ? 0 : 1);
