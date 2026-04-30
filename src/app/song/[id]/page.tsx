"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ShieldCheck, ExternalLink } from "lucide-react";
import { PriceChart, type PricePointDTO } from "@/components/PriceChart";
import { TradePanel } from "@/components/TradePanel";
import { TradeFeed } from "@/components/TradeFeed";
import { useSession } from "@/lib/store";
import { fmtSol, fmtNum, fmtPct } from "@/lib/pricing";
import { spotPrice, quoteBuyByTokens, quoteSellByTokens } from "@/lib/bondingCurve";
import { Glossary } from "@/components/Tooltip";

type Range = "LIVE" | "15S" | "1MIN" | "15MIN" | "30MIN" | "1H" | "1D" | "1W" | "1MO" | "ALL";
const RANGE_MS: Record<Range, number> = {
  "LIVE": 15_000,
  "15S": 15_000,
  "1MIN": 60_000,
  "15MIN": 900_000,
  "30MIN": 1800_000,
  "1H": 3600_000,
  "1D": 86400_000,
  "1W": 7 * 86400_000,
  "1MO": 30 * 86400_000,
  "ALL": Date.now() - 1700000000000, // Roughly all
};

export default function SongTradingPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { address } = useSession();
  const [song, setSong] = useState<any>(null);
  const [points, setPoints] = useState<PricePointDTO[]>([]);
  const [holders, setHolders] = useState<any[]>([]);
  const [range, setRange] = useState<Range>("1D");
  const [watching, setWatching] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, p, h] = await Promise.all([
        fetch(`/api/songs/${id}`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/price/${id}`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/songs/${id}/holders`, { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (s.error) throw new Error(s.error);
      setSong(s.song);
      setPoints(p.points || []);
      setHolders(h.holders || []);
    } catch (e: any) { setErr(e.message); }
  }, [id]);

  useEffect(() => { load(); const i = setInterval(load, 4_000); return () => clearInterval(i); }, [load]);

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
    const cutoff = now - RANGE_MS[range];
    
    // 1. Filter existing points
    let res = points.filter((x) => new Date(x.ts as any).getTime() >= cutoff);

    // 2. Map and ensure we have at least a current price point
    if (song) {
      const livePoint = { 
        ts: new Date(), 
        open: song.price, 
        high: song.price, 
        low: song.price, 
        close: song.price, 
        volume: 0 
      } as any;

      // If no points in range, synthesize a starting point at the cutoff
      if (res.length === 0) {
        res = [
          { ts: new Date(cutoff), open: song.price, high: song.price, low: song.price, close: song.price, volume: 0 } as any,
          livePoint
        ];
      } else {
        res.push(livePoint);
      }
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
  if (!song) return <div className="panel p-10 text-center text-neon uppercase tracking-widest text-[10px] animate-pulse">Establishing Connection to Network…</div>;

  const change = (song.performance - 1) * 100;

  if (advancedMode) {
    return (
      <div className="fixed inset-0 z-[100] bg-bg text-ink flex flex-col font-sans overflow-hidden">
        {/* Top Navbar */}
        <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 shrink-0 bg-bg shadow-md z-10">
          <div className="flex items-center gap-4">
            {song.artworkUrl ? <Image src={song.artworkUrl} alt={song.title} width={36} height={36} className="rounded-md shadow-sm" /> : <div className="w-9 h-9 rounded-md bg-white/10" />}
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-white">{song.title}</h1>
              <span className="font-mono text-xs font-bold text-neon bg-neon/10 px-2 py-0.5 rounded border border-neon/20">${song.symbol}</span>
            </div>
            <div className="w-px h-6 bg-white/10 mx-2" />
            <div className="flex items-baseline gap-3">
              <span className="text-xl font-mono font-bold text-white">{fmtSol(song.price, 6)} <span className="text-[10px] text-white/40">SOL</span></span>
              <span className={`num text-sm font-bold tracking-wider ${change >= 0 ? "gain" : "lose"}`}>
                {change >= 0 ? "+" : ""}{fmtPct(change)}
              </span>
            </div>
            <div className="flex gap-4 ml-6 text-xs text-white/40 font-mono">
              <div>MC: <span className="text-white">${fmtNum(song.marketCap)}</span></div>
              <div>Vol: <span className="text-white">${fmtNum(song.marketCap * 0.14)}</span></div>
              <div>Holders: <span className="text-white">{fmtNum(holders.length)}</span></div>
            </div>
          </div>
          
          <button 
            onClick={() => setAdvancedMode(false)} 
            className="px-4 py-2 bg-red/10 text-red border border-red/20 hover:bg-red/20 transition-all rounded-md text-[10px] uppercase tracking-widest font-bold shadow-sm flex items-center gap-2"
          >
            <span>Exit Terminal</span>
            <span className="text-lg leading-none">&times;</span>
          </button>
        </div>

        {/* Main Terminal Layout */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Sidebar (TradeFeed + Holders) */}
          <div className="w-80 border-r border-white/10 flex flex-col bg-panel2 overflow-y-auto no-scrollbar shrink-0">
            <div className="p-3 border-b border-white/5 bg-black/40">
              <div className="text-[10px] uppercase tracking-widest font-bold text-white/40">Live Order Tape</div>
            </div>
            <div className="h-[50%] overflow-y-auto no-scrollbar border-b border-white/10 p-2">
              <TradeFeed />
            </div>
            <div className="p-3 border-b border-white/5 bg-black/40">
              <div className="text-[10px] uppercase tracking-widest font-bold text-white/40">Top Holders</div>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar p-2">
              <ul className="divide-y divide-white/5 text-xs">
                {holders.map((h, i) => (
                  <li key={h.wallet} className="px-3 py-2 flex items-center justify-between hover:bg-white/5 transition rounded">
                    <span className="font-mono text-white/60 truncate max-w-[100px]">{h.audiusHandle ? `@${h.audiusHandle}` : `${h.wallet.slice(0, 4)}…`}</span>
                    <span className="num font-bold text-neon">{h.pct.toFixed(2)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* Center (Chart & Depth) */}
          <div className="flex-1 flex flex-col min-w-0 bg-bg relative">
            <div className="absolute inset-0 bg-gradient-to-b from-neon/5 to-transparent pointer-events-none opacity-20" />
            
            {/* Chart Toolbar */}
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/5 bg-black/20 relative z-10 overflow-x-auto no-scrollbar">
              {(["LIVE", "15S", "1MIN", "15MIN", "30MIN", "1H", "1D", "1W", "1MO", "ALL"] as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 rounded text-[10px] uppercase tracking-widest font-bold transition-all shrink-0 ${range === r ? "bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]" : "text-white/40 hover:text-white hover:bg-white/5"}`}
                >{r}</button>
              ))}
            </div>

            {/* Chart */}
            <div className="flex-1 p-4 relative z-10">
              <div className="w-full h-full min-h-[300px]">
                <PriceChart points={filtered} />
              </div>
            </div>

            {/* Bottom Panel (Liquidity Matrix) */}
            <div className="h-[35%] border-t border-white/10 bg-panel2 flex flex-col relative z-10">
              <div className="p-2 border-b border-white/5 bg-black/40 px-4">
                <div className="text-[10px] uppercase tracking-widest font-bold text-white/40">Liquidity Matrix</div>
              </div>
              <div className="flex-1 overflow-y-auto no-scrollbar p-2">
                {!depth ? null : (
                  <table className="w-full text-[11px] text-left">
                    <thead className="text-white/30 uppercase tracking-widest font-mono">
                      <tr>
                        <th className="px-4 py-2">Size</th>
                        <th className="text-right px-4 py-2 text-neon">Ask (Buy)</th>
                        <th className="text-right px-4 py-2 text-red">Bid (Sell)</th>
                        <th className="text-right px-4 py-2">Slippage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {depth.buys.map((b, i) => {
                        const s = depth.sells[i];
                        return (
                          <tr key={b.tokens} className="hover:bg-white/5 transition">
                            <td className="px-4 py-2 font-bold text-white/70">{fmtNum(b.tokens)}</td>
                            <td className="px-4 py-2 text-right text-white/90">{fmtSol(b.total, 4)}</td>
                            <td className="px-4 py-2 text-right text-white/90">{fmtSol(s.total, 4)}</td>
                            <td className="px-4 py-2 text-right text-white/40">{(b.slipBps/100).toFixed(2)}%</td>
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
          <div className="w-[380px] border-l border-white/10 bg-[#050505] overflow-y-auto no-scrollbar shrink-0 p-4 space-y-4">
            <TradePanel song={song} onTraded={load} />
            
            <div className="panel p-4 bg-black/20">
              <div className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3">Distributor Royalties</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs"><span className="text-white/50">Artist Share</span><span className="font-mono text-violet font-bold">{(song.artistShareBps / 100).toFixed(0)}%</span></div>
                <div className="flex justify-between items-center text-xs"><span className="text-white/50">Holder Dividend</span><span className="font-mono text-neon font-bold">{(song.holderShareBps / 100).toFixed(0)}%</span></div>
                <div className="flex justify-between items-center text-xs"><span className="text-white/50">Status</span>{song.splitsLocked ? <span className="chip-neon border-none px-1 py-0 shadow-none">Locked</span> : <span className="text-[10px] text-orange-500 font-bold uppercase tracking-widest">Pending</span>}</div>
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
        <div className="panel p-6 flex flex-col md:flex-row items-start md:items-center gap-6 relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-neon/5 to-transparent pointer-events-none mix-blend-screen" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-neon/10 rounded-full blur-[80px] pointer-events-none mix-blend-screen" />
          
          <div className="relative w-28 h-28 rounded-xl overflow-hidden bg-black/60 shrink-0 shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/10 group">
            {song.artworkUrl ? <Image src={song.artworkUrl} alt={song.title} fill sizes="112px" className="object-cover group-hover:scale-105 transition-transform duration-500" /> : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
            {song.streamUrl && (
              <div className="absolute bottom-2 left-2 right-2">
                <audio controls src={song.streamUrl} className="w-full h-6 opacity-80 hover:opacity-100 transition filter grayscale invert" preload="none" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 relative z-10">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-md truncate">{song.title}</h1>
              <span className="font-mono text-sm font-bold text-neon bg-neon/10 px-2 py-0.5 rounded border border-neon/20 shadow-[0_0_10px_rgba(0,229,114,0.3)]">${song.symbol}</span>
            </div>
            <div className="text-white/60 text-sm flex items-center gap-2 font-medium">
              <span>{song.artistName}</span>
              {song.artistWallet?.audiusHandle && <span className="text-white/40">· @{song.artistWallet.audiusHandle}</span>}
              {song.artistWallet?.audiusVerified && <span className="chip border-neon/40 text-neon bg-neon/10 ml-2 shadow-[0_0_5px_rgba(0,229,114,0.3)]">Verified</span>}
            </div>
            <div className="mt-4 flex items-baseline gap-4">
              <span className="text-4xl font-mono font-bold text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">{fmtSol(song.price, 6)} SOL</span>
              <span className={`num text-lg font-bold tracking-wider ${change >= 0 ? "gain drop-shadow-[0_0_10px_rgba(0,229,114,0.4)]" : "lose drop-shadow-[0_0_10px_rgba(255,51,102,0.4)]"}`}>
                {change >= 0 ? "+" : ""}{fmtPct(change)}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold ml-2">ATH {fmtSol(song.ath, 6)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 shrink-0 relative z-10">
            {address && (
              <button className={`px-4 py-2 rounded-lg text-[10px] uppercase tracking-widest font-bold transition-all shadow-lg ${watching ? "bg-neon/20 text-neon border border-neon/50 shadow-[0_0_15px_rgba(0,229,114,0.3)]" : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white"}`} onClick={toggleWatch}>
                {watching ? "★ Tracking" : "☆ Track"}
              </button>
            )}
            <button className="px-4 py-2 rounded-lg text-[10px] uppercase tracking-widest font-bold transition-all shadow-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white" onClick={() => setAdvancedMode(true)}>
              ◱ Terminal
            </button>
            {song.splitsLocked ? (
              <span className="text-[9px] uppercase tracking-widest font-bold text-neon flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-neon rounded-full shadow-[0_0_5px_rgba(0,229,114,0.8)]" /> Splits Locked</span>
            ) : (
              <span className="text-[9px] uppercase tracking-widest font-bold text-orange-500 flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(249,115,22,0.8)]" /> Unverified Splits</span>
            )}
          </div>
        </div>

        <div className="panel p-5 relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40 pointer-events-none" />
          <div className="px-2 pt-1 pb-4 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
              {(["1D", "1W", "1M", "3M", "1Y", "2Y"] as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1.5 rounded-md text-[10px] uppercase tracking-widest font-bold transition-all ${range === r ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white"}`}
                >{r}</button>
              ))}
            </div>
            <span className="text-[10px] uppercase tracking-widest font-mono text-white/30">{filtered.length} Candles</span>
          </div>
          <div className="relative z-10 h-[380px]">
            <PriceChart points={filtered} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat k="Market Cap" v={`${fmtSol(song.marketCap, 2)} SOL`} tooltip="Total network valuation based on current spot price." />
          <Stat k="Circulating" v={`${fmtNum(song.circulating)} / ${fmtNum(song.supply)}`} tooltip="Tokens actively trading versus total minted supply." />
          <Stat k="Reserve" v={`${fmtSol(song.reserveSol, 2)} SOL`} tooltip="Liquidity pool backing the bonding curve." />
          <Stat k="Royalty Pool" v={`${fmtSol(song.royaltyPool, 4)} SOL`} tooltip="Accumulated streaming royalties awaiting distribution." />
          <Stat k="Streams" v={fmtNum(song.streams)} />
          <Stat k="Likes" v={fmtNum(song.likes)} />
          <Stat k="Reposts" v={fmtNum(song.reposts)} />
          <Stat k="Performance" v={`${song.performance.toFixed(2)}x`} accent={change >= 0 ? "gain" : "lose"} tooltip="Multiple of initial launch price." />
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="panel overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-white/10 flex justify-between items-center bg-black/20">
              <div className="label">Institutional Holders</div>
            </div>
            {!holders.length ? (
              <div className="px-6 py-12 text-center text-white/40 text-[10px] uppercase tracking-widest font-bold">No registered wallets.</div>
            ) : (
              <ul className="divide-y divide-white/5 max-h-[300px] overflow-y-auto">
                {holders.map((h, i) => (
                  <li key={h.wallet} className="px-5 py-3 flex items-center gap-4 text-sm hover:bg-white/5 transition">
                    <span className="text-white/30 w-5 num text-xs font-bold">{i + 1}</span>
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
            <div className="px-5 py-4 border-b border-white/10 bg-black/20">
              <Glossary term="Depth" def="Simulated slippage across increasing order sizes based on current curve liquidity.">
                Liquidity Matrix
              </Glossary>
            </div>
            {!depth ? null : (
              <table className="w-full text-xs text-left">
                <thead className="bg-black/40 text-white/40 text-[9px] uppercase tracking-widest font-bold border-b border-white/5">
                  <tr>
                    <th className="px-5 py-3">Lot Size</th>
                    <th className="text-right px-5 py-3 text-neon">Ask (Buy)</th>
                    <th className="text-right px-5 py-3 text-red">Bid (Sell)</th>
                    <th className="text-right px-5 py-3">Slippage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {depth.buys.map((b, i) => {
                    const s = depth.sells[i];
                    return (
                      <tr key={b.tokens} className="hover:bg-white/5 transition">
                        <td className="px-5 py-3 font-mono font-bold text-white/80">{fmtNum(b.tokens)}</td>
                        <td className="px-5 py-3 text-right num text-white font-medium">{fmtSol(b.total, 4)}</td>
                        <td className="px-5 py-3 text-right num text-white font-medium">{fmtSol(s.total, 4)}</td>
                        <td className="px-5 py-3 text-right num font-mono text-white/40">{(b.slipBps/100).toFixed(2)}%</td>
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
        <TradePanel song={song} onTraded={load} />
        
        {!song.splitsLocked && (
          <div className="panel p-5 bg-orange-500/5 border border-orange-500/20 rounded-2xl space-y-4 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="text-orange-500" size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-orange-500">Unverified Splits</h4>
                <p className="text-[10px] text-white/50 leading-relaxed font-medium">This asset has not yet locked its royalty distribution protocol. Holders are not receiving streaming revenue.</p>
              </div>
            </div>
            <Link href="/splits" className="btn w-full py-3 text-[10px] font-black uppercase tracking-widest bg-orange-500/10 border-orange-500/20 text-orange-500 hover:bg-orange-500/20 transition-all flex items-center justify-center gap-2">
              Setup splits with your distributor <ExternalLink size={12} />
            </Link>
          </div>
        )}

        <div className="panel overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-white/10 bg-black/20">
            <Glossary term="Royalties" def="How external revenue is distributed among network participants.">
              Distribution Architecture
            </Glossary>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-3 border-b border-white/10 pb-4">
              <Sline k="Artist Allocation" v={`${(song.artistShareBps / 100).toFixed(0)}%`} color="violet" />
              <Sline k="Holder Dividend" v={`${(song.holderShareBps / 100).toFixed(0)}%`} color="neon" />
              <Sline k="Protocol Treasury" v={`${(song.protocolShareBps / 100).toFixed(0)}%`} color="mute" />
            </div>
            
            <div className="space-y-3 border-b border-white/10 pb-4">
              <Toggle k="Streaming Revenue Sync" on={song.streamingEnabled} />
              <Toggle k="Secondary Trading Fees" on={song.tradingFeesEnabled} />
              <Toggle k="External Merch/Sync" on={song.externalRevenueEnabled} />
            </div>
            
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center"><span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">DSP Distributor</span><span className="font-medium text-xs text-white/80">{song.distributor || "Decentralized"}</span></div>
              <div className="flex justify-between items-center"><span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Master Vault</span><a href={`mailto:${song.royaltyVault}`} className="font-mono text-[10px] text-neon hover:text-[#00FC7D] hover:drop-shadow-[0_0_5px_rgba(0,229,114,0.5)] transition truncate max-w-[200px]">{song.royaltyVault || "Network Locked"}</a></div>
              <div className="flex justify-between items-center"><span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">SPL Token</span><span className="font-mono text-[10px] text-white/60 bg-white/5 px-2 py-0.5 rounded border border-white/10">{song.mintAddress?.slice(0, 4)}…{song.mintAddress?.slice(-4)}</span></div>
            </div>
          </div>
        </div>
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

function Sline({ k, v, color }: { k: string; v: string; color: "violet" | "neon" | "mute" }) {
  const dot = color === "violet" ? "bg-violet shadow-[0_0_8px_rgba(155,81,224,0.8)]" : color === "neon" ? "bg-neon shadow-[0_0_8px_rgba(0,229,114,0.8)]" : "bg-white/40";
  return (
    <div className="flex items-center justify-between group">
      <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-white/60 group-hover:text-white transition"><span className={`w-2 h-2 rounded-full ${dot}`} />{k}</span>
      <span className="num font-bold text-white tracking-wider">{v}</span>
    </div>
  );
}

function Toggle({ k, on }: { k: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between group">
      <span className="text-[10px] uppercase tracking-widest font-bold text-white/50 group-hover:text-white/80 transition">{k}</span>
      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${on ? "text-neon bg-neon/10 border-neon/30 drop-shadow-[0_0_5px_rgba(0,229,114,0.3)]" : "text-white/30 bg-white/5 border-white/10"}`}>{on ? "ACTIVE" : "DISABLED"}</span>
    </div>
  );
}
