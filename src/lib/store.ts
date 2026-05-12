"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type WalletKind = "solana";

function isPersistedSolanaAddress(address: unknown) {
  return typeof address === "string" &&
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) &&
    !address.toLowerCase().startsWith("0x");
}

export interface AudiusProfile {
  userId: string;
  handle: string;
  name: string;
  verified: boolean;
  avatar: string | null;
  wallets?: {
    sol: string | null;
    eth: string | null;
  };
  follower_count?: number;
  following_count?: number;
  track_count?: number;
  /** Unified AUDIO balance from Audius plus associated Solana wallets. */
  audioBalance?: number;
}

/* ── Session (wallet + Audius identity, current browser tab only) ── */
interface SessionState {
  address: string | null;
  kind: WalletKind | null;
  provider: string | null;
  audius: AudiusProfile | null;
  setSession: (s: Partial<SessionState>) => void;
  clear: () => void;
  clearAudius: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      address: null,
      kind: null,
      provider: null,
      audius: null,
      setSession: (s) => set((prev) => {
        const nextAddress = s.provider === "audius"
          ? null
          : isPersistedSolanaAddress(s.address)
            ? s.address
            : s.address === null
              ? null
              : prev.provider === "audius"
                ? null
                : prev.address;
        return {
          ...prev,
          ...s,
          address: nextAddress,
          kind: nextAddress ? "solana" : null,
          provider: nextAddress ? (s.provider ?? prev.provider) : null,
        };
      }),
      clear: () => set({ address: null, kind: null, provider: null, audius: null }),
      clearAudius: () => set({ address: null, kind: null, provider: null, audius: null }),
    }),
    {
      name: "songdaq-session-tab",
      storage: createJSONStorage(() => sessionStorage),
      version: 1,
      merge: (persisted, current) => {
        const state = (persisted as any) ?? {};
        const validWallet = state.provider !== "audius" && state.kind === "solana" && isPersistedSolanaAddress(state.address);
        return {
          ...current,
          ...state,
          address: validWallet ? state.address : null,
          kind: validWallet ? "solana" : null,
          provider: validWallet ? state.provider : null,
        };
      },
    },
  ),
);

/* ── Ephemeral UI state (never persisted) ─────────────────────── */
interface UIState {
  loginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  userMode: "INVESTOR" | "ARTIST";
  setUserMode: (m: "INVESTOR" | "ARTIST") => void;
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  // Activity ticker overlay
  activityToastVisible: boolean;
  setActivityToastVisible: (v: boolean) => void;
  // Sound effects toggle
  soundEnabled: boolean;
  toggleSound: () => void;
}

export const useUI = create<UIState>((set) => ({
  loginModalOpen: false,
  openLoginModal: () => set({ loginModalOpen: true }),
  closeLoginModal: () => set({ loginModalOpen: false }),
  userMode: "INVESTOR",
  setUserMode: (m) => set({ userMode: m }),
  theme: "dark",
  setTheme: (t) => set({ theme: t }),
  activityToastVisible: true,
  setActivityToastVisible: (v) => set({ activityToastVisible: v }),
  soundEnabled: false,
  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
}));

interface PaperTrade {
  id: string;
  mint: string;
  ticker: string;
  side: "BUY" | "SELL";
  inputAmount: number;
  inputAsset: "SOL" | "AUDIO";
  settleAmount: number;
  tokenAmount: number;
  totalUsd: number;
  ts: number;
}

interface PaperHolding {
  mint: string;
  ticker: string;
  amount: number;
  costUsd: number;
}

interface PaperTradeState {
  enabled: boolean;
  seeded: boolean;
  balances: { cashUsd: number; sol: number; audio: number };
  holdings: Record<string, PaperHolding>;
  trades: PaperTrade[];
  setEnabled: (enabled: boolean) => void;
  seedDemo: () => void;
  resetDemo: () => void;
  record: (trade: Omit<PaperTrade, "id" | "ts">) => void;
  getHolding: (mint: string) => PaperHolding | null;
}

const DEMO_BALANCES = { cashUsd: 10000, sol: 250, audio: 2500 };

