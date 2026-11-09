import type { SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...rest,
  };
}

// Synapse OS Hexagon Logo (from 01 Dashboard.svg)
export const IconLogoHex = ({ size = 20, className, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    {...rest}
  >
    <path
      d="M21 7.25C20.9995 6.7824 20.8761 6.32307 20.642 5.91827C20.408 5.51333 20.0716 5.1772 19.6667 4.94333L13.3333 1.27667C12.928 1.04267 12.4681 0.919333 12 0.919333C11.5319 0.919333 11.072 1.04267 10.6667 1.27667L4.33333 4.94333C3.9284 5.1772 3.592 5.51333 3.358 5.91827C3.12387 6.32307 3.00053 6.7824 3 7.25V14.5833C3.00053 15.051 3.12387 15.5103 3.358 15.9151C3.592 16.32 3.9284 16.6561 4.33333 16.89L10.6667 20.5567C11.072 20.7907 11.5319 20.914 12 20.914C12.4681 20.914 12.928 20.7907 13.3333 20.5567L19.6667 16.89C20.0716 16.6561 20.408 16.32 20.642 15.9151C20.8761 15.5103 20.9995 15.051 21 14.5833V7.25Z"
      stroke="#58E9A8"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3.4 5.91667L12 10.875L20.6 5.91667"
      stroke="#58E9A8"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 20.9167V10.875"
      stroke="#58E9A8"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Shadow Workspace Database Icon (from 01 Dashboard.svg)
export const IconShadowDb = ({ size = 14, className, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    className={className}
    {...rest}
  >
    <path
      d="M13.5 4C13.5 5.10457 11.0376 6 8 6C4.96243 6 2.5 5.10457 2.5 4C2.5 2.89543 4.96243 2 8 2C11.0376 2 13.5 2.89543 13.5 4Z"
      stroke="#78BAFF"
      strokeWidth="1.2"
    />
    <path
      d="M2.5 4V12C2.5 13.1046 4.96243 14 8 14C11.0376 14 13.5 13.1046 13.5 12V4"
      stroke="#78BAFF"
      strokeWidth="1.2"
    />
    <path
      d="M2.5 8C2.5 9.10457 4.96243 10 8 10C11.0376 10 13.5 9.10457 13.5 8"
      stroke="#78BAFF"
      strokeWidth="1.2"
    />
  </svg>
);

// Pin icon (from 01 Dashboard.svg)
export const IconPin = ({ size = 14, className, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    className={className}
    {...rest}
  >
    <path
      d="M8 12.5V15"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
    <path
      d="M6.25 9.777C6.25 9.994 6.189 10.206 6.075 10.391C5.96 10.575 5.797 10.724 5.602 10.821L4.564 11.346C4.37 11.442 4.206 11.591 4.092 11.776C3.977 11.96 3.917 12.173 3.917 12.39V12.833H12.083V12.39C12.083 12.173 12.023 11.96 11.908 11.776C11.794 11.591 11.63 11.442 11.436 11.346L10.397 10.821C10.203 10.724 10.04 10.575 9.925 10.391C9.811 10.206 9.75 9.994 9.75 9.777V7.583C9.75 7.429 9.811 7.28 9.921 7.171C10.03 7.061 10.179 7 10.333 7C10.643 7 10.939 6.877 11.158 6.658C11.377 6.439 11.5 6.143 11.5 5.833C11.5 5.524 11.377 5.227 11.158 5.008C10.939 4.79 10.643 4.667 10.333 4.667H5.667C5.357 4.667 5.06 4.79 4.842 5.008C4.623 5.227 4.5 5.524 4.5 5.833C4.5 6.143 4.623 6.439 4.842 6.658C5.06 6.877 5.357 7 5.667 7C5.821 7 5.97 7.061 6.079 7.171C6.189 7.28 6.25 7.429 6.25 7.583V9.777Z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

// Graph icon for Topbar mode toggle (from 01 Dashboard.svg)
export const IconGraph = ({ size = 16, className, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    className={className}
    {...rest}
  >
    <rect x="11.5" y="10.5" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
    <rect x="1.5" y="10.5" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
    <rect x="6.5" y="2.5" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M3 10.5V8.5C3 8.22386 3.22386 8 3.5 8H12.5C12.7761 8 13 8.22386 13 8.5V10.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M8 8V5.5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

// Send Paper Airplane (from 01 Dashboard.svg)
export const IconSendPlane = ({ size = 16, className, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    className={className}
    {...rest}
  >
    <path
      d="M14.5 1.5L7.2 8.8"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14.5 1.5L10 14.2C9.94 14.36 9.77 14.47 9.59 14.47C9.4 14.47 9.25 14.36 9.19 14.2L7.07 8.93C7 8.76 6.87 8.63 6.7 8.56L1.43 6.44C1.27 6.38 1.16 6.23 1.16 6.04C1.16 5.86 1.27 5.71 1.43 5.65L14.13 1.15C14.29 1.09 14.47 1.14 14.58 1.25C14.69 1.36 14.74 1.54 14.68 1.7L14.5 1.5Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconCube = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 2 3 7v10l9 5 9-5V7z" />
    <path d="m3 7 9 5 9-5M12 12v10" />
  </svg>
);

export const IconChat = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z" />
  </svg>
);

export const IconPlus = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconMinus = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12h14" />
  </svg>
);

export const IconChevronDown = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const IconChevronRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const IconLayers = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m12 3 9 5-9 5-9-5z" />
    <path d="m3 13 9 5 9-5" />
  </svg>
);

export const IconPaperclip = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7" />
  </svg>
);

export const IconSend = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m5 12 14-7-5 14-2-6z" />
  </svg>
);

export const IconCopy = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </svg>
);

export const IconPlay = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 4v16l13-8z" fill="currentColor" />
  </svg>
);

export const IconPause = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 4h3v16H7zM14 4h3v16h-3z" fill="currentColor" />
  </svg>
);

