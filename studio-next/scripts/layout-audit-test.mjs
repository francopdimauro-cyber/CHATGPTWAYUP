// Prueba de la auditoría automática (lib/layout-audit.ts) en un navegador real, sin servidor.
// Uso: node scripts/layout-audit-test.mjs   (NAVEGADOR=firefox y FIREFOX_PATH para Firefox)
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { chromium, firefox } from 'playwright';
// Sin empaquetador: Node quita los tipos y el módulo se expone como window.Audit.
const js = stripTypeScriptTypes(readFileSync('lib/layout-audit.ts', 'utf8'));
const code = 'window.Audit=(()=>{' + js.replace(/^export\s+/gm, '') + '\nreturn {auditLayout,OVERFLOW_SAFETY_CSS};})();';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP4z8DAwMDAAAAMBAEAa2s3TwAAAABJRU5ErkJggg==';
const BAD = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>
body{margin:0;font-family:Arial}header{display:flex;flex-wrap:wrap;gap:40px;padding:10px}header a{font-size:28px;padding:20px}
.ancha{width:900px;background:#eee}.flojo{color:#bbbbbb;background:#ffffff}.foto{width:300px;height:300px}</style></head><body>
<header><a href="#a">Inicio</a><a href="#b">Servicios premium</a><a href="#c">Sobre nosotros</a><a href="#d">Testimonios</a><a href="#e">Preguntas</a><a href="#f">Contacto directo</a><a href="#g">Reservar</a></header>
<section id="hero" data-wc-section="hero"><div class="ancha">Bloque demasiado ancho</div><p class="flojo">Texto gris claro con poco contraste sobre blanco</p>
<img class="foto" src="${PNG}" alt=""></section></body></html>`;
const GOOD = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>body{margin:0;font-family:Arial;font-size:16px;color:#111}header{display:flex;height:72px;align-items:center;padding:0 16px}</style></head>
<body><header><strong>Marca</strong></header><section id="s" data-wc-section="s"><h1>Titular corto</h1><p>Texto normal con buen contraste.</p></section></body></html>`;
const browser = process.env.NAVEGADOR === 'firefox' ? await firefox.launch(process.env.FIREFOX_PATH ? { executablePath: process.env.FIREFOX_PATH } : {}) : await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
await page.setContent('<!DOCTYPE html><html><body></body></html>');
await page.addScriptTag({ content: code });
// Foto 2:1 generada en el navegador (válida en todos los motores).
const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 200; c.height = 100; c.getContext('2d').fillRect(0, 0, 200, 100); return c.toDataURL('image/png'); });
const run = (html, w, v) => page.evaluate(([h, w, v]) => window.Audit.auditLayout(h, w, v), [html.split(PNG).join(png), w, v]);
const out = []; const check = (l, ok, x = '') => out.push((ok ? '✔ ' : '✘ ') + l + (x ? ' · ' + x : ''));
const desk = await run(BAD, 1280, 'escritorio'), mob = await run(BAD, 390, 'móvil');
const all = (r) => r.notes.map(n => n.notes).join('\n');
check('Detecta el scroll horizontal en móvil', mob.overflow && /div\.ancha/.test(all(mob)), all(mob).split('\n')[0]);
check('Detecta el contraste insuficiente', /contraste insuficiente/.test(all(desk)));
check('Detecta la cabecera en varias filas (escritorio)', /cabecera mide/.test(all(desk)));
check('Detecta la imagen deformada', /deformada/.test(all(desk)));
check('Agrupa por bloque (hero)', desk.notes.some(n => n.id === 'hero'));
const ok1 = await run(GOOD, 1280, 'escritorio'), ok2 = await run(GOOD, 390, 'móvil');
check('Una web correcta no da avisos', ok1.issues === 0 && ok2.issues === 0, all(ok1) + all(ok2));
console.log(out.join('\n'));
await browser.close();
