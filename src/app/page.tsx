import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { formatDateLong } from "@/lib/utils";
import { SITE_NAME, COMMUNITY_LEGAL } from "@/lib/constants";

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
  FileText,
  Users,
  Newspaper,
  Phone,
  Handshake,
  Eye,
  TrendingUp,
  Pin,
  CalendarDays,
  Calendar,
  MapPin,
  Vote,
  Clock,
} from "lucide-react";
import Link from "next/link";

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

export default async function HomePage() {
  const [news, upcomingMeeting] = await Promise.all([getLatestNews(), getUpcomingMeeting()]);

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

      {/* Artėjantis susirinkimas – svarbus skelbimas pačiame viršuje */}
      {upcomingMeeting && (
        <section className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-b-2 border-amber-300">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            <Link
              href={`/susirinkimai/${upcomingMeeting.id}`}
              className="block group"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-amber-500 flex items-center justify-center shadow-md">
                  <Vote className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white uppercase tracking-wide">
                      <Clock className="h-3 w-3" /> Artėjantis susirinkimas
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 group-hover:text-amber-700 transition-colors">
                    {upcomingMeeting.title}
                  </h2>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-amber-600" />
                      {formatDateLong(upcomingMeeting.meeting_date)}{" "}
                      {new Date(upcomingMeeting.meeting_date).toLocaleTimeString("lt-LT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-amber-600" />
                      {upcomingMeeting.location}
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0 self-stretch sm:self-center">
                  <span className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold group-hover:bg-amber-700 transition-colors">
                    Darbotvarkė ir dokumentai <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-green-800 via-green-700 to-green-900 text-white overflow-hidden">
        {/* Dekoracija – tik subtilios šviesos formos, be logotipo */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-0 -left-24 w-72 h-72 rounded-full bg-green-400/15 blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-widest text-green-200 mb-3 font-medium">
              Nuo 2012 m.
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-5">
              {SITE_NAME}
            </h1>
            <p className="text-lg md:text-xl text-green-100 leading-relaxed mb-8 max-w-2xl">
              Kartu kuriame geresnę ateitį mūsų kaimui ir žmonėms.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/naujienos"
                className="inline-flex items-center gap-2 px-5 py-3 bg-white text-green-800 rounded-lg font-medium hover:bg-green-50 transition-colors shadow-sm"
              >
                Naujienos <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/kontaktai"
                className="inline-flex items-center gap-2 px-5 py-3 bg-white/10 text-white border border-white/30 rounded-lg font-medium hover:bg-white/20 transition-colors backdrop-blur-sm"
              >
                Susisiekite
              </Link>
            </div>
          </div>

          {/* Statistikos juostelė */}
          <div className="mt-12 pt-8 border-t border-white/15 grid grid-cols-3 gap-4 max-w-2xl">
            <div>
              <div className="text-3xl md:text-4xl font-bold">70+</div>
              <div className="text-xs sm:text-sm text-green-200 mt-1">narių</div>
            </div>
            <div className="border-l border-white/15 pl-4">
              <div className="text-3xl md:text-4xl font-bold">25</div>
              <div className="text-xs sm:text-sm text-green-200 mt-1">savanorių</div>
            </div>
            <div className="border-l border-white/15 pl-4">
              <div className="text-3xl md:text-4xl font-bold">14</div>
              <div className="text-xs sm:text-sm text-green-200 mt-1">veiklos metų</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pinned announcement */}
      {news.filter((n) => n.is_pinned).length > 0 && (
        <section className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            {news
              .filter((n) => n.is_pinned)
              .map((article) => (
                <Link
                  key={article.id}
                  href={`/naujienos/${article.slug}`}
                  className="block bg-amber-50 rounded-xl border border-amber-200 p-5 hover:border-amber-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center">
                      <CalendarDays className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-400 text-white">
                          <Pin className="h-3 w-3" /> Svarbu
                        </span>
                        <span className="text-xs text-gray-400">
                          {article.published_at ? formatDateLong(article.published_at) : ""}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1 group-hover:text-amber-700 transition-colors">
                        {article.title}
                      </h3>
                      {article.excerpt && (
                        <p className="text-sm text-gray-600 line-clamp-2">{article.excerpt}</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
          </div>
        </section>
      )}

      {/* Quick links */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Newspaper,
                title: "Naujienos",
                desc: "Pranešimai apie susirinkimus, renginius ir svarbius sprendimus",
                href: "/naujienos",
              },
              {
                icon: FileText,
                title: "Dokumentai",
                desc: "Įstatai, protokolai, ataskaitos ir kiti svarbūs dokumentai",
                href: "/dokumentai",
              },
              {
                icon: Users,
                title: "Apie mus",
                desc: "Vizija, misija ir socialinio verslo modelis",
                href: "/kontaktai",
              },
              {
                icon: Phone,
                title: "Kontaktai",
                desc: "Susisiekite su bendruomenės valdyba",
                href: "/kontaktai",
              },
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
                  <p className="text-sm text-gray-500 line-clamp-3">{article.excerpt || ""}</p>
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
              Telkiame bendruomenės narius bendriems projektams ir iniciatyvoms, kurios pagerina
              gyvenimo kokybę Krūminiuose. Skatinama kaimynystė, savanoriškumas ir tarpusavio
              pagarba. Aktyviai bendradarbiaujame su vietiniais verslais, savivaldybe ir kitomis
              organizacijomis.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                icon: Handshake,
                title: "Bendruomeniškumas",
                desc: "Telkiame Krūminių ir aplinkinių kaimų gyventojus bendriems projektams ir iniciatyvoms",
              },
              {
                icon: Eye,
                title: "Skaidrumas",
                desc: "Visi finansiniai srautai yra skaidrūs ir prieinami bendruomenės nariams",
              },
              {
                icon: TrendingUp,
                title: "Socialinis verslas",
                desc: "Visos pajamos reinvestuojamos į bendruomenės gerovę – nuo SPA centro iki pavežimo paslaugų",
              },
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
              Bendruomenės nariais gali būti 18 metų sulaukę veiksnūs fiziniai asmenys, gyvenantys,
              dirbantys ar turintys nuosavybės Krūminių kaime ir pritariantys bendruomenės tikslams.
            </p>
            <div className="flex flex-wrap justify-center gap-6 mb-8">
              <div className="bg-white rounded-xl border border-gray-200 px-6 py-4 text-center">
                <p className="text-2xl font-bold text-green-700">20 &euro;</p>
                <p className="text-sm text-gray-500">Stojamasis mokestis</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 px-6 py-4 text-center">
                <p className="text-2xl font-bold text-green-700">12 &euro;</p>
                <p className="text-sm text-gray-500">Metinis nario mokestis</p>
              </div>
            </div>
            <Link
              href="/registracija"
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-700 text-white rounded-lg font-medium hover:bg-green-600 transition-colors shadow-sm"
            >
              Pateikti prašymą
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
