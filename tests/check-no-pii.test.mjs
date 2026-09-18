import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_CONTACTS,
  buildSelfTestCases,
  checkFile,
  distinctEmails,
  distinctPhones,
  normalizeForPhoneScan,
} from "../scripts/check-no-pii.mjs";

// Tie patys atvejai, kuriuos tikrina `node scripts/check-no-pii.mjs --self-test`
for (const c of buildSelfTestCases()) {
  test(`check-pii: ${c.name}`, () => {
    const problems = checkFile(c.file, c.content);
    if (c.expectProblem) {
      assert.ok(problems.length > 0, `tikėtasi klaidos, gauta: ${problems.join(" | ")}`);
      if (c.expectMessage) {
        assert.ok(
          problems.some((p) => p.includes(c.expectMessage)),
          `tikėtasi pranešimo su „${c.expectMessage}", gauta: ${problems.join(" | ")}`
        );
      }
    } else {
      assert.deepEqual(problems, []);
    }
  });
}

test("check-pii: skirtukai tarp skaitmenų pašalinami, eilutės lūžis – ne", () => {
  assert.equal(normalizeForPhoneScan("+370 612 34567"), "+37061234567");
  assert.equal(normalizeForPhoneScan("8 612-34567"), "861234567");
  assert.equal(normalizeForPhoneScan("8 (612) 34.567"), "861234567");
  // Eilutės lūžis turi likti – kitaip du atskiri numeriai sulimptų į vieną seką
  assert.equal(normalizeForPhoneScan("861234567\n861234568"), "861234567\n861234568");
  // Kablelis irgi lieka (sumos ir sąrašų reikšmės)
  assert.equal(normalizeForPhoneScan("13 868,50"), "13868,50");
});

test("check-pii: atpažįstami visi `normalizePhone` priimami užrašymai", () => {
  const variants = ["+370 612 34567", "+37061234567", "37061234567", "8 612-34567", "861234567"];
  for (const v of variants) {
    assert.deepEqual(distinctPhones(v), ["37061234567"], `neatpažintas: ${v}`);
  }
  // Skirtingi numeriai skaičiuojami atskirai
  assert.equal(distinctPhones(["+370 612 34567", "8 612-34568"].join("\n")).length, 2);
});

test("check-pii: riba yra MAX_CONTACTS skirtingų kontaktų", () => {
  const phones = Array.from({ length: MAX_CONTACTS }, (_, i) => `+370 600 0000${i}`);
  assert.equal(distinctPhones(phones.join("\n")).length, MAX_CONTACTS);
  assert.ok(checkFile("sarasas.sql", phones.join("\n")).length > 0);
  assert.deepEqual(checkFile("sarasas.sql", phones.slice(0, MAX_CONTACTS - 1).join("\n")), []);
});

test("check-pii: el. paštai skaičiuojami be didžiųjų raidžių skirtumo", () => {
  assert.deepEqual(distinctEmails("Info@Kruminiai.LT info@kruminiai.lt"), ["info@kruminiai.lt"]);
});
