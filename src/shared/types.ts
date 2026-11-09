// =========================================================
// 1. ĐỊNH DANH AGENT & CHẾ ĐỘ HOẠT ĐỘNG
// =========================================================
export type AgentId = 'chatgpt' | 'gemini' | 'codex' | 'claude';
export type WorkspaceMode = 'CHAT_ONLY' | 'CHAT_AND_GRAPH';

// =========================================================
// 2. CODEBASE KNOWLEDGE GRAPH (ĐỒ THỊ TRI THỨC)
// =========================================================
export type GraphNodeVisualState =
  | 'DEFAULT'
  | 'ACTIVE_CHATGPT'
  | 'ACTIVE_GEMINI'
  | 'ACTIVE_CODEX'
  | 'ACTIVE_CLAUDE'
  | 'IGNORED' // Khi người dùng chọn "Bỏ qua (Exclude)"
  | 'ERROR';  // Khi file có lỗi biên dịch/runtime

export interface GraphNode {
  id: string;                // VD: "pipeline.py" hoặc "cut_highlights()"
  label: string;             // Nhãn hiển thị trên đồ thị
  kind: 'FILE' | 'FUNCTION' | 'CONFIG';
  file_path: string;         // Đường dẫn tương đối trong dự án
  function_count: number;    // Hiển thị trên Tooltip Hover (VD: 5 hàm)
  link_count: number;        // Hiển thị trên Tooltip Hover (VD: 5 liên kết)
  last_modified_ms: number;  // Để tính "Thay đổi 2 phút trước"
  visual_state: GraphNodeVisualState;
  is_focused?: boolean;      // Khi người dùng chọn "Tập trung (Focus)"
  error_details?: string;
}

export interface GraphEdge {
  id: string;
  source: string;            // Node ID nguồn (VD: "main.py")
  target: string;            // Node ID đích (VD: "pipeline.py")
  relation: 'IMPORTS' | 'CALLS' | 'EXPORTS';
  style: 'SOLID' | 'DASHED';
  active_agent?: AgentId | null; // Nếu khác null -> Kích hoạt "Path lights up" theo màu Agent
}

