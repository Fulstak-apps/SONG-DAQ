"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Music2, Radio, RefreshCw, ShieldCheck, TrendingUp } from "lucide-react";
import { SafeImage } from "@/components/SafeImage";
import { fmtNum } from "@/lib/pricing";
import { readJson } from "@/lib/safeJson";

type IntelProfile = {
  platform: string;
  url: string;
  handle?: string | null;
  displayName?: string | null;
  imageUrl?: string | null;
  bio?: string | null;
  followerCount?: number | null;
  popularityScore?: number | null;
  verified?: boolean | null;
  sourceType: string;
  confidence: number;
  lastSyncedAt?: string | null;
  metrics?: Record<string, unknown> | null;
};

type IntelSongLink = {
  platform: string;
  url: string;
  title?: string | null;
  imageUrl?: string | null;
  channelName?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
  commentCount?: number | null;
  publishedAt?: string | null;
  sourceType: string;
  confidence: number;
};

type IntelResponse = {
  profiles?: IntelProfile[];
  songLinks?: IntelSongLink[];
  tracks?: Array<{
    id: string;
    title: string;
    url: string;
    imageUrl?: string | null;
    playCount?: number | null;
    favoriteCount?: number | null;
    repostCount?: number | null;
  }>;
  updatedAt?: string;
  note?: string;
};

function platformLabel(platform: string) {
  const clean = platform.replace(/_/g, " ");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function ageLabel(updatedAt?: string | null) {
  if (!updatedAt) return "Updated recently";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(updatedAt).getTime()) / 1000));
  if (!Number.isFinite(seconds) || seconds < 60) return "Updated just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `Updated ${hours}h ago`;
}

export function ArtistIntel({
  mint,
  artistName,
  handle,
  songTitle,
  trackId,
  compact = false,
}: {
  mint?: string | null;
  artistName?: string | null;
  handle?: string | null;
  songTitle?: string | null;
  trackId?: string | null;
  compact?: boolean;
}) {
  const [data, setData] = useState<IntelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (mint) params.set("mint", mint);
    if (artistName) params.set("artistName", artistName);
    if (handle) params.set("handle", handle);
    if (songTitle) params.set("songTitle", songTitle);
    if (trackId) params.set("trackId", trackId);
    return params.toString();
  }, [mint, artistName, handle, songTitle, trackId]);

  useEffect(() => {
    if (!qs) { setData(null); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    fetch(`/api/artist-intel?${qs}`, { cache: "no-store" })
      .then((res) => readJson<IntelResponse>(res))
      .then((json) => { if (alive) setData(json); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [qs, nonce]);

  const profiles = data?.profiles ?? [];
  const songLinks = data?.songLinks ?? [];
  const tracks = data?.tracks ?? [];
  const audius = profiles.find((profile) => profile.platform === "audius");
  const spotify = profiles.find((profile) => profile.platform === "spotify");
  const youtube = songLinks.filter((link) => link.platform === "youtube");
  const otherLinks = [
    ...profiles.filter((profile) => !["audius", "spotify"].includes(profile.platform)),
    ...songLinks.filter((link) => !["youtube", "spotify"].includes(link.platform)),
  ];

  if (!loading && !profiles.length && !songLinks.length && !tracks.length) return null;

  return (
    <section className={`panel-elevated grain ${compact ? "p-4" : "p-5 sm:p-6"} space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] font-black text-neon">Artist Intel</div>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-ink">Artist Momentum</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-mute">
            Verified music and social signals are pulled from Audius/Open Audio first. Other platforms only appear when there is a confident match or artist-approved link.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNonce((n) => n + 1)}
          className="btn h-9 px-3 text-[11px] uppercase tracking-widest font-black"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-2xl border border-edge bg-panel shimmer" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {audius ? <ProfileCard profile={audius} primary icon={<Radio size={16} />} /> : null}
            {spotify ? <ProfileCard profile={spotify} icon={<TrendingUp size={16} />} /> : null}
            {tracks.length ? (
              <div className="rounded-2xl border border-edge bg-panel p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-black text-mute">
                  <Music2 size={14} className="text-neon" />
                  Audius Catalog
                </div>
                <div className="mt-3 grid gap-2">
                  {tracks.slice(0, compact ? 2 : 4).map((track) => (
                    <a key={track.id} href={track.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-edge bg-panel2/70 p-2.5 hover:border-neon/30 transition">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-edge bg-panel">
                        <SafeImage src={track.imageUrl ?? null} alt={track.title} fill sizes="40px" fallback={track.title.slice(0, 2)} className="object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-black text-ink">{track.title}</div>
                        <div className="mt-0.5 text-[11px] uppercase tracking-widest text-mute">{fmtNum(track.playCount ?? 0)} plays</div>
                      </div>
                      <ExternalLink size={12} className="shrink-0 text-mute" />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {youtube.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {youtube.slice(0, compact ? 1 : 2).map((video) => (
                <a key={video.url} href={video.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-edge bg-panel hover:border-neon/30 transition">
                  <div className="relative aspect-video bg-panel2">
                    <SafeImage src={video.imageUrl ?? null} alt={video.title ?? "YouTube video"} fill sizes="(max-width: 768px) 100vw, 50vw" fallback="YT" className="object-cover transition group-hover:scale-[1.02]" />
                  </div>
                  <div className="p-4">
                    <div className="text-[11px] uppercase tracking-widest font-black text-neon">YouTube Match</div>
                    <div className="mt-1 line-clamp-2 text-sm font-black text-ink">{video.title}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-widest text-mute">
                      {video.channelName ? <span>{video.channelName}</span> : null}
                      {video.viewCount ? <span>{fmtNum(video.viewCount)} views</span> : null}
                      {video.likeCount ? <span>{fmtNum(video.likeCount)} likes</span> : null}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : null}

          {otherLinks.length ? (
            <div className="flex flex-wrap gap-2">
              {otherLinks.map((link) => (
                <a key={`${link.platform}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" className="btn h-9 px-3 text-[11px] uppercase tracking-widest font-black">
                  {platformLabel(link.platform)}
                  <ExternalLink size={12} />
                </a>
              ))}
            </div>
          ) : null}
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] pt-3 text-[11px] uppercase tracking-widest text-mute">
        <span>{data?.note || "Stats are estimates and may update with delay."}</span>
        <span>{ageLabel(data?.updatedAt)}</span>
      </div>
    </section>
  );
}

