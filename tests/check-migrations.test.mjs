import { test } from "node:test";
import assert from "node:assert/strict";

import {
  KNOWN_DUPLICATES,
  RESERVED,
  buildSelfTestCases,
  checkMigrationFiles,
  fakeMigrationFiles,
} from "../scripts/check-migrations.mjs";

// Tie patys atvejai, kuriuos tikrina `node scripts/check-migrations.mjs --self-test`
for (const c of buildSelfTestCases()) {
  test(`check-migrations: ${c.name}`, () => {
    const { problems } = checkMigrationFiles(c.files, c.context);
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

test("check-migrations: netinkamas pavadinimas – klaida", () => {
  const { problems } = checkMigrationFiles([...fakeMigrationFiles(), "055-Blogas Vardas.sql"]);
  assert.ok(problems.some((p) => p.includes("NNN_pavadinimas.sql")));
});

test("check-migrations: istoriniai dublikatai lieka leidžiami", () => {
  const files = fakeMigrationFiles();
  for (const number of Object.keys(KNOWN_DUPLICATES)) {
    assert.equal(
      files.filter((f) => f.startsWith(`${number}_`)).length,
      KNOWN_DUPLICATES[number],
      `${number} turi turėti ${KNOWN_DUPLICATES[number]} failus`
    );
  }
  assert.deepEqual(checkMigrationFiles(files).problems, []);
});

test("check-migrations: istorinio dublikato failų skaičius tikrinamas tiksliai", () => {
  const files = fakeMigrationFiles();
  for (const number of Object.keys(KNOWN_DUPLICATES)) {
    // Ištrinta viena pora – likęs failas numerį išlaiko, bet dalis istorijos dingo
    const withoutOne = files.filter((f) => f !== `${number}_migracija_1.sql`);
    const { problems } = checkMigrationFiles(withoutOne);
    assert.ok(
      problems.some((p) => p.includes(`istorinis dublikatas ${number} turi turėti`)),
      `${number}: tikėtasi klaidos, gauta: ${problems.join(" | ")}`
    );
  }
});

test("check-migrations: migracijų trynimas PR'e – klaida", () => {
  const files = fakeMigrationFiles();
  const { problems } = checkMigrationFiles(files, {
    addedFiles: [],
    deletedFiles: ["031_kazkas.sql"],
    mainMaxNumber: "054",
  });
  assert.ok(problems.some((p) => p.includes("migracijų failai netrinami: 031_kazkas.sql")));
});

test("check-migrations: rezervuoti numeriai nesukuria tarpo", () => {
  const files = fakeMigrationFiles();
  for (const number of RESERVED) {
    assert.equal(
      files.some((f) => f.startsWith(`${number}_`)),
      false,
      `${number} neturi būti fiktyviame rinkinyje`
    );
  }
  assert.deepEqual(checkMigrationFiles(files).problems, []);
});
