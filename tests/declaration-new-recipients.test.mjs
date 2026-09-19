import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource, fakeDatabase } from './bylaws/helpers.mjs';
import * as texts from '../src/lib/notification-texts.ts';

for (const submittedAt of [null, '2026-01-01']) {
  test(`pirmas siuntimas neliečia esamos deklaracijos (submitted=${submittedAt})`, async () => {
    const existing = { member_id: 'existing', token: 'old-token', expires_at: '2020-01-01', submitted_at: submittedAt };
    const fake = fakeDatabase({ membership_declarations: [existing] });
    const sent = [];
    const action = loadSource('src/actions/declarations.ts', {
      '@/lib/supabase-server': { createServerSupabaseClient: () => fake.client },
      '@/lib/authz': { requireAdmin: async () => ({ user: { id: 'admin' } }) },
      '@/lib/audit': { logAudit: async () => {} },
      '@/lib/infobip': { sendSms: async phone => { sent.push(phone); return { success: true }; }, normalizePhone: x => x },
      '@/lib/email': { sendEmail: async () => { throw Error('Unexpected email'); }, renderBrandedEmail: () => '' },
      '@/lib/notification-log': { logNotification: async () => {} },
      '@/actions/reminders': { getMembersWithDebts: async () => ({ members: [
        { id: 'existing', phone: '60000001', first_name: 'Test', last_name: 'Old' },
        { id: 'new', phone: '60000002', first_name: 'Test', last_name: 'New' },
      ] }) },
      '@/lib/notification-texts': texts,
      'next/cache': { revalidatePath: () => {} },
      'crypto': { randomBytes: () => ({ toString: () => 'new-token' }), randomUUID: () => 'batch-test' },
    });
    const result = await action.generateAndSendDeclarations('2030-12-31');
    assert.equal(result.success, true);
    assert.deepEqual(sent, ['60000002']);
    assert.equal(result.smsSkipped, 1);
    assert.deepEqual(fake.tables.membership_declarations.find(d => d.member_id === 'existing'), existing);
  });
}
