import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
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
              gėrio kūrimo. Mes tikime, kad kaimo gyvensena gali būti patraukli ir moderni,
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
              Telkiame Krūminių ir aplinkinių kaimų – Valkininkų, Užuperkasio, Bucivonių,
              Urkionių, Jakėnų, Paversekio – gyventojus bendriems projektams ir iniciatyvoms,
              kurios pagerina gyvenimo kokybę regione. Skatiname kaimynystę, savanoriškumą
              ir tarpusavio pagarbą.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              Aktyviai bendradarbiaujame su vietos verslais, savivaldybe ir kitomis
              organizacijomis kuriant darnią aplinką, kurioje visi – nuo jauniausiųjų
              iki vyriausiųjų – gali rasti veiklų ir prisidėti prie bendruomenės gyvenimo.
            </p>
          </div>

          {/* Socialinio verslo modelis */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-800 flex items-center justify-center flex-shrink-0">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Veiklos finansavimas</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-5">
              Krūminių bendruomenė veikia ne pelno principu – visos gautos
              pajamos reinvestuojamos į bendruomenės gerovę: teritorijos priežiūrą,
              renginius ir bendros infrastruktūros gerinimą.
            </p>

            <div className="space-y-4 ml-1">
              <div className="border-l-2 border-green-700 pl-4">
                <p className="font-semibold text-gray-900 text-sm mb-1">Narių įnašai</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Stojamasis mokestis (20&euro;) ir metinis nario mokestis (12&euro;) sudaro
                  bazinį finansavimą bendruomenės administraciniam darbui ir renginių organizavimui.
                </p>
              </div>
              <div className="border-l-2 border-green-700 pl-4">
                <p className="font-semibold text-gray-900 text-sm mb-1">Teritorijos priežiūra</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Lėšos skiriamos paplūdimio (smėlio užvežimas), žaidimų aikštelės remontui
                  ir bendrosios teritorijos priežiūrai (žolės pjovimas, kuras, elektra).
                </p>
              </div>
              <div className="border-l-2 border-green-700 pl-4">
                <p className="font-semibold text-gray-900 text-sm mb-1">Paplūdimio liepto atnaujinimas</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Liepto laikas atsinaujinti. Tikslas 4 000 EUR – renkamos iš bendruomenės narių
                  ir kaimo svečių aukų atskirai nuo nario mokesčio biudžeto.
                </p>
              </div>
              <div className="border-l-2 border-green-700 pl-4">
                <p className="font-semibold text-gray-900 text-sm mb-1">Renginiai</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Mindauginės (liepos 6 d.) ir Eglutės puošimas (gruodis) – tradicinės
                  kasmetinės bendruomenės šventės. Papildomi renginiai pagal narių iniciatyvą.
                </p>
              </div>
              <div className="border-l-2 border-green-700 pl-4">
                <p className="font-semibold text-gray-900 text-sm mb-1">Skaidrumas</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Visi finansiniai srautai yra skaidrūs ir prieinami bendruomenės nariams.
                  Reguliariai teikiame finansines ir metines ataskaitas.
                </p>
              </div>
            </div>
          </div>

          {/* Socialinis poveikis */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-800 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Socialinis poveikis</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-green-50 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mb-2">
                  <Users className="h-4 w-4 text-green-700" />
                </div>
                <p className="font-semibold text-gray-900 text-sm mb-1">Bendruomeniškumas</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Telkiame kaimo gyventojus bendriems projektams ir renginiams,
                  stipriname kaimyniškus ryšius.
                </p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mb-2">
                  <Home className="h-4 w-4 text-green-700" />
                </div>
                <p className="font-semibold text-gray-900 text-sm mb-1">Gyvenamoji aplinka</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Prižiūrime paplūdimį, žaidimų aikštelę ir bendrąją teritoriją –
                  gerinama gyvenimo kokybė kaime.
                </p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mb-2">
                  <Sparkles className="h-4 w-4 text-green-700" />
                </div>
                <p className="font-semibold text-gray-900 text-sm mb-1">Tradicijos</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Mindauginės, Eglutės puošimas ir kiti bendruomenės renginiai
                  puoselėja kaimo tradicijas.
                </p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mb-2">
                  <Eye className="h-4 w-4 text-green-700" />
                </div>
                <p className="font-semibold text-gray-900 text-sm mb-1">Skaidrumas</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Visi finansiniai srautai ir veiklos sprendimai yra atviri –
                  pasitikėjimas ir atskaitomybė nariams.
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
                "Socialinė atsakomybė ir įtraukimas",
                "Pagarba aplinkai ir tradicijoms",
                "Lygios galimybės visiems",
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
