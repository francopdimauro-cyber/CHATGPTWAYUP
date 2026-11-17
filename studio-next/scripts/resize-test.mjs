// Prueba de los tiradores tipo Figma: esquina = escalar (también la letra), lado izquierdo = borde derecho quieto.
// Uso: con el servidor de desarrollo en marcha →  node scripts/resize-test.mjs [url]
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://localhost:3123/';
const HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Web ficticia tiradores</title>
<style>body{margin:0;font-family:Arial}section{padding:60px}.logo{display:inline-block;font-size:20px;font-weight:700}
img{display:block;width:200px;height:120px;margin-left:420px}</style></head><body><section id="a"><span class="logo" id="logo">MarcaFicticia</span>
<p id="p">Texto de prueba.</p><img id="img" alt="x" src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="></section></body></html>`;
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const out = []; const check = (l, ok, x = '') => out.push((ok ? '✔ ' : '✘ ') + l + (x ? ' · ' + x : ''));
let paso = 'inicio';
try {
  await page.goto(URL);
  paso = 'cargar HTML';
  await page.getByRole('button', { name: /Empezar en blanco/ }).click();
  await page.getByRole('button', { name: 'Código' }).first().click();
  await page.getByLabel('Editor completo de HTML de la web').fill(HTML);
  await page.getByRole('button', { name: /Aplicar y ver resultado/ }).click();
  await page.getByRole('button', { name: 'Volver al 100 %' }).or(page.getByTitle('Volver al 100 %')).first().click();
  const frame = () => page.frames().find(f => f !== page.mainFrame() && f.url() === 'about:srcdoc');
  const fl = page.frameLocator('iframe[title^="Previsualizaci"]');
  await fl.locator('#logo').waitFor();
  const iframeBox = async () => (await page.locator('iframe[title^="Previsualizaci"]').first().boundingBox());
  const handle = async (pos) => {
    const ib = await iframeBox();
    const r = await fl.locator('#wayup-resize-box > div').nth(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].indexOf(pos)).evaluate(e => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    return { x: ib.x + r.x, y: ib.y + r.y };
  };
  const drag = async (from, dx, dy) => { await page.mouse.move(from.x, from.y); await page.mouse.down(); for (let i = 1; i <= 8; i++) await page.mouse.move(from.x + dx * i / 8, from.y + dy * i / 8); await page.mouse.up(); await page.waitForTimeout(1200); };
  const live = sel => fl.locator(sel).evaluate(e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, right: r.right, font: parseFloat(getComputedStyle(e).fontSize) }; });

  paso = 'esquina en texto';
  await fl.locator('#logo').click();
  check('Hay 8 tiradores', (await fl.locator('#wayup-resize-box > div').count()) === 8);
  const a = await live('#logo');
  await drag(await handle('se'), 80, 20);
  const b = await live('#logo');
  check('Esquina escala la letra del texto', b.font > a.font * 1.3, a.font + 'px → ' + b.font + 'px');

  paso = 'lado izquierdo en imagen';
  await fl.locator('#img').click();
  const c = await live('#img');
  await drag(await handle('w'), -60, 0);
  const d = await live('#img');
  check('Lado izquierdo ensancha', d.w > c.w + 40, Math.round(c.w) + ' → ' + Math.round(d.w));
  check('El borde derecho no se mueve', Math.abs(d.right - c.right) < 3, Math.round(c.right) + ' / ' + Math.round(d.right));

  paso = 'esquina en imagen';
  const e0 = await live('#img');
  await drag(await handle('se'), 50, 0);
  const e1 = await live('#img');
  check('Esquina en imagen agranda', e1.w > e0.w + 30, Math.round(e0.w) + ' → ' + Math.round(e1.w));
  check('Esquina en imagen mantiene la proporción', Math.abs(e1.w / e1.h - e0.w / e0.h) < 0.03, (e0.w / e0.h).toFixed(2) + ' → ' + (e1.w / e1.h).toFixed(2));

  paso = 'deshacer';
  await page.getByRole('button', { name: 'Deshacer' }).click(); await page.waitForTimeout(1000);
  const f = await live('#img');
  check('Deshacer vuelve atrás un paso', Math.abs(f.w - e0.w) < 3, Math.round(f.w) + ' vs ' + Math.round(e0.w));
} catch (e) { out.push('✘ ERROR en «' + paso + '»: ' + e.message.split('\n')[0]); }
console.log(out.join('\n'));
await browser.close();
