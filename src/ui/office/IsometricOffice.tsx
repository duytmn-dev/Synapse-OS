import { useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode, type WheelEvent } from 'react';
import type { VisualOfficeEvent } from '@shared/types';
import { getAgentMeta, ROOMS, type RoomId } from '../agents';

/* ───────────────────────── Phép chiếu isometric ───────────────────────── */

const S = 28; // kích thước 1 ô sàn (px)
const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;

type P = [number, number];
/** (x: hướng xuống-phải, y: hướng xuống-trái, z: độ cao) → toạ độ màn hình */
const iso = (x: number, y: number, z = 0): P => [(x - y) * S * COS, (x + y) * S * SIN - z * S];
const pts = (...p: P[]) => p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Bố cục 5 phòng trên sàn 10×10 (theo design_reference.png). */
const ROOM_LAYOUT: Record<RoomId, Rect> = {
  CODEX: { x0: 0, y0: 0, x1: 4, y1: 4 },
  MANAGER: { x0: 4, y0: 0, x1: 10, y1: 4 },
  GEMINI_AGY: { x0: 0, y0: 4, x1: 5, y1: 10 },
  CHATGPT: { x0: 5, y0: 4, x1: 10, y1: 7 },
  CLAUDE_EXT: { x0: 5, y0: 7, x1: 10, y1: 10 },
};
const ROOM_ORDER: RoomId[] = ['CODEX', 'MANAGER', 'GEMINI_AGY', 'CHATGPT', 'CLAUDE_EXT'];

interface Desk {
  x: number;
  y: number;
  w: number;
  d: number;
}

function deskFor(room: Rect, index: number): Desk {
  const W = room.x1 - room.x0;
  const cols = W >= 5 ? 3 : 2;
  const slot = (W - 0.6) / cols;
  const w = Math.min(1.4, slot - 0.4);
  const col = index % cols;
  const row = Math.floor(index / cols);
  return { x: room.x0 + 0.3 + col * slot + (slot - w) / 2, y: room.y0 + 1.2 + row * 1.7, w, d: 0.6 };
}

/* ───────────────────────── Primitive 3D ───────────────────────── */

function Box({ x, y, z = 0, w, d, h, top, left, right, stroke = 'rgba(0,0,0,.35)' }: {
  x: number; y: number; z?: number; w: number; d: number; h: number;
  top: string; left: string; right: string; stroke?: string;
}) {
  const zt = z + h;
  return (
    <g stroke={stroke} strokeWidth={0.6} strokeLinejoin="round">
      {/* mặt trái (y = y + d) */}
      <polygon points={pts(iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, zt), iso(x, y + d, zt))} fill={left} />
      {/* mặt phải (x = x + w) */}
      <polygon points={pts(iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, zt), iso(x + w, y, zt))} fill={right} />
      {/* mặt trên */}
      <polygon points={pts(iso(x, y, zt), iso(x + w, y, zt), iso(x + w, y + d, zt), iso(x, y + d, zt))} fill={top} />
    </g>
  );
}

/* ───────────────────────── Nhân vật & Huy hiệu ───────────────────────── */

type Anim = VisualOfficeEvent['animation_state'];

function TaskBadge({ code, color, x, y, highlighted }: { code: string; color: string; x: number; y: number; highlighted: boolean }) {
  const w = Math.max(22, code.length * 7 + 12);
  return (
    <g transform={`translate(${x},${y})`} className="office-badge">
      <path d={`M-4,-2 L0,4 L4,-2 Z`} fill={color} />
      <rect
        x={-w / 2} y={-18} width={w} height={16} rx={8}
        fill="#0b1220" stroke={color} strokeWidth={highlighted ? 2.2 : 1.4}
        style={highlighted ? { filter: `drop-shadow(0 0 6px ${color})` } : undefined}
      />
      <text x={0} y={-6.5} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#fff" fontFamily="Inter, system-ui, sans-serif">
        {code}
      </text>
    </g>
  );
}

