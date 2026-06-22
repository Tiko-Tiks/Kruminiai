// Narystės srauto laiškai:
//   #1 – užpildžius narystės užklausą (pasveikinimas + kaip apmokėti)
//   #2 – patvirtinus narystę (pasveikinimas tapus nariu + supažindinimas su sistema)

import { renderBrandedEmail } from "@/lib/email";
import { vocative } from "@/lib/utils";
import {
  renderPaymentDetailsBlock,
  ENTRY_FEE_EUR,
  MEMBERSHIP_FEE_EUR,
} from "@/lib/payment-info";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kruminiai.lt";

const TOTAL_EUR = ENTRY_FEE_EUR + MEMBERSHIP_FEE_EUR;

/**
 * Laiškas #1 – narystės užklausa gauta. Paaiškina, kad reikia sumokėti
 * stojamąjį + metinį nario mokestį, kad narystė būtų patvirtinta.
 */
export function renderMembershipRequestEmail(opts: {
  firstName: string;
  fullName: string;
}): string {
  const greeting = vocative(opts.firstName);
  const currentYear = new Date().getFullYear();

  return renderBrandedEmail({
    preheader: `Sveiki! Kad taptumėte nariu, sumokėkite stojamąjį (${ENTRY_FEE_EUR} EUR) ir metinį nario mokestį (${MEMBERSHIP_FEE_EUR} EUR).`,
    body: `
      <h1 style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#0f3d20;line-height:1.3;">Sveiki, ${greeting}!</h1>

      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">
        Ačiū, kad pateikėte narystės užklausą Krūminių kaimo bendruomenei. Džiaugiamės, kad norite prisijungti!
      </p>

      <p style="margin:0 0 8px;font-size:15px;line-height:1.7;color:#374151;">
        Kad taptumėte <strong>pilnaverčiu bendruomenės nariu</strong>, prašome sumokėti:
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fafaf7;border:1px solid #e7e5dd;border-radius:4px;margin:0 0 8px;font-size:14px;">
        <tr>
          <td style="padding:12px 16px 6px;color:#374151;">Stojamasis mokestis (vienkartinis)</td>
          <td style="padding:12px 16px 6px;text-align:right;font-weight:600;color:#111827;">${ENTRY_FEE_EUR} EUR</td>
        </tr>
        <tr>
          <td style="padding:6px 16px;color:#374151;">${currentYear} m. nario mokestis (metinis)</td>
          <td style="padding:6px 16px;text-align:right;font-weight:600;color:#111827;">${MEMBERSHIP_FEE_EUR} EUR</td>
        </tr>
        <tr>
          <td style="padding:6px 16px 12px;border-top:1px solid #e7e5dd;font-weight:700;color:#111827;">Iš viso</td>
          <td style="padding:6px 16px 12px;border-top:1px solid #e7e5dd;text-align:right;font-weight:700;font-size:16px;color:#15803d;">${TOTAL_EUR} EUR</td>
        </tr>
      </table>

      ${renderPaymentDetailsBlock({
        amountLabel: `${TOTAL_EUR} EUR`,
        purpose: `Stojamasis ir nario mokestis – ${opts.fullName}`,
      })}

      <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#4b5563;">
        Kai gausime apmokėjimą, patvirtinsime jūsų narystę ir atskiru laišku atsiųsime prisijungimo prie nario portalo informaciją.
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#4b5563;">
        Taip pat galite sumokėti <strong>grynaisiais</strong> – susitarkite asmeniškai su pirmininku.
      </p>
      <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#6b7280;">
        Klausimai: <a href="mailto:info@kruminiai.lt" style="color:#15803d;">info@kruminiai.lt</a> arba +370 658 49514.
      </p>
    `,
  });
}

/**
 * Laiškas #2 – narystė patvirtinta. Pasveikina ir supažindina su sistema
 * (portalas, įstatai, kontaktai).
 */
export function renderMemberWelcomeEmail(opts: { firstName: string }): string {
  const greeting = vocative(opts.firstName);

  return renderBrandedEmail({
    preheader: "Jūsų narystė patvirtinta! Štai kaip naudotis nario portalu.",
    body: `
      <h1 style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#0f3d20;line-height:1.3;">Sveiki tapę nariu, ${greeting}!</h1>

      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">
        Jūsų narystė Krūminių kaimo bendruomenėje <strong>patvirtinta</strong>. Sveikiname ir kviečiame naudotis nario portalu.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0fdf4;border-left:3px solid #15803d;border-radius:4px;margin:0 0 20px;">
        <tr>
          <td style="padding:18px 22px;">
            <div style="font-size:13px;color:#166534;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">Prisijungimas</div>
            <p style="margin:0;font-size:14px;line-height:1.7;color:#374151;">
              Junkitės adresu <a href="${SITE_URL}/prisijungimas" style="color:#15803d;font-weight:600;text-decoration:underline;">kruminiai.lt/prisijungimas</a> su el. paštu ir slaptažodžiu, kurį susikūrėte registruodamiesi.
            </p>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 8px;font-size:15px;line-height:1.7;color:#374151;">Portale galėsite:</p>
      <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:1.8;color:#374151;">
        <li>matyti savo nario mokesčio istoriją ir likučius (<strong>Finansai</strong>)</li>
        <li>balsuoti visuotinių susirinkimų metu tiesiogiai (<strong>Balsavimai</strong>)</li>
        <li>skaityti bendruomenės dokumentus – protokolus, ataskaitas ir <strong>įstatus</strong> (<strong>Dokumentai</strong>)</li>
        <li>matyti susirinkimų darbotvarkes ir rezultatus</li>
        <li>atnaujinti savo kontaktinius duomenis (<strong>Profilis</strong>)</li>
      </ul>

      <div style="text-align:center;margin:24px 0;">
        <a href="${SITE_URL}/portalas" style="display:inline-block;background-color:#15803d;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Atidaryti nario portalą</a>
      </div>

      <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#6b7280;">
        Klausimai ar pasiūlymai: <a href="mailto:info@kruminiai.lt" style="color:#15803d;">info@kruminiai.lt</a> arba +370 658 49514.
      </p>
      <p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:#374151;">
        Pagarbiai,<br>
        <strong style="font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:15px;color:#0f3d20;">Krūminių kaimo bendruomenė</strong>
      </p>
    `,
  });
}
