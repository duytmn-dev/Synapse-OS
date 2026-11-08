import { Suspense, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, Html, useGLTF } from '@react-three/drei';
import type { VisualOfficeEvent } from '@shared/types';
import type { RoomId } from '../agents';

/* ─────────────────────────────────────────────────────────────────────────────
 * BẢNG TỌA ĐỘ 5 PHÒNG TRONG KHÔNG GIAN 3D (Dễ dàng tinh chỉnh [x, y, z])
 * ─────────────────────────────────────────────────────────────────────────────
 * Hướng trục:
 * - X: Trục ngang (âm sang trái, dương sang phải)
 * - Y: Chiều cao tính từ sàn (tăng lên để đưa nhãn cao hơn)
 * - Z: Trục sâu (âm vào trong, dương ra phía trước)
 */

export interface RoomAnchorConfig {
  id: RoomId;
  name: string;
  glyph: string;
  color: string;
  defaultModel: string;
  /** Tọa độ [x, y, z] hiển thị Nhãn Tên Phòng lơ lửng */
  labelPosition: [number, number, number];
  /** Tọa độ [x, y, z] hiển thị Huy hiệu Task ID & Model bàn làm việc */
  deskPosition: [number, number, number];
}

export const ROOM_COORDINATES: Record<RoomId, RoomAnchorConfig> = {
  MANAGER: {
    id: 'MANAGER',
    name: 'QUẢN LÝ',
    glyph: '▣',
    color: '#f59e0b',
    defaultModel: 'GPT-6 Orchestrator',
    labelPosition: [3.3, 2.4, -1.1],
    deskPosition: [4.7, 1.8, -4.45],
  },
  CODEX: {
    id: 'CODEX',
    name: 'CODEX',
    glyph: '</>',
    color: '#38bdf8',
    defaultModel: 'GPT-6.1 Sol',
    labelPosition: [-3.3, 2.4, -2.1],
    deskPosition: [-4.8, 1.8, -4.45],
  },
  GEMINI_AGY: {
    id: 'GEMINI_AGY',
    name: 'GEMINI · Antigravity',
    glyph: '✦',
    color: '#a855f7',
    defaultModel: 'Gemini 3.8 Flash',
    labelPosition: [-3.3, 2.4, 1.7],
    deskPosition: [-4.8, 1.8, -0.65],
  },
  CHATGPT: {
    id: 'CHATGPT',
    name: 'CHATGPT',
    glyph: '❖',
    color: '#10b981',
    defaultModel: 'GPT-5.6 Sol',
    labelPosition: [3.3, 2.4, 5.8],
    deskPosition: [4.6, 1.8, 0.5],
  },
  CLAUDE_EXT: {
    id: 'CLAUDE_EXT',
    name: 'CLAUDE · CÔNG TY',
    glyph: '✺',
    color: '#ea580c',
    defaultModel: 'Claude 5.5 Sonnet',
    labelPosition: [-3.3, 2.4, 5.5],
    deskPosition: [-4.8, 1.8, 3.15],
  },
};

/* ───────────────────────── Nạp File Mô Hình 3D Thực ───────────────────────── */

// Tương thích linh hoạt cả môi trường Web (Vite dev) và Electron file://
const GLB_MODEL_PATH =
  typeof window !== 'undefined' && window.location.protocol === 'file:'
    ? './models/office_scene.glb'
    : '/models/office_scene.glb';

function OfficeModel() {
  const { scene } = useGLTF(GLB_MODEL_PATH);
  return <primitive object={scene} />;
}

// Preload mô hình để loại bỏ độ trễ khi render
useGLTF.preload(GLB_MODEL_PATH);
if (GLB_MODEL_PATH !== '/models/office_scene.glb') {
  useGLTF.preload('/models/office_scene.glb');
}

/* ───────────────────────── Lớp Nhãn HTML (Overlays) ───────────────────────── */

interface RoomOverlaysProps {
  config: RoomAnchorConfig;
  event?: VisualOfficeEvent;
  onSelectTask?: (code: string) => void;
  isHighlighted?: boolean;
}

