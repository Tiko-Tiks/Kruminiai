import { createServerSupabaseClient } from "@/lib/supabase-server";
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
  total_cents: number;
  donor_count: number;
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

  // Visos aukos vienoje užklausoje – sugrupuojam per project_id
  const { data: donations } = await supabase
    .from("donations")
    .select("project_id, amount_cents")
    .in(
      "project_id",
      projects.map((p) => p.id)
    );

  const byProject = new Map<string, { total: number; count: number }>();
  for (const d of donations ?? []) {
    const cur = byProject.get(d.project_id as string) || { total: 0, count: 0 };
    cur.total += d.amount_cents as number;
    cur.count += 1;
    byProject.set(d.project_id as string, cur);
  }

  return projects.map((p) => {
    const agg = byProject.get(p.id as string) || { total: 0, count: 0 };
    return {
      id: p.id as string,
      slug: p.slug as string,
      title: p.title as string,
      short_desc: (p.short_desc as string) || null,
      goal_cents: p.goal_cents as number,
      total_cents: agg.total,
      donor_count: agg.count,
    };
  });
}

export default async function ProjectsPage() {
  const projects = await getProjects();
  const t = getDict().projects;

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main id="turinys" className="flex-1 bg-surface-muted">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <header className="mb-10 max-w-prose">
            <h1 className="text-display-md font-bold text-ink text-balance">
              {t.pageTitle}
            </h1>
            <p className="mt-3 text-prose text-ink-muted text-pretty">{t.pageIntro}</p>
          </header>

          {projects.length === 0 ? (
            <div className="bg-surface-card rounded-2xl border border-line p-10 text-center">
              <Heart className="h-10 w-10 text-ink-subtle/50 mx-auto mb-3" aria-hidden />
              <p className="text-ink-subtle">{t.emptyState}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {projects.map((p) => {
                const percent =
                  p.goal_cents > 0
                    ? Math.min(100, Math.round((p.total_cents / p.goal_cents) * 100))
                    : 0;
                return (
                  <Link
                    key={p.id}
                    href={`/projektai/${p.slug}`}
                    className="group flex flex-col bg-surface-card rounded-2xl border border-line p-6 sm:p-7 hover:border-brand-line hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <span className="flex-shrink-0 w-11 h-11 rounded-xl bg-brand-soft border border-brand-line flex items-center justify-center">
                        <Heart className="h-5 w-5 text-brand" aria-hidden />
                      </span>
                      <span className="text-xs font-bold text-brand uppercase tracking-wide">
                        {t.fundraisingBadge}
                      </span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-bold text-ink mb-2 text-balance group-hover:text-brand-strong transition-colors">
                      {p.title}
                    </h2>
                    {p.short_desc && (
                      <p className="text-sm text-ink-muted mb-5 text-pretty">{p.short_desc}</p>
                    )}

                    <div className="mt-auto space-y-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-2xl font-semibold text-brand-strong">
                          {(p.total_cents / 100).toFixed(0)} €
                          {p.goal_cents > 0 && (
                            <span className="text-sm font-sans font-normal text-ink-subtle">
                              {" "}{t.amountOfGoal.replace("{goal}", (p.goal_cents / 100).toFixed(0))}
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-ink-subtle">
                          {p.donor_count}{" "}
                          {p.donor_count === 1 ? t.donorSingular : t.donorPlural}
                        </span>
                      </div>
                      {p.goal_cents > 0 && (
                        <div
                          className="h-2 bg-brand-soft rounded-full overflow-hidden"
                          role="progressbar"
                          aria-valuenow={percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={p.title}
                        >
                          <div
                            className="h-full bg-brand rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      )}
                      <span className="inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-brand-strong">
                        {t.readMore}
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" aria-hidden />
                      </span>
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
