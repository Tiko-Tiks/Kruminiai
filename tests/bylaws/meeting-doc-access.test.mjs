import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { migrationsFrom } from './helpers.mjs';

// 047's `_can_view_meeting_doc` compared `voting_token_meeting(p_token) = p_meeting_id`
// without guarding NULL: an unknown or expired token yields NULL, `IF NOT NULL` does
// not fire, and an anonymous caller with any bogus token could read a published
// meeting's document RPCs. 049 (and, independently, the bylaws migration 048) wrap every
// term in coalesce(..., false). Two engines: 049 on its own closes the hole, and the
// full clean-database chain (read from the directory) ends closed as well.
const migration = name => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const BASE = ['001_initial_schema.sql', '002_voting_schema.sql', '003_voting_tokens.sql',
  '005_resolution_documents.sql', '008_membership_declarations.sql', '009_notification_log.sql',
  '010_declaration_view_tracking.sql', '011_meeting_expulsions.sql', '013_vote_comments_and_management.sql',
  '015_donations_and_projects.sql', '024_meeting_announcements_and_doc_linkage.sql',
  '026_procedural_type_pranesimas.sql', '027_contact_update_tokens.sql', '036_honorary_member_status.sql'];

/** Isolated engine with the repository schemas and local stand-ins; no network or credentials. */
async function engine(chain) {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;`);
  for (const file of BASE) await db.exec(migration(file));
  await db.exec(`create schema storage; create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
    alter table storage.objects enable row level security;
    create policy test_storage_access on storage.objects for all to authenticated using(true) with check(true);
    grant usage on schema storage to authenticated; grant select,update,delete on storage.objects to authenticated;
    alter table public.meetings add column if not exists is_published boolean not null default true;
    alter table public.profiles add column is_approved boolean not null default false;
    alter table public.profiles add column member_id uuid references public.members(id);
    alter table public.profiles drop constraint profiles_role_check;
    create or replace function public.is_voting_status(p_status text) returns boolean
      language sql immutable as $$ select p_status in ('aktyvus','pasyvus','garbes_narys') $$;
    create or replace function public.is_admin() returns boolean language sql stable as $$ select false $$;
    create or replace function public.is_approved_member() returns boolean language sql stable as
      $$ select exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_approved) $$;
    create or replace function public._is_complete_ballot(p_meeting_id uuid, p_votes jsonb) returns boolean
      language sql stable as $$ select true $$;`);
  for (const file of chain) await db.exec(migration(file));
  return db;
}

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const MEETING = uuid(100);
const MEMBER = uuid(1);

/** A published general meeting with one member; runs inside a transaction that the caller rolls back.
 * With the bylaws migration in the chain, `members` needs admission evidence (3.2 p.). */
async function seed(db, { bylaws }) {
  await db.exec('begin');
  if (bylaws) {
    await db.query(`insert into members(id,first_name,last_name,application_reference,admission_reference,admission_date)
      values ($1,'Testas','Narys','Prašymas 1','Tarybos 1','2026-01-01')`, [MEMBER]);
  } else {
    await db.query(`insert into members(id,first_name,last_name) values ($1,'Testas','Narys')`, [MEMBER]);
  }
  await db.query(`insert into meetings(id,title,meeting_date,location,meeting_type,total_members_at_time,quorum_required,status)
    values ($1,'Visuotinis susirinkimas',now()+interval '10 days','Testinė vieta','visuotinis',1,1,'planuojamas')`, [MEETING]);
}

const elections = async (db, token) =>
  (await db.query('select get_meeting_elections_data($1,$2) as data', [MEETING, token])).rows[0].data;

const chains = {
  'tik #16 grandinė (046 → 047 → 049, be įstatų migracijos)': { bylaws: false,
    files: ['046_token_lifetime_hardening.sql', '047_meeting_doc_rpc_access.sql', '049_access_contract_hardening.sql'] },
  'pilna grandinė katalogo eile (046 → 047 → 048 įstatai → 049 → 050)': { bylaws: true,
    files: migrationsFrom('046') },
};

for (const [label, { bylaws, files }] of Object.entries(chains)) {
  const dbPromise = engine(files);
  const seedDb = db => seed(db, { bylaws });

  test(`${label}: anon su netikru tokenu – forbidden`, async () => {
    const db = await dbPromise;
    try {
      await seedDb(db);
      await db.exec('set local role anon');
      assert.equal((await elections(db, 'unknown-token')).error, 'forbidden');
    } finally { await db.exec('rollback'); }
  });

  test(`${label}: anon be tokeno – forbidden`, async () => {
    const db = await dbPromise;
    try {
      await seedDb(db);
      await db.exec('set local role anon');
      assert.equal((await elections(db, null)).error, 'forbidden');
    } finally { await db.exec('rollback'); }
  });

  test(`${label}: anon su pasibaigusiu tokenu – forbidden`, async () => {
    const db = await dbPromise;
    try {
      await seedDb(db);
      await db.query(`insert into meeting_voting_tokens(meeting_id,member_id,token,expires_at) values ($1,$2,'expired-token',now()-interval '1 day')`, [MEETING, MEMBER]);
      await db.exec('set local role anon');
      assert.equal((await elections(db, 'expired-token')).error, 'forbidden');
    } finally { await db.exec('rollback'); }
  });

  test(`${label}: anon su galiojančiu šio susirinkimo tokenu – leidžiama`, async () => {
    const db = await dbPromise;
    try {
      await seedDb(db);
      await db.query(`insert into meeting_voting_tokens(meeting_id,member_id,token,expires_at) values ($1,$2,'valid-token',now()+interval '1 day')`, [MEETING, MEMBER]);
      await db.exec('set local role anon');
      const data = await elections(db, 'valid-token');
      assert.equal(data.error, undefined);
      assert.equal(data.meeting_id, MEETING);
    } finally { await db.exec('rollback'); }
  });

  test(`${label}: helper'io kūnas su coalesce, teisės tik vidinės`, async () => {
    const db = await dbPromise;
    const row = (await db.query(`select pg_get_functiondef('public._can_view_meeting_doc(uuid,text)'::regprocedure) as def,
      has_function_privilege('anon','public._can_view_meeting_doc(uuid,text)','execute') as anon_ok,
      has_function_privilege('authenticated','public._can_view_meeting_doc(uuid,text)','execute') as auth_ok`)).rows[0];
    assert.match(row.def, /coalesce\(public\.voting_token_meeting\(p_token\)=p_meeting_id,false\)/);
    assert.equal(row.anon_ok, false);
    assert.equal(row.auth_ok, false);
  });

  test.after(async () => (await dbPromise).close());
}
