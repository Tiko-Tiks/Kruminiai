#!/usr/bin/env node
// Generuoja brand'intus HTML šablonus Supabase Auth email'ams.
// Šiuos rezultatus reikia ranka įklijuoti į Supabase Dashboard:
//   Authentication → Email Templates → atitinkamas šablonas.
//
// Naudojama ta pati struktūra kaip src/lib/email.ts → renderBrandedEmail.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "email-templates");

const SITE_URL = "https://kruminiai.lt";
const LOGO_URL = `${SITE_URL}/images/logo-md.png`;

const bodyFont = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;
const headingFont = `Georgia,'Times New Roman',serif`;

function renderBrandedEmail({ preheader, body }) {
  return `<!DOCTYPE html>
<html lang="lt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Krūminių kaimo bendruomenė</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f3ee;font-family:${bodyFont};">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f5f3ee;">${preheader}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f3ee;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr>
          <td style="padding:32px 32px 0;font-family:${headingFont};">
            <div style="font-size:13px;color:#15803d;letter-spacing:0.12em;text-transform:uppercase;font-family:${bodyFont};font-weight:600;">Krūminių kaimo bendruomenė</div>
            <div style="height:2px;background-color:#15803d;width:48px;margin-top:12px;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 32px;color:#1f2937;font-family:${bodyFont};">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="background-color:#fafaf7;padding:28px 32px;border-top:1px solid #e7e5dd;font-family:${bodyFont};font-size:12px;color:#6b7280;line-height:1.7;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td valign="middle" width="64" style="padding-right:16px;">
                  <img src="${LOGO_URL}" alt="" width="56" style="display:block;height:auto;max-width:56px;border:0;">
                </td>
                <td valign="middle">
                  <div style="color:#0f3d20;font-family:${headingFont};font-size:14px;font-weight:400;letter-spacing:0.01em;margin-bottom:4px;">Krūminių kaimo bendruomenė</div>
                  Beržų g. 8, Krūminių k., LT-65474 Varėnos r. &nbsp;·&nbsp; Įm. kodas: 302795244<br>
                  <a href="mailto:info@kruminiai.lt" style="color:#15803d;text-decoration:none;">info@kruminiai.lt</a> &nbsp;·&nbsp; <a href="https://kruminiai.lt" style="color:#15803d;text-decoration:none;">kruminiai.lt</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <p style="margin:16px auto 0;max-width:600px;font-family:${bodyFont};font-size:11px;color:#9ca3af;text-align:center;line-height:1.5;">
        Šis pranešimas išsiųstas Krūminių kaimo bendruomenės nariui. Jei gavote jį per klaidą, susisiekite <a href="mailto:info@kruminiai.lt" style="color:#9ca3af;">info@kruminiai.lt</a>.
      </p>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function ctaButton(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
            <tr>
              <td style="border-radius:8px;background:#15803d;">
                <a href="${href}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;font-family:${bodyFont};">${label}</a>
              </td>
            </tr>
          </table>`;
}

function heading(text) {
  return `<h1 style="margin:0 0 20px;font-family:${headingFont};font-size:24px;font-weight:400;color:#0f3d20;letter-spacing:0.01em;line-height:1.3;">${text}</h1>`;
}

function paragraph(text) {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">${text}</p>`;
}

function fallbackLink(href) {
  return `<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">
    Jei mygtukas neveikia, nukopijuokite šią nuorodą į naršyklę:<br>
    <a href="${href}" style="color:#15803d;word-break:break-all;">${href}</a>
  </p>`;
}

function signature() {
  return `<p style="margin:32px 0 0;font-size:14px;line-height:1.6;color:#6b7280;">
    Pagarbiai,<br>
    <strong style="font-family:${headingFont};font-weight:400;font-size:15px;color:#0f3d20;">Krūminių kaimo bendruomenė</strong>
  </p>`;
}

// =============================================================================
// Šablonai
// =============================================================================

