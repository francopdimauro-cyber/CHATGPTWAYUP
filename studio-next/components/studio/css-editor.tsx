'use client';
/** Editor CSS integrado: tres niveles (Elemento, Sección, Global), con colores, números de línea, revisión en
 *  castellano y vista en vivo en el lienzo. «Aplicar» guarda en el HTML de la web en un solo paso de deshacer. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Braces, Check, X } from 'lucide-react';
import { checkCss, tokenizeCss, type CssMode, type CssTokenKind } from '@/lib/css-check';
import type { CssScope } from '@/lib/element-editing';

const MODE: Record<CssScope, CssMode> = { elemento: 'declaraciones', seccion: 'anidado', global: 'hoja' };
const COLORS: Record<CssTokenKind, string> = {
  comment: 'color:#7f8796;font-style:italic', selector: 'color:#c678dd', at: 'color:#e06c75', prop: 'color:#56b6c2', value: 'color:#e5c07b',
  num: 'color:#d19a66', color: 'color:#98c379', punct: 'color:#abb2bf', string: 'color:#98c379', plain: '', important: 'color:#e06c75;font-weight:600',
};
const styleObj = (s: string) => Object.fromEntries(s.split(';').filter(Boolean).map(d => { const [k, v] = d.split(':'); return [k.replace(/-(\w)/g, (_, c) => c.toUpperCase()), v]; }));
const HINT: Record<CssScope, string> = {
  elemento: 'Propiedades del elemento seleccionado, una por línea. Ej.: border-radius: 16px;',
  seccion: 'Se aplica solo a esta sección. Propiedades sueltas = la sección; reglas anidadas = lo de dentro. Ej.: h2 { letter-spacing: -.02em; }',
  global: 'CSS para toda la web. Se carga después del CSS original, así que lo sustituye donde coincida.',
};

export type CssEditorProps = {
  index: number | null; sectionLabel: string | null;
  read(scope: CssScope): string;
  onLive(scope: CssScope, text: string | null): void;
  onApply(scope: CssScope, text: string): boolean;
  onClose(): void;
  initialScope?: CssScope;
};

export function CssEditor({ index, sectionLabel, read, onLive, onApply, onClose, initialScope }: CssEditorProps) {
  const [scope, setScope] = useState<CssScope>(initialScope || (index === null ? 'global' : 'elemento'));
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const available = (s: CssScope) => s === 'global' || (index !== null && (s === 'elemento' || !!sectionLabel));
  const dirty = text !== saved;

  // Sincronía con el inspector: si cambia la selección o el HTML y no hay cambios sin aplicar, se recarga.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const current = useMemo(() => available(scope) ? read(scope) : '', [read, scope, index, sectionLabel]);
  useEffect(() => { if (!dirty) { setText(current); setSaved(current); } else if (current === text) setSaved(current); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [current]);

  const issues = useMemo(() => checkCss(text, MODE[scope]), [text, scope]);
  const errors = issues.filter(i => i.level === 'error');
  // Vista en vivo (solo si el CSS es válido; si no, se muestra lo guardado).
  useEffect(() => {
    const t = setTimeout(() => onLive(scope, dirty && !errors.length ? text : null), 140);
    return () => clearTimeout(t);
  }, [text, scope, dirty, errors.length, onLive]);
  useEffect(() => () => { onLive('elemento', null); onLive('seccion', null); onLive('global', null); }, [onLive]);

  function switchScope(s: CssScope) {
    if (s === scope || !available(s)) return;
    if (dirty && !window.confirm('Tienes cambios sin aplicar en este nivel. ¿Descartarlos?')) return;
    onLive(scope, null);
    const v = read(s); setScope(s); setText(v); setSaved(v);
  }
  function apply() { if (errors.length) return; if (onApply(scope, text)) setSaved(text); }
  function discard() { setText(saved); onLive(scope, null); }
  function goTo(line: number) {
    const ta = taRef.current; if (!ta) return;
    const pos = text.split('\n').slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0);
    ta.focus(); ta.setSelectionRange(pos, pos + (text.split('\n')[line - 1]?.length || 0));
  }
  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget, a = ta.selectionStart, b = ta.selectionEnd;
      const next = text.slice(0, a) + '  ' + text.slice(b); setText(next);
      requestAnimationFrame(() => ta.setSelectionRange(a + 2, a + 2));
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); apply(); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  }
  const sync = () => { const ta = taRef.current; if (!ta) return; if (preRef.current) { preRef.current.scrollTop = ta.scrollTop; preRef.current.scrollLeft = ta.scrollLeft; } if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop; };
  const lines = text.split('\n').length;
  const errLines = new Set(errors.map(i => i.line));
  const tokens = useMemo(() => tokenizeCss(text, MODE[scope]), [text, scope]);
  const mono = 'font-mono text-[12px] leading-[19px] whitespace-pre';

  return <section role="dialog" aria-label="Editor CSS" className="fixed bottom-3 left-1/2 z-[110] flex h-[min(420px,60vh)] w-[min(760px,calc(100vw-24px))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-stroke bg-panel shadow-2xl">
    <header className="flex items-center gap-2 border-b border-stroke px-3 py-2">
      <Braces size={15} className="text-brand" /><h2 className="text-[12.5px] font-semibold">Editor CSS</h2>
      <div className="ml-2 flex gap-1" role="tablist" aria-label="Nivel del CSS">
        {(['elemento', 'seccion', 'global'] as CssScope[]).map(s => <button key={s} type="button" role="tab" aria-selected={scope === s} disabled={!available(s)} onClick={() => switchScope(s)}
          className={'rounded-md px-2.5 py-1 text-[11px] disabled:opacity-35 ' + (scope === s ? 'bg-brandsoft font-semibold text-brand' : 'text-mist hover:text-ink')}>
          {s === 'elemento' ? 'Elemento' : s === 'seccion' ? 'Sección' + (sectionLabel ? ' · ' + sectionLabel.slice(0, 18) : '') : 'Global'}</button>)}
      </div>
      <span className="ml-auto text-[10.5px] text-faint">{dirty ? (errors.length ? 'Vista en vivo pausada (hay errores)' : 'Vista en vivo · sin aplicar') : 'Guardado'}</span>
      <button type="button" onClick={onClose} aria-label="Cerrar editor CSS" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-mist hover:bg-elevated"><X size={15} /></button>
    </header>
    <p className="border-b border-stroke px-3 py-1.5 text-[10.5px] text-faint">{HINT[scope]}</p>
    <div className="relative flex min-h-0 flex-1 bg-[#1e2128]">
      <div ref={gutterRef} aria-hidden="true" className={'select-none overflow-hidden border-r border-white/10 px-2 py-2 text-right text-[#5c6370] ' + mono}>
        {Array.from({ length: lines }, (_, i) => <div key={i} style={errLines.has(i + 1) ? { color: '#e06c75', fontWeight: 700 } : undefined}>{i + 1}</div>)}
      </div>
      <div className="relative min-w-0 flex-1">
        <pre ref={preRef} aria-hidden="true" className={'pointer-events-none absolute inset-0 m-0 overflow-hidden p-2 text-[#abb2bf] ' + mono}>
          {tokens.map((t, i) => <span key={i} style={COLORS[t.kind] ? styleObj(COLORS[t.kind]) : undefined}>{t.text}</span>)}{'\n'}
        </pre>
        <textarea ref={taRef} value={text} spellCheck={false} autoCapitalize="off" autoComplete="off" aria-label={'CSS de ' + (scope === 'elemento' ? 'elemento' : scope === 'seccion' ? 'sección' : 'toda la web')}
          onChange={e => setText(e.target.value)} onScroll={sync} onKeyDown={onKey} wrap="off"
          placeholder={scope === 'elemento' ? 'color: #0029ff;\npadding: 24px;' : scope === 'seccion' ? 'padding-block: 120px;\nh2 { font-size: clamp(2rem, 5vw, 4rem); }' : '.btn { border-radius: 999px; }'}
          className={'absolute inset-0 resize-none overflow-auto bg-transparent p-2 text-transparent caret-white outline-none placeholder:text-[#5c6370] ' + mono} style={{ WebkitTextFillColor: text ? 'transparent' : undefined }} />
      </div>
    </div>
    {issues.length > 0 && <ul aria-label="Problemas del CSS" className="max-h-[92px] overflow-y-auto border-t border-stroke bg-elevated px-3 py-1.5 text-[11px]">
      {issues.map((i, k) => <li key={k}><button type="button" onClick={() => goTo(i.line)} className={'flex w-full items-start gap-1.5 py-0.5 text-left hover:underline ' + (i.level === 'error' ? 'text-red-500' : 'text-amber-600')}>
        <AlertTriangle size={12} className="mt-0.5 flex-none" /><span>Línea {i.line}: {i.message}</span></button></li>)}
    </ul>}
    <footer className="flex items-center justify-between gap-2 border-t border-stroke px-3 py-2">
      <span className="text-[10.5px] text-faint">Ctrl+Intro aplica · Tab sangra · Esc cierra</span>
      <div className="flex gap-2">
        <button type="button" disabled={!dirty} onClick={discard} className="rounded-lg border border-stroke px-3 py-1.5 text-[11.5px] text-ink hover:bg-elevated disabled:opacity-40">Descartar</button>
        <button type="button" disabled={!dirty || errors.length > 0} onClick={apply} className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-[11.5px] font-semibold text-white hover:brightness-110 disabled:opacity-40"><Check size={13} /> Aplicar CSS</button>
      </div>
    </footer>
  </section>;
}
