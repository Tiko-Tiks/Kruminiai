import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { SITE_NAME } from "@/lib/constants";
import { MapPin, Phone, Mail, Clock } from "lucide-react";

export const metadata = {
  title: "Kontaktai | Krūminių kaimo bendruomenė",
};

export default function ContactsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex-1 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Kontaktai</h1>
          <p className="text-gray-500 mb-8">Susisiekite su bendruomene</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">{SITE_NAME}</h2>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-green-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Adresas</p>
                    <p className="text-sm text-gray-600">
                      Krūminių k., LT-00000<br />
                      Lietuvos Respublika
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-green-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Telefonas</p>
                    <p className="text-sm text-gray-600">+370 600 00000</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-green-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">El. paštas</p>
                    <p className="text-sm text-gray-600">info@kruminiai.lt</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-green-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Darbo laikas</p>
                    <p className="text-sm text-gray-600">
                      Pagal susitarimą
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Valdyba</h2>
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-900">Pirmininkas</p>
                  <p className="text-sm text-gray-600">Vardas Pavardė</p>
                  <p className="text-xs text-gray-400">+370 600 00000</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-900">Pirmininko pavaduotojas</p>
                  <p className="text-sm text-gray-600">Vardas Pavardė</p>
                  <p className="text-xs text-gray-400">+370 600 00000</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-900">Sekretorius</p>
                  <p className="text-sm text-gray-600">Vardas Pavardė</p>
                  <p className="text-xs text-gray-400">+370 600 00000</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
