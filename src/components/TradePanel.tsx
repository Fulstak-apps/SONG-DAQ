"use client";
import { useEffect, useMemo, useState } from "react";
import { useSession, useUI } from "@/lib/store";
import { api } from "@/lib/api";
import { fmtSol } from "@/lib/pricing";
import { Glossary } from "@/components/Tooltip";

export function TradePanel({ song, onTraded }: { song: any; onTraded: () => void }) {
  const { address, kind, provider } = useSession();
  const { openLoginModal } = useUI();
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [tokens, setTokens] = useState<string>("100");
  const asset = "SOL";
  const [solIn, setSolIn] = useState<string>("");
  const [maxSlippageBps, setMax] = useState<string>("1500");
  const [quote, setQuote] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    if (!address) { openLoginModal(); setErr("Connect a Solana wallet first"); return; }
    if (!quote) {
      setErr("No live route is available for this order yet. Try a smaller amount or wait until liquidity is active.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/trade`, {
        method: "POST",
        json: {
          songId: song.id,
          side,
          wallet: address,
          walletType: kind,
          maxSlippageBps: Number(maxSlippageBps),
          asset,
          ...(side === "BUY" && solAmt > 0 ? { solIn: solAmt } : { tokens: tokenAmt }),
        },
      });
      onTraded();
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const slippagePct = useMemo(() => quote ? (quote.slippageBps / 100).toFixed(2) : "0.00", [quote]);
  
  const displayTotal = quote ? quote.total : null;
  const displayAvgPrice = quote ? quote.avgPrice : null;
  const walletCanTransact = kind === "solana" && provider !== "audius";
  const swapRouteReady = Boolean(song.swapRouteReady);
  const canExecute = !busy && walletCanTransact && swapRouteReady && Number(tokens || solIn) > 0 && !!quote;

  return (
    <div className="panel p-6 space-y-6 relative overflow-hidden shadow-2xl">
      <div className="absolute top-0 right-0 w-32 h-32 bg-neon/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex p-1 bg-white/[0.055] rounded-xl border border-edge relative z-10">
        <button
          onClick={() => setSide("BUY")}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold tracking-widest uppercase transition-all ${side === "BUY" ? "bg-neon/20 text-neon shadow-[0_0_15px_rgba(0,229,114,0.3)] border border-neon/30" : "text-mute hover:text-ink"}`}
        >BUY</button>
        <button
          onClick={() => setSide("SELL")}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold tracking-widest uppercase transition-all ${side === "SELL" ? "bg-red/20 text-red shadow-[0_0_15px_rgba(255,51,102,0.3)] border border-red/30" : "text-mute hover:text-ink"}`}
        >SELL</button>
      </div>

      <div className="space-y-5 relative z-10">
        <div className="rounded-xl border border-amber/20 bg-amber/5 px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-amber leading-relaxed">
          SONG·DAQ will never ask for a message signature as a fake trade. Wallet approval appears only when a real on-chain swap route is ready. This panel can preview pricing, but execution stays locked until swap routing is live.
        </div>
        
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest font-bold text-mute px-1 flex justify-between">
            <Glossary term="Token amount" def="How many Song Tokens you want to buy or sell. If you are buying and do not know the amount, use the budget field instead.">
              Token Amount
            </Glossary>
            <span className="text-mute font-mono">${song.symbol}</span>
          </label>
          <div className="relative group">
            <input
              type="number"
              value={tokens}
              onChange={(e) => { setTokens(e.target.value); setSolIn(""); }}
              className="w-full bg-panel2 border border-edge rounded-xl px-4 py-3 text-xl font-mono text-ink placeholder-mute focus:border-neon/50 focus:ring-1 focus:ring-neon/50 transition-all outline-none"
              placeholder="0.00"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-widest font-bold text-mute pointer-events-none group-focus-within:text-neon transition">Tokens</div>
          </div>
        </div>

        {side === "BUY" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-edge" />
              <div className="text-[9px] uppercase tracking-widest font-bold text-mute">OR SPECIFY BUDGET</div>
              <div className="h-px flex-1 bg-edge" />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-mute px-1 flex justify-between">
                <Glossary term="Budget" def="The most SOL you want to spend on this buy. The app estimates how many Song Tokens that budget can get.">
                  Budget
                </Glossary>
                <span className="text-mute font-mono">{asset}</span>
              </label>
              <div className="relative group">
                <input
                  type="number"
                  value={solIn}
                  onChange={(e) => { setSolIn(e.target.value); setTokens(""); }}
                  className="w-full bg-panel2 border border-edge rounded-xl px-4 py-3 text-xl font-mono text-ink placeholder-mute focus:border-neon/50 focus:ring-1 focus:ring-neon/50 transition-all outline-none"
                  placeholder="0.000"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-widest font-bold text-mute pointer-events-none group-focus-within:text-neon transition">{asset}</div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest font-bold text-mute px-1 flex justify-between">
            <Glossary term="Price movement allowance" def="How much the price can move while your wallet is confirming. Lower protects you more but can fail if the market moves. Higher is more flexible but can give a slightly worse price.">
              Price Movement Allowance
            </Glossary>
            <span className="text-mute font-mono">{(Number(maxSlippageBps) / 100).toFixed(2)}%</span>
          </label>
          <div className="relative group">
            <input
              type="number"
              value={maxSlippageBps}
              onChange={(e) => setMax(e.target.value)}
              className="w-full bg-panel2 border border-edge rounded-xl px-4 py-2 text-sm font-mono text-ink placeholder-mute focus:border-neon/50 transition-all outline-none"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-mute pointer-events-none group-focus-within:text-neon transition">BPS</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-panel2 p-4 text-[10px] uppercase tracking-widest font-bold space-y-3 border border-edge relative z-10">
        <Row k="Execution Price" v={quote ? `${fmtSol(displayAvgPrice!, 6)} ${asset}` : "—"} />
        <Row k={side === "BUY" ? "Total Expenditure" : "Estimated Proceeds"} v={quote ? `${fmtSol(displayTotal!, 5)} ${asset}` : "—"} color="text-ink" />
        <Row k="Network Fee (0.5%)" v={quote ? `${fmtSol(quote.fee, 5)} SOL` : "—"} />
        <Row k="Settlement Units" v={quote ? `${quote.tokens.toFixed(2)} UNITS` : "—"} />
        <Row k="Price Impact" v={`${slippagePct}%`} color={Number(slippagePct) > 2 ? "text-red" : "text-neon"} />
        <Row k="Spot Price" v={quote ? `${fmtSol(quote.newSpotPrice, 6)} SOL` : "—"} />
        <Row k="Wallet Approval" v="On-chain swap only" color="text-neon" />
      </div>

      <div className="relative z-10 space-y-3">
        <button
          className={`w-full py-4 rounded-xl font-bold tracking-widest text-xs transition-all shadow-2xl disabled:opacity-50 disabled:grayscale ${side === "BUY" ? "btn-primary shadow-[0_0_20px_rgba(0,229,114,0.3)]" : "btn-danger shadow-[0_0_20px_rgba(255,51,102,0.3)]"}`}
          disabled={!canExecute}
          onClick={execute}
        >
          {busy ? "CHECKING ROUTE…" : !address ? "CONNECT SOLANA WALLET" : !walletCanTransact ? "EXTERNAL WALLET REQUIRED" : !swapRouteReady ? "SWAP ROUTE COMING ONLINE" : quote ? `CHECK ${side} ROUTE` : "NO LIVE ROUTE"}
        </button>

        {err && <div className="text-red text-[10px] uppercase tracking-widest font-bold text-center bg-red/10 border border-red/20 py-2 rounded-lg">{err}</div>}
        {!address && <div className="text-mute text-[10px] uppercase tracking-widest font-bold text-center">Authorization required to transact.</div>}
      </div>
    </div>
  );
}

function Row({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-mute">{k}</span>
      <span className={`font-mono text-xs tracking-normal font-bold ${color || "text-ink"}`}>{v}</span>
    </div>
  );
}
