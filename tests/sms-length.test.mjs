import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DECLARATION_RESPONSE_DAYS,
  declarationExpiryBounds,
  declarationReminderSmsText,
  declarationSmsText,
  minDeclarationExpiryDate,
  formatMeetingDateLong,
  formatMeetingDateTime,
  isCalendarDate,
  isGsm7,
  isValidMeetingDate,
  meetingTypeLabel,
  overdueDeclarationSmsText,
  smsSegments,
  toGsm7,
  votingReminderSmsText,
  votingSmsText,
} from "../src/lib/notification-texts.ts";

// 32 hex simboliai – toks pat ilgis kaip tikro balsavimo tokeno
const TOKEN = "0".repeat(32);
const URL = `https://kruminiai.lt/balsuoti/${TOKEN}`;

// Vasaros laikas (EEST, UTC+3) ir žiemos (EET, UTC+2) – patikrinam abu
const SUMMER_ISO = "2027-05-23T15:00:00Z"; // 18:00 Vilniuje
const WINTER_ISO = "2027-12-07T16:30:00Z"; // 18:30 Vilniuje

test("data verčiama į Europe/Vilnius laiką (vasara ir žiema)", () => {
  assert.equal(formatMeetingDateTime(SUMMER_ISO), "2027-05-23 18:00");
  assert.equal(formatMeetingDateTime(WINTER_ISO), "2027-12-07 18:30");
});

test("ilgas datos formatas abiem kalbomis", () => {
  assert.equal(formatMeetingDateLong(SUMMER_ISO, "lt"), "2027 m. gegužės 23 d.");
  assert.equal(formatMeetingDateLong(SUMMER_ISO, "en"), "23 May 2027");
  assert.equal(formatMeetingDateLong(WINTER_ISO, "lt"), "2027 m. gruodžio 7 d.");
});

test("netinkama data – aiški klaida, ne tylus „Invalid Date“", () => {
  assert.throws(() => formatMeetingDateTime("ne data"), RangeError);
  assert.equal(isValidMeetingDate("ne data"), false);
  assert.equal(isValidMeetingDate(null), false);
  assert.equal(isValidMeetingDate(SUMMER_ISO), true);
});

test("isCalendarDate atmeta kalendoriuje neegzistuojančias datas", () => {
  for (const ok of ["2026-01-01", "2026-12-31", "2028-02-29"]) {
    assert.equal(isCalendarDate(ok), true, `turėjo būti tinkama: ${ok}`);
  }
  // Formatą atitinka, bet Date jas „pataisytų" į kitą dieną arba grąžintų NaN
  for (const bad of [
    "2026-02-30",
    "2026-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-00-10",
    "2026-1-01",
    "2026/01/01",
    "rytoj",
    "",
  ]) {
    assert.equal(isCalendarDate(bad), false, `turėjo būti netinkama: ${bad}`);
  }
});

test("minDeclarationExpiryDate prideda žadamą atsakymo langą", () => {
  assert.equal(DECLARATION_RESPONSE_DAYS, 7);
  assert.equal(minDeclarationExpiryDate("2026-09-18"), "2026-09-25");
  // Mėnesio, metų ir keliamųjų metų riba
  assert.equal(minDeclarationExpiryDate("2026-09-30"), "2026-10-07");
  assert.equal(minDeclarationExpiryDate("2026-12-28"), "2027-01-04");
  assert.equal(minDeclarationExpiryDate("2028-02-25"), "2028-03-03");
  // Vasaros/žiemos laiko perjungimas (paros skaičiuojamos UTC, ne vietos laiku)
  assert.equal(minDeclarationExpiryDate("2027-03-25"), "2027-04-01");
  assert.equal(minDeclarationExpiryDate("2027-10-28"), "2027-11-04");
  assert.throws(() => minDeclarationExpiryDate("2026-02-30"), RangeError);
});

