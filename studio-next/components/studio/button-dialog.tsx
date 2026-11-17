'use client';
/** Diálogo «Cambiar botón»: diseño, color, tamaño, texto, icono y comportamiento de un botón o enlace,
 *  con vista previa en directo. Nunca toca las clases, el id ni los atributos que usa el JavaScript de la web. */
import { useEffect, useMemo, useState } from 'react';
import { MousePointerClick, X } from 'lucide-react';
import { BUTTON_DESIGNS, actionHref, buttonDesignsCss, contrastText, parseAction, type ButtonAction, type ButtonSize } from '@/lib/button-designs';
import { loadSymbols, symbolSvg, type SymbolEntry } from '@/lib/symbols';
import type { ElementInfo } from './property-panel';

export type ButtonChange = {
  design?: string | null; color?: string; textColor?: string; size?: ButtonSize; text?: string;
  icon?: string | null; iconPosition?: 'before' | 'after'; href?: string; newTab?: boolean; convert?: boolean;
};
const ICONS = ['arrow-right', 'arrow-up-right', 'chevron-right', 'phone', 'message-circle', 'mail', 'calendar-check', 'map-pin', 'shopping-bag', 'download', 'play', 'star'];
const KINDS: [ButtonAction['kind'], string][] = [['seccion', 'Ir a una sección'], ['telefono', 'Llamar por teléfono'], ['whatsapp', 'Abrir WhatsApp'], ['email', 'Enviar un correo'], ['enlace', 'Abrir un enlace']];
const input = 'w-full rounded-md border border-stroke bg-panel px-2.5 py-2 text-[12px] text-ink outline-none focus:border-brand';
const chip = (on: boolean) => 'rounded-md border px-2.5 py-1.5 text-[11px] transition ' + (on ? 'border-brand bg-brandsoft text-brand' : 'border-stroke text-mist hover:text-ink');

