import { useState } from 'react';
import type {
  AINetworkSettings,
  AgentSettingsProfile,
  ToolDependencyStatus,
  WorkspaceStorageInfo,
  AppearanceSettings,
  UpdateStatus,
} from '@shared/types';
import {
  IconAlert,
  IconCheck,
  IconChevronDown,
  IconCube,
  IconDots,
  IconEye,
  IconEyeOff,
  IconInfo,
  IconKey,
  IconLayers,
  IconLock,
  IconRefresh,
  IconShield,
  IconSpinner,
  IconTerminal,
  IconWrench,
  IconX,
} from '../icons';
import { getAgentMeta } from '../agents';

export type SettingsTabId = 'network' | 'tools' | 'appearance' | 'updates';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  networkSettings: AINetworkSettings;
  onSaveNetworkSettings: (settings: AINetworkSettings) => void;
  toolDependencies: ToolDependencyStatus[];
  workspaceStorage: WorkspaceStorageInfo;
  appearanceSettings: AppearanceSettings;
  onSaveAppearanceSettings: (settings: AppearanceSettings) => void;
  updateStatus: UpdateStatus;
  onToggleAgentConnection?: (agentId: string) => void;
}

const CHAT_MODELS = [
  { id: 'gemini_3_8_flash', label: 'Gemini 3.8 Flash', tag: 'Mặc định · Siêu tốc' },
  { id: 'claude_5_5_sonnet', label: 'Claude 5.5 Sonnet', tag: 'UI & Tinh chỉnh' },
  { id: 'gpt_6_1_sol', label: 'GPT-6.1 Sol', tag: 'Lập luận DAG' },
  { id: 'codex_cli', label: 'Codex-CLI', tag: 'Tập lệnh' },
];

