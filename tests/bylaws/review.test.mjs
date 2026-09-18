import test from 'node:test';
import assert from 'node:assert/strict';
import { actionHarness, votingFixture, form } from './helpers.mjs';

const meetingForm=type=>form({title:'Testinis',meeting_date:'2026-09-20',meeting_time:'12:00',location:'Testas',meeting_type:type});
test('Peržiūra: Tarybos posėdis nepaverčiamas Visuotiniu su sena narių baze',async()=>{
  const seed=votingFixture({totalMembers:6});seed.meetings[0].meeting_type='valdybos';
  const h=actionHarness('src/actions/meetings.ts',seed);
  assert.ok((await h.actions.updateMeeting('meeting',meetingForm('visuotinis'))).error);
  assert.equal(h.writes.length,0);
});
test('Peržiūra: to paties tipo susirinkimo vietą galima taisyti',async()=>{
  const h=actionHarness('src/actions/meetings.ts',votingFixture());
  assert.equal((await h.actions.updateMeeting('meeting',meetingForm('visuotinis'))).success,true);
});
test('Peržiūra: uždaryta ankstesnio susirinkimo darbotvarkė neperrašoma',async()=>{
  const seed=votingFixture();seed.meetings[0].status='baigtas';
  const h=actionHarness('src/actions/voting.ts',seed);
  assert.ok((await h.actions.updateResolution('resolution','meeting',{title:'Nauja tema'})).error);
  assert.equal(h.writes.length,0);
});
for(const status of ['patvirtintas','atmestas']) test(`Peržiūra: ${status} nutarimas neištrinamas`,async()=>{
  const seed=votingFixture();seed.resolutions[0].status=status;
  const h=actionHarness('src/actions/voting.ts',seed);
  assert.ok((await h.actions.deleteResolution('resolution','meeting')).error);
  assert.equal(h.writes.length,0);
});
for(const method of ['setResolutionResults','updateResolutionStatus']) test(`Peržiūra: esminis klausimas be pranešimo neatvirtinamas per ${method}`,async()=>{
  const seed=votingFixture({votes:Array(7).fill('uz')});seed.meeting_announcements=[];
  const h=actionHarness('src/actions/voting.ts',seed);
  const result=method==='setResolutionResults'
    ? await h.actions.setResolutionResults('resolution','meeting',{result_for:0,result_against:0,result_abstain:0},'patvirtintas')
    : await h.actions.updateResolutionStatus('resolution','patvirtintas','meeting');
  assert.match(result.error,/pranešimo/);assert.equal(h.writes.length,0);
});
const debtSeed=amounts=>({
  members:[{id:'member',first_name:'Testas',last_name:'Narys',status:'aktyvus',join_date:'2020-01-01'}],
  fee_periods:[{id:'fee',year:2021,fee_type:'metinis',amount_cents:1200,due_date:'2021-12-31'}],
  payments:amounts.map(amount_cents=>({member_id:'member',fee_period_id:'fee',amount_cents})),
  meeting_expulsions:[],resolutions:[],
});
for(const [amounts,outstanding] of [[[1],1199],[[500,699],1],[[600,600],0],[[1201],0]]) {
  test(`Peržiūra: kandidato skola po mokėjimų ${amounts} yra ${outstanding} ct`,async()=>{
    const h=actionHarness('src/actions/expulsions.ts',debtSeed(amounts));
    const {candidates}=await h.actions.getMeetingExpulsions('meeting');
    assert.equal(candidates.length,outstanding>0?1:0);
    if(outstanding) assert.equal(candidates[0].debt_cents,outstanding);
  });
}
test('Peržiūra: į kandidatų sąrašą įrašomas dalinai apmokėtos skolos likutis',async()=>{
  const h=actionHarness('src/actions/expulsions.ts',debtSeed([1]));
  assert.equal((await h.actions.addExpulsion('meeting','member')).success,true);
  assert.equal(h.tables.meeting_expulsions[0].debt_cents,1199);
});
test('Peržiūra: apmokėjęs visą mokestį neįtraukiamas į skolininkų sąrašą',async()=>{
  const h=actionHarness('src/actions/expulsions.ts',debtSeed([600,600]));
  assert.ok((await h.actions.addExpulsion('meeting','member')).error);
  assert.equal(h.writes.length,0);
});
test('Peržiūra: neperskaityti mokėjimai nesukuria tariamos skolos',async()=>{
  const h=actionHarness('src/actions/expulsions.ts',debtSeed([1200]),{errors:{'payments:select':'Test error'}});
  assert.ok((await h.actions.addExpulsion('meeting','member')).error);
  assert.equal(h.writes.length,0);
});
test('Peržiūra: esamo nario redagavimas negali ištrinti priėmimo pagrindo',async()=>{
  const h=actionHarness('src/actions/members.ts',{members:[{id:'member',status:'aktyvus',application_reference:'Prašymas',admission_reference:'Taryba 1',admission_date:'2020-01-01'}]});
  assert.ok((await h.actions.updateMember('member',form({first_name:'Testas',last_name:'Narys',join_date:'2020-01-01',email:'',status:'aktyvus',application_reference:'',admission_reference:'',admission_date:''}))).error);
  assert.equal(h.writes.length,0);
});
for(const locale of ['lt','en']) test(`Peržiūra: portalo paskyros laiškas neskelbia naujos narystės (${locale})`,async()=>{
  const h=actionHarness('src/actions/users.ts',{
    profiles:[{id:'test-admin',role:'admin',is_approved:true},{id:'profile',member_id:'member',is_approved:false}],
    members:[{id:'member',first_name:'Testas <Narys>',email:'test@example.invalid',language:locale,status:'aktyvus'}],
  });
  assert.equal((await h.actions.approveUser('profile')).success,true);
  assert.equal(h.notifications.length,1);
  const [,subject,html]=h.notifications[0];
  assert.match(subject,/paskyra aktyvuota|account is active/);
  assert.doesNotMatch(html,/narystė.*patvirtinta|membership.*confirmed|Sveiki tapę/);
  assert.match(html,/Testas &lt;Narys&gt;/);
  await h.actions.approveUser('profile');assert.equal(h.notifications.length,1);
});
