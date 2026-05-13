"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ExternalLink, LockKeyhole, Music, Pause, Play, Radio, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { SafeImage } from "@/components/SafeImage";
import { CoinPreviewModal } from "@/components/CoinPreviewModal";
import { CoinTradeModal } from "@/components/CoinTradeModal";
import { ArtistIntel } from "@/components/ArtistIntel";
import { HypeMeterCard, SongIPOPanel, UndervaluedSignalsPanel } from "@/components/GamificationLayer";
import { fmtNum, fmtPct } from "@/lib/pricing";
import type { AudiusCoin } from "@/lib/audiusCoins";
import { usePlayer, useSession, type PlayerTrack } from "@/lib/store";

function artwork(track: any) {
  return track?.artwork?.["480x480"] || track?.artwork?.["150x150"] || track?.artwork?.["1000x1000"] || null;
}

function profileImage(user: any, tracks: any[]) {
  return user?.profile_picture?.["480x480"] || user?.profile_picture?.["150x150"] || artwork(tracks[0]) || null;
}

export default function ArtistProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const decoded = decodeURIComponent(String(handle || ""));
  const [tracks, setTracks] = useState<any[]>([]);
  const [coins, setCoins] = useState<AudiusCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<AudiusCoin | null>(null);
  const [trade, setTrade] = useState<{ side: "BUY" | "SELL"; coin: AudiusCoin } | null>(null);
  const { current, playing, playTrack, toggle } = usePlayer();
  const { audius } = useSession();

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const [artistR, coinsR] = await Promise.all([
          fetch(`/api/audius/search?q=${encodeURIComponent(decoded)}`, { cache: "no-store" }),
          fetch("/api/coins?sort=marketCap&limit=100", { cache: "no-store" }),
        ]);
        const [artistJ, coinsJ] = await Promise.all([artistR.json(), coinsR.json()]);
        if (!alive) return;
        const exact = (artistJ.tracks ?? []).filter((t: any) =>
          t.user?.handle?.toLowerCase() === decoded.toLowerCase() ||
          t.user?.name?.toLowerCase() === decoded.toLowerCase(),
        );
        setTracks((exact.length ? exact : artistJ.tracks ?? []).slice(0, 18));
        setCoins(coinsJ.coins ?? []);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [decoded]);

  const user = tracks.find((t) => t.user?.handle?.toLowerCase() === decoded.toLowerCase())?.user || tracks[0]?.user;
  const artistCoins = useMemo(() => coins.filter((c) =>
    c.artist_handle?.toLowerCase() === decoded.toLowerCase() ||
    c.artist_name?.toLowerCase() === user?.name?.toLowerCase(),
  ), [coins, decoded, user?.name]);
  const topTracks = tracks.slice().sort((a, b) => (b.play_count ?? 0) - (a.play_count ?? 0));
  const totalPlays = tracks.reduce((n, t) => n + (t.play_count ?? 0), 0);
  const totalFavorites = tracks.reduce((n, t) => n + (t.favorite_count ?? 0), 0);
  const totalCap = artistCoins.reduce((n, c) => n + (c.marketCap ?? 0), 0);
  const verified = Boolean(user?.is_verified || user?.verified || artistCoins.some((c: any) => c.audiusVerified || c.songDaqVerified));
  const pendingLiquidity = artistCoins.filter((c: any) => Number(c.liquidity ?? c.reserveSol ?? c.liquidityPairAmount ?? 0) <= 0).length;
  const artistName = user?.name || user?.handle || decoded;
  const gamifiedAssets = useMemo(() => {
    if (artistCoins.length) return artistCoins as any[];
    return topTracks.slice(0, 4).map((track) => ({
      id: String(track.id),
      mint: String(track.id),
      ticker: String(track.title || "SONG").replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "SONG",
      title: track.title,
      name: track.title,
      artistName,
      artist_name: artistName,
      price: 0.00001,
      v24hUSD: Number(track.play_count || 0) / 100,
      holder: Math.max(1, Math.round(Number(track.favorite_count || 0) / 5)),
      priceChange24hPercent: ((Number(track.repost_count || 0) % 18) - 4),
    }));
  }, [artistCoins, topTracks, artistName]);
  const isSignedInArtist = Boolean(
    (audius?.userId && user?.id && String(audius.userId) === String(user.id)) ||
    (audius?.handle && user?.handle && audius.handle.toLowerCase() === String(user.handle).toLowerCase())
  );
  const nameClass = artistName.length > 34
    ? "text-2xl md:text-4xl"
    : artistName.length > 22
      ? "text-3xl md:text-5xl"
      : "text-4xl md:text-6xl";

  function playerTrack(track: any): PlayerTrack {
    const handle = track.user?.handle || user?.handle || decoded;
    return {
      id: String(track.id),
      title: track.title,
      artist: track.user?.name || artistName,
      artwork: artwork(track),
      streamUrl: `https://api.audius.co/v1/tracks/${track.id}/stream?app_name=songdaq`,
      href: `/artist/${encodeURIComponent(handle)}`,
    };
  }

  function playSong(track: any) {
    const pt = playerTrack(track);
    if (current?.id === pt.id) toggle();
    else playTrack(pt, topTracks.map(playerTrack));
  }

  function linkedCoinForTrack(track: any) {
    const trackId = String(track?.id ?? "");
    const trackTitle = String(track?.title ?? "").trim().toLowerCase();
    return coins.find((coin) => {
      if (coin.audius_track_id && String(coin.audius_track_id) === trackId) return true;
      return !!trackTitle
        && String(coin.audius_track_title ?? coin.name ?? "").trim().toLowerCase() === trackTitle
        && (
          String(coin.artist_handle ?? "").trim().toLowerCase() === String(user?.handle ?? decoded).trim().toLowerCase() ||
          String(coin.artist_name ?? "").trim().toLowerCase() === artistName.trim().toLowerCase()
        );
    }) ?? null;
  }

  function createSongCoinHref(track: any) {
    const params = new URLSearchParams();
    const trackId = String(track?.id ?? "");
    if (trackId) params.set("trackId", trackId);
    const trackTitle = String(track?.title ?? "");
    if (trackTitle) params.set("trackTitle", trackTitle);
    if (user?.handle) params.set("artist", user.handle);
    return `/artist?${params.toString()}`;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="panel-elevated h-72 animate-pulse bg-white/[0.03]" />
        <div className="grid md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="panel h-44 animate-pulse bg-white/[0.03]" />)}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="panel-elevated p-12 text-center">
        <h1 className="text-2xl font-black text-white">Artist not found</h1>
        <p className="text-mute mt-2">No live Audius profile came back for @{decoded}.</p>
        <Link href="/market" className="btn mt-6">Back to market</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="panel-elevated overflow-hidden grain">
        <div className="relative min-h-[300px] p-6 md:p-8 flex flex-col md:flex-row gap-6 md:items-end">
          <div className="absolute inset-0">
            <img src={profileImage(user, tracks) || ""} alt="" className="w-full h-full object-cover opacity-30 blur-xl scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-bg/35" />
          </div>
          <div className="relative w-28 h-28 rounded-2xl overflow-hidden border border-white/[0.08] bg-panel2 shrink-0 shadow-depth">
            <SafeImage src={profileImage(user, tracks)} alt={user.name || user.handle} fill sizes="112px" fallback={user.name || user.handle} className="object-cover" />
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[0.28em] text-mute font-black mb-2">Audius Artist</div>
            <h1 className={`${nameClass} font-black tracking-tight text-white leading-[0.95] break-words`}>{artistName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-mute">
              <span>@{user.handle}</span>
              {user.follower_count != null && <span>{fmtNum(user.follower_count)} followers</span>}
              <a href={`https://audius.co/${user.handle}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-neon transition">
                Audius <ExternalLink size={13} />
              </a>
            </div>
          </div>
          <div className="relative grid grid-cols-3 gap-2 w-full md:w-auto">
            <Metric icon={<Music size={14} />} label="Tracks" value={fmtNum(tracks.length)} />
            <Metric icon={<Radio size={14} />} label="Plays" value={fmtNum(totalPlays)} />
            <Metric icon={<Users size={14} />} label="Likes" value={fmtNum(totalFavorites)} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Insight icon={<ShieldCheck size={16} />} label="Verification" value={verified ? "SONG·DAQ verified" : "Unverified"} tone={verified ? "neon" : "amber"} />
        <Insight icon={<LockKeyhole size={16} />} label="Liquidity" value={pendingLiquidity ? `${pendingLiquidity} Pending` : "Active"} tone={pendingLiquidity ? "amber" : "neon"} />
        <Insight icon={<TrendingUp size={16} />} label="Market Cap" value={`$${fmtNum(totalCap)}`} tone="neon" />
        <Insight icon={<Radio size={16} />} label="Social Traction" value={`${fmtNum(totalPlays)} Plays`} tone="violet" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <HypeMeterCard asset={gamifiedAssets[0]} />
        <div className="space-y-4">
          <SongIPOPanel assets={gamifiedAssets} limit={2} />
          <UndervaluedSignalsPanel assets={gamifiedAssets} limit={2} />
        </div>
      </section>

      <ArtistIntel
        artistName={artistName}
        handle={user.handle || decoded}
        songTitle={topTracks[0]?.title}
        trackId={topTracks[0]?.id ? String(topTracks[0].id) : null}
        compact
      />

      <section className="grid lg:grid-cols-[360px_1fr] gap-4">
        <aside className="panel-elevated p-5 h-fit">
          <div className="text-[11px] uppercase tracking-[0.24em] text-mute font-black mb-4">Token Status</div>
          {artistCoins.length ? (
            <div className="space-y-3">
              {artistCoins.map((coin) => (
                <button key={coin.mint} onClick={() => setPreview(coin)} className="w-full rounded-xl border border-edge bg-panel p-3 flex items-center gap-3 text-left hover:bg-panel2 hover:border-white/25 active:scale-[0.99] transition">
                  <span className="relative w-12 h-12 rounded-xl overflow-hidden bg-panel2 border border-edge shrink-0">
                    <SafeImage src={coin.logo_uri} alt={coin.ticker} fill sizes="48px" fallback={coin.ticker} className="object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-black text-white truncate">${coin.ticker}</span>
                    <span className="block text-[11px] uppercase tracking-widest text-mute truncate">Artist Token Live</span>
                  </span>
                  <span className={`num text-xs font-black ${Number(coin.priceChange24hPercent ?? 0) >= 0 ? "text-neon" : "text-red"}`}>
                    {fmtPct(coin.priceChange24hPercent ?? 0)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-edge bg-panel p-5">
              <div className="text-lg font-black text-white">No Artist Token yet</div>
              <p className="text-sm text-mute mt-2 leading-relaxed">
                This artist is live on Audius, but SONG·DAQ does not currently list an Artist Token or Song Coin for them.
              </p>
              <div className="mt-4 rounded-lg bg-violet/10 border border-violet/20 p-3 text-xs text-violet/90 leading-relaxed">
                Upcoming-token information will appear here when the artist connects their Audius login or submits a launch.
              </div>
            </div>
          )}
        </aside>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="text-[11px] uppercase tracking-[0.24em] text-mute font-black">Songs and Activity</div>
            <span className="text-[11px] uppercase tracking-widest text-mute font-bold">{tracks.length} tracks found</span>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {topTracks.map((track) => {
              const linkedCoin = linkedCoinForTrack(track);
              return (
              <div key={track.id} className="panel panel-hover p-4 flex gap-3 min-w-0">
                <span className="relative w-16 h-16 rounded-xl overflow-hidden bg-panel2 border border-edge shrink-0">
                  <SafeImage src={artwork(track)} alt={track.title} fill sizes="64px" fallback={track.title} className="object-cover" />
                  <button
                    onClick={() => playSong(track)}
                    className="absolute inset-0 grid place-items-center bg-pure-black/35 text-pure-white opacity-0 hover:opacity-100 transition"
                    title={current?.id === String(track.id) && playing ? "Pause" : "Play"}
                  >
                    {current?.id === String(track.id) && playing ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-white break-words">{track.title}</span>
                      <span className="block text-[11px] uppercase tracking-widest text-mute mt-1 truncate">{track.genre || track.mood || "Audius Track"}</span>
                    </span>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-black uppercase tracking-widest ${
                      linkedCoin ? "border-neon/30 bg-neon/10 text-neon" : "border-edge bg-white/[0.04] text-mute"
                    }`}>
                      {linkedCoin ? "Coin On" : "No Coin"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-mono text-mute">
                    <span>{fmtNum(track.play_count ?? 0)} plays</span>
                    <span>{fmtNum(track.favorite_count ?? 0)} likes</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {linkedCoin ? (
                      <Link href={`/coin/${linkedCoin.mint}`} className="btn h-8 px-3 text-[11px] uppercase tracking-widest font-black">
                        Open Coin
                      </Link>
                    ) : isSignedInArtist ? (
                      <Link href={createSongCoinHref(track)} className="btn-primary h-8 px-3 text-[11px] uppercase tracking-widest font-black">
                        Create Coin
                      </Link>
                    ) : (
                      <span className="inline-flex h-8 items-center rounded-xl border border-edge bg-panel2 px-3 text-[11px] uppercase tracking-widest font-black text-mute">
                        No Coin Yet
                      </span>
                    )}
                  </div>
                </div>
                <a href={track.permalink ? `https://audius.co${track.permalink}` : `https://audius.co/${user.handle}`} target="_blank" rel="noreferrer" className="self-start text-mute hover:text-white transition">
                  <ExternalLink size={14} />
                </a>
              </div>
              );
            })}
          </div>
        </section>
      </section>

      <CoinPreviewModal
        coin={preview}
        isOwner={isSignedInArtist}
        onClose={() => setPreview(null)}
        onTrade={(side, coin) => setTrade({ side, coin })}
      />
      {trade && <CoinTradeModal coin={trade.coin} side={trade.side} onClose={() => setTrade(null)} />}
    </div>
  );
}

function Insight({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "neon" | "amber" | "violet" }) {
  const color = tone === "neon" ? "text-neon border-neon/20 bg-neon/8" : tone === "amber" ? "text-amber border-amber/20 bg-amber/10" : "text-violet border-violet/20 bg-violet/10";
  return (
    <div className="panel p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl border grid place-items-center ${color}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-widest font-black text-mute">{label}</div>
        <div className="mt-1 text-sm font-black text-ink truncate">{value}</div>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-edge bg-panel px-4 py-3 min-w-[92px]">
      <div className="flex items-center gap-2 text-mute">{icon}<span className="text-[11px] uppercase tracking-widest font-black">{label}</span></div>
      <div className="num text-lg font-black text-white mt-1">{value}</div>
    </div>
  );
}
