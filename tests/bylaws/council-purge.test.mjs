import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = name => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const db = new PGlite();

// Real Postgres engine with the actual repository schemas. Supabase-owned auth
// roles are stubbed locally; no production credentials, services or network.
await db.exec(`create role anon; create role authenticated; create schema auth;
  create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`);
for (const file of ['001_initial_schema.sql', '002_voting_schema.sql', '003_voting_tokens.sql',
  '005_resolution_documents.sql', '008_membership_declarations.sql', '009_notification_log.sql',
  '010_declaration_view_tracking.sql', '011_meeting_expulsions.sql',
  '013_vote_comments_and_management.sql', '024_meeting_announcements_and_doc_linkage.sql',
  '026_procedural_type_pranesimas.sql', '027_contact_update_tokens.sql',
  '036_honorary_member_status.sql']) {
  await db.exec(migration(file));
}
// The bylaws migration installs `bylaws_document_guard` on `resolution_documents` (005 above)
// and RESTRICTIVE policies on `storage.objects`, which Supabase owns. The same local stand-in
// as tests/bylaws/database.test.mjs: a bare table with RLS, so the policies can be created.
await db.exec(`create schema storage; create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
  alter table storage.objects enable row level security;
  create policy test_storage_access on storage.objects for all to authenticated using(true) with check(true);
  grant usage on schema storage to authenticated; grant select,update,delete on storage.objects to authenticated;`);

// Prerequisites that 049 expects from migrations outside this subset. They are
// stubbed rather than loaded, because the intervening migrations carry RLS
// policies for tables this subset does not create. The stubs keep exactly the
// behaviour 049 relies on; they are not what is under test.
await db.exec(`
  alter table public.meetings add column if not exists is_published boolean not null default true;
  create or replace function public.is_voting_status(p_status text) returns boolean
    language sql immutable as $$ select p_status in ('aktyvus','pasyvus','garbes_narys') $$;
  create or replace function public.is_admin() returns boolean language sql stable as $$ select false $$;
  create or replace function public.is_approved_member() returns boolean language sql stable as $$ select false $$;
  create or replace function public._is_complete_ballot(p_meeting_id uuid, p_votes jsonb) returns boolean
    language sql stable as $$ select true $$;`);

// Production order: 046 and 047 (token lifetime, document-access RPCs – already deployed and
// now carried by the bylaws PR), then the bylaws migration, then 049 on top of it. 047 is the
// real `_can_view_meeting_doc`, which the bylaws migration replaces (same signature).
await db.exec(migration('046_token_lifetime_hardening.sql'));
await db.exec(migration('047_meeting_doc_rpc_access.sql'));
await db.exec(migration('20260918185337_bylaws_enforcement.sql'));
await db.exec(migration('049_voting_eligibility_helper.sql'));

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
/** Council meeting ten days ahead, still 'planuojamas': early ballots are possible and it is
 * inside the purge scope of 049 (`meeting_date > now()`, not closed). */
const FUTURE_MEETING = uuid(100);
/** Council meeting that started today ('vyksta'). `bylaws_meeting_guard` allows a registry
 * capture only on the meeting day once its time has come, and a decision can be closed only
 * with that captured electorate (its `member_ids` must cover every attendee), so final
 * decisions can exist only on a started meeting. */
const STARTED_MEETING = uuid(101);
const OPEN_RESOLUTION = uuid(200);   // on FUTURE_MEETING
const FINAL_RESOLUTION = uuid(201);  // on STARTED_MEETING

/** Council size under Article 5.2. The bylaws guard rejects a Council electorate other than
 * six when it captures the register, so the fixture must seat a complete Council. */
const COUNCIL_SIZE = 6;

/** Full Council, all registered for the future Council meeting. Council terms must have
 * begun (`term_start <= today`): the bylaws guard and 049 both require it. */