function Character({ ev, desk, color, highlighted, onSelect }: {
  ev: VisualOfficeEvent; desk: Desk; color: string; highlighted: boolean; onSelect?: (code: string) => void;
}) {
  // Nhân vật ngồi phía sau bàn, quay mặt về phía người xem.
  const [cx, cy] = iso(desk.x + desk.w / 2, desk.y - 0.25, 0);
  const anim: Anim = ev.animation_state;
  const idle = anim === 'IDLE';
  const body = idle ? '#475569' : color;
  const code = ev.active_task_code;

  return (
    <g
      opacity={idle ? 0.55 : 1}
      onClick={() => code && onSelect?.(code)}
      style={{ cursor: code ? 'pointer' : 'default', filter: highlighted ? `drop-shadow(0 0 5px ${color})` : undefined }}
    >
      <title>
        {ROOMS[ev.room_id].label} · bàn {ev.desk_index + 1} · {anim}
        {code ? ` · task ${code}` : ''}
      </title>
      {/* ghế */}
      <ellipse cx={cx} cy={cy + 2} rx={9} ry={4.5} fill="#1e293b" />
      <g className={anim === 'TYPING' ? 'office-typing' : anim === 'THINKING' ? 'office-thinking' : undefined}>
        {/* thân */}
        <path d={`M${cx - 7},${cy} Q${cx - 7},${cy - 17} ${cx},${cy - 17} Q${cx + 7},${cy - 17} ${cx + 7},${cy} Z`} fill={body} />
        {/* đầu */}
        <circle cx={cx} cy={cy - 23} r={6} fill="#f2c9a0" />
        <path d={`M${cx - 6},${cy - 24} Q${cx},${cy - 33} ${cx + 6},${cy - 24} Q${cx},${cy - 27} ${cx - 6},${cy - 24}`} fill="#3b2a20" />
      </g>

      {anim === 'THINKING' && (
        <g className="office-bubble">
          <circle cx={cx + 9} cy={cy - 31} r={1.6} fill="#e2e8f0" />
          <rect x={cx + 10} y={cy - 45} width={20} height={11} rx={5.5} fill="#e2e8f0" />
          <text x={cx + 20} y={cy - 37} textAnchor="middle" fontSize={9} fontWeight={700} fill="#0b1220">…</text>
        </g>
      )}
      {anim === 'DONE' && (
        <g transform={`translate(${cx + (code ? 15 : 9)},${cy - 39})`}>
          <circle r={5} fill="#22c55e" />
          <path d="M-2.3,0 L-0.5,1.8 L2.5,-1.6" stroke="#0b1220" strokeWidth={1.5} fill="none" />
        </g>
      )}
    </g>
  );
}

function DeskWithMonitor({ desk, color, state }: { desk: Desk; color: string; state: Anim | null }) {
  const on = state === 'TYPING' || state === 'THINKING';
  const mx = desk.x + desk.w / 2 - 0.35;
  const my = desk.y + 0.12;
  const z0 = 0.42;
  return (
    <g>
      <Box x={desk.x} y={desk.y} w={desk.w} d={desk.d} h={0.42} top="#3a4a63" left="#243248" right="#1c2738" />
      {/* màn hình (mặt đứng hướng về nhân vật phía sau) */}
      <polygon
        points={pts(iso(mx, my, z0), iso(mx + 0.7, my, z0), iso(mx + 0.7, my, z0 + 0.45), iso(mx, my, z0 + 0.45))}
        fill="#0f172a" stroke="#475569" strokeWidth={0.6}
      />
      <polygon
        points={pts(iso(mx + 0.05, my + 0.01, z0 + 0.05), iso(mx + 0.65, my + 0.01, z0 + 0.05), iso(mx + 0.65, my + 0.01, z0 + 0.4), iso(mx + 0.05, my + 0.01, z0 + 0.4))}
        fill={on ? color : state === 'DONE' ? '#14532d' : '#111827'}
        opacity={on ? 0.85 : 0.9}
        className={state === 'TYPING' ? 'office-screen' : undefined}
      />
    </g>
  );
}

