import { SiteHeader } from "@/components/layout/SiteHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SkaidrumasTabs } from "./SkaidrumasTabs";

async function getFinansaiData() {
  const supabase = createServerSupabaseClient();

  // Get all public documents by category
  const { data: documents } = await supabase
    .from("documents")
    .select("id, title, file_path, file_name, category, published_at, file_size")
    .eq("is_public", true)
    .order("published_at", { ascending: false });

  // Get published news for "susirinkimai" / "projektai" if any
  const { data: news } = await supabase
    .from("news")
    .select("id, title, slug, excerpt, published_at, is_pinned")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  return {
    documents: documents || [],
    news: news || [],
  };
}

export const metadata = {
  title: "Skaidrumas",
  description:
    "Krūminių kaimo bendruomenės skaidrumo puslapis – metinės ataskaitos, susirinkimų protokolai, įstatai ir kiti viešai prieinami dokumentai.",
  alternates: { canonical: "/skaidrumas" },
  openGraph: {
    title: "Skaidrumas",
    description:
      "Metinės ataskaitos, protokolai ir įstatai – atvira informacija apie bendruomenės veiklą.",
    url: "/skaidrumas",
  },
};

export default async function SkaidrumasPage() {
  const { documents, news } = await getFinansaiData();

  const ataskaitos = documents.filter((d) => d.category === "ataskaitos");
  const protokolai = documents.filter((d) => d.category === "protokolai");
  const istatai = documents.filter((d) => d.category === "istatai" || d.category === "sutartys");
  return (
    <div className="min-h-screen flex flex-col bg-amber-50/50">
      <SiteHeader />

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-green-800 mb-3">
              Bendruomenės Skaidrumas
            </h1>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Mes tikime atvirumu. Čia galite rasti viešai prieinamą informaciją apie
              mūsų veiklą, finansus ir priimtus sprendimus.
            </p>
          </div>

          <SkaidrumasTabs
            ataskaitos={ataskaitos}
            protokolai={protokolai}
            istatai={istatai}
            news={news}
          />
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
