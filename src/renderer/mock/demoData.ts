import type {
  AgentQuotaStat,
  DAGTaskItem,
  VisualOfficeEvent,
  AINetworkSettings,
  ToolDependencyStatus,
  WorkspaceStorageInfo,
  AppearanceSettings,
  UpdateStatus,
} from '@shared/types';
import type { ChatMessage, Conversation } from '../../ui/chat/types';

/** Dữ liệu minh hoạ — chỉ dùng khi chạy trên trình duyệt (không có window.synapse). */

export const DEMO_QUOTA: AgentQuotaStat[] = [
  { agent_id: 'chatgpt', usage_5h_percent: 40, usage_week_percent: 28 },
  { agent_id: 'codex', usage_5h_percent: 70, usage_week_percent: 45 },
  { agent_id: 'gemini', usage_5h_percent: 25, usage_week_percent: 18 },
  { agent_id: 'claude', usage_5h_percent: 90, usage_week_percent: 65 },
];

export const DEMO_TASKS: DAGTaskItem[] = [
  { step_code: 'A', title: 'Phân tích yêu cầu', assigned_agent: 'chatgpt', status: 'COMPLETED' },
  {
    step_code: 'B',
    title: 'Chọn khoảnh khắc',
    assigned_agent: 'gemini',
    status: 'RUNNING',
    sub_tasks: [
      { sub_code: 'B1', title: 'Phát hiện cảnh', status: 'COMPLETED' },
      { sub_code: 'B2', title: 'Chấm điểm cảnh', status: 'RUNNING' },
    ],
  },
  { step_code: 'C', title: 'Viết pipeline', assigned_agent: 'codex', status: 'RUNNING' },
  { step_code: 'D', title: 'Kiểm thử', assigned_agent: 'codex', status: 'WAITING' },
  { step_code: 'E', title: 'Tổng hợp', assigned_agent: 'chatgpt', status: 'WAITING' },
];

export const DEMO_OFFICE: VisualOfficeEvent[] = [
  { room_id: 'MANAGER', desk_index: 0, active_task_code: null, animation_state: 'THINKING', worker_model_name: 'Triage Router' },
  { room_id: 'CODEX', desk_index: 0, active_task_code: 'C', animation_state: 'TYPING', worker_model_name: 'GPT-6.1 Sol' },
  { room_id: 'CODEX', desk_index: 1, active_task_code: null, animation_state: 'IDLE', worker_model_name: 'Terra CLI' },
  { room_id: 'GEMINI_AGY', desk_index: 0, active_task_code: 'B1', animation_state: 'DONE', worker_model_name: 'Gemini 3.8 Flash' },
  { room_id: 'GEMINI_AGY', desk_index: 1, active_task_code: 'B2', animation_state: 'TYPING', worker_model_name: 'Gemini 3.8 Flash' },
  { room_id: 'GEMINI_AGY', desk_index: 2, active_task_code: null, animation_state: 'IDLE', worker_model_name: 'Antigravity UI' },
  { room_id: 'CHATGPT', desk_index: 0, active_task_code: 'A', animation_state: 'DONE', worker_model_name: 'GPT-6' },
  { room_id: 'CHATGPT', desk_index: 1, active_task_code: null, animation_state: 'IDLE', worker_model_name: 'GPT-5.6' },
  { room_id: 'CLAUDE_EXT', desk_index: 0, active_task_code: null, animation_state: 'IDLE', worker_model_name: 'Claude 5.5' },
];

export const DEMO_ACTIVE_ROOMS: VisualOfficeEvent['room_id'][] = [
  'MANAGER',
  'CODEX',
  'GEMINI_AGY',
  'CHATGPT',
];

export const DEMO_CONVERSATIONS: Conversation[] = [
  { id: 'c1', title: 'Video 360 Highlights' },
  { id: 'c2', title: 'Website portfolio' },
  { id: 'c3', title: 'Lịch trình 2N1Đ' },
];

