/**
 * SMS ir laiškų tekstai nariams – VIENAS ŠALTINIS.
 *
 * Susirinkimo data, laikas ir pavadinimas imami iš `meetings` įrašo, todėl
 * naujas susirinkimas nereikalauja nė vieno teksto pataisymo. Laikas visada
 * verčiamas į `Europe/Vilnius` (DB stulpeliai yra `timestamptz`, o serverio
 * zona – UTC; žr. CLAUDE.md „Datos ir laikai formose").
 *
 * SMS tekstai praleidžiami per `toGsm7()`: lietuviškos diakritikos raidė SMS'e
 * perjungtų koduotę į UCS-2 (70 simbolių vietoj 160) ir žinutė suskiltų į du
 * segmentus, t. y. kainuotų dvigubai. Tai liečia ir nario vardą tekste.
 *
 * Tie patys tekstai naudojami ir admin peržiūrai prieš siuntimą, todėl tai,
 * ką administratorius mato, yra tiksliai tai, kas išsiunčiama.
 *
 * Failas sąmoningai be importų – taip jį gali paleisti ir `node --test`
 * (tests/sms-length.test.mjs), ir Next.js.
 */

export type NotificationLocale = "lt" | "en";

const TIME_ZONE = "Europe/Vilnius";

const LT_MONTHS_GENITIVE = [
  "sausio",
  "vasario",
  "kovo",
  "balandžio",
  "gegužės",
  "birželio",
  "liepos",
  "rugpjūčio",
  "rugsėjo",
  "spalio",
  "lapkričio",
  "gruodžio",
];

const EN_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MEETING_TYPE_LABELS: Record<string, { lt: string; en: string }> = {
  visuotinis: { lt: "Visuotinis narių susirinkimas", en: "General members' meeting" },
  neeilinis: { lt: "Neeilinis susirinkimas", en: "Extraordinary meeting" },
  pakartotinis: { lt: "Pakartotinis susirinkimas", en: "Repeat meeting" },
  valdybos: { lt: "Tarybos posėdis", en: "Council meeting" },
};

const MEETING_TYPE_FALLBACK = { lt: "Susirinkimas", en: "Meeting" };

interface VilniusParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
}

