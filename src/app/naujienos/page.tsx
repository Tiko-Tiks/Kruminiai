import { SiteHeader } from "@/components/layout/SiteHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getNewsArticles } from "@/actions/news";
import { formatDateLong } from "@/lib/utils";
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

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Naujienos</h1>

          {articles.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-400">Kol kas naujienų nėra</p>
            </div>
          ) : (
            <div className="space-y-4">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/naujienos/${article.slug}`}
                  className="block bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:border-green-200 transition-all"
                >
                  <div className="flex items-start gap-3">
                    {article.is_pinned && (
                      <Pin className="h-4 w-4 text-amber-500 flex-shrink-0 mt-1" />
                    )}
                    <div>
                      <p className="text-xs text-gray-400 mb-1">
                        {article.published_at ? formatDateLong(article.published_at) : ""}
                      </p>
                      <h2 className="text-lg font-semibold text-gray-900 mb-2">
                        {article.title}
                      </h2>
                      {article.excerpt && (
                        <p className="text-sm text-gray-500 line-clamp-2">{article.excerpt}</p>
                      )}
                    </div>
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
