import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource, actionHarness } from './helpers.mjs';

const { suggestedQuorum, hasQuorum } = loadSource('src/lib/quorum.ts');
const { summarizeAnnouncements } = loadSource('src/lib/protocol-text.ts');
const { isVotingWindowOpen } = loadSource('src/lib/voting-window.ts');

for (const [type, total, expected] of [
  ['visuotinis', 20, 11], ['visuotinis', 21, 11], ['neeilinis', 20, 11],
  ['visuotinis', 1, 1], ['valdybos', 6, 4], ['pakartotinis', 20, 0],
]) {
  test(`KKB-16/17/23: ${type}, N=${total}, kvorumo riba=${expected}`, () => {
    assert.equal(suggestedQuorum(type, total), expected);
  });
}
for (const [present, needed, expected] of [[10, 11, false], [11, 11, true], [3, 4, false], [4, 4, true]]) {
  test(`4.5 / 5.5: ${present} dalyvių, reikia ${needed}`, () => assert.equal(hasQuorum(present, needed), expected));
}

const meetingDate = new Date('2026-01-20T16:00:00Z');
for (const [days, expected] of [[14, true], [13, false]]) {
  test(`KKB-14: eilinio susirinkimo ${days} dienų informavimo riba`, () => {
    const published_at = new Date(meetingDate.getTime() - days * 86400000).toISOString();
    assert.equal(summarizeAnnouncements([{ channel: 'web', url: null, published_at }], meetingDate).compliant, expected);
  });
}
test('KKB-14: be pranešimų nėra patvirtintos informavimo atitikties', () => {
  assert.equal(summarizeAnnouncements([], meetingDate).compliant, false);
});

const window = { status: 'planuojamas', meeting_date: '2026-01-20T16:00:00Z',
  early_voting_start: '2026-01-10T16:00:00Z', early_voting_end: '2026-01-19T16:00:00Z' };
for (const [description, data, now, expected] of [
  ['iki pradžios', window, '2026-01-09T16:00:00Z', false],
  ['lange', window, '2026-01-15T16:00:00Z', true],
  ['po pabaigos', window, '2026-01-19T16:00:01Z', false],
  ['susirinkimui prasidėjus', window, '2026-01-20T16:00:00Z', false],
  ['atšauktas', { ...window, status: 'atšauktas' }, '2026-01-15T16:00:00Z', false],
  ['baigtas', { ...window, status: 'baigtas' }, '2026-01-15T16:00:00Z', false],
]) {
  test(`KKB-15 saugumo regresija: balsavimo langas ${description}`, () => {
    assert.equal(isVotingWindowOpen(data, Date.parse(now)), expected);
  });
}

test('KKB-25: einantis pareigas Tarybos narys lieka sąraše po kadencijos datos', async () => {
  const h = actionHarness('src/actions/meetings.ts', { community_management: [{
    role: 'tarybos_narys', is_current: true, term_end: '2020-01-01', sort_order: 1,
    member: { id: 'council', first_name: 'Testas', last_name: 'Vienas', status: 'aktyvus' },
  }] });
  assert.equal((await h.actions.getEligibleAttendees('valdybos')).length, 1);
});

test('KKB-20: tas pats Pirmininkas / Tarybos narys neskaičiuojamas du kartus', async () => {
  const member = { id: 'council', first_name: 'Testas', last_name: 'Vienas', status: 'aktyvus' };
  const h = actionHarness('src/actions/meetings.ts', { community_management: [
    { role: 'pirmininkas', is_current: true, member }, { role: 'tarybos_narys', is_current: true, member },
  ] });
  assert.equal((await h.actions.getEligibleAttendees('valdybos')).length, 1);
});

test('KKB-10: pasyvus narys patenka į Visuotinio susirinkimo dalyvių sąrašą', async () => {
  const h = actionHarness('src/actions/meetings.ts', { members: [
    { id: 'passive', first_name: 'Testas', last_name: 'Vienas', status: 'pasyvus' },
    { id: 'former', first_name: 'Testas', last_name: 'Du', status: 'išstojęs' },
  ] });
  assert.deepEqual((await h.actions.getEligibleAttendees('visuotinis')).map(m => m.id), ['passive']);
});
