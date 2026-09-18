import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Patikrina, ar dabartinis vartotojas yra PATVIRTINTAS admin arba super_admin.
 *
 * Skirtas server action'ams, kurie daro daugiau nei DB mutacijas
 * (SMS/email siuntimas, service-role naudojimas, failų trynimas) –
 * vien RLS jų neapsaugo, todėl rolė tikrinama eksplicitiškai.
 *
 * `is_approved` tikrinamas kartu su role: atšaukus prieigą
 * (`revokeUser()` → `is_approved=false`) profilis nustoja būti
 * administratoriumi iškart, o ne tik pasibaigus jo access token'ui. Tą patį
 * kontraktą DB pusėje įgyvendina `public.is_admin()` (migr. 048) – abu
 * sluoksniai turi sutapti, kitaip viena pusė praleistų tai, ką kita blokuoja.
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
    .select("role, is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !profile ||
    profile.is_approved !== true ||
    !["admin", "super_admin"].includes(profile.role)
  ) {
    return { error: "Trūksta teisių" };
  }

  return { user: { id: user.id } };
}
