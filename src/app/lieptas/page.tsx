import { createServerSupabaseClient } from "@/lib/supabase-server";
import { generateSepaQrSvg } from "@/lib/sepa-qr";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { formatDate, getImagePublicUrl } from "@/lib/utils";
import { getDict } from "@/lib/i18n-server";
import { Heart, Phone, Mail, Copy, Hammer, Wallet } from "lucide-react";
import { CopyIbanButton } from "./CopyIbanButton";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 60; // atnaujinama kas minutę – progresas matomas beveik gyvai

export const metadata: Metadata = {
  title: "Padėk man atsinaujinti – Krūminių paplūdimio lieptas",
  description:
    "Krūminių paplūdimio lieptas vertas antro gyvenimo. Renkame lėšas jį apkalti terasinėmis lentomis, įrengti nerūdijančio plieno turėklus ir kopėtėles – gražesnė ir saugesnė erdvė visiems.",
  alternates: { canonical: "/lieptas" },
  openGraph: {
    type: "website",
    locale: "lt_LT",
    title: "Padėk man atsinaujinti – Krūminių paplūdimio lieptas",
    description:
      "Krūminių kaimo bendruomenė atnaujina paplūdimio lieptą: terasinės lentos, nerūdijančio plieno turėklai ir kopėtėlės. Prisidėk – gražesnė ir saugesnė erdvė visiems.",
    siteName: "Krūminių kaimo bendruomenė",
    images: [{ url: "/images/lieptas/liepto-vizija.jpg", width: 1445, height: 1088 }],
  },
};

