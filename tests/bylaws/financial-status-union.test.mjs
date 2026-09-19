import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { migrationsFrom } from './helpers.mjs';

// `get_member_financial_status()` is redefined by TWO migrations: 048 (bylaws;
// installment-aware debt: sum of every payment per period) and 049 (approval
// gate: `not_approved` for a profile without `is_approved`). 049 is applied AFTER
// 048 – in production and, since the files carry the same numbers, on a clean
// database as well – so its body must be the union of both changes. This file
// applies the chain exactly as the directory orders it (no hand-written list, so a
// renumbering cannot quietly reverse the two) and checks that nothing from either
// side is lost at the end of it.
const migration = name => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const db = new PGlite();

// Supabase-owned auth roles are stubbed locally; no credentials, services or network.
await db.exec(`create role anon; create role authenticated; create schema auth;
  create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;`);
for (const file of ['001_initial_schema.sql', '002_voting_schema.sql', '003_voting_tokens.sql',
  '005_resolution_documents.sql', '008_membership_declarations.sql', '009_notification_log.sql',
  '010_declaration_view_tracking.sql', '011_meeting_expulsions.sql', '013_vote_comments_and_management.sql',
  '015_donations_and_projects.sql', '024_meeting_announcements_and_doc_linkage.sql',
  '026_procedural_type_pranesimas.sql', '027_contact_update_tokens.sql', '036_honorary_member_status.sql']) {
  await db.exec(migration(file));
}
// Stand-ins for objects the intervening (not loaded) migrations provide. 049
// replaces `is_admin()` with its real body, which reads `profiles.is_approved`.
await db.exec(`create schema storage; create table storage.buckets(id text primary key, public boolean);
    insert into storage.buckets values ('documents', true), ('images', true);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
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

// Clean-database order, straight from the directory: 046, 047, 048 bylaws, 049, 050, 051.
const chain = migrationsFrom('046');
for (const file of chain) await db.exec(migration(file));

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const MEMBER = uuid(1);
const FEE_PERIOD = uuid(500);
const USER = uuid(600);
const FEE_CENTS = 1200;

/** One active member with an annual fee period, a linked portal profile and the given installments. */
async function setup({ approved = true, amounts = [] } = {}) {
  await db.exec('begin');
  await db.query(`insert into members(id,first_name,last_name,join_date,application_reference,admission_reference,admission_date)
    values ($1,'Testas','Narys','2026-01-01','Prašymas 1','Tarybos 1','2026-01-01')`, [MEMBER]);
  await db.query(`insert into fee_periods(id,year,name,amount_cents,fee_type,decision_reference,decision_date)
    values ($1,2026,'Metinis',$2,'metinis','Visuotinio 1','2026-01-01')`, [FEE_PERIOD, FEE_CENTS]);
  // `handle_new_user` (001) creates the profile row for every auth user; link and approve it here.
  await db.query(`insert into auth.users(id,email,raw_user_meta_data) values ($1,'test@example.invalid','{}')`, [USER]);
  await db.query(`update profiles set role='member',is_approved=$2,member_id=$3 where id=$1`, [USER, approved, MEMBER]);
  for (const amount of amounts) {
    await db.query(`insert into payments(member_id,fee_period_id,amount_cents,receipt_number) values ($1,$2,$3,$4)`,
      [MEMBER, FEE_PERIOD, amount, `Kvitas-${amount}`]);
  }
  await db.query(`select set_config('test.user_id',$1,true)`, [USER]);
}

const status = async () => (await db.query('select get_member_financial_status() as data')).rows[0].data;

function scenario(name, options, fn) {
  test(name, async () => {
    try { await setup(options); await fn(); } finally { await db.exec('rollback'); }
  });
}

for (const amounts of [[500], [500, 700], [500, 800]]) {
  scenario(`049 po įstatų migracijos: įmokos dalimis sumuojamos ${amounts}`, { amounts }, async () => {
    const remaining = Math.max(0, FEE_CENTS - amounts.reduce((a, b) => a + b, 0));
    const data = await status();
    assert.equal(data.error, undefined);
    assert.equal(data.total_debt_cents, remaining, 'skola = suma − visų įmokų suma');
    assert.equal(data.unpaid.length, remaining ? 1 : 0, 'pilnai padengtas laikotarpis nebe skola');
    if (remaining) assert.equal(data.unpaid[0].amount_cents, remaining, 'rodoma tik neapmokėta dalis');
    assert.equal(data.paid.length, amounts.length, 'kiekviena įmoka lieka atskiru įrašu');
  });
}

scenario('049 po įstatų migracijos: nepatvirtintam profiliui – not_approved', { approved: false, amounts: [500] }, async () => {
  assert.equal((await status()).error, 'not_approved');
});

scenario('049 po įstatų migracijos: be sesijos – not_authenticated', { amounts: [500] }, async () => {
  await db.exec(`select set_config('test.user_id','',true)`);
  assert.equal((await status()).error, 'not_authenticated');
});

test('Katalogo eilė: įstatų migracija (048) eina prieš prieigos kontraktą (049) ir balso teisę (050)', () => {
  // Eilė galioja tik tol, kol visi failai turi vienodo pločio `NNN_` prefiksą: laiko žymės
  // failas (14 skaitmenų) rikiuotųsi PO visų `0xx` – būtent taip ir atsirado ši pastaba.
  for (const file of chain) {
    assert.match(file, /^\d{3}_/, `${file}: migracijos failo vardas privalo prasidėti trimis skaitmenimis`);
  }
  const at = name => { const i = chain.indexOf(name); assert.notEqual(i, -1, `${name} yra grandinėje`); return i; };
  assert.ok(at('048_bylaws_enforcement.sql') < at('049_access_contract_hardening.sql'),
    'prieigos kontraktas taikomas PO įstatų migracijos – kitaip ji perrašytų vartus');
  assert.ok(at('049_access_contract_hardening.sql') < at('050_voting_eligibility_helper.sql'));
});

test('Galutinis funkcijos kūnas turi ir patvirtinimo vartus, ir įmokų dalių skaičiavimą', async () => {
  const def = (await db.query(`select pg_get_functiondef('public.get_member_financial_status()'::regprocedure) as def`)).rows[0].def;
  assert.match(def, /not_approved/, '049 vartai išlikę');
  assert.match(def, /greatest\(fp\.amount_cents/, 'įstatų migracijos įmokų dalių skaičiavimas išlikęs');
  assert.doesNotMatch(def, /NOT EXISTS \(\s*SELECT 1 FROM payments/, 'senoji „yra/nėra įrašo" logika negrįžo');
});

test('EXECUTE teisės: authenticated gali, anon negali', async () => {
  const row = (await db.query(`select has_function_privilege('authenticated','public.get_member_financial_status()','execute') as auth_ok,
    has_function_privilege('anon','public.get_member_financial_status()','execute') as anon_ok`)).rows[0];
  assert.equal(row.auth_ok, true);
  assert.equal(row.anon_ok, false);
});

test.after(async () => db.close());


test('051: dokumentų bucket privatus, paveikslėlių lieka viešas', async () => {
  const { rows } = await db.query('select id, public from storage.buckets order by id');
  assert.deepEqual(rows, [{ id: 'documents', public: false }, { id: 'images', public: true }]);
});
