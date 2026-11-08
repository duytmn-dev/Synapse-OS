import { useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode, type WheelEvent } from 'react';
import type { VisualOfficeEvent } from '@shared/types';
import { getAgentMeta, ROOMS, type RoomId } from '../agents';

/* ───────────────────────── Phép chiếu isometric ───────────────────────── */

const S = 28; // kích thước 1 ô sàn (px)
const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;

export type P = [number, number];
/** (x: hướng xuống-phải, y: hướng xuống-trái, z: độ cao) → toạ độ màn hình */
export const iso = (x: number, y: number, z = 0): P => [(x - y) * S * COS, (x + y) * S * SIN - z * S];
const pts = (...p: P[]) => p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Bố cục Văn phòng có HÀNH LANG TRUNG TÂM tách biệt 2 dãy phòng
 * Trục hành lang chạy từ y=0.2 đến y=9.8 ở khoảng x = 4.2 đến 5.6
 */
const ROOM_LAYOUT: Record<RoomId, Rect> = {
  // Dãy phòng bên trái (Left wing)
  CODEX: { x0: 0.2, y0: 0.2, x1: 4.2, y1: 4.0 },
  GEMINI_AGY: { x0: 0.2, y0: 4.6, x1: 4.2, y1: 9.8 },
  // Dãy phòng bên phải (Right wing)
  MANAGER: { x0: 5.6, y0: 0.2, x1: 9.8, y1: 4.0 },
  CHATGPT: { x0: 5.6, y0: 4.6, x1: 9.8, y1: 7.2 },
  CLAUDE_EXT: { x0: 5.6, y0: 7.5, x1: 9.8, y1: 9.8 },
};

const ROOM_ORDER: RoomId[] = ['CODEX', 'MANAGER', 'GEMINI_AGY', 'CHATGPT', 'CLAUDE_EXT'];

/** Vị trí cửa phòng mở hướng trực tiếp ra Hành lang trung tâm */
const ROOM_DOORS: Record<RoomId, { doorX: number; doorY: number; corridorY: number }> = {
  CODEX: { doorX: 4.2, doorY: 2.2, corridorY: 2.2 },
  GEMINI_AGY: { doorX: 4.2, doorY: 6.8, corridorY: 6.8 },
  MANAGER: { doorX: 5.6, doorY: 2.2, corridorY: 2.2 },
  CHATGPT: { doorX: 5.6, doorY: 5.8, corridorY: 5.8 },
  CLAUDE_EXT: { doorX: 5.6, doorY: 8.6, corridorY: 8.6 },
};

/** Tên model mặc định nếu backend chưa gửi worker_model_name */
const DEFAULT_ROOM_MODELS: Record<RoomId, string> = {
  MANAGER: 'Triage Router',
  CODEX: 'GPT-6.1 Sol',
  GEMINI_AGY: 'Gemini 3.8 Flash',
  CHATGPT: 'GPT-6',
  CLAUDE_EXT: 'Claude 5.5',
};

interface Desk {
  x: number;
  y: number;
  w: number;
  d: number;
}

function deskFor(room: Rect, index: number): Desk {
  const W = room.x1 - room.x0;
  const cols = W >= 4.5 ? 3 : 2;
  const slot = (W - 0.5) / cols;
  const w = Math.min(1.3, slot - 0.3);
  const col = index % cols;
  const row = Math.floor(index / cols);
  return { x: room.x0 + 0.3 + col * slot + (slot - w) / 2, y: room.y0 + 1.2 + row * 1.6, w, d: 0.58 };
}

/* ───────────────────────── Primitive 3D ───────────────────────── */

