import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-white font-semibold mb-3">{SITE_NAME}</h3>
            <p className="text-sm leading-relaxed">
              Bendruomenė, vienijanti Krūminių kaimo gyventojus bendriems tikslams
              ir geresnei gyvenimo kokybei.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">Nuorodos</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/naujienos" className="hover:text-white transition-colors">Naujienos</Link></li>
              <li><Link href="/dokumentai" className="hover:text-white transition-colors">Dokumentai</Link></li>
              <li><Link href="/kontaktai" className="hover:text-white transition-colors">Kontaktai</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">Kontaktai</h4>
            <ul className="space-y-2 text-sm">
              <li>Krūminių k., Lietuvos Respublika</li>
              <li>El. paštas: info@kruminiai.lt</li>
              <li>Tel.: +370 600 00000</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-800 text-sm text-center">
          &copy; {year} {SITE_NAME}. Visos teisės saugomos.
        </div>
      </div>
    </footer>
  );
}
