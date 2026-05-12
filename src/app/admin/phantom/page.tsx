import { AlertTriangle, CheckCircle2, FileText, ShieldCheck } from "lucide-react";

function envOn(name: string) {
  return ["1", "true", "yes", "on"].includes(String(process.env[name] || process.env[`NEXT_PUBLIC_${name}`] || "").toLowerCase());
}

export default function AdminPhantomPage() {
  const submitted = envOn("PHANTOM_REVIEW_SUBMITTED");
  const approved = envOn("PHANTOM_REVIEW_APPROVED") || envOn("NEXT_PUBLIC_PHANTOM_REVIEW_APPROVED");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || "https://song-daq.onrender.com";
  const status = approved ? "Approved" : submitted ? "Submitted / waiting" : "Blocked / not submitted";
  return (
    <main className="space-y-6">
      <section className="panel-elevated p-6 md:p-10 space-y-4">
        <div className="text-[10px] uppercase tracking-[0.3em] font-black text-neon">Admin · wallet trust</div>
        <h1 className="text-4xl md:text-6xl font-black text-ink">Phantom review status</h1>
        <p className="max-w-3xl text-mute leading-relaxed">
          Phantom/Blowfish can block a live domain before users ever see the transaction. song-daq pauses live signing until this page shows approved.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Status label="Current status" value={status} ok={approved} warn={submitted && !approved} />
        <Status label="Review submitted" value={submitted ? "Yes" : "No"} ok={submitted} />
        <Status label="Live signing" value={approved ? "Enabled" : "Paused"} ok={approved} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div className="panel p-6 space-y-4">
          <h2 className="text-2xl font-black text-ink flex items-center gap-2"><FileText size={20} /> What to send Phantom</h2>
          <div className="rounded-2xl border border-edge bg-panel2 p-4 text-sm leading-relaxed text-ink/85 space-y-3">
            <p>Email <span className="font-mono text-neon">review@phantom.com</span> with the subject: <span className="font-mono">song-daq dApp review request</span>.</p>
            <ul className="space-y-2">
              <li>Live URL: <span className="font-mono text-ink">{appUrl}</span></li>
              <li>Support contact: <span className="font-mono text-ink">admin@song-daq.com</span></li>
              <li>Short product description: music coin marketplace using Solana wallet signatures only for real launch, liquidity, and swap transactions.</li>
              <li>Clean screenshots/video of wallet connect, token launch preview, liquidity preview, buy/sell preview, and final confirmation screens.</li>
              <li>Example mint transaction, metadata URL, liquidity transaction, and swap transaction after test launch is available.</li>
              <li>Confirmation that song-daq does not request private keys, seed phrases, unlimited approvals, or fake message signatures for trades.</li>
            </ul>
          </div>
        </div>

        <div className="panel p-6 space-y-4">
          <h2 className="text-2xl font-black text-ink flex items-center gap-2"><ShieldCheck size={20} /> Safety checklist</h2>
          <Check ok label="No private keys in frontend" />
          <Check ok label="Live signing blocked until approval" />
          <Check ok label="Wallet prompts only for real transactions" />
          <Check ok label="Metadata URL is stable" />
          <Check ok={approved} label="Phantom review approved" />
          <Check ok={false} label="Custom domain recommended" />
          <div className="rounded-xl border border-amber/20 bg-amber/10 p-3 text-xs leading-relaxed text-amber flex gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            After approval, set both `PHANTOM_REVIEW_APPROVED=true` and `NEXT_PUBLIC_PHANTOM_REVIEW_APPROVED=true` in Render, then redeploy.
          </div>
        </div>
      </section>
    </main>
  );
}

function Status({ label, value, ok, warn = false }: { label: string; value: string; ok: boolean; warn?: boolean }) {
  return (
    <div className="panel p-5">
      <div className="text-[10px] uppercase tracking-widest font-black text-mute">{label}</div>
      <div className={`mt-2 text-xl font-black ${ok ? "text-neon" : warn ? "text-amber" : "text-red"}`}>{value}</div>
    </div>
  );
}

function Check({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-panel2 px-4 py-3">
      <span className="text-sm font-bold text-ink">{label}</span>
      <span className={`chip ${ok ? "text-neon border-neon/20 bg-neon/10" : "text-amber border-amber/20 bg-amber/10"}`}>
        {ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />} {ok ? "OK" : "Needed"}
      </span>
    </div>
  );
}
