"use client";
import { motion } from "framer-motion";

/* ─── Base shimmer ─────────────────────────────────────── */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/* ─── Card skeleton: matches CoinCard / SongCard ───────── */
export function CardRowSkeleton() {
  return (
    <div className="panel-elevated p-5 flex gap-4 grain">
      <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-14 rounded-lg" />
        </div>
        <Skeleton className="h-3 w-36" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="flex-1 h-10 rounded-xl" />
          <Skeleton className="h-5 w-14 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="flex-1 h-10 rounded-xl" />
          <Skeleton className="w-20 h-10 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: i * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <CardRowSkeleton />
        </motion.div>
      ))}
    </section>
  );
}

export function StatRowSkeleton() {
  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: i * 0.06, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="panel-elevated p-5 space-y-3 grain"
        >
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-28" />
        </motion.div>
      ))}
    </section>
  );
}

export function ChartSkeleton({ height = 288 }: { height?: number }) {
  return (
    <div className="panel-elevated p-5 grain">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-32 rounded-lg" />
      </div>
      <div style={{ height }} className="relative overflow-hidden">
        <Skeleton className="absolute inset-0 rounded-xl" />
      </div>
    </div>
  );
}

/* ─── Inline loading dot ───────────────────────────────── */
export function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1 h-1 rounded-full bg-white/20"
          animate={{ opacity: [0.2, 0.8, 0.2] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

/* ─── Feed skeleton (news/trade) ───────────────────────── */
export function FeedSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="panel-elevated grain">
      <div className="px-5 py-3.5 flex items-center justify-between border-b border-white/[0.03]">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-20 rounded-lg" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-5 py-3.5 flex items-center gap-3 border-b border-white/[0.02] last:border-0">
          <Skeleton className="h-5 w-12 rounded-lg" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </div>
  );
}
