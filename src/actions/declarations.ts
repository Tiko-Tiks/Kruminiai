"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";
import { sendSms, normalizePhone } from "@/lib/infobip";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import { logNotification } from "@/lib/notification-log";
import { getMembersWithDebts } from "@/actions/reminders";
import { vocative } from "@/lib/utils";
import type { ChannelChoice } from "@/actions/reminders";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

const BANK_NAME = "AB Artea bankas";
const BANK_ACCOUNT = "LT167181200000606866";
const BANK_RECIPIENT = "Krūminių kaimo bendruomenė";

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    "https://kruminiai.lt"
  ).replace(/\/$/, "");
}

function generateToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

const EXPIRES_AT = "2026-05-23 14:00:00+00"; // iki susirinkimo

// =============================================================================
// Generuoti tokenus visiems aktyviems nariams + siųsti SMS
// =============================================================================
export async function generateAndSendDeclarations() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Tik skolingi nariai – kurie pilnai atsiskaitė, jiems siūsti nereikia
  // (mokėjimas reiškia, kad jie tęsia narystę).
  const { members: debtors } = await getMembersWithDebts();
  const members = debtors;

  if (!members || members.length === 0)
    return { success: false as const, error: "Skolingų narių nėra – siųsti nereikia" };

  const baseUrl = getBaseUrl();
  const batchId = crypto.randomUUID();
  let smsSent = 0;
  let smsSkipped = 0;
  const errors: string[] = [];

  for (const m of members) {
    if (!m.phone) {
      smsSkipped++;
      continue;
    }

    // Patikrinti egzistuojantį tokeną
    const { data: existing } = await supabase
      .from("membership_declarations")
      .select("token, submitted_at")
      .eq("member_id", m.id)
      .maybeSingle();

    let token = existing?.token;

    if (!existing) {
      token = generateToken();
      const { error: insertErr } = await supabase
        .from("membership_declarations")
        .insert({
          member_id: m.id,
          token,
          expires_at: EXPIRES_AT,
        });
      if (insertErr) {
        errors.push(`${m.first_name} ${m.last_name}: ${insertErr.message}`);
        continue;
      }
    } else if (existing.submitted_at) {
      // Jau atsakė – nesiunčiame
      smsSkipped++;
      continue;
    }

    const url = `${baseUrl}/deklaracija/${token}`;
    const text = `Sveiki, ${m.first_name}. Galbut pamirsote nario mokesti. Patvirtinkit duomenis ir mokejima: ${url}`;

    const result = await sendSms(m.phone, text);
    await logNotification(supabase, {
      memberId: m.id,
      channel: "sms",
      kind: "membership_declaration",
      recipient: normalizePhone(m.phone) ?? m.phone,
      message: text,
      status: result.success ? "sent" : "failed",
      error: result.success ? null : result.error,
      externalId: result.messageId ?? null,
      batchId,
      segments: 1,
    });
    if (result.success) {
      await supabase
        .from("membership_declarations")
        .update({ sent_at: new Date().toISOString() })
        .eq("token", token!);
      smsSent++;
    } else {
      errors.push(`${m.first_name} ${m.last_name}: ${result.error}`);
    }
  }

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "notification_log",
    recordId: batchId,
    newData: {
      batch_kind: "membership_declaration",
      smsSent,
      smsSkipped,
      errorsCount: errors.length,
    },
  });

  revalidatePath("/admin/nariai/deklaracija");
  return { success: true as const, smsSent, smsSkipped, errors };
}

// =============================================================================
// Mokesčių priminimas su deklaracijos nuoroda – pasirenkamiems nariams,
// pasirenkamu kanalu (Email + SMS). Naudojama /admin/mokesciai/[id]/priminimai.
// =============================================================================
export interface ReminderResultDecl {
  total: number;
  emailsSent: number;
  smsSent: number;
  emailErrors: number;
  smsErrors: number;
  skipped: number;
  errors: string[];
}

