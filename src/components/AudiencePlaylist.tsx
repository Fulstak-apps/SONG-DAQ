"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Pause, Play, Radio, SkipForward } from "lucide-react";
import { SafeImage } from "./SafeImage";
import { usePlayer, type PlayerTrack } from "@/lib/store";
import { fmtNum } from "@/lib/pricing";
import type { AudiusTrack } from "@/lib/audius";
import { readJson } from "@/lib/safeJson";

function artwork(t: AudiusTrack) {
  return t.artwork?.["1000x1000"] || t.artwork?.["480x480"] || t.artwork?.["150x150"] || null;
}

function streamUrl(trackId: string) {
  return `https://api.audius.co/v1/tracks/${trackId}/stream?app_name=songdaq`;
}

function duration(seconds?: number) {
  const s = Math.max(0, Math.floor(Number(seconds ?? 0)));
  const m = Math.floor(s / 60);
  const r = String(s % 60).padStart(2, "0");
  return `${m}:${r}`;
}

export function AudiencePlaylist() {
  const [tracks, setTracks] = useState<AudiusTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const { current, playing, setQueue, playTrack, toggle, next } = usePlayer();

  useEffect(() => {
    let alive = true;
    fetch("/api/audius/search", { cache: "no-store" })
      .then((r) => readJson<{ tracks?: AudiusTrack[] }>(r))
      .then((j) => { if (alive) setTracks((j?.tracks ?? []).slice(0, 8)); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const queue = useMemo<PlayerTrack[]>(() => tracks.map((t) => ({
    id: String(t.id),
    title: t.title,
    artist: t.user?.name || t.user?.handle || "Audius",
    artwork: artwork(t),
    streamUrl: streamUrl(String(t.id)),
    href: t.permalink ? `https://audius.co${t.permalink}` : (t.user?.handle ? `https://audius.co/${t.user.handle}` : undefined),
  })), [tracks]);

  useEffect(() => {
    if (!queue.length) return;
    setQueue(queue, !current);
  }, [queue, current, setQueue]);

  if (!loading && !tracks.length) return null;

  const activeIndex = Math.max(0, queue.findIndex((t) => t.id === current?.id));
  const cover = queue[activeIndex] ?? queue[0];

  if (!expanded) {
    return (
      <section className="panel-elevated overflow-hidden grain">
        <div className="p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-edge bg-panel2 shrink-0">
              {cover ? (
                <SafeImage src={cover.artwork} alt={cover.title} fill sizes="48px" fallback={cover.title} className="object-cover" />
              ) : (
                <div className="absolute inset-0 animate-pulse bg-white/[0.04]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] font-black text-neon">
                <Radio size={12} /> Audius Playlist
              </div>
              <div className="text-sm font-black text-ink truncate mt-1">
                {cover ? cover.title : "Open Audio Queue"}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-mute truncate">
                {cover ? cover.artist : loading ? "Loading tracks..." : `${queue.length || 0} tracks loaded`}
              </div>
            </div>
          </div>
          <div className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-2 sm:flex sm:w-auto sm:shrink-0">
            {queue[0] && (
              <button
                className="btn-primary h-9 px-4 text-[10px] font-black tracking-widest"
                onClick={() => current ? toggle() : playTrack(queue[0], queue)}
              >
                {playing ? <Pause size={13} /> : <Play size={13} />}
                {playing ? "Pause" : "Play"}
              </button>
            )}
            <button className="btn h-9 px-3 text-[10px] font-black tracking-widest" onClick={next} disabled={!current} title="Next track">
              <SkipForward size={13} />
            </button>
            <button className="btn h-9 px-3 text-[10px] font-black tracking-widest" onClick={() => setExpanded(true)}>
              Expand <ChevronDown size={13} />
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel-elevated overflow-hidden grain">
      <div className="px-4 py-2 border-b border-edge flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.24em] font-black text-mute">Expanded Queue</span>
        <button className="text-[10px] uppercase tracking-widest font-black text-mute hover:text-ink transition" onClick={() => setExpanded(false)}>
          Collapse
        </button>
      </div>
      <div className="grid lg:grid-cols-[260px_1fr]">
        <div className="p-4 border-b lg:border-b-0 lg:border-r border-edge bg-white/[0.035]">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] font-black text-neon">
            <Radio size={13} /> Audius Playlist
          </div>
          <div className="mt-4 flex gap-4 lg:block">
            <div className="relative w-20 h-20 lg:w-full lg:h-auto lg:aspect-square rounded-xl overflow-hidden border border-edge bg-panel2 shrink-0 shadow-xl">
              {cover ? (
                <SafeImage src={cover.artwork} alt={cover.title} fill sizes="260px" fallback={cover.title} className="object-cover" />
              ) : (
                <div className="absolute inset-0 animate-pulse bg-white/[0.04]" />
              )}
            </div>
            <div className="min-w-0 lg:mt-4">
              <h2 className="text-xl font-black tracking-tight text-ink leading-none">Open Audio Queue</h2>
              <p className="mt-2 text-xs text-mute leading-relaxed">
                A live playlist from the Open Audio catalog. Playback stays running as you move around song-daq.
              </p>
              <div className="mt-3 flex items-center gap-2">
                {queue[0] && (
                  <button
                    className="btn-primary px-4 py-2 text-[10px] font-black tracking-widest"
                    onClick={() => current ? toggle() : playTrack(queue[0], queue)}
                  >
                    {playing ? <Pause size={13} /> : <Play size={13} />}
                    {playing ? "Pause" : "Play"}
                  </button>
                )}
                <button
                  className="btn px-3 py-2 text-[10px] font-black tracking-widest"
                  onClick={next}
                  disabled={!current}
                  title="Next track"
                >
                  <SkipForward size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="hidden md:grid grid-cols-[42px_1fr_82px_70px] gap-3 px-4 py-2.5 border-b border-edge text-[9px] uppercase tracking-[0.2em] font-black text-mute">
            <span>#</span>
            <span>Track</span>
            <span className="text-right">Plays</span>
            <span className="text-right">Time</span>
          </div>
          <div className="divide-y divide-white/[0.025]">
            {(loading ? Array.from({ length: 6 }) : tracks).map((item: any, i) => {
              if (loading) return (
                <div key={i} className="grid grid-cols-[42px_1fr] md:grid-cols-[42px_1fr_82px_70px] gap-3 px-4 py-2.5">
                  <div className="h-8 rounded-lg bg-white/[0.03] animate-pulse" />
                  <div className="h-8 rounded-lg bg-white/[0.03] animate-pulse" />
                  <div className="hidden md:block h-8 rounded-lg bg-white/[0.03] animate-pulse" />
                  <div className="hidden md:block h-8 rounded-lg bg-white/[0.03] animate-pulse" />
                </div>
              );
              const track = item as AudiusTrack;
              const q = queue[i];
              const active = current?.id === String(track.id);
              return (
                <button
                  key={track.id}
                  onClick={() => active ? toggle() : playTrack(q, queue)}
                  className={`w-full grid grid-cols-[42px_1fr] md:grid-cols-[42px_1fr_82px_70px] gap-3 items-center px-4 py-2.5 text-left transition active:scale-[0.995] ${
                    active ? "bg-neon/[0.07]" : "hover:bg-white/[0.035]"
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg grid place-items-center border text-[10px] font-black ${
                    active ? "bg-neon text-black border-neon" : "bg-white/[0.055] border-edge text-mute"
                  }`}>
                    {active && playing ? <Pause size={13} /> : active ? <Play size={13} /> : String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="relative w-9 h-9 rounded-lg overflow-hidden border border-white/[0.05] bg-panel2 shrink-0">
                      <SafeImage src={artwork(track)} alt={track.title} fill sizes="36px" fallback={track.title} className="object-cover" />
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[13px] font-bold truncate ${active ? "text-neon" : "text-ink"}`}>{track.title}</span>
                      <span className="block text-[10px] uppercase tracking-widest text-mute truncate">
                        {track.user?.name || track.user?.handle || "Audius"}
                      </span>
                    </span>
                  </span>
                  <span className="hidden md:block text-right text-[11px] font-mono text-mute">{fmtNum(track.play_count ?? 0)}</span>
                  <span className="hidden md:block text-right text-[11px] font-mono text-mute">{duration(track.duration)}</span>
                </button>
              );
            })}
          </div>
          <div className="px-5 py-3 border-t border-edge flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest font-bold text-mute">
              {loading ? "Loading tracks..." : `${queue.length || 0} tracks loaded`}
            </span>
            <Link href="/social" className="text-[10px] uppercase tracking-widest font-bold text-mute hover:text-ink transition">
              More signal →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
