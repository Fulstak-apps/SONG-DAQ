"use client";
import Link from "next/link";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { ArrowRight, CloudUpload, Globe, CircleDollarSign, Lock, ShieldCheck, Users, Copy, Music, Info, CheckCircle2, TrendingUp, Zap, BarChart3, Gem, Sparkles, Eye } from "lucide-react";
import { useUI } from "@/lib/store";

const spring = { type: "spring", stiffness: 300, damping: 30 } as const;
const fadeUp = { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } };

function Section({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
      animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function LandingPage() {
  const { openLoginModal } = useUI();

  const [heroIdx, setHeroIdx] = useState(0);
  const HERO_TEXT = [
    { a: "Insurance and", b: "liquidity.", color: "text-gradient-neon" },
    { a: "100% verified", b: "on-chain.", color: "text-gradient-violet" },
    { a: "Earn stream", b: "royalties.", color: "text-gradient-cyan" },
    { a: "Real-time", b: "audit protocol.", color: "text-gradient-gold" },
  ];

  useEffect(() => {
    const i = setInterval(() => setHeroIdx((curr) => (curr + 1) % HERO_TEXT.length), 4000);
    return () => clearInterval(i);
  }, []);

  const curr = HERO_TEXT[heroIdx];

  return (
    <div className="space-y-20 pb-20 overflow-hidden">
      {/* ═══ CINEMATIC HERO ═══════════════════════════════ */}
      <section className="relative min-h-[70vh] flex items-center justify-center text-center pt-10">
        {/* Ambient orbs */}
        <div className="orb orb-neon w-[600px] h-[600px] -top-40 -left-40 opacity-60" />
        <div className="orb orb-violet w-[500px] h-[500px] -top-20 -right-40 opacity-50" style={{ animationDelay: "-7s" }} />
        <div className="orb orb-cyan w-[400px] h-[400px] bottom-0 left-1/3 opacity-30" style={{ animationDelay: "-14s" }} />
        
        <div className="relative z-10 max-w-3xl mx-auto space-y-8 px-4 h-full flex flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-neon shadow-[0_0_6px_rgba(0,229,114,0.6)] animate-pulseDot" />
              <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-mute">Institutional Music Exchange · Live</span>
            </div>
          </motion.div>

          <div className="h-[200px] md:h-[250px] relative w-full flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.h1
                key={heroIdx}
                initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -20, filter: "blur(8px)" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="text-5xl md:text-8xl font-black tracking-[-0.04em] leading-[0.85] absolute inset-0 flex flex-col items-center justify-center"
              >
                <span className="text-gradient-hero">{curr.a}</span>
                <span className={curr.color}>{curr.b}</span>
              </motion.h1>
            </AnimatePresence>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="text-white/40 text-lg md:text-xl font-medium leading-relaxed max-w-xl mx-auto"
          >
            The world&apos;s first institutional-grade exchange for tokenized music royalties. 
            Trade on-chain. Earn on every stream.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <Link
              href="/artist"
              className="btn-primary px-10 py-4 text-sm font-black tracking-widest shadow-neon-glow hover:shadow-[0_0_40px_rgba(0,229,114,0.35)] transition-all text-pure-white"
            >
              LAUNCH A TOKEN
              <ArrowRight size={16} className="ml-1" />
            </Link>
            <Link
              href="/"
              className="btn-glass px-8 py-4 text-[11px] uppercase tracking-widest font-bold"
            >
              TRADING TERMINAL
            </Link>
          </motion.div>

          {/* Live stats counter */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="flex items-center justify-center gap-8 md:gap-12 pt-8"
          >
            <LiveStat label="Trading Volume" value="$2.4M" />
            <div className="w-px h-8 bg-white/[0.06]" />
            <LiveStat label="Active Artists" value="847" />
            <div className="w-px h-8 bg-white/[0.06] hidden sm:block" />
            <LiveStat label="Songs Tokenized" value="3,241" className="hidden sm:block" />
          </motion.div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═════════════════════════════════ */}
      <Section>
        <div className="text-center mb-12">
          <div className="text-[10px] uppercase tracking-[0.3em] font-black text-white/20 mb-3">How SONGDAQ Works</div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-gradient-hero">Six steps to ownership</h2>
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Section delay={0}><Step num={1} title="Upload" icon={<CloudUpload className="text-violet" size={24} />} desc="Upload your track to Audius." /></Section>
        <Section delay={0.05}><Step num={2} title="Distribute" icon={<Globe className="text-violet" size={24} />} desc="Release via DistroKid, TuneCore, etc." /></Section>
        <Section delay={0.1}><Step num={3} title="Tokenize" icon={<CircleDollarSign className="text-violet" size={24} />} desc="Create your song token. Set royalty share (min 10%)." active /></Section>
        <Section delay={0.15}><Step num={4} title="Lock Splits" icon={<Lock className="text-neon" size={24} />} desc="Send unique royalty email to your distributor." /></Section>
        <Section delay={0.2}><Step num={5} title="Verify" icon={<ShieldCheck className="text-violet" size={24} />} desc="Distributor confirms → Splits Locked badge." /></Section>
        <Section delay={0.25}><Step num={6} title="Fans Invest" icon={<Users className="text-violet" size={24} />} desc="Royalties flow monthly. Everyone wins." /></Section>
      </div>

      {/* ═══ PRODUCT SHOWCASE ═════════════════════════════ */}
      <Section>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
          {/* Token Preview Card */}
          <div className="panel-elevated p-8 relative overflow-hidden grain">
            <div className="orb orb-violet w-[300px] h-[300px] -top-20 -right-20 opacity-30" />
            <div className="relative z-10">
              <div className="flex items-start gap-6">
                <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 border border-white/10 flex items-center justify-center shadow-depth">
                  <span className="font-black text-3xl tracking-tighter text-white/40 leading-none text-center">BLUE<br/>KUSH</span>
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
                <MiniStat k="Token Price" v="$0.021" />
                <MiniStat k="Market Cap" v="$2.1M" />
                <MiniStat k="Holders" v="1,248" />
                <MiniStat k="Royalty Share" v="25%" accent />
              </div>

              {/* Token allocation */}
              <div className="mt-8 pt-6 border-t border-white/[0.04]">
                <div className="label mb-4">Token Allocation</div>
                <div className="flex gap-1 h-3 rounded-full overflow-hidden">
                  <div className="bg-violet/60 flex-[50]" />
                  <div className="bg-blue-500/60 flex-[25]" />
                  <div className="bg-neon/60 flex-[15]" />
                  <div className="bg-amber/60 flex-[10]" />
                </div>
                <div className="flex gap-6 mt-3 text-[10px] text-white/40 uppercase tracking-widest font-bold">
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
                <span className="text-violet font-mono text-xs">bluekush@songdaq.io</span>
                <button className="text-white/30 hover:text-white transition"><Copy size={14} /></button>
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
          <div className="text-[10px] uppercase tracking-[0.3em] font-black text-white/20 mb-3">Platform Features</div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-gradient-hero">Built for the new music economy</h2>
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Section delay={0}><FeatureCard icon={<TrendingUp size={24} />} title="Live Trading" desc="Real-time bonding curve execution. Buy and sell tokens instantly with on-chain settlement." color="neon" /></Section>
        <Section delay={0.05}><FeatureCard icon={<Zap size={24} />} title="Stream Royalties" desc="Verified distributor splits route royalties directly to token holders every month." color="violet" /></Section>
        <Section delay={0.1}><FeatureCard icon={<ShieldCheck size={24} />} title="On-Chain Verified" desc="Every split is cryptographically verifiable. No trust needed — verify on Solana." color="neon" /></Section>
        <Section delay={0.15}><FeatureCard icon={<BarChart3 size={24} />} title="Price Intelligence" desc="AI-powered 'Why Did This Move?' analysis explains every price movement." color="cyan" /></Section>
        <Section delay={0.2}><FeatureCard icon={<Eye size={24} />} title="Whale Tracking" desc="Real-time alerts when large wallets accumulate or exit positions." color="gold" /></Section>
        <Section delay={0.25}><FeatureCard icon={<Gem size={24} />} title="Prestige System" desc="Earn XP for trading. Unlock Bronze → Silver → Gold → Platinum → Diamond tiers." color="violet" /></Section>
      </div>

      {/* ═══ TRUST SECTION ════════════════════════════════ */}
      <Section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Why it's trusted */}
          <div className="panel-elevated p-8 space-y-6 grain relative overflow-hidden">
            <div className="orb orb-neon w-[200px] h-[200px] -bottom-20 -left-20 opacity-20" />
            <div className="relative z-10">
              <div className="label mb-6">Security & Trust</div>
              <ul className="space-y-4">
                <TrustItem text="Minimum 10% royalty commitment required" />
                <TrustItem text="Distributor-verified splits" />
                <TrustItem text="On-chain transparency — verify everything" />
                <TrustItem text="Artist tokens are vested (no rug pulls)" />
                <TrustItem text="Open exit window if delisted" />
                <TrustItem text="Real-time audit of distributor accounts" />
              </ul>
            </div>
          </div>

          {/* Why everyone wins */}
          <div className="panel-elevated p-8 space-y-8 grain relative overflow-hidden">
            <div className="orb orb-violet w-[200px] h-[200px] -top-20 -right-20 opacity-20" />
            <div className="relative z-10">
              <div className="label mb-6">Why Everyone Wins</div>
              <WinCard icon={<Users size={20} />} title="Artists" items={["Raise capital from fans", "Keep ownership", "Earn from royalties + growth"]} color="violet" />
              <WinCard icon={<TrendingUp size={20} />} title="Fans" items={["Own a piece of the music", "Share in real revenue", "Support artists you believe in"]} color="neon" />
              <WinCard icon={<Music size={20} />} title="The Music" items={["Stronger communities", "More engagement", "More hits"]} color="cyan" />
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
              initial={{ opacity: 0 }}
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
              <p className="text-white/30 text-lg max-w-md mx-auto">
                Start trading tokenized music. Earn royalties on every stream.
              </p>
            </motion.div>
            
            <button
              onClick={openLoginModal}
              className="btn-primary px-12 py-5 text-sm font-black tracking-widest shadow-neon-glow hover:shadow-[0_0_50px_rgba(0,229,114,0.3)] transition-all"
            >
              CONNECT WALLET
              <ArrowRight size={16} className="ml-2" />
            </button>
            <div className="text-[10px] text-white/20 uppercase tracking-widest font-bold pt-2">
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
      <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-white/20 mt-1">{label}</div>
    </div>
  );
}

function Step({ num, title, icon, desc, active }: { num: number; title: string; icon: React.ReactNode; desc: string; active?: boolean }) {
  return (
    <div className={`panel-elevated p-5 flex flex-col items-center text-center gap-3 h-full relative ${active ? "border-neon/20 shadow-neon-glow" : ""}`}>
      <div className="text-[9px] font-black text-white/20 tracking-widest">{String(num).padStart(2, "0")}</div>
      <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">{icon}</div>
      <div className="text-xs font-black uppercase tracking-widest text-white/70">{title}</div>
      <p className="text-[11px] text-white/30 leading-relaxed flex-1">{desc}</p>
    </div>
  );
}

function InfoRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
      <span className="text-white/40 text-xs">{k}</span>
      <span className="font-medium text-sm text-white">{typeof v === "string" ? v : v}</span>
    </div>
  );
}

