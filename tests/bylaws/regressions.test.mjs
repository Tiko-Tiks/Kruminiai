import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource, actionHarness, votingFixture, form } from './helpers.mjs';
const { decisionError, overdueMoreThanTwelveMonths } = loadSource('src/lib/bylaws.ts');
const { summarizeAnnouncements } = loadSource('src/lib/protocol-text.ts');
const decision = { participants: 10, totalMembers: 10, repeat: false, repeatValidated: false,
  qualified: true, council: false, for: 7, against: 0, abstain: 0, status: 'patvirtintas' };

for (const [name, changes] of [
  ['nevisi dalyviai balsavo: 6 iš 10 vis tiek per mažai', { for: 6 }],
  ['neigiami balsai', { against: -1 }],
  ['trupmeniniai balsai', { for: 7.5 }],
  ['balsų daugiau nei dalyvių', { for: 11 }],
  ['nulis dalyvių', { participants: 0, for: 0 }],
  ['paprasta dauguma be patvirtintos tvarkos', { qualified: false }],
  ['neteisėtas pakartotinio pagrindas', { repeat: true }],
  ['priimto nutarimo negalima pažymėti atmestu', { status: 'atmestas' }],
]) test(`Sprendimo apsauga: ${name}`, () => assert.ok(decisionError({ ...decision, ...changes })));

test('2/3 skaičiuojama nuo visų dalyvaujančių net kai dalis nebalsavo', () => assert.equal(decisionError(decision), null));
test('įrašyta paprastos daugumos tvarka atskiria abu vardiklius', () => {
  const ordinary = { ...decision, qualified: false, for: 4, against: 3, abstain: 3, majorityReference: 'Tvarka Nr. 1' };
  assert.equal(decisionError({ ...ordinary, majorityRule: 'for_against' }), null);
  assert.ok(decisionError({ ...ordinary, majorityRule: 'participants' }));
});
test('Tarybos posėdžio pirmininko balsas sprendžia lygybę tik Taryboje', () => {
  const tie = { ...decision, participants: 4, totalMembers: 6, qualified: false, for: 2, against: 2,
    majorityRule: 'for_against', majorityReference: 'Tvarka Nr. 1', chairVote: 'uz' };
  assert.equal(decisionError({ ...tie, council: true }), null);
  assert.ok(decisionError(tie));
});
for (const [type, days, expected] of [['neeilinis',7,true],['neeilinis',6,false],['visuotinis',13,false],['visuotinis',14,true],['valdybos',14,false]]) {
  test(`Pranešimo terminas: ${type}, ${days} dienos`, () => {
    const meeting = new Date('2026-03-20T10:00:00Z');
    const published_at = new Date(meeting.getTime() - days * 86400000).toISOString();
    assert.equal(summarizeAnnouncements([{ channel:'email', url:null, published_at }],meeting,type).compliant,expected);
  });
}
test('ankstyva SMS neuždengia per vėlyvo įstatuose numatyto kanalo', () => {
  assert.equal(summarizeAnnouncements([
    {channel:'sms',url:null,published_at:'2026-03-01T10:00:00Z'},
    {channel:'web',url:null,published_at:'2026-03-19T10:00:00Z'},
  ],new Date('2026-03-20T10:00:00Z')).compliant,false);
});
for (const [due,today,expected] of [['2025-09-18','2026-09-18',false],['2025-09-18','2026-09-19',true],[null,'2026-09-19',false],['2024-02-29','2025-02-28',false],['2024-02-29','2025-03-01',true]]) {
  test(`12 mėnesių riba ${due} → ${today}`, () => assert.equal(overdueMoreThanTwelveMonths(due,today),expected));
}
test('dokumentuotas Tarybos priėmimas leidžia įrašyti narį', async () => {
  const h = actionHarness('src/actions/members.ts', { members: [] });
  const result = await h.actions.createMember(form({ first_name:'Testas',last_name:'Vienas',email:'',join_date:'2026-01-10',status:'aktyvus',
    application_reference:'Prašymas Nr. 1',admission_reference:'Tarybos protokolas Nr. 2, 3 punktas',admission_date:'2026-01-10' }));
  assert.equal(result.success,true);
  assert.equal(h.tables.members[0].admission_reference,'Tarybos protokolas Nr. 2, 3 punktas');
});
test('redagavimas negali apeiti pakartotinio priėmimo pagrindo', async () => {
  const h = actionHarness('src/actions/members.ts',{members:[{id:'former',status:'išstojęs'}]});
  const result = await h.actions.updateMember('former',form({first_name:'Testas',last_name:'Vienas',email:'',join_date:'2026-01-10',status:'aktyvus'}));
  assert.ok(result.error); assert.equal(h.writes.length,0);
});
test('Visuotinio susirinkimo patvirtintas mokestis sukuriamas su pagrindu', async () => {
  const h=actionHarness('src/actions/payments.ts',{fee_periods:[]});
  const result=await h.actions.createFeePeriod(form({year:2027,name:'Metinis',amount_cents:1200,fee_type:'metinis',due_date:'2027-12-31',decision_reference:'Visuotinio protokolas Nr. 3, 2 punktas',decision_date:'2026-01-10'}));
  assert.equal(result.success,true); assert.equal(h.tables.fee_periods[0].decision_date,'2026-01-10');
});
test('nutarimo redagavimas nepraleidžia suklastoto statuso lauko',async()=>{
  const h=actionHarness('src/actions/voting.ts',votingFixture());
  assert.ok((await h.actions.updateResolution('resolution','meeting',{status:'patvirtintas'})).error);
  assert.equal(h.writes.length,0);
});
