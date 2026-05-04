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
const ENTRY_FEE_EUR = 20;

export type ChannelChoice = "both" | "email" | "sms";

interface FeePeriod {
  id: string;
  year: number;
  name: string;
  amount_cents: number;
  fee_type: string;
}

interface MemberWithDebt {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  join_date: string | null;
  unpaidPeriods: FeePeriod[];
  totalCents: number;
}

// =============================================================================
// Surinkti narius su skolomis (visi metai nuo įstojimo)
// =============================================================================
export async function getMembersWithDebts() {
  const supabase = createServerSupabaseClient();

  const { data: members } = await supabase
    .from("members")
    .select("id, first_name, last_name, email, phone, join_date, status")
    .eq("status", "aktyvus");

  const { data: periods } = await supabase
    .from("fee_periods")
    .select("id, year, name, amount_cents, fee_type")
    .eq("fee_type", "metinis")
    .order("year", { ascending: true });

  const { data: payments } = await supabase
    .from("payments")
    .select("member_id, fee_period_id");

  if (!members || !periods || !payments) {
    return { members: [] as MemberWithDebt[] };
  }

  const paidByMember = new Map<string, Set<string>>();
  for (const p of payments) {
    const set = paidByMember.get(p.member_id) || new Set<string>();
    set.add(p.fee_period_id);
    paidByMember.set(p.member_id, set);
  }

  const result: MemberWithDebt[] = [];
  for (const m of members) {
    const joinYear = m.join_date ? new Date(m.join_date).getFullYear() : 2012;
    const paidIds = paidByMember.get(m.id) || new Set<string>();
    const unpaid = periods.filter((p) => p.year >= joinYear && !paidIds.has(p.id));
    if (unpaid.length === 0) continue;

    result.push({
      id: m.id,
      first_name: m.first_name,
      last_name: m.last_name,
      email: m.email,
      phone: m.phone,
      join_date: m.join_date,
      unpaidPeriods: unpaid,
      totalCents: unpaid.reduce((s, p) => s + p.amount_cents, 0),
    });
  }

  result.sort((a, b) => b.totalCents - a.totalCents); // didžiausia skola viršuje
  return { members: result };
}

// =============================================================================
// Siųsti pradelstų mokesčių priminimus (visiems su skola)
// =============================================================================
interface ReminderResult {
  total: number;
  emailsSent: number;
  smsSent: number;
  emailErrors: number;
  smsErrors: number;
  skipped: number;
  errors: string[];
}

