import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getNewsArticle } from "@/actions/news";
import { formatDateLong } from "@/lib/utils";
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
    },
    twitter: {
      card: "summary",
      title: article.title,
      description,
    },
  };
}

export default async function NewsArticlePage({ params }: Props) {
  const article = await getNewsArticle(params.slug);
  if (!article) notFound();

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex-1 bg-gray-50">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          <Link
            href="/naujienos"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Visos naujienos
          </Link>

          <header className="mb-8">
            <p className="text-sm text-gray-400 mb-2">
              {article.published_at ? formatDateLong(article.published_at) : ""}
            </p>
            <h1 className="text-3xl font-bold text-gray-900">{article.title}</h1>
          </header>

          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <MarkdownContent content={article.content} />
          </div>
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}
