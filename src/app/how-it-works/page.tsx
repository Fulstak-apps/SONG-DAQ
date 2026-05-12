import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Coins,
  Disc3,
  LineChart,
  Lock,
  Music,
  Repeat2,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { WhyFansCanBuy } from "@/components/WhyFansCanBuy";

const artistSteps = [
  ["Connect Audius", "The artist signs in so song-daq can attach the market to a real profile, catalog, artwork, and music identity."],
  ["Choose Artist Coin or Song Coin", "Artist Coins follow the Audius/Open Audio style. Song Coins are song-daq markets tied to a specific track."],
  ["Pick a launch preset", "Fan First, Balanced, and Premium presets set supply, artist allocation, liquidity, and wallet caps in one click."],
  ["Launch and add liquidity", "Liquidity puts public market money behind the coin so fans can buy and sell from a pool or curve."],
  ["Set up royalties later", "Royalty splits are optional after launch. Admin verification keeps royalty status separate from the initial launch."],
] as const;

const investorSteps = [
  ["Browse the market", "Compare Song Coins, Artist Coins, Hype Meter, liquidity, price, volume, and royalty status."],
  ["Open a coin page", "Review chart movement, artist info, discography, token source, liquidity, market value, and risk/trust signals."],
  ["Choose buy or sell amount", "Enter USD, SOL, AUDIO, or token amount. song-daq shows crypto and fiat estimates before confirmation."],
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

export default function HowItWorksPage() {
  return (
    <main className="space-y-8 pb-14">
      <section className="panel-elevated grain overflow-hidden p-6 md:p-10">
        <div className="grid gap-8 xl:grid-cols-[1fr_0.9fr] xl:items-center">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] font-black text-neon">How song-daq works</div>
            <h1 className="mt-4 max-w-4xl text-4xl font-black leading-[0.95] tracking-tight text-ink md:text-6xl">
              A music market where songs trade like assets.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-mute md:text-lg">
              Artists launch music coins. Fans and investors buy from a public pool or curve. The app tracks price, liquidity, portfolio value, royalty status, and artist momentum in one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/market" className="btn-primary h-11 px-4 text-[11px] font-black uppercase tracking-widest">
                Explore Market <ArrowRight size={14} />
              </Link>
              <Link href="/artist" className="btn h-11 px-4 text-[11px] font-black uppercase tracking-widest">
                Launch Coin
              </Link>
              <Link href="/signals" className="btn h-11 px-4 text-[11px] font-black uppercase tracking-widest">
                View Signals
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
            <InfoRow title="Royalties happen later" body="The artist can set up distributor splits after the coin exists. song-daq records royalty status only after verification." />
            <InfoRow title="The two systems stay separate" body="A coin can be live before royalties are verified. Royalty status should never be confused with launch liquidity." />
          </div>
        </section>

        <section className="panel-elevated grain p-5 md:p-6">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-violet">
            <BadgeCheck size={15} /> Trust signals
          </div>
          <div className="mt-5 grid gap-3">
            <InfoRow title="Source label" body="Every coin should make clear whether it came from song-daq or Open Audio/Audius-style artist coin data." />
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
            <article key={term} className="rounded-2xl border border-edge bg-panel p-4">
              <h3 className="text-base font-black text-ink">{term}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-amber/25 bg-amber/10 p-5 text-sm leading-relaxed text-amber/90">
        song-daq shows market data, music signals, liquidity, royalties, and portfolio estimates to help users understand the asset. Prices can move down or up, and users are responsible for their own decisions.
      </section>
    </main>
  );
}

function HeroMetric({ icon, label, value, text }: { icon: React.ReactNode; label: string; value: string; text: string }) {
  return (
    <article className="panel-elevated grain p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-neon/25 bg-neon/10 text-neon">{icon}</div>
        <div>
          <div className="text-[11px] font-black uppercase tracking-widest text-mute">{label}</div>
          <div className="text-xl font-black text-ink">{value}</div>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-mute">{text}</p>
    </article>
  );
}

function FlowPanel({ title, eyebrow, icon, items }: { title: string; eyebrow: string; icon: React.ReactNode; items: readonly (readonly [string, string])[] }) {
  return (
    <section className="panel-elevated grain p-5 md:p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-neon/25 bg-neon/10 text-neon">{icon}</div>
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-mute">{eyebrow}</div>
          <h2 className="text-2xl font-black text-ink">{title}</h2>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {items.map(([name, body], index) => (
          <div key={name} className="flex gap-3 rounded-2xl border border-edge bg-panel p-4">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.055] font-mono text-xs font-black text-neon">{index + 1}</div>
            <div>
              <h3 className="font-black text-ink">{name}</h3>
              <p className="mt-1 text-sm leading-relaxed text-mute">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function InfoRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-edge bg-panel p-4">
      <h3 className="text-base font-black text-ink">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-mute">{body}</p>
    </div>
  );
}

function MarketGraph() {
  return (
    <div className="rounded-[2rem] border border-edge bg-[#05070a] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-mute">Live value curve</div>
          <div className="mt-1 text-2xl font-black text-ink">$12,840.22</div>
        </div>
        <span className="rounded-full border border-neon/25 bg-neon/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-neon">+18.4%</span>
      </div>
      <svg viewBox="0 0 720 300" className="h-64 w-full overflow-visible">
        <defs>
          <linearGradient id="how-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#b7ff00" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#b7ff00" stopOpacity="0" />
          </linearGradient>
          <filter id="how-glow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[60, 120, 180, 240].map((y) => <line key={y} x1="0" x2="720" y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="8 10" />)}
        <path d="M0,226 C80,220 110,230 160,206 C205,185 220,125 265,132 C315,140 310,220 360,214 C415,208 412,154 458,148 C515,140 520,232 568,226 C620,220 610,116 720,86 L720,300 L0,300 Z" fill="url(#how-gradient)" />
        <path d="M0,226 C80,220 110,230 160,206 C205,185 220,125 265,132 C315,140 310,220 360,214 C415,208 412,154 458,148 C515,140 520,232 568,226 C620,220 610,116 720,86" fill="none" stroke="#b7ff00" strokeWidth="8" strokeLinecap="round" filter="url(#how-glow)" />
        <text x="0" y="286" fill="rgba(255,255,255,0.5)" fontSize="24" fontFamily="monospace">Launch</text>
        <text x="295" y="286" fill="rgba(255,255,255,0.5)" fontSize="24" fontFamily="monospace">Trading</text>
        <text x="600" y="286" fill="rgba(255,255,255,0.5)" fontSize="24" fontFamily="monospace">Signals</text>
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
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-mute">
        <BarChart3 size={15} /> Example supply graph
      </div>
      <h2 className="mt-2 text-2xl font-black text-ink">Where the coins go</h2>
      <p className="mt-2 text-sm leading-relaxed text-mute">The exact split depends on the launch preset, but the core idea is simple: artist inventory, public trading supply, liquidity, and reserves are separate buckets.</p>
      <div className="mt-5 space-y-3">
        {rows.map(([label, value, color]) => (
          <div key={label}>
            <div className="mb-1 flex items-center justify-between text-xs font-black uppercase tracking-widest text-mute">
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
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-mute">
        <LineChart size={15} /> Liquidity depth
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
