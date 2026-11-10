import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonBackHeader, SkeletonCard, SkeletonPage } from "@/components/Skeletons";

export default function Loading() {
  return (
    <SkeletonPage className="space-y-4 pt-3">
      <SkeletonBackHeader sub={false} />
      <div className="space-y-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-3.5 w-56" />
      </div>
      {Array.from({ length: 5 }, (_, i) => <SkeletonCard key={i} lines={i === 0 ? 1 : 2} />)}
    </SkeletonPage>
  );
}
