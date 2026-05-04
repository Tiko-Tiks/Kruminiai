import type { MetadataRoute } from "next";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kruminiai.lt";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/naujienos`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/kontaktai`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/skaidrumas`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/dokumentai`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/susirinkimai`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];

  let newsRoutes: MetadataRoute.Sitemap = [];
  try {
    const supabase = createServerSupabaseClient();
    const { data: news } = await supabase
      .from("news")
      .select("slug, published_at, updated_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(500);

    newsRoutes =
      news?.map((article) => ({
        url: `${SITE_URL}/naujienos/${article.slug}`,
        lastModified: new Date(article.updated_at || article.published_at || now),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })) || [];
  } catch {
    // jei Supabase neprieinamas build metu – grąžinama tik statinė dalis
  }

  return [...staticRoutes, ...newsRoutes];
}
