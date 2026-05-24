import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase klientas – APEINA RLS, naudoja `SUPABASE_SERVICE_ROLE_KEY`.
 * Skirtas TIK server-side admin operacijoms (vartotojų kūrimas, masinis
 * narystės valdymas, generateLink ir pan.). Niekada neperduoti kliento pusėje.
 *
 * Aplinkoje turi būti nustatyta:
 *   SUPABASE_SERVICE_ROLE_KEY=... (Supabase Dashboard → Settings → API → service_role)
 *
 * Jei rakto nėra – funkcija mes klaidą, ne tyliai mock'ins. Tai sąmoningas
 * pasirinkimas, kad bandymas vykdyti admin operaciją be rakto būtų pastebėtas.
 */

let cached: SupabaseClient | null = null;

export function createAdminSupabaseClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Trūksta NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!serviceKey) {
    throw new Error(
      "Trūksta SUPABASE_SERVICE_ROLE_KEY env var'o. " +
        "Pridėkite jį prie .env.local IR į Vercel Dashboard'ą " +
        "(Settings → API → service_role)."
    );
  }

  cached = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}

export function isAdminClientAvailable(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
