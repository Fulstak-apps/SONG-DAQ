import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, Coins, FileCheck2, Landmark, LifeBuoy, Lock, RefreshCw, ShieldAlert, Sparkles, Split, TrendingUp, Wallet } from "lucide-react";
import { ROYALTY_EMAIL } from "@/lib/appMode";

const artistSteps = [
  "Connect your external Solana wallet.",
  "Switch to Artist Mode.",
  "Choose a song or create an artist coin.",
  "Enter coin details, ticker, supply, and launch price.",
  "Choose how many coins are reserved for launch liquidity and how much SOL/USDC is paired with them.",
  "Approve the mint transaction, then approve the automatic launch liquidity transaction.",
  "After launch, set up royalty splits if you want royalty verification.",
];

const investorSteps = [
  "Connect a Solana wallet.",
  "Browse the marketplace.",
  "Open a coin page.",
  "Review the chart, price, royalty status, and risk notes.",
  "Choose an amount and review crypto plus fiat.",
  "Confirm the buy from your wallet.",
  "Track the coin in your portfolio.",
];

const launchChecklist = [
  "Wallet connected globally across song-daq.",
  "Song, artist name, ticker, artwork, and supply are filled in.",
  "Launch liquidity amount is reviewed in crypto plus fiat.",
  "Artist confirms they have the rights or authority to launch the coin.",
  "Wallet transaction is approved.",
  "Coin appears on the market and portfolio pages after launch.",
];

const walletHelp = [
  "If the wallet is not connected, song-daq should show a Connect Wallet button instead of zero balances.",
  "If a wallet rejects a request, song-daq should show the real wallet error so it can be tested and fixed.",
  "If a balance looks wrong, refresh the wallet connection and confirm the same wallet address is selected.",
  "Live buys use SOL right now. Audius wallet buying is coming later because Audius has platform restrictions.",
];

const portfolioHelp = [
  "Your portfolio should show song coins bought on song-daq.",
  "External wallet assets should show token names, images when available, token amounts, and fiat value.",
  "Paper Mode portfolio stays separate from Live Mode.",
  "If Phantom marks a token as spam, open Phantom and report it as not spam so it becomes visible.",
];

const adminFlow = [
  "Review new users, wallets, coins, royalty requests, and failed transactions.",
  "Verify or reject distributor split requests.",
  "Record royalty payments received by song-daq.",
  "Record Royalty Pool contributions or liquidity support.",
  "Keep notes so every important admin action has history.",
];

const quickFacts = [
  ["Song Coins", "A song coin is tied to one song. Fans buy from the public market created by launch liquidity."],
  ["Artist Coins", "An artist coin represents the artist market. Open Audio/Audius Artist Coins can be imported or launched through the supported flow."],
  ["Liquidity", "Liquidity is the public pool money that lets fans buy and sell. It is separate from the artist’s held allocation."],
  ["Paper Mode", "Paper Mode gives you a fake funded wallet so you can test launch, buy, sell, and portfolio flows without spending real money."],
];

const glossary = [
  ["Launch liquidity", "The starting market. It pairs song coins with SOL, USDC, or AUDIO so buyers and sellers have a pool to trade against."],
  ["Artist hold", "The artist’s allocation. It should stay separate from the public market so the artist is not selling the whole supply at once."],
  ["Public allocation", "The portion of supply used for the market. Fans buy from this pool or curve."],
  ["Market value", "The app should use tradable supply and real liquidity signals, not blindly count the full 1B supply as liquid value."],
  ["Royalty status", "The public label that tells users whether royalty splits are not submitted, in progress, verified, paid, or added to the pool."],
  ["Wallet confirmation", "The final screen in Phantom, Solflare, or Backpack before a real transaction is sent."],
];

