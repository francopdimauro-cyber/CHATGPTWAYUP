'use client';
import { useState } from 'react';
import { CircleAlert, CircleCheck, Search, X } from 'lucide-react';
import { readSeo, seoChecks, type PageSeo } from '@/lib/element-editing';

/** SEO de la página: título, metadescripción, idioma, Open Graph, canónica y robots, con avisos deterministas. */
export function SeoPanel({ html, onSave, onClose }: { html: string; onSave(seo: PageSeo): void; onClose(): void }) {
  const [seo, setSeo] = useState<PageSeo>(() => readSeo(html));
  const checks = seoChecks(html);
  const input = 'mt-1 w-full rounded-md border border-stroke bg-panel px-2.5 py-2 text-[12.5px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15';
  const field = (key: keyof PageSeo, label: string, max: number, hint?: string, area = false) => <label className="block text-[11px] font-medium text-mist">
    <span className="flex justify-between">{label}<span className={'font-mono text-[10px] ' + (seo[key].length > max ? 'text-red-500' : 'text-faint')}>{seo[key].length}/{max}</span></span>
    {area ? <textarea className={input + ' min-h-[70px] resize-y'} value={seo[key]} onChange={e => setSeo({ ...seo, [key]: e.target.value })} />
      : <input className={input} value={seo[key]} onChange={e => setSeo({ ...seo, [key]: e.target.value })} />}
    {hint && <span className="mt-1 block text-[10px] font-normal text-faint">{hint}</span>}
  </label>;
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-3" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="seo-title" className="scroll-subtle max-h-[calc(100dvh-24px)] w-full max-w-[620px] overflow-y-auto rounded-xl border border-stroke bg-panel p-5 shadow-pop sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <div><h2 id="seo-title" className="flex items-center gap-2 font-display text-[24px] font-semibold"><Search size={18} className="text-brand" /> SEO de la página</h2>
          <p className="mt-1 text-[12px] text-mist">Cómo aparecerá tu web en Google y al compartirla.</p></div>
        <button type="button" onClick={onClose} aria-label="Cerrar SEO" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-mist hover:bg-raised"><X size={16} /></button>
      </header>
      <div className="mt-4 rounded-lg border border-stroke bg-elevated p-3.5">
        <p className="truncate text-[11px] text-faint">{seo.canonical || 'https://tudominio.es/'}</p>
        <p className="truncate text-[16px] text-brand">{seo.title || 'Título de la página'}</p>
        <p className="line-clamp-2 text-[12px] text-mist">{seo.description || 'Añade una metadescripción que resuma la página en una o dos frases.'}</p>
      </div>
      <div className="mt-4 space-y-3.5">
        {field('title', 'Título SEO', 65, 'Aparece en la pestaña del navegador y en Google.')}
        {field('description', 'Metadescripción', 165, undefined, true)}
        <div className="grid gap-3 sm:grid-cols-2">
          {field('lang', 'Idioma (lang)', 10, 'Ej. es-ES')}
          <label className="block text-[11px] font-medium text-mist">Indexación
            <select className={input} value={seo.robots} onChange={e => setSeo({ ...seo, robots: e.target.value })}>
              <option value="">Por defecto (indexar)</option><option value="index, follow">Indexar y seguir enlaces</option><option value="noindex, follow">No indexar</option><option value="noindex, nofollow">No indexar ni seguir</option>
            </select></label>
        </div>
        {field('canonical', 'URL canónica', 300, 'Solo si ya conoces el dominio definitivo (https://…).')}
        {field('ogTitle', 'Título al compartir (Open Graph)', 90)}
        {field('ogDescription', 'Descripción al compartir', 200, undefined, true)}
      </div>
      <div className="mt-4 rounded-lg border border-stroke p-3">
        <p className="mb-1.5 text-[11px] font-semibold">Revisión automática</p>
        {checks.length ? checks.map(c => <p key={c} className="flex items-start gap-2 text-[11.5px] leading-5 text-mist"><CircleAlert size={13} className="mt-1 shrink-0 text-amber-500" />{c}</p>)
          : <p className="flex items-center gap-2 text-[11.5px] text-mist"><CircleCheck size={13} className="text-emerald-500" /> Todo correcto en lo básico.</p>}
        <p className="mt-1.5 text-[10px] text-faint">La revisión se actualiza al guardar.</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="inline-flex min-h-[34px] items-center rounded-lg border border-stroke px-3 text-[12px] text-ink hover:bg-elevated">Cancelar</button>
        <button type="button" onClick={() => onSave(seo)} className="inline-flex min-h-[34px] items-center rounded-lg bg-brand px-4 text-[12px] font-semibold text-white hover:brightness-110">Guardar SEO</button>
      </div>
    </section>
  </div>;
}
