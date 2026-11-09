import { Fragment, useState, type ReactNode } from 'react';
import type { ChatCode } from './types';
import { IconCheck, IconFile } from '../icons';

const PY_KEYWORDS = new Set([
  'from', 'import', 'def', 'return', 'for', 'in', 'if', 'else', 'elif', 'while', 'class', 'with', 'as',
  'True', 'False', 'None', 'and', 'or', 'not', 'lambda', 'try', 'except', 'raise', 'yield',
]);

const TOKEN_RE = /(#.*$|\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)(?=\s*\()|\b([A-Za-z_]\w*)\b/gm;

function highlight(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const [tok, comment, str, num, fn, word] = m;
    let cls = '';
    if (comment) cls = 'text-[#8297B2] italic';
    else if (str) cls = 'text-[#FFC075]';
    else if (num) cls = 'text-[#FF9A83]';
    else if (fn) cls = PY_KEYWORDS.has(fn) ? 'text-[#A88BFA]' : 'text-[#78BAFF]';
    else if (word && PY_KEYWORDS.has(word)) cls = 'text-[#A88BFA]';
    else if (word && ['cut_highlights', 'cut_highlight'].includes(word)) cls = 'text-[#78BAFF]';
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
}

export function CodeBlock({ code, onRun, onApply }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const lines = code.code.split('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const handleAction = (label: string, cb?: (c: ChatCode) => void) => {
    cb?.(code);
    setStatusNotice(label);
    setTimeout(() => setStatusNotice(null), 1500);
  };

  return (
    <div className="overflow-hidden rounded-[8px] border border-[#23344A] bg-[#0A1220] shadow-md">
      {/* Code Header Bar */}
      <div className="flex h-[32px] items-center justify-between border-b border-[#23344A] bg-[#142235] px-3">
        <div className="flex items-center gap-2">
          <IconFile size={13} className="text-[#78BAFF]" />
          <span className="font-mono text-[12px] font-medium text-[#EAF2FF]">
            {code.filename || code.language}
          </span>
          {statusNotice && (
            <span className="text-[11px] text-[#58E9A8] animate-in fade-in">
              • {statusNotice}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={copy}
            className="rounded-[4px] border border-[#23344A] bg-[#142235] px-2.5 py-0.5 text-[11px] font-medium text-[#9DB0C8] transition hover:border-[#405672] hover:text-[#EAF2FF]"
          >
            {copied ? (
              <span className="flex items-center gap-1 text-[#58E9A8]">
                <IconCheck size={11} /> Đã copy
              </span>
            ) : (
              'Copy'
            )}
          </button>

          <button
            type="button"
            onClick={() => handleAction('Đã chạy mã lệnh', onRun)}
            className="rounded-[4px] border border-[#23344A] bg-[#142235] px-2.5 py-0.5 text-[11px] font-medium text-[#9DB0C8] transition hover:border-[#405672] hover:text-[#EAF2FF]"
          >
            Run
          </button>

          <button
            type="button"
            onClick={() => handleAction('Đã áp dụng vào mã nguồn', onApply)}
            className="rounded-[4px] border border-[#23344A] bg-[#142235] px-2.5 py-0.5 text-[11px] font-medium text-[#58E9A8] transition hover:border-[#58E9A8] hover:bg-[#58E9A8]/10"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Code Content */}
      <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-5 text-[#EAF2FF]">
        <code className="grid grid-cols-[auto_1fr] gap-x-4">
          {lines.map((l, i) => (
            <Fragment key={i}>
              <span className="select-none text-right font-mono text-[11px] text-[#8297B2]">
                {i + 1}
              </span>
              <span className="whitespace-pre">{highlight(l)}</span>
            </Fragment>
          ))}
        </code>
      </pre>
    </div>
  );
}
