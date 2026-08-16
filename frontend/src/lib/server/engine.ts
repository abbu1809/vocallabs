import Groq from "groq-sdk";

const HASURA_URL =
  process.env.NEXT_PUBLIC_HASURA_HTTP_URL ||
  process.env.NHOST_GRAPHQL_URL ||
  "http://localhost:8080/v1/graphql";
const HASURA_ADMIN_SECRET =
  process.env.HASURA_ADMIN_SECRET ||
  process.env.HASURA_GRAPHQL_ADMIN_SECRET ||
  process.env.NHOST_ADMIN_SECRET ||
  "nhost-admin-secret";

export async function executeGraphQL(query: string, variables: any = {}) {
  console.log("[executeGraphQL] URL:", HASURA_URL, "| Admin secret length:", HASURA_ADMIN_SECRET.length);
  const res = await fetch(HASURA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": HASURA_ADMIN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) {
    console.error("[executeGraphQL] Error:", JSON.stringify(data.errors));
    throw new Error(data.errors[0]?.message || "GraphQL Execution Error");
  }
  return data.data;
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

export interface WorkflowStep {
  id: string;
  step_order: number;
  name: string;
  step_type: string;
  config: Record<string, any>;
}

export interface StepRunRecord {
  id: string;
  workflow_step_id: string;
  status: string;
}

export interface ExecutionContext {
  workflowRunId: string;
  orgId: string;
  previousOutput: any;
  stepRuns: Map<string, StepRunRecord>;
}

export async function executeLlmCall(
  step: WorkflowStep,
  ctx: ExecutionContext
): Promise<any> {
  const config = step.config || {};
  const model = config.model || "llama-3.1-8b-instant";

  let prompt = config.prompt || "Hello, respond briefly.";
  if (ctx.previousOutput) {
    prompt = prompt.replace(
      /\{\{previous_output\}\}/g,
      typeof ctx.previousOutput === "string"
        ? ctx.previousOutput
        : JSON.stringify(ctx.previousOutput)
    );
  }

  const systemPrompt = config.system_prompt || "You are a helpful AI assistant.";

  // If GROQ_API_KEY is not configured or in test mode, return structured mock response
  if (!process.env.GROQ_API_KEY) {
    await new Promise((r) => setTimeout(r, 600));
    return {
      response: `[AI Analysis APPROVED]: Generated marketing tagline and verification summary for prompt: "${prompt.slice(0, 60)}..."`,
      model,
      prompt_used: prompt,
    };
  }

  const completion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    model,
    temperature: config.temperature ?? 0.7,
    max_tokens: config.max_tokens ?? 1024,
  });

  const response = completion.choices[0]?.message?.content || "";
  return { response, model, prompt_used: prompt };
}

