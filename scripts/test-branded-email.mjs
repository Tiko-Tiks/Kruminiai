// Test naujo brand'into email šablono (modesti antraštė + logotipas apačioje)
import nodemailer from "nodemailer";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(join(__dirname, "..", ".env.local"), "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim();
  if (!process.env[key]) process.env[key] = value;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kruminiai.lt";
const logoUrl = `${baseUrl}/images/logo-md.png`;
const bodyFont = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;
const headingFont = `Georgia,'Times New Roman',serif`;

const greeting = "Sveiki, Mindaugai!";
const votedAt = new Date().toLocaleString("lt-LT", {
  timeZone: "Europe/Vilnius",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const sampleVotes = [
  { number: 3, title: "2025 m. veiklos ataskaitos tvirtinimas", vote: "uz" },
  { number: 4, title: "2025 m. finansinių ataskaitų rinkinio tvirtinimas", vote: "uz" },
  { number: 5, title: "Pavedimas pirmininkui pateikti ataskaitas Registrų centrui", vote: "uz" },
  { number: 6, title: "2026 m. veiklos planų patvirtinimas", vote: "uz" },
  { number: 7, title: "Naujų narių priėmimas", vote: "susilaike" },
  { number: 8, title: "Nemokių narių šalinimas", vote: "pries" },
  { number: 9, title: "Informacija apie 2027 m. valdymo organų rinkimus", vote: "susilaike" },
  { number: 10, title: "Kiti klausimai", vote: "uz" },
];

const voteLabels = {
  uz: { label: "Už", color: "#166534", bg: "#dcfce7" },
  pries: { label: "Prieš", color: "#991b1b", bg: "#fee2e2" },
  susilaike: { label: "Susilaikė", color: "#374151", bg: "#f3f4f6" },
};

const votesHtml = sampleVotes.map((v) => {
  const s = voteLabels[v.vote];
  return `
    <tr>
      <td style="padding:12px 8px 12px 0;border-bottom:1px solid #f3f4f6;vertical-align:top;width:32px;">
        <span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;background:#f3f4f6;color:#6b7280;border-radius:50%;font-size:12px;font-weight:600;">${v.number}</span>
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;line-height:1.5;">${v.title}</td>
      <td style="padding:12px 0 12px 8px;border-bottom:1px solid #f3f4f6;text-align:right;white-space:nowrap;vertical-align:top;">
        <span style="display:inline-block;padding:4px 12px;background:${s.bg};color:${s.color};font-size:12px;font-weight:600;border-radius:12px;">${s.label}</span>
      </td>
    </tr>`;
}).join("");

const body = `
  <h1 style="margin:0 0 20px;font-family:${headingFont};font-size:24px;font-weight:400;color:#0f3d20;letter-spacing:0.01em;line-height:1.3;">${greeting}</h1>
  <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#374151;">
    Jūsų balsas dėl <strong style="color:#111827;">2026 m. gegužės 23 d.</strong> Krūminių kaimo bendruomenės eilinio visuotinio narių susirinkimo klausimų sėkmingai užregistruotas.
  </p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0fdf4;border-left:3px solid #15803d;border-radius:4px;margin:24px 0;">
    <tr>
      <td style="padding:16px 20px;">
        <div style="font-size:14px;color:#166534;font-weight:600;">✓ Balsas užregistruotas</div>
        <div style="margin-top:4px;font-size:13px;color:#374151;">${votedAt} (Europe/Vilnius)</div>
        <div style="margin-top:8px;font-size:13px;color:#4b5563;line-height:1.5;">Susirinkimo metu būsite skaičiuojamas kaip <strong>nuotolinis dalyvis</strong> kvorumui nustatyti.</div>
      </td>
    </tr>
  </table>
  <h2 style="margin:32px 0 12px;font-family:${headingFont};font-size:18px;font-weight:400;color:#0f3d20;letter-spacing:0.01em;">Jūsų balsai pagal darbotvarkę</h2>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">${votesHtml}</table>
  <p style="margin:32px 0 8px;font-size:14px;line-height:1.6;color:#6b7280;">Jei pastebėjote klaidą arba turite klausimų, parašykite <a href="mailto:info@kruminiai.lt" style="color:#15803d;text-decoration:underline;">info@kruminiai.lt</a>.</p>
  <p style="margin:24px 0 0;font-size:15px;line-height:1.7;color:#374151;">
    Pagarbiai,<br>
    <strong style="font-family:${headingFont};font-weight:400;font-size:16px;color:#0f3d20;">Mindaugas Mameniškis</strong><br>
    <span style="color:#6b7280;font-size:13px;">Bendruomenės pirmininkas</span>
  </p>
`;

const html = `<!DOCTYPE html>
<html lang="lt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Krūminių kaimo bendruomenė</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f3ee;font-family:${bodyFont};">
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
          <td style="padding:24px 32px 32px;color:#1f2937;font-family:${bodyFont};">${body}</td>
        </tr>
        <tr>
          <td style="background-color:#fafaf7;padding:28px 32px;border-top:1px solid #e7e5dd;font-family:${bodyFont};font-size:12px;color:#6b7280;line-height:1.7;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td valign="middle" width="64" style="padding-right:16px;">
                  <img src="${logoUrl}" alt="" width="56" style="display:block;height:auto;max-width:56px;border:0;">
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
      <p style="margin:16px auto 0;max-width:600px;font-family:${bodyFont};font-size:11px;color:#9ca3af;text-align:center;line-height:1.5;">Šis pranešimas išsiųstas Krūminių kaimo bendruomenės nariui. Jei gavote jį per klaidą, susisiekite info@kruminiai.lt.</p>
    </td>
  </tr>
</table>
</body>
</html>`;

const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: parseInt(process.env.SMTP_PORT, 10) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
});

const info = await t.sendMail({
  from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
  to: "mindaugas.copy@gmail.com",
  subject: "Jūsų balsas užregistruotas – Krūminių bendruomenė",
  html,
});
console.log("✓ Išsiųsta:", info.messageId);
