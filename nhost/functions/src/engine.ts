/**
 * Workflow Execution Engine
 *
 * Executes workflow steps sequentially, handling:
 * - llm_call (Groq API with retry)
 * - http_request (external API with retry)
 * - db_write (save to workflow_data)
 * - notify (simulated notification)
 * - conditional_branch (if/else based on previous output)
 * - approval_gate (pauses run, awaits approval)
 */

import Groq from 'groq-sdk';
import { adminClient } from './graphql-client';
import * as queries from './queries';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// ── Types ──────────────────────────────────────────────────

interface WorkflowStep {
  id: string;
  step_order: number;
  name: string;
  step_type: string;
  config: Record<string, any>;
}

interface StepRunRecord {
  id: string;
  workflow_step_id: string;
  status: string;
}

interface ExecutionContext {
  workflowRunId: string;
  orgId: string;
  previousOutput: any;
  stepRuns: Map<string, StepRunRecord>;
}

// ── Step Executors ─────────────────────────────────────────

async function executeLlmCall(
  step: WorkflowStep,
  ctx: ExecutionContext
): Promise<any> {
  const config = step.config;
  const model = config.model || 'llama-3.1-8b-instant';

  // Build prompt — interpolate {{previous_output}} with actual data
  let prompt = config.prompt || 'Hello, respond briefly.';
  if (ctx.previousOutput) {
    prompt = prompt.replace(
      /\{\{previous_output\}\}/g,
      typeof ctx.previousOutput === 'string'
        ? ctx.previousOutput
        : JSON.stringify(ctx.previousOutput)
    );
  }

  const systemPrompt = config.system_prompt || 'You are a helpful AI assistant.';

  const completion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    model,
    temperature: config.temperature ?? 0.7,
    max_tokens: config.max_tokens ?? 1024,
  });

  const response = completion.choices[0]?.message?.content || '';
  return { response, model, prompt_used: prompt };
}

async function executeHttpRequest(
  step: WorkflowStep,
  ctx: ExecutionContext
): Promise<any> {
  const config = step.config;
  const url = config.url || 'https://httpbin.org/get';
  const method = (config.method || 'GET').toUpperCase();

  let body = config.body;
  if (body && ctx.previousOutput) {
    body = JSON.stringify(body).replace(
      /\{\{previous_output\}\}/g,
      typeof ctx.previousOutput === 'string'
        ? ctx.previousOutput
        : JSON.stringify(ctx.previousOutput)
    );
    body = JSON.parse(body);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config.headers || {}),
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (method !== 'GET' && method !== 'HEAD' && body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  const responseText = await response.text();

  let responseData: any;
  try {
    responseData = JSON.parse(responseText);
  } catch {
    responseData = responseText;
  }

  return {
    status_code: response.status,
    data: responseData,
    url,
    method,
  };
}

async function executeDbWrite(
  step: WorkflowStep,
  ctx: ExecutionContext
): Promise<any> {
  const dataToStore = step.config.data || ctx.previousOutput || {};
  const stepRunId = ctx.stepRuns.get(step.id)?.id;

  if (!stepRunId) throw new Error('Step run ID not found');

  await adminClient.request(queries.INSERT_WORKFLOW_DATA, {
    org_id: ctx.orgId,
    workflow_run_id: ctx.workflowRunId,
    step_run_id: stepRunId,
    data: dataToStore,
  });

  return { stored: true, data_preview: JSON.stringify(dataToStore).slice(0, 200) };
}

async function executeNotify(
  step: WorkflowStep,
  ctx: ExecutionContext
): Promise<any> {
  const config = step.config;
  const channel = config.channel || 'log';
  let message = config.message || 'Workflow notification';

  if (ctx.previousOutput) {
    message = message.replace(
      /\{\{previous_output\}\}/g,
      typeof ctx.previousOutput === 'string'
        ? ctx.previousOutput
        : JSON.stringify(ctx.previousOutput)
    );
  }

  // Simulate notification — in production this would call Slack/email API
  console.log(`[NOTIFY] Channel: ${channel} | Message: ${message}`);

  // If a webhook URL is configured, actually POST to it
  if (config.webhook_url) {
    try {
      await fetch(config.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message, channel }),
      });
    } catch (err) {
      console.warn('[NOTIFY] Webhook delivery failed:', err);
    }
  }

  return { notified: true, channel, message };
}

function evaluateCondition(
  condition: Record<string, any>,
  previousOutput: any
): boolean {
  const field = condition.field || 'response';
  const operator = condition.operator || 'contains';
  const value = condition.value || '';

  // Extract field value from previous output
  let fieldValue: any;
  if (typeof previousOutput === 'object' && previousOutput !== null) {
    fieldValue = previousOutput[field];
  } else {
    fieldValue = previousOutput;
  }

  const strValue = String(fieldValue || '').toLowerCase();
  const targetValue = String(value).toLowerCase();

  switch (operator) {
    case 'contains':
      return strValue.includes(targetValue);
    case 'not_contains':
      return !strValue.includes(targetValue);
    case 'equals':
      return strValue === targetValue;
    case 'not_equals':
      return strValue !== targetValue;
    case 'starts_with':
      return strValue.startsWith(targetValue);
    case 'ends_with':
      return strValue.endsWith(targetValue);
    case 'greater_than':
      return parseFloat(strValue) > parseFloat(targetValue);
    case 'less_than':
      return parseFloat(strValue) < parseFloat(targetValue);
    default:
      return strValue.includes(targetValue);
  }
}

