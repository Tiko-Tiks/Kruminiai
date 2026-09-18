#!/usr/bin/env node
/**
 * Migracijų numeracijos patikra.
 *
 * `supabase/migrations/` failai taikomi numerio tvarka, todėl du to paties
 * numerio failai reiškia, kad atkuriant bazę iš repo eiliškumas priklauso nuo
 * abėcėlės, ne nuo to, kaip buvo taikyta gyvai. Istoriškai tokių porų yra
 * (žr. KNOWN_DUPLICATES) – jos paliekamos kaip yra, nes failai jau pritaikyti
 * ir pervadinimas nieko nebeištaisytų. Nauji dublikatai neleidžiami.
 *
 * Paleidimas: `npm run check:migrations` (taip pat vykdoma CI).
 */

import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "supabase",
  "migrations"
);

/**
 * Istoriniai dublikatai: numeris → kiek failų su juo leidžiama.
 * Šio sąrašo NEPILDOM – naujas įrašas reikštų, kad dublikatas praleistas.
 */
const KNOWN_DUPLICATES = {
  "020": 2,
  "021": 2,
  "028": 2,
};

const FILE_NAME_RE = /^(\d{3})_[a-z0-9_]+\.sql$/;

function main() {
  let files;
  try {
    files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  } catch (err) {
    console.error(`[check:migrations] Nepavyko nuskaityti ${MIGRATIONS_DIR}: ${err.message}`);
    process.exit(2);
  }

  const problems = [];
  const byNumber = new Map();

  for (const file of files) {
    const match = FILE_NAME_RE.exec(file);
    if (!match) {
      problems.push(`${file}: pavadinimas turi būti NNN_pavadinimas.sql (mažosios raidės, pabraukimai)`);
      continue;
    }
    const number = match[1];
    byNumber.set(number, [...(byNumber.get(number) ?? []), file]);
  }

  for (const [number, group] of [...byNumber.entries()].sort()) {
    const allowed = KNOWN_DUPLICATES[number] ?? 1;
    if (group.length > allowed) {
      problems.push(
        `numeris ${number}: ${group.length} failai (leidžiama ${allowed}) – ${group.join(", ")}`
      );
    }
  }

  if (problems.length > 0) {
    console.error("[check:migrations] Migracijų numeracijos klaidos:\n");
    for (const p of problems) console.error(`  • ${p}`);
    console.error(
      "\nNaujai migracijai imkit didžiausią esamą numerį + 1. Esamų failų nepervadinkit – " +
        "jie jau pritaikyti duomenų bazei."
    );
    process.exit(1);
  }

  console.log(`[check:migrations] ${files.length} migracijos, numeracija tvarkinga.`);
}

main();
