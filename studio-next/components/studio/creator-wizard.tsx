'use client';
/** Creador de webs en 4 pasos: negocio → referencias → dirección creativa → generar.
 *  Cada paso usa servicios reales (/studio-api/webcreator/*); si algo no está disponible se dice claramente. */
import { useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, FilePlus2, Globe, ImagePlus, LoaderCircle, Palette, Search, Sparkles, Trash2, Wand2 } from 'lucide-react';

export type Direction = {
  resumen: string; estilo: string; tono: string; composicion: string; cta: string; imagenes: string;
  paleta: { fondo: string; superficie: string; texto: string; acento: string; secundario: string };
  tipografia: { titulares: string; texto: string; razon: string };
  secciones: { titulo: string; objetivo: string }[];
};
type Analysis = {
  url: string; title: string; description: string; colors: { hex: string }[]; fonts: string[]; nav: string[];
  headings: { tag: string; text: string }[]; contacts: { emails: string[]; phones: string[]; whatsapp: boolean; socials: string[] };
  images: { src: string; alt: string }[]; logo: string; forms: number;
};
type WebRef = { url: string; host: string; title: string; snippet: string; selected: boolean; colors?: string[]; fonts?: string[]; status?: string };
type RefImage = { id: string; name: string; dataUrl: string; role: string; note: string; analysis?: Record<string, unknown>; status: string };
type Props = {
  form: Record<string, string>; setForm(f: Record<string, string>): void; brief: string; busy: boolean;
  aiReady: boolean; aiReason: string; onCheckAI(): void; onGenerate(direction: Direction | null): void; onLocal(): void; error: string;
};
const FONT_OPTIONS = ['Serif editorial', 'Serif clásica', 'Sans humanista', 'Sans geométrica', 'Sans neutra', 'Display condensada', 'Monoespaciada'];
const FONT_PREVIEW: Record<string, string> = {
  'Serif editorial': "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif", 'Serif clásica': "Georgia,'Times New Roman',serif",
  'Sans humanista': "'Segoe UI','Helvetica Neue',Arial,sans-serif", 'Sans geométrica': "'Avenir Next',Avenir,'Century Gothic','Trebuchet MS',sans-serif",
  'Sans neutra': "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", 'Display condensada': "'Arial Narrow','Roboto Condensed',Impact,sans-serif",
  'Monoespaciada': "ui-monospace,'SF Mono',Menlo,Consolas,monospace",
};
const ROLES: [string, string][] = [['inspiracion', 'Inspiración general'], ['estructura', 'Estructura / composición'], ['color', 'Colores'], ['tipografia', 'Tipografía'], ['marca', 'Marca'], ['seccion', 'Una sección concreta']];
const PRESERVE: [string, string][] = [['colores', 'Colores'], ['logo', 'Logo'], ['fotografias', 'Fotografías'], ['textos', 'Textos'], ['estructura', 'Estructura'], ['estilo', 'Estilo general']];
const MODES: [string, string, string][] = [
  ['modernizar', 'Modernizar mi web', 'Mantiene marca y contenidos, mejora diseño y usabilidad.'],
  ['redisenar', 'Rediseñar desde cero', 'Nueva dirección visual usando tu web como contexto.'],
  ['identidad', 'Conservar identidad', 'Prioriza logo, colores e imágenes reconocibles.'],
  ['inspirarme', 'Inspirarme en esta web', 'No es mi web: solo como inspiración visual.'],
];
const input = 'w-full rounded-lg border border-stroke bg-panel px-3 py-2.5 text-[12.5px] text-ink outline-none transition placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15';
const btn = 'inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-stroke bg-panel px-3 text-[11.5px] font-medium text-ink transition hover:border-brand/45 hover:bg-elevated disabled:opacity-40';
const primary = 'inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-[12px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50';

