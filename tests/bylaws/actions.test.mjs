import test from 'node:test';
import assert from 'node:assert/strict';
import { actionHarness, votingFixture, form, loadSource, fakeDatabase } from './helpers.mjs';

// These assert the required behaviour, not today's bugs. Known failures remain
// ordinary failing tests (no skip, TODO, inverted assertion or expected-failure).
const votingFile = 'src/actions/voting.ts';

test('AUD-01 / 4.7: 6 iš 10 dalyvaujančių nepakanka įstatams pakeisti', async () => {
  const h = actionHarness(votingFile, votingFixture());
  const result = await h.actions.setResolutionResults('resolution', 'meeting',
    { result_for: 6, result_against: 0, result_abstain: 4 }, 'patvirtintas');
  assert.ok(result.error, 'Serveris turi atmesti patvirtinimą nesurinkus 2/3');
  assert.equal(h.writes.length, 0);
});

test('4.7: 7 iš 10 ir pakankamas kvorumas leidžia patvirtinti įstatų pakeitimą', async () => {
  const h = actionHarness(votingFile, votingFixture());
  const result = await h.actions.setResolutionResults('resolution', 'meeting',
    { result_for: 7, result_against: 1, result_abstain: 2 }, 'patvirtintas');
  assert.equal(result.success, true);
  assert.equal(h.tables.resolutions[0].result_for, 7);
});

test('AUD-01 / 4.7: tiesioginis statuso keitimas nepatvirtina nulio balsų', async () => {
  const h = actionHarness(votingFile, votingFixture());
  const result = await h.actions.updateResolutionStatus('resolution', 'patvirtintas', 'meeting');
  assert.ok(result.error, 'Nulis balsų negali virsti priimtu sprendimu');
  assert.equal(h.writes.length, 0);
});

test('AUD-01 / 4.4: balsų skaitymo klaida nestiprina sprendimo patvirtinimo', async () => {
  const h = actionHarness(votingFile, votingFixture(), { errors: { 'vote_ballots:select': 'test read failure' } });
  const result = await h.actions.setResolutionResults('resolution', 'meeting',
    { result_for: 10, result_against: 0, result_abstain: 0 }, 'patvirtintas');
  assert.ok(result.error, 'Nepavykus perskaityti balsų negalima tyliai prilyginti jų nuliui');
  assert.equal(h.writes.length, 0);
});

test('AUD-02 / 4.5: 10 iš 20 dalyvių neturi kvorumo sprendimui priimti', async () => {
  const h = actionHarness(votingFile, votingFixture({ totalMembers: 20, attendees: 10 }));
  const result = await h.actions.setResolutionResults('resolution', 'meeting',
    { result_for: 10, result_against: 0, result_abstain: 0 }, 'patvirtintas');
  assert.ok(result.error, 'Balsų dauguma nepakeičia kvorumo');
  assert.equal(h.writes.length, 0);
});

test('AUD-02 / 4.5: negalima sumažinti 20 narių pradinio kvorumo iki 10', async () => {
  const h = actionHarness('src/actions/meetings.ts', votingFixture({ totalMembers: 20 }));
  const result = await h.actions.updateMeetingQuorum('meeting', { total_members_at_time: 20, quorum_required: 10 });
  assert.ok(result.error, 'Istorinio narių skaičiaus korekcija neleidžia pakeisti įstatų formulės');
  assert.equal(h.writes.length, 0);
});

test('4.5: teisėta 20 narių / 11 kvorumo faktų korekcija išsaugoma', async () => {
  const h = actionHarness('src/actions/meetings.ts', votingFixture({ totalMembers: 20 }));
  const result = await h.actions.updateMeetingQuorum('meeting', { total_members_at_time: 20, quorum_required: 11 });
  assert.equal(result.success, true);
});

test('4.4: ne administratorius negali keisti kvorumo', async () => {
  const h = actionHarness('src/actions/meetings.ts', {
    ...votingFixture(), profiles: [{ id: 'test-admin', role: 'member' }],
  });
  assert.ok((await h.actions.updateMeetingQuorum('meeting', { total_members_at_time: 20, quorum_required: 11 })).error);
  assert.equal(h.writes.length, 0);
});

