/**
 * `src/lib/document-access.ts` – balsavimo tokeno prieigos taisyklė.
 *
 * Esmė, kurią testas saugo: tokenas atrakina TIK to paties susirinkimo
 * dokumentus. Jei sąlyga taptų „yra tokenas – rodom", SMS nuorodos gavėjas
 * galėtų atsidaryti bet kurį neviešą bibliotekos dokumentą.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { documentBelongsToMeeting } from "../src/lib/document-access.ts";

const MEETING = "99d4ea03-0f38-430b-9dec-ddd9128ef82b";
const OTHER_MEETING = "11111111-2222-3333-4444-555555555555";

test("dokumentas, prikabintas tiesiai prie susirinkimo, praleidžiamas", () => {
  assert.equal(
    documentBelongsToMeeting({ meetingId: MEETING, resolutionMeetingIds: [] }, MEETING),
    true
  );
});

test("dokumentas, prikabintas per nutarimą, praleidžiamas", () => {
  assert.equal(
    documentBelongsToMeeting(
      { meetingId: null, resolutionMeetingIds: [OTHER_MEETING, MEETING] },
      MEETING
    ),
    true
  );
});

test("kito susirinkimo dokumentas neatrakinamas", () => {
  assert.equal(
    documentBelongsToMeeting({ meetingId: OTHER_MEETING, resolutionMeetingIds: [] }, MEETING),
    false
  );
  assert.equal(
    documentBelongsToMeeting(
      { meetingId: null, resolutionMeetingIds: [OTHER_MEETING] },
      MEETING
    ),
    false
  );
});

test("su jokiu susirinkimu nesusietas dokumentas neatrakinamas", () => {
  assert.equal(
    documentBelongsToMeeting({ meetingId: null, resolutionMeetingIds: [] }, MEETING),
    false
  );
});

test("be susirinkimo ID (netinkamas ar nebegaliojantis tokenas) – niekada", () => {
  for (const tokenMeeting of [null, undefined, ""]) {
    assert.equal(
      documentBelongsToMeeting(
        { meetingId: MEETING, resolutionMeetingIds: [MEETING] },
        tokenMeeting
      ),
      false,
      `turi būti atmesta: ${String(tokenMeeting)}`
    );
  }
});

test("tušti ryšiai nesutampa su tuščiu susirinkimo ID", () => {
  // Apsauga nuo „null === null" – abi pusės tuščios, bet leidimo nėra
  assert.equal(
    documentBelongsToMeeting({ meetingId: null, resolutionMeetingIds: [null] }, null),
    false
  );
});
