import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AgentId,
  GraphActiveEvent,
  GraphData,
  GraphNodeControlCommand,
  GraphNodeVisualState,
} from '@shared/types';
import {
  IconExpand,
  IconEyeOff,
  IconFile,
  IconMinus,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTarget,
  IconX,
} from '../icons';

interface KnowledgeGraphPanelProps {
  title?: string;
  subtitle?: string;
  isRunning?: boolean;
  onSearchClick?: () => void;
  activeEvent?: GraphActiveEvent | null;
  graphData?: GraphData | null;
  projectHash?: string;
  onControlNode?: (command: GraphNodeControlCommand) => Promise<void> | void;
}

export interface InternalGraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  type: 'config' | 'source' | 'pipeline' | 'module' | 'function' | 'test' | 'error' | 'ignored';
  textYOffset: number;
  functionCount: number;
  linkCount: number;
  lastModified: string;
  visualState: GraphNodeVisualState;
  isFocused?: boolean;
}

const DEFAULT_NODES: Record<string, InternalGraphNode> = {
  'config.yaml': {
    id: 'config.yaml',
    label: 'config.yaml',
    x: 978,
    y: 203,
    type: 'config',
    textYOffset: -8,
    functionCount: 0,
    linkCount: 2,
    lastModified: '10 phút trước',
    visualState: 'DEFAULT',
  },
  'main.py': {
    id: 'main.py',
    label: 'main.py',
    x: 943,
    y: 272,
    type: 'source',
    textYOffset: 24,
    functionCount: 2,
    linkCount: 3,
    lastModified: '5 phút trước',
    visualState: 'DEFAULT',
  },
  'pipeline.py': {
    id: 'pipeline.py',
    label: 'pipeline.py',
    x: 1103,
    y: 279,
    type: 'pipeline',
    textYOffset: 29,
    functionCount: 5,
    linkCount: 5,
    lastModified: 'Thay đổi 2 phút trước',
    visualState: 'ACTIVE_CHATGPT',
  },
  'scene_detect.py': {
    id: 'scene_detect.py',
    label: 'scene_detect.py',
    x: 1270,
    y: 218,
    type: 'module',
    textYOffset: 29,
    functionCount: 3,
    linkCount: 4,
    lastModified: '15 phút trước',
    visualState: 'ACTIVE_GEMINI',
  },
  'score_scene()': {
    id: 'score_scene()',
    label: 'score_scene()',
    x: 1274,
    y: 327,
    type: 'function',
    textYOffset: 23,
    functionCount: 1,
    linkCount: 2,
    lastModified: '30 phút trước',
    visualState: 'DEFAULT',
  },
  'cut_highlights()': {
    id: 'cut_highlights()',
    label: 'cut_highlights()',
    x: 1098,
    y: 404,
    type: 'function',
    textYOffset: 24,
    functionCount: 1,
    linkCount: 3,
    lastModified: '45 phút trước',
    visualState: 'DEFAULT',
  },
  'test_export.py': {
    id: 'test_export.py',
    label: 'test_export.py',
    x: 981,
    y: 379,
    type: 'test',
    textYOffset: 25,
    functionCount: 4,
    linkCount: 2,
    lastModified: '1 giờ trước',
    visualState: 'DEFAULT',
  },
  'export.py': {
    id: 'export.py',
    label: 'export.py',
    x: 1344,
    y: 393,
    type: 'error',
    textYOffset: 29,
    functionCount: 2,
    linkCount: 3,
    lastModified: '3 phút trước',
    visualState: 'ERROR',
  },
  '.env.local': {
    id: '.env.local',
    label: '.env.local',
    x: 1192,
    y: 446,
    type: 'ignored',
    textYOffset: 22,
    functionCount: 0,
    linkCount: 0,
    lastModified: '2 ngày trước',
    visualState: 'IGNORED',
  },
};

