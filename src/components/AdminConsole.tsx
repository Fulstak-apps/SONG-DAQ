"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSession } from "@/lib/store";
import { safeJson } from "@/lib/safeJson";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeInfo,
  BellRing,
  CheckCircle2,
  Clock3,
  Lock,
  Megaphone,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  UserCheck,
  Users,
  Waves,
} from "lucide-react";

type Dashboard = {
  summary: Record<string, number>;
  reports: any[];
  launches: any[];
  users: any[];
  recentTrades: any[];
  recentCoinTrades: any[];
  events: any[];
  topRisk: any[];
  royaltyRequests: any[];
  royaltyPayments: any[];
  royaltyContributions: any[];
  transactions: any[];
  errorLogs: any[];
  adminLogs: any[];
  system: Record<string, any>;
};

type ActionPayload = {
  entity: "report" | "song" | "user";
  id: string;
  action: string;
  note?: string;
};

export function AdminConsole() {
  const { address } = useSession();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<"unknown" | "locked" | "open">("unknown");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setErr(null);
    try {
      const endpoint = address ? `/api/admin/dashboard?wallet=${encodeURIComponent(address)}` : "/api/admin/dashboard";
      const r = await fetch(endpoint, { cache: "no-store" });
      const j: any = await safeJson(r);
      if (r.status === 401 || r.status === 403) {
        setAccess("locked");
        setData(null);
        return;
      }
      if (!r.ok) throw new Error(j.error || "Failed to load admin dashboard");
      setAccess("open");
      setData(j as Dashboard);
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const act = async (payload: ActionPayload) => {
    if (!address) return;
    setBusy(`${payload.entity}:${payload.id}:${payload.action}`);
    setErr(null);
    try {
      const r = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: address, ...payload }),
      });
      const j: any = await safeJson(r);
      if (!r.ok) throw new Error(j.error || "Action failed");
      await refresh();
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/session", { method: "DELETE" }).catch(() => {});
    window.location.href = "/admin/login";
  };

  const stats = data?.summary ?? {};
  const system = data?.system ?? {};
  const databaseConnected = Boolean(system.databaseConnected);
  const databaseValue = databaseConnected ? "Connected" : system.databaseConfigured ? "Offline" : "Needs URL";

  const openReports = (data?.reports ?? []).filter((r) => r.status === "OPEN").length;
  const launchQueue = useMemo(
    () => (data?.launches ?? []).filter((s) => s.status !== "LIVE"),
    [data?.launches],
  );
  const verifiedArtists = (data?.users ?? []).filter((u) => u.role === "ARTIST").length;

  if (access === "locked") {
    return (
      <section className="panel mx-auto max-w-2xl p-10 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-panel2 border border-edge grid place-items-center mx-auto text-mute">
          <Lock size={22} />
        </div>
        <div className="text-[10px] uppercase tracking-[0.28em] font-black text-mute">Restricted</div>
        <h1 className="text-2xl font-black text-ink">Page Not Available</h1>
        <p className="text-sm text-mute max-w-lg mx-auto">
          This area is only available to configured admin wallets or password-authenticated admin sessions.
          Log in at <span className="font-mono text-ink">/admin/login</span> or connect an admin wallet.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Link href="/market" className="btn h-10 px-4 text-[10px] uppercase tracking-widest font-black">
            Back to Market
          </Link>
          <button onClick={refresh} className="btn h-10 px-4 text-[10px] uppercase tracking-widest font-black">
            <RefreshCcw size={12} /> Check Access
          </button>
        </div>
      </section>
    );
  }

  return (
    <main className="space-y-5">
      <header className="panel p-6 md:p-7 flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-[0.28em] font-black text-red">Admin Backend</div>
            <h1 className="text-3xl md:text-4xl font-black text-ink">Moderation, Launch Control, and Split Ops</h1>
            <p className="text-sm text-mute max-w-3xl leading-relaxed">
              Use this console to review abuse, resolve launch issues, lock or verify splits, and keep the market healthy without leaving the app.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={refresh} className="btn h-10 px-4 text-[10px] uppercase tracking-widest font-black">
              <RefreshCcw size={12} /> Refresh
            </button>
            <Link href="/admin/reports" className="btn h-10 px-4 text-[10px] uppercase tracking-widest font-black">
              Legacy Queue <ArrowUpRight size={12} />
            </Link>
            <Link href="/admin/settings" className="btn h-10 px-4 text-[10px] uppercase tracking-widest font-black">
              Settings <ArrowUpRight size={12} />
            </Link>
            <button onClick={logout} className="btn h-10 px-4 text-[10px] uppercase tracking-widest font-black text-red border-red/20">
              Logout
            </button>
          </div>
        </div>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AdminStat label="Open Reports" value={stats.openReports ?? openReports} icon={<AlertTriangle size={16} />} tone="red" />
          <AdminStat label="Live Tokens" value={stats.liveTokens ?? 0} icon={<CheckCircle2 size={16} />} tone="neon" />
          <AdminStat label="Pending Liquidity" value={stats.pendingLiquidity ?? 0} icon={<Clock3 size={16} />} tone="amber" />
          <AdminStat label="Verified Artists" value={stats.artists ?? verifiedArtists} icon={<UserCheck size={16} />} tone="violet" />
          <AdminStat label="Royalty Requests" value={stats.pendingRoyaltyRequests ?? 0} icon={<Lock size={16} />} tone="amber" />
          <AdminStat label="Royalties Received" value={`$${Number(stats.royaltiesReceivedUsd ?? 0).toLocaleString()}`} icon={<Waves size={16} />} tone="neon" />
          <AdminStat label="Pool Added" value={`$${Number(stats.royaltyPoolContributionsUsd ?? 0).toLocaleString()}`} icon={<ShieldCheck size={16} />} tone="violet" />
          <AdminStat label="Unresolved Errors" value={stats.unresolvedErrors ?? 0} icon={<TriangleAlert size={16} />} tone="red" />
        </section>
      </header>

      {err && (
        <div className="panel p-4 border-red/25 bg-red/10 text-red text-xs uppercase tracking-widest font-bold">
          {err}
        </div>
      )}
      {loading && <div className="panel p-8 text-center text-mute uppercase tracking-widest font-bold text-xs">Loading admin data…</div>}

      {!loading && data && (
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-5">
            <Panel title="Reports Queue" icon={<ShieldAlert size={16} />} meta={`${openReports} open · ${stats.reviewedReports ?? 0} reviewed`}>
              <div className="grid gap-3">
                {(data.reports ?? []).slice(0, 10).map((r) => (
                  <article key={r.id} className="rounded-2xl border border-edge bg-panel2 p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-ink">{r.reason}</div>
                        <div className="text-[10px] uppercase tracking-widest font-bold text-mute mt-1">
                          {r.song?.symbol || r.mint || "No asset"} · {r.reporter?.wallet ? short(r.reporter.wallet) : "Anonymous"}
                        </div>
                      </div>
                      <StatusPill value={r.status} />
                    </div>
                    {r.description && <p className="text-sm text-ink/80 leading-relaxed">{r.description}</p>}
                    <div className="flex flex-wrap gap-2">
                      <ActionButton
                        onClick={() => act({ entity: "report", id: r.id, action: "REPORT_REVIEWED" })}
                        busy={busy === `report:${r.id}:REPORT_REVIEWED`}
                        label="Mark Reviewed"
                      />
                      <ActionButton
                        onClick={() => act({ entity: "report", id: r.id, action: "REPORT_ACTIONED" })}
                        busy={busy === `report:${r.id}:REPORT_ACTIONED`}
                        label="Action Taken"
                      />
                      <ActionButton
                        onClick={() => act({ entity: "report", id: r.id, action: "REPORT_OPEN" })}
                        busy={busy === `report:${r.id}:REPORT_OPEN`}
                        label="Reopen"
                      />
                    </div>
                  </article>
                ))}
                {!data.reports?.length && <EmptyState text="No reports in queue." />}
              </div>
            </Panel>

            <Panel title="Launch Queue" icon={<Megaphone size={16} />} meta={`${launchQueue.length} pending or restricted`}>
              <div className="grid gap-3">
                {launchQueue.slice(0, 10).map((song) => (
                  <article key={song.id} className="rounded-2xl border border-edge bg-panel2 p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-black text-ink truncate">{song.title}</div>
                        <div className="text-[10px] uppercase tracking-widest font-bold text-mute mt-1 truncate">
                          ${song.symbol} · {song.artistName} · {short(song.artistWallet?.wallet || "")}
                        </div>
                      </div>
                      <StatusPill value={song.status} />
                    </div>
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4 text-xs">
                      <MiniMetric k="Royalty" v={song.royaltyStatus} />
                      <MiniMetric k="Liquidity" v={`${Math.round(song.liquidityHealth ?? 0)} / 100`} />
                      <MiniMetric k="Reports" v={String(song._count?.reports ?? song.reportCount ?? 0)} />
                      <MiniMetric k="Trades" v={String(song._count?.trades ?? 0)} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ActionButton onClick={() => act({ entity: "song", id: song.id, action: "SONG_LIVE" })} busy={busy === `song:${song.id}:SONG_LIVE`} label="Mark Live" />
                      <ActionButton onClick={() => act({ entity: "song", id: song.id, action: "SONG_MARK_PENDING" })} busy={busy === `song:${song.id}:SONG_MARK_PENDING`} label="Pending Liquidity" />
                      <ActionButton onClick={() => act({ entity: "song", id: song.id, action: "SONG_LOCK_SPLITS" })} busy={busy === `song:${song.id}:SONG_LOCK_SPLITS`} label="Lock Splits" />
                      <ActionButton onClick={() => act({ entity: "song", id: song.id, action: "SONG_VERIFY_ROYALTY" })} busy={busy === `song:${song.id}:SONG_VERIFY_ROYALTY`} label="Verify Royalty" />
                      <ActionButton onClick={() => act({ entity: "song", id: song.id, action: "SONG_RESTRICT" })} busy={busy === `song:${song.id}:SONG_RESTRICT`} label="Restrict" danger />
                      <ActionButton onClick={() => act({ entity: "song", id: song.id, action: "SONG_DELIST" })} busy={busy === `song:${song.id}:SONG_DELIST`} label="Delist" danger />
                    </div>
                  </article>
                ))}
                {!launchQueue.length && <EmptyState text="No launch queue items right now." />}
              </div>
            </Panel>

            <Panel title="Trading Audit" icon={<Waves size={16} />} meta="Recent market activity and wallet flow">
              <div className="grid gap-3">
                {[...(data.recentTrades ?? []).map((t) => ({
                  id: `trad-${t.id}`,
                  kind: "TRD",
                  label: `${t.side} ${t.song?.symbol}`,
                  meta: `${short(t.user?.wallet || "")} · ${Number(t.amount).toLocaleString()} · ${Number(t.total).toFixed(4)} SOL`,
                  ts: t.createdAt,
                  href: `/coin/${t.songId}`,
                })), ...(data.recentCoinTrades ?? []).map((t) => ({
                  id: `coin-${t.id}`,
                  kind: "CTD",
                  label: `${t.side} ${t.ticker}`,
                  meta: `${short(t.user?.wallet || "")} · ${Number(t.amount).toLocaleString()} · $${Number(t.totalUsd).toFixed(2)}`,
                  ts: t.createdAt,
                  href: `/coin/${t.mint}`,
                }))].sort((a, b) => +new Date(b.ts) - +new Date(a.ts)).slice(0, 12).map((item) => (
                  <article key={item.id} className="rounded-2xl border border-edge bg-panel2 p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-ink truncate">{item.label}</div>
                      <div className="text-[10px] uppercase tracking-widest font-bold text-mute mt-1 truncate">{item.meta}</div>
                    </div>
                    <Link href={item.href} className="btn h-9 px-3 text-[10px] uppercase tracking-widest font-black shrink-0">
                      Open
                    </Link>
                  </article>
                ))}
              </div>
            </Panel>

            <Panel title="Royalty Requests" icon={<Lock size={16} />} meta={`${data.royaltyRequests?.length ?? 0} recent requests`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-widest text-mute">
                    <tr>
                      <th className="py-2 pr-3">Artist</th>
                      <th className="py-2 pr-3">Song</th>
                      <th className="py-2 pr-3">Coin</th>
                      <th className="py-2 pr-3">Distributor</th>
                      <th className="py-2 pr-3">Split</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.royaltyRequests ?? []).slice(0, 12).map((r) => (
                      <tr key={r.id} className="border-t border-edge/70">
                        <td className="py-3 pr-3 font-bold text-ink">{r.artistName}</td>
                        <td className="py-3 pr-3 text-mute max-w-[180px] truncate">{r.songTitle}</td>
                        <td className="py-3 pr-3 font-mono text-mute">{r.coinToken || short(r.coinId || "")}</td>
                        <td className="py-3 pr-3 text-mute">{r.distributor || "—"}</td>
                        <td className="py-3 pr-3 text-mute">{r.royaltyPercentageAssigned ? `${r.royaltyPercentageAssigned}%` : "—"}</td>
                        <td className="py-3 pr-3"><StatusPill value={r.status} /></td>
                        <td className="py-3 pr-3 text-mute">{new Date(r.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.royaltyRequests?.length && <EmptyState text="No royalty requests yet." />}
              </div>
            </Panel>

            <Panel title="Royalty Payments + Pool Contributions" icon={<ShieldCheck size={16} />} meta="Manual-first MVP ledger">
              <div className="grid gap-3">
                {(data.royaltyPayments ?? []).slice(0, 8).map((p) => (
                  <article key={p.id} className="rounded-2xl border border-edge bg-panel2 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-black text-ink truncate">{p.songTitle}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-widest font-bold text-mute">
                          {p.monthCovered || "Unassigned month"} · {p.distributorSource || "Distributor/source pending"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-neon">${Number(p.receivedAmountUsd || 0).toLocaleString()}</div>
                        <StatusPill value={p.status} />
                      </div>
                    </div>
                    {p.transactionHash && (
                      <a href={`https://solscan.io/tx/${p.transactionHash}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-[10px] uppercase tracking-widest font-black text-violet hover:text-neon">
                        View transaction <ArrowUpRight size={12} />
                      </a>
                    )}
                  </article>
                ))}
                {!data.royaltyPayments?.length && <EmptyState text="No royalty payments recorded yet." />}
              </div>
            </Panel>
          </section>

          <aside className="space-y-5">
            <Panel title="System Health" icon={<BadgeInfo size={16} />} meta={system.readyForPublic ? "Public-ready signals present" : "Setup still missing pieces"}>
              <div className="grid gap-2">
                <SystemLine label="Network" value={String(system.network || "unknown")} ok={system.network === "mainnet-beta"} />
                <SystemLine label="Database" value={databaseValue} ok={databaseConnected} />
                <SystemLine label="RPC" value={system.rpcUrl ? "Configured" : "Missing"} ok={!!system.rpcUrl} />
                <SystemLine label="Audius API key" value={system.audiusConfigured ? "Configured" : "Missing"} ok={!!system.audiusConfigured} />
                <SystemLine label="Treasury wallet" value={system.treasuryWallet ? short(String(system.treasuryWallet)) : "Missing"} ok={!!system.treasuryWallet} />
                <SystemLine label="Jupiter" value={system.jupiterConfigured ? "Configured" : "Missing"} ok={!!system.jupiterConfigured} />
                <SystemLine label="Payer secret" value={system.payerConfigured ? "Configured" : "Missing"} ok={!!system.payerConfigured} />
                <SystemLine label="Phantom review" value={system.phantomReviewApproved ? "Approved" : system.phantomReviewSubmitted ? "Submitted" : "Not submitted"} ok={!!system.phantomReviewApproved} />
                <SystemLine label="Royalty automation" value={system.royaltyAutomationAllowed ? "Enabled" : "Manual only"} ok={!!system.royaltyAutomationAllowed} />
                <SystemLine label="Treasury automation" value={system.treasuryAutomationAllowed ? "Enabled" : "Manual only"} ok={!!system.treasuryAutomationAllowed} />
              </div>
              {system.databaseWarning && (
                <div className="mt-4 rounded-2xl border border-amber/25 bg-amber/10 p-4 text-xs leading-relaxed text-ink/80">
                  <div className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber">Database Setup</div>
                  {system.databaseConfigured
                    ? "A database URL is set, but the admin API could not reach it from this environment. Render may still work if its DATABASE_URL points to the live Postgres instance."
                    : "This local workspace does not have DATABASE_URL set, so the admin console is showing a safe empty dashboard. Add the Render Postgres DATABASE_URL locally to show real admin data here."}
                </div>
              )}
            </Panel>

            <Panel title="Risk Watchlist" icon={<TriangleAlert size={16} />} meta="Highest risk assets by reports / liquidity">
              <div className="grid gap-3">
                {(data.topRisk ?? []).slice(0, 8).map((song) => (
                  <article key={song.id} className="rounded-2xl border border-edge bg-panel2 p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-black text-ink truncate">{song.title}</div>
                        <div className="text-[10px] uppercase tracking-widest font-bold text-mute mt-1 truncate">${song.symbol}</div>
                      </div>
                      <StatusPill value={song.riskLevel || "UNVERIFIED"} />
                    </div>
                    <div className="grid gap-2 grid-cols-3 text-[10px] uppercase tracking-widest font-black text-mute">
                      <MiniMetric k="Reports" v={String(song._count?.reports ?? 0)} />
                      <MiniMetric k="Liquidity" v={`${Math.round(song.liquidityHealth ?? 0)} / 100`} />
                      <MiniMetric k="Trades" v={String(song._count?.trades ?? 0)} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ActionButton onClick={() => act({ entity: "song", id: song.id, action: "SONG_RESTRICT" })} busy={busy === `song:${song.id}:SONG_RESTRICT`} label="Restrict" danger />
                      <ActionButton onClick={() => act({ entity: "song", id: song.id, action: "SONG_DELIST" })} busy={busy === `song:${song.id}:SONG_DELIST`} label="Delist" danger />
                    </div>
                  </article>
                ))}
              </div>
            </Panel>

            <Panel title="Users" icon={<Users size={16} />} meta={`${data.users?.length ?? 0} recent users`}>
              <div className="grid gap-3">
                {(data.users ?? []).slice(0, 10).map((user) => (
                  <article key={user.id} className="rounded-2xl border border-edge bg-panel2 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-black text-ink truncate">{user.audiusHandle ? `@${user.audiusHandle}` : short(user.wallet)}</div>
                        <div className="text-[10px] uppercase tracking-widest font-bold text-mute mt-1 truncate">{user.wallet}</div>
                      </div>
                      <StatusPill value={user.role} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <MiniMetric k="Tokens" v={String(user._count?.artistTokens ?? 0)} />
                      <MiniMetric k="Reports" v={String(user._count?.reports ?? 0)} />
                      <MiniMetric k="Trades" v={String((user._count?.trades ?? 0) + (user._count?.coinTrades ?? 0))} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ActionButton onClick={() => act({ entity: "user", id: user.id, action: "USER_PROMOTE_ARTIST" })} busy={busy === `user:${user.id}:USER_PROMOTE_ARTIST`} label="Artist" />
                      <ActionButton onClick={() => act({ entity: "user", id: user.id, action: "USER_SET_INVESTOR" })} busy={busy === `user:${user.id}:USER_SET_INVESTOR`} label="Investor" />
                      <ActionButton onClick={() => act({ entity: "user", id: user.id, action: "USER_PROMOTE_ADMIN" })} busy={busy === `user:${user.id}:USER_PROMOTE_ADMIN`} label="Admin" />
                    </div>
                  </article>
                ))}
              </div>
            </Panel>

            <Panel title="Royalty / Split Ops" icon={<Lock size={16} />} meta="Verification and email workflow">
              <div className="space-y-3">
                <div className="rounded-2xl border border-edge bg-panel2 p-4 text-sm text-ink/80 leading-relaxed">
                  Artists should add <span className="font-mono text-neon">admin@song-daq.com</span> as a distributor split recipient, then submit the in-app royalty request. Admin verifies the invitation here before any coin is labeled Royalty Verified.
                </div>
                <div className="grid gap-2">
                  {(data.launches ?? []).filter((s) => s.royaltyVault || s.royaltyStatus !== "VERIFIED" || !s.splitsLocked).slice(0, 6).map((song) => (
                    <article key={song.id} className="rounded-2xl border border-edge bg-panel2 p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-black text-ink truncate">{song.title}</div>
                          <div className="text-[10px] uppercase tracking-widest font-bold text-mute mt-1 truncate">{song.royaltyVault || "No split vault yet"}</div>
                        </div>
                        <StatusPill value={song.royaltyStatus || "UNVERIFIED"} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <ActionButton onClick={() => act({ entity: "song", id: song.id, action: "SONG_VERIFY_ROYALTY" })} busy={busy === `song:${song.id}:SONG_VERIFY_ROYALTY`} label="Verify" />
                        <ActionButton onClick={() => act({ entity: "song", id: song.id, action: "SONG_LOCK_SPLITS" })} busy={busy === `song:${song.id}:SONG_LOCK_SPLITS`} label="Lock" />
                        <ActionButton onClick={() => act({ entity: "song", id: song.id, action: "SONG_UNLOCK_SPLITS" })} busy={busy === `song:${song.id}:SONG_UNLOCK_SPLITS`} label="Unlock" danger />
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel title="Launch Notes" icon={<BellRing size={16} />} meta="What still needs setup">
              <ul className="space-y-2 text-sm text-ink/80 leading-relaxed">
                <li className="flex gap-2"><ShieldCheck size={14} className="text-neon shrink-0 mt-1" />Confirm Audius redirect URLs and OAuth app settings.</li>
                <li className="flex gap-2"><ShieldCheck size={14} className="text-neon shrink-0 mt-1" />After the live domain deploys, submit SONG·DAQ to Phantom/Blowfish review with token launch, liquidity, and swap examples.</li>
                <li className="flex gap-2"><ShieldCheck size={14} className="text-neon shrink-0 mt-1" />Expect brand-new liquidity pools to wait for Jupiter indexing; the UI must show route waiting states instead of asking wallets to sign.</li>
                <li className="flex gap-2"><ShieldCheck size={14} className="text-neon shrink-0 mt-1" />Keep royalty payout and holder reward automation manual until legal review and treasury automation audit are complete.</li>
                <li className="flex gap-2"><ShieldCheck size={14} className="text-neon shrink-0 mt-1" />Set the split inbox provider to forward confirmations into your ops workflow.</li>
                <li className="flex gap-2"><ShieldCheck size={14} className="text-neon shrink-0 mt-1" />Use this console to review high-risk tokens before they go live.</li>
                <li className="flex gap-2"><ShieldCheck size={14} className="text-neon shrink-0 mt-1" />Keep a funded Solana payer wallet and treasury wallet available in Render env vars.</li>
              </ul>
            </Panel>
          </aside>
        </div>
      )}
    </main>
  );
}

function Panel({ title, icon, meta, children }: { title: string; icon?: ReactNode; meta?: string; children: ReactNode }) {
  return (
    <section className="panel p-5 md:p-6 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon && <span className="text-neon">{icon}</span>}
          <h2 className="text-lg md:text-xl font-black text-ink">{title}</h2>
        </div>
        {meta && <div className="text-[10px] uppercase tracking-widest font-black text-mute">{meta}</div>}
      </header>
      {children}
    </section>
  );
}

function AdminStat({ label, value, icon, tone }: { label: string; value: number | string; icon?: ReactNode; tone?: "neon" | "violet" | "amber" | "red" }) {
  const toneCls =
    tone === "red"
      ? "text-red border-red/20 bg-red/10"
      : tone === "amber"
        ? "text-amber border-amber/20 bg-amber/10"
        : tone === "violet"
          ? "text-violet border-violet/20 bg-violet/10"
          : "text-neon border-neon/20 bg-neon/10";
  return (
    <div className="rounded-2xl border border-edge bg-panel2 p-4">
      <div className={`inline-flex items-center gap-2 rounded-lg px-2 py-1 text-[10px] uppercase tracking-widest font-black ${toneCls}`}>
        {icon}
        {label}
      </div>
      <div className="mt-3 text-3xl font-black text-ink">{value}</div>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const v = String(value || "").toUpperCase();
  const cls =
    /LIVE|LOCKED|VERIFIED|ARTIST|ADMIN|REVIEWED|ACTIONED/.test(v)
      ? "text-neon border-neon/20 bg-neon/10"
      : /RESTRICT|DELIST|FLAG|OPEN|PENDING|UNVERIFIED/.test(v)
        ? "text-amber border-amber/20 bg-amber/10"
        : "text-mute border-edge bg-white/5";
  return <span className={`chip ${cls}`}>{v || "UNKNOWN"}</span>;
}

function ActionButton({
  label,
  onClick,
  busy,
  danger,
}: {
  label: string;
  onClick: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`btn h-9 px-3 text-[10px] uppercase tracking-widest font-black ${danger ? "text-red border-red/20" : ""}`}
    >
      {busy ? "Working..." : label}
    </button>
  );
}

function MiniMetric({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-edge bg-panel p-3">
      <div className="text-[9px] uppercase tracking-widest font-black text-mute">{k}</div>
      <div className="mt-1 text-sm font-black text-ink truncate">{v}</div>
    </div>
  );
}

function SystemLine({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-panel2 px-3 py-2">
      <div className="text-xs uppercase tracking-widest font-black text-mute">{label}</div>
      <div className={`text-[10px] font-black uppercase tracking-widest ${ok ? "text-neon" : "text-amber"}`}>{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-edge bg-panel2 p-5 text-center text-xs uppercase tracking-widest font-bold text-mute">{text}</div>;
}

function short(value: string, take = 4) {
  if (!value) return "";
  if (value.length <= take * 2 + 1) return value;
  return `${value.slice(0, take)}…${value.slice(-take)}`;
}
