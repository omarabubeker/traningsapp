import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard, SkeletonPage, SkeletonRows, SkeletonSectionLabel, SkeletonStats } from "@/components/Skeletons";

/** Översikten medan den laddas (även reserv för sidor utan egen laddningsvy). */
export default function Loading() {
  return (
    <SkeletonPage>
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-8 w-36" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <Skeleton className="h-6 w-10" />
          <Skeleton className="h-3.5 w-24" />
        </div>
      </div>
      <div className="space-y-2">
        <SkeletonSectionLabel />
        <SkeletonCard />
      </div>
      <div className="card grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="h-3 w-6" />
            <Skeleton className="size-9 rounded-full" />
          </div>
        ))}
      </div>
      <SkeletonStats />
      <div className="space-y-2">
        <SkeletonSectionLabel />
        <SkeletonRows count={3} />
      </div>
    </SkeletonPage>
  );
}
