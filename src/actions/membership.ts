"use server";

import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { logNotificationSystem } from "@/lib/notification-log";
import { renderMembershipRequestEmail } from "@/lib/membership-emails";
import { createAdminSupabaseClient, isAdminClientAvailable } from "@/lib/supabase-admin";

// Šio (anon) endpoint'o laiškai žurnale žymimi atskira reikšme – pagal ją
// skaičiuojamas ir dažnio ribojimas. Bendra „other" netiktų: ja žymimas ir
// `approveUser` sveikinimo laiškas, todėl patvirtinimų serija uždarytų bendrą
// valandinį limitą registracijoms. `notification_log.kind` CHECK apribojimo
// neturi (migr. 009), todėl naujai reikšmei migracijos nereikia.
const REQUEST_EMAIL_KIND = "membership_request";

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

/** Kvota rezervuojama DB transakcijoje prieš siuntimą; klaidos atveju nesiunčiame. */
async function reserveEmailQuota(email: string): Promise<boolean> {
  if (!isAdminClientAvailable()) return false;
  try {
    const { data, error } = await createAdminSupabaseClient().rpc(
      "reserve_membership_email", { p_email: email }
    );
    return !error && data === true;
  } catch {
    return false;
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

  // Atominė rezervacija (055): 3 gavėjui / 10 min., 30 visiems / val.
  // Rezervacija lieka ir nepavykus siųsti, kad klaidos neatvertų piktnaudžiavimo.
  if (!(await reserveEmailQuota(email))) return { success: false };
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
