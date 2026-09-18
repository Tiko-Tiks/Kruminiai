import { createServerSupabaseClient } from "@/lib/supabase-server";
import { generateSepaQrSvg } from "@/lib/sepa-qr";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { formatDate, getImagePublicUrl } from "@/lib/utils";
import { formatDonorName } from "@/lib/donor-name";
import { getDict, getLocale } from "@/lib/i18n-server";
import { Heart, Phone, Mail, Hammer, Wallet, ChevronDown } from "lucide-react";
import { CopyButton } from "./CopyButton";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

// Kiek rėmėjų rodoma iš karto (likusieji – po išskleidimu)
const DONORS_VISIBLE = 12;

export const dynamic = "force-dynamic";
export const revalidate = 60; // naujas projektas DB atsiranda be perdiegimo

// Statiniai repo failai / senieji adresai, kurių DB nesaugo. Naujam projektui
// įrašo čia nereikia – tiesiog nebus „prieš/po" nuotraukų ir plakato nuorodos.
interface ProjectAssets {
  beforeImage?: string;
  afterImage?: string;
  ogImage?: { url: string; width: number; height: number };
  printPath?: string;
  /** Trumpasis adresas, likęs nuo atskiro puslapio laikų (plakatuose, SMS). */
  shortPath?: string;
}

const PROJECT_ASSETS: Record<string, ProjectAssets> = {
  lieptas: {
    beforeImage: "/images/lieptas/liepto-dabar.jpg",
    afterImage: "/images/lieptas/liepto-vizija.jpg",
    ogImage: { url: "/images/lieptas/liepto-vizija.jpg", width: 1445, height: 1088 },
    printPath: "/lieptas/spausdinti",
    shortPath: "/lieptas",
  },
};

/** Viešo projekto įrašas pagal slug'ą – null, jei nerastas arba nepaviešintas. */
async function getProject(slug: string) {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("fundraising_projects")
    .select("*")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const project = await getProject(params.slug);
  if (!project) return { title: "Projektas nerastas" };

  const assets = PROJECT_ASSETS[params.slug] ?? {};
  const title = project.title as string;
  const description = (project.short_desc as string | null) || undefined;

  return {
    title,
    description,
    alternates: { canonical: assets.shortPath ?? `/projektai/${params.slug}` },
    openGraph: {
      type: "website",
      locale: "lt_LT",
      title,
      description,
      siteName: "Krūminių kaimo bendruomenė",
      images: assets.ogImage ? [assets.ogImage] : undefined,
    },
  };
}

