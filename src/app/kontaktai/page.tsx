import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getDict } from "@/lib/i18n-server";
import {
  Eye,
  MapPin,
  Briefcase,
  Heart,
  Sparkles,
  Home,
  Users,
  Mail,
  Phone,
  Building2,
  ArrowUpRight,
} from "lucide-react";

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

const ADDRESS = "Beržų g. 8, Krūminių k., LT-65474 Varėnos r.";
const MAP_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`;

export default function AboutPage() {
  const t = getDict().about;
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main id="turinys" className="flex-1 bg-surface-muted">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <h1 className="font-display text-display-md text-ink text-center mb-10 text-balance">
            {t.pageTitle}
          </h1>

          {/* Mūsų vizija */}
          <section className="bg-surface-card rounded-2xl border border-line p-6 sm:p-8 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-soft border border-brand-line flex items-center justify-center flex-shrink-0">
                <Eye className="h-5 w-5 text-brand" aria-hidden />
              </div>
              <h2 className="font-display text-xl font-semibold text-ink">{t.visionTitle}</h2>
            </div>
            <p className="text-prose text-ink-muted text-pretty">{t.visionBody}</p>
          </section>

          {/* Mūsų misija */}
          <section className="bg-surface-card rounded-2xl border border-line p-6 sm:p-8 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-soft border border-brand-line flex items-center justify-center flex-shrink-0">
                <MapPin className="h-5 w-5 text-brand" aria-hidden />
              </div>
              <h2 className="font-display text-xl font-semibold text-ink">{t.missionTitle}</h2>
            </div>
            <p className="text-prose text-ink-muted mb-4 text-pretty">{t.missionBody1}</p>
            <p className="text-prose text-ink-muted text-pretty">{t.missionBody2}</p>
          </section>

          {/* Socialinio verslo modelis */}
          <section className="bg-surface-card rounded-2xl border border-line p-6 sm:p-8 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-soft border border-brand-line flex items-center justify-center flex-shrink-0">
                <Briefcase className="h-5 w-5 text-brand" aria-hidden />
              </div>
              <h2 className="font-display text-xl font-semibold text-ink">{t.fundingTitle}</h2>
            </div>
            <p className="text-prose text-ink-muted mb-6 text-pretty">{t.fundingIntro}</p>

            <div className="space-y-5">
              {[
                { title: t.fundingMembersTitle, desc: t.fundingMembersDesc },
                { title: t.fundingGroundsTitle, desc: t.fundingGroundsDesc },
                { title: t.fundingBridgeTitle, desc: t.fundingBridgeDesc },
                { title: t.fundingEventsTitle, desc: t.fundingEventsDesc },
                { title: t.fundingTransparencyTitle, desc: t.fundingTransparencyDesc },
              ].map((item) => (
                <div key={item.title} className="border-l-2 border-brand-line pl-4">
                  <p className="font-semibold text-ink mb-1">{item.title}</p>
                  <p className="text-sm text-ink-muted leading-relaxed text-pretty">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Socialinis poveikis */}
          <section className="bg-surface-card rounded-2xl border border-line p-6 sm:p-8 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-soft border border-brand-line flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-brand" aria-hidden />
              </div>
              <h2 className="font-display text-xl font-semibold text-ink">{t.impactTitle}</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: Users, title: t.impactCommunityTitle, desc: t.impactCommunityDesc },
                { icon: Home, title: t.impactLivingTitle, desc: t.impactLivingDesc },
                { icon: Sparkles, title: t.impactTraditionsTitle, desc: t.impactTraditionsDesc },
                { icon: Eye, title: t.impactTransparencyTitle, desc: t.impactTransparencyDesc },
              ].map((item) => (
                <div key={item.title} className="bg-brand-soft rounded-xl p-4 border border-brand-line">
                  <item.icon className="h-5 w-5 text-brand mb-2" aria-hidden />
                  <p className="font-semibold text-ink text-sm mb-1">{item.title}</p>
                  <p className="text-sm text-ink-muted leading-relaxed text-pretty">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Kontaktai – iki šiol jų šiame puslapyje NEBUVO, nors meniu punktas
              veda būtent čia, o poraštėje jis vadinasi „Kontaktai". */}
          <section id="kontaktai" className="bg-surface-card rounded-2xl border border-line p-6 sm:p-8 mb-6 scroll-mt-24">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-soft border border-brand-line flex items-center justify-center flex-shrink-0">
                <Mail className="h-5 w-5 text-brand" aria-hidden />
              </div>
              <h2 className="font-display text-xl font-semibold text-ink">{t.contactsTitle}</h2>
            </div>
            <p className="text-prose text-ink-muted mb-6 text-pretty">{t.contactsIntro}</p>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle mb-1">
                  {t.contactAddressLabel}
                </dt>
                <dd className="text-ink">
                  {ADDRESS}
                  <a
                    href={MAP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-strong"
                  >
                    {t.contactMapLink}
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle mb-1">
                  {t.contactEmailLabel}
                </dt>
                <dd>
                  <a
                    href="mailto:info@kruminiai.lt"
                    className="inline-flex items-center gap-2 text-ink hover:text-brand-strong transition-colors"
                  >
                    <Mail className="h-4 w-4 text-brand" aria-hidden />
                    info@kruminiai.lt
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle mb-1">
                  {t.contactPhoneLabel}
                </dt>
                <dd>
                  <a
                    href="tel:+37065849514"
                    className="inline-flex items-center gap-2 text-ink hover:text-brand-strong transition-colors"
                  >
                    <Phone className="h-4 w-4 text-brand" aria-hidden />
                    +370 658 49514
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle mb-1">
                  {t.contactCodeLabel}
                </dt>
                <dd className="inline-flex items-center gap-2 text-ink">
                  <Building2 className="h-4 w-4 text-brand" aria-hidden />
                  302795244
                </dd>
              </div>
            </dl>
          </section>

          {/* Mūsų vertybės */}
          <section className="bg-brand-strong rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                <Heart className="h-5 w-5 text-white" aria-hidden />
              </div>
              <h2 className="font-display text-xl font-semibold text-white">{t.valuesTitle}</h2>
            </div>
            <ul className="space-y-2.5">
              {[t.value1, t.value2, t.value3, t.value4, t.value5].map((value) => (
                <li key={value} className="flex items-center gap-2.5 text-green-50">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-300 flex-shrink-0" aria-hidden />
                  {value}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
