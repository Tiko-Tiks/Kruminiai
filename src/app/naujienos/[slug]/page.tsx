import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getNewsArticle } from "@/actions/news";
import { formatDateLong, getImagePublicUrl } from "@/lib/utils";
import { getDict } from "@/lib/i18n-server";
import { newsCategoryLabel } from "@/lib/news-category";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MarkdownContent } from "./MarkdownContent";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getNewsArticle(params.slug);
  if (!article) return { title: "Nerasta" };
  const description =
    article.excerpt ||
    `Krūminių kaimo bendruomenės naujiena: ${article.title}`;
  const canonical = `/naujienos/${article.slug}`;
  // Viršelis – ir kaip social share nuotrauka (Facebook, Messenger)
  const cover = article.cover_image_path
    ? getImagePublicUrl(article.cover_image_path)
    : null;
  return {
    title: article.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: article.title,
      description,
      url: canonical,
      publishedTime: article.published_at || undefined,
      locale: "lt_LT",
      siteName: "Krūminių kaimo bendruomenė",
      ...(cover ? { images: [cover] } : {}),
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title: article.title,
      description,
      ...(cover ? { images: [cover] } : {}),
    },
  };
}

export default async function NewsArticlePage({ params }: Props) {
  const article = await getNewsArticle(params.slug);
  if (!article) notFound();
  const t = getDict().news;

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      {/* Straipsnis – ant balto, ne dėžutėje ant pilko. Tekstas apribotas
          `max-w-prose` (~68 simboliai eilutėje); anksčiau eilutė siekė ~90
          simbolių, o tai jau varginanti skaitymo riba. */}
      <main id="turinys" className="flex-1 bg-surface">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <Link
            href="/naujienos"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-brand-strong transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> {t.backToList}
          </Link>

          <header className="mb-8">
            <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
              <span className="inline-flex items-center rounded-full bg-brand-soft text-brand-strong border border-brand-line px-2.5 py-0.5 font-semibold">
                {newsCategoryLabel(article.category, t)}
              </span>
              <time
                className="text-ink-subtle"
                dateTime={article.published_at || undefined}
              >
                {article.published_at ? formatDateLong(article.published_at) : ""}
              </time>
            </div>
            <h1 className="text-display-md font-bold text-ink text-balance">
              {article.title}
            </h1>
            {article.excerpt && (
              <p className="mt-4 text-lg leading-relaxed text-ink-muted text-pretty max-w-prose">
                {article.excerpt}
              </p>
            )}
          </header>

          {article.cover_image_path && (
            <img
              src={getImagePublicUrl(article.cover_image_path, { width: 768 })}
              alt={t.coverAlt}
              width={768}
              height={432}
              className="w-full aspect-[16/9] object-cover rounded-2xl border border-line mb-10"
            />
          )}

          <div className="max-w-prose">
            <MarkdownContent content={article.content} />
          </div>

          <footer className="mt-12 pt-8 border-t border-line">
            <Link
              href="/naujienos"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-strong hover:underline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> {t.backToList}
            </Link>
          </footer>
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}