async function api(path: string, body: unknown): Promise<any> {
  const res = await fetch('/studio-api/webcreator/' + path, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Error(typeof data.error === 'string' ? data.error : 'Error del servidor (' + res.status + ').');
  return data;
}
function Card({ title, subtitle, children, icon }: { title: string; subtitle?: string; children: ReactNode; icon: ReactNode }) {
  return <section className="rounded-xl border border-stroke bg-panel p-5 sm:p-6">
    <h3 className="flex items-center gap-2 text-[14px] font-semibold">{icon}{title}</h3>
    {subtitle && <p className="mt-1 text-[12px] leading-5 text-mist">{subtitle}</p>}
    <div className="mt-4">{children}</div>
  </section>;
}

export function CreatorWizard({ form, setForm, brief, busy, aiReady, aiReason, onCheckAI, onGenerate, onLocal, error }: Props) {
  const [step, setStep] = useState(0);
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState('modernizar');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [preserve, setPreserve] = useState<string[]>([]);
  const [images, setImages] = useState<RefImage[]>([]);
  const [freedom, setFreedom] = useState('equilibrado');
  const [webRefs, setWebRefs] = useState<WebRef[]>([]);
  const [direction, setDirection] = useState<Direction | null>(null);
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');
  const field = (id: string, label: string, placeholder: string, area = false) => <label key={id} className="flex flex-col gap-1.5 text-[11.5px] font-medium text-mist">{label}
    {area ? <textarea className={input + ' min-h-[96px] resize-y'} value={form[id] || ''} placeholder={placeholder} onChange={e => setForm({ ...form, [id]: e.target.value })} />
      : <input className={input} value={form[id] || ''} placeholder={placeholder} onChange={e => setForm({ ...form, [id]: e.target.value })} />}
  </label>;
  const run = async (label: string, fn: () => Promise<void>) => {
    setWorking(label); setMessage('');
    try { await fn(); } catch (e) { setMessage(e instanceof Error ? e.message : 'No se pudo completar.'); } finally { setWorking(''); }
  };
  const analyzeUrl = () => run('Analizando tu web…', async () => {
    const r = await api('analyze-url', { url }); setAnalysis(r.analysis);
    if (!form.name && r.analysis.title) setForm({ ...form, name: r.analysis.title.split(/[|·–-]/)[0].trim() });
  });
  const addImages = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files).slice(0, 4 - images.length)) {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setMessage('«' + file.name + '»: solo PNG, JPEG o WebP.'); continue; }
      if (file.size > 1_500_000) { setMessage('«' + file.name + '» supera 1,5 MB.'); continue; }
      const dataUrl = await new Promise<string>((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = ko; r.readAsDataURL(file); });
      setImages(list => [...list, { id: crypto.randomUUID(), name: file.name, dataUrl, role: 'inspiracion', note: '', status: 'Sin analizar' }]);
    }
  };
  const analyzeImage = (img: RefImage) => run('Analizando imagen…', async () => {
    const r = await api('analyze-image', { image: img.dataUrl, role: img.role, note: img.note });
    setImages(list => list.map(x => x.id === img.id ? { ...x, analysis: r.reference, status: 'Analizada' } : x));
  });
  const search = () => run('Buscando webs de referencia reales…', async () => {
    const r = await api('research', { industry: form.industry, style: form.style, goal: form.goal, location: form.contact });
    setWebRefs((r.research.results as WebRef[]).map((x, i) => ({ ...x, selected: i < 4 })));
    if (!r.research.results.length) setMessage('El buscador no encontró webs adecuadas. Prueba a detallar el sector o el estilo.');
  });
  const analyzeRef = (ref: WebRef) => run('Analizando ' + ref.host + '…', async () => {
    const r = await api('analyze-url', { url: ref.url });
    setWebRefs(l => l.map(x => x.url === ref.url ? { ...x, colors: r.analysis.colors.slice(0, 6).map((c: { hex: string }) => c.hex), fonts: r.analysis.fonts, status: 'Analizada' } : x));
  });
  const propose = () => run('Creando la dirección creativa…', async () => {
    const r = await api('direction', {
      brief, mode, freedom, preserve,
      analysis: analysis ? { title: analysis.title, description: analysis.description, colors: analysis.colors, fonts: analysis.fonts, nav: analysis.nav, headings: analysis.headings } : null,
      images: images.filter(i => i.analysis || i.note).map(i => ({ rol: i.role, nota: i.note, analisis: i.analysis || null })),
      research: webRefs.filter(r => r.selected).map(({ title, host, snippet, colors, fonts }) => ({ title, host, snippet, colors, fonts })),
    });
    setDirection(r.direction);
  });
  const steps = ['Tu negocio', 'Referencias', 'Dirección creativa', 'Generar'];
  const canNext = step !== 0 || (form.name?.trim().length >= 2 && (form.services?.trim().length || 0) >= 20);
  const setPal = (k: keyof Direction['paleta'], v: string) => direction && setDirection({ ...direction, paleta: { ...direction.paleta, [k]: v } });

  return <div className="space-y-5">
    <ol className="flex flex-wrap items-center gap-2" aria-label="Pasos del creador">
      {steps.map((s, i) => <li key={s}><button type="button" onClick={() => (i <= step || canNext) && setStep(i)} aria-current={i === step ? 'step' : undefined}
        className={'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11.5px] transition ' + (i === step ? 'border-brand bg-brandsoft text-brand' : i < step ? 'border-stroke text-ink' : 'border-stroke text-faint')}>
        <span className={'inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px] ' + (i === step ? 'bg-brand text-white' : i < step ? 'bg-brandsoft text-brand' : 'border border-stroke')}>{i < step ? <Check size={11} /> : i + 1}</span>{s}
      </button></li>)}
    </ol>

    {step === 0 && <Card title="Cuéntanos tu negocio" subtitle="Solo información real: la IA no inventará precios, reseñas ni datos de contacto." icon={<Wand2 size={16} className="text-brand" />}>
      <div className="grid gap-4 md:grid-cols-2">
        {field('name', 'Nombre del negocio *', 'Ej. Estudio Norte')}
        {field('industry', 'Sector o actividad', 'Restaurante, clínica, academia…')}
        {field('audience', 'Público objetivo', '¿A quién te diriges?')}
        {field('goal', 'Objetivo de la web', 'Reservas, contactos, ventas…')}
        {field('style', 'Estilo que te gusta', 'Editorial, cálido, minimalista…')}
        {field('palette', 'Colores e identidad', 'Colores de marca, logotipo…')}
      </div>
      <div className="mt-4">{field('services', 'Servicios y propuesta de valor * (mín. 20 caracteres)', 'Qué haces de verdad y por qué eres diferente…', true)}</div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {field('contact', 'Ubicación, contacto y horarios', 'Solo información real')}
        {field('features', 'Funciones necesarias', 'Formulario, WhatsApp, mapa, reservas…')}
      </div>
    </Card>}

    {step === 1 && <div className="space-y-4">
      <Card title="¿Ya tienes una web?" subtitle="La analizamos de verdad (estructura, textos, colores, tipografías, contacto) para mejorarla o inspirarnos." icon={<Globe size={16} className="text-brand" />}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className={input} type="url" inputMode="url" placeholder="https://tuwebactual.com" value={url} onChange={e => setUrl(e.target.value)} aria-label="Dirección de tu web actual" />
          <button type="button" className={btn + ' shrink-0'} disabled={!url.trim() || !!working} onClick={() => void analyzeUrl()}>
            {working.startsWith('Analizando tu web') ? <LoaderCircle size={14} className="animate-spin" /> : <Search size={14} />} Analizar web</button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {MODES.map(([id, title, desc]) => <label key={id} className={'flex cursor-pointer gap-2.5 rounded-lg border p-3 transition ' + (mode === id ? 'border-brand bg-brandsoft' : 'border-stroke hover:border-brand/40')}>
            <input type="radio" name="modo" className="mt-0.5 accent-[var(--wu-brand)]" checked={mode === id} onChange={() => setMode(id)} />
            <span><span className="block text-[12px] font-semibold">{title}</span><span className="text-[11px] text-mist">{desc}</span></span>
          </label>)}
        </div>
        {analysis && <div className="mt-4 rounded-lg border border-stroke bg-elevated p-4 text-[12px]">
          <p className="font-semibold">{analysis.title || analysis.url}</p>
          {analysis.description && <p className="mt-1 text-mist">{analysis.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">{analysis.colors.slice(0, 8).map(c => <span key={c.hex} title={c.hex} className="h-6 w-6 rounded-full border border-stroke" style={{ background: c.hex }} />)}
            {!analysis.colors.length && <span className="text-faint">Sin colores detectables en el CSS.</span>}</div>
          <dl className="mt-3 grid gap-x-4 gap-y-1 text-[11.5px] sm:grid-cols-2">
            <div><dt className="inline text-faint">Tipografías: </dt><dd className="inline">{analysis.fonts.join(', ') || 'no detectadas'}</dd></div>
            <div><dt className="inline text-faint">Menú: </dt><dd className="inline">{analysis.nav.slice(0, 6).join(' · ') || '—'}</dd></div>
            <div><dt className="inline text-faint">Contacto verificado: </dt><dd className="inline">{[...analysis.contacts.emails, ...analysis.contacts.phones].join(' · ') || '—'}{analysis.contacts.whatsapp ? ' · WhatsApp' : ''}</dd></div>
            <div><dt className="inline text-faint">Imágenes: </dt><dd className="inline">{analysis.images.length}{analysis.logo ? ' · logo detectado' : ''} · formularios: {analysis.forms}</dd></div>
          </dl>
          <p className="mt-2 text-[10.5px] text-faint">Datos extraídos de la web pública. Las imágenes de tu web se incorporarán en una próxima versión; de momento súbelas como referencias.</p>
        </div>}
      </Card>
      <Card title="¿Qué quieres conservar?" icon={<Check size={16} className="text-brand" />}>
        <div className="flex flex-wrap gap-2">{PRESERVE.map(([id, l]) => <label key={id} className={'flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] ' + (preserve.includes(id) ? 'border-brand bg-brandsoft text-brand' : 'border-stroke text-mist')}>
          <input type="checkbox" className="sr-only" checked={preserve.includes(id)} onChange={e => setPreserve(p => e.target.checked ? [...p, id] : p.filter(x => x !== id))} />{l}</label>)}</div>
      </Card>
      <Card title="Referencias visuales" subtitle="Sube hasta 4 capturas o imágenes y dinos qué te gusta de cada una. Se usan como inspiración, nunca se copian." icon={<ImagePlus size={16} className="text-brand" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          {images.map(img => <div key={img.id} className="rounded-lg border border-stroke p-3">
            <div className="flex gap-3"><img src={img.dataUrl} alt={'Referencia ' + img.name} className="h-16 w-24 shrink-0 rounded object-cover" />
              <div className="min-w-0 flex-1"><p className="truncate text-[11.5px] font-medium">{img.name}</p><p className="text-[10.5px] text-faint">{img.status}</p>
                <button type="button" onClick={() => setImages(l => l.filter(x => x.id !== img.id))} className="mt-1 inline-flex items-center gap-1 text-[10.5px] text-red-500 hover:underline"><Trash2 size={11} /> Quitar</button></div></div>
            <select className={input + ' mt-2 py-1.5'} value={img.role} onChange={e => setImages(l => l.map(x => x.id === img.id ? { ...x, role: e.target.value, analysis: undefined, status: 'Sin analizar' } : x))} aria-label="Uso de la referencia">
              {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <input className={input + ' mt-2 py-1.5'} placeholder="¿Qué te gusta? Ej. el hero y la tipografía" value={img.note} onChange={e => setImages(l => l.map(x => x.id === img.id ? { ...x, note: e.target.value } : x))} aria-label="Nota sobre la referencia" />
            <button type="button" className={btn + ' mt-2 w-full'} disabled={!!working} onClick={() => void analyzeImage(img)}><Sparkles size={13} /> {img.analysis ? 'Volver a analizar' : 'Analizar con IA'}</button>
            {img.analysis && <p className="mt-2 text-[11px] leading-5 text-mist">{String(img.analysis.composicion || img.analysis.estilo || '')}</p>}
          </div>)}
          {images.length < 4 && <label className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stroke text-[12px] text-mist hover:border-brand/50">
            <ImagePlus size={20} className="text-brand" /> Añadir imágenes<span className="text-[10.5px] text-faint">PNG, JPEG o WebP · máx. 1,5 MB</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={e => { void addImages(e.target.files); e.currentTarget.value = ''; }} />
          </label>}
        </div>
      </Card>
      <Card title="Buscar inspiración en internet" subtitle="Buscamos webs reales de tu sector con buen diseño. Elige las que te inspiren: se usan como referencia de patrones, nunca se copian." icon={<Search size={16} className="text-brand" />}>
        <button type="button" className={btn} disabled={!!working} onClick={() => void search()}>
          {working.startsWith('Buscando') ? <LoaderCircle size={14} className="animate-spin" /> : <Search size={14} />} {webRefs.length ? 'Buscar de nuevo' : 'Buscar inspiración'}</button>
        {webRefs.length > 0 && <ul className="mt-3 space-y-2">
          {webRefs.map(r => <li key={r.url} className={'rounded-lg border p-3 ' + (r.selected ? 'border-brand/50 bg-brandsoft/40' : 'border-stroke')}>
            <div className="flex items-start gap-2.5">
              <input type="checkbox" className="mt-1 accent-[var(--wu-brand)]" checked={r.selected} aria-label={'Usar ' + r.host + ' como referencia'}
                onChange={e => setWebRefs(l => l.map(x => x.url === r.url ? { ...x, selected: e.target.checked } : x))} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold">{r.title}</p>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="truncate text-[11px] text-brand hover:underline">{r.host}</a>
                {r.snippet && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-mist">{r.snippet}</p>}
                {r.colors && <div className="mt-2 flex items-center gap-1">{r.colors.map(c => <span key={c} title={c} className="h-4 w-4 rounded-full border border-stroke" style={{ background: c }} />)}
                  {r.fonts?.length ? <span className="ml-2 text-[10.5px] text-faint">{r.fonts.join(', ')}</span> : null}</div>}
              </div>
              <button type="button" className={btn + ' shrink-0 px-2 text-[10.5px]'} disabled={!!working} onClick={() => void analyzeRef(r)}>{r.status ? 'Analizada' : 'Analizar'}</button>
            </div>
          </li>)}
        </ul>}
        <p className="mt-2 text-[10.5px] text-faint">Resultados reales del buscador Tavily. Solo se usan las marcadas.</p>
      </Card>
    </div>}

    {step === 2 && <Card title="Dirección creativa" subtitle="La IA propone concepto, paleta, tipografía y estructura a partir de todo lo anterior. Puedes editarla antes de generar." icon={<Palette size={16} className="text-brand" />}>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Libertad creativa" className="flex gap-0.5 rounded-lg border border-stroke bg-elevated p-[3px]">
          {([['conservador', 'Conservadora'], ['equilibrado', 'Equilibrada'], ['atrevido', 'Atrevida']] as const).map(([v, l]) =>
            <button key={v} type="button" aria-pressed={freedom === v} onClick={() => setFreedom(v)} className={'rounded-md px-3 py-1.5 text-[11.5px] ' + (freedom === v ? 'bg-panel text-ink shadow-sm' : 'text-mist')}>{l}</button>)}
        </div>
        <button type="button" className={primary} disabled={!aiReady || !!working} onClick={() => void propose()}>
          {working.startsWith('Creando') ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />} {direction ? 'Proponer otra' : 'Proponer dirección'}</button>
      </div>
      {!aiReady && <p className="mt-2 text-[11px] text-amber-600">{aiReason || 'Motor IA no disponible.'} <button type="button" className="underline" onClick={onCheckAI}>Comprobar</button></p>}
      {direction && <div className="mt-5 space-y-4">
        <textarea aria-label="Concepto" className={input + ' min-h-[70px] resize-y'} value={direction.resumen} onChange={e => setDirection({ ...direction, resumen: e.target.value })} />
        <div className="grid grid-cols-5 gap-2">
          {(Object.keys(direction.paleta) as (keyof Direction['paleta'])[]).map(k => <label key={k} className="text-center text-[10.5px] text-mist">
            <span className="relative mx-auto block h-12 w-full overflow-hidden rounded-lg border border-stroke" style={{ background: direction.paleta[k] }}>
              <input type="color" value={direction.paleta[k]} onChange={e => setPal(k, e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={'Color ' + k} /></span>
            <span className="mt-1 block capitalize">{k}</span><span className="font-mono text-[10px] text-faint">{direction.paleta[k]}</span></label>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['titulares', 'texto'] as const).map(k => <label key={k} className="text-[11.5px] font-medium text-mist">Tipografía de {k}
            <select className={input + ' mt-1'} value={direction.tipografia[k]} onChange={e => setDirection({ ...direction, tipografia: { ...direction.tipografia, [k]: e.target.value } })}>
              {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}</select>
            <span className="mt-1 block truncate text-[18px] text-ink" style={{ fontFamily: FONT_PREVIEW[direction.tipografia[k]] }}>{k === 'titulares' ? form.name || 'Tu titular' : 'Texto de párrafo legible y cuidado.'}</span>
          </label>)}
        </div>
        {direction.tipografia.razon && <p className="text-[11px] text-faint">{direction.tipografia.razon}</p>}
        <div><p className="text-[11.5px] font-medium text-mist">Secciones (en orden)</p>
          <ol className="mt-1 space-y-1">{direction.secciones.map((s, i) => <li key={i} className="flex gap-2">
            <input className={input + ' py-1.5'} value={s.titulo} aria-label={'Sección ' + (i + 1)} onChange={e => setDirection({ ...direction, secciones: direction.secciones.map((x, j) => j === i ? { ...x, titulo: e.target.value } : x) })} />
            <button type="button" className={btn + ' shrink-0 px-2'} aria-label={'Quitar sección ' + s.titulo} onClick={() => setDirection({ ...direction, secciones: direction.secciones.filter((_, j) => j !== i) })}><Trash2 size={13} /></button></li>)}</ol>
          <button type="button" className="mt-1 text-[11px] text-brand hover:underline" onClick={() => setDirection({ ...direction, secciones: [...direction.secciones, { titulo: 'Nueva sección', objetivo: '' }] })}>+ Añadir sección</button></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[11.5px] font-medium text-mist">Tono<input className={input + ' mt-1'} value={direction.tono} onChange={e => setDirection({ ...direction, tono: e.target.value })} /></label>
          <label className="text-[11.5px] font-medium text-mist">Llamada a la acción<input className={input + ' mt-1'} value={direction.cta} onChange={e => setDirection({ ...direction, cta: e.target.value })} /></label>
        </div>
      </div>}
    </Card>}

    {step === 3 && <Card title="Generar tu web" subtitle={direction ? 'Se generará siguiendo la dirección creativa aprobada. Después se abre en el editor.' : 'Sin dirección creativa: la IA decidirá el diseño a partir del briefing.'} icon={<Sparkles size={16} className="text-brand" />}>
      <ul className="space-y-1 text-[12px] text-mist">
        <li>· Negocio: <span className="text-ink">{form.name || '—'}</span></li>
        <li>· Web analizada: <span className="text-ink">{analysis ? analysis.url + ' (' + MODES.find(m => m[0] === mode)?.[1] + ')' : 'ninguna'}</span></li>
        <li>· Webs de referencia: <span className="text-ink">{webRefs.filter(r => r.selected).length}</span> · Referencias visuales: <span className="text-ink">{images.length}</span> · Conservar: <span className="text-ink">{preserve.join(', ') || 'nada en concreto'}</span></li>
        <li>· Dirección: <span className="text-ink">{direction ? direction.resumen.slice(0, 120) : 'automática'}</span></li>
      </ul>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className={primary} disabled={!aiReady || busy} onClick={() => onGenerate(direction)}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />} Generar mi web con IA</button>
        <button type="button" className={btn} disabled={busy} onClick={onLocal}><FilePlus2 size={14} /> Crear sin IA (plantilla editable)</button>
      </div>
      {!aiReady && <p className="mt-2 text-[11px] text-amber-600">{aiReason || 'Motor IA no disponible.'} <button type="button" className="underline" onClick={onCheckAI}>Comprobar</button></p>}
    </Card>}

    {(message || error || working) && <p role="status" className={'rounded-lg border px-3 py-2 text-[12px] ' + (message || error ? 'border-red-500/30 bg-red-500/10 text-red-500' : 'border-stroke bg-elevated text-mist')}>{working || message || error}</p>}
    <div className="flex justify-between">
      <button type="button" className={btn} disabled={step === 0} onClick={() => setStep(s => s - 1)}><ArrowLeft size={14} /> Anterior</button>
      {step < 3 && <button type="button" className={primary} disabled={!canNext} onClick={() => setStep(s => s + 1)}>Siguiente <ArrowRight size={14} /></button>}
    </div>
  </div>;
}
