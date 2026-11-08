export default function Loading() {
  return (
    <main className="animate-pulse space-y-5 pt-4" aria-busy="true" aria-label="Laddar">
      <div className="h-8 w-40 rounded-lg bg-surface-2" />
      <div className="h-24 rounded-2xl bg-surface" />
      <div className="grid grid-cols-3 gap-3">
        <div className="h-16 rounded-2xl bg-surface" />
        <div className="h-16 rounded-2xl bg-surface" />
        <div className="h-16 rounded-2xl bg-surface" />
      </div>
      <div className="h-16 rounded-2xl bg-surface" />
      <div className="h-16 rounded-2xl bg-surface" />
    </main>
  );
}
