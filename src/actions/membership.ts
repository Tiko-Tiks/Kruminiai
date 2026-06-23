"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { sendEmail } from "@/lib/email";
import { logNotification } from "@/lib/notification-log";
import { renderMembershipRequestEmail } from "@/lib/membership-emails";

/**
 * Laiškas #1 – išsiunčiamas ką tik /registracija formą užpildžiusiam žmogui:
 * pasveikinimas + kaip apmokėti stojamąjį ir nario mokestį, kad narystė būtų
 * patvirtinta.
 *
 * Vieša (anon) – kvietėjas dar neautentifikuotas. Best-effort: el. pašto klaida
 * neblokuoja registracijos (paskyra jau sukurta), tik grąžinam success vėliavą.
 */
export async function sendMembershipRequestEmail(input: {
  email: string;
  firstName: string;
  lastName: string;
  locale?: "lt" | "en";
}): Promise<{ success: boolean }> {
  const email = (input.email || "").trim();
  const firstName = (input.firstName || "").trim();
  const lastName = (input.lastName || "").trim();
  if (!email) return { success: false };

  const locale = input.locale === "en" ? "en" : "lt";
  const fullName = `${firstName} ${lastName}`.trim() || email;
  const subject =
    locale === "en"
      ? "Membership request received – how to join the Krūminiai Village Community"
      : "Narystės užklausa gauta – kaip tapti Krūminių kaimo bendruomenės nariu";
  const html = renderMembershipRequestEmail({
    firstName: firstName || fullName,
    fullName,
    locale,
  });

  const r = await sendEmail(email, subject, html);

  const supabase = createServerSupabaseClient();
  await logNotification(supabase, {
    memberId: null,
    channel: "email",
    kind: "other",
    recipient: email,
    subject,
    message: html,
    status: r.success ? "sent" : "failed",
    error: r.success ? null : r.error,
    externalId: r.messageId ?? null,
  });

  return { success: r.success };
}
