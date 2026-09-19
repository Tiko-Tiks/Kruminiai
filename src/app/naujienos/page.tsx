import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getNewsArticles } from "@/actions/news";
import { formatDateLong, getImagePublicUrl } from "@/lib/utils";
import { getDict } from "@/lib/i18n-server";
import { newsCategoryLabel } from "@/lib/news-category";
import { Pin } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Naujienos",
  description:
    "Krūminių kaimo bendruomenės naujienos – pranešimai apie susirinkimus, renginius, sprendimus ir bendruomenės gyvenimą.",
  alternates: { canonical: "/naujienos" },
  openGraph: {
    title: "Naujienos",
    description:
      "Krūminių kaimo bendruomenės naujienos – pranešimai apie susirinkimus, renginius ir sprendimus.",
    url: "/naujienos",
  },
};

export default async function NewsPage() {
  const articles = await getNewsArticles(true);
  const t = getDict().news;

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main id="turinys" className="flex-1 bg-surface-muted">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <header className="mb-10 max-w-prose">
            <h1 className="text-display-md font-bold text-ink text-balance">{t.pageTitle}</h1>
            <p className="mt-3 text-prose text-ink-muted text-pretty">{t.pageIntro}</p>
          </header>

          {articles.length === 0 ? (
            <div className="bg-surface-card rounded-2xl border border-line p-12 text-center">
              <p className="text-ink-subtle">{t.emptyState}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/naujienos/${article.slug}`}
                  className="group flex flex-col overflow-hidden bg-surface-card rounded-2xl border border-line hover:border-brand-line hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                >
                  {/* Vienodo formato viršus: arba nuotrauka, arba spalvinis laukas.
                      Anksčiau dalis įrašų turėjo miniatiūrą, dalis ne, todėl
                      sąrašo eilutės šokinėjo skirtingais aukščiais. */}
                  {article.cover_image_path ? (
                    <img
                      src={getImagePublicUrl(article.cover_image_path, { width: 560 })}
                      alt={t.coverAlt}
                      loading="lazy"
                      width={560}
                      height={315}
                      className="w-full aspect-[16/9] object-cover"
                    />
                  ) : (
                    // Be viršelio – ramus bendruomenės ženklas. Kategorijos
                    // pavadinimas čia netiko: dauguma įrašų yra „bendra", tad
                    // tas pats žodis kartojosi per visą tinklelį ir atrodė
                    // kaip klaida.
                    <div className="w-full aspect-[16/9] bg-brand-soft border-b border-brand-line flex items-center justify-center">
                      <img
                        src="/images/logo-sm.png"
                        alt=""
                        aria-hidden
                        width={40}
                        height={60}
                        className="h-14 w-auto opacity-25"
                      />
                    </div>
                  )}

                  <div className="flex-1 p-5 sm:p-6">
                    <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
                      {article.is_pinned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft text-accent-strong border border-accent-line px-2 py-0.5 font-semibold">
                          <Pin className="h-3 w-3" aria-hidden /> {t.pinnedLabel}
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-full bg-brand-soft text-brand-strong border border-brand-line px-2 py-0.5 font-semibold">
                        {newsCategoryLabel(article.category, t)}
                      </span>
                      <span className="text-ink-subtle">
                        {article.published_at ? formatDateLong(article.published_at) : ""}
                      </span>
                    </div>
                    <h2 className="text-xl font-semibold text-ink mb-2 text-balance group-hover:text-brand-strong transition-colors">
                      {article.title}
                    </h2>
                    {article.excerpt && (
                      <p className="text-sm text-ink-muted line-clamp-3 text-pretty">
                        {article.excerpt}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
