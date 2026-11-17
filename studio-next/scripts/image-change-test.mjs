// Prueba de «Cambiar imagen»: subir y recortar manteniendo la caja, reajustar la actual desde su original
// (filtros y enfoque móvil), deshacer y foto de Pixabay (simulada) con su autoría.
// Uso: con el servidor de desarrollo en marcha →  node scripts/image-change-test.mjs [url] [captura.png]
import { chromium, firefox } from 'playwright';
const URL = process.argv[2] || 'http://localhost:3123/';
const HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Imágenes ficticias</title>
<style>body{font-family:Arial;margin:0;padding:60px 60px 60px 460px}.foto{display:block;width:400px;height:auto;border-radius:12px}</style></head><body>
<section id="galeria"><h2>Galería</h2><img id="foto" class="foto principal" data-track="hero" width="400" height="300" alt=""></section>
</body></html>`;
// NAVEGADOR=firefox para probar en Firefox (el navegador del usuario).
const browser = process.env.NAVEGADOR === 'firefox' ? await firefox.launch(process.env.FIREFOX_PATH ? { executablePath: process.env.FIREFOX_PATH } : {}) : await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const out = []; const check = (l, ok, x = '') => out.push((ok ? '✔ ' : '✘ ') + l + (x ? ' · ' + x : ''));
let paso = 'inicio';
// Foto de prueba generada en el navegador (2:1, mitad izquierda roja y derecha azul).
async function makePng(w, h) {
  const b64 = await page.evaluate(([w, h]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.fillStyle = '#d02020'; g.fillRect(0, 0, w / 2, h); g.fillStyle = '#2040d0'; g.fillRect(w / 2, 0, w / 2, h); return c.toDataURL('image/png').split(',')[1]; }, [w, h]);
  return Buffer.from(b64, 'base64');
}
try {
  await page.route('**/studio-api/webcreator/photo-search', r => r.fulfill({ json: { total: 1, photos: [{ id: 42, thumb: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=', w: 1600, h: 1200, user: 'Autora', tags: 'playa, mar' }] } }));
  await page.goto(URL);
  const pixabay = await makePng(1600, 1200);
  await page.route('**/studio-api/webcreator/photo-get', r => r.fulfill({ json: { image: 'data:image/png;base64,' + pixabay.toString('base64'), source: 'pixabay', credit: 'Foto de Autora en Pixabay', link: 'https://pixabay.com/photos/42/' } }));
  await page.getByRole('button', { name: /Empezar en blanco/ }).click();
  await page.getByRole('button', { name: 'Código' }).first().click();
  await page.getByLabel('Editor completo de HTML de la web').fill(HTML);
  await page.getByRole('button', { name: /Aplicar y ver resultado/ }).click();
  await page.getByTitle('Volver al 100 %').first().click();
  const fl = page.frameLocator('iframe[title^="Previsualizaci"]');
  await fl.locator('#foto').waitFor();
  const dlg = page.getByRole('dialog', { name: 'Cambiar imagen' });
  const files = async () => Number((await page.getByText(/· \d+ recursos/).first().textContent()).match(/(\d+) recursos/)[1]);
  const read = () => fl.locator('#foto').evaluate(e => { const b = e.getBoundingClientRect();
    return { src: e.getAttribute('src') || '', cls: e.className, track: e.dataset.track, w: Math.round(b.width), h: Math.round(b.height), nat: e.naturalWidth + 'x' + e.naturalHeight,
      crop: e.dataset.wcCrop || '', original: e.dataset.wcImgOriginal || '', filter: e.style.filter, pos: e.style.objectPosition, alt: e.alt, credit: e.dataset.wcCredit || '',
      mobile: !!document.querySelector('style[data-wc-img-style="' + e.dataset.wcImg + '"]') }; });

  paso = 'subir y recortar';
  await fl.locator('#foto').click();
  await page.getByRole('button', { name: 'Cambiar imagen' }).click();
  await dlg.getByLabel('Subir imagen').setInputFiles({ name: 'mi-foto.png', mimeType: 'image/png', buffer: await makePng(1200, 600) });
  await dlg.getByLabel('Zona recortada: arrástrala para moverla').waitFor();
  await page.waitForTimeout(600);
  check('Vista previa del recorte para enfoque y filtros', await dlg.getByLabel('Haz clic para elegir el punto de enfoque').locator('img').evaluate(i => i.src.startsWith('data:image/jpeg') && i.naturalWidth > 0));
  if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
  // Arrastrar el recorte hacia la izquierda: queda pegado al borde.
  const cb = await dlg.getByLabel('Zona recortada: arrástrala para moverla').boundingBox();
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2); await page.mouse.down();
  await page.mouse.move(cb.x + cb.width / 2 - 60, cb.y + cb.height / 2, { steps: 6 }); await page.mouse.move(cb.x - 200, cb.y + cb.height / 2, { steps: 6 }); await page.mouse.up();
  await dlg.getByRole('button', { name: 'Aplicar imagen' }).click();
  await dlg.waitFor({ state: 'hidden' }); await page.waitForTimeout(1000);
  const a = await read();
  const n1 = await files();
  check('La foto recortada y su original quedan en el proyecto', n1 === 2 && /^blob:/.test(a.src), n1 + ' recursos');
  check('Mantiene la caja de 400×300', a.w === 400 && a.h === 300, a.w + '×' + a.h);
  check('Recortada a la proporción de la caja (4:3)', /^800x600$/.test(a.nat), a.nat);
  check('Guarda el original y el recorte para reajustar', !!a.original && !!a.crop, a.crop);
  check('Arrastrar mueve el recorte (pegado a la izquierda)', a.crop.startsWith('0.0000,'), a.crop);
  check('Conserva clases y atributos', a.cls === 'foto principal' && a.track === 'hero');
  check('Texto alternativo a partir del nombre del archivo', a.alt === 'mi foto', a.alt);

  paso = 'ajustar la actual';
  await fl.locator('#foto').click();
  await page.getByRole('button', { name: 'Cambiar imagen' }).click();
  check('«Ajustar la actual» parte del original (1200 px)', await dlg.locator('img[src^="blob:"]').first().evaluate(i => new Promise(r => i.complete ? r(i.naturalWidth) : i.onload = () => r(i.naturalWidth))) === 1200);
  await dlg.getByRole('button', { name: 'Blanco y negro' }).click();
  await dlg.getByRole('button', { name: 'Móvil' }).click();
  const fbox = await dlg.getByLabel('Haz clic para elegir el punto de enfoque').boundingBox();
  await page.mouse.click(fbox.x + fbox.width * 0.8, fbox.y + fbox.height * 0.5);
  await dlg.getByRole('button', { name: 'Aplicar imagen' }).click();
  await dlg.waitFor({ state: 'hidden' }); await page.waitForTimeout(1000);
  const b = await read();
  check('Sin recortar de nuevo no crea otro archivo', (await files()) === n1 && b.crop === a.crop);
  check('Filtro blanco y negro aplicado', /grayscale\(1/.test(b.filter), b.filter);
  check('Enfoque propio en móvil', b.mobile);

  paso = 'deshacer';
  await page.getByRole('button', { name: 'Deshacer' }).click(); await page.waitForTimeout(1000);
  const u = await read();
  check('Deshacer quita el filtro y el enfoque móvil', !u.filter && !u.mobile && u.crop === a.crop, JSON.stringify({ f: u.filter, m: u.mobile }));

  paso = 'pixabay';
  await fl.locator('#foto').click();
  await page.getByRole('button', { name: 'Cambiar imagen' }).click();
  await dlg.getByRole('tab', { name: 'Buscar fotos' }).click();
  await dlg.getByLabel('Buscar fotos').fill('playa');
  await dlg.getByRole('button', { name: 'Buscar', exact: true }).click();
  await dlg.getByTitle(/playa, mar/).click();
  await dlg.getByText('Foto de Autora en Pixabay').waitFor();
  await dlg.getByRole('button', { name: 'Aplicar imagen' }).click();
  await dlg.waitFor({ state: 'hidden' }); await page.waitForTimeout(1000);
  const c = await read();
  check('Foto de Pixabay con su autoría', !c.crop && !c.original && c.credit === 'Foto de Autora en Pixabay', c.credit);
  check('Sigue en 400×300', c.w === 400 && c.h === 300, c.w + '×' + c.h);
} catch (e) { out.push('✘ ERROR en «' + paso + '»: ' + e.message.split('\n')[0]); await page.screenshot({ path: 'image-error.png' }); }
console.log(out.join('\n'));
await browser.close();
