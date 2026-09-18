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
 * Pasitikrinti logiką: `node scripts/check-no-pii.mjs --self-test`
 * (tuos pačius atvejus tikrina ir `tests/check-no-pii.test.mjs`).
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Kiek skirtingų kontaktų viename faile dar laikoma pavyzdžiais, ne sąrašu.
export const MAX_CONTACTS = 5;

export const SCANNED_EXTENSIONS = [".md", ".sql", ".json", ".txt"];
export const FORBIDDEN_EXTENSIONS = [".csv", ".xlsx", ".xls"];

/**
 * Išimtys – kelias repo šaknies atžvilgiu tiksliai taip, kaip jį rodo
 * `git ls-files`. Pildyti TIK tada, kai failas tikrai neturi asmens duomenų
 * (pvz. testinis rinkinys su išgalvotais kontaktais), ir kartu paaiškinti kodėl.
 */
export const ALLOWLIST = [
  // "tests/fixtures/pavyzdinis-sarasas.csv" – išgalvoti kontaktai unit testui
];

/**
 * LT telefonas: `+370`/`370` arba `8` ir dar 8 skaitmenys. Aplink negali būti
 * kitų skaitmenų – taip ilgesnės skaičių sekos (ID, sumos) nevirsta „numeriu".
 */
const PHONE_RE = /(?<!\d)(?:\+?370\d{8}|8\d{8})(?!\d)/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * Pašalina skirtukus TARP skaitmenų, kad `+370 612 34567` ir `8 612-34567`
 * atrodytų taip pat kaip `+37061234567` (tą patį daro `normalizePhone`
 * `src/lib/infobip.ts`).
 *
 * NEšalinama: eilutės lūžis (kitaip į vieną seką sulimptų skirtingose eilutėse
 * esantys numeriai) ir kablelis (jis skiria sumas `13 868,50` bei sąrašų
 * reikšmes, o ne telefono dalis).
 */
export function normalizeForPhoneScan(text) {
  return text.replace(/(?<=\d)[ \t \-().]+(?=\d)/g, "");
}

/** Vienoda numerio forma, kad tas pats žmogus dviem užrašymo būdais būtų vienas. */
function canonicalPhone(match) {
  const digits = match.replace(/^\+/, "");
  return digits.length === 9 && digits.startsWith("8") ? `370${digits.slice(1)}` : digits;
}

export function distinctPhones(text) {
  const found = normalizeForPhoneScan(text).match(PHONE_RE);
  if (!found) return [];
  return [...new Set(found.map(canonicalPhone))];
}

export function distinctEmails(text) {
  const found = text.match(EMAIL_RE);
  if (!found) return [];
  return [...new Set(found.map((v) => v.toLowerCase()))];
}

