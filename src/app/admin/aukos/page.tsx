import { createServerSupabaseClient } from "@/lib/supabase-server";
import { DonationsPanel } from "./DonationsPanel";
import { ProgressPanel } from "./ProgressPanel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Aukos",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AukosPage() {
  const supabase = createServerSupabaseClient();

  const { data: projects } = await supabase
    .from("fundraising_projects")
    .select("id, slug, title, goal_cents, is_active")
    .order("title");

  const { data: donations } = await supabase
    .from("donations")
    .select("*, project:fundraising_projects(slug, title)")
    .order("donated_at", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: updates } = await supabase
    .from("project_updates")
    .select("*, project:fundraising_projects(slug, title)")
    .order("update_date", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: expenses } = await supabase
    .from("project_expenses")
    .select("*, project:fundraising_projects(slug, title)")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Aukos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Lėšų rinkimo projektai ir gautos aukos. Pridedame banko išrašo ar grynais
          gautas aukas – progresas viešame puslapyje atsinaujins iškart.
        </p>
      </div>

      <DonationsPanel projects={projects || []} donations={donations || []} />

      <div className="mt-10 mb-6">
        <h2 className="text-xl font-bold text-gray-900">Statybų eiga ir išlaidos</h2>
        <p className="text-sm text-gray-500 mt-1">
          II etapas – darbų įrašai su nuotraukomis ir išlaidų registras. Viskas
          iškart matoma viešame projekto puslapyje.
        </p>
      </div>

      <ProgressPanel
        projects={projects || []}
        updates={updates || []}
        expenses={expenses || []}
      />
    </div>
  );
}
