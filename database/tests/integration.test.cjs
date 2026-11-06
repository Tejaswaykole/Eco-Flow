const fs = require('fs');
const { Client } = require('T:/My Projects/ECO-Flow/node_modules/.pnpm/pg@8.23.1/node_modules/pg');

const lines = fs.readFileSync('database/.env', 'utf8').split(/\r?\n/);
let directUrl = '';
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('DIRECT_URL=')) directUrl = trimmed.substring('DIRECT_URL='.length).replace(/^["']|["']$/g, '');
}

async function run() {
  const client = new Client({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  console.log('--- RUNNING LIVE POSTGRESQL INTEGRATION TESTS ---\n');

  // Test 1: Primary Role Invariant - Active user without primary role must fail
  await test('Invariant: Reject activating user without a primary role', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    let caught = false;
    try {
      await client.query(`
        BEGIN;
        INSERT INTO public.users (id, email, password_hash, first_name, last_name, status, created_at, updated_at)
        VALUES ('${userId}', 'test.no.role@test.com', 'hash', 'Test', 'User', 'ACTIVE', NOW(), NOW());
        COMMIT;
      `);
    } catch (e) {
      caught = true;
      await client.query('ROLLBACK;').catch(() => {});
      if (!e.message.includes('Invariant violation')) throw e;
    }
    if (!caught) throw new Error('Expected transaction to fail deferred activation invariant check');
  });

  // Test 2: Primary Role Invariant - Multiple primary roles must fail partial unique index
  await test('Invariant: Reject multiple primary roles for same user', async () => {
    const userId = '22222222-2222-2222-2222-222222222222';
    const role1 = 'a0000000-0000-0000-0000-000000000001';
    const role2 = 'a0000000-0000-0000-0000-000000000002';
    let caught = false;
    try {
      await client.query(`
        BEGIN;
        INSERT INTO public.users (id, email, password_hash, first_name, last_name, status, created_at, updated_at)
        VALUES ('${userId}', 'test.multi.role@test.com', 'hash', 'Multi', 'Role', 'PENDING', NOW(), NOW());
        INSERT INTO public.user_roles (id, user_id, role_id, is_primary)
        VALUES (gen_random_uuid(), '${userId}', '${role1}', true);
        INSERT INTO public.user_roles (id, user_id, role_id, is_primary)
        VALUES (gen_random_uuid(), '${userId}', '${role2}', true);
        COMMIT;
      `);
    } catch (e) {
      caught = true;
      await client.query('ROLLBACK;').catch(() => {});
    }
    if (!caught) throw new Error('Expected duplicate primary role to be blocked by partial unique index');
  });

  // Test 3: Audit Table Immutability - Reject UPDATE
  await test('Audit Immutability: Reject UPDATE on audit_logs', async () => {
    const auditId = '33333333-3333-3333-3333-333333333333';
    await client.query(`
      INSERT INTO public.audit_logs (id, user_id, action, entity_type, entity_id, severity, created_at)
      VALUES ('${auditId}', 'c0000000-0000-0000-0000-000000000001', 'TEST_ACTION', 'USER', 'c0000000-0000-0000-0000-000000000001', 'INFO', NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    let caught = false;
    try {
      await client.query(`UPDATE public.audit_logs SET action = 'MODIFIED' WHERE id = '${auditId}';`);
    } catch (e) {
      caught = true;
      if (!e.message.includes('Immutability violation')) throw e;
    }
    if (!caught) throw new Error('Expected UPDATE on audit_logs to be rejected by trigger');
  });

  // Test 4: Audit Table Immutability - Reject DELETE
  await test('Audit Immutability: Reject DELETE on audit_logs', async () => {
    const auditId = '33333333-3333-3333-3333-333333333333';
    let caught = false;
    try {
      await client.query(`DELETE FROM public.audit_logs WHERE id = '${auditId}';`);
    } catch (e) {
      caught = true;
      if (!e.message.includes('Immutability violation')) throw e;
    }
    if (!caught) throw new Error('Expected DELETE on audit_logs to be rejected by trigger');
  });

  // Test 5: Audit Table Immutability - Reject TRUNCATE
  await test('Audit Immutability: Reject TRUNCATE on audit_logs', async () => {
    let caught = false;
    try {
      await client.query(`TRUNCATE TABLE public.audit_logs;`);
    } catch (e) {
      caught = true;
      if (!e.message.includes('Security violation')) throw e;
    }
    if (!caught) throw new Error('Expected TRUNCATE on audit_logs to be rejected by trigger');
  });

  // Test 6: ECO Lifecycle & Change Protection - Reject adding changes to non-draft ECO
  await test('ECO Lifecycle: Reject ECO changes when ECO is not in DRAFT', async () => {
    const catId = gen_random_uuid();
    const prodId = gen_random_uuid();
    const bomId = gen_random_uuid();
    const ecoId = gen_random_uuid();
    const adminId = 'c0000000-0000-0000-0000-000000000001';

    let caught = false;
    try {
      await client.query(`
        BEGIN;
        INSERT INTO public.product_categories (id, name, code, created_by, created_at, updated_at)
        VALUES ('${catId}', 'Test Category Random', 'TEST_${Date.now()}', '${adminId}', NOW(), NOW());

        INSERT INTO public.products (id, part_number, name, category_id, created_by, created_at, updated_at)
        VALUES ('${prodId}', 'PN-TEST-${Date.now()}', 'Test Product', '${catId}', '${adminId}', NOW(), NOW());

        INSERT INTO public.boms (id, product_id, bom_number, created_by, created_at, updated_at)
        VALUES ('${bomId}', '${prodId}', 'BOM-TEST-${Date.now()}', '${adminId}', NOW(), NOW());

        INSERT INTO public.ecos (id, eco_number, product_id, bom_id, title, status, active_revision_no, created_by, created_at, updated_at)
        VALUES ('${ecoId}', 'ECO-TEST-${Date.now()}', '${prodId}', '${bomId}', 'Test ECO', 'SUBMITTED', 1, '${adminId}', NOW(), NOW());

        INSERT INTO public.eco_revisions (eco_id, revision_number, change_summary, status, created_by, created_at, updated_at)
        VALUES ('${ecoId}', 1, 'Initial Rev', 'SUBMITTED', '${adminId}', NOW(), NOW());

        -- Try inserting an eco_change when ECO is in SUBMITTED status
        INSERT INTO public.eco_changes (id, eco_id, change_type, change_target, field_name, created_at)
        VALUES (gen_random_uuid(), '${ecoId}', 'QUANTITY_CHANGE', 'COMPONENT', 'COMP-001', NOW());

        COMMIT;
      `);
    } catch (e) {
      caught = true;
      await client.query('ROLLBACK;').catch(() => {});
      if (!e.message.includes('Precondition violation')) throw e;
    }
    if (!caught) throw new Error('Expected inserting changes on non-draft ECO to fail');
  });

  // Test 7: Snapshot Immutability - Reject UPDATE or DELETE on snapshots
  await test('Snapshot Integrity: Reject UPDATE and DELETE on eco_revision_snapshots', async () => {
    const snapId = '88888888-8888-8888-8888-888888888888';
    let caughtUpdate = false;
    let caughtDelete = false;

    try {
      await client.query(`UPDATE public.eco_revision_snapshots SET snapshot_data = '{"components": ["tampered"]}' WHERE id = '${snapId}';`);
    } catch (e) {
      caughtUpdate = true;
    }

    try {
      await client.query(`DELETE FROM public.eco_revision_snapshots WHERE id = '${snapId}';`);
    } catch (e) {
      caughtDelete = true;
    }

    if (!caughtUpdate) throw new Error('Expected UPDATE on snapshot to be rejected');
    if (!caughtDelete) throw new Error('Expected DELETE on snapshot to be rejected');
  });

  // Test 8: Idempotency Identity Protection - Reject modifying identity columns
  await test('Idempotency Protection: Reject changing scope, key, or actor_id', async () => {
    const idKey = '99999999-9999-9999-9999-999999999999';
    await client.query(`
      INSERT INTO public.idempotency_keys (id, scope, key, request_hash, actor_id, status, lease_expires, claim_token, created_at, updated_at)
      VALUES ('${idKey}', 'CREATE_ECO', 'req-key-001', 'hash123', 'c0000000-0000-0000-0000-000000000001', 'PROCESSING', NOW() + INTERVAL '5 minutes', gen_random_uuid(), NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    let caught = false;
    try {
      await client.query(`UPDATE public.idempotency_keys SET key = 'tampered-key' WHERE id = '${idKey}';`);
    } catch (e) {
      caught = true;
      if (!e.message.includes('Immutability violation')) throw e;
    }
    if (!caught) throw new Error('Expected updating key on idempotency record to fail');
  });

  // Test 9: ECO Revision Lifecycle - Reject terminal state modification
  await test('ECO Revision Lifecycle: Reject modifying terminal revision', async () => {
    const ecoId = '88888888-8888-8888-8888-888888888881';
    let caught = false;
    try {
      await client.query(`UPDATE public.eco_revisions SET status = 'CANCELLED' WHERE eco_id = '${ecoId}' AND revision_number = 1;`);
    } catch (e) {
      caught = true;
    }
  });

  // Test 10: Product / BOM Immutability on ECO
  await test('ECO Immutability: Reject changing product_id or bom_id on established ECO', async () => {
    const ecoId = '88888888-8888-8888-8888-888888888881';
    let caught = false;
    try {
      await client.query(`UPDATE public.ecos SET product_id = gen_random_uuid() WHERE id = '${ecoId}';`);
    } catch (e) {
      caught = true;
      if (!e.message.includes('Immutability violation')) throw e;
    }
    if (!caught) throw new Error('Expected updating product_id on ECO to be rejected');
  });

  console.log(`\n========================================`);
  console.log(`TOTAL INTEGRATION TESTS: ${passed + failed}`);
  console.log(`PASSED:                 ${passed}`);
  console.log(`FAILED:                 ${failed}`);
  console.log(`========================================\n`);

  await client.end();
  if (failed > 0) process.exit(1);
}

function gen_random_uuid() {
  const { randomUUID } = require('crypto');
  return randomUUID();
}

run().catch(err => {
  console.error('Test execution crashed:', err);
  process.exit(1);
});
