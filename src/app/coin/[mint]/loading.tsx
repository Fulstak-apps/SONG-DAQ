import { ChartSkeleton, FeedSkeleton, StatRowSkeleton } from "@/components/Skeleton";

export default function CoinLoading() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      <div className="hidden lg:block">
        <FeedSkeleton rows={8} />
      </div>
      <div className="space-y-5">
        <div className="panel p-6">
          <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
        </div>
        <ChartSkeleton height={420} />
        <StatRowSkeleton />
      </div>
    </div>
  );
}
