// Helper'is įrašyti SMS/email siuntimo įrašą į notification_log lentelę.
// Naudoja log_notification RPC (SECURITY DEFINER), todėl veikia ir
// anonymous, ir authenticated kontekste.

import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationKind =
  | "overdue_reminder"          // Mokesčių priminimas (skola)
  | "membership_declaration"    // Narystės patvirtinimo deklaracija
  | "voting_token"              // SMS su balsavimo nuoroda
  | "voting_resend"             // Pakartotinis balsavimo SMS
  | "vote_confirmation"         // Email po balsavimo
  | "other";

export interface LogNotificationParams {
  memberId: string | null;
  channel: "sms" | "email";
  kind: NotificationKind;
  recipient: string;
  subject?: string | null;
  message: string;
  status: "sent" | "failed";
  error?: string | null;
  externalId?: string | null;
  batchId?: string | null;
  segments?: number | null;
}

export async function logNotification(
  supabase: SupabaseClient,
  p: LogNotificationParams
): Promise<void> {
  // Nesilaikom – jei žurnalas neveikia, siuntimas turi tęstis.
  try {
    await supabase.rpc("log_notification", {
      p_member_id: p.memberId,
      p_channel: p.channel,
      p_kind: p.kind,
      p_recipient: p.recipient,
      p_subject: p.subject ?? null,
      p_message: p.message,
      p_status: p.status,
      p_error: p.error ?? null,
      p_external_id: p.externalId ?? null,
      p_batch_id: p.batchId ?? null,
      p_segments: p.segments ?? null,
    });
  } catch (e) {
    // Žurnalo klaida nieko nestopdo – tik konsolėj užfiksuojam.
    console.warn("[notification_log] Įrašymas nepavyko:", e);
  }
}
