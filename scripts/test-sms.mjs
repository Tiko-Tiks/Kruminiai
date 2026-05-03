// Test SMS siuntimas per Infobip
// Naudojimas: node scripts/test-sms.mjs

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

// Įkrauti .env.local
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim().replace(/^"|"$/g, "");
  if (!process.env[key]) process.env[key] = value;
}

const BASE_URL = process.env.INFOBIP_BASE_URL?.replace(/^https?:\/\//, "").replace(/\/$/, "");
const API_KEY = process.env.INFOBIP_API_KEY;
const SENDER = process.env.INFOBIP_SMS_SENDER || "Kruminiai";
const TO = "37065849514";
const TEXT = "Krūminių bendruomenė. Test SMS – jei matote šią žinutę, integracija veikia ✓";

console.log("→ Konfigūracija:");
console.log("  BASE_URL:", BASE_URL || "(nėra)");
console.log("  API_KEY:", API_KEY ? `${API_KEY.slice(0, 8)}...${API_KEY.slice(-4)}` : "(nėra)");
console.log("  SENDER:", SENDER);
console.log("  TO:", TO);
console.log("");

if (!BASE_URL || !API_KEY) {
  console.error("❌ Trūksta INFOBIP_BASE_URL arba INFOBIP_API_KEY .env.local faile");
  process.exit(1);
}

console.log("→ Siunčiama...");
const res = await fetch(`https://${BASE_URL}/sms/2/text/advanced`, {
  method: "POST",
  headers: {
    Authorization: `App ${API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify({
    messages: [
      {
        from: SENDER,
        destinations: [{ to: TO }],
        text: TEXT,
      },
    ],
  }),
});

const data = await res.json();
console.log("");
console.log("→ HTTP", res.status);
console.log("→ Atsakymas:");
console.log(JSON.stringify(data, null, 2));

if (res.ok) {
  const msg = data?.messages?.[0];
  if (msg?.status?.groupName === "PENDING" || msg?.status?.groupName === "ACCEPTED") {
    console.log("");
    console.log("✓ SMS priimtas siuntimui. messageId:", msg.messageId);
    console.log("  Po kelių sekundžių turėtų ateiti į telefoną.");
  } else {
    console.log("");
    console.log("⚠ Statusas:", msg?.status?.name, "-", msg?.status?.description);
  }
}
