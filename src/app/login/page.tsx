import { LoginForm } from "./LoginForm";

const NOTICE: Record<string, string> = {
  ogiltig: "Länken fungerar inte. Kontrollera att du kopierat hela länken, eller be om en ny.",
  avstangd: "Den här länken är avstängd. Hör av dig till den som bjöd in dig.",
  fel: "Inloggningen misslyckades. Försök igen om en stund.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ lank?: string }> }) {
  const { lank } = await searchParams;
  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="h-page mb-1">Träning</h1>
      <p className="mb-8 text-muted-foreground">Logga in med din personliga länk.</p>
      <LoginForm notice={lank ? (NOTICE[lank] ?? NOTICE.fel) : null} />
    </main>
  );
}
