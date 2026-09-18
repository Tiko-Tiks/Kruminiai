import test from 'node:test';
import assert from 'node:assert/strict';
import { actionHarness, votingFixture, form, loadSource, noticePolicy } from './helpers.mjs';

const meetingForm=type=>form({title:'Testinis',meeting_date:'2026-09-20',meeting_time:'12:00',location:'Testas',meeting_type:type});
test('Peržiūra: būsimas priėmimo sprendimas nesukuria narystės',()=>{
  const {admissionEvidenceError}=loadSource('src/lib/bylaws.ts');
  assert.match(admissionEvidenceError({status:'aktyvus',application_reference:'Prašymas',admission_reference:'Taryba',admission_date:'2099-01-01'}),/data dar neatėjo/);
});
test('Peržiūra: būsimas mokesčio sprendimas nesukuria prievolės',async()=>{
  const h=actionHarness('src/actions/payments.ts',{fee_periods:[]});
  const result=await h.actions.createFeePeriod(form({year:2027,name:'Metinis',amount_cents:1200,fee_type:'metinis',decision_reference:'Visuotinio 1',decision_date:'2099-01-01'}));
  assert.ok(result.error);assert.equal(h.writes.length,0);
});
test('Peržiūra: reikalavimas po susirinkimo nepriimamas',async()=>{
  const h=actionHarness('src/actions/meetings.ts',{});const f=meetingForm('neeilinis');
  f.set('convening_kind','members');f.set('convening_date','2026-09-21');
  assert.ok((await h.actions.createMeeting(f)).error);assert.equal(h.writes.length,0);
});
test('Peržiūra: perrikiavimas negali dubliuoti užfiksuoto numerio',async()=>{
  const h=actionHarness('src/actions/voting.ts',{resolutions:[{id:'final',meeting_id:'meeting',status:'patvirtintas',resolution_number:1},{id:'draft',meeting_id:'meeting',status:'projektas',resolution_number:2}]});
  assert.match((await h.actions.reorderResolution('draft','meeting','up')).error,/numeracija užfiksuota/);assert.equal(h.writes.length,0);
});
test('Peržiūra: perrikiavimo RPC klaida nepateikiama kaip sėkmė',async()=>{
  const h=actionHarness('src/actions/voting.ts',{resolutions:[{id:'one',meeting_id:'meeting',status:'projektas'},{id:'two',meeting_id:'meeting',status:'projektas'}]},{rpc:{bylaws_reorder_resolutions:{error:{message:'Darbotvarkė pasikeitė'}}}});
  assert.match((await h.actions.reorderResolution('two','meeting','up')).error,/pasikeitė/);assert.equal(h.writes.length,0);
});
for(const error of [false,true]) test(`Peržiūra: pakartotinis paveldi priedus arba grąžina klaidą ${error}`,async()=>{
  const seed={members:[{id:'member',status:'aktyvus'}],meetings:[{id:'previous',status:'baigtas',meeting_type:'visuotinis',meeting_date:'2026-08-01',total_members_at_time:10}],meeting_attendance:[],resolutions:[{id:'source',meeting_id:'previous',title:'Įstatai',decision_type:'statutes'}],resolution_documents:[{resolution_id:'source',document_id:'original-document',sort_order:2}]};
  const h=actionHarness('src/actions/meetings.ts',seed,{errors:error?{'resolution_documents:insert':'Nepavyko įrašyti priedo'}:{}});
  const f=meetingForm('pakartotinis');f.set('previous_meeting_id','previous');
  const result=await h.actions.createMeeting(f);
  if(error) {assert.ok(result.error);assert.equal(h.tables.meetings.length,1);}
  else {assert.equal(result.success,true);assert.equal(h.tables.resolution_documents.at(-1).document_id,'original-document');assert.equal(h.tables.resolution_documents.at(-1).resolution_id,'test-resolutions-0');}
});
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