export async function sendOverdueReminders(channel: ChannelChoice = "both") {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { members } = await getMembersWithDebts();

  const result: ReminderResult = {
    total: members.length,
    emailsSent: 0,
    smsSent: 0,
    emailErrors: 0,
    smsErrors: 0,
    skipped: 0,
    errors: [],
  };

  for (const m of members) {
    const fullName = `${m.first_name} ${m.last_name}`;
    let sentSomething = false;

    const totalEur = (m.totalCents / 100).toFixed(2);
    const yearsList = m.unpaidPeriods.map((p) => p.year).join(", ");
    const yearsCount = m.unpaidPeriods.length;

    // Email
    if ((channel === "both" || channel === "email") && m.email && m.email.trim()) {
      const periodsRows = m.unpaidPeriods
        .map(
          (p) => `
            <tr>
              <td style="padding:8px 12px 8px 0;border-bottom:1px solid #fee2e2;color:#374151;">${p.year} m. metinis mokestis</td>
              <td style="padding:8px 0;border-bottom:1px solid #fee2e2;text-align:right;font-weight:600;color:#991b1b;">${(p.amount_cents / 100).toFixed(2)} EUR</td>
            </tr>`
        )
        .join("");

      const html = renderBrandedEmail({
        preheader: `SVARBU: pradelsta ${totalEur} EUR (${yearsCount} m.). Skubiai sumokėkite arba būsite šalinami.`,
        body: `
          <h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:400;color:#0f3d20;letter-spacing:0.01em;line-height:1.3;">Sveiki, ${vocative(m.first_name)}!</h1>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fef3f2;border-left:3px solid #dc2626;border-radius:4px;margin:0 0 20px;">
            <tr>
              <td style="padding:16px 20px;">
                <div style="font-size:13px;color:#991b1b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Pradelsti mokesčiai</div>
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

          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">
            Pagal Krūminių kaimo bendruomenės įstatus, <strong>nesumokėjus nario mokesčio</strong>, narystė gali būti nutraukta visuotinio narių susirinkimo sprendimu. Klausimas dėl nemokių narių šalinimo bus svarstomas <strong>2026 m. gegužės 23 d.</strong> susirinkime.
          </p>

          <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#4b5563;background:#fffbeb;border-left:3px solid #f59e0b;padding:12px 16px;border-radius:4px;">
            <strong style="color:#92400e;">Įsidėmėkit:</strong> jei narystė nutraukiama, vėliau norint vėl tapti nariu, reikės sumokėti <strong>${ENTRY_FEE_EUR} EUR stojamąjį mokestį</strong> bei einamųjų metų nario mokestį.
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
                    <td style="font-weight:700;color:#15803d;">${totalEur} EUR</td>
                  </tr>
                  <tr>
                    <td style="padding-right:12px;color:#6b7280;">Paskirtis:</td>
                    <td style="color:#111827;">Nario mokestis (${yearsList}) – ${fullName}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#4b5563;">
            Taip pat galite sumokėti <strong>grynais</strong> – susitarkite asmeniškai su pirmininku.
          </p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#4b5563;">
            Mokėjimų istorija: <a href="https://kruminiai.lt/portalas/finansai" style="color:#15803d;text-decoration:underline;">kruminiai.lt/portalas/finansai</a>
          </p>
          <p style="margin:24px 0 8px;font-size:14px;line-height:1.6;color:#6b7280;">
            Klausimai: <a href="mailto:info@kruminiai.lt" style="color:#15803d;">info@kruminiai.lt</a> arba +370 658 49514.
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
        `SVARBU: pradelstas nario mokestis ${totalEur} EUR – ${BANK_RECIPIENT}`,
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

    // SMS – glausta žinutė be lt diakritikos
    if ((channel === "both" || channel === "sms") && m.phone) {
      const normalized = normalizePhone(m.phone);
      if (normalized) {
        const yearsLabel =
          yearsCount === 1
            ? `${m.unpaidPeriods[0].year}m.`
            : `${yearsCount}m. (${m.unpaidPeriods.map((p) => p.year).join(",")})`;
        // ~155 simb. limit – 1 SMS
        const text = `KKB: PRADELSTAS nario mokestis ${yearsLabel} ${totalEur} EUR. Sumokekite ${BANK_ACCOUNT}. Nesumokejus busite salinami; naujam istojimui +${ENTRY_FEE_EUR}EUR.`;
        const r = await sendSms(m.phone, text);
        if (r.success) {
          result.smsSent++;
          sentSomething = true;
        } else {
          result.smsErrors++;
          result.errors.push(`SMS klaida ${fullName}: ${r.error}`);
        }
      }
    }

    if (!sentSomething) result.skipped++;
  }

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "members",
    recordId: "overdue_reminder_batch",
    newData: {
      reminder_channel: channel,
      total: result.total,
      emails: result.emailsSent,
      sms: result.smsSent,
      skipped: result.skipped,
    },
  });

  revalidatePath("/admin/mokesciai");
  return { success: true as const, ...result };
}

// =============================================================================
// Backwards-compat: vienos periodo priminimas (paliekam, jei kažkur naudojama)
// =============================================================================
export async function previewUnpaidMembers(feePeriodId: string) {
  const supabase = createServerSupabaseClient();

  const { data: period } = await supabase
    .from("fee_periods")
    .select("id, year, name, amount_cents, due_date")
    .eq("id", feePeriodId)
    .single();

  if (!period) return { error: "Laikotarpis nerastas" };

  const { members: allWithDebts } = await getMembersWithDebts();
  // Filtruoti tik tuos, kurie skolingi BENT už šį periodą
  const unpaid = allWithDebts
    .filter((m) => m.unpaidPeriods.some((p) => p.id === feePeriodId))
    .map((m) => ({
      id: m.id,
      first_name: m.first_name,
      last_name: m.last_name,
      email: m.email,
      phone: m.phone,
      totalCents: m.totalCents,
      yearsUnpaid: m.unpaidPeriods.length,
    }));

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

// Per-period varianto sender – dabar tiesiog kviečia overdue su filtrais
// (paliekamas backwards-compat'ui esamai admin UI)
export async function sendPaymentReminders(_feePeriodId: string, channel: ChannelChoice = "both") {
  return sendOverdueReminders(channel);
}
