import { useEffect, useState } from 'react';
import type { ChatMedia } from './types';
import { IconDownload, IconExpand, IconPause, IconPlay, IconVolume } from '../icons';

const fmt = (s: number) => {
  const v = Math.max(0, Math.floor(s));
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};

/** Khung nền "hoàng hôn" minh hoạ khi chưa có file video thật từ LocalMediaTools. */
const HERO_BG =
  'radial-gradient(circle at 50% 58%, #fde68a 0 4%, transparent 14%), linear-gradient(180deg,#1e3a5f 0%,#f97316 45%,#fb923c 55%,#334155 62%,#1f2937 100%)';

interface MediaPreviewProps {
  media: ChatMedia;
  /** URL video thật (file:// hoặc blob:) — nếu có sẽ dùng <video>. */
  src?: string;
  onDownload?: () => void;
}

export function MediaPreview({ media, src, onDownload }: MediaPreviewProps) {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(12);
  const [selected, setSelected] = useState(-1);

  useEffect(() => {
    if (!playing || src) return;
    const t = setInterval(() => {
      setTime((v) => {
        if (v + 0.25 >= media.durationSec) {
          setPlaying(false);
          return media.durationSec;
        }
        return v + 0.25;
      });
    }, 250);
    return () => clearInterval(t);
  }, [playing, src, media.durationSec]);

  const pct = (time / media.durationSec) * 100;
  const heroBg = selected >= 0 ? media.thumbnails[selected] : HERO_BG;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_minmax(0,0.36fr)] gap-2">
        {src ? (
          <video src={src} controls className="aspect-video w-full rounded-lg bg-black" />
        ) : (
          <div className="group relative aspect-video overflow-hidden rounded-lg" style={{ background: heroBg }}>
            <button
              onClick={() => {
                if (time >= media.durationSec) setTime(0);
                setPlaying((p) => !p);
              }}
              className={`absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition ${
                playing ? 'opacity-0 group-hover:opacity-100' : ''
              }`}
              aria-label={playing ? 'Tạm dừng' : 'Phát'}
            >
              {playing ? <IconPause size={20} /> : <IconPlay size={20} />}
            </button>
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-[11px] text-white">
              <button onClick={() => setPlaying((p) => !p)}>{playing ? <IconPause size={12} /> : <IconPlay size={12} />}</button>
              <input
                type="range"
                min={0}
                max={media.durationSec}
                step={0.25}
                value={time}
                onChange={(e) => setTime(Number(e.target.value))}
                className="h-1 flex-1 cursor-pointer accent-sky-400"
                style={{ background: `linear-gradient(90deg,#38bdf8 ${pct}%,rgba(255,255,255,.3) ${pct}%)` }}
                aria-label="Tua video"
              />
              <span className="tabular-nums">
                {fmt(time)} / {fmt(media.durationSec)}
              </span>
              <IconVolume size={13} />
              <IconExpand size={13} />
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {media.thumbnails.map((bg, i) => (
            <button
              key={i}
              onClick={() => setSelected(selected === i ? -1 : i)}
              className={`flex-1 rounded-lg border-2 transition ${selected === i ? 'border-hq-accent' : 'border-transparent hover:border-white/20'}`}
              style={{ background: bg }}
              aria-label={`Cảnh ${i + 1}`}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-hq-muted">
        <span>Bản xem trước · {media.title}</span>
        <button
          onClick={onDownload}
          className="flex items-center gap-1.5 rounded-md border border-hq-border px-2.5 py-1 text-hq-text transition hover:border-hq-accent/50"
        >
          <IconDownload size={13} /> Tải bản xem trước
        </button>
      </div>
    </div>
  );
}