const {summarizeAnnouncements}=loadSource('src/lib/protocol-text.ts');
const {terminationEvidenceError}=loadSource('src/lib/bylaws.ts');
for(const [policy,expected] of [[undefined,false],[{repeat_notice_days:10},false],[{repeat_notice_days:10,repeat_notice_reference:'Patvirtinta tvarka'},true],[{repeat_notice_days:11,repeat_notice_reference:'Patvirtinta tvarka'},false]]) test(`Pakartotinio terminas taikomas tik pagal patvirtintą tvarką: ${JSON.stringify(policy)}`,()=>{
  assert.equal(summarizeAnnouncements([{channel:'web',url:null,published_at:'2026-09-10T12:00:00Z'}],new Date('2026-09-20T12:00:00Z'),'pakartotinis',{...noticePolicy,...policy}).compliant,expected);
});
test('Narystės pabaiga: raštiškas išstojimas nereikalauja Tarybos sprendimo',()=>{
  assert.equal(terminationEvidenceError({termination_kind:'withdrawal',termination_reference:'Nario prašymas',termination_date:'2026-09-18'}),null);
});
test('Narystės pabaiga: Tarybos pašalinimas turi nurodyti teisę skųsti',()=>{
  assert.ok(terminationEvidenceError({termination_kind:'expulsion',termination_reference:'Tarybos 2',termination_date:'2026-09-18',expulsion_ground:'3.4.2'}));
});
test('Serveris nenaudoja nepatvirtintos sukūrimo dienos bazės',async()=>{
  const seed=votingFixture({attendees:6});seed.members.push({id:'new1',status:'aktyvus'},{id:'new2',status:'aktyvus'});seed.meetings[0].electorate_snapshot=null;
  const h=actionHarness('src/actions/voting.ts',seed);
  assert.match((await h.actions.setResolutionResults('resolution','meeting',{result_for:6,result_against:0,result_abstain:0},'patvirtintas')).error,/užfiksuokite/);
  assert.equal(h.writes.length,0);
});

for(const [local,expected] of [['2026-09-04T18:00','2026-09-04T15:00:00.000Z'],['2026-01-04T18:00','2026-01-04T16:00:00.000Z']]) test(`Skelbimo Vilniaus laikas saugomas teisingai: ${local}`,async()=>{
  const h=actionHarness('src/actions/announcements.ts',{meeting_announcements:[]});
  assert.equal((await h.actions.createMeetingAnnouncement(form({meeting_id:'00000000-0000-4000-8000-000000000100',channel:'web',published_at:local,url:'',notes:''}))).success,true);
  assert.equal(h.tables.meeting_announcements[0].published_at,expected);
});
test('Skelbimas tiksliai prieš 14 dienų Vilniaus laiku priimamas',async()=>{
  const h=actionHarness('src/actions/announcements.ts',{meeting_announcements:[]});
  await h.actions.createMeetingAnnouncement(form({meeting_id:'00000000-0000-4000-8000-000000000100',channel:'web',published_at:'2026-09-04T18:00',url:'',notes:''}));
  const {vilniusLocalToIso}=loadSource('src/lib/utils.ts');
  assert.equal(summarizeAnnouncements(h.tables.meeting_announcements,new Date(vilniusLocalToIso('2026-09-18T18:00')),'visuotinis',noticePolicy).compliant,true);
});
test('Buvusio nario archyvavimas saugo tą patį įrašą',async()=>{
  const h=actionHarness('src/actions/members.ts',{members:[{id:'former',status:'išstojęs'}]});
  assert.equal((await h.actions.deleteMember('former')).success,true);
  assert.equal(h.tables.members.length,1);assert.ok(h.tables.members[0].archived_at);
  assert.equal(h.writes[0].operation,'update');
});

