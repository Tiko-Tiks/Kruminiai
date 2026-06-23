import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";
import { getDict } from "@/lib/i18n-server";

export function PublicFooter() {
  const year = new Date().getFullYear();
  const t = getDict().footer;
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-white font-semibold mb-3">{SITE_NAME}</h3>
            <p className="text-sm leading-relaxed">{t.tagline}</p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">{t.linksHeading}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/naujienos" className="hover:text-white transition-colors">{t.linkNews}</Link></li>
              <li><Link href="/dokumentai" className="hover:text-white transition-colors">{t.linkDocuments}</Link></li>
              <li><Link href="/kontaktai" className="hover:text-white transition-colors">{t.linkContacts}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">{t.contactsHeading}</h4>
            <ul className="space-y-2 text-sm">
              <li>Beržų g. 8, Krūminių k., LT-65474 Varėnos r.</li>
              <li>{t.companyCodeLabel} 302795244</li>
              <li>{t.emailLabel} info@kruminiai.lt</li>
              <li>{t.phoneLabel} +370 658 49514</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-800 text-sm text-center">
          &copy; {year} {SITE_NAME}. {t.rightsReserved}
        </div>
      </div>
    </footer>
  );
}
