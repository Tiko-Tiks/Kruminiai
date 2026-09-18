/**
 * `src/lib/document-access.ts` – balsavimo tokeno prieigos taisyklė.
 *
 * Esmė, kurią testas saugo: tokenas atrakina TIK to paties susirinkimo
 * darbotvarkės medžiagą – dokumentus, prikabintus prie jo NEPROCEDŪRINIŲ
 * nutarimų. Tiesioginis `documents.meeting_id` ryšys (po susirinkimo įkelti
 * pasirašyti dokumentai) ir procedūrinių klausimų priedai lieka už ribos, nes
 * jų balsuotojui nerodo ir pats balsavimo payload'as.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { documentBelongsToMeeting } from "../src/lib/document-access.ts";

const MEETING = "99d4ea03-0f38-430b-9dec-ddd9128ef82b";
const OTHER_MEETING = "11111111-2222-3333-4444-555555555555";

/** Ryšys su neprocedūriniu (balsuojamu) nutarimu. */
const votable = (meetingId) => ({ meetingId, isProcedural: false });
/** Ryšys su procedūriniu nutarimu – į balsavimo payload'ą neįeina. */
const procedural = (meetingId) => ({ meetingId, isProcedural: true });

test("neprocedūrinio nutarimo priedas atrakinamas", () => {
  assert.equal(
    documentBelongsToMeeting({ resolutions: [votable(MEETING)] }, MEETING),
    true
  );
});

test("randa ryšį ir tarp kelių nutarimų", () => {
  assert.equal(
    documentBelongsToMeeting(
      { resolutions: [procedural(MEETING), votable(OTHER_MEETING), votable(MEETING)] },
      MEETING
    ),
    true
  );
});

test("procedūrinio nutarimo priedas NEatrakinamas", () => {
  assert.equal(
    documentBelongsToMeeting({ resolutions: [procedural(MEETING)] }, MEETING),
    false
  );
});

test("tiesioginis priedas prie susirinkimo NEatrakinamas", () => {
  // Po susirinkimo įkelti pasirašyti dokumentai (migr. 025) prie nutarimų
  // nekabinami, todėl ryšių sąrašas tuščias – tokenas jų neatidaro.
  assert.equal(documentBelongsToMeeting({ resolutions: [] }, MEETING), false);
});

test("kito susirinkimo nutarimo priedas NEatrakinamas", () => {
  assert.equal(
    documentBelongsToMeeting({ resolutions: [votable(OTHER_MEETING)] }, MEETING),
    false
  );
});

test("be susirinkimo ID (nėra tokeno arba jis nebegalioja) – niekada", () => {
  for (const tokenMeeting of [null, undefined, ""]) {
    assert.equal(
      documentBelongsToMeeting({ resolutions: [votable(MEETING)] }, tokenMeeting),
      false,
      `turi būti atmesta: ${String(tokenMeeting)}`
    );
  }
});

test("neaiški `is_procedural` reikšmė neatrakina", () => {
  // Atkartoja SQL `is_procedural = FALSE`: NULL nėra FALSE.
  assert.equal(
    documentBelongsToMeeting(
      { resolutions: [{ meetingId: MEETING, isProcedural: null }] },
      MEETING
    ),
    false
  );
});

test("tušti ryšiai nesutampa su tuščiu susirinkimo ID", () => {
  assert.equal(
    documentBelongsToMeeting({ resolutions: [votable(null)] }, null),
    false
  );
});
