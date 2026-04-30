"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WalletKind = "solana" | "evm";

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
  /** Unified AUDIO balance (ERC + wAUDIO + associated wallets). */
  audioBalance?: number;
}

/* ── Persisted session (wallet + audius identity) ─────────────── */
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
      setSession: (s) => set((prev) => ({ ...prev, ...s })),
      clear: () => set({ address: null, kind: null, provider: null }),
      clearAudius: () => set({ audius: null }),
    }),
    { name: "songdaq-session" },
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
  theme: "light",
  setTheme: (t) => set({ theme: t }),
  activityToastVisible: true,
  setActivityToastVisible: (v) => set({ activityToastVisible: v }),
  soundEnabled: false,
  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
}));

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
