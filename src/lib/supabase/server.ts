import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Anropat från en Server Component – proxy.ts sköter förnyelsen.
        }
      },
    },
  });
}

/** Hämtar inloggad användare (verifierad JWT) eller skickar till /login. */
export async function requireUser() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  return { supabase, user: { id: claims.sub, email: (claims.email as string | undefined) ?? "" } };
}