export const usePaperTrading = create<PaperTradeState>()(
  persist(
    (set, get) => ({
      enabled: false,
      seeded: false,
      balances: DEMO_BALANCES,
      holdings: {},
      trades: [],
      setEnabled: (enabled) => {
        set({ enabled });
        if (enabled && !get().seeded) get().seedDemo();
      },
      seedDemo: () => set({
        seeded: true,
        balances: DEMO_BALANCES,
      }),
      resetDemo: () => set({
        seeded: true,
        balances: DEMO_BALANCES,
        holdings: {},
        trades: [],
      }),
      record: (trade) => set((s) => {
        const entry: PaperTrade = { ...trade, id: crypto.randomUUID(), ts: Date.now() };
        const trades = [entry, ...s.trades].slice(0, 200);
        const holdings = { ...s.holdings };
        const current = holdings[trade.mint] ?? { mint: trade.mint, ticker: trade.ticker, amount: 0, costUsd: 0 };
        const balances = { ...s.balances };

        if (trade.side === "BUY") {
          current.amount += trade.tokenAmount;
          current.costUsd += trade.totalUsd;
          if (trade.inputAsset === "SOL") balances.sol = Math.max(0, balances.sol - trade.settleAmount);
          if (trade.inputAsset === "AUDIO") balances.audio = Math.max(0, balances.audio - trade.settleAmount);
        } else {
          current.amount = Math.max(0, current.amount - trade.tokenAmount);
          current.costUsd = Math.max(0, current.costUsd - trade.totalUsd);
          if (trade.inputAsset === "SOL") balances.sol += trade.settleAmount;
          if (trade.inputAsset === "AUDIO") balances.audio += trade.settleAmount;
        }

        holdings[trade.mint] = current;
        return { trades, holdings, balances };
      }),
      getHolding: (mint) => get().holdings[mint] ?? null,
    }),
    {
      name: "songdaq-paper-trading",
      version: 2,
      migrate: (persisted) => ({
        ...(persisted as any),
        enabled: false,
      }),
    },
  ),
);

/* ── Trade feed ───────────────────────────────────────────────── */
interface TradeFeedItem {
  id: string;
  songId: string;
  symbol: string;
  side: "BUY" | "SELL";
  amount: number;
  price: number;
  ts: number;
}

interface FeedState {
  feed: TradeFeedItem[];
  push: (item: TradeFeedItem) => void;
}

export const useFeed = create<FeedState>((set) => ({
  feed: [],
  push: (item) =>
    set((s) => ({ feed: [item, ...s.feed].slice(0, 60) })),
}));

/* ── Watchlist (persisted) ────────────────────────────────────── */
interface WatchlistState {
  items: string[]; // coin mints or song IDs
  add: (id: string) => void;
  remove: (id: string) => void;
  toggle: (id: string) => void;
  has: (id: string) => boolean;
}

export const useWatchlist = create<WatchlistState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (id) => set((s) => ({ items: s.items.includes(id) ? s.items : [...s.items, id] })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i !== id) })),
      toggle: (id) => {
        const s = get();
        if (s.items.includes(id)) {
          set({ items: s.items.filter((i) => i !== id) });
        } else {
          set({ items: [...s.items, id] });
        }
      },
      has: (id) => get().items.includes(id),
    }),
    { name: "songdaq-watchlist" },
  ),
);

/* ── Price Alerts (persisted) ─────────────────────────────────── */
interface PriceAlert {
  id: string;
  assetId: string;
  symbol: string;
  metric?: "price" | "volume" | "holders" | "liquidity";
  targetPrice: number;
  direction: "above" | "below";
  createdAt: number;
  triggered: boolean;
}

interface AlertsState {
  alerts: PriceAlert[];
  add: (alert: Omit<PriceAlert, "id" | "createdAt" | "triggered">) => void;
  remove: (id: string) => void;
  markTriggered: (id: string) => void;
}

export const useAlerts = create<AlertsState>()(
  persist(
    (set) => ({
      alerts: [],
      add: (alert) =>
        set((s) => ({
          alerts: [
            ...s.alerts,
            { ...alert, id: crypto.randomUUID(), createdAt: Date.now(), triggered: false },
          ],
        })),
      remove: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
      markTriggered: (id) =>
        set((s) => ({
          alerts: s.alerts.map((a) => (a.id === id ? { ...a, triggered: true } : a)),
        })),
    }),
    { name: "songdaq-alerts" },
  ),
);