export const DEMO_MESSAGES: ChatMessage[] = [
  {
    id: 'm1',
    author: 'user',
    authorName: 'Justin',
    time: '14:02',
    text: 'Phân tích và viết tool cắt video 360 độ tự động.',
    attachments: [{ name: 'trip_360.mp4', sizeLabel: '128 MB', kind: 'video' }],
  },
  {
    id: 'm2',
    author: 'system',
    authorName: 'AGENT HQ',
    time: '14:03',
    text: 'Mình đã chia dự án thành 5 task. Bạn có thể tiếp tục chat trong khi các agent làm việc.',
    orchestration: { label: 'Đang chạy quy trình đa tác tử' },
    code: {
      filename: 'pipeline.py',
      language: 'python',
      code: [
        'from moviepy.editor import VideoFileClip',
        'def cut_highlight(input_path, segments):',
        '    clip = VideoFileClip(input_path)',
        '    return [clip.subclip(s, e) for s, e in segments]',
      ].join('\n'),
    },
    media: {
      title: 'highlight_01.mp4',
      durationSec: 30,
      thumbnails: [
        'linear-gradient(160deg,#7dd3fc 0%,#38bdf8 35%,#0e7490 60%,#14532d 100%)',
        'linear-gradient(160deg,#bae6fd 0%,#65a30d 45%,#3f6212 70%,#57534e 100%)',
      ],
    },
  },
];

// Dữ liệu cài đặt mặc định theo docs/07_SETTINGS_UI_UX_SPEC.md & design_settings.png.png
export const DEMO_AI_NETWORK_SETTINGS: AINetworkSettings = {
  default_chat_agent_id: 'gemini_3_8_flash',
  agents: [
    {
      agent_id: 'chatgpt',
      display_name: 'ChatGPT',
      role_description: 'Điều phối & Suy luận',
      connection_status: 'CONNECTED',
      auth_method: 'OAuth · OS Keychain',
      quota_5h_percent: 40,
      quota_week_percent: 28,
      alert_threshold_percent: 80,
      fallback_api: {
        is_configured: true,
        use_fallback_on_error: true,
        api_key_masked: 'sk-proj-••••••••••••••••••••••••3a9F',
        is_valid: true,
      },
    },
    {
      agent_id: 'gemini',
      display_name: 'Antigravity · Gemini',
      role_description: 'UI & Vision',
      connection_status: 'CONNECTED',
      auth_method: 'Đang chạy qua CLI',
      quota_5h_percent: 25,
      quota_week_percent: 18,
      alert_threshold_percent: 80,
      fallback_api: {
        is_configured: false,
        use_fallback_on_error: false,
        api_key_masked: '',
        is_valid: false,
      },
    },
    {
      agent_id: 'codex',
      display_name: 'Codex',
      role_description: 'Backend Builder',
      connection_status: 'CONNECTED',
      auth_method: 'Đã kết nối',
      quota_5h_percent: 70,
      quota_week_percent: 45,
      alert_threshold_percent: 80,
      fallback_api: {
        is_configured: true,
        use_fallback_on_error: false,
        api_key_masked: 'sk-codex-••••••••••••••••••••881b',
        is_valid: true,
      },
    },
    {
      agent_id: 'claude',
      display_name: 'Claude · Công ty',
      role_description: 'Audit & Code Review',
      connection_status: 'DISCONNECTED',
      auth_method: 'Chưa kết nối',
      quota_5h_percent: 90,
      quota_week_percent: 65,
      alert_threshold_percent: 85,
      fallback_api: {
        is_configured: false,
        use_fallback_on_error: false,
        api_key_masked: '',
        is_valid: false,
      },
    },
  ],
};

export const DEMO_TOOL_DEPENDENCIES: ToolDependencyStatus[] = [
  { tool_id: 'ffmpeg', tool_name: 'FFmpeg Video/Audio (Dynamic)', is_installed: true, size_mb: 85 },
  { tool_id: 'python_scripts', tool_name: 'Python Environment (Video 360)', is_installed: false, size_mb: 48 },
];

export const DEMO_WORKSPACE_STORAGE: WorkspaceStorageInfo = {
  total_used_mb: 127,
  core_app_mb: 42,
  shadow_workspaces_mb: 0,
  temp_files_mb: 85,
};

export const DEMO_APPEARANCE_SETTINGS: AppearanceSettings = {
  startup_behavior: 'RESTORE_SESSION',
  graph_render_fps: 'HIGH_60FPS',
  enable_graph_glow: true,
  enable_path_lights_up: true,
  office_3d_performance: 'HIGH_60FPS',
  enable_realtime_shadows: true,
  enable_light_trails: true,
  enable_task_sound: true,
};

export const DEMO_UPDATE_STATUS: UpdateStatus = {
  current_version: '0.0.1 (Alpha Release)',
  has_dev_build_ready: false,
  dev_build_version: undefined,
};
