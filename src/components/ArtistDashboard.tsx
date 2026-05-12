"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CoinCard } from "./CoinCard";
import { SongCard, type SongRow } from "./SongCard";
import { CoinTradeModal } from "./CoinTradeModal";
import { CardGridSkeleton } from "./Skeleton";
import { SafeImage } from "./SafeImage";
import { useCoins } from "@/lib/useCoins";
import { useSession } from "@/lib/store";
import { fmtNum } from "@/lib/pricing";
import { formatCryptoWithFiat, useLiveFiatPrices, useUsdToDisplayRate } from "@/lib/fiat";
import type { AudiusCoin } from "@/lib/audiusCoins";
import { Users, BarChart3, Coins, TrendingUp, ExternalLink, Plus, Briefcase, ShieldCheck, LockKeyhole, AlertTriangle } from "lucide-react";

export function ArtistDashboard() {
  const { audius, address } = useSession();
  const { coins, loading: coinLoading } = useCoins("marketCap");
  const { currency, prices: fiatPrices } = useLiveFiatPrices(["SOL"]);
  const { formatUsd: formatDisplayFiat } = useUsdToDisplayRate();
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [royalty, setRoyalty] = useState<number>(0);
  const [trade, setTrade] = useState<{ side: "BUY" | "SELL"; coin: AudiusCoin } | null>(null);

  // Pull this artist's launched songs.
  useEffect(() => {
    let alive = true;
    fetch("/api/songs?sort=new", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (alive) setSongs(j.songs ?? []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Pull artist's claimable royalties summary.
  useEffect(() => {
    if (!address) { setRoyalty(0); return; }
    let alive = true;
    fetch(`/api/portfolio?wallet=${address}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (alive) setRoyalty(j.summary?.royalty ?? 0); })
      .catch(() => {});
    return () => { alive = false; };
  }, [address]);

  // Coins this artist owns (Audius user id matches owner_id).
  const myCoins = useMemo(
    () => coins.filter((c) => audius?.userId && c.owner_id === audius.userId),
    [coins, audius?.userId],
  );
  // Songs likely launched by this artist (matched on Audius userId stored at launch time).
  const mySongs = useMemo(
    () => audius?.userId ? songs.filter((s: any) => s.audiusUserId === audius.userId || s.artistName === audius.name) : [],
    [songs, audius?.userId, audius?.name],
  );

  const totalArtistFees = myCoins.reduce(
    (acc, c) => acc + (((c as any).artist_fees?.unclaimed_fees ?? 0) / 1e9),
    0,
  );
  const totalHolders = myCoins.reduce((acc, c) => acc + (c.holder ?? 0), 0);
  const totalCap = myCoins.reduce((acc, c) => acc + (c.marketCap ?? 0), 0);
  const totalVol24 = myCoins.reduce((acc, c) => acc + (c.v24hUSD ?? 0), 0);
  const launchReady = Boolean(audius?.verified && address);
  const pendingLiquidity = mySongs.filter((s: any) => s.status !== "LIVE" || Number(s.liquidityPairAmount ?? 0) <= 0).length;
  const lockedCoins = myCoins.filter((c: any) => c.splitsLocked || c.liquidityLocked).length;

  return (
    <div className="space-y-6">
      {/* Artist Hero */}
      <section className="panel-elevated p-8 flex flex-col md:flex-row gap-6 items-start md:items-center relative overflow-hidden grain">
        <div className="orb orb-violet w-[400px] h-[400px] -top-40 -right-40 opacity-30" />
        <div className="relative z-10 flex items-center gap-5 flex-1 min-w-0">
          <div className="relative w-16 h-16 rounded-full overflow-hidden border border-violet/20 bg-violet/5 shrink-0 shadow-violet-glow">
            {audius?.avatar
              ? <SafeImage src={audius.avatar} fill sizes="64px" alt={audius.handle ?? "artist"} fallback={audius?.handle ?? "A"} className="object-cover" />
              : <div className="absolute inset-0 grid place-items-center text-violet text-xl font-mono font-black">A</div>}
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-black tracking-tight text-white">Artist Studio</h1>
              {audius?.handle && (
                <a href={`https://audius.co/${audius.handle}`} target="_blank" rel="noreferrer" className="chip-violet flex items-center gap-1">
                  @{audius.handle} <ExternalLink size={10} />
                </a>
              )}
            </div>
            <p className="text-mute text-sm mt-1">
              {audius
                ? `Managing ${myCoins.length} coin${myCoins.length === 1 ? "" : "s"} · ${mySongs.length} launch${mySongs.length === 1 ? "" : "es"} · royalty payouts streaming live.`
                : "Sign in with Audius to surface your catalog, fees, and holders."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 relative z-10">
          <Link href="/artist" className="btn-primary px-6 py-3 text-[10px] font-black tracking-widest">
            <Plus size={14} /> Launch Artist Token
          </Link>
          <Link href="/portfolio" className="btn-glass px-5 py-3 text-[10px] font-black tracking-widest">
            <Briefcase size={14} /> Portfolio
          </Link>
        </div>
      </section>

      {/* Stats grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ArtistStat k="Your Coins" v={String(myCoins.length)} icon={<Coins size={16} />} color="violet" />
        <ArtistStat k="Your IPOs" v={String(mySongs.length)} icon={<BarChart3 size={16} />} color="violet" />
        <ArtistStat k="Total Holders" v={fmtNum(totalHolders)} icon={<Users size={16} />} />
        <ArtistStat k="Combined Cap" v={formatDisplayFiat(totalCap, 0)} icon={<TrendingUp size={16} />} />
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ArtistStat k="24h Volume" v={formatDisplayFiat(totalVol24, 0)} />
        <ArtistStat k="Unclaimed Fees" v={fmtNum(totalArtistFees)} accent="gain" />
        <ArtistStat
          k="Royalty Earned"
          v={formatCryptoWithFiat(royalty, "SOL", Number(fiatPrices.SOL?.usd ?? 0) > 0 ? royalty * Number(fiatPrices.SOL?.usd ?? 0) : null, currency, 4)}
          accent="gain"
        />
        <ArtistStat k="Audius Followers" v={fmtNum((audius as any)?.follower_count ?? 0)} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <ReadinessCard
          icon={<ShieldCheck size={18} />}
          title="Launch Readiness"
          value={launchReady ? "Ready" : "Needs Review"}
          body={launchReady ? "Audius identity and Solana wallet are connected." : "Connect verified Audius identity and a Solana wallet before launch."}
          tone={launchReady ? "neon" : "amber"}
        />
        <ReadinessCard
          icon={<LockKeyhole size={18} />}
          title="Liquidity Status"
          value={`${lockedCoins}/${Math.max(myCoins.length, 1)} Locked`}
          body={pendingLiquidity ? `${pendingLiquidity} Song Coin launch still needs verified liquidity.` : "No pending liquidity blocks found for your indexed launches."}
          tone={pendingLiquidity ? "amber" : "neon"}
        />
        <ReadinessCard
          icon={<AlertTriangle size={18} />}
          title="Market Warnings"
          value={totalHolders < 25 && myCoins.length ? "Thin Holder Base" : "Normal"}
          body={totalHolders < 25 && myCoins.length ? "Holder distribution is still early. Push fans toward gradual participation." : "No major artist-dashboard warnings surfaced."}
          tone={totalHolders < 25 && myCoins.length ? "amber" : "neon"}
        />
      </section>

      {/* Artist's coins */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="label">Your Artist Coins</div>
          <a href="https://audius.co/clubs" target="_blank" rel="noreferrer" className="text-[10px] text-mute hover:text-white uppercase tracking-widest font-bold transition flex items-center gap-1">
            Manage on Audius <ExternalLink size={10} />
          </a>
        </div>
        {coinLoading ? (
          <CardGridSkeleton count={3} />
        ) : myCoins.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {myCoins.map((c, i) => (
              <motion.div
                key={c.mint}
                initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              >
                <CoinCard c={c} isOwner onTrade={(side, coin) => setTrade({ side, coin })} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="panel-elevated p-8 text-center grain">
            <div className="text-mute text-sm font-bold mb-1">
              {audius
                ? "No Audius Artist Token found for your handle."
                : "Sign in with Audius (top-right) to surface your launched coins."}
            </div>
            {audius && <a href="https://audius.co/clubs" target="_blank" rel="noreferrer" className="text-violet text-xs hover:text-violet/80 transition">Launch one at audius.co/clubs →</a>}
          </div>
        )}
      </section>

      {/* Artist's song IPOs */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="label">Your Song IPOs</div>
          <Link href="/artist" className="btn-primary text-[10px] px-4 py-2 font-black tracking-widest">+ New Launch</Link>
        </div>
        {mySongs.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {mySongs.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              >
                <SongCard s={s} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="panel-elevated p-8 text-center grain">
            <div className="text-mute text-sm font-bold mb-2">No Song IPOs yet.</div>
            <Link href="/artist" className="text-neon text-xs hover:text-neon/80 transition">Launch your first one →</Link>
          </div>
        )}
      </section>

      {/* On-chain breakdown */}
      {myCoins.length > 0 && (
        <section className="panel-elevated p-5 grain relative overflow-hidden">
          <div className="orb orb-neon w-[200px] h-[200px] -bottom-20 -right-20 opacity-15" />
          <div className="label mb-4 relative z-10">Locker & Reward Pools</div>
          <div className="overflow-x-auto relative z-10">
            <table className="w-full text-sm">
              <thead className="text-[9px] uppercase tracking-widest font-black text-mute">
                <tr>
                  <th className="text-left py-2 pl-2">Coin</th>
                  <th className="text-right py-2">Locked</th>
                  <th className="text-right py-2">Unlocked</th>
                  <th className="text-right py-2">Claimable</th>
                  <th className="text-right py-2 pr-2">Reward Pool</th>
                </tr>
              </thead>
              <tbody>
                {myCoins.map((c) => {
                  const locker = (c as any).artist_locker ?? {};
                  const reward = (c as any).reward_pool ?? {};
                  return (
                    <tr key={c.mint} className="border-t border-edge hover:bg-panel transition">
                      <td className="py-3 pl-2 font-mono font-bold text-white">${c.ticker}</td>
                      <td className="py-3 text-right num text-mute">{fmtNum((locker.locked ?? 0) / 1e9)}</td>
                      <td className="py-3 text-right num text-mute">{fmtNum((locker.unlocked ?? 0) / 1e9)}</td>
                      <td className="py-3 text-right num text-neon font-bold">{fmtNum((locker.claimable ?? 0) / 1e9)}</td>
                      <td className="py-3 text-right pr-2 num text-mute">{fmtNum((reward.balance ?? 0) / 1e9)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {trade && (
        <CoinTradeModal coin={trade.coin} side={trade.side} onClose={() => setTrade(null)} />
      )}
    </div>
  );
}

function ReadinessCard({ icon, title, value, body, tone }: { icon: React.ReactNode; title: string; value: string; body: string; tone: "neon" | "amber" }) {
  const cls = tone === "neon" ? "text-neon border-neon/20 bg-neon/8" : "text-amber border-amber/20 bg-amber/10";
  return (
    <div className="panel-elevated p-5 grain">
      <div className={`w-10 h-10 rounded-xl border grid place-items-center mb-3 ${cls}`}>{icon}</div>
      <div className="text-[10px] uppercase tracking-widest font-black text-mute">{title}</div>
      <div className="mt-1 text-xl font-black text-ink">{value}</div>
      <p className="mt-2 text-xs leading-relaxed text-mute">{body}</p>
    </div>
  );
}

function ArtistStat({ k, v, icon, accent, color }: { k: string; v: string; icon?: React.ReactNode; accent?: "gain" | "lose"; color?: "violet" | "neon" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      className="panel-elevated p-4 relative overflow-hidden grain group"
    >
      <div className="absolute -right-6 -top-6 w-16 h-16 bg-white/[0.01] rounded-full blur-[20px] pointer-events-none group-hover:bg-white/[0.03] transition duration-700" />
      <div className="flex items-center gap-2">
        {icon && <div className={`${color === "violet" ? "text-violet" : "text-mute"}`}>{icon}</div>}
        <div className="label">{k}</div>
      </div>
      <div className={`mt-2 text-xl font-mono font-black tracking-tight ${
        accent === "gain" ? "text-neon" : accent === "lose" ? "text-red" : color === "violet" ? "text-violet" : "text-white"
      }`}>
        {v}
      </div>
    </motion.div>
  );
}
