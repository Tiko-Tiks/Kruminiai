// Test naujo brand'into email šablono
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
const greeting = "Sveiki, Mindaugai!";
const votedAt = new Date().toLocaleString("lt-LT", {
  timeZone: "Europe/Vilnius",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const body = `
  <h1 style="margin:0 0 20px;font-size:22px;font-weight:600;color:#111827;letter-spacing:-0.01em;line-height:1.3;">${greeting}</h1>
  <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#374151;">
    Jūsų balsas dėl <strong style="color:#111827;">2026 m. gegužės 23 d.</strong> Krūminių kaimo bendruomenės eilinio visuotinio narių susirinkimo klausimų sėkmingai užregistruotas.
  </p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0fdf4;border-left:3px solid #15803d;border-radius:6px;margin:24px 0;">
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
  <p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:#374151;">
    Ačiū, kad aktyviai dalyvaujate bendruomenės gyvenime!
  </p>
  <p style="margin:24px 0 0;font-size:15px;line-height:1.65;color:#374151;">
    Pagarbiai,<br>
    <strong style="color:#111827;">Mindaugas Mameniškis</strong><br>
    <span style="color:#6b7280;font-size:14px;">Bendruomenės pirmininkas</span>
  </p>
`;

const html = `<!DOCTYPE html>
<html lang="lt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Krūminių kaimo bendruomenė</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f3f4f6;">Jūsų balsas dėl 2026-05-23 visuotinio susirinkimo užregistruotas.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#15803d 0%,#166534 100%);padding:32px 24px;">
            <img src="${logoUrl}" alt="Krūminių kaimo bendruomenė" width="80" style="display:block;height:auto;max-width:80px;margin:0 auto;border:0;">
            <div style="margin:16px 0 0;color:#ffffff;font-size:17px;font-weight:600;letter-spacing:-0.01em;">Krūminių kaimo bendruomenė</div>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 32px 32px;color:#1f2937;">${body}</td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.7;">
            <strong style="color:#1f2937;">Krūminių kaimo bendruomenė</strong><br>
            Beržų g. 8, Krūminių k., LT-65474 Varėnos r.<br>
            Įm. kodas: 302795244<br>
            <a href="mailto:info@kruminiai.lt" style="color:#15803d;text-decoration:none;">info@kruminiai.lt</a> &nbsp;·&nbsp; <a href="https://kruminiai.lt" style="color:#15803d;text-decoration:none;">kruminiai.lt</a>
          </td>
        </tr>
      </table>
      <p style="margin:16px auto 0;max-width:600px;font-size:11px;color:#9ca3af;text-align:center;line-height:1.5;">
        Šis pranešimas išsiųstas Krūminių kaimo bendruomenės nariui. Jei gavote jį per klaidą, susisiekite <a href="mailto:info@kruminiai.lt" style="color:#9ca3af;">info@kruminiai.lt</a>.
      </p>
    </td>
  </tr>
</table>
</body>
</html>`;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: parseInt(process.env.SMTP_PORT, 10) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
});

const info = await transporter.sendMail({
  from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
  to: "mindaugas.copy@gmail.com",
  subject: "Jūsų balsas užregistruotas – Krūminių bendruomenė",
  html,
});

console.log("✓ Išsiųsta:", info.messageId);
console.log("  response:", info.response);
