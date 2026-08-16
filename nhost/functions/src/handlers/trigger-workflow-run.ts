/**
 * triggerWorkflowRun — Hasura Action Handler
 *
 * 1. Verifies caller is owner/editor in the workflow's org
 * 2. Checks org quota
 * 3. Creates workflow_run + step_runs
 * 4. Executes steps via the engine (async, non-blocking response)
 */

import { Request, Response } from 'express';
import { adminClient } from '../graphql-client';
import * as queries from '../queries';
import { executeWorkflow } from '../engine';

interface HasuraActionPayload {
  action: { name: string };
  input: { workflow_id: string };
  session_variables: Record<string, string>;
}

export default async function triggerWorkflowRun(req: Request, res: Response) {
  try {
    const payload = req.body as HasuraActionPayload;
    const workflowId = payload.input.workflow_id;
    const userId = payload.session_variables['x-hasura-user-id'];

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // 1. Fetch workflow with org and steps
    const data: any = await adminClient.request(queries.GET_WORKFLOW_WITH_STEPS, {
      workflow_id: workflowId,
    });

    const workflow = data.workflows_by_pk;
    if (!workflow) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    if (!workflow.is_active) {
      return res.status(400).json({ message: 'Workflow is not active' });
    }

    // 2. Verify caller is owner or editor in the workflow's org
    const memberData: any = await adminClient.request(queries.GET_USER_ORG_ROLE, {
      user_id: userId,
      org_id: workflow.org_id,
    });

    const membership = memberData.org_members[0];
    if (!membership) {
      return res.status(403).json({ message: 'You are not a member of this organization' });
    }

    if (!['owner', 'editor'].includes(membership.role)) {
      return res.status(403).json({ message: 'Only owners and editors can trigger workflow runs' });
    }

    // 3. Check quota
    const org = workflow.organization;
    if (org.quota_used >= org.quota_limit) {
      return res.status(429).json({ message: 'Organization quota exhausted. Please upgrade or wait for reset.' });
    }

    // 4. Create the workflow run
    const runData: any = await adminClient.request(queries.CREATE_WORKFLOW_RUN, {
      workflow_id: workflowId,
      triggered_by: 'manual',
      started_by: userId,
    });

    const workflowRun = runData.insert_workflow_runs_one;

    // 5. Create step_runs for all steps
    const stepRunObjects = workflow.workflow_steps.map((step: any) => ({
      workflow_run_id: workflowRun.id,
      workflow_step_id: step.id,
      status: 'pending',
    }));

    const stepRunData: any = await adminClient.request(queries.CREATE_STEP_RUNS, {
      objects: stepRunObjects,
    });

    const stepRuns = stepRunData.insert_step_runs.returning;

    // 6. Return immediately, execute async
    res.status(200).json({
      workflow_run_id: workflowRun.id,
      status: 'pending',
      message: 'Workflow run started successfully',
    });

    // 7. Execute workflow steps asynchronously
    executeWorkflow(
      workflowRun.id,
      workflow.org_id,
      workflow.workflow_steps,
      stepRuns
    ).catch((err) => {
      console.error('[triggerWorkflowRun] Execution error:', err);
    });

  } catch (err: any) {
    console.error('[triggerWorkflowRun] Error:', err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
}