function Box({
  x,
  y,
  z = 0,
  w,
  d,
  h,
  top,
  left,
  right,
  stroke = 'rgba(0,0,0,.35)',
}: {
  x: number;
  y: number;
  z?: number;
  w: number;
  d: number;
  h: number;
  top: string;
  left: string;
  right: string;
  stroke?: string;
}) {
  const zt = z + h;
  return (
    <g stroke={stroke} strokeWidth={0.6} strokeLinejoin="round">
      <polygon points={pts(iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, zt), iso(x, y + d, zt))} fill={left} />
      <polygon points={pts(iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, zt), iso(x + w, y, zt))} fill={right} />
      <polygon points={pts(iso(x, y, zt), iso(x + w, y, zt), iso(x + w, y + d, zt), iso(x, y + d, zt))} fill={top} />
    </g>
  );
}

/* ───────────────────────── Huy hiệu Task + Tên Model thật ───────────────────────── */

function FloatingIdentityBadge({
  taskCode,
  modelName,
  color,
  x,
  y,
  highlighted,
}: {
  taskCode?: string | null;
  modelName: string;
  color: string;
  x: number;
  y: number;
  highlighted: boolean;
}) {
  const hasCode = !!taskCode;
  const modelText = modelName;
  const modelWidth = Math.max(38, modelText.length * 5.8 + 10);
  const codeWidth = hasCode ? Math.max(22, taskCode.length * 7 + 10) : 0;
  const totalWidth = hasCode ? codeWidth + modelWidth + 2 : modelWidth;

  return (
    <g transform={`translate(${x},${y})`} className="office-badge">
      <path d="M-3,-1 L0,3 L3,-1 Z" fill={color} />
      <rect
        x={-totalWidth / 2}
        y={-17}
        width={totalWidth}
        height={16}
        rx={8}
        fill="#0b1220f0"
        stroke={color}
        strokeWidth={highlighted ? 2.4 : 1.3}
        style={highlighted ? { filter: `drop-shadow(0 0 6px ${color})` } : undefined}
      />
      {hasCode && (
        <>
          <rect
            x={-totalWidth / 2 + 1}
            y={-16}
            width={codeWidth}
            height={14}
            rx={7}
            fill={`${color}30`}
          />
          <text
            x={-totalWidth / 2 + codeWidth / 2}
            y={-6}
            textAnchor="middle"
            fontSize={9}
            fontWeight={800}
            fill="#ffffff"
            fontFamily="Inter, system-ui, sans-serif"
          >
            {taskCode}
          </text>
        </>
      )}
      <text
        x={hasCode ? -totalWidth / 2 + codeWidth + modelWidth / 2 + 1 : 0}
        y={-6}
        textAnchor="middle"
        fontSize={8.5}
        fontWeight={600}
        fill={hasCode ? '#e2e8f0' : color}
        fontFamily="Inter, system-ui, sans-serif"
      >
        {modelText}
      </text>
    </g>
  );
}