export function SupportPage() {
  return (
    <main className="space-y-6">
      <section className="panel-elevated overflow-hidden p-6 md:p-10">
        <div className="max-w-4xl space-y-5">
          <div className="text-[11px] tracking-[0.22em] font-black text-neon">song-daq support</div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-ink">Everything you need to use song-daq with confidence.</h1>
          <p className="text-base md:text-xl text-ink/85 leading-relaxed font-semibold">
            song-daq is a music market where artists launch coins tied to artists and songs, and fans can buy, sell, track, and test those markets with clear wallet, liquidity, price, and royalty signals.
          </p>
          <p className="text-sm md:text-base text-ink/70 leading-relaxed font-medium">
            The goal is simple: make music markets understandable. New users see clean charts, direct wallet prompts, crypto plus fiat values, and plain-English explanations. Power users can go deeper into liquidity, volume, slippage, holder activity, and royalty records.
          </p>
          <div className="rounded-2xl border border-neon/25 bg-neon/10 p-4 text-sm text-neon font-black leading-relaxed shadow-[inset_0_0_24px_rgba(193,255,0,0.05)]">
            Launch works in two clear approvals: create the fixed-supply coin, then add launch liquidity. Fans buy from the liquidity pool, not from a hidden mint. Royalty money supports the coin after launch.
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {quickFacts.map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-edge bg-panel p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] font-black text-neon">{title}</div>
                <p className="mt-2 text-sm leading-relaxed text-ink/75 font-semibold">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Walkthrough icon={<Coins />} title="Artist Launch Walkthrough" steps={artistSteps} />
        <Walkthrough icon={<Wallet />} title="Investor Buying Walkthrough" steps={investorSteps} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <SupportCard icon={<CheckCircle2 />} title="Launch Readiness Checklist">
          <Checklist items={launchChecklist} />
        </SupportCard>
        <SupportCard icon={<Wallet />} title="Wallet Help">
          <Checklist items={walletHelp} />
        </SupportCard>
        <SupportCard icon={<TrendingUp />} title="Portfolio Help">
          <Checklist items={portfolioHelp} />
        </SupportCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <SupportCard icon={<Landmark />} title="What Is Launch Liquidity?">
          <p><strong className="text-ink">Liquidity is the public market money.</strong> It is what makes a coin tradable after the mint is created.</p>
          <p>song-daq separates the supply into artist hold, launch liquidity, and reserve. The launch-liquidity portion may stage in the artist wallet briefly, then the artist approves a second transaction that moves those coins plus SOL, USDC, or AUDIO into the public trading pool.</p>
          <p>This is separate from royalties. A coin can launch without royalty verification, but it still needs liquidity to trade.</p>
          <p>Think of launch liquidity like opening the first market for the coin. Without it, people can see the coin, but there is no real pool for buys and sells.</p>
          <p>Once the pool is verified, fans can buy with SOL. If demand rises and someone later sells higher, that holder can come out ahead. Prices can also move down.</p>
        </SupportCard>

        <SupportCard icon={<FileCheck2 />} title="How Royalty Splits Work">
          <p><strong className="text-ink">Royalty setup happens after the coin is created.</strong> Open your distributor dashboard, go to splits or royalty sharing, and add <span className="font-mono text-neon">{ROYALTY_EMAIL}</span> as the split recipient.</p>
          <p>Send the split invitation from inside the distributor platform, then return to song-daq and submit the verification form. Admin reviews it, then the coin can move from Royalty Verification In Progress to Royalty Verified.</p>
          <p>The artist does not manually email monthly royalty money. The distributor sends the royalty split to song-daq, and admin records what was received.</p>
          <Link href="/splits" className="btn-primary mt-2 inline-flex h-11 px-4 text-[11px] uppercase tracking-widest font-black">
            Set Up Royalty Split <ArrowRight size={14} />
          </Link>
        </SupportCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <SupportCard icon={<Split />} title="Royalty Status Badges">
          <StatusGrid />
        </SupportCard>
        <SupportCard icon={<RefreshCw />} title="What Is Manual vs Automatic?">
          <p><strong className="text-ink">Automatic:</strong> the app can show coin pages, charts, Paper Mode, wallet state, portfolio records, submitted royalty requests, and admin dashboard data.</p>
          <p><strong className="text-ink">Manual:</strong> royalty verification, royalty payments received from distributors, Royalty Pool contributions, and any treasury movement are admin-reviewed for the MVP.</p>
          <p>Manual royalty and treasury controls live in the admin dashboard. They do not stop users from testing the public launch, buy, sell, and wallet flows.</p>
          <p>If a launch or trade fails, song-daq should show the real backend or wallet error instead of a fake paused state.</p>
        </SupportCard>
      </section>

      <section className="panel-elevated p-6 md:p-10 space-y-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] font-black text-mute">Plain-English Terms</div>
          <h2 className="text-3xl md:text-5xl font-black text-ink">The words users need to understand.</h2>
          <p className="mt-3 max-w-4xl text-sm md:text-base text-ink/70 font-medium leading-relaxed">
            song-daq should explain market language right where users make decisions. These terms show up during launch, trading, liquidity, and portfolio review.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {glossary.map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-edge bg-panel p-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-ink">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/75 font-semibold">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <SupportCard icon={<Lock />} title="When Royalties Come In">
          <p>The distributor pays song-daq based on the split invitation. Admin records the payment and can add that value into the coin’s Royalty Pool / liquidity support system.</p>
          <p>Royalty activity can add visible value flow to the ecosystem when payments are received, verified, and added to the pool.</p>
          <p>When recorded, the coin page can show the amount received, the month covered, and whether it was added to the Royalty Pool.</p>
        </SupportCard>
        <SupportCard icon={<Sparkles />} title="Paper Mode">
          <p>Paper Mode uses simulated funds. No real SOL is spent, and no real wallet balance changes. The green glowing border means you are testing with demo money.</p>
          <p>Use Paper Mode to practice buying, selling, launching coins, reviewing charts, and testing portfolio changes before spending real money.</p>
        </SupportCard>
        <SupportCard icon={<BarChart3 />} title="Advanced Chart">
          <p>The coin chart uses advanced market tools by default, including volume, liquidity, slippage, and deeper market data.</p>
          <p>The goal is to make every coin feel like a real trading screen while still keeping the labels clear for music fans.</p>
          <p>When a new pool is created, Jupiter may need time to index the route. During that time, song-daq shows a route waiting state and will not ask your wallet to approve a swap.</p>
        </SupportCard>
      </section>

      <section className="panel-elevated p-6 md:p-10 space-y-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] font-black text-mute">Trading Guide</div>
          <h2 className="text-3xl md:text-5xl font-black text-ink">How buying and selling should feel.</h2>
          <p className="mt-3 max-w-4xl text-sm md:text-base text-mute leading-relaxed">
            song-daq should always tell users what they are about to do before money moves. A buy or sell confirmation should show token amount, crypto amount, fiat estimate, wallet address, estimated fees, and any slippage warning in plain English.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <MiniGuide title="Before Buying" items={["Connect your wallet.", "Check price and royalty status.", "Review crypto plus fiat.", "Confirm in wallet."]} />
          <MiniGuide title="Before Selling" items={["Check token amount.", "Review expected crypto plus fiat.", "Read slippage warning.", "Confirm only once."]} />
          <MiniGuide title="After Trading" items={["Portfolio updates.", "Transaction is saved.", "Coin history updates.", "Solscan link appears when available."]} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <SupportCard icon={<LifeBuoy />} title="Admin Dashboard">
          <p>The admin area is for reviewing what happens in the background: users, wallets, coins, transactions, royalty requests, error logs, and manual royalty actions.</p>
          <Checklist items={adminFlow} />
          <p className="text-xs text-mute">The hidden Support-page Admin link is not security. Real protection comes from login, roles, and server-side checks.</p>
        </SupportCard>
        <SupportCard icon={<ShieldAlert />} title="Public Launch Safety">
          <p>Before public launch, confirm real wallet buys, coin launches, portfolio tracking, admin login, royalty request submission, and mobile layouts all work on the Render app.</p>
          <p>Legal language must be reviewed by a qualified attorney before marketing song coins publicly.</p>
          <p>Public user flows should stay open for testing. Admin-only moderation and operational checks belong inside the admin dashboard.</p>
        </SupportCard>
      </section>

      <section className="panel-elevated p-6 md:p-10 space-y-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-red/20 bg-red/10 text-red">
            <ShieldAlert size={20} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] font-black text-mute">Risk Notes</div>
            <h2 className="text-3xl md:text-5xl font-black text-ink">Be clear before money moves.</h2>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            "song-daq is not a bank, broker, exchange, or financial advisor.",
            "Song coins are risky and speculative.",
            "Royalty activity is shown as a verified market signal when available.",
            "Prices can go down.",
            "Users are responsible for their own decisions.",
            "Legal copy is placeholder text and needs attorney review before public launch.",
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-edge bg-panel p-4 text-sm text-mute leading-relaxed">
              <CheckCircle2 className="mb-3 text-neon" size={16} />
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-6 md:p-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <LifeBuoy className="text-neon" />
          <div>
            <h2 className="text-xl font-black text-ink">Need help?</h2>
            <p className="text-sm text-mute">Support and royalty split review: <span className="font-mono text-neon">{ROYALTY_EMAIL}</span></p>
          </div>
        </div>
        <Link href="/admin/login" className="text-[11px] uppercase tracking-widest font-black text-mute hover:text-neon">
          Admin
        </Link>
      </section>
    </main>
  );
}

