import { createServerSupabaseClient } from "@/lib/supabase-server";
import { generateSepaQrSvg } from "@/lib/sepa-qr";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { formatDate } from "@/lib/utils";
import { Heart, Phone, Mail, AlertCircle } from "lucide-react";
import { CopyIbanButton } from "./CopyIbanButton";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 60; // atnaujinama kas minutę – progresas matomas beveik gyvai

export const metadata: Metadata = {
  title: "Padėk man atsinaujinti – Krūminių paplūdimio lieptas",
  description:
    "Sovietmečio betoninis Krūminių paplūdimio lieptas vietomis suiręs ir nesaugus. Renkame lėšas jį apkalti terasinėmis lentomis ir įrengti nerūdijančio plieno kopėtėles bei turėklus.",
  alternates: { canonical: "/lieptas" },
  openGraph: {
    type: "website",
    locale: "lt_LT",
    title: "Padėk man atsinaujinti – Krūminių paplūdimio lieptas",
    description:
      "Krūminių kaimo bendruomenė renka lėšas paplūdimio liepto atnaujinimui – apkalimas terasinėmis lentomis, nerūdijančio plieno kopėtėlės ir turėklai.",
    siteName: "Krūminių kaimo bendruomenė",
    images: [{ url: "/images/logo-md.png", width: 512, height: 512 }],
  },
};

