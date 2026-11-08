import { useState } from 'react';
import type { VisualOfficeEvent } from '@shared/types';
import { OfficeSceneController } from './OfficeSceneController';
import { IconExpand, IconMinus, IconPlus, IconTarget, IconX } from '../icons';

interface OfficePanelProps {
  events: VisualOfficeEvent[];
  activeRooms?: VisualOfficeEvent['room_id'][];
  highlightCode: string | null;
  onSelectCode: (code: string) => void;
  onClose: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  enableLightTrails?: boolean;
}

export function OfficePanel({
  events,
  highlightCode,
  onSelectCode,
  onClose,
  expanded,
  onToggleExpand,
}: OfficePanelProps) {
  const [zoomLevel, setZoomLevel] = useState(17);
  const busy = events.filter((e) => e.animation_state === 'TYPING' || e.animation_state === 'THINKING').length;

  const ctl = 'grid h-7 w-7 place-items-center rounded-md text-hq-muted transition hover:bg-white/10 hover:text-hq-text';

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-hq-border bg-hq-panel shadow-xl">
      <header className="flex items-center gap-2 px-4 pt-3 z-10">
        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400" />
        <h2 className="font-semibold text-sm">Văn phòng 3D</h2>
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
        <OfficeSceneController
          events={events}
          highlightCode={highlightCode}
          onSelectCode={onSelectCode}
          zoomLevel={zoomLevel}
        />
        <div className="absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-lg border border-hq-border bg-hq-bg/85 p-1 backdrop-blur-md shadow-lg">
          <button
            className={ctl}
            onClick={() => setZoomLevel(17)}
            aria-label="Căn giữa"
            title="Đặt lại góc nhìn chuẩn"
          >
            <IconTarget size={14} />
          </button>
          <button
            className={ctl}
            onClick={() => setZoomLevel((z) => Math.min(38, z + 3))}
            aria-label="Phóng to"
            title="Phóng to"
          >
            <IconPlus size={14} />
          </button>
          <button
            className={ctl}
            onClick={() => setZoomLevel((z) => Math.max(10, z - 3))}
            aria-label="Thu nhỏ"
            title="Thu nhỏ"
          >
            <IconMinus size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
