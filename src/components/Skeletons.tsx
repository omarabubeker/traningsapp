import { Skeleton } from "@/components/ui/skeleton";

/** Laddningsplattor: grå platshållare i samma form som sidorna, så att inget hoppar när datan kommer. */

export function SkeletonPage({ children, className = "space-y-7 pt-4" }: { children: React.ReactNode; className?: string }) {
  return (
    <main className={className} aria-busy="true" aria-label="Laddar">
      {children}
    </main>
  );
}

/** Rubrik med tillbakapil (detaljsidor). */
export function SkeletonBackHeader({ sub = true }: { sub?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="size-6 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-6 w-44" />
        {sub && <Skeleton className="h-3 w-32" />}
      </div>
    </div>
  );
}

export function SkeletonTitle({ className = "h-8 w-36" }: { className?: string }) {
  return <Skeleton className={className} />;
}

export function SkeletonSectionLabel() {
  return <Skeleton className="h-3.5 w-28" />;
}

/** Kort med en eller två textrader. */
export function SkeletonCard({ lines = 2, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`card space-y-2.5 ${className}`}>
      <Skeleton className="h-4 w-2/5" />
      {lines > 1 && <Skeleton className="h-3 w-3/4" />}
      {lines > 2 && <Skeleton className="h-3 w-1/2" />}
    </div>
  );
}

/** Rad i en lista (t.ex. ett löppass). */
export function SkeletonRow() {
  return (
    <div className="card flex items-center justify-between gap-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => <SkeletonRow key={i} />)}
    </div>
  );
}

/** Kort med en graf. */
export function SkeletonChart({ height = "h-44" }: { height?: string }) {
  return (
    <div className="card space-y-3">
      <Skeleton className="h-3.5 w-32" />
      <Skeleton className={`w-full rounded-xl ${height}`} />
    </div>
  );
}

/** Rutnät med nyckeltal. */
export function SkeletonStats({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card space-y-2 p-3">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Gympasset medan det laddas (används både av loading.tsx och loggern). */
export function GymSessionSkeleton() {
  return (
    <SkeletonPage className="space-y-4 pt-3">
      <div className="flex items-center gap-3">
        <Skeleton className="size-6 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
      <SkeletonCard />
      <SkeletonCard />
      <Skeleton className="h-12 w-full rounded-xl" />
    </SkeletonPage>
  );
}
