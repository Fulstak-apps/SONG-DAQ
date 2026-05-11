import { CardGridSkeleton, StatRowSkeleton } from "@/components/Skeleton";

export default function PortfolioLoading() {
  return (
    <div className="space-y-5">
      <StatRowSkeleton />
      <CardGridSkeleton count={6} />
    </div>
  );
}
