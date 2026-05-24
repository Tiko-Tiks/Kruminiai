import { createServerSupabaseClient } from "@/lib/supabase-server";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { ContactUpdateForm } from "./ContactUpdateForm";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Atnaujinkite savo kontaktus",
  // robots: nuoroda token-based, privatūs duomenys – jokio indeksavimo
  robots: { index: false, follow: false, nocache: true },
  // Išjungiam OG ir Twitter image preview – kitaip iMessage/Android Messages
  // sukuria didelę logotipo „kortelę" SMS preview'e (512x512 logo-md.png
  // iš root layout'o). Šiam srautui preview nereikalingas.
  openGraph: { images: [] },
  twitter: { card: "summary" as const, images: [] },
};

interface TokenData {
  error?: string;
  member?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
}

export default async function ContactUpdatePage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_contact_update_token_data", {
    p_token: params.token,
  });

  const result = (data || {}) as TokenData;

  return (
    <div className="min-h-screen flex flex-col bg-amber-50/40">
      <PublicHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {error || result.error || !result.member ? (
            <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">
                {result.error === "already_completed"
                  ? "Nuoroda jau panaudota"
                  : "Nuoroda negalioja"}
              </h1>
              <p className="text-sm text-gray-600 leading-relaxed">
                {result.error === "already_completed"
                  ? "Šia nuoroda jau pasinaudojote ir savo kontaktus atnaujinote. Ačiū!"
                  : "Ši nuoroda negalioja arba pasibaigė. Susisiekite su bendruomenės administratoriumi info@kruminiai.lt"}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              {/* Sveikinimo blokas – slepiamas per CSS po sėkmingo
                  išsaugojimo (žr. ContactUpdateForm success state). */}
              <div className="text-center mb-6" data-greeting>
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="h-7 w-7 text-green-700" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Sveiki, {result.member.first_name}!
                </h1>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                  Mūsų sistemoje trūksta Jūsų el. pašto. Užpildykite formą ir
                  galėsite gauti svarbius pranešimus, balsavimo nuorodas ir
                  prisijungti prie nario portalo.
                </p>
              </div>
              <ContactUpdateForm
                token={params.token}
                member={result.member}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
