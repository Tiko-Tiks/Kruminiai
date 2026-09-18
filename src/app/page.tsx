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
import { ArrowRight, Pin, Heart } from "lucide-react";
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

  // „Skelbimų lenta" pagrindinio puslapio dešinėje – vietoj dekoratyvių
  // skaičių kubelių, tikras šiandienos turinys: artėjantis susirinkimas,
  // prisegta naujiena, aktyvaus projekto progresas. Kiekvienas – iš JAU
  // gautų duomenų, be papildomų DB kvietimų.
  type Notice = { key: string; eyebrow: string; title: string; meta?: string; href: string };
  const notices: Notice[] = [];
  if (upcomingMeeting) {
    notices.push({
      key: "meeting",
      eyebrow: t.upcomingMeetingBadge,
      title: upcomingMeeting.title,
      meta: `${formatDateLong(upcomingMeeting.meeting_date)} · ${upcomingMeeting.location}`,
      href: `/susirinkimai/${upcomingMeeting.id}`,
    });
  }
  if (pinned[0]) {
    notices.push({
      key: "news",
      eyebrow: t.noticeboardNewsLabel,
      title: pinned[0].title,
      meta: pinned[0].published_at ? formatDateLong(pinned[0].published_at) : undefined,
      href: `/naujienos/${pinned[0].slug}`,
    });
  }
  const activeProject = projects.find((pr) => pr.acceptsDonations && pr.goalCents > 0);
  if (activeProject) {
    const pct = Math.min(100, Math.round((activeProject.totalCents / activeProject.goalCents) * 100));
    notices.push({
      key: "project",
      eyebrow: t.lieptasCategoryLabel,
      title: activeProject.title,
      meta: t.noticeboardProjectProgress.replace("{percent}", String(pct)),
      href: `/projektai/${activeProject.slug}`,
    });
  }

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
        {/* Priešakinis puslapis – asimetriškas dviejų stulpelių maketas,
            NE centruotas „hero" su gradiento dekoracijomis ir statistikos
            kubeliais (tas raštas identiškas kiekvienam AI sugeneruotam
            puslapiui: eyebrow + antraštė + subtitle + 2 mygtukai + 3 skaičiai).
            Kairėje – konkreti tapatybės antraštė su realiais kaimų vardais
            (ne pakartotas svetainės pavadinimas, kuris jau yra header'yje virš).
            Dešinėje – tikra, gyva „skelbimų lenta": artėjantis susirinkimas,
            naujiena, projekto progresas – tas pats turinys, kuris anksčiau
            gulėjo atskiroje gintarinėje juostoje ir statistikos kubeliuose. */}
        <section className="bg-surface-muted border-b border-line">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 md:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10 lg:gap-16 items-start">
              {/* Tapatybė */}
              <div>
                <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.12em] text-brand mb-4 text-balance">
                  {t.heroEyebrow}
                </p>
                <h1 className="text-display-lg font-bold text-ink text-balance mb-5">
                  {t.heroTitle}
                </h1>
                <p className="text-lg text-ink-muted leading-relaxed max-w-2xl text-pretty mb-8">
                  {t.heroSubtitle}
                </p>
                <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
                  <Link
                    href="/naujienos"
                    className="inline-flex items-center gap-2 px-5 py-3 bg-brand text-brand-ink rounded-xl font-semibold hover:bg-brand-strong transition-colors"
                  >
                    {t.heroNewsButton} <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <Link
                    href="/kontaktai"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink hover:text-brand-strong transition-colors"
                  >
                    {t.heroContactButton} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </div>

              {/* Skelbimų lenta */}
              <aside className="bg-surface-card border border-line rounded-2xl overflow-hidden lg:sticky lg:top-24">
                <div className="h-1 bg-brand" aria-hidden />
                <div className="p-5">
                  <h2 className="text-xs font-bold uppercase tracking-wide text-ink-subtle mb-4">
                    {t.noticeboardHeading}
                  </h2>
                  {notices.length > 0 ? (
                    <ul className="space-y-4">
                      {notices.map((n, i) => (
                        <li key={n.key} className={i > 0 ? "pt-4 border-t border-line" : ""}>
                          <Link href={n.href} className="group block">
                            <span className="block text-xs font-semibold text-brand mb-1 truncate">
                              {n.eyebrow}
                            </span>
                            <span className="block text-sm font-semibold text-ink group-hover:text-brand-strong transition-colors text-balance">
                              {n.title}
                            </span>
                            {n.meta && (
                              <span className="block text-xs text-ink-subtle mt-1">{n.meta}</span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Link
                      href="/naujienos"
                      className="text-sm text-brand-strong font-semibold hover:underline"
                    >
                      {t.noticeboardEmpty}
                    </Link>
                  )}
                </div>
              </aside>
            </div>
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

        {/* About section – redakcinis dviejų stulpelių maketas, be ikonų */}
        <section className="py-16 sm:py-20 bg-surface-muted">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
              <div className="max-w-prose">
                <h2 className="text-display-sm font-bold text-ink mb-4 text-balance">
                  {t.aboutHeading}
                </h2>
                <p className="text-prose text-ink-muted text-pretty">{t.aboutBody}</p>
              </div>
              <div className="space-y-6">
                {[
                  { title: t.valueCommunityTitle, desc: t.valueCommunityDesc },
                  { title: t.valueTransparencyTitle, desc: t.valueTransparencyDesc },
                  { title: t.valueInvestmentTitle, desc: t.valueInvestmentDesc },
                ].map((item) => (
                  <div key={item.title} className="border-l-2 border-brand-line pl-5">
                    <h3 className="font-semibold text-ink mb-1">{item.title}</h3>
                    <p className="text-sm text-ink-muted text-pretty">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Membership info */}
        <section className="py-16 sm:py-20 bg-surface border-t border-line">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="max-w-prose mx-auto text-center">
              <h2 className="text-display-sm font-bold text-ink mb-4 text-balance">
                {t.membershipHeading}
              </h2>
              <p className="text-prose text-ink-muted mb-6 text-pretty">{t.membershipBody}</p>
              <p className="text-sm text-ink-muted mb-8">
                {t.membershipJoiningFeeLabel}{" "}
                <strong className="text-ink font-semibold">{t.membershipJoiningFeeAmount}</strong>
                <span className="mx-2.5 text-line-strong" aria-hidden>·</span>
                {t.membershipAnnualFeeLabel}{" "}
                <strong className="text-ink font-semibold">{t.membershipAnnualFeeAmount}</strong>
              </p>
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
