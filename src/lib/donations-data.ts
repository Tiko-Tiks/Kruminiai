import "server-only";

import { createAdminSupabaseClient, isAdminClientAvailable } from "@/lib/supabase-admin";
import { formatDonorName, type DonorAudience } from "@/lib/donor-name";
import type { FinanceDonation } from "@/lib/finance";
import type { Locale } from "@/lib/i18n";

/**
 * Aukų skaitymas – VIENAS serverio pusės kelias.
 *
 * KODĖL taip: `donations` eilutėse guli `donor_name`, `donor_first_name` ir
 * `donor_last_name`. Aukotojo vardo kaukė (`formatDonorName`, žr.
 * `src/lib/donor-name.ts`) yra PATEIKIMO sluoksnis – ji nieko nekeičia tam, kas
 * lentelę skaito tiesiogiai per PostgREST su viešu anon raktu. Todėl nuo
 * migr. 049 `donations` SELECT RLS'e paliktas tik administratoriui, o visi
 * puslapiai eilutes ima ČIA, service-role klientu, ir į vaizdo modelius deda
 * TIK užmaskuotą vardą.
 *
 * Šis modulis:
 *   • yra `server-only` – klientinis komponentas jo importuoti negali;
 *   • NĖRA server action (nėra "use server"), kad nevirstų viešu endpoint'u;
 *   • pats NIEKO neautorizuoja. Kvietėjas atsako už tai, kad puslapį mato tas,
 *     kam jis skirtas, ir kad perduota teisinga auditorija
 *     (`public` viešiems puslapiams, `members` – tik už middleware esantiems).
 *
 * Klaida grąžinama eksplicitiškai (`ok: false`), o ne tuščiu sąrašu: tuščias
 * sąrašas iš nepavykusios užklausos puslapyje atrodytų kaip „aukų nėra" ir
 * suklastotų surinktą sumą.
 */

export type DonationRecord = FinanceDonation;

export type DonationsResult =
  | { ok: true; rows: DonationRecord[] }
  | { ok: false; error: string };

export interface DonationTotals {
  totalCents: number;
  donorCount: number;
}

/** Vaizdo modelis: žalias vardas čia nebepatenka. */
export interface DonationView {
  id: string;
  projectId: string | null;
  donor: string;
  amountCents: number;
  donatedAt: string;
  message: string | null;
}

const DONATION_COLUMNS =
  "id, project_id, donor_name, donor_first_name, donor_last_name, display_mode, is_anonymous, amount_cents, method, donated_at, donor_message";

/**
 * Aukos iš DB. `projectIds` – neprivalomas filtras; tuščias masyvas reiškia
 * „nėra ko krauti" ir grąžina tuščią sėkmę (ne klaidą).
 */
export async function loadDonations(options?: {
  projectIds?: string[];
}): Promise<DonationsResult> {
  const projectIds = options?.projectIds;
  if (projectIds && projectIds.length === 0) {
    return { ok: true, rows: [] };
  }

  if (!isAdminClientAvailable()) {
    return {
      ok: false,
      error: "Trūksta SUPABASE_SERVICE_ROLE_KEY – aukų duomenys nepasiekiami",
    };
  }

  try {
    const supabase = createAdminSupabaseClient();
    let query = supabase
      .from("donations")
      .select(DONATION_COLUMNS)
      .order("donated_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (projectIds) query = query.in("project_id", projectIds);

    const { data, error } = await query;
    if (error) return { ok: false, error: error.message };

    return { ok: true, rows: (data ?? []) as DonationRecord[] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Nežinoma klaida" };
  }
}

/** Surinkta suma ir aukotojų (įrašų) skaičius. */
export function donationTotals(rows: DonationRecord[]): DonationTotals {
  return {
    totalCents: rows.reduce((sum, d) => sum + d.amount_cents, 0),
    donorCount: rows.length,
  };
}

/** Tos pačios sumos, sugrupuotos pagal projektą. */
export function donationTotalsByProject(
  rows: DonationRecord[]
): Map<string, DonationTotals> {
  const byProject = new Map<string, DonationTotals>();
  for (const d of rows) {
    if (!d.project_id) continue;
    const cur = byProject.get(d.project_id) ?? { totalCents: 0, donorCount: 0 };
    cur.totalCents += d.amount_cents;
    cur.donorCount += 1;
    byProject.set(d.project_id, cur);
  }
  return byProject;
}

/**
 * Eilutės → vaizdo modeliai su užmaskuotu vardu.
 *
 * `audience` numatytoji reikšmė yra griežtesnioji (`public`) – pamiršus
 * parametrą gaunami inicialai, ne atvirkščiai.
 */
export function toDonationViews(
  rows: DonationRecord[],
  locale: Locale,
  audience: DonorAudience = "public"
): DonationView[] {
  return rows.map((d) => ({
    id: d.id,
    projectId: d.project_id,
    donor: formatDonorName(d, locale, audience),
    amountCents: d.amount_cents,
    donatedAt: d.donated_at,
    message: d.donor_message,
  }));
}
