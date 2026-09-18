import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { formatDateLong } from "@/lib/utils";
import { SITE_NAME, COMMUNITY_LEGAL } from "@/lib/constants";
import { getDict, getLocale } from "@/lib/i18n-server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kruminiai.lt";

export const metadata: Metadata = {
  title: { absolute: "Krūminių kaimo bendruomenė – kartu kuriame savo kaimą" },
  description:
    "Krūminių kaimo bendruomenė nuo 2012 m. – aktyvi Varėnos r. kaimo bendruomenė. Naujienos, artėjantys susirinkimai, dokumentai, skaidri finansų ataskaita ir narystės informacija.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "lt_LT",
    url: SITE_URL,
    siteName: "Krūminių kaimo bendruomenė",
    title: "Krūminių kaimo bendruomenė – kartu kuriame savo kaimą",
    description:
      "Aktyvi kaimo bendruomenė Varėnos r. – naujienos, susirinkimai, dokumentai ir skaidri veikla.",
  },
};
import {
  ArrowRight,
  Users,
  Newspaper,
  Handshake,
  Eye,
  TrendingUp,
  Pin,
  Calendar,
  MapPin,
  Vote,
  Clock,
  Heart,
} from "lucide-react";
import Link from "next/link";

// Šešios – kad po prisegtųjų atmetimo „Naujausios naujienos" turėtų iš ko
// sudėti tris. Anksčiau buvo `limit(3)` ir tos pačios trys naujienos ėjo
// ir į „Svarbu" bloką, ir į „Naujausios naujienos" – lankytojas matydavo
// identišką turinį du kartus iš eilės.
const NEWS_FETCH_LIMIT = 6;
const PINNED_LIMIT = 2;
const LATEST_LIMIT = 3;

async function getLatestNews() {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("news")
    .select("id, title, slug, excerpt, published_at, is_pinned")
    .eq("is_published", true)
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(NEWS_FETCH_LIMIT);
  return data || [];
}

