import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SkaidrumasTabs } from "./SkaidrumasTabs";

export const dynamic = "force-dynamic";

interface YearStats {
  year: number;
  collected_cents: number;
  potential_cents: number;
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

  // Nario mokesčiai – pagal metus
  const { data: feePeriods } = await supabase
    .from("fee_periods")
    .select("id, year, amount_cents")
    .eq("fee_type", "metinis")
    .order("year", { ascending: false });

  const { data: members } = await supabase
    .from("members")
    .select("id, join_date, status")
    .in("status", ["aktyvus", "pasyvus"]);

  const { data: payments } = await supabase
    .from("payments")
    .select("member_id, fee_period_id, amount_cents");

  const paidByYear = new Map<number, { cents: number; count: number }>();
  for (const p of payments || []) {
    const fp = (feePeriods || []).find((f) => f.id === p.fee_period_id);
    if (!fp) continue;
    const cur = paidByYear.get(fp.year) || { cents: 0, count: 0 };
    cur.cents += p.amount_cents as number;
    cur.count += 1;
    paidByYear.set(fp.year, cur);
  }

  // Skaičiuojam kiekvienam fee_period: surinkta vs. potencialu (tik nariai,
  // įstoję iki to metų pradžios)
  const yearStats: YearStats[] = (feePeriods || []).map((fp) => {
    const eligible = (members || []).filter((m) => {
      const joinYear = m.join_date ? new Date(m.join_date).getFullYear() : 2012;
      return joinYear <= fp.year;
    });
    const paid = paidByYear.get(fp.year) || { cents: 0, count: 0 };
    return {
      year: fp.year,
      collected_cents: paid.cents,
      potential_cents: eligible.length * (fp.amount_cents as number),
      paid_count: paid.count,
      unpaid_count: eligible.length - paid.count,
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

  // Bendros sumos
  const totalFeesCollected = yearStats.reduce(
    (s, y) => s + y.collected_cents,
    0
  );
  const totalDebt = yearStats.reduce(
    (s, y) => s + (y.potential_cents - y.collected_cents),
    0
  );

  return {
    ataskaitos: documents || [],
    yearStats,
    totalFeesCollected,
    totalDebt,
    donations: (donations || []) as DonationRow[],
    totalDonations,
    lieptasGoalCents: lieptasProject?.goal_cents ?? 0,
  };
}

export const metadata = {
  title: "Skaidrumas",
  description:
    "Krūminių kaimo bendruomenės finansų skaidrumas – nario mokesčiai pagal metus, aukos, projektai ir finansinės ataskaitos.",
  alternates: { canonical: "/skaidrumas" },
  openGraph: {
    title: "Skaidrumas",
    description:
      "Nario mokesčių surinkimas, aukos ir finansinės ataskaitos – atvira informacija apie bendruomenės pinigus.",
    url: "/skaidrumas",
  },
};

export default async function SkaidrumasPage() {
  const data = await getFinansaiData();

  return (
    <div className="min-h-screen flex flex-col bg-amber-50/50">
      <PublicHeader />

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-green-800 mb-3">
              Finansų skaidrumas
            </h1>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Mes tikime atvirumu. Čia matosi visa informacija apie bendruomenės
              finansus – nario mokesčius, skolas, aukas ir kaip jos naudojamos.
              Visi kiti dokumentai – įstatai, protokolai, sutartys – yra{" "}
              <a href="/dokumentai" className="text-green-700 hover:underline font-medium">
                dokumentų archyve
              </a>
              .
            </p>
          </div>

          <SkaidrumasTabs
            ataskaitos={data.ataskaitos}
            yearStats={data.yearStats}
            totalFeesCollected={data.totalFeesCollected}
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
