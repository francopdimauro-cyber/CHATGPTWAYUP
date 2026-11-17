// Prueba de «Cambiar símbolo»: sustituir un icono SVG de la web conservando tamaño, clases y color.
// Uso: con el servidor de desarrollo en marcha →  node scripts/symbol-change-test.mjs [url] [captura.png]
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://localhost:3123/';
const HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Iconos ficticios</title>
<style>body{font-family:Arial;margin:0;padding:60px 60px 60px 460px}.marca{display:inline-flex;align-items:center;gap:10px}.ico{fill:#c0392b}</style></head><body>
<header id="cabecera"><span class="marca"><span class="logo-mark" id="logo"><svg class="ico" width="28" height="28" viewBox="0 0 24 24"><path d="M3 20 L12 4 L21 20Z"/></svg></span><strong>Marca ficticia</strong></span></header>
</body></html>`;
const browser = await chromium.launch({ channel: 'msedge' });
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
  await fl.locator('#logo').waitFor();

  paso = 'seleccionar icono';
  await fl.locator('#logo svg').click();
  check('Al hacer clic en el icono se selecciona su contenedor y aparece «Cambiar símbolo»', await page.getByRole('button', { name: 'Cambiar símbolo' }).isVisible());
  await page.getByRole('button', { name: 'Cambiar símbolo' }).click();
  const dlg = page.getByRole('dialog', { name: 'Cambiar símbolo' });
  await dlg.getByLabel('Buscar símbolo').fill('luna');
  await dlg.getByTitle(/^moon · /).first().click();
  if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
  await dlg.getByRole('button', { name: 'Cambiar símbolo' }).click();
  await page.waitForTimeout(1200);

  paso = 'comprobar';
  const r = await fl.locator('#logo').evaluate(e => {
    const s = e.querySelector('svg'), b = s.getBoundingClientRect(), cs = getComputedStyle(s);
    return { cls: e.className, svgCls: s.getAttribute('class'), w: Math.round(b.width), h: Math.round(b.height), stroke: cs.stroke, fill: cs.fill, moon: s.innerHTML.includes('M20.985') };
  });
  check('Es la luna nueva', r.moon);
  check('Mismo tamaño en pantalla (28×28)', r.w === 28 && r.h === 28, r.w + '×' + r.h);
  check('Conserva las clases del contenedor y del SVG', r.cls === 'logo-mark' && r.svgCls === 'ico', r.cls + ' / ' + r.svgCls);
  check('Mantiene el color rojo como trazo', r.stroke === 'rgb(192, 57, 43)', r.stroke);
  check('No queda relleno aunque la web lo pinte con .ico{fill}', r.fill === 'none', r.fill);
  paso = 'deshacer';
  await page.getByRole('button', { name: 'Deshacer' }).click(); await page.waitForTimeout(1000);
  check('Deshacer devuelve el icono original', await fl.locator('#logo svg path').evaluate(p => p.getAttribute('d').startsWith('M3 20')));
} catch (e) { out.push('✘ ERROR en «' + paso + '»: ' + e.message.split('\n')[0]); await page.screenshot({ path: 'symbol-error.png' }); }
console.log(out.join('\n'));
await browser.close();