for(const type of ['statutes','transformation','liquidation']) test(`Taryba negali uždaryti Visuotinio kompetencijos sprendimo: ${type}`,async()=>{
  const seed=votingFixture({attendees:4,totalMembers:6});seed.meetings[0].meeting_type='valdybos';seed.resolutions[0].decision_type=type;
  const h=actionHarness('src/actions/voting.ts',seed);
  assert.match((await h.actions.setResolutionResults('resolution','meeting',{result_for:3,result_against:0,result_abstain:1},'patvirtintas')).error,/kompetencijai/);
  assert.equal(h.writes.length,0);
});
for(const date of ['2099-01-01T12:00Z',new Date().toISOString()]) test(`Rankinė bazė neįšaldoma prieš istorinį susirinkimą: ${date}`,async()=>{
  const seed=votingFixture();seed.meetings[0].meeting_date=date;
  const h=actionHarness('src/actions/meetings.ts',seed);
  assert.match((await h.actions.updateMeetingQuorum('meeting',{total_members_at_time:2,quorum_required:2,electorate_reference:'Tariamas išrašas'})).error,/istoriniam/);
  assert.equal(h.writes.length,0);
});
test('Dokumentuota istorinė bazė perduodama duomenų bazės patikrai',async()=>{
  const h=actionHarness('src/actions/meetings.ts',votingFixture());
  assert.equal((await h.actions.updateMeetingQuorum('meeting',{total_members_at_time:10,quorum_required:6,electorate_reference:'Registro išrašas 1',electorate_member_ids:[]})).success,true);
  assert.equal(h.tables.meetings[0].electorate_snapshot.reference,'Registro išrašas 1');
});
const ended={termination_kind:'expulsion',termination_reference:'Tarybos 2',termination_date:'2026-09-18',expulsion_ground:'3.4.2',appeal_reference:'Pranešimas apie skundą'};
for(const key of Object.keys(ended)) test(`Serveris išsaugo narystės pabaigos įrodymą: ${key}`,async()=>{
  const h=actionHarness('src/actions/members.ts',{members:[{id:'member',status:'išstojęs',...ended}]});
  assert.ok((await h.actions.updateMember('member',form({first_name:'Testas',last_name:'Narys',join_date:'2020-01-01',status:'išstojęs',...ended,[key]:''}))).error);
  assert.equal(h.writes.length,0);
});
const springMeeting=new Date('2026-04-05T15:00:00Z');
const springNotice=[{channel:'web',url:null,published_at:'2026-03-22T16:00:00Z'}];
for(const [rule,expected] of [['vilnius_calendar',true],['elapsed_hours',false]]) test(`Vasaros laiko riba laikosi įrašytos tvarkos: ${rule}`,()=>{
  assert.equal(summarizeAnnouncements(springNotice,springMeeting,'visuotinis',{...noticePolicy,notice_day_rule:rule}).compliant,expected);
});
test('Vasaros laiko riboje viena sekunde pavėluotas kalendorinis pranešimas atmetamas',()=>{
  assert.equal(summarizeAnnouncements([{...springNotice[0],published_at:'2026-03-22T16:00:01Z'}],springMeeting,'visuotinis',noticePolicy).compliant,false);
});
for(const missing of ['notice_channels','notice_reference','notice_day_rule','notice_day_reference']) test(`Be informavimo tvarkos įrodymo atitiktis nepatvirtinama: ${missing}`,()=>{
  assert.equal(summarizeAnnouncements(springNotice,springMeeting,'visuotinis',{...noticePolicy,[missing]:null}).compliant,false);
});
test('Ankstyvas nepaskirtas kanalas neatstoja Tarybos pasirinkto el. pašto',()=>{
  assert.equal(summarizeAnnouncements(springNotice,springMeeting,'visuotinis',{...noticePolicy,notice_channels:['email']}).compliant,false);
});
for(const email of [false,true]) test(`Visi Tarybos paskirti kanalai turi įrodymus: ${email}`,()=>{
  const list=email?[...springNotice,{...springNotice[0],channel:'email'}]:springNotice;
  assert.equal(summarizeAnnouncements(list,springMeeting,'visuotinis',{...noticePolicy,notice_channels:['web','email']}).compliant,email);
});
for(const type of ['council_election','council_removal','auditor_election','reports','fees','seat']) test(`Serveris saugo Visuotinio kompetenciją: ${type}`,async()=>{
  const seed=votingFixture({totalMembers:6,attendees:4});seed.meetings[0].meeting_type='valdybos';seed.resolutions[0].decision_type=type;
  const h=actionHarness('src/actions/voting.ts',seed);
  assert.match((await h.actions.setResolutionResults('resolution','meeting',{result_for:3,result_against:1,result_abstain:0},'patvirtintas')).error,/kompetencijai/);
  assert.equal(h.writes.length,0);
});
test('Serveris nepriima į sąrašą naujo, momentinėje kopijoje nesančio dalyvio',async()=>{
  const seed=votingFixture();seed.meeting_attendance[0].member_id='new-member';
  const h=actionHarness('src/actions/voting.ts',seed);
  assert.match((await h.actions.setResolutionResults('resolution','meeting',{result_for:7,result_against:0,result_abstain:0},'patvirtintas')).error,/sąrašui/);
});
test('Istorinio susirinkimo pasirinkimai išsaugo vėliau išstojusį narį',async()=>{
  const seed=votingFixture();seed.members[0].status='išstojęs';
  const h=actionHarness('src/actions/meetings.ts',seed);
  assert.equal((await h.actions.getEligibleAttendees('visuotinis','meeting')).length,10);
});
test('Serveris neatidaro užbaigto susirinkimo',async()=>{
  const seed=votingFixture();seed.meetings[0].status='baigtas';
  const h=actionHarness('src/actions/meetings.ts',seed);
  assert.match((await h.actions.updateMeetingStatus('meeting','vyksta')).error,/atidaryti negalima/);assert.equal(h.writes.length,0);
});
for(const method of ['attachDocumentToResolution','detachDocumentFromResolution','uploadAndAttachDocument']) test(`Serveris nekeičia galutinio nutarimo priedų: ${method}`,async()=>{
  const seed=votingFixture();seed.resolutions[0].status='patvirtintas';
  const h=actionHarness('src/actions/voting.ts',seed);
  const args=method==='uploadAndAttachDocument'?['resolution','meeting',new FormData()]:['resolution','document','meeting'];
  assert.match((await h.actions[method](...args)).error,/priedų keisti/);assert.equal(h.writes.length,0);
});
test('Serveris neatkuria narystės pagal buvusio laikotarpio dokumentus',async()=>{
  const evidence={application_reference:'Senas prašymas',admission_reference:'Sena Taryba',admission_date:'2020-01-01'};
  const h=actionHarness('src/actions/members.ts',{members:[{id:'member',status:'išstojęs',...ended,...evidence}]});
  const result=await h.actions.updateMember('member',form({first_name:'Testas',last_name:'Narys',join_date:'2020-01-01',status:'aktyvus',...ended,...evidence}));
  assert.match(result.error._form[0],/Pakartotiniam priėmimui/);assert.equal(h.writes.length,0);
});

