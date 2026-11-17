// Prueba del paso «Agente IA»: «Crear nuevo» abre el formulario y «Proponer agente con IA» lo rellena.
// Uso: con el servidor de desarrollo en marcha →  node scripts/agent-new-test.mjs [url]
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://localhost:3123/';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
const out = []; const check = (l, ok, x = '') => out.push((ok ? '✔ ' : '✘ ') + l + (x ? ' · ' + x : ''));
await page.route('**/studio-api/agents/auth/me', r => r.fulfill({ json: { user: { id: 'u1', email: 'propietario@example.com' } } }));
await page.route('**/studio-api/agents/agents', r => r.request().method() === 'GET' ? r.fulfill({ json: { agents: [] } }) : r.continue());
await page.route('**/studio-api/agents/agents/generate', r => r.fulfill({ json: { config: { name: 'Asistente IA ficticio', description: 'd', role: 'Rol propuesto por IA', objective: 'Objetivo IA', instructions: 'Instrucciones propuestas por la IA.', capabilities: [], requiresApproval: false } } }));
try {
  await page.goto(URL);
  await page.getByRole('button', { name: /Empezar en blanco/ }).click();
  await page.getByRole('button', { name: /Siguiente: agente IA/ }).click();
  await page.getByRole('button', { name: 'Crear nuevo' }).waitFor();
  await page.getByRole('button', { name: 'Crear nuevo' }).click();
  const role = page.getByRole('textbox', { name: 'Rol' });
  check('«Crear nuevo» abre el formulario del agente', await role.isVisible());
  check('El formulario viene prerrellenado', (await role.inputValue()).length > 5, await role.inputValue());
  await page.getByRole('button', { name: /Rellenar con IA/ }).click();
  await page.waitForTimeout(800);
  check('«Rellenar con IA» sustituye los campos por la propuesta', (await role.inputValue()) === 'Rol propuesto por IA', await role.inputValue());
} catch (e) { out.push('✘ ERROR: ' + e.message.split('\n')[0]); await page.screenshot({ path: 'agent-error.png' }); }
console.log(out.join('\n'));
await browser.close();
