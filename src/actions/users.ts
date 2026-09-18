"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient, isAdminClientAvailable } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { logNotification } from "@/lib/notification-log";
import { renderPortalApprovalEmail } from "@/lib/portal-approval-email";
import { revalidatePath } from "next/cache";

/** Patvirtina portalo paskyrą. Narystė registruojama atskirai pagal Tarybos sprendimą. */
export async function approveUser(
  profileId: string
): Promise<{ success?: boolean; error?: string; createdMember?: boolean }> {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (!auth.user) return { error: auth.error };

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name, member_id, is_approved")
    .eq("id", profileId)
    .single();
  if (profErr || !profile) return { error: "Profilis nerastas" };

  // Ar tai TIKRAS patvirtinimas (false→true), ar pakartotinis? Laišką #2
  // siunčiam tik pirmą kartą patvirtinant, kad pakartotinis paspaudimas
  // arba atšaukimas+patvirtinimas iš naujo nedubliuotų pasveikinimo.
  const wasApproved = profile.is_approved === true;

  let memberId = (profile.member_id as string | null) ?? null;
  const createdMember = false;

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

    if (!memberId) {
      return { error: "Pirmiausia narių registre įrašykite raštiško prašymo ir Tarybos priėmimo sprendimo pagrindą bei nario el. paštą. Paskyros patvirtinimas narystės nesuteikia." };
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

  // Pirmą kartą patvirtinant (false→true):
  if (!wasApproved) {
    // 1) Patvirtinam el. paštą admin teisėmis. Be to narys, nepaspaudęs
    //    Supabase „Confirm email" nuorodos, NEGALĖTŲ prisijungti net po
    //    patvirtinimo (signInWithPassword grąžintų email_not_confirmed).
    //    Admin patvirtinimas yra vartai, todėl el. paštą patvirtinti saugu.
    if (isAdminClientAvailable()) {
      try {
        const admin = createAdminSupabaseClient();
        await admin.auth.admin.updateUserById(profileId, { email_confirm: true });
      } catch (e) {
        console.warn("[approveUser] email_confirm nepavyko:", e);
      }
    }

    // 2) Portalo prieigos pranešimas jau priimtam nariui.
    //    Kalba – pagal nario `language` lauką (admin gali nustatyti 'en').
    if (memberId) {
      const { data: member } = await supabase
        .from("members")
        .select("first_name, email, language, status")
        .eq("id", memberId)
        .single();
      if (member?.email) {
        const locale = member.language === "en" ? "en" : "lt";
        const subject =
          locale === "en"
            ? "Your Krūminiai portal account is active"
            : "Jūsų Krūminių portalo paskyra aktyvuota";
        const html = renderPortalApprovalEmail({
          firstName: member.first_name as string,
          locale,
        });
        const r = await sendEmail(member.email as string, subject, html);
        await logNotification(supabase, {
          memberId,
          channel: "email",
          kind: "other",
          recipient: member.email as string,
          subject,
          message: html,
          status: r.success ? "sent" : "failed",
          error: r.success ? null : r.error,
          externalId: r.messageId ?? null,
        });
      }
    }
  }

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