async function setup({ members = COUNCIL_SIZE } = {}) {
  await db.exec('begin');
  for (let i = 1; i <= members; i++) {
    await db.query(`insert into members(id,first_name,last_name,application_reference,admission_reference,admission_date)
      values ($1,'Testas','Narys','Prašymas 1','Tarybos 1','2026-01-01')`, [uuid(i)]);
    await db.query(`insert into community_management(member_id,role,term_start) values ($1,'tarybos_narys','2026-01-01')`, [uuid(i)]);
  }
  await db.query(`insert into meetings(id,title,meeting_date,location,meeting_type,total_members_at_time,quorum_required,status,majority_rule,majority_reference)
    values ($1,'Tarybos posėdis',now()+interval '10 days','Testinė vieta','valdybos',$2,$3,'planuojamas','for_against','Patvirtinta tvarka Nr. 1')`,
    [FUTURE_MEETING, members, Math.floor(members / 2) + 1]);
  for (let i = 1; i <= members; i++) {
    await db.query(`insert into meeting_attendance(meeting_id,member_id) values ($1,$2)`, [FUTURE_MEETING, uuid(i)]);
  }
  await db.query(`insert into resolutions(id,meeting_id,resolution_number,title,decision_text,decision_type,status)
    values ($1,$2,1,'Sąmatos tvirtinimas','Sąmatai pritarta','ordinary','balsuojamas')`, [OPEN_RESOLUTION, FUTURE_MEETING]);
}

/** Second Council meeting inserted as started today: the bylaws guard records the electorate
 * snapshot (six members, quorum four) at this point. */
async function startedMeeting() {
  await db.query(`insert into meetings(id,title,meeting_date,location,meeting_type,total_members_at_time,quorum_required,status,majority_rule,majority_reference)
    values ($1,'Tarybos posėdis (vyksta)',now(),'Testinė vieta','valdybos',$2,$3,'vyksta','for_against','Patvirtinta tvarka Nr. 1')`,
    [STARTED_MEETING, COUNCIL_SIZE, Math.floor(COUNCIL_SIZE / 2) + 1]);
  for (let i = 1; i <= COUNCIL_SIZE; i++) {
    await db.query(`insert into meeting_attendance(meeting_id,member_id) values ($1,$2)`, [STARTED_MEETING, uuid(i)]);
  }
  await db.query(`insert into resolutions(id,meeting_id,resolution_number,title,decision_text,decision_type,status)
    values ($1,$2,1,'Sąmatos tvirtinimas','Sąmatai pritarta','ordinary','balsuojamas')`, [FINAL_RESOLUTION, STARTED_MEETING]);
}

const ballot = (resolution, member, vote = 'uz') =>
  db.query(`insert into vote_ballots(resolution_id,member_id,vote) values ($1,$2,$3)`, [resolution, member, vote]);

const results = async id =>
  (await db.query(`select result_for,result_against,result_abstain,participants_at_decision,status from resolutions where id=$1`, [id])).rows[0];

const ballotCount = async id =>
  Number((await db.query(`select count(*)::int as n from vote_ballots where resolution_id=$1`, [id])).rows[0].n);

const meetingBase = async id =>
  (await db.query(`select total_members_at_time, quorum_required, (electorate_snapshot->>'total')::int as snapshot_total
    from meetings where id=$1`, [id])).rows[0];

function scenario(name, options, fn) {
  test(name, async () => {
    try { await setup(options); await fn(); } finally { await db.exec('rollback'); }
  });
}

scenario('Taryba: pašalinus narį iš Tarybos, jo būsimo posėdžio balsas ištrinamas', {}, async () => {
  for (const i of [1, 2, 3]) await ballot(OPEN_RESOLUTION, uuid(i));
  await db.query(`update resolutions set result_for=3 where id=$1`, [OPEN_RESOLUTION]);

  await db.query(`delete from community_management where member_id=$1`, [uuid(1)]);

  assert.equal(await ballotCount(OPEN_RESOLUTION), 2, 'lieka tik dviejų Tarybos narių balsai');
  assert.equal((await results(OPEN_RESOLUTION)).result_for, 2, 'result_for perskaičiuotas');
  assert.equal(
    Number((await db.query(`select count(*)::int as n from meeting_attendance where meeting_id=$1 and member_id=$2`,
      [FUTURE_MEETING, uuid(1)])).rows[0].n),
    0,
    'dalyvavimas būsimame posėdyje pašalintas'
  );
  assert.match(
    (await db.query(`select old_data->>'reason' as reason from audit_log order by created_at desc limit 1`)).rows[0].reason,
    /member_not_council_anymore/
  );
  // The purge never writes to `meetings`: the quorum base is the bylaws guard's business
  // (captured on the meeting day and locked afterwards), not a consequence of a Council change.
  assert.deepEqual(
    await meetingBase(FUTURE_MEETING),
    { total_members_at_time: COUNCIL_SIZE, quorum_required: Math.floor(COUNCIL_SIZE / 2) + 1, snapshot_total: null },
    'posėdžio narių bazė valymo neliečiama'
  );
});

