import { SkeletonBackHeader, SkeletonChart, SkeletonPage, SkeletonRows, SkeletonSectionLabel } from "@/components/Skeletons";

export default function Loading() {
  return (
    <SkeletonPage className="space-y-7 pt-3">
      <SkeletonBackHeader />
      <SkeletonChart />
      <div className="space-y-2">
        <SkeletonSectionLabel />
        <SkeletonRows count={4} />
      </div>
    </SkeletonPage>
  );
}