function vilniusParts(iso: string): VilniusParts {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Netinkama susirinkimo data: ${iso}`);
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const out: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") out[part.type] = part.value;
  }
  return out as unknown as VilniusParts;
}

/** „2026-05-23 18:00" Vilniaus laiku – trumpiausias vienareikšmis formatas SMS'ui. */
export function formatMeetingDateTime(iso: string): string {
  const p = vilniusParts(iso);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** Ar datą apskritai galima suformatuoti (patikra prieš masinį siuntimą). */
export function isValidMeetingDate(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return !Number.isNaN(new Date(iso).getTime());
}

/**
 * Ar eilutė yra reali kalendorinė data „YYYY-MM-DD".
 *
 * Vien formos patikros neužtenka: `2026-02-30` ją atitinka, bet `Date` tokią
 * datą „pataiso" į kovo 2 d. – galiojimo pabaiga tyliai nušoktų į kitą dieną,
 * nei matyti formoje. Todėl datą suformatuojam atgal ir reikalaujam, kad
 * sutaptų su įvestimi.
 */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const utc = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(utc.getTime())) return false;
  return utc.toISOString().slice(0, 10) === value;
}

/** „2026 m. gegužės 23 d." / „23 May 2026" – laiškams ir puslapių tekstams. */
export function formatMeetingDateLong(iso: string, locale: NotificationLocale): string {
  const p = vilniusParts(iso);
  const monthIndex = Number(p.month) - 1;
  const day = Number(p.day);
  if (locale === "en") {
    return `${day} ${EN_MONTHS[monthIndex]} ${p.year}`;
  }
  return `${p.year} m. ${LT_MONTHS_GENITIVE[monthIndex]} ${day} d.`;
}

/** Susirinkimo tipo pavadinimas pagal `meetings.meeting_type`. */
export function meetingTypeLabel(
  meetingType: string | null | undefined,
  locale: NotificationLocale
): string {
  const label = MEETING_TYPE_LABELS[meetingType ?? ""] ?? MEETING_TYPE_FALLBACK;
  return locale === "en" ? label.en : label.lt;
}

// GSM 03.38 bazinis rinkinys (po 7 bitus simboliui)
const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

// Išplėstiniai simboliai – kiekvienas užima DU 7 bitų vienetus
const GSM7_EXTENDED = "^{}\\[~]|€";

const LT_TRANSLITERATION: Record<string, string> = {
  ą: "a", č: "c", ę: "e", ė: "e", į: "i", š: "s", ų: "u", ū: "u", ž: "z",
  Ą: "A", Č: "C", Ę: "E", Ė: "E", Į: "I", Š: "S", Ų: "U", Ū: "U", Ž: "Z",
  "„": '"', "“": '"', "”": '"', "–": "-", "—": "-", "…": "...", " ": " ",
};

/** Pakeičia lietuviškas raides ir tipografinius ženklus GSM-7 atitikmenimis. */
export function toGsm7(text: string): string {
  let out = "";
  for (const char of text) {
    out += LT_TRANSLITERATION[char] ?? char;
  }
  return out;
}

/** Ar visas tekstas telpa į GSM-7 koduotę (kitaip SMS siunčiamas UCS-2). */
export function isGsm7(text: string): boolean {
  for (const char of text) {
    if (!GSM7_BASIC.includes(char) && !GSM7_EXTENDED.includes(char)) return false;
  }
  return true;
}

/** Kiek SMS segmentų kainuos tekstas (GSM-7: 160/153, UCS-2: 70/67). */
export function smsSegments(text: string): number {
  if (!isGsm7(text)) {
    // UCS-2: vienas vienetas = vienas UTF-16 kodo vienetas, t. y. `length`
    const units = text.length;
    return units <= 70 ? 1 : Math.ceil(units / 67);
  }
  let units = 0;
  for (const char of text) units += GSM7_EXTENDED.includes(char) ? 2 : 1;
  return units <= 160 ? 1 : Math.ceil(units / 153);
}

export interface MeetingSmsInput {
  locale: NotificationLocale;
  meetingType: string | null | undefined;
  meetingDateIso: string;
  url: string;
}

/** Kvietimo balsuoti SMS. */
export function votingSmsText({ locale, meetingType, meetingDateIso, url }: MeetingSmsInput): string {
  const label = meetingTypeLabel(meetingType, locale);
  const when = formatMeetingDateTime(meetingDateIso);
  return toGsm7(
    locale === "en"
      ? `${label} ${when}. Vote: ${url}`
      : `${label} ${when}. Balsuokite: ${url}`
  );
}

/** Priminimo SMS tiems, kurie dar nebalsavo. */
export function votingReminderSmsText({
  locale,
  meetingType,
  meetingDateIso,
  url,
}: MeetingSmsInput): string {
  const label = meetingTypeLabel(meetingType, locale);
  const when = formatMeetingDateTime(meetingDateIso);
  return toGsm7(
    locale === "en"
      ? `Reminder: ${label} ${when}. Vote: ${url}`
      : `Priminimas: ${label} ${when}. Balsuokite: ${url}`
  );
}

// ---------------------------------------------------------------------------
// Narystės deklaracijos SMS (/admin/nariai/deklaracija, /admin/mokesciai/…)
// ---------------------------------------------------------------------------

export interface DeclarationSmsInput {
  locale: NotificationLocale;
  firstName: string;
  url: string;
}

/** Pirmasis kvietimas patvirtinti narystę. */
export function declarationSmsText({ locale, firstName, url }: DeclarationSmsInput): string {
  return toGsm7(
    locale === "en"
      ? `Hello, ${firstName}. You may have forgotten your membership fee. Confirm your details and payment: ${url}`
      : `Sveiki, ${firstName}. Galbut pamirsote nario mokesti. Patvirtinkit duomenis ir mokejima: ${url}`
  );
}

/** Priminimas neatsakiusiems. */
export function declarationReminderSmsText({
  locale,
  firstName,
  url,
}: DeclarationSmsInput): string {
  return toGsm7(
    locale === "en"
      ? `Hello, ${firstName}. A reminder about your membership fee - please confirm your details: ${url}`
      : `Sveiki, ${firstName}. Priminam del nario mokescio - patvirtinkit duomenis: ${url}`
  );
}

/** Priminimas su konkrečia skolos suma (EUR, jau suformatuota). */
export function overdueDeclarationSmsText({
  locale,
  firstName,
  totalEur,
  url,
}: DeclarationSmsInput & { totalEur: string }): string {
  return toGsm7(
    locale === "en"
      ? `Hello, ${firstName}. Overdue membership fee ${totalEur} EUR. Confirm your membership: ${url}`
      : `Sveiki, ${firstName}. Pradelstas nario mokestis ${totalEur} EUR. Patvirtinkit naryste: ${url}`
  );
}
