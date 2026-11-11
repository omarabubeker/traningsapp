import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonBackHeader, SkeletonPage, SkeletonRows, SkeletonSectionLabel } from "@/components/Skeletons";

export default function Loading() {
  return (
    <SkeletonPage className="space-y-7 pt-3">
      <SkeletonBackHeader sub={false} />
      <div className="space-y-2">
        <SkeletonSectionLabel />
        <div className="card space-y-4">
          <Skeleton className="h-2 w-full rounded-full" />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <SkeletonSectionLabel />
        <SkeletonRows count={3} />
      </div>
    </SkeletonPage>
  );
}
