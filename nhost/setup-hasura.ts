/**
 * Hasura Metadata Setup Script
 *
 * Applies all table tracking, relationships, permissions, and actions
 * to the Hasura instance via the Metadata API.
 *
 * Run with: npx ts-node setup-hasura.ts
 */

import fs from 'fs';
import path from 'path';

const HASURA_URL = process.env.HASURA_URL || 'http://localhost:8080';
const ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'nhost-admin-secret';

async function runSql(sql: string) {
  const res = await fetch(`${HASURA_URL}/v2/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify({
      type: 'run_sql',
      args: {
        source: 'default',
        sql,
      },
    }),
  });
  const data = await res.json();
  if (data.errors || data.error) {
    console.warn('⚠️ SQL Warning:', data.error || data.errors);
  } else {
    console.log('✅ SQL Migration executed successfully');
  }
  return data;
}

async function hasuraRequest(body: any) {
  const res = await fetch(`${HASURA_URL}/v1/metadata`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok && data.code !== 'already-tracked' && data.code !== 'already-exists'
      && data.code !== 'constraint-violation') {
    console.warn(`⚠️  ${body.type}: ${data.error || JSON.stringify(data)}`);
  } else {
    console.log(`✅ ${body.type}${body.args?.table?.name ? ` (${body.args.table.name})` : ''}`);
  }
  return data;
}

async function trackTable(name: string) {
  return hasuraRequest({
    type: 'pg_track_table',
    args: {
      source: 'default',
      table: { schema: 'public', name },
    },
  });
}

async function trackRelationship(
  table: string,
  name: string,
  type: 'object' | 'array',
  config: any
) {
  const reqType = type === 'object' ? 'pg_create_object_relationship' : 'pg_create_array_relationship';
  return hasuraRequest({
    type: reqType,
    args: {
      source: 'default',
      table: { schema: 'public', name: table },
      name,
      using: config,
    },
  });
}

async function setPermission(
  table: string,
  role: string,
  operation: 'select' | 'insert' | 'update' | 'delete',
  permission: any
) {
  return hasuraRequest({
    type: `pg_create_${operation}_permission`,
    args: {
      source: 'default',
      table: { schema: 'public', name: table },
      role,
      permission,
    },
  });
}

async function main() {
  console.log('\n🔧 Setting up Hasura schema and metadata...\n');

  // ── 0. Run SQL Migrations ──────────────────────────────
  console.log('--- Running SQL schema migrations & seed ---');
  try {
    const schemaSql = fs.readFileSync(
      path.join(__dirname, 'migrations', 'default', '1_initial', 'up.sql'),
      'utf8'
    );
    await runSql(schemaSql);
  } catch (err: any) {
    console.warn('⚠️ Could not load up.sql:', err.message);
  }

  try {
    const seedSql = fs.readFileSync(
      path.join(__dirname, 'seeds', 'default', 'seed.sql'),
      'utf8'
    );
    await runSql(seedSql);
  } catch (err: any) {
    console.warn('⚠️ Could not load seed.sql:', err.message);
  }

  // ── 1. Track Tables ────────────────────────────────────
  console.log('\n--- Tracking tables ---');
  const tables = [
    'users', 'organizations', 'org_members', 'workflows',
    'workflow_steps', 'workflow_triggers', 'workflow_runs',
    'step_runs', 'workflow_data', 'org_usage_stats',
  ];

  for (const t of tables) {
    await trackTable(t);
  }

  // ── 2. Relationships ──────────────────────────────────
  console.log('\n--- Creating relationships ---');

  // organizations
  await trackRelationship('organizations', 'org_members', 'array', {
    foreign_key_constraint_on: {
      column: 'org_id',
      table: { schema: 'public', name: 'org_members' },
    },
  });
  await trackRelationship('organizations', 'workflows', 'array', {
    foreign_key_constraint_on: {
      column: 'org_id',
      table: { schema: 'public', name: 'workflows' },
    },
  });

  // org_members
  await trackRelationship('org_members', 'organization', 'object', {
    foreign_key_constraint_on: 'org_id',
  });
  await trackRelationship('org_members', 'user', 'object', {
    foreign_key_constraint_on: 'user_id',
  });

  // workflows
  await trackRelationship('workflows', 'organization', 'object', {
    foreign_key_constraint_on: 'org_id',
  });
  await trackRelationship('workflows', 'workflow_steps', 'array', {
    foreign_key_constraint_on: {
      column: 'workflow_id',
      table: { schema: 'public', name: 'workflow_steps' },
    },
  });
  await trackRelationship('workflows', 'workflow_triggers', 'array', {
    foreign_key_constraint_on: {
      column: 'workflow_id',
      table: { schema: 'public', name: 'workflow_triggers' },
    },
  });
  await trackRelationship('workflows', 'workflow_runs', 'array', {
    foreign_key_constraint_on: {
      column: 'workflow_id',
      table: { schema: 'public', name: 'workflow_runs' },
    },
  });

  // workflow_steps
  await trackRelationship('workflow_steps', 'workflow', 'object', {
    foreign_key_constraint_on: 'workflow_id',
  });

  // workflow_triggers
  await trackRelationship('workflow_triggers', 'workflow', 'object', {
    foreign_key_constraint_on: 'workflow_id',
  });

  // workflow_runs
  await trackRelationship('workflow_runs', 'workflow', 'object', {
    foreign_key_constraint_on: 'workflow_id',
  });
  await trackRelationship('workflow_runs', 'step_runs', 'array', {
    foreign_key_constraint_on: {
      column: 'workflow_run_id',
      table: { schema: 'public', name: 'step_runs' },
    },
  });

  // step_runs
  await trackRelationship('step_runs', 'workflow_run', 'object', {
    foreign_key_constraint_on: 'workflow_run_id',
  });
  await trackRelationship('step_runs', 'workflow_step', 'object', {
    foreign_key_constraint_on: 'workflow_step_id',
  });

  // workflow_data
  await trackRelationship('workflow_data', 'organization', 'object', {
    foreign_key_constraint_on: 'org_id',
  });
  await trackRelationship('workflow_data', 'workflow_run', 'object', {
    foreign_key_constraint_on: 'workflow_run_id',
  });
  await trackRelationship('workflow_data', 'step_run', 'object', {
    foreign_key_constraint_on: 'step_run_id',
  });

  // ── 3. Permissions (Layer 1: Org + Role Scoping) ──────
  console.log('\n--- Setting permissions ---');

  // --- users ---
  await setPermission('users', 'user', 'select', {
    columns: ['id', 'email', 'display_name', 'created_at'],
    filter: { id: { _eq: 'X-Hasura-User-Id' } },
  });

  // --- organizations: SELECT ---
  await setPermission('organizations', 'user', 'select', {
    columns: '*',
    filter: {
      org_members: { user_id: { _eq: 'X-Hasura-User-Id' } },
    },
  });

  // --- organizations: UPDATE (owner only) ---
  await setPermission('organizations', 'user', 'update', {
    columns: ['name', 'quota_limit'],
    filter: {
      org_members: {
        _and: [
          { user_id: { _eq: 'X-Hasura-User-Id' } },
          { role: { _eq: 'owner' } },
        ],
      },
    },
  });

  // --- org_members: SELECT ---
  await setPermission('org_members', 'user', 'select', {
    columns: '*',
    filter: {
      organization: {
        org_members: { user_id: { _eq: 'X-Hasura-User-Id' } },
      },
    },
  });

  // --- org_members: INSERT (owner only) ---
  await setPermission('org_members', 'user', 'insert', {
    columns: ['id', 'org_id', 'user_id', 'role'],
    check: {
      organization: {
        org_members: {
          _and: [
            { user_id: { _eq: 'X-Hasura-User-Id' } },
            { role: { _eq: 'owner' } },
          ],
        },
      },
    },
  });

  // --- org_members: UPDATE (owner only) ---
  await setPermission('org_members', 'user', 'update', {
    columns: ['role'],
    filter: {
      organization: {
        org_members: {
          _and: [
            { user_id: { _eq: 'X-Hasura-User-Id' } },
            { role: { _eq: 'owner' } },
          ],
        },
      },
    },
  });

  // --- org_members: DELETE (owner only) ---
  await setPermission('org_members', 'user', 'delete', {
    filter: {
      organization: {
        org_members: {
          _and: [
            { user_id: { _eq: 'X-Hasura-User-Id' } },
            { role: { _eq: 'owner' } },
          ],
        },
      },
    },
  });

  // --- workflows: SELECT ---
  await setPermission('workflows', 'user', 'select', {
    columns: '*',
    filter: {
      organization: {
        org_members: { user_id: { _eq: 'X-Hasura-User-Id' } },
      },
    },
  });

  // --- workflows: INSERT (owner/editor) ---
  await setPermission('workflows', 'user', 'insert', {
    columns: ['id', 'org_id', 'name', 'description', 'is_active', 'created_by'],
    check: {
      organization: {
        org_members: {
          _and: [
            { user_id: { _eq: 'X-Hasura-User-Id' } },
            { role: { _in: ['owner', 'editor'] } },
          ],
        },
      },
    },
    set: { created_by: 'X-Hasura-User-Id' },
  });

  // --- workflows: UPDATE (owner/editor) ---
  await setPermission('workflows', 'user', 'update', {
    columns: ['name', 'description', 'is_active', 'updated_at'],
    filter: {
      organization: {
        org_members: {
          _and: [
            { user_id: { _eq: 'X-Hasura-User-Id' } },
            { role: { _in: ['owner', 'editor'] } },
          ],
        },
      },
    },
  });

  // --- workflows: DELETE (owner only) ---
  await setPermission('workflows', 'user', 'delete', {
    filter: {
      organization: {
        org_members: {
          _and: [
            { user_id: { _eq: 'X-Hasura-User-Id' } },
            { role: { _eq: 'owner' } },
          ],
        },
      },
    },
  });

  // --- workflow_steps: SELECT ---
  await setPermission('workflow_steps', 'user', 'select', {
    columns: '*',
    filter: {
      workflow: {
        organization: {
          org_members: { user_id: { _eq: 'X-Hasura-User-Id' } },
        },
      },
    },
  });

  // --- workflow_steps: INSERT (owner/editor) ---
  await setPermission('workflow_steps', 'user', 'insert', {
    columns: ['id', 'workflow_id', 'step_order', 'name', 'step_type', 'config'],
    check: {
      workflow: {
        organization: {
          org_members: {
            _and: [
              { user_id: { _eq: 'X-Hasura-User-Id' } },
              { role: { _in: ['owner', 'editor'] } },
            ],
          },
        },
      },
    },
  });

  // --- workflow_steps: UPDATE (owner/editor) ---
  await setPermission('workflow_steps', 'user', 'update', {
    columns: ['step_order', 'name', 'step_type', 'config', 'updated_at'],
    filter: {
      workflow: {
        organization: {
          org_members: {
            _and: [
              { user_id: { _eq: 'X-Hasura-User-Id' } },
              { role: { _in: ['owner', 'editor'] } },
            ],
          },
        },
      },
    },
  });

  // --- workflow_steps: DELETE (owner/editor) ---
  await setPermission('workflow_steps', 'user', 'delete', {
    filter: {
      workflow: {
        organization: {
          org_members: {
            _and: [
              { user_id: { _eq: 'X-Hasura-User-Id' } },
              { role: { _in: ['owner', 'editor'] } },
            ],
          },
        },
      },
    },
  });

  // --- workflow_triggers: SELECT ---
  await setPermission('workflow_triggers', 'user', 'select', {
    columns: '*',
    filter: {
      workflow: {
        organization: {
          org_members: { user_id: { _eq: 'X-Hasura-User-Id' } },
        },
      },
    },
  });

  // --- workflow_triggers: INSERT (owner/editor) ---
  await setPermission('workflow_triggers', 'user', 'insert', {
    columns: ['id', 'workflow_id', 'trigger_type', 'config', 'is_active'],
    check: {
      workflow: {
        organization: {
          org_members: {
            _and: [
              { user_id: { _eq: 'X-Hasura-User-Id' } },
              { role: { _in: ['owner', 'editor'] } },
            ],
          },
        },
      },
    },
  });

  // --- workflow_triggers: UPDATE (owner/editor) ---
  await setPermission('workflow_triggers', 'user', 'update', {
    columns: ['trigger_type', 'config', 'is_active'],
    filter: {
      workflow: {
        organization: {
          org_members: {
            _and: [
              { user_id: { _eq: 'X-Hasura-User-Id' } },
              { role: { _in: ['owner', 'editor'] } },
            ],
          },
        },
      },
    },
  });

  // --- workflow_triggers: DELETE (owner/editor) ---
  await setPermission('workflow_triggers', 'user', 'delete', {
    filter: {
      workflow: {
        organization: {
          org_members: {
            _and: [
              { user_id: { _eq: 'X-Hasura-User-Id' } },
              { role: { _in: ['owner', 'editor'] } },
            ],
          },
        },
      },
    },
  });

  // --- workflow_runs: SELECT ---
  await setPermission('workflow_runs', 'user', 'select', {
    columns: '*',
    filter: {
      workflow: {
        organization: {
          org_members: { user_id: { _eq: 'X-Hasura-User-Id' } },
        },
      },
    },
  });

  // --- workflow_runs: INSERT (owner/editor) ---
  await setPermission('workflow_runs', 'user', 'insert', {
    columns: ['id', 'workflow_id', 'status', 'triggered_by', 'started_by', 'started_at'],
    check: {
      workflow: {
        organization: {
          org_members: {
            _and: [
              { user_id: { _eq: 'X-Hasura-User-Id' } },
              { role: { _in: ['owner', 'editor'] } },
            ],
          },
        },
      },
    },
  });

  // --- step_runs: SELECT ---
  await setPermission('step_runs', 'user', 'select', {
    columns: '*',
    filter: {
      workflow_run: {
        workflow: {
          organization: {
            org_members: { user_id: { _eq: 'X-Hasura-User-Id' } },
          },
        },
      },
    },
  });

  // --- workflow_data: SELECT ---
  await setPermission('workflow_data', 'user', 'select', {
    columns: '*',
    filter: {
      organization: {
        org_members: { user_id: { _eq: 'X-Hasura-User-Id' } },
      },
    },
  });

  // --- org_usage_stats: SELECT ---
  // For views, we use a simpler permission since it's already org-scoped
  await setPermission('org_usage_stats', 'user', 'select', {
    columns: '*',
    filter: {},
  });

  // ── 4. Actions ────────────────────────────────────────
  console.log('\n--- Creating actions ---');

  // triggerWorkflowRun
  await hasuraRequest({
    type: 'create_action',
    args: {
      name: 'triggerWorkflowRun',
      definition: {
        kind: 'synchronous',
        handler: 'http://functions:3001/api/trigger-workflow-run',
        type: 'mutation',
        arguments: [
          { name: 'workflow_id', type: 'uuid!' },
        ],
        output_type: 'TriggerWorkflowRunOutput!',
        forward_client_headers: true,
        timeout: 120,
      },
    },
  });

  // Custom types for actions
  await hasuraRequest({
    type: 'set_custom_types',
    args: {
      input_objects: [],
      objects: [
        {
          name: 'TriggerWorkflowRunOutput',
          fields: [
            { name: 'workflow_run_id', type: 'uuid!' },
            { name: 'status', type: 'String!' },
            { name: 'message', type: 'String!' },
          ],
        },
        {
          name: 'ApproveStepOutput',
          fields: [
            { name: 'success', type: 'Boolean!' },
            { name: 'message', type: 'String!' },
            { name: 'workflow_run_id', type: 'uuid!' },
          ],
        },
        {
          name: 'WebhookTriggerOutput',
          fields: [
            { name: 'workflow_run_id', type: 'uuid!' },
            { name: 'status', type: 'String!' },
            { name: 'message', type: 'String!' },
          ],
        },
        {
          name: 'RegisterUserOutput',
          fields: [
            { name: 'user_id', type: 'uuid!' },
            { name: 'token', type: 'String!' },
            { name: 'message', type: 'String!' },
          ],
        },
        {
          name: 'LoginUserOutput',
          fields: [
            { name: 'user_id', type: 'uuid!' },
            { name: 'token', type: 'String!' },
            { name: 'message', type: 'String!' },
          ],
        },
      ],
      scalars: [],
      enums: [],
    },
  });

  // approveStep
  await hasuraRequest({
    type: 'create_action',
    args: {
      name: 'approveStep',
      definition: {
        kind: 'synchronous',
        handler: 'http://functions:3001/api/approve-step',
        type: 'mutation',
        arguments: [
          { name: 'step_run_id', type: 'uuid!' },
        ],
        output_type: 'ApproveStepOutput!',
        forward_client_headers: true,
        timeout: 30,
      },
    },
  });

  // webhookTrigger
  await hasuraRequest({
    type: 'create_action',
    args: {
      name: 'webhookTrigger',
      definition: {
        kind: 'synchronous',
        handler: 'http://functions:3001/api/webhook-trigger',
        type: 'mutation',
        arguments: [
          { name: 'workflow_id', type: 'uuid!' },
          { name: 'secret', type: 'String!' },
          { name: 'payload', type: 'jsonb' },
        ],
        output_type: 'WebhookTriggerOutput!',
        forward_client_headers: false,
        timeout: 120,
      },
    },
  });

  // registerUser
  await hasuraRequest({
    type: 'create_action',
    args: {
      name: 'registerUser',
      definition: {
        kind: 'synchronous',
        handler: 'http://functions:3001/api/register-user',
        type: 'mutation',
        arguments: [
          { name: 'email', type: 'String!' },
          { name: 'password', type: 'String!' },
          { name: 'display_name', type: 'String!' },
        ],
        output_type: 'RegisterUserOutput!',
        forward_client_headers: false,
        timeout: 30,
      },
    },
  });

  // loginUser
  await hasuraRequest({
    type: 'create_action',
    args: {
      name: 'loginUser',
      definition: {
        kind: 'synchronous',
        handler: 'http://functions:3001/api/login-user',
        type: 'mutation',
        arguments: [
          { name: 'email', type: 'String!' },
          { name: 'password', type: 'String!' },
        ],
        output_type: 'LoginUserOutput!',
        forward_client_headers: false,
        timeout: 30,
      },
    },
  });

  // Action permissions
  for (const actionName of ['triggerWorkflowRun', 'approveStep']) {
    await hasuraRequest({
      type: 'create_action_permission',
      args: {
        action: actionName,
        role: 'user',
      },
    });
  }

  for (const actionName of ['webhookTrigger', 'registerUser', 'loginUser']) {
    await hasuraRequest({
      type: 'create_action_permission',
      args: {
        action: actionName,
        role: 'public',
      },
    });
  }

  console.log('\n✨ Hasura metadata setup complete!\n');
}

main().catch(console.error);