function RoomOverlays({ config, event, onSelectTask, isHighlighted }: RoomOverlaysProps) {
  const activeTaskId = event?.active_task_code;
  const modelName = event?.worker_model_name || config.defaultModel;
  const isBusy = event?.animation_state === 'TYPING' || event?.animation_state === 'THINKING';

  return (
    <>
      {/* 1. Nhãn Tên Phòng nổi lơ lửng */}
      <Html position={config.labelPosition} center transform={false}>
        <div
          className={`flex select-none items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 font-mono text-[11px] font-bold tracking-wide shadow-2xl backdrop-blur-md transition-transform hover:scale-105 ${
            isHighlighted ? 'ring-2 ring-white scale-105' : ''
          }`}
          style={{
            background: 'rgba(9, 13, 22, 0.90)',
            border: `1.5px solid ${config.color}`,
            color: '#ffffff',
            boxShadow: `0 0 16px ${config.color}66, inset 0 0 6px ${config.color}33`,
          }}
        >
          <span style={{ color: config.color }}>{config.glyph}</span>
          <span>{config.name}</span>
          {isBusy && (
            <span
              className="inline-block h-2 w-2 rounded-full animate-pulse"
              style={{ backgroundColor: config.color }}
            />
          )}
        </div>
      </Html>

      {/* 2. Huy hiệu Task ID (B1, B2) & Tên Model gắn tại bàn làm việc */}
      {activeTaskId && (
        <Html position={config.deskPosition} center transform={false}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelectTask?.(activeTaskId);
            }}
            className="flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-0.5 shadow-2xl transition hover:scale-110 active:scale-95"
            style={{
              background: 'rgba(15, 23, 42, 0.95)',
              border: `1.5px solid ${config.color}`,
              boxShadow: `0 0 14px ${config.color}88, 0 4px 10px rgba(0,0,0,0.8)`,
            }}
            title={`Task ${activeTaskId} - Click để xem chi tiết`}
          >
            {/* Vòng tròn Task ID */}
            <span
              className="flex h-5 min-w-5 items-center justify-center rounded-full text-[10px] font-black text-white"
              style={{
                background: config.color,
                boxShadow: `0 0 8px ${config.color}`,
              }}
            >
              {activeTaskId}
            </span>

            {/* Tên Model thực tế */}
            <span className="font-mono text-[10px] font-semibold text-slate-200 pr-1 whitespace-nowrap">
              {modelName}
            </span>
          </div>
        </Html>
      )}
    </>
  );
}

/* ───────────────────────── Toàn cảnh Văn phòng 3D ───────────────────────── */

interface OfficeSceneControllerProps {
  events: VisualOfficeEvent[];
  highlightCode?: string | null;
  onSelectCode?: (code: string) => void;
  zoomLevel?: number;
}

export function OfficeSceneController({
  events,
  highlightCode,
  onSelectCode,
  zoomLevel = 17,
}: OfficeSceneControllerProps) {
  const controlsRef = useRef<any>(null);

  // Ánh xạ event ưu tiên event có task đang chạy theo từng phòng
  const eventsByRoom = useMemo(() => {
    const map = new Map<RoomId, VisualOfficeEvent>();
    for (const ev of events) {
      const existing = map.get(ev.room_id);
      if (
        !existing ||
        (ev.active_task_code && !existing.active_task_code) ||
        (ev.animation_state !== 'IDLE' && existing.animation_state === 'IDLE')
      ) {
        map.set(ev.room_id, ev);
      }
    }
    return map;
  }, [events]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#070b13]">
      <Canvas shadows gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}>
        {/* Camera Isometric Orthographic chuẩn góc nhìn bao quát toàn bộ văn phòng */}
        <OrthographicCamera
          makeDefault
          position={[20, 24, 20]}
          zoom={zoomLevel}
          near={-100}
          far={200}
        />

        {/* Hệ thống ánh sáng văn phòng sáng rõ, tôn vinh chi tiết mô hình 3D thực */}
        <ambientLight intensity={1.8} color="#ffffff" />
        <directionalLight
          position={[18, 30, 16]}
          intensity={2.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0001}
        />
        <directionalLight position={[-16, 20, -16]} intensity={1.2} color="#bae6fd" />
        <directionalLight position={[0, 20, 0]} intensity={0.8} color="#f8fafc" />

        {/* Mô hình văn phòng 3D thực (GLTF/GLB) */}
        <Suspense
          fallback={
            <Html center transform={false}>
              <div className="flex flex-col items-center gap-2 rounded-lg bg-slate-900/90 px-4 py-3 text-xs text-sky-400 border border-sky-500/30 shadow-2xl backdrop-blur-md">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                <span>Đang tải mô hình Văn phòng 3D...</span>
              </div>
            </Html>
          }
        >
          <OfficeModel />
        </Suspense>

        {/* Các nhãn Tên phòng, Task ID B1 và Tên Model */}
        {Object.values(ROOM_COORDINATES).map((cfg) => {
          const ev = eventsByRoom.get(cfg.id);
          const isHighlighted = highlightCode ? ev?.active_task_code === highlightCode : false;

          return (
            <RoomOverlays
              key={cfg.id}
              config={cfg}
              event={ev}
              onSelectTask={onSelectCode}
              isHighlighted={isHighlighted}
            />
          );
        })}

        {/* Điều khiển xoay và thu phóng Isometric mượt mà */}
        <OrbitControls
          ref={controlsRef}
          enableRotate={true}
          enablePan={true}
          enableZoom={true}
          maxPolarAngle={Math.PI / 2.05}
          minPolarAngle={Math.PI / 8}
          dampingFactor={0.05}
        />
      </Canvas>
    </div>
  );
}
