// Email siuntimas per Hostinger SMTP (nodemailer)

import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.hostinger.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "465", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER || "noreply@kruminiai.lt";
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "Krūminių kaimo bendruomenė";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!SMTP_USER || !SMTP_PASSWORD) return null;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
  return transporter;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<EmailResult> {
  const t = getTransporter();
  if (!t) {
    console.warn("[Email] Trūksta SMTP_USER/SMTP_PASSWORD – siuntimas praleistas");
    console.log(`[Email MOCK] Į ${to}: ${subject}`);
    return { success: true, messageId: "mock-" + Date.now() };
  }

  try {
    const info = await t.sendMail({
      from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
      to,
      subject,
      text: text || htmlToText(html),
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Nežinoma klaida" };
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

// Brand'intas email šablonas su logotipu, antrašte ir poraštė.
// Tinka visiems email klientams (table-based layout, inline CSS).
export function renderBrandedEmail(opts: {
  preheader?: string;       // peržiūros tekstas inbox'e (paslėptas)
  body: string;             // pagrindinio turinio HTML
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kruminiai.lt";
  const logoUrl = `${baseUrl}/images/logo-md.png`;

  // Kūno šriftai: sisteminis sans-serif – švarus, gerai veikia visur.
  // Antraštės: Georgia (klasikinis serif, prieinamas visiems email klientams).
  const bodyFont = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;
  const headingFont = `Georgia,'Times New Roman',serif`;

  return `<!DOCTYPE html>
<html lang="lt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Krūminių kaimo bendruomenė</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f3ee;font-family:${bodyFont};">
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f5f3ee;">${opts.preheader}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f3ee;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <!-- Kukli antraštė: tik tekstas su žalia akcento juosta -->
        <tr>
          <td style="padding:32px 32px 0;font-family:${headingFont};">
            <div style="font-size:13px;color:#15803d;letter-spacing:0.12em;text-transform:uppercase;font-family:${bodyFont};font-weight:600;">Krūminių kaimo bendruomenė</div>
            <div style="height:2px;background-color:#15803d;width:48px;margin-top:12px;"></div>
          </td>
        </tr>
        <!-- Pagrindinis turinys -->
        <tr>
          <td style="padding:24px 32px 32px;color:#1f2937;font-family:${bodyFont};">
            ${opts.body}
          </td>
        </tr>
        <!-- Poraštė: logotipas + rekvizitai -->
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
      <p style="margin:16px auto 0;max-width:600px;font-family:${bodyFont};font-size:11px;color:#9ca3af;text-align:center;line-height:1.5;">
        Šis pranešimas išsiųstas Krūminių kaimo bendruomenės nariui. Jei gavote jį per klaidą, susisiekite <a href="mailto:info@kruminiai.lt" style="color:#9ca3af;">info@kruminiai.lt</a>.
      </p>
    </td>
  </tr>
</table>
</body>
</html>`;
}
