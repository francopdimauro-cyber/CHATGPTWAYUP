import { chromium } from 'playwright';
const mod = await import(process.argv[2]);
const js = await (await mod.default.fetch(new Request('https://x.test/widget.js'), {})).text();
const fns = js.slice(js.indexOf('function inline('), js.indexOf('function say('));
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
await page.setContent('<div id="t"></div>');
const html = await page.evaluate(([code]) => {
  const fn = new Function(code + ';return markdown;');
  const markdown = fn();
  window.__xss = false;
  markdown(document.getElementById('t'), '¡Hola! En **Casa Ficticia** ofrecemos:\n\n- **Comidas** de 13:00 a 16:00\n- Teléfono: **[Teléfono]**\n\nTexto <img src=x onerror="window.__xss=true"> final');
  return { html: document.getElementById('t').innerHTML, xss: window.__xss };
}, [fns]);
await page.waitForTimeout(300);
const xss = await page.evaluate(() => window.__xss);
console.log(html.html);
console.log('negritas:', (html.html.match(/<strong>/g) || []).length, '· lista:', html.html.includes('<ul><li>'), '· código ejecutado:', xss, '· img real:', html.html.includes('<img'));
await browser.close();
