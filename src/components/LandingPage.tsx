"use client";
import Link from "next/link";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { ArrowRight, CloudUpload, Globe, CircleDollarSign, Lock, ShieldCheck, Users, Copy, Music, Info, CheckCircle2, TrendingUp, Zap, BarChart3, Gem, Sparkles, Eye } from "lucide-react";
import { useUI } from "@/lib/store";
import { Tooltip } from "./Tooltip";

const spring = { type: "spring", stiffness: 300, damping: 30 } as const;
const fadeUp = { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } };

function Section({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={false}
      animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function fmtStat(n: number) {
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function fmtStatUsd(n: number) {
  if (!Number.isFinite(n)) return "$0";
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function LandingPage() {
  const { openLoginModal } = useUI();

  const [heroIdx, setHeroIdx] = useState(0);
  const [stats, setStats] = useState({ tradingVolume: 0, activeArtists: 0, songsTokenized: 0 });
  const [statsLoaded, setStatsLoaded] = useState(false);
  const HERO_TEXT = [
    { a: "Own Music", b: "Like Stock.", color: "text-gradient-neon" },
    { a: "100% verified", b: "on-chain.", color: "text-gradient-violet" },
    { a: "Launch in", b: "under 2 min.", color: "text-gradient-cyan" },
    { a: "Instant creator", b: "tokenization.", color: "text-gradient-gold" },
  ];
  const trustBadges = ["100% verified on-chain", "Instant creator tokenization", "Launch in under 2 minutes"];

  useEffect(() => {
    const i = setInterval(() => setHeroIdx((curr) => (curr + 1) % HERO_TEXT.length), 4000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (alive) setStats({
        tradingVolume: Number(j.tradingVolume ?? 0),
        activeArtists: Number(j.activeArtists ?? 0),
        songsTokenized: Number(j.songsTokenized ?? 0),
      }); if (alive) setStatsLoaded(true); })
      .catch(() => { if (alive) setStatsLoaded(false); });
    load();
    const i = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(i); };
  }, []);

  const curr = HERO_TEXT[heroIdx];

  return (
    <div className="space-y-20 pb-20 overflow-hidden">
      {/* ═══ MARKET HERO ═══════════════════════════════ */}
      <section className="relative rounded-2xl md:rounded-3xl overflow-hidden panel-elevated p-5 sm:p-7 md:p-12 2xl:p-14 flex flex-col lg:flex-row gap-6 md:gap-8 2xl:gap-12 items-center justify-between grain">
        <div className="orb orb-neon w-[500px] h-[500px] -top-40 -right-40 opacity-40" />
        <div className="orb orb-violet w-[400px] h-[400px] -bottom-40 -left-40 opacity-30" style={{ animationDelay: "-10s" }} />

        <div className="relative z-10 flex-1 min-w-0 space-y-5 text-center lg:text-left">
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-[0.22em] sm:tracking-[0.3em] font-black text-mute mb-3">Live Music Economy</div>
            <div className="relative h-[92px] sm:h-[112px] md:h-[138px]">
            <AnimatePresence mode="wait">
              <motion.h1
                key={heroIdx}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -12, filter: "blur(8px)" }}
                transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 flex flex-col justify-center text-[2.35rem] sm:text-5xl md:text-6xl font-black tracking-tight leading-[0.9]"
              >
                <span className="text-gradient-hero">{curr.a}</span>
                <span className={curr.color}>{curr.b}</span>
              </motion.h1>
            </AnimatePresence>
            </div>
          </div>

          <motion.p
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="text-mute text-sm sm:text-base md:text-lg max-w-xl font-medium leading-relaxed mx-auto lg:mx-0"
          >
            Song-daq lets artists launch music markets and lets fans buy song coins with clear price, liquidity, wallet, and royalty signals before money moves.
          </motion.p>

          <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
            {trustBadges.map((badge) => (
              <span key={badge} className="rounded-full border border-neon/20 bg-neon/8 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-neon">
                {badge}
              </span>
            ))}
          </div>

          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2"
          >
            <PathButton href="/market" title="Fan / Investor" body="Browse coins, watch charts, buy, sell, and track your portfolio." tone="neon" />
            <PathButton href="/artist" title="Artist" body="Connect Audius, choose Artist Coin or Song Coin, launch, add liquidity, and set up splits." tone="violet" />
          </motion.div>
        </div>

        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="relative z-10 w-full max-w-[380px] shrink-0"
        >
          <div className="panel p-5 rounded-[28px] border border-edge bg-panel2/70 backdrop-blur-3xl grain overflow-hidden relative">
            <div className="absolute inset-x-0 bottom-0 h-16 wave-line opacity-20" />
            <div className="absolute -right-14 -top-14 h-32 w-32 rounded-full bg-neon/10 blur-3xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em] font-black text-mute">Live Market</div>
                <div className="mt-1 text-xl font-black tracking-tight text-ink">Pulse</div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-neon/25 bg-neon/10 px-2.5 py-1 text-[8px] uppercase tracking-widest font-black text-neon">
                <span className="h-1.5 w-1.5 rounded-full bg-neon animate-pulseDot" /> Live
              </span>
            </div>
            <div className="relative mt-5 grid gap-3">
            {!statsLoaded ? (
              <>
                <div className="rounded-2xl border border-edge bg-neon/8 px-4 py-3 text-[10px] uppercase tracking-[0.2em] font-black text-neon">
                  <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-neon animate-pulseDot" /> Loading market data...</span>
                </div>
                <HeroPulseStat label="Volume" loading />
                <HeroPulseStat label="Active Artists" loading />
                <HeroPulseStat label="Song Coins" loading />
              </>
            ) : (
              <>
                <HeroPulseStat label="Volume" value={fmtStatUsd(stats.tradingVolume)} accent="text-neon" />
                <HeroPulseStat label="Active Artists" value={fmtStat(stats.activeArtists)} />
                <HeroPulseStat label="Song Coins" value={fmtStat(stats.songsTokenized)} accent="text-cyan" />
              </>
            )}
            </div>
            <div className="relative mt-4 flex items-center justify-between gap-3 text-[9px] uppercase tracking-[0.18em] font-black text-mute">
              <span>Audius synced</span>
              <span className="text-neon/80">Every 60s</span>
            </div>
          </div>
        </motion.div>
      </section>

      <Section>
        <div className="grid gap-3 md:grid-cols-3">
          <SimpleStep
            num="01"
            title="Launch Artist Coin"
            body="Artists connect Audius, choose an Artist Coin or Song Coin, and set the market structure in plain English."
          />
          <SimpleStep
            num="02"
            title="Fans Buy Ownership"
            body="Fans buy from a public curve or liquidity pool, not from a hidden artist wallet."
          />
          <SimpleStep
            num="03"
            title="Earn From Activity + Growth"
            body="Portfolio value can move with demand, market activity, and verified royalty signals. Profit is never guaranteed."
          />
        </div>
      </Section>

      {/* ═══ HOW IT WORKS ═════════════════════════════════ */}
      <Section>
        <div className="grid gap-3 md:grid-cols-3">
          <FlowCard title="Investors" items={["Browse market", "Open coin", "Review chart, artist, source, liquidity, royalty status", "Buy or sell", "Portfolio updates"]} />
          <FlowCard title="Artists" items={["Connect Audius", "Choose Artist Coin or Song Coin", "Pick profile or song", "Choose a launch preset", "Launch, add liquidity, set up splits later"]} />
          <FlowCard title="Admins" items={["Verify royalty requests", "Review trust issues", "Track wallet/API errors", "Manage payout records"]} />
        </div>
      </Section>

      <Section>
        <div className="text-center mb-12">
          <div className="text-[10px] uppercase tracking-[0.3em] font-black text-mute mb-3">How song-daq Works</div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-gradient-hero">Six steps to ownership</h2>
        </div>
      </Section>

      <div className="grid grid-cols-1 items-stretch gap-3 [grid-auto-rows:1fr] md:grid-cols-3 lg:grid-cols-6">
        <Section className="h-full" delay={0}><Step num={1} title="Upload" icon={<CloudUpload className="text-violet" size={24} />} desc="Upload your track to Audius." /></Section>
        <Section className="h-full" delay={0.05}><Step num={2} title="Distribute" icon={<Globe className="text-violet" size={24} />} desc="Release via DistroKid, TuneCore, etc." /></Section>
        <Section className="h-full" delay={0.1}><Step num={3} title="Launch Coin" icon={<CircleDollarSign className="text-violet" size={24} />} desc="Create your song coin. Set royalty share (min 10%)." active /></Section>
        <Section className="h-full" delay={0.15}><Step num={4} title="Lock Splits" icon={<Lock className="text-neon" size={24} />} desc="Send unique royalty email to your distributor." /></Section>
        <Section className="h-full" delay={0.2}><Step num={5} title="Verify" icon={<ShieldCheck className="text-violet" size={24} />} desc="Distributor confirms → Splits Locked badge." /></Section>
        <Section className="h-full" delay={0.25}><Step num={6} title="Fans Invest" icon={<Users className="text-violet" size={24} />} desc="Royalties flow monthly. Everyone wins." /></Section>
      </div>

      {/* ═══ PRODUCT SHOWCASE ═════════════════════════════ */}
      <Section>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
          {/* Coin Preview Card */}
          <div className="panel-elevated p-8 relative overflow-hidden grain">
            <div className="orb orb-violet w-[300px] h-[300px] -top-20 -right-20 opacity-30" />
            <div className="relative z-10">
              <div className="flex items-start gap-6">
                <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 border border-white/10 flex items-center justify-center shadow-depth">
                  <span className="font-black text-3xl tracking-tighter text-mute leading-none text-center">BLUE<br/>KUSH</span>
                </div>
                <div className="space-y-3 flex-1">
                  <div>
                    <h3 className="text-3xl font-black font-mono tracking-tighter text-white">$BLUEKUSH</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-semibold text-white/60">Blue Kush</span>
                      <ShieldCheck className="text-neon" size={16} />
                      <span className="chip-neon">Verified</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className="chip">Hip Hop</span>
                    <span className="chip">3:24</span>
                    <span className="chip">128 BPM</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
                <MiniStat k="Coin Price" v="$0.021" />
                <MiniStat k="Market Cap" v="$2.1M" />
                <MiniStat k="Holders" v="1,248" />
                <MiniStat k="Royalty Share" v="25%" accent />
              </div>

              {/* Coin allocation */}
              <div className="mt-8 pt-6 border-t border-white/[0.04]">
                <div className="label mb-4">Coin Allocation</div>
                <div className="flex gap-1 h-3 rounded-full overflow-hidden">
                  <div className="bg-violet/60 flex-[50]" />
                  <div className="bg-blue-500/60 flex-[25]" />
                  <div className="bg-neon/60 flex-[15]" />
                  <div className="bg-amber/60 flex-[10]" />
                </div>
                <div className="flex gap-6 mt-3 text-[10px] text-mute uppercase tracking-widest font-bold">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-violet/60" />50% Community</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-blue-500/60" />25% Royalty Pool</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-neon/60" />15% Artist</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-amber/60" />10% Liquidity</span>
                </div>
              </div>
            </div>
          </div>

          {/* Splits & Verification */}
          <div className="space-y-4">
            <div className="panel-elevated p-6 space-y-5 relative overflow-hidden grain">
              <div className="orb orb-neon w-[200px] h-[200px] -bottom-20 -right-20 opacity-20" />
              <div className="relative z-10">
                <div className="label">Splits & Verification</div>
                <div className="mt-4 bg-neon/[0.06] border border-neon/20 rounded-xl p-4 flex gap-3 items-center">
                  <div className="w-10 h-10 rounded-xl bg-neon/10 flex items-center justify-center">
                    <Lock className="text-neon" size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-neon text-sm tracking-tight">SPLITS LOCKED</div>
                    <div className="text-[11px] text-neon/60">Distributor-verified royalties</div>
                  </div>
                </div>
                <div className="space-y-3 mt-5 text-sm">
                  <InfoRow k="Royalty Share" v="25%" />
                  <InfoRow k="Distributor" v="DistroKid" />
                  <InfoRow k="Status" v={<span className="text-neon flex items-center gap-1">Verified <CheckCircle2 size={14} /></span>} />
                </div>
              </div>
            </div>

            {/* Royalty email card */}
            <div className="panel p-5 space-y-3">
              <div className="text-xs font-bold text-white/60 tracking-wide">DISTRIBUTOR SPLIT EMAIL</div>
              <div className="flex items-center justify-between bg-panel2 border border-violet/20 rounded-xl p-3">
                <span className="text-violet font-mono text-xs">admin@song-daq.com</span>
                <button className="text-mute hover:text-white transition"><Copy size={14} /></button>
              </div>
              <Link href="/splits" className="text-[11px] text-violet hover:text-violet/80 transition flex items-center gap-1">
                How to setup splits <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══ FEATURE GRID ═════════════════════════════════ */}
      <Section>
        <div className="text-center mb-12">
          <div className="text-[10px] uppercase tracking-[0.3em] font-black text-mute mb-3">Platform Features</div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-gradient-hero">Built for the new music economy</h2>
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Section delay={0}><FeatureCard icon={<TrendingUp size={24} />} title="Live Trading" desc="Buy and sell song coins with clear chart, liquidity, fee, and wallet confirmation screens." detail="Execution, price discovery, and wallet confirmation stay visible so users can understand what they are buying and how the market is moving before they commit funds." color="neon" noTooltip /></Section>
        <Section delay={0.05}><FeatureCard icon={<Zap size={24} />} title="Stream Royalties" desc="Verified distributor splits can become visible royalty signals for song coin markets." detail="Royalty-backed signals, distributor routing, and payout status are surfaced in the app so buyers can distinguish between verified revenue flows and pending claims." color="violet" noTooltip /></Section>
        <Section delay={0.1}><FeatureCard icon={<ShieldCheck size={24} />} title="On-Chain Verified" desc="Every split is cryptographically verifiable. No trust needed — verify on Solana." detail="Mint addresses, launch data, and contract-linked status are presented with explorer visibility so advanced users can verify the same records the interface is describing." color="neon" noTooltip /></Section>
        <Section delay={0.15}><FeatureCard icon={<BarChart3 size={24} />} title="Price Intelligence" desc="AI-powered 'Why Did This Move?' analysis explains every price movement." detail="Market context is easier to trust when price movement is explained with volume, timing, and behavior cues instead of leaving users to guess why a token jumped or faded." color="cyan" noTooltip /></Section>
        <Section delay={0.2}><FeatureCard icon={<Eye size={24} />} title="Whale Tracking" desc="Real-time alerts when large wallets accumulate or exit positions." detail="Large position changes, holder concentration, and unusual activity are the kinds of signals that help users avoid blindly walking into manipulated markets." color="gold" noTooltip /></Section>
        <Section delay={0.25}><FeatureCard icon={<Gem size={24} />} title="Prestige System" desc="Build reputation through market participation, watchlists, and informed activity." detail="Prestige gives active users a persistent reputation layer tied to informed participation, not just empty badges, so long-term engagement is more visible than impulsive hype." color="violet" noTooltip /></Section>
      </div>

      {/* ═══ TRUST SECTION ════════════════════════════════ */}
      <Section>
        <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.95fr] gap-4 items-stretch">
          {/* Why it's trusted */}
          <div className="panel-elevated p-8 md:p-10 space-y-8 grain relative overflow-hidden">
            <div className="orb orb-neon w-[200px] h-[200px] -bottom-20 -left-20 opacity-20" />
            <div className="relative z-10">
              <div className="label mb-4">Security & Trust</div>
              <h3 className="text-3xl md:text-4xl font-black tracking-tight text-white max-w-2xl">
                Built to make coin launches and trades legible before anyone risks real money.
              </h3>
              <p className="mt-4 mb-8 text-base md:text-lg leading-relaxed text-mute max-w-2xl">
                song-daq is designed so wallet approvals, artist identity, royalty status, liquidity protection, and contract visibility are understandable before anyone commits funds. The page should answer the trust questions first, not make you hunt for them in tiny hover states.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TrustCard title="Wallet approvals are required for every transaction" body="song-daq can prepare trades and launches, but user funds do not move unless the connected Solana wallet signs and approves the exact action." />
                <TrustCard title="Audius sign-in verifies artist identity" body="Artist launch access uses Sign in with Audius instead of pasted handles, reducing impersonation risk and tying the launch flow to a real public music identity." />
                <TrustCard title="Locked split status is visible before trading" body="Coin pages and launch review screens show whether royalty split routing is locked, pending, or still unverified, so buyers can understand revenue status before they buy." />
                <TrustCard title="Liquidity is required before launch" body="A token cannot go live, become tradable, or appear in the public market until starting liquidity is added and validated, so buyers are not dropped into a frozen market." />
                <TrustCard title="Liquidity lock settings are visible" body="Launch screens capture liquidity lock duration and show it publicly, helping users spot whether liquidity is protected or still vulnerable to quick removal." />
                <TrustCard title="Artist wallet caps and allocation warnings" body="The app warns when artist allocation is too high or wallet caps are too loose, which helps surface setups that could make concentration or dumping risk worse." />
                <TrustCard title="Smart contract visibility and on-chain transparency" body="Mint addresses, launch records, wallets, and explorer links are surfaced so users can inspect what the app is describing instead of trusting a black box." />
                <TrustCard title="Fraud reporting and suspicious activity monitoring" body="Fake artists, fake royalty claims, suspicious launches, and unusual holder behavior can be reported and flagged so bad actors are easier to review and delist." />
              </div>
            </div>
          </div>

          {/* Why everyone wins */}
          <div className="panel-elevated p-8 md:p-10 space-y-8 grain relative overflow-hidden">
            <div className="orb orb-violet w-[200px] h-[200px] -top-20 -right-20 opacity-20" />
            <div className="relative z-10 max-w-2xl mx-auto text-center">
              <div className="label mb-4">Why Everyone Wins</div>
              <h3 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                The model works best when artists, fans, and the music all benefit at the same time.
              </h3>
              <p className="mt-4 text-base md:text-lg leading-relaxed text-mute max-w-xl mx-auto">
                This should not feel like a one-sided extraction machine. The structure is strongest when artists get funding, fans get transparency and access, and the music itself gets sustained attention.
              </p>
              <div className="mt-8 space-y-5">
                <WinCard icon={<Users size={20} />} title="Artists" items={["Raise capital from fans without pretending to give away the whole catalog", "Keep ownership visible while still showing how revenue flows are structured", "Launch artist tokens and song coins with clearer market expectations", "Build long-term support instead of short-term hype around a single drop"]} color="violet" />
                <WinCard icon={<TrendingUp size={20} />} title="Fans" items={["Support artists you believe in with more transparency around launch terms", "Track liquidity, verification status, and market behavior before buying", "Share in market participation and royalty-linked signals where the data is actually verified", "Build status and reputation around informed participation, not blind speculation"]} color="neon" />
                <WinCard icon={<Music size={20} />} title="The Music" items={["Stronger communities form around songs with real traction and real support", "Better reporting and launch standards reduce fake or low-quality token spam", "Artists have more reason to keep fans engaged beyond the first launch moment", "The market can reward consistency, trust, and actual cultural momentum"]} color="cyan" />
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <div className="panel-elevated p-8 md:p-10 space-y-8 grain relative overflow-hidden">
          <div className="orb orb-cyan w-[220px] h-[220px] -bottom-24 -right-16 opacity-15" />
          <div className="relative z-10">
            <div className="label mb-4">Launch Guide</div>
            <h3 className="text-3xl md:text-4xl font-black tracking-tight text-white max-w-3xl">
              How launch works, why liquidity matters, and what guardrails exist before a token ever goes live.
            </h3>
            <p className="mt-4 text-base md:text-lg leading-relaxed text-mute max-w-3xl">
              This section is meant to slow people down in a good way. If someone is about to spend money, they should understand the launch sequence, what gets locked, what stays transparent, and what the app does to reduce rug-pull behavior.
            </p>
            <div className="grid gap-4 xl:grid-cols-2 mt-8">
              <div className="rounded-2xl border border-edge bg-panel p-6 md:p-7 min-h-[320px]">
                <div className="text-sm font-black uppercase tracking-widest text-neon mb-4">How launch works</div>
                <ul className="space-y-4 text-sm md:text-[15px] text-mute leading-relaxed">
                  <li>Artists sign in with Audius, choose either an artist token or a song coin, and connect the wallet that will own the launch transaction.</li>
                  <li>For song coins, the artist selects a real catalog track, configures supply, wallet caps, artist allocation, and royalty transparency fields before anything is minted.</li>
                  <li>Liquidity is a required launch step. The launch cannot move forward until the artist adds starting liquidity, chooses a paired asset, and sets a lock duration.</li>
                  <li>The review step summarizes supply, allocation, price, liquidity, lock period, and warnings so the artist sees the market structure clearly before confirming.</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-edge bg-panel p-6 md:p-7 min-h-[320px]">
                <div className="text-sm font-black uppercase tracking-widest text-violet mb-4">Why this is safer</div>
                <ul className="space-y-4 text-sm md:text-[15px] text-mute leading-relaxed">
                  <li>Wallet signatures are required for launches and trades, which means user funds do not move unless the connected wallet explicitly approves the exact transaction.</li>
                  <li>Liquidity lock settings are captured at launch and shown publicly, helping users judge whether the pool is protected or still exposed to quick removal.</li>
                  <li>Coins without valid launch liquidity should not appear as live public market assets, which reduces the chance of people buying into a dead or non-functional market.</li>
                  <li>Artist identity, royalty status, wallet caps, allocation warnings, trust badges, and reporting tools are all surfaced so buyers can evaluate risk before participating.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══ CTA FOOTER ═══════════════════════════════════ */}
      <Section>
        <div className="relative rounded-3xl overflow-hidden">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-r from-neon/10 via-violet/10 to-neon/10" />
          <div className="absolute inset-0 bg-bg/80 backdrop-blur-3xl" />
          
          <div className="relative z-10 p-12 md:p-16 text-center space-y-6">
            <motion.div
              initial={false}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="space-y-4"
            >
              <Sparkles size={32} className="text-neon mx-auto opacity-60" />
              <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.1]">
                <span className="text-gradient-hero">The fans become</span>
                <br />
                <span className="text-gradient-neon">the label.</span>
              </h2>
              <p className="text-mute text-lg max-w-md mx-auto">
                Start trading song coins. Follow royalty signals on every stream.
              </p>
            </motion.div>
            
            <button
              onClick={openLoginModal}
              className="btn-primary px-12 py-5 text-sm font-black tracking-widest shadow-neon-glow hover:shadow-[0_0_50px_rgba(0,229,114,0.3)] transition-all"
            >
              CONNECT WALLET
              <ArrowRight size={16} className="ml-2" />
            </button>
            <div className="text-[10px] text-mute uppercase tracking-widest font-bold pt-2">
              Solana · On-Chain · Verified
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────── */

