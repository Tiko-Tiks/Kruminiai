import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Eye, MapPin, Briefcase, Heart } from "lucide-react";

export const metadata = {
  title: "Apie mus | Krūminių kaimo bendruomenė",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-amber-50/50">
      <PublicHeader />

      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="text-3xl font-bold text-gray-900 text-center mb-8">Apie mus</h1>

          {/* Mūsų vizija */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
                <Eye className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Mūsų vizija</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Krūminių bendruomenė siekia tapti pavyzdžiu kaimo bendruomenės modeliui
              Lietuvoje – aktyvi, moderni ir socialiai atsakinga bendruomenė, kurioje
              kiekvienas narys jaučiasi vertinamas ir turi galimybę prisidėti prie bendro
              gėrio kūrimo. Mes tikime, kad kaimų gyvensena gali būti patraukli ir moderni,
              derinant tradicinės kaimo kultūros privalumus su šiuolaikinėmis galimybėmis.
            </p>
          </div>

          {/* Mūsų misija */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Mūsų misija</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-3">
              Telkiame bendruomenės narius bendriems projektams ir iniciatyvoms, kurios
              pagerina gyvenimo kokybę Krūminiuose. Skatiname kaimynystę, savanoriškumą
              ir tarpusavio pagarbą. Aktyviai bendradarbiaujame su vietiniais verslais,
              savivaldybe ir kitomis organizacijomis.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              Kuriame darnią aplinką, kurioje visi – nuo jauniausiųjų iki vyriausiųjų –
              gali rasti veiklų ir prisidėti prie bendruomenės gyvenimo.
            </p>
          </div>

          {/* Socialinio verslo modelis */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-800 flex items-center justify-center flex-shrink-0">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Socialinio verslo modelis</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-5">
              Krūminių bendruomenė veikia pagal socialinio verslo principus, kurie leidžia
              mums būti finansiškai nepriklausomiems. Tai reiškia, kad:
            </p>

            <div className="space-y-4 ml-1">
              <div className="border-l-2 border-green-700 pl-4">
                <p className="font-semibold text-gray-900 text-sm mb-1">Narių įnašai</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Stojamasis mokestis (20&euro;) ir metinis nario mokestis (12&euro;) sudaro
                  bazinį finansavimą bendruomenės administraciniam ir renginių organizavimui.
                </p>
              </div>
              <div className="border-l-2 border-green-700 pl-4">
                <p className="font-semibold text-gray-900 text-sm mb-1">Pajamos iš paslaugų</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Miško ruošos paslaugos, smulkių nuomoti ūkio paslaugų generuoja pajamas,
                  kurios reinvestuojamos į bendruomenės projektus ir infrastruktūros tobulinimą.
                </p>
              </div>
              <div className="border-l-2 border-green-700 pl-4">
                <p className="font-semibold text-gray-900 text-sm mb-1">Partnerystė ir projektai</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Bendradarbiaujame su vietiniais verslais, savivaldybe ir ES projektų
                  dalyvavimas leidžia pritraukti papildomų lėšų didesnių iniciatyvų finansavimui.
                </p>
              </div>
              <div className="border-l-2 border-green-700 pl-4">
                <p className="font-semibold text-gray-900 text-sm mb-1">Skaidrumas</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Visi finansiniai srautai yra skaidrūs ir prieinami bendruomenės nariams.
                  Reguliariai teikiame finansines ataskaitas ir metines ataskaitas.
                </p>
              </div>
            </div>
          </div>

          {/* Mūsų vertybės */}
          <div className="bg-green-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
                <Heart className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-white">Mūsų vertybės</h2>
            </div>
            <ul className="space-y-2">
              {[
                "Bendruomeniškumas ir solidarumas",
                "Atsakingumas ir skaidrumas",
                "Inovatyvus ir tvarus tobulėjimas",
                "Pagarba aplinkai ir tradicijoms",
                "Įtraukimas ir lygios galimybės visiems",
              ].map((value) => (
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
