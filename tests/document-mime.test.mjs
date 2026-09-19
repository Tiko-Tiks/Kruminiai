/**
 * `src/lib/document-mime.ts` testai.
 *
 * Esmė, kurią jie saugo: dokumentai atiduodami iš PROGRAMOS kilmės, todėl
 * įkeltas HTML ar SVG niekada neturi būti atiduotas `inline` su savo tikruoju
 * tipu – kitaip jame esantis skriptas vykdytųsi mūsų puslapio kontekste.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  documentUploadType,
  isAllowedDocumentMimeType,
  isInlineSafeMimeType,
  normalizeMimeType,
  resolveDocumentDelivery,
} from "../src/lib/document-mime.ts";

test("normalizeMimeType nuima parametrus ir didžiąsias raides", () => {
  assert.equal(normalizeMimeType("application/pdf"), "application/pdf");
  assert.equal(normalizeMimeType("application/pdf; charset=utf-8"), "application/pdf");
  assert.equal(normalizeMimeType("  Application/PDF ;charset=UTF-8"), "application/pdf");
  assert.equal(normalizeMimeType("TEXT/HTML"), "text/html");
  assert.equal(normalizeMimeType(""), "");
  assert.equal(normalizeMimeType(null), "");
  assert.equal(normalizeMimeType(undefined), "");
});

test("isInlineSafeMimeType praleidžia tik nevykdomus tipus", () => {
  assert.ok(isInlineSafeMimeType("application/pdf"));
  assert.ok(isInlineSafeMimeType("application/pdf; charset=utf-8"));
  assert.ok(isInlineSafeMimeType("image/png"));
  assert.ok(isInlineSafeMimeType("image/jpeg"));
  assert.ok(isInlineSafeMimeType("image/webp"));
  assert.ok(isInlineSafeMimeType("text/plain; charset=utf-8"));
});

test("isInlineSafeMimeType atmeta naršyklėje vykdomus tipus", () => {
  for (const type of [
    "text/html",
    "text/html; charset=utf-8",
    "application/xhtml+xml",
    "image/svg+xml",
    "text/xml",
    "application/xml",
    "text/javascript",
    "application/javascript",
    "",
    null,
    undefined,
    "nesamone",
  ]) {
    assert.equal(isInlineSafeMimeType(type), false, `turi būti atmestas: ${String(type)}`);
  }
});

test("isAllowedDocumentMimeType apima ir tik parsisiunčiamus tipus", () => {
  assert.ok(isAllowedDocumentMimeType("application/pdf"));
  assert.ok(isAllowedDocumentMimeType("application/msword"));
  assert.ok(
    isAllowedDocumentMimeType(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
  );
  assert.ok(isAllowedDocumentMimeType("application/vnd.oasis.opendocument.text"));
  assert.equal(isAllowedDocumentMimeType("text/html"), false);
  assert.equal(isAllowedDocumentMimeType("image/svg+xml"), false);
  assert.equal(isAllowedDocumentMimeType(""), false);
});

test("documentUploadType sprendžia pagal plėtinį, ne pagal paskelbtą tipą", () => {
  assert.equal(documentUploadType("ataskaita.pdf"), "application/pdf");
  assert.equal(documentUploadType("ATASKAITA.PDF"), "application/pdf");
  assert.equal(documentUploadType("nuotrauka.JPEG"), "image/jpeg");
  assert.equal(
    documentUploadType("protokolas.docx"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  assert.equal(documentUploadType("pastaba.txt"), "text/plain; charset=utf-8");
});

test("documentUploadType atmeta pavojingus ir neatpažintus plėtinius", () => {
  for (const name of [
    "puslapis.html",
    "puslapis.htm",
    "logotipas.svg",
    "duomenys.xml",
    "skriptas.js",
    "archyvas.zip",
    "programa.exe",
    "be-pletinio",
    ".gitignore",
    "",
  ]) {
    assert.equal(documentUploadType(name), null, `turi būti atmestas: ${name}`);
  }
});

test("ALLOWED_DOCUMENT_EXTENSIONS tinka klaidos tekstui ir neturi pavojingų", () => {
  assert.ok(ALLOWED_DOCUMENT_EXTENSIONS.includes(".pdf"));
  assert.ok(ALLOWED_DOCUMENT_EXTENSIONS.includes(".docx"));
  assert.equal(ALLOWED_DOCUMENT_EXTENSIONS.includes(".html"), false);
  assert.equal(ALLOWED_DOCUMENT_EXTENSIONS.includes(".svg"), false);
  // Surikiuota – klaidos tekstas nariui visada vienodas
  assert.deepEqual(
    [...ALLOWED_DOCUMENT_EXTENSIONS],
    [...ALLOWED_DOCUMENT_EXTENSIONS].sort()
  );
});

test("resolveDocumentDelivery saugius tipus atiduoda inline", () => {
  assert.deepEqual(resolveDocumentDelivery("ataskaita.pdf"), {
    contentType: "application/pdf",
    disposition: "inline",
  });
  assert.deepEqual(resolveDocumentDelivery("nuotrauka.png"), {
    contentType: "image/png",
    disposition: "inline",
  });
});

test("resolveDocumentDelivery biuro failus atiduoda tik parsisiuntimui", () => {
  assert.deepEqual(resolveDocumentDelivery("protokolas.odt"), {
    contentType: "application/vnd.oasis.opendocument.text",
    disposition: "attachment",
  });
});

test("resolveDocumentDelivery HTML ir SVG paverčia parsisiuntimu", () => {
  for (const name of ["puslapis.html", "logotipas.svg", "duomenys.xml", "be-pletinio"]) {
    assert.deepEqual(
      resolveDocumentDelivery(name),
      { contentType: "application/octet-stream", disposition: "attachment" },
      `turi būti atsisiunčiamas: ${name}`
    );
  }
});

test("resolveDocumentDelivery nepasitiki saugykloje įrašytu MIME tipu", () => {
  // Plėtinys žinomas – jis ir lemia, net jei saugykloje įrašyta text/html
  assert.deepEqual(resolveDocumentDelivery("ataskaita.pdf", "text/html"), {
    contentType: "application/pdf",
    disposition: "inline",
  });
  // Plėtinys nežinomas, o saugyklos tipas pavojingas – parsisiuntimas
  assert.deepEqual(resolveDocumentDelivery("failas", "text/html; charset=utf-8"), {
    contentType: "application/octet-stream",
    disposition: "attachment",
  });
  // Plėtinys nežinomas, saugyklos tipas leistinas ir nevykdomas
  assert.deepEqual(resolveDocumentDelivery("failas", "application/pdf"), {
    contentType: "application/pdf",
    disposition: "inline",
  });
});

test("resolveDocumentDelivery atsparus keliui ir tuščiam vardui", () => {
  assert.equal(resolveDocumentDelivery("aplankas/ataskaita.pdf").disposition, "inline");
  assert.equal(resolveDocumentDelivery("").disposition, "attachment");
});