test('Peržiūra: projekto pašalinimas nepakeičia likusių protokolo numerių',async()=>{
  const seed=votingFixture();seed.resolutions=[{id:'final',meeting_id:'meeting',status:'patvirtintas',resolution_number:1},{id:'draft',meeting_id:'meeting',status:'projektas',resolution_number:2},{id:'next',meeting_id:'meeting',status:'projektas',resolution_number:3}];
  const h=actionHarness('src/actions/voting.ts',seed);
  assert.equal((await h.actions.deleteResolution('draft','meeting')).success,true);
  assert.deepEqual(h.tables.resolutions.map(r=>r.resolution_number),[1,3]);
});

for(const amounts of [[500],[500,700],[500,800]]) test(`Peržiūra: įmokų ataskaita skiria dalinį ir pilną apmokėjimą ${amounts}`,async()=>{
  const h=actionHarness('src/actions/payments.ts',{members:[{id:'member',status:'aktyvus'}],fee_periods:[{id:'fee',amount_cents:1200}],payments:amounts.map(amount_cents=>({member_id:'member',fee_period_id:'fee',amount_cents}))});
  const result=await h.actions.getFeeReport('fee');
  assert.equal(result.paidCount,amounts.reduce((a,b)=>a+b,0)>=1200?1:0);
});
test('Peržiūra: dvi įmokos išsaugo atskirus kvitus',async()=>{
  const h=actionHarness('src/actions/payments.ts',{payments:[]});
  for(const amount of [500,700]) assert.equal((await h.actions.createPayment(form({member_id:'00000000-0000-4000-8000-000000000001',fee_period_id:'00000000-0000-4000-8000-000000000002',amount_cents:amount,paid_date:'2026-09-19',payment_method:'grynieji',receipt_number:`Kvitas-${amount}`}))).success,true);
  assert.equal(h.tables.payments.length,2);assert.deepEqual(h.tables.payments.map(p=>p.receipt_number),['Kvitas-500','Kvitas-700']);
});
for(const amounts of [[500],[500,700],[500,800]]) test(`Peržiūra: priminime lieka tik neapmokėta suma ${amounts}`,async()=>{
  const h=actionHarness('src/actions/reminders.ts',debtSeed(amounts));
  const {members}=await h.actions.getMembersWithDebts();
  const remaining=Math.max(0,1200-amounts.reduce((a,b)=>a+b,0));
  assert.equal(members.length,remaining?1:0);if(remaining) assert.equal(members[0].totalCents,remaining);
});
for(const locale of ['lt','en']) test(`Peržiūra: priminimo tekstas nežada automatinio pašalinimo ar priėmimo ${locale}`,async()=>{
  const seed=debtSeed([500]);Object.assign(seed.members[0],{first_name:'Testas',last_name:'Narys',language:locale,email:'test@example.invalid'});
  const h=actionHarness('src/actions/reminders.ts',seed);
  // sendEmail is an in-memory spy; all real network modules are blocked.
  await h.actions.sendOverdueReminders('email');
  assert.equal(h.notifications.length,1);
  const html=h.notifications[0][2];assert.match(html,/3\.4\.2/);assert.match(html,/7\.00/);assert.doesNotMatch(html,/būsite šalinami|20 EUR joining fee|clause 3\.5/);
});
