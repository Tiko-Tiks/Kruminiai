// Tik serveriui – naudoja `fs` (importuojam iš serverio komponentų / action'ų).
import { access } from "fs/promises";
import path from "path";
import { createAdminSupabaseClient, isAdminClientAvailable } from "@/lib/supabase-admin";

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
 *   • kita                   → Supabase Storage objektas (bucket'o sąrašas)
 *
 * Klaidos atveju (tinklas, timeout) grąžinam „yra" – geriau nerodyti įspėjimo,
 * nei klaidingai apkaltinti veikiantį dokumentą.
 */

const STORAGE_BUCKET = "documents";

async function existsInRepo(relativeFromCwd: string): Promise<boolean> {
  try {
    await access(path.join(process.cwd(), relativeFromCwd));
    return true;
  } catch {
    return false;
  }
}

/**
 * `documents` bucket'as privatus (migr. 050), todėl HEAD į viešą URL nebetinka –
 * jis visiems failams grąžintų „nėra". Tikrinam service-role klientu per
 * bucket'o sąrašą: tai neparsiunčia turinio ir nekuria pasirašytų nuorodų.
 */
async function existsInStorage(filePath: string): Promise<boolean> {
  if (!isAdminClientAvailable()) return true;

  const lastSlash = filePath.lastIndexOf("/");
  const dir = lastSlash === -1 ? "" : filePath.slice(0, lastSlash);
  const name = lastSlash === -1 ? filePath : filePath.slice(lastSlash + 1);
  if (!name) return true;

  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(dir, { limit: 100, search: name });
    if (error) return true;
    return (data ?? []).some((entry) => entry.name === name);
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
