"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient, isAdminClientAvailable } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

/**
 * Patvirtina portalo vartotoją (is_approved=true) IR užtikrina, kad jis
 * egzistuoja narių registre (`members`).
 *
 * Kontekstas: self-registracijos atveju (`/registracija`) `handle_new_user`
 * trigger'is sukuria TIK `profiles` įrašą. Jei pagal el. paštą nerandamas
 * esamas narys, `member_id` lieka NULL – t.y. žmogus turi portalo paskyrą,
 * bet NEatsiranda `/admin/nariai` ir nepatenka į balsavimo / mokesčių
 * srautus. Patvirtinant tą spragą užpildome: jei profilis dar nesusietas,
 * automatiškai sukuriamas (arba prisiejamas pagal el. paštą) `members` įrašas.
 */
export async function approveUser(
  profileId: string
): Promise<{ success?: boolean; error?: string; createdMember?: boolean }> {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (!auth.user) return { error: auth.error };

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name, member_id")
    .eq("id", profileId)
    .single();
  if (profErr || !profile) return { error: "Profilis nerastas" };

  let memberId = (profile.member_id as string | null) ?? null;
  let createdMember = false;

  if (!memberId) {
    // El. paštą imam iš auth.users (tik service-role klientas mato auth schemą).
    let email: string | null = null;
    if (isAdminClientAvailable()) {
      const admin = createAdminSupabaseClient();
      const { data: authUser } = await admin.auth.admin.getUserById(profileId);
      email = authUser?.user?.email ?? null;
    }

    // Jei narys tokiu el. paštu jau yra – prisiejam, kad nesukurtume dublikato.
    if (email) {
      const { data: existing } = await supabase
        .from("members")
        .select("id")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (existing) memberId = existing.id as string;
    }

    // Naujas žmogus – sukuriam narį iš profilio duomenų.
    if (!memberId) {
      const fullName = ((profile.full_name as string) || "").trim();
      const parts = fullName.split(/\s+/).filter(Boolean);
      const firstName = parts[0] || fullName || "Narys";
      const lastName = parts.slice(1).join(" ") || "—";

      const { data: newMember, error: memErr } = await supabase
        .from("members")
        .insert({
          first_name: firstName,
          last_name: lastName,
          email,
          status: "aktyvus",
          created_by: auth.user.id,
          notes: "Sukurta automatiškai patvirtinant portalo registraciją.",
        })
        .select("id")
        .single();
      if (memErr || !newMember) {
        return { error: `Nepavyko sukurti nario: ${memErr?.message ?? "nežinoma klaida"}` };
      }
      memberId = newMember.id as string;
      createdMember = true;

      await logAudit(supabase, {
        userId: auth.user.id,
        action: "CREATE",
        tableName: "members",
        recordId: memberId,
        newData: { first_name: firstName, last_name: lastName, email, via: "approve_user" },
      });
    }
  }

  const { error: updErr } = await supabase
    .from("profiles")
    .update({ is_approved: true, member_id: memberId })
    .eq("id", profileId);
  if (updErr) return { error: updErr.message };

  await logAudit(supabase, {
    userId: auth.user.id,
    action: "UPDATE",
    tableName: "profiles",
    recordId: profileId,
    newData: { is_approved: true, member_id: memberId, via: "approve_user" },
  });

  revalidatePath("/admin/vartotojai");
  revalidatePath("/admin/nariai");
  return { success: true, createdMember };
}

/**
 * Atšaukia patvirtinimą (is_approved=false). Nario įrašo (`members`) neliečia –
 * narystės pabaiga yra Tarybos kompetencija, ne portalo prieigos atšaukimas.
 */
export async function revokeUser(
  profileId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (!auth.user) return { error: auth.error };

  const { error } = await supabase
    .from("profiles")
    .update({ is_approved: false })
    .eq("id", profileId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: auth.user.id,
    action: "UPDATE",
    tableName: "profiles",
    recordId: profileId,
    newData: { is_approved: false, via: "revoke_user" },
  });

  revalidatePath("/admin/vartotojai");
  return { success: true };
}
