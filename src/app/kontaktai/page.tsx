import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { SITE_NAME } from "@/lib/constants";
import { MapPin, Mail, Phone, Building2, Target, Heart, Lightbulb } from "lucide-react";

export const metadata = {
  title: "Kontaktai | Krūminių kaimo bendruomenė",
};

export default function ContactsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex-1 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Apie mus ir kontaktai</h1>
          <p className="text-gray-500 mb-8">
            Sužinokite apie Krūminių bendruomenės viziją, misiją ir socialinio verslo modelį
          </p>

          {/* Mission */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Mūsų vizija ir misija</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Krūminių kaimo bendruomenė yra ribotos civilinės atsakomybės viešasis juridinis
              asmuo, kurio teisinė forma — asociacija. Bendruomenė veikia Krūminių kaimo ir
              aplinkinių teritorijų ribose.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <Target className="h-5 w-5 text-green-700 mb-2" />
                <p className="font-medium text-gray-900 text-sm mb-1">Tikslas</p>
                <p className="text-xs text-gray-600">
                  Atstovauti ir ginti bendruomenės narių interesus, skatinti pilietinį aktyvumą,
                  puoselėti kaimo tradicijas ir gerinti gyvenimo kokybę.
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <Heart className="h-5 w-5 text-green-700 mb-2" />
                <p className="font-medium text-gray-900 text-sm mb-1">Vertybės</p>
                <p className="text-xs text-gray-600">
                  Bendruomeniškumas, solidarumas, kaimynystė, savanoriškumas ir tarpusavio pagarba.
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <Lightbulb className="h-5 w-5 text-green-700 mb-2" />
                <p className="font-medium text-gray-900 text-sm mb-1">Socialinis verslas</p>
                <p className="text-xs text-gray-600">
                  Veikiame pagal socialinio verslo principus, kurie leidžia būti finansiškai
                  nepriklausomiems ir tvariai augti.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">{SITE_NAME}</h2>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-green-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Rekvizitai</p>
                    <p className="text-sm text-gray-600">
                      Asociacija<br />
                      Įmonės kodas: 302795244<br />
                      Įkurta: 2012-06-04
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-green-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Adresas</p>
                    <p className="text-sm text-gray-600">
                      Beržų g. 8, Krūminių k.<br />
                      LT-65474 Varėnos r.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-green-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Telefonas</p>
                    <p className="text-sm text-gray-600">+370 658 49514</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-green-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">El. paštas</p>
                    <p className="text-sm text-gray-600">info@kruminiai.lt</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Valdyba</h2>
              <p className="text-sm text-gray-500 mb-4">
                Valdyba yra kolegialus valdymo organas, kurį sudaro 5 nariai,
                renkami 3 metų kadencijai.
              </p>
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-900">Pirmininkas</p>
                  <p className="text-xs text-gray-400">Vienasmenis valdymo organas, renkamas 3 metų kadencijai</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-900">Valdybos nariai</p>
                  <p className="text-xs text-gray-400">4 nariai, renkami visuotiniame susirinkime</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-900">Revizijos komisija</p>
                  <p className="text-xs text-gray-400">Finansinės veiklos kontrolė, renkama 3 metams</p>
                </div>
              </div>
            </div>
          </div>

          {/* Membership */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Narystė</h2>
            <p className="text-sm text-gray-600 mb-4">
              Bendruomenės nariais gali būti 18 metų sulaukę veiksnūs fiziniai asmenys,
              gyvenantys, dirbantys ar turintys nuosavybės Krūminių kaime ir pritariantys
              bendruomenės tikslams. Norintis tapti nariu pateikia raštišką prašymą pirmininkui.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-900 mb-1">Nario teisės:</p>
                <ul className="text-gray-600 space-y-1 list-disc list-inside">
                  <li>Dalyvauti ir balsuoti visuotiniame susirinkime</li>
                  <li>Naudotis bendruomenės paslaugomis</li>
                  <li>Susipažinti su dokumentais</li>
                  <li>Rinkti ir būti renkamam į valdymo organus</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-1">Nario mokesčiai:</p>
                <ul className="text-gray-600 space-y-1 list-disc list-inside">
                  <li>Stojamasis mokestis — 20 &euro;</li>
                  <li>Metinis nario mokestis — 12 &euro;</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
