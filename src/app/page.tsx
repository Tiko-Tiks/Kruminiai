import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { formatDateLong } from "@/lib/utils";
import { SITE_NAME } from "@/lib/constants";
import { ArrowRight, FileText, Users, Newspaper, Phone, Handshake, Eye, TrendingUp } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

async function getLatestNews() {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("news")
    .select("id, title, slug, excerpt, published_at, is_pinned")
    .eq("is_published", true)
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(3);
  return data || [];
}

export default async function HomePage() {
  const news = await getLatestNews();

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      {/* Hero */}
      <section className="bg-gradient-to-br from-green-800 via-green-700 to-green-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28">
          <div className="flex flex-col md:flex-row items-center gap-10">
          <Image
            src="/images/logo-md.png"
            alt={SITE_NAME}
            width={180}
            height={270}
            className="hidden md:block drop-shadow-xl"
            priority
          />
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
              {SITE_NAME}
            </h1>
            <p className="text-lg text-green-100 leading-relaxed mb-8">
              Elektroninė demokratija ir socialinis verslas. Kartu kuriame
              geresnę ateitį mūsų kaimui ir žmonėms.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/naujienos"
                className="inline-flex items-center gap-2 px-5 py-3 bg-white text-green-800 rounded-lg font-medium hover:bg-green-50 transition-colors"
              >
                Naujienos <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/kontaktai"
                className="inline-flex items-center gap-2 px-5 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-500 transition-colors"
              >
                Susisiekite
              </Link>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Newspaper, title: "Naujienos", desc: "Pranešimai apie susirinkimus, renginius ir svarbius sprendimus", href: "/naujienos" },
              { icon: FileText, title: "Dokumentai", desc: "Įstatai, protokolai, ataskaitos ir kiti svarbūs dokumentai", href: "/dokumentai" },
              { icon: Users, title: "Apie mus", desc: "Vizija, misija ir socialinio verslo modelis", href: "/kontaktai" },
              { icon: Phone, title: "Kontaktai", desc: "Susisiekite su bendruomenės valdyba", href: "/kontaktai" },
            ].map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group p-6 rounded-xl border border-gray-200 hover:border-green-300 hover:shadow-md transition-all"
              >
                <item.icon className="h-8 w-8 text-green-700 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-green-700">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Latest news */}
      {news.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Naujausios naujienos</h2>
              <Link
                href="/naujienos"
                className="text-sm text-green-700 hover:text-green-800 font-medium flex items-center gap-1"
              >
                Visos naujienos <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {news.map((article) => (
                <Link
                  key={article.id}
                  href={`/naujienos/${article.slug}`}
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:border-green-200 transition-all"
                >
                  <p className="text-xs text-gray-400 mb-2">
                    {article.published_at ? formatDateLong(article.published_at) : ""}
                  </p>
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{article.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-3">
                    {article.excerpt || ""}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* About section */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Apie bendruomenę</h2>
            <p className="text-gray-600 leading-relaxed">
              Telkiame bendruomenės narius bendriems projektams ir iniciatyvoms, kurios
              pagerina gyvenimo kokybę Krūminiuose. Skatinama kaimynystė, savanoriškumas
              ir tarpusavio pagarba. Aktyviai bendradarbiaujame su vietiniais verslais,
              savivaldybe ir kitomis organizacijomis.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { icon: Handshake, title: "Bendruomeniškumas", desc: "Kuriame darnią aplinką, kurioje visi gali rasti veiklų ir prisidėti prie bendruomenės gyvenimo" },
              { icon: Eye, title: "Skaidrumas", desc: "Visi finansiniai srautai yra skaidrūs ir prieinami bendruomenės nariams" },
              { icon: TrendingUp, title: "Socialinis verslas", desc: "Veikiame pagal socialinio verslo principus, kurie leidžia būti finansiškai nepriklausomiems" },
            ].map((item) => (
              <div key={item.title} className="text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-green-100 text-green-700 mb-3">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Membership info */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Tapkite nariu</h2>
            <p className="text-gray-600 leading-relaxed mb-6">
              Bendruomenės nariais gali būti 18 metų sulaukę veiksnūs fiziniai asmenys,
              gyvenantys, dirbantys ar turintys nuosavybės Krūminių kaime ir pritariantys
              bendruomenės tikslams.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              <div className="bg-white rounded-xl border border-gray-200 px-6 py-4 text-center">
                <p className="text-2xl font-bold text-green-700">20 &euro;</p>
                <p className="text-sm text-gray-500">Stojamasis mokestis</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 px-6 py-4 text-center">
                <p className="text-2xl font-bold text-green-700">12 &euro;</p>
                <p className="text-sm text-gray-500">Metinis nario mokestis</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
