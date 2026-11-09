import { useRef, useState, type KeyboardEvent } from 'react';
import type { ChatAgent } from '../../main/ipc';
import { getAgentMeta } from '../agents';
import type { TargetAgent } from './types';
import { IconChevronDown, IconPaperclip, IconSendPlane, IconX } from '../icons';

interface SmartInputBarProps {
  onSend: (text: string, target: TargetAgent, files: File[]) => void;
  agents: ChatAgent[];
  onOpenAgentMenu: () => void;
  sendDisabled?: boolean;
}

export function SmartInputBar({ onSend, agents, onOpenAgentMenu, sendDisabled }: SmartInputBarProps) {
  const [text, setText] = useState('');
  const [target, setTarget] = useState<TargetAgent>('auto');
  const [files, setFiles] = useState<File[]>([]);
  const [menu, setMenu] = useState<'agent' | 'route' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const t = text.trim();
    if (sendDisabled || (!t && files.length === 0)) return;
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

  const toolBtn =
    'flex items-center gap-1.5 rounded-[6px] border border-[#23344A] bg-[#142235] px-2.5 py-1 text-[11.5px] font-medium text-[#9DB0C8] transition hover:border-[#405672] hover:text-[#EAF2FF]';

  return (
    <div className="relative rounded-[12px] border border-[#405672] bg-[#0A1220] p-3 shadow-md focus-within:border-[#58E9A8]/80 focus-within:shadow-[0_0_12px_rgba(88,233,168,0.12)]">
      {/* File tags */}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span
              key={i}
              className="flex items-center gap-1 rounded-md border border-[#23344A] bg-[#142235] px-2 py-0.5 text-[11px] text-[#EAF2FF]"
            >
              <span className="truncate max-w-[140px]">{f.name}</span>
              <button
                type="button"
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
                className="text-[#8297B2] hover:text-[#FF9A83]"
              >
                <IconX size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Textarea */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        rows={2}
        placeholder="Nhập tin nhắn..."
        className="max-h-32 w-full resize-none bg-transparent px-1 text-[13px] text-[#EAF2FF] outline-none placeholder:text-[#8297B2]"
      />

      {/* Bottom tools row */}
      <div className="mt-2 flex items-center justify-between">
        {/* Left tool pills */}
        <div className="flex items-center gap-2">
          {/* Attach button */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={toolBtn}
            title="Đính kèm tệp"
          >
            <IconPaperclip size={13} className="text-[#9DB0C8]" />
            <span>Đính kèm</span>
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

          {/* @Agent button */}
          <div className="relative">
            <button
              type="button"
              className={toolBtn}
              onClick={() => {
                if (menu !== 'agent') onOpenAgentMenu();
                setMenu(menu === 'agent' ? null : 'agent');
              }}
            >
              <span>
                {target === 'auto' ? '@Agent' : `@${agents.find((agent) => agent.id === target)?.label ?? target}`}
              </span>
            </button>
            {menu === 'agent' && (
              <ul className="absolute bottom-9 left-0 z-30 w-44 rounded-lg border border-[#23344A] bg-[#0E1725] p-1 text-[12px] shadow-2xl">
                <li>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[#9DB0C8] hover:bg-[#142235] hover:text-[#EAF2FF]"
                    onClick={() => {
                      setTarget('auto');
                      setMenu(null);
                    }}
                  >
                    <span>✦ Gemini → ChatGPT</span>
                  </button>
                </li>
                {agents.map((a) => {
                  const m = getAgentMeta(a.id);
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[#9DB0C8] hover:bg-[#142235] hover:text-[#EAF2FF]"
                        onClick={() => {
                          setTarget(a.id);
                          setMenu(null);
                        }}
                      >
                        <span style={{ color: m.color }}>{m.glyph}</span>
                        <span>{a.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Route dropdown (Tự động ▾) */}
          <div className="relative">
            <button
              type="button"
              className={toolBtn}
              onClick={() => setMenu(menu === 'route' ? null : 'route')}
            >
              <span>{target === 'auto' ? 'Tự động' : 'Chỉ định'}</span>
              <IconChevronDown size={11} className="text-[#9DB0C8]" />
            </button>
            {menu === 'route' && (
              <ul className="absolute bottom-9 left-0 z-30 w-36 rounded-lg border border-[#23344A] bg-[#0E1725] p-1 text-[12px] shadow-2xl">
                <li>
                  <button
                    type="button"
                    className="w-full rounded px-2.5 py-1.5 text-left text-[#9DB0C8] hover:bg-[#142235] hover:text-[#EAF2FF]"
                    onClick={() => {
                      setTarget('auto');
                      setMenu(null);
                    }}
                  >
                    Tự động
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>

        {/* Right Send button (Gửi) */}
        <button
          type="button"
          onClick={submit}
          disabled={sendDisabled || (!text.trim() && files.length === 0)}
          className="flex h-[29px] items-center gap-1.5 rounded-[6px] border border-[#58E9A8] bg-[#58E9A8] px-3.5 text-[12px] font-semibold text-[#071912] shadow-sm transition hover:bg-[#6af2b4] disabled:opacity-40"
        >
          <IconSendPlane size={14} className="text-[#071912]" />
          <span>Gửi</span>
        </button>
      </div>
    </div>
  );
}
