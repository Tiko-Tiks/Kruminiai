/**
 * Regresijos sargas serveryje generuojamiems dokumentams.
 *
 * Penki route'ai sudaro HTML sujungdami eilutes (`template literal`), todėl
 * automatinio kodavimo nėra: pamiršta `escapeHtml` reikštų, kad iš DB atėjęs
 * vardas ar pavadinimas taptų dokumento žymėmis. `tests/html-escape.test.mjs`
 * įrodo, kad kodavimo funkcijos veikia; šis testas tikrina, kad jos IŠ TIKRŲJŲ
 * uždėtos ant kiekvienos jautrios reikšmės.
 *
 * Kaip veikia: iš kiekvieno failo ištraukiami visi `${...}` intarpai
 * (skaičiuojant riestinių skliaustų poras, todėl įdėtiniai intarpai netrukdo).
 * Jei intarpo išraiškoje minimas bent vienas DB stulpelis iš `SENSITIVE_FIELDS`,
 * toje pačioje išraiškoje privalo būti ir kodavimo funkcijos kvietimas.
 *
 * Reikšmes, kurios užkoduotos anksčiau (pvz. `nameHtml`), pagal susitarimą
 * vadiname `...Html` galūne – tokios išraiškos DB stulpelių nebemini, todėl
 * sargo netrikdo.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Route'ai, kurie HTML dokumentą sudaro eilutėmis (ne per React). */
const DOCUMENT_ROUTES = [
  "src/app/api/protokolas/[id]/route.ts",
  "src/app/api/dalyviu-sarasas/[meeting_id]/route.ts",
  "src/app/api/veiklos-planai/[meeting_id]/route.ts",
  "src/app/api/salinami/[meeting_id]/route.ts",
  "src/app/api/rinkimai/[meeting_id]/route.ts",
];

/** DB laukai, kurių turinį rašo žmonės (nariai arba administratorius). */
const SENSITIVE_FIELDS = [
  "first_name",
  "last_name",
  "full_name",
  "title",
  "location",
  "description",
  "decision_text",
  "discussion_text",
  "notes",
  "reason",
  "message",
  "chairperson_name",
  "secretary_name",
  "protocol_number",
  "meeting_title",
  "debt_years",
  "file_name",
  "channel",
  "kind",
  "url",
];

const SENSITIVE_RE = new RegExp(`\\b(${SENSITIVE_FIELDS.join("|")})\\b`);
const ESCAPER_RE = /\b(escapeHtml|escapeAttr|safeUrl)\s*\(/;

/**
 * Ištraukia visų `${...}` intarpų išraiškas. Riba randama skaičiuojant `{` ir
 * `}` poras, todėl `${a ? `x${b}` : ""}` grąžinamas kaip viena išraiška.
 */
function extractInterpolations(source) {
  const found = [];
  for (let i = 0; i < source.length - 1; i++) {
    if (source[i] !== "$" || source[i + 1] !== "{") continue;
    let depth = 0;
    let end = -1;
    for (let j = i + 1; j < source.length; j++) {
      if (source[j] === "{") depth++;
      else if (source[j] === "}") {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end === -1) continue; // neužsidariusi – praleidžiam, ne testo reikalas
    found.push({
      expression: source.slice(i + 2, end),
      line: source.slice(0, i).split("\n").length,
    });
    i = end;
  }
  return found;
}

test("extractInterpolations randa ir įdėtinius intarpus", () => {
  const found = extractInterpolations("`<p>${a}</p><p>${b ? `x${c}` : \"\"}</p>`");
  assert.deepEqual(
    found.map((f) => f.expression),
    ["a", 'b ? `x${c}` : ""']
  );
});

for (const relPath of DOCUMENT_ROUTES) {
  const source = readFileSync(path.join(repoRoot, relPath), "utf8");

  test(`${relPath} importuoja kodavimo funkcijas`, () => {
    assert.match(
      source,
      /import\s*\{[^}]*escape(Html|Attr)[^}]*\}\s*from\s*"@\/lib\/html"/,
      "route'as turi importuoti kodavimą iš @/lib/html"
    );
  });

  test(`${relPath} koduoja visas jautrias DB reikšmes`, () => {
    const unescaped = extractInterpolations(source)
      .filter((i) => SENSITIVE_RE.test(i.expression) && !ESCAPER_RE.test(i.expression))
      .map((i) => `${relPath}:${i.line}  \${${i.expression}}`);

    assert.deepEqual(
      unescaped,
      [],
      "šie intarpai į HTML deda DB tekstą be kodavimo:\n" + unescaped.join("\n")
    );
  });
}

test("sargas pastebėtų neužkoduotą vardą", () => {
  // Kontrolinis pavyzdys: jei kas nors grąžintų seną, neužkoduotą variantą,
  // testas privalo kristi.
  const bad = extractInterpolations('`<td>${m.first_name} ${m.last_name}</td>`').filter(
    (i) => SENSITIVE_RE.test(i.expression) && !ESCAPER_RE.test(i.expression)
  );
  assert.equal(bad.length, 2);

  const good = extractInterpolations(
    '`<td>${escapeHtml(m.first_name)} ${escapeHtml(m.last_name)}</td>`'
  ).filter((i) => SENSITIVE_RE.test(i.expression) && !ESCAPER_RE.test(i.expression));
  assert.equal(good.length, 0);
});