test('AUD-03 / 4.6: pakartotinio išimtis negalioja be ankstesnio susirinkimo pagrindo', async () => {
  const seed = votingFixture({ totalMembers: 20, attendees: 1, votes: ['uz'] });
  Object.assign(seed.meetings[0], { meeting_type: 'pakartotinis', is_repeat: true, quorum_required: 0 });
  // No predecessor and no inherited agenda: this is an ungrounded exception.
  const h = actionHarness(votingFile, seed);
  const result = await h.actions.updateResolutionStatus('resolution', 'patvirtintas', 'meeting');
  assert.ok(result.error, 'Vien tipo pakartotinis nepakanka 4.6 išimčiai');
  assert.equal(h.writes.length, 0);
});

test('AUD-04 / 5.1, 5.5, 6.2: Revizorius nepatenka į Tarybos balsuotojų sąrašą', async () => {
  const h = actionHarness('src/actions/meetings.ts', { community_management: [
    { role: 'tarybos_narys', is_current: true, member: { id: 'council', first_name: 'Testas', last_name: 'Vienas', status: 'aktyvus' } },
    { role: 'revizorius', is_current: true, member: { id: 'auditor', first_name: 'Testas', last_name: 'Du', status: 'aktyvus' } },
  ] });
  assert.deepEqual((await h.actions.getEligibleAttendees('valdybos')).map(m => m.id), ['council']);
});

test('AUD-05 / 3.2: naujas narys neaktyvuojamas be Tarybos sprendimo pagrindo', async () => {
  const h = actionHarness('src/actions/members.ts', { members: [] });
  const result = await h.actions.createMember(form({ first_name: 'Testas', last_name: 'Vienas',
    email: '', join_date: '2026-01-10', status: 'aktyvus' }));
  assert.ok(result.error, 'Naujam aktyviam nariui trūksta priėmimo sprendimo');
  assert.equal(h.writes.length, 0);
});

test('AUD-05 / 3.2: portalo paskyros patvirtinimas nepakeičia priėmimo į narius', async () => {
  const h = actionHarness('src/actions/users.ts', {
    profiles: [{ id: 'test-admin', role: 'admin', is_approved: true },
      { id: 'applicant', full_name: 'Testas Kandidatas', member_id: null, is_approved: false }],
    members: [],
  });
  await h.actions.approveUser('applicant');
  assert.equal(h.writes.filter(w => w.table === 'members' && w.operation === 'insert').length, 0,
    'Paskyros patvirtinimas neturi automatiškai sukurti aktyvaus nario');
});

test('AUD-06 / 3.7, 4.8.5: naujas mokesčio dydis reikalauja susirinkimo sprendimo', async () => {
  const h = actionHarness('src/actions/payments.ts', { fee_periods: [] });
  const result = await h.actions.createFeePeriod(form({ year: 2027, name: 'Testinis metinis mokestis',
    amount_cents: 1200, fee_type: 'metinis', due_date: '2027-12-31' }));
  assert.ok(result.error, 'Naujas mokestis neturi sprendimo pagrindo');
  assert.equal(h.writes.length, 0);
});

test('4.4: nutarimo patvirtinimui būtinas konkretus sprendimo tekstas', async () => {
  const seed = votingFixture();
  seed.resolutions[0].decision_text = '';
  const h = actionHarness(votingFile, seed);
  assert.ok((await h.actions.updateResolutionStatus('resolution', 'patvirtintas', 'meeting')).error);
  assert.equal(h.writes.length, 0);
});

for (const status of ['aktyvus', 'pasyvus', 'garbes_narys']) {
  test(`AUD-07 / 3.6: esamas ${status} narys pasiekia susirinkimų informaciją`, async () => {
    const db = fakeDatabase({ profiles: [{ id: 'test-admin', role: 'member', is_approved: true,
      member_id: 'member', members: { status } }] });
    const { middleware } = loadSource('src/middleware.ts', {
      '@supabase/ssr': { createServerClient: () => db.client },
      'next/server': { NextResponse: {
        next: () => ({ kind: 'next', cookies: { set() {} } }),
        redirect: url => ({ kind: 'redirect', url: String(url) }),
      } },
    });
    const nextUrl = new URL('https://test.invalid/susirinkimai');
    nextUrl.clone = () => new URL(nextUrl);
    const response = await middleware({ nextUrl, cookies: { getAll: () => [], set() {} } });
    assert.equal(response.kind, 'next', 'Narystės būsena pasyvus nėra pašalinimas iš bendruomenės');
  });
}