export function SettingsModal(props: SettingsModalProps) {
  const {
    isOpen,
    onClose,
    networkSettings: initialNetwork,
    onSaveNetworkSettings,
    toolDependencies: initialTools,
    workspaceStorage,
    appearanceSettings: initialAppearance,
    onSaveAppearanceSettings,
    updateStatus,
    onToggleAgentConnection,
  } = props;

  const [activeTab, setActiveTab] = useState<SettingsTabId>('network');
  const [network, setNetwork] = useState<AINetworkSettings>(initialNetwork);
  const [appearance, setAppearance] = useState<AppearanceSettings>(initialAppearance);
  const [tools, setTools] = useState<ToolDependencyStatus[]>(initialTools);
  const [expandedFallbackAgentId, setExpandedFallbackAgentId] = useState<string | null>(null);
  const [menuOpenAgentId, setMenuOpenAgentId] = useState<string | null>(null);
  const [showKeyAgentId, setShowKeyAgentId] = useState<Record<string, boolean>>({});
  const [inputKeys, setInputKeys] = useState<Record<string, string>>({});
  const [pingStatus, setPingStatus] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'failed'>>({});
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpdateAgent = (agentId: string, updater: (p: AgentSettingsProfile) => AgentSettingsProfile) => {
    setNetwork((prev) => ({
      ...prev,
      agents: prev.agents.map((a) => (a.agent_id === agentId ? updater(a) : a)),
    }));
  };

  const handleTestKey = (agentId: string) => {
    setPingStatus((s) => ({ ...s, [agentId]: 'testing' }));
    setTimeout(() => {
      setPingStatus((s) => ({ ...s, [agentId]: 'ok' }));
      handleUpdateAgent(agentId, (a) => ({
        ...a,
        fallback_api: { ...a.fallback_api, is_valid: true },
      }));
    }, 900);
  };

  const handleSaveKey = (agentId: string) => {
    const raw = inputKeys[agentId];
    if (!raw) return;
    const masked = `${raw.slice(0, 8)}••••••••••••••••${raw.slice(-4)}`;
    handleUpdateAgent(agentId, (a) => ({
      ...a,
      fallback_api: {
        ...a.fallback_api,
        is_configured: true,
        api_key_masked: masked,
        is_valid: true,
      },
    }));
    setInputKeys((s) => ({ ...s, [agentId]: '' }));
    setSaveSuccessNotice(`Đã lưu API Key dự phòng cho ${agentId} vào OS Keychain.`);
    setTimeout(() => setSaveSuccessNotice(null), 3000);
  };

  const handleSaveAll = () => {
    onSaveNetworkSettings(network);
    onSaveAppearanceSettings(appearance);
    setSaveSuccessNotice('Đã lưu cấu hình thành công!');
    setTimeout(() => {
      setSaveSuccessNotice(null);
      onClose();
    }, 700);
  };

  const statusColor = (status: AgentSettingsProfile['connection_status']) => {
    if (status === 'CONNECTED') return '#22c55e';
    if (status === 'OUT_OF_QUOTA') return '#eab308';
    return '#ef4444';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex h-[660px] w-full max-w-[940px] flex-col overflow-hidden rounded-2xl border border-hq-border bg-[#0e1626] shadow-2xl">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-hq-border px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-hq-border bg-white/5 text-hq-accent">
              <IconWrench size={17} />
            </span>
            <div className="flex items-baseline gap-2">
              <h2 className="text-base font-bold text-hq-text">Cài đặt</h2>
              <span className="text-xs text-hq-muted">Synapse OS</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-hq-muted transition hover:bg-white/10 hover:text-hq-text"
            aria-label="Đóng"
          >
            <IconX size={16} />
          </button>
        </header>

        {/* Body (Left sidebar tabs + Right content) */}
        <div className="flex min-h-0 flex-1">
          {/* Tabs Sidebar */}
          <aside className="w-56 shrink-0 border-r border-hq-border bg-[#0a111e]/70 p-3">
            <nav className="flex flex-col gap-1.5 text-xs font-medium">
              <button
                onClick={() => setActiveTab('network')}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition ${
                  activeTab === 'network'
                    ? 'bg-hq-accent font-semibold text-slate-900 shadow-sm'
                    : 'text-hq-muted hover:bg-white/5 hover:text-hq-text'
                }`}
              >
                <IconLayers size={16} />
                <span>Mạng lưới AI</span>
              </button>
              <button
                onClick={() => setActiveTab('tools')}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition ${
                  activeTab === 'tools'
                    ? 'bg-hq-accent font-semibold text-slate-900 shadow-sm'
                    : 'text-hq-muted hover:bg-white/5 hover:text-hq-text'
                }`}
              >
                <IconWrench size={16} />
                <span>Hệ thống & Công cụ</span>
              </button>
              <button
                onClick={() => setActiveTab('appearance')}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition ${
                  activeTab === 'appearance'
                    ? 'bg-hq-accent font-semibold text-slate-900 shadow-sm'
                    : 'text-hq-muted hover:bg-white/5 hover:text-hq-text'
                }`}
              >
                <IconCube size={16} />
                <span>Trải nghiệm & 3D</span>
              </button>
              <button
                onClick={() => setActiveTab('updates')}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition ${
                  activeTab === 'updates'
                    ? 'bg-hq-accent font-semibold text-slate-900 shadow-sm'
                    : 'text-hq-muted hover:bg-white/5 hover:text-hq-text'
                }`}
              >
                <IconRefresh size={16} />
                <span>Bản dựng & Cập nhật</span>
              </button>
            </nav>
          </aside>

          {/* Tab Content Panel */}
          <main className="min-h-0 flex-1 overflow-y-auto p-6">
            {/* ───────────── TAB 1: MẠNG LƯỚI AI ───────────── */}
            {activeTab === 'network' && (
              <div className="flex flex-col gap-5">
                {/* Header Section */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-hq-text">Quản lý Nền tảng & Hạn mức</h3>
                    <p className="text-xs text-hq-muted">Kiểm soát kết nối tài khoản, phiên làm việc và API dự phòng</p>
                  </div>
                  <span className="text-[11px] text-hq-muted">% đã dùng · Số liệu minh hoạ</span>
                </div>

                {/* 1. Default Chat Agent Dropdown Section */}
                <div className="rounded-xl border border-hq-border bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-lg bg-sky-500/15 text-sky-400">
                        <IconTerminal size={15} />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-hq-text">Agent xử lý Chat mặc định</span>
                          <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">
                            Chế độ 01
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-hq-muted">
                          Dùng cho câu hỏi thông thường ở chế độ Chỉ chat. Phản hồi tức thì không qua chia nhỏ DAG.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <div className="relative">
                        <select
                          value={network.default_chat_agent_id}
                          onChange={(e) =>
                            setNetwork((prev) => ({ ...prev, default_chat_agent_id: e.target.value }))
                          }
                          className="appearance-none rounded-lg border border-hq-border bg-[#0a111e] py-1.5 pl-3 pr-8 text-xs font-medium text-hq-text outline-none transition focus:border-hq-accent"
                        >
                          {CHAT_MODELS.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label} ({m.tag})
                            </option>
                          ))}
                        </select>
                        <IconChevronDown
                          size={13}
                          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hq-muted"
                        />
                      </div>
                      <span className="text-[10px] text-hq-muted">Tên model minh hoạ</span>
                    </div>
                  </div>
                </div>

                {/* Status Legend */}
                <div className="flex items-center gap-4 text-[11px] text-hq-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Kết nối
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500" /> Ngắt kết nối
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> Hết quota
                  </span>
                </div>

                {/* Agent Cards List */}
                <div className="flex flex-col gap-3">
                  {network.agents.map((ag) => {
                    const meta = getAgentMeta(ag.agent_id);
                    const isExpanded = expandedFallbackAgentId === ag.agent_id;
                    const isMenuOpen = menuOpenAgentId === ag.agent_id;
                    const isKeyVisible = !!showKeyAgentId[ag.agent_id];
                    const pStatus = pingStatus[ag.agent_id] || 'idle';

                    return (
                      <div
                        key={ag.agent_id}
                        className={`rounded-xl border transition ${
                          isExpanded
                            ? 'border-hq-accent/60 bg-[#0d182b]'
                            : 'border-hq-border bg-white/[0.02] hover:border-hq-border/90'
                        }`}
                      >
                        {/* Agent Main Row */}
                        <div className="flex items-center justify-between p-3.5">
                          {/* Left: Logo & Identity */}
                          <div className="flex min-w-[200px] items-center gap-3">
                            <span
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold shadow-sm"
                              style={{ background: `${meta.color}25`, color: meta.color }}
                            >
                              {meta.glyph}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-hq-text">{ag.display_name}</span>
                              </div>
                              <span className="text-[11px] text-hq-muted">{ag.role_description}</span>
                            </div>
                          </div>

                          {/* Center: Connection Status & Quick Action */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 rounded-full border border-hq-border bg-black/20 px-2.5 py-1 text-[11px]">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ background: statusColor(ag.connection_status) }}
                              />
                              <span className="text-hq-muted">{ag.auth_method}</span>
                            </div>

                            {ag.connection_status === 'CONNECTED' ? (
                              <button
                                onClick={() => onToggleAgentConnection?.(ag.agent_id)}
                                className="rounded-md border border-hq-border px-2.5 py-1 text-[11px] text-hq-muted transition hover:border-rose-500/50 hover:text-rose-300"
                              >
                                Đăng xuất
                              </button>
                            ) : (
                              <button
                                onClick={() => onToggleAgentConnection?.(ag.agent_id)}
                                className="rounded-md border border-hq-accent/50 bg-hq-accent/10 px-2.5 py-1 text-[11px] text-hq-accent transition hover:bg-hq-accent/20"
                              >
                                Kết nối lại
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setSaveSuccessNotice(`Đã làm mới phiên cho ${ag.display_name}.`);
                                setTimeout(() => setSaveSuccessNotice(null), 2500);
                              }}
                              className="rounded-md border border-hq-border px-2.5 py-1 text-[11px] text-hq-muted transition hover:text-hq-text hover:bg-white/5"
                            >
                              Làm mới phiên
                            </button>
                          </div>

                          {/* Right: Quota & [...] Menu */}
                          <div className="flex items-center gap-3">
                            <div className="text-right text-[11px] tabular-nums leading-tight">
                              <div>
                                <span className="text-hq-muted">5h:</span>{' '}
                                <span className="font-semibold text-hq-text">{ag.quota_5h_percent}%</span>
                              </div>
                              <div>
                                <span className="text-hq-muted">Tuần:</span>{' '}
                                <span className="font-semibold text-hq-text">{ag.quota_week_percent}%</span>
                              </div>
                            </div>

                            <div className="relative">
                              <button
                                onClick={() => setMenuOpenAgentId(isMenuOpen ? null : ag.agent_id)}
                                className={`grid h-7 w-7 place-items-center rounded-lg border transition ${
                                  isMenuOpen || isExpanded
                                    ? 'border-hq-accent text-hq-accent bg-hq-accent/10'
                                    : 'border-hq-border text-hq-muted hover:text-hq-text'
                                }`}
                                aria-label="Tùy chọn agent"
                              >
                                <IconDots size={14} />
                              </button>

                              {/* Dropdown Popup */}
                              {isMenuOpen && (
                                <div className="absolute right-0 top-8 z-30 w-44 rounded-xl border border-hq-border bg-[#0b1220] p-1 text-xs shadow-2xl animate-in fade-in zoom-in-95 duration-100">
                                  <button
                                    onClick={() => {
                                      setExpandedFallbackAgentId(isExpanded ? null : ag.agent_id);
                                      setMenuOpenAgentId(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium text-hq-text hover:bg-hq-accent/15 hover:text-hq-accent"
                                  >
                                    <IconKey size={13} className="text-hq-accent" />
                                    <span>API Key dự phòng</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Threshold Slider (when not expanded) */}
                        {!isExpanded && (
                          <div className="flex items-center gap-3 border-t border-hq-border/40 px-4 py-2 text-[11px] text-hq-muted">
                            <span className="w-24 shrink-0">Ngưỡng cảnh báo</span>
                            <input
                              type="range"
                              min={10}
                              max={100}
                              step={5}
                              value={ag.alert_threshold_percent}
                              onChange={(e) =>
                                handleUpdateAgent(ag.agent_id, (p) => ({
                                  ...p,
                                  alert_threshold_percent: Number(e.target.value),
                                }))
                              }
                              className="h-1 flex-1 cursor-pointer accent-emerald-400"
                            />
                            <span className="w-8 text-right font-semibold text-hq-text">
                              {ag.alert_threshold_percent}%
                            </span>
                          </div>
                        )}

                        {/* ──────── 3. Expand Panel: API Key Dự Phòng ──────── */}
                        {isExpanded && (
                          <div className="border-t border-hq-border bg-black/30 p-4 animate-in slide-in-from-top-2 duration-150">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <IconKey size={15} className="text-hq-accent" />
                                <h4 className="text-xs font-bold text-hq-text">API Key dự phòng</h4>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px]">
                                {ag.fallback_api.is_valid ? (
                                  <span className="flex items-center gap-1 text-emerald-400">
                                    <IconCheck size={13} /> Kết nối hợp lệ · Minh hoạ
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-hq-muted">
                                    <IconInfo size={13} /> Chưa xác thực
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Row 1: Toggle use_fallback_on_error */}
                            <div className="mt-3 flex items-center justify-between rounded-lg border border-hq-border/60 bg-white/[0.02] px-3 py-2">
                              <div>
                                <span className="text-xs font-medium text-hq-text">
                                  Dùng API khi phiên chính lỗi
                                </span>
                                <p className="text-[10px] text-hq-muted">
                                  Tự động kích hoạt khi tài khoản hết hạn mức 5h hoặc ngắt phiên kết nối.
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="relative inline-flex cursor-pointer items-center">
                                  <input
                                    type="checkbox"
                                    checked={ag.fallback_api.use_fallback_on_error}
                                    onChange={(e) =>
                                      handleUpdateAgent(ag.agent_id, (p) => ({
                                        ...p,
                                        fallback_api: {
                                          ...p.fallback_api,
                                          use_fallback_on_error: e.target.checked,
                                        },
                                      }))
                                    }
                                    className="peer sr-only"
                                  />
                                  <div className="h-5 w-9 rounded-full bg-hq-border peer-checked:bg-hq-accent after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-slate-900 after:transition-all peer-checked:after:translate-x-full" />
                                </label>
                                <span className="text-[10px] text-hq-muted">
                                  {ag.fallback_api.is_configured ? 'Đã bật' : 'Chỉ bật khi đã cấu hình'}
                                </span>
                              </div>
                            </div>

                            {/* Row 2: API Key input */}
                            <div className="mt-3">
                              <label className="mb-1 block text-[11px] font-medium text-hq-muted">
                                Khóa API (Bearer Token / Secret Key)
                              </label>
                              <div className="relative flex items-center">
                                <input
                                  type={isKeyVisible ? 'text' : 'password'}
                                  placeholder={
                                    ag.fallback_api.api_key_masked || 'sk-proj-••••••••••••••••••••••••'
                                  }
                                  value={inputKeys[ag.agent_id] ?? ''}
                                  onChange={(e) =>
                                    setInputKeys((s) => ({ ...s, [ag.agent_id]: e.target.value }))
                                  }
                                  className="w-full rounded-lg border border-hq-border bg-[#0a111e] py-1.5 pl-3 pr-9 font-mono text-xs text-hq-text outline-none transition focus:border-hq-accent"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowKeyAgentId((s) => ({ ...s, [ag.agent_id]: !isKeyVisible }))
                                  }
                                  className="absolute right-2.5 text-hq-muted hover:text-hq-text"
                                  aria-label={isKeyVisible ? 'Ẩn key' : 'Xem key'}
                                >
                                  {isKeyVisible ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                                </button>
                              </div>
                            </div>

                            {/* Row 3: Security & Actions */}
                            <div className="mt-3 flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-[11px] text-hq-muted">
                                <IconLock size={13} className="text-emerald-400" />
                                <span>Lưu trong kho bảo mật hệ điều hành.</span>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleTestKey(ag.agent_id)}
                                  disabled={pStatus === 'testing'}
                                  className="flex items-center gap-1.5 rounded-lg border border-hq-border px-3 py-1 text-xs text-hq-text transition hover:bg-white/10"
                                >
                                  {pStatus === 'testing' ? (
                                    <>
                                      <IconSpinner size={12} /> Đang kiểm tra...
                                    </>
                                  ) : (
                                    'Kiểm tra kết nối'
                                  )}
                                </button>

                                <button
                                  onClick={() => handleSaveKey(ag.agent_id)}
                                  className="rounded-lg bg-hq-accent px-3.5 py-1 text-xs font-semibold text-slate-900 transition hover:brightness-110"
                                >
                                  Lưu key
                                </button>
                              </div>
                            </div>

                            {/* Row 4: Yellow Cost Warning */}
                            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-amber-400">
                              <IconAlert size={13} />
                              <span>API có chi phí riêng (sử dụng tín dụng tài khoản nhà cung cấp, không phải luồng miễn phí).</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Add Agent Action */}
                <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-hq-border py-2.5 text-xs font-medium text-hq-muted transition hover:border-hq-accent/50 hover:text-hq-accent hover:bg-hq-accent/5">
                  <span>+ Thêm AI mở rộng (Plug & Play)</span>
                </button>
              </div>
            )}

            {/* ───────────── TAB 2: HỆ THỐNG & CÔNG CỤ ───────────── */}
            {activeTab === 'tools' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="text-sm font-semibold text-hq-text">Hệ thống & Công cụ Cục bộ</h3>
                  <p className="text-xs text-hq-muted">
                    Kiến trúc Lõi Rỗng (Hollow Core) — công cụ nặng được tải động vào thư mục .plugins khi cần
                  </p>
                </div>

                {/* Local Tools List */}
                <div className="flex flex-col gap-3">
                  <h4 className="text-xs font-semibold text-hq-text">Công cụ Lazy-Load (.plugins/)</h4>
                  {tools.map((t) => (
                    <div
                      key={t.tool_id}
                      className="flex items-center justify-between rounded-xl border border-hq-border bg-white/[0.02] p-3.5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-500/15 text-sky-300">
                          <IconWrench size={16} />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-hq-text">{t.tool_name}</span>
                            <span className="text-[10px] text-hq-muted">({t.size_mb} MB)</span>
                          </div>
                          <span className="text-[11px] text-hq-muted">
                            {t.is_installed ? 'Đã cài đặt sẵn sàng sử dụng' : 'Chưa tải (Tự động tải khi có task)'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {t.is_installed ? (
                          <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] text-emerald-300">
                            <IconCheck size={12} /> Đã sẵn sàng
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setTools((prev) =>
                                prev.map((item) =>
                                  item.tool_id === t.tool_id ? { ...item, is_installed: true } : item
                                )
                              );
                              setSaveSuccessNotice(`Đã tải và xác thực ${t.tool_name}.`);
                              setTimeout(() => setSaveSuccessNotice(null), 3000);
                            }}
                            className="rounded-lg border border-hq-accent/50 bg-hq-accent/10 px-3 py-1 text-xs text-hq-accent transition hover:bg-hq-accent/20"
                          >
                            Tải trước
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Storage Info */}
                <div className="rounded-xl border border-hq-border bg-white/[0.02] p-4">
                  <h4 className="text-xs font-semibold text-hq-text">Dung lượng Không gian Làm việc</h4>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-hq-border/70 bg-black/20 p-2.5 text-center">
                      <span className="text-[10px] text-hq-muted">Tổng dung lượng</span>
                      <p className="mt-1 text-sm font-bold text-hq-text">{workspaceStorage.total_used_mb} MB</p>
                    </div>
                    <div className="rounded-lg border border-hq-border/70 bg-black/20 p-2.5 text-center">
                      <span className="text-[10px] text-hq-muted">Lõi ứng dụng</span>
                      <p className="mt-1 text-sm font-bold text-hq-text">{workspaceStorage.core_app_mb} MB</p>
                    </div>
                    <div className="rounded-lg border border-hq-border/70 bg-black/20 p-2.5 text-center">
                      <span className="text-[10px] text-hq-muted">Tệp tạm (.plugins)</span>
                      <p className="mt-1 text-sm font-bold text-hq-text">{workspaceStorage.temp_files_mb} MB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSaveSuccessNotice('Đã dọn dẹp bộ nhớ đệm và tệp tạm.');
                      setTimeout(() => setSaveSuccessNotice(null), 2500);
                    }}
                    className="mt-3 rounded-lg border border-hq-border px-3 py-1 text-xs text-hq-muted transition hover:bg-white/5 hover:text-hq-text"
                  >
                    Dọn dẹp tệp tạm
                  </button>
                </div>
              </div>
            )}

            {/* ───────────── TAB 3: TRẢI NGHIỆM & 3D ───────────── */}
            {activeTab === 'appearance' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="text-sm font-semibold text-hq-text">Trải nghiệm & Văn phòng 3D</h3>
                  <p className="text-xs text-hq-muted">Cấu hình hiển thị mô hình isometric, luồng sáng và âm thanh</p>
                </div>

                {/* 3D Performance */}
                <div className="rounded-xl border border-hq-border bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-hq-text">Hiệu năng Văn phòng 3D</span>
                      <p className="text-[11px] text-hq-muted">Chọn tốc độ khung hình và hoạt ảnh đồ họa</p>
                    </div>
                    <select
                      value={appearance.office_3d_performance}
                      onChange={(e) =>
                        setAppearance((prev) => ({
                          ...prev,
                          office_3d_performance: e.target.value as any,
                        }))
                      }
                      className="rounded-lg border border-hq-border bg-[#0a111e] px-3 py-1.5 text-xs font-medium text-hq-text outline-none focus:border-hq-accent"
                    >
                      <option value="HIGH_60FPS">Mượt mà (60 FPS)</option>
                      <option value="POWER_SAVE_30FPS">Tiết kiệm pin (30 FPS)</option>
                    </select>
                  </div>
                </div>

                {/* Visual Toggles */}
                <div className="flex flex-col gap-2 rounded-xl border border-hq-border bg-white/[0.02] p-4">
                  <h4 className="text-xs font-semibold text-hq-text">Hiệu ứng Đồ họa</h4>

                  <div className="flex items-center justify-between py-2 border-b border-hq-border/40">
                    <div>
                      <span className="text-xs font-medium text-hq-text">Luồng sáng giao việc (Light Trails)</span>
                      <p className="text-[10px] text-hq-muted">Tia laser chạy từ phòng Quản lý dọc hành lang trung tâm tới phòng agent</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={appearance.enable_light_trails}
                        onChange={(e) =>
                          setAppearance((prev) => ({ ...prev, enable_light_trails: e.target.checked }))
                        }
                        className="peer sr-only"
                      />
                      <div className="h-5 w-9 rounded-full bg-hq-border peer-checked:bg-hq-accent after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-slate-900 after:transition-all peer-checked:after:translate-x-full" />
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-hq-border/40">
                    <div>
                      <span className="text-xs font-medium text-hq-text">Bóng đổ thời gian thực (Real-time Shadows)</span>
                      <p className="text-[10px] text-hq-muted">Hiển thị bóng đổ isometric cho nhân vật và bàn làm việc</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={appearance.enable_realtime_shadows}
                        onChange={(e) =>
                          setAppearance((prev) => ({ ...prev, enable_realtime_shadows: e.target.checked }))
                        }
                        className="peer sr-only"
                      />
                      <div className="h-5 w-9 rounded-full bg-hq-border peer-checked:bg-hq-accent after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-slate-900 after:transition-all peer-checked:after:translate-x-full" />
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div>
                      <span className="text-xs font-medium text-hq-text">Âm thanh hoàn tất tác vụ</span>
                      <p className="text-[10px] text-hq-muted">Phát tiếng chuông nhẹ khi một DAG task kết thúc</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={appearance.enable_task_sound}
                        onChange={(e) =>
                          setAppearance((prev) => ({ ...prev, enable_task_sound: e.target.checked }))
                        }
                        className="peer sr-only"
                      />
                      <div className="h-5 w-9 rounded-full bg-hq-border peer-checked:bg-hq-accent after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-slate-900 after:transition-all peer-checked:after:translate-x-full" />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ───────────── TAB 4: BẢN DỰNG & CẬP NHẬT ───────────── */}
            {activeTab === 'updates' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="text-sm font-semibold text-hq-text">Bản dựng & Tự Nâng cấp Bóng Ma</h3>
                  <p className="text-xs text-hq-muted">Kiến trúc Blue-Green Self-Evolution đảm bảo an toàn tuyệt đối</p>
                </div>

                <div className="rounded-xl border border-hq-border bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-hq-text">Phiên bản hiện tại</span>
                      <p className="mt-0.5 text-sm font-bold text-hq-accent">{updateStatus.current_version}</p>
                    </div>
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">
                      Đang chạy Production
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-hq-border bg-black/20 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-lg bg-hq-accent/15 text-hq-accent">
                      <IconShield size={16} />
                    </span>
                    <div>
                      <span className="text-xs font-semibold text-hq-text">Cơ chế Bảo vệ Blue-Green</span>
                      <p className="mt-1 text-[11px] text-hq-muted leading-relaxed">
                        Hệ thống cấm sửa mã nguồn Production đang chạy. Khi có lệnh nâng cấp, ứng dụng tự động clone sang .workspace/synapse-os-dev/ để chạy kiểm thử. Chỉ khi kiểm thử đạt 100% mới xuất thông báo chuyển giao.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-hq-border/40 pt-3 text-xs">
                    <span className="text-hq-muted">Trạng thái bản dev:</span>
                    <span className="font-medium text-hq-text">
                      {updateStatus.has_dev_build_ready
                        ? `Đã có bản dựng mới: ${updateStatus.dev_build_version}`
                        : 'Hệ thống đang chạy ổn định. Chưa có bản cập nhật dev.'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSaveSuccessNotice('Đang kiểm tra kho lưu trữ... Hệ thống đang ở bản mới nhất.');
                    setTimeout(() => setSaveSuccessNotice(null), 3000);
                  }}
                  className="flex w-fit items-center gap-2 rounded-lg border border-hq-border px-4 py-2 text-xs font-medium text-hq-text transition hover:bg-white/5"
                >
                  <IconRefresh size={14} /> Kiểm tra bản cập nhật
                </button>
              </div>
            )}
          </main>
        </div>

        {/* Footer */}
        <footer className="flex h-14 shrink-0 items-center justify-between border-t border-hq-border bg-[#0a111e]/80 px-6">
          <div className="text-xs">
            {saveSuccessNotice && (
              <span className="flex items-center gap-1.5 font-medium text-hq-accent animate-in fade-in duration-150">
                <IconCheck size={14} /> {saveSuccessNotice}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-hq-border px-4 py-1.5 text-xs font-medium text-hq-muted transition hover:bg-white/5 hover:text-hq-text"
            >
              Hủy
            </button>
            <button
              onClick={handleSaveAll}
              className="rounded-lg bg-hq-accent px-5 py-1.5 text-xs font-semibold text-slate-900 transition hover:brightness-110 shadow-sm"
            >
              Lưu thay đổi
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
