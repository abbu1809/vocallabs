/**
 * approveStep — Hasura Action Handler
 *
 * Layer 2 permission enforcement:
 * 1. Verifies the step is actually paused_awaiting_approval
 * 2. Checks the approver is owner/editor in the step's org
 * 3. Approves the step and resumes workflow execution
 */

import { Request, Response } from 'express';
import { adminClient } from '../graphql-client';
import * as queries from '../queries';
import { executeWorkflow } from '../engine';

interface HasuraActionPayload {
  action: { name: string };
  input: { step_run_id: string };
  session_variables: Record<string, string>;
}

export default async function approveStep(req: Request, res: Response) {
  try {
    const payload = req.body as HasuraActionPayload;
    const stepRunId = payload.input.step_run_id;
    const userId = payload.session_variables['x-hasura-user-id'];

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // 1. Fetch step run with full context
    const data: any = await adminClient.request(queries.GET_STEP_RUN_DETAILS, {
      step_run_id: stepRunId,
    });

    const stepRun = data.step_runs_by_pk;
    if (!stepRun) {
      return res.status(404).json({ message: 'Step run not found' });
    }

    if (stepRun.status !== 'paused_awaiting_approval') {
      return res.status(400).json({
        message: `Step is not awaiting approval (current status: ${stepRun.status})`,
      });
    }

    const workflowRun = stepRun.workflow_run;
    const workflow = workflowRun.workflow;
    const orgId = workflow.org_id;

    // 2. LAYER 2: Verify approver is owner or editor in this org
    const memberData: any = await adminClient.request(queries.GET_USER_ORG_ROLE, {
      user_id: userId,
      org_id: orgId,
    });

    const membership = memberData.org_members[0];
    if (!membership) {
      return res.status(403).json({
        message: 'You are not a member of this organization',
      });
    }

    if (!['owner', 'editor'].includes(membership.role)) {
      return res.status(403).json({
        message: 'Only owners and editors can approve steps',
      });
    }

    // 3. Approve the step
    await adminClient.request(queries.UPDATE_STEP_RUN, {
      id: stepRunId,
      status: 'completed',
      input: null,
      output: { approved: true, approver_role: membership.role },
      error: null,
      attempt_count: null,
      started_at: null,
      completed_at: new Date().toISOString(),
      approved_by: userId,
      approved_at: new Date().toISOString(),
    });

    // 4. Return success immediately
    res.status(200).json({
      success: true,
      message: 'Step approved successfully. Resuming workflow.',
      workflow_run_id: workflowRun.id,
    });

    // 5. Resume workflow execution from the next step
    const currentStepOrder = stepRun.workflow_step.step_order;

    // Get remaining step runs
    const remainingData: any = await adminClient.request(queries.GET_REMAINING_STEP_RUNS, {
      workflow_run_id: workflowRun.id,
      min_step_order: currentStepOrder,
    });

    const remainingStepRuns = remainingData.step_runs;

    if (remainingStepRuns.length > 0) {
      const remainingSteps = remainingStepRuns.map((sr: any) => sr.workflow_step);

      executeWorkflow(
        workflowRun.id,
        orgId,
        workflow.workflow_steps, // all steps for context
        remainingStepRuns,
        currentStepOrder + 1 // start from next step
      ).catch((err) => {
        console.error('[approveStep] Resume execution error:', err);
      });
    } else {
      // No more steps, mark run as completed
      await adminClient.request(queries.UPDATE_WORKFLOW_RUN, {
        id: workflowRun.id,
        status: 'completed',
        error: null,
        completed_at: new Date().toISOString(),
      });

      // Increment quota
      await adminClient.request(queries.INCREMENT_QUOTA, { org_id: orgId });
    }

  } catch (err: any) {
    console.error('[approveStep] Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error',
      workflow_run_id: '',
    });
  }
}
