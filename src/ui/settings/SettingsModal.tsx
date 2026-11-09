import { useState } from 'react';
import type {
  AgentId,
  AINetworkSettings,
  AgentSettingsProfile,
  ToolDependencyStatus,
  WorkspaceStorageInfo,
  AppearanceSettings,
  UpdateStatus,
} from '@shared/types';
import {
  IconCheck,
  IconEye,
  IconEyeOff,
  IconGraph,
  IconKey,
  IconLayers,
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
  toolDependencies: ToolDependencyStatus[];
  workspaceStorage: WorkspaceStorageInfo;
  appearanceSettings: AppearanceSettings;
  onSaveAppearanceSettings?: (settings: AppearanceSettings) => void;
  updateStatus: UpdateStatus;
  // Real IPC bridge action handlers
  onAgentConnectionAction?: (agentId: AgentId, action: 'CONNECT' | 'DISCONNECT' | 'REFRESH' | 'CHECK_CLI' | 'CHECK_API') => Promise<AgentSettingsProfile>;
  onSetFallbackOnError?: (agentId: AgentId, enabled: boolean) => Promise<AgentSettingsProfile>;
  onSetAgentAlertThreshold?: (agentId: AgentId, percent: number) => Promise<AgentSettingsProfile>;
  onSaveAgentKey?: (agentId: AgentId, key: string) => Promise<void>;
  onSetDefaultChatAgent?: (agentId: string) => Promise<AINetworkSettings>;
  onEnsureToolDependency?: (toolId: ToolDependencyStatus['tool_id']) => Promise<ToolDependencyStatus>;
}

