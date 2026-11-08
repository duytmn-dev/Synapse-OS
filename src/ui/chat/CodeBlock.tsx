import { Fragment, useState, type ReactNode } from 'react';
import type { ChatCode } from './types';
import { IconCheck, IconCode, IconCopy, IconFile, IconPlay } from '../icons';

const PY_KEYWORDS = new Set([
  'from', 'import', 'def', 'return', 'for', 'in', 'if', 'else', 'elif', 'while', 'class', 'with', 'as',
  'True', 'False', 'None', 'and', 'or', 'not', 'lambda', 'try', 'except', 'raise', 'yield',
  'const', 'let', 'var', 'function', 'export', 'async', 'await', 'new', 'interface', 'type',
]);

const TOKEN_RE = /(#.*$|\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)(?=\s*\()|\b([A-Za-z_]\w*)\b/gm;

/** Tô màu cú pháp tối giản (không thêm thư viện để giữ app nhẹ). */
function highlight(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const [tok, comment, str, num, fn, word] = m;
    let cls = '';
    if (comment) cls = 'text-slate-500 italic';
    else if (str) cls = 'text-amber-300';
    else if (num) cls = 'text-orange-300';
    else if (fn) cls = PY_KEYWORDS.has(fn) ? 'text-sky-400' : 'text-emerald-300';
    else if (word && PY_KEYWORDS.has(word)) cls = 'text-sky-400';
    out.push(cls ? <span key={m.index} className={cls}>{tok}</span> : tok);
    last = m.index + tok.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

interface CodeBlockProps {
  code: ChatCode;
  onRun?: (code: ChatCode) => void;
  onApply?: (code: ChatCode) => void;
  /** Chế độ gọn (chỉ có Copy), dùng cho trả lời Fast-Path. */
  minimal?: boolean;
}

export function CodeBlock({ code, onRun, onApply, minimal = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const lines = code.code.split('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard bị chặn — bỏ qua */
    }
  };

  const action = (label: string, cb?: (c: ChatCode) => void) => {
    cb?.(code);
    setFlash(label);
    setTimeout(() => setFlash(null), 1500);
  };

  const btn = 'flex items-center gap-1 rounded-md border border-hq-border px-2 py-0.5 text-[11px] text-hq-muted transition hover:border-hq-accent/50 hover:text-hq-text';

  return (
    <div className="overflow-hidden rounded-lg border border-hq-border bg-[#0a101c]">
      <div className="flex items-center gap-2 border-b border-hq-border px-3 py-1.5">
        <IconFile size={13} className="text-hq-muted" />
        <span className="text-xs text-hq-muted">{code.filename || code.language}</span>
        {flash && <span className="text-[11px] text-hq-accent">{flash}</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <button className={btn} onClick={copy}>
            {copied ? <IconCheck size={12} className="text-hq-accent" /> : <IconCopy size={12} />} {copied ? 'Đã copy' : 'Copy'}
          </button>
          {!minimal && (
            <>
              <button className={btn} onClick={() => action('Đã gửi lệnh chạy', onRun)}>
                <IconPlay size={10} /> Run
              </button>
              <button className={btn} onClick={() => action('Đã áp dụng', onApply)}>
                <IconCode size={12} /> Apply
              </button>
            </>
          )}
        </div>
      </div>
      <pre className="overflow-x-auto px-3 py-2 font-mono text-[12px] leading-5">
        <code className="grid grid-cols-[auto_1fr] gap-x-4">
          {lines.map((l, i) => (
            <Fragment key={i}>
              <span className="select-none text-right text-slate-600">{minimal ? '' : i + 1}</span>
              <span className="whitespace-pre text-slate-200">{highlight(l)}</span>
            </Fragment>
          ))}
        </code>
      </pre>
    </div>
  );
}
