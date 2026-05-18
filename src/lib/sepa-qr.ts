// SEPA Credit Transfer (EPC) QR code generavimas.
// Standartas: EPC069-12 (European Payments Council).
// Kai nuskanuojama Lietuvos banko aplikacijoje (Swedbank, SEB, Luminor, Revolut),
// atidaroma pavedimo forma su jau užpildytais gavėjo duomenimis – naudotojui
// tereikia įvesti sumą ir patvirtinti.

import QRCode, { type QRCodeSegment } from "qrcode";

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
 *
 * Naudojam v001 (10 laukų, BIC privalomas) – Lietuvos bankų aplikacijos
 * (Swedbank, SEB, Luminor, LKU) v001 palaiko labiau nuosekliai negu v002.
 * v002 kai kurios LT app'ų versijos atmeta kaip „nepalaikomas".
 *
 * Eilutė pateikiama qrcode generatoriui kaip Byte mode segmentas.
 */
export function buildSepaQrPayload(p: SepaPayment): string {
  const lines = [
    "BCD",                                          // 1. Service tag
    "001",                                          // 2. Version (v001 plačiau palaikoma LT)
    "1",                                            // 3. Character set: UTF-8
    "SCT",                                          // 4. SEPA Credit Transfer
    p.bic ?? "",                                    // 5. BIC (privalomas v001)
    p.recipient.slice(0, 70),                       // 6. Name
    p.iban.replace(/\s+/g, ""),                     // 7. IBAN
    p.amount ? `EUR${p.amount.toFixed(2)}` : "",    // 8. Amount (tuščia – aukotojas įveda)
    "",                                             // 9. Purpose code (neprivalomas)
    (p.remittance ?? "").slice(0, 140),             // 10. Remittance Information
  ];
  return lines.join("\n");
}

/**
 * Sugeneruoja SEPA QR kaip SVG eilutę (server-side, be jokio extra fetch'o).
 *
 * SVARBU: payload'as perduodamas KAIP VIENAS „byte" segmentas. Default'inis
 * qrcode autodetect'as padalintų jį į Byte/Numeric/Byte (nes IBAN ir bank
 * kodai yra skaitiniai) – tokio mišraus encoding'o kai kurios bankų
 * aplikacijos neapdoroja kaip EPC SEPA QR ir grąžina „negaliojantis".
 */
export async function generateSepaQrSvg(p: SepaPayment): Promise<string> {
  const payload = buildSepaQrPayload(p);
  // Byte mode reikalauja Uint8Array – konvertuojam payload'ą iš UTF-8.
  const segments: QRCodeSegment[] = [
    { data: new TextEncoder().encode(payload), mode: "byte" },
  ];
  return QRCode.toString(segments, {
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
  const segments: QRCodeSegment[] = [
    { data: new TextEncoder().encode(payload), mode: "byte" },
  ];
  return QRCode.toDataURL(segments, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 512,
    color: {
      dark: "#0f3d20",
      light: "#ffffff",
    },
  });
}
