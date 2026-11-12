import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isOwner } from "@/lib/owner";
import { memberLink, newToken, type Member } from "@/lib/members";
import { USD_TO_SEK } from "@/lib/coach/pricing";
import { formatDate, isoDay } from "@/lib/dates";
import type { Challenge } from "@/lib/challenges";
import { ChallengeAdmin } from "./ChallengeAdmin";
import { AddMember } from "./AddMember";
import { MemberCard } from "./MemberCard";

export const dynamic = "force-dynamic";

/** Ägarens admin-vy: medlemmar och deras personliga länkar. */
export default async function AdminPage() {
  const { supabase, user } = await requireUser();
  if (!isOwner(user.email)) notFound();
  const admin = supabaseAdmin();

  // Ägaren finns alltid med (med egen länk).
  const { data: me } = await admin.from("members").select("id").eq("email", user.email.toLowerCase()).maybeSingle();
  if (!me) {
    const { data: prof } = await supabase.from("profile").select("display_name").maybeSingle();
    await admin.from("members").insert({ email: user.email.toLowerCase(), name: prof?.display_name || "Jag", token: newToken(), user_id: user.id });
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const today = isoDay();
  const [{ data: rows }, { data: usage }, { data: chRows }] = await Promise.all([
    admin.from("members").select("*").order("created_at"),
    admin.from("llm_usage").select("user_id, cost_usd").gte("created_at", monthStart),
    admin.from("challenges").select("*").order("start_date", { ascending: false }).limit(20),
  ]);
  const cost = new Map<string, number>();
  for (const u of usage ?? []) cost.set(u.user_id, (cost.get(u.user_id) ?? 0) + Number(u.cost_usd));

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const members = (rows ?? []) as Member[];

  return (
    <main className="space-y-7 pt-3">
      <header className="flex items-center gap-3">
        <Link href="/profil" className="-ml-2 flex size-10 items-center justify-center rounded-full text-foreground active:bg-secondary" aria-label="Tillbaka"><CaretLeft size={22} weight="bold" /></Link>
        <h1 className="h-detail">Medlemmar och challenger</h1>
      </header>
      <p className="-mt-3 text-sm text-muted-foreground">Den här sidan ser bara du.</p>

      <section className="space-y-3">
        <h2 className="h-section">Challenger</h2>
        <ChallengeAdmin challenges={(chRows ?? []) as Challenge[]} today={today} defaultEnd={isoDay(new Date(now.getTime() + 30 * 864e5))} />
      </section>

      <section className="space-y-3">
        <h2 className="h-section">Medlemmar</h2>
        <p className="text-sm text-muted-foreground">Varje person loggar in med sin personliga länk – inget lösenord, ingen kod.</p>
        <AddMember />
        {members.map((m) => (
          <MemberCard
            key={m.id}
            id={m.id}
            name={m.name}
            email={m.email}
            link={memberLink(origin, m.token)}
            active={m.active}
            lastLogin={m.last_login_at ? formatDate(m.last_login_at, { day: "numeric", month: "short" }) : null}
            usage={m.user_id && cost.get(m.user_id) ? `${(cost.get(m.user_id)! * USD_TO_SEK).toLocaleString("sv-SE", { maximumFractionDigits: 0 })} kr` : null}
            isSelf={m.user_id === user.id || m.email === user.email.toLowerCase()}
          />
        ))}
      </section>
    </main>
  );
}