const templates = {
  // Authentication → Email Templates → Confirm signup
  confirm: {
    file: "confirm.html",
    label: "Confirm signup (registracijos patvirtinimas)",
    subject: "Patvirtinkite el. paštą – Krūminių kaimo bendruomenė",
    body: renderBrandedEmail({
      preheader: "Patvirtinkite savo el. paštą, kad užbaigtumėte registraciją.",
      body: `
        ${heading("Sveiki!")}
        ${paragraph("Ačiū, kad užsiregistravote Krūminių kaimo bendruomenės sistemoje. Norėdami užbaigti registraciją, patvirtinkite savo el. pašto adresą.")}
        ${ctaButton("{{ .ConfirmationURL }}", "Patvirtinti el. paštą")}
        ${paragraph(`<strong>Kas toliau?</strong> Po el. pašto patvirtinimo, administratorius dar peržiūrės ir patvirtins jūsų narystę. Apie tai pranešime atskirai. Iki tol prisijungti į portalą nebus galima.`)}
        ${paragraph("Jei to neprašėte, šio laiško galite nepaisyti.")}
        ${fallbackLink("{{ .ConfirmationURL }}")}
        ${signature()}
      `,
    }),
  },

  // Authentication → Email Templates → Reset password
  recovery: {
    file: "recovery.html",
    label: "Reset password (slaptažodžio atstatymas)",
    subject: "Slaptažodžio atstatymas – Krūminių kaimo bendruomenė",
    body: renderBrandedEmail({
      preheader: "Spauskite, kad nustatytumėte naują slaptažodį.",
      body: `
        ${heading("Slaptažodžio atstatymas")}
        ${paragraph("Gavome prašymą atstatyti jūsų Krūminių kaimo bendruomenės paskyros slaptažodį. Spauskite mygtuką žemiau, kad nustatytumėte naują slaptažodį.")}
        ${ctaButton("{{ .ConfirmationURL }}", "Nustatyti naują slaptažodį")}
        ${paragraph("Nuoroda galioja ribotą laiką. Jei jos nepanaudosite, slaptažodis išliks tas pats.")}
        ${paragraph("<strong>Jei to neprašėte</strong> – šio laiško galite nepaisyti, niekas su jūsų paskyra nebus daroma.")}
        ${fallbackLink("{{ .ConfirmationURL }}")}
        ${signature()}
      `,
    }),
  },

  // Authentication → Email Templates → Magic Link
  magicLink: {
    file: "magic-link.html",
    label: "Magic Link (prisijungimo nuoroda be slaptažodžio)",
    subject: "Prisijungimo nuoroda – Krūminių kaimo bendruomenė",
    body: renderBrandedEmail({
      preheader: "Spauskite, kad prisijungtumėte be slaptažodžio.",
      body: `
        ${heading("Prisijungimo nuoroda")}
        ${paragraph("Paspauskite mygtuką žemiau, kad prisijungtumėte prie Krūminių kaimo bendruomenės portalo.")}
        ${ctaButton("{{ .ConfirmationURL }}", "Prisijungti")}
        ${paragraph("Nuoroda vienkartinė ir galioja ribotą laiką. Jei to neprašėte – ignoruokite šį laišką.")}
        ${fallbackLink("{{ .ConfirmationURL }}")}
        ${signature()}
      `,
    }),
  },

  // Authentication → Email Templates → Change Email Address
  emailChange: {
    file: "email-change.html",
    label: "Change Email Address (el. pašto pakeitimas)",
    subject: "Patvirtinkite naują el. pašto adresą – Krūminių kaimo bendruomenė",
    body: renderBrandedEmail({
      preheader: "Patvirtinkite, kad norite pakeisti el. pašto adresą.",
      body: `
        ${heading("El. pašto adreso keitimas")}
        ${paragraph("Gavome prašymą pakeisti jūsų Krūminių kaimo bendruomenės paskyros el. pašto adresą į <strong>{{ .NewEmail }}</strong>. Patvirtinkite šį veiksmą.")}
        ${ctaButton("{{ .ConfirmationURL }}", "Patvirtinti pakeitimą")}
        ${paragraph("Jei to neprašėte – šio laiško nepaisykit. Jūsų esamas el. paštas išliks tas pats.")}
        ${fallbackLink("{{ .ConfirmationURL }}")}
        ${signature()}
      `,
    }),
  },

  // Authentication → Email Templates → Reauthentication
  reauthentication: {
    file: "reauthentication.html",
    label: "Reauthentication (pakartotinis patvirtinimas su kodu)",
    subject: "Patvirtinimo kodas – Krūminių kaimo bendruomenė",
    body: renderBrandedEmail({
      preheader: "Jūsų vienkartinis patvirtinimo kodas.",
      body: `
        ${heading("Patvirtinimo kodas")}
        ${paragraph("Įveskite šį kodą, kad patvirtintumėte savo veiksmą:")}
        <div style="margin:24px 0;padding:20px 24px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;text-align:center;">
          <div style="font-family:'Courier New',monospace;font-size:32px;font-weight:700;color:#15803d;letter-spacing:0.2em;">{{ .Token }}</div>
        </div>
        ${paragraph("Kodas galioja ribotą laiką. Jei to neprašėte – ignoruokite šį laišką ir nedalinkitės kodu su niekuo.")}
        ${signature()}
      `,
    }),
  },
};