test("declarationExpiryBounds – ta pati riba formai ir serveriui", () => {
  const bounds = declarationExpiryBounds("2026-09-18");
  assert.equal(bounds.min, minDeclarationExpiryDate("2026-09-18"));
  assert.equal(bounds.min, "2026-09-25");
  assert.equal(bounds.default, "2026-10-02");
  assert.equal(bounds.responseDays, DECLARATION_RESPONSE_DAYS);
  // Numatytoji reikšmė visada tinka pagal minimumą
  assert.ok(bounds.default >= bounds.min);
});

test("susirinkimo tipo pavadinimas pagal meetings.meeting_type", () => {
  assert.equal(meetingTypeLabel("visuotinis", "lt"), "Visuotinis narių susirinkimas");
  assert.equal(meetingTypeLabel("valdybos", "en"), "Council meeting");
  assert.equal(meetingTypeLabel("nezinomas", "lt"), "Susirinkimas");
  assert.equal(meetingTypeLabel(null, "en"), "Meeting");
});

test("toGsm7 pašalina lietuviškas diakritikas ir tipografinius ženklus", () => {
  assert.equal(toGsm7("Šaunuolė – „ąčęėįųūž“"), 'Saunuole - "aceeiuuz"');
  assert.ok(isGsm7(toGsm7("Tarybos posėdis")));
  assert.equal(isGsm7("Tarybos posėdis"), false);
});

test("smsSegments skaičiuoja pagal koduotę", () => {
  assert.equal(smsSegments("a".repeat(160)), 1);
  assert.equal(smsSegments("a".repeat(161)), 2);
  assert.equal(smsSegments("ė".repeat(70)), 1); // UCS-2
  assert.equal(smsSegments("ė".repeat(71)), 2);
  assert.equal(smsSegments("€".repeat(80)), 1); // išplėstinis simbolis = 2 vienetai
});

const MEETING_TYPES = ["visuotinis", "neeilinis", "pakartotinis", "valdybos", "nezinomas"];
const LOCALES = ["lt", "en"];

test("balsavimo SMS telpa į vieną GSM-7 segmentą", () => {
  for (const meetingType of MEETING_TYPES) {
    for (const locale of LOCALES) {
      for (const meetingDateIso of [SUMMER_ISO, WINTER_ISO]) {
        for (const build of [votingSmsText, votingReminderSmsText]) {
          const text = build({ locale, meetingType, meetingDateIso, url: URL });
          assert.ok(isGsm7(text), `ne GSM-7: ${text}`);
          assert.ok(text.length <= 160, `per ilgas (${text.length}): ${text}`);
          assert.equal(smsSegments(text), 1, `daugiau nei 1 segmentas: ${text}`);
        }
      }
    }
  }
});

test("deklaracijos SMS telpa į vieną segmentą net su lietuvišku vardu", () => {
  const url = `https://kruminiai.lt/deklaracija/${TOKEN}`;
  // Vardas su diakritika anksčiau perjungdavo visą žinutę į UCS-2 (2 segmentai)
  for (const firstName of ["Aušra", "Ingrida", "Jurgita"]) {
    for (const locale of LOCALES) {
      const texts = [
        declarationSmsText({ locale, firstName, url }),
        declarationReminderSmsText({ locale, firstName, url }),
        overdueDeclarationSmsText({ locale, firstName, totalEur: "48.00", url }),
      ];
      for (const text of texts) {
        assert.ok(isGsm7(text), `ne GSM-7: ${text}`);
        assert.equal(smsSegments(text), 1, `daugiau nei 1 segmentas (${text.length}): ${text}`);
      }
    }
  }
  assert.ok(declarationSmsText({ locale: "lt", firstName: "Aušra", url }).includes("Ausra"));
});

test("SMS tekste yra tikroji susirinkimo data, ne įrašyta ranka", () => {
  const text = votingSmsText({
    locale: "lt",
    meetingType: "visuotinis",
    meetingDateIso: SUMMER_ISO,
    url: URL,
  });
  assert.ok(text.includes("2027-05-23 18:00"));
  assert.ok(text.includes(URL));
});
