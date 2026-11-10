import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPage, SkeletonRows } from "@/components/Skeletons";

export default function Loading() {
  return (
    <SkeletonPage className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <Skeleton className="h-9 w-16 rounded-lg" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
      <SkeletonRows count={7} />
    </SkeletonPage>
  );
}
