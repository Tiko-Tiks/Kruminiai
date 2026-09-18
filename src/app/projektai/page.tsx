import { createServerSupabaseClient } from "@/lib/supabase-server";
import { donationTotalsByProject, loadDonations } from "@/lib/donations-data";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Heart, ArrowRight } from "lucide-react";
import { getDict } from "@/lib/i18n-server";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Projektai",
  description:
    "Krūminių kaimo bendruomenės aukų rinkimo projektai – skaidri lėšų istorija ir progresas iki tikslo.",
  alternates: { canonical: "/projektai" },
};

interface ProjectCard {
  id: string;
  slug: string;
  title: string;
  short_desc: string | null;
  goal_cents: number;
  /** `null` – aukų suvestinės užkrauti nepavyko (nulis čia meluotų). */
  total_cents: number | null;
  donor_count: number | null;
}

async function getProjects(): Promise<ProjectCard[]> {
  const supabase = createServerSupabaseClient();
  const { data: projects } = await supabase
    .from("fundraising_projects")
    .select("id, slug, title, short_desc, goal_cents")
    .eq("is_public", true)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (!projects || projects.length === 0) return [];

  // Aukos – per serverio kroviklį (žr. src/lib/donations-data.ts): `donations`
  // lentelėje guli žali aukotojų vardai, todėl anon raktui ji neprieinama.
  const donations = await loadDonations({ projectIds: projects.map((p) => p.id as string) });
  const byProject = donations.ok ? donationTotalsByProject(donations.rows) : null;
  if (!donations.ok) {
    console.error("[/projektai] Nepavyko užkrauti aukų suvestinės:", donations.error);
  }

  return projects.map((p) => {
    const agg = byProject?.get(p.id as string) ?? null;
    return {
      id: p.id as string,
      slug: p.slug as string,
      title: p.title as string,
      short_desc: (p.short_desc as string) || null,
      goal_cents: p.goal_cents as number,
      total_cents: byProject ? (agg?.totalCents ?? 0) : null,
      donor_count: byProject ? (agg?.donorCount ?? 0) : null,
    };
  });
}

export default async function ProjectsPage() {
  const projects = await getProjects();
  const t = getDict().projects;
  const tCommon = getDict().common;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <PublicHeader />

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <div className="mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              {t.pageTitle}
            </h1>
            <p className="text-base text-gray-600 max-w-2xl leading-relaxed">{t.pageIntro}</p>
          </div>

          {projects.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
              <Heart className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">{t.emptyState}</p>
            </div>
          ) : (
            <div className="space-y-5">
              {projects.map((p) => {
                const totalCents = p.total_cents;
                const percent =
                  totalCents !== null && p.goal_cents > 0
                    ? Math.min(100, Math.round((totalCents / p.goal_cents) * 100))
                    : 0;
                return (
                  <Link
                    key={p.id}
                    href={`/projektai/${p.slug}`}
                    className="block bg-gradient-to-br from-amber-50 via-white to-amber-50/50 rounded-2xl border-2 border-amber-200 p-6 sm:p-8 hover:border-amber-300 hover:shadow-lg transition-all group"
                  >
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                      <div className="flex-shrink-0">
                        <div className="w-16 h-16 rounded-2xl bg-amber-400 flex items-center justify-center shadow-md">
                          <Heart className="h-8 w-8 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white uppercase tracking-wide mb-2">
                          {t.fundraisingBadge}
                        </span>
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 group-hover:text-amber-700 transition-colors">
                          {p.title}
                        </h2>
                        {p.short_desc && (
                          <p className="text-base text-gray-700 mb-3 leading-relaxed max-w-2xl">
                            {p.short_desc}
                          </p>
                        )}
                        {totalCents === null ? (
                          <p className="text-sm text-gray-500">{tCommon.dataUnavailable}</p>
                        ) : (
                          <div className="space-y-1.5 max-w-xl">
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                              <span className="font-semibold text-gray-900">
                                {(totalCents / 100).toFixed(0)} €
                                {p.goal_cents > 0 && (
                                  <span className="text-gray-400 font-normal">
                                    {" "}{t.amountOfGoal.replace("{goal}", (p.goal_cents / 100).toFixed(0))}
                                  </span>
                                )}
                              </span>
                              {p.donor_count !== null && (
                                <span className="text-xs text-gray-500">
                                  {p.donor_count}{" "}
                                  {p.donor_count === 1 ? t.donorSingular : t.donorPlural}
                                </span>
                              )}
                            </div>
                            {p.goal_cents > 0 && (
                              <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 self-stretch md:self-center">
                        <span className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold group-hover:bg-amber-700 transition-colors whitespace-nowrap">
                          {t.readMore} <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