export interface GraphDataSnapshot {
  project_hash: string;
  project_name: string;
  git_branch: string;
  total_nodes: number;
  total_edges: number;
  is_running: boolean;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Alias thuận tiện cho GraphDataSnapshot
export type GraphData = GraphDataSnapshot;

// Sự kiện thời gian thực làm sáng Node và đường nối (Path lights up)
export interface GraphActiveEvent {
  project_hash: string;
  agent_id: AgentId;
  worker_model_name: string; // VD: "Gemini 3.8 Flash", "GPT-6.1 Sol"
  action: 'READING' | 'WRITING' | 'FLOW_TRANSITION' | 'IDLE' | 'ERROR';
  target_node_id: string;    // Node đang sáng
  source_node_id?: string;   // Nếu có -> làm sáng đường nối từ source -> target
  task_code?: string;        // VD: "B1", "C"
  timestamp: number;
}

// Lệnh điều khiển từ Context Menu trên Node (Focus / Exclude)
export interface GraphNodeControlCommand {
  project_hash: string;
  node_id: string;
  command: 'FOCUS' | 'EXCLUDE' | 'RESET';
}

// =========================================================
// 3. SHADOW WORKSPACE & QUẢN LÝ CUỘC TRÒ CHUYỆN (07 Quản lý chat.svg)
// =========================================================
export interface ChatSessionItem {
  session_id: string;
  project_hash: string | null; // null nếu là Lịch sử chat độc lập ngoài dự án
  title: string;
  is_pinned: boolean;
  updated_at: number;
}

export interface ShadowProjectInfo {
  project_hash: string;
  project_name: string;
  original_path: string;
  git_branch: string;
  is_shadow_workspace: boolean; // Luôn là true để hiển thị badge SHADOW WORKSPACE
  sessions: ChatSessionItem[];
}

// Alias thuận tiện cho ShadowProjectInfo
export type ShadowProjectMeta = ShadowProjectInfo;

export interface ChatSessionMutationRequest {
  action: 'CREATE' | 'RENAME' | 'TOGGLE_PIN' | 'DELETE';
  session_id?: string;
  project_hash?: string | null;
  new_title?: string;
}

// =========================================================
// 4. CÂY SƠ ĐỒ TASK (TASK TREE)
// =========================================================
export interface TaskTreeItem {
  task_code: string;         // VD: "A", "B", "B1", "B2", "C"
  title: string;             // VD: "Chọn khoảnh khắc"
  assigned_agent: AgentId;
  status: 'COMPLETED' | 'RUNNING' | 'PENDING' | 'FAILED';
  progress_percent?: number; // VD: 62
  children?: TaskTreeItem[];
}

export interface TaskTreeSnapshot {
  root_title: string;        // VD: "Tool cắt video 360"
  completed_count: number;   // VD: 1
  total_count: number;       // VD: 5
  tasks: TaskTreeItem[];
}

// =========================================================
// 5. MÀN HÌNH CÀI ĐẶT 4 TAB (02 & 03 Cài đặt.svg)
// =========================================================
export interface AgentSettingsProfile {
  agent_id: AgentId;
  display_name: string;      // VD: "ChatGPT", "Antigravity · Gemini"
  role_description: string;  // VD: "Điều phối & suy luận", "UI & Vision"
  connection_status: 'CONNECTED' | 'DISCONNECTED' | 'OUT_OF_QUOTA';
  auth_method: string;       // VD: "OAuth · OS Keychain", "Đang chạy qua CLI", "Chưa kết nối"
  quota_5h_percent: number | null;
  quota_week_percent: number | null;
  alert_threshold_percent?: number; // Slider ngưỡng cảnh báo (VD: 80)
  fallback_api: {
    is_configured: boolean;
    use_fallback_on_error: boolean;
    api_key_masked?: string; // Tuyệt đối không gửi key thật xuống UI
    is_valid: boolean;
  };
}

export interface AINetworkSettings {
  default_chat_agent_id: string; // VD: "gemini_antigravity"
  agents: AgentSettingsProfile[];
}

export interface ToolDependencyStatus {
  tool_id: 'graphify' | 'ffmpeg' | 'python_scripts';
  tool_name: string;
  is_installed: boolean;
  size_mb: number;
}

export interface WorkspaceStorageInfo {
  total_used_mb: number;
  core_app_mb: number;
  shadow_workspaces_mb?: number;
  temp_files_mb: number;
}

export interface AppearanceAndGraphSettings {
  startup_behavior: 'RESTORE_SESSION' | 'NEW_SESSION';
  graph_render_fps: 'HIGH_60FPS' | 'POWER_SAVE_30FPS';
  enable_graph_glow: boolean;
  enable_path_lights_up: boolean;
  enable_task_sound: boolean;
}

// Alias và mở rộng tương thích ngược cho AppearanceSettings trong Pha 0
export interface AppearanceSettings extends AppearanceAndGraphSettings {
  office_3d_performance?: 'HIGH_60FPS' | 'POWER_SAVE_30FPS';
  enable_realtime_shadows?: boolean;
  enable_light_trails?: boolean;
}

// =========================================================
// 6. CÁC KIỂU CHUYỂN TIẾP CHO BACKEND & PHA 0 (TRANSITION TYPES)
// =========================================================
export type AgentBrandId = AgentId | string;

export interface AgentQuotaStat {
  agent_id: AgentBrandId;
  usage_5h_percent: number | null;
  usage_week_percent: number | null;
  connection_status?: AgentSettingsProfile['connection_status'];
}

export interface DAGTaskItem {
  step_code: string;            // "A", "B"
  title: string;
  assigned_agent: AgentBrandId;
  status: 'COMPLETED' | 'RUNNING' | 'WAITING' | 'FAILED';
  sub_tasks?: { sub_code: string; title: string; status: string }[]; // "B1", "B2"
}

export interface VisualOfficeEvent {
  room_id: 'MANAGER' | 'CODEX' | 'GEMINI_AGY' | 'CHATGPT' | 'CLAUDE_EXT';
  desk_index: 0 | 1 | 2;
  active_task_code: string | null; // Hiện huy hiệu "B1" lên nhân vật
  animation_state: 'IDLE' | 'TYPING' | 'THINKING' | 'DONE';
  worker_model_name?: string | null; // Tên model thực tế: VD "Claude 5.5", "GPT-6.1 Sol"
}

export interface UpdateStatus {
  current_version: string;
  has_dev_build_ready: boolean;
  dev_build_version?: string;
}
