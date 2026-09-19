import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDict, getLocale } from "@/lib/i18n-server";
import {
  donationTotals,
  donationTotalsByProject,
  loadDonations,
  toDonationViews,
} from "@/lib/donations-data";
import type { Locale } from "@/lib/i18n";
import { SkaidrumasTabs } from "./SkaidrumasTabs";

export const dynamic = "force-dynamic";

interface YearStats {
  year: number;
  collected_cents: number;          // visi mokėjimai (metinis + stojamieji)
  metinis_collected_cents: number;  // tik metinis – naudojam skolai apskaičiuoti
  potential_cents: number;          // potencialas = aktyvūs nariai × metinis tarifas
  paid_count: number;
  unpaid_count: number;
}

interface DonationRow {
  id: string;
  /** Jau užmaskuotas vardas – pilnas `donor_name` į klientą nekeliauja. */
  donor: string;
  amount_cents: number;
  donated_at: string;
}

async function getFinansaiData(locale: Locale) {
  const supabase = createServerSupabaseClient();

  // Tik finansinių ataskaitų dokumentai – Skaidrumas puslapis sutelktas
  // į finansus. Visi kiti dokumentai (įstatai, protokolai, sutartys) gyvena
  // /dokumentai puslapyje, su nuoroda iš čia.
  const { data: documents } = await supabase
    .from("documents")
    .select("id, title, file_path, file_name, category, published_at, file_size")
    .eq("is_public", true)
    .eq("category", "ataskaitos")
    .order("published_at", { ascending: false });

  // Nario mokesčiai – visi fee_periods, NE tik metinis. Stojamieji
  // (vienkartinis) ir tiksliniai mokėjimai irgi yra bendruomenės pajamos
  // ir turi būti įtraukti į „Surinkta" sumas.
  const { data: feePeriods } = await supabase
    .from("fee_periods")
    .select("id, year, fee_type, amount_cents")
    .order("year", { ascending: false });

  // Nariai + mokėjimai agregavimui – per SECURITY DEFINER RPC: nariams
  // nebereikia tiesioginės SELECT teisės į members/payments (ten PII),
  // o RPC grąžina tik statistikai būtinus laukus be asmens duomenų.
  const { data: feeStats } = await supabase.rpc("get_transparency_fee_stats");
  const paidCounts=new Map<string,number>((feeStats?.paid_counts || []).map((p:{fee_period_id:string;count:number})=>[p.fee_period_id,p.count]));
  const payments = ((feeStats?.payments ?? []) as { fee_period_id: string; amount_cents: number }[]);

  // Grupuojam payments pagal metus, atskirai metinius ir kitus (stojamieji,
  // tiksliniai, vienkartiniai), kad galėtume rodyti breakdown.
  const paidByYear = new Map<
    number,
    { metinis_cents: number; metinis_count: number; kita_cents: number; kita_count: number }
  >();
  for (const p of payments || []) {
    const fp = (feePeriods || []).find((f) => f.id === p.fee_period_id);
    if (!fp) continue;
    const cur =
      paidByYear.get(fp.year) || {
        metinis_cents: 0,
        metinis_count: 0,
        kita_cents: 0,
        kita_count: 0,
      };
    if (fp.fee_type === "metinis") {
      cur.metinis_cents += p.amount_cents as number;
      cur.metinis_count += 1;
    } else {
      cur.kita_cents += p.amount_cents as number;
      cur.kita_count += 1;
    }
    paidByYear.set(fp.year, cur);
  }

  // Metiniams skaičiuojam potencialą (X narių × 12€), kitiems – tik tai, kas surinkta
  const metinisByYear = (feePeriods || [])
    .filter((fp) => fp.fee_type === "metinis")
    .sort((a, b) => (b.year as number) - (a.year as number));

  const yearStats: YearStats[] = metinisByYear.map((fp) => {
    const eligibleCount = ((feeStats?.eligible_counts ?? []) as { fee_period_id: string; count: number }[]).find(row => row.fee_period_id === fp.id)?.count ?? 0;
    const paid = paidByYear.get(fp.year) || {
      metinis_cents: 0,
      metinis_count: 0,
      kita_cents: 0,
      kita_count: 0,
    };
    return {
      year: fp.year,
      collected_cents: paid.metinis_cents + paid.kita_cents, // metinis + stojamieji
      metinis_collected_cents: paid.metinis_cents, // tik metinis – naudojam skolai
      potential_cents: eligibleCount * (fp.amount_cents as number),
      paid_count: paidCounts.get(fp.id) || 0,
      unpaid_count: Math.max(0,eligibleCount - (paidCounts.get(fp.id) || 0)),
    };
  });

  // Aukos – VISI vieši projektai (ne tik lieptas)
  const { data: projectRows } = await supabase
    .from("fundraising_projects")
    .select("id, title, slug, goal_cents, accepts_donations")
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  // Aukos – per serverio kroviklį (žr. src/lib/donations-data.ts): `donations`
  // lentelėje guli žali aukotojų vardai, todėl ji nebeprieinama nei anon, nei
  // eiliniam nariui. Auditorija čia – `members`: puslapis už middleware.
  const donationsResult = await loadDonations({
    projectIds: (projectRows || []).map((p) => p.id as string),
  });
  // Skola = metinis potential - metinis collected (stojamieji NEAtimti
  // iš metinio potencialo). Niekada neigiama.
  const totalDebt = yearStats.reduce(
    (s, y) =>
      s + Math.max(0, y.potential_cents - y.metinis_collected_cents),
    0
  );

  // Nepavykus užkrauti aukų grąžinam `null`, o NE nulines sumas: tuščias
  // sąrašas puslapyje virstų „surinkta 0 €" ir 0 % progresu, t. y. atrodytų
  // kaip tikras rezultatas. `null` verčia UI parodyti nepasiekiamumo būseną.
  if (!donationsResult.ok) {
    console.error("[/skaidrumas] Nepavyko užkrauti aukų:", donationsResult.error);
    return {
      ataskaitos: documents || [],
      yearStats,
      totalDebt,
      donationSummary: null,
    };
  }

  const donationRecords = donationsResult.rows;
  const totalsByProject = donationTotalsByProject(donationRecords);

  // Kiekvieno projekto suvestinė – atskira kortelė su savo progresu
  const projects = (projectRows || []).map((project) => {
    const own = totalsByProject.get(project.id as string);
    return {
      id: project.id as string,
      title: project.title as string,
      slug: project.slug as string,
      goalCents: project.goal_cents as number,
      acceptsDonations: project.accepts_donations !== false,
      totalCents: own?.totalCents ?? 0,
      donorCount: own?.donorCount ?? 0,
    };
  });

  // Aukotojų vardai per bendrą kaukę (žr. src/lib/donor-name.ts). Auditorija –
  // `members`: puslapis už middleware, jį mato tik patvirtinti nariai.
  const donationRows: DonationRow[] = toDonationViews(
    donationRecords,
    locale,
    "members"
  ).map((d) => ({
    id: d.id,
    donor: d.donor,
    amount_cents: d.amountCents,
    donated_at: d.donatedAt,
  }));

  return {
    ataskaitos: documents || [],
    yearStats,
    totalDebt,
    donationSummary: {
      totalDonations: donationTotals(donationRecords).totalCents,
      donations: donationRows,
      projects,
    },
  };
}