export async function sendOverdueDeclarationReminders(
  memberIds: string[],
  channel: ChannelChoice = "both"
) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!memberIds || memberIds.length === 0) {
    return { success: false as const, error: "Nepasirinkti nariai" };
  }

  // Gauname pilnus skolininkų duomenis + filtruojame pagal pasirinktus ID'us
  const { members: allDebtors } = await getMembersWithDebts();
  const debtors = allDebtors.filter((m) => memberIds.includes(m.id));

  if (debtors.length === 0) {
    return { success: false as const, error: "Iš pasirinktų narių nė vienas neturi skolos" };
  }

  const baseUrl = getBaseUrl();
  const batchId = crypto.randomUUID();

  const result: ReminderResultDecl = {
    total: debtors.length,
    emailsSent: 0,
    smsSent: 0,
    emailErrors: 0,
    smsErrors: 0,
    skipped: 0,
    errors: [],
  };

  for (const m of debtors) {
    let sentSomething = false;
    const totalEur = (m.totalCents / 100).toFixed(2);
    const yearsList = m.unpaidPeriods.map((p) => p.year).join(", ");

    // 1) Užtikrinti, kad yra tokenas (sukurti, jei reikia)
    const { data: existing } = await supabase
      .from("membership_declarations")
      .select("token, submitted_at")
      .eq("member_id", m.id)
      .maybeSingle();

    let token = existing?.token;
    if (!token) {
      token = generateToken();
      const { error: insErr } = await supabase
        .from("membership_declarations")
        .insert({ member_id: m.id, token, expires_at: EXPIRES_AT });
      if (insErr) {
        result.errors.push(`${m.first_name} ${m.last_name}: ${insErr.message}`);
        continue;
      }
    } else if (existing?.submitted_at) {
      // Jau atsakė – nereikia kartoti
      result.skipped++;
      continue;
    }

    const url = `${baseUrl}/deklaracija/${token}`;

    // 2) Email
    if ((channel === "both" || channel === "email") && m.email && m.email.trim()) {
      const periodsRows = m.unpaidPeriods
        .map(
          (p) => `
            <tr>
              <td style="padding:8px 12px 8px 0;border-bottom:1px solid #fee2e2;color:#374151;">${p.year} m. metinis mokestis</td>
              <td style="padding:8px 0;border-bottom:1px solid #fee2e2;text-align:right;font-weight:700;color:#991b1b;">${(p.amount_cents / 100).toFixed(2)} EUR</td>
            </tr>`
        )
        .join("");

      const html = renderBrandedEmail({
        preheader: `Pradelstas nario mokestis ${totalEur} EUR. Patvirtinkit narystę spustelėję mygtuką.`,
        body: `
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f3d20;">Sveiki, ${vocative(m.first_name)}!</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">
            Primename, kad pagal mūsų duomenis turite <strong>nesumokėtą Krūminių kaimo bendruomenės nario mokestį</strong>.
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fef3f2;border-left:3px solid #dc2626;border-radius:4px;margin:0 0 20px;">
            <tr>
              <td style="padding:16px 20px;">
                <div style="font-size:13px;color:#991b1b;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Pradelsti mokesčiai</div>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:14px;">
                  ${periodsRows}
                  <tr>
                    <td style="padding:10px 12px 0 0;font-weight:700;color:#111827;">Iš viso skola:</td>
                    <td style="padding:10px 0 0;text-align:right;font-weight:700;font-size:18px;color:#991b1b;">${totalEur} EUR</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#374151;">
            Prašome <strong>patvirtinti narystę</strong> ir pasirinkti tolesnius veiksmus (sumokėti grynais, sumokėti pavedimu arba išstoti) paspaudę mygtuką žemiau:
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
            <tr>
              <td style="border-radius:8px;background:#15803d;">
                <a href="${url}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;font-family:Arial,Helvetica,sans-serif;">Patvirtinti narystę</a>
              </td>
            </tr>
          </table>

          <p style="margin:24px 0 16px;font-size:13px;color:#6b7280;line-height:1.6;">
            Jei mygtukas neveikia, nukopijuokite šią nuorodą į naršyklę:<br>
            <a href="${url}" style="color:#15803d;word-break:break-all;">${url}</a>
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0fdf4;border-left:3px solid #15803d;border-radius:4px;margin:24px 0 16px;">
            <tr>
              <td style="padding:16px 20px;">
                <div style="font-size:13px;color:#166534;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">Mokėjimo rekvizitai (jei sumokėsite iškart)</div>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;color:#374151;line-height:1.7;">
                  <tr><td style="padding-right:12px;color:#6b7280;">Gavėjas:</td><td style="font-weight:600;color:#111827;">${BANK_RECIPIENT}</td></tr>
                  <tr><td style="padding-right:12px;color:#6b7280;">Sąskaita:</td><td style="font-family:monospace;font-weight:600;color:#111827;">${BANK_ACCOUNT}</td></tr>
                  <tr><td style="padding-right:12px;color:#6b7280;">Bankas:</td><td style="color:#111827;">${BANK_NAME}</td></tr>
                  <tr><td style="padding-right:12px;color:#6b7280;">Suma:</td><td style="font-weight:700;color:#15803d;">${totalEur} EUR</td></tr>
                  <tr><td style="padding-right:12px;color:#6b7280;">Paskirtis:</td><td style="color:#111827;">Nario mokestis (${yearsList}) – ${m.first_name} ${m.last_name}</td></tr>
                </table>
              </td>
            </tr>
          </table>

          <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#374151;">
            Pagarbiai,<br>
            <strong style="font-size:15px;color:#0f3d20;">Mindaugas Mameniškis</strong><br>
            <span style="color:#6b7280;font-size:13px;">Bendruomenės pirmininkas</span>
          </p>
        `,
      });

      const subject = `Krūminių bendruomenė: nario mokesčio skola ${totalEur} EUR – patvirtinkit narystę`;
      const r = await sendEmail(m.email.trim(), subject, html);
      await logNotification(supabase, {
        memberId: m.id,
        channel: "email",
        kind: "membership_declaration",
        recipient: m.email.trim(),
        subject,
        message: html,
        status: r.success ? "sent" : "failed",
        error: r.success ? null : r.error,
        externalId: r.messageId ?? null,
        batchId,
      });
      if (r.success) {
        result.emailsSent++;
        sentSomething = true;
      } else {
        result.emailErrors++;
        result.errors.push(`Email ${m.first_name} ${m.last_name}: ${r.error}`);
      }
    }

    // 3) SMS
    if ((channel === "both" || channel === "sms") && m.phone) {
      const normalized = normalizePhone(m.phone);
      if (normalized) {
        // ~135 simb. – telpa į 1 SMS (GSM-7, be lt diakritikos)
        const text = `Sveiki, ${m.first_name}. Pradelstas nario mokestis ${totalEur} EUR. Patvirtinkit naryste: ${url}`;
        const r = await sendSms(m.phone, text);
        await logNotification(supabase, {
          memberId: m.id,
          channel: "sms",
          kind: "membership_declaration",
          recipient: normalized,
          message: text,
          status: r.success ? "sent" : "failed",
          error: r.success ? null : r.error,
          externalId: r.messageId ?? null,
          batchId,
          segments: 1,
        });
        if (r.success) {
          result.smsSent++;
          sentSomething = true;
        } else {
          result.smsErrors++;
          result.errors.push(`SMS ${m.first_name} ${m.last_name}: ${r.error}`);
        }
      }
    }

    // 4) Atnaujinti sent_at deklaracijoje (jei kažką pasiuntėm)
    if (sentSomething && token) {
      await supabase
        .from("membership_declarations")
        .update({ sent_at: new Date().toISOString() })
        .eq("token", token);
    }

    if (!sentSomething) result.skipped++;
  }

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "notification_log",
    recordId: batchId,
    newData: {
      batch_kind: "overdue_declaration_reminder",
      channel,
      requested: memberIds.length,
      total: result.total,
      emails: result.emailsSent,
      sms: result.smsSent,
      email_errors: result.emailErrors,
      sms_errors: result.smsErrors,
      skipped: result.skipped,
    },
  });

  revalidatePath("/admin/mokesciai");
  revalidatePath("/admin/nariai/deklaracija");
  return { success: true as const, batchId, ...result };
}

