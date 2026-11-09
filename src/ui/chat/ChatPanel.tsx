import { useEffect, useRef } from 'react';
import type { AgentQuotaStat } from '@shared/types';
import type { ChatMessage, TargetAgent } from './types';
import { CodeBlock } from './CodeBlock';
import { MediaPreview } from './MediaPreview';
import { SmartInputBar } from './SmartInputBar';
import { IconExternal, IconFile, IconLogoHex } from '../icons';

interface ChatPanelProps {
  title: string;
  projectPathSubtitle?: string;
  messages: ChatMessage[];
  connectedAgents: AgentQuotaStat[];
  onSend: (text: string, target: TargetAgent, files: File[]) => void;
  onFocusGraph?: () => void;
}

export function ChatPanel({
  title,
  projectPathSubtitle = 'Video 360 Highlights / Chat dự án',
  messages,
  connectedAgents,
  onSend,
  onFocusGraph,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col justify-between rounded-[16px] border border-[#23344A] bg-[#0E1725] shadow-lg">
      {/* Header (01 Dashboard.svg) */}
      <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-[#23344A] px-5">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[18px] font-medium tracking-tight text-[#EAF2FF]">
            {title}
          </h1>
          <span className="text-[12.5px] text-[#9DB0C8]">
            {projectPathSubtitle}
          </span>
        </div>

        {/* Badge • Tự động điều phối */}
        <div className="flex items-center gap-2 rounded-md border border-[#23344A] bg-[#0A1220] px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FFC075]" />
          <span className="text-[11px] font-medium text-[#FFC075]">
            Tự động điều phối
          </span>
        </div>
      </header>

      {/* Message Flow Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-4 space-y-5"
      >
        {messages.map((m) => {
          if (m.author === 'user') {
            return (
              <div key={m.id} className="flex flex-col items-end gap-1.5">
                {/* Author & Time */}
                <span className="text-[12px] text-[#8297B2]">
                  {m.authorName || 'Bạn'} · {m.time}
                </span>

                {/* Message Bubble */}
                <div className="max-w-[85%] rounded-[8px] border border-[#405672] bg-[#182B43] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#EAF2FF] shadow-sm">
                  {m.text}
                </div>

                {/* File Attachment tag */}
                {m.attachments?.map((a) => (
                  <div
                    key={a.name}
                    className="flex items-center gap-2 rounded-md border border-[#23344A] bg-[#0A1220] px-3 py-1.5 text-[11px] text-[#9DB0C8]"
                  >
                    <IconFile size={13} className="text-[#9DB0C8]" />
                    <span>{a.name} · {a.sizeLabel}</span>
                  </div>
                ))}
              </div>
            );
          }

          // System / Agent message
          return (
            <div key={m.id} className="flex flex-col items-start gap-3">
              {/* Header: Logo, Name, Time */}
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#23344A] bg-[#142235]">
                  <IconLogoHex size={16} />
                </div>
                <span className="text-[13px] font-medium text-[#EAF2FF]">
                  Synapse OS
                </span>
                <span className="text-[12px] text-[#8297B2]">{m.time}</span>
              </div>

              {/* Main message text */}
              {m.text && (
                <p className="max-w-[95%] text-[13px] leading-relaxed text-[#9DB0C8]">
                  {m.text}
                </p>
              )}

              {/* Agent Running Status banner */}
              <div className="flex w-full items-center justify-between rounded-lg border border-[#405672] bg-[#142235] px-3.5 py-2 shadow-sm">
                <div className="flex items-center gap-2 text-[12px] font-medium text-[#A88BFA]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#A88BFA] shadow-[0_0_6px_#A88BFA]" />
                  <span>Gemini đang chọn khoảnh khắc</span>
                </div>
                {onFocusGraph && (
                  <button
                    type="button"
                    onClick={onFocusGraph}
                    className="flex items-center gap-1 text-[11.5px] text-[#9DB0C8] transition hover:text-[#EAF2FF]"
                  >
                    <span>Xem đồ thị</span>
                    <IconExternal size={12} />
                  </button>
                )}
              </div>

              {/* Code block if present */}
              {m.code && (
                <div className="w-full">
                  <CodeBlock code={m.code} />
                </div>
              )}

              {/* 360° Preview if present */}
              {m.media && (
                <div className="w-full">
                  <MediaPreview media={m.media} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Smart Input Bar (01 Dashboard.svg) */}
      <footer className="shrink-0 p-4 pt-1">
        <SmartInputBar onSend={onSend} agents={connectedAgents} />
      </footer>
    </section>
  );
}
