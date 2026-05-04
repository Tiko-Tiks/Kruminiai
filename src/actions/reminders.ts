"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";
import { sendSms, normalizePhone } from "@/lib/infobip";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import { vocative } from "@/lib/utils";
import { revalidatePath } from "next/cache";

const BANK_NAME = "AB Artea bankas";
const BANK_ACCOUNT = "LT167181200000606866";
const BANK_RECIPIENT = "Krūminių kaimo bendruomenė";

interface MemberRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  join_date: string;
}

interface FeePeriodRow {
  id: string;
  year: number;
  name: string;
  amount_cents: number;
  due_date: string | null;
}

export type ChannelChoice = "both" | "email" | "sms";

interface ReminderResult {
  total: number;
  emailsSent: number;
  smsSent: number;
  emailErrors: number;
  smsErrors: number;
  skipped: number;
  errors: string[];
}

export async function previewUnpaidMembers(feePeriodId: string) {
  const supabase = createServerSupabaseClient();

  const { data: period } = await supabase
    .from("fee_periods")
    .select("id, year, name, amount_cents, due_date")
    .eq("id", feePeriodId)
    .single();

  if (!period) return { error: "Laikotarpis nerastas" };

  // Aktyvūs nariai, neapmokėti šio periodo
  const { data: members, error } = await supabase
    .from("members")
    .select("id, first_name, last_name, email, phone, status, join_date")
    .eq("status", "aktyvus")
    .order("last_name", { ascending: true });

  if (error) return { error: error.message };

  const { data: payments } = await supabase
    .from("payments")
    .select("member_id")
    .eq("fee_period_id", feePeriodId);

  const paidIds = new Set((payments || []).map((p) => p.member_id));

  const unpaid = (members || []).filter((m) => {
    // Tik tie, kurių periodas taikomas (nuo įstojimo metų)
    const joinYear = m.join_date ? new Date(m.join_date).getFullYear() : 2012;
    return !paidIds.has(m.id) && joinYear <= period.year;
  });

  const withEmail = unpaid.filter((m) => m.email && m.email.trim() !== "");
  const withPhone = unpaid.filter((m) => m.phone && normalizePhone(m.phone));
  const withNothing = unpaid.filter(
    (m) => !m.email && !(m.phone && normalizePhone(m.phone))
  );

  return {
    period,
    unpaid,
    counts: {
      total: unpaid.length,
      withEmail: withEmail.length,
      withPhone: withPhone.length,
      withBoth: unpaid.filter((m) => m.email && m.phone && normalizePhone(m.phone)).length,
      withNothing: withNothing.length,
    },
  };
}

