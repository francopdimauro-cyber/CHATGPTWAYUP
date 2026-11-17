// Prueba de «Cambiar botón»: diseño, tamaño, texto, icono y comportamiento sin romper clases, id ni atributos.
// Uso: con el servidor de desarrollo en marcha →  node scripts/button-change-test.mjs [url] [captura.png]
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://localhost:3123/';
const HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Botones ficticios</title>
<style>body{font-family:Arial;margin:0;padding:60px 60px 60px 460px;background:#fff}.btn{background:#c0392b;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none}</style></head><body>
<section id="inicio" data-wc-section="inicio"><h1>Inicio</h1>
<a class="btn principal" id="cta" href="#contacto" data-track="hero">Reserva</a>
<button id="menu" class="toggle" aria-expanded="false" type="button">Menú</button></section>
<section id="contacto" data-wc-section="contacto"><h2>Contacto</h2><form><button id="enviar" type="submit">Enviar</button></form></section>
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
  await fl.locator('#cta').waitFor();

  paso = 'enlace';
  await fl.locator('#cta').click();
  await page.getByRole('button', { name: 'Cambiar botón' }).click();
  const dlg = page.getByRole('dialog', { name: 'Cambiar botón' });
  await dlg.getByRole('button', { name: /Contorno/ }).click();
  await dlg.getByRole('button', { name: 'Grande' }).click();
  await dlg.getByLabel('Texto del botón').fill('Reservar ahora');
  await dlg.getByLabel('Icono arrow-right').click();
  await dlg.getByLabel('Qué hace el botón').selectOption('telefono');
  await dlg.getByLabel('Destino del botón').fill('+34 600 111 222');
  if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
  await dlg.getByRole('button', { name: 'Aplicar cambios' }).click();
  await page.waitForTimeout(1200);
  const a = await fl.locator('#cta').evaluate(e => ({ btn: e.dataset.wcBtn, size: e.dataset.wcBtnSize, cls: e.className, track: e.dataset.track, href: e.getAttribute('href'),
    text: e.textContent.trim(), icon: !!e.querySelector('[data-wc-btn-icon] svg'), border: getComputedStyle(e).borderTopStyle, sheet: !!document.querySelector('style[data-wc-buttons]') }));
  check('Diseño y tamaño aplicados', a.btn === 'contorno' && a.size === 'l' && a.border === 'solid', a.btn + ' ' + a.size + ' borde ' + a.border);
  check('Se conservan clases, id y atributos del enlace', a.cls === 'btn principal' && a.track === 'hero', a.cls + ' · ' + a.track);
  check('Texto e icono nuevos', a.text === 'Reservar ahora' && a.icon, a.text);
  check('Ahora llama por teléfono', a.href === 'tel:+34600111222', a.href);
  check('La hoja de diseños está en la página', a.sheet);

  paso = 'deshacer';
  await page.getByRole('button', { name: 'Deshacer' }).click(); await page.waitForTimeout(1000);
  const u = await fl.locator('#cta').evaluate(e => ({ btn: e.dataset.wcBtn || '', href: e.getAttribute('href'), text: e.textContent.trim() }));
  check('Un solo Deshacer lo devuelve todo', !u.btn && u.href === '#contacto' && u.text === 'Reserva', JSON.stringify(u));

  paso = 'botón de menú';
  await fl.locator('#menu').click();
  await page.getByRole('button', { name: 'Cambiar botón' }).click();
  check('Avisa de que lo controla el JavaScript', await dlg.getByText(/lo controla el JavaScript/).isVisible());
  await dlg.getByRole('button', { name: /Pastilla/ }).click();
  await dlg.getByRole('button', { name: 'Aplicar cambios' }).click();
  await page.waitForTimeout(1000);
  const m = await fl.locator('#menu').evaluate(e => ({ tag: e.tagName, btn: e.dataset.wcBtn, aria: e.getAttribute('aria-expanded'), cls: e.className, radius: getComputedStyle(e).borderTopLeftRadius }));
  check('El botón de menú sigue siendo un botón con sus atributos', m.tag === 'BUTTON' && m.aria === 'false' && m.cls === 'toggle', JSON.stringify(m));
  check('Y con el diseño pastilla', m.btn === 'pastilla' && parseFloat(m.radius) > 100, m.radius);

  paso = 'formulario';
  await fl.locator('#enviar').click();
  await page.getByRole('button', { name: 'Cambiar botón' }).click();
  check('El botón de envío de un formulario no deja cambiar su comportamiento', await dlg.getByText(/envía un formulario/).isVisible());
  await dlg.getByRole('button', { name: 'Cancelar' }).click();

  paso = 'volver al original';
  await fl.locator('#menu').click();
  await page.getByRole('button', { name: 'Cambiar botón' }).click();
  await dlg.getByRole('button', { name: /Volver al diseño original/ }).click();
  await page.waitForTimeout(1000);
  check('«Volver al diseño original» quita el diseño', !(await fl.locator('#menu').getAttribute('data-wc-btn')));
} catch (e) { out.push('✘ ERROR en «' + paso + '»: ' + e.message.split('\n')[0]); await page.screenshot({ path: 'button-error.png' }); }
console.log(out.join('\n'));
await browser.close();
