'use client';
/** Muestra las respuestas de los agentes con formato Markdown básico (negritas, cursivas, listas y párrafos).
 *  Seguro por construcción: se generan elementos de React a partir del texto, nunca HTML en bruto. */
import React from 'react';

function inline(text: string, key: string): React.ReactNode[] {
  // **negrita** y *cursiva* (o _cursiva_); el resto, texto literal.
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={key + '-' + i++} className="font-semibold text-ink">{m[1]}</strong>);
    else out.push(<em key={key + '-' + i++}>{m[2] ?? m[3]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function AgentMarkdown({ text, className = '' }: { text: string; className?: string }) {
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, j) => <li key={j}>{inline(it, 'l' + blocks.length + '-' + j)}</li>);
    blocks.push(list.ordered
      ? <ol key={'b' + blocks.length} className="my-1.5 list-decimal space-y-1 pl-5">{items}</ol>
      : <ul key={'b' + blocks.length} className="my-1.5 list-disc space-y-1 pl-5">{items}</ul>);
    list = null;
  };
  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line), num = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (bullet || num) {
      const ordered = Boolean(num);
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? num)![1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    if (heading) blocks.push(<p key={'b' + blocks.length} className="mt-2 font-semibold text-ink">{inline(heading[1], 'h' + blocks.length)}</p>);
    else blocks.push(<p key={'b' + blocks.length} className="my-1">{inline(line, 'p' + blocks.length)}</p>);
  }
  flush();
  return <div className={className}>{blocks}</div>;
}
