import { useMemo, useState } from 'react';
import type { AgentId, GraphActiveEvent, GraphData } from '@shared/types';
import {
  IconExpand,
  IconMinus,
  IconPlus,
  IconSearch,
} from '../icons';

interface KnowledgeGraphPanelProps {
  title?: string;
  subtitle?: string;
  isRunning?: boolean;
  onSearchClick?: () => void;
  activeEvent?: GraphActiveEvent | null;
  graphData?: GraphData | null;
}

interface NodeCoord {
  id: string;
  label: string;
  x: number;
  y: number;
  type: 'config' | 'source' | 'pipeline' | 'module' | 'function' | 'test' | 'error' | 'ignored';
  textYOffset: number;
}

const DEFAULT_NODES: Record<string, NodeCoord> = {
  'config.yaml': { id: 'config.yaml', label: 'config.yaml', x: 978, y: 203, type: 'config', textYOffset: -8 },
  'main.py': { id: 'main.py', label: 'main.py', x: 943, y: 272, type: 'source', textYOffset: 24 },
  'pipeline.py': { id: 'pipeline.py', label: 'pipeline.py', x: 1103, y: 279, type: 'pipeline', textYOffset: 29 },
  'scene_detect.py': { id: 'scene_detect.py', label: 'scene_detect.py', x: 1270, y: 218, type: 'module', textYOffset: 29 },
  'score_scene()': { id: 'score_scene()', label: 'score_scene()', x: 1274, y: 327, type: 'function', textYOffset: 23 },
  'cut_highlights()': { id: 'cut_highlights()', label: 'cut_highlights()', x: 1098, y: 404, type: 'function', textYOffset: 24 },
  'test_export.py': { id: 'test_export.py', label: 'test_export.py', x: 981, y: 379, type: 'test', textYOffset: 25 },
  'export.py': { id: 'export.py', label: 'export.py', x: 1344, y: 393, type: 'error', textYOffset: 29 },
  '.env.local': { id: '.env.local', label: '.env.local', x: 1192, y: 446, type: 'ignored', textYOffset: 22 },
};

function getAgentColor(agentId?: AgentId): string {
  switch (agentId) {
    case 'chatgpt':
      return '#58E9A8';
    case 'gemini':
      return '#A88BFA';
    case 'claude':
      return '#78BAFF';
    case 'codex':
      return '#FFC075';
    default:
      return '#58E9A8';
  }
}

