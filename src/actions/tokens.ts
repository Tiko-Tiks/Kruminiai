"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";
import { sendSms } from "@/lib/infobip";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import { vocative } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

function generateToken(): string {
  // 16 baitu = 32 hex simboliai = 128 bitu entropija (saugu, telpa i 1 SMS)
  return crypto.randomBytes(16).toString("hex");
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

    // SMS be lt diakritikos (GSM-7 = 160 simb./SMS), su trumpu tokenu telpa i 1 SMS.
    const url = `${baseUrl}/balsuoti/${token}`;
    const text = `KKB visuotinis susirinkimas 2026-05-23 18:00. Balsuokite: ${url}`;

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
    const text = `Priminimas: KKB balsavimas 2026-05-23 18:00. Balsuokite: ${url}`;

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
    .select("id, sent_at, voted_at, live_intent_at, member:members(first_name, last_name, phone)")
    .eq("meeting_id", meetingId)
    .order("voted_at", { ascending: false, nullsFirst: false });

  const all = tokens || [];
  return {
    total: all.length,
    sent: all.filter((t) => t.sent_at).length,
    voted: all.filter((t) => t.voted_at).length,
    liveIntent: all.filter((t) => t.live_intent_at && !t.voted_at).length,
    pending: all.filter((t) => t.sent_at && !t.voted_at && !t.live_intent_at).length,
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

interface VoteWithDetails {
  resolution_id: string;
  resolution_number: number;
  title: string;
  vote: "uz" | "pries" | "susilaike";
  documents?: { id: string; title: string; file_path: string }[];
}

export async function castVotesByToken(
  token: string,
  firstName: string,
  email: string,
  phone: string | null,
  votes: VoteWithDetails[]
) {
  const supabase = createServerSupabaseClient();

  // RPC priima tik resolution_id ir vote – likę laukai naudojami tik email'ui
  const { data, error } = await supabase.rpc("cast_votes_with_token", {
    p_token: token,
    p_email: email,
    p_phone: phone,
    p_votes: votes.map((v) => ({ resolution_id: v.resolution_id, vote: v.vote })),
  });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };

  // Po balsavimo siųsti patvirtinimą su pilnais balsų rezultatais
  const greeting = firstName ? `Sveiki, ${vocative(firstName)}!` : "Sveiki!";
  const votedAt = new Date().toLocaleString("lt-LT", {
    timeZone: "Europe/Vilnius",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const voteLabels: Record<string, { label: string; color: string; bg: string }> = {
    uz: { label: "Už", color: "#166534", bg: "#dcfce7" },
    pries: { label: "Prieš", color: "#991b1b", bg: "#fee2e2" },
    susilaike: { label: "Susilaikė", color: "#374151", bg: "#f3f4f6" },
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const docUrl = (filePath: string) =>
    `${supabaseUrl}/storage/v1/object/public/documents/${filePath}`;

  const votesHtml = votes
    .map((v) => {
      const style = voteLabels[v.vote];
      const docsLine =
        v.documents && v.documents.length > 0
          ? `<div style="margin-top:6px;font-size:12px;color:#6b7280;">${v.documents
              .map(
                (d) =>
                  `<a href="${docUrl(d.file_path)}" style="color:#15803d;text-decoration:none;">📄 ${d.title}</a>`
              )
              .join(" &nbsp;·&nbsp; ")}</div>`
          : "";
      return `
        <tr>
          <td style="padding:12px 8px 12px 0;border-bottom:1px solid #f3f4f6;vertical-align:top;width:32px;">
            <span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;background:#f3f4f6;color:#6b7280;border-radius:50%;font-size:12px;font-weight:600;">${v.resolution_number}</span>
          </td>
          <td style="padding:12px 8px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;line-height:1.5;">
            ${v.title}
            ${docsLine}
          </td>
          <td style="padding:12px 0 12px 8px;border-bottom:1px solid #f3f4f6;text-align:right;white-space:nowrap;vertical-align:top;">
            <span style="display:inline-block;padding:4px 12px;background:${style.bg};color:${style.color};font-size:12px;font-weight:600;border-radius:12px;">${style.label}</span>
          </td>
        </tr>
      `;
    })
    .join("");

  const body = `
    <h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:400;color:#0f3d20;letter-spacing:0.01em;line-height:1.3;">${greeting}</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#374151;">
      Jūsų balsas dėl <strong style="color:#111827;">2026 m. gegužės 23 d.</strong> Krūminių kaimo bendruomenės eilinio visuotinio narių susirinkimo klausimų sėkmingai užregistruotas.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0fdf4;border-left:3px solid #15803d;border-radius:4px;margin:24px 0;">
      <tr>
        <td style="padding:16px 20px;">
          <div style="font-size:14px;color:#166534;font-weight:600;">✓ Balsas užregistruotas</div>
          <div style="margin-top:4px;font-size:13px;color:#374151;">${votedAt} (Europe/Vilnius)</div>
          <div style="margin-top:8px;font-size:13px;color:#4b5563;line-height:1.5;">
            Susirinkimo metu būsite skaičiuojamas kaip <strong>nuotolinis dalyvis</strong> kvorumui nustatyti.
          </div>
        </td>
      </tr>
    </table>

    <h2 style="margin:32px 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:400;color:#0f3d20;letter-spacing:0.01em;">Jūsų balsai pagal darbotvarkę</h2>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
      ${votesHtml}
    </table>

    <p style="margin:32px 0 8px;font-size:14px;line-height:1.6;color:#6b7280;">
      Jei pastebėjote klaidą arba turite klausimų, parašykite <a href="mailto:info@kruminiai.lt" style="color:#15803d;text-decoration:underline;">info@kruminiai.lt</a>.
    </p>

    <p style="margin:24px 0 0;font-size:15px;line-height:1.7;color:#374151;">
      Pagarbiai,<br>
      <strong style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:16px;color:#0f3d20;">Mindaugas Mameniškis</strong><br>
      <span style="color:#6b7280;font-size:13px;">Bendruomenės pirmininkas</span>
    </p>
  `;

  const html = renderBrandedEmail({
    preheader: `Jūsų balsas dėl 2026-05-23 visuotinio susirinkimo užregistruotas (${votes.length} klausimai).`,
    body,
  });

  await sendEmail(
    email,
    "Jūsų balsas užregistruotas – Krūminių bendruomenė",
    html
  ).catch(() => null);

  return { success: true };
}

// Narys paspaudžia "Dalyvausiu gyvai" – jokio balsavimo, tik intencija
export async function registerLiveIntentByToken(token: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("register_live_intent_with_token", {
    p_token: token,
  });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { success: true };
}
