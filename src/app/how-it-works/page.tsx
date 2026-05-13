import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Coins,
  Disc3,
  FileCheck2,
  HelpCircle,
  LifeBuoy,
  LineChart,
  Music,
  Repeat2,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { ROYALTY_EMAIL } from "@/lib/appMode";
import { WhyFansCanBuy } from "@/components/WhyFansCanBuy";

const artistSteps = [
  ["Connect Audius", "The artist signs in so SONG·DAQ can attach the market to a real profile, catalog, artwork, and music identity."],
  ["Choose Artist Coin or Song Coin", "Artist Coins follow the Audius/Open Audio style. Song Coins are SONG·DAQ markets tied to a specific track."],
  ["Pick a launch preset", "Fan First, Balanced, and Premium presets set supply, artist allocation, liquidity, and wallet caps in one click."],
  ["Launch and add liquidity", "Liquidity puts public market money behind the coin so fans can buy and sell from a pool or curve."],
  ["Set up royalties later", "Royalty splits are optional after launch. Admin verification keeps royalty status separate from the initial launch."],
] as const;

const investorSteps = [
  ["Browse the market", "Compare Song Coins, Artist Coins, Hype Meter, liquidity, price, volume, and royalty status."],
  ["Open a coin page", "Review chart movement, artist info, discography, token source, liquidity, market value, and risk/trust signals."],
  ["Choose buy or sell amount", "Enter USD, SOL, AUDIO, or token amount. SONG·DAQ shows crypto and fiat estimates before confirmation."],
  ["Confirm in wallet", "Live mode uses a real Solana wallet. Paper Mode simulates the same flow with fake funds."],
  ["Track portfolio", "Portfolio rolls up SOL, AUDIO, Song Coins, Artist Coins, other wallet assets, P/L, and recent activity."],
] as const;

const glossary = [
  ["Liquidity", "The public market money that lets fans buy and sell. Without liquidity, a coin can exist but trading will feel stuck."],
  ["Market value", "A current estimate based on price and the supply that should count in the market. Creator inventory should not be treated like spendable cash."],
  ["Royalty pool", "Verified royalty money received later that can be recorded into the coin ecosystem."],
  ["Hype Meter", "A discovery score based on trading, watchlists, music activity, and momentum signals."],
  ["Undervalued signal", "A discovery prompt when attention appears to be rising faster than price or investor activity."],
  ["Song IPO", "A market-debut event for a new song coin launch."],
];

const supportTopics = [
  ["Launch help", "Create the coin, review supply, choose a launch preset, then add liquidity so the public market can open. SONG·DAQ shows crypto and fiat estimates before money moves."],
  ["Wallet help", "Live mode uses your connected Solana wallet. Paper Mode gives you a simulated wallet so you can test launching, buying, selling, and portfolio changes with no real funds."],
  ["Royalty help", `Royalty splits happen after launch. Artists add ${ROYALTY_EMAIL} inside their distributor dashboard, return to SONG·DAQ, and submit the setup request for verification.`],
  ["Portfolio help", "Portfolio rolls up SOL, AUDIO, Song Coins, Artist Coins, other wallet assets, profit/loss, and recent activity so investors can see the whole account in one place."],
  ["Liquidity help", "Liquidity is still called liquidity, but the app explains it as the public market money that lets fans buy and sell without waiting for a private buyer."],
  ["Admin help", "Admin-only review, royalty verification, payment records, support requests, and asset sync health live inside the admin dashboard, not in the public launch flow."],
] as const;

const supportGraphs = [
  ["Coin minted", "Fixed supply created", "text-violet"],
  ["Liquidity added", "Public pool opens", "text-neon"],
  ["Market visible", "Fans can buy/sell", "text-cyan"],
  ["Royalties optional", "Verified later", "text-gold"],
] as const;

