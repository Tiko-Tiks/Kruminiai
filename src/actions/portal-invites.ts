"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient, isAdminClientAvailable } from "@/lib/supabase-admin";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { vocative } from "@/lib/utils";

export interface MemberAccountStatus {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  status: string;
  has_account: boolean;
  is_approved: boolean;
}

/**
 * Grąžina aktyvių+pasyvių narių sąrašą su paskyros statusu:
 *   has_account=true  → narys jau turi profiles įrašą su member_id susiejimu
 *   has_account=false → narys neturi paskyros (kandidatas masiniam kvietimui)
 *
 * Be el. pašto narius rodom kaip „has_account=false" – jiems negalima sukurti
 * paskyros kol nepridės email'o.
 */
export async function getMembersAccountStatus(): Promise<MemberAccountStatus[]> {
  const supabase = createServerSupabaseClient();

  const { data: members, error: memErr } = await supabase
    .from("members")
    .select("id, first_name, last_name, email, status")
    .in("status", ["aktyvus", "pasyvus"])
    .order("first_name", { ascending: true })
    .order("last_name", { ascending: true });
  if (memErr) throw memErr;

  // Profiles su member_id ir is_approved
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("member_id, is_approved")
    .not("member_id", "is", null);
  if (profErr) throw profErr;

  const profileByMember = new Map<string, { is_approved: boolean }>();
  for (const p of profiles || []) {
    if (p.member_id) profileByMember.set(p.member_id as string, { is_approved: !!p.is_approved });
  }

  return (members || []).map((m) => {
    const prof = profileByMember.get(m.id as string);
    return {
      id: m.id as string,
      first_name: m.first_name as string,
      last_name: m.last_name as string,
      email: (m.email as string | null) || null,
      status: m.status as string,
      has_account: !!prof,
      is_approved: prof?.is_approved || false,
    };
  });
}

/**
 * Sukuria paskyras pažymėtiems nariams (arba VISIEMS aktyviems+pasyviems su email,
 * kurie dar neturi paskyros).
 *
 * Sėkmingo kvietimo žingsniai vienam nariui:
 *   1) `auth.admin.createUser(email, randomPassword, email_confirm=true)`
 *   2) `handle_new_user` trigger'is auto-sukuria profiles įrašą
 *   3) Atnaujinam profiles: `member_id`, `role=member`, `is_approved=true`
 *   4) `auth.admin.generateLink(type=recovery)` – nuoroda slaptažodžio nustatymui
 *   5) Siunčiam brand'intą email'ą su nuoroda
 *   6) Audit log įrašas
 */
export async function bulkCreateMemberAccounts(memberIds?: string[]): Promise<{
  success?: boolean;
  error?: string;
  created?: number;
  emailed?: number;
  skipped?: number;
  errors?: { member: string; reason: string }[];
}> {
  if (!isAdminClientAvailable()) {
    return {
      error:
        "Trūksta SUPABASE_SERVICE_ROLE_KEY env var'o. Pridėkite jį prie " +
        ".env.local IR Vercel Dashboard'o (Settings → API → service_role).",
    };
  }

  const supabase = createServerSupabaseClient();
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
    return { error: "Trūksta teisių (reikia admin arba super_admin)" };
  }

  // Atrenkam aktyvius+pasyvius su email, kurie dar neturi paskyros
  let memQ = supabase
    .from("members")
    .select("id, first_name, last_name, email, status")
    .in("status", ["aktyvus", "pasyvus"])
    .not("email", "is", null);
  if (memberIds && memberIds.length > 0) {
    memQ = memQ.in("id", memberIds);
  }
  const { data: candidates, error: candErr } = await memQ;
  if (candErr) return { error: candErr.message };
  if (!candidates || candidates.length === 0) {
    return { error: "Nerasta tinkamų narių (aktyvūs/pasyvūs su el. paštu)" };
  }

  // Filtruojam tuos, kurie jau turi paskyrą
  const { data: existingProfiles } = await supabase
    .from("profiles")
    .select("member_id")
    .in(
      "member_id",
      candidates.map((m) => m.id as string)
    );
  const haveAccount = new Set(
    (existingProfiles || []).map((p) => p.member_id as string)
  );

  const toCreate = candidates.filter((m) => !haveAccount.has(m.id as string));
  if (toCreate.length === 0) {
    return {
      success: true,
      created: 0,
      emailed: 0,
      skipped: candidates.length,
      errors: [],
    };
  }

  const admin = createAdminSupabaseClient();
  let created = 0;
  let emailed = 0;
  const errors: { member: string; reason: string }[] = [];

  for (const m of toCreate) {
    const memberLabel = `${m.first_name} ${m.last_name}`;
    const email = m.email as string;
    try {
      // 1) Sukuriam auth.users (su atsitiktiniu slaptažodžiu)
      const tempPassword =
        Math.random().toString(36).slice(-12) +
        Math.random().toString(36).slice(-4).toUpperCase() +
        "1!";

      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: memberLabel,
        },
      });
      if (createErr || !newUser?.user) {
        // Detalus log'as serveryje, kad Vercel runtime log'uose matytume
        console.error("[bulk-invite] createUser failed", {
          member: memberLabel,
          email,
          error: createErr,
          errorCode: createErr?.code,
          errorStatus: createErr?.status,
        });
        errors.push({
          member: memberLabel,
          reason:
            createErr?.message ||
            (createErr ? JSON.stringify(createErr) : "createUser nepavyko (no detail)"),
        });
        continue;
      }
      created++;

      // 2) Atnaujinam profiles (member_id, is_approved, role)
      //    handle_new_user trigger'is jau sukūrė įrašą; mes tik atnaujinam.
      await supabase
        .from("profiles")
        .update({
          member_id: m.id,
          is_approved: true,
          role: "member",
        })
        .eq("id", newUser.user.id);

      // 3) Recovery link slaptažodžio nustatymui
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
      });
      if (linkErr || !linkData?.properties?.action_link) {
        errors.push({
          member: memberLabel,
          reason: "Paskyra sukurta, bet nepavyko sugeneruoti slaptažodžio nuorodos",
        });
        continue;
      }

      // 4) Brand'intas welcome email
      const html = renderWelcomeEmail({
        name: m.first_name as string,
        email,
        resetUrl: linkData.properties.action_link,
      });
      const emailResult = await sendEmail(
        email,
        "Jūsų paskyra sukurta – Krūminių kaimo bendruomenė",
        html
      );
      if (emailResult.success) {
        emailed++;
      } else {
        errors.push({
          member: memberLabel,
          reason: `Paskyra sukurta, email klaida: ${emailResult.error || "nežinoma"}`,
        });
      }

      // 5) Audit log
      await logAudit(supabase, {
        userId: user.id,
        action: "CREATE",
        tableName: "profiles",
        recordId: newUser.user.id,
        newData: {
          member_id: m.id,
          email,
          role: "member",
          is_approved: true,
          via: "bulk_invite",
        } as Record<string, unknown>,
      });
    } catch (e) {
      console.error("[bulk-invite] unexpected exception", { member: memberLabel, error: e });
      errors.push({
        member: memberLabel,
        reason: e instanceof Error ? `${e.message}` : `Nežinoma klaida: ${JSON.stringify(e)}`,
      });
    }
  }

  revalidatePath("/admin/nariai");
  revalidatePath("/admin/nariai/paskyros");

  return {
    success: true,
    created,
    emailed,
    skipped: candidates.length - toCreate.length,
    errors,
  };
}