export default async function LieptasPage() {
  const supabase = createServerSupabaseClient();

  const { data: project } = await supabase
    .from("fundraising_projects")
    .select("*")
    .eq("slug", "lieptas")
    .eq("is_public", true)
    .single();

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col">
        <PublicHeader />
        <main className="flex-1 flex items-center justify-center p-8">
          <p className="text-gray-500">Projektas nerastas.</p>
        </main>
        <PublicFooter />
      </div>
    );
  }

  const { data: donations } = await supabase
    .from("donations")
    .select("id, donor_name, amount_cents, donated_at, is_anonymous, donor_message")
    .eq("project_id", project.id)
    .order("donated_at", { ascending: false });

  const totalCents = (donations || []).reduce((s, d) => s + (d.amount_cents as number), 0);
  const goalCents = project.goal_cents as number;
  const percent = goalCents > 0 ? Math.min(100, Math.round((totalCents / goalCents) * 100)) : 0;
  const donorCount = (donations || []).length;

  // SEPA QR kodas. BIC pridedamas (nors v002 leidžia tuščią), kad senesni
  // bankų aplikacijų variantai apdorotų korektiškai.
  const qrSvg = await generateSepaQrSvg({
    bic: project.bic || undefined,
    recipient: project.recipient,
    iban: project.iban,
    remittance: project.purpose_text,
  });

  const totalEur = (totalCents / 100).toFixed(0);
  const goalEur = (goalCents / 100).toFixed(0);
  const remainingEur = ((goalCents - totalCents) / 100).toFixed(0);

  // Pasiūlytos sumos
  const suggestedAmounts = [5, 10, 20, 50];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-br from-green-800 via-green-700 to-green-900 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-16">
            <p className="text-sm uppercase tracking-widest text-green-200 mb-2 font-medium">
              Pilotinis projektas · {new Date().getFullYear()} m.
            </p>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-4">
              {project.title}
            </h1>
            <p className="text-lg md:text-xl text-green-100 leading-relaxed max-w-2xl">
              {project.short_desc}
            </p>
          </div>
        </section>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-10">
          {/* Progresas */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
            <div className="flex items-end justify-between flex-wrap gap-3 mb-3">
              <div>
                <div className="text-4xl sm:text-5xl font-bold text-green-700">
                  {totalEur} €
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  surinkta iš <span className="font-semibold">{goalEur} €</span> tikslo
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{percent}%</div>
                <p className="text-xs text-gray-500">{donorCount} aukotojai (-os)</p>
              </div>
            </div>

            <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-green-500 to-green-700 h-full rounded-full transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>

            <p className="text-sm text-gray-600 mt-4">
              Liko surinkti: <strong className="text-gray-900">{remainingEur} €</strong>.
              Kiekviena auka svarbi – net 5 € yra svari pagalba!
            </p>
          </section>

          {/* Aukojimas */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
              <Heart className="h-6 w-6 text-red-500" />
              Kaip paaukoti?
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Greičiausias būdas – nuskenuokite QR kodą savo banko aplikacija. Forma
              atsidarys su jau užpildytais duomenimis. Jums tereikia įvesti sumą ir
              patvirtinti pavedimą.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* QR */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 text-center border border-green-100">
                <div
                  className="bg-white rounded-lg p-4 shadow-sm mx-auto max-w-[320px] [&_svg]:w-full [&_svg]:h-auto [&_svg]:block"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
                <p className="text-sm text-gray-700 mt-3 font-semibold">
                  📱 Atidarykite banko aplikaciją → „Naujas pavedimas" → „Skenuoti QR"
                </p>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  Geriausiai veikia Swedbank, SEB, Luminor, Šiaulių/Artea aplikacijose.
                  Jei jūsų app'as nepalaiko – pavedimą įveskite rankomis (rekvizitai dešinėje).
                </p>
              </div>

              {/* Banko rekvizitai */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm uppercase tracking-wide">
                    Pavedimas rankomis
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500">Gavėjas:</span>
                      <span className="font-medium text-gray-900 text-right">{project.recipient}</span>
                    </div>
                    <div className="flex justify-between gap-2 items-center">
                      <span className="text-gray-500">IBAN:</span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono font-medium text-gray-900 text-right text-xs sm:text-sm">{project.iban}</span>
                        <CopyIbanButton iban={project.iban} />
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500">Bankas:</span>
                      <span className="text-gray-900 text-right">AB Artea bankas</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500">Paskirtis:</span>
                      <span className="font-medium text-gray-900 text-right">{project.purpose_text}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm uppercase tracking-wide">
                    Pasiūlytos sumos
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {suggestedAmounts.map((amt) => (
                      <span
                        key={amt}
                        className="px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm font-semibold border border-green-200"
                      >
                        {amt} €
                      </span>
                    ))}
                    <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm border border-gray-200">
                      arba kita suma
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    💡 <strong>Vienos terasinės lentos kaina ~12 €</strong> – jūsų indėlis tampa konkrečia statybinė medžiaga.
                  </p>
                </div>
              </div>
            </div>

            {/* Grynais */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm uppercase tracking-wide">
                Norite paaukoti grynais?
              </h3>
              <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                {project.contact_phone && (
                  <a href={`tel:${project.contact_phone}`} className="inline-flex items-center gap-1.5 hover:text-green-700">
                    <Phone className="h-4 w-4" /> {project.contact_phone}
                  </a>
                )}
                {project.contact_email && (
                  <a href={`mailto:${project.contact_email}`} className="inline-flex items-center gap-1.5 hover:text-green-700">
                    <Mail className="h-4 w-4" /> {project.contact_email}
                  </a>
                )}
                <span className="text-gray-500">Beržų g. 8, Krūminių k., Varėnos r.</span>
              </div>
            </div>
          </section>

          {/* Istorija */}
          {project.story_md && (
            <section className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm prose prose-sm max-w-none">
              <StoryMarkdown md={project.story_md as string} />
            </section>
          )}

          {/* Aukotojų sąrašas */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              Mūsų rėmėjai ({donorCount})
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              Skaidrumas – kiekviena auka užregistruota viešai. Anoniminiai aukotojai parodyti kaip &bdquo;Anonimas&ldquo;.
            </p>

            {donorCount === 0 ? (
              <div className="text-center py-10">
                <p className="text-gray-400 mb-2">Aukotojų dar nėra – būkite pirmas! 💚</p>
                <p className="text-sm text-gray-500">
                  Jūsų auka padarys liepto atnaujinimą realybe.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(donations || []).map((d) => (
                  <div key={d.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">
                        {d.is_anonymous || !d.donor_name ? "Anonimas" : (d.donor_name as string)}
                      </p>
                      {d.donor_message && (
                        <p className="text-sm text-gray-600 italic mt-0.5">
                          &bdquo;{d.donor_message as string}&ldquo;
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(d.donated_at as string)}
                      </p>
                    </div>
                    <span className="font-bold text-green-700 whitespace-nowrap">
                      {((d.amount_cents as number) / 100).toFixed(0)} €
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Pasidalink */}
          <section className="bg-amber-50 border border-amber-200 rounded-2xl p-6 sm:p-8 text-center">
            <h2 className="text-lg font-bold text-amber-900 mb-2">Pasidalinkit su draugais!</h2>
            <p className="text-sm text-amber-800 mb-4">
              Kuo daugiau žmonių sužinos, tuo greičiau atnaujinsim lieptą. Nukopijuokit nuorodą ir pasidalinkit:
            </p>
            <div className="inline-flex items-center gap-2 bg-white border border-amber-300 rounded-full px-4 py-2 text-sm">
              <span className="font-mono text-gray-900">kruminiai.lt/lieptas</span>
              <Copy className="h-4 w-4 text-gray-400" />
            </div>
          </section>

          <p className="text-xs text-center text-gray-400">
            Spausdintinę versiją (A4 su QR kodu) galite atsisiųsti{" "}
            <Link href="/lieptas/spausdinti" className="text-green-700 hover:underline">
              čia
            </Link>
            .
          </p>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

// Paprastas markdown rendereris – tinka pradiniam pasakojimui
function StoryMarkdown({ md }: { md: string }) {
  const lines = md.split("\n");
  const html: string[] = [];
  for (const line of lines) {
    if (line.startsWith("## ")) {
      html.push(`<h3>${line.slice(3)}</h3>`);
    } else if (line.startsWith("- ")) {
      html.push(`<li>${line.slice(2)}</li>`);
    } else if (line.trim() === "") {
      html.push("");
    } else {
      // bold **text**
      const formatted = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      html.push(`<p>${formatted}</p>`);
    }
  }
  return <div dangerouslySetInnerHTML={{ __html: html.join("\n") }} />;
}