export const IconCode = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m8 7-5 5 5 5M16 7l5 5-5 5" />
  </svg>
);

export const IconFile = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14 3H6v18h12V7z" />
    <path d="M14 3v4h4" />
  </svg>
);

export const IconVideo = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m10 9 5 3-5 3z" fill="currentColor" />
  </svg>
);

export const IconX = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconDots = ({ size = 16, className, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="currentColor"
    className={className}
    {...rest}
  >
    <circle cx="3" cy="8" r="1.2" />
    <circle cx="8" cy="8" r="1.2" />
    <circle cx="13" cy="8" r="1.2" />
  </svg>
);

export const IconExpand = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
);

export const IconTarget = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="7" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
);

export const IconCheck = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m5 12 5 5 9-10" />
  </svg>
);

export const IconClock = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const IconFolder = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
  </svg>
);

export const IconDownload = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4v11m-5-5 5 5 5-5M5 20h14" />
  </svg>
);

export const IconExternal = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

export const IconSettings = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const IconSearch = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4.35-4.35" />
  </svg>
);

export const IconPencil = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

export const IconUnpin = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m3 3 18 18" />
    <path d="M15 9.34V7a2 2 0 0 1 2-2V3H7v1" />
    <path d="M9 9v1.76L7 13v1h8v-1l-1-1.34" />
    <path d="M12 17v4" />
  </svg>
);

export const IconTrash = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

export const IconAt = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
  </svg>
);

export const IconSpinner = (p: IconProps) => (
  <svg {...base(p)} className={`animate-spin ${p.className ?? ''}`}>
    <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
  </svg>
);

export const IconEye = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconEyeOff = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export const IconShield = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export const IconRefresh = (p: IconProps) => (
  <svg {...base(p)}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

export const IconTerminal = (p: IconProps) => (
  <svg {...base(p)}>
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

export const IconLock = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const IconAlert = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

export const IconInfo = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

export const IconKey = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m21 2-2 2m-1.5 1.5L19 7l-2 2-2-2-1.5 1.5" />
    <circle cx="7.5" cy="15.5" r="5.5" />
  </svg>
);

export const IconWrench = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);
