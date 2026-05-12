import Link from "next/link";
import { Coins, Music, ShieldCheck, Wallet } from "lucide-react";
import { WhyFansCanBuy } from "@/components/WhyFansCanBuy";

const steps = [
  ["Artist verifies", "Artist signs in with Audius so song-daq can connect the coin to a real artist identity.", <Music key="music" />],
  ["Market opens", "The public allocation goes into a curve or liquidity pool. Fans buy from that market, not from the artist directly.", <Coins key="coins" />],
  ["Wallet signs", "Real buys, sells, and launches use an external Solana wallet. Paper Mode uses simulated money.", <Wallet key="wallet" />],
  ["Clear testing", "Launches, buys, sells, and wallet prompts run through the live flow so real backend or wallet errors are visible while testing.", <ShieldCheck key="shield" />],
] as const;

export default function HowItWorksPage() {
  return (
    <main className="space-y-6">
      <section className="panel-elevated p-6 md:p-10 space-y-4">
        <div className="text-[10px] uppercase tracking-[0.3em] font-black text-neon">First-time guide</div>
        <h1 className="text-4xl md:text-6xl font-black text-ink">How song-daq works</h1>
        <p className="max-w-3xl text-mute leading-relaxed">
          song-daq is a music market app. Artists create song-linked coins, fans trade them, and royalty activity can later be recorded into the coin ecosystem after admin verification.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/market" className="btn-primary h-11 px-4 text-[10px] uppercase tracking-widest font-black">Explore market</Link>
          <Link href="/artist" className="btn h-11 px-4 text-[10px] uppercase tracking-widest font-black">Launch artist flow</Link>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {steps.map(([title, body, icon]) => (
          <article key={title} className="panel p-5">
            <div className="text-neon">{icon}</div>
            <h2 className="mt-4 text-xl font-black text-ink">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-mute">{body}</p>
          </article>
        ))}
      </section>
      <WhyFansCanBuy />
      <section className="panel p-6 text-sm leading-relaxed text-mute">
        Royalty activity may support a song coin ecosystem, but it does not guarantee price increases, profit, liquidity, copyright ownership, or royalty rights unless verified legal terms say so.
      </section>
    </main>
  );
}