function RoomLabel({ room, rect, active }: { room: RoomId; rect: Rect; active: boolean }) {
  const meta = ROOMS[room];
  const agent = getAgentMeta(meta.agent);
  const [x, y] = iso((rect.x0 + rect.x1) / 2, rect.y1 - 0.45, 0);
  const text = meta.label;
  const w = text.length * 6.4 + 30;
  const h = meta.subLabel ? 26 : 18;
  return (
    <g transform={`translate(${x},${y})`} style={{ pointerEvents: 'none' }}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} fill="#0b1220e6" stroke={agent.color} strokeWidth={active ? 1.4 : 0.8} />
      <text x={-w / 2 + 9} y={meta.subLabel ? -1 : 3.5} fontSize={9} fill={agent.color} fontFamily="Inter, system-ui, sans-serif">
        {agent.glyph.length > 1 ? '◇' : agent.glyph}
      </text>
      <text x={-w / 2 + 21} y={meta.subLabel ? -1 : 3.5} fontSize={9} fontWeight={700} fill="#e5e9f0" letterSpacing={0.6} fontFamily="Inter, system-ui, sans-serif">
        {text}
      </text>
      {meta.subLabel && (
        <text x={-w / 2 + 21} y={9} fontSize={7} fill="#8a94a7" fontFamily="Inter, system-ui, sans-serif">
          {meta.subLabel}
        </text>
      )}
    </g>
  );
}

/* ───────────────────────── Scene ───────────────────────── */

export type OfficePan = P;

interface IsometricOfficeProps {
  events: VisualOfficeEvent[];
  highlightCode?: string | null;
  onSelectCode?: (code: string) => void;
  zoom: number;
  onZoomChange: (z: number) => void;
  pan: P;
  onPanChange: (p: P) => void;
}