function MiniStat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.04] p-3">
      <div className="text-[9px] uppercase tracking-widest font-bold text-white/25 mb-1">{k}</div>
      <div className={`text-sm font-bold font-mono ${accent ? "text-neon" : "text-white"}`}>{v}</div>
    </div>
  );
}

function FeatureCard({ icon, title, desc, color }: { icon: React.ReactNode; title: string; desc: string; color: string }) {
  const colorMap: Record<string, string> = {
    neon: "text-neon bg-neon/10 border-neon/20",
    violet: "text-violet bg-violet/10 border-violet/20",
    gold: "text-gold bg-gold/10 border-gold/20",
    cyan: "text-cyan bg-cyan/10 border-cyan/20",
  };
  const style = colorMap[color] || colorMap.neon;

  return (
    <div className="panel-elevated p-6 group hover:border-white/10 transition-all duration-500 relative overflow-hidden grain">
      <div className={`w-12 h-12 rounded-2xl ${style} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500 border`}>
        {icon}
      </div>
      <h3 className="text-sm font-bold text-white tracking-tight mb-2">{title}</h3>
      <p className="text-[12px] text-white/35 leading-relaxed">{desc}</p>
    </div>
  );
}

function TrustItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <CheckCircle2 size={16} className="text-neon shrink-0 mt-0.5" />
      <span className="text-[13px] text-white/50 leading-relaxed">{text}</span>
    </li>
  );
}

function WinCard({ icon, title, items, color }: { icon: React.ReactNode; title: string; items: string[]; color: string }) {
  const colorMap: Record<string, { text: string; bg: string; marker: string }> = {
    violet: { text: "text-violet", bg: "bg-violet/10", marker: "marker:text-violet/40" },
    neon: { text: "text-neon", bg: "bg-neon/10", marker: "marker:text-neon/40" },
    cyan: { text: "text-cyan", bg: "bg-cyan/10", marker: "marker:text-cyan/40" },
  };
  const s = colorMap[color] || colorMap.neon;

  return (
    <div className="flex gap-3 mb-4 last:mb-0">
      <div className={`w-10 h-10 rounded-xl ${s.bg} ${s.text} flex items-center justify-center shrink-0`}>{icon}</div>
      <div>
        <div className={`text-xs font-black uppercase tracking-widest ${s.text}`}>{title}</div>
        <ul className={`text-[11px] text-white/40 space-y-1 mt-1.5 list-disc pl-4 ${s.marker}`}>
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
    </div>
  );
}
