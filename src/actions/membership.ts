"use server";

import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { logNotificationSystem } from "@/lib/notification-log";
import { renderMembershipRequestEmail } from "@/lib/membership-emails";
import { createAdminSupabaseClient, isAdminClientAvailable } from "@/lib/supabase-admin";

// Šio (anon) endpoint'o laiškai žurnale žymimi taip – pagal tai skaičiuojamas
// ir dažnio ribojimas, kad admin'o siunčiamos kampanijos jo neišnaudotų.
const REQUEST_EMAIL_KIND = "other";

// Anti-bombardavimo apsauga: tam pačiam adresui – ne daugiau kaip 3 laiškai per
// 10 min. (normali registracija siunčia 1); visiems adresams kartu – ne daugiau
// kaip 30 per valandą, kad vien adresų keitimas apsaugos neapeitų.
const REQUEST_EMAIL_WINDOW_MS = 10 * 60 * 1000;
const REQUEST_EMAIL_MAX = 3;
const GLOBAL_WINDOW_MS = 60 * 60 * 1000;
const GLOBAL_MAX = 30;

// Paskyra turi būti sukurta ką tik – laiškas #1 yra registracijos dalis, o ne
// būdas patikrinti, ar adresas apskritai registruotas.
const NEW_ACCOUNT_MAX_AGE_MS = 60 * 60 * 1000;
const USER_PAGE_SIZE = 200;
const MAX_USER_PAGES = 10;

const inputSchema = z.object({
  email: z.string().trim().email(),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  locale: z.enum(["lt", "en"]).optional(),
});

/**
 * Dažnio ribojimas. Abu langai suskaičiuojami iš VIENOS užklausos – imamos
 * valandos eilutės, o siauresnis (gavėjo) langas filtruojamas jau atmintyje.
 */
async function tooManyRecentRequests(email: string): Promise<boolean> {
  if (!isAdminClientAvailable()) return false;
  try {
    const admin = createAdminSupabaseClient();
    const now = Date.now();
    const { data } = await admin
      .from("notification_log")
      .select("recipient, sent_at")
      .eq("channel", "email")
      .eq("kind", REQUEST_EMAIL_KIND)
      .gte("sent_at", new Date(now - GLOBAL_WINDOW_MS).toISOString())
      .order("sent_at", { ascending: false })
      .limit(GLOBAL_MAX);

    const rows = (data ?? []) as { recipient: string | null; sent_at: string }[];
    if (rows.length >= GLOBAL_MAX) return true;

    const perRecipientSince = now - REQUEST_EMAIL_WINDOW_MS;
    const forRecipient = rows.filter(
      (r) =>
        (r.recipient ?? "").toLowerCase() === email.toLowerCase() &&
        new Date(r.sent_at).getTime() >= perRecipientSince
    ).length;
    return forRecipient >= REQUEST_EMAIL_MAX;
  } catch {
    return false; // throttle klaida neblokuoja teisėtos registracijos
  }
}

/**
 * Ar šiam adresui ką tik sukurta paskyra. Be šios patikros anon endpoint'as
 * siųstų laišką bet kuriuo nurodytu adresu – t. y. veiktų kaip atviras
 * siuntėjas svetimu vardu.
 *
 * Nerandant vartotojo grąžinam `false`, o kvietėjas atsako taip pat, kaip ir
 * sėkmės atveju – kad atsakymas neatskleistų, ar adresas registruotas.
 */
async function hasFreshAccount(email: string): Promise<boolean> {
  if (!isAdminClientAvailable()) return false;
  const needle = email.toLowerCase();
  try {
    const admin = createAdminSupabaseClient();
    // Admin API filtro pagal el. paštą neturi, todėl peržiūrim puslapiais.
    // Bendruomenės dydžiui (dešimtys paskyrų) tai viena užklausa.
    for (let page = 1; page <= MAX_USER_PAGES; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: USER_PAGE_SIZE });
      const users = data?.users ?? [];
      if (error) return false;

      const user = users.find((u) => (u.email ?? "").toLowerCase() === needle);
      if (user) {
        if (!user.created_at) return false;
        return Date.now() - new Date(user.created_at).getTime() <= NEW_ACCOUNT_MAX_AGE_MS;
      }
      if (users.length < USER_PAGE_SIZE) break;
    }
    return false;
  } catch {
    return false;
  }
}

// Garbės nariui mokesčiai netaikomi. Registracija yra ANON srautas, todėl
// nario įrašo ieškom per service-role (RLS neleistų). Jei admin'o kliento nėra
// arba narys dar nesukurtas – elgiamės kaip su įprastu stojančiuoju.
async function isHonoraryMemberEmail(email: string): Promise<boolean> {
  if (!isAdminClientAvailable()) return false;
  try {
    const admin = createAdminSupabaseClient();
    const { data } = await admin
      .from("members")
      .select("status")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    return (data as { status?: string } | null)?.status === "garbes_narys";
  } catch {
    return false;
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
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { success: false };

  const email = parsed.data.email;
  const firstName = parsed.data.firstName ?? "";
  const lastName = parsed.data.lastName ?? "";

  // Anti-bombardavimas: neleisti spaminti nei to paties adreso, nei endpoint'o
  if (await tooManyRecentRequests(email)) return { success: false };

  // Laiškas siunčiamas tik ką tik užsiregistravusiam. Atsakymas toks pat kaip
  // sėkmės atveju – neatskleidžiam, ar toks adresas registruotas.
  if (!(await hasFreshAccount(email))) return { success: true };

  const locale = parsed.data.locale === "en" ? "en" : "lt";
  const fullName = `${firstName} ${lastName}`.trim() || email;
  const isHonorary = await isHonoraryMemberEmail(email);
  const subject = isHonorary
    ? locale === "en"
      ? "Membership request received – Krūminiai Village Community"
      : "Narystės užklausa gauta – Krūminių kaimo bendruomenė"
    : locale === "en"
      ? "Membership request received – how to join the Krūminiai Village Community"
      : "Narystės užklausa gauta – kaip tapti Krūminių kaimo bendruomenės nariu";
  const html = renderMembershipRequestEmail({
    firstName: firstName || fullName,
    fullName,
    locale,
    isHonorary,
  });

  const r = await sendEmail(email, subject, html);

  // ANON srautas (registracija) – žurnalas per service-role (žr. logNotificationSystem)
  await logNotificationSystem({
    memberId: null,
    channel: "email",
    kind: REQUEST_EMAIL_KIND,
    recipient: email,
    subject,
    message: html,
    status: r.success ? "sent" : "failed",
    error: r.success ? null : r.error,
    externalId: r.messageId ?? null,
  });

  return { success: r.success };
}
