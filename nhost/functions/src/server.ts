/**
 * Express Server — Action Handler Endpoints
 *
 * Serves all Hasura Action handlers and the webhook endpoint.
 */

import express from 'express';
import cors from 'cors';
import triggerWorkflowRun from './handlers/trigger-workflow-run';
import approveStep from './handlers/approve-step';
import webhookTrigger from './handlers/webhook-trigger';
import { registerUser, loginUser, createOrganization } from './handlers/auth';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Hasura Action Handlers ─────────────────────────────────

// Trigger a workflow run (manual)
app.post('/api/trigger-workflow-run', triggerWorkflowRun);

// Approve a paused approval_gate step
app.post('/api/approve-step', approveStep);

// Webhook trigger (external systems)
app.post('/api/webhook-trigger', webhookTrigger);

// ── Auth & Organization Endpoints ──────────────────────────

// Register a new user
app.post('/api/register-user', registerUser);

// Login
app.post('/api/login-user', loginUser);

// Create Organization / Workspace
app.post('/api/create-organization', createOrganization);

// ── Start Server ───────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 Functions server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/healthz`);
  console.log(`   Actions: /api/trigger-workflow-run, /api/approve-step`);
  console.log(`   Webhook: /api/webhook-trigger`);
  console.log(`   Auth:    /api/register-user, /api/login-user`);
});

export default app;
