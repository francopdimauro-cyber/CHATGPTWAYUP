// Prueba de la biblioteca de símbolos y elementos del panel Insertar.
// Uso: con el servidor de desarrollo en marcha →  node scripts/symbols-test.mjs [url]
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://localhost:3123/';
const HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Web ficticia símbolos</title>
<style>body{margin:0;font-family:Arial;color:#222}section{padding:60px 60px 60px 460px}</style></head><body><section id="a"><h2 id="t">Título de prueba</h2></section></body></html>`;
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
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
  await fl.locator('#t').waitFor();
  await fl.locator('#t').click();

  paso = 'buscar símbolo';
  await page.getByRole('button', { name: 'Insertar' }).first().click();
  await page.getByRole('tab', { name: 'Símbolos' }).click();
  await page.getByLabel('Buscar símbolo').fill('luna');
  const first = page.getByTitle(/^moon · /).first();
  await first.waitFor({ timeout: 15000 });
  check('La búsqueda en castellano encuentra «luna»', await first.isVisible());
  await first.focus(); await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  const sym = fl.locator('[data-wc-symbol="moon"]');
  check('El símbolo se inserta en la web', (await sym.count()) === 1);
  check('Es un SVG en línea con currentColor', await sym.evaluate(e => e.querySelector('svg')?.getAttribute('stroke') === 'currentColor'));

  paso = 'color del símbolo';
  await page.getByRole('button', { name: 'Seleccionar' }).first().click();
  await sym.click();
  const hex = page.getByLabel('Color del texto en HEX o RGB');
  await hex.fill('#c0392b'); await hex.press('Enter'); await page.waitForTimeout(1000);
  const col = await fl.locator('[data-wc-symbol="moon"] svg').evaluate(e => getComputedStyle(e).color);
  check('Cambia de color con «Color del texto»', col === 'rgb(192, 57, 43)', col);

  paso = 'escalar símbolo';
  if (process.env.RECLIC) { await sym.click(); await page.waitForTimeout(300); }
  const ib = await page.locator('iframe[title^="Previsualizaci"]').first().boundingBox();
  const h = await fl.locator('#wayup-resize-box > div').nth(4).evaluate(e => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  const w0 = await fl.locator('[data-wc-symbol="moon"]').evaluate(e => e.getBoundingClientRect().width);
  out.push("  dep: "+JSON.stringify(await fl.locator("[data-wc-symbol=moon]").evaluate(e=>{const box=document.getElementById("wayup-resize-box");const hb=box&&box.querySelectorAll(":scope > div")[4];const r=hb&&hb.getBoundingClientRect();const at=r&&document.elementFromPoint(r.x+5,r.y+5);return {sym:e.getBoundingClientRect().toJSON(),box:box&&box.getBoundingClientRect().toJSON(),disp:box&&box.style.display,sel:e.dataset.wayupSelected,at:at&&(at.id||at.tagName)};})));
  await page.mouse.move(ib.x + h.x, ib.y + h.y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(ib.x + h.x + 6 * i, ib.y + h.y + 6 * i);
  out.push('  durante: ' + await fl.locator('[data-wc-symbol="moon"]').evaluate(e => e.getAttribute('style') + ' | ' + e.getBoundingClientRect().width));
  await page.mouse.up(); await page.waitForTimeout(1200);
  out.push('  aviso: ' + (await page.locator('[role="status"]').allTextContents()).join(' / '));
  const s1 = await fl.locator('[data-wc-symbol="moon"]').evaluate(e => { const r = e.getBoundingClientRect(); const v = e.querySelector('svg').getBoundingClientRect(); return { w: r.width, h: r.height, sv: v.width }; });
  check('Se escala con la esquina y el dibujo crece', s1.w > w0 + 30 && Math.abs(s1.w - s1.h) < 3 && s1.sv > 60, Math.round(w0) + ' → ' + Math.round(s1.w) + ' (svg ' + Math.round(s1.sv) + ')');

  paso = 'elementos';
  await page.getByRole('button', { name: 'Insertar' }).first().click();
  await page.getByRole('tab', { name: 'Bloques' }).click();
  await page.getByRole('button', { name: 'Elementos', exact: true }).click();
  const n = await page.locator('aside[aria-label="Insertar elementos"] button[title^="Insertar "]').count();
  check('La categoría Elementos tiene piezas', n >= 12, String(n));
  const sello = page.getByTitle('Insertar Sello circular');
  await sello.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(1200);
  check('El sello circular se inserta con su texto en círculo', (await fl.locator('[data-wc-name="Sello circular"] textPath').count()) === 1);
  await page.screenshot({ path: process.env.SHOT || 'symbols.png' });
} catch (e) { out.push('✘ ERROR en «' + paso + '»: ' + e.message.split('\n')[0]); await page.screenshot({ path: 'symbols-error.png' }); }
console.log(out.join('\n'));
await browser.close();
