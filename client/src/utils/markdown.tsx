import type { ReactNode } from 'react';

type Segment =
  | { t: 'text'; v: string }
  | { t: 'bold'; v: string }
  | { t: 'italic'; v: string }
  | { t: 'code'; v: string }
  | { t: 'strike'; v: string }
  | { t: 'link'; v: string; href: string };

const RE = /(?:\*{2}(.+?)\*{2})|(?:\*(.+?)\*)|(?:`(.+?)`)|(?:~~(.+?)~~)|(?:\[(.+?)\]\((.+?)\))/g;

function tokenize(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(text)) !== null) {
    if (m.index > last) out.push({ t: 'text', v: text.slice(last, m.index) });
    if (m[1]) out.push({ t: 'bold', v: m[1] });
    else if (m[2]) out.push({ t: 'italic', v: m[2] });
    else if (m[3]) out.push({ t: 'code', v: m[3] });
    else if (m[4]) out.push({ t: 'strike', v: m[4] });
    else if (m[5] && m[6]) out.push({ t: 'link', v: m[5], href: m[6] });
    last = RE.lastIndex;
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out;
}

export function formatText(text: string): ReactNode {
  const segments = tokenize(text);
  if (segments.length === 1 && segments[0].t === 'text') return text;
  return segments.map((s, i) => {
    switch (s.t) {
      case 'bold': return <strong key={i}>{s.v}</strong>;
      case 'italic': return <em key={i}>{s.v}</em>;
      case 'code': return <code key={i} className="rounded bg-[var(--hover-overlay)] px-1 text-sm">{s.v}</code>;
      case 'strike': return <del key={i}>{s.v}</del>;
      case 'link': return <a key={i} href={s.href} target="_blank" rel="noreferrer" className="text-telegram-blue underline">{s.v}</a>;
      default: return s.v;
    }
  });
}
