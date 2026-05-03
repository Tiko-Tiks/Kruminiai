// Test email siuntimas per Hostinger SMTP
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
  const value = trimmed.slice(eq + 1).trim().replace(/^"|"$/g, "");
  if (!process.env[key]) process.env[key] = value;
}

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "465", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM;
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME;
const TO = "mindaugas.copy@gmail.com";

console.log("→ Konfigūracija:");
console.log("  SMTP_HOST:", SMTP_HOST);
console.log("  SMTP_PORT:", SMTP_PORT);
console.log("  SMTP_USER:", SMTP_USER);
console.log("  SMTP_PASSWORD:", SMTP_PASSWORD ? `(${SMTP_PASSWORD.length} simb.)` : "(NĖRA)");
console.log("  EMAIL_FROM:", EMAIL_FROM);
console.log("  EMAIL_FROM_NAME:", EMAIL_FROM_NAME);
console.log("");

if (!SMTP_USER || !SMTP_PASSWORD) {
  console.error("❌ Trūksta SMTP_USER arba SMTP_PASSWORD");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  logger: true,
  debug: true,
});

console.log("→ Tikrinu jungtį...");
try {
  await transporter.verify();
  console.log("✓ SMTP jungtis OK");
} catch (err) {
  console.error("❌ SMTP jungties klaida:", err.message);
  process.exit(1);
}

console.log("\n→ Siunčiu test email į", TO);
try {
  const info = await transporter.sendMail({
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: TO,
    subject: "Krūminių bendruomenė – test email",
    text: "Sveiki, čia test email iš Krūminių sistemos.",
    html: "<p>Sveiki, čia <b>test email</b> iš Krūminių sistemos.</p>",
  });
  console.log("✓ Išsiųsta. messageId:", info.messageId);
  console.log("  response:", info.response);
} catch (err) {
  console.error("❌ Siuntimo klaida:", err.message);
  console.error("  code:", err.code);
  console.error("  response:", err.response);
}