const EDGES_TOPOLOGY = [
  { source: 'pipeline.py', target: 'cut_highlights()', dashed: false },
  { source: 'pipeline.py', target: 'export.py', dashed: false },
  { source: 'pipeline.py', target: 'config.yaml', dashed: false },
  { source: 'main.py', target: 'config.yaml', dashed: false },
  { source: 'cut_highlights()', target: 'export.py', dashed: false },
  { source: 'test_export.py', target: 'export.py', dashed: true },
  { source: 'test_export.py', target: 'cut_highlights()', dashed: true },
];

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
  graphData,
  projectHash = 'video-360-highlights',
  onControlNode,
}: KnowledgeGraphPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan & Zoom state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Hover Tooltip state (04 Hover Node.svg)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Context Menu state (05 Context Menu.svg)
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);

  // Search Overlay state (06 Tìm kiếm file.svg)
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

  // Local control state overrides (Focus / Exclude)
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [excludedNodeIds, setExcludedNodeIds] = useState<Set<string>>(new Set(['.env.local']));

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-context-menu]') && !target.closest('[data-node-item]')) {
        setContextMenu(null);
      }
      if (!target.closest('[data-search-box]') && !target.closest('[data-search-toggle]')) {
        // Keep search open unless clicked outside
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Merge nodes with real IPC graphData if present
  const nodesMap = useMemo(() => {
    const merged: Record<string, InternalGraphNode> = { ...DEFAULT_NODES };
    if (graphData && graphData.nodes) {
      for (const gn of graphData.nodes) {
        const existing = merged[gn.id];
        if (existing) {
          merged[gn.id] = {
            ...existing,
            label: gn.label || existing.label,
            functionCount: gn.function_count ?? existing.functionCount,
            linkCount: gn.link_count ?? existing.linkCount,
            visualState: gn.visual_state ?? existing.visualState,
            isFocused: gn.is_focused ?? existing.isFocused,
          };
        }
      }
    }
    return merged;
  }, [graphData]);

  // Compute active path based on IPC GraphActiveEvent
  const activePath = useMemo(() => {
    if (!activeEvent || !activeEvent.target_node_id) {
      return null;
    }
    const color = getAgentColor(activeEvent.agent_id);
    const target = nodesMap[activeEvent.target_node_id] || {
      id: activeEvent.target_node_id,
      label: activeEvent.target_node_id,
      x: 1103,
      y: 279,
      type: 'pipeline' as const,
      textYOffset: 28,
      functionCount: 1,
      linkCount: 1,
      lastModified: 'Vừa xong',
      visualState: 'ACTIVE_CHATGPT' as const,
    };
    const source = activeEvent.source_node_id ? nodesMap[activeEvent.source_node_id] : null;

    return {
      agentId: activeEvent.agent_id,
      color,
      action: activeEvent.action,
      modelName: activeEvent.worker_model_name,
      source,
      target,
    };
  }, [activeEvent, nodesMap]);

  // Handle Drag to Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only pan if clicking canvas background (not buttons, overlays, or nodes)
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'svg' ||
      target.classList.contains('bg-grid-graph') ||
      target.getAttribute('data-canvas-bg') === 'true'
    ) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle Wheel to Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoomLevel((prev) => Math.min(2.2, Math.max(0.5, Number((prev + delta).toFixed(2)))));
  };

  // Node Hover Tooltip handler
  const handleNodeMouseEnter = (node: InternalGraphNode, e: React.MouseEvent) => {
    if (contextMenu) return; // Do not show tooltip if context menu is active
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(10, e.clientX - containerRect.left + 15), containerRect.width - 230);
    const y = Math.min(Math.max(10, e.clientY - containerRect.top - 45), containerRect.height - 110);
    setHoveredNodeId(node.id);
    setTooltipPos({ x, y });
  };

  const handleNodeMouseLeave = () => {
    setHoveredNodeId(null);
    setTooltipPos(null);
  };

  // Node Right-Click Context Menu handler (05 Context Menu.svg)
  const handleNodeContextMenu = (node: InternalGraphNode, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    // Clamp inside container
    const x = Math.min(Math.max(10, e.clientX - containerRect.left), containerRect.width - 225);
    const y = Math.min(Math.max(10, e.clientY - containerRect.top), containerRect.height - 130);

    setContextMenu({ x, y, nodeId: node.id });
    setHoveredNodeId(null);
    setTooltipPos(null);
  };

  // Execute GraphNodeControlCommand (FOCUS / EXCLUDE / RESET)
  const handleControlCommand = async (nodeId: string, command: 'FOCUS' | 'EXCLUDE' | 'RESET') => {
    setContextMenu(null);

    // Apply local state updates immediately for zero-latency UI response
    if (command === 'FOCUS') {
      setFocusedNodeId((prev) => (prev === nodeId ? null : nodeId));
    } else if (command === 'EXCLUDE') {
      setExcludedNodeIds((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
        }
        return next;
      });
      if (focusedNodeId === nodeId) {
        setFocusedNodeId(null);
      }
    } else if (command === 'RESET') {
      if (focusedNodeId === nodeId) setFocusedNodeId(null);
      setExcludedNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    }

    // Call IPC bridge if hooked
    if (onControlNode) {
      await onControlNode({
        project_hash: projectHash,
        node_id: nodeId,
        command,
      });
    }
  };

  // Search and Pan/Zoom to Node
  const handleSelectSearchResult = (node: InternalGraphNode) => {
    setHighlightedNodeId(node.id);
    setIsSearchOpen(false);

    // Center view onto node coordinates in SVG space (877, 149 to 1409, 493)
    const centerX = 1143;
    const centerY = 321;
    const dx = (centerX - node.x) * 0.7;
    const dy = (centerY - node.y) * 0.7;

    setPanOffset({ x: dx, y: dy });
    setZoomLevel(1.35);

    // Pulse highlight for 2.5 seconds
    setTimeout(() => {
      setHighlightedNodeId(null);
    }, 2500);
  };

  // Filter nodes for search query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return Object.values(nodesMap).filter((n) => n.id.toLowerCase().includes(q) || n.label.toLowerCase().includes(q));
  }, [searchQuery, nodesMap]);

  const activeHoverNode = hoveredNodeId ? nodesMap[hoveredNodeId] : null;
  const activeMenuNode = contextMenu ? nodesMap[contextMenu.nodeId] : null;

  return (
    <section className="flex h-full flex-col justify-between rounded-[16px] border border-[#23344A] bg-[#0E1725] p-4 shadow-lg select-none">
      {/* Header (01 Dashboard.svg) */}
      <header className="flex h-[42px] shrink-0 items-center justify-between border-b border-[#23344A] pb-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[18px] font-medium tracking-tight text-[#EAF2FF]">{title}</h2>
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
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="relative mt-3 flex-1 overflow-hidden rounded-[8px] border border-[#23344A] bg-[#0A1220] cursor-grab active:cursor-grabbing"
      >
        {/* Top-left node/edge count badge + Active flow notice */}
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2 pointer-events-none">
          <div className="flex items-center rounded-md border border-[#23344A] bg-[#0A1220]/90 px-2.5 py-1 backdrop-blur-sm">
            <span className="font-mono text-[11px] font-medium text-[#8297B2]">
              {graphData?.total_nodes ?? 9} NODES / {graphData?.total_edges ?? 10} EDGES
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

          {focusedNodeId && (
            <div className="flex items-center gap-1.5 rounded-md border border-[#58E9A8]/50 bg-[#142338]/90 px-2.5 py-1 text-[#58E9A8] pointer-events-auto">
              <IconTarget size={12} />
              <span className="font-mono text-[11px] font-medium">Tập trung: {focusedNodeId}</span>
              <button
                type="button"
                onClick={() => setFocusedNodeId(null)}
                className="ml-1 text-[#9DB0C8] hover:text-[#EAF2FF]"
                title="Bỏ tập trung"
              >
                <IconX size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Top-right toolbar: 4 controls */}
        <div className="absolute right-3 top-3 z-20 flex flex-col gap-1.5">
          <button
            type="button"
            data-search-toggle="true"
            onClick={() => {
              setIsSearchOpen((prev) => !prev);
              if (onSearchClick) onSearchClick();
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-[6px] border bg-[#142235] shadow-md transition ${
              isSearchOpen
                ? 'border-[#58E9A8] text-[#58E9A8] shadow-[0_0_8px_rgba(88,233,168,0.3)]'
                : 'border-[#405672] text-[#9DB0C8] hover:border-[#58E9A8] hover:text-[#EAF2FF]'
            }`}
            title="Tìm kiếm file"
          >
            <IconSearch size={14} />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(Number((z + 0.15).toFixed(2)), 2.2))}
            className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#405672] bg-[#142235] text-[#9DB0C8] shadow-md transition hover:border-[#58E9A8] hover:text-[#EAF2FF]"
            title="Phóng to"
          >
            <IconPlus size={14} />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(Number((z - 0.15).toFixed(2)), 0.5))}
            className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#405672] bg-[#142235] text-[#9DB0C8] shadow-md transition hover:border-[#58E9A8] hover:text-[#EAF2FF]"
            title="Thu nhỏ"
          >
            <IconMinus size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoomLevel(1);
              setPanOffset({ x: 0, y: 0 });
            }}
            className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#405672] bg-[#142235] text-[#9DB0C8] shadow-md transition hover:border-[#58E9A8] hover:text-[#EAF2FF]"
            title="Căn giữa toàn khung"
          >
            <IconExpand size={14} />
          </button>
        </div>

        {/* 06 Tìm kiếm file.svg - Search Overlay */}
        {isSearchOpen && (
          <div
            data-search-box="true"
            className="absolute right-14 top-3 z-30 w-[262px] rounded-[10px] border border-[#405672] bg-[#142338]/95 p-2.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Input with #58E9A8 green border */}
            <div className="flex h-[31px] items-center gap-2 rounded-[6px] border border-[#58E9A8] bg-[#142235] px-2.5 shadow-inner">
              <IconSearch size={13} className="shrink-0 text-[#EAF2FF]" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm file trong graph..."
                className="w-full bg-transparent font-mono text-[12px] text-[#EAF2FF] placeholder-[#8297B2] outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[#9DB0C8] hover:text-[#EAF2FF]"
                >
                  <IconX size={13} />
                </button>
              )}
            </div>

            {/* Result list */}
            <div className="mt-2 flex max-h-[160px] flex-col gap-1.5 overflow-y-auto">
              {searchQuery.trim() === '' ? (
                <p className="px-1 py-1 text-[11px] text-[#8297B2]">Nhập tên file để tìm kiếm...</p>
              ) : searchResults.length === 0 ? (
                <p className="px-1 py-1 text-[11px] text-[#FF806E]">Không tìm thấy file nào</p>
              ) : (
                searchResults.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => handleSelectSearchResult(node)}
                    className="flex h-[30px] items-center justify-between rounded-[6px] border border-[#23344A] bg-[#142235] px-2.5 text-left transition hover:border-[#58E9A8] hover:bg-[#1A2D46]"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <IconFile size={13} className="shrink-0 text-[#58E9A8]" />
                      <span className="truncate font-mono text-[12px] text-[#EAF2FF]">{node.label}</span>
                    </div>
                    <span className="shrink-0 text-[10px] text-[#8297B2]">{node.functionCount} hàm</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Interactive SVG Knowledge Graph Viewport */}
        <div
          data-canvas-bg="true"
          className="h-full w-full bg-grid-graph transition-transform duration-75"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
            transformOrigin: 'center center',
          }}
        >
          <svg
            viewBox="877 149 532 344"
            className="h-full w-full object-contain pointer-events-auto"
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
            {EDGES_TOPOLOGY.map((edge) => {
              const src = nodesMap[edge.source];
              const tgt = nodesMap[edge.target];
              if (!src || !tgt) return null;

              // Check if edge should be dimmed by Focus mode
              const isEdgeDimmed =
                focusedNodeId && focusedNodeId !== edge.source && focusedNodeId !== edge.target;

              return (
                <path
                  key={`${edge.source}-${edge.target}`}
                  d={`M${src.x} ${src.y}L${tgt.x} ${tgt.y}`}
                  stroke="#3D526D"
                  strokeWidth="1.2"
                  strokeDasharray={edge.dashed ? '4 4' : undefined}
                  opacity={isEdgeDimmed ? 0.15 : 1}
                  className="transition-opacity duration-300"
                />
              );
            })}

            {/* Glowing Edge 1: main.py -> pipeline.py (Active ChatGPT - Green #58E9A8) */}
            <path id="path-edge-1" d="M943 272L1103 279" fill="none" />
            <line
              x1="943"
              y1="272"
              x2="1103"
              y2="279"
              stroke="#58E9A8"
              strokeWidth="6"
              opacity={focusedNodeId && focusedNodeId !== 'main.py' && focusedNodeId !== 'pipeline.py' ? 0.08 : 0.25}
            />
            <line
              x1="943"
              y1="272"
              x2="1103"
              y2="279"
              stroke="#58E9A8"
              strokeWidth="2"
              filter="url(#glow-green)"
              opacity={focusedNodeId && focusedNodeId !== 'main.py' && focusedNodeId !== 'pipeline.py' ? 0.2 : 1}
            />
            <circle r="3" fill="#EEFFF7">
              <animateMotion dur="2.2s" repeatCount="indefinite">
                <mpath href="#path-edge-1" />
              </animateMotion>
            </circle>
            <path d="M1062 277L1056 280.5M1062 277L1056 273.5" stroke="#58E9A8" strokeWidth="1.5" />

            {/* Glowing Edge 2: pipeline.py -> scene_detect.py (Active Gemini - Purple #A88BFA) */}
            <path id="path-edge-2" d="M1103 279L1270 218" fill="none" />
            <line
              x1="1103"
              y1="279"
              x2="1270"
              y2="218"
              stroke="#A88BFA"
              strokeWidth="6"
              opacity={focusedNodeId && focusedNodeId !== 'pipeline.py' && focusedNodeId !== 'scene_detect.py' ? 0.08 : 0.25}
            />
            <line
              x1="1103"
              y1="279"
              x2="1270"
              y2="218"
              stroke="#A88BFA"
              strokeWidth="2"
              filter="url(#glow-purple)"
              opacity={focusedNodeId && focusedNodeId !== 'pipeline.py' && focusedNodeId !== 'scene_detect.py' ? 0.2 : 1}
            />
            <circle r="3" fill="#EEFFF7">
              <animateMotion dur="2.4s" repeatCount="indefinite">
                <mpath href="#path-edge-2" />
              </animateMotion>
            </circle>
            <path d="M1210 240L1206 245M1210 240L1204 238.5" stroke="#A88BFA" strokeWidth="1.5" />

            {/* Glowing Edge 3: scene_detect.py -> score_scene() (Active Gemini - Purple #A88BFA) */}
            <path id="path-edge-3" d="M1270 218L1274 327" fill="none" />
            <line
              x1="1270"
              y1="218"
              x2="1274"
              y2="327"
              stroke="#A88BFA"
              strokeWidth="6"
              opacity={focusedNodeId && focusedNodeId !== 'scene_detect.py' && focusedNodeId !== 'score_scene()' ? 0.08 : 0.25}
            />
            <line
              x1="1270"
              y1="218"
              x2="1274"
              y2="327"
              stroke="#A88BFA"
              strokeWidth="2"
              filter="url(#glow-purple)"
              opacity={focusedNodeId && focusedNodeId !== 'scene_detect.py' && focusedNodeId !== 'score_scene()' ? 0.2 : 1}
            />
            <circle r="3" fill="#EEFFF7">
              <animateMotion dur="1.8s" repeatCount="indefinite">
                <mpath href="#path-edge-3" />
              </animateMotion>
            </circle>
            <path d="M1272.5 288L1269 282.5M1272.5 288L1276 282" stroke="#A88BFA" strokeWidth="1.5" />

            {/* DYNAMIC PATH LIGHTS UP (From IPC GraphActiveEvent) */}
            {activePath?.source && (
              <g className="animate-in fade-in duration-300">
                <path
                  id="dynamic-active-path"
                  d={`M ${activePath.source.x} ${activePath.source.y} L ${activePath.target.x} ${activePath.target.y}`}
                  fill="none"
                />
                <line
                  x1={activePath.source.x}
                  y1={activePath.source.y}
                  x2={activePath.target.x}
                  y2={activePath.target.y}
                  stroke={activePath.color}
                  strokeWidth="8"
                  opacity="0.35"
                />
                <line
                  x1={activePath.source.x}
                  y1={activePath.source.y}
                  x2={activePath.target.x}
                  y2={activePath.target.y}
                  stroke={activePath.color}
                  strokeWidth="2.5"
                  filter="url(#glow-agent)"
                />
                <circle r="3.5" fill="#EEFFF7">
                  <animateMotion dur="1.4s" repeatCount="indefinite">
                    <mpath href="#dynamic-active-path" />
                  </animateMotion>
                </circle>
              </g>
            )}

            {/* RENDER ALL NODES WITH EXACT DIMENSIONS & VISUAL STATES */}
            {Object.values(nodesMap).map((node) => {
              const isExcluded = excludedNodeIds.has(node.id) || node.visualState === 'IGNORED';
              const isFocused = focusedNodeId === node.id || node.isFocused;
              const isDimmed = focusedNodeId && !isFocused;
              const isHighlighted = highlightedNodeId === node.id;

              return (
                <g
                  key={node.id}
                  data-node-item="true"
                  className="cursor-pointer transition-opacity duration-200"
                  opacity={isDimmed ? 0.22 : isExcluded ? 0.45 : 1}
                  onMouseEnter={(e) => handleNodeMouseEnter(node, e)}
                  onMouseLeave={handleNodeMouseLeave}
                  onContextMenu={(e) => handleNodeContextMenu(node, e)}
                  onClick={(e) => {
                    // Left click: toggle focus
                    e.stopPropagation();
                    handleControlCommand(node.id, isFocused ? 'RESET' : 'FOCUS');
                  }}
                >
                  {/* Highlight halo from search jump */}
                  {isHighlighted && (
                    <circle cx={node.x} cy={node.y} r="24" fill="#58E9A8" opacity="0.3" className="animate-ping" />
                  )}

                  {/* Pulsing halo when node is Focused */}
                  {isFocused && (
                    <>
                      <circle cx={node.x} cy={node.y} r="22" fill="#58E9A8" opacity="0.25" className="animate-pulse" />
                      <circle cx={node.x} cy={node.y} r="15" fill="none" stroke="#58E9A8" strokeWidth="1.5" strokeDasharray="3 3" />
                    </>
                  )}

                  {/* Node Type Rendering */}
                  {node.type === 'pipeline' && (
                    <>
                      <circle cx={node.x} cy={node.y} r="16" fill="#58E9A8" opacity="0.22" />
                      <circle cx={node.x} cy={node.y} r="8" fill="#58E9A8" filter="url(#glow-green)" />
                      <circle cx={node.x} cy={node.y} r="3" fill="#EEFFF7" />
                      <text
                        x={node.x}
                        y={node.y + node.textYOffset}
                        textAnchor="middle"
                        fill="#58E9A8"
                        fontSize="12"
                        fontWeight="600"
                        fontFamily="JetBrains Mono"
                      >
                        {node.label}
                      </text>
                    </>
                  )}

                  {node.type === 'module' && (
                    <>
                      <circle cx={node.x} cy={node.y} r="16" fill="#A88BFA" opacity="0.22" />
                      <circle cx={node.x} cy={node.y} r="8" fill="#A88BFA" filter="url(#glow-purple)" />
                      <circle cx={node.x} cy={node.y} r="3" fill="#EEFFF7" />
                      <text
                        x={node.x}
                        y={node.y + node.textYOffset}
                        textAnchor="middle"
                        fill="#A88BFA"
                        fontSize="12"
                        fontWeight="600"
                        fontFamily="JetBrains Mono"
                      >
                        {node.label}
                      </text>
                    </>
                  )}

                  {node.type === 'function' && (
                    <>
                      <circle cx={node.x} cy={node.y} r="5" fill="#0A1220" stroke="#88D2E7" strokeWidth="1.5" />
                      <text
                        x={node.x}
                        y={node.y + node.textYOffset}
                        textAnchor="middle"
                        fill="#88D2E7"
                        fontSize="11"
                        fontFamily="JetBrains Mono"
                      >
                        {node.label}
                      </text>
                    </>
                  )}

                  {node.type === 'error' && (
                    <>
                      <circle cx={node.x} cy={node.y} r="16" fill="#FF806E" opacity="0.22" />
                      <circle cx={node.x} cy={node.y} r="7" fill="#FF9A83" filter="url(#glow-red)" />
                      <circle cx={node.x} cy={node.y} r="3" fill="#EEFFF7" />
                      <text
                        x={node.x}
                        y={node.y + node.textYOffset}
                        textAnchor="middle"
                        fill="#FF9A83"
                        fontSize="11"
                        fontWeight="600"
                        fontFamily="JetBrains Mono"
                      >
                        {node.label}
                      </text>
                    </>
                  )}

                  {node.type === 'ignored' && (
                    <>
                      <circle cx={node.x} cy={node.y} r="4.5" fill="#0A1220" stroke="#65748A" strokeWidth="1.5" />
                      <text
                        x={node.x}
                        y={node.y + node.textYOffset}
                        textAnchor="middle"
                        fill="#65748A"
                        fontSize="10.5"
                        fontFamily="JetBrains Mono"
                      >
                        {node.label}
                      </text>
                    </>
                  )}

                  {['config', 'source', 'test'].includes(node.type) && (
                    <>
                      <circle cx={node.x} cy={node.y} r="5" fill="#0A1220" stroke="#9FB2CC" strokeWidth="1.5" />
                      <text
                        x={node.x}
                        y={node.y + node.textYOffset}
                        textAnchor="middle"
                        fill="#9FB2CC"
                        fontSize="11"
                        fontFamily="JetBrains Mono"
                      >
                        {node.label}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* 04 Hover Node.svg - Hover Tooltip Card */}
        {activeHoverNode && tooltipPos && !contextMenu && (
          <div
            className="pointer-events-none absolute z-40 w-[218px] rounded-[10px] border border-[#405672] bg-[#142338]/90 p-3 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
            style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
          >
            {/* Header: File icon + File name */}
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-[#58E9A8]/10 text-[#58E9A8]">
                <IconFile size={13} />
              </div>
              <span className="truncate font-mono text-[13px] font-bold text-[#EAF2FF]">
                {activeHoverNode.label}
              </span>
            </div>

            {/* Line 1: Function count & Link count */}
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#9DB0C8]">
              <span>
                {activeHoverNode.functionCount} hàm · {activeHoverNode.linkCount} liên kết
              </span>
            </div>

            {/* Line 2: Modified time */}
            <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-[#8297B2]">
              <span>{activeHoverNode.lastModified}</span>
            </div>
          </div>
        )}

        {/* 05 Context Menu.svg - Right-Click Context Menu Card */}
        {activeMenuNode && contextMenu && (
          <div
            data-context-menu="true"
            className="absolute z-50 w-[211px] rounded-[10px] border border-[#58E9A8] bg-[#142338]/95 p-2.5 shadow-[0_0_20px_rgba(88,233,168,0.25)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
            style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          >
            {/* Node Title */}
            <div className="mb-2 px-1 font-mono text-[11px] font-medium text-[#8297B2] truncate">
              {activeMenuNode.label}
            </div>

            {/* Action 1: Tập trung (Focus) */}
            <button
              type="button"
              onClick={() => handleControlCommand(activeMenuNode.id, focusedNodeId === activeMenuNode.id ? 'RESET' : 'FOCUS')}
              className="flex h-[31px] w-full items-center gap-2.5 rounded-[6px] border border-[#23344A] bg-[#142235] px-2.5 text-[#58E9A8] transition hover:border-[#58E9A8] hover:bg-[#1A2D46]"
            >
              <IconTarget size={14} className="shrink-0" />
              <span className="font-medium text-[12px]">
                {focusedNodeId === activeMenuNode.id ? 'Bỏ tập trung' : 'Tập trung (Focus)'}
              </span>
            </button>

            {/* Action 2: Bỏ qua (Exclude) */}
            <button
              type="button"
              onClick={() =>
                handleControlCommand(
                  activeMenuNode.id,
                  excludedNodeIds.has(activeMenuNode.id) ? 'RESET' : 'EXCLUDE'
                )
              }
              className="mt-1.5 flex h-[31px] w-full items-center gap-2.5 rounded-[6px] border border-[#23344A] bg-transparent px-2.5 text-[#EAF2FF] transition hover:border-[#405672] hover:bg-[#142235]"
            >
              {excludedNodeIds.has(activeMenuNode.id) ? (
                <>
                  <IconRefresh size={14} className="shrink-0 text-[#58E9A8]" />
                  <span className="font-medium text-[12px] text-[#58E9A8]">Khôi phục (Reset)</span>
                </>
              ) : (
                <>
                  <IconEyeOff size={14} className="shrink-0 text-[#9DB0C8]" />
                  <span className="font-medium text-[12px]">Bỏ qua (Exclude)</span>
                </>
              )}
            </button>
          </div>
        )}
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

        <span className="text-[10.5px] text-[#8297B2]">Kéo để di chuyển • Cuộn để zoom</span>
      </footer>
    </section>
  );
}