function Character({
  ev,
  desk,
  color,
  highlighted,
  onSelect,
}: {
  ev: VisualOfficeEvent;
  desk: Desk;
  color: string;
  highlighted: boolean;
  onSelect?: (code: string) => void;
}) {
  const [cx, cy] = iso(desk.x + desk.w / 2, desk.y - 0.25, 0);
  const anim = ev.animation_state;
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
      <ellipse cx={cx} cy={cy + 2} rx={9} ry={4.5} fill="#1e293b" />
      <g className={anim === 'TYPING' ? 'office-typing' : anim === 'THINKING' ? 'office-thinking' : undefined}>
        <path d={`M${cx - 7},${cy} Q${cx - 7},${cy - 17} ${cx},${cy - 17} Q${cx + 7},${cy - 17} ${cx + 7},${cy} Z`} fill={body} />
        <circle cx={cx} cy={cy - 23} r={6} fill="#f2c9a0" />
        <path d={`M${cx - 6},${cy - 24} Q${cx},${cy - 33} ${cx + 6},${cy - 24} Q${cx},${cy - 27} ${cx - 6},${cy - 24}`} fill="#3b2a20" />
      </g>

      {anim === 'THINKING' && (
        <g className="office-bubble">
          <circle cx={cx + 9} cy={cy - 31} r={1.6} fill="#e2e8f0" />
          <rect x={cx + 10} y={cy - 45} width={20} height={11} rx={5.5} fill="#e2e8f0" />
          <text x={cx + 20} y={cy - 37} textAnchor="middle" fontSize={9} fontWeight={700} fill="#0b1220">
            …
          </text>
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

function DeskWithMonitor({ desk, color, state }: { desk: Desk; color: string; state: VisualOfficeEvent['animation_state'] | null }) {
  const on = state === 'TYPING' || state === 'THINKING';
  const mx = desk.x + desk.w / 2 - 0.35;
  const my = desk.y + 0.12;
  const z0 = 0.42;
  return (
    <g>
      <Box x={desk.x} y={desk.y} w={desk.w} d={desk.d} h={0.42} top="#3a4a63" left="#243248" right="#1c2738" />
      <polygon
        points={pts(iso(mx, my, z0), iso(mx + 0.7, my, z0), iso(mx + 0.7, my, z0 + 0.45), iso(mx, my, z0 + 0.45))}
        fill="#0f172a"
        stroke="#475569"
        strokeWidth={0.6}
      />
      <polygon
        points={pts(
          iso(mx + 0.05, my + 0.01, z0 + 0.05),
          iso(mx + 0.65, my + 0.01, z0 + 0.05),
          iso(mx + 0.65, my + 0.01, z0 + 0.4),
          iso(mx + 0.05, my + 0.01, z0 + 0.4)
        )}
        fill={on ? color : state === 'DONE' ? '#14532d' : '#111827'}
        opacity={on ? 0.85 : 0.9}
        className={state === 'TYPING' ? 'office-screen' : undefined}
      />
    </g>
  );
}

function RoomLabel({ room, rect, active, isConnected }: { room: RoomId; rect: Rect; active: boolean; isConnected: boolean }) {
  const meta = ROOMS[room];
  const agent = getAgentMeta(meta.agent);
  const [x, y] = iso((rect.x0 + rect.x1) / 2, rect.y1 - 0.45, 0);
  const text = meta.label;
  const w = text.length * 6.4 + 30;
  const h = meta.subLabel ? 26 : 18;

  if (!isConnected) {
    return (
      <g transform={`translate(${x},${y})`} opacity={0.4} style={{ pointerEvents: 'none' }}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} fill="#0b122099" stroke="#475569" strokeWidth={0.8} />
        <text x={0} y={3.5} textAnchor="middle" fontSize={8.5} fill="#94a3b8" fontFamily="Inter, system-ui, sans-serif">
          {text} (Chưa kết nối)
        </text>
      </g>
    );
  }

  return (
    <g transform={`translate(${x},${y})`} style={{ pointerEvents: 'none' }}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} fill="#0b1220e6" stroke={agent.color} strokeWidth={active ? 1.4 : 0.8} />
      <text x={-w / 2 + 9} y={meta.subLabel ? -1 : 3.5} fontSize={9} fill={agent.color} fontFamily="Inter, system-ui, sans-serif">
        {agent.glyph.length > 1 ? '◇' : agent.glyph}
      </text>
      <text
        x={-w / 2 + 21}
        y={meta.subLabel ? -1 : 3.5}
        fontSize={9}
        fontWeight={700}
        fill="#e5e9f0"
        letterSpacing={0.6}
        fontFamily="Inter, system-ui, sans-serif"
      >
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

/* ───────────────────────── Tia sáng giao việc (Light Trail) ───────────────────────── */

interface LightTrailProps {
  targetRoom: RoomId;
  deskIndex: number;
  color: string;
}

function LightTrail({ targetRoom, deskIndex, color }: LightTrailProps) {
  if (targetRoom === 'MANAGER') return null;

  // Điểm xuất phát: Bàn làm việc của phòng Quản lý
  const mgrDesk = deskFor(ROOM_LAYOUT.MANAGER, 0);
  const startP = iso(mgrDesk.x + mgrDesk.w / 2, mgrDesk.y + 0.2, 0.4);

  // Điểm ra khỏi cửa phòng Quản lý
  const mgrDoorP = iso(ROOM_DOORS.MANAGER.doorX, ROOM_DOORS.MANAGER.doorY, 0.05);

  // Điểm vào tim Hành lang trung tâm
  const corridorX = 4.9;
  const spineStartP = iso(corridorX, ROOM_DOORS.MANAGER.corridorY, 0.05);

  // Điểm chạy dọc hành lang tới cửa phòng đích
  const targetDoorConfig = ROOM_DOORS[targetRoom];
  const spineTargetP = iso(corridorX, targetDoorConfig.corridorY, 0.05);
  const targetDoorP = iso(targetDoorConfig.doorX, targetDoorConfig.doorY, 0.05);

  // Điểm đích: Bàn của nhân vật đang làm task
  const targetDesk = deskFor(ROOM_LAYOUT[targetRoom], deskIndex);
  const targetDeskP = iso(targetDesk.x + targetDesk.w / 2, targetDesk.y + 0.2, 0.4);

  const pointsArray = [startP, mgrDoorP, spineStartP, spineTargetP, targetDoorP, targetDeskP];
  const pathData = pointsArray.map(([px, py], idx) => `${idx === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');

  return (
    <g>
      {/* Tia laser mờ nền */}
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth={3.5}
        strokeOpacity={0.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Luồng xung sáng chạy liên tục */}
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="office-light-trail"
        style={{ filter: `drop-shadow(0 0 5px ${color})` }}
      />
      {/* Viên sáng Data Orb di chuyển ở đầu bàn làm việc */}
      <circle
        cx={targetDeskP[0]}
        cy={targetDeskP[1]}
        r={3.5}
        fill="#ffffff"
        stroke={color}
        strokeWidth={1.5}
        className="animate-ping"
      />
      <circle
        cx={targetDeskP[0]}
        cy={targetDeskP[1]}
        r={3}
        fill={color}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
    </g>
  );
}

/* ───────────────────────── Scene ───────────────────────── */

export type OfficePan = P;

interface IsometricOfficeProps {
  events: VisualOfficeEvent[];
  activeRooms?: RoomId[];
  highlightCode?: string | null;
  onSelectCode?: (code: string) => void;
  zoom: number;
  onZoomChange: (z: number) => void;
  pan: P;
  onPanChange: (p: P) => void;
  enableLightTrails?: boolean;
}

export function IsometricOffice({
  events,
  activeRooms = ['MANAGER', 'CODEX', 'GEMINI_AGY', 'CHATGPT'],
  highlightCode,
  onSelectCode,
  zoom,
  onZoomChange,
  pan,
  onPanChange,
  enableLightTrails = true,
}: IsometricOfficeProps) {
  const drag = useRef<{ start: P; pan: P } | null>(null);
  const [dragging, setDragging] = useState(false);

  const byDesk = useMemo(() => {
    const m = new Map<string, VisualOfficeEvent>();
    for (const e of events) m.set(`${e.room_id}#${e.desk_index}`, e);
    return m;
  }, [events]);

  const activeSet = useMemo(() => new Set<RoomId>(['MANAGER', ...activeRooms]), [activeRooms]);

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
      {[1, 3, 5.5, 7.5].map((t) => (
        <polygon key={`wx${t}`} points={pts(iso(t, 0, 0.55), iso(t + 1.4, 0, 0.55), iso(t + 1.4, 0, 1.25), iso(t, 0, 1.25))} fill="#38bdf81f" stroke="#38bdf833" strokeWidth={0.6} />
      ))}
      {[1, 6].map((t) => (
        <polygon key={`wy${t}`} points={pts(iso(0, t, 0.55), iso(0, t + 2, 0.55), iso(0, t + 2, 1.25), iso(0, t, 1.25))} fill="#38bdf81a" stroke="#38bdf833" strokeWidth={0.6} />
      ))}
    </g>
  );

  // Tìm các sự kiện đang hoạt động để bắn tia sáng (Light Trail)
  const activeWorkingEvents = useMemo(() => {
    return events.filter(
      (e) =>
        e.room_id !== 'MANAGER' &&
        activeSet.has(e.room_id) &&
        (e.animation_state === 'TYPING' || e.animation_state === 'THINKING' || !!e.active_task_code)
    );
  }, [events, activeSet]);

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
        {/* Đế sàn chung */}
        <polygon points={pts(iso(0, 10, 0), iso(10, 10, 0), iso(10, 10, -0.35), iso(0, 10, -0.35))} fill="#0e1626" stroke="#1f2a3d" />
        <polygon points={pts(iso(10, 0, 0), iso(10, 10, 0), iso(10, 10, -0.35), iso(10, 0, -0.35))} fill="#0a111e" stroke="#1f2a3d" />
        <polygon points={pts(iso(0, 0), iso(10, 0), iso(10, 10), iso(0, 10))} fill="#111a2b" />
        {backWalls}

        {/* ──────── 1. HÀNH LANG TRUNG TÂM (CENTRAL DATA CORRIDOR) ──────── */}
        <g id="central-corridor">
          {/* Mặt sàn hành lang dọc giữa 2 dãy phòng (x: 4.2 -> 5.6, y: 0.2 -> 9.8) */}
          <polygon
            points={pts(iso(4.2, 0.2), iso(5.6, 0.2), iso(5.6, 9.8), iso(4.2, 9.8))}
            fill="#0b1526"
            stroke="#1e3a5f"
            strokeWidth={0.8}
          />
          {/* Lối giao cắt ngang giữa phòng Quản lý và Codex */}
          <polygon
            points={pts(iso(2.0, 4.0), iso(7.5, 4.0), iso(7.5, 4.6), iso(2.0, 4.6))}
            fill="#091322"
            stroke="#1b3050"
            strokeWidth={0.6}
          />
          {/* Rãnh LED sáng chạy dọc trung tâm hành lang */}
          <polyline
            points={pts(iso(4.9, 0.4), iso(4.9, 9.6))}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            strokeOpacity={0.7}
            style={{ filter: 'drop-shadow(0 0 4px #38bdf8)' }}
          />
          {/* Vạch ranh giới cửa các phòng hướng vào hành lang */}
          {ROOM_ORDER.map((id) => {
            const door = ROOM_DOORS[id];
            const isLeft = door.doorX < 4.9;
            const x0 = isLeft ? 4.2 : 5.6;
            const x1 = isLeft ? 4.6 : 5.2;
            return (
              <line
                key={`door-thresh-${id}`}
                x1={iso(x0, door.doorY)[0]}
                y1={iso(x0, door.doorY)[1]}
                x2={iso(x1, door.doorY)[0]}
                y2={iso(x1, door.doorY)[1]}
                stroke={activeSet.has(id) ? getAgentMeta(ROOMS[id].agent).color : '#334155'}
                strokeWidth={1.6}
                strokeOpacity={activeSet.has(id) ? 0.9 : 0.4}
              />
            );
          })}
        </g>

        {/* ──────── 2. SÀN CÁC PHÒNG (THEO TRẠNG THÁI ACTIVE_ROOMS) ──────── */}
        {ROOM_ORDER.map((id) => {
          const r = ROOM_LAYOUT[id];
          const isConnected = activeSet.has(id);
          const c = getAgentMeta(ROOMS[id].agent).color;
          const g = 0.05;

          if (!isConnected) {
            // Phòng chưa kết nối: vẽ khung lưới mờ (chìm xuống / bóng tối)
            return (
              <g key={`floor-unconnected-${id}`} opacity={0.35}>
                <polygon
                  points={pts(iso(r.x0 + g, r.y0 + g), iso(r.x1 - g, r.y0 + g), iso(r.x1 - g, r.y1 - g), iso(r.x0 + g, r.y1 - g))}
                  fill="#060b14"
                  stroke="#1e293b"
                  strokeWidth={0.8}
                  strokeDasharray="3 3"
                />
              </g>
            );
          }

          // Phòng đã kết nối: Sàn phát sáng neon màu thương hiệu
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

        {/* ──────── 3. VÁCH KÍNH + BÀN + NHÂN VẬT ──────── */}
        {ROOM_ORDER.map((id) => {
          const r = ROOM_LAYOUT[id];
          const isConnected = activeSet.has(id);
          const c = getAgentMeta(ROOMS[id].agent).color;

          if (!isConnected) {
            return null; // Không vẽ nhân vật và bàn nếu phòng chưa kết nối
          }

          const items = [0, 1, 2]
            .map((i) => ({ i, desk: deskFor(r, i), ev: byDesk.get(`${id}#${i}`) ?? null }))
            .sort((a, b) => a.desk.x + a.desk.y - (b.desk.x + b.desk.y));

          return (
            <g key={`room-content-${id}`}>
              {/* Vách kính phòng */}
              {r.x0 > 0.5 && (
                <polygon points={pts(iso(r.x0, r.y0, 0), iso(r.x0, r.y1, 0), iso(r.x0, r.y1, 0.45), iso(r.x0, r.y0, 0.45))} fill={`${c}14`} stroke={`${c}55`} strokeWidth={0.6} />
              )}
              {r.y0 > 0.5 && (
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

        {/* ──────── 4. TIA SÁNG GIAO VIỆC DỌC HÀNH LANG (LIGHT TRAILS) ──────── */}
        {enableLightTrails &&
          activeWorkingEvents.map((ev) => {
            const agentMeta = getAgentMeta(ROOMS[ev.room_id].agent);
            return (
              <LightTrail
                key={`trail-${ev.room_id}-${ev.desk_index}`}
                targetRoom={ev.room_id}
                deskIndex={ev.desk_index}
                color={agentMeta.color}
              />
            );
          })}

        {/* ──────── 5. HUY HIỆU TASK + TÊN MODEL THẬT NỔI TRÊN ĐẦU NHÂN VẬT ──────── */}
        {events
          .filter((e) => activeSet.has(e.room_id) && (e.active_task_code || e.animation_state === 'TYPING' || e.animation_state === 'THINKING'))
          .map((e) => {
            const desk = deskFor(ROOM_LAYOUT[e.room_id], e.desk_index);
            const [cx, cy] = iso(desk.x + desk.w / 2, desk.y - 0.25, 0);
            const c = getAgentMeta(ROOMS[e.room_id].agent).color;
            const modelName = e.worker_model_name || DEFAULT_ROOM_MODELS[e.room_id];

            return (
              <g
                key={`badge-${e.room_id}-${e.desk_index}`}
                onClick={() => e.active_task_code && onSelectCode?.(e.active_task_code)}
                style={{ cursor: e.active_task_code ? 'pointer' : 'default' }}
              >
                <FloatingIdentityBadge
                  taskCode={e.active_task_code}
                  modelName={modelName}
                  color={c}
                  x={cx}
                  y={cy - 34}
                  highlighted={highlightCode === e.active_task_code}
                />
              </g>
            );
          })}

        {/* ──────── 6. BIỂN TÊN PHÒNG ──────── */}
        {ROOM_ORDER.map((id) => (
          <RoomLabel
            key={`label-${id}`}
            room={id}
            rect={ROOM_LAYOUT[id]}
            active={events.some((e) => e.room_id === id && e.animation_state !== 'IDLE')}
            isConnected={activeSet.has(id)}
          />
        ))}
      </g>
    </svg>
  );
}
