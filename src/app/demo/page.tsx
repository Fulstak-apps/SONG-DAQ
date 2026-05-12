"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BarChart3, CheckCircle2, Coins, Music2, PlayCircle, WalletCards } from "lucide-react";
import { PAPER_WALLET_ADDRESS, PAPER_WALLET_PROVIDER, usePaperTrading, useSession } from "@/lib/store";

const flow = [
  {
    title: "Browse the market",
    body: "Start with the visual grid, compare artist coins and song coins, and open anything that looks interesting.",
    icon: <Music2 size={22} />,
  },
  {
    title: "Read the coin page",
    body: "Check price, chart movement, source, artist info, liquidity, royalty status, and why fans can buy.",
    icon: <BarChart3 size={22} />,
  },
  {
    title: "Place a test trade",
    body: "Paper Mode lets investors buy or sell with simulated funds, so the trade flow is easy to understand first.",
    icon: <Coins size={22} />,
  },
  {
    title: "Track portfolio",
    body: "Portfolio shows total value, wallet balances, song coins, artist coins, other assets, and recent activity.",
    icon: <WalletCards size={22} />,
  },
];

const investorChecks = [
  "Is this a SONG·DAQ Song Coin or an Open Audio Artist Coin?",
  "Does it have public liquidity so fans can buy and sell?",
  "Is the artist and song metadata complete?",
  "Is royalty status not submitted, in progress, verified, paid, or added to pool?",
  "Does the chart show actual market movement instead of placeholder zeroes?",
];

export default function InvestorDemoPage() {
  const router = useRouter();
  const { setEnabled } = usePaperTrading();
  const { setSession } = useSession();

  const startDemo = () => {
    setEnabled(true);
    setSession({ address: PAPER_WALLET_ADDRESS, kind: "solana", provider: PAPER_WALLET_PROVIDER });
    router.push("/market?demo=investor");
  };

  return (
    <main className="space-y-6 pb-10">
      <section className="panel-elevated relative overflow-hidden p-6 md:p-10 grain">
        <div className="orb orb-neon -right-24 -top-28 h-72 w-72 opacity-25" />
        <div className="orb orb-violet -bottom-28 -left-24 h-72 w-72 opacity-20" />
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-neon/25 bg-neon/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-neon">
              <PlayCircle size={14} /> Investor Walkthrough
            </div>
            <div className="space-y-3">
              <h1 className="max-w-4xl text-4xl font-black leading-[0.95] tracking-tight text-ink md:text-6xl">
                Learn how buying a song coin works before you trade.
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-mute md:text-lg">
                This guided demo turns on a simulated paper wallet, opens the market, and shows the exact investor path:
                browse coins, inspect the chart, buy or sell, then watch the portfolio update.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={startDemo} className="btn-primary h-12 px-5 text-[12px] font-black uppercase tracking-widest">
                Start Paper Mode Demo <ArrowRight size={15} />
              </button>
              <Link href="/market" className="btn h-12 px-5 text-[12px] font-black uppercase tracking-widest">
                Open Market
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-edge bg-black/45 p-5 shadow-depth backdrop-blur-xl">
            <div className="aspect-video rounded-2xl border border-neon/25 bg-[radial-gradient(circle_at_50%_35%,rgba(183,255,0,0.22),rgba(0,0,0,0.78)_55%)] p-5">
              <div className="flex h-full flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="chip-neon">Demo Mode</span>
                  <span className="text-[11px] font-black uppercase tracking-widest text-mute">2 min flow</span>
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-4/5 rounded-full bg-neon shadow-[0_0_18px_rgba(183,255,0,0.5)]" />
                  <div className="h-2 w-3/5 rounded-full bg-neon/55" />
                  <div className="h-2 w-2/5 rounded-full bg-violet/60" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <MiniDemoMetric label="Paper cash" value="$10K" />
                  <MiniDemoMetric label="Default buy" value="$0.07" />
                  <MiniDemoMetric label="Wallet" value="Sim" />
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-mute">
              Paper Mode behaves like a connected wallet, but no real money moves and no blockchain transaction is sent.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {flow.map((step, index) => (
          <article key={step.title} className="panel flex h-full min-h-[220px] flex-col p-5 md:p-6">
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xl font-black text-neon">{String(index + 1).padStart(2, "0")}</span>
              <span className="text-violet">{step.icon}</span>
            </div>
            <h2 className="mt-5 text-xl font-black text-ink">{step.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-mute">{step.body}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="panel p-6 md:p-7">
          <div className="text-[11px] font-black uppercase tracking-[0.26em] text-neon">Investor checklist</div>
          <h2 className="mt-3 text-2xl font-black text-ink">What to look at before buying</h2>
          <ul className="mt-5 space-y-3">
            {investorChecks.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-relaxed text-mute">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-neon" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel p-6 md:p-7">
          <div className="text-[11px] font-black uppercase tracking-[0.26em] text-violet">Fast path</div>
          <h2 className="mt-3 text-2xl font-black text-ink">A clean investor route for demos</h2>
          <p className="mt-3 text-sm leading-relaxed text-mute">
            Use this link when showing investors the app. It puts them into a safer simulated flow first, then they can
            switch into live wallet mode once the product story and trading flow make sense.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={startDemo} className="btn-primary h-11 px-4 text-[11px] font-black uppercase tracking-widest">
              Launch Demo Wallet
            </button>
            <Link href="/portfolio" className="btn h-11 px-4 text-[11px] font-black uppercase tracking-widest">
              Portfolio
            </Link>
            <Link href="/how-it-works" className="btn h-11 px-4 text-[11px] font-black uppercase tracking-widest">
              How It Works
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function MiniDemoMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.055] p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-mute">{label}</div>
      <div className="mt-1 font-mono text-lg font-black text-ink">{value}</div>
    </div>
  );
}