export const metadata = {
  title: "Finansai",
  description:
    "Krūminių kaimo bendruomenės finansai – nario mokesčiai pagal metus, aukos, projektai ir finansinės ataskaitos.",
  alternates: { canonical: "/skaidrumas" },
  openGraph: {
    title: "Finansai",
    description:
      "Nario mokesčių surinkimas, aukos ir finansinės ataskaitos – atvira informacija apie bendruomenės pinigus.",
    url: "/skaidrumas",
  },
};

export default async function SkaidrumasPage() {
  const locale = getLocale();
  const data = await getFinansaiData(locale);
  const t = getDict().transparency;

  return (
    <div className="min-h-screen flex flex-col bg-amber-50/50">
      <PublicHeader />

      <main id="turinys" className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-green-800 mb-3">
              {t.pageHeading}
            </h1>
            <p className="text-gray-500 max-w-2xl mx-auto">
              {t.introPrefix}{" "}
              <a href="/dokumentai" className="text-green-700 hover:underline font-medium">
                {t.introLinkWord}
              </a>
              .
            </p>
          </div>

          {/* Aukų dalis gali būti nepasiekiama (DB klaida). Tada
              `donationSummary` yra `null` ir komponentas sumų NErodo – nei
              kortelėje, nei projektų progrese, nei aukotojų lentelėje. */}
          <SkaidrumasTabs
            ataskaitos={data.ataskaitos}
            yearStats={data.yearStats}
            totalDebt={data.totalDebt}
            donationSummary={data.donationSummary}
          />
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
