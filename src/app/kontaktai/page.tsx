import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getDict } from "@/lib/i18n-server";
import { Eye, MapPin, Briefcase, Heart, Sparkles, Home, Users } from "lucide-react";

export const metadata = {
  title: "Apie mus",
  description:
    "Krūminių kaimo bendruomenės vizija, misija, vertybės ir veikla. Telkiame Krūminių, Valkininkų, Užuperkasio, Bucivonių, Urkionių, Jakėnų ir Paversekio gyventojus.",
  alternates: { canonical: "/kontaktai" },
  openGraph: {
    title: "Apie mus",
    description:
      "Krūminių kaimo bendruomenės vizija, misija ir socialinio verslo modelis.",
    url: "/kontaktai",
  },
};

export default function AboutPage() {
  const t = getDict().about;
  return (
    <div className="min-h-screen flex flex-col bg-amber-50/50">
      <PublicHeader />

      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="text-3xl font-bold text-gray-900 text-center mb-8">{t.pageTitle}</h1>

          {/* Mūsų vizija */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
                <Eye className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">{t.visionTitle}</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{t.visionBody}</p>
          </div>

          {/* Mūsų misija */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">{t.missionTitle}</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-3">{t.missionBody1}</p>
            <p className="text-sm text-gray-600 leading-relaxed">{t.missionBody2}</p>
          </div>

          {/* Socialinio verslo modelis */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-800 flex items-center justify-center flex-shrink-0">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">{t.fundingTitle}</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-5">{t.fundingIntro}</p>

            <div className="space-y-4 ml-1">
              <div className="border-l-2 border-green-700 pl-4">
                <p className="font-semibold text-gray-900 text-sm mb-1">{t.fundingMembersTitle}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{t.fundingMembersDesc}</p>
              </div>
              <div className="border-l-2 border-green-700 pl-4">
                <p className="font-semibold text-gray-900 text-sm mb-1">{t.fundingGroundsTitle}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{t.fundingGroundsDesc}</p>
              </div>
              <div className="border-l-2 border-green-700 pl-4">
                <p className="font-semibold text-gray-900 text-sm mb-1">{t.fundingBridgeTitle}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{t.fundingBridgeDesc}</p>
              </div>
              <div className="border-l-2 border-green-700 pl-4">
                <p className="font-semibold text-gray-900 text-sm mb-1">{t.fundingEventsTitle}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{t.fundingEventsDesc}</p>
              </div>
              <div className="border-l-2 border-green-700 pl-4">
                <p className="font-semibold text-gray-900 text-sm mb-1">{t.fundingTransparencyTitle}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{t.fundingTransparencyDesc}</p>
              </div>
            </div>
          </div>

          {/* Socialinis poveikis */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-800 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">{t.impactTitle}</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-green-50 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mb-2">
                  <Users className="h-4 w-4 text-green-700" />
                </div>
                <p className="font-semibold text-gray-900 text-sm mb-1">{t.impactCommunityTitle}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{t.impactCommunityDesc}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mb-2">
                  <Home className="h-4 w-4 text-green-700" />
                </div>
                <p className="font-semibold text-gray-900 text-sm mb-1">{t.impactLivingTitle}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{t.impactLivingDesc}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mb-2">
                  <Sparkles className="h-4 w-4 text-green-700" />
                </div>
                <p className="font-semibold text-gray-900 text-sm mb-1">{t.impactTraditionsTitle}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{t.impactTraditionsDesc}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mb-2">
                  <Eye className="h-4 w-4 text-green-700" />
                </div>
                <p className="font-semibold text-gray-900 text-sm mb-1">{t.impactTransparencyTitle}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{t.impactTransparencyDesc}</p>
              </div>
            </div>
          </div>

          {/* Mūsų vertybės */}
          <div className="bg-green-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
                <Heart className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-white">{t.valuesTitle}</h2>
            </div>
            <ul className="space-y-2">
              {[t.value1, t.value2, t.value3, t.value4, t.value5].map((value) => (
                <li key={value} className="flex items-center gap-2 text-sm text-green-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  {value}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
