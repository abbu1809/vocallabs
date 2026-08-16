/**
 * webhookTrigger — Hasura Action Handler
 *
 * External systems call this to start a workflow run.
 * Validates webhook secret from trigger config.
 */

import { Request, Response } from 'express';
import { adminClient } from '../graphql-client';
import * as queries from '../queries';
import { executeWorkflow } from '../engine';

interface WebhookPayload {
  action?: { name: string };
  input: {
    workflow_id: string;
    secret: string;
    payload?: any;
  };
  session_variables?: Record<string, string>;
}

export default async function webhookTrigger(req: Request, res: Response) {
  try {
    const body = req.body as WebhookPayload;
    const { workflow_id, secret, payload } = body.input || body;

    if (!workflow_id || !secret) {
      return res.status(400).json({ message: 'workflow_id and secret are required' });
    }

    // 1. Look up the webhook trigger for this workflow
    const triggerData: any = await adminClient.request(queries.GET_WORKFLOW_WEBHOOK_TRIGGER, {
      workflow_id,
    });

    const triggers = triggerData.workflow_triggers;
    if (!triggers || triggers.length === 0) {
      return res.status(404).json({ message: 'No active webhook trigger found for this workflow' });
    }

    const trigger = triggers[0];
    const workflow = trigger.workflow;

    // 2. Validate secret
    const expectedSecret = trigger.config?.secret;
    if (!expectedSecret || secret !== expectedSecret) {
      return res.status(403).json({ message: 'Invalid webhook secret' });
    }

    // 3. Check workflow is active
    if (!workflow.is_active) {
      return res.status(400).json({ message: 'Workflow is not active' });
    }

    // 4. Check quota
    const org = workflow.organization;
    if (org.quota_used >= org.quota_limit) {
      return res.status(429).json({ message: 'Organization quota exhausted' });
    }

    // 5. Create workflow run
    const runData: any = await adminClient.request(queries.CREATE_WORKFLOW_RUN, {
      workflow_id,
      triggered_by: 'webhook',
      started_by: null,
    });

    const workflowRun = runData.insert_workflow_runs_one;

    // 6. Create step runs
    const stepRunObjects = workflow.workflow_steps.map((step: any) => ({
      workflow_run_id: workflowRun.id,
      workflow_step_id: step.id,
      status: 'pending',
    }));

    const stepRunData: any = await adminClient.request(queries.CREATE_STEP_RUNS, {
      objects: stepRunObjects,
    });

    const stepRuns = stepRunData.insert_step_runs.returning;

    // 7. Return immediately
    res.status(200).json({
      workflow_run_id: workflowRun.id,
      status: 'pending',
      message: 'Workflow triggered via webhook successfully',
    });

    // 8. Execute async
    executeWorkflow(
      workflowRun.id,
      org.id,
      workflow.workflow_steps,
      stepRuns
    ).catch((err) => {
      console.error('[webhookTrigger] Execution error:', err);
    });

  } catch (err: any) {
    console.error('[webhookTrigger] Error:', err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
}
