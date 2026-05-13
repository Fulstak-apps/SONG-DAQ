"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { usePlayer } from "@/lib/store";
import { SafeImage } from "./SafeImage";

function clampVolume(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

const SHOW_PLAYER_EVENT = "songdaq:show-player";
const PLAYER_IDLE_REVEAL_MS = 60_000;

export function GlobalPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSrcRef = useRef<string | null>(null);
  const commandRef = useRef<"play" | "pause">("pause");
  const fadeRef = useRef<number | null>(null);
  const scrollHideRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const lastScrollYRef = useRef(0);
  const hiddenForScrollRef = useRef(false);
  const targetVolumeRef = useRef(0.05);
  const { current, playing, userPaused, pause, resume, next, previous, setPlaying, muted, volume, setVolume, setPlaybackTime, seekRequest } = usePlayer();
  const [hiddenForScroll, setHiddenForScroll] = useState(false);

  const setScrollHidden = useCallback((hidden: boolean) => {
    if (hiddenForScrollRef.current === hidden) return;
    hiddenForScrollRef.current = hidden;
    setHiddenForScroll(hidden);
  }, []);

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
    targetVolumeRef.current = muted ? 0 : clampVolume(volume);
    audio.muted = muted;
    if (fadeRef.current == null) {
      audio.volume = clampVolume(targetVolumeRef.current);
    }
  }, [muted, volume]);

  const sliderPct = muted ? 0 : Math.max(0, Math.min(100, Math.round(volume * 100)));
  const sliderStyle = {
    background: `linear-gradient(to right, var(--neon) 0%, var(--neon) ${sliderPct}%, rgba(255,255,255,0.14) ${sliderPct}%, rgba(255,255,255,0.14) 100%)`,
  };
  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (playing) {
      commandRef.current = "pause";
      if (fadeRef.current != null) {
        cancelAnimationFrame(fadeRef.current);
        fadeRef.current = null;
      }
      audio?.pause();
      pause();
    } else {
      resume();
    }
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

  useEffect(() => {
    if (!current) return;
    const revealPlayer = () => {
      if (scrollHideRef.current != null) window.clearTimeout(scrollHideRef.current);
      setScrollHidden(false);
    };
    const onScroll = () => {
      if (scrollFrameRef.current != null) return;
      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        const isMobile = window.matchMedia("(max-width: 767px)").matches;
        if (!isMobile) {
          setScrollHidden(false);
          return;
        }
        const nextY = window.scrollY || window.pageYOffset || 0;
        const scrollingDown = nextY > lastScrollYRef.current + 10;
        const scrollingUp = nextY < lastScrollYRef.current - 16;
        const nearTop = nextY < 20;
        lastScrollYRef.current = nextY;

        if (scrollHideRef.current != null) window.clearTimeout(scrollHideRef.current);

        if (nearTop || scrollingUp) {
          scrollHideRef.current = window.setTimeout(() => setScrollHidden(false), nearTop ? 80 : 180);
          return;
        }

        if (scrollingDown) {
          setScrollHidden(true);
          scrollHideRef.current = window.setTimeout(() => setScrollHidden(false), PLAYER_IDLE_REVEAL_MS);
        }
      });
    };
    lastScrollYRef.current = window.scrollY || window.pageYOffset || 0;
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener(SHOW_PLAYER_EVENT, revealPlayer);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener(SHOW_PLAYER_EVENT, revealPlayer);
      if (scrollHideRef.current != null) window.clearTimeout(scrollHideRef.current);
      if (scrollFrameRef.current != null) window.cancelAnimationFrame(scrollFrameRef.current);
      scrollHideRef.current = null;
      scrollFrameRef.current = null;
    };
  }, [current, setScrollHidden]);

  if (!current) return <audio ref={audioRef} className="hidden" preload="none" />;

  return (
    <div
      aria-hidden={hiddenForScroll}
      className={`global-player-safe fixed inset-x-0 bottom-[calc(4.45rem+env(safe-area-inset-bottom,0px))] z-50 border-t border-edge bg-bg/95 px-2 py-1 shadow-[0_-14px_42px_rgba(0,0,0,0.34)] backdrop-blur-xl transition-all duration-300 sm:px-4 sm:pt-1.5 md:bottom-0 md:backdrop-blur-2xl ${
        hiddenForScroll ? "translate-y-[calc(100%+1rem)] opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
      }`}
    >
      <div className="mx-auto flex w-full max-w-[1680px] items-center gap-1.5 sm:gap-2">
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-edge bg-panel2 sm:h-9 sm:w-9">
          <SafeImage src={current.artwork} alt={current.title} fill sizes="40px" fallback={current.title} className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          {current.href ? (
            <Link href={current.href} className="block truncate text-[11px] font-bold leading-tight text-ink transition hover:text-neon sm:text-sm">
              {current.title}
            </Link>
          ) : (
            <div className="truncate text-[11px] font-bold leading-tight text-ink sm:text-sm">{current.title}</div>
          )}
          <div className="truncate text-[9px] uppercase tracking-[0.18em] text-mute sm:text-[10px]">{current.artist}</div>
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
            className="grid h-9 w-9 place-items-center rounded-xl bg-neon text-pure-black shadow-neon-glow transition hover:bg-neondim sm:h-10 sm:w-10"
            onClick={handlePlayPause}
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

        <div className="hidden min-w-[82px] items-center gap-1.5 text-mute min-[430px]:flex md:min-w-[180px] md:gap-2">
          <Volume2 size={14} />
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={sliderPct}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            className="h-1.5 w-16 appearance-none rounded-full bg-white/10 md:w-24"
            style={sliderStyle}
            aria-label="Player volume"
          />
          <span className="hidden w-10 text-right text-[11px] font-bold uppercase tracking-widest md:block">{sliderPct}%</span>
        </div>
        <audio
          ref={audioRef}
          onLoadedMetadata={(e) => setPlaybackTime(e.currentTarget.currentTime || 0, e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setPlaybackTime(e.currentTarget.currentTime || 0, e.currentTarget.duration || 0)}
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
