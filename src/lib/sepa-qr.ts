// SEPA Credit Transfer (EPC) QR code generavimas.
// Standartas: EPC069-12 (European Payments Council).
// Kai nuskanuojama Lietuvos banko aplikacijoje (Swedbank, SEB, Luminor, Revolut),
// atidaroma pavedimo forma su jau užpildytais gavėjo duomenimis – naudotojui
// tereikia įvesti sumą ir patvirtinti.

import QRCode from "qrcode";

export interface SepaPayment {
  /** Gavėjo banko BIC kodas (neprivalomas v2 specifikacijoje) */
  bic?: string;
  /** Gavėjo pavadinimas (max 70 simb., be lt diakritikos saugiausia) */
  recipient: string;
  /** IBAN sąskaitos numeris */
  iban: string;
  /** Suma EUR (paliekam tuščią – aukotojas pats įveda) */
  amount?: number;
  /** Pavedimo paskirties tekstas (max 140 simb.) */
  remittance?: string;
}

/**
 * Sukonstruoja EPC SEPA QR turinio eilutę pagal standartą.
 * Eilutė pateikiama qrcode generatoriui.
 */
export function buildSepaQrPayload(p: SepaPayment): string {
  const lines = [
    "BCD",                                          // Service tag
    "002",                                          // Version
    "1",                                            // Character set: UTF-8
    "SCT",                                          // SEPA Credit Transfer
    p.bic ?? "",                                    // BIC
    p.recipient.slice(0, 70),                       // Name
    p.iban.replace(/\s+/g, ""),                     // IBAN
    p.amount ? `EUR${p.amount.toFixed(2)}` : "",    // Amount (paliekam tuščią aukotojui įvesti)
    "",                                             // Purpose code (neprivalomas)
    "",                                             // Structured reference
    (p.remittance ?? "").slice(0, 140),             // Unstructured remittance
  ];
  return lines.join("\n");
}

/**
 * Sugeneruoja SEPA QR kaip SVG eilutę (server-side, be jokio extra fetch'o).
 */
export async function generateSepaQrSvg(p: SepaPayment): Promise<string> {
  const payload = buildSepaQrPayload(p);
  return QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 400,
    color: {
      dark: "#0f3d20",
      light: "#ffffff",
    },
  });
}

/**
 * Sugeneruoja kaip Data URL (PNG base64) – atvejui, jei norėsim įdėti į img.
 */
export async function generateSepaQrDataUrl(p: SepaPayment): Promise<string> {
  const payload = buildSepaQrPayload(p);
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 512,
    color: {
      dark: "#0f3d20",
      light: "#ffffff",
    },
  });
}
