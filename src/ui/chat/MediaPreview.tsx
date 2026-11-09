import { useState } from 'react';
import type { ChatMedia } from './types';
import { IconDownload } from '../icons';

interface MediaPreviewProps {
  media: ChatMedia;
  onDownload?: () => void;
}

export function MediaPreview({ media, onDownload }: MediaPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="flex w-full flex-col gap-2">
      {/* 360 Video Player Card */}
      <div className="relative h-[184px] w-full overflow-hidden rounded-[8px] border border-[#23344A] bg-[#0A1220] shadow-md">
        {/* Stylized 360 SVG Canvas from 01 Dashboard.svg */}
        <svg
          viewBox="318 502 486 184"
          className="absolute inset-0 h-full w-full object-cover"
          preserveAspectRatio="none"
        >
          {/* Sky background */}
          <rect x="318" y="502" width="486" height="184" fill="#385278" />

          {/* Sun */}
          <circle cx="651" cy="545" r="23" fill="#FFD9A4" />

          {/* Mountain silhouettes */}
          <path d="M318 568H804V686H318V568Z" fill="#274769" />
          <path d="M318 593L376 552L415 568L477 537L568 579L596 592L318 593Z" fill="#5D5772" />
          <path d="M318 634L398 602L450 611L532 580L576 545L663 529L732 516H804V686H318V634Z" fill="#25354B" />
          <path d="M318 654C389 633 491 614 560 607C643 597 663 559 751 536C696 559 662 612 572 625C520 636 476 645 453 654H318Z" fill="#526D85" />

          {/* Curved road dash lines */}
          <path
            d="M378 650C430 636 490 622 560 615C640 606 670 575 740 548"
            stroke="#DEBF91"
            strokeWidth="1.8"
            strokeDasharray="6 4"
            fill="none"
          />
        </svg>

        {/* Top-left Badge: 360° PREVIEW */}
        <div className="absolute left-3 top-3 z-10 flex items-center rounded-md border border-[#23344A] bg-[#0A1220]/90 px-2.5 py-1 backdrop-blur-sm">
          <span className="font-mono text-[11px] font-medium tracking-wide text-[#EAF2FF]">
            360° PREVIEW
          </span>
        </div>

        {/* Center Big Play Button */}
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          className="absolute left-1/2 top-1/2 z-10 flex h-[42px] w-[46px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[8px] border border-[#405672] bg-[#0A1220]/80 shadow-lg backdrop-blur-sm transition hover:border-[#58E9A8] hover:bg-[#0A1220]"
          aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
        >
          {isPlaying ? (
            <span className="flex items-center gap-1">
              <span className="h-3.5 w-1 rounded-sm bg-[#EAF2FF]" />
              <span className="h-3.5 w-1 rounded-sm bg-[#EAF2FF]" />
            </span>
          ) : (
            <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
              <path d="M1 1.5L12.5 8L1 14.5V1.5Z" fill="#EAF2FF" stroke="#EAF2FF" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Bottom Control Bar */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex h-[34px] items-center gap-3 bg-gradient-to-t from-[#0A1220] via-[#0A1220]/90 to-transparent px-3">
          {/* Small play icon */}
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="text-[#9DB0C8] hover:text-[#EAF2FF]"
          >
            {isPlaying ? (
              <span className="flex items-center gap-0.5">
                <span className="h-2.5 w-0.5 bg-[#9DB0C8]" />
                <span className="h-2.5 w-0.5 bg-[#9DB0C8]" />
              </span>
            ) : (
              <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
                <path d="M1 1L9 6L1 11V1Z" fill="#9DB0C8" />
              </svg>
            )}
          </button>

          {/* Time display */}
          <span className="font-mono text-[11px] text-[#9DB0C8]">
            00:12 / 00:30
          </span>

          {/* Scrubber progress bar */}
          <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-[#23344A]">
            <div
              className="h-full rounded-full bg-[#78BAFF]"
              style={{ width: '40%' }}
            />
          </div>

          {/* Fullscreen icon */}
          <button type="button" className="text-[#8297B2] hover:text-[#EAF2FF]" title="Toàn màn hình">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 3.5V1.5C1 1.22 1.22 1 1.5 1H3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M8.5 1H10.5C10.78 1 11 1.22 11 1.5V3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M11 8.5V10.5C11 10.78 10.78 11 10.5 11H8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M3.5 11H1.5C1.22 11 1 10.78 1 10.5V8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Card Footer: Title & Download button */}
      <div className="flex items-center justify-between px-0.5 text-[11px]">
        <span className="text-[#8297B2]">
          Bản xem trước · {media.title || 'highlight_01.mp4'}
        </span>
        <button
          type="button"
          onClick={onDownload}
          className="flex items-center gap-1.5 rounded-[6px] border border-[#23344A] bg-[#142235] px-2.5 py-1 text-[11px] font-medium text-[#9DB0C8] transition hover:border-[#405672] hover:text-[#EAF2FF]"
        >
          <IconDownload size={12} className="text-[#9DB0C8]" />
          <span>Tải bản xem trước</span>
        </button>
      </div>
    </div>
  );
}