export default async function LieptasPage() {
  const supabase = createServerSupabaseClient();
  const t = getDict().lieptas;

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
          <p className="text-gray-500">{t.projectNotFound}</p>
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

  // II etapas: statybų eigos įrašai + viešos išlaidos (RLS leidžia anon skaityti)
  const { data: updates } = await supabase
    .from("project_updates")
    .select("id, title, body, update_date, photos")
    .eq("project_id", project.id)
    .eq("is_published", true)
    .order("update_date", { ascending: false });

  const { data: expenses } = await supabase
    .from("project_expenses")
    .select("id, description, supplier, amount_cents, expense_date")
    .eq("project_id", project.id)
    .order("expense_date", { ascending: false });

  const totalCents = (donations || []).reduce((s, d) => s + (d.amount_cents as number), 0);
  const goalCents = project.goal_cents as number;
  const percent = goalCents > 0 ? Math.round((totalCents / goalCents) * 100) : 0;
  const barPercent = Math.min(100, percent);
  const donorCount = (donations || []).length;
  const goalReached = goalCents > 0 && totalCents >= goalCents;
  const surplusCents = Math.max(0, totalCents - goalCents);

  const spentCents = (expenses || []).reduce((s, e) => s + (e.amount_cents as number), 0);
  const fundsRemainingCents = totalCents - spentCents;

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
              {t.heroEyebrow.replace("{year}", String(new Date().getFullYear()))}
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
          {/* Prieš / Po */}
          <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <figure className="relative overflow-hidden rounded-xl">
                <img
                  src="/images/lieptas/liepto-dabar.jpg"
                  alt={t.beforePhotoAlt}
                  className="w-full aspect-[4/3] object-cover"
                  loading="lazy"
                />
                <figcaption className="absolute top-3 left-3 bg-gray-900/75 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  {t.beforeBadge}
                </figcaption>
              </figure>
              <figure className="relative overflow-hidden rounded-xl">
                <img
                  src="/images/lieptas/liepto-vizija.jpg"
                  alt={t.afterPhotoAlt}
                  className="w-full aspect-[4/3] object-cover"
                  loading="lazy"
                />
                <figcaption className="absolute top-3 left-3 bg-green-700/90 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  {t.afterBadge}
                </figcaption>
              </figure>
            </div>
          </section>

          {/* Progresas */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
            <div className="flex items-end justify-between flex-wrap gap-3 mb-3">
              <div>
                <div className="text-4xl sm:text-5xl font-bold text-green-700">
                  {totalEur} €
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {t.progressRaisedPrefix} <span className="font-semibold">{goalEur} €</span> {t.progressGoalSuffix}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{percent}%</div>
                <p className="text-xs text-gray-500">{donorCount} {t.donorsLabel}</p>
              </div>
            </div>

            <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-green-500 to-green-700 h-full rounded-full transition-all"
                style={{ width: `${barPercent}%` }}
              />
            </div>

            {goalReached ? (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-green-800">{t.goalReachedTitle}</p>
                {surplusCents > 0 && (
                  <p className="text-sm text-green-700 mt-0.5">
                    {t.goalSurplusNote.replace("{surplus}", (surplusCents / 100).toFixed(0))}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-600 mt-4">
                {t.remainingPrefix} <strong className="text-gray-900">{remainingEur} €</strong>{t.remainingSuffix}
              </p>
            )}
          </section>

          {/* Statybų eiga (II etapas) */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
              <Hammer className="h-6 w-6 text-amber-600" />
              {t.constructionHeading}
            </h2>
            <p className="text-sm text-gray-600 mb-6">{t.constructionIntro}</p>

            {(updates || []).length === 0 ? (
              <div className="text-center py-10">
                <p className="text-gray-400 mb-2">{t.noUpdatesTitle}</p>
                <p className="text-sm text-gray-500">{t.noUpdatesSubtitle}</p>
              </div>
            ) : (
              <ol className="relative border-l-2 border-green-100 ml-2 space-y-8">
                {(updates || []).map((u) => {
                  const photos = ((u.photos as string[]) || []).filter(Boolean);
                  return (
                    <li key={u.id} className="pl-6 relative">
                      <span className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full bg-green-600 border-4 border-green-100" />
                      <p className="text-xs text-gray-400 mb-0.5">
                        {formatDate(u.update_date as string)}
                      </p>
                      <h3 className="font-semibold text-gray-900">{u.title as string}</h3>
                      {u.body && (
                        <p className="text-sm text-gray-600 mt-1 leading-relaxed whitespace-pre-line">
                          {u.body as string}
                        </p>
                      )}
                      {photos.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                          {photos.map((p) => {
                            const url = getImagePublicUrl(p);
                            return (
                              <a
                                key={p}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block overflow-hidden rounded-lg group"
                              >
                                <img
                                  src={url}
                                  alt={t.updatePhotoAlt}
                                  loading="lazy"
                                  className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition-transform"
                                />
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* Lėšų panaudojimas (išlaidos viešai) */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
              <Wallet className="h-6 w-6 text-green-700" />
              {t.spendingHeading}
            </h2>
            <p className="text-sm text-gray-600 mb-6">{t.spendingIntro}</p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 sm:p-4 text-center">
                <div className="text-lg sm:text-2xl font-bold text-green-700">
                  {(totalCents / 100).toFixed(0)} €
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{t.statCollected}</p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 sm:p-4 text-center">
                <div className="text-lg sm:text-2xl font-bold text-amber-700">
                  {(spentCents / 100).toFixed(2).replace(/\.00$/, "")} €
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{t.statSpent}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4 text-center">
                <div className="text-lg sm:text-2xl font-bold text-gray-900">
                  {(fundsRemainingCents / 100).toFixed(2).replace(/\.00$/, "")} €
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{t.statRemaining}</p>
              </div>
            </div>

            {(expenses || []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">{t.expensesEmpty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                      <th className="py-2 pr-3 font-medium">{t.expColDate}</th>
                      <th className="py-2 pr-3 font-medium">{t.expColPurpose}</th>
                      <th className="py-2 text-right font-medium">{t.expColAmount}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(expenses || []).map((e) => (
                      <tr key={e.id}>
                        <td className="py-2.5 pr-3 text-gray-500 whitespace-nowrap align-top">
                          {formatDate(e.expense_date as string)}
                        </td>
                        <td className="py-2.5 pr-3 text-gray-900 align-top">
                          {e.description as string}
                          {e.supplier && (
                            <span className="text-gray-500"> · {e.supplier as string}</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap align-top">
                          {((e.amount_cents as number) / 100).toFixed(2)} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200">
                      <td colSpan={2} className="py-2.5 pr-3 text-sm font-semibold text-gray-700">
                        {t.expensesTotalLabel}
                      </td>
                      <td className="py-2.5 text-right font-bold text-amber-700 whitespace-nowrap">
                        {(spentCents / 100).toFixed(2)} €
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* Aukojimas */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
              <Heart className="h-6 w-6 text-red-500" />
              {t.howToDonateHeading}
            </h2>
            <p className="text-sm text-gray-600 mb-6">{t.howToDonateIntro}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* QR */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 text-center border border-green-100">
                <div
                  className="bg-white rounded-lg p-4 shadow-sm mx-auto max-w-[320px] [&_svg]:w-full [&_svg]:h-auto [&_svg]:block"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
                <p className="text-sm text-gray-700 mt-3 font-semibold">
                  {t.qrInstruction}
                </p>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  {t.qrSupportedApps}
                </p>
              </div>

              {/* Banko rekvizitai */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm uppercase tracking-wide">
                    {t.manualTransferHeading}
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500">{t.fieldRecipient}</span>
                      <span className="font-medium text-gray-900 text-right">{project.recipient}</span>
                    </div>
                    <div className="flex justify-between gap-2 items-center">
                      <span className="text-gray-500">{t.fieldIban}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono font-medium text-gray-900 text-right text-xs sm:text-sm">{project.iban}</span>
                        <CopyIbanButton iban={project.iban} />
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500">{t.fieldBank}</span>
                      <span className="text-gray-900 text-right">{t.bankName}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500">{t.fieldPurpose}</span>
                      <span className="font-medium text-gray-900 text-right">{project.purpose_text}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm uppercase tracking-wide">
                    {t.suggestedAmountsHeading}
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
                      {t.otherAmount}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{t.boardCostHint}</p>
                </div>
              </div>
            </div>

            {/* Grynais */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm uppercase tracking-wide">
                {t.cashDonationHeading}
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
                <span className="text-gray-500">{t.communityAddress}</span>
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
              {t.supportersHeading} ({donorCount})
            </h2>
            <p className="text-sm text-gray-500 mb-5">{t.supportersTransparency}</p>

            {donorCount === 0 ? (
              <div className="text-center py-10">
                <p className="text-gray-400 mb-2">{t.noDonorsTitle}</p>
                <p className="text-sm text-gray-500">{t.noDonorsSubtitle}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(donations || []).map((d) => (
                  <div key={d.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">
                        {d.is_anonymous || !d.donor_name ? t.anonymousDonor : (d.donor_name as string)}
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
            <h2 className="text-lg font-bold text-amber-900 mb-2">{t.shareHeading}</h2>
            <p className="text-sm text-amber-800 mb-4">{t.shareIntro}</p>
            <div className="inline-flex items-center gap-2 bg-white border border-amber-300 rounded-full px-4 py-2 text-sm">
              <span className="font-mono text-gray-900">kruminiai.lt/lieptas</span>
              <Copy className="h-4 w-4 text-gray-400" />
            </div>
          </section>

          <p className="text-xs text-center text-gray-400">
            {t.printableNotice}{" "}
            <Link href="/lieptas/spausdinti" className="text-green-700 hover:underline">
              {t.printableLinkWord}
            </Link>
            .
          </p>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

// Paprastas markdown rendereris – tinka pradiniam pasakojimui.
// HTML escape'inamas, kad DB turinyje atsiradę <script>/<img> netaptų XSS.
function StoryMarkdown({ md }: { md: string }) {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.split("\n");
  const html: string[] = [];
  for (const line of lines) {
    if (line.startsWith("## ")) {
      html.push(
        `<h3 class="text-lg font-bold text-gray-900 mt-6 mb-2 first:mt-0">${esc(line.slice(3))}</h3>`
      );
    } else if (line.startsWith("- ")) {
      html.push(
        `<li class="ml-5 list-disc text-gray-700 leading-relaxed">${esc(line.slice(2))}</li>`
      );
    } else if (line.trim() === "") {
      html.push("");
    } else {
      // bold **text**
      const formatted = esc(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      html.push(`<p class="text-gray-700 leading-relaxed mb-3">${formatted}</p>`);
    }
  }
  return <div dangerouslySetInnerHTML={{ __html: html.join("\n") }} />;
}
