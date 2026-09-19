"use server";

import { z } from "zod";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import { logNotificationSystem } from "@/lib/notification-log";
import { createAdminSupabaseClient, isAdminClientAvailable } from "@/lib/supabase-admin";
import { escapeHtml, vocative } from "@/lib/utils";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kruminiai.lt";

// Anti-bombardavimo apsauga anon endpoint'ui (tas pats principas kaip
// `membership.ts` registracijos laiške): kiek laiškų tam pačiam adresui
// leidžiama per langą.
const RESET_EMAIL_WINDOW_MS = 15 * 60 * 1000;
const RESET_EMAIL_MAX = 3;

const schema = z.object({
  email: z.string().trim().email(),
  locale: z.enum(["lt", "en"]).optional(),
});

/**
 * „Pamiršau slaptažodį" – slaptažodžio atstatymo nuoroda nariui.
 *
 * KODĖL NE `supabase.auth.resetPasswordForEmail()`: tas srautas laišką siunčia
 * per Supabase Auth SMTP ir Supabase numatytuoju šablonu – t. y. NE per mūsų
 * Hostinger SMTP ir be brand'o bei EN vertimo. Visa kita korespondencija
 * nariams eina per `sendEmail()` + `renderBrandedEmail()` ir yra dvikalbė
 * (žr. CLAUDE.md „Email"), todėl nuorodą generuojam admin API'u
 * (`generateLink`), o laišką siunčiam patys. Kartu gaunam `notification_log`
 * įrašą – matosi, ar nuoroda tikrai išėjo.
 *
 * Vieša (anon) funkcija, todėl:
 *   • rezultatas VISADA vienodas („jei paskyra egzistuoja – išsiuntėm"),
 *     kad nebūtų galima tikrinti, kurie el. paštai registruoti;
 *   • veikia dažnio ribojimas pagal gavėją.
 */
