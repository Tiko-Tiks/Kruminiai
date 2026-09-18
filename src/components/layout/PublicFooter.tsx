import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { SITE_NAME } from "@/lib/constants";
import { getDict } from "@/lib/i18n-server";

export function PublicFooter() {
  const year = new Date().getFullYear();
  const t = getDict().footer;
  return (
    <footer className="bg-brand-strong text-green-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <h3 className="text-white text-lg font-semibold mb-3">{SITE_NAME}</h3>
            <p className="text-sm leading-relaxed text-green-100/80 text-pretty">{t.tagline}</p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">
              {t.linksHeading}
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/naujienos" className="hover:text-white transition-colors">{t.linkNews}</Link></li>
              <li><Link href="/projektai" className="hover:text-white transition-colors">{t.linkProjects}</Link></li>
              <li><Link href="/dokumentai" className="hover:text-white transition-colors">{t.linkDocuments}</Link></li>
              <li><Link href="/kontaktai" className="hover:text-white transition-colors">{t.linkContacts}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">
              {t.contactsHeading}
            </h4>
            {/* Adresas / paštas / telefonas – paspaudžiami. Telefone „paskambinti"
                iš svetainės buvo neįmanoma: numeris buvo paprastas tekstas. */}
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-300" aria-hidden />
                <span>Beržų g. 8, Krūminių k., LT-65474 Varėnos r.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Mail className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-300" aria-hidden />
                <a href="mailto:info@kruminiai.lt" className="hover:text-white transition-colors">
                  info@kruminiai.lt
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-300" aria-hidden />
                <a href="tel:+37065849514" className="hover:text-white transition-colors">
                  +370 658 49514
                </a>
              </li>
              <li className="text-green-100/70 pl-[1.625rem]">
                {t.companyCodeLabel} 302795244
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-8 border-t border-white/15 text-sm text-center text-green-100/70">
          &copy; {year} {SITE_NAME}. {t.rightsReserved}
        </div>
      </div>
    </footer>
  );
}