export function ButtonDialog({ info, anchors, onApply, onClose }: { info: ElementInfo; anchors: { id: string; label: string }[];
  onApply(change: ButtonChange): void; onClose(): void }) {
  const b = info.button!;
  const isLink = info.tag === 'A';
  const [design, setDesign] = useState(b.design || 'solido');
  const [color, setColor] = useState(b.color);
  const [autoText, setAutoText] = useState(!b.design || b.textColor === contrastText(b.color));
  const [textColor, setTextColor] = useState(b.textColor);
  const [size, setSize] = useState<ButtonSize>((['s', 'm', 'l'].includes(b.size) ? b.size : 'm') as ButtonSize);
  const [text, setText] = useState(info.text);
  const [iconName, setIconName] = useState<string | null>(b.hasIcon ? 'actual' : null);
  const [iconPos, setIconPos] = useState<'before' | 'after'>(b.iconBefore ? 'before' : 'after');
  const [symbols, setSymbols] = useState<SymbolEntry[]>([]);
  const initialAction = useMemo(() => parseAction(info.attrs.href, info.attrs.target), [info.attrs.href, info.attrs.target]);
  const [action, setAction] = useState<ButtonAction>(initialAction);
  const [convert, setConvert] = useState(false);
  const [error, setError] = useState('');
  const [dark, setDark] = useState(false);
  useEffect(() => { loadSymbols().then(all => setSymbols(ICONS.map(n => all.find(s => s.name === n)).filter((s): s is SymbolEntry => Boolean(s)))).catch(() => {}); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const tColor = autoText ? contrastText(color) : textColor;
  const iconSvg = iconName && iconName !== 'actual' ? symbolSvg(symbols.find(s => s.name === iconName)!, 2.2) : '';
  const canLink = isLink || convert;
  const submitInForm = info.tag === 'BUTTON' && b.inForm;

  function apply() {
    setError('');
    try {
      const change: ButtonChange = { design, color, textColor: tColor, size, iconPosition: iconPos };
      if (text.trim() !== info.text.trim()) change.text = text;
      if (iconName === null) change.icon = b.hasIcon ? null : undefined;
      else if (iconName !== 'actual') change.icon = iconSvg;
      if (canLink) {
        const { href, newTab } = actionHref(action);
        const changed = convert || href !== info.attrs.href || newTab !== (info.attrs.target === '_blank');
        if (changed) { change.href = href; change.newTab = newTab; }
        if (convert) change.convert = true;
      }
      onApply(change); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Revisa los datos del botón.'); }
  }
  const previewStyle = { ['--wcb-c' as string]: color, ['--wcb-t' as string]: tColor } as React.CSSProperties;
  const preview = (d: string, label: string, small = false) => <span data-wc-btn={d} data-wc-btn-size={small ? 's' : size} style={previewStyle}>
    {iconPos === 'before' && iconSvg && <span data-wc-btn-icon="" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconSvg }} />}
    {label}
    {iconPos === 'after' && iconSvg && <span data-wc-btn-icon="" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconSvg }} />}
  </span>;

  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-3" role="dialog" aria-modal="true" aria-label="Cambiar botón" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <style>{buttonDesignsCss()}</style>
    <div className="flex max-h-[92vh] w-full max-w-[860px] flex-col overflow-hidden rounded-2xl border border-stroke bg-panel shadow-2xl">
      <header className="flex items-center justify-between border-b border-stroke px-5 py-3">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold"><MousePointerClick size={16} className="text-brand" /> Cambiar botón</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-mist hover:bg-elevated"><X size={16} /></button>
      </header>
      <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[1fr_300px]">
        <div className="space-y-5 p-5">
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Diseño</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BUTTON_DESIGNS.map(d => <button key={d.id} type="button" onClick={() => setDesign(d.id)} aria-pressed={design === d.id}
                className={'flex flex-col items-center gap-2 rounded-xl border p-3 transition ' + (design === d.id ? 'border-brand ring-2 ring-brand/25' : 'border-stroke hover:border-brand/40')}>
                <span className={'flex h-12 w-full items-center justify-center rounded-lg ' + (dark ? 'bg-[#15171c]' : 'bg-[#f4f2ec]')}>{preview(d.id, 'Botón', true)}</span>
                <span className="text-[11px] font-medium text-ink">{d.name}</span><span className="-mt-1.5 text-[10px] text-faint">{d.hint}</span>
              </button>)}
            </div>
          </section>
          <section className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Color</h3>
              <div className="flex items-center gap-2">
                <input type="color" value={color} onChange={e => setColor(e.target.value)} aria-label="Color del botón" className="h-9 w-12 cursor-pointer rounded-md border border-stroke bg-panel" />
                <input className={input + ' font-mono'} value={color} maxLength={7} aria-label="Color del botón en hexadecimal" onChange={e => { const v = e.target.value.trim(); if (/^#[\da-f]{0,6}$/i.test(v)) setColor(v.length === 7 ? v.toLowerCase() : v); }} />
              </div>
              <label className="mt-2 flex items-center gap-2 text-[11px] text-mist"><input type="checkbox" checked={autoText} onChange={e => setAutoText(e.target.checked)} /> Texto con contraste automático</label>
              {!autoText && <div className="mt-2 flex items-center gap-2"><input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} aria-label="Color del texto" className="h-8 w-12 cursor-pointer rounded-md border border-stroke" /><span className="font-mono text-[11px] text-mist">{textColor}</span></div>}
            </div>
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Tamaño</h3>
              <div className="flex gap-1.5">{([['s', 'Pequeño'], ['m', 'Mediano'], ['l', 'Grande']] as const).map(([k, l]) => <button key={k} type="button" className={chip(size === k)} onClick={() => setSize(k)}>{l}</button>)}</div>
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Texto e icono</h3>
            <input className={input} value={text} maxLength={120} onChange={e => setText(e.target.value)} aria-label="Texto del botón" />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button type="button" className={chip(iconName === null)} onClick={() => setIconName(null)}>Sin icono</button>
              {b.hasIcon && <button type="button" className={chip(iconName === 'actual')} onClick={() => setIconName('actual')}>El actual</button>}
              {symbols.map(s => <button key={s.name} type="button" title={s.name} aria-label={'Icono ' + s.name} className={chip(iconName === s.name) + ' px-2'} onClick={() => setIconName(s.name)}>
                <span className="block h-4 w-4" dangerouslySetInnerHTML={{ __html: symbolSvg(s, 2) }} /></button>)}
            </div>
            {iconName && <div className="mt-2 flex gap-1.5"><button type="button" className={chip(iconPos === 'before')} onClick={() => setIconPos('before')}>Icono delante</button><button type="button" className={chip(iconPos === 'after')} onClick={() => setIconPos('after')}>Icono detrás</button></div>}
          </section>
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Al pulsarlo</h3>
            {submitInForm ? <p className="rounded-lg bg-elevated p-3 text-[11.5px] leading-5 text-mist">Este botón envía un formulario: su comportamiento se mantiene tal cual para no romperlo.</p>
              : !canLink ? <div className="rounded-lg bg-elevated p-3 text-[11.5px] leading-5 text-mist">Este botón lo controla el JavaScript de la web (abre menús, pestañas…). Se mantiene tal cual.
                <button type="button" className="mt-2 block text-brand underline" onClick={() => setConvert(true)}>Prefiero que lleve a una sección, un teléfono o un enlace</button></div>
              : <div className="space-y-2">
                {convert && <p className="text-[11px] leading-5 text-amber-600">Se convertirá en enlace: dejará de hacer lo que le asigne el JavaScript de la web.</p>}
                <select className={input} value={action.kind} aria-label="Qué hace el botón" onChange={e => setAction({ kind: e.target.value as ButtonAction['kind'], value: '' } as ButtonAction)}>
                  {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                {action.kind === 'seccion' ? <select className={input} value={action.value} aria-label="Sección de destino" onChange={e => setAction({ kind: 'seccion', value: e.target.value })}>
                  <option value="">Elige una sección…</option>{anchors.map(a => <option key={a.id} value={a.id}>{a.label} (#{a.id})</option>)}</select>
                  : <input className={input} value={action.value} aria-label="Destino del botón"
                    placeholder={{ telefono: '+34 600 111 222', whatsapp: '34600111222', email: 'hola@tunegocio.es', enlace: 'https://…' }[action.kind]}
                    onChange={e => setAction({ ...action, value: e.target.value } as ButtonAction)} />}
                {action.kind === 'whatsapp' && <input className={input} value={action.text || ''} aria-label="Mensaje inicial de WhatsApp" placeholder="Mensaje inicial (opcional)" onChange={e => setAction({ ...action, text: e.target.value })} />}
                {action.kind === 'enlace' && <label className="flex items-center gap-2 text-[11px] text-mist"><input type="checkbox" checked={Boolean(action.newTab)} onChange={e => setAction({ ...action, newTab: e.target.checked })} /> Abrir en una pestaña nueva</label>}
              </div>}
          </section>
        </div>
        <aside className="border-t border-stroke bg-elevated p-5 md:sticky md:top-0 md:self-start md:border-l md:border-t-0">
          <div className="flex items-center justify-between"><h3 className="text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Vista previa</h3>
            <button type="button" className="text-[10.5px] text-mist underline" onClick={() => setDark(v => !v)}>{dark ? 'Fondo claro' : 'Fondo oscuro'}</button></div>
          <div className={'mt-3 flex min-h-[160px] items-center justify-center rounded-xl p-6 ' + (dark ? 'bg-[#15171c]' : 'bg-[#f4f2ec]')}>{preview(design, text || 'Botón')}</div>
          <p className="mt-3 text-[10.5px] leading-5 text-faint">Pasa el ratón por encima para ver el efecto. Se conservan las clases, el id y los atributos del botón, así que sus funciones siguen igual.</p>
        </aside>
      </div>
      {error && <p className="border-t border-stroke bg-red-500/10 px-5 py-2 text-[11.5px] text-red-600" role="alert">{error}</p>}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-stroke px-5 py-3">
        <button type="button" className="text-[11px] text-mist hover:text-ink hover:underline" onClick={() => { onApply({ design: null }); onClose(); }}>Volver al diseño original de la web</button>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-stroke px-4 py-2 text-[12px] text-ink hover:bg-elevated">Cancelar</button>
          <button type="button" onClick={apply} className="rounded-lg bg-brand px-4 py-2 text-[12px] font-semibold text-white hover:brightness-110">Aplicar cambios</button>
        </div>
      </footer>
    </div>
  </div>;
}
