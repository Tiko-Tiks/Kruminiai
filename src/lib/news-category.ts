import type { Dictionary } from "@/lib/i18n";

/**
 * Naujienos kategorijos etiketė lankytojo kalba.
 *
 * `news.category` (migr. 023) DB'oje gyvena nuo pat pradžių, bet viešame
 * sąraše nebuvo rodoma – vienintelė vieta, kur ji veikė, buvo Skaidrumo tab'ai.
 * Etiketes laikom ČIA, o ne `constants.ts`, nes viešoje pusėje jos turi būti
 * dvikalbės (`constants.ts` etiketės – LT admin'ui).
 */
export function newsCategoryLabel(
  category: unknown,
  t: Dictionary["news"]
): string {
  switch (category) {
    case "projektas":
      return t.categoryProjektas;
    case "susirinkimas":
      return t.categorySusirinkimas;
    default:
      return t.categoryBendra;
  }
}