// =============================================================================
// Pakartotinis SMS – tik nesumokėjusiems / neatsakiusiems
// =============================================================================
export async function resendDeclarationSms() {
  const supabase = createServerSupabaseClient();

  const { data: tokens } = await supabase
    .from("membership_declarations")
    .select("token, member_id, members(first_name, last_name, phone)")
    .is("submitted_at", null);

  if (!tokens || tokens.length === 0) {
    return { success: true as const, smsSent: 0, errors: [] };
  }

  const baseUrl = getBaseUrl();
  let smsSent = 0;
  const errors: string[] = [];

  const batchId = crypto.randomUUID();
  for (const t of tokens) {
    const member = Array.isArray(t.members) ? t.members[0] : t.members;
    if (!member?.phone) continue;

    const url = `${baseUrl}/deklaracija/${t.token}`;
    const text = `Sveiki, ${member.first_name}. Priminam del nario mokescio - patvirtinkit duomenis: ${url}`;

    const r = await sendSms(member.phone, text);
    await logNotification(supabase, {
      memberId: t.member_id,
      channel: "sms",
      kind: "membership_declaration",
      recipient: normalizePhone(member.phone) ?? member.phone,
      message: text,
      status: r.success ? "sent" : "failed",
      error: r.success ? null : r.error,
      externalId: r.messageId ?? null,
      batchId,
      segments: 1,
    });
    if (r.success) smsSent++;
    else errors.push(`${member.first_name} ${member.last_name}: ${r.error}`);
  }

  revalidatePath("/admin/nariai/deklaracija");
  return { success: true as const, smsSent, errors };
}

// =============================================================================
// Statistikos admin'ui
// =============================================================================
export async function getDeclarationStats() {
  const supabase = createServerSupabaseClient();

  const { data: rows } = await supabase
    .from("membership_declarations")
    .select(
      "id, token, sent_at, viewed_at, view_count, submitted_at, intent, email, notes, member:members(id, first_name, last_name, phone, email, status)"
    )
    .order("submitted_at", { ascending: false, nullsFirst: false });

  const all = rows || [];

  return {
    total: all.length,
    sent: all.filter((r) => r.sent_at).length,
    viewed: all.filter((r) => r.viewed_at && !r.submitted_at).length,
    submitted: all.filter((r) => r.submitted_at).length,
    pending: all.filter((r) => r.sent_at && !r.submitted_at).length,
    continue_cash: all.filter((r) => r.intent === "continue_cash").length,
    continue_transfer: all.filter((r) => r.intent === "continue_transfer").length,
    withdraw: all.filter((r) => r.intent === "withdraw").length,
    declarations: all,
  };
}

// =============================================================================
// Vieši (be auth) – per token
// =============================================================================
export async function getDeclarationTokenData(token: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_declaration_token_data", { p_token: token });
  if (error) return { error: error.message };
  return data;
}

export async function submitDeclaration(
  token: string,
  intent: "continue_cash" | "continue_transfer" | "withdraw",
  email: string,
  notes: string
) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("submit_declaration", {
    p_token: token,
    p_intent: intent,
    p_email: email,
    p_notes: notes,
  });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { success: true };
}
