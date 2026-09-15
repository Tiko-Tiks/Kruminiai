import type { Locale } from "@/lib/i18n";

/**
 * Aukotojo vardo kaukė – VIENAS ŠALTINIS visiems puslapiams.
 *
 * Naudoja ir vieši surinkimo puslapiai (`/projektai/[slug]`, `/lieptas`), ir
 * nariams skirti (`/finansai`, `/skaidrumas`). Niekur kitur `donor_name` į UI
 * tiesiogiai neduodam – kitaip vienoje vietoje rodytųsi inicialai, kitoje
 * pilnas vardas, ir GDPR pažadas subyrėtų.
 *
 * | Režimas     | viešai (`public`) | nariams (`members`) |
 * |-------------|-------------------|---------------------|
 * | `initials`  | `V. K.`           | `Vaida K.`          |
 * | `full`      | `Vaida Kuncienė`  | `Vaida Kuncienė`    |
 * | `anonymous` | `Anonimas`        | `Anonimas`          |
 *
 * NUMATYTASIS režimas – `initials`, numatytoji auditorija – `public`.
 * `full` skirtas juridiniams asmenims, institucijoms ir rėmėjams, davusiems
 * aiškų sutikimą viešinti vardą.
 *
 * KODĖL nariams daugiau: `/finansai` ir `/skaidrumas` yra už middleware –
 * juos mato tik prisijungę PATVIRTINTI nariai, t. y. tie patys žmonės, kurie
 * vieni kitus ir taip pažįsta. Vieši puslapiai atviri visam internetui, todėl
 * ten pavardė lieka paslėpta ir vardas neatidengiamas.
 */

export type DonorDisplayMode = "initials" | "full" | "anonymous";

/**
 * Kam rodoma. `initials` režimas skiriasi pagal auditoriją:
 *
 *   public  – vieši puslapiai (`/projektai/[slug]`, `/lieptas`), mato bet kas
 *             internete → tik inicialai („V. K.")
 *   members – už middleware esantys puslapiai (`/finansai`, `/skaidrumas`),
 *             mato tik prisijungę patvirtinti nariai → vardas + pavardės
 *             raidė („Vaida K."), kad savi vieni kitus atpažintų
 *
 * NUMATYTA – `public`. Jei kviesdamas pamirši nurodyti auditoriją, gausi
 * griežtesnį variantą, o ne atvirkščiai.
 */
export type DonorAudience = "public" | "members";

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
  const clean = stripTrailingDot(word);
  if (!clean) return "";
  return `${clean.charAt(0).toUpperCase()}.`;
}

/** Vardas be galūninio taško – istorinė forma „Danutė. G" paliko tašką. */
function stripTrailingDot(word: string): string {
  return word.replace(/[.\s]+$/g, "").trim();
}

/**
 * Asmenvardžio kaukė pagal auditoriją.
 *
 * `parts` – vardo žodžiai; paskutinis laikomas pavarde. Pavardė VISADA
 * sutrumpinama iki raidės, skiriasi tik tai, ar vardas rodomas pilnas.
 */
function maskPerson(parts: string[], audience: DonorAudience): string {
  const words = parts.map((w) => w.trim()).filter(Boolean);
  if (words.length === 0) return "";

  // Vienas žodis – pavardės nėra, tai vardas
  if (words.length === 1) {
    return audience === "members" ? stripTrailingDot(words[0]) : initial(words[0]);
  }

  const surname = initial(words[words.length - 1]);
  if (audience === "members") {
    const given = words.slice(0, -1).map(stripTrailingDot).filter(Boolean);
    return [...given, surname].filter(Boolean).join(" ");
  }
  return [initial(words[0]), surname].filter(Boolean).join(" ");
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
 * Sutrumpina asmenvardį iš laisvos eilutės (fallback'as, kai nėra
 * struktūrizuoto vardo). Istoriškai `donor_name` saugotas nevienodai, todėl
 * apdorojam visus variantus:
 *
 * |                          | public    | members          |
 * |--------------------------|-----------|------------------|
 * | „Vaida Kuncienė"         | „V. K."   | „Vaida K."       |
 * | „Danutė. G"              | „D. G."   | „Danutė G."      |
 * | „Mindaugas M"            | „M. M."   | „Mindaugas M."   |
 * | „Vaida"                  | „V."      | „Vaida"          |
 * | „Jonas Petras Petraitis" | „J. P."   | „Jonas Petras P."|
 * | „Menčinskų šeima"        | „M. šeima"| „M. šeima"       |
 *
 * Šeima abiem atvejais lieka su inicialu: ten vienintelis vardo dėmuo yra
 * PAVARDĖ, o pavardę slepiam visada.
 */
function initialsFromString(raw: string, locale: Locale, audience: DonorAudience): string {
  const name = raw.trim();
  if (!name) return ANONYMOUS_LABEL[locale];

  if (FAMILY_RE.test(name)) {
    const surname = name.replace(FAMILY_RE, "").trim();
    const ini = initial(surname);
    return ini ? `${ini} ${FAMILY_LABEL[locale]}` : FAMILY_LABEL[locale];
  }

  return maskPerson(name.split(/\s+/), audience);
}

/**
 * Aukotojo vardas, paruoštas rodymui.
 *
 * @param donation aukos įrašas (užtenka vardo laukų ir `display_mode`)
 * @param locale   kalba – tik „Anonimas"/„šeima" etiketėms
 * @param audience kam rodoma; `public` (numatyta) yra griežtesnis variantas
 */
export function formatDonorName(
  donation: DonorNameInput,
  locale: Locale = "lt",
  audience: DonorAudience = "public"
): string {
  const mode = donorDisplayMode(donation);
  if (mode === "anonymous") return ANONYMOUS_LABEL[locale];

  const first = donation.donor_first_name?.trim() || "";
  const last = donation.donor_last_name?.trim() || "";
  const full = donation.donor_name?.trim() || [first, last].filter(Boolean).join(" ").trim();

  if (!full) return ANONYMOUS_LABEL[locale];
  if (mode === "full") return full;

  // Struktūrizuotas vardas – patikimiau nei eilutės parsinimas
  if (first || last) {
    const masked = maskPerson([first, last], audience);
    if (masked) return masked;
  }

  return initialsFromString(full, locale, audience);
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
