"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Copy, ExternalLink } from "lucide-react";

const ROYALTY_EMAIL = "admin@song-daq.com";

const DISTRIBUTORS = [
  ["UnitedMasters", "https://unitedmasters.com"],
  ["CD Baby", "https://members.cdbaby.com"],
  ["Roc Nation Distribution", "https://www.rocnation.com/distribution"],
  ["DistroKid", "https://distrokid.com"],
  ["TuneCore", "https://www.tunecore.com"],
  ["EMPIRE", "https://www.empi.re"],
  ["Stem", "https://stem.is"],
  ["Symphonic", "https://symphonic.com"],
  ["Ditto Music", "https://dittomusic.com"],
  ["Too Lost", "https://toolost.com"],
  ["Amuse", "https://www.amuse.io"],
  ["ONErpm", "https://onerpm.com"],
  ["Venice Music", "https://www.venicemusic.co"],
  ["Create Music Group", "https://createmusicgroup.com"],
];

export default function SplitsPage() {
  const [searchParams, setSearchParams] = useState(() => new URLSearchParams());
  const [selected, setSelected] = useState("UnitedMasters");
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [otherName, setOtherName] = useState("");
  const [otherUrl, setOtherUrl] = useState("");
  const distributorUrl = useMemo(() => {
    if (selected === "Other") return otherUrl || "https://www.google.com/search?q=music+distributor+royalty+splits";
    return DISTRIBUTORS.find(([name]) => name === selected)?.[1] ?? "#";
  }, [selected, otherUrl]);

  useEffect(() => {
    setSearchParams(new URLSearchParams(window.location.search));
  }, []);

  const copy = () => {
    navigator.clipboard.writeText(ROYALTY_EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 py-8">
      <Link href="/market" className="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest font-black text-mute hover:text-neon">
        <ArrowLeft size={14} /> Back to market
      </Link>

      <section className="panel-elevated p-6 md:p-10 space-y-5">
        <div className="text-[11px] uppercase tracking-[0.3em] font-black text-neon">Royalty Split Setup</div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-ink">Send the split from your distributor.</h1>
        <p className="max-w-4xl text-base text-mute leading-relaxed">
          Do not send a personal email. Open your distributor dashboard, go to splits or royalty sharing, and add <span className="font-mono text-neon">{ROYALTY_EMAIL}</span> as the royalty split recipient. Then return here and submit the verification form.
        </p>
        {searchParams.get("symbol") || searchParams.get("title") ? (
          <div className="rounded-2xl border border-edge bg-panel p-4">
            <div className="text-[11px] uppercase tracking-widest font-black text-mute">Selected coin</div>
            <div className="mt-1 text-lg font-black text-white break-words">
              {searchParams.get("symbol") ? `$${searchParams.get("symbol")}` : "Song coin"}
              {searchParams.get("title") ? <span className="text-mute"> · {searchParams.get("title")}</span> : null}
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-3 rounded-2xl border border-neon/20 bg-neon/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest font-black text-neon">Split recipient</div>
            <div className="mt-1 font-mono text-lg font-black text-ink break-all">{ROYALTY_EMAIL}</div>
          </div>
          <button onClick={copy} className="btn h-11 px-4 text-[11px] uppercase tracking-widest font-black">
            {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[...DISTRIBUTORS, ["Other", otherUrl || "#"]].map(([name, url]) => (
          <article key={name} className={`panel p-5 space-y-4 transition ${selected === name ? "border-neon/35 bg-neon/8" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-ink break-words">{name}</h2>
                <p className="mt-2 text-sm text-mute leading-relaxed">Open your distributor dashboard and find splits / royalty sharing.</p>
              </div>
              {selected === name ? <CheckCircle2 className="shrink-0 text-neon" size={18} /> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setSelected(name)} className="btn h-10 px-3 text-[11px] uppercase tracking-widest font-black">Select</button>
              <a href={url} target="_blank" rel="noreferrer" className="btn-primary h-10 px-3 text-[11px] uppercase tracking-widest font-black">
                Open Distributor <ExternalLink size={13} />
              </a>
            </div>
          </article>
        ))}
      </section>

      {selected === "Other" ? (
        <section className="panel p-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-[11px] uppercase tracking-widest font-black text-mute">Distributor name</span>
            <input value={otherName} onChange={(e) => setOtherName(e.target.value)} className="w-full rounded-xl border border-edge bg-panel px-4 py-3 text-ink outline-none focus:border-neon/40" />
          </label>
          <label className="space-y-2">
            <span className="text-[11px] uppercase tracking-widest font-black text-mute">Distributor website</span>
            <input value={otherUrl} onChange={(e) => setOtherUrl(e.target.value)} placeholder="https://" className="w-full rounded-xl border border-edge bg-panel px-4 py-3 text-ink outline-none focus:border-neon/40" />
          </label>
        </section>
      ) : null}

      <section className="panel p-6 md:p-8 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest font-black text-mute">Step 2</div>
            <h2 className="text-2xl font-black text-ink">After you send the distributor invitation</h2>
            <p className="mt-2 text-sm text-mute">Click below once the invitation was sent from inside your distributor. Then submit the verification form so admin can link it to the created coin.</p>
          </div>
          <button onClick={() => setSent(true)} className="btn-primary h-11 px-4 text-[11px] uppercase tracking-widest font-black">
            I sent the split invitation
          </button>
        </div>

        {sent ? (
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setSubmitError(null);
              const form = new FormData(e.currentTarget);
              const payload = {
                action: "submit_request",
                coinId: searchParams.get("coinId") || undefined,
                artistName: form.get("artistName"),
                legalName: form.get("legalName"),
                email: form.get("email"),
                walletAddress: form.get("walletAddress"),
                songTitle: form.get("songTitle"),
                coinToken: form.get("coinToken"),
                distributor: selected === "Other" ? otherName : selected,
                royaltyPercentageAssigned: form.get("royaltyPercentageAssigned"),
                dateSplitInvitationSent: form.get("dateSplitInvitationSent"),
                isrc: form.get("isrc"),
                upc: form.get("upc"),
                notes: form.get("notes"),
                distributorPortalUsed: distributorUrl,
              };
              const res = await fetch("/api/royalty", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload),
              }).catch(() => null);
              if (res?.ok) {
                setSubmitted(true);
                return;
              }
              const err = await res?.json().catch(() => ({}));
              setSubmitError(err?.error || "Request could not be saved right now. Check database connection and try again.");
            }}
          >
            {[
              ["Artist Name", "artistName"],
              ["Legal Name", "legalName"],
              ["Email", "email"],
              ["Wallet Address", "walletAddress"],
              ["Song Title", "songTitle"],
              ["Coin Symbol", "coinToken"],
              ["Royalty Percentage Assigned", "royaltyPercentageAssigned"],
              ["Date Split Invitation Was Sent", "dateSplitInvitationSent"],
              ["ISRC", "isrc"],
              ["UPC", "upc"],
            ].map(([field, name]) => (
              <label key={field} className="space-y-2">
                <span className="text-[11px] uppercase tracking-widest font-black text-mute">{field}</span>
                <input
                  name={name}
                  required={field !== "ISRC" && field !== "UPC"}
                  defaultValue={
                    name === "artistName" ? searchParams.get("artist") || "" :
                    name === "walletAddress" ? searchParams.get("wallet") || "" :
                    name === "songTitle" ? searchParams.get("title") || "" :
                    name === "coinToken" ? searchParams.get("symbol") || "" :
                    ""
                  }
                  className="w-full rounded-xl border border-edge bg-panel px-4 py-3 text-ink outline-none focus:border-neon/40"
                />
              </label>
            ))}
            <label className="space-y-2 md:col-span-2">
              <span className="text-[11px] uppercase tracking-widest font-black text-mute">Distributor</span>
              <input value={selected === "Other" ? otherName : selected} readOnly className="w-full rounded-xl border border-edge bg-panel px-4 py-3 text-ink outline-none" />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-[11px] uppercase tracking-widest font-black text-mute">Notes / proof link</span>
              <textarea name="notes" className="min-h-28 w-full rounded-xl border border-edge bg-panel px-4 py-3 text-ink outline-none focus:border-neon/40" />
            </label>
            <button className="btn-primary h-12 px-5 text-[11px] uppercase tracking-widest font-black md:col-span-2">
              Submit Royalty Verification Request
            </button>
          </form>
        ) : null}

        {submitted ? (
          <div className="rounded-2xl border border-neon/25 bg-neon/10 p-4 text-sm font-bold text-neon">
            Your royalty setup request has been submitted. Your coin should show Royalty Verification In Progress after admin links it to the created coin.
          </div>
        ) : null}
        {submitError ? (
          <div className="rounded-2xl border border-red/25 bg-red/10 p-4 text-sm font-bold text-red">
            {submitError}
          </div>
        ) : null}
      </section>
    </main>
  );
}