export function hasExtension(file, extensions) {
  const lower = file.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

/**
 * Gryna patikra vienam failui – be failų sistemos.
 *
 * @param {string} file kelias repo šaknies atžvilgiu
 * @param {string | null} content turinys (`null`, kai failo skaityti nereikia)
 * @returns {string[]} rastos problemos
 */
export function checkFile(file, content) {
  if (ALLOWLIST.includes(file)) return [];

  if (hasExtension(file, FORBIDDEN_EXTENSIONS)) {
    return [`${file}: skaičiuoklės eksportas repo medyje (${FORBIDDEN_EXTENSIONS.join(", ")})`];
  }
  if (!hasExtension(file, SCANNED_EXTENSIONS) || content == null) return [];

  const problems = [];
  const phones = distinctPhones(content);
  if (phones.length >= MAX_CONTACTS) {
    problems.push(
      `${file}: rasta ${phones.length} skirtingų telefono numerių (riba – ${MAX_CONTACTS})`
    );
  }
  const emails = distinctEmails(content);
  if (emails.length >= MAX_CONTACTS) {
    problems.push(
      `${file}: rasta ${emails.length} skirtingų el. pašto adresų (riba – ${MAX_CONTACTS})`
    );
  }
  return problems;
}

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

function main() {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
    return;
  }

  const problems = [];

  for (const file of trackedFiles()) {
    let content = null;
    if (!hasExtension(file, FORBIDDEN_EXTENSIONS) && hasExtension(file, SCANNED_EXTENSIONS)) {
      try {
        // Į git indeksą įrašytas, bet darbiniame medyje ištrintas ar katalogu
        // tapęs kelias meta klaidą čia pat – atskira išankstinė patikra būtų
        // lenktynių sąlyga (failas gali pasikeisti tarp patikros ir skaitymo).
        content = readFileSync(file, "utf8");
      } catch {
        continue;
      }
    }
    problems.push(...checkFile(file, content));
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

/** Fiktyvūs kontaktai testams – tikrų numerių čia niekada nebūna. */
export function buildSelfTestCases() {
  const spaced = ["+370 600 00001", "+370 600 00002", "370 600 00003", "8 600-00004", "8 (600) 00005"];
  const plain = ["+37060000001", "+37060000002", "37060000003", "860000004", "860000005"];
  const emails = ["a@x.lt", "b@x.lt", "c@x.lt", "d@x.lt", "e@x.lt"];

  return [
    {
      name: "penki numeriai su skirtukais – klaida",
      file: "duomenys.sql",
      content: spaced.join("\n"),
      expectProblem: true,
      expectMessage: "5 skirtingų telefono numerių",
    },
    {
      name: "penki numeriai be skirtukų – klaida",
      file: "duomenys.txt",
      content: plain.join("\n"),
      expectProblem: true,
      expectMessage: "5 skirtingų telefono numerių",
    },
    {
      name: "tas pats numeris skirtingais užrašymais – vienas kontaktas",
      file: "pastabos.md",
      content: ["+370 600 00001", "+37060000001", "8 600 00001", "860000001", "370-600-00001"].join("\n"),
      expectProblem: false,
    },
    {
      name: "keturi numeriai – po riba",
      file: "pastabos.md",
      content: spaced.slice(0, 4).join("\n"),
      expectProblem: false,
    },
    {
      name: "datos nelaikomos telefonais",
      file: "pastabos.md",
      content: ["2026-09-18", "2026.09.18", "2026 09 18", "2026-05-23", "1999-12-31"].join("\n"),
      expectProblem: false,
    },
    {
      name: "sumos ir IBAN nelaikomi telefonais",
      file: "finansai.md",
      content: ["13 868,50 EUR", "13.868,50", "1 200,00", "LT167181200000606866", "606 866"].join("\n"),
      expectProblem: false,
    },
    {
      name: "ilgesnė skaičių seka nelaikoma telefonu",
      file: "log.json",
      content: ["99937061234567000", "8600000041234", "0123456789012"].join("\n"),
      expectProblem: false,
    },
    {
      name: "penki el. paštai – klaida",
      file: "sarasas.md",
      content: emails.join("\n"),
      expectProblem: true,
      expectMessage: "5 skirtingų el. pašto adresų",
    },
    {
      name: "csv repo medyje – klaida",
      file: "eksportas.csv",
      content: null,
      expectProblem: true,
      expectMessage: "skaičiuoklės eksportas",
    },
    {
      name: "kodo failas netikrinamas",
      file: "src/lib/pavyzdys.ts",
      content: spaced.join("\n"),
      expectProblem: false,
    },
  ];
}

function runSelfTest() {
  const cases = buildSelfTestCases();
  let failed = 0;
  for (const c of cases) {
    const problems = checkFile(c.file, c.content);
    const ok = c.expectProblem
      ? problems.length > 0 && (!c.expectMessage || problems.some((p) => p.includes(c.expectMessage)))
      : problems.length === 0;
    if (ok) {
      console.log(`  ✓ ${c.name}`);
    } else {
      failed++;
      console.error(`  ✗ ${c.name} – gauta: ${problems.join(" | ") || "(problemų nėra)"}`);
    }
  }
  if (failed > 0) {
    console.error(`[check:pii] savitikra: ${failed} nesėkmingi atvejai`);
    process.exit(1);
  }
  console.log(`[check:pii] savitikra: ${cases.length}/${cases.length} gerai`);
}

// Vykdoma tik paleidus tiesiogiai – testai importuoja gryną logiką
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
