import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPage } from "@/components/Skeletons";

export default function Loading() {
  return (
    <SkeletonPage className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-14 rounded-lg" />
          <Skeleton className="h-9 w-16 rounded-lg" />
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="space-y-3">
        <Skeleton className="ml-auto h-12 w-3/5 rounded-2xl" />
        <Skeleton className="h-28 w-5/6 rounded-2xl" />
        <Skeleton className="ml-auto h-10 w-2/5 rounded-2xl" />
      </div>
    </SkeletonPage>
  );
}
