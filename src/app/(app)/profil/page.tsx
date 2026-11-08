import { requireUser } from "@/lib/supabase/server";
import type { Profile, WeightEntry } from "@/lib/types";
import { ProfileForm } from "./ProfileForm";
import { WeightLog } from "./WeightLog";
import { signOut } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: weights }] = await Promise.all([
    supabase.from("profile").select("*").maybeSingle(),
    supabase.from("weight_entries").select("id, measured_on, weight_kg").order("measured_on", { ascending: false }).limit(60),
  ]);

  return (
    <main className="space-y-6 pt-4">
      <h1 className="text-2xl font-semibold">Profil</h1>
      <WeightLog initial={(weights ?? []) as WeightEntry[]} />
      <ProfileForm initial={profile as Profile | null} userId={user.id} />
      <form action={signOut} className="pt-2 text-center">
        <p className="mb-2 text-xs text-muted">Inloggad som {user.email}</p>
        <button className="text-sm text-danger">Logga ut</button>
      </form>
    </main>
  );
}