export function IsometricOffice({ events, highlightCode, onSelectCode, zoom, onZoomChange, pan, onPanChange }: IsometricOfficeProps) {
  const drag = useRef<{ start: P; pan: P } | null>(null);
  const [dragging, setDragging] = useState(false);

  const byDesk = useMemo(() => {
    const m = new Map<string, VisualOfficeEvent>();
    for (const e of events) m.set(`${e.room_id}#${e.desk_index}`, e);
    return m;
  }, [events]);

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    drag.current = { start: [e.clientX, e.clientY], pan };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const k = 500 / e.currentTarget.clientWidth / zoom;
    onPanChange([drag.current.pan[0] + (e.clientX - drag.current.start[0]) * k, drag.current.pan[1] + (e.clientY - drag.current.start[1]) * k]);
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };
  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    onZoomChange(Math.min(2.5, Math.max(0.6, zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))));
  };

  // Tường bao phía sau
  const WALL_H = 1.5;
  const backWalls: ReactNode = (
    <g>
      <polygon points={pts(iso(0, 0, 0), iso(0, 10, 0), iso(0, 10, WALL_H), iso(0, 0, WALL_H))} fill="#152036" stroke="#22314d" strokeWidth={0.8} />
      <polygon points={pts(iso(0, 0, 0), iso(10, 0, 0), iso(10, 0, WALL_H), iso(0, 0, WALL_H))} fill="#1a2740" stroke="#22314d" strokeWidth={0.8} />
      {/* cửa sổ */}
      {[1, 3, 5.5, 7.5].map((t) => (
        <polygon key={`wx${t}`} points={pts(iso(t, 0, 0.55), iso(t + 1.4, 0, 0.55), iso(t + 1.4, 0, 1.25), iso(t, 0, 1.25))} fill="#38bdf81f" stroke="#38bdf833" strokeWidth={0.6} />
      ))}
      {[1, 6].map((t) => (
        <polygon key={`wy${t}`} points={pts(iso(0, t, 0.55), iso(0, t + 2, 0.55), iso(0, t + 2, 1.25), iso(0, t, 1.25))} fill="#38bdf81a" stroke="#38bdf833" strokeWidth={0.6} />
      ))}
    </g>
  );

  return (
    <svg
      viewBox="-250 -55 500 350"
      className={`h-full w-full select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onWheel={onWheel}
      role="img"
      aria-label="Văn phòng 3D isometric của các agent"
    >
      <defs>
        <radialGradient id="office-glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#1e3a5f" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#0b1220" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x={-250} y={-55} width={500} height={350} fill="url(#office-glow)" />

      <g transform={`translate(${pan[0]},${pan[1]}) scale(${zoom})`} style={{ transition: dragging ? undefined : 'transform .25s ease-out' }}>
        {/* Đế sàn */}
        <polygon points={pts(iso(0, 10, 0), iso(10, 10, 0), iso(10, 10, -0.35), iso(0, 10, -0.35))} fill="#0e1626" stroke="#1f2a3d" />
        <polygon points={pts(iso(10, 0, 0), iso(10, 10, 0), iso(10, 10, -0.35), iso(10, 0, -0.35))} fill="#0a111e" stroke="#1f2a3d" />
        <polygon points={pts(iso(0, 0), iso(10, 0), iso(10, 10), iso(0, 10))} fill="#111a2b" />
        {backWalls}

        {/* Sàn từng phòng */}
        {ROOM_ORDER.map((id) => {
          const r = ROOM_LAYOUT[id];
          const c = getAgentMeta(ROOMS[id].agent).color;
          const g = 0.08;
          return (
            <polygon
              key={`floor-${id}`}
              points={pts(iso(r.x0 + g, r.y0 + g), iso(r.x1 - g, r.y0 + g), iso(r.x1 - g, r.y1 - g), iso(r.x0 + g, r.y1 - g))}
              fill={`${c}1f`}
              stroke={`${c}66`}
              strokeWidth={1}
            />
          );
        })}

        {/* Vách kính + bàn + nhân vật, vẽ theo chiều sâu */}
        {ROOM_ORDER.map((id) => {
          const r = ROOM_LAYOUT[id];
          const c = getAgentMeta(ROOMS[id].agent).color;
          const items = [0, 1, 2]
            .map((i) => ({ i, desk: deskFor(r, i), ev: byDesk.get(`${id}#${i}`) ?? null }))
            .sort((a, b) => a.desk.x + a.desk.y - (b.desk.x + b.desk.y));
          return (
            <g key={`room-${id}`}>
              {r.x0 > 0 && (
                <polygon points={pts(iso(r.x0, r.y0, 0), iso(r.x0, r.y1, 0), iso(r.x0, r.y1, 0.45), iso(r.x0, r.y0, 0.45))} fill={`${c}14`} stroke={`${c}55`} strokeWidth={0.6} />
              )}
              {r.y0 > 0 && (
                <polygon points={pts(iso(r.x0, r.y0, 0), iso(r.x1, r.y0, 0), iso(r.x1, r.y0, 0.45), iso(r.x0, r.y0, 0.45))} fill={`${c}14`} stroke={`${c}55`} strokeWidth={0.6} />
              )}
              {items.map(({ i, desk, ev }) => (
                <g key={i}>
                  {ev && (
                    <Character
                      ev={ev}
                      desk={desk}
                      color={c}
                      highlighted={!!highlightCode && ev.active_task_code === highlightCode}
                      onSelect={onSelectCode}
                    />
                  )}
                  <DeskWithMonitor desk={desk} color={c} state={ev?.animation_state ?? null} />
                </g>
              ))}
            </g>
          );
        })}

        {/* Huy hiệu vẽ lại lớp trên cùng để không bị bàn phía trước che */}
        {events
          .filter((e) => e.active_task_code)
          .map((e) => {
            const desk = deskFor(ROOM_LAYOUT[e.room_id], e.desk_index);
            const [cx, cy] = iso(desk.x + desk.w / 2, desk.y - 0.25, 0);
            const c = getAgentMeta(ROOMS[e.room_id].agent).color;
            return (
              <g key={`badge-${e.room_id}-${e.desk_index}`} onClick={() => onSelectCode?.(e.active_task_code!)} style={{ cursor: 'pointer' }}>
                <TaskBadge code={e.active_task_code!} color={c} x={cx} y={cy - 32} highlighted={highlightCode === e.active_task_code} />
              </g>
            );
          })}

        {ROOM_ORDER.map((id) => (
          <RoomLabel
            key={`label-${id}`}
            room={id}
            rect={ROOM_LAYOUT[id]}
            active={events.some((e) => e.room_id === id && e.animation_state !== 'IDLE')}
          />
        ))}
      </g>
    </svg>
  );
}