/**
 * Pasiunčia slaptažodžio nustatymo nuorodą JAU egzistuojančiam vartotojui.
 * Naudinga, jei narys pamiršo slaptažodį arba pirminis welcome email nepasiekė.
 */
export async function resendPasswordSetupLink(memberId: string): Promise<{
  success?: boolean;
  error?: string;
}> {
  if (!isAdminClientAvailable()) {
    return { error: "Trūksta SUPABASE_SERVICE_ROLE_KEY env var'o" };
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Neautorizuotas" };

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!callerProfile || !["admin", "super_admin"].includes(callerProfile.role)) {
    return { error: "Trūksta teisių" };
  }

  const { data: member } = await supabase
    .from("members")
    .select("id, first_name, last_name, email")
    .eq("id", memberId)
    .single();
  if (!member || !member.email) {
    return { error: "Narys neturi el. pašto arba nerastas" };
  }

  const admin = createAdminSupabaseClient();
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: member.email as string,
  });
  if (linkErr || !linkData?.properties?.action_link) {
    return { error: linkErr?.message || "Nepavyko sugeneruoti nuorodos" };
  }

  const html = renderWelcomeEmail({
    name: member.first_name as string,
    email: member.email as string,
    resetUrl: linkData.properties.action_link,
    isResend: true,
  });
  const result = await sendEmail(
    member.email as string,
    "Slaptažodžio nustatymas – Krūminių kaimo bendruomenė",
    html
  );
  if (!result.success) {
    return { error: result.error || "Email siuntimo klaida" };
  }

  return { success: true };
}

function renderWelcomeEmail(opts: {
  name: string;
  email: string;
  resetUrl: string;
  isResend?: boolean;
}): string {
  const greetingName = vocative(opts.name);
  const intro = opts.isResend
    ? `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#1f2937;">Sveiki, ${greetingName},</p>
       <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#374151;">Štai nauja nuoroda slaptažodžiui nustatyti / pakeisti.</p>`
    : `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#1f2937;">Sveiki, ${greetingName},</p>
       <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#374151;">Jums sukurta paskyra Krūminių kaimo bendruomenės narių portale. Per ją galėsite:</p>
       <ul style="font-size:14px;line-height:1.7;margin:0 0 20px;padding-left:20px;color:#374151;">
         <li>matyti savo nario mokesčio istoriją ir likučius</li>
         <li>balsuoti visuotinių susirinkimų metu tiesiogiai (be SMS)</li>
         <li>skaityti bendruomenės dokumentus (protokolai, ataskaitos, įstatai)</li>
         <li>matyti susirinkimų rezultatus ir darbotvarkes</li>
         <li>atnaujinti savo kontaktinius duomenis</li>
       </ul>`;

  return renderBrandedEmail({
    preheader: opts.isResend
      ? "Nauja slaptažodžio nustatymo nuoroda"
      : `Jūsų paskyra sukurta. Nustatykite slaptažodį.`,
    body: `
      ${intro}
      <p style="font-size:14px;line-height:1.6;margin:0 0 8px;color:#374151;">Pirmiausia nustatykite savo slaptažodį:</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${opts.resetUrl}" style="display:inline-block;background-color:#15803d;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Nustatyti slaptažodį</a>
      </div>
      <p style="font-size:13px;line-height:1.6;margin:0 0 6px;color:#6b7280;">Po slaptažodžio nustatymo prisijungimui naudokite el. paštą:</p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 20px;color:#1f2937;font-weight:600;">${opts.email}</p>
      <p style="font-size:13px;line-height:1.6;margin:24px 0 0;color:#6b7280;font-style:italic;">Jei nuoroda nebeveiks (paprastai galioja 24 val.), naudokite „Pamiršau slaptažodį" funkciją kruminiai.lt/prisijungimas puslapyje.</p>
    `,
  });
}
