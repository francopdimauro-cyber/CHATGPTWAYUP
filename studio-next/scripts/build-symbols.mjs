// Genera public/simbolos/lucide.json: el catálogo de símbolos (Lucide, licencia ISC) que el editor
// descarga solo al abrir la pestaña «Símbolos». Uso: node scripts/build-symbols.mjs
import { readdirSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(here, '..', 'node_modules', 'lucide-react', 'dist', 'esm', 'icons');
const pkg = JSON.parse(readFileSync(join(here, '..', 'node_modules', 'lucide-react', 'package.json'), 'utf8'));
const out = [];
for (const file of readdirSync(iconsDir).filter(f => f.endsWith('.mjs')).sort()) {
  const mod = await import(pathToFileURL(join(iconsDir, file)).href);
  const data = mod.__iconData;
  if (!data?.name || !Array.isArray(data.node)) continue;
  // Solo la geometría: etiqueta + atributos (sin «key», que es interno de React).
  const node = data.node.map(([tag, attrs]) => { const { key, ...rest } = attrs; return [tag, rest]; });
  out.push([data.name, node]);
}
const target = join(here, '..', 'public', 'simbolos');
mkdirSync(target, { recursive: true });
writeFileSync(join(target, 'lucide.json'), JSON.stringify({ version: pkg.version, license: 'ISC — Lucide Contributors', icons: out }));
console.log('Símbolos:', out.length, '· Lucide', pkg.version);