export async function sendPaymentReminders(feePeriodId: string, channel: ChannelChoice = "both") {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: period } = await supabase
    .from("fee_periods")
    .select("id, year, name, amount_cents, due_date")
    .eq("id", feePeriodId)
    .single<FeePeriodRow>();

  if (!period) return { error: "Laikotarpis nerastas" };

  const { data: members } = await supabase
    .from("members")
    .select("id, first_name, last_name, email, phone, status, join_date")
    .eq("status", "aktyvus");

  const { data: payments } = await supabase
    .from("payments")
    .select("member_id")
    .eq("fee_period_id", feePeriodId);

  const paidIds = new Set((payments || []).map((p) => p.member_id));
  const unpaid = ((members as MemberRow[]) || []).filter((m) => {
    const joinYear = m.join_date ? new Date(m.join_date).getFullYear() : 2012;
    return !paidIds.has(m.id) && joinYear <= period.year;
  });

  const result: ReminderResult = {
    total: unpaid.length,
    emailsSent: 0,
    smsSent: 0,
    emailErrors: 0,
    smsErrors: 0,
    skipped: 0,
    errors: [],
  };

  const amountEur = (period.amount_cents / 100).toFixed(2);

  for (const m of unpaid) {
    const fullName = `${m.first_name} ${m.last_name}`;
    let sentSomething = false;

    // Email (jei pasirinkta + yra email)
    if ((channel === "both" || channel === "email") && m.email && m.email.trim()) {
      const html = renderBrandedEmail({
        preheader: `Primename – ${period.year} m. nario mokestis ${amountEur} EUR.`,
        body: `
          <h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:400;color:#0f3d20;letter-spacing:0.01em;line-height:1.3;">Sveiki, ${vocative(m.first_name)}!</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">
            Primename, kad <strong>${period.year} m. metinis bendruomenės nario mokestis (${amountEur} EUR)</strong> dar yra neapmokėtas.
          </p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#374151;">
            Surinktos lėšos naudojamos kaimo aplinkos priežiūrai, viešoms erdvėms tvarkyti, renginiams organizuoti ir kitoms bendruomenės reikmėms.
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0fdf4;border-left:3px solid #15803d;border-radius:4px;margin:24px 0;">
            <tr>
              <td style="padding:18px 22px;">
                <div style="font-size:13px;color:#166534;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">Mokėjimo rekvizitai</div>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;color:#374151;line-height:1.7;">
                  <tr>
                    <td style="padding-right:12px;color:#6b7280;">Gavėjas:</td>
                    <td style="font-weight:600;color:#111827;">${BANK_RECIPIENT}</td>
                  </tr>
                  <tr>
                    <td style="padding-right:12px;color:#6b7280;">Sąskaita:</td>
                    <td style="font-family:monospace;font-weight:600;color:#111827;">${BANK_ACCOUNT}</td>
                  </tr>
                  <tr>
                    <td style="padding-right:12px;color:#6b7280;">Bankas:</td>
                    <td style="color:#111827;">${BANK_NAME}</td>
                  </tr>
                  <tr>
                    <td style="padding-right:12px;color:#6b7280;">Suma:</td>
                    <td style="font-weight:700;color:#15803d;">${amountEur} EUR</td>
                  </tr>
                  <tr>
                    <td style="padding-right:12px;color:#6b7280;">Paskirtis:</td>
                    <td style="color:#111827;">${period.year} m. nario mokestis – ${fullName}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#4b5563;">
            Taip pat galite sumokėti <strong>grynais</strong> – susitarkite asmeniškai su pirmininku.
          </p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#4b5563;">
            Savo mokėjimų istoriją ir likusias skolas galite stebėti narių portale: <a href="https://kruminiai.lt/portalas/finansai" style="color:#15803d;text-decoration:underline;">kruminiai.lt/portalas/finansai</a>
          </p>
          <p style="margin:24px 0 8px;font-size:14px;line-height:1.6;color:#6b7280;">
            Iškilus klausimams – <a href="mailto:info@kruminiai.lt" style="color:#15803d;">info@kruminiai.lt</a> arba +370 658 49514.
          </p>
          <p style="margin:24px 0 0;font-size:15px;line-height:1.7;color:#374151;">
            Pagarbiai,<br>
            <strong style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:16px;color:#0f3d20;">Mindaugas Mameniškis</strong><br>
            <span style="color:#6b7280;font-size:13px;">Bendruomenės pirmininkas</span>
          </p>
        `,
      });

      const r = await sendEmail(
        m.email.trim(),
        `Priminimas: ${period.year} m. nario mokestis – ${BANK_RECIPIENT}`,
        html
      );
      if (r.success) {
        result.emailsSent++;
        sentSomething = true;
      } else {
        result.emailErrors++;
        result.errors.push(`Email klaida ${fullName}: ${r.error}`);
      }
    }

    // SMS (jei pasirinkta + yra telefonas)
    if ((channel === "both" || channel === "sms") && m.phone) {
      const normalized = normalizePhone(m.phone);
      if (normalized) {
        // Trumpas, be lt diakritikos, telpa i 1 SMS (~140 simb.)
        const text = `KKB priminimas: ${period.year}m. nario mokestis ${amountEur} EUR neapmoketas. Sask: ${BANK_ACCOUNT}. Info: kruminiai.lt/portalas/finansai`;
        const r = await sendSms(m.phone, text);
        if (r.success) {
          result.smsSent++;
          sentSomething = true;
        } else {
          result.smsErrors++;
          result.errors.push(`SMS klaida ${fullName}: ${r.error}`);
        }
      } else {
        // Phone format invalid - skip silently
      }
    }

    if (!sentSomething) result.skipped++;
  }

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "fee_periods",
    recordId: feePeriodId,
    newData: {
      reminder_channel: channel,
      total: result.total,
      emails: result.emailsSent,
      sms: result.smsSent,
      skipped: result.skipped,
    },
  });

  revalidatePath("/admin/mokesciai");
  return { success: true, ...result };
}
