"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, BadgeCheck, ExternalLink, Lock, Pause, Play, RotateCcw, RotateCw, ShieldCheck, Volume2 } from "lucide-react";
import { PriceChart, type PricePointDTO } from "@/components/PriceChart";
import { TradePanel } from "@/components/TradePanel";
import { TradeFeed } from "@/components/TradeFeed";
import { usePlayer, useSession } from "@/lib/store";
import { api } from "@/lib/api";
import { getConnectedWalletId, sendSerializedTransaction } from "@/lib/wallet";
import { fmtSol, fmtNum, fmtPct } from "@/lib/pricing";
import { spotPrice, quoteBuyByTokens, quoteSellByTokens } from "@/lib/bondingCurve";
import { Glossary, InfoTooltip } from "@/components/Tooltip";
import { formatCryptoWithFiat, formatFiatEstimate, priceAgeText, useLiveFiatPrices } from "@/lib/fiat";

import { CHART_RANGE_LABELS, CHART_RANGES, CHART_RANGE_MS, type ChartRange } from "@/lib/chartRanges";

export default function SongTradingPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { address } = useSession();
  const { current, playing, playTrack, pause, resume, currentTime, duration, seekTo, volume, setVolume } = usePlayer();
  const [song, setSong] = useState<any>(null);
  const [points, setPoints] = useState<PricePointDTO[]>([]);
  const [holders, setHolders] = useState<any[]>([]);
  const [range, setRange] = useState<ChartRange>("LIVE");
  const [watching, setWatching] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [liqOpen, setLiqOpen] = useState(false);
  const [liqTokenAmount, setLiqTokenAmount] = useState<string>("100000");
  const [liqPairAmount, setLiqPairAmount] = useState<string>("1");
  const [liqPairAsset, setLiqPairAsset] = useState<"SOL" | "USDC">("SOL");
  const [liqLockDays, setLiqLockDays] = useState<string>("180");
  const [liqBusy, setLiqBusy] = useState(false);
  const [liqErr, setLiqErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, p, h] = await Promise.all([
        api<any>(`/api/songs/${id}`),
        api<any>(`/api/price/${id}`),
        api<any>(`/api/songs/${id}/holders`),
      ]);
      if (s.error) throw new Error(s.error);
      setSong(s.song);
      setPoints(p.points || []);
      setHolders(h.holders || []);
    } catch (e: any) { setErr(e.message); }
  }, [id]);

  useEffect(() => { load(); const i = setInterval(load, 4_000); return () => clearInterval(i); }, [load]);
  useEffect(() => {
    setRange("LIVE");
  }, [id]);

  useEffect(() => {
    if (!address) return;
    fetch(`/api/watchlist?wallet=${address}`).then((r) => r.json()).then((j) => {
      setWatching(!!(j.items || []).find((x: any) => x.songId === id));
    }).catch(() => {});
  }, [address, id]);

  async function toggleWatch() {
    if (!address) return;
    const r = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: address, songId: id, action: "toggle" }),
    });
    const j = await r.json();
    setWatching(!!j.watching);
  }

  // Filter chart points by range.
  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff = now - CHART_RANGE_MS[range];
    
    // 1. Filter existing points
    let res = points.filter((x) => new Date(x.ts as any).getTime() >= cutoff);

    // 2. Add the current live price as the latest real-time point.
    if (song) {
      const livePoint = { 
        ts: new Date(), 
        open: song.price, 
        high: song.price, 
        low: song.price, 
        close: song.price, 
        volume: 0 
      } as any;

      res.push(livePoint);
    }
    
    return res;
  }, [points, range, song]);

  // Liquidity depth (cost / proceeds for ladder of trade sizes).
  const depth = useMemo(() => {
    if (!song) return null;
    const params = {
      basePrice: song.basePrice, slope: song.curveSlope,
      circulating: song.circulating, performance: song.performance,
    };
    const ladder = [10, 50, 100, 500, 1000, 5000];
    const buys = ladder.map((tokens) => {
      try {
        const q = quoteBuyByTokens(params, tokens);
        return { tokens, total: q.total, slipBps: q.slippageBps };
      } catch { return { tokens, total: 0, slipBps: 0 }; }
    });
    const sells = ladder.map((tokens) => {
      try {
        const q = quoteSellByTokens(params, Math.min(tokens, song.circulating));
        return { tokens: Math.min(tokens, song.circulating), total: q.total, slipBps: q.slippageBps };
      } catch { return { tokens: 0, total: 0, slipBps: 0 }; }
    });
    return { buys, sells, spot: spotPrice(params) };
  }, [song]);

  if (err) return <div className="panel p-10 text-center text-red uppercase tracking-widest font-bold shadow-2xl">{err}</div>;
  if (!song) return <div className="panel p-10 text-center text-neon uppercase tracking-widest text-[11px] animate-pulse">Establishing Connection to Network…</div>;

  const change = (song.performance - 1) * 100;
  const isTradable = song.status === "LIVE" && Number(song.liquidityPairAmount || 0) > 0 && Number(song.liquidityTokenAmount || 0) > 0;
  const isOwner = !!address && song.artistWallet?.wallet === address;
  const playingThis = current?.id === String(song.id) && playing;
  const activeThis = current?.id === String(song.id);
  const playerTrack = song.streamUrl ? {
    id: String(song.id),
    title: song.title,
    artist: song.artistName,
    artwork: song.artworkUrl,
    streamUrl: song.streamUrl,
    href: `/song/${song.id}`,
    duration: Number(song.duration || 0) || null,
  } : null;
  const toggleSong = () => {
    if (!playerTrack) return;
    if (current?.id === String(song.id)) {
      if (playing) pause();
      else resume();
    } else {
      playTrack(playerTrack);
    }
  };
  const skipSong = (seconds: number) => {
    if (!playerTrack) return;
    if (!activeThis) playTrack(playerTrack);
    seekTo(Math.max(0, (activeThis ? currentTime : 0) + seconds));
  };

  if (advancedMode) {
    return (
      <div className="mobile-fullscreen-safe fixed inset-0 z-[100] bg-bg text-ink flex flex-col font-sans overflow-y-auto lg:overflow-hidden">
        {/* Top Navbar */}
        <div className="min-h-16 border-b border-edge flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 shrink-0 bg-bg shadow-md z-10">
          <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
            {song.artworkUrl ? <Image src={song.artworkUrl} alt={song.title} width={36} height={36} className="rounded-md shadow-sm" /> : <div className="w-9 h-9 rounded-md bg-white/10" />}
            <div className="flex items-center gap-3">
              <h1 className="max-w-[58vw] truncate text-lg sm:text-xl font-bold tracking-tight text-white">{song.title}</h1>
              <span className="font-mono text-xs font-bold text-neon bg-neon/10 px-2 py-0.5 rounded border border-neon/20">${song.symbol}</span>
            </div>
            <div className="w-px h-6 bg-white/10 mx-1 sm:mx-2 hidden sm:block" />
            <div className="flex items-baseline gap-2 sm:gap-3">
              <span className="text-lg sm:text-xl font-mono font-bold text-white">{fmtSol(song.price, 6)} <span className="text-[11px] text-mute">SOL</span></span>
              <span className={`num text-sm font-bold tracking-wider ${change >= 0 ? "gain" : "lose"}`}>
                {change >= 0 ? "+" : ""}{fmtPct(change)}
              </span>
            </div>
            <div className="flex gap-3 sm:gap-4 sm:ml-6 text-xs text-mute font-mono">
              <div>Value: <span className="text-white">{song.isMarketValueReliable ? `${fmtNum(song.marketCap)} SOL` : "Not priced"}</span></div>
              <div>Vol: <span className="text-white">{fmtNum(song.volume24h || 0)} SOL</span></div>
              <div>Holders: <span className="text-white">{fmtNum(holders.length)}</span></div>
            </div>
          </div>
          
          <button 
            onClick={() => setAdvancedMode(false)} 
            className="px-3 sm:px-4 py-2 bg-red/10 text-red border border-red/20 hover:bg-red/20 transition-all rounded-md text-[11px] uppercase tracking-widest font-bold shadow-sm flex items-center gap-2"
          >
            <span>Close Advanced</span>
            <span className="text-lg leading-none">&times;</span>
          </button>
        </div>

        {/* Main Terminal Layout */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-visible lg:overflow-hidden">
          
          {/* Left Sidebar (TradeFeed + Holders) */}
          <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-edge flex flex-col bg-panel2 overflow-y-auto no-scrollbar shrink-0 max-h-[34dvh] lg:max-h-none">
            <div className="p-3 border-b border-edge bg-panel">
              <div className="text-[11px] uppercase tracking-widest font-bold text-mute">Live Order Tape</div>
            </div>
            <div className="h-[50%] overflow-y-auto no-scrollbar border-b border-edge p-2">
              <TradeFeed />
            </div>
            <div className="p-3 border-b border-edge bg-panel">
              <div className="text-[11px] uppercase tracking-widest font-bold text-mute">Top Holders</div>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar p-2">
              <ul className="divide-y divide-edge text-xs">
                {holders.map((h, i) => (
                  <li key={h.wallet} className="px-3 py-2 flex items-center justify-between hover:bg-white/5 transition rounded">
                    <span className="font-mono text-mute truncate max-w-[100px]">{h.audiusHandle ? `@${h.audiusHandle}` : `${h.wallet.slice(0, 4)}…`}</span>
                    <span className="num font-bold text-neon">{h.pct.toFixed(2)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* Center (Chart & Depth) */}
          <div className="flex-1 flex flex-col min-w-0 bg-bg relative min-h-[520px] lg:min-h-0">
            <div className="absolute inset-0 bg-gradient-to-b from-neon/5 to-transparent pointer-events-none opacity-20" />
            
            {/* Chart Toolbar */}
            <div className="border-b border-edge bg-panel relative z-10 px-4 py-2">
              <div className="mb-1 text-[11px] uppercase tracking-widest font-black text-mute">Timeframe: <span className="text-neon">{CHART_RANGE_LABELS[range]}</span></div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {CHART_RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-3 py-1 rounded text-[11px] uppercase tracking-widest font-bold transition-all shrink-0 ${range === r ? "bg-neon/15 text-neon border border-neon/25" : "text-mute hover:text-white hover:bg-white/10"}`}
                  >{r}</button>
                ))}
              </div>
            </div>

            {/* Chart */}
            <div className="flex-1 p-4 relative z-10">
              <div className="w-full h-full min-h-[300px]">
                <PriceChart points={filtered} quote="USD" live={range === "LIVE"} mode="advanced" showVolume showMA7={false} showMA25={false} />
              </div>
            </div>

            {/* Bottom Panel (Liquidity Matrix) */}
            <div className="min-h-[220px] lg:h-[35%] border-t border-edge bg-panel2 flex flex-col relative z-10">
              <div className="p-2 border-b border-edge bg-panel px-4">
                <div className="text-[11px] uppercase tracking-widest font-bold text-mute">Liquidity Matrix</div>
              </div>
              <div className="flex-1 overflow-auto no-scrollbar p-2">
                {!depth ? null : (
                  <table className="min-w-[560px] w-full text-[11px] text-left">
                    <thead className="text-mute uppercase tracking-widest font-mono">
                      <tr>
                        <th className="px-4 py-2">Size</th>
                        <th className="text-right px-4 py-2 text-neon">Ask (Buy)</th>
                        <th className="text-right px-4 py-2 text-red">Bid (Sell)</th>
                        <th className="text-right px-4 py-2">Slippage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-edge font-mono">
                      {depth.buys.map((b, i) => {
                        const s = depth.sells[i];
                        return (
                          <tr key={b.tokens} className="hover:bg-white/5 transition">
                            <td className="px-4 py-2 font-bold text-white/70">{fmtNum(b.tokens)}</td>
                            <td className="px-4 py-2 text-right text-white/90">{fmtSol(b.total, 4)}</td>
                            <td className="px-4 py-2 text-right text-white/90">{fmtSol(s.total, 4)}</td>
                            <td className="px-4 py-2 text-right text-mute">{(b.slipBps/100).toFixed(2)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar (Trade Panel) */}
          <div className="w-full lg:w-[380px] border-t lg:border-t-0 lg:border-l border-edge bg-panel2 overflow-y-auto no-scrollbar shrink-0 p-4 space-y-4">
            {isTradable ? (
              <>
                <TradePanel song={song} onTraded={load} />
                {isOwner ? <LiveLiquidityPanel song={song} onChanged={load} /> : null}
              </>
            ) : <PendingLiquidityPanel song={song} isOwner={isOwner} />}
            
            <div className="panel p-4 bg-panel">
              <div className="text-[11px] uppercase tracking-widest font-bold text-mute mb-3">Distributor Royalties</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs"><span className="text-mute">Artist Share</span><span className="font-mono text-violet font-bold">{(song.artistShareBps / 100).toFixed(0)}%</span></div>
                <div className="flex justify-between items-center text-xs"><span className="text-mute">Holder Dividend</span><span className="font-mono text-neon font-bold">{(song.holderShareBps / 100).toFixed(0)}%</span></div>
                <div className="flex justify-between items-center text-xs"><span className="text-mute">Status</span>{song.splitsLocked ? <span className="chip-neon border-none px-1 py-0 shadow-none">Locked</span> : <span className="text-[11px] text-orange-500 font-bold uppercase tracking-widest">Pending</span>}</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
      <div className="space-y-6">
        <div className="panel p-4 sm:p-6 flex flex-col md:flex-row items-start md:items-center gap-4 sm:gap-6 relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-neon/5 to-transparent pointer-events-none mix-blend-screen" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-neon/10 rounded-full blur-[80px] pointer-events-none mix-blend-screen" />
          
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-panel2 shrink-0 shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-edge group">
            {song.artworkUrl ? <Image src={song.artworkUrl} alt={song.title} fill sizes="112px" className="object-cover group-hover:scale-105 transition-transform duration-500" /> : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
          </div>
          <div className="flex-1 min-w-0 relative z-10">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white drop-shadow-md break-words">{song.title}</h1>
              <span className="font-mono text-sm font-bold text-neon bg-neon/10 px-2 py-0.5 rounded border border-neon/20 shadow-[0_0_10px_rgba(0,229,114,0.3)]">${song.symbol}</span>
            </div>
            <div className="text-mute text-sm flex flex-wrap items-center gap-2 font-medium break-words whitespace-normal">
              <span className="text-white/90 break-words">{song.artistName}</span>
              {song.artistWallet?.audiusHandle && <span className="text-mute">· @{song.artistWallet.audiusHandle}</span>}
              {song.artistWallet?.audiusVerified && <span className="chip border-neon/40 text-neon bg-neon/10 ml-2 shadow-[0_0_5px_rgba(0,229,114,0.3)]">Verified</span>}
            </div>
            <div className="mt-4 flex flex-wrap items-baseline gap-3 sm:gap-4">
              <span className="text-3xl sm:text-4xl font-mono font-bold text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">{fmtSol(song.price, 6)} SOL</span>
              <span className={`num text-lg font-bold tracking-wider ${change >= 0 ? "gain drop-shadow-[0_0_10px_rgba(0,229,114,0.4)]" : "lose drop-shadow-[0_0_10px_rgba(255,51,102,0.4)]"}`}>
                {change >= 0 ? "+" : ""}{fmtPct(change)}
              </span>
              <span className="text-[11px] uppercase tracking-widest text-mute font-bold ml-2">ATH {fmtSol(song.ath, 6)}</span>
            </div>
            <SongPageAudioPlayer
              disabled={!playerTrack}
              playing={playingThis}
              active={activeThis}
              currentTime={activeThis ? currentTime : 0}
              duration={activeThis ? (duration || Number(song.duration || 0)) : Number(song.duration || 0)}
              volume={volume}
              onToggle={toggleSong}
              onSeek={(seconds) => {
                if (!playerTrack) return;
                if (!activeThis) playTrack(playerTrack);
                seekTo(seconds);
              }}
              onSkip={skipSong}
              onVolume={setVolume}
            />
          </div>
          <div className="flex w-full flex-col gap-3 shrink-0 relative z-10 md:w-auto">
            {address && (
              <button className={`px-4 py-2 rounded-lg text-[11px] uppercase tracking-widest font-bold transition-all shadow-lg ${watching ? "bg-neon/20 text-neon border border-neon/50 shadow-[0_0_15px_rgba(0,229,114,0.3)]" : "bg-panel2 border border-edge text-ink hover:bg-white/10 hover:text-white"}`} onClick={toggleWatch}>
                {watching ? "★ Tracking" : "☆ Track"}
              </button>
            )}
            <button className="px-4 py-2 rounded-lg text-[11px] uppercase tracking-widest font-bold transition-all shadow-lg bg-panel2 border border-edge text-ink hover:bg-white/10 hover:text-neon" onClick={() => setAdvancedMode(true)}>
              Advanced
            </button>
            {song.splitsLocked ? (
              <span className="text-[11px] uppercase tracking-widest font-bold text-neon flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-neon rounded-full shadow-[0_0_5px_rgba(0,229,114,0.8)]" /> Splits Locked</span>
            ) : (
              <span className="text-[11px] uppercase tracking-widest font-bold text-orange-500 flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(249,115,22,0.8)]" /> Unverified Splits</span>
            )}
          </div>
        </div>

        <div className="panel p-3 sm:p-5 relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-bg/30 pointer-events-none" />
          <div className="px-2 pt-1 pb-4 flex flex-col gap-2 relative z-10">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] uppercase tracking-widest font-black text-mute">Timeframe: <span className="text-neon">{CHART_RANGE_LABELS[range]}</span></span>
              <span className="text-[11px] uppercase tracking-widest font-mono text-mute">{filtered.length} Candles</span>
            </div>
            <div className="flex items-center gap-1 bg-panel p-1 rounded-lg border border-edge overflow-x-auto no-scrollbar">
              {CHART_RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-md text-[11px] uppercase tracking-widest font-bold transition-all shrink-0 ${range === r ? "bg-neon/15 text-neon border border-neon/25 shadow-sm" : "text-mute hover:text-white hover:bg-white/10"}`}
                >{r}</button>
              ))}
            </div>
          </div>
          <div className="relative z-10 h-[280px] sm:h-[380px]">
            <PriceChart points={filtered} quote="USD" live={range === "LIVE"} mode="advanced" showVolume showMA7={false} showMA25={false} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat
            k="Public Value"
            v={song.isMarketValueReliable ? `${fmtSol(song.marketCap, 2)} SOL` : "Not priced yet"}
            tooltip={song.marketValueNote || "Public value uses public tradable supply, not the full minted supply."}
          />
          <Stat k="Circulating" v={`${fmtNum(song.circulating)} / ${fmtNum(song.supply)}`} tooltip="Tokens actively trading versus total minted supply." />
          <Stat
            k="Burned"
            v={fmtNum(song.burnedSupply || song.supplyDistribution?.burnedSupply || 0)}
            tooltip="Burned coins are permanently removed from supply. After a burn, song-daq updates total supply, artist hold, public pool, reserve, and portfolio values."
          />
          <Stat k="Reserve" v={`${fmtSol(song.reserveSol, 2)} SOL`} tooltip="Liquidity pool backing the bonding curve." />
          <Stat k="Royalty Pool" v={`${fmtSol(song.royaltyPool, 4)} SOL`} tooltip="Accumulated streaming royalties awaiting distribution." />
          <Stat k="Streams" v={fmtNum(song.streams)} />
          <Stat k="Likes" v={fmtNum(song.likes)} />
          <Stat k="Reposts" v={fmtNum(song.reposts)} />
          <Stat k="Performance" v={`${song.performance.toFixed(2)}x`} accent={change >= 0 ? "gain" : "lose"} tooltip="Multiple of initial launch price." />
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="panel overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-edge flex justify-between items-center bg-panel">
              <div className="label">Institutional Holders</div>
            </div>
            {!holders.length ? (
              <div className="px-6 py-12 text-center text-mute text-[11px] uppercase tracking-widest font-bold">No registered wallets.</div>
            ) : (
              <ul className="divide-y divide-edge max-h-[300px] overflow-y-auto">
                {holders.map((h, i) => (
                  <li key={h.wallet} className="px-5 py-3 flex items-center gap-4 text-sm hover:bg-white/5 transition">
                    <span className="text-mute w-5 num text-xs font-bold">{i + 1}</span>
                    {h.audiusAvatar ? <Image src={h.audiusAvatar} alt="" width={24} height={24} className="rounded-full shadow-md" /> : <div className="w-6 h-6 rounded-full bg-white/10" />}
                    <span className="font-mono text-xs flex-1 truncate font-bold text-white/80">{h.audiusHandle ? `@${h.audiusHandle}` : `${h.wallet.slice(0, 4)}…${h.wallet.slice(-4)}`}</span>
                    <span className="num text-xs font-medium text-white">{fmtNum(h.amount)}</span>
                    <span className="num text-xs font-bold text-neon drop-shadow-[0_0_5px_rgba(0,229,114,0.3)] w-14 text-right">{h.pct.toFixed(2)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-edge bg-panel">
              <Glossary term="Depth" def="Simulated slippage across increasing order sizes based on current curve liquidity.">
                Liquidity Matrix
              </Glossary>
            </div>
            {!depth ? null : (
              <table className="w-full text-xs text-left">
                <thead className="bg-panel text-mute text-[11px] uppercase tracking-widest font-bold border-b border-edge">
                  <tr>
                    <th className="px-5 py-3">Lot Size</th>
                    <th className="text-right px-5 py-3 text-neon">Ask (Buy)</th>
                    <th className="text-right px-5 py-3 text-red">Bid (Sell)</th>
                    <th className="text-right px-5 py-3">Slippage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {depth.buys.map((b, i) => {
                    const s = depth.sells[i];
                    return (
                      <tr key={b.tokens} className="hover:bg-white/5 transition">
                        <td className="px-5 py-3 font-mono font-bold text-white/80">{fmtNum(b.tokens)}</td>
                        <td className="px-5 py-3 text-right num text-white font-medium">{fmtSol(b.total, 4)}</td>
                        <td className="px-5 py-3 text-right num text-white font-medium">{fmtSol(s.total, 4)}</td>
                        <td className="px-5 py-3 text-right num font-mono text-mute">{(b.slipBps/100).toFixed(2)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <TradeFeed />
      </div>

      <div className="space-y-6">
        {isTradable ? (
          <>
            <TradePanel song={song} onTraded={load} />
            {isOwner ? <LiveLiquidityPanel song={song} onChanged={load} /> : null}
          </>
        ) : <PendingLiquidityPanel song={song} isOwner={isOwner} />}
        <TokenTrustPanel song={song} isTradable={isTradable} />
        <SupplyDistributionPanel song={song} />
        
        {!song.splitsLocked && (
          <div className="panel p-5 bg-orange-500/5 border border-orange-500/20 rounded-2xl space-y-4 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="text-orange-500" size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-orange-500">Unverified Splits</h4>
                <p className="text-[11px] text-mute leading-relaxed font-medium">This asset has not yet locked its royalty distribution protocol. Holders are not receiving streaming revenue.</p>
              </div>
            </div>
            <Link href="/splits" className="btn w-full py-3 text-[11px] font-black uppercase tracking-widest bg-orange-500/10 border-orange-500/20 text-orange-500 hover:bg-orange-500/20 transition-all flex items-center justify-center gap-2">
              Setup splits with your distributor <ExternalLink size={12} />
            </Link>
          </div>
        )}

        <div className="panel overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-edge bg-panel">
            <Glossary term="Royalties" def="How external revenue is distributed among network participants.">
              Royalty Split Distribution
            </Glossary>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-3 border-b border-edge pb-4">
              <Sline k="Artist Allocation" v={`${(song.artistShareBps / 100).toFixed(0)}%`} color="violet" />
              <Sline k="Holder Dividend" v={`${(song.holderShareBps / 100).toFixed(0)}%`} color="neon" />
              <Sline k="Protocol Treasury" v={`${(song.protocolShareBps / 100).toFixed(0)}%`} color="mute" />
            </div>
            
            <div className="space-y-3 border-b border-edge pb-4">
              <Toggle k="Streaming Revenue Sync" on={song.streamingEnabled} />
              <Toggle k="Secondary Trading Fees" on={song.tradingFeesEnabled} />
              <Toggle k="External Merch/Sync" on={song.externalRevenueEnabled} />
            </div>
            
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center"><span className="text-[11px] uppercase tracking-widest text-mute font-bold">DSP Distributor</span><span className="font-medium text-xs text-ink">{song.distributor || "Decentralized"}</span></div>
              <div className="flex justify-between items-center"><span className="text-[11px] uppercase tracking-widest text-mute font-bold">Master Vault</span><span className="font-mono text-[11px] text-neon truncate max-w-[200px]">{song.royaltyVault || "Network Locked"}</span></div>
              <div className="flex justify-between items-center"><span className="text-[11px] uppercase tracking-widest text-mute font-bold">SPL Token</span><span className="font-mono text-[11px] text-ink bg-panel2 px-2 py-0.5 rounded border border-edge">{song.mintAddress?.slice(0, 4)}…{song.mintAddress?.slice(-4)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function pctFromBps(value: unknown) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return "0.00%";
  return `${(n / 100).toFixed(2)}%`;
}

function SupplyDistributionPanel({ song }: { song: any }) {
  const distribution = song.supplyDistribution || {};
  const totalSupply = Number(distribution.totalSupply ?? song.supply ?? 0);
  const rows = [
    {
      label: "Public Pool",
      value: Number(distribution.publicLiquiditySupply ?? song.tradableSupply ?? song.liquidityTokenAmount ?? 0),
      pct: pctFromBps(distribution.publicLiquidityBps),
      tone: "text-neon",
      help: "Coins placed into the public liquidity route. Fans buy and sell against this pool.",
    },
    {
      label: "Artist Hold",
      value: Number(distribution.artistAllocationSupply ?? (totalSupply * Number(song.artistAllocationBps || 0)) / 10_000),
      pct: pctFromBps(distribution.artistAllocationBps ?? song.artistAllocationBps),
      tone: "text-violet",
      help: "The artist-side allocation. If the artist burns coins from their wallet, this number goes down automatically.",
    },
    {
      label: "Reserve",
      value: Number(distribution.reserveSupply ?? 0),
      pct: pctFromBps(distribution.reserveBps),
      tone: "text-white",
      help: "Coins not currently counted as public pool or artist hold. This can support future liquidity or platform mechanics.",
    },
    {
      label: "Burned",
      value: Number(distribution.burnedSupply ?? song.burnedSupply ?? 0),
      pct: pctFromBps(distribution.burnedBps),
      tone: "text-red",
      help: "Coins permanently destroyed and removed from total supply.",
    },
    {
      label: "Circulating",
      value: Number(distribution.circulatingSupply ?? song.circulating ?? 0),
      pct: pctFromBps(distribution.circulatingBps),
      tone: "text-ink",
      help: "Coins currently active in the market calculation.",
    },
  ];

  return (
    <div className="panel overflow-hidden shadow-xl">
      <div className="px-5 py-4 border-b border-edge bg-panel">
        <Glossary
          term="Supply Split"
          def="Supply split shows where the coins sit: public pool, artist hold, reserve, burned, and circulating. Burns recalculate this automatically."
        >
          Supply Split After Burns
        </Glossary>
      </div>
      <div className="p-5 space-y-4">
        <div className="rounded-xl border border-edge bg-panel p-3">
          <div className="text-[11px] uppercase tracking-widest font-black text-mute">Total Indexed Supply</div>
          <div className="mt-1 font-mono text-xl font-black text-white">{totalSupply > 0 ? fmtNum(totalSupply) : "Pending"}</div>
        </div>
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="rounded-xl border border-edge bg-panel p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-black text-mute">
                    <InfoTooltip label={row.label} def={row.help} />
                  </div>
                  <div className={`mt-1 font-mono text-base font-black ${row.tone}`}>{fmtNum(row.value)}</div>
                </div>
                <div className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] font-black text-white">
                  {row.pct}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-mute">
          When coins are burned, song-daq records the burn event, reduces indexed supply, updates the public value math, and refreshes the artist/public/reserve split shown here.
        </p>
      </div>
    </div>
  );
}

function TokenTrustPanel({ song, isTradable }: { song: any; isTradable: boolean }) {
  const hasMint = Boolean(song.mintAddress);
  const hasMetadata = hasMint && Boolean(song.artworkUrl || song.streamUrl);
  const hasLiquidity = Number(song.liquidityPairAmount || 0) > 0 && Number(song.liquidityTokenAmount || 0) > 0;
  const liquidityVerified = Boolean(song.liquidityLocked && song.status === "LIVE");
  const royaltyVerified = song.royaltyVerificationStatus === "verified" || song.royaltyBacked;
  const artistVerified = Boolean(song.artistWallet?.audiusVerified);
  const trustItems = [
    {
      label: "Fixed supply mint",
      detail: hasMint ? "Mint authority revoked at launch" : "Mint pending",
      ok: hasMint,
    },
    {
      label: "Freeze authority",
      detail: hasMint ? "Disabled for normal transfers" : "Pending",
      ok: hasMint,
    },
    {
      label: "Professional metadata",
      detail: hasMetadata ? "Artwork/audio metadata attached" : "Fallback metadata only",
      ok: hasMetadata,
    },
    {
      label: "Launch liquidity",
      detail: liquidityVerified ? "Verified and live" : hasLiquidity ? "Reserved, pending verification" : "Not added yet",
      ok: liquidityVerified,
      warn: hasLiquidity && !liquidityVerified,
    },
    {
      label: "Artist identity",
      detail: artistVerified ? "Audius profile verified" : "Audius-linked, not verified",
      ok: artistVerified,
      warn: !artistVerified,
    },
    {
      label: "Royalty backing",
      detail: royaltyVerified ? "Royalty split verified" : "Not royalty verified yet",
      ok: royaltyVerified,
      warn: !royaltyVerified,
    },
  ];

  return (
    <div className="panel p-5 space-y-4 shadow-xl">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-neon/25 bg-neon/10 text-neon">
          <ShieldCheck size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-widest font-black text-neon">Token Trust Check</div>
          <p className="mt-1 text-xs leading-relaxed text-mute">
            song-daq only opens trading after a real liquidity route is verified. Royalty status is separate from launch liquidity.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {trustItems.map((item) => (
          <div key={item.label} className="flex items-start justify-between gap-3 rounded-xl border border-edge bg-panel p-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-widest font-black text-ink">{item.label}</div>
              <div className="mt-1 text-[11px] leading-relaxed text-mute">{item.detail}</div>
            </div>
            <div className={`mt-0.5 shrink-0 ${item.ok ? "text-neon" : item.warn ? "text-amber" : "text-red"}`}>
              {item.ok ? <BadgeCheck size={17} /> : item.warn ? <AlertTriangle size={17} /> : <Lock size={17} />}
            </div>
          </div>
        ))}
      </div>
      <div className={`rounded-xl border p-3 text-[11px] leading-relaxed ${
        isTradable ? "border-neon/20 bg-neon/10 text-neon" : "border-amber/20 bg-amber/10 text-amber"
      }`}>
        {isTradable
          ? "Trading is enabled because launch liquidity is verified. Wallet approval should only appear for real on-chain swaps."
          : "Trading needs launch liquidity before a real swap route can execute. If you try before a route exists, song-daq will show the actual router or backend error."}
      </div>
    </div>
  );
}

function Stat({ k, v, accent, tooltip }: { k: string; v: string; accent?: "gain" | "lose", tooltip?: string }) {
  const content = (
    <div className="label mb-1">
      {tooltip ? <Glossary term={k} def={tooltip}>{k}</Glossary> : k}
    </div>
  );

  return (
    <div className="panel p-5 relative overflow-hidden group">
      <div className="absolute -right-5 -top-5 w-16 h-16 bg-white/5 rounded-full blur-[20px] pointer-events-none group-hover:bg-white/10 transition" />
      {content}
      <div className={`mt-2 text-2xl font-mono font-bold tracking-tight ${accent === "gain" ? "gain drop-shadow-[0_0_10px_rgba(0,229,114,0.4)]" : accent === "lose" ? "lose drop-shadow-[0_0_10px_rgba(255,51,102,0.4)]" : "text-white"}`}>
        {v}
      </div>
    </div>
  );
}

function PendingLiquidityPanel({ song, isOwner = false }: { song: any; isOwner?: boolean }) {
  const mint = song.mintAddress ? `${song.mintAddress.slice(0, 6)}…${song.mintAddress.slice(-6)}` : "Mint pending";
  const status = song.status === "LIVE" ? "Liquidity missing" : "Pending liquidity";

  return (
    <div id="liquidity" className="panel p-5 space-y-4 border border-orange-500/25 bg-orange-500/5 shadow-xl relative overflow-hidden scroll-mt-28">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/60 to-transparent" />
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0">
          <ShieldCheck className="text-orange-500" size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-widest font-black text-orange-500">{status}</div>
          <h3 className="mt-1 text-lg font-black tracking-tight text-white">Trading route not live yet</h3>
          <p className="mt-2 text-xs text-mute leading-relaxed">
            This Song Coin can be inspected on-chain, but song-daq will not enable buy or sell actions until the artist adds the reserved coins plus SOL/USDC into a verified liquidity pool.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-edge bg-panel p-3 min-w-0">
          <div className="text-[11px] uppercase tracking-widest font-black text-mute">SPL Mint</div>
          <div className="mt-1 font-mono text-xs text-white truncate">{mint}</div>
        </div>
        <div className="rounded-xl border border-edge bg-panel p-3">
          <div className="text-[11px] uppercase tracking-widest font-black text-mute">Liquidity</div>
          <div className="mt-1 text-xs uppercase tracking-widest font-black text-orange-500">Not verified</div>
        </div>
      </div>

      <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-3 text-[11px] leading-relaxed text-orange-100/90">
        Fans buy from the liquidity pool, not directly from a hidden mint. The artist receives the fixed supply first, then the reserved launch portion must be paired with SOL/USDC before fans can trade.
      </div>

      {isOwner && (
        <LiquidityTopUp
          song={song}
          mintLabel={mint}
        />
      )}
    </div>
  );
}

function LiveLiquidityPanel({ song, onChanged }: { song: any; onChanged?: () => void }) {
  const mint = song.mintAddress ? `${song.mintAddress.slice(0, 6)}…${song.mintAddress.slice(-6)}` : "Mint pending";
  const pairAsset = song.liquidityPairAsset || "SOL";
  const pairAmount = Number(song.liquidityPairAmount || 0);
  const tokenAmount = Number(song.liquidityTokenAmount || 0);

  return (
    <div id="liquidity" className="panel p-5 space-y-4 border border-neon/20 bg-neon/5 shadow-xl scroll-mt-28">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-neon/15 border border-neon/25 flex items-center justify-center shrink-0">
          <BadgeCheck className="text-neon" size={18} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-black text-neon">
            Liquidity is live
            <InfoTooltip
              side="bottom"
              def="Liquidity is the public market money that lets fans buy and sell. Adding more liquidity can make trading smoother and reduce big price jumps."
            />
          </div>
          <h3 className="mt-1 text-lg font-black tracking-tight text-white">Add more liquidity anytime</h3>
          <p className="mt-2 text-xs text-mute leading-relaxed">
            Yes, you can keep adding liquidity after launch. Think of it like adding more inventory and market depth: more song coins plus more {pairAsset} go into the public pool so fans have a clearer place to buy and sell.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-edge bg-panel p-3 min-w-0">
          <div className="text-[11px] uppercase tracking-widest font-black text-mute">SPL Mint</div>
          <div className="mt-1 font-mono text-xs text-white truncate">{mint}</div>
        </div>
        <div className="rounded-xl border border-edge bg-panel p-3">
          <div className="text-[11px] uppercase tracking-widest font-black text-mute">Current Pair</div>
          <div className="mt-1 text-xs uppercase tracking-widest font-black text-neon">{pairAmount.toLocaleString()} {pairAsset}</div>
        </div>
        <div className="rounded-xl border border-edge bg-panel p-3">
          <div className="text-[11px] uppercase tracking-widest font-black text-mute">Coin Side</div>
          <div className="mt-1 text-xs uppercase tracking-widest font-black text-neon">{tokenAmount.toLocaleString()} coins</div>
        </div>
      </div>

      <div className="rounded-xl border border-neon/20 bg-neon/10 p-3 text-[11px] leading-relaxed text-neon/90">
        Your creator-held supply is separate from the public pool. Fans do not buy from a hidden artist wallet; they buy from the liquidity route. Add more liquidity when you want to deepen that public market.
      </div>

      <LiquidityTopUp song={song} mintLabel={mint} />
      <BurnTokensPanel song={song} onBurned={onChanged} />
    </div>
  );
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function SongPageAudioPlayer({
  disabled,
  playing,
  active,
  currentTime,
  duration,
  volume,
  onToggle,
  onSeek,
  onSkip,
  onVolume,
}: {
  disabled: boolean;
  playing: boolean;
  active: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
  onSkip: (seconds: number) => void;
  onVolume: (volume: number) => void;
}) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safeCurrent = safeDuration > 0 ? Math.min(currentTime, safeDuration) : 0;
  const pct = safeDuration > 0 ? Math.max(0, Math.min(100, (safeCurrent / safeDuration) * 100)) : 0;
  const rangeStyle = {
    background: `linear-gradient(to right, var(--neon) 0%, var(--neon) ${pct}%, rgba(255,255,255,0.16) ${pct}%, rgba(255,255,255,0.16) 100%)`,
  };
  const volumePct = Math.max(0, Math.min(100, Math.round(volume * 100)));
  const volumeStyle = {
    background: `linear-gradient(to right, var(--neon) 0%, var(--neon) ${volumePct}%, rgba(255,255,255,0.14) ${volumePct}%, rgba(255,255,255,0.14) 100%)`,
  };

  if (disabled) {
    return (
      <div className="mt-5 rounded-2xl border border-edge bg-panel/80 p-4 text-xs text-mute">
        No Audius audio preview is attached to this Song Coin yet.
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-2xl border border-neon/20 bg-black/35 p-4 shadow-[0_0_30px_rgba(183,255,0,0.08)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onToggle}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-neon text-pure-black shadow-neon-glow transition hover:bg-neondim"
          aria-label={playing ? "Pause song" : "Play song"}
        >
          {playing ? <Pause size={19} /> : <Play size={19} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-[11px] uppercase tracking-widest font-black text-neon">
              {playing ? "Playing from Audius" : active ? "Paused" : "Play Song"}
            </div>
            <div className="font-mono text-[11px] text-mute">
              {formatTime(safeCurrent)} / {safeDuration ? formatTime(safeDuration) : "--:--"}
            </div>
          </div>
          <input
            type="range"
            min="0"
            max={safeDuration || 100}
            step="0.1"
            value={safeDuration ? safeCurrent : 0}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="h-2 w-full appearance-none rounded-full bg-white/10 accent-neon"
            style={rangeStyle}
            aria-label="Song playback position"
          />
          <div className="mt-2 h-8 overflow-hidden rounded-xl border border-white/10 bg-panel/70">
            <div className="flex h-full items-end gap-1 px-2 pb-1 opacity-80">
              {Array.from({ length: 48 }).map((_, i) => (
                <span
                  key={i}
                  className={`w-full rounded-t bg-neon/70 ${i / 48 <= pct / 100 ? "shadow-[0_0_10px_rgba(183,255,0,0.45)]" : "opacity-25"}`}
                  style={{ height: `${20 + ((i * 17) % 72)}%` }}
                />
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-mute">
            <Volume2 size={14} className="shrink-0" />
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={volumePct}
              onChange={(e) => onVolume(Number(e.target.value) / 100)}
              className="h-2 w-full appearance-none rounded-full bg-white/10"
              style={volumeStyle}
              aria-label="Song volume"
            />
            <span className="w-10 text-right font-mono text-[11px] font-black text-mute">{volumePct}%</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:w-[92px]">
          <button
            type="button"
            onClick={() => onSkip(-10)}
            className="btn h-10 px-2 text-[11px] uppercase tracking-widest font-black"
            aria-label="Back 10 seconds"
          >
            <RotateCcw size={13} /> 10
          </button>
          <button
            type="button"
            onClick={() => onSkip(10)}
            className="btn h-10 px-2 text-[11px] uppercase tracking-widest font-black"
            aria-label="Forward 10 seconds"
          >
            10 <RotateCw size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function BurnTokensPanel({ song, onBurned }: { song: any; onBurned?: () => void }) {
  const { address } = useSession();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const { currency, prices, updatedAt } = useLiveFiatPrices(["SOL"]);
  const amountNumber = Number(amount || 0);
  const tokenUsd = Number(song.currentPriceUsd || song.launchPriceUsd || 0);
  const estimatedValueUsd = amountNumber > 0 && tokenUsd > 0 ? amountNumber * tokenUsd : null;
  const estimatedFeeSol = 0.002;
  const solUsd = Number(prices.SOL?.usd || 0);
  const estimatedFeeUsd = solUsd > 0 ? estimatedFeeSol * solUsd : null;
  const canSubmit = !!address && amountNumber > 0 && confirm.trim().toUpperCase() === "BURN";

  async function submit() {
    if (!address || !canSubmit) return;
    setBusy(true);
    setErr(null);
    setStatus(null);
    let sig: string | null = null;
    try {
      const prepared = await api<{ transaction: string; message: string }>(`/api/songs/${song.id}/burn/onchain`, {
        method: "POST",
        json: { wallet: address, amount: amountNumber },
      });
      const walletId = getConnectedWalletId();
      if (!walletId) throw new Error("No connected Solana wallet found");
      setStatus(prepared.message);
      sig = await sendSerializedTransaction(walletId, prepared.transaction);
      setStatus("Burn transaction sent. Verifying the supply update.");

      let verified = false;
      let lastError: any = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          await api(`/api/songs/${song.id}/burn`, {
            method: "POST",
            json: { wallet: address, amount: amountNumber, burnTxSig: sig },
          });
          verified = true;
          break;
        } catch (e: any) {
          lastError = e;
          await new Promise((resolve) => setTimeout(resolve, 1600 + attempt * 900));
        }
      }
      if (!verified) {
        setStatus(`Burn transaction was sent, but song-daq is still waiting for confirmation. Transaction: ${sig}. Refresh in a moment.`);
        setErr(lastError?.message || null);
        return;
      }
      setAmount("");
      setConfirm("");
      setOpen(false);
      onBurned?.();
    } catch (e: any) {
      if (sig) {
        setStatus(`Burn transaction was sent, but song-daq could not finish verification yet. Transaction: ${sig}. Refresh in a moment.`);
        setErr(e.message ?? null);
      } else {
        setErr(e.message ?? "Failed to burn tokens");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-red/20 bg-red/5 p-4 space-y-3">
      <button
        className="btn w-full h-11 border-red/25 bg-red/10 text-red hover:bg-red/15 text-[11px] font-black uppercase tracking-widest"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Close Burn Tool" : "Burn Tokens"}
      </button>
      <div className="text-[11px] uppercase tracking-widest font-bold text-red/80">
        Permanently remove coins from your wallet
      </div>
      {open && (
        <div className="space-y-3">
          <div className="rounded-xl border border-red/20 bg-red/10 p-3 text-[11px] leading-relaxed text-red/90">
            Burning destroys tokens forever. Use it only when you want to reduce supply or remove tokens you own. This is not the same as selling, and you will not receive SOL back.
          </div>
          <label className="space-y-2 text-[11px] uppercase tracking-widest font-bold text-mute">
            <span>Amount to burn</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-edge bg-panel px-4 py-3 text-sm text-ink outline-none focus:border-red/50" placeholder="1000" />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-edge bg-panel p-3">
              <div className="text-[11px] uppercase tracking-widest font-black text-mute">Estimated value removed</div>
              <div className="mt-1 font-mono text-xs font-bold text-white">{formatFiatEstimate(estimatedValueUsd, currency)}</div>
            </div>
            <div className="rounded-xl border border-edge bg-panel p-3">
              <div className="text-[11px] uppercase tracking-widest font-black text-mute">Network fee estimate</div>
              <div className="mt-1 font-mono text-xs font-bold text-white">{formatCryptoWithFiat(estimatedFeeSol, "SOL", estimatedFeeUsd, currency)}</div>
            </div>
          </div>
          <label className="space-y-2 text-[11px] uppercase tracking-widest font-bold text-mute">
            <span>Type BURN to confirm</span>
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-xl border border-edge bg-panel px-4 py-3 text-sm text-ink outline-none focus:border-red/50" placeholder="BURN" />
          </label>
          <div className="text-[11px] uppercase tracking-widest text-mute">{priceAgeText(updatedAt)}</div>
          {status && <div className="rounded-xl border border-neon/20 bg-neon/10 p-3 text-xs text-neon">{status}</div>}
          {err && <div className="rounded-xl border border-red/20 bg-red/10 p-3 text-xs text-red">{err}</div>}
          <button className="btn-primary w-full h-11 text-[11px] font-black uppercase tracking-widest disabled:opacity-50" disabled={busy || !canSubmit} onClick={submit}>
            {busy ? "Burning…" : `Permanently Burn ${amountNumber > 0 ? amountNumber.toLocaleString() : ""} $${song.symbol}`}
          </button>
        </div>
      )}
    </div>
  );
}

function LiquidityTopUp({ song, mintLabel }: { song: any; mintLabel: string }) {
  const { address } = useSession();
  const [open, setOpen] = useState(false);
  const [tokenAmount, setTokenAmount] = useState(String(song.liquidityTokenAmount || 100000));
  const [pairAmount, setPairAmount] = useState(String(song.liquidityPairAmount || 1));
  const [pairAsset, setPairAsset] = useState<"SOL" | "USDC">((song.liquidityPairAsset === "USDC" ? "USDC" : "SOL"));
  const [lockDays, setLockDays] = useState(String(song.liquidityLockDays || 180));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const { currency, prices, updatedAt } = useLiveFiatPrices([pairAsset, "SOL"]);
  const pairAmountNumber = Number(pairAmount || 0);
  const pairUsdRate = pairAsset === "USDC" ? 1 : Number(prices[pairAsset]?.usd ?? 0);
  const pairUsd = pairUsdRate > 0 ? pairAmountNumber * pairUsdRate : null;
  const estimatedFeeSol = 0.003;
  const solUsdRate = Number(prices.SOL?.usd ?? 0);
  const estimatedFeeUsd = solUsdRate > 0 ? estimatedFeeSol * solUsdRate : null;
  const poolValueUsd = pairUsd != null ? pairUsd * 2 : null;
  const totalSpendUsd = pairUsd != null && estimatedFeeUsd != null ? pairUsd + estimatedFeeUsd : null;
  const hasExistingLiquidity = Number(song.liquidityPairAmount || 0) > 0 && Number(song.liquidityTokenAmount || 0) > 0;
  const totalSpendLabel = pairAsset === "SOL"
    ? formatCryptoWithFiat(pairAmountNumber + estimatedFeeSol, "SOL", totalSpendUsd, currency)
    : `${formatCryptoWithFiat(pairAmountNumber, pairAsset, pairUsd, currency)} + ${formatCryptoWithFiat(estimatedFeeSol, "SOL", estimatedFeeUsd, currency)}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (window.location.hash === "#liquidity" || params.get("liquidity") === "1") {
      setOpen(true);
      window.setTimeout(() => document.getElementById("liquidity")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
  }, []);

  async function submit() {
    if (!address) return;
    setBusy(true);
    setErr(null);
    setStatus(null);
    let sig: string | null = null;
    try {
      const prepared = await api<{
        transaction: string;
        poolId: string;
        lpMint: string;
        mintA: string;
        mintB: string;
        configId: string;
      }>(`/api/songs/${song.id}/liquidity/onchain`, {
        method: "POST",
        json: {
          wallet: address,
          tokenAmount: Number(tokenAmount),
          pairAmount: Number(pairAmount),
          pairAsset,
          lockDays: Number(lockDays),
        },
      });
      const walletId = getConnectedWalletId();
      if (!walletId) throw new Error("No connected Solana wallet found");
      setStatus(`Approve liquidity: ${formatCryptoWithFiat(pairAmountNumber, pairAsset, pairUsd, currency)} plus ${Number(tokenAmount).toLocaleString()} song coins. Estimated total wallet spend: ${formatFiatEstimate(totalSpendUsd, currency)}.`);
      sig = await sendSerializedTransaction(walletId, prepared.transaction);
      setStatus("Liquidity transaction sent. Verifying the public pool. This can take a little while after wallet approval.");

      let verified = false;
      let lastError: any = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          setStatus(`Liquidity transaction sent. Checking confirmation (${attempt + 1}/10).`);
          await api(`/api/songs/${song.id}/liquidity`, {
            method: "POST",
            json: {
              wallet: address,
              tokenAmount: Number(tokenAmount),
              pairAmount: Number(pairAmount),
              pairAsset,
              lockDays: Number(lockDays),
              liquidityTxSig: sig,
              poolId: prepared.poolId,
              lpMint: prepared.lpMint,
            },
          });
          verified = true;
          break;
        } catch (e: any) {
          lastError = e;
          await new Promise((resolve) => setTimeout(resolve, 1800 + attempt * 1200));
        }
      }
      if (!verified) {
        setStatus(`Liquidity transaction was sent, but song-daq is still waiting for router/indexer confirmation. Transaction: ${sig}. Refresh this page in a moment.`);
        setErr(lastError?.message || null);
        return;
      }
      setOpen(false);
      window.location.reload();
    } catch (e: any) {
      if (sig) {
        setStatus(`Liquidity transaction was sent, but song-daq could not finish verification yet. Transaction: ${sig}. Refresh this page in a moment.`);
        setErr(e.message ?? null);
      } else {
        setErr(e.message ?? "Failed to add liquidity");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neon/20 bg-neon/5 p-4 space-y-3">
      <button
        className="btn-primary w-full h-11 text-[11px] font-black uppercase tracking-widest"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Close Liquidity Form" : hasExistingLiquidity ? "Add More Liquidity" : "Add Liquidity"}
      </button>
      <div className="text-[11px] uppercase tracking-widest font-bold text-neon/80">
        Artist-only liquidity {hasExistingLiquidity ? "top-up" : "setup"} for {mintLabel}
      </div>
      {open && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-2 text-[11px] uppercase tracking-widest font-bold text-mute">
              <span>Token amount</span>
              <input value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-edge bg-panel px-4 py-3 text-sm text-ink outline-none focus:border-neon/50" />
            </label>
            <label className="space-y-2 text-[11px] uppercase tracking-widest font-bold text-mute">
              <span className="flex items-center gap-1.5">
                Paired asset amount ({pairAsset})
                <InfoTooltip
                  side="bottom"
                  def={`This is the ${pairAsset} side of the public market. Fans pay with this side and receive song coins from the token side.`}
                />
              </span>
              <input value={pairAmount} onChange={(e) => setPairAmount(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-edge bg-panel px-4 py-3 text-sm text-ink outline-none focus:border-neon/50" />
              <span className="block text-[11px] normal-case tracking-normal text-mute">
                {formatCryptoWithFiat(pairAmountNumber, pairAsset, pairUsd, currency)}
              </span>
            </label>
            <label className="space-y-2 text-[11px] uppercase tracking-widest font-bold text-mute">
              <span>Paired Asset</span>
              <select value={pairAsset} onChange={(e) => setPairAsset(e.target.value as "SOL" | "USDC")} className="w-full bg-panel border border-edge rounded-xl px-4 py-3 text-sm text-ink">
                <option value="SOL">SOL</option>
                <option value="USDC">USDC</option>
              </select>
            </label>
            <label className="space-y-2 text-[11px] uppercase tracking-widest font-bold text-mute">
              <span>Liquidity lock days</span>
              <input value={lockDays} onChange={(e) => setLockDays(e.target.value)} inputMode="numeric" className="w-full rounded-xl border border-edge bg-panel px-4 py-3 text-sm text-ink outline-none focus:border-neon/50" />
            </label>
          </div>
          <div className="rounded-xl border border-edge bg-panel p-3 text-xs text-mute">
            {hasExistingLiquidity
              ? "This adds another layer of market depth to the public pool. It can help fans buy and sell with less price jump, but it is still your money going into liquidity."
              : "This sends the reserved launch coins plus paired SOL/USDC into the public pool. Once the transaction is verified, song-daq marks the coin live so fans can buy and sell."}
          </div>
          <div className="rounded-2xl border border-neon/25 bg-neon/10 p-4">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-black text-neon">
              Full estimated spend
              <InfoTooltip
                side="bottom"
                def="This is the real-world estimate before you sign: the paired asset you add to liquidity plus the Solana network fee. Your wallet may show a tiny final fee difference."
              />
            </div>
            <div className="mt-2 font-mono text-sm font-black text-white break-words">{totalSpendLabel}</div>
            <div className="mt-1 text-xs font-bold text-neon">{formatFiatEstimate(totalSpendUsd, currency)}</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-edge bg-panel p-3">
              <div className="text-[11px] uppercase tracking-widest font-black text-mute">Payment side</div>
              <div className="mt-1 font-mono text-xs font-bold text-white">{formatCryptoWithFiat(pairAmountNumber, pairAsset, pairUsd, currency)}</div>
            </div>
            <div className="rounded-xl border border-edge bg-panel p-3">
              <div className="text-[11px] uppercase tracking-widest font-black text-mute">Estimated pool</div>
              <div className="mt-1 font-mono text-xs font-bold text-neon">{formatFiatEstimate(poolValueUsd, currency)}</div>
            </div>
            <div className="rounded-xl border border-edge bg-panel p-3">
              <div className="text-[11px] uppercase tracking-widest font-black text-mute">Network fee</div>
              <div className="mt-1 font-mono text-xs font-bold text-white">{formatCryptoWithFiat(estimatedFeeSol, "SOL", estimatedFeeUsd, currency)}</div>
            </div>
          </div>
          <div className="text-[11px] uppercase tracking-widest text-mute">{priceAgeText(updatedAt)}</div>
          {status && <div className="rounded-xl border border-neon/20 bg-neon/10 p-3 text-xs text-neon">{status}</div>}
          {err && <div className="rounded-xl border border-red/20 bg-red/10 p-3 text-xs text-red">{err}</div>}
          <button className="btn-primary w-full h-11 text-[11px] font-black uppercase tracking-widest disabled:opacity-50" disabled={busy} onClick={submit}>
            {busy ? "Saving Liquidity…" : `Confirm Liquidity · ${formatFiatEstimate(totalSpendUsd, currency)}`}
          </button>
        </div>
      )}
    </div>
  );
}

function Sline({ k, v, color }: { k: string; v: string; color: "violet" | "neon" | "mute" }) {
  const dot = color === "violet" ? "bg-violet shadow-[0_0_8px_rgba(155,81,224,0.8)]" : color === "neon" ? "bg-neon shadow-[0_0_8px_rgba(0,229,114,0.8)]" : "bg-white/40";
  return (
    <div className="flex items-center justify-between group">
      <span className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-bold text-mute group-hover:text-white transition"><span className={`w-2 h-2 rounded-full ${dot}`} />{k}</span>
      <span className="num font-bold text-white tracking-wider">{v}</span>
    </div>
  );
}

function Toggle({ k, on }: { k: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between group">
      <span className="text-[11px] uppercase tracking-widest font-bold text-mute group-hover:text-white transition">{k}</span>
      <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${on ? "text-neon bg-neon/10 border-neon/30 drop-shadow-[0_0_5px_rgba(0,229,114,0.3)]" : "text-mute bg-panel2 border-edge"}`}>{on ? "ACTIVE" : "DISABLED"}</span>
    </div>
  );
}
