"use client";

import { useEffect, useRef } from "react";
import { usePlayer, type PlayerTrack } from "@/lib/store";
import type { AudiusTrack } from "@/lib/audius";

function artwork(track: AudiusTrack) {
  return track.artwork?.["1000x1000"] || track.artwork?.["480x480"] || track.artwork?.["150x150"] || null;
}

function streamUrl(trackId: string) {
  return `https://api.audius.co/v1/tracks/${trackId}/stream?app_name=songdaq`;
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const j = random[0] % (i + 1);
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function toPlayerTrack(track: AudiusTrack): PlayerTrack {
  const id = String(track.id);
  return {
    id,
    title: track.title,
    artist: track.user?.name || track.user?.handle || "Audius",
    artwork: artwork(track),
    streamUrl: streamUrl(id),
    href: track.permalink ? `https://audius.co${track.permalink}` : (track.user?.handle ? `https://audius.co/${track.user.handle}` : undefined),
  };
}

export function AudiusAutoShuffle() {
  const booted = useRef(false);
  const { current, setQueue, setVolume } = usePlayer();

  useEffect(() => {
    if (booted.current || current) return;
    booted.current = true;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function loadShuffle() {
      try {
        setVolume(0.1);
        const res = await fetch("/api/audius/search", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!alive) return;
        const tracks: AudiusTrack[] = Array.isArray(json.tracks) ? json.tracks : [];
        const queue = shuffle(tracks.slice(0, 18).map(toPlayerTrack).filter((track: PlayerTrack) => track.streamUrl));
        if (queue.length) setQueue(queue, true);
      } catch {
        // The site should never fail to load because background music failed.
      }
    }

    // Keep first paint and wallet/auth actions snappy; music can hydrate once
    // the main app has had a moment to settle.
    timer = setTimeout(loadShuffle, 2_500);
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [current, setQueue, setVolume]);

  return null;
}
