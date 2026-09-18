#!/usr/bin/env node
/**
 * Asmens duomenų sargas repo medyje.
 *
 * Tikslas – neleisti, kad į viešą repozitoriją vėl patektų narių sąrašai
 * (eksportai iš skaičiuoklių, importo SQL ir pan.). Tikrinami TIK git sekami
 * failai, todėl lokalūs, į `.gitignore` įtraukti darbiniai failai netrukdo.
 *
 * Dvi taisyklės:
 *   1. Skaičiuoklių eksportai (`.csv`, `.xlsx`, `.xls`) repo medyje neleidžiami.
 *   2. Ne kodo failuose (`.md`, `.sql`, `.json`, `.txt`) neleidžiama turėti
 *      MAX_CONTACTS ar daugiau skirtingų telefono numerių arba el. pašto adresų –
 *      tiek jų pasitaiko tik sąraše, ne pavyzdyje.
 *
 * Kodo failai (`.ts`, `.tsx`, `.mjs`) netikrinami: juose pasitaiko techninių
 * adresų (pvz. bendruomenės dėžutė šablonuose), o duomenų sąrašų – ne.
 *
 * Paleidimas: `npm run check:pii` (taip pat vykdoma CI).
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Kiek skirtingų kontaktų viename faile dar laikoma pavyzdžiais, ne sąrašu.
const MAX_CONTACTS = 5;

const SCANNED_EXTENSIONS = [".md", ".sql", ".json", ".txt"];
const FORBIDDEN_EXTENSIONS = [".csv", ".xlsx", ".xls"];

/**
 * Išimtys – kelias repo šaknies atžvilgiu tiksliai taip, kaip jį rodo
 * `git ls-files`. Pildyti TIK tada, kai failas tikrai neturi asmens duomenų
 * (pvz. testinis rinkinys su išgalvotais kontaktais), ir kartu paaiškinti kodėl.
 */
const ALLOWLIST = [
  // "tests/fixtures/pavyzdinis-sarasas.csv" – išgalvoti kontaktai unit testui
];

const PHONE_RE = /(?:\+?3706\d{7})|(?:\b86\d{7}\b)/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function trackedFiles() {
  try {
    const out = execFileSync("git", ["ls-files", "-z"], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    return out.split("\0").filter(Boolean);
  } catch (err) {
    console.error("[check:pii] Nepavyko nuskaityti git sekamų failų sąrašo:", err.message);
    process.exit(2);
  }
}

function hasExtension(file, extensions) {
  const lower = file.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

function distinctMatches(text, regex) {
  const found = text.match(regex);
  if (!found) return [];
  return [...new Set(found.map((v) => v.toLowerCase()))];
}

function main() {
  const problems = [];

  for (const file of trackedFiles()) {
    if (ALLOWLIST.includes(file)) continue;

    if (hasExtension(file, FORBIDDEN_EXTENSIONS)) {
      problems.push(`${file}: skaičiuoklės eksportas repo medyje (${FORBIDDEN_EXTENSIONS.join(", ")})`);
      continue;
    }

    if (!hasExtension(file, SCANNED_EXTENSIONS)) continue;

    let content;
    try {
      // Į git indeksą įrašytas, bet darbiniame medyje ištrintas ar katalogu
      // tapęs kelias meta klaidą čia pat – atskira išankstinė patikra būtų
      // lenktynių sąlyga (failas gali pasikeisti tarp patikros ir skaitymo).
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    const phones = distinctMatches(content, PHONE_RE);
    if (phones.length >= MAX_CONTACTS) {
      problems.push(`${file}: rasta ${phones.length} skirtingų telefono numerių (riba – ${MAX_CONTACTS})`);
    }

    const emails = distinctMatches(content, EMAIL_RE);
    if (emails.length >= MAX_CONTACTS) {
      problems.push(`${file}: rasta ${emails.length} skirtingų el. pašto adresų (riba – ${MAX_CONTACTS})`);
    }
  }

  if (problems.length > 0) {
    console.error("[check:pii] Repo medyje rasti galimi asmens duomenys:\n");
    for (const p of problems) console.error(`  • ${p}`);
    console.error(
      "\nDuomenų failai laikomi už repo ribų. Jei tai klaidingas pastebėjimas – " +
        "įrašykit failą į ALLOWLIST faile scripts/check-no-pii.mjs su paaiškinimu."
    );
    process.exit(1);
  }

  console.log("[check:pii] Asmens duomenų požymių repo medyje nerasta.");
}

main();
