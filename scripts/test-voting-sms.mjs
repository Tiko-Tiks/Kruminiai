// Vienkartinis test SMS su balsavimo nuoroda Mindaugui
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

const BASE_URL = process.env.INFOBIP_BASE_URL?.replace(/^https?:\/\//, "").replace(/\/$/, "");
const API_KEY = process.env.INFOBIP_API_KEY;
const SENDER = process.env.INFOBIP_SMS_SENDER || "Kruminiai";
const TO = "37065849514";
const TOKEN = "ca51c303ef3a2b9eadf5a01fe4d191f1";
const URL = `https://kruminiai.lt/balsuoti/${TOKEN}`;
const TEXT = `KKB visuotinis susirinkimas 2026-05-23 18:00. Balsuokite: ${URL}`;

console.log("→ SMS tekstas:", TEXT);
console.log("→ Ilgis:", TEXT.length, "simb.");
console.log("");

const res = await fetch(`https://${BASE_URL}/sms/2/text/advanced`, {
  method: "POST",
  headers: {
    Authorization: `App ${API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify({
    messages: [{ from: SENDER, destinations: [{ to: TO }], text: TEXT }],
  }),
});

const data = await res.json();
console.log("→ HTTP", res.status);
console.log(JSON.stringify(data, null, 2));
