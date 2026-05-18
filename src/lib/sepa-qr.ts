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
 * Versijos pasirinkimas:
 * - Jei BIC pateiktas → v001 (10 laukų, BIC privalomas)
 * - Jei BIC NE pateiktas → v002 (11 laukų, BIC neprivalomas; bankų
 *   aplikacija pati susiranda BIC iš IBAN per LEI/SWIFT registrą)
 *
 * Tai svarbu, nes BIC↔IBAN neatitikimas yra dažna priežastis, kodėl
 * bankų aplikacijos atmeta SEPA QR su pranešimu „nepalaikomas".
 *
 * Eilutė pateikiama qrcode generatoriui kaip Byte mode segmentas.
 */
export function buildSepaQrPayload(p: SepaPayment): string {
  const hasBic = !!(p.bic && p.bic.trim());

  if (hasBic) {
    // v001 – kompaktiškiausia forma su BIC
    return [
      "BCD",
      "001",
      "1",
      "SCT",
      p.bic!.trim(),
      p.recipient.slice(0, 70),
      p.iban.replace(/\s+/g, ""),
      p.amount ? `EUR${p.amount.toFixed(2)}` : "",
      "",                                           // Purpose code
      (p.remittance ?? "").slice(0, 140),           // Remittance Information
    ].join("\n");
  }

  // v002 – BIC neprivalomas, banko app pati ras BIC iš IBAN
  return [
    "BCD",
    "002",
    "1",
    "SCT",
    "",                                             // BIC (tuščia – derive iš IBAN)
    p.recipient.slice(0, 70),
    p.iban.replace(/\s+/g, ""),
    p.amount ? `EUR${p.amount.toFixed(2)}` : "",
    "",                                             // Purpose code
    "",                                             // Structured reference
    (p.remittance ?? "").slice(0, 140),
  ].join("\n");
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
