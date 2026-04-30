"use client";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { useSession } from "@/lib/store";
import { useNativeBalance, useAudiusAudioBalance } from "@/components/WalletBalance";
import { fmtSol, fmtNum, fmtPct } from "@/lib/pricing";
import { Glossary } from "@/components/Tooltip";
import { ArrowUpRight } from "lucide-react";

export default function PortfolioPage() {
  const { address, audius } = useSession();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!address) return;
    let alive = true;
    async function load() {
      try {
        const params = new URLSearchParams({ wallet: address! });
        if (audius?.userId) params.set("audiusUserId", audius.userId);
        if (audius?.wallets?.sol) params.set("audiusSolWallet", audius.wallets.sol);
        if (audius?.wallets?.eth) params.set("audiusEthWallet", audius.wallets.eth);
        
        const r = await fetch(`/api/portfolio?${params}`, { cache: "no-store" });
        const j = await r.json();
        if (alive) setData(j);
      } catch { /* ignore network errors */ }
    }
    load();
    const i = setInterval(load, 5_000);
    return () => { alive = false; clearInterval(i); };
  }, [address, audius?.userId]);

  if (!address) {
    return <div className="panel p-10 text-center text-white/50 text-sm uppercase tracking-widest rounded-3xl">Connect a wallet to view your portfolio.</div>;
  }
  if (!data) return <div className="panel p-10 text-center text-neon text-sm uppercase tracking-widest animate-pulse rounded-3xl">Loading intelligence…</div>;
  if (data.error) return <div className="panel p-10 text-center text-red font-bold uppercase tracking-widest rounded-3xl">{data.error}</div>;
  if (!data.summary || !data.holdings) return <div className="panel p-10 text-center text-white/50 uppercase tracking-widest rounded-3xl">Failed to load portfolio data.</div>;

  return <PortfolioInner data={data} audius={audius} />;
}

