import { useRef, useState, type KeyboardEvent } from 'react';
import type { AgentQuotaStat } from '@shared/types';
import { getAgentMeta } from '../agents';
import type { TargetAgent, ViewMode } from './types';
import { IconChevronDown, IconCube, IconPaperclip, IconSend, IconX } from '../icons';

interface SmartInputBarProps {
  mode: ViewMode;
  onToggle3D: () => void;
  onSend: (text: string, target: TargetAgent, files: File[]) => void;
  agents: AgentQuotaStat[];
}

export function SmartInputBar({ mode, onToggle3D, onSend, agents }: SmartInputBarProps) {
  const [text, setText] = useState('');
  const [target, setTarget] = useState<TargetAgent>('auto');
  const [files, setFiles] = useState<File[]>([]);
  const [menu, setMenu] = useState<'agent' | 'route' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const t = text.trim();
    if (!t && files.length === 0) return;
    onSend(t, target, files);
    setText('');
    setFiles([]);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const chip = 'flex items-center gap-1 rounded-md border border-hq-border px-2 py-1 text-xs text-hq-muted transition hover:text-hq-text';
  const is3D = mode === 'chat3d';

  return (
    <div className="relative rounded-xl border border-hq-border bg-hq-panel p-2.5 focus-within:border-hq-accent/50">
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span key={i} className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[11px]">
              {f.name}
              <button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Bỏ file">
                <IconX size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        rows={1}
        placeholder="Bổ sung yêu cầu cho dự án..."
        className="max-h-32 w-full resize-none bg-transparent px-1 text-sm outline-none placeholder:text-hq-muted"
      />
      <div className="mt-2 flex items-center gap-2">
        <button className="text-hq-muted hover:text-hq-text" onClick={() => fileRef.current?.click()} aria-label="Đính kèm file">
          <IconPaperclip size={16} />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            setFiles([...files, ...Array.from(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />

        <div className="relative">
          <button className={chip} onClick={() => setMenu(menu === 'agent' ? null : 'agent')}>
            @ {target === 'auto' ? 'Agent' : getAgentMeta(target).label}
          </button>
          {menu === 'agent' && (
            <ul className="absolute bottom-9 left-0 z-20 w-40 rounded-lg border border-hq-border bg-hq-panel p-1 text-xs shadow-xl">
              {agents.map((a) => {
                const m = getAgentMeta(a.agent_id);
                return (
                  <li key={a.agent_id}>
                    <button
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-white/5"
                      onClick={() => {
                        setTarget(a.agent_id);
                        setMenu(null);
                      }}
                    >
                      <span style={{ color: m.color }}>{m.glyph}</span> {m.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="relative">
          <button className={chip} onClick={() => setMenu(menu === 'route' ? null : 'route')}>
            {target === 'auto' ? 'Tự động' : 'Chỉ định'} <IconChevronDown size={12} />
          </button>
          {menu === 'route' && (
            <ul className="absolute bottom-9 left-0 z-20 w-36 rounded-lg border border-hq-border bg-hq-panel p-1 text-xs shadow-xl">
              <li>
                <button
                  className="w-full rounded px-2 py-1.5 text-left hover:bg-white/5"
                  onClick={() => {
                    setTarget('auto');
                    setMenu(null);
                  }}
                >
                  Tự động (Triage)
                </button>
              </li>
            </ul>
          )}
        </div>

        <button
          onClick={onToggle3D}
          className={`ml-auto flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs transition ${
            is3D ? 'border-hq-accent/50 bg-hq-accent/10 text-hq-accent' : 'border-hq-border text-hq-muted hover:text-hq-text'
          }`}
        >
          <IconCube size={13} /> {is3D ? '3D đang bật' : 'Mở 3D'}
        </button>
        <button
          onClick={submit}
          className="grid h-7 w-8 place-items-center rounded-md bg-hq-accent text-slate-900 transition hover:brightness-110 disabled:opacity-40"
          disabled={!text.trim() && files.length === 0}
          aria-label="Gửi"
        >
          <IconSend size={14} />
        </button>
      </div>
    </div>
  );
}
