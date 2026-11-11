import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPage, SkeletonTitle } from "@/components/Skeletons";

export default function Loading() {
  return (
    <SkeletonPage className="space-y-7 pt-4">
      <SkeletonTitle className="h-8 w-24" />
      <div className="card space-y-4">
        <div className="flex items-baseline justify-between">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-7 w-20" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-3.5 w-full" />
      </div>
      <div className="card grid grid-cols-2 gap-3">
        <Skeleton className="col-span-2 h-4 w-16" />
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
      </div>
    </SkeletonPage>
  );
}
