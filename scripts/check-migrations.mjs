#!/usr/bin/env node
/**
 * Migracijų numeracijos patikra.
 *
 * `supabase/migrations/` failai taikomi numerio tvarka, todėl numeris turi būti
 * unikalus IR toliau už visus jau sumergintus. Tikrinama trys dalykai:
 *
 *   1. pavadinimo forma `NNN_pavadinimas.sql`;
 *   2. dublikatai (istoriniai – `KNOWN_DUPLICATES`, naujų neleidžiam);
 *   3. seka be tarpų nuo 001 iki didžiausio, išskyrus `RESERVED`;
 *   4. PR kontekste (kai pasiekiamas `origin/main`) – naujai PRIDĖTI failai turi
 *      būti arba `RESERVED`, arba didesni už `origin/main` maksimumą.
 *
 * Paleidimas: `npm run check:migrations` (taip pat vykdoma CI).
 * Pasitikrinti pačią logiką: `node scripts/check-migrations.mjs --self-test`
 * (tuos pačius atvejus tikrina ir `tests/check-migrations.test.mjs`).
 */

import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase", "migrations");
const MIGRATIONS_PREFIX = "supabase/migrations/";

/**
 * Istoriniai dublikatai: numeris → kiek failų su juo leidžiama.
 * Šio sąrašo NEPILDOM – naujas įrašas reikštų, kad dublikatas praleistas.
 */
export const KNOWN_DUPLICATES = {
  "020": 2,
  "021": 2,
  "028": 2,
};

/**
 * Numeriai, rezervuoti lygiagrečiai kuriamiems PR. Jie repo dar neegzistuoja,
 * todėl sekos patikra jų vietoje tarpo nelaiko klaida, o naujas failas su tokiu
 * numeriu praeina ir tada, kai jis mažesnis už `origin/main` maksimumą.
 *
 * 046–049 – PR #16, 050–052 – PR #15.
 * ŠIUOS ĮRAŠUS PAŠALINTI, kai tie PR sumerginti (tada numeriai jau bus repo, o
 * sekos patikra saugos toliau).
 */
export const RESERVED = ["046", "047", "048", "049", "050", "051", "052"];

const FILE_NAME_RE = /^(\d{3})_[a-z0-9_]+\.sql$/;

/** „7" → „007" (numeriai visur lyginami kaip trijų skaitmenų eilutės). */
function pad(n) {
  return String(n).padStart(3, "0");
}

/**
 * Gryna patikros logika – be failų sistemos ir be git.
 *
 * @param {string[]} files migracijų failų vardai (be katalogo)
 * @param {{ addedFiles?: string[] | null, mainMaxNumber?: string | null }} [context]
 *   `addedFiles` – šiame PR pridėti failai (vardai be katalogo);
 *   `mainMaxNumber` – didžiausias numeris `origin/main` šakoje.
 * @returns {{ problems: string[], count: number }}
 */
export function checkMigrationFiles(files, context = {}) {
  const { addedFiles = null, mainMaxNumber = null } = context;
  const problems = [];
  const byNumber = new Map();

  for (const file of files) {
    const match = FILE_NAME_RE.exec(file);
    if (!match) {
      problems.push(
        `${file}: pavadinimas turi būti NNN_pavadinimas.sql (mažosios raidės, pabraukimai)`
      );
      continue;
    }
    const number = match[1];
    byNumber.set(number, [...(byNumber.get(number) ?? []), file]);
  }

  // 1) Dublikatai
  for (const [number, group] of [...byNumber.entries()].sort()) {
    const allowed = KNOWN_DUPLICATES[number] ?? 1;
    if (group.length > allowed) {
      problems.push(
        `numeris ${number}: ${group.length} failai (leidžiama ${allowed}) – ${group.join(", ")}`
      );
    }
  }

  // 2) Seka be tarpų (rezervuoti numeriai tarpu nelaikomi)
  const numbers = [...byNumber.keys()].map(Number).filter((n) => Number.isFinite(n));
  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  const missing = [];
  for (let n = 1; n <= max; n++) {
    const key = pad(n);
    if (!byNumber.has(key) && !RESERVED.includes(key)) missing.push(key);
  }
  if (missing.length > 0) {
    problems.push(
      `sekoje trūksta numerių: ${missing.join(", ")} (jei jie rezervuoti kitam PR – įrašykit į RESERVED)`
    );
  }

  // 3) Naujai pridėti failai turi eiti PO visko, kas jau sumerginta
  if (addedFiles && mainMaxNumber) {
    const expected = pad(Number(mainMaxNumber) + 1);
    for (const file of addedFiles) {
      const match = FILE_NAME_RE.exec(file);
      if (!match) continue; // formos klaida jau pranešta aukščiau
      const number = match[1];
      if (RESERVED.includes(number)) continue;
      if (Number(number) > Number(mainMaxNumber)) continue;
      problems.push(
        `${file}: numeris ${number} nėra didesnis už origin/main maksimumą (${mainMaxNumber}) – ` +
          `laukiamas numeris ${expected}`
      );
    }
  }

  return { problems, count: files.length };
}

function git(args) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

/** Failų vardai (be katalogo) iš git išvesties su pilnais keliais. */
function toFileNames(stdout) {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(MIGRATIONS_PREFIX) && line.endsWith(".sql"))
    .map((line) => line.slice(MIGRATIONS_PREFIX.length));
}

/**
 * PR kontekstas. Jei `origin/main` nepasiekiamas (lokaliai arba shallow clone
 * be jo), grąžinam `null` – tada lieka tik sekos patikra su įspėjimu.
 */
