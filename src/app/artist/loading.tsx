import { CardGridSkeleton, StatRowSkeleton } from "@/components/Skeleton";

export default function ArtistLoading() {
  return (
    <div className="space-y-5">
      <div className="panel p-8">
        <div className="h-20 animate-pulse rounded-2xl bg-white/5" />
      </div>
      <StatRowSkeleton />
      <CardGridSkeleton count={4} />
    </div>
  );
}