export default function HowItWorksPage() {
  return (
    <main className="space-y-8 pb-14">
      <section className="panel-elevated grain overflow-hidden p-6 md:p-10">
        <div className="grid gap-8 xl:grid-cols-[1fr_0.9fr] xl:items-center">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] font-black text-neon">How SONG·DAQ works</div>
            <h1 className="mt-4 max-w-4xl text-4xl font-black leading-[0.95] tracking-tight text-ink md:text-6xl">
              Buy music coins and follow the live music economy.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-mute md:text-lg">
              SONG·DAQ lets fans invest in their favorite music and lets artists launch music coins with visible price, liquidity, wallet, and royalty signals. The goal is to make every market feel understandable before anyone spends money.
            </p>
            <p className="mt-3 max-w-3xl text-base font-semibold leading-relaxed text-ink/75 md:text-lg">
              100% verified on-chain means the app surfaces the mint, wallet, pool, launch, and market records users need to inspect. Artists can launch coin markets for fans, and investors can compare Song Coins and Artist Coins from one clean screen.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/market" className="btn-primary h-11 px-4 text-[11px] font-black uppercase tracking-widest">
                Explore Market <ArrowRight size={14} />
              </Link>
              <Link href="/artist" className="btn h-11 px-4 text-[11px] font-black uppercase tracking-widest">
                Launch Coin
              </Link>
            </div>
          </div>
          <MarketGraph />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <HeroMetric icon={<Music />} label="Artist Identity" value="Audius-first" text="Catalog, profile, artwork, and song data come from Audius/Open Audio whenever available." />
        <HeroMetric icon={<Coins />} label="Market Structure" value="Public pool" text="Fans buy from a visible market, not from a hidden artist wallet." />
        <HeroMetric icon={<ShieldCheck />} label="Trading Clarity" value="Fiat + crypto" text="Amounts show crypto and fiat estimates before launch, liquidity, buy, and sell actions." />
      </section>

      <section className="panel-elevated grain p-5 md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-neon">
              <LifeBuoy size={18} /> Support + product guide
            </div>
            <h2 className="mt-3 max-w-4xl text-3xl font-black leading-tight text-ink md:text-5xl">
              One page for how it works, what to do next, and what each market signal means.
            </h2>
            <p className="mt-3 max-w-4xl text-base font-semibold leading-relaxed text-mute md:text-lg">
              This page now combines the how-it-works guide with support details so beginners can understand launch, trading, liquidity, wallets, royalties, and portfolio updates without hunting through different pages.
            </p>
          </div>
          <Link href="/admin/login" className="btn-primary h-11 px-4 text-xs font-black uppercase tracking-widest">
            Admin
          </Link>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {supportTopics.map(([title, body]) => (
            <SupportTopic key={title} title={title} body={body} />
          ))}
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          {supportGraphs.map(([title, body, color], index) => (
            <div key={title} className="rounded-2xl border border-edge bg-panel p-4">
              <div className={`grid h-16 w-16 place-items-center rounded-[1.25rem] border border-white/10 bg-white/[0.055] ${color}`}>
                {index === 0 ? <Coins size={32} /> : index === 1 ? <LineChart size={32} /> : index === 2 ? <BarChart3 size={32} /> : <FileCheck2 size={32} />}
              </div>
              <div className="mt-4 text-lg font-black text-ink">{title}</div>
              <p className="mt-1 text-base font-semibold leading-relaxed text-mute">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <FlowPanel title="Artist flow" eyebrow="Launch side" icon={<Disc3 />} items={artistSteps} />
        <AllocationGraph />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1fr]">
        <LiquidityGraph />
        <FlowPanel title="Investor flow" eyebrow="Trading side" icon={<Wallet />} items={investorSteps} />
      </section>

      <WhyFansCanBuy />

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="panel-elevated grain p-5 md:p-6">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-neon">
            <Repeat2 size={15} /> Launch liquidity vs royalties
          </div>
          <div className="mt-5 grid gap-3">
            <InfoRow title="Launch liquidity gets the coin live" body="The artist pairs song coins with SOL, USDC, or AUDIO-style market money so buyers and sellers have a place to trade." />
            <InfoRow title="Royalties happen later" body="The artist can set up distributor splits after the coin exists. SONG·DAQ records royalty status only after verification." />
            <InfoRow title="The two systems stay separate" body="A coin can be live before royalties are verified. Royalty status should never be confused with launch liquidity." />
          </div>
        </section>

        <section className="panel-elevated grain p-5 md:p-6">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-violet">
            <BadgeCheck size={15} /> Trust signals
          </div>
          <div className="mt-5 grid gap-3">
            <InfoRow title="Source label" body="Every coin should make clear whether it came from SONG·DAQ or Open Audio/Audius-style artist coin data." />
            <InfoRow title="Visible supply logic" body="Artist allocation, public allocation, liquidity allocation, reserve, and burned supply should update everywhere." />
            <InfoRow title="Wallet-readable actions" body="Live actions should show clear wallet prompts, estimated fiat cost, network fee, and real backend or wallet errors." />
          </div>
        </section>
      </section>

      <section className="panel-elevated grain p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-mute">Beginner glossary</div>
            <h2 className="mt-2 text-2xl font-black text-ink">Terms investors see in the app</h2>
          </div>
          <Link href="/faq" className="btn h-10 px-4 text-[11px] font-black uppercase tracking-widest">Support</Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {glossary.map(([term, body]) => (
            <article key={term} className="rounded-2xl border border-edge bg-panel p-5">
              <h3 className="text-lg font-black text-ink">{term}</h3>
              <p className="mt-2 text-base font-semibold leading-relaxed text-mute">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-amber/25 bg-amber/10 p-5 text-base font-semibold leading-relaxed text-amber/90">
        SONG·DAQ shows market data, music signals, liquidity, royalties, and portfolio estimates to help users understand the asset. Prices can move down or up, and users are responsible for their own decisions.
      </section>
    </main>
  );
}

function HeroMetric({ icon, label, value, text }: { icon: React.ReactNode; label: string; value: string; text: string }) {
  return (
    <article className="panel-elevated grain p-5 md:p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-neon/25 bg-neon/10 text-neon [&>svg]:h-6 [&>svg]:w-6">{icon}</div>
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-mute">{label}</div>
          <div className="text-2xl font-black text-ink">{value}</div>
        </div>
      </div>
      <p className="mt-4 text-base font-semibold leading-relaxed text-mute">{text}</p>
    </article>
  );
}

function SupportTopic({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-2xl border border-edge bg-panel p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-neon/20 bg-neon/10 text-neon">
          <HelpCircle size={20} />
        </div>
        <div>
          <h3 className="text-lg font-black text-ink">{title}</h3>
          <p className="mt-2 text-base font-semibold leading-relaxed text-mute">{body}</p>
        </div>
      </div>
    </article>
  );
}

function FlowPanel({ title, eyebrow, icon, items }: { title: string; eyebrow: string; icon: React.ReactNode; items: readonly (readonly [string, string])[] }) {
  return (
    <section className="panel-elevated grain p-5 md:p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-neon/25 bg-neon/10 text-neon [&>svg]:h-6 [&>svg]:w-6">{icon}</div>
        <div>
          <div className="text-xs font-black uppercase tracking-[0.24em] text-mute">{eyebrow}</div>
          <h2 className="text-3xl font-black text-ink">{title}</h2>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {items.map(([name, body], index) => (
          <div key={name} className="flex gap-3 rounded-2xl border border-edge bg-panel p-4 md:p-5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.055] font-mono text-sm font-black text-neon">{index + 1}</div>
            <div>
              <h3 className="text-lg font-black text-ink">{name}</h3>
              <p className="mt-1 text-base font-semibold leading-relaxed text-mute">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function InfoRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-edge bg-panel p-5">
      <h3 className="text-lg font-black text-ink">{title}</h3>
      <p className="mt-2 text-base font-semibold leading-relaxed text-mute">{body}</p>
    </div>
  );
}

function MarketGraph() {
  const curve =
    "M24,226 C104,220 134,230 184,206 C229,185 244,125 289,132 C339,140 334,220 384,214 C439,208 436,154 482,148 C539,140 544,232 592,226 C642,220 632,116 700,86";
  const area = `${curve} L700,300 L24,300 Z`;

  return (
    <div className="rounded-[2rem] border border-edge bg-[#05070a] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-mute">Live value curve</div>
          <div className="mt-1 text-2xl font-black text-ink">$12,840.22</div>
        </div>
        <span className="rounded-full border border-neon/25 bg-neon/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-neon">+18.4%</span>
      </div>
      <svg viewBox="0 0 760 300" className="h-60 w-full overflow-visible sm:h-64" role="img" aria-label="Animated live value curve">
        <defs>
          <linearGradient id="how-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#b7ff00" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#b7ff00" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="how-line-gradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#8fdc35" />
            <stop offset="55%" stopColor="#b7ff00" />
            <stop offset="100%" stopColor="#e0ff7a" />
          </linearGradient>
          <filter id="how-glow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[54, 108, 162, 216].map((y) => <line key={y} x1="56" x2="640" y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="8 10" />)}
        {[
          [18, 174, 86, "#58d64f"],
          [28, 188, 72, "#58d64f"],
          [38, 206, 54, "#58d64f"],
          [48, 226, 34, "#ff3366"],
          [58, 240, 20, "#58d64f"],
        ].map(([x, y, h, color]) => (
          <rect key={`${x}-${y}`} x={x as number} y={y as number} width="5" height={h as number} rx="2.5" fill={color as string} opacity="0.34" />
        ))}
        <path id="how-live-curve" d={curve} fill="none" stroke="none" />
        <path d={area} fill="url(#how-gradient)" opacity="0.95" />
        <path d={curve} fill="none" stroke="url(#how-line-gradient)" strokeWidth="8" strokeLinecap="round" filter="url(#how-glow)" />
        <path d={curve} fill="none" stroke="#efffb5" strokeWidth="3" strokeLinecap="round" opacity="0.75" strokeDasharray="90 720">
          <animate attributeName="stroke-dashoffset" values="740;0;-740" dur="5.5s" repeatCount="indefinite" />
        </path>
        <circle r="7" fill="#d8ff52" opacity="0.95" filter="url(#how-glow)">
          <animateMotion dur="6s" repeatCount="indefinite">
            <mpath href="#how-live-curve" />
          </animateMotion>
        </circle>
        <circle cx="700" cy="86" r="7" fill="#b7ff00" opacity="0.88" filter="url(#how-glow)">
          <animate attributeName="r" values="7;13;7" dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.9;0.35;0.9" dur="1.8s" repeatCount="indefinite" />
        </circle>
        <line x1="56" x2="640" y1="86" y2="86" stroke="rgba(88,214,79,0.42)" strokeDasharray="7 8" />
        <rect x="384" y="28" width="150" height="42" rx="21" fill="rgba(0,0,0,0.62)" stroke="rgba(255,255,255,0.16)" />
        <text x="404" y="55" fill="#58d64f" fontSize="15" fontWeight="900" fontFamily="monospace" letterSpacing="3">HIGH $13.09K</text>
        <rect x="498" y="224" width="134" height="36" rx="18" fill="rgba(0,0,0,0.62)" stroke="rgba(255,255,255,0.16)" />
        <text x="515" y="247" fill="rgba(255,255,255,0.82)" fontSize="14" fontWeight="900" fontFamily="monospace" letterSpacing="3">LOW $11.88K</text>
        <rect x="642" y="72" width="94" height="42" rx="21" fill="#58d64f" />
        <text x="659" y="99" fill="#041006" fontSize="17" fontWeight="900" fontFamily="monospace">$12.84K</text>
        <text x="656" y="54" fill="rgba(255,255,255,0.62)" fontSize="16" fontWeight="800" fontFamily="monospace">$13.20K</text>
        <text x="656" y="142" fill="rgba(255,255,255,0.58)" fontSize="16" fontWeight="800" fontFamily="monospace">$12.60K</text>
        <text x="656" y="216" fill="rgba(255,255,255,0.58)" fontSize="16" fontWeight="800" fontFamily="monospace">$12.05K</text>
        <text x="24" y="286" fill="rgba(255,255,255,0.56)" fontSize="21" fontFamily="monospace">Launch</text>
        <text x="310" y="286" fill="rgba(255,255,255,0.56)" fontSize="21" fontFamily="monospace">Trading</text>
        <text x="612" y="286" fill="rgba(255,255,255,0.56)" fontSize="21" fontFamily="monospace">Signals</text>
      </svg>
    </div>
  );
}

function AllocationGraph() {
  const rows = [
    ["Public market", "40%", "bg-neon"],
    ["Launch liquidity", "30%", "bg-cyan"],
    ["Artist vesting", "20%", "bg-violet"],
    ["Reserve", "10%", "bg-gold"],
  ];
  return (
    <section className="panel-elevated grain p-5 md:p-6">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-mute">
        <BarChart3 size={18} /> Example supply graph
      </div>
      <h2 className="mt-2 text-2xl font-black text-ink">Where the coins go</h2>
      <p className="mt-2 text-base font-semibold leading-relaxed text-mute">The exact split depends on the launch preset, but the core idea is simple: artist inventory, public trading supply, liquidity, and reserves are separate buckets.</p>
      <div className="mt-5 space-y-3">
        {rows.map(([label, value, color]) => (
          <div key={label}>
            <div className="mb-1 flex items-center justify-between text-sm font-black uppercase tracking-widest text-mute">
              <span>{label}</span>
              <span>{value}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/[0.07]">
              <div className={`h-full rounded-full ${color}`} style={{ width: value }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LiquidityGraph() {
  return (
    <section className="panel-elevated grain p-5 md:p-6">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-mute">
        <LineChart size={18} /> Liquidity depth
      </div>
      <h2 className="mt-2 text-2xl font-black text-ink">Why liquidity matters</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <DepthCard title="Thin liquidity" amount="$250" move="Large price swings" tone="red" />
        <DepthCard title="Healthier liquidity" amount="$5,000+" move="Smoother trading" tone="neon" />
      </div>
      <div className="mt-5 rounded-2xl border border-edge bg-panel p-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
          <div className="rounded-xl bg-neon/10 p-4 text-neon">
            <Coins className="mx-auto mb-2" size={24} />
            <div className="text-xs font-black uppercase tracking-widest">Song coins</div>
          </div>
          <div className="text-mute">+</div>
          <div className="rounded-xl bg-violet/10 p-4 text-violet">
            <Wallet className="mx-auto mb-2" size={24} />
            <div className="text-xs font-black uppercase tracking-widest">SOL / USDC / AUDIO</div>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-neon/20 bg-neon/8 p-3 text-sm leading-relaxed text-neon/90">
          Together, these form the public trading pool. Fans buy and sell against that pool.
        </div>
      </div>
    </section>
  );
}

function DepthCard({ title, amount, move, tone }: { title: string; amount: string; move: string; tone: "red" | "neon" }) {
  const color = tone === "red" ? "text-red border-red/25 bg-red/10" : "text-neon border-neon/25 bg-neon/10";
  return (
    <div className={`rounded-2xl border p-4 ${color}`}>
      <div className="text-[11px] font-black uppercase tracking-widest opacity-80">{title}</div>
      <div className="mt-2 font-mono text-2xl font-black">{amount}</div>
      <div className="mt-1 text-sm opacity-85">{move}</div>
    </div>
  );
}
