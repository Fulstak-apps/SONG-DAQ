import Link from "next/link";
import { Wallet, Music, Droplets, FileCheck2, Rocket } from "lucide-react";

export default function ArtistOnboardingPage() {
  const steps = [
    ["Connect Wallet", "Connect an external Solana wallet. This wallet pays launch fees and owns the launch transaction.", <Wallet key="wallet" />],
    ["Create Song Coin", "Choose a real Audius catalog song, artwork, symbol, supply, launch price, and market terms.", <Music key="music" />],
    ["Add Launch Liquidity", "Launch liquidity is required to make the song coin tradable. It is separate from royalty revenue.", <Droplets key="drop" />],
    ["Royalty Setup", "Optionally add admin@song-daq.com as a distributor split recipient and submit a request for verification.", <FileCheck2 key="file" />],
    ["Review + Launch", "Review crypto plus fiat values, wallet address, liquidity, risk notes, and final wallet approval.", <Rocket key="rocket" />],
  ];

  return (
    <main className="space-y-6">
      <section className="panel-elevated p-6 md:p-10 space-y-4">
        <div className="text-[10px] uppercase tracking-[0.3em] font-black text-neon">Artist onboarding</div>
        <h1 className="text-4xl md:text-6xl font-black text-ink">Launch a song coin on song-daq</h1>
        <p className="max-w-3xl text-mute leading-relaxed">
          This walkthrough separates the two money systems: launch liquidity gets the coin live, and royalty activity can support the coin after launch once distributor splits are verified.
        </p>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {steps.map(([title, body, icon], i) => (
          <article key={String(title)} className="panel p-5 space-y-3">
            <div className="w-10 h-10 rounded-2xl border border-edge bg-panel2 grid place-items-center text-neon">{icon}</div>
            <div className="text-[10px] uppercase tracking-widest font-black text-mute">Step {i + 1}</div>
            <h2 className="text-xl font-black text-ink">{title}</h2>
            <p className="text-sm text-mute leading-relaxed">{body}</p>
          </article>
        ))}
      </section>
      <Link href="/artist" className="btn-primary inline-flex h-12 px-6 text-[11px] uppercase tracking-widest font-black">
        Open launch tools
      </Link>
    </main>
  );
}
