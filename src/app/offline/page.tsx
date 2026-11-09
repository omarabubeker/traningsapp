export default function Offline() {
  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="mb-2 text-xl font-semibold">Ingen uppkoppling</h1>
      <p className="text-muted-foreground">Sidan är inte sparad offline än. Set du redan loggat sparas och skickas när nätet är tillbaka.</p>
    </main>
  );
}
