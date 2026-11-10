import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonBackHeader, SkeletonPage, SkeletonStats } from "@/components/Skeletons";

export default function Loading() {
  return (
    <SkeletonPage className="space-y-5 pt-3">
      <SkeletonBackHeader />
      <SkeletonStats count={6} />
      <div className="card p-2">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
      <div className="card space-y-3">
        <Skeleton className="h-3.5 w-16" />
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-4 w-full" />)}
      </div>
    </SkeletonPage>
  );
}