function ProfileCard({ profile, icon, primary = false }: { profile: IntelProfile; icon: React.ReactNode; primary?: boolean }) {
  return (
    <a href={profile.url} target="_blank" rel="noreferrer" className={`rounded-2xl border bg-panel p-4 transition hover:border-neon/30 ${primary ? "border-neon/25" : "border-edge"}`}>
      <div className="flex items-start gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-edge bg-panel2">
          <SafeImage src={profile.imageUrl ?? null} alt={profile.displayName ?? profile.platform} fill sizes="48px" fallback={platformLabel(profile.platform).slice(0, 2)} className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-black text-mute">
            {icon}
            {platformLabel(profile.platform)}
            {profile.verified ? <ShieldCheck size={12} className="text-neon" /> : null}
          </div>
          <div className="mt-1 truncate text-sm font-black text-ink">{profile.displayName || profile.handle || platformLabel(profile.platform)}</div>
          {profile.handle ? <div className="text-[11px] font-bold text-violet">@{profile.handle}</div> : null}
        </div>
        <ExternalLink size={13} className="shrink-0 text-mute" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {profile.followerCount != null ? <Mini label="Followers" value={fmtNum(profile.followerCount)} /> : null}
        {profile.popularityScore != null ? <Mini label="Popularity" value={`${fmtNum(profile.popularityScore)}/100`} /> : null}
        {profile.metrics?.trackCount != null ? <Mini label="Tracks" value={fmtNum(Number(profile.metrics.trackCount))} /> : null}
        {profile.metrics?.audioBalance != null ? <Mini label="AUDIO" value={fmtNum(Number(profile.metrics.audioBalance))} /> : null}
      </div>
      {profile.bio ? <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-mute">{profile.bio}</p> : null}
    </a>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-edge bg-panel2/70 p-2">
      <div className="text-[11px] uppercase tracking-widest text-mute font-black">{label}</div>
      <div className="mt-0.5 font-mono text-xs font-black text-ink">{value}</div>
    </div>
  );
}
