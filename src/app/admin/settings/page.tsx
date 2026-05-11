import { appMode, ROYALTY_EMAIL, SUPPORT_EMAIL } from "@/lib/appMode";

const flags = [
  ["ENABLE_ROYALTY_REQUESTS", true],
  ["ENABLE_ADMIN_DASHBOARD", true],
  ["ENABLE_MANUAL_ROYALTY_RECORDING", true],
  ["ENABLE_ROYALTY_ENGINE", true],
  ["ENABLE_ROYALTY_POOL_CONTRIBUTIONS", true],
  ["ENABLE_PAPER_MODE", true],
  ["ENABLE_AUTOMATED_BUYBACKS", false],
  ["ENABLE_AUTOMATED_LIQUIDITY", false],
  ["ENABLE_HOLDER_REWARDS", false],
  ["ENABLE_CLAIMABLE_REWARDS", false],
] as const;

function enabled(name: string, fallback: boolean) {
  const raw = process.env[name] ?? process.env[`NEXT_PUBLIC_${name}`];
  if (raw == null || raw === "") return fallback;
  return !["0", "false", "off", "no"].includes(String(raw).toLowerCase());
}

export default function AdminSettingsPage() {
  return (
    <main className="space-y-6">
      <section className="panel-elevated p-6 md:p-10 space-y-4">
        <div className="text-[10px] uppercase tracking-[0.3em] font-black text-neon">Admin settings</div>
        <h1 className="text-4xl md:text-6xl font-black text-ink">SONG·DAQ control panel</h1>
        <p className="max-w-3xl text-mute leading-relaxed">
          Settings are server-driven for the MVP. Update env vars in Render, then redeploy. Live treasury execution should stay manual until automated treasury flows are audited.
        </p>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Setting label="App mode" value={appMode()} />
        <Setting label="Royalty setup email" value={ROYALTY_EMAIL} />
        <Setting label="Support email" value={SUPPORT_EMAIL} />
        <Setting label="Royalty grace period" value={`${process.env.ROYALTY_GRACE_PERIOD_DAYS || 10} days`} />
        <Setting label="Maximum slippage" value={`${process.env.MAXIMUM_SLIPPAGE_BPS || 300} bps`} />
        <Setting label="Paper default balance" value={`${process.env.PAPER_DEFAULT_SOL || 100} paper SOL / $${process.env.PAPER_DEFAULT_USD || 10000}`} />
      </section>
      <section className="panel p-6 space-y-4">
        <h2 className="text-2xl font-black text-ink">Feature flags</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {flags.map(([name, fallback]) => {
            const on = enabled(name, fallback);
            return (
              <div key={name} className="flex items-center justify-between gap-3 rounded-2xl border border-edge bg-panel2 px-4 py-3">
                <span className="font-mono text-xs text-mute">{name}</span>
                <span className={`chip ${on ? "text-neon border-neon/20 bg-neon/10" : "text-amber border-amber/20 bg-amber/10"}`}>{on ? "ON" : "OFF"}</span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-5">
      <div className="text-[10px] uppercase tracking-widest font-black text-mute">{label}</div>
      <div className="mt-2 text-lg font-black text-ink break-words">{value}</div>
    </div>
  );
}
