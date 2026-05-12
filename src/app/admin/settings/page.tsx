import Link from "next/link";
import { appMode, databaseReadiness, ROYALTY_EMAIL, SUPPORT_EMAIL } from "@/lib/appMode";

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
  ["ENABLE_AUTOMATED_ROYALTY_PAYOUTS", false],
  ["ENABLE_TREASURY_AUTOMATION", false],
] as const;

function enabled(name: string, fallback: boolean) {
  const raw = process.env[name] ?? process.env[`NEXT_PUBLIC_${name}`];
  if (raw == null || raw === "") return fallback;
  return !["0", "false", "off", "no"].includes(String(raw).toLowerCase());
}

export default function AdminSettingsPage() {
  const phantomSubmitted = enabled("PHANTOM_REVIEW_SUBMITTED", false);
  const phantomApproved = enabled("PHANTOM_REVIEW_APPROVED", false);
  const legalApproved = enabled("LEGAL_REVIEW_APPROVED", false);
  const auditApproved = enabled("TREASURY_AUTOMATION_AUDIT_APPROVED", false);
  const payoutAutomation = enabled("ENABLE_AUTOMATED_ROYALTY_PAYOUTS", false) && legalApproved && auditApproved;
  const treasuryAutomation = enabled("ENABLE_TREASURY_AUTOMATION", false) && auditApproved;
  const database = databaseReadiness();
  return (
    <main className="space-y-6">
      <section className="panel-elevated p-6 md:p-10 space-y-4">
        <div className="text-[10px] uppercase tracking-[0.3em] font-black text-neon">Admin settings</div>
        <h1 className="text-4xl md:text-6xl font-black text-ink">song-daq control panel</h1>
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
      <section className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-6 space-y-4">
          <h2 className="text-2xl font-black text-ink">Production Database</h2>
          <p className="text-sm text-mute leading-relaxed">
            Render should use a production Postgres URL that it can actually reach. If you are using Supabase, prefer the pooler connection string instead of the direct `db.project.supabase.co:5432` host.
          </p>
          <Readiness label="DATABASE_URL configured" value={database.configured ? "Configured" : "Missing"} ok={database.configured} />
          <Readiness label="Render-ready DB URL" value={database.productionReady ? "Production ready" : "Needs pooler/live URL"} ok={database.productionReady} />
          {database.warning && (
            <div className="rounded-2xl border border-amber/20 bg-amber/10 p-4 text-sm text-amber leading-relaxed">
              {database.warning} {database.recommendation}
            </div>
          )}
        </section>
        <section className="panel p-6 space-y-4">
          <h2 className="text-2xl font-black text-ink">Wallet Trust Readiness</h2>
          <p className="text-sm text-mute leading-relaxed">
            Submit Phantom review only after the live Render/custom domain is deployed and `NEXT_PUBLIC_APP_URL` matches that domain exactly.
          </p>
          <Readiness label="Live app URL" value={process.env.NEXT_PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || "Missing"} ok={Boolean(process.env.NEXT_PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL)} />
          <Readiness label="Phantom review submitted" value={phantomSubmitted ? "Submitted" : "Not submitted"} ok={phantomSubmitted} />
          <Readiness label="Phantom review approved" value={phantomApproved ? "Approved" : "Pending"} ok={phantomApproved} />
          <Readiness label="Jupiter route policy" value="Do not ask wallet to sign until route exists" ok />
          <Link href="/admin/phantom" className="btn-primary h-11 px-4 text-[10px] uppercase tracking-widest font-black">
            Open Phantom review page
          </Link>
          <div className="rounded-2xl border border-edge bg-panel2 p-4 text-sm text-mute leading-relaxed">
            If Phantom still warns after deployment, send Phantom/Blowfish the live URL, a clean token-launch transaction, a liquidity transaction, metadata URL, and support contact.
          </div>
        </section>
        <section className="panel p-6 space-y-4">
          <h2 className="text-2xl font-black text-ink">Automation Locks</h2>
          <p className="text-sm text-mute leading-relaxed">
            Royalty payout, holder rewards, and treasury automation stay manual until legal review and treasury automation audit are both explicitly approved in env vars.
          </p>
          <Readiness label="Legal review" value={legalApproved ? "Approved" : "Required"} ok={legalApproved} />
          <Readiness label="Treasury automation audit" value={auditApproved ? "Approved" : "Required"} ok={auditApproved} />
          <Readiness label="Royalty payout automation" value={payoutAutomation ? "Enabled" : "Manual only"} ok={payoutAutomation} />
          <Readiness label="Treasury automation" value={treasuryAutomation ? "Enabled" : "Manual only"} ok={treasuryAutomation} />
        </section>
        <section className="panel p-6 space-y-4">
          <h2 className="text-2xl font-black text-ink">Admin Review Checklist</h2>
          <p className="text-sm text-mute leading-relaxed">
            Use this before marking an artist or royalty split verified. Verification should be boring, documented, and repeatable.
          </p>
          <Readiness label="Artist identity" value="Audius account, name, handle, and wallet match" ok />
          <Readiness label="Song ownership" value="Track belongs to the signed-in Audius artist" ok />
          <Readiness label="Royalty split invite" value="Distributor invite received at admin@song-daq.com" ok={false} />
          <Readiness label="Coin match" value="Song title, ISRC/UPC, symbol, wallet, and distributor match request" ok={false} />
          <Readiness label="Public label" value="Only then mark Royalty Verified" ok={false} />
        </section>
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

function Readiness({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-edge bg-panel2 px-4 py-3">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest font-black text-mute">{label}</div>
        <div className="mt-1 text-sm font-bold text-ink break-words">{value}</div>
      </div>
      <span className={`chip shrink-0 ${ok ? "text-neon border-neon/20 bg-neon/10" : "text-amber border-amber/20 bg-amber/10"}`}>{ok ? "OK" : "WAIT"}</span>
    </div>
  );
}
