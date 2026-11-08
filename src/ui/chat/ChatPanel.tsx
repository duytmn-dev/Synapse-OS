import { useEffect, useRef } from 'react';
import type { AgentQuotaStat } from '@shared/types';
import type { ChatMessage, TargetAgent, ViewMode } from './types';
import { CodeBlock } from './CodeBlock';
import { MediaPreview } from './MediaPreview';
import { SmartInputBar } from './SmartInputBar';
import { IconCube, IconDots, IconExternal, IconSpinner, IconVideo, IconX } from '../icons';

interface ChatPanelProps {
  title: string;
  messages: ChatMessage[];
  mode: ViewMode;
  autoOrchestrated: boolean;
  connectedAgents: AgentQuotaStat[];
  onSend: (text: string, target: TargetAgent, files: File[]) => void;
  onToggle3D: () => void;
  onOpenOffice: () => void;
}

function Avatar({ msg }: { msg: ChatMessage }) {
  if (msg.author === 'user') {
    return (
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-orange-400 text-xs font-bold text-slate-900">
        {msg.authorName.charAt(0)}
      </span>
    );
  }
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-500/20 text-indigo-300">
      <IconCube size={16} />
    </span>
  );
}

function MessageItem({ msg, compact, onOpenOffice }: { msg: ChatMessage; compact: boolean; onOpenOffice: () => void }) {
  return (
    <article className="flex gap-3">
      <Avatar msg={msg} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-semibold">{msg.authorName}</span>
          <span className="text-[11px] text-hq-muted">{msg.time}</span>
        </div>
        {msg.text && (
          <p
            className={`w-fit max-w-full whitespace-pre-wrap text-sm ${
              msg.author === 'user' ? 'rounded-lg border border-hq-border bg-white/[0.03] px-3 py-1.5' : ''
            }`}
          >
            {msg.text}
          </p>
        )}
        {msg.attachments?.map((a) => (
          <div key={a.name} className="flex w-fit items-center gap-2.5 rounded-lg border border-hq-border bg-white/[0.03] px-2.5 py-1.5">
            <IconVideo size={18} className="text-hq-muted" />
            <div className="text-xs leading-tight">
              <div>{a.name}</div>
              <div className="text-hq-muted">{a.sizeLabel}</div>
            </div>
            <IconX size={13} className="ml-3 text-hq-muted" />
          </div>
        ))}
        {msg.orchestration && (
          <div className="flex items-center gap-2.5 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-sm">
            <IconSpinner size={15} className="text-indigo-300" />
            <span>{msg.orchestration.label}</span>
            <button onClick={onOpenOffice} className="ml-auto flex items-center gap-1 text-xs text-indigo-200 hover:text-white">
              Xem văn phòng <IconExternal size={12} />
            </button>
          </div>
        )}
        {msg.code && <CodeBlock code={msg.code} minimal={compact} />}
        {msg.media && !compact && <MediaPreview media={msg.media} />}
      </div>
    </article>
  );
}

export function ChatPanel(props: ChatPanelProps) {
  const { title, messages, mode, autoOrchestrated, connectedAgents, onSend, onToggle3D, onOpenOffice } = props;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  return (
    <section className="flex min-w-0 flex-1 flex-col border-r border-hq-border">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-hq-border px-4">
        <IconCube size={16} className="text-hq-muted" />
        <h1 className="font-semibold">{title}</h1>
        {autoOrchestrated && (
          <span className="rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-300">
            ⚡ Tự động điều phối
          </span>
        )}
        <button className="ml-auto text-hq-muted hover:text-hq-text" aria-label="Thêm">
          <IconDots size={18} />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {messages.map((m) => (
            <MessageItem key={m.id} msg={m} compact={false} onOpenOffice={onOpenOffice} />
          ))}
        </div>
      </div>

      <footer className="shrink-0 px-5 pb-3">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-hq-muted">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400" />
            <span className="text-hq-text">{connectedAgents.length} agent đã kết nối</span>
          </div>
          <SmartInputBar mode={mode} onToggle3D={onToggle3D} onSend={onSend} agents={connectedAgents} />
        </div>
      </footer>
    </section>
  );
}