function LiveStat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`text-center ${className}`}>
      <div className="text-xl md:text-2xl font-black font-mono text-white tracking-tight">{value}</div>
      <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-mute mt-1">{label}</div>
    </div>
  );
}

function LiveStatSkeleton({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div className={`text-center ${className}`}>
      <div className="mx-auto h-7 w-24 rounded-lg skeleton" />
      <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-mute mt-2">{label}</div>
    </div>
  );
}

function HeroPulseStat({ label, value, accent = "text-ink", loading = false }: { label: string; value?: string; accent?: string; loading?: boolean }) {
  return (
    <div className="rounded-2xl border border-edge bg-white/[0.045] px-4 py-3">
      <div className="flex min-w-0 items-center justify-between gap-4">
        <span className="min-w-0 truncate text-[10px] uppercase tracking-[0.2em] font-black text-mute">{label}</span>
        {loading ? (
          <span className="h-5 w-20 shrink-0 rounded-lg skeleton" />
        ) : (
          <motion.span
            key={value}
            initial={{ opacity: 0.65, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`shrink-0 font-mono text-lg font-black tabular-nums ${accent}`}
          >
            {value}
          </motion.span>
        )}
      </div>
    </div>
  );
}

function PathButton({ href, title, body, tone }: { href: string; title: string; body: string; tone: "neon" | "violet" }) {
  const active = tone === "neon";
  return (
    <Link
      href={href}
      className={`group w-full rounded-2xl border p-4 text-left transition-all sm:w-[270px] ${
        active
          ? "border-neon/30 bg-neon/10 hover:border-neon/55 hover:bg-neon/15"
          : "border-violet/30 bg-violet/10 hover:border-violet/55 hover:bg-violet/15"
      }`}
    >
      <div className={`flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.22em] ${active ? "text-neon" : "text-violet"}`}>
        {title}
        <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-mute">{body}</p>
    </Link>
  );
}

function FlowCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="panel-elevated grain flex h-full min-h-[250px] flex-col p-5 md:p-6">
      <div className="text-[10px] font-black uppercase tracking-[0.26em] text-neon">{title}</div>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-mute">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-neon" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SimpleStep({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="panel-elevated grain min-h-[190px] p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <span className="font-mono text-2xl font-black text-neon">{num}</span>
        <span className="h-2 w-2 rounded-full bg-neon shadow-[0_0_16px_rgba(183,255,0,0.45)]" />
      </div>
      <h3 className="mt-5 text-2xl font-black tracking-tight text-ink">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-mute">{body}</p>
    </div>
  );
}

function Step({ num, title, icon, desc, active }: { num: number; title: string; icon: React.ReactNode; desc: string; active?: boolean }) {
  return (
    <Tooltip
      width={340}
      triggerClassName="flex h-full w-full items-stretch"
      content={<div><div className="font-black text-neon mb-1">{title}</div><p className="text-pure-white/70 text-xs leading-relaxed">{desc}</p></div>}
    >
      <div className={`panel-elevated relative flex h-full min-h-[210px] w-full flex-col items-center justify-between gap-3 p-4 text-center md:aspect-square md:min-h-0 lg:aspect-square ${active ? "border-neon/20 shadow-neon-glow" : ""}`}>
        <div className="shrink-0 text-[9px] font-black text-mute tracking-widest">{String(num).padStart(2, "0")}</div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">{icon}</div>
        <div className="min-h-[2rem] shrink-0 text-xs font-black uppercase tracking-widest text-white/70 flex items-center justify-center">{title}</div>
        <p className="flex flex-1 items-center text-[11px] text-mute leading-relaxed line-clamp-4">{desc}</p>
      </div>
    </Tooltip>
  );
}

function InfoRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
      <span className="text-mute text-xs">{k}</span>
      <span className="font-medium text-sm text-white">{typeof v === "string" ? v : v}</span>
    </div>
  );
}

