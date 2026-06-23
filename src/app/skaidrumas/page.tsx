import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDict } from "@/lib/i18n-server";
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
  donor_name: string | null;
  amount_cents: number;
  donated_at: string;
  is_anonymous: boolean;
}

async function getFinansaiData() {
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
  const members = ((feeStats?.members ?? []) as { join_date: string | null; status: string }[]);
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
    const eligible = (members || []).filter((m) => {
      const joinYear = m.join_date ? new Date(m.join_date).getFullYear() : 2012;
      return joinYear <= fp.year;
    });
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
      potential_cents: eligible.length * (fp.amount_cents as number),
      paid_count: paid.metinis_count,
      unpaid_count: eligible.length - paid.metinis_count,
    };
  });

  // Aukos – Liepto projektas
  const { data: lieptasProject } = await supabase
    .from("fundraising_projects")
    .select("id, title, goal_cents")
    .eq("slug", "lieptas")
    .maybeSingle();

  const { data: donations } = lieptasProject
    ? await supabase
        .from("donations")
        .select("id, donor_name, amount_cents, donated_at, is_anonymous")
        .eq("project_id", lieptasProject.id)
        .order("donated_at", { ascending: false })
    : { data: [] };

  const totalDonations = (donations || []).reduce(
    (s, d) => s + (d.amount_cents as number),
    0
  );

  // Skola = metinis potential - metinis collected (stojamieji NEAtimti
  // iš metinio potencialo). Niekada neigiama.
  const totalDebt = yearStats.reduce(
    (s, y) =>
      s + Math.max(0, y.potential_cents - y.metinis_collected_cents),
    0
  );

  return {
    ataskaitos: documents || [],
    yearStats,
    totalDebt,
    donations: (donations || []) as DonationRow[],
    totalDonations,
    lieptasGoalCents: lieptasProject?.goal_cents ?? 0,
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
  const data = await getFinansaiData();
  const t = getDict().transparency;

  return (
    <div className="min-h-screen flex flex-col bg-amber-50/50">
      <PublicHeader />

      <main className="flex-1">
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

          <SkaidrumasTabs
            ataskaitos={data.ataskaitos}
            yearStats={data.yearStats}
            totalDebt={data.totalDebt}
            donations={data.donations}
            totalDonations={data.totalDonations}
            lieptasGoalCents={data.lieptasGoalCents}
          />
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
