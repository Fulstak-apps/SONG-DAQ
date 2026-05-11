import { CardGridSkeleton, StatRowSkeleton } from "@/components/Skeleton";

export default function MarketLoading() {
  return (
    <div className="space-y-5">
      <StatRowSkeleton />
      <CardGridSkeleton count={9} />
    </div>
  );
}