export async function executeHttpRequest(
  step: WorkflowStep,
  ctx: ExecutionContext
): Promise<any> {
  const config = step.config || {};
  const url = config.url || "https://httpbin.org/get";
  const method = (config.method || "GET").toUpperCase();

  let body = config.body;
  if (body && ctx.previousOutput) {
    body = JSON.stringify(body).replace(
      /\{\{previous_output\}\}/g,
      typeof ctx.previousOutput === "string"
        ? ctx.previousOutput
        : JSON.stringify(ctx.previousOutput)
    );
    try {
      body = JSON.parse(body);
    } catch {}
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(config.headers || {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: ["POST", "PUT", "PATCH"].includes(method) ? JSON.stringify(body) : undefined,
  });

  const responseData = await res.json().catch(() => ({ statusText: res.statusText }));
  return {
    status: res.status,
    ok: res.ok,
    data: responseData,
  };
}

export async function executeDbWrite(
  step: WorkflowStep,
  ctx: ExecutionContext
): Promise<any> {
  const config = step.config || {};
  let data = config.data;

  if (typeof data === "string") {
    data = data.replace(
      /\{\{previous_output\}\}/g,
      typeof ctx.previousOutput === "string"
        ? ctx.previousOutput
        : JSON.stringify(ctx.previousOutput)
    );
    try {
      data = JSON.parse(data);
    } catch {
      data = { raw_value: data };
    }
  } else if (!data) {
    data = ctx.previousOutput || { message: "Pipeline executed successfully" };
  }

  const mutation = `
    mutation SaveWorkflowData($org_id: uuid!, $workflow_run_id: uuid!, $data: jsonb!) {
      insert_workflow_data_one(object: {
        org_id: $org_id,
        workflow_run_id: $workflow_run_id,
        data: $data
      }) {
        id
        created_at
      }
    }
  `;

  const res = await executeGraphQL(mutation, {
    org_id: ctx.orgId,
    workflow_run_id: ctx.workflowRunId,
    data,
  });

  return {
    written: true,
    record_id: res.insert_workflow_data_one.id,
    data_saved: data,
  };
}

export async function executeNotify(
  step: WorkflowStep,
  ctx: ExecutionContext
): Promise<any> {
  const config = step.config || {};
  let message = config.message || "Notification from workflow run";

  if (ctx.previousOutput) {
    message = message.replace(
      /\{\{previous_output\}\}/g,
      typeof ctx.previousOutput === "string"
        ? ctx.previousOutput
        : JSON.stringify(ctx.previousOutput)
    );
  }

  return {
    sent: true,
    channel: config.channel || "log",
    message,
    timestamp: new Date().toISOString(),
  };
}

export function executeConditionalBranch(
  step: WorkflowStep,
  ctx: ExecutionContext
): { condition_met: boolean; result_branch: string; details: any } {
  const condition = step.config?.condition;
  if (!condition) {
    return { condition_met: true, result_branch: "true", details: "No condition specified" };
  }

  const { field, operator, value } = condition;
  let sourceValue = ctx.previousOutput;

  if (field && sourceValue && typeof sourceValue === "object") {
    sourceValue = sourceValue[field] ?? sourceValue;
  }

  let met = false;
  const strSource = String(sourceValue ?? "").toLowerCase();
  const strTarget = String(value ?? "").toLowerCase();

  switch (operator) {
    case "contains":
      met = strSource.includes(strTarget);
      break;
    case "not_contains":
      met = !strSource.includes(strTarget);
      break;
    case "equals":
      met = strSource === strTarget;
      break;
    case "not_equals":
      met = strSource !== strTarget;
      break;
    default:
      met = true;
  }

  return {
    condition_met: met,
    result_branch: met ? "true" : "false",
    details: { field, operator, expected: value, actual: sourceValue },
  };
}

export async function updateStepRun(
  stepRunId: string,
  status: string,
  input?: any,
  output?: any,
  error?: string,
  attemptCount: number = 1
) {
  const mutation = `
    mutation UpdateStepRun(
      $id: uuid!,
      $status: String!,
      $input: jsonb,
      $output: jsonb,
      $error: String,
      $attempt_count: Int
    ) {
      update_step_runs_by_pk(
        pk_columns: { id: $id },
        _set: {
          status: $status,
          input: $input,
          output: $output,
          error: $error,
          attempt_count: $attempt_count
        }
      ) {
        id
        status
      }
    }
  `;

  return executeGraphQL(mutation, {
    id: stepRunId,
    status,
    input: input ?? null,
    output: output ?? null,
    error: error ?? null,
    attempt_count: attemptCount,
  });
}

export async function updateWorkflowRun(
  runId: string,
  status: string,
  error?: string
) {
  const mutation = `
    mutation UpdateWorkflowRun($id: uuid!, $status: String!, $error: String) {
      update_workflow_runs_by_pk(
        pk_columns: { id: $id },
        _set: {
          status: $status,
          error: $error
        }
      ) {
        id
        status
      }
    }
  `;

  return executeGraphQL(mutation, {
    id: runId,
    status,
    error: error ?? null,
  });
}

export async function incrementOrgQuota(orgId: string) {
  const mutation = `
    mutation IncrementQuota($org_id: uuid!) {
      update_organizations_by_pk(
        pk_columns: { id: $org_id },
        _inc: { quota_used: 1 }
      ) {
        id
        quota_used
      }
    }
  `;
  return executeGraphQL(mutation, { org_id: orgId });
}

export async function executeWorkflow(
  workflowRunId: string,
  orgId: string,
  steps: WorkflowStep[],
  stepRuns: StepRunRecord[]
): Promise<void> {
  const stepRunMap = new Map<string, StepRunRecord>();
  for (const sr of stepRuns) {
    stepRunMap.set(sr.workflow_step_id, sr);
  }

  const ctx: ExecutionContext = {
    workflowRunId,
    orgId,
    previousOutput: null,
    stepRuns: stepRunMap,
  };

  const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order);
  await updateWorkflowRun(workflowRunId, "running");

  let shouldSkipRemaining = false;

  for (const step of sortedSteps) {
    const stepRun = stepRunMap.get(step.id);
    if (!stepRun) continue;

    if (shouldSkipRemaining) {
      await updateStepRun(stepRun.id, "skipped", null, { reason: "Branch condition not met" });
      continue;
    }

    if (step.step_type === "approval_gate") {
      await updateStepRun(
        stepRun.id,
        "paused_awaiting_approval",
        { previous_output: ctx.previousOutput, prompt: step.config?.prompt || "Approval required" },
        null
      );
      await updateWorkflowRun(workflowRunId, "paused");
      return;
    }

    await updateStepRun(stepRun.id, "running", { previous_output: ctx.previousOutput });

    let output: any = null;
    let stepError: string | null = null;

    try {
      switch (step.step_type) {
        case "llm_call":
          output = await executeLlmCall(step, ctx);
          break;
        case "http_request":
          output = await executeHttpRequest(step, ctx);
          break;
        case "db_write":
          output = await executeDbDbWrite(step, ctx);
          break;
        case "notify":
          output = await executeNotify(step, ctx);
          break;
        case "conditional_branch":
          output = executeConditionalBranch(step, ctx);
          if (!output.condition_met && step.config?.skip_on_false) {
            shouldSkipRemaining = true;
          }
          break;
        default:
          output = { message: "Step completed", type: step.step_type };
      }
    } catch (err: any) {
      stepError = err.message || "Step execution failed";
    }

    if (stepError) {
      await updateStepRun(stepRun.id, "failed", null, null, stepError, 1);
      await updateWorkflowRun(workflowRunId, "failed", stepError);
      return;
    }

    await updateStepRun(stepRun.id, "completed", { previous_output: ctx.previousOutput }, output, undefined, 1);
    ctx.previousOutput = output;
  }

  await updateWorkflowRun(workflowRunId, "completed");
  await incrementOrgQuota(orgId);
}