// =============================================================================
// README
// =============================================================================
const README = `# Supabase Auth Email Templates

Šiame aplanke yra brand'inti HTML šablonai Supabase Auth siunčiamiems el. laiškams.
Visi naudoja tą pačią vizualinę kalbą kaip ir mūsų vidiniai el. laiškai
(\`renderBrandedEmail\` faile \`src/lib/email.ts\`).

## Kaip įklijuoti į Supabase

1. Atidarykit Supabase Dashboard → Authentication → Email Templates
2. Kiekvienam šablonui:
   - Subject heading: nukopijuokit nurodytą lietuviška antraštę (žr. lentelę žemiau)
   - Message body (HTML): nukopijuokit atitinkamą \`.html\` failą **ištisai**
3. Spauskit Save.

## Šablonų sąrašas

| Failas | Supabase šablonas | Subject |
|---|---|---|
| \`confirm.html\` | Confirm signup | Patvirtinkite el. paštą – Krūminių kaimo bendruomenė |
| \`recovery.html\` | Reset Password | Slaptažodžio atstatymas – Krūminių kaimo bendruomenė |
| \`magic-link.html\` | Magic Link | Prisijungimo nuoroda – Krūminių kaimo bendruomenė |
| \`email-change.html\` | Change Email Address | Patvirtinkite naują el. pašto adresą – Krūminių kaimo bendruomenė |
| \`reauthentication.html\` | Reauthentication | Patvirtinimo kodas – Krūminių kaimo bendruomenė |

## Supabase template kintamieji

Šablonuose paliktos Supabase'o vietinės žymės — jas Supabase keičia automatiškai:
- \`{{ .ConfirmationURL }}\` — pilna patvirtinimo nuoroda (nurodo į \`/auth/callback\`)
- \`{{ .Token }}\` — vienkartinis kodas (tik reauthentication)
- \`{{ .NewEmail }}\` — naujas el. paštas (tik email-change)

## Pakeitimai

Šablonai sugeneruoti iš \`scripts/generate-auth-email-templates.mjs\`.
Norėdami atnaujinti — keiskit šabloną \`renderBrandedEmail\` funkciją skripte
ir paleiskit:

\`\`\`bash
node scripts/generate-auth-email-templates.mjs
\`\`\`

Tada įklijuokit pakeistus failus į Supabase Dashboard.
`;

// =============================================================================
// Generavimas
// =============================================================================
mkdirSync(OUT_DIR, { recursive: true });

for (const tpl of Object.values(templates)) {
  const path = join(OUT_DIR, tpl.file);
  writeFileSync(path, tpl.body, "utf8");
  console.log(`✓ ${tpl.file}  —  ${tpl.label}`);
  console.log(`  Subject: ${tpl.subject}`);
}

writeFileSync(join(OUT_DIR, "README.md"), README, "utf8");
console.log(`✓ README.md`);
console.log(`\nVisi šablonai išsaugoti: ${OUT_DIR}`);
console.log(`Sekančiai: įklijuokit į Supabase Dashboard pagal README.md instrukcijas.`);