export function KnowledgeGraphPanel({
  title = 'Codebase Knowledge Graph',
  subtitle = 'Video 360 Highlights / main',
  isRunning = true,
  onSearchClick,
  activeEvent,
}: KnowledgeGraphPanelProps) {
  const [zoomLevel, setZoomLevel] = useState(1);

  // Active path lights up configuration based on real IPC GraphActiveEvent
  const activePath = useMemo(() => {
    if (!activeEvent || !activeEvent.target_node_id) {
      return null;
    }
    const color = getAgentColor(activeEvent.agent_id);
    const target = DEFAULT_NODES[activeEvent.target_node_id] || {
      id: activeEvent.target_node_id,
      label: activeEvent.target_node_id,
      x: 1103,
      y: 279,
      type: 'pipeline',
      textYOffset: 28,
    };
    const source = activeEvent.source_node_id ? DEFAULT_NODES[activeEvent.source_node_id] : null;

    return {
      agentId: activeEvent.agent_id,
      color,
      action: activeEvent.action,
      modelName: activeEvent.worker_model_name,
      source,
      target,
    };
  }, [activeEvent]);

  return (
    <section className="flex h-full flex-col justify-between rounded-[16px] border border-[#23344A] bg-[#0E1725] p-4 shadow-lg select-none">
      {/* Header (01 Dashboard.svg) */}
      <header className="flex h-[42px] shrink-0 items-center justify-between border-b border-[#23344A] pb-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[18px] font-medium tracking-tight text-[#EAF2FF]">
            {title}
          </h2>
          <span className="text-[12.5px] text-[#9DB0C8]">{subtitle}</span>
        </div>

        {/* Badge • ĐANG CHẠY / DỪNG */}
        <div className="flex items-center gap-2 rounded-md border border-[#23344A] bg-[#0A1220] px-3 py-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isRunning ? 'bg-[#58E9A8] shadow-[0_0_6px_#58E9A8]' : 'bg-[#8297B2]'
            }`}
          />
          <span
            className={`font-mono text-[11px] font-medium tracking-wide ${
              isRunning ? 'text-[#58E9A8]' : 'text-[#8297B2]'
            }`}
          >
            {isRunning ? 'ĐANG CHẠY' : 'DỪNG'}
          </span>
        </div>
      </header>

      {/* Graph Canvas Container */}
      <div className="relative mt-3 flex-1 overflow-hidden rounded-[8px] border border-[#23344A] bg-[#0A1220]">
        {/* Top-left node/edge count badge + Active flow notice */}
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
          <div className="flex items-center rounded-md border border-[#23344A] bg-[#0A1220]/90 px-2.5 py-1 backdrop-blur-sm">
            <span className="font-mono text-[11px] font-medium text-[#8297B2]">
              9 NODES / 10 EDGES
            </span>
          </div>

          {activePath && (
            <div
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 backdrop-blur-sm animate-pulse"
              style={{
                borderColor: `${activePath.color}66`,
                backgroundColor: `${activePath.color}15`,
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: activePath.color }} />
              <span className="font-mono text-[11px] font-semibold" style={{ color: activePath.color }}>
                {activePath.modelName || activePath.agentId.toUpperCase()} • {activePath.action}
              </span>
            </div>
          )}
        </div>

        {/* Top-right toolbar: 4 controls */}
        <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={onSearchClick}
            className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#405672] bg-[#142235] text-[#9DB0C8] shadow-md transition hover:border-[#58E9A8] hover:text-[#EAF2FF]"
            title="Tìm kiếm file"
          >
            <IconSearch size={14} />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(z + 0.15, 2))}
            className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#405672] bg-[#142235] text-[#9DB0C8] shadow-md transition hover:border-[#58E9A8] hover:text-[#EAF2FF]"
            title="Phóng to"
          >
            <IconPlus size={14} />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(z - 0.15, 0.5))}
            className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#405672] bg-[#142235] text-[#9DB0C8] shadow-md transition hover:border-[#58E9A8] hover:text-[#EAF2FF]"
            title="Thu nhỏ"
          >
            <IconMinus size={14} />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel(1)}
            className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#405672] bg-[#142235] text-[#9DB0C8] shadow-md transition hover:border-[#58E9A8] hover:text-[#EAF2FF]"
            title="Căn giữa toàn khung"
          >
            <IconExpand size={14} />
          </button>
        </div>

        {/* Interactive SVG Knowledge Graph Viewport */}
        <div
          className="h-full w-full bg-grid-graph"
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
        >
          <svg
            viewBox="877 149 532 344"
            className="h-full w-full object-contain"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter id="glow-green" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-purple" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-red" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-agent" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Inactive & Dashed Edges (Standard topology from 01 Dashboard.svg) */}
            <path d="M1103 279L1098 404" stroke="#3D526D" strokeWidth="1.2" />
            <path d="M1103 279L1344 393" stroke="#3D526D" strokeWidth="1.2" />
            <path d="M1103 279L978 203" stroke="#3D526D" strokeWidth="1.2" />
            <path d="M943 272L978 203" stroke="#3D526D" strokeWidth="1.2" />
            <path d="M1098 404L1344 393" stroke="#3D526D" strokeWidth="1.2" />
            <path d="M981 379L1344 393" stroke="#3D526D" strokeWidth="1.2" strokeDasharray="4 4" />
            <path d="M981 379L1098 404" stroke="#3D526D" strokeWidth="1.2" strokeDasharray="4 4" />

            {/* Static Glowing Edge 1: main.py -> pipeline.py (Active ChatGPT - Green #58E9A8) */}
            <path id="path-edge-1" d="M943 272L1103 279" fill="none" />
            <line
              x1="943"
              y1="272"
              x2="1103"
              y2="279"
              stroke="#58E9A8"
              strokeWidth="6"
              opacity="0.25"
            />
            <line
              x1="943"
              y1="272"
              x2="1103"
              y2="279"
              stroke="#58E9A8"
              strokeWidth="2"
              filter="url(#glow-green)"
            />
            {/* Flow particle beam traveling from main.py to pipeline.py */}
            <circle r="3" fill="#EEFFF7">
              <animateMotion dur="2.2s" repeatCount="indefinite">
                <mpath href="#path-edge-1" />
              </animateMotion>
            </circle>
            <path d="M1062 277L1056 280.5M1062 277L1056 273.5" stroke="#58E9A8" strokeWidth="1.5" />

            {/* Static Glowing Edge 2: pipeline.py -> scene_detect.py (Active Gemini - Purple #A88BFA) */}
            <path id="path-edge-2" d="M1103 279L1270 218" fill="none" />
            <line
              x1="1103"
              y1="279"
              x2="1270"
              y2="218"
              stroke="#A88BFA"
              strokeWidth="6"
              opacity="0.25"
            />
            <line
              x1="1103"
              y1="279"
              x2="1270"
              y2="218"
              stroke="#A88BFA"
              strokeWidth="2"
              filter="url(#glow-purple)"
            />
            {/* Flow particle beam traveling from pipeline.py to scene_detect.py */}
            <circle r="3" fill="#EEFFF7">
              <animateMotion dur="2.4s" repeatCount="indefinite">
                <mpath href="#path-edge-2" />
              </animateMotion>
            </circle>
            <path d="M1210 240L1206 245M1210 240L1204 238.5" stroke="#A88BFA" strokeWidth="1.5" />

            {/* Static Glowing Edge 3: scene_detect.py -> score_scene() (Active Gemini - Purple #A88BFA) */}
            <path id="path-edge-3" d="M1270 218L1274 327" fill="none" />
            <line
              x1="1270"
              y1="218"
              x2="1274"
              y2="327"
              stroke="#A88BFA"
              strokeWidth="6"
              opacity="0.25"
            />
            <line
              x1="1270"
              y1="218"
              x2="1274"
              y2="327"
              stroke="#A88BFA"
              strokeWidth="2"
              filter="url(#glow-purple)"
            />
            {/* Flow particle beam traveling from scene_detect.py to score_scene() */}
            <circle r="3" fill="#EEFFF7">
              <animateMotion dur="1.8s" repeatCount="indefinite">
                <mpath href="#path-edge-3" />
              </animateMotion>
            </circle>
            <path d="M1272.5 288L1269 282.5M1272.5 288L1276 282" stroke="#A88BFA" strokeWidth="1.5" />

            {/* DYNAMIC PATH LIGHTS UP (When activeEvent from IPC is present) */}
            {activePath?.source && (
              <g className="animate-in fade-in duration-300">
                <path
                  id="dynamic-active-path"
                  d={`M ${activePath.source.x} ${activePath.source.y} L ${activePath.target.x} ${activePath.target.y}`}
                  fill="none"
                />
                {/* Wide soft glow */}
                <line
                  x1={activePath.source.x}
                  y1={activePath.source.y}
                  x2={activePath.target.x}
                  y2={activePath.target.y}
                  stroke={activePath.color}
                  strokeWidth="8"
                  opacity="0.35"
                />
                {/* Core bright stroke */}
                <line
                  x1={activePath.source.x}
                  y1={activePath.source.y}
                  x2={activePath.target.x}
                  y2={activePath.target.y}
                  stroke={activePath.color}
                  strokeWidth="2.5"
                  filter="url(#glow-agent)"
                />
                {/* Traveling particle beam matching agent color */}
                <circle r="3.5" fill="#EEFFF7">
                  <animateMotion dur="1.4s" repeatCount="indefinite">
                    <mpath href="#dynamic-active-path" />
                  </animateMotion>
                </circle>
              </g>
            )}

            {/* NODES (Exact dimensions and coordinates from 01 Dashboard.svg) */}
            {/* 1. config.yaml */}
            <g className="cursor-pointer">
              <circle cx="978" cy="203" r="5" fill="#0A1220" stroke="#9FB2CC" strokeWidth="1.5" />
              <text x="978" y="195" textAnchor="middle" fill="#9FB2CC" fontSize="11" fontFamily="JetBrains Mono">
                config.yaml
              </text>
            </g>

            {/* 2. main.py */}
            <g className="cursor-pointer">
              <circle cx="943" cy="272" r="5" fill="#0A1220" stroke="#9FB2CC" strokeWidth="1.5" />
              <text x="943" y="296" textAnchor="middle" fill="#9FB2CC" fontSize="11" fontFamily="JetBrains Mono">
                main.py
              </text>
            </g>

            {/* 3. pipeline.py (Active ChatGPT - Glowing Green Double Ring) */}
            <g className="cursor-pointer">
              <circle cx="1103" cy="279" r="16" fill="#58E9A8" opacity="0.22" />
              <circle cx="1103" cy="279" r="8" fill="#58E9A8" filter="url(#glow-green)" />
              <circle cx="1103" cy="279" r="3" fill="#EEFFF7" />
              <text x="1103" y="308" textAnchor="middle" fill="#58E9A8" fontSize="12" fontWeight="600" fontFamily="JetBrains Mono">
                pipeline.py
              </text>
            </g>

            {/* 4. scene_detect.py (Active Gemini - Glowing Purple Double Ring) */}
            <g className="cursor-pointer">
              <circle cx="1270" cy="218" r="16" fill="#A88BFA" opacity="0.22" />
              <circle cx="1270" cy="218" r="8" fill="#A88BFA" filter="url(#glow-purple)" />
              <circle cx="1270" cy="218" r="3" fill="#EEFFF7" />
              <text x="1270" y="247" textAnchor="middle" fill="#A88BFA" fontSize="12" fontWeight="600" fontFamily="JetBrains Mono">
                scene_detect.py
              </text>
            </g>

            {/* 5. score_scene() (Function node - Cyan) */}
            <g className="cursor-pointer">
              <circle cx="1274" cy="327" r="5" fill="#0A1220" stroke="#88D2E7" strokeWidth="1.5" />
              <text x="1274" y="350" textAnchor="middle" fill="#88D2E7" fontSize="11" fontFamily="JetBrains Mono">
                score_scene()
              </text>
            </g>

            {/* 6. cut_highlights() (Function node - Cyan) */}
            <g className="cursor-pointer">
              <circle cx="1098" cy="404" r="5" fill="#0A1220" stroke="#88D2E7" strokeWidth="1.5" />
              <text x="1098" y="428" textAnchor="middle" fill="#88D2E7" fontSize="11" fontFamily="JetBrains Mono">
                cut_highlights()
              </text>
            </g>

            {/* 7. test_export.py (Default node) */}
            <g className="cursor-pointer">
              <circle cx="981" cy="379" r="5" fill="#0A1220" stroke="#9FB2CC" strokeWidth="1.5" />
              <text x="981" y="404" textAnchor="middle" fill="#9FB2CC" fontSize="11" fontFamily="JetBrains Mono">
                test_export.py
              </text>
            </g>

            {/* 8. export.py (ERROR node - Glowing Red) */}
            <g className="cursor-pointer">
              <circle cx="1344" cy="393" r="16" fill="#FF806E" opacity="0.22" />
              <circle cx="1344" cy="393" r="7" fill="#FF9A83" filter="url(#glow-red)" />
              <circle cx="1344" cy="393" r="3" fill="#EEFFF7" />
              <text x="1344" y="422" textAnchor="middle" fill="#FF9A83" fontSize="11" fontWeight="600" fontFamily="JetBrains Mono">
                export.py
              </text>
            </g>

            {/* 9. .env.local (IGNORED node - Grey/Muted) */}
            <g className="cursor-pointer opacity-50">
              <circle cx="1192" cy="446" r="4.5" fill="#0A1220" stroke="#65748A" strokeWidth="1.5" />
              <text x="1192" y="468" textAnchor="middle" fill="#65748A" fontSize="10.5" fontFamily="JetBrains Mono">
                .env.local
              </text>
            </g>

            {/* DYNAMIC TARGET NODE (If custom target from GraphActiveEvent is active) */}
            {activePath && activePath.target && !['pipeline.py', 'scene_detect.py', 'export.py'].includes(activePath.target.id) && (
              <g className="cursor-pointer">
                <circle cx={activePath.target.x} cy={activePath.target.y} r="16" fill={activePath.color} opacity="0.22" />
                <circle cx={activePath.target.x} cy={activePath.target.y} r="8" fill={activePath.color} filter="url(#glow-agent)" />
                <circle cx={activePath.target.x} cy={activePath.target.y} r="3" fill="#EEFFF7" />
                <text
                  x={activePath.target.x}
                  y={activePath.target.y + activePath.target.textYOffset}
                  textAnchor="middle"
                  fill={activePath.color}
                  fontSize="12"
                  fontWeight="600"
                  fontFamily="JetBrains Mono"
                >
                  {activePath.target.label}
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Bottom Legend (01 Dashboard.svg) */}
      <footer className="mt-3 flex items-center justify-between text-[11px] text-[#9DB0C8]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#58E9A8]" />
            <span>ChatGPT</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#A88BFA]" />
            <span>Gemini</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#78BAFF]" />
            <span>Claude</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#FFC075]" />
            <span>Codex</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#65748A]" />
            <span>Bỏ qua</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#FF9A83]" />
            <span>Lỗi</span>
          </div>
        </div>

        <span className="text-[10.5px] text-[#8297B2]">Cuộn để zoom</span>
      </footer>
    </section>
  );
}
