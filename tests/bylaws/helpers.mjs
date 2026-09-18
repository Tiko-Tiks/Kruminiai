import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const packages = new Set(['zod', 'clsx', 'tailwind-merge', 'date-fns', 'date-fns/locale']);
const localLibraries = new Set(['authz', 'constants', 'quorum', 'protocol-text', 'utils', 'voting-window', 'bylaws', 'decision-validation']);

/** Execute the real TS implementation. All I/O modules must be explicitly replaced.
 * This is an application unit-test boundary, NOT an emulation of Postgres/RLS.
 * A new unrecognised import fails closed rather than loading a production client.
 */
export function loadSource(relativePath, mocks = {}) {
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path).exports;
    const module = { exports: {} };
    cache.set(path, module);
    const code = ts.transpileModule(readFileSync(resolve(root, path), 'utf8'), {
      fileName: path,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText;
    const isolatedRequire = (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (packages.has(id)) return require(id);
      if (id.startsWith('@/lib/') && localLibraries.has(id.slice(6))) {
        return load(`src/lib/${id.slice(6)}.ts`);
      }
      throw new Error(`Unmocked dependency blocked: ${id}`);
    };
    new Function('require', 'module', 'exports', code)(isolatedRequire, module, module.exports);
    return module.exports;
  }
  return load(relativePath);
}

/** In-memory, query-aware double; never reads env files or connects to a server. */
export function fakeDatabase(seed = {}, { userId = 'test-admin', errors = {} } = {}) {
  const tables = structuredClone(seed);
  const writes = [];
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }) },
    from(table) {
      if (!Object.hasOwn(tables, table)) throw new Error(`Unconfigured test table: ${table}`);
      let operation = 'select', values, one = false, max = Infinity, selection = '*';
      const filters = [];
      const query = {
        select(columns = '*') { selection = columns; return query; },
        eq(key, value) { filters.push(row => row[key] === value); return query; },
        in(key, values) { filters.push(row => values.includes(row[key])); return query; },
        ilike(key, value) {
          filters.push(row => String(row[key] ?? '').toLowerCase() === value.toLowerCase()); return query;
        },
        order() { return query; },
        limit(value) { max = value; return query; },
        single() { one = true; return query; },
        maybeSingle() { one = true; return query; },
        insert(value) { operation = 'insert'; values = value; return query; },
        update(value) { operation = 'update'; values = value; return query; },
        then(onFulfilled, onRejected) {
          calls.push({ table, operation, selection });
          const injectedError = errors[`${table}:${operation}`];
          if (injectedError) return Promise.resolve({ data: null, error: { message: injectedError } }).then(onFulfilled, onRejected);
          let rows = tables[table].filter(row => filters.every(filter => filter(row))).slice(0, max);
          if (operation !== 'select') {
            writes.push({ table, operation, values: structuredClone(values) });
            if (operation === 'insert') {
              rows = (Array.isArray(values) ? values : [values]).map((row, i) => ({ id: `test-${table}-${i}`, ...row }));
              tables[table].push(...rows);
            } else {
              for (const row of rows) Object.assign(row, values);
            }
          }
          // Honour selected columns so fixtures cannot accidentally supply unqueried data.
          if (selection !== '*' && !selection.includes('(')) {
            const keys = selection.split(',').map(key => key.trim());
            rows = rows.map(row => Object.fromEntries(keys.filter(key => key in row).map(key => [key, row[key]])));
          }
          return Promise.resolve({ data: one ? rows[0] ?? null : rows, count: rows.length, error: null }).then(onFulfilled, onRejected);
        },
      };
      return query;
    },
  };
  return { client, tables, writes, calls };
}

export function actionHarness(file, seed = {}, options = {}) {
  const db = fakeDatabase({ profiles: [{ id: 'test-admin', role: 'admin', is_approved: true }], ...seed }, options);
  const notifications = [];
  const mocks = {
    '@/lib/supabase-server': { createServerSupabaseClient: () => db.client },
    '@/lib/supabase-admin': {
      isAdminClientAvailable: () => false,
      createAdminSupabaseClient: () => { throw new Error('Production admin client blocked'); },
    },
    '@/lib/audit': { logAudit: async () => {} },
    '@/lib/revalidate': { revalidateMeetingPaths: () => {} },
    'next/cache': { revalidatePath: () => {} },
    '@/lib/email': { sendEmail: async (...args) => { notifications.push(args); return { success: true }; } },
    '@/lib/notification-log': { logNotification: async () => {} },
    '@/lib/membership-emails': { renderMemberWelcomeEmail: () => 'test email' },
  };
  return { ...db, notifications, actions: loadSource(file, mocks) };
}

export function form(values) {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) result.set(key, String(value));
  return result;
}

export function votingFixture({ attendees = 10, totalMembers = 10, votes = [], qualified = true } = {}) {
  return {
    meetings: [{ id: 'meeting', meeting_type: 'visuotinis', status: 'vyksta', total_members_at_time: totalMembers,
      quorum_required: Math.floor(totalMembers / 2) + 1, meeting_date: '2026-01-20T16:00:00Z' }],
    resolutions: [{ id: 'resolution', meeting_id: 'meeting', title: 'Įstatų keitimas', is_procedural: false,
      requires_qualified_majority: qualified, decision_text: 'Pakeisti įstatus pagal pridėtą projektą.', status: 'balsuojamas' }],
    vote_ballots: votes.map((vote, i) => ({ resolution_id: 'resolution', member_id: `voter-${i}`, vote })),
    meeting_attendance: Array.from({ length: attendees }, (_, i) => ({ meeting_id: 'meeting', member_id: `attendee-${i}` })),
    meeting_announcements: [],
  };
}
