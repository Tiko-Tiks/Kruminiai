// Bendri bendruomenės mokėjimo rekvizitai ir mokesčių dydžiai.
// VIENAS šaltinis – kad sąskaitos nr. / sumos negyventų išmėtyti po failus.

export const BANK_NAME = "AB Artea bankas";
export const BANK_ACCOUNT = "LT167181200000606866";
export const BANK_RECIPIENT = "Krūminių kaimo bendruomenė";

// Stojamasis (vienkartinis, naujam nariui) ir metinis nario mokestis.
export const ENTRY_FEE_EUR = 20;
export const MEMBERSHIP_FEE_EUR = 12;

type PaymentBlockLocale = "lt" | "en";

const PAYMENT_BLOCK_LABELS: Record<PaymentBlockLocale, {
  heading: string;
  recipient: string;
  account: string;
  bank: string;
  amount: string;
  purpose: string;
}> = {
  lt: {
    heading: "Mokėjimo rekvizitai",
    recipient: "Gavėjas:",
    account: "Sąskaita:",
    bank: "Bankas:",
    amount: "Suma:",
    purpose: "Paskirtis:",
  },
  en: {
    heading: "Payment details",
    recipient: "Recipient:",
    account: "Account:",
    bank: "Bank:",
    amount: "Amount:",
    purpose: "Reference:",
  },
};

/**
 * Brand'into email'o „Mokėjimo rekvizitai" blokas (žalia kortelė).
 * Naudojamas narystės ir priminimų laiškuose, kad rekvizitai atrodytų vienodai.
 * `locale` lemia etiketes (LT numatyta).
 */
export function renderPaymentDetailsBlock(opts: {
  amountLabel: string; // pvz. „32 EUR"
  purpose: string; // pvz. „Nario mokestis – Vardas Pavardė"
  locale?: PaymentBlockLocale;
}): string {
  const L = PAYMENT_BLOCK_LABELS[opts.locale ?? "lt"];
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0fdf4;border-left:3px solid #15803d;border-radius:4px;margin:24px 0;">
      <tr>
        <td style="padding:18px 22px;">
          <div style="font-size:13px;color:#166534;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">${L.heading}</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;color:#374151;line-height:1.7;">
            <tr>
              <td style="padding-right:12px;color:#6b7280;">${L.recipient}</td>
              <td style="font-weight:600;color:#111827;">${BANK_RECIPIENT}</td>
            </tr>
            <tr>
              <td style="padding-right:12px;color:#6b7280;">${L.account}</td>
              <td style="font-family:monospace;font-weight:600;color:#111827;">${BANK_ACCOUNT}</td>
            </tr>
            <tr>
              <td style="padding-right:12px;color:#6b7280;">${L.bank}</td>
              <td style="color:#111827;">${BANK_NAME}</td>
            </tr>
            <tr>
              <td style="padding-right:12px;color:#6b7280;">${L.amount}</td>
              <td style="font-weight:700;color:#15803d;">${opts.amountLabel}</td>
            </tr>
            <tr>
              <td style="padding-right:12px;color:#6b7280;">${L.purpose}</td>
              <td style="color:#111827;">${opts.purpose}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}
