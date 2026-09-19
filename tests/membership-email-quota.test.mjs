import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { loadSource, fakeDatabase } from './bylaws/helpers.mjs';

const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
  create table public.notification_log(id uuid primary key, recipient text, sent_at timestamptz, channel text, kind text);`);
await db.exec(readFileSync(new URL('../supabase/migrations/055_membership_email_quota.sql', import.meta.url), 'utf8'));
after(() => db.close());
const reserve = async email => (await db.query('select public.reserve_membership_email($1) as allowed', [email])).rows[0].allowed;

test('kvota: 40 vienu metu pateiktų užklausų leidžia tik 30 rezervacijų', async () => {
  await db.exec('truncate membership_email_reservations');
  const results = await Promise.all(Array.from({ length: 40 }, (_, i) => reserve(`test${i}@example.invalid`)));
  assert.equal(results.filter(Boolean).length, 30);
  assert.equal((await db.query('select count(*)::int n from membership_email_reservations')).rows[0].n, 30);
});

test('kvota: vienam gavėjui 3/10 min., raidžių dydis ir tarpai ribos neapeina', async () => {
  await db.exec('truncate membership_email_reservations');
  assert.equal(await reserve('user@example.invalid'), true);
  assert.equal(await reserve('USER@example.invalid'), true);
  assert.equal(await reserve(' user@example.invalid '), true);
  assert.equal(await reserve('user@example.invalid'), false);
  await db.exec("update membership_email_reservations set reserved_at=clock_timestamp()-interval '11 minutes'");
  assert.equal(await reserve('user@example.invalid'), true);
  await db.exec("update membership_email_reservations set reserved_at=clock_timestamp()-interval '61 minutes'");
  assert.equal(await reserve('user@example.invalid'), true);
  assert.equal((await db.query('select count(*)::int n from membership_email_reservations')).rows[0].n, 1);
});

test('kvota: anon/narys negali rezervuoti ar skaityti kvotos, service_role gali vykdyti RPC', async () => {
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await db.query("select has_function_privilege($1,'public.reserve_membership_email(text)','execute') allowed", [role])).rows[0].allowed, false);
    assert.equal((await db.query("select has_table_privilege($1,'public.membership_email_reservations','select') allowed", [role])).rows[0].allowed, false);
  }
  assert.equal((await db.query("select has_function_privilege('service_role','public.reserve_membership_email(text)','execute') allowed")).rows[0].allowed, true);
});

for (const outcome of [{ data: true, error: null }, { data: false, error: null }, { data: null, error: { message: 'unavailable' } }]) {
  test(`registracijos laiškas siunčiamas tik gavus rezervaciją: ${JSON.stringify(outcome)}`, async () => {
    const fake = fakeDatabase({ members: [] });
    let sent = 0;
    const order = [];
    fake.client.auth.admin = { listUsers: async () => ({ data: { users: [{ email: 'test@example.invalid', created_at: new Date().toISOString() }] }, error: null }) };
    fake.client.rpc = async name => { assert.equal(name, 'reserve_membership_email'); order.push('reserve'); return outcome; };
    const action = loadSource('src/actions/membership.ts', {
      '@/lib/email': { sendEmail: async () => { order.push('send'); sent++; return { success: true }; } },
      '@/lib/notification-log': { logNotificationSystem: async () => {} },
      '@/lib/membership-emails': { renderMembershipRequestEmail: () => '<p>Test</p>' },
      '@/lib/supabase-admin': { createAdminSupabaseClient: () => fake.client, isAdminClientAvailable: () => true },
    });
    await action.sendMembershipRequestEmail({ email: 'test@example.invalid', firstName: 'Test', lastName: 'User' });
    assert.equal(sent, outcome.data === true && !outcome.error ? 1 : 0);
    assert.deepEqual(order, sent ? ['reserve', 'send'] : ['reserve']);
  });
}