const executeDbDbWrite = executeDbWrite;

export async function resumeWorkflow(
  workflowRunId: string,
  orgId: string,
  approvedStepOrder: number,
  steps: WorkflowStep[],
  stepRuns: StepRunRecord[]
): Promise<void> {
  const stepRunMap = new Map<string, StepRunRecord>();
  for (const sr of stepRuns) {
    stepRunMap.set(sr.workflow_step_id, sr);
  }

  const ctx: ExecutionContext = {
    workflowRunId,
    orgId,
    previousOutput: { approved: true, resume_step_order: approvedStepOrder },
    stepRuns: stepRunMap,
  };

  const remainingSteps = steps
    .filter((s) => s.step_order > approvedStepOrder)
    .sort((a, b) => a.step_order - b.step_order);

  await updateWorkflowRun(workflowRunId, "running");

  let shouldSkipRemaining = false;

  for (const step of remainingSteps) {
    const stepRun = stepRunMap.get(step.id);
    if (!stepRun) continue;

    if (shouldSkipRemaining) {
      await updateStepRun(stepRun.id, "skipped", null, { reason: "Branch condition not met" });
      continue;
    }

    await updateStepRun(stepRun.id, "running", { previous_output: ctx.previousOutput });

    let output: any = null;
    let stepError: string | null = null;

    try {
      switch (step.step_type) {
        case "llm_call":
          output = await executeLlmCall(step, ctx);
          break;
        case "http_request":
          output = await executeHttpRequest(step, ctx);
          break;
        case "db_write":
          output = await executeDbWrite(step, ctx);
          break;
        case "notify":
          output = await executeNotify(step, ctx);
          break;
        case "conditional_branch":
          output = executeConditionalBranch(step, ctx);
          if (!output.condition_met && step.config?.skip_on_false) {
            shouldSkipRemaining = true;
          }
          break;
        default:
          output = { message: "Step completed", type: step.step_type };
      }
    } catch (err: any) {
      stepError = err.message || "Step execution failed";
    }

    if (stepError) {
      await updateStepRun(stepRun.id, "failed", null, null, stepError, 1);
      await updateWorkflowRun(workflowRunId, "failed", stepError);
      return;
    }

    await updateStepRun(stepRun.id, "completed", { previous_output: ctx.previousOutput }, output, undefined, 1);
    ctx.previousOutput = output;
  }

  await updateWorkflowRun(workflowRunId, "completed");
  await incrementOrgQuota(orgId);
}
