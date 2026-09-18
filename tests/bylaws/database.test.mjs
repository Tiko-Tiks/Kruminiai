import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = name => readFileSync(new URL(`../../supabase/migrations/${name}`,import.meta.url),'utf8');
const db = new PGlite();
// Real Postgres engine with actual repository schemas. Supabase-owned auth roles
// are stubbed locally; no production credentials, services, records or network.
await db.exec(`create role anon; create role authenticated; create schema auth;
  create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`);
for (const file of ['001_initial_schema.sql','002_voting_schema.sql','003_voting_tokens.sql','013_vote_comments_and_management.sql','024_meeting_announcements_and_doc_linkage.sql','026_procedural_type_pranesimas.sql','036_honorary_member_status.sql']) {
  await db.exec(migration(file));
}
await db.exec(migration('20260918185337_bylaws_enforcement.sql'));
await db.exec(`create trigger members_status_change_sync after update of status on members for each row execute function public.on_member_status_change();`);
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function setup({members=10,attendees=10,type='visuotinis',qualified=true,notice=true,started=true}={}) {
  // Each case rolls back; the migration is applied only once.
  await db.exec('begin');
  for(let i=1;i<=members;i++) await db.query(`insert into members(id,first_name,last_name,application_reference,admission_reference,admission_date) values ($1,'Testas','Narys','Prašymas 1','Tarybos 1','2026-01-01')`,[uuid(i)]);
  await db.query(`insert into meetings(id,title,meeting_date,location,meeting_type,total_members_at_time,quorum_required,status,majority_rule,majority_reference,chairperson_name)
    values ($1,'Testinis susirinkimas','2026-09-20 12:00Z','Testinė vieta',$2,$3,$4,'planuojamas','for_against','Patvirtinta tvarka Nr. 1','Testas Narys')`,[uuid(100),type,members,type==='pakartotinis'?0:Math.floor(members/2)+1]);
  if(type==='neeilinis') await db.exec(`update meetings set convening_kind='council',convening_reference='Tarybos protokolas 1'`);
  if(type==='pakartotinis') await db.exec(`update meetings set repeat_notice_days=14,repeat_notice_reference='Patvirtinta informavimo tvarka'`);
  if(notice) await db.query(`insert into meeting_announcements(meeting_id,channel,published_at) select id,'web',meeting_date-interval '14 days' from meetings where id=$1`,[uuid(100)]);
  if(type==='valdybos') for(let i=1;i<=members;i++) await db.query(`insert into community_management(member_id,role) values ($1,'tarybos_narys')`,[uuid(i)]);
  if(started) await db.exec("update meetings set status='vyksta'");
  for(let i=1;i<=attendees;i++) await db.query(`insert into meeting_attendance(meeting_id,member_id) values($1,$2)`,[uuid(100),uuid(i)]);
  await db.query(`insert into resolutions(id,meeting_id,title,decision_text,decision_type) values ($1,$2,'Įstatų projektas','Priimti pateiktą projektą',$3)`,[uuid(200),uuid(100),qualified?'statutes':'ordinary']);
}
async function finish(f,a=0,s=0,status='patvirtintas',snapshot={uz:0,pries:0,susilaike:0}) {
  return db.query(`update resolutions set result_for=$1,result_against=$2,result_abstain=$3,status=$4,ballot_snapshot=$5 where id=$6 returning participants_at_decision`,[f,a,s,status,JSON.stringify(snapshot),uuid(200)]);
}
function scenario(name,options,fn) {
  test(name,async()=>{ try { await setup(options); await fn(); } finally { await db.exec('rollback'); } });
}
scenario('DB: 6 iš 10 neatitinka 2/3 net kai kiti nebalsavo',{},async()=>assert.rejects(finish(6),/daugumos/));
scenario('DB: 7 iš 10 leidžiama ir išsaugomas dalyvių skaičius',{},async()=>assert.equal((await finish(7)).rows[0].participants_at_decision,10));
scenario('DB: pusė narių nėra kvorumas',{members:20,attendees:10},async()=>assert.rejects(finish(10),/kvorumo/));
scenario('DB: neigiamų balsų negalima paslėpti teigiamoje sumoje',{},async()=>assert.rejects(finish(7,-1,1),/Balsų/));
scenario('DB: naujas narys be Tarybos sprendimo atmetamas',{},async()=>assert.rejects(db.exec(`insert into members(first_name,last_name) values ('Testas','Be sprendimo')`),/Tarybos/));
scenario('DB: mokestis be Visuotinio sprendimo atmetamas',{},async()=>assert.rejects(db.exec(`insert into fee_periods(year,name,amount_cents) values(2027,'Testas',1200)`),/Visuotinio/));
scenario('DB: patvirtintas mokesčio pagrindas priimamas',{},async()=>db.exec(`insert into fee_periods(year,name,amount_cents,decision_reference,decision_date) values(2027,'Testas',1200,'Visuotinio Nr. 3','2026-01-01')`));
scenario('DB: kvorumo negalima sumažinti tiesiogine užklausa',{started:false},async()=>assert.rejects(db.exec(`update meetings set quorum_required=5`),/Kvorumas/));
scenario('DB: pakartotinio išimtis be ankstesnio susirinkimo atmetama',{type:'pakartotinis',attendees:1},async()=>assert.rejects(finish(1),/ankstesnio/));
scenario('DB: naujas balsas po rezultato perskaitymo neleidžia išsaugoti pasenusios sumos',{},async()=>{
  await db.query(`insert into vote_ballots(resolution_id,member_id,vote) values($1,$2,'uz')`,[uuid(200),uuid(1)]);
  await assert.rejects(finish(7),/pasikeitė/);
});
scenario('DB: vardinis balsas ir papildomi gyvi balsai negali dubliuoti dalyvių',{},async()=>{
  await db.query(`insert into vote_ballots(resolution_id,member_id,vote) values($1,$2,'uz')`,[uuid(200),uuid(1)]);
  await assert.rejects(finish(11,0,0,'patvirtintas',{uz:1,pries:0,susilaike:0}),/Balsų/);
});
scenario('DB: revizorius negali balsuoti Taryboje',{type:'valdybos',members:6,attendees:4},async()=>{
  await db.query(`update community_management set role='revizorius' where member_id=$1`,[uuid(6)]);
  await assert.rejects(db.query(`insert into vote_ballots(resolution_id,member_id,vote) values($1,$2,'uz')`,[uuid(200),uuid(6)]),/Tarybos/);
});
scenario('DB: galutinis nutarimas nebeleidžia pridėti balso',{},async()=>{
  await finish(7);
  await assert.rejects(db.query(`insert into vote_ballots(resolution_id,member_id,vote) values($1,$2,'uz')`,[uuid(200),uuid(1)]),/uždarytas/);
});
scenario('DB: sprendimo suvestinės negalima perrašyti po patvirtinimo',{},async()=>{
  await finish(7); await assert.rejects(db.exec(`update resolutions set result_for=1`),/užfiksuotas/);
});
scenario('DB: Tarybos balsų lygybę lemia įskaičiuotas posėdžio pirmininko balsas',{members:6,attendees:4,type:'valdybos',qualified:false},async()=>{
  await db.query(`update meetings set chairperson_member_id=$1`,[uuid(1)]);
  for(let i=1;i<=4;i++) await db.query(`insert into vote_ballots(resolution_id,member_id,vote) values($1,$2,$3)`,[uuid(200),uuid(i),i<=2?'uz':'pries']);
  await db.exec(`update resolutions set chair_vote='uz'`); await finish(2,2,0,'patvirtintas',{uz:2,pries:2,susilaike:0});
});
scenario('DB: pakartotinis tik su paveldėtu klausimu po nesurinkto kvorumo',{members:20,attendees:10},async()=>{
  await db.exec(`update meetings set status='baigtas',meeting_date='2026-09-19 12:00Z'`);
  await db.query(`insert into meetings(id,title,meeting_date,location,meeting_type,status,total_members_at_time,quorum_required,previous_meeting_id) values($1,'Pakartotinis','2026-09-21 12:00Z','Testas','pakartotinis','vyksta',20,0,$2)`,[uuid(101),uuid(100)]);
  await db.query(`update meetings set repeat_notice_days=14,repeat_notice_reference='Patvirtinta tvarka' where id=$1`,[uuid(101)]);
  await db.query(`insert into meeting_announcements(meeting_id,channel,published_at) values($1,'web','2026-09-01 12:00Z')`,[uuid(101)]);
  await db.query(`insert into resolutions(id,meeting_id,title,decision_text,decision_type,source_resolution_id) values($1,$2,'Įstatų projektas','Priimti','statutes',$3)`,[uuid(201),uuid(101),uuid(200)]);
  await db.query(`insert into meeting_attendance(meeting_id,member_id) values($1,$2)`,[uuid(101),uuid(1)]);
  await db.query(`update resolutions set status='patvirtintas',result_for=1,ballot_snapshot='{"uz":0,"pries":0,"susilaike":0}' where id=$1`,[uuid(201)]);
});
scenario('DB: vėlesnis dalyvavimo taisymas neperrašo priimto sprendimo vardiklio',{},async()=>{
  await finish(7); await db.query(`delete from meeting_attendance where member_id=$1`,[uuid(10)]);
  assert.equal((await db.exec(`select participants_at_decision from resolutions`))[0].rows[0].participants_at_decision,10);
});
scenario('DB: išstojimas išsaugo galutinį sprendimą ir neužstringa dėl istorinio balso',{},async()=>{
  await db.exec(`update meetings set meeting_date=now()+interval '10 days'`);
  await db.query(`insert into vote_ballots(resolution_id,member_id,vote) values($1,$2,'uz')`,[uuid(200),uuid(1)]);
  await db.query(`update meeting_attendance set attendance_type='nuotolinis' where member_id=$1`,[uuid(1)]);
  await db.exec(`update vote_ballots set vote_type='isankstinis'`);
  await finish(7,0,0,'patvirtintas',{uz:1,pries:0,susilaike:0});
  await db.query(`update members set status='išstojęs',termination_kind='withdrawal',termination_reference='Raštiškas prašymas 1',termination_date='2026-09-18' where id=$1`,[uuid(1)]);
  assert.equal((await db.exec(`select count(*)::integer as n from vote_ballots`))[0].rows[0].n,1);
  assert.equal((await db.exec(`select participants_at_decision from resolutions`))[0].rows[0].participants_at_decision,10);
});
scenario('DB: prisijungusio administratoriaus rolė neapeina įstatų tikrinimo',{},async()=>{
  await db.exec(`grant select,insert,update on all tables in schema public to authenticated; set local role authenticated;`);
  await assert.rejects(db.exec(`insert into members(first_name,last_name) values('Testas','Be pagrindo')`),/Tarybos/);
});
scenario('DB: neeiliniam pranešimui pakanka septynių dienų',{type:'neeilinis',qualified:false,notice:false},async()=>{
  await db.exec(`update resolutions set procedural_type='pranesimas'; insert into meeting_announcements(meeting_id,channel,published_at) select id,'web',meeting_date-interval '7 days' from meetings`);
  await finish(7);
});
scenario('DB: vien ankstyvos SMS nepakanka patvirtinti pranešimo',{qualified:false,notice:false},async()=>{
  await db.exec(`update resolutions set procedural_type='pranesimas'; insert into meeting_announcements(meeting_id,channel,published_at) select id,'sms',meeting_date-interval '20 days' from meetings`);
  await assert.rejects(finish(7),/pranešimo/);
});
scenario('DB: netekęs Tarybos pareigų dalyvis nebesuteikia kvorumo kitam sprendimui',{members:6,attendees:4,type:'valdybos'},async()=>{
  await db.query(`update community_management set is_current=false where member_id=$1`,[uuid(1)]);
  await assert.rejects(finish(4),/balso teisės/);
});
scenario('DB: neužregistruoto dalyvio balso negalima paslėpti bendroje sumoje',{members:10,attendees:6},async()=>{
  await db.query(`insert into vote_ballots(resolution_id,member_id,vote) values($1,$2,'uz')`,[uuid(200),uuid(10)]);
  await assert.rejects(finish(5,0,0,'patvirtintas',{uz:1,pries:0,susilaike:0}),/neįregistruotas/);
});
scenario('DB: įregistruoto priėmimo pagrindo negalima ištrinti redaguojant',{},async()=>{
  await assert.rejects(db.query(`update members set admission_reference='' where id=$1`,[uuid(1)]),/pagrindo ištrinti/);
});
scenario('DB: kontaktų taisymas išsaugo priėmimo pagrindą',{},async()=>{
  await db.query(`update members set phone='TEST-NUMBER' where id=$1`,[uuid(1)]);
  assert.equal((await db.query(`select admission_reference from members where id=$1`,[uuid(1)])).rows[0].admission_reference,'Tarybos 1');
});
scenario('DB: Tarybos posėdis negali tapti Visuotiniu su sena kvorumo baze',{members:6,attendees:4,type:'valdybos'},async()=>{
  await assert.rejects(db.exec(`update meetings set meeting_type='visuotinis'`),/tipo keisti/);
});
for (const statement of ["update resolutions set title='Naujas klausimas'", "delete from resolutions", "insert into resolutions(meeting_id,title) select id,'Naujas klausimas' from meetings"]) {
  scenario(`DB: uždaryto susirinkimo darbotvarkė nekinta: ${statement}`,{members:20,attendees:10},async()=>{
    await db.exec(`update meetings set status='baigtas'`);
    await assert.rejects(db.exec(statement),/darbotvarkės/);
  });
}
for (const target of ['resolutions','meetings']) {
  scenario(`DB: galutinis nutarimas išlieka trinant ${target}`,{},async()=>{
    await finish(7); await assert.rejects(db.exec(`delete from ${target}`),/nutarimo ištrinti/);
  });
}
scenario('DB: nenaudotą neuždarytą projektą galima ištrinti',{},async()=>{
  await db.exec('delete from resolutions');
  assert.equal((await db.query('select count(*)::integer as n from resolutions')).rows[0].n,0);
});
for (const [type,days] of [['visuotinis',13],['neeilinis',6]]) {
  scenario(`DB: esminis klausimas reikalauja laiku paskelbto pranešimo: ${type}`,{type,notice:false},async()=>{
    await db.query(`insert into meeting_announcements(meeting_id,channel,published_at) select id,'web',meeting_date-make_interval(days=>$1) from meetings`,[days]);
    await assert.rejects(finish(7),/pranešimo/);
  });
}
scenario('DB: pranešimo įrodymai išsaugomi prie priimto sprendimo',{},async()=>{
  await finish(7); await db.exec('delete from meeting_announcements');
  assert.equal((await db.query("select decision_basis->'notice'->>'channel' as channel from resolutions")).rows[0].channel,'web');
});
scenario('DB: užbaigto susirinkimo dalyviai taisomi su auditu, sprendimo vardiklis nekinta',{},async()=>{
  await finish(7); await db.exec("update meetings set status='baigtas'");
  await db.query('delete from meeting_attendance where member_id=$1',[uuid(10)]);
  assert.equal((await db.query('select participants_at_decision from resolutions')).rows[0].participants_at_decision,10);
  assert.equal((await db.query("select count(*)::int as n from audit_log where new_data->>'reason'='post_meeting_attendance_correction'")).rows[0].n,1);
});
for(const change of ["discussion_text='Perrašyta'","resolution_number=99","is_procedural=true","procedural_type='darbotvarke'",`ballot_snapshot='{}'::jsonb`]) {
  scenario(`DB: užfiksuotas protokolo laukas nekinta: ${change}`,{},async()=>{
    await finish(7);await assert.rejects(db.exec(`update resolutions set ${change}`),/užfiksuotas/);
  });
}
for(const noticeDays of [null,10]) scenario(`DB: pakartotinis po 10 dienų tik pagal patvirtintą terminą ${noticeDays}`,{members:20,attendees:10},async()=>{
  await db.exec("update meetings set status='baigtas',meeting_date='2026-09-19 12:00Z'");
  await db.query("insert into meetings(id,title,meeting_date,location,meeting_type,status,total_members_at_time,quorum_required,previous_meeting_id,repeat_notice_days,repeat_notice_reference) values($1,'Pakartotinis','2026-09-21 12:00Z','Testas','pakartotinis','vyksta',20,0,$2,$3,$4)",[uuid(101),uuid(100),noticeDays,noticeDays===null?null:'Patvirtinta 10 dienų tvarka']);
  await db.query("insert into meeting_announcements(meeting_id,channel,published_at) values($1,'web','2026-09-11 12:00Z')",[uuid(101)]);
  await db.query("insert into resolutions(id,meeting_id,title,decision_text,decision_type,source_resolution_id) values($1,$2,'Įstatų projektas','Priimti','statutes',$3)",[uuid(201),uuid(101),uuid(200)]);
  await db.query('insert into meeting_attendance(meeting_id,member_id) values($1,$2)',[uuid(101),uuid(1)]);
  const close=()=>db.query(`update resolutions set status='patvirtintas',result_for=1,ballot_snapshot='{"uz":0,"pries":0,"susilaike":0}' where id=$1`,[uuid(201)]);
  if(noticeDays===null) await assert.rejects(close(),/informavimo termino/); else await close();
});
for(const decisionType of ['statutes','transformation','liquidation']) scenario(`DB: ${decisionType} privalomai reikalauja 2/3 net su išjungta žyma`,{qualified:false},async()=>{
  await db.query('update resolutions set decision_type=$1,requires_qualified_majority=false',[decisionType]);
  assert.equal((await db.query('select requires_qualified_majority as q from resolutions')).rows[0].q,true);
  await assert.rejects(finish(6,0,4),/daugumos/);
});
scenario('DB: nežinomos sprendimo rūšies negalima uždaryti',{},async()=>{
  await db.exec('update resolutions set decision_type=null');await assert.rejects(finish(7),/sprendimo rūšį/);
});
scenario('DB: pirmininko vardas nepakeičia tikro jo balso',{members:6,attendees:4,type:'valdybos',qualified:false},async()=>{
  await db.query('update meetings set chairperson_member_id=$1',[uuid(1)]);
  for(let i=1;i<=4;i++) await db.query('insert into vote_ballots(resolution_id,member_id,vote) values($1,$2,$3)',[uuid(200),uuid(i),i<=2?'pries':'uz']);
  await db.exec("update resolutions set chair_vote='uz'");
  await assert.rejects(finish(2,2,0,'patvirtintas',{uz:2,pries:2,susilaike:0}),/pirmininko vardinis/);
});
for(const [existing,added] of [['revizorius','tarybos_narys'],['pirmininkas','revizorius']]) scenario(`DB: nesuderinamos pareigos ${existing} ir ${added}`,{},async()=>{
  await db.query('insert into community_management(member_id,role) values($1,$2)',[uuid(1),existing]);
  await assert.rejects(db.query('insert into community_management(member_id,role) values($1,$2)',[uuid(1),added]),/Revizorius/);
});
scenario('DB: pasibaigusios revizoriaus pareigos netrukdo teisėtam naujam paskyrimui',{},async()=>{
  await db.query("insert into community_management(member_id,role,is_current) values($1,'revizorius',false)",[uuid(1)]);
  await db.query("insert into community_management(member_id,role) values($1,'tarybos_narys')",[uuid(1)]);
});
scenario('DB: neeilinio neleidžiama uždaryti be sušaukimo pagrindo',{type:'neeilinis'},async()=>{
  await db.exec('update meetings set convening_kind=null,convening_reference=null');await assert.rejects(finish(7),/Neeiliniam/);
});
for(const requesters of [[1],[1,1],[1,2]]) scenario(`DB: 1/5 reikalavimo kelias be papildomo Tarybos sprendimo (${requesters})`,{type:'neeilinis'},async()=>{
  const register=()=>db.query("update meetings set convening_kind='members',convening_reference='Narių raštiškas reikalavimas ir registro išrašas',convening_date='2026-09-17',convening_total_members=10,convening_requesters=$1",[requesters.map(uuid)]);
  if(new Set(requesters).size===2) { await register(); await finish(7); } else await assert.rejects(register(),/1\/5/);
});
scenario('DB: narystės neleidžiama nutraukti vien statusu',{},async()=>{
  await assert.rejects(db.query("update members set status='išstojęs' where id=$1",[uuid(1)]),/pabaigos/);
});
scenario('DB: savanoriškam išstojimui nereikia Tarybos leidimo',{},async()=>{
  await db.query("update members set status='išstojęs',termination_kind='withdrawal',termination_reference='Nario raštiškas prašymas',termination_date='2026-09-18' where id=$1",[uuid(1)]);
  assert.equal((await db.query('select status from members where id=$1',[uuid(1)])).rows[0].status,'išstojęs');
});
scenario('DB: pašalinimui būtinas skundo teisės pranešimo įrodymas',{},async()=>{
  await assert.rejects(db.query("update members set status='išstojęs',termination_kind='expulsion',termination_reference='Tarybos 2',termination_date='2026-09-18',expulsion_ground='3.4.2' where id=$1",[uuid(1)]),/teisę skųsti/);
});
scenario('DB: dokumentuotas pašalinimas su pagrindu ir skundo teisės pranešimu priimamas',{},async()=>{
  await db.query("update members set status='išstojęs',termination_kind='expulsion',termination_reference='Tarybos 2',termination_date='2026-09-18',expulsion_ground='3.4.2',appeal_reference='Pranešimas nariui Nr. 3: skundas artimiausiam Visuotiniam' where id=$1",[uuid(1)]);
});
scenario('DB: gyvų balsų suvestinė negali dubliuoti vardinio fizinio balso',{},async()=>{
  await db.query("insert into vote_ballots(resolution_id,member_id,vote,vote_type) values($1,$2,'uz','fizinis')",[uuid(200),uuid(1)]);
  await assert.rejects(finish(7,0,0,'patvirtintas',{uz:1,pries:0,susilaike:0}),/maišyti/);
});
scenario('DB: po dviejų naujų priėmimų prieš pradžią šeši iš dvylikos neturi kvorumo',{attendees:6,started:false},async()=>{
  for(let i=11;i<=12;i++) await db.query("insert into members(id,first_name,last_name,application_reference,admission_reference,admission_date) values($1,'Testas','Naujas','Prašymas','Taryba','2026-09-18')",[uuid(i)]);
  await db.exec("update meetings set status='vyksta'");
  await assert.rejects(finish(6),/kvorumo/);
});
scenario('DB: uždarant neįvykusį susirinkimą išsaugoma pradžioje buvusi narių bazė',{attendees:6,started:false},async()=>{
  for(let i=11;i<=12;i++) await db.query("insert into members(id,first_name,last_name,application_reference,admission_reference,admission_date) values($1,'Testas','Naujas','Prašymas','Taryba','2026-09-18')",[uuid(i)]);
  await db.exec("update meetings set status='vyksta'");
  await db.exec("update meetings set status='baigtas'");
  assert.equal((await db.query('select total_members_at_time as n from meetings')).rows[0].n,12);
});
scenario('DB: penki iš dešimties lieka be kvorumo po dviejų vėlesnių išstojimų',{attendees:5},async()=>{
  for(const id of [9,10]) await db.query("update members set status='išstojęs',termination_kind='withdrawal',termination_reference='Raštiškas prašymas',termination_date='2026-09-18' where id=$1",[uuid(id)]);
  await db.exec("update meetings set status='baigtas'");
  assert.equal((await db.query('select total_members_at_time as total from meetings')).rows[0].total,10);
});
scenario('DB: po pradžios priimtas narys neperrašo užfiksuoto vardiklio',{attendees:5},async()=>{
  await db.query("insert into members(id,first_name,last_name,application_reference,admission_reference,admission_date) values($1,'Testas','Vėliau','Prašymas','Taryba','2026-09-18')",[uuid(11)]);
  await db.exec("update meetings set status='baigtas'");
  assert.equal((await db.query('select total_members_at_time as total from meetings')).rows[0].total,10);
});
scenario('DB: pradžios bazės negalima perrašyti nauju dabartiniu skaičiumi',{},async()=>{
  await assert.rejects(db.exec(`update meetings set electorate_snapshot='{"capture":true}'`),/užfiksuota/);
});
scenario('DB: neužfiksuotas istorinis susirinkimas reikalauja dokumentuotos bazės',{started:false},async()=>{
  await assert.rejects(db.exec("update meetings set status='baigtas'"),/užfiksuokite/);
});
scenario('DB: dokumentuota istorinė narių bazė įrašoma su šaltiniu',{started:false},async()=>{
  await db.exec(`update meetings set electorate_snapshot='{"total":12,"reference":"Susirinkimo dienos narių registro išrašas Nr. 1"}'`);
  await db.exec("update meetings set status='baigtas'");
  assert.equal((await db.query('select total_members_at_time as total from meetings')).rows[0].total,12);
});
scenario('DB: galiojantis 1/5 reikalavimas išlieka pasirašiusiam nariui vėliau išstojus',{type:'neeilinis',attendees:8},async()=>{
  await db.query("update meetings set convening_kind='members',convening_reference='Reikalavimas ir registro išrašas',convening_date='2026-09-17',convening_total_members=10,convening_requesters=$1",[[uuid(9),uuid(10)]]);
  await db.query("update members set status='išstojęs',termination_kind='withdrawal',termination_reference='Vėlesnis prašymas',termination_date='2026-09-18' where id=$1",[uuid(9)]);
  await finish(6);
  const snapshot=(await db.query('select convening_snapshot from meetings')).rows[0].convening_snapshot;
  assert.equal(snapshot.total,10);assert.equal(snapshot.requester_ids.length,2);
});
scenario('DB: vėliau priimtas narys neskaičiuojamas ankstesniame reikalavime',{type:'neeilinis'},async()=>{
  await db.query("update members set admission_date='2026-09-18' where id=$1",[uuid(2)]);
  await assert.rejects(db.query("update meetings set convening_kind='members',convening_reference='Reikalavimas',convening_date='2026-09-17',convening_total_members=10,convening_requesters=$1",[[uuid(1),uuid(2)]]),/narystė reikalavimo dieną/);
});
scenario('DB: užfiksuoto reikalavimo parašų negalima keisti atgaline data',{type:'neeilinis'},async()=>{
  await db.query("update meetings set convening_kind='members',convening_reference='Reikalavimas',convening_date='2026-09-17',convening_total_members=10,convening_requesters=$1",[[uuid(1),uuid(2)]]);
  await assert.rejects(db.query('update meetings set convening_requesters=$1',[[uuid(3),uuid(4)]]),/pagrindas užfiksuotas/);
});
scenario('DB: nepilna keturių asmenų Taryba nesumažina šešių narių bazės',{type:'valdybos',members:6,attendees:3,started:false},async()=>{
  await db.query('update community_management set is_current=false where member_id=any($1)',[[uuid(5),uuid(6)]]);
  await assert.rejects(db.exec("update meetings set status='vyksta'"),/šeši/);
});
scenario('DB: buvusio nario negalima fiziškai ištrinti',{},async()=>{
  await db.query("update members set status='išstojęs',termination_kind='withdrawal',termination_reference='Prašymas',termination_date='2026-09-18' where id=$1",[uuid(10)]);
  await assert.rejects(db.query('delete from members where id=$1',[uuid(10)]),/istorijos ištrinti/);
});
scenario('DB: archyvuojant buvusį narį jo mokėjimai išsaugomi',{},async()=>{
  await db.exec("insert into fee_periods(year,name,amount_cents,decision_reference,decision_date) values(2026,'Testinis',1200,'Visuotinio 1','2026-01-01')");
  await db.query('insert into payments(member_id,fee_period_id,amount_cents) select $1,id,1200 from fee_periods',[uuid(10)]);
  await db.query("update members set status='išstojęs',termination_kind='withdrawal',termination_reference='Prašymas',termination_date='2026-09-18',archived_at=now() where id=$1",[uuid(10)]);
  assert.equal((await db.query('select count(*)::int as n from payments')).rows[0].n,1);
});
scenario('DB: būsima narystės pabaiga šiandien neatima nario teisių',{},async()=>{
  await assert.rejects(db.query("update members set status='išstojęs',termination_kind='withdrawal',termination_reference='Prašymas',termination_date='2099-01-01' where id=$1",[uuid(10)]),/data dar neatėjo/);
});
test.after(async()=>db.close());