export default async function ProjectPage({ params }: { params: { slug: string } }) {
  const locale = getLocale();
  const t = getDict().lieptas;

  const project = await getProject(params.slug);
  if (!project) notFound();

  const supabase = createServerSupabaseClient();
  const assets = PROJECT_ASSETS[params.slug] ?? {};

  const { data: donations } = await supabase
    .from("donations")
    .select(
      "id, donor_name, donor_first_name, donor_last_name, display_mode, amount_cents, donated_at, is_anonymous, donor_message"
    )
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

  // Projekto marketinginis turinys – EN versija iš *_en stulpelių su LT fallback'u
  const projectTitle =
    (locale === "en" && (project.title_en as string | null)) || (project.title as string);
  const projectShortDesc =
    (locale === "en" && (project.short_desc_en as string | null)) ||
    (project.short_desc as string | null);
  const projectStory =
    (locale === "en" && (project.story_md_en as string | null)) ||
    (project.story_md as string | null);

  // Projektas gali būti jau finansuotas iš išorės – tada paramos bloko nerodom.
  const acceptsDonations = project.accepts_donations !== false;

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
  const qrSvg = acceptsDonations
    ? await generateSepaQrSvg({
        bic: project.bic || undefined,
        recipient: project.recipient,
        iban: project.iban,
        remittance: project.purpose_text,
      })
    : null;

  const totalEur = (totalCents / 100).toFixed(0);
  const goalEur = (goalCents / 100).toFixed(0);
  const remainingEur = ((goalCents - totalCents) / 100).toFixed(0);

  const shareUrl = `kruminiai.lt${assets.shortPath ?? `/projektai/${params.slug}`}`;
  const hasBeforeAfter = Boolean(assets.beforeImage && assets.afterImage);

  // Rėmėjų sąrašas: matomi naujausi, likusieji – po „Rodyti visus".
  const visibleDonations = (donations || []).slice(0, DONORS_VISIBLE);
  const hiddenDonations = (donations || []).slice(DONORS_VISIBLE);

  const renderDonor = (d: (typeof visibleDonations)[number]) => (
    <div key={d.id as string} className="py-3 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-ink">
          {/* Be auditorijos – viešas puslapis, tad tik inicialai („V. K.") */}
          {formatDonorName(d, locale)}
        </p>
        {d.donor_message && (
          <p className="text-sm text-ink-muted italic mt-0.5">
            &bdquo;{d.donor_message as string}&ldquo;
          </p>
        )}
        <p className="text-xs text-ink-subtle mt-0.5">
          {formatDate(d.donated_at as string)}
        </p>
      </div>
      <span className="font-bold text-brand whitespace-nowrap">
        {((d.amount_cents as number) / 100).toFixed(0)} €
      </span>
    </div>
  );

  // Pasiūlytos sumos
  const suggestedAmounts = [5, 10, 20, 50];

  return (
    <div className="min-h-screen flex flex-col bg-surface-muted">
      <PublicHeader />

      <main id="turinys" className="flex-1">
        {/* Hero */}
        <section className="bg-brand-strong text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-16">
            <p className="text-sm uppercase tracking-widest text-green-200 mb-2 font-medium">
              {t.heroEyebrow.replace("{year}", String(new Date().getFullYear()))}
            </p>
            <h1 className="font-display text-display-lg font-semibold text-balance mb-4">
              {projectTitle}
            </h1>
            <p className="text-lg md:text-xl text-green-100 leading-relaxed max-w-2xl">
              {projectShortDesc}
            </p>
          </div>
        </section>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-10">
          {/* Prieš / Po */}
          {hasBeforeAfter && (
            <section className="bg-surface-card rounded-2xl border border-line p-4 sm:p-6 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <figure className="relative overflow-hidden rounded-xl">
                  <img
                    src={assets.beforeImage}
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
                    src={assets.afterImage}
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
          )}

          {/* Progresas */}
          <section className="bg-surface-card rounded-2xl border border-line p-6 sm:p-8 shadow-sm">
            {goalCents > 0 ? (
              <>
                <div className="flex items-end justify-between flex-wrap gap-3 mb-3">
                  <div>
                    <div className="text-4xl sm:text-5xl font-bold text-brand">
                      {totalEur} €
                    </div>
                    <p className="text-sm text-ink-subtle mt-1">
                      {t.progressRaisedPrefix} <span className="font-semibold">{goalEur} €</span> {t.progressGoalSuffix}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-ink">{percent}%</div>
                    {acceptsDonations && (
                      <p className="text-xs text-ink-subtle">{donorCount} {t.donorsLabel}</p>
                    )}
                  </div>
                </div>

                <div className="w-full bg-surface-muted rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-brand h-full rounded-full transition-all"
                    style={{ width: `${barPercent}%` }}
                  />
                </div>

                {goalReached ? (
                  <div className="mt-4 bg-brand-soft border border-brand-line rounded-xl px-4 py-3">
                    <p className="text-sm font-semibold text-brand-strong">{t.goalReachedTitle}</p>
                    {surplusCents > 0 && (
                      <p className="text-sm text-brand mt-0.5">
                        {t.goalSurplusNote.replace("{surplus}", (surplusCents / 100).toFixed(0))}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-ink-muted mt-4">
                    {t.remainingPrefix} <strong className="text-ink">{remainingEur} €</strong>{t.remainingSuffix}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="text-center">
                  <div className="text-5xl sm:text-6xl font-bold text-brand">
                    {totalEur} €
                  </div>
                  <p className="text-sm text-ink-subtle mt-2">
                    {donorCount} {t.donorsLabel}
                  </p>
                </div>
                {acceptsDonations && (
                  <div className="mt-5 bg-brand-soft border border-brand-line rounded-xl px-4 py-3">
                    <p className="text-sm text-brand-strong text-center">{t.noGoalNote}</p>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Statybų eiga (II etapas) */}
          <section className="bg-surface-card rounded-2xl border border-line p-6 sm:p-8 shadow-sm">
            <h2 className="font-display text-2xl font-semibold text-ink mb-1 flex items-center gap-2">
              <Hammer className="h-6 w-6 text-amber-600" />
              {t.constructionHeading}
            </h2>
            <p className="text-sm text-ink-muted mb-6">{t.constructionIntro}</p>

            {(updates || []).length === 0 ? (
              <div className="text-center py-10">
                <p className="text-ink-subtle mb-2">{t.noUpdatesTitle}</p>
                <p className="text-sm text-ink-subtle">{t.noUpdatesSubtitle}</p>
              </div>
            ) : (
              <ol className="relative border-l-2 border-brand-line ml-2 space-y-8">
                {(updates || []).map((u) => {
                  const photos = ((u.photos as string[]) || []).filter(Boolean);
                  return (
                    <li key={u.id} className="pl-6 relative">
                      <span className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full bg-brand border-4 border-brand-line" />
                      <p className="text-xs text-ink-subtle mb-0.5">
                        {formatDate(u.update_date as string)}
                      </p>
                      <h3 className="font-semibold text-ink">{u.title as string}</h3>
                      {u.body && (
                        <p className="text-sm text-ink-muted mt-1 leading-relaxed whitespace-pre-line">
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
                                  src={getImagePublicUrl(p, { width: 320 })}
                                  alt={t.updatePhotoAlt}
                                  loading="lazy"
                                  width={320}
                                  height={240}
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
          <section className="bg-surface-card rounded-2xl border border-line p-6 sm:p-8 shadow-sm">
            <h2 className="font-display text-2xl font-semibold text-ink mb-1 flex items-center gap-2">
              <Wallet className="h-6 w-6 text-brand" />
              {t.spendingHeading}
            </h2>
            <p className="text-sm text-ink-muted mb-6">{t.spendingIntro}</p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-brand-soft border border-brand-line rounded-xl p-3 sm:p-4 text-center">
                <div className="text-lg sm:text-2xl font-bold text-brand">
                  {(totalCents / 100).toFixed(0)} €
                </div>
                <p className="text-xs text-ink-subtle mt-0.5">{t.statCollected}</p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 sm:p-4 text-center">
                <div className="text-lg sm:text-2xl font-bold text-amber-700">
                  {(spentCents / 100).toFixed(2).replace(/\.00$/, "")} €
                </div>
                <p className="text-xs text-ink-subtle mt-0.5">{t.statSpent}</p>
              </div>
              <div className="bg-surface-muted border border-line rounded-xl p-3 sm:p-4 text-center">
                <div className="text-lg sm:text-2xl font-bold text-ink">
                  {(fundsRemainingCents / 100).toFixed(2).replace(/\.00$/, "")} €
                </div>
                <p className="text-xs text-ink-subtle mt-0.5">{t.statRemaining}</p>
              </div>
            </div>

            {(expenses || []).length === 0 ? (
              <p className="text-sm text-ink-subtle text-center py-4">{t.expensesEmpty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ink-subtle uppercase tracking-wide border-b border-line">
                      <th className="py-2 pr-3 font-medium">{t.expColDate}</th>
                      <th className="py-2 pr-3 font-medium">{t.expColPurpose}</th>
                      <th className="py-2 text-right font-medium">{t.expColAmount}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(expenses || []).map((e) => (
                      <tr key={e.id}>
                        <td className="py-2.5 pr-3 text-ink-subtle whitespace-nowrap align-top">
                          {formatDate(e.expense_date as string)}
                        </td>
                        <td className="py-2.5 pr-3 text-ink align-top">
                          {e.description as string}
                          {e.supplier && (
                            <span className="text-ink-subtle"> · {e.supplier as string}</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right font-semibold text-ink whitespace-nowrap align-top">
                          {((e.amount_cents as number) / 100).toFixed(2)} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-line">
                      <td colSpan={2} className="py-2.5 pr-3 text-sm font-semibold text-ink-muted">
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

          {/* Aukojimas – tik projektams, kuriems dar renkama parama */}
          {acceptsDonations && qrSvg && (
            <section className="bg-surface-card rounded-2xl border border-line p-6 sm:p-8 shadow-sm">
              <h2 className="font-display text-2xl font-semibold text-ink mb-1 flex items-center gap-2">
                <Heart className="h-6 w-6 text-red-500" />
                {t.howToDonateHeading}
              </h2>
              <p className="text-sm text-ink-muted mb-6">{t.howToDonateIntro}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* QR */}
                <div className="bg-brand-soft rounded-xl p-6 text-center border border-brand-line">
                  <div
                    className="bg-surface-card rounded-lg p-4 shadow-sm mx-auto max-w-[320px] [&_svg]:w-full [&_svg]:h-auto [&_svg]:block"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                  <p className="text-sm text-ink-muted mt-3 font-semibold">
                    {t.qrInstruction}
                  </p>
                  <p className="text-xs text-ink-subtle mt-2 leading-relaxed">
                    {t.qrSupportedApps}
                  </p>
                </div>

                {/* Banko rekvizitai */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-ink mb-2 text-sm uppercase tracking-wide">
                      {t.manualTransferHeading}
                    </h3>
                    <div className="bg-surface-muted rounded-lg p-4 space-y-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="text-ink-subtle">{t.fieldRecipient}</span>
                        <span className="font-medium text-ink text-right">{project.recipient}</span>
                      </div>
                      <div className="flex justify-between gap-2 items-center">
                        <span className="text-ink-subtle">{t.fieldIban}</span>
                        <span className="flex items-center gap-2">
                          <span className="font-mono font-medium text-ink text-right text-xs sm:text-sm">{project.iban}</span>
                          <CopyButton value={project.iban} />
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-ink-subtle">{t.fieldBank}</span>
                        <span className="text-ink text-right">{t.bankName}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-ink-subtle">{t.fieldPurpose}</span>
                        <span className="font-medium text-ink text-right">{project.purpose_text}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-ink mb-2 text-sm uppercase tracking-wide">
                      {t.suggestedAmountsHeading}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {suggestedAmounts.map((amt) => (
                        <span
                          key={amt}
                          className="px-3 py-1.5 bg-brand-soft text-brand-strong rounded-full text-sm font-semibold border border-brand-line"
                        >
                          {amt} €
                        </span>
                      ))}
                      <span className="px-3 py-1.5 bg-surface-muted text-ink-muted rounded-full text-sm border border-line">
                        {t.otherAmount}
                      </span>
                    </div>
                    <p className="text-xs text-ink-subtle mt-2">{t.boardCostHint}</p>
                  </div>
                </div>
              </div>

              {/* Grynais */}
              <div className="mt-6 pt-6 border-t border-line">
                <h3 className="font-semibold text-ink mb-2 text-sm uppercase tracking-wide">
                  {t.cashDonationHeading}
                </h3>
                <div className="flex flex-wrap gap-4 text-sm text-ink-muted">
                  {project.contact_phone && (
                    <a href={`tel:${project.contact_phone}`} className="inline-flex items-center gap-1.5 hover:text-brand">
                      <Phone className="h-4 w-4" /> {project.contact_phone}
                    </a>
                  )}
                  {project.contact_email && (
                    <a href={`mailto:${project.contact_email}`} className="inline-flex items-center gap-1.5 hover:text-brand">
                      <Mail className="h-4 w-4" /> {project.contact_email}
                    </a>
                  )}
                  <span className="text-ink-subtle">{t.communityAddress}</span>
                </div>
              </div>
            </section>
          )}

          {/* Istorija */}
          {projectStory && (
            <section className="bg-surface-card rounded-2xl border border-line p-6 sm:p-8 shadow-sm">
              <StoryMarkdown md={projectStory} />
            </section>
          )}

          {/* Rėmėjų sąrašas */}
          <section className="bg-surface-card rounded-2xl border border-line p-6 sm:p-8 shadow-sm">
            <h2 className="font-display text-xl font-semibold text-ink mb-1">
              {t.supportersHeading} ({donorCount})
            </h2>
            <p className="text-sm text-ink-subtle mb-5">{t.supportersTransparency}</p>

            {donorCount === 0 ? (
              <div className="text-center py-10">
                <p className="text-ink-subtle mb-2">{t.noDonorsTitle}</p>
                <p className="text-sm text-ink-subtle">{t.noDonorsSubtitle}</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-line">
                  {visibleDonations.map(renderDonor)}
                </div>

                {/* 61 eilutės sąrašas anksčiau užimdavo pusę puslapio ir
                    nustumdavo žemyn viską, kas po jo. Likusieji – po
                    išskleidimu; `<details>` veikia ir be JavaScript. */}
                {hiddenDonations.length > 0 && (
                  <details className="group mt-2">
                    <summary className="cursor-pointer list-none py-3 text-sm font-semibold text-brand hover:text-brand-strong flex items-center gap-1.5">
                      <ChevronDown className="h-4 w-4 group-[[open]]:rotate-180 transition-transform" aria-hidden />
                      {t.supportersShowAll.replace("{count}", String(hiddenDonations.length))}
                    </summary>
                    <div className="divide-y divide-line border-t border-line">
                      {hiddenDonations.map(renderDonor)}
                    </div>
                  </details>
                )}
              </>
            )}
          </section>

          {/* Pasidalink */}
          <section className="bg-amber-50 border border-amber-200 rounded-2xl p-6 sm:p-8 text-center">
            <h2 className="text-lg font-bold text-amber-900 mb-2">{t.shareHeading}</h2>
            <p className="text-sm text-amber-800 mb-4">{t.shareIntro}</p>
            <div className="inline-flex items-center gap-1 bg-surface-card border border-amber-300 rounded-full pl-4 pr-1.5 py-1.5 text-sm">
              <span className="font-mono text-ink">{shareUrl}</span>
              <CopyButton value={`https://${shareUrl}`} />
            </div>
          </section>

          {assets.printPath && (
            <p className="text-xs text-center text-ink-subtle">
              {t.printableNotice}{" "}
              <Link href={assets.printPath} className="text-brand hover:underline">
                {t.printableLinkWord}
              </Link>
              .
            </p>
          )}
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
        `<h3 class="text-lg font-bold text-ink mt-6 mb-2 first:mt-0">${esc(line.slice(3))}</h3>`
      );
    } else if (line.startsWith("- ")) {
      html.push(
        `<li class="ml-5 list-disc text-ink-muted leading-relaxed">${esc(line.slice(2))}</li>`
      );
    } else if (line.trim() === "") {
      html.push("");
    } else {
      // bold **text**
      const formatted = esc(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      html.push(`<p class="text-ink-muted leading-relaxed mb-3">${formatted}</p>`);
    }
  }
  return <div dangerouslySetInnerHTML={{ __html: html.join("\n") }} />;
}
