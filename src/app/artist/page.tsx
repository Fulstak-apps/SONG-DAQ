"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/store";
import { CoinLauncher } from "@/components/CoinLauncher";
import { fmtNum } from "@/lib/pricing";
import { formatCryptoWithFiat, priceAgeText, useLiveFiatPrices } from "@/lib/fiat";

import { Glossary } from "@/components/Tooltip";

export default function ArtistPage() {
  const { address, provider, audius } = useSession();
  const [me, setMe] = useState<any>(null);
  const [mySongs, setMySongs] = useState<any[]>([]);
  const [loadingMe, setLoadingMe] = useState(false);
  const [checkedMe, setCheckedMe] = useState(false);
  const tradingWallet = address && provider !== "audius" ? address : null;
  const artistIdentityWallet = tradingWallet || audius?.wallets?.sol || address || null;
  const activeWallet = artistIdentityWallet;
  const { currency, prices: fiatPrices, updatedAt: fiatUpdatedAt } = useLiveFiatPrices(["SOL"]);
  const solUsdRate = Number(fiatPrices.SOL?.usd ?? 0);

  async function loadMe(blocking = false) {
    if (!activeWallet) return;
    if (blocking) setLoadingMe(true);
    const r = await fetch(`/api/me?wallet=${encodeURIComponent(activeWallet)}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    setMe(r.user ?? null);
    setCheckedMe(true);
    if (blocking) setLoadingMe(false);
  }

  async function loadSongs() {
    if (!activeWallet) return;
    const r = await fetch(`/api/songs?sort=new&owner=${encodeURIComponent(activeWallet)}`).then((r) => r.json()).catch(() => ({}));
    setMySongs(r.songs || []);
  }

  useEffect(() => {
    setCheckedMe(false);
    loadMe(true);
    loadSongs();
  }, [activeWallet, audius?.userId]);

  if (!activeWallet) {
    return <div className="panel p-10 text-center text-mute text-sm uppercase tracking-widest font-bold">Connect a wallet to access artist tools.</div>;
  }
  if (!audius) {
    return (
      <div className="panel p-10 text-center space-y-4 max-w-lg mx-auto mt-10 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-violet/5 to-transparent pointer-events-none" />
        <div className="text-white text-lg font-bold">Audius Authentication Required</div>
        <div className="text-mute text-sm leading-relaxed">
          Sign in with Audius to verify your artist identity and establish ownership.
        </div>
        <div className="text-[10px] text-mute uppercase tracking-widest font-bold border-t border-edge pt-4 mt-4">
          Verification unlocks automated royalty splitting and token launch capabilities.
        </div>
      </div>
    );
  }

  if (loadingMe && !checkedMe) {
    return <div className="panel p-10 text-center text-mute text-sm uppercase tracking-widest font-bold">Verifying artist access...</div>;
  }

  if (me?.role && me.role !== "ARTIST") {
    return (
      <div className="panel p-10 text-center space-y-4 max-w-lg mx-auto mt-10 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-red/5 to-transparent pointer-events-none" />
        <div className="text-white text-lg font-bold">Artist Access Restricted</div>
        <div className="text-mute text-sm leading-relaxed">
          Your account is currently registered as an Investor. Only verified Artists can launch Artist Tokens and access the studio.
        </div>
      </div>
    );
  }

  const artistRevenue = mySongs.reduce((acc, s) => acc + (s.royaltyPool * s.artistShareBps) / 10_000, 0);
  const totalCap = mySongs.reduce((acc, s) => acc + s.marketCap, 0);
  const totalHolders = 0;

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <header className="relative panel p-8 overflow-hidden shadow-2xl border border-edge flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-neon/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
        <div className="relative z-10">
          <h1 className="text-4xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 flex items-center gap-3">
            Song Studio
            {audius.verified && <span className="text-[10px] uppercase tracking-widest text-black bg-neon px-2 py-0.5 rounded shadow-[0_0_10px_rgba(0,229,114,0.5)] font-bold">Verified</span>}
          </h1>
          <p className="text-mute mt-2 font-medium break-words whitespace-normal">
            Authenticated as <span className="text-white">{audius.name || `@${audius.handle}`}</span>
            {audius.handle ? <span className="text-mute"> (@{audius.handle})</span> : null}
            <span className="text-mute"> · Status </span><span className={me?.role === "ARTIST" ? "text-neon drop-shadow-[0_0_5px_rgba(0,229,114,0.4)]" : "text-mute uppercase tracking-widest text-[10px]"}>{me?.role ?? "INVESTOR"}</span>
            {tradingWallet && <span className="block mt-1 text-[10px] uppercase tracking-widest text-mute">Trading wallet connected separately</span>}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat k="Active Artist Tokens" v={fmtNum(mySongs.length)} tooltip="Number of your artist and Song Coins currently trading on the market." />
        <Stat k="Total Network Cap" v={formatCryptoWithFiat(totalCap, "SOL", totalCap * solUsdRate, currency, 2)} tooltip={`The combined market capitalization of all your listed songs. ${priceAgeText(fiatUpdatedAt)}.`} />
        <Stat k="Cumulative Revenue" v={formatCryptoWithFiat(artistRevenue, "SOL", artistRevenue * solUsdRate, currency, 4)} accent="gain" tooltip={`Total SOL you have earned from your retained shares. ${priceAgeText(fiatUpdatedAt)}.`} />
        <Stat k="Unique Holders" v={fmtNum(totalHolders)} tooltip="Total number of unique addresses holding your Song Coins." />
      </section>

      <CoinLauncher onLaunched={() => { loadMe(); loadSongs(); }} />

      <section className="panel overflow-hidden">
        <div className="px-6 py-5 border-b border-edge flex items-center justify-between bg-panel">
          <span className="text-white font-bold tracking-tight">Artist Token Dashboard</span>
          <span className="text-[10px] uppercase tracking-widest font-bold text-mute">On-chain assets only</span>
        </div>
        
        {!mySongs.length ? (
          <div className="px-6 py-12 text-center relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/5 pointer-events-none" />
            <div className="text-mute uppercase tracking-widest font-bold text-xs relative z-10">No active assets</div>
            <div className="text-mute text-[10px] mt-2 relative z-10">Use the studio above to tokenize your first track.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-panel text-mute text-[10px] uppercase tracking-widest font-semibold border-b border-edge">
                <tr>
                  <th className="px-6 py-4 font-medium w-1/3">Asset</th>
                  <th className="px-6 py-4 font-medium text-right">Metrics (SOL)</th>
                  <th className="px-6 py-4 font-medium text-center">Split Distribution</th>
                  <th className="px-6 py-4 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {mySongs.map((s) => {
                  const statusLabel = s.status === "LIVE" ? "Live" : s.status === "PENDING_LIQUIDITY" ? "Pending Liquidity" : s.mintAddress ? "Minted" : "Not minted";
                  const statusClass = s.status === "LIVE"
                    ? "text-neon bg-neon/10 border-neon/20"
                    : s.status === "PENDING_LIQUIDITY"
                      ? "text-orange-500 bg-orange-500/10 border-orange-500/20"
                      : s.mintAddress
                        ? "text-violet bg-violet/10 border-violet/20"
                        : "text-red bg-red/10 border-red/20";
                  return (
                  <tr key={s.id} className="hover:bg-white/5 transition group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-white group-hover:text-neon transition drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">{s.symbol}</span>
                        <span className="text-white/80 truncate max-w-[200px] font-medium">{s.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="num font-bold text-white shadow-sm">{formatCryptoWithFiat(s.price, "SOL", Number(s.price ?? 0) * solUsdRate, currency, 6)}</span>
                        <div className="flex gap-2 text-[9px] uppercase tracking-widest text-mute font-mono">
                          <span>Cap {formatCryptoWithFiat(s.marketCap, "SOL", Number(s.marketCap ?? 0) * solUsdRate, currency, 2)}</span>
                          <span>|</span>
                          <span>Vol {formatCryptoWithFiat(s.volume24h, "SOL", Number(s.volume24h ?? 0) * solUsdRate, currency, 2)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-widest font-bold bg-violet/10 text-violet border border-violet/20 px-2 py-0.5 rounded shadow-[0_0_5px_rgba(155,81,224,0.2)]">Artist {(s.artistShareBps/100).toFixed(0)}%</span>
                        <span className="text-[10px] uppercase tracking-widest font-bold bg-neon/10 text-neon border border-neon/20 px-2 py-0.5 rounded shadow-[0_0_5px_rgba(0,229,114,0.2)]">Holders {(s.holderShareBps/100).toFixed(0)}%</span>
                        <span className="text-[10px] uppercase tracking-widest font-bold bg-panel2 text-mute border border-edge px-2 py-0.5 rounded">Protocol {(s.protocolShareBps/100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link className="px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-bold bg-panel2 border border-edge hover:bg-white/10 text-white hover:border-white/30 transition" href={`/song/${s.id}`}>
                          Open
                        </Link>
                        {s.status === "PENDING_LIQUIDITY" && (
                          <Link className="px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-bold bg-neon/10 border border-neon/20 hover:bg-neon/20 text-neon transition" href={`/song/${s.id}`}>
                            Add Liquidity
                          </Link>
                        )}
                        <span className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-bold border ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
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