export function SettingsModal(props: SettingsModalProps) {
  const {
    isOpen,
    onClose,
    networkSettings,
    toolDependencies,
    workspaceStorage,
    appearanceSettings,
    onSaveAppearanceSettings,
    updateStatus,
    onAgentConnectionAction,
    onSetFallbackOnError,
    onSetAgentAlertThreshold,
    onSaveAgentKey,
    onSetDefaultChatAgent,
    onEnsureToolDependency,
  } = props;

  const [activeTab, setActiveTab] = useState<SettingsTabId>('network');
  const [expandedFallbackAgentId, setExpandedFallbackAgentId] = useState<string | null>(null);
  const [showKeyAgentId, setShowKeyAgentId] = useState<Record<string, boolean>>({});
  const [inputKeys, setInputKeys] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, string | null>>({});
  const [notification, setNotification] = useState<string | null>(null);

  // Local copy of appearance settings for editing
  const [localAppearance, setLocalAppearance] = useState<AppearanceSettings>(appearanceSettings);

  if (!isOpen) return null;

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleConnectionAction = async (agentId: AgentId, action: 'CONNECT' | 'DISCONNECT' | 'REFRESH' | 'CHECK_CLI' | 'CHECK_API') => {
    setActionLoading((s) => ({ ...s, [agentId]: action }));
    try {
      if (!onAgentConnectionAction) throw new Error('Chưa có kết nối với ứng dụng Electron.');
      const profile = await onAgentConnectionAction(agentId, action);
      if (action === 'CHECK_API') {
        showNotice(profile.fallback_api.is_valid ? `✓ API Key của ${agentId.toUpperCase()} hợp lệ.` : 'Nhà cung cấp không chấp nhận API key đã lưu.');
      } else if (action === 'CHECK_CLI') {
        showNotice(profile.connection_status === 'DISCONNECTED' ? `${agentId.toUpperCase()} chưa đăng nhập.` : `Đã xác nhận phiên ${agentId.toUpperCase()}.`);
      } else if (action === 'DISCONNECT') {
        showNotice(`Đã ngắt kết nối phiên làm việc của ${agentId.toUpperCase()}.`);
      } else if (action === 'CONNECT') {
        showNotice(`Đã kết nối thành công tới ${agentId.toUpperCase()}.`);
      } else if (action === 'REFRESH') {
        showNotice(profile.connection_status === 'DISCONNECTED' ? `${agentId.toUpperCase()} chưa đăng nhập.` : `Đã cập nhật trạng thái ${agentId.toUpperCase()}.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Thao tác không thành công';
      showNotice(message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''));
    } finally {
      setActionLoading((s) => ({ ...s, [agentId]: null }));
    }
  };

  const handleToggleFallback = async (agentId: AgentId, currentEnabled: boolean) => {
    const next = !currentEnabled;
    try {
      if (onSetFallbackOnError) {
        await onSetFallbackOnError(agentId, next);
      }
      showNotice(`Đã ${next ? 'bật' : 'tắt'} chế độ dùng API dự phòng khi gặp lỗi cho ${agentId}.`);
    } catch (err: any) {
      showNotice(`Không thể đổi trạng thái dự phòng: ${err?.message}`);
    }
  };

  const handleSaveKey = async (agentId: AgentId) => {
    const key = inputKeys[agentId]?.trim();
    if (!key) {
      showNotice('Vui lòng nhập API Key hợp lệ trước khi lưu.');
      return;
    }
    setActionLoading((s) => ({ ...s, [`${agentId}_key`]: 'saving' }));
    try {
      if (onSaveAgentKey) {
        await onSaveAgentKey(agentId, key);
      }
      setInputKeys((s) => ({ ...s, [agentId]: '' }));
      showNotice(`Đã mã hoá và lưu API Key dự phòng cho ${agentId.toUpperCase()} vào OS Keychain.`);
    } catch (err: any) {
      showNotice(`Lỗi lưu API Key: ${err?.message}`);
    } finally {
      setActionLoading((s) => ({ ...s, [`${agentId}_key`]: null }));
    }
  };

  const handleSaveAll = () => {
    if (onSaveAppearanceSettings) {
      onSaveAppearanceSettings(localAppearance);
    }
    showNotice('Đã lưu tất cả thay đổi cấu hình thành công!');
    setTimeout(() => {
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* 1. Dark Graph Grid & Node Cluster Backdrop (02 & 03 Cài đặt.svg) */}
      <div className="absolute inset-0 bg-[#080E18] overflow-hidden select-none">
        <svg
          className="w-full h-full opacity-60"
          preserveAspectRatio="none"
          viewBox="0 0 1440 900"
          fill="none"
        >
          {/* 32px grid lines */}
          <path
            opacity="0.55"
            d="M32 0V900M64 0V900M96 0V900M128 0V900M160 0V900M192 0V900M224 0V900M256 0V900M288 0V900M320 0V900M352 0V900M384 0V900M416 0V900M448 0V900M480 0V900M512 0V900M544 0V900M576 0V900M608 0V900M640 0V900M672 0V900M704 0V900M736 0V900M768 0V900M800 0V900M832 0V900M864 0V900M896 0V900M928 0V900M960 0V900M992 0V900M1024 0V900M1056 0V900M1088 0V900M1120 0V900M1152 0V900M1184 0V900M1216 0V900M1248 0V900M1280 0V900M1312 0V900M1344 0V900M1376 0V900M1408 0V900M0 32H1440M0 64H1440M0 96H1440M0 128H1440M0 160H1440M0 192H1440M0 224H1440M0 256H1440M0 288H1440M0 320H1440M0 352H1440M0 384H1440M0 416H1440M0 448H1440M0 480H1440M0 512H1440M0 544H1440M0 576H1440M0 608H1440M0 640H1440M0 672H1440M0 704H1440M0 736H1440M0 768H1440M0 800H1440M0 832H1440M0 864H1440M0 896H1440"
            stroke="#1A2A3D"
          />
          {/* Constellation connectors and node circles */}
          <path opacity="0.35" d="M32 674L140 500" stroke="#3D526D" />
          <circle opacity="0.35" cx="140.5" cy="500.5" r="3.5" fill="#58E9A8" />
          <path opacity="0.35" d="M140 500L256 630" stroke="#A88BFA" />
          <circle opacity="0.35" cx="256.5" cy="630.5" r="3.5" fill="#A88BFA" />
          <path opacity="0.35" d="M256 630L381 306" stroke="#3D526D" />
          <circle opacity="0.35" cx="381.5" cy="306.5" r="3.5" fill="#58E9A8" />
          <path opacity="0.35" d="M381 306L657 408" stroke="#A88BFA" />
          <circle opacity="0.35" cx="657.5" cy="408.5" r="3.5" fill="#A88BFA" />
          <path opacity="0.35" d="M657 408L877 267" stroke="#3D526D" />
          <circle opacity="0.35" cx="877.5" cy="267.5" r="3.5" fill="#58E9A8" />
          <path opacity="0.35" d="M877 267L1065 402" stroke="#A88BFA" />
          <circle opacity="0.35" cx="1065.5" cy="402.5" r="3.5" fill="#A88BFA" />
          <path opacity="0.35" d="M1065 402L1268 206" stroke="#3D526D" />
          <circle opacity="0.35" cx="1268.5" cy="206.5" r="3.5" fill="#58E9A8" />
          <path opacity="0.35" d="M1268 206L1410 354" stroke="#A88BFA" />
          <circle opacity="0.35" cx="1410.5" cy="354.5" r="3.5" fill="#A88BFA" />
          <path opacity="0.35" d="M1410 354L1290 695" stroke="#3D526D" />
          <circle opacity="0.35" cx="1290.5" cy="695.5" r="3.5" fill="#58E9A8" />
          <path opacity="0.35" d="M1290 695L1370 788" stroke="#A88BFA" />
          <circle opacity="0.35" cx="1370.5" cy="788.5" r="3.5" fill="#A88BFA" />
          <path opacity="0.35" d="M1370 788L1080 810" stroke="#3D526D" />
          <circle opacity="0.35" cx="1080.5" cy="810.5" r="3.5" fill="#58E9A8" />
          <path opacity="0.35" d="M1080 810L895 710" stroke="#A88BFA" />
          <circle opacity="0.35" cx="895.5" cy="710.5" r="3.5" fill="#A88BFA" />
          <path opacity="0.35" d="M895 710L408 782" stroke="#3D526D" />
          <circle opacity="0.35" cx="408.5" cy="782.5" r="3.5" fill="#58E9A8" />
          <path opacity="0.35" d="M408 782L186 810" stroke="#A88BFA" />
          <circle opacity="0.35" cx="186.5" cy="810.5" r="3.5" fill="#A88BFA" />
        </svg>
        <div className="absolute inset-0 bg-[#080E18]/70 backdrop-blur-[2px]" />
      </div>

      {/* 2. Main Modal Card (Exact 980px x 704px, #0E1725, #23344A border) */}
      <div className="relative z-10 flex h-[704px] w-full max-w-[980px] flex-col overflow-hidden rounded-[16px] border border-[#23344A] bg-[#0E1725] shadow-2xl">
        {/* Header (02 & 03 Cài đặt.svg) */}
        <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-[#23344A] px-6 bg-[#0E1725]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center text-[#58E9A8]">
              <IconWrench size={16} />
            </span>
            <div className="flex items-baseline gap-1.5 font-medium">
              <span className="text-[15px] font-semibold text-[#EAF2FF]">Cài đặt</span>
              <span className="text-[13px] text-[#8297B2]">/ Synapse OS</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#8297B2] transition hover:bg-[#142235] hover:text-[#EAF2FF]"
            aria-label="Đóng"
          >
            <IconX size={15} />
          </button>
        </header>

        {/* Body Layout: Left Menu (220px) + Right Content */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Left Menu Tabs */}
          <aside className="w-[220px] shrink-0 border-r border-[#23344A] bg-[#0A1220]/60 p-3 select-none">
            <nav className="flex flex-col gap-1.5 text-[13px]">
              <button
                type="button"
                onClick={() => setActiveTab('network')}
                className={`flex h-[38px] items-center gap-2.5 rounded-[8px] px-3 font-medium transition ${
                  activeTab === 'network'
                    ? 'border border-[#58E9A8] bg-[#142235] text-[#58E9A8]'
                    : 'text-[#9DB0C8] hover:border-[#405672] hover:bg-[#142235]/50 hover:text-[#EAF2FF]'
                }`}
              >
                <IconShield size={15} />
                <span>Mạng lưới AI</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('tools')}
                className={`flex h-[38px] items-center gap-2.5 rounded-[8px] px-3 font-medium transition ${
                  activeTab === 'tools'
                    ? 'border border-[#58E9A8] bg-[#142235] text-[#58E9A8]'
                    : 'text-[#9DB0C8] hover:border-[#405672] hover:bg-[#142235]/50 hover:text-[#EAF2FF]'
                }`}
              >
                <IconTerminal size={15} />
                <span>Hệ thống & Công cụ</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('appearance')}
                className={`flex h-[38px] items-center gap-2.5 rounded-[8px] px-3 font-medium transition ${
                  activeTab === 'appearance'
                    ? 'border border-[#58E9A8] bg-[#142235] text-[#58E9A8]'
                    : 'text-[#9DB0C8] hover:border-[#405672] hover:bg-[#142235]/50 hover:text-[#EAF2FF]'
                }`}
              >
                <IconGraph size={15} />
                <span>Trải nghiệm & Đồ thị</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('updates')}
                className={`flex h-[38px] items-center gap-2.5 rounded-[8px] px-3 font-medium transition ${
                  activeTab === 'updates'
                    ? 'border border-[#58E9A8] bg-[#142235] text-[#58E9A8]'
                    : 'text-[#9DB0C8] hover:border-[#405672] hover:bg-[#142235]/50 hover:text-[#EAF2FF]'
                }`}
              >
                <IconLayers size={15} />
                <span>Bản dựng & Cập nhật</span>
              </button>
            </nav>
          </aside>

          {/* Right Tab Content Viewport */}
          <main className="flex-1 overflow-y-auto p-5 scrollbar-thin">
            {/* TAB 1: MẠNG LƯỚI AI (02 & 03 Cài đặt.svg) */}
            {activeTab === 'network' && (
              <div className="flex flex-col gap-4">
                {/* Section Header */}
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-[15px] font-semibold text-[#EAF2FF]">
                    Quản lý nền tảng & hạn mức
                  </h3>
                  <p className="text-[12px] text-[#8297B2]">
                    Kết nối agent, chọn cấu hình mặc định và đặt phương án dự phòng.
                  </p>
                </div>

                {/* Default Chat Agent Selector Bar */}
                <div className="flex items-center justify-between rounded-[10px] border border-[#23344A] bg-[#0A1220] p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#23344A] bg-[#142235] text-[#58E9A8]">
                      💬
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium text-[#EAF2FF]">
                        Agent xử lý chat mặc định
                      </span>
                      <span className="text-[11.5px] text-[#8297B2]">
                        Áp dụng khi ở chế độ Chỉ chat.
                      </span>
                    </div>
                  </div>

                  <select
                    value={networkSettings.default_chat_agent_id}
                    onChange={(e) => {
                      if (onSetDefaultChatAgent) {
                        onSetDefaultChatAgent(e.target.value);
                      }
                      showNotice(`Đã chuyển Agent chat mặc định sang ${e.target.value}.`);
                    }}
                    className="h-8 rounded-[6px] border border-[#405672] bg-[#142235] px-3 text-[12px] font-medium text-[#EAF2FF] focus:border-[#58E9A8] focus:outline-none"
                  >
                    <option value="gemini_antigravity">Gemini · Antigravity</option>
                    <option value="chatgpt">ChatGPT · Điều phối</option>
                    <option value="claude">Claude · Agent công ty</option>
                    <option value="codex">Codex · CLI</option>
                  </select>
                </div>

                {/* Status legend */}
                <div className="flex items-center gap-4 text-[11.5px] text-[#9DB0C8]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#58E9A8]" />
                    <span>Kết nối</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#FF806E]" />
                    <span>Ngắt kết nối</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#FFC075]" />
                    <span>Hết quota</span>
                  </span>
                </div>

                {/* Agent Cards (ChatGPT, Gemini, Codex, Claude) */}
                <div className="flex flex-col gap-3">
                  {networkSettings.agents.map((agent) => {
                    const meta = getAgentMeta(agent.agent_id);
                    const isExpanded = expandedFallbackAgentId === agent.agent_id;
                    const isConnected = agent.connection_status !== 'DISCONNECTED';
                    const isShowKey = showKeyAgentId[agent.agent_id];
                    const rawInputKey = inputKeys[agent.agent_id] || '';
                    const isLoading = actionLoading[agent.agent_id];

                    return (
                      <div
                        key={agent.agent_id}
                        className="flex flex-col rounded-[12px] border border-[#23344A] bg-[#0A1220] p-4 transition-all"
                      >
                        {/* Agent Card Top Row */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span
                              className="flex h-9 w-9 items-center justify-center rounded-[8px] text-[13px] font-bold"
                              style={{
                                backgroundColor: `${meta.color}20`,
                                color: meta.color,
                                border: `1px solid ${meta.color}40`,
                              }}
                            >
                              {meta.label.slice(0, 2).toUpperCase()}
                            </span>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="text-[13.5px] font-semibold text-[#EAF2FF]">
                                  {agent.display_name}
                                </span>
                                <span className="text-[12px] text-[#8297B2]">
                                  ({agent.role_description})
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[11.5px]">
                                <span
                                  className="flex items-center gap-1 font-medium"
                                  style={{
                                    color: isConnected ? '#58E9A8' : '#8297B2',
                                  }}
                                >
                                  • {agent.auth_method}
                                </span>
                                <span className="text-[#8297B2]">
                                  5h {agent.quota_5h_percent === null ? '—' : `${agent.quota_5h_percent}%`} · Tuần {agent.quota_week_percent === null ? '—' : `${agent.quota_week_percent}%`}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons Right */}
                          <div className="flex items-center gap-2">
                            {/* CLI Agent Button */}
                            {agent.agent_id === 'gemini' && (
                              <button
                                type="button"
                                disabled={Boolean(isLoading)}
                                onClick={() => handleConnectionAction('gemini', 'CHECK_CLI')}
                                className="flex h-7 items-center gap-1.5 rounded-[6px] border border-[#23344A] bg-[#142235] px-3 text-[11.5px] font-medium text-[#EAF2FF] transition hover:border-[#58E9A8]"
                              >
                                {isLoading === 'CHECK_CLI' ? (
                                  <span className="animate-spin text-[#58E9A8]">
                                    <IconSpinner size={12} />
                                  </span>
                                ) : null}
                                <span>Kiểm tra CLI</span>
                              </button>
                            )}

                            {/* ChatGPT Refresh Button */}
                            {agent.agent_id === 'chatgpt' && isConnected && (
                              <button
                                type="button"
                                disabled={Boolean(isLoading)}
                                onClick={() => handleConnectionAction('chatgpt', 'REFRESH')}
                                className="flex h-7 items-center gap-1.5 rounded-[6px] border border-[#23344A] bg-[#142235] px-3 text-[11.5px] font-medium text-[#EAF2FF] transition hover:border-[#58E9A8]"
                                title="Làm mới token"
                              >
                                {isLoading === 'REFRESH' ? (
                                  <span className="animate-spin text-[#58E9A8]">
                                    <IconSpinner size={12} />
                                  </span>
                                ) : (
                                  <IconRefresh size={12} />
                                )}
                                <span>Làm mới</span>
                              </button>
                            )}

                            {/* Connect / Disconnect button */}
                            {isConnected ? (
                              <button
                                type="button"
                                disabled={Boolean(isLoading)}
                                onClick={() => handleConnectionAction(agent.agent_id, 'DISCONNECT')}
                                className="flex h-7 items-center rounded-[6px] border border-[#23344A] bg-[#142235] px-3 text-[11.5px] font-medium text-[#9DB0C8] transition hover:border-[#FF806E] hover:text-[#FF806E]"
                              >
                                {isLoading === 'DISCONNECT' ? 'Đang ngắt...' : 'Đăng xuất'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={Boolean(isLoading)}
                                onClick={() => handleConnectionAction(agent.agent_id, 'CONNECT')}
                                className="flex h-7 items-center rounded-[6px] bg-[#58E9A8] px-3 text-[11.5px] font-semibold text-[#080E18] transition hover:brightness-110"
                              >
                                {isLoading === 'CONNECT' ? 'Đang kết nối...' : 'Kết nối'}
                              </button>
                            )}

                            {/* Key / ••• toggle expandable Fallback API Key */}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedFallbackAgentId(isExpanded ? null : agent.agent_id)
                              }
                              className={`flex h-7 w-7 items-center justify-center rounded-[6px] border transition ${
                                isExpanded
                                  ? 'border-[#58E9A8] bg-[#142235] text-[#58E9A8]'
                                  : 'border-[#23344A] bg-[#142235] text-[#8297B2] hover:text-[#EAF2FF]'
                              }`}
                              title="Cấu hình API Key dự phòng"
                            >
                              <IconKey size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Slider Ngưỡng cảnh báo (02 Cài đặt · Mạng lưới AI.svg) */}
                        <div className="mt-3 flex items-center justify-between border-t border-[#1A2A3D] pt-3 text-[11.5px]">
                          <span className="text-[#8297B2]">
                            Ngưỡng cảnh báo quota: <b className="text-[#58E9A8]">{agent.alert_threshold_percent ?? 80}%</b>
                          </span>
                          <input
                            type="range"
                            min="50"
                            max="95"
                            step="5"
                            value={agent.alert_threshold_percent ?? 80}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (onSetAgentAlertThreshold) {
                                onSetAgentAlertThreshold(agent.agent_id, val);
                              }
                            }}
                            className="h-1.5 w-44 cursor-pointer accent-[#58E9A8]"
                          />
                        </div>

                        {/* EXPANDABLE FALLBACK API KEY CARD (03 Cài đặt · API Key dự phòng.svg) */}
                        {isExpanded && (
                          <div className="mt-3.5 flex flex-col gap-3 rounded-[10px] border border-[#23344A] bg-[#0E1725] p-3.5 animate-in slide-in-from-top-2 duration-150">
                            {/* Row 1: Title + Status */}
                            <div className="flex items-center justify-between">
                              <span className="text-[12.5px] font-semibold text-[#EAF2FF]">
                                API Key dự phòng
                              </span>
                              <span
                                className={`flex items-center gap-1 text-[11.5px] font-medium ${
                                  agent.fallback_api.is_valid ? 'text-[#58E9A8]' : 'text-[#8297B2]'
                                }`}
                              >
                                {agent.fallback_api.is_valid ? (
                                  <>
                                    <IconCheck size={13} />
                                    <span>Kết nối hợp lệ</span>
                                  </>
                                ) : (
                                  <span>Chưa cấu hình</span>
                                )}
                              </span>
                            </div>

                            {/* Row 2: Toggle fallback on error */}
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] text-[#9DB0C8]">
                                Dùng API khi phiên chính gặp lỗi
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleFallback(
                                    agent.agent_id,
                                    agent.fallback_api.use_fallback_on_error
                                  )
                                }
                                className={`relative h-5 w-9 rounded-full transition-colors ${
                                  agent.fallback_api.use_fallback_on_error
                                    ? 'bg-[#58E9A8]'
                                    : 'bg-[#23344A]'
                                }`}
                              >
                                <span
                                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-[#080E18] transition-transform ${
                                    agent.fallback_api.use_fallback_on_error
                                      ? 'translate-x-4'
                                      : 'translate-x-0.5'
                                  }`}
                                />
                              </button>
                            </div>

                            {/* Row 3: API Key input with password masking & eye toggle */}
                            <div className="flex flex-col gap-1">
                              <label className="text-[11.5px] font-medium text-[#8297B2]">
                                API Key
                              </label>
                              <div className="relative flex items-center">
                                <input
                                  type={isShowKey ? 'text' : 'password'}
                                  value={
                                    rawInputKey ||
                                    (agent.fallback_api.api_key_masked ?? '')
                                  }
                                  placeholder="••••••••••••••••••••••••••••••••"
                                  onChange={(e) =>
                                    setInputKeys((s) => ({
                                      ...s,
                                      [agent.agent_id]: e.target.value,
                                    }))
                                  }
                                  className="h-8 w-full rounded-[6px] border border-[#23344A] bg-[#0A1220] px-3 pr-8 font-mono text-[12px] text-[#EAF2FF] placeholder-[#65748A] focus:border-[#58E9A8] focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowKeyAgentId((s) => ({
                                      ...s,
                                      [agent.agent_id]: !isShowKey,
                                    }))
                                  }
                                  className="absolute right-2 text-[#8297B2] hover:text-[#EAF2FF]"
                                  title={isShowKey ? 'Ẩn key' : 'Hiện key'}
                                >
                                  {isShowKey ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                                </button>
                              </div>
                            </div>

                            {/* Row 4: Warning note + Check & Save buttons */}
                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-1.5 text-[11.5px] text-[#FFC075]">
                                <span>⚠️ Lưu trong kho bảo mật OS. API có chi phí riêng.</span>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={Boolean(actionLoading[agent.agent_id])}
                                  onClick={() =>
                                    handleConnectionAction(agent.agent_id, 'CHECK_API')
                                  }
                                  className="flex h-7 items-center gap-1.5 rounded-[6px] border border-[#23344A] bg-[#142235] px-3 text-[11.5px] font-medium text-[#EAF2FF] transition hover:border-[#58E9A8]"
                                >
                                  {actionLoading[agent.agent_id] === 'CHECK_API' ? (
                                    <span className="animate-spin text-[#58E9A8]">
                                      <IconSpinner size={12} />
                                    </span>
                                  ) : null}
                                  <span>Kiểm tra kết nối</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSaveKey(agent.agent_id)}
                                  disabled={Boolean(actionLoading[`${agent.agent_id}_key`])}
                                  className="flex h-7 items-center rounded-[6px] bg-[#58E9A8] px-3.5 text-[11.5px] font-semibold text-[#080E18] transition hover:brightness-110"
                                >
                                  {actionLoading[`${agent.agent_id}_key`] === 'saving'
                                    ? 'Đang lưu...'
                                    : 'Lưu key'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Bottom button [+ Thêm AI mở rộng] */}
                <button
                  type="button"
                  onClick={() => showNotice('Tính năng thêm Agent tuỳ biến sẽ khả dụng ở bản cập nhật tiếp theo.')}
                  className="flex h-10 w-full items-center justify-center rounded-[8px] border border-dashed border-[#23344A] bg-[#0A1220]/50 text-[12.5px] font-medium text-[#58E9A8] transition hover:border-[#58E9A8] hover:bg-[#142235]/40"
                >
                  + Thêm AI mở rộng
                </button>
              </div>
            )}

            {/* TAB 2: HỆ THỐNG & CÔNG CỤ */}
            {activeTab === 'tools' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-[15px] font-semibold text-[#EAF2FF]">
                    Công cụ & Shadow Workspace
                  </h3>
                  <p className="text-[12px] text-[#8297B2]">
                    Kiểm tra các phụ thuộc CLI bên dưới hệ thống và dung lượng không gian ảo.
                  </p>
                </div>

                {/* Tool Dependencies Table */}
                <div className="rounded-[10px] border border-[#23344A] bg-[#0A1220] overflow-hidden">
                  <div className="border-b border-[#23344A] px-4 py-2 text-[12px] font-semibold text-[#8297B2]">
                    CÁC PHỤ THUỘC HỆ THỐNG
                  </div>
                  <div className="divide-y divide-[#1A2A3D]">
                    {toolDependencies.map((tool) => (
                      <div
                        key={tool.tool_id}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <div className="flex flex-col">
                          <span className="text-[13px] font-medium text-[#EAF2FF]">
                            {tool.tool_name}
                          </span>
                          <span className="text-[11.5px] text-[#8297B2]">
                            Dung lượng: {tool.size_mb} MB
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex items-center gap-1 text-[11.5px] font-medium ${
                              tool.is_installed ? 'text-[#58E9A8]' : 'text-[#FF806E]'
                            }`}
                          >
                            {tool.is_installed ? '✓ Đã sẵn sàng' : 'Chưa cài đặt'}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              if (onEnsureToolDependency) {
                                await onEnsureToolDependency(tool.tool_id);
                                showNotice(`Đã kiểm tra và đảm bảo phụ thuộc ${tool.tool_name}.`);
                              }
                            }}
                            className="flex h-7 items-center rounded-[6px] border border-[#23344A] bg-[#142235] px-3 text-[11.5px] font-medium text-[#EAF2FF] transition hover:border-[#58E9A8]"
                          >
                            Kiểm tra lại
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Workspace Storage Info */}
                <div className="rounded-[10px] border border-[#23344A] bg-[#0A1220] p-4">
                  <span className="text-[12px] font-semibold text-[#8297B2]">
                    DUNG LƯỢNG LƯU TRỮ SHADOW WORKSPACE
                  </span>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div className="rounded-[8px] border border-[#1A2A3D] bg-[#0E1725] p-3">
                      <span className="text-[11px] text-[#8297B2]">Tổng dung lượng</span>
                      <p className="mt-1 font-mono text-[16px] font-semibold text-[#58E9A8]">
                        {workspaceStorage.total_used_mb} MB
                      </p>
                    </div>
                    <div className="rounded-[8px] border border-[#1A2A3D] bg-[#0E1725] p-3">
                      <span className="text-[11px] text-[#8297B2]">Shadow Workspaces</span>
                      <p className="mt-1 font-mono text-[16px] font-semibold text-[#EAF2FF]">
                        {workspaceStorage.shadow_workspaces_mb ?? 142} MB
                      </p>
                    </div>
                    <div className="rounded-[8px] border border-[#1A2A3D] bg-[#0E1725] p-3">
                      <span className="text-[11px] text-[#8297B2]">Bộ nhớ tạm</span>
                      <p className="mt-1 font-mono text-[16px] font-semibold text-[#9DB0C8]">
                        {workspaceStorage.temp_files_mb} MB
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: TRẢI NGHIỆM & ĐỒ THỊ */}
            {activeTab === 'appearance' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-[15px] font-semibold text-[#EAF2FF]">
                    Trải nghiệm & Đồ thị tri thức
                  </h3>
                  <p className="text-[12px] text-[#8297B2]">
                    Tùy chỉnh hiệu năng kết xuất đồ thị WebGL và hiệu ứng ánh sáng.
                  </p>
                </div>

                <div className="flex flex-col gap-3 rounded-[10px] border border-[#23344A] bg-[#0A1220] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-[#EAF2FF]">
                      Hành vi khi khởi động
                    </span>
                    <select
                      value={localAppearance.startup_behavior}
                      onChange={(e) =>
                        setLocalAppearance((s) => ({
                          ...s,
                          startup_behavior: e.target.value as any,
                        }))
                      }
                      className="h-8 rounded-[6px] border border-[#405672] bg-[#142235] px-3 text-[12px] font-medium text-[#EAF2FF] focus:border-[#58E9A8] focus:outline-none"
                    >
                      <option value="RESTORE_SESSION">Khôi phục phiên làm việc trước</option>
                      <option value="NEW_SESSION">Luôn mở phiên mới</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#1A2A3D] pt-3">
                    <span className="text-[13px] font-medium text-[#EAF2FF]">
                      Tốc độ làm mới khung hình Đồ thị
                    </span>
                    <select
                      value={localAppearance.graph_render_fps}
                      onChange={(e) =>
                        setLocalAppearance((s) => ({
                          ...s,
                          graph_render_fps: e.target.value as any,
                        }))
                      }
                      className="h-8 rounded-[6px] border border-[#405672] bg-[#142235] px-3 text-[12px] font-medium text-[#EAF2FF] focus:border-[#58E9A8] focus:outline-none"
                    >
                      <option value="HIGH_60FPS">60 FPS (Mượt mà nhất)</option>
                      <option value="POWER_SAVE_30FPS">30 FPS (Tiết kiệm pin)</option>
                    </select>
                  </div>

                  {/* Toggles */}
                  <div className="flex items-center justify-between border-t border-[#1A2A3D] pt-3">
                    <span className="text-[13px] font-medium text-[#EAF2FF]">
                      Bật hiệu ứng Glow trên Đồ thị
                    </span>
                    <input
                      type="checkbox"
                      checked={localAppearance.enable_graph_glow}
                      onChange={(e) =>
                        setLocalAppearance((s) => ({
                          ...s,
                          enable_graph_glow: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#58E9A8]"
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-[#1A2A3D] pt-3">
                    <span className="text-[13px] font-medium text-[#EAF2FF]">
                      Bật đường sáng di chuyển (Path lights up)
                    </span>
                    <input
                      type="checkbox"
                      checked={localAppearance.enable_path_lights_up}
                      onChange={(e) =>
                        setLocalAppearance((s) => ({
                          ...s,
                          enable_path_lights_up: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#58E9A8]"
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-[#1A2A3D] pt-3">
                    <span className="text-[13px] font-medium text-[#EAF2FF]">
                      Bật âm thanh hoàn thành task
                    </span>
                    <input
                      type="checkbox"
                      checked={localAppearance.enable_task_sound}
                      onChange={(e) =>
                        setLocalAppearance((s) => ({
                          ...s,
                          enable_task_sound: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#58E9A8]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: BẢN DỰNG & CẬP NHẬT */}
            {activeTab === 'updates' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-[15px] font-semibold text-[#EAF2FF]">
                    Thông tin phiên bản
                  </h3>
                  <p className="text-[12px] text-[#8297B2]">
                    Kiểm tra trạng thái cập nhật và các commit từ nhánh phát triển.
                  </p>
                </div>

                <div className="flex flex-col gap-3 rounded-[10px] border border-[#23344A] bg-[#0A1220] p-4 text-[12.5px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#8297B2]">Phiên bản hiện tại</span>
                    <span className="font-mono font-medium text-[#EAF2FF]">
                      {updateStatus.current_version}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#1A2A3D] pt-2">
                    <span className="text-[#8297B2]">Bản dựng nội bộ (Dev Build)</span>
                    <span className="font-medium text-[#58E9A8]">
                      {updateStatus.has_dev_build_ready ? (updateStatus.dev_build_version ?? 'Sẵn sàng') : 'Không có'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#1A2A3D] pt-2">
                    <span className="text-[#8297B2]">Trạng thái</span>
                    <span className="font-medium text-[#EAF2FF]">
                      {updateStatus.has_dev_build_ready ? 'Có bản dựng thử nghiệm mới' : 'Đang ở phiên bản ổn định'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => showNotice('Hệ thống đang chạy phiên bản mới nhất.')}
                  className="flex h-9 items-center justify-center rounded-[6px] border border-[#23344A] bg-[#142235] text-[12px] font-medium text-[#EAF2FF] transition hover:border-[#58E9A8]"
                >
                  Kiểm tra bản cập nhật
                </button>
              </div>
            )}
          </main>
        </div>

        {/* Footer (02 & 03 Cài đặt.svg) */}
        <footer className="flex h-14 shrink-0 items-center justify-between border-t border-[#23344A] bg-[#0A1220] px-6">
          <div className="text-[12px] text-[#58E9A8]">
            {notification && (
              <span className="flex items-center gap-1.5 animate-in fade-in">
                <span>✓</span>
                <span>{notification}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 items-center rounded-[6px] border border-[#23344A] bg-[#142235] px-4 text-[12px] font-medium text-[#9DB0C8] transition hover:border-[#405672] hover:text-[#EAF2FF]"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="flex h-8 items-center rounded-[6px] bg-[#58E9A8] px-4 text-[12px] font-bold text-[#080E18] transition hover:brightness-110"
            >
              Lưu thay đổi
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
