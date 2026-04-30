"use client";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/store";
import { api } from "@/lib/api";
import { signMessage } from "@/lib/wallet";
import { fmtSol } from "@/lib/pricing";
import { Glossary } from "@/components/Tooltip";

export function TradePanel({ song, onTraded }: { song: any; onTraded: () => void }) {
  const { address, kind, provider } = useSession();
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [tokens, setTokens] = useState<string>("100");
  const [asset, setAsset] = useState<"SOL" | "AUDIO">("SOL");
  const [solIn, setSolIn] = useState<string>("");
  const [maxSlippageBps, setMax] = useState<string>("1500");
  const [quote, setQuote] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const tokenAmt = Number(tokens) || 0;
  const solAmt = Number(solIn) || 0;

  useEffect(() => {
    let alive = true;
    setErr(null);
    if (!song) return;
    if (side === "BUY" && !tokenAmt && !solAmt) { setQuote(null); return; }
    if (side === "SELL" && !tokenAmt) { setQuote(null); return; }
    const qs = new URLSearchParams({ songId: song.id, side, asset });
    if (side === "BUY" && solAmt > 0) qs.set("solIn", String(solAmt));
    else if (tokenAmt > 0) qs.set("tokens", String(tokenAmt));
    api<any>(`/api/trade?${qs.toString()}`)
      .then((d) => { if (alive) setQuote(d.quote); })
      .catch((e) => { if (alive) { setErr(e.message); setQuote(null); } });
    return () => { alive = false; };
  }, [song?.id, side, tokens, solIn, asset, song?.circulating, song?.performance]);

  async function execute() {
    if (!address) { setErr("Connect a wallet first"); return; }
    setBusy(true); setErr(null); setOk(null);
    try {
      let sig = "audius-internal-auth";
      
      // Only require external wallet signature if settling in native SOL
      if (asset === "SOL") {
        const msg = `SONG-DAQ\n\nConfirm ${side} of ${(quote?.tokens ?? tokenAmt).toFixed(2)} ${song.symbol}`;
        sig = await signMessage(provider as any, msg, address);
      }
      
      const json: Record<string, unknown> = {
        songId: song.id,
        side,
        wallet: address,
        walletType: kind,
        maxSlippageBps: Number(maxSlippageBps),
        txSig: sig,
        asset,
      };
      if (side === "BUY" && solAmt > 0) json.solIn = solAmt;
      else json.tokens = tokenAmt;
      await api(`/api/trade`, { method: "POST", json });
      setOk(`${side === "BUY" ? "Bought" : "Sold"} ${(quote?.tokens ?? tokenAmt).toFixed(2)} ${song.symbol}`);
      onTraded();
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const slippagePct = useMemo(() => quote ? (quote.slippageBps / 100).toFixed(2) : "0.00", [quote]);
  
  const displayTotal = quote ? (asset === "AUDIO" ? quote.total / 0.002 : quote.total) : null;
  const displayAvgPrice = quote ? (asset === "AUDIO" ? quote.avgPrice / 0.002 : quote.avgPrice) : null;

  return (
    <div className="panel p-6 space-y-6 relative overflow-hidden shadow-2xl">
      <div className="absolute top-0 right-0 w-32 h-32 bg-neon/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex p-1 bg-black/40 rounded-xl border border-white/5 relative z-10">
        <button
          onClick={() => setSide("BUY")}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold tracking-widest uppercase transition-all ${side === "BUY" ? "bg-neon/20 text-neon shadow-[0_0_15px_rgba(0,229,114,0.3)] border border-neon/30" : "text-white/40 hover:text-white"}`}
        >BUY</button>
        <button
          onClick={() => setSide("SELL")}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold tracking-widest uppercase transition-all ${side === "SELL" ? "bg-red/20 text-red shadow-[0_0_15px_rgba(255,51,102,0.3)] border border-red/30" : "text-white/40 hover:text-white"}`}
        >SELL</button>
      </div>

      <div className="space-y-5 relative z-10">
        {side === "BUY" && (
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">Settle Asset</span>
            <div className="flex gap-2">
              {["SOL", "AUDIO"].map((a) => (
                <button
                  key={a}
                  onClick={() => setAsset(a as any)}
                  className={`px-3 py-1 rounded border text-[10px] font-mono font-bold transition-all ${asset === a ? "bg-white/10 border-white/20 text-white" : "border-white/5 text-white/30 hover:text-white/50"}`}
                >{a}</button>
              ))}
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 px-1 flex justify-between">
            <span>Lot Size</span>
            <span className="text-white/20 font-mono">${song.symbol}</span>
          </label>
          <div className="relative group">
            <input
              type="number"
              value={tokens}
              onChange={(e) => { setTokens(e.target.value); setSolIn(""); }}
              className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-xl font-mono text-white placeholder-white/20 focus:border-neon/50 focus:ring-1 focus:ring-neon/50 transition-all outline-none"
              placeholder="0.00"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-widest font-bold text-white/20 pointer-events-none group-focus-within:text-neon transition">Tokens</div>
          </div>
        </div>

        {side === "BUY" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-white/5" />
              <div className="text-[9px] uppercase tracking-widest font-bold text-white/20">OR SPECIFY BUDGET</div>
              <div className="h-px flex-1 bg-white/5" />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 px-1 flex justify-between">
                <span>Maximum Outlay</span>
                <span className="text-white/20 font-mono">{asset}</span>
              </label>
              <div className="relative group">
                <input
                  type="number"
                  value={solIn}
                  onChange={(e) => { setSolIn(e.target.value); setTokens(""); }}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-xl font-mono text-white placeholder-white/20 focus:border-neon/50 focus:ring-1 focus:ring-neon/50 transition-all outline-none"
                  placeholder="0.000"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-widest font-bold text-white/20 pointer-events-none group-focus-within:text-neon transition">{asset}</div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 px-1 flex justify-between">
            <span>Slippage Tolerance</span>
            <span className="text-white/20 font-mono">Basis Points</span>
          </label>
          <div className="relative group">
            <input
              type="number"
              value={maxSlippageBps}
              onChange={(e) => setMax(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2 text-sm font-mono text-white placeholder-white/20 focus:border-neon/50 transition-all outline-none"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/20 pointer-events-none group-focus-within:text-neon transition">BPS</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-black/40 p-4 text-[10px] uppercase tracking-widest font-bold space-y-3 border border-white/5 relative z-10">
        <Row k="Execution Price" v={quote ? `${fmtSol(displayAvgPrice!, 6)} ${asset}` : "—"} />
        <Row k={side === "BUY" ? "Total Expenditure" : "Estimated Proceeds"} v={quote ? `${fmtSol(displayTotal!, 5)} ${asset}` : "—"} color="text-white" />
        <Row k="Network Fee (0.5%)" v={quote ? `${fmtSol(quote.fee, 5)} SOL` : "—"} />
        <Row k="Settlement Units" v={quote ? `${quote.tokens.toFixed(2)} UNITS` : "—"} />
        <Row k="Price Impact" v={`${slippagePct}%`} color={Number(slippagePct) > 2 ? "text-red" : "text-neon"} />
        <Row k="Terminal Spot" v={quote ? `${fmtSol(quote.newSpotPrice, 6)} SOL` : "—"} />
      </div>

      <div className="relative z-10 space-y-3">
        <button
          className={`w-full py-4 rounded-xl font-bold tracking-widest text-xs transition-all shadow-2xl disabled:opacity-50 disabled:grayscale ${side === "BUY" ? "btn-primary shadow-[0_0_20px_rgba(0,229,114,0.3)]" : "btn-danger shadow-[0_0_20px_rgba(255,51,102,0.3)]"}`}
          disabled={busy || !quote}
          onClick={execute}
        >
          {busy ? "COMMITTING TRANSACTION…" : `EXECUTE ${side} ORDER`}
        </button>

        {err && <div className="text-red text-[10px] uppercase tracking-widest font-bold text-center bg-red/10 border border-red/20 py-2 rounded-lg">{err}</div>}
        {ok && <div className="text-neon text-[10px] uppercase tracking-widest font-bold text-center bg-neon/10 border border-neon/20 py-2 rounded-lg">{ok}</div>}
        {!address && <div className="text-white/30 text-[10px] uppercase tracking-widest font-bold text-center">Authorization required to transact.</div>}
      </div>
    </div>
  );
}

function Row({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/40">{k}</span>
      <span className={`font-mono text-xs tracking-normal ${color || "text-white/80"}`}>{v}</span>
    </div>
  );
}
