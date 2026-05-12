"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { usePlayer } from "@/lib/store";
import { SafeImage } from "./SafeImage";

function clampVolume(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function GlobalPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSrcRef = useRef<string | null>(null);
  const commandRef = useRef<"play" | "pause">("pause");
  const fadeRef = useRef<number | null>(null);
  const targetVolumeRef = useRef(0.05);
  const { current, playing, userPaused, toggle, next, previous, setPlaying, volume, setVolume, setPlaybackTime, seekRequest } = usePlayer();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (lastSrcRef.current !== current.streamUrl) {
      lastSrcRef.current = current.streamUrl;
      audio.src = current.streamUrl;
      audio.load();
    }
  }, [current?.id, current?.streamUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    targetVolumeRef.current = clampVolume(volume);
    if (fadeRef.current == null) {
      audio.volume = clampVolume(targetVolumeRef.current);
    }
  }, [volume]);

  const sliderPct = Math.max(0, Math.min(100, Math.round(volume * 100)));
  const sliderStyle = {
    background: `linear-gradient(to right, var(--neon) 0%, var(--neon) ${sliderPct}%, rgba(255,255,255,0.14) ${sliderPct}%, rgba(255,255,255,0.14) 100%)`,
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!playing || userPaused || !current) {
      commandRef.current = "pause";
      if (fadeRef.current != null) {
        cancelAnimationFrame(fadeRef.current);
        fadeRef.current = null;
      }
      if (!audio.paused) audio.pause();
      return;
    }

    commandRef.current = "play";
    const shouldFade = audio.paused;
    if (shouldFade) audio.volume = 0;
    audio.play()
        .then(() => {
          setBlocked(false);
          if (!shouldFade) return;
          const startedAt = performance.now();
          const duration = 450;
          const fade = (now: number) => {
            const pct = Math.max(0, Math.min(1, (now - startedAt) / duration));
            audio.volume = clampVolume(targetVolumeRef.current * pct);
            if (pct < 1) {
              fadeRef.current = requestAnimationFrame(fade);
            } else {
              fadeRef.current = null;
              audio.volume = clampVolume(targetVolumeRef.current);
            }
          };
          if (fadeRef.current != null) cancelAnimationFrame(fadeRef.current);
          fadeRef.current = requestAnimationFrame(fade);
        })
        .catch(() => {
          setBlocked(true);
          setPlaying(false);
        });
  }, [playing, userPaused, current?.id, setPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || seekRequest == null) return;
    const nextTime = Math.max(0, Math.min(seekRequest, Number.isFinite(audio.duration) ? audio.duration : seekRequest));
    audio.currentTime = nextTime;
    setPlaybackTime(nextTime, audio.duration);
  }, [seekRequest, setPlaybackTime]);

  if (!current) return <audio ref={audioRef} className="hidden" preload="none" />;

  return (
    <div className="global-player-safe fixed inset-x-0 bottom-0 z-50 border-t border-edge bg-bg/95 px-3 pt-2 shadow-[0_-14px_42px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:px-4">
      <div className="mx-auto flex w-full max-w-[1680px] items-center gap-2.5">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-edge bg-panel2">
          <SafeImage src={current.artwork} alt={current.title} fill sizes="40px" fallback={current.title} className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          {current.href ? (
            <Link href={current.href} className="block truncate text-sm font-bold text-ink transition hover:text-neon">
              {current.title}
            </Link>
          ) : (
            <div className="truncate text-sm font-bold text-ink">{current.title}</div>
          )}
          <div className="truncate text-[10px] uppercase tracking-widest text-mute">{current.artist}</div>
          {blocked && (
            <div className="mt-0.5 text-[10px] uppercase tracking-widest text-neon">
              Press play once to enable browser audio
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            className="grid h-8 w-8 place-items-center rounded-xl border border-edge bg-white/[0.055] text-mute transition hover:bg-white/[0.1] hover:text-ink sm:h-9 sm:w-9"
            onClick={previous}
            title="Previous"
          >
            <SkipBack size={15} />
          </button>
          <button
            className="grid h-10 w-10 place-items-center rounded-xl bg-neon text-pure-black shadow-neon-glow transition hover:bg-neondim"
            onClick={toggle}
            title={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            className="grid h-8 w-8 place-items-center rounded-xl border border-edge bg-white/[0.055] text-mute transition hover:bg-white/[0.1] hover:text-ink sm:h-9 sm:w-9"
            onClick={next}
            title="Next"
          >
            <SkipForward size={15} />
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2 text-mute min-w-[180px]">
          <Volume2 size={14} />
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={sliderPct}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            className="w-24 appearance-none h-1.5 rounded-full bg-white/10"
            style={sliderStyle}
            aria-label="Player volume"
          />
          <span className="text-[11px] uppercase tracking-widest font-bold w-10 text-right">{sliderPct}%</span>
        </div>
        <audio
          ref={audioRef}
          onLoadedMetadata={(e) => setPlaybackTime(e.currentTarget.currentTime || 0, e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setPlaybackTime(e.currentTarget.currentTime || 0, e.currentTarget.duration || 0)}
          onPlay={() => setBlocked(false)}
          onPause={() => {
            if (commandRef.current === "play" && !userPaused) setPlaying(false);
          }}
          onEnded={() => {
            const queue = usePlayer.getState().queue;
            if (queue.length > 1) next();
            else setPlaying(false);
          }}
          preload="none"
          className="hidden"
        />
      </div>
    </div>
  );
}