export async function requestPasswordReset(input: {
  email: string;
  locale?: "lt" | "en";
}): Promise<{ success: boolean }> {
  const parsed = schema.safeParse(input);
  // Netaisyklingas el. paštas – atsakom taip pat neutraliai, kaip ir nerastam
  if (!parsed.success) return { success: true };

  const email = parsed.data.email.toLowerCase();
  let locale: "lt" | "en" = parsed.data.locale === "en" ? "en" : "lt";

  if (!isAdminClientAvailable()) {
    console.error("[password-reset] Trūksta SUPABASE_SERVICE_ROLE_KEY – nuoroda negeneruota");
    return { success: false };
  }

  const admin = createAdminSupabaseClient();

  // 1) Dažnio ribojimas pagal gavėją
  try {
    const since = new Date(Date.now() - RESET_EMAIL_WINDOW_MS).toISOString();
    const { count } = await admin
      .from("notification_log")
      .select("id", { count: "exact", head: true })
      .eq("recipient", email)
      .eq("channel", "email")
      .gte("sent_at", since);
    if ((count ?? 0) >= RESET_EMAIL_MAX) return { success: true };
  } catch {
    // Ribojimo klaida neblokuoja teisėto atstatymo
  }

  // 2) Nario įrašas – vardui ir pageidaujamai laiškų kalbai (RLS neleistų anon,
  //    todėl per service-role). Jei nario nėra – laiškas eina svetainės kalba.
  let firstName = "";
  let memberId: string | null = null;
  try {
    const { data } = await admin
      .from("members")
      .select("id, first_name, language")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    const m = data as { id?: string; first_name?: string; language?: string } | null;
    if (m) {
      memberId = m.id ?? null;
      firstName = m.first_name ?? "";
      if (m.language === "en" || m.language === "lt") locale = m.language;
    }
  } catch {
    // vardo/kalbos nežinom – tęsiam su numatytaisiais
  }

  // 3) Atstatymo nuoroda. Recovery nuoroda grįžta su hash fragmentu
  //    (#access_token=...), todėl vedam tiesiai į formą – `/auth/callback`
  //    laukia `?code=` ir netiktų (tas pats sprendimas kaip portal-invites.ts).
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${SITE_URL}/nustatyti-slaptazodi` },
  });
  if (linkErr || !linkData?.properties?.action_link) {
    // Dažniausiai – tokio vartotojo nėra. Neatskleidžiam (žr. komentarą viršuje).
    return { success: true };
  }

  // 4) Brand'intas dvikalbis laiškas per mūsų SMTP
  const subject =
    locale === "en"
      ? "Password reset – Krūminiai Village Community"
      : "Slaptažodžio atstatymas – Krūminių kaimo bendruomenė";
  const resetUrl = linkData.properties.action_link;
  const html = renderPasswordResetEmail({ firstName, email, resetUrl, locale });

  const r = await sendEmail(email, subject, html);

  // Atstatymo nuoroda yra vienkartinis raktas į paskyrą, todėl į žurnalą ji
  // NErašoma – žurnalą skaito administratoriai, o įrašai lieka duomenų bazėje
  // ilgam. Lieka matyti, kad laiškas buvo išsiųstas, tik be paties rakto.
  const loggedMessage = html
    .split(resetUrl)
    .join(locale === "en" ? "[link hidden]" : "[nuoroda paslėpta]");

  await logNotificationSystem({
    memberId,
    channel: "email",
    kind: "password_reset",
    recipient: email,
    subject,
    message: loggedMessage,
    status: r.success ? "sent" : "failed",
    error: r.success ? null : r.error,
    externalId: r.messageId ?? null,
  });

  return { success: r.success };
}

function renderPasswordResetEmail(opts: {
  firstName: string;
  email: string;
  resetUrl: string;
  locale: "lt" | "en";
}): string {
  const button = (label: string) => `
    <div style="text-align:center;margin:24px 0;">
      <a href="${opts.resetUrl}" style="display:inline-block;background-color:#15803d;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">${label}</a>
    </div>`;

  if (opts.locale === "en") {
    const greeting = opts.firstName ? `Hello ${escapeHtml(opts.firstName)},` : "Hello,";
    return renderBrandedEmail({
      locale: "en",
      preheader: "Link to set a new password for your member portal account.",
      body: `
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#1f2937;">${greeting}</p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 8px;color:#374151;">
          A password reset was requested for the Krūminiai Village Community member portal. Set a new password here:
        </p>
        ${button("Set a new password")}
        <p style="font-size:13px;line-height:1.6;margin:0 0 6px;color:#6b7280;">Afterwards, sign in with the email:</p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 20px;color:#1f2937;font-weight:600;">${escapeHtml(opts.email)}</p>
        <p style="font-size:13px;line-height:1.6;margin:24px 0 0;color:#6b7280;font-style:italic;">
          The link is valid for about 24 hours. If you did not request this, simply ignore this email – your password stays unchanged.
        </p>
      `,
    });
  }

  const greeting = opts.firstName ? `Sveiki, ${escapeHtml(vocative(opts.firstName))},` : "Sveiki,";
  return renderBrandedEmail({
    locale: "lt",
    preheader: "Nuoroda naujam nario portalo slaptažodžiui nusistatyti.",
    body: `
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#1f2937;">${greeting}</p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 8px;color:#374151;">
        Gavome prašymą atstatyti Krūminių kaimo bendruomenės nario portalo slaptažodį. Naują slaptažodį nusistatykite čia:
      </p>
      ${button("Nustatyti naują slaptažodį")}
      <p style="font-size:13px;line-height:1.6;margin:0 0 6px;color:#6b7280;">Po to prisijungimui naudokite el. paštą:</p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 20px;color:#1f2937;font-weight:600;">${escapeHtml(opts.email)}</p>
      <p style="font-size:13px;line-height:1.6;margin:24px 0 0;color:#6b7280;font-style:italic;">
        Nuoroda galioja apie 24 val. Jei atstatymo neprašėte – tiesiog ignoruokite šį laišką, slaptažodis nepasikeis.
      </p>
    `,
  });
}