function MiniStat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <Tooltip
      width={320}
      content={<p className="text-xs text-pure-white/70 leading-relaxed">{k} is shown as a quick readout so artists and fans can understand the token economics without opening a separate dashboard.</p>}
    >
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.04] p-3">
        <div className="text-[9px] uppercase tracking-widest font-bold text-mute mb-1">{k}</div>
        <div className={`text-sm font-bold font-mono ${accent ? "text-neon" : "text-white"}`}>{v}</div>
      </div>
    </Tooltip>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
  color,
  detail,
  noTooltip = false,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
  detail?: string;
  noTooltip?: boolean;
}) {
  const colorMap: Record<string, string> = {
    neon: "text-neon bg-neon/10 border-neon/20",
    violet: "text-violet bg-violet/10 border-violet/20",
    gold: "text-gold bg-gold/10 border-gold/20",
    cyan: "text-cyan bg-cyan/10 border-cyan/20",
  };
  const style = colorMap[color] || colorMap.neon;
  const card = (
    <div className="panel-elevated p-6 md:p-7 group hover:border-white/10 transition-all duration-500 relative overflow-hidden grain min-h-[280px]">
      <div className={`w-12 h-12 rounded-2xl ${style} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500 border`}>
        {icon}
      </div>
      <h3 className="text-lg font-black text-white tracking-tight mb-2">{title}</h3>
      <p className="text-sm text-mute leading-relaxed">{desc}</p>
      {detail ? <p className="mt-4 text-[13px] text-mute leading-relaxed">{detail}</p> : null}
    </div>
  );

  if (noTooltip) return card;

  return (
    <Tooltip
      width={360}
      content={<div><div className={`text-sm font-black mb-1 ${style.split(" ")[0]}`}>{title}</div><p className="text-xs text-pure-white/70 leading-relaxed">{desc}</p></div>}
    >
      {card}
    </Tooltip>
  );
}

