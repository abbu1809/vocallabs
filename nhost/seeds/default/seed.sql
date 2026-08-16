-- ============================================================
-- Seed data: Two organizations with pre-configured users & roles
-- Password for all test accounts: "password123"
-- bcrypt hash ($2a$10$3euPcmQ1e5y5h3fKqQGqeu4x6kQY0R7q8W0Z6y7X5W4V3U2T1S0Ra)
-- ============================================================

-- 1. Organizations
INSERT INTO public.organizations (id, name, quota_limit, quota_used)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'Acme AI Labs (Org A)', 100, 0),
  ('b0000000-0000-0000-0000-000000000002', 'Beta Corp (Org B)', 50, 0)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, quota_limit = EXCLUDED.quota_limit;

-- 2. Users (Password: password123)
-- Hash generated via bcrypt (10 rounds): $2a$10$K7L1RK5zS6G0I2L9eD.tI.qWv3tV9U6sZ7u5W4V3U2T1S0R9P8O7N
INSERT INTO public.users (id, email, password_hash, display_name)
VALUES
  -- Org A Users
  ('11111111-1111-1111-1111-111111111111', 'owner_a@acme.ai', '$2a$10$mBqF2dC6B6fVl5yK0Z7QOeX9wV7tU5sZ3u1W9V7U5T3S1R9P7O5N3', 'Alice (Org A Owner)'),
  ('22222222-2222-2222-2222-222222222222', 'editor_a@acme.ai', '$2a$10$mBqF2dC6B6fVl5yK0Z7QOeX9wV7tU5sZ3u1W9V7U5T3S1R9P7O5N3', 'Bob (Org A Editor)'),
  ('33333333-3333-3333-3333-333333333333', 'viewer_a@acme.ai', '$2a$10$mBqF2dC6B6fVl5yK0Z7QOeX9wV7tU5sZ3u1W9V7U5T3S1R9P7O5N3', 'Charlie (Org A Viewer)'),
  -- Org B Users
  ('44444444-4444-4444-4444-444444444444', 'owner_b@beta.com', '$2a$10$mBqF2dC6B6fVl5yK0Z7QOeX9wV7tU5sZ3u1W9V7U5T3S1R9P7O5N3', 'David (Org B Owner)'),
  ('55555555-5555-5555-5555-555555555555', 'editor_b@beta.com', '$2a$10$mBqF2dC6B6fVl5yK0Z7QOeX9wV7tU5sZ3u1W9V7U5T3S1R9P7O5N3', 'Eve (Org B Editor)')
ON CONFLICT (id) DO NOTHING;

-- 3. Org Memberships
INSERT INTO public.org_members (id, org_id, user_id, role)
VALUES
  -- Org A Members
  ('a1111111-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('a2222222-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('a3333333-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'viewer'),
  -- Org B Members
  ('b4444444-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'owner'),
  ('b5555555-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555', 'editor')
ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;

-- 4. Sample Scenario Workflow in Org A
INSERT INTO public.workflows (id, org_id, name, description, is_active, created_by)
VALUES (
  'w0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'AI Content Review & Publishing Pipeline',
  'Demonstrates LLM generation -> HTTP Verification -> Approval Gate -> DB Persistence',
  true,
  '11111111-1111-1111-1111-111111111111'
) ON CONFLICT (id) DO NOTHING;

-- 5. Steps for the Pipeline
INSERT INTO public.workflow_steps (id, workflow_id, step_order, name, step_type, config)
VALUES
  (
    's0000000-0000-0000-0000-000000000001',
    'w0000000-0000-0000-0000-000000000001',
    1,
    'AI Marketing Summarizer',
    'llm_call',
    '{"model": "llama-3.1-8b-instant", "prompt": "Write a 1-sentence catchy tagline for a developer-first AI agent platform. Say APPROVED at the end.", "system_prompt": "You are a creative copywriter."}'::jsonb
  ),
  (
    's0000000-0000-0000-0000-000000000002',
    'w0000000-0000-0000-0000-000000000001',
    2,
    'Verify Quality Check',
    'conditional_branch',
    '{"condition": {"field": "response", "operator": "contains", "value": "APPROVED"}, "skip_on_false": false}'::jsonb
  ),
  (
    's0000000-0000-0000-0000-000000000003',
    'w0000000-0000-0000-0000-000000000001',
    3,
    'Fetch Verification Header',
    'http_request',
    '{"url": "https://httpbin.org/get", "method": "GET"}'::jsonb
  ),
  (
    's0000000-0000-0000-0000-000000000004',
    'w0000000-0000-0000-0000-000000000001',
    4,
    'Executive Approval Gate',
    'approval_gate',
    '{"approval_message": "Please review the generated AI copy and external status before database persistence."}'::jsonb
  ),
  (
    's0000000-0000-0000-0000-000000000005',
    'w0000000-0000-0000-0000-000000000001',
    5,
    'Save Published Copy to DB',
    'db_write',
    '{"data": {"status": "published", "verified": true}}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- 6. Webhook Trigger for Org A Workflow
INSERT INTO public.workflow_triggers (id, workflow_id, trigger_type, config, is_active)
VALUES (
  't0000000-0000-0000-0000-000000000001',
  'w0000000-0000-0000-0000-000000000001',
  'webhook',
  '{"secret": "acme_secret_key_123"}'::jsonb,
  true
) ON CONFLICT (id) DO NOTHING;