function PortfolioInner({ data, audius }: { data: any; audius: any }) {
  const s = data.summary;
  const pnlPct = s.cost > 0 ? (s.pnl / s.cost) * 100 : 0;

  const allocation = useMemo(() => {
    const songValue = data.holdings.reduce((acc: number, h: any) => acc + h.amount * h.song.price, 0);
    const coinValue = (data.coinHoldings ?? []).reduce((acc: number, h: any) => acc + h.amount * (h.livePrice ?? h.costBasis), 0);
    return [
      { name: "Artist Coins", value: songValue, color: "#00E572" },
      { name: "Audius Ecosystem", value: coinValue, color: "#9B51E0" },
    ];
  }, [data]);

  const { kind, address } = useSession();

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto text-white px-2 md:px-0">
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 md:px-2">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Hi, @{audius?.handle ?? "Investor"}!</h1>
          <p className="text-mute text-sm mt-1">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN */}
        <div className="space-y-6 flex flex-col">
          {/* Portfolio Overview */}
          <div className="bg-panel border border-violet/10 shadow-sm rounded-2xl md:rounded-[32px] p-6 md:p-8 flex-1 flex flex-col relative overflow-hidden">
            <h2 className="text-2xl text-white/90 mb-6">Portfolio Overview</h2>
            <div className="flex justify-between items-start mb-12">
              <div>
                <p className="text-mute text-xs md:text-sm mb-1 uppercase tracking-widest font-bold">Total Value</p>
                <p className="text-3xl md:text-5xl font-medium tracking-tighter">{fmtSol(s.value, 2)} SOL</p>
              </div>
              <div className="bg-panel2 px-4 py-2 rounded-full text-xs font-medium text-white/70">
                30 Days
              </div>
            </div>

            {/* Custom Bar Chart mimicking image */}
            <div className="flex-1 min-h-[200px] flex items-end justify-between gap-4 mt-auto relative z-10 pt-10">
              <div className="absolute left-0 top-[40%] right-0 border-t border-dashed border-white/20 z-0"></div>
              <div className="absolute left-0 top-[40%] -translate-y-1/2 bg-black px-2 py-1 rounded text-neon text-sm font-bold z-10 flex items-center gap-1">
                <ArrowUpRight size={14} /> +{(pnlPct).toFixed(1)}%
              </div>

              {[0.4, 0.3, 0.9, 0.6].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end relative z-10 h-full">
                  <div className="absolute -top-8 bg-white text-black font-bold text-[10px] px-2 py-1 rounded shadow-lg flex items-center gap-1">
                    <ArrowUpRight size={10} className={i % 2 === 0 ? "text-neon" : "text-black"} /> {(s.value * h).toFixed(1)}
                  </div>
                  <div 
                    className={`w-full rounded-t-xl transition-all ${i === 2 ? "bg-white" : "bg-panel2"}`} 
                    style={{ 
                      height: `${h * 100}%`,
                      backgroundImage: i === 2 ? "repeating-linear-gradient(45deg, transparent, transparent 10px, var(--ink) 10px, var(--ink) 20px)" : "none",
                      opacity: i === 2 ? 1 : 0.8
                    }} 
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Crypto Holdings Donut Area */}
          <div className="bg-panel border border-violet/10 shadow-sm rounded-2xl md:rounded-[32px] p-6 md:p-8 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="w-full flex justify-between items-center mb-8">
              <h2 className="text-xl text-white/90">Asset Holdings</h2>
              <button className="w-10 h-10 rounded-full bg-neon text-black flex items-center justify-center">
                <ArrowUpRight size={20} />
              </button>
            </div>
            
            <div className="flex gap-4 mb-8 text-sm text-mute">
              <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-panel2" /> Artist Coins</span>
              <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-white/20" /> Audius Ecosystem</span>
              <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-white" /> Liquid Assets</span>
            </div>

            {/* Fake Donut Arc */}
            <div className="relative w-[200px] h-[100px] overflow-hidden mb-8">
              <div className="absolute top-0 left-0 w-[200px] h-[200px] rounded-full border-[30px] border-panel2 border-t-white border-l-white/20 border-r-transparent transform -rotate-45" />
            </div>

            {/* Bottom Actions */}
            <div className="flex w-full gap-4 mt-auto">
              <Link href="/" className="flex-1 bg-gradient-to-r from-violet to-violet/80 text-white rounded-full py-4 font-bold flex items-center justify-center gap-2 shadow-lg shadow-violet/20 hover:scale-[1.02] transition-transform">
                Discover
              </Link>
              <button className="w-16 h-16 rounded-full bg-panel2 flex items-center justify-center">
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h16M4 6h16M4 18h16"></path></svg>
              </button>
              <button className="w-16 h-16 rounded-full bg-panel2 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6 flex flex-col">
          
          {/* Asset Allocation Dot Matrix */}
          <div className="bg-panel border border-violet/10 shadow-sm rounded-2xl md:rounded-[32px] p-6 md:p-8 relative">
             <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl text-white/90">Asset Allocation</h2>
                <div className="flex items-center gap-3">
                   <span className="text-sm bg-panel2 px-4 py-1.5 rounded-full">Weekly ⌄</span>
                   <button className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center">⋯</button>
                </div>
             </div>

             <div className="flex justify-between items-end mb-8">
                <div>
                  <p className="text-4xl font-medium tracking-tight mb-1">${(s.value * 200).toFixed(1)}K</p>
                  <p className="text-xs text-mute">Total</p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[9px] text-mute">
                   <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-neon/20"/> $1-$100</span>
                   <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-neon/60"/> &gt;$300</span>
                   <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-neon/40"/> $100-$300</span>
                   <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-panel2"/> None</span>
                </div>
             </div>

             {/* Matrix Grid */}
             <div className="space-y-4">
                {['Artist Coins', 'Ecosystem', 'Liquid'].map((asset, i) => (
                   <div key={asset} className="flex items-center gap-4">
                      <span className="w-20 text-xs text-mute">{asset}</span>
                      <div className="flex gap-2">
                        {[1,2,3,4,5,6,7].map((day, j) => {
                           const isStriped = (i+j)%3===0;
                           const isFilled = (i+j)%4===0;
                           const isBright = (i+j)%5===0;
                           return (
                             <div 
                               key={day} 
                               className={`w-6 h-6 rounded-full transition-colors ${isBright ? "bg-neon/60" : isFilled ? "bg-white/80" : "bg-panel2"}`}
                               style={{ backgroundImage: isStriped ? "repeating-linear-gradient(45deg, rgba(0,0,0,0.1), rgba(0,0,0,0.1) 2px, transparent 2px, transparent 4px)" : "none" }}
                             />
                           )
                        })}
                      </div>
                   </div>
                ))}
                <div className="flex pl-24 gap-2 text-[10px] text-mute pt-2">
                  <span className="w-6 text-center">M</span>
                  <span className="w-6 text-center">T</span>
                  <span className="w-6 text-center">W</span>
                  <span className="w-6 text-center">T</span>
                  <span className="w-6 text-center">F</span>
                  <span className="w-6 text-center">S</span>
                  <span className="w-6 text-center">S</span>
                </div>
             </div>
          </div>

          {/* Today's Earnings */}
          <div className="bg-panel border border-violet/10 shadow-sm rounded-2xl md:rounded-[32px] p-6 md:p-8 relative flex flex-col justify-center">
             <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl text-white/90">Today's Earnings</h2>
                <button className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/70">
                  <ArrowUpRight size={18} />
                </button>
             </div>
             <div className="flex items-end gap-4">
                <p className="text-5xl font-medium tracking-tight">{fmtSol(s.royalty, 4)}</p>
                <div className="pb-1 text-neon">
                   <p className="font-bold">+73%</p>
                   <p className="text-[9px] text-mute">Percentage Change</p>
                </div>
             </div>
          </div>

          {/* Topographic Ad Card */}
          <div className="bg-panel shadow-sm border border-violet/10 rounded-2xl md:rounded-[32px] p-6 md:p-8 relative overflow-hidden flex-1 flex flex-col justify-between" style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')", backgroundBlendMode: "overlay" }}>
             <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 100% 100%, rgba(212,255,0,0.4) 0%, transparent 50%), repeating-radial-gradient(circle at 100% 100%, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 11px)" }} />
             
             <div className="flex justify-between items-start relative z-10">
                <h2 className="text-2xl text-white font-medium max-w-[200px]">Join Our Crypto Mastery Class</h2>
                <button className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/70 bg-black/20 backdrop-blur-md">
                  <ArrowUpRight size={18} />
                </button>
             </div>

             <div className="flex items-center gap-3 relative z-10 mt-6 mb-8">
                <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold text-white">15%</span>
                <span className="text-sm text-white/70">discount for members</span>
             </div>

             {/* Action Bar inside Promo Card */}
             <div className="flex w-full gap-4 relative z-10">
                <Link href="/" className="flex-1 bg-neon text-black rounded-full py-4 font-bold flex items-center justify-center gap-2">
                  Discover
                </Link>
                <button className="w-16 h-16 rounded-full bg-panel2 flex items-center justify-center">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h16M4 6h16M4 18h16"></path></svg>
                </button>
                <button className="w-16 h-16 rounded-full bg-panel2 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </button>
             </div>
          </div>

        </div>
      </div>

    </div>
  );
}
