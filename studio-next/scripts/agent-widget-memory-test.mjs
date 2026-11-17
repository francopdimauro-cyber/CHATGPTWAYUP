// Prueba del widget publicado: la conversación tiene memoria (envía los últimos turnos) y pinta Markdown.
// Uso: node scripts/agent-widget-memory-test.mjs <file:///…/src/studio-public-agent-worker.js>   (NAVEGADOR=firefox opcional)
import { chromium, firefox } from 'playwright';
const mod = await import(process.argv[2]);
const widget = await (await mod.default.fetch(new Request('https://agente.test/widget.js'), {})).text();
const ID = '11111111-2222-4333-8444-555555555555';
const browser = process.env.NAVEGADOR === 'firefox' ? await firefox.launch(process.env.FIREFOX_PATH ? { executablePath: process.env.FIREFOX_PATH } : {}) : await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
// El widget usa shadow DOM cerrado: solo en la prueba se abre para poder manejarlo.
await page.addInitScript(() => { const o = Element.prototype.attachShadow; Element.prototype.attachShadow = function (i) { return o.call(this, { ...i, mode: 'open' }); }; });
const bodies = [];
await page.route('https://web-ficticia.test/', r => r.fulfill({ contentType: 'text/html', body: '<!DOCTYPE html><html><body><script src="https://agente.test/widget.js" data-chat="' + ID + '"></script></body></html>' }));
await page.route('https://agente.test/**', async r => {
  const url = r.request().url(), cors = { 'Access-Control-Allow-Origin': 'https://web-ficticia.test', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (url.endsWith('/widget.js')) return r.fulfill({ contentType: 'text/javascript', body: widget });
  if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  if (url.endsWith('/config')) return r.fulfill({ headers: cors, json: { title: 'Asistente ficticio', greeting: 'Hola', leadCapture: false } });
  const body = JSON.parse(r.request().postData() || '{}'); bodies.push(body);
  return r.fulfill({ headers: cors, json: { reply: bodies.length === 1 ? 'Abrimos de **lunes a viernes**.' : 'El **sábado** no abrimos.' } });
});
const out = []; const check = (l, ok, x = '') => out.push((ok ? '✔ ' : '✘ ') + l + (x ? ' · ' + x : ''));
try {
  await page.goto('https://web-ficticia.test/');
  const sh = page.locator('[data-wayup-agent]');
  await sh.locator('#toggle').click();
  await sh.locator('#message').fill('¿Qué horario tenéis?');
  await sh.locator('#send').click();
  await sh.locator('.agent strong', { hasText: 'lunes a viernes' }).waitFor();
  await sh.locator('#message').fill('¿Y el sábado?');
  await sh.locator('#send').click();
  await sh.locator('.agent strong', { hasText: 'sábado' }).waitFor();
  check('El primer mensaje va sin historial', Array.isArray(bodies[0]?.history) && bodies[0].history.length === 0);
  check('El segundo lleva la pregunta y la respuesta anteriores', bodies[1]?.history?.length === 2 && bodies[1].history[0].role === 'user' && bodies[1].history[1].role === 'agent' && /lunes a viernes/.test(bodies[1].history[1].text), JSON.stringify(bodies[1]?.history));
  check('Las respuestas se pintan con negrita', await sh.locator('.agent strong').count() >= 2);
} catch (e) { out.push('✘ ERROR: ' + e.message.split('\n')[0]); }
console.log(out.join('\n'));
await browser.close();