/* ── Prestige / Reputation ────────────────────────────────────── */
type PrestigeTier = "newcomer" | "bronze" | "silver" | "gold" | "platinum" | "diamond";

interface PrestigeState {
  tier: PrestigeTier;
  xp: number;
  tradesCount: number;
  holdingsCount: number;
  addXp: (amount: number) => void;
  incrementTrades: () => void;
  recalcTier: () => void;
}

const TIER_THRESHOLDS: [number, PrestigeTier][] = [
  [10000, "diamond"],
  [5000, "platinum"],
  [2000, "gold"],
  [800, "silver"],
  [200, "bronze"],
  [0, "newcomer"],
];

export const usePrestige = create<PrestigeState>()(
  persist(
    (set, get) => ({
      tier: "newcomer",
      xp: 0,
      tradesCount: 0,
      holdingsCount: 0,
      addXp: (amount) => {
        set((s) => ({ xp: s.xp + amount }));
        get().recalcTier();
      },
      incrementTrades: () => {
        set((s) => ({ tradesCount: s.tradesCount + 1 }));
        get().addXp(10);
      },
      recalcTier: () => {
        const xp = get().xp;
        const tier = (TIER_THRESHOLDS.find(([t]) => xp >= t)?.[1]) ?? "newcomer";
        set({ tier });
      },
    }),
    { name: "songdaq-prestige" },
  ),
);

/* ── Persistent site audio player ─────────────────────────────────────── */
export interface PlayerTrack {
  id: string;
  title: string;
  artist: string;
  streamUrl: string;
  artwork?: string | null;
  href?: string;
}

interface PlayerState {
  current: PlayerTrack | null;
  queue: PlayerTrack[];
  playing: boolean;
  userPaused: boolean;
  volume: number;
  setQueue: (tracks: PlayerTrack[], autoplay?: boolean) => void;
  playTrack: (track: PlayerTrack, queue?: PlayerTrack[]) => void;
  toggle: () => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  setPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
}

export const usePlayer = create<PlayerState>()(
  persist(
    (set, get) => ({
      current: null,
      queue: [],
      playing: false,
      userPaused: false,
      volume: 0.1,
      setQueue: (tracks, autoplay = false) => {
        const { current, queue, userPaused } = get();
        const sameQueue = queue.length === tracks.length && queue.every((t, i) => t.id === tracks[i]?.id);
        if (sameQueue && current) return;
        const nextCurrent = current ?? tracks[0] ?? null;
        set({
          queue: tracks,
          current: nextCurrent,
          playing: autoplay && !!nextCurrent && !userPaused,
          userPaused: autoplay ? false : userPaused,
        });
      },
      playTrack: (track, queue) => set({
        current: track,
        queue: queue?.length ? queue : get().queue,
        playing: true,
        userPaused: false,
      }),
      toggle: () => {
        const playing = get().playing;
        set({ playing: !playing, userPaused: playing });
      },
      pause: () => set({ playing: false, userPaused: true }),
      resume: () => set({ playing: true, userPaused: false }),
      next: () => {
        const { current, queue } = get();
        if (!current || queue.length === 0) return;
        const i = queue.findIndex((t) => t.id === current.id);
        const next = queue[(i + 1 + queue.length) % queue.length];
        set({ current: next, playing: true, userPaused: false });
      },
      previous: () => {
        const { current, queue } = get();
        if (!current || queue.length === 0) return;
        const i = queue.findIndex((t) => t.id === current.id);
        const prev = queue[(i - 1 + queue.length) % queue.length];
        set({ current: prev, playing: true, userPaused: false });
      },
      setPlaying: (playing) => set({ playing }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
    }),
    {
      name: "songdaq-player",
      version: 4,
      migrate: (persistedState: any, version) => {
        if (version < 2) {
          return { ...persistedState, volume: 0.1 };
        }
        if (version < 3) {
          return { ...persistedState, volume: 0.1 };
        }
        if (version < 4) {
          return { ...persistedState, volume: 0.1 };
        }
        return persistedState;
      },
      partialize: (state) => ({ volume: state.volume }),
    },
  ),
);