async function getUpcomingMeeting() {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("meetings")
    .select("id, title, meeting_date, location, meeting_type, status")
    .in("status", ["planuojamas", "registracija", "vyksta"])
    .gte("meeting_date", new Date().toISOString())
    .order("meeting_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

async function getFundraisingProjects() {
  const supabase = createServerSupabaseClient();
  const { data: projects } = await supabase
    .from("fundraising_projects")
    .select(
      "id, title, title_en, short_desc, short_desc_en, slug, goal_cents, accepts_donations"
    )
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

  const locale = getLocale();
  return projects.map((project) => {
    const agg = byProject.get(project.id as string) || { total: 0, count: 0 };
    return {
      id: project.id as string,
      title:
        (locale === "en" && (project.title_en as string | null)) ||
        (project.title as string),
      shortDesc:
        (locale === "en" && (project.short_desc_en as string | null)) ||
        (project.short_desc as string | null),
      slug: project.slug as string,
      goalCents: project.goal_cents as number,
      acceptsDonations: project.accepts_donations !== false,
      totalCents: agg.total,
      donorCount: agg.count,
    };
  });
}

export default async function HomePage() {
  const [news, upcomingMeeting, projects] = await Promise.all([
    getLatestNews(),
    getUpcomingMeeting(),
    getFundraisingProjects(),
  ]);
  const t = getDict().home;

  // Prisegtos naujienos rodomos „Svarbu" juostoje, VISOS kitos – žemiau.
  // Vienas įrašas niekada nepatenka į abu blokus.
  const pinned = news.filter((n) => n.is_pinned).slice(0, PINNED_LIMIT);
  const pinnedIds = new Set(pinned.map((n) => n.id));
  const latest = news.filter((n) => !pinnedIds.has(n.id)).slice(0, LATEST_LIMIT);

  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: COMMUNITY_LEGAL.name,
    legalName: COMMUNITY_LEGAL.name,
    url: SITE_URL,
    logo: `${SITE_URL}/images/logo-md.png`,
    foundingDate: "2012",
    taxID: COMMUNITY_LEGAL.code,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Beržų g. 8",
      addressLocality: "Krūminių k.",
      addressRegion: "Varėnos r.",
      addressCountry: "LT",
    },
    areaServed: {
      "@type": "Place",
      name: "Krūminių k., Varėnos r.",
    },
    sameAs: [SITE_URL],
  };

  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "lt-LT",
  };

  return (
    <div className="min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }}
      />
      <PublicHeader />

      <main id="turinys">
        {/* Artėjantis susirinkimas – vienintelis dalykas, kuris turi teisę
            rėkti gintaro spalva. Visa kita svetainėje – ramu. */}
        {upcomingMeeting && (
          <section className="bg-accent-soft border-b border-accent-line">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
              <Link
                href={`/susirinkimai/${upcomingMeeting.id}`}
                className="block group"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
                    <Vote className="h-6 w-6 text-white" aria-hidden />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-accent-strong uppercase tracking-wide">
                      <Clock className="h-3 w-3" aria-hidden /> {t.upcomingMeetingBadge}
                    </span>
                    <h2 className="text-lg sm:text-xl font-bold text-ink mt-1 mb-1 text-balance group-hover:text-accent-strong transition-colors">
                      {upcomingMeeting.title}
                    </h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-accent" aria-hidden />
                        {formatDateLong(upcomingMeeting.meeting_date)}{" "}
                        {new Date(upcomingMeeting.meeting_date).toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vilnius" })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-accent" aria-hidden />
                        {upcomingMeeting.location}
                      </span>
                    </div>
                  </div>
                  <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-accent-strong text-white text-sm font-semibold group-hover:bg-accent transition-colors">
                    {t.upcomingMeetingCta} <ArrowRight className="h-4 w-4" aria-hidden />
                  </span>
                </div>
              </Link>
            </div>
          </section>
        )}

        {/* Hero */}
        <section className="relative bg-brand-strong text-white overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(70rem 40rem at 15% -10%, rgba(134,239,172,0.22), transparent 60%), radial-gradient(45rem 45rem at 95% 110%, rgba(21,128,61,0.55), transparent 65%)",
            }}
            aria-hidden
          />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28">
            <div className="max-w-3xl">
              <p className="text-sm uppercase tracking-[0.2em] text-green-200 mb-4 font-semibold">
                {t.heroEyebrow}
              </p>
              <h1 className="text-display-lg font-bold text-balance mb-6">
                {t.heroTitle}
              </h1>
              <p className="text-lg md:text-xl text-green-50/90 leading-relaxed mb-9 max-w-2xl text-pretty">
                {t.heroSubtitle}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/naujienos"
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-white text-brand-strong rounded-xl font-semibold hover:bg-green-50 transition-colors shadow-lg shadow-black/10"
                >
                  {t.heroNewsButton} <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/kontaktai"
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-white/10 text-white border border-white/40 rounded-xl font-semibold hover:bg-white/20 transition-colors backdrop-blur-sm"
                >
                  {t.heroContactButton}
                </Link>
              </div>
            </div>

            {/* Statistikos juostelė */}
            <dl className="mt-16 pt-9 border-t border-white/20 grid grid-cols-3 gap-4 max-w-2xl">
              {[
                // Narių skaičius patikrintas 2026-09-18 (DB: aktyvūs + garbės
                // narys, be išstojusių). Rankomis prižiūrimas skaičius – kito
                // patikrinimo metu perskaičiuoti iš naujo, ne tiesiog didinti.
                { value: "79", label: t.statMembersLabel },
                { value: "25", label: t.statVolunteersLabel },
                { value: "14", label: t.statYearsLabel },
              ].map((stat, i) => (
                <div key={stat.label} className={i > 0 ? "border-l border-white/20 pl-4" : ""}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="block text-4xl md:text-5xl font-bold">
                      {stat.value}
                    </span>
                    <span className="block text-xs sm:text-sm text-green-200 mt-1.5">
                      {stat.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Bendruomenės projektai */}
        {projects.length > 0 && (
          <section className="bg-surface border-b border-line">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {projects.map((project) => {
                const percent =
                  project.goalCents > 0
                    ? Math.round((project.totalCents / project.goalCents) * 100)
                    : 0;
                return (
                  <Link
                    key={project.id}
                    href={`/projektai/${project.slug}`}
                    className="group flex flex-col bg-surface-card rounded-2xl border border-line p-6 sm:p-7 hover:border-brand-line hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <span className="flex-shrink-0 w-11 h-11 rounded-xl bg-brand-soft border border-brand-line flex items-center justify-center">
                        <Heart className="h-5 w-5 text-brand" aria-hidden />
                      </span>
                      <span className="text-xs font-bold text-brand uppercase tracking-wide">
                        {project.acceptsDonations ? t.lieptasCategoryLabel : t.lieptasBadge}
                      </span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-bold text-ink mb-2 text-balance group-hover:text-brand-strong transition-colors">
                      {project.title}
                    </h2>
                    {project.shortDesc && (
                      <p className="text-sm text-ink-muted mb-5 text-pretty">
                        {project.shortDesc}
                      </p>
                    )}

                    {/* Progresas */}
                    <div className="mt-auto space-y-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-2xl font-semibold text-brand-strong">
                          {(project.totalCents / 100).toFixed(0)} €
                          {project.goalCents > 0 && (
                            <span className="text-sm font-sans font-normal text-ink-subtle">
                              {" "}
                              {t.lieptasProgressOf.replace("{goal}", (project.goalCents / 100).toFixed(0))}
                            </span>
                          )}
                        </span>
                        {project.acceptsDonations && (
                          <span className="text-xs text-ink-subtle">
                            {project.donorCount}{" "}
                            {project.donorCount === 1 ? t.lieptasDonorSingular : t.lieptasDonorPlural}
                          </span>
                        )}
                      </div>
                      {project.goalCents > 0 && (
                        <div
                          className="h-2 bg-brand-soft rounded-full overflow-hidden"
                          role="progressbar"
                          aria-valuenow={percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={project.title}
                        >
                          <div
                            className="h-full bg-brand rounded-full"
                            style={{ width: `${Math.min(100, percent)}%` }}
                          />
                        </div>
                      )}
                      <span className="inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-brand-strong">
                        {project.acceptsDonations ? t.lieptasCta : t.readMoreCta}
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" aria-hidden />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Svarbūs pranešimai – kompaktiškas sąrašas, ne trys dideli blokai */}
        {pinned.length > 0 && (
          <section className="bg-surface-muted border-b border-line">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-3">
              {pinned.map((article) => (
                <Link
                  key={article.id}
                  href={`/naujienos/${article.slug}`}
                  className="group flex items-start gap-4 border-l-4 border-accent bg-surface-card rounded-r-xl border-y border-r border-line p-4 sm:p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 text-xs">
                      <span className="inline-flex items-center gap-1 font-bold text-accent-strong uppercase tracking-wide">
                        <Pin className="h-3 w-3" aria-hidden /> {t.pinnedBadge}
                      </span>
                      <span className="text-ink-subtle">
                        {article.published_at ? formatDateLong(article.published_at) : ""}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-ink mb-1 text-balance group-hover:text-brand-strong transition-colors">
                      {article.title}
                    </h3>
                    {article.excerpt && (
                      <p className="text-sm text-ink-muted line-clamp-2 text-pretty">
                        {article.excerpt}
                      </p>
                    )}
                  </div>
                  <ArrowRight
                    className="h-5 w-5 flex-shrink-0 mt-1 text-ink-subtle group-hover:text-brand group-hover:translate-x-0.5 transition-all"
                    aria-hidden
                  />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Latest news */}
        {latest.length > 0 && (
          <section className="py-16 sm:py-20 bg-surface">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              <div className="flex items-end justify-between gap-4 mb-8">
                <h2 className="text-display-sm font-bold text-ink text-balance">
                  {t.latestNewsHeading}
                </h2>
                <Link
                  href="/naujienos"
                  className="flex-shrink-0 text-sm font-semibold text-brand-strong hover:underline flex items-center gap-1"
                >
                  {t.allNewsLink} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {latest.map((article) => (
                  <Link
                    key={article.id}
                    href={`/naujienos/${article.slug}`}
                    className="group bg-surface-card rounded-2xl border border-line p-6 hover:border-brand-line hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <p className="text-xs text-ink-subtle mb-2">
                      {article.published_at ? formatDateLong(article.published_at) : ""}
                    </p>
                    <h3 className="text-lg font-semibold text-ink mb-2 line-clamp-2 text-balance group-hover:text-brand-strong transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-sm text-ink-muted line-clamp-3 text-pretty">
                      {article.excerpt || ""}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* About section */}
        <section className="py-16 sm:py-20 bg-surface-muted">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="max-w-prose mx-auto text-center mb-12">
              <h2 className="text-display-sm font-bold text-ink mb-4 text-balance">
                {t.aboutHeading}
              </h2>
              <p className="text-prose text-ink-muted text-pretty">{t.aboutBody}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                {
                  icon: Handshake,
                  title: t.valueCommunityTitle,
                  desc: t.valueCommunityDesc,
                },
                {
                  icon: Eye,
                  title: t.valueTransparencyTitle,
                  desc: t.valueTransparencyDesc,
                },
                {
                  icon: TrendingUp,
                  title: t.valueInvestmentTitle,
                  desc: t.valueInvestmentDesc,
                },
              ].map((item) => (
                <div key={item.title} className="text-center">
                  <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-brand-soft border border-brand-line text-brand mb-4">
                    <item.icon className="h-6 w-6" aria-hidden />
                  </div>
                  <h3 className="text-lg font-semibold text-ink mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-ink-muted text-pretty">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Kur eiti toliau – trys skirtingos vietos.
            Anksčiau čia buvo keturios kortelės, iš kurių dvi („Apie mus" ir
            „Kontaktai") vedė į tą patį /kontaktai puslapį. */}
        <section className="py-16 bg-surface border-y border-line">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {[
                {
                  icon: Newspaper,
                  title: t.quickLinkNewsTitle,
                  desc: t.quickLinkNewsDesc,
                  href: "/naujienos",
                },
                {
                  icon: Heart,
                  title: t.quickLinkProjectsTitle,
                  desc: t.quickLinkProjectsDesc,
                  href: "/projektai",
                },
                {
                  icon: Users,
                  title: t.quickLinkAboutTitle,
                  desc: t.quickLinkAboutDesc,
                  href: "/kontaktai",
                },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-start gap-4 p-5 rounded-2xl border border-line hover:border-brand-line hover:bg-brand-soft/40 transition-colors"
                >
                  <item.icon className="h-6 w-6 flex-shrink-0 text-brand mt-0.5" aria-hidden />
                  <span>
                    <span className="block font-semibold text-ink group-hover:text-brand-strong transition-colors">
                      {item.title}
                    </span>
                    <span className="block text-sm text-ink-muted mt-0.5 text-pretty">
                      {item.desc}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Membership info */}
        <section className="py-16 sm:py-20 bg-surface-muted">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="max-w-prose mx-auto text-center">
              <h2 className="text-display-sm font-bold text-ink mb-4 text-balance">
                {t.membershipHeading}
              </h2>
              <p className="text-prose text-ink-muted mb-8 text-pretty">{t.membershipBody}</p>
              <div className="flex flex-wrap justify-center gap-4 mb-9">
                <div className="bg-surface-card rounded-2xl border border-line px-7 py-5 text-center">
                  <p className="text-3xl font-bold text-brand-strong">
                    {t.membershipJoiningFeeAmount}
                  </p>
                  <p className="text-sm text-ink-muted mt-1">{t.membershipJoiningFeeLabel}</p>
                </div>
                <div className="bg-surface-card rounded-2xl border border-line px-7 py-5 text-center">
                  <p className="text-3xl font-bold text-brand-strong">
                    {t.membershipAnnualFeeAmount}
                  </p>
                  <p className="text-sm text-ink-muted mt-1">{t.membershipAnnualFeeLabel}</p>
                </div>
              </div>
              <Link
                href="/registracija"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-brand text-brand-ink rounded-xl font-semibold hover:bg-brand-strong transition-colors shadow-sm"
              >
                {t.membershipCta}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
