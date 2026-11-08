/**
 * SYNAPSE OS — HỢP ĐỒNG DỮ LIỆU TĨNH (Shared Data Contracts)
 * Nguồn: docs/04_SHARED_DATA_CONTRACTS.md — phải khớp 100%.
 * Chủ sở hữu: Nhánh Frontend (Antigravity). Backend (Codex) CHỈ ĐỌC.
 */

// Dùng chung cho toàn dự án
export type AgentBrandId = 'chatgpt' | 'codex' | 'gemini' | 'claude' | string;

export interface AgentQuotaStat {
  agent_id: AgentBrandId;
  usage_5h_percent: number;
  usage_week_percent: number;
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

// --- HỢP ĐỒNG MÀN HÌNH CÀI ĐẶT (SETTINGS UI) ---

// 1. Tab Mạng lưới AI (AI Network)
export interface AgentSettingsProfile {
  agent_id: string; 
  display_name: string;
  role_description: string; 
  connection_status: 'CONNECTED' | 'DISCONNECTED' | 'OUT_OF_QUOTA';
  auth_method: string; 
  quota_5h_percent: number;
  quota_week_percent: number;
  alert_threshold_percent: number; 
  
  // Cấu hình API Key Dự phòng
  fallback_api: {
    is_configured: boolean;         // Backend trả về true nếu đã có key trong OS Keychain
    use_fallback_on_error: boolean; // Công tắc: "Dùng API khi phiên chính lỗi"
    api_key_masked?: string;        // VD: "sk-proj-**********" (Tuyệt đối không gửi key thật xuống UI)
    is_valid: boolean;              // Trạng thái nút "Kiểm tra kết nối"
  };
}

export interface AINetworkSettings {
  default_chat_agent_id: string; // VD: "gemini_3_8_flash" (Dùng cho Chế độ 01)
  agents: AgentSettingsProfile[];
}

// 2. Tab Hệ thống & Công cụ (Core & Tools)
export interface ToolDependencyStatus {
  tool_id: 'ffmpeg' | 'python_scripts';
  tool_name: string; // VD: "FFmpeg Video/Audio"
  is_installed: boolean;
  size_mb: number; // VD: 85
}

export interface WorkspaceStorageInfo {
  total_used_mb: number;
  core_app_mb: number;
  temp_files_mb: number;
}

// 3. Tab Trải nghiệm & 3D (Appearance)
export interface AppearanceSettings {
  startup_behavior: 'RESTORE_SESSION' | 'NEW_SESSION';
  office_3d_performance: 'HIGH_60FPS' | 'POWER_SAVE_30FPS';
  enable_realtime_shadows: boolean;
  enable_light_trails: boolean;
  enable_task_sound: boolean;
}

// 4. Tab Bản dựng (Updates)
export interface UpdateStatus {
  current_version: string;
  has_dev_build_ready: boolean;
  dev_build_version?: string;
}