function Walkthrough({ icon, title, steps }: { icon: React.ReactNode; title: string; steps: string[] }) {
  return (
    <section className="panel p-6 md:p-7">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-edge bg-white/[0.05] text-neon">{icon}</div>
        <h2 className="text-2xl font-black text-ink">{title}</h2>
      </div>
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3 rounded-2xl border border-edge bg-panel p-4">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-neon text-[11px] font-black text-black">{index + 1}</span>
            <span className="text-sm text-ink/75 leading-relaxed font-semibold">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SupportCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="panel p-6 md:p-7 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-white/[0.05] border border-edge grid place-items-center text-neon">{icon}</div>
        <h2 className="text-2xl font-black text-ink">{title}</h2>
      </div>
      <div className="space-y-3 text-sm md:text-base text-ink/75 leading-relaxed font-medium">
        {children}
      </div>
    </section>
  );
}

function Checklist({ items }: { items: string[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item} className="flex gap-2 rounded-xl border border-edge bg-panel2/70 p-3 text-sm text-ink/75 font-semibold leading-relaxed">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-neon" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

function StatusGrid() {
  const statuses = [
    ["Royalties Not Submitted", "No royalty setup request has been submitted yet."],
    ["Royalty Verification In Progress", "Artist submitted the form and admin is reviewing the distributor split."],
    ["Royalty Verified", "Admin confirmed the distributor split information."],
    ["Needs Update", "Something is missing or does not match."],
    ["Payment Received", "song-daq received royalty money, but it has not been added to the pool yet."],
    ["Royalty Added To Coin Pool", "Admin recorded that royalty value was added to the coin ecosystem."],
  ];
  return (
    <div className="grid gap-2">
      {statuses.map(([name, desc]) => (
        <div key={name} className="rounded-xl border border-edge bg-panel2/70 p-3">
          <div className="text-[11px] uppercase tracking-widest font-black text-ink">{name}</div>
          <p className="mt-1 text-xs text-ink/70 font-medium leading-relaxed">{desc}</p>
        </div>
      ))}
    </div>
  );
}

function MiniGuide({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-edge bg-panel p-4">
      <h3 className="text-sm font-black uppercase tracking-widest text-ink">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-sm text-ink/75 font-semibold leading-relaxed">• {item}</li>
        ))}
      </ul>
    </div>
  );
}
