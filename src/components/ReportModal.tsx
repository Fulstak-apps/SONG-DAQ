"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useSession } from "@/lib/store";
import { toast } from "@/lib/toast";

const REASONS = [
  ["IMPERSONATION", "Impersonation"],
  ["STOLEN_SONG", "Stolen song"],
  ["FAKE_ROYALTY", "Fake royalty claim"],
  ["SCAM", "Scam coin"],
  ["OFFENSIVE", "Offensive content"],
  ["MARKET_MANIPULATION", "Market manipulation"],
  ["WRONG_METADATA", "Wrong metadata"],
];

export function ReportModal({ mint, songId, onClose }: { mint?: string; songId?: string; onClose: () => void }) {
  const { address } = useSession();
  const [reason, setReason] = useState("IMPERSONATION");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const r = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: address, mint, songId, reason, description, email }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Report failed");
      toast.success("Report submitted", "The moderation queue will review this coin.");
      onClose();
    } catch (e: any) {
      toast.error("Report failed", e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid items-start justify-items-center overflow-y-auto bg-pure-black/65 backdrop-blur-xl p-2 sm:place-items-center sm:p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="w-full sm:w-[520px] max-w-full max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-2xl sm:rounded-3xl border border-edge bg-panel p-4 sm:p-5 text-ink shadow-depth" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-edge pb-4">
          <div>
            <div className="text-[11px] uppercase tracking-widest font-black text-red">Report / Takedown</div>
            <div className="mt-1 text-xl font-black">Flag suspicious coin</div>
          </div>
          <button className="btn h-9 w-9 p-0" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="label">Reason</span>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-2 w-full rounded-xl border border-edge bg-panel2 px-4 py-3 text-sm text-ink">
              {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-edge bg-panel2 px-4 py-3 text-sm text-ink" placeholder="Tell the review team what looks wrong." />
          </label>
          <label className="block">
            <span className="label">Email optional</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-edge bg-panel2 px-4 py-3 text-sm text-ink" placeholder="you@example.com" />
          </label>
          <button disabled={busy} onClick={submit} className="btn-primary h-11 w-full text-[11px] uppercase tracking-widest font-black disabled:opacity-50">Submit Report</button>
        </div>
      </motion.div>
    </div>
  );
}