function TrustItem({ text }: { text: string }) {
  return (
    <Tooltip width={340} content={<p className="text-xs text-pure-white/70 leading-relaxed">{supportDetail(text)}</p>}>
      <li className="flex items-start gap-3">
        <CheckCircle2 size={16} className="text-neon shrink-0 mt-0.5" />
        <span className="text-[13px] text-mute leading-relaxed">{text}</span>
      </li>
    </Tooltip>
  );
}

function TrustCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-edge bg-panel p-5 md:p-6 min-h-[170px]">
      <div className="flex items-start gap-3">
        <CheckCircle2 size={18} className="text-neon shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="text-sm font-black tracking-tight text-white">{title}</div>
          <p className="mt-2 text-[13px] md:text-sm text-mute leading-relaxed">{body}</p>
        </div>
      </div>
    </div>
  );
}

function supportDetail(text: string) {
  const details: Record<string, string> = {
    "Minimum 10% royalty commitment required": "Artists must commit a meaningful royalty share before launch. That protects buyers from empty tokens and makes the asset tied to real music revenue.",
    "Wallet approvals are required for every transaction": "song-daq can prepare transactions, but user funds do not move unless the connected Solana wallet signs and approves the action.",
    "Audius sign-in verifies artist identity": "Artist launch access uses Sign in with Audius rather than pasted handles, reducing impersonation risk and tying launches to a real content identity.",
    "External wallets stay optional for artists": "Artists can use an Audius-linked wallet when available and attach a separate Solana wallet only when they deliberately choose to.",
    "Locked split status is visible before trading": "Coin pages and previews show whether royalty split routing is locked, pending, or unavailable so investors understand the revenue status.",
    "Royalty split transparency": "Royalty share, holder share, protocol share, distributor, and vault details are surfaced wherever the app has verified data.",
    "Smart contract visibility": "Mint addresses and external explorers are linked so advanced users can inspect token contracts and transactions directly.",
    "Fraud and fake artist reporting": "Suspicious coins or fake artist listings should be reportable through support so the market can flag, review, and delist abusive assets.",
    "Account recovery and support process": "Wallet custody remains with the user, but support can help with Audius linking, suspicious activity reports, and transaction troubleshooting.",
    "Distributor-verified splits": "The artist routes royalties through a distributor split or verification flow, so coin holders can see that payouts are connected to actual distribution infrastructure.",
    "On-chain transparency — verify everything": "Mint addresses, wallets, launch data, and market activity should be inspectable on Solana. The UI summarizes it, but the chain remains the source of truth.",
    "Artist tokens are vested (no rug pulls)": "Artist allocations should release over time instead of all at once. Vesting helps prevent instant dumping and makes incentives line up with long-term fan support.",
    "Suspicious coin monitoring": "Large holder changes, unusual activity, and identity mismatches should be highlighted so users can judge risk before buying.",
    "Real-time audit of distributor accounts": "When distributor or Audius signals update, song-daq should surface those changes quickly so the market can react to real artist activity.",
    "Liquidity is required before launch": "A token cannot go live until the artist adds starting liquidity. That gives fans a working market on day one and stops frozen launches from appearing as tradable assets.",
    "Liquidity lock settings are visible": "The launch flow captures lock duration and displays it publicly so buyers can see whether liquidity is protected or still vulnerable to removal.",
    "Artist wallet caps limit concentration": "Wallet-cap settings can stop one address from absorbing too much supply during launch and make it harder for a single buyer to dominate early trading.",
    "Launch review happens before minting": "Before the mint is created, song-daq shows supply, allocation, price, liquidity, and warnings so the artist must acknowledge the risk settings they are putting on-chain.",
  };
  return details[text] ?? `${text}. This control exists to make song-daq easier to understand before committing money.`;
}

function WinCard({ icon, title, items, color }: { icon: React.ReactNode; title: string; items: string[]; color: string }) {
  const colorMap: Record<string, { text: string; bg: string; marker: string }> = {
    violet: { text: "text-violet", bg: "bg-violet/10", marker: "marker:text-violet/40" },
    neon: { text: "text-neon", bg: "bg-neon/10", marker: "marker:text-neon/40" },
    cyan: { text: "text-cyan", bg: "bg-cyan/10", marker: "marker:text-cyan/40" },
  };
  const s = colorMap[color] || colorMap.neon;

  return (
    <div className="rounded-2xl border border-edge bg-panel p-5 md:p-6 text-left mb-4 last:mb-0">
      <div className="flex gap-3 justify-center md:justify-start">
        <div className={`w-10 h-10 rounded-xl ${s.bg} ${s.text} flex items-center justify-center shrink-0`}>{icon}</div>
        <div className="max-w-xl">
        <div className={`text-xs font-black uppercase tracking-widest ${s.text}`}>{title}</div>
        <ul className={`text-[13px] text-mute space-y-2 mt-2.5 list-disc pl-4 ${s.marker}`}>
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
        </div>
      </div>
    </div>
  );
}
