"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";
import { sendSms } from "@/lib/infobip";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

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

  // Įtraukiame ir 'pasyvus' (jie vis dar nariai). 'išstojęs' – ne.
  const { data: members, error } = await supabase
    .from("members")
    .select("id, first_name, last_name, phone, email")
    .in("status", ["aktyvus", "pasyvus"]);

  if (error) return { success: false as const, error: error.message };
  if (!members || members.length === 0)
    return { success: false as const, error: "Narių nėra" };

  const baseUrl = getBaseUrl();
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
    const text = `KKB pries 2026-05-23 susirinkima patvirtinkit naryste: ${url}`;

    const result = await sendSms(m.phone, text);
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
    tableName: "membership_declarations",
    recordId: "batch",
    newData: { smsSent, smsSkipped, errorsCount: errors.length },
  });

  revalidatePath("/admin/nariai/deklaracija");
  return { success: true as const, smsSent, smsSkipped, errors };
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

  for (const t of tokens) {
    const member = Array.isArray(t.members) ? t.members[0] : t.members;
    if (!member?.phone) continue;

    const url = `${baseUrl}/deklaracija/${t.token}`;
    const text = `Priminimas: KKB pries 2026-05-23 susirinkima patvirtinkit naryste: ${url}`;

    const r = await sendSms(member.phone, text);
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
      "id, token, sent_at, submitted_at, intent, email, notes, member:members(id, first_name, last_name, phone, email, status)"
    )
    .order("submitted_at", { ascending: false, nullsFirst: false });

  const all = rows || [];

  return {
    total: all.length,
    sent: all.filter((r) => r.sent_at).length,
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
