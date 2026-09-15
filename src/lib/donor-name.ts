import type { Locale } from "@/lib/i18n";

/**
 * Aukotojo vardo kaukė – VIENAS ŠALTINIS visiems puslapiams.
 *
 * Naudoja ir vieši surinkimo puslapiai (`/projektai/[slug]`, `/skaidrumas`),
 * ir narių finansų puslapis (`/finansai`). Niekur kitur `donor_name` į UI
 * tiesiogiai neduodam – kitaip vienoje vietoje rodytųsi inicialai, kitoje
 * pilnas vardas, ir GDPR pažadas subyrėtų.
 *
 * | Režimas     | „Vaida Kuncienė" → |
 * |-------------|--------------------|
 * | `initials`  | `V. K.`            |
 * | `full`      | `Vaida Kuncienė`   |
 * | `anonymous` | `Anonimas`         |
 *
 * NUMATYTASIS režimas – `initials`. `full` skirtas juridiniams asmenims,
 * institucijoms ir rėmėjams, davusiems aiškų sutikimą viešinti vardą.
 */

export type DonorDisplayMode = "initials" | "full" | "anonymous";

export const DONOR_DISPLAY_MODES: DonorDisplayMode[] = ["initials", "full", "anonymous"];

export interface DonorNameInput {
  donor_name?: string | null;
  /** Struktūrizuotas vardas – pirmenybė prieš `donor_name` parsinimą. */
  donor_first_name?: string | null;
  donor_last_name?: string | null;
  display_mode?: string | null;
  /** Legacy vėliavėlė (iki migr. 044). Naudojama tik jei `display_mode` tuščias. */
  is_anonymous?: boolean | null;
}

const ANONYMOUS_LABEL: Record<Locale, string> = {
  lt: "Anonimas",
  en: "Anonymous",
};

/** „šeima" → „family": vieninteliai ne-asmenvardžiai, kuriuos dar inicialinam. */
const FAMILY_LABEL: Record<Locale, string> = {
  lt: "šeima",
  en: "family",
};

const FAMILY_RE = /\s*šeima\s*$/i;

/** Pirmoji raidė didžiąja + taškas. „žydelienė" → „Ž." */
function initial(word: string): string {
  const clean = word.replace(/[.\s]+$/g, "").trim();
  if (!clean) return "";
  return `${clean.charAt(0).toUpperCase()}.`;
}

/**
 * Normalizuotas režimas. Jei `display_mode` dar neįrašytas (seni įrašai arba
 * nepilnas SELECT), krentam į legacy `is_anonymous`, o po jo – į `initials`.
 * Numatytasis NIEKADA nėra `full` – privatumas pagal nutylėjimą.
 */
export function donorDisplayMode(donation: DonorNameInput): DonorDisplayMode {
  const mode = donation.display_mode;
  if (mode === "initials" || mode === "full" || mode === "anonymous") return mode;
  if (donation.is_anonymous) return "anonymous";
  return "initials";
}

/**
 * Sutrumpina asmenvardį iki inicialų.
 *
 * Istoriškai `donor_name` saugotas nevienodai, todėl apdorojam visus variantus:
 *   „Vaida Kuncienė"    → „V. K."
 *   „Danutė. G"         → „D. G."   (senoji, jau sutrumpinta forma)
 *   „Mindaugas M"       → „M. M."
 *   „Menčinskų šeima"   → „M. šeima"
 *   „Vaida"             → „V."
 *   „Jonas Petras Petraitis" → „J. P."  (vardas + paskutinis žodis)
 */
function initialsFromString(raw: string, locale: Locale): string {
  const name = raw.trim();
  if (!name) return ANONYMOUS_LABEL[locale];

  // Šeima – pavardės šaknis irgi yra asmens duomuo, todėl paliekam tik inicialą
  if (FAMILY_RE.test(name)) {
    const surname = name.replace(FAMILY_RE, "").trim();
    const ini = initial(surname);
    return ini ? `${ini} ${FAMILY_LABEL[locale]}` : FAMILY_LABEL[locale];
  }

  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return initial(parts[0]);

  const first = initial(parts[0]);
  const last = initial(parts[parts.length - 1]);
  return [first, last].filter(Boolean).join(" ");
}

/**
 * Aukotojo vardas, paruoštas rodymui.
 *
 * @param donation aukos įrašas (užtenka vardo laukų ir `display_mode`)
 * @param locale   kalba – tik „Anonimas"/„šeima" etiketėms
 */
export function formatDonorName(donation: DonorNameInput, locale: Locale = "lt"): string {
  const mode = donorDisplayMode(donation);
  if (mode === "anonymous") return ANONYMOUS_LABEL[locale];

  const first = donation.donor_first_name?.trim() || "";
  const last = donation.donor_last_name?.trim() || "";
  const full = donation.donor_name?.trim() || [first, last].filter(Boolean).join(" ").trim();

  if (!full) return ANONYMOUS_LABEL[locale];
  if (mode === "full") return full;

  // Struktūrizuotas vardas – patikimiau nei eilutės parsinimas
  if (first || last) {
    const ini = [initial(first), initial(last)].filter(Boolean).join(" ");
    if (ini) return ini;
  }

  return initialsFromString(full, locale);
}

/**
 * Ar vardas atrodo kaip organizacija/institucija? Naudojama admin formoje
 * numatytajam `display_mode` pasiūlyti – organizacijoms inicialai beprasmiai
 * („Varėnos rajono savivaldybė" → „V. s." niekam nieko nepasako).
 */
export function looksLikeOrganisation(name: string): boolean {
  const n = name.trim();
  if (!n) return false;
  if (FAMILY_RE.test(n)) return false;
  if (/\b(UAB|AB|MB|VšĮ|IĮ|savivaldyb|inspekcij|fondas|asociacij|bendrov|ministerij|centras)\b/i.test(n)) {
    return true;
  }
  // Asmenvardis – vienas arba du žodžiai; ilgesni pavadinimai beveik visada
  // yra organizacijos („Gyventojų parama per VMI (1,2 % GPM)")
  return n.split(/\s+/).filter(Boolean).length > 2;
}