scenario('Taryba: rolės pakeitimas į revizorių atima balso teisę (6.2 p.)', {}, async () => {
  for (const i of [1, 2, 3]) await ballot(OPEN_RESOLUTION, uuid(i));

  await db.query(`update community_management set role='revizorius' where member_id=$1`, [uuid(1)]);

  assert.equal(await ballotCount(OPEN_RESOLUTION), 2);
  assert.equal((await results(OPEN_RESOLUTION)).result_for, 2);
});

scenario('Taryba: galutinio nutarimo balsai neliečiami', {}, async () => {
  await startedMeeting();
  assert.equal((await meetingBase(STARTED_MEETING)).snapshot_total, COUNCIL_SIZE, 'pradėto posėdžio bazė užfiksuota');

  for (const i of [1, 2, 3]) await ballot(FINAL_RESOLUTION, uuid(i));
  await db.query(`update resolutions set status='patvirtintas',result_for=3,result_against=0,result_abstain=0,
    ballot_snapshot='{"uz":3,"pries":0,"susilaike":0}' where id=$1`, [FINAL_RESOLUTION]);

  // Still-open question of the future Council meeting, voted early by the same members.
  for (const i of [1, 2]) await ballot(OPEN_RESOLUTION, uuid(i));
  await db.query(`update resolutions set result_for=2 where id=$1`, [OPEN_RESOLUTION]);

  await db.query(`delete from community_management where member_id=$1`, [uuid(1)]);

  const closed = await results(FINAL_RESOLUTION);
  assert.equal(await ballotCount(FINAL_RESOLUTION), 3, 'galutinio nutarimo balsai lieka');
  assert.equal(closed.result_for, 3, 'galutinio nutarimo suvestinė nekeičiama');
  assert.equal(closed.participants_at_decision, COUNCIL_SIZE, 'dalyvių skaičius sprendimo metu užfiksuotas');
  assert.deepEqual(
    await meetingBase(STARTED_MEETING),
    { total_members_at_time: COUNCIL_SIZE, quorum_required: Math.floor(COUNCIL_SIZE / 2) + 1, snapshot_total: COUNCIL_SIZE },
    'užfiksuota pradėto posėdžio bazė valymo neliečiama'
  );

  assert.equal(await ballotCount(OPEN_RESOLUTION), 1, 'būsimo posėdžio atviro klausimo balsas ištrintas');
  assert.equal((await results(OPEN_RESOLUTION)).result_for, 1);
});

scenario('Taryba: likusių narių balsai nepaliečiami', {}, async () => {
  for (const i of [1, 2, 3]) await ballot(OPEN_RESOLUTION, uuid(i));

  await db.query(`update community_management set sort_order=5 where member_id=$1`, [uuid(2)]);

  assert.equal(await ballotCount(OPEN_RESOLUTION), 3, 'nesusijęs pakeitimas nieko netrina');
});

scenario('Taryba: dar neprasidėjusi kadencija (term_start ateityje) nesuteikia balso', {}, async () => {
  for (const i of [1, 2, 3]) await ballot(OPEN_RESOLUTION, uuid(i));

  // The same rule as the bylaws guard: a seat whose term has not begun is not a Council seat yet.
  await db.query(`update community_management set term_start=(now() AT TIME ZONE 'Europe/Vilnius')::date + 1 where member_id=$1`, [uuid(1)]);

  assert.equal(await ballotCount(OPEN_RESOLUTION), 2, 'būsimos kadencijos nario balsas išvalytas');
  assert.equal((await results(OPEN_RESOLUTION)).result_for, 2);
  assert.equal(
    (await db.query('select public._is_current_council_member($1) as c', [uuid(1)])).rows[0].c,
    false,
    '049 kriterijus sutampa su bylaws_participation_guard'
  );
});