async function executeConditionalBranch(
  step: WorkflowStep,
  ctx: ExecutionContext
): Promise<{ branch_taken: string; condition_met: boolean }> {
  const config = step.config;
  const condition = config.condition || { field: 'response', operator: 'contains', value: 'yes' };

  const conditionMet = evaluateCondition(condition, ctx.previousOutput);

  return {
    branch_taken: conditionMet ? 'if_true' : 'if_false',
    condition_met: conditionMet,
  };
}

// ── Retry Wrapper ──────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.log(`[RETRY] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// ── Update Helpers ─────────────────────────────────────────

async function updateStepRun(
  stepRunId: string,
  data: Record<string, any>
): Promise<void> {
  await adminClient.request(queries.UPDATE_STEP_RUN, {
    id: stepRunId,
    status: data.status,
    input: data.input ?? null,
    output: data.output ?? null,
    error: data.error ?? null,
    attempt_count: data.attempt_count ?? null,
    started_at: data.started_at ?? null,
    completed_at: data.completed_at ?? null,
    approved_by: data.approved_by ?? null,
    approved_at: data.approved_at ?? null,
  });
}

async function updateWorkflowRun(
  runId: string,
  status: string,
  error?: string
): Promise<void> {
  await adminClient.request(queries.UPDATE_WORKFLOW_RUN, {
    id: runId,
    status,
    error: error || null,
    completed_at: ['completed', 'failed'].includes(status) ? new Date().toISOString() : null,
  });
}

// ── Main Execution Loop ────────────────────────────────────

export async function executeWorkflow(
  workflowRunId: string,
  orgId: string,
  steps: WorkflowStep[],
  stepRuns: StepRunRecord[],
  startFromOrder: number = 0
): Promise<{ status: string; error?: string }> {
  const ctx: ExecutionContext = {
    workflowRunId,
    orgId,
    previousOutput: null,
    stepRuns: new Map(stepRuns.map((sr) => [sr.workflow_step_id, sr])),
  };

  // Update workflow run to running
  await updateWorkflowRun(workflowRunId, 'running');

  const stepsToExecute = steps.filter((s) => s.step_order >= startFromOrder);

  for (const step of stepsToExecute) {
    const stepRun = ctx.stepRuns.get(step.id);
    if (!stepRun) {
      console.error(`No step_run found for step ${step.id}`);
      continue;
    }

    // Skip already completed/skipped steps
    if (['completed', 'skipped'].includes(stepRun.status)) {
      continue;
    }

    // Mark step as running
    await updateStepRun(stepRun.id, {
      status: 'running',
      input: ctx.previousOutput,
      started_at: new Date().toISOString(),
      attempt_count: 0,
    });

    // Small delay so subscription picks up the "running" state
    await new Promise((r) => setTimeout(r, 300));

    try {
      let output: any;
      let attemptCount = 1;

      switch (step.step_type) {
        case 'llm_call':
          output = await withRetry(() => executeLlmCall(step, ctx), 3);
          break;

        case 'http_request':
          output = await withRetry(() => executeHttpRequest(step, ctx), 3);
          break;

        case 'db_write':
          output = await executeDbWrite(step, ctx);
          break;

        case 'notify':
          output = await executeNotify(step, ctx);
          break;

        case 'conditional_branch':
          output = await executeConditionalBranch(step, ctx);

          // If condition not met and config says to skip remaining, handle
          if (output.branch_taken === 'if_false' && step.config.skip_on_false) {
            // Mark subsequent steps as skipped until the next non-skippable
            const skipCount = step.config.skip_count || 1;
            const currentIdx = stepsToExecute.indexOf(step);
            for (let i = 1; i <= skipCount && currentIdx + i < stepsToExecute.length; i++) {
              const skipStep = stepsToExecute[currentIdx + i];
              const skipStepRun = ctx.stepRuns.get(skipStep.id);
              if (skipStepRun) {
                await updateStepRun(skipStepRun.id, {
                  status: 'skipped',
                  output: { reason: 'Conditional branch evaluated to false' },
                  completed_at: new Date().toISOString(),
                });
              }
            }
          }
          break;

        case 'approval_gate':
          // Pause the run and stop execution
          await updateStepRun(stepRun.id, {
            status: 'paused_awaiting_approval',
            input: ctx.previousOutput,
            output: { message: step.config.approval_message || 'Awaiting approval to continue' },
          });
          await updateWorkflowRun(workflowRunId, 'paused');
          return { status: 'paused' };

        default:
          throw new Error(`Unknown step type: ${step.step_type}`);
      }

      // Mark step completed
      await updateStepRun(stepRun.id, {
        status: 'completed',
        output,
        attempt_count: attemptCount,
        completed_at: new Date().toISOString(),
      });

      // Pass output to next step
      ctx.previousOutput = output;

    } catch (err: any) {
      // Mark step as failed
      await updateStepRun(stepRun.id, {
        status: 'failed',
        error: err.message || 'Unknown error',
        completed_at: new Date().toISOString(),
      });

      // Mark workflow run as failed
      await updateWorkflowRun(workflowRunId, 'failed', err.message);
      return { status: 'failed', error: err.message };
    }
  }

  // All steps completed
  await updateWorkflowRun(workflowRunId, 'completed');

  // Increment quota
  await adminClient.request(queries.INCREMENT_QUOTA, { org_id: orgId });

  return { status: 'completed' };
}
