// Infobip SMS API wrapper
// Docs: https://www.infobip.com/docs/api/channels/sms/sms-api-send-sms

// Toleruojam ir `xxxx.api.infobip.com`, ir `https://xxxx.api.infobip.com`
const BASE_URL = process.env.INFOBIP_BASE_URL?.replace(/^https?:\/\//, "").replace(/\/$/, "");
const API_KEY = process.env.INFOBIP_API_KEY;
const SMS_SENDER = process.env.INFOBIP_SMS_SENDER || "Kruminiai";

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendSms(toPhone: string, text: string): Promise<SmsResult> {
  if (!BASE_URL || !API_KEY) {
    console.warn("[Infobip] Trūksta INFOBIP_BASE_URL arba INFOBIP_API_KEY – siuntimas praleistas");
    console.log(`[Infobip MOCK] Į ${toPhone}: ${text}`);
    return { success: true, messageId: "mock-" + Date.now() };
  }

  // Normalizuoti telefono numerį (LT: 370XXXXXXXX, be + ir tarpų)
  const normalized = normalizePhone(toPhone);
  if (!normalized) {
    return { success: false, error: "Negaliojantis telefono numeris" };
  }

  try {
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
            from: SMS_SENDER,
            destinations: [{ to: normalized }],
            text,
          },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data?.requestError?.serviceException?.text || `HTTP ${res.status}`,
      };
    }

    const message = data?.messages?.[0];
    if (message?.status?.groupName === "REJECTED" || message?.status?.groupName === "UNDELIVERABLE") {
      return { success: false, error: message.status.description || "SMS atmestas" };
    }

    return { success: true, messageId: message?.messageId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Nežinoma klaida" };
  }
}

// LT telefono numeris → tarptautinis formatas be +
// Priima: +37061234567, 37061234567, 861234567, 61234567
export function normalizePhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  if (!cleaned) return null;

  let digits = cleaned.replace(/^\+/, "");

  // 8 -> 370 (lietuviška vidaus konvencija)
  if (digits.startsWith("8") && digits.length === 9) {
    digits = "370" + digits.slice(1);
  }
  // bareXXXXXXXX (8 skaitm.) -> 370 + 6XXXXXXXX
  else if (digits.length === 8 && digits.startsWith("6")) {
    digits = "370" + digits;
  }

  // Galiojantis LT: 370 + 8 skaitmenys = 11 skaitmenų
  if (!/^\d{10,15}$/.test(digits)) return null;

  return digits;
}
