"use server";

import { sendEmail } from "@/lib/email";
import { logNotificationSystem } from "@/lib/notification-log";
import { renderMembershipRequestEmail } from "@/lib/membership-emails";
import { createAdminSupabaseClient, isAdminClientAvailable } from "@/lib/supabase-admin";

// Anti-bombardavimo apsauga anon endpoint'ui: kiek laiškų tam pačiam adresui
// leidžiama per langą (normali registracija siunčia 1). Skaičiuojam iš
// notification_log per service-role.
const REQUEST_EMAIL_WINDOW_MS = 10 * 60 * 1000;
const REQUEST_EMAIL_MAX = 3;

async function tooManyRecentRequests(email: string): Promise<boolean> {
  if (!isAdminClientAvailable()) return false;
  try {
    const admin = createAdminSupabaseClient();
    const since = new Date(Date.now() - REQUEST_EMAIL_WINDOW_MS).toISOString();
    const { count } = await admin
      .from("notification_log")
      .select("id", { count: "exact", head: true })
      .eq("recipient", email)
      .eq("channel", "email")
      .gte("created_at", since);
    return (count ?? 0) >= REQUEST_EMAIL_MAX;
  } catch {
    return false; // throttle klaida neblokuoja teisėtos registracijos
  }
}

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

  // Anti-bombardavimas: neleisti spaminti to paties adreso per anon endpoint
  if (await tooManyRecentRequests(email)) return { success: false };

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

  // ANON srautas (registracija) – žurnalas per service-role (žr. logNotificationSystem)
  await logNotificationSystem({
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
