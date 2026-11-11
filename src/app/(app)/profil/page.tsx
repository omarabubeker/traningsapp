import { requireUser } from "@/lib/supabase/server";
import type { Profile, WeightEntry } from "@/lib/types";
import { ProfileForm } from "./ProfileForm";
import { WeightLog } from "./WeightLog";
import { signOut } from "@/app/login/actions";
import Link from "next/link";
import { CardHead, IconBadge } from "@/components/CardParts";
import { ThemeSelect } from "@/components/ThemeSelect";
import { CaretRight, CircleHalf, Gear } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: weights }] = await Promise.all([
    supabase.from("profile").select("*").maybeSingle(),
    supabase.from("weight_entries").select("id, measured_on, weight_kg").order("measured_on", { ascending: false }).limit(60),
  ]);

  return (
    <main className="space-y-7 pt-4">
      <h1 className="h-page">Profil</h1>
      <WeightLog initial={(weights ?? []) as WeightEntry[]} />
      <ProfileForm initial={profile as Profile | null} userId={user.id} />
      <section className="card space-y-4">
        <CardHead icon={CircleHalf} tone="brand" title="Utseende" />
        <ThemeSelect />
        <p className="text-xs text-muted-foreground">Auto följer telefonens ljusa eller mörka läge.</p>
      </section>
      <Link href="/installningar" className="card flex items-center gap-3 active:bg-secondary">
        <IconBadge icon={Gear} tone="muted" />
        <span className="min-w-0 flex-1 font-semibold">Inställningar, synk och import</span>
        <CaretRight size={14} weight="bold" className="text-muted-foreground" />
      </Link>
      <form action={signOut} className="pt-2 text-center">
        <p className="mb-2 text-xs text-muted-foreground">Inloggad som {user.email}</p>
        <button className="text-sm text-danger">Logga ut</button>
      </form>
    </main>
  );
}
