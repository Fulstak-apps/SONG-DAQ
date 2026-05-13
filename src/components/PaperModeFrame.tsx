"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, ChevronUp, Clock3, Gamepad2, Sparkles } from "lucide-react";
import { usePaperTrading } from "@/lib/store";

const GAME_DURATION_MS = 5 * 60 * 1000;
const STORAGE_KEY = "songdaq-paper-intro-game-v2";

type MissionId = "wallet" | "market" | "coin" | "trade" | "portfolio" | "launch";

type IntroGameState = {
  startedAt: number;
  collapsed: boolean;
  completedIds: MissionId[];
};

function readGameState(): IntroGameState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IntroGameState;
    return typeof parsed.startedAt === "number"
      ? { ...parsed, completedIds: Array.isArray(parsed.completedIds) ? parsed.completedIds : [] }
      : null;
  } catch {
    return null;
  }
}

function writeGameState(state: IntroGameState) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function PaperModeFrame() {
  const enabled = usePaperTrading((s) => s.enabled);
  const trades = usePaperTrading((s) => s.trades);
  const holdings = usePaperTrading((s) => s.holdings);
  const resetDemo = usePaperTrading((s) => s.resetDemo);
  const path = usePathname();
  const router = useRouter();
  const [now, setNow] = useState(Date.now());
  const [gameState, setGameState] = useState<IntroGameState | null>(null);
  const [autoCollapsed, setAutoCollapsed] = useState(false);
  const lastCompletedRef = useRef(0);
  const hasTrade = trades.length > 0;
  const hasPosition = Object.values(holdings).some((holding) => holding.amount > 0);

  useEffect(() => {
    if (!enabled) {
      setGameState(null);
      setAutoCollapsed(false);
      lastCompletedRef.current = 0;
      return;
    }
    const existing = readGameState();
    const stale = existing ? Date.now() - existing.startedAt > GAME_DURATION_MS : true;
    const next = !existing || stale ? { startedAt: Date.now(), collapsed: false, completedIds: [] } : existing;
    writeGameState(next);
    setGameState(next);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [enabled]);

  const derivedCompletedIds = useMemo<MissionId[]>(() => {
    return [
      "wallet",
      ...(path.startsWith("/market") ? (["market"] as MissionId[]) : []),
      ...(path.startsWith("/coin") || path.startsWith("/song") ? (["coin"] as MissionId[]) : []),
      ...(hasTrade || hasPosition ? (["trade"] as MissionId[]) : []),
      ...(path.startsWith("/portfolio") ? (["portfolio"] as MissionId[]) : []),
      ...(path.startsWith("/artist") ? (["launch"] as MissionId[]) : []),
    ];
  }, [hasPosition, hasTrade, path]);

  const completedIds = gameState?.completedIds ?? [];
  const completedSet = useMemo(() => new Set<MissionId>(completedIds), [completedIds]);

  const missions = useMemo(() => {
    return [
      {
        id: "wallet" as MissionId,
        title: "Paper wallet ready",
        body: "You have simulated SOL and AUDIO.",
        done: true,
        href: "/market",
      },
      {
        id: "market" as MissionId,
        title: "Browse the market",
        body: "Scan live song and artist coins.",
        done: completedSet.has("market"),
        href: "/market",
      },
      {
        id: "coin" as MissionId,
        title: "Open a coin",
        body: "Read the chart, artist, source, and liquidity.",
        done: completedSet.has("coin"),
        href: "/market",
      },
      {
        id: "trade" as MissionId,
        title: "Make a paper trade",
        body: "Buy or sell once with fake funds.",
        done: completedSet.has("trade"),
        href: path.startsWith("/coin") || path.startsWith("/song") ? path : "/market",
      },
      {
        id: "portfolio" as MissionId,
        title: "Check portfolio",
        body: "Watch paper value and P/L move.",
        done: completedSet.has("portfolio"),
        href: "/portfolio",
      },
      {
        id: "launch" as MissionId,
        title: "Try launch flow",
        body: "Create a coin without real signing.",
        done: completedSet.has("launch"),
        href: "/artist",
      },
    ];
  }, [completedSet, path]);

  const completed = missions.filter((mission) => mission.done).length;
  const nextMission = missions.find((mission) => !mission.done) ?? missions[missions.length - 1];
  const startedAt = gameState?.startedAt ?? now;
  const elapsed = now - startedAt;
  const remaining = Math.max(0, GAME_DURATION_MS - elapsed);
  const gameComplete = completed === missions.length;
  const progress = Math.max(0, Math.min(100, gameComplete ? 100 : (completed / missions.length) * 100));
  const ctaHref = gameComplete ? "/market" : nextMission.href;
  const ctaLabel = gameComplete ? "Review Market" : `Next: ${nextMission.title}`;

  const setCollapsed = (collapsed: boolean) => {
    setGameState((previous) => {
      const next = {
        startedAt: previous?.startedAt ?? startedAt,
        collapsed,
        completedIds: previous?.completedIds ?? completedIds,
      };
      writeGameState(next);
      return next;
    });
  };

  const completeMission = (id: MissionId, reopen = false) => {
    setGameState((previous) => {
      const nextIds = Array.from(new Set<MissionId>([...(previous?.completedIds ?? completedIds), id]));
      const next = {
        startedAt: previous?.startedAt ?? startedAt,
        collapsed: reopen ? false : previous?.collapsed ?? gameState?.collapsed ?? false,
        completedIds: nextIds,
      };
      writeGameState(next);
      return next;
    });
    if (reopen) setAutoCollapsed(false);
  };

  const missionIsActuallyDone = (id: MissionId) => {
    if (id === "wallet") return true;
    if (id === "market") return path.startsWith("/market");
    if (id === "coin") return path.startsWith("/coin") || path.startsWith("/song");
    if (id === "trade") return hasTrade || hasPosition;
    if (id === "portfolio") return path.startsWith("/portfolio");
    if (id === "launch") return path.startsWith("/artist");
    return false;
  };

  const guideTo = (href: string, missionId?: MissionId) => {
    setAutoCollapsed(true);
    setCollapsed(true);
    router.push(href);
    if (missionId && missionIsActuallyDone(missionId)) {
      window.setTimeout(() => completeMission(missionId, true), 650);
    }
  };

  const restartGame = () => {
    resetDemo();
    const next = { startedAt: Date.now(), collapsed: false, completedIds: [] };
    writeGameState(next);
    setGameState(next);
    setAutoCollapsed(false);
    lastCompletedRef.current = 0;
    setNow(Date.now());
    router.push("/market");
  };

  useEffect(() => {
    if (!enabled || !gameState) {
      lastCompletedRef.current = 0;
      setAutoCollapsed(false);
      return;
    }

    const missing = derivedCompletedIds.filter((id) => !completedSet.has(id));
    if (!missing.length) return;

    const nextIds = Array.from(new Set<MissionId>([...completedIds, ...missing]));
    const next = { ...gameState, completedIds: nextIds };
    writeGameState(next);
    setGameState(next);

    if (!autoCollapsed) return;

    const reveal = window.setTimeout(() => {
      setCollapsed(false);
      setAutoCollapsed(false);
    }, 520);

    return () => window.clearTimeout(reveal);
  }, [autoCollapsed, completedIds, completedSet, derivedCompletedIds, enabled, gameState, startedAt]);

  if (!enabled) return null;

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[9998] border-2 border-neon/80 shadow-[inset_0_0_24px_rgba(0,229,114,0.18),0_0_28px_rgba(0,229,114,0.35)]" />
      <section className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+6.4rem)] z-[70] mx-auto max-w-[520px] md:inset-x-auto md:bottom-5 md:right-5 md:mx-0 md:w-[420px]">
        <div className="overflow-hidden rounded-2xl border border-neon/30 bg-bg/95 shadow-[0_18px_60px_rgba(0,0,0,0.55),0_0_32px_rgba(0,229,114,0.12)] backdrop-blur-2xl">
          <button
            type="button"
            onClick={() => {
              setAutoCollapsed(false);
              setCollapsed(!gameState?.collapsed);
            }}
            className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-white/[0.035] active:scale-[0.995] sm:px-4"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-neon/30 bg-neon/12 text-neon shadow-[0_0_18px_rgba(0,229,114,0.14)]">
              <Gamepad2 size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-neon">
                Paper intro game
                {gameComplete ? <Sparkles size={13} /> : null}
              </span>
              <span className="mt-0.5 block truncate text-sm font-black text-ink">
                {gameComplete ? "Intro complete. You know the loop." : nextMission.title}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2 rounded-full border border-edge bg-white/[0.04] px-2.5 py-1 font-mono text-xs font-black text-ink">
              <Clock3 size={13} className="text-neon" />
              {formatRemaining(remaining)}
            </span>
            {gameState?.collapsed ? <ChevronUp size={16} className="text-mute" /> : <ChevronDown size={16} className="text-mute" />}
          </button>

          <div className="h-1 bg-white/[0.06]">
            <div
              className="h-full bg-neon shadow-[0_0_16px_rgba(0,229,114,0.6)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {!gameState?.collapsed ? (
            <div className="space-y-3 px-3 pb-3 pt-3 sm:px-4">
              <div className="grid grid-cols-3 gap-2">
                <MiniStat label="Mission" value={`${completed}/${missions.length}`} />
                <MiniStat label="Timer" value={formatRemaining(remaining)} />
                <MiniStat label="Funds" value="Fake" />
              </div>

              <div className="space-y-1.5">
                {missions.map((mission) => (
                  <button
                    key={mission.title}
                    type="button"
                    onClick={() => guideTo(mission.href, mission.id)}
                    className="flex w-full items-start gap-2 rounded-xl border border-edge/80 bg-white/[0.035] px-3 py-2 text-left transition hover:border-neon/30 hover:bg-neon/[0.055] active:scale-[0.995]"
                    aria-label={`Go to ${mission.title}`}
                  >
                    <CheckCircle2 size={15} className={`mt-0.5 shrink-0 ${mission.done ? "text-neon" : "text-mute/55"}`} />
                    <div className="min-w-0">
                      <div className={`text-xs font-black ${mission.done ? "text-ink" : "text-mute"}`}>{mission.title}</div>
                      <div className="text-[11px] leading-snug text-mute">{mission.body}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <button
                  type="button"
                  onClick={() => guideTo(ctaHref, nextMission.id)}
                  className="btn-primary min-h-11 px-3 text-[11px] font-black uppercase tracking-widest"
                >
                  {ctaLabel}
                </button>
                <button
                  type="button"
                  onClick={restartGame}
                  className="btn min-h-11 px-3 text-[11px] font-black uppercase tracking-widest"
                >
                  Reset
                </button>
              </div>

              <p className="text-[11px] leading-relaxed text-mute">
                Five minutes, fake wallet, real app flow. No blockchain transaction is sent while this green frame is on.
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-edge bg-black/20 px-3 py-2">
      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-mute">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-black text-ink">{value}</div>
    </div>
  );
}