function readMainContext() {
  try {
    git(["rev-parse", "--verify", "--quiet", "origin/main"]);
  } catch {
    return null;
  }

  try {
    const mainFiles = toFileNames(
      git(["ls-tree", "-r", "--name-only", "origin/main", "--", "supabase/migrations"])
    );
    const mainNumbers = mainFiles
      .map((f) => FILE_NAME_RE.exec(f)?.[1])
      .filter(Boolean)
      .map(Number);
    if (mainNumbers.length === 0) return null;

    // Dviejų taškų diff'as – veikia ir shallow clone'e (nereikia merge-base)
    const addedFiles = toFileNames(
      git([
        "diff",
        "--name-only",
        "--diff-filter=A",
        "origin/main",
        "HEAD",
        "--",
        "supabase/migrations",
      ])
    );

    return { mainMaxNumber: pad(Math.max(...mainNumbers)), addedFiles };
  } catch {
    return null;
  }
}

function main() {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
    return;
  }

  let files;
  try {
    files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch (err) {
    console.error(`[check:migrations] Nepavyko nuskaityti ${MIGRATIONS_DIR}: ${err.message}`);
    process.exit(2);
  }

  const context = readMainContext();
  if (!context) {
    console.warn(
      "[check:migrations] `origin/main` nepasiekiamas – tikrinama tik numeracija repo viduje " +
        "(CI prieš šį žingsnį parsisiunčia main)."
    );
  }

  const { problems, count } = checkMigrationFiles(files, context ?? {});

  if (problems.length > 0) {
    console.error("[check:migrations] Migracijų numeracijos klaidos:\n");
    for (const p of problems) console.error(`  • ${p}`);
    console.error(
      "\nNaujai migracijai imkit didžiausią esamą numerį + 1. Esamų failų nepervadinkit – " +
        "jie jau pritaikyti duomenų bazei."
    );
    process.exit(1);
  }

  const reservedNote = RESERVED.length > 0 ? ` (rezervuota: ${RESERVED.join(", ")})` : "";
  console.log(`[check:migrations] ${count} migracijos, numeracija tvarkinga${reservedNote}.`);
}

/** Minimalūs atvejai su fiktyviu failų sąrašu – tie patys kaip tests/. */
function runSelfTest() {
  const cases = buildSelfTestCases();
  let failed = 0;
  for (const c of cases) {
    const { problems } = checkMigrationFiles(c.files, c.context);
    const ok = c.expectProblem
      ? problems.length > 0 &&
        (!c.expectMessage || problems.some((p) => p.includes(c.expectMessage)))
      : problems.length === 0;
    if (!ok) {
      failed++;
      console.error(`  ✗ ${c.name} – gauta: ${problems.join(" | ") || "(klaidų nėra)"}`);
    } else {
      console.log(`  ✓ ${c.name}`);
    }
  }
  if (failed > 0) {
    console.error(`[check:migrations] savitikra: ${failed} nesėkmingi atvejai`);
    process.exit(1);
  }
  console.log(`[check:migrations] savitikra: ${cases.length}/${cases.length} gerai`);
}

/** Fiktyvus 001..054 rinkinys (su istoriniais dublikatais ir rezervuotais tarpais). */
export function fakeMigrationFiles(maxNumber = 54) {
  const files = [];
  for (let n = 1; n <= maxNumber; n++) {
    const key = pad(n);
    if (RESERVED.includes(key)) continue;
    const copies = KNOWN_DUPLICATES[key] ?? 1;
    for (let i = 0; i < copies; i++) {
      files.push(`${key}_migracija_${i}.sql`);
    }
  }
  return files;
}

export function buildSelfTestCases() {
  const base = fakeMigrationFiles();
  return [
    {
      name: "tvarkingas rinkinys praeina",
      files: base,
      context: {},
      expectProblem: false,
    },
    {
      name: "naujas dublikatas – klaida",
      files: [...base, "044_dar_viena.sql"],
      context: {},
      expectProblem: true,
      expectMessage: "numeris 044: 2 failai",
    },
    {
      name: "nerezervuotas tarpas – klaida",
      files: base.filter((f) => !f.startsWith("030_")),
      context: {},
      expectProblem: true,
      expectMessage: "trūksta numerių: 030",
    },
    {
      name: "rezervuotas tarpas – praeina",
      files: base,
      context: { addedFiles: [], mainMaxNumber: "045" },
      expectProblem: false,
    },
    {
      name: "naujas 999, kai main maksimumas 054 – klaida",
      files: [...base, "999_per_toli.sql"],
      context: { addedFiles: ["999_per_toli.sql"], mainMaxNumber: "054" },
      expectProblem: true,
      expectMessage: "trūksta numerių: 055",
    },
    {
      name: "naujas 055, kai main maksimumas 054 – praeina",
      files: [...base, "055_kitas.sql"],
      context: { addedFiles: ["055_kitas.sql"], mainMaxNumber: "054" },
      expectProblem: false,
    },
    {
      name: "naujas mažesnis numeris už main maksimumą – klaida",
      files: base,
      context: { addedFiles: ["044_naujas.sql"], mainMaxNumber: "054" },
      expectProblem: true,
      expectMessage: "laukiamas numeris 055",
    },
    {
      name: "naujas rezervuotas numeris – praeina",
      files: [...base, "047_rezervuotas.sql"],
      context: { addedFiles: ["047_rezervuotas.sql"], mainMaxNumber: "054" },
      expectProblem: false,
    },
  ];
}

// Vykdoma tik paleidus tiesiogiai – testai importuoja gryną logiką
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
