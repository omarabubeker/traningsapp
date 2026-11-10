import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard, SkeletonPage, SkeletonRows, SkeletonSectionLabel, SkeletonTitle } from "@/components/Skeletons";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonTitle className="h-8 w-20" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <SkeletonCard />
      <div className="space-y-2">
        <SkeletonSectionLabel />
        <SkeletonRows count={3} />
      </div>
      <div className="space-y-2">
        <SkeletonSectionLabel />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </SkeletonPage>
  );
}
