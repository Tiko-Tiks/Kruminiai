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

test('check-migrations: tikras git diff atmeta M ir R istorijos pakeitimus', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, renameSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const { readMainContext } = await import('../scripts/check-migrations.mjs');
  const root = mkdtempSync(join(tmpdir(), 'migration-guard-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  try {
    git('init'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
    mkdirSync(join(root, 'supabase/migrations'), { recursive: true });
    for (const file of fakeMigrationFiles()) writeFileSync(join(root, 'supabase/migrations', file), '-- original\n');
    git('add', '.'); git('commit', '-m', 'baseline'); git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    writeFileSync(join(root, 'supabase/migrations/030_migracija_0.sql'), '-- changed\n');
    renameSync(join(root, 'supabase/migrations/031_migracija_0.sql'), join(root, 'supabase/migrations/031_renamed.sql'));
    git('add', '-A'); git('commit', '-m', 'edit and rename');
    const context = readMainContext(root);
    assert.deepEqual(context.modifiedFiles, ['030_migracija_0.sql']);
    assert.deepEqual(context.deletedFiles, ['031_migracija_0.sql']);
    assert.deepEqual(context.addedFiles, ['031_renamed.sql']);
    const { problems } = checkMigrationFiles(fakeMigrationFiles(), context);
    assert.ok(problems.some(p => p.includes('nekeičiamos: 030_migracija_0.sql')));
    assert.ok(problems.some(p => p.includes('netrinami: 031_migracija_0.sql')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
