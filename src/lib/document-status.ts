// Tik serveriui – naudoja `fs` (importuojam iš serverio komponentų / action'ų).
import { access } from "fs/promises";
import path from "path";
import { getDocumentPublicUrl } from "@/lib/utils";

/**
 * Patikrina, ar `documents` įrašo failas realiai egzistuoja.
 *
 * Kodėl to reikia: `documents` eilutė ir pats failas yra du atskiri dalykai –
 * eilutė gali likti be failo (kaip buvo su įstatais: įrašas viešas, o failo
 * nei Storage'e, nei pasiekiamu keliu nebuvo). Naudotojui tai atrodydavo kaip
 * tylus nieko neveikimas. Admin sąraše tokį dokumentą pažymim aiškiai.
 *
 * Tikrinimo būdas pagal `file_path` formatą:
 *   • `__api__/dokumentai/X` → failas repo `private/documents/` aplanke (fs)
 *   • `__public__/X`         → failas repo `public/` aplanke (fs)
 *   • `__api__/…` (kita)     → server-generuojamas HTML, failo nėra ir nereikia
 *   • kita                   → Supabase Storage objektas (HEAD į public URL)
 *
 * Klaidos atveju (tinklas, timeout) grąžinam „yra" – geriau nerodyti įspėjimo,
 * nei klaidingai apkaltinti veikiantį dokumentą.
 */

const CHECK_TIMEOUT_MS = 2500;

async function existsInRepo(relativeFromCwd: string): Promise<boolean> {
  try {
    await access(path.join(process.cwd(), relativeFromCwd));
    return true;
  } catch {
    return false;
  }
}

async function existsInStorage(filePath: string): Promise<boolean> {
  const url = getDocumentPublicUrl(filePath);
  if (!url.startsWith("http")) return true;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    // 404 / 400 – objekto nėra. Kiti kodai (5xx, tinklo triktis) – nesprendžiam.
    if (res.status === 404 || res.status === 400) return false;
    return true;
  } catch {
    return true;
  }
}

export async function documentFileExists(filePath: string): Promise<boolean> {
  if (filePath.startsWith("__api__/dokumentai/")) {
    return existsInRepo(
      path.join("private", "documents", filePath.slice("__api__/dokumentai/".length))
    );
  }
  if (filePath.startsWith("__public__/")) {
    return existsInRepo(path.join("public", filePath.slice("__public__/".length)));
  }
  // Server-generuojami HTML dokumentai (veiklos planas, šalinami, rinkimai)
  if (filePath.startsWith("__api__/")) return true;

  return existsInStorage(filePath);
}

/**
 * Grąžina aibę `file_path` reikšmių, kurių failo rasti nepavyko.
 * Tikrinimai vykdomi lygiagrečiai – admin dokumentų sąraše jų yra keliolika.
 */
export async function findMissingDocumentFiles(
  filePaths: string[]
): Promise<Set<string>> {
  const unique = Array.from(new Set(filePaths));
  const results = await Promise.all(
    unique.map(async (fp) => [fp, await documentFileExists(fp)] as const)
  );
  return new Set(results.filter(([, exists]) => !exists).map(([fp]) => fp));
}
