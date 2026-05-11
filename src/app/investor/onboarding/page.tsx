import Link from "next/link";
import { Wallet, ShieldCheck, TrendingUp, CheckCircle2 } from "lucide-react";

export default function InvestorOnboardingPage() {
  return (
    <main className="space-y-6">
      <section className="panel-elevated p-6 md:p-10 space-y-4">
        <div className="text-[10px] uppercase tracking-[0.3em] font-black text-neon">Investor onboarding</div>
        <h1 className="text-4xl md:text-6xl font-black text-ink">Trade song coins with clear risk signals.</h1>
        <p className="max-w-3xl text-mute leading-relaxed">
          Before buying, SONG·DAQ shows wallet, SOL and USD values, token amount, slippage, fees, royalty status, and risk acknowledgments in plain English.
        </p>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <Card icon={<Wallet />} title="Connect Wallet" body="Use an external Solana wallet for real buys and sells. Paper Mode uses simulated balances." />
        <Card icon={<ShieldCheck />} title="Acknowledge Risk" body="Song coins are speculative. Royalty verification does not guarantee profit, price increases, or liquidity." />
        <Card icon={<TrendingUp />} title="Explore Coins" body="Browse royalty verified, in-progress, new launch, highest volume, and watched song coins." />
      </section>
      <section className="panel p-6 space-y-3">
        {[
          "I understand song coins are risky.",
          "I understand royalty verification does not guarantee profit.",
          "I understand prices can go down.",
          "I understand I am responsible for my own decisions.",
        ].map((copy) => (
          <div key={copy} className="flex items-center gap-3 text-sm text-mute">
            <CheckCircle2 size={16} className="text-neon shrink-0" />
            {copy}
          </div>
        ))}
      </section>
      <Link href="/market" className="btn-primary inline-flex h-12 px-6 text-[11px] uppercase tracking-widest font-black">
        Explore Market
      </Link>
    </main>
  );
}

function Card({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <article className="panel p-6 space-y-3">
      <div className="w-10 h-10 rounded-2xl border border-edge bg-panel2 grid place-items-center text-neon">{icon}</div>
      <h2 className="text-xl font-black text-ink">{title}</h2>
      <p className="text-sm text-mute leading-relaxed">{body}</p>
    </article>
  );
}
