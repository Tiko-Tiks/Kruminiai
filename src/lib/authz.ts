import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Patikrina, ar dabartinis vartotojas yra admin arba super_admin.
 *
 * Skirtas server action'ams, kurie daro daugiau nei DB mutacijas
 * (SMS/email siuntimas, service-role naudojimas, failų trynimas) –
 * vien RLS jų neapsaugo, todėl rolė tikrinama eksplicitiškai.
 */
export async function requireAdmin(
  supabase: SupabaseClient
): Promise<{ user: { id: string }; error?: never } | { user?: never; error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Neautorizuotas" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return { error: "Trūksta teisių" };
  }

  return { user: { id: user.id } };
}
