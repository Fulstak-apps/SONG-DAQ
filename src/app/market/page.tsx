import dynamic from "next/dynamic";
import { CardGridSkeleton, StatRowSkeleton } from "@/components/Skeleton";

const DiscoveryEngine = dynamic(() => import("@/components/DiscoveryEngine"), {
  ssr: false,
  loading: () => (
    <div className="space-y-5">
      <StatRowSkeleton />
      <CardGridSkeleton count={9} />
    </div>
  ),
});

export default function MarketPage() {
  return <DiscoveryEngine />;
}
