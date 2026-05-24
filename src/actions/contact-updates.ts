"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { sendSms } from "@/lib/infobip";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import crypto from "crypto";

export interface MemberContactStatus {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  last_token_sent_at: string | null;
  last_token_viewed_at: string | null;
  last_token_completed_at: string | null;
}

/**
 * Grąžina aktyvių+pasyvių narių sąrašą su tokenų statusu:
 *   • be el. pašto, su telefonu – galima siųsti SMS
 *   • be telefono – negalima (negausi nuorodos)
 *   • su el. paštu – jau yra (nereikia siųsti)
 */
export async function getMembersForContactUpdate(): Promise<MemberContactStatus[]> {
  const supabase = createServerSupabaseClient();

  const { data: members } = await supabase
    .from("members")
    .select("id, first_name, last_name, email, phone, status")
    .in("status", ["aktyvus", "pasyvus"])
    .order("first_name", { ascending: true });

  if (!members) return [];

  // Paskutinis tokeno įrašas kiekvienam
  const { data: tokens } = await supabase
    .from("contact_update_tokens")
    .select("member_id, sent_at, viewed_at, completed_at")
    .order("sent_at", { ascending: false });

  const latestByMember = new Map<
    string,
    { sent_at: string; viewed_at: string | null; completed_at: string | null }
  >();
  for (const t of tokens || []) {
    if (!latestByMember.has(t.member_id as string)) {
      latestByMember.set(t.member_id as string, {
        sent_at: t.sent_at as string,
        viewed_at: (t.viewed_at as string | null) || null,
        completed_at: (t.completed_at as string | null) || null,
      });
    }
  }

  return members.map((m) => {
    const latest = latestByMember.get(m.id as string);
    return {
      id: m.id as string,
      first_name: m.first_name as string,
      last_name: m.last_name as string,
      email: (m.email as string | null) || null,
      phone: (m.phone as string | null) || null,
      status: m.status as string,
      last_token_sent_at: latest?.sent_at || null,
      last_token_viewed_at: latest?.viewed_at || null,
      last_token_completed_at: latest?.completed_at || null,
    };
  });
}

const sendContactUpdateSmsSchema = z.object({
  member_ids: z.array(z.string().regex(/^[0-9a-f-]{36}$/i)),
});

/**
 * Generuoja unikalius tokenus pažymėtiems nariams ir siunčia SMS.
 *
 * SMS turinys (GSM-7, be lt diakritikos, <=160 simb.):
 *   "Sveiki, [Vardenis]. Atnaujinkite kontaktus Kruminiu bendruomenes
 *    sistemoje: kruminiai.lt/duomenys/[token]"
 *
 * Token: 16-baitų hex (32 simb.), URL-safe.
 */
export async function sendContactUpdateSmsBatch(memberIds: string[]): Promise<{
  success?: boolean;
  error?: string;
  sent?: number;
  failed?: number;
  errors?: { member: string; reason: string }[];
}> {
  const parsed = sendContactUpdateSmsSchema.safeParse({ member_ids: memberIds });
  if (!parsed.success) return { error: "Netinkami narių ID" };

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
    return { error: "Trūksta teisių" };
  }

  // Gaunam narių duomenis – tik tuos, kurie turi telefoną
  const { data: members } = await supabase
    .from("members")
    .select("id, first_name, last_name, phone")
    .in("id", memberIds)
    .in("status", ["aktyvus", "pasyvus"])
    .not("phone", "is", null);

  if (!members || members.length === 0) {
    return { error: "Nerasta narių su telefonu" };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kruminiai.lt";
  let sent = 0;
  let failed = 0;
  const errors: { member: string; reason: string }[] = [];

  for (const m of members) {
    const memberLabel = `${m.first_name} ${m.last_name}`;
    const phone = m.phone as string;
    const firstName = m.first_name as string;

    try {
      // 1) Sukuriam tokeną
      const token = crypto.randomBytes(16).toString("hex");
      const { error: tokenErr } = await supabase
        .from("contact_update_tokens")
        .insert({
          token,
          member_id: m.id,
          created_by: user.id,
        });
      if (tokenErr) {
        errors.push({ member: memberLabel, reason: tokenErr.message });
        failed++;
        continue;
      }

      // 2) Siunčiam SMS – GSM-7 saugomas tekstas (be diakritikos), <=160 simb.
      const text = `Sveiki, ${firstName.normalize("NFD").replace(/[̀-ͯ]/g, "")}. Atnaujinkite kontaktus Kruminiu bendruomenes sistemoje: ${siteUrl.replace(/^https?:\/\//, "")}/duomenys/${token}`;
      const smsResult = await sendSms(phone, text);

      // Log į notification_log
      await supabase.from("notification_log").insert({
        member_id: m.id,
        channel: "sms",
        kind: "contact_update",
        recipient: phone.replace(/^\+/, ""),
        message: text,
        status: smsResult.success ? "sent" : "failed",
        error: smsResult.error || null,
        external_id: smsResult.messageId || null,
        segments: 1,
        created_by: user.id,
      });

      if (smsResult.success) {
        sent++;
      } else {
        failed++;
        errors.push({
          member: memberLabel,
          reason: smsResult.error || "SMS klaida",
        });
      }
    } catch (e) {
      failed++;
      errors.push({
        member: memberLabel,
        reason: e instanceof Error ? e.message : "Nežinoma klaida",
      });
    }
  }

  await logAudit(supabase, {
    userId: user.id,
    action: "CREATE",
    tableName: "contact_update_tokens",
    recordId: "batch",
    newData: { sent, failed, total: memberIds.length } as Record<string, unknown>,
  });

  revalidatePath("/admin/nariai/kontaktai");
  revalidatePath("/admin/nariai");

  return { success: true, sent, failed, errors };
}
