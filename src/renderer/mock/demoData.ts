import type { AgentQuotaStat, DAGTaskItem, VisualOfficeEvent } from '@shared/types';
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
  { room_id: 'MANAGER', desk_index: 0, active_task_code: null, animation_state: 'THINKING' },
  { room_id: 'CODEX', desk_index: 0, active_task_code: 'C', animation_state: 'TYPING' },
  { room_id: 'CODEX', desk_index: 1, active_task_code: null, animation_state: 'IDLE' },
  { room_id: 'GEMINI_AGY', desk_index: 0, active_task_code: 'B1', animation_state: 'DONE' },
  { room_id: 'GEMINI_AGY', desk_index: 1, active_task_code: 'B2', animation_state: 'TYPING' },
  { room_id: 'GEMINI_AGY', desk_index: 2, active_task_code: null, animation_state: 'IDLE' },
  { room_id: 'CHATGPT', desk_index: 0, active_task_code: 'A', animation_state: 'DONE' },
  { room_id: 'CHATGPT', desk_index: 1, active_task_code: null, animation_state: 'IDLE' },
  { room_id: 'CLAUDE_EXT', desk_index: 0, active_task_code: null, animation_state: 'IDLE' },
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
