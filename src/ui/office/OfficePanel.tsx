import { useState } from 'react';
import type { VisualOfficeEvent } from '@shared/types';
import { IsometricOffice, type OfficePan } from './IsometricOffice';
import { IconExpand, IconMinus, IconPlus, IconTarget, IconX } from '../icons';

interface OfficePanelProps {
  events: VisualOfficeEvent[];
  highlightCode: string | null;
  onSelectCode: (code: string) => void;
  onClose: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}

export function OfficePanel({ events, highlightCode, onSelectCode, onClose, expanded, onToggleExpand }: OfficePanelProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<OfficePan>([0, 0]);
  const busy = events.filter((e) => e.animation_state === 'TYPING' || e.animation_state === 'THINKING').length;

  const ctl = 'grid h-7 w-7 place-items-center rounded-md text-hq-muted transition hover:bg-white/10 hover:text-hq-text';

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-hq-border bg-hq-panel">
      <header className="flex items-center gap-2 px-4 pt-3">
        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400" />
        <h2 className="font-semibold">Văn phòng 3D</h2>
        <span className="text-[11px] text-hq-muted">{busy} agent đang làm việc</span>
        <div className="ml-auto flex items-center gap-1">
          <button className={ctl} onClick={onToggleExpand} aria-label={expanded ? 'Thu nhỏ' : 'Phóng to'}>
            <IconExpand size={14} />
          </button>
          <button className={ctl} onClick={onClose} aria-label="Đóng 3D">
            <IconX size={15} />
          </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <IsometricOffice
          events={events}
          highlightCode={highlightCode}
          onSelectCode={onSelectCode}
          zoom={zoom}
          onZoomChange={setZoom}
          pan={pan}
          onPanChange={setPan}
        />
        <div className="absolute right-3 top-3 flex flex-col gap-1 rounded-lg border border-hq-border bg-hq-bg/80 p-1 backdrop-blur">
          <button className={ctl} onClick={() => { setZoom(1); setPan([0, 0]); }} aria-label="Căn giữa">
            <IconTarget size={14} />
          </button>
          <button className={ctl} onClick={() => setZoom((z) => Math.min(2.5, z * 1.2))} aria-label="Phóng to">
            <IconPlus size={14} />
          </button>
          <button className={ctl} onClick={() => setZoom((z) => Math.max(0.6, z / 1.2))} aria-label="Thu nhỏ">
            <IconMinus size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
