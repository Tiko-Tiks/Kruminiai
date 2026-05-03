"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";
import { sendSms } from "@/lib/infobip";
import { sendEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    "https://kruminiai.lt"
  ).replace(/\/$/, "");
}

// =============================================================================
// Tokenų generavimas + SMS siuntimas
// =============================================================================
export async function generateAndSendVotingTokens(meetingId: string) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Susirinkimas
  const { data: meeting, error: meetingErr } = await supabase
    .from("meetings")
    .select("id, title, meeting_date")
    .eq("id", meetingId)
    .single();

  if (meetingErr || !meeting) return { success: false as const, error: "Susirinkimas nerastas" };

  // Aktyvūs nariai su telefonu
  const { data: members, error: membersErr } = await supabase
    .from("members")
    .select("id, first_name, last_name, phone, email")
    .eq("status", "aktyvus");

  if (membersErr) return { success: false as const, error: membersErr.message };
  if (!members || members.length === 0)
    return { success: false as const, error: "Aktyvių narių nėra" };

  const baseUrl = getBaseUrl();
  const expiresAt = meeting.meeting_date; // iki susirinkimo pradžios

  let smsSent = 0;
  let smsSkipped = 0;
  const errors: string[] = [];

  for (const m of members) {
    if (!m.phone) {
      smsSkipped++;
      continue;
    }

    // Patikrinti ar tokenas jau yra (po balsavimo nedubliuojame)
    const { data: existing } = await supabase
      .from("meeting_voting_tokens")
      .select("id, token, voted_at")
      .eq("meeting_id", meetingId)
      .eq("member_id", m.id)
      .maybeSingle();

    let token = existing?.token;

    if (!existing) {
      // Naujas tokenas
      token = generateToken();
      const { error: insertErr } = await supabase
        .from("meeting_voting_tokens")
        .insert({
          meeting_id: meetingId,
          member_id: m.id,
          token,
          expires_at: expiresAt,
        });
      if (insertErr) {
        errors.push(`${m.first_name} ${m.last_name}: ${insertErr.message}`);
        continue;
      }
    } else if (existing.voted_at) {
      // Jau balsavo – nesiunčiame
      smsSkipped++;
      continue;
    }

    // SMS tekstas (≤160 sym. – telpa į 1 SMS)
    const url = `${baseUrl}/balsuoti/${token}`;
    const text = `Krūminių bendruomenė. Visuotinis susirinkimas 2026-05-23. Balsuokite čia: ${url}`;

    const result = await sendSms(m.phone, text);
    if (result.success) {
      await supabase
        .from("meeting_voting_tokens")
        .update({ sent_at: new Date().toISOString() })
        .eq("token", token!);
      smsSent++;
    } else {
      errors.push(`${m.first_name} ${m.last_name} (${m.phone}): ${result.error}`);
    }
  }

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "meeting_voting_tokens",
    recordId: meetingId,
    newData: { smsSent, smsSkipped, errorsCount: errors.length },
  });

  revalidatePath(`/admin/susirinkimai/${meetingId}`);
  return { success: true as const, smsSent, smsSkipped, errors };
}

// =============================================================================
// Pakartotinis SMS siuntimas tik tiems, kas dar nebalsavo
// =============================================================================
export async function resendVotingSms(meetingId: string) {
  const supabase = createServerSupabaseClient();

  const { data: tokens } = await supabase
    .from("meeting_voting_tokens")
    .select("token, member_id, members(first_name, last_name, phone)")
    .eq("meeting_id", meetingId)
    .is("voted_at", null);

  if (!tokens || tokens.length === 0) {
    return { success: true as const, smsSent: 0, errors: [] };
  }

  const baseUrl = getBaseUrl();
  let smsSent = 0;
  const errors: string[] = [];

  for (const t of tokens) {
    const member = Array.isArray(t.members) ? t.members[0] : t.members;
    if (!member?.phone) continue;

    const url = `${baseUrl}/balsuoti/${t.token}`;
    const text = `Priminimas: Krūminių bendruomenės balsavimas 2026-05-23. Balsuokite: ${url}`;

    const result = await sendSms(member.phone, text);
    if (result.success) {
      smsSent++;
    } else {
      errors.push(`${member.first_name} ${member.last_name}: ${result.error}`);
    }
  }

  revalidatePath(`/admin/susirinkimai/${meetingId}`);
  return { success: true as const, smsSent, errors };
}

// =============================================================================
// Tokenų statistika administratoriaus dashboard'ui
// =============================================================================
export async function getVotingTokensStats(meetingId: string) {
  const supabase = createServerSupabaseClient();

  const { data: tokens } = await supabase
    .from("meeting_voting_tokens")
    .select("id, sent_at, voted_at, member:members(first_name, last_name, phone)")
    .eq("meeting_id", meetingId)
    .order("voted_at", { ascending: false, nullsFirst: false });

  const all = tokens || [];
  return {
    total: all.length,
    sent: all.filter((t) => t.sent_at).length,
    voted: all.filter((t) => t.voted_at).length,
    pending: all.filter((t) => t.sent_at && !t.voted_at).length,
    tokens: all,
  };
}

// =============================================================================
// Vieši puslapio veiksmai – be auth, per token
// =============================================================================
export async function getVotingTokenData(token: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_voting_token_data", { p_token: token });
  if (error) return { error: error.message };
  return data;
}

export async function castVotesByToken(
  token: string,
  email: string | null,
  phone: string | null,
  votes: { resolution_id: string; vote: "uz" | "pries" | "susilaike" }[]
) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc("cast_votes_with_token", {
    p_token: token,
    p_email: email,
    p_phone: phone,
    p_votes: votes,
  });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };

  // Po balsavimo siųsti patvirtinimą email (jei pateikta)
  if (email) {
    await sendEmail(
      email,
      "Krūminių bendruomenė – jūsų balsas užregistruotas",
      `<p>Sveiki,</p>
       <p>Jūsų balsas dėl 2026 m. gegužės 23 d. visuotinio susirinkimo klausimų sėkmingai užregistruotas.</p>
       <p>Ačiū, kad dalyvaujate bendruomenės gyvenime!</p>
       <p>Pagarbiai,<br/>Krūminių kaimo bendruomenė</p>`
    ).catch(() => null);
  }

  return { success: true };
}
