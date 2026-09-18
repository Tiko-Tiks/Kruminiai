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
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;`);
for (const file of ['001_initial_schema.sql','002_voting_schema.sql','003_voting_tokens.sql','005_resolution_documents.sql','008_membership_declarations.sql','009_notification_log.sql','010_declaration_view_tracking.sql','011_meeting_expulsions.sql','013_vote_comments_and_management.sql','024_meeting_announcements_and_doc_linkage.sql','026_procedural_type_pranesimas.sql','027_contact_update_tokens.sql','036_honorary_member_status.sql']) {
  await db.exec(migration(file));
}
await db.exec(`create schema storage; create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
  alter table storage.objects enable row level security;
  create policy test_storage_access on storage.objects for all to authenticated using(true) with check(true);
  grant usage on schema storage to authenticated; grant select,update,delete on storage.objects to authenticated;`);
await db.exec(`alter table meetings add column is_published boolean default true;
  alter table profiles add column member_id uuid references members(id);
  create function public.is_admin() returns boolean language sql as $$ select coalesce(current_setting('test.is_admin',true),'true')='true' $$;
  create function public.is_approved_member() returns boolean language sql as $$ select coalesce(current_setting('test.is_member',true),'false')='true' $$;
  create function public.is_voting_status(text) returns boolean language sql as $$ select $1 in ('aktyvus','pasyvus','garbes_narys') $$;`);
await db.exec(migration('046_token_lifetime_hardening.sql'));
await db.exec(migration('047_meeting_doc_rpc_access.sql'));
await db.exec(migration('20260918185337_bylaws_enforcement.sql'));
await db.exec(`create trigger members_status_change_sync after update of status on members for each row execute function public.on_member_status_change();`);
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function setup({members=10,attendees=10,type='visuotinis',qualified=type!=='valdybos',notice=true,started=true,historical=false,date=null}={}) {
  // Each case rolls back; the migration is applied only once.
  await db.exec("begin; set local test.is_admin='true'; set local test.is_member='false'; set local test.user_id=''");
  for(let i=1;i<=members;i++) await db.query(`insert into members(id,first_name,last_name,application_reference,admission_reference,admission_date) values ($1,'Testas','Narys','Prašymas 1','Tarybos 1','2026-01-01')`,[uuid(i)]);
  await db.query(`insert into meetings(id,title,meeting_date,location,meeting_type,total_members_at_time,quorum_required,status,majority_rule,majority_reference,chairperson_name)
    values ($1,'Testinis susirinkimas',now(),'Testinė vieta',$2,$3,$4,'planuojamas','for_against','Patvirtinta tvarka Nr. 1','Testas Narys')`,[uuid(100),type,members,type==='pakartotinis'?0:Math.floor(members/2)+1]);
  await db.exec(`update meetings set notice_channels=ARRAY['web'],notice_reference='Tarybos 1',notice_day_rule='vilnius_calendar',notice_day_reference='Terminų tvarka 1'`);
  if(historical) await db.query(`update meetings set meeting_date=coalesce($1::timestamptz,now()-interval '3 days'),electorate_snapshot=jsonb_build_object('total',total_members_at_time,'reference','Istorinis registro išrašas','member_ids',(select jsonb_agg(id) from members))`,[date]);
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
scenario('DB: revizorius negali balsuoti Taryboje',{type:'valdybos',members:6,attendees:4,started:false},async()=>{
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
scenario('DB: pakartotinis tik su paveldėtu klausimu po nesurinkto kvorumo',{members:20,attendees:10,historical:true},async()=>{
  await db.exec(`update meetings set status='baigtas'`);
  await db.query(`insert into meetings(id,title,meeting_date,location,meeting_type,status,total_members_at_time,quorum_required,previous_meeting_id) values($1,'Pakartotinis',now(),'Testas','pakartotinis','vyksta',20,0,$2)`,[uuid(101),uuid(100)]);
  await db.query(`update meetings set notice_channels=ARRAY['web'],notice_reference='Tarybos 1',notice_day_rule='vilnius_calendar',notice_day_reference='Terminų tvarka 1',repeat_notice_days=14,repeat_notice_reference='Patvirtinta tvarka' where id=$1`,[uuid(101)]);
  await db.query(`insert into meeting_announcements(meeting_id,channel,published_at) select id,'web',meeting_date-interval '20 days' from meetings where id=$1`,[uuid(101)]);
  await db.query(`insert into resolutions(id,meeting_id,title,decision_text,decision_type,source_resolution_id) values($1,$2,'Įstatų projektas','Priimti','statutes',$3)`,[uuid(201),uuid(101),uuid(200)]);
  await db.query(`insert into meeting_attendance(meeting_id,member_id) values($1,$2)`,[uuid(101),uuid(1)]);
  await db.query(`update resolutions set status='patvirtintas',result_for=1,ballot_snapshot='{"uz":0,"pries":0,"susilaike":0}' where id=$1`,[uuid(201)]);
});
scenario('DB: vėlesnis dalyvavimo taisymas neperrašo priimto sprendimo vardiklio',{},async()=>{
  await finish(7); await db.query(`delete from meeting_attendance where member_id=$1`,[uuid(10)]);
  assert.equal((await db.exec(`select participants_at_decision from resolutions`))[0].rows[0].participants_at_decision,10);
});
scenario('DB: išstojimas išsaugo galutinį sprendimą ir neužstringa dėl istorinio balso',{},async()=>{
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
scenario('DB: vėlesnis Tarybos pareigų pasikeitimas nekeičia šio posėdžio sąrašo',{members:6,attendees:4,type:'valdybos'},async()=>{
  await db.query(`update community_management set is_current=false where member_id=$1`,[uuid(1)]);
  await finish(4);
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
  await finish(7);
  assert.equal((await db.query("select decision_basis->'notice'->0->>'channel' as channel from resolutions")).rows[0].channel,'web');
  await assert.rejects(db.exec('delete from meeting_announcements'),/įrodymai užfiksuoti/);
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
for(const noticeDays of [null,10]) scenario(`DB: pakartotinis po 10 dienų tik pagal patvirtintą terminą ${noticeDays}`,{members:20,attendees:10,historical:true},async()=>{
  await db.exec("update meetings set status='baigtas'");
  await db.query("insert into meetings(id,title,meeting_date,location,meeting_type,status,total_members_at_time,quorum_required,previous_meeting_id,repeat_notice_days,repeat_notice_reference) values($1,'Pakartotinis',now(),'Testas','pakartotinis','vyksta',20,0,$2,$3,$4)",[uuid(101),uuid(100),noticeDays,noticeDays===null?null:'Patvirtinta 10 dienų tvarka']);
  await db.query("update meetings set notice_channels=ARRAY['web'],notice_reference='Tarybos 1',notice_day_rule='vilnius_calendar',notice_day_reference='Terminų tvarka 1' where id=$1",[uuid(101)]);
  await db.query("insert into meeting_announcements(meeting_id,channel,published_at) select id,'web',(meeting_date AT TIME ZONE 'Europe/Vilnius'-interval '10 days') AT TIME ZONE 'Europe/Vilnius' from meetings where id=$1",[uuid(101)]);
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
  for(let i=11;i<=12;i++) await db.query("insert into members(id,first_name,last_name,application_reference,admission_reference,admission_date) values($1,'Testas','Papildomas','Prašymas','Taryba','2026-01-01')",[uuid(i)]);
  await db.exec(`update meetings set meeting_date=now()-interval '3 days',electorate_snapshot=jsonb_build_object('total',12,'reference','Susirinkimo dienos registro išrašas','member_ids',(select jsonb_agg(id) from members))`);
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

for(const type of ['statutes','transformation','liquidation']) scenario(`DB: Taryba neturi ${type} kompetencijos`,{type:'valdybos',members:6,attendees:4},async()=>{
  await db.query('update resolutions set decision_type=$1',[type]);
  await assert.rejects(finish(3,0,1),/kompetencijai/);
});
for(const offset of [0,3]) scenario(`DB: dokumentinis vardiklis draudžiamas šiandien ir ateityje (${offset})`,{started:false},async()=>{
  await assert.rejects(db.query(`update meetings set meeting_date=now()+make_interval(days=>$1),electorate_snapshot='{"total":2,"reference":"Tariamas dokumentas"}'`,[offset]),/tik istoriniam/);
});
scenario('DB: būsimo susirinkimo bazė negali būti užfiksuota iš anksto',{started:false},async()=>{
  await db.exec("update meetings set meeting_date=now()+interval '1 day'");
  await assert.rejects(db.exec("update meetings set status='vyksta'"),/susirinkimo dieną/);
});
scenario('DB: istorinis vardiklis negali būti perkeltas į būsimą susirinkimą',{historical:true},async()=>{
  await assert.rejects(db.exec("update meetings set meeting_date=now()+interval '1 day'"),/bazė užfiksuota/);
});
for(const change of ["termination_kind='withdrawal'","termination_reference=null","termination_date=null","expulsion_ground=null","appeal_reference=null"]) scenario(`DB: įrašyta narystės pabaiga nekinta: ${change}`,{},async()=>{
  await db.query("update members set status='išstojęs',termination_kind='expulsion',termination_reference='Tarybos 2',termination_date='2026-09-18',expulsion_ground='3.4.2',appeal_reference='Pranešimas apie skundą' where id=$1",[uuid(10)]);
  await assert.rejects(db.query(`update members set ${change} where id=$1`,[uuid(10)]),/pabaigos pagrindas užfiksuotas/);
});
scenario('DB: buvusio nario kontaktų taisymas ir archyvavimas išsaugo pabaigos pagrindą',{},async()=>{
  await db.query("update members set status='išstojęs',termination_kind='withdrawal',termination_reference='Prašymas',termination_date='2026-09-18' where id=$1",[uuid(10)]);
  await db.query("update members set phone='TEST',archived_at=now() where id=$1",[uuid(10)]);
  assert.equal((await db.query('select termination_reference from members where id=$1',[uuid(10)])).rows[0].termination_reference,'Prašymas');
});
for(const field of ['notice_channels','notice_reference','notice_day_rule','notice_day_reference']) scenario(`DB: informavimo pagrindas būtinas: ${field}`,{},async()=>{
  await db.exec(`update meetings set ${field}=null`);
  await assert.rejects(finish(7),/Pranešimo patikrai/);
});
for(const email of [false,true]) scenario(`DB: paskirtam el. paštui vien svetainės nepakanka (${email})`,{},async()=>{
  await db.exec("update meetings set notice_channels=ARRAY['web','email']");
  if(email) {await db.exec("insert into meeting_announcements(meeting_id,channel,published_at) select meeting_id,'email',published_at from meeting_announcements");await finish(7);}
  else await assert.rejects(finish(7),/kiekvienu Tarybos pasirinktu/);
});
for(const [rule,late,expected] of [['vilnius_calendar',false,true],['elapsed_hours',false,false],['vilnius_calendar',true,false]]) scenario(`DB: informavimo DST riba ${rule}, pavėluota=${late}`,{historical:true,date:'2026-04-05T15:00:00Z',notice:false},async()=>{
  await db.query('update meetings set notice_day_rule=$1',[rule]);
  await db.query("insert into meeting_announcements(meeting_id,channel,published_at) values($1,'web',$2)",[uuid(100),late?'2026-03-22T16:00:01Z':'2026-03-22T16:00:00Z']);
  if(expected) {await finish(7);assert.equal((await db.query("select decision_basis->>'notice_day_rule' as rule from resolutions")).rows[0].rule,rule);}
  else await assert.rejects(finish(7),/pranešimo/);
});

for(const type of ['council_election','council_removal','auditor_election','reports','fees','seat']) {
  scenario(`DB: Visuotinio kompetencija ${type} neperduodama Tarybai`,{type:'valdybos',members:6,attendees:4},async()=>{
    await db.query('update resolutions set decision_type=$1',[type]);await assert.rejects(finish(3,1),/kompetencijai/);
  });
  scenario(`DB: ${type} Visuotiniame priimamas paprasta dauguma`,{qualified:false},async()=>{
    await db.query('update resolutions set decision_type=$1',[type]);await finish(6,4);
    assert.equal((await db.query('select requires_qualified_majority as q from resolutions')).rows[0].q,false);
  });
}
for(const table of ['meeting_attendance','vote_ballots']) scenario(`DB: po bazės fiksavimo priimtas narys nepatenka į ${table}`,{},async()=>{
  await db.query("insert into members(id,first_name,last_name,application_reference,admission_reference,admission_date) values($1,'Naujas','Narys','Naujas prašymas','Naujas sprendimas','2026-09-19')",[uuid(11)]);
  const sql=table==='meeting_attendance'?"insert into meeting_attendance(meeting_id,member_id) values($1,$2)":"insert into vote_ballots(resolution_id,member_id,vote) values($1,$2,'uz')";
  await assert.rejects(db.query(sql,[uuid(table==='meeting_attendance'?100:200),uuid(11)]),/užfiksuotam/);
});
scenario('DB: po istorinio susirinkimo išstojęs narys išlieka jo balsuotoju',{historical:true,attendees:9},async()=>{
  await db.query("update members set status='išstojęs',termination_kind='withdrawal',termination_reference='Prašymas',termination_date='2026-09-19' where id=$1",[uuid(10)]);
  await db.query('insert into meeting_attendance(meeting_id,member_id) values($1,$2)',[uuid(100),uuid(10)]);
  await db.query("insert into vote_ballots(resolution_id,member_id,vote) values($1,$2,'uz')",[uuid(200),uuid(10)]);
  for(let i=1;i<=9;i++) await db.query("insert into vote_ballots(resolution_id,member_id,vote) values($1,$2,'uz')",[uuid(200),uuid(i)]);
  await finish(10,0,0,'patvirtintas',{uz:10,pries:0,susilaike:0});
});
for(const status of ['vyksta','planuojamas']) scenario(`DB: baigto susirinkimo statusas negrąžinamas į ${status}`,{},async()=>{
  await db.exec("update meetings set status='baigtas'");await assert.rejects(db.query('update meetings set status=$1',[status]),/atidaryti negalima/);
});
for(const fresh of [false,true]) scenario(`DB: pakartotiniam priėmimui reikia naujų dokumentų (${fresh})`,{},async()=>{
  await db.query("update members set status='išstojęs',termination_kind='withdrawal',termination_reference='Prašymas išeiti',termination_date='2026-09-18' where id=$1",[uuid(10)]);
  const reactivate=()=>db.query(`update members set status='aktyvus',application_reference=$1,admission_reference=$2,admission_date=$3 where id=$4`,[fresh?'Naujas prašymas':'Prašymas 1',fresh?'Naujas Tarybos sprendimas':'Tarybos 1',fresh?'2026-09-19':'2026-01-01',uuid(10)]);
  if(fresh) await reactivate();else await assert.rejects(reactivate(),/Pakartotiniam priėmimui/);
});
async function attachFixture() {
  await db.query("insert into documents(id,title,file_path,file_name) values($1,'Priimamas projektas','test-file.pdf','test.pdf')",[uuid(300)]);
  await db.query('insert into resolution_documents(resolution_id,document_id) values($1,$2)',[uuid(200),uuid(300)]);
  await db.exec("insert into storage.objects(bucket_id,name) values('documents','test-file.pdf')");
}
for(const change of ["delete from resolution_documents","update resolution_documents set sort_order=9","delete from documents","update documents set file_path='replacement.pdf'","update documents set title='Kitas priimtas projektas'"]) scenario(`DB: galutinio nutarimo priedai nekinta: ${change}`,{},async()=>{
  await attachFixture();await finish(7);await assert.rejects(db.exec(change),/priedų keisti/);
});
scenario('DB: prie galutinio nutarimo negalima pridėti naujo priedo',{},async()=>{
  await finish(7);await db.query("insert into documents(id,title,file_path,file_name) values($1,'Kitas','other.pdf','other.pdf')",[uuid(301)]);
  await assert.rejects(db.query('insert into resolution_documents(resolution_id,document_id) values($1,$2)',[uuid(200),uuid(301)]),/priedų keisti/);
});
scenario('DB: neužbaigto projekto priedą galima atkabinti',{},async()=>{
  await attachFixture();await db.exec('delete from resolution_documents');
});
for(const sql of ["delete from storage.objects","update storage.objects set name='replacement.pdf'"]) scenario(`DB: Storage API išsaugo galutinio nutarimo failą: ${sql}`,{},async()=>{
  await attachFixture();await finish(7);
  await db.exec('grant select on all tables in schema public to authenticated; set local role authenticated');
  await db.exec(sql);
  assert.equal((await db.query("select name from storage.objects")).rows[0].name,'test-file.pdf');
});


for(const change of ["admission_date=(now() AT TIME ZONE 'Europe/Vilnius')::date+1","admission_date='2099-01-01'"]) scenario(`DB: būsimas priėmimas nesuteikia narystės: ${change}`,{},async()=>{
  await assert.rejects(db.exec(`update members set ${change}`),/Priėmimo sprendimo data/);
});
scenario('DB: šiandienos priėmimo sprendimas galioja',{},async()=>{
  await db.exec("update members set admission_date=(now() AT TIME ZONE 'Europe/Vilnius')::date");
});
for(const date of ["(now() AT TIME ZONE 'Europe/Vilnius')::date+1","'2099-01-01'::date"]) scenario(`DB: būsimas mokesčio sprendimas nesukuria prievolės ${date}`,{},async()=>{
  await assert.rejects(db.exec(`insert into fee_periods(year,name,amount_cents,decision_reference,decision_date) values(2027,'Metinis',1200,'Visuotinio 1',${date})`),/sprendimo data dar neatėjo/);
});
scenario('DB: šiandienos mokesčio sprendimas priimamas',{},async()=>{
  await db.exec("insert into fee_periods(year,name,amount_cents,decision_reference,decision_date) values(2027,'Metinis',1200,'Visuotinio 1',(now() AT TIME ZONE 'Europe/Vilnius')::date)");
});
for(const change of ["admission_date='2026-07-01'","status='išstojęs',termination_kind='withdrawal',termination_reference='Prašymas',termination_date='2026-02-01'"]) scenario(`DB: istorinis sąrašas negali prieštarauti narystės datoms ${change}`,{started:false,attendees:0},async()=>{
  await db.exec(`update members set ${change}`);
  await assert.rejects(db.exec("update meetings set meeting_date='2026-06-01',electorate_snapshot=jsonb_build_object('total',10,'reference','Istorinis sąrašas','member_ids',(select jsonb_agg(id) from members))"),/narystės datos/);
});
scenario('DB: reikalavimas negali būti vėlesnis už susirinkimą',{type:'neeilinis',started:false,attendees:0},async()=>{
  await db.exec("update meetings set meeting_date='2026-06-01'");
  await assert.rejects(db.query("update meetings set convening_kind='members',convening_date='2026-06-02',convening_reference='Reikalavimas',convening_total_members=10,convening_requesters=$1",[[uuid(1),uuid(2)]]),/iki susirinkimo/);
});
scenario('DB: datos perkėlimas negali apeiti jau įrašyto reikalavimo',{type:'neeilinis',started:false,attendees:0},async()=>{
  await db.query("update meetings set convening_kind='members',convening_date='2026-06-02',convening_reference='Reikalavimas',convening_total_members=10,convening_requesters=$1",[[uuid(1),uuid(2)]]);
  await assert.rejects(db.exec("update meetings set meeting_date='2026-06-01'"),/iki susirinkimo/);
});
for(const change of ["update meeting_announcements set published_at=now()","insert into meeting_announcements(meeting_id,channel,published_at) select id,'rc',now() from meetings","update meetings set notice_reference='Naujas pagrindas'","update meetings set notice_day_rule='elapsed_hours'"]) scenario(`DB: po sprendimo informavimo įrodymai nekinta: ${change}`,{},async()=>{
  await finish(7);await assert.rejects(db.exec(change),/užfiksuot/);
});
scenario('DB: neužbaigto susirinkimo skelbimą galima pataisyti',{},async()=>{
  await db.exec("update meeting_announcements set url='https://example.invalid/pranesimas'");
});
scenario('DB: darbotvarkė perrikiuojama vienu veiksmu',{},async()=>{
  await db.query("insert into resolutions(id,meeting_id,title) values($1,$2,'Antras')",[uuid(201),uuid(100)]);
  await db.query('select bylaws_reorder_resolutions($1,$2)',[uuid(100),[uuid(201),uuid(200)]]);
  assert.equal((await db.query('select resolution_number from resolutions where id=$1',[uuid(200)])).rows[0].resolution_number,2);
});
for(const order of [[200],[200,200],[200,999]]) scenario(`DB: nepilnas perrikiavimas atmetamas ${order}`,{},async()=>{
  await db.query("insert into resolutions(id,meeting_id,title,resolution_number) values($1,$2,'Antras',2)",[uuid(201),uuid(100)]);
  await assert.rejects(db.query('select bylaws_reorder_resolutions($1,$2)',[uuid(100),order.map(uuid)]),/Darbotvarkė pasikeitė/);
});
scenario('DB: perrikiavimas negali perkelti galutinio klausimo',{},async()=>{
  await finish(7);
  await assert.rejects(db.query('select bylaws_reorder_resolutions($1,$2)',[uuid(100),[uuid(200)]]),/numeracija užfiksuota/);
});
scenario('DB: perrikiavimas tik administratoriui',{},async()=>{
  await db.exec("set local test.is_admin='false'");
  await assert.rejects(db.query('select bylaws_reorder_resolutions($1,$2)',[uuid(100),[uuid(200)]]),/Tik administratorius/);
});
async function generatedFixture(kind) {
  await db.query("insert into documents(id,title,file_path,file_name) values($1,'Generuojamas priedas',$2,'test.html')",[uuid(300),`__api__/${kind}/${uuid(100)}`]);
  await db.query('insert into resolution_documents(resolution_id,document_id) values($1,$2)',[uuid(200),uuid(300)]);
  if(kind==='salinami') await db.query("insert into meeting_expulsions(meeting_id,member_id,debt_cents,debt_years,reason) values($1,$2,1200,'2024','Pradinis pagrindas')",[uuid(100),uuid(1)]);
  if(kind==='rinkimai') await db.query("insert into community_management(member_id,role) values($1,'tarybos_narys')",[uuid(1)]);
}
for(const [kind,fn] of [['salinami','get_meeting_expulsions_data'],['rinkimai','get_meeting_elections_data'],['veiklos-planai','get_meeting_plan_data']]) scenario(`DB: ${kind} dokumentas grąžina galutinio momento duomenis`,{},async()=>{
  await generatedFixture(kind);await finish(7);
  const before=(await db.query(`select ${fn}($1) as payload`,[uuid(100)])).rows[0].payload;
  assert.ok(before.captured_at);
  await db.exec("update members set first_name='Pakeistas'; update meetings set title='Vėlesnis pavadinimas'; update community_management set is_current=false");
  const after=(await db.query(`select ${fn}($1) as payload`,[uuid(100)])).rows[0].payload;
  assert.deepEqual(after,before);
});
for(const change of ["update meeting_expulsions set reason='Pakeista'","delete from meeting_expulsions"]) scenario(`DB: užfiksuotas šalinimo priedas neperrašomas ${change}`,{},async()=>{
  await generatedFixture('salinami');await finish(7);await assert.rejects(db.exec(change),/įrodymai užfiksuoti/);
});
scenario('DB: kvorumo nesurinkusio susirinkimo generuojamas priedas išsaugomas kartojimui',{members:20,attendees:10,historical:true},async()=>{
  await generatedFixture('salinami');await db.exec("update meetings set status='baigtas'");
  assert.equal((await db.query('select count(*)::int as n from bylaws_document_snapshots')).rows[0].n,1);
});
scenario('DB: kopijos negalima skaityti tiesiogiai per Data API',{},async()=>{
  await generatedFixture('salinami');await finish(7);await db.exec('set local role anon');
  await assert.rejects(db.exec('select * from bylaws_document_snapshots'),/permission denied/);
});
scenario('DB: kopija nepanaikina dokumento prieigos patikros',{},async()=>{
  await generatedFixture('salinami');await finish(7);await db.exec("set local test.is_admin='false'");
  assert.equal((await db.query('select get_meeting_expulsions_data($1) as data',[uuid(100)])).rows[0].data.error,'forbidden');
});
for(const same of [true,false]) scenario(`DB: pakartotiniame privalomas tas pats priedas ${same}`,{members:20,attendees:10,historical:true},async()=>{
  await attachFixture();await db.exec("update meetings set status='baigtas'");
  await db.query("insert into meetings(id,title,meeting_date,location,meeting_type,status,total_members_at_time,quorum_required,previous_meeting_id,repeat_notice_days,repeat_notice_reference,notice_channels,notice_reference,notice_day_rule,notice_day_reference) values($1,'Pakartotinis',now(),'Testas','pakartotinis','vyksta',20,0,$2,14,'Tvarka',ARRAY['web'],'Taryba','vilnius_calendar','Tvarka')",[uuid(101),uuid(100)]);
  await db.query("insert into meeting_announcements(meeting_id,channel,published_at) values($1,'web',now()-interval '20 days')",[uuid(101)]);
  await db.query("insert into resolutions(id,meeting_id,title,decision_text,decision_type,source_resolution_id) values($1,$2,'Įstatų projektas','Priimti','statutes',$3)",[uuid(201),uuid(101),uuid(200)]);
  if(same) await db.query('insert into resolution_documents(resolution_id,document_id) values($1,$2)',[uuid(201),uuid(300)]);
  await db.query('insert into meeting_attendance(meeting_id,member_id) values($1,$2)',[uuid(101),uuid(1)]);
  const close=()=>db.query(`update resolutions set status='patvirtintas',result_for=1,ballot_snapshot='{"uz":0,"pries":0,"susilaike":0}' where id=$1`,[uuid(201)]);
  if(same) await close();else await assert.rejects(close(),/priedai turi sutapti/);
});
scenario('DB: bet kuri perrikiavimo klaida grąžina visus numerius',{},async()=>{
  await db.exec('update resolutions set resolution_number=1');
  await db.query("insert into resolutions(id,meeting_id,title,resolution_number) values($1,$2,'Antras',2)",[uuid(201),uuid(100)]);
  await db.exec(`create function test_reorder_failure() returns trigger language plpgsql as $$ begin if NEW.resolution_number=1 then raise exception 'Testinis sutrikimas'; end if; return NEW; end $$;
    create trigger z_test_reorder_failure before update on resolutions for each row execute function test_reorder_failure(); savepoint before_reorder;`);
  await assert.rejects(db.query('select bylaws_reorder_resolutions($1,$2)',[uuid(100),[uuid(201),uuid(200)]]),/Testinis sutrikimas/);
  await db.exec('rollback to savepoint before_reorder');
  assert.deepEqual((await db.query('select resolution_number from resolutions order by id')).rows.map(r=>r.resolution_number),[1,2]);
});


for(const fn of ['get_meeting_expulsions_data','get_meeting_elections_data','get_meeting_plan_data']) for(const token of [null,'unknown-token']) scenario(`DB: tikras prieigos helper atmeta svetimą kvietimą ${fn}/${token}`,{},async()=>{
  await db.exec("set local test.is_admin='false'; set local role anon");
  assert.equal((await db.query(`select ${fn}($1,$2) as data`,[uuid(100),token])).rows[0].data.error,'forbidden');
});
for(const valid of [true,false]) scenario(`DB: dokumento prieiga priklauso nuo tikro balsavimo tokeno galiojimo ${valid}`,{},async()=>{
  await db.query("insert into meeting_voting_tokens(meeting_id,member_id,token,expires_at) values($1,$2,'test-token',now()+$3::interval)",[uuid(100),uuid(1),valid?'1 day':'-1 day']);
  await db.exec("set local test.is_admin='false'; set local role anon");
  const data=(await db.query('select get_meeting_elections_data($1,$2) as data',[uuid(100),'test-token'])).rows[0].data;
  if(valid) assert.equal(data.meeting_id,uuid(100));else assert.equal(data.error,'forbidden');
});
for(const [reference,role,start,allowed] of [['','tarybos_narys','2026-01-01',false],['Tarybos išrašas 1','revizorius','2026-01-01',false],['Tarybos išrašas 1','tarybos_narys','2026-08-01',false],['Tarybos išrašas 1','tarybos_narys','2026-01-01',true]]) scenario(`DB: istorinei Tarybai būtinos pareigos ir dokumentas ${reference}/${role}/${start}`,{members:6,attendees:0,type:'valdybos',started:false},async()=>{
  // Replace current entries with a historical Council register, not today's roster.
  await db.exec('delete from community_management');
  for(let i=1;i<=6;i++) await db.query('insert into community_management(member_id,role,term_start,term_end,is_current) values($1,$2,$3,$4,false)',[uuid(i),role,start,'2026-04-01']);
  const capture=()=>db.query("update meetings set meeting_date='2026-06-01',electorate_snapshot=jsonb_build_object('total',6,'reference','Narių sąrašas','council_reference',$1::text,'member_ids',(select jsonb_agg(id) from members))",[reference]);
  if(allowed) await capture();else await assert.rejects(capture(),/Istorinei Tarybai/);
});
for(const role of ['pirmininkas','revizorius']) scenario(`DB: vienu metu negali būti du ${role}`,{},async()=>{
  await db.query('insert into community_management(member_id,role) values($1,$2)',[uuid(1),role]);
  await assert.rejects(db.query('insert into community_management(member_id,role) values($1,$2)',[uuid(2),role]),/tik vienas/);
});
scenario('DB: dokumentuotai pasikeitus Pirmininkui ankstesnis lieka istorijoje',{},async()=>{
  await db.query("insert into community_management(member_id,role) values($1,'pirmininkas')",[uuid(1)]);
  await db.exec('update community_management set is_current=false');
  await db.query("insert into community_management(member_id,role) values($1,'pirmininkas')",[uuid(2)]);
  assert.equal((await db.query("select count(*)::int as n from community_management where is_current and role='pirmininkas'")).rows[0].n,1);
});
async function readmissionFixture() {
  await db.query("update members set status='išstojęs',termination_kind='withdrawal',termination_reference='Prašymas išeiti 1',termination_date='2026-04-01' where id=$1",[uuid(1)]);
  await db.query("update members set status='aktyvus',application_reference='Antras prašymas',admission_reference='Tarybos 2',admission_date='2026-08-01' where id=$1",[uuid(1)]);
}
scenario('DB: tiesioginis pakartotinis priėmimas išsaugo ankstesnio laikotarpio įrodymus',{},async()=>{
  await readmissionFixture();
  const old=(await db.query('select * from bylaws_membership_periods where member_id=$1',[uuid(1)])).rows[0];
  assert.equal(old.admission_reference,'Tarybos 1');assert.equal(old.application_reference,'Prašymas 1');assert.equal(old.started_on.toISOString().slice(0,10),'2026-01-01');assert.equal(old.ended_on.toISOString().slice(0,10),'2026-04-01');
  assert.equal((await db.query("select count(*)::int as n from audit_log where new_data->>'reason'='readmission'")).rows[0].n,1);
});
for(const date of ['2026-03-01','2026-06-01','2026-09-01']) scenario(`DB: istorinis narių sąrašas tikrina visus narystės laikotarpius ${date}`,{started:false,attendees:0},async()=>{
  await readmissionFixture();
  const capture=()=>db.query("update meetings set meeting_date=$1,electorate_snapshot=jsonb_build_object('total',10,'reference','Narių registro išrašas','member_ids',(select jsonb_agg(id) from members))",[date]);
  if(date==='2026-06-01') await assert.rejects(capture(),/narystės datos/);else await capture();
});
scenario('DB: narystės laikotarpiai neperrašomi per administratoriaus Data API',{},async()=>{
  await readmissionFixture();await db.exec('set local role authenticated');
  await assert.rejects(db.exec("update bylaws_membership_periods set admission_reference='Kitas pagrindas'"),/permission denied/);
});
scenario('DB: tiesioginis priėmimo pagrindo taisymas palieka seną įrodymą audite',{},async()=>{
  await db.query("update members set admission_reference='Patikslintas protokolo numeris' where id=$1",[uuid(1)]);
  assert.equal((await db.query("select old_data->>'admission_reference' as old from audit_log where new_data->>'reason'='admission_evidence_correction'")).rows[0].old,'Tarybos 1');
});
async function installmentsFixture(amounts) {
  await db.exec("update members set join_date='2026-01-01'");
  await db.query("insert into fee_periods(id,year,name,amount_cents,fee_type,decision_reference,decision_date) values($1,2026,'Metinis',1200,'metinis','Visuotinio 1','2026-01-01')",[uuid(500)]);
  for(const amount of amounts) await db.query("insert into payments(member_id,fee_period_id,amount_cents,receipt_number) values($1,$2,$3,$4)",[uuid(1),uuid(500),amount,`Kvitas-${amount}`]);
}
for(const amounts of [[500],[500,700],[500,800]]) scenario(`DB: tikri įmokų įrašai išsaugo dalis ir jų likutį ${amounts}`,{members:1,attendees:1},async()=>{
  await installmentsFixture(amounts);
  const remaining=Math.max(0,1200-amounts.reduce((a,b)=>a+b,0));
  const plan=(await db.query('select get_meeting_plan_data($1) as data',[uuid(100)])).rows[0].data;
  assert.equal(plan.total_debt_cents,remaining);assert.equal(plan.paid_count,remaining?0:1);
  assert.equal((await db.query('select count(*)::int as n from payments')).rows[0].n,amounts.length);
  const stats=(await db.query('select get_transparency_fee_stats() as data')).rows[0].data;
  assert.equal(stats.paid_counts[0]?.count || 0,remaining?0:1);
  await db.query("insert into membership_declarations(member_id,token,expires_at) values($1,'declaration-test',now()+interval '1 day')",[uuid(1)]);
  const declaration=(await db.query("select get_declaration_token_data('declaration-test') as data")).rows[0].data;
  assert.equal(declaration.debt.total_cents,remaining);
  await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'test@example.invalid','{}')",[uuid(600)]);
  await db.query('update profiles set member_id=$1 where id=$2',[uuid(1),uuid(600)]);
  await db.query("select set_config('test.user_id',$1,true)",[uuid(600)]);
  const financial=(await db.query('select get_member_financial_status() as data')).rows[0].data;
  assert.equal(financial.total_debt_cents,remaining);assert.equal(financial.paid.length,amounts.length);
});
scenario('DB: naujas neigiamas mokėjimas negali iškreipti skolos',{},async()=>{
  await installmentsFixture([]);await assert.rejects(db.query('insert into payments(member_id,fee_period_id,amount_cents) values($1,$2,-1)',[uuid(1),uuid(500)]),/bylaws_payment_positive/);
});
for(const date of ['2026-03-01','2026-06-01']) scenario(`DB: istorinis narių reikalavimas tikrina ankstesnius narystės laikotarpius ${date}`,{type:'neeilinis'},async()=>{
  await readmissionFixture();
  const demand=()=>db.query("update meetings set convening_kind='members',convening_reference='Reikalavimas ir išrašas',convening_date=$1,convening_total_members=10,convening_requesters=$2",[date,[uuid(1),uuid(2)]]);
  if(date==='2026-03-01') await demand();else await assert.rejects(demand(),/narystė reikalavimo dieną/);
});
test.after(async()=>db.close());
