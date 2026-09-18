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
async function setup({members=10,attendees=10,type='visuotinis',qualified=true}={}) {
  // Each case rolls back; the migration is applied only once.
  await db.exec('begin');
  for(let i=1;i<=members;i++) await db.query(`insert into members(id,first_name,last_name,application_reference,admission_reference,admission_date) values ($1,'Testas','Narys','Prašymas 1','Tarybos 1','2026-01-01')`,[uuid(i)]);
  await db.query(`insert into meetings(id,title,meeting_date,location,meeting_type,total_members_at_time,quorum_required,status,majority_rule,majority_reference,chairperson_name)
    values ($1,'Testinis susirinkimas','2026-09-20 12:00Z','Testinė vieta',$2,$3,$4,'vyksta','for_against','Patvirtinta tvarka Nr. 1','Testas Narys')`,[uuid(100),type,members,type==='pakartotinis'?0:Math.floor(members/2)+1]);
  if(type==='valdybos') for(let i=1;i<=members;i++) await db.query(`insert into community_management(member_id,role) values ($1,'tarybos_narys')`,[uuid(i)]);
  for(let i=1;i<=attendees;i++) await db.query(`insert into meeting_attendance(meeting_id,member_id) values($1,$2)`,[uuid(100),uuid(i)]);
  await db.query(`insert into resolutions(id,meeting_id,title,decision_text,requires_qualified_majority) values ($1,$2,'Įstatų projektas','Priimti pateiktą projektą',$3)`,[uuid(200),uuid(100),qualified]);
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
scenario('DB: kvorumo negalima sumažinti tiesiogine užklausa',{},async()=>assert.rejects(db.exec(`update meetings set quorum_required=5`),/Kvorumas/));
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
  await db.exec(`update resolutions set chair_vote='uz'`); await finish(2,2);
});
scenario('DB: pakartotinis tik su paveldėtu klausimu po nesurinkto kvorumo',{members:20,attendees:10},async()=>{
  await db.exec(`update meetings set status='baigtas',meeting_date='2026-09-19 12:00Z'`);
  await db.query(`insert into meetings(id,title,meeting_date,location,meeting_type,status,total_members_at_time,quorum_required,previous_meeting_id) values($1,'Pakartotinis','2026-09-21 12:00Z','Testas','pakartotinis','vyksta',20,0,$2)`,[uuid(101),uuid(100)]);
  await db.query(`insert into resolutions(id,meeting_id,title,decision_text,requires_qualified_majority,source_resolution_id) values($1,$2,'Įstatų projektas','Priimti',true,$3)`,[uuid(201),uuid(101),uuid(200)]);
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
  await finish(7,0,0,'patvirtintas',{uz:1,pries:0,susilaike:0});
  await db.query(`update members set status='išstojęs' where id=$1`,[uuid(1)]);
  assert.equal((await db.exec(`select count(*)::integer as n from vote_ballots`))[0].rows[0].n,1);
  assert.equal((await db.exec(`select participants_at_decision from resolutions`))[0].rows[0].participants_at_decision,10);
});
scenario('DB: prisijungusio administratoriaus rolė neapeina įstatų tikrinimo',{},async()=>{
  await db.exec(`grant select,insert,update on all tables in schema public to authenticated; set local role authenticated;`);
  await assert.rejects(db.exec(`insert into members(first_name,last_name) values('Testas','Be pagrindo')`),/Tarybos/);
});
scenario('DB: neeiliniam pranešimui pakanka septynių dienų',{type:'neeilinis',qualified:false},async()=>{
  await db.exec(`update resolutions set procedural_type='pranesimas'; insert into meeting_announcements(meeting_id,channel,published_at) select id,'web',meeting_date-interval '7 days' from meetings`);
  await finish(7);
});
scenario('DB: vien ankstyvos SMS nepakanka patvirtinti pranešimo',{qualified:false},async()=>{
  await db.exec(`update resolutions set procedural_type='pranesimas'; insert into meeting_announcements(meeting_id,channel,published_at) select id,'sms',meeting_date-interval '20 days' from meetings`);
  await assert.rejects(finish(7),/pranešimo/);
});
scenario('DB: netekęs Tarybos pareigų dalyvis nebesuteikia kvorumo kitam sprendimui',{members:6,attendees:4,type:'valdybos'},async()=>{
  await db.query(`update community_management set is_current=false where member_id=$1`,[uuid(1)]);
  await assert.rejects(finish(4),/balso teisės/);
});
test.after(async()=>db.close());
