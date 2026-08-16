import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import {
  executeGraphQL,
  executeWorkflow,
  resumeWorkflow,
} from "@/lib/server/engine";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "0123456789012345678901234567890123456789012345678901234567891234";
const TARGET_FUNCTIONS_URL =
  process.env.NEXT_PUBLIC_FUNCTIONS_URL || "http://localhost:3001";

function generateToken(user: { id: string; email: string; display_name?: string }) {
  return jwt.sign(
    {
      "https://hasura.io/jwt/claims": {
        "x-hasura-allowed-roles": ["user", "anonymous"],
        "x-hasura-default-role": "user",
        "x-hasura-user-id": user.id,
      },
      sub: user.id,
      email: user.email,
      display_name: user.display_name,
    },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: "7d" }
  );
}

function verifyUserFromAuth(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.split(" ")[1];
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return decoded.sub || decoded["https://hasura.io/jwt/claims"]?.["x-hasura-user-id"] || null;
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const subpath = path.join("/");
    const body = await req.json().catch(() => ({}));

    // ── 1. Create Organization Handler ──────────────────────────────
    if (subpath.endsWith("create-organization")) {
      const payload = body.input || body;
      const { name, user_id, email, display_name } = payload;

      if (!name || !user_id) {
        return NextResponse.json(
          { message: "name and user_id are required" },
          { status: 400 }
        );
      }

      // Ensure user exists in public.users to satisfy FK constraint on org_members
      const userEmail = email || `${user_id}@vocallabs.internal`;
      const userName = display_name || "Workspace Owner";

      console.log("[create-organization] Ensuring user exists:", { user_id, userEmail, userName });

      // First, check if user already exists
      const checkUserQuery = `
        query CheckUser($id: uuid!) {
          users_by_pk(id: $id) {
            id
          }
        }
      `;

      const existingUser = await executeGraphQL(checkUserQuery, { id: user_id });

      if (!existingUser.users_by_pk) {
        console.log("[create-organization] User not found, inserting...");
        const insertUserMutation = `
          mutation InsertUser($id: uuid!, $email: String!, $password_hash: String!, $display_name: String!) {
            insert_users_one(
              object: {
                id: $id,
                email: $email,
                password_hash: $password_hash,
                display_name: $display_name
              }
            ) {
              id
            }
          }
        `;

        await executeGraphQL(insertUserMutation, {
          id: user_id,
          email: userEmail,
          password_hash: "authenticated",
          display_name: userName,
        });
        console.log("[create-organization] User inserted successfully");
      } else {
        console.log("[create-organization] User already exists:", existingUser.users_by_pk.id);
      }

      const orgId = uuidv4();
      const mutation = `
        mutation CreateUserOrg($org_id: uuid!, $name: String!, $user_id: uuid!) {
          insert_organizations_one(object: {
            id: $org_id,
            name: $name,
            quota_limit: 100,
            quota_used: 0
          }) {
            id
            name
          }
          insert_org_members_one(object: {
            org_id: $org_id,
            user_id: $user_id,
            role: "owner"
          }) {
            id
          }
        }
      `;

      await executeGraphQL(mutation, {
        org_id: orgId,
        name,
        user_id,
      });

      return NextResponse.json(
        {
          org_id: orgId,
          name,
          message: "Organization created successfully",
        },
        { status: 200 }
      );
    }

    // ── 2. Login User Handler ───────────────────────────────────────
    if (subpath.endsWith("login-user")) {
      const payload = body.input || body;
      const { email, password } = payload;

      if (!email || !password) {
        return NextResponse.json(
          { message: "email and password are required" },
          { status: 400 }
        );
      }

      const getUserQuery = `
        query GetUser($email: String!) {
          users(where: { email: { _eq: $email } }) {
            id
            email
            password_hash
            display_name
            org_members {
              org_id
              role
            }
          }
        }
      `;

      const data = await executeGraphQL(getUserQuery, { email });
      const user = data.users?.[0];

      if (!user) {
        return NextResponse.json(
          { message: "Invalid email or password" },
          { status: 401 }
        );
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return NextResponse.json(
          { message: "Invalid email or password" },
          { status: 401 }
        );
      }

      // If user has 0 workspaces, auto-provision default workspace
      if (!user.org_members || user.org_members.length === 0) {
        const orgId = uuidv4();
        const createOrgMutation = `
          mutation AutoCreateOrg($org_id: uuid!, $name: String!, $user_id: uuid!) {
            insert_organizations_one(object: {
              id: $org_id,
              name: $name,
              quota_limit: 100,
              quota_used: 0
            }) {
              id
            }
            insert_org_members_one(object: {
              org_id: $org_id,
              user_id: $user_id,
              role: "owner"
            }) {
              id
            }
          }
        `;
        await executeGraphQL(createOrgMutation, {
          org_id: orgId,
          name: `${user.display_name || user.email.split("@")[0]}'s Workspace`,
          user_id: user.id,
        });
      }

      const token = generateToken(user);
      return NextResponse.json(
        {
          user_id: user.id,
          token,
          message: "Login successful",
        },
        { status: 200 }
      );
    }

    // ── 3. Register User Handler ────────────────────────────────────
    if (subpath.endsWith("register-user")) {
      const payload = body.input || body;
      const { email, password, display_name } = payload;

      if (!email || !password || !display_name) {
        return NextResponse.json(
          { message: "email, password, and display_name are required" },
          { status: 400 }
        );
      }

      const checkQuery = `
        query CheckUser($email: String!) {
          users(where: { email: { _eq: $email } }) {
            id
          }
        }
      `;
      const existing = await executeGraphQL(checkQuery, { email });
      if (existing.users && existing.users.length > 0) {
        return NextResponse.json(
          { message: "A user with this email already exists" },
          { status: 409 }
        );
      }

      const userId = uuidv4();
      const orgId = uuidv4();
      const passwordHash = await bcrypt.hash(password, 10);

      const registerMutation = `
        mutation RegisterUser($user_id: uuid!, $email: String!, $password_hash: String!, $display_name: String!, $org_id: uuid!, $org_name: String!) {
          insert_users_one(object: {
            id: $user_id,
            email: $email,
            password_hash: $password_hash,
            display_name: $display_name
          }) {
            id
            email
            display_name
          }
          insert_organizations_one(object: {
            id: $org_id,
            name: $org_name,
            quota_limit: 100,
            quota_used: 0
          }) {
            id
          }
          insert_org_members_one(object: {
            org_id: $org_id,
            user_id: $user_id,
            role: "owner"
          }) {
            id
          }
        }
      `;

      await executeGraphQL(registerMutation, {
        user_id: userId,
        email,
        password_hash: passwordHash,
        display_name,
        org_id: orgId,
        org_name: `${display_name}'s Workspace`,
      });

      const token = generateToken({
        id: userId,
        email,
        display_name,
      });

      return NextResponse.json(
        {
          user_id: userId,
          token,
          message: "Registration successful",
        },
        { status: 200 }
      );
    }

    // ── 4. Trigger Workflow Run Handler ─────────────────────────────
    if (subpath.endsWith("trigger-workflow-run")) {
      const payload = body.input || body;
      const workflowId = payload.workflow_id;
      const userId =
        body.session_variables?.["x-hasura-user-id"] ||
        verifyUserFromAuth(req) ||
        payload.user_id;

      if (!workflowId) {
        return NextResponse.json({ message: "workflow_id is required" }, { status: 400 });
      }

      const getWorkflowQuery = `
        query GetWorkflow($workflow_id: uuid!) {
          workflows_by_pk(id: $workflow_id) {
            id
            org_id
            name
            is_active
            organization {
              id
              quota_limit
              quota_used
            }
            workflow_steps(order_by: { step_order: asc }) {
              id
              step_order
              name
              step_type
              config
            }
          }
        }
      `;

      const wfData = await executeGraphQL(getWorkflowQuery, { workflow_id: workflowId });
      const workflow = wfData.workflows_by_pk;

      if (!workflow) {
        return NextResponse.json({ message: "Workflow not found" }, { status: 404 });
      }

      // Check quota
      const org = workflow.organization;
      if (org.quota_used >= org.quota_limit) {
        return NextResponse.json(
          { message: "Organization quota exhausted" },
          { status: 429 }
        );
      }

      // Create workflow run
      const createRunMutation = `
        mutation CreateRun($workflow_id: uuid!, $started_by: uuid) {
          insert_workflow_runs_one(object: {
            workflow_id: $workflow_id,
            triggered_by: "manual",
            started_by: $started_by,
            status: "pending"
          }) {
            id
          }
        }
      `;

      const runRes = await executeGraphQL(createRunMutation, {
        workflow_id: workflowId,
        started_by: userId || null,
      });

      const workflowRunId = runRes.insert_workflow_runs_one.id;

      // Create step runs
      const stepRunObjects = workflow.workflow_steps.map((step: any) => ({
        workflow_run_id: workflowRunId,
        workflow_step_id: step.id,
        status: "pending",
      }));

      const createStepRunsMutation = `
        mutation CreateStepRuns($objects: [step_runs_insert_input!]!) {
          insert_step_runs(objects: $objects) {
            returning {
              id
              workflow_step_id
              status
            }
          }
        }
      `;

      const stepRunsRes = await executeGraphQL(createStepRunsMutation, {
        objects: stepRunObjects,
      });

      const stepRuns = stepRunsRes.insert_step_runs.returning;

      // Execute asynchronously in background
      executeWorkflow(
        workflowRunId,
        workflow.org_id,
        workflow.workflow_steps,
        stepRuns
      ).catch((err) => console.error("[executeWorkflow error]", err));

      return NextResponse.json(
        {
          workflow_run_id: workflowRunId,
          status: "pending",
          message: "Workflow run started successfully",
        },
        { status: 200 }
      );
    }

    // ── 5. Approve Step Handler ─────────────────────────────────────
    if (subpath.endsWith("approve-step")) {
      const payload = body.input || body;
      const stepRunId = payload.step_run_id;
      const userId =
        body.session_variables?.["x-hasura-user-id"] ||
        verifyUserFromAuth(req) ||
        payload.user_id;

      if (!stepRunId) {
        return NextResponse.json({ message: "step_run_id is required" }, { status: 400 });
      }

      const getStepRunQuery = `
        query GetStepRun($id: uuid!) {
          step_runs_by_pk(id: $id) {
            id
            status
            workflow_run_id
            workflow_step {
              id
              step_order
              workflow_id
              workflow {
                id
                org_id
                workflow_steps(order_by: { step_order: asc }) {
                  id
                  step_order
                  name
                  step_type
                  config
                }
              }
            }
            workflow_run {
              id
              step_runs {
                id
                workflow_step_id
                status
              }
            }
          }
        }
      `;

      const srData = await executeGraphQL(getStepRunQuery, { id: stepRunId });
      const stepRun = srData.step_runs_by_pk;

      if (!stepRun) {
        return NextResponse.json({ message: "Step run not found" }, { status: 404 });
      }

      const workflow = stepRun.workflow_step.workflow;
      const workflowRun = stepRun.workflow_run;

      // Update approved step run
      const approveMutation = `
        mutation ApproveStepRun($id: uuid!, $approved_by: uuid, $approved_at: timestamptz!) {
          update_step_runs_by_pk(
            pk_columns: { id: $id },
            _set: {
              status: "completed",
              approved_by: $approved_by,
              approved_at: $approved_at,
              output: { approved: true, approved_at: $approved_at }
            }
          ) {
            id
          }
        }
      `;

      await executeGraphQL(approveMutation, {
        id: stepRunId,
        approved_by: userId || null,
        approved_at: new Date().toISOString(),
      });

      // Resume execution in background
      resumeWorkflow(
        workflowRun.id,
        workflow.org_id,
        stepRun.workflow_step.step_order,
        workflow.workflow_steps,
        workflowRun.step_runs
      ).catch((err) => console.error("[resumeWorkflow error]", err));

      return NextResponse.json(
        {
          success: true,
          workflow_run_id: workflowRun.id,
          message: "Step approved, workflow resumed",
        },
        { status: 200 }
      );
    }

    // ── 6. Webhook Trigger Handler ──────────────────────────────────
    if (subpath.endsWith("webhook-trigger")) {
      const payload = body.input || body;
      const { workflow_id, secret, payload: eventPayload } = payload;

      if (!workflow_id || !secret) {
        return NextResponse.json(
          { message: "workflow_id and secret are required" },
          { status: 400 }
        );
      }

      const getTriggerQuery = `
        query GetWebhookTrigger($workflow_id: uuid!) {
          workflow_triggers(where: { workflow_id: { _eq: $workflow_id }, trigger_type: { _eq: "webhook" } }) {
            id
            config
            workflow {
              id
              org_id
              is_active
              organization {
                quota_limit
                quota_used
              }
              workflow_steps(order_by: { step_order: asc }) {
                id
                step_order
                name
                step_type
                config
              }
            }
          }
        }
      `;

      const tData = await executeGraphQL(getTriggerQuery, { workflow_id });
      const trigger = tData.workflow_triggers?.[0];

      if (!trigger || trigger.config?.secret !== secret) {
        return NextResponse.json(
          { message: "Invalid webhook credentials or workflow" },
          { status: 401 }
        );
      }

      const workflow = trigger.workflow;
      if (!workflow.is_active) {
        return NextResponse.json({ message: "Workflow is not active" }, { status: 400 });
      }

      // Check quota
      if (workflow.organization.quota_used >= workflow.organization.quota_limit) {
        return NextResponse.json({ message: "Organization quota exhausted" }, { status: 429 });
      }

      // Create workflow run
      const createRunMutation = `
        mutation CreateWebhookRun($workflow_id: uuid!) {
          insert_workflow_runs_one(object: {
            workflow_id: $workflow_id,
            triggered_by: "webhook",
            status: "pending"
          }) {
            id
          }
        }
      `;

      const runRes = await executeGraphQL(createRunMutation, { workflow_id });
      const workflowRunId = runRes.insert_workflow_runs_one.id;

      // Create step runs
      const stepRunObjects = workflow.workflow_steps.map((step: any) => ({
        workflow_run_id: workflowRunId,
        workflow_step_id: step.id,
        status: "pending",
      }));

      const createStepRunsMutation = `
        mutation CreateStepRuns($objects: [step_runs_insert_input!]!) {
          insert_step_runs(objects: $objects) {
            returning {
              id
              workflow_step_id
              status
            }
          }
        }
      `;

      const stepRunsRes = await executeGraphQL(createStepRunsMutation, {
        objects: stepRunObjects,
      });

      const stepRuns = stepRunsRes.insert_step_runs.returning;

      // Execute asynchronously in background
      executeWorkflow(
        workflowRunId,
        workflow.org_id,
        workflow.workflow_steps,
        stepRuns
      ).catch((err) => console.error("[webhook executeWorkflow error]", err));

      return NextResponse.json(
        {
          workflow_run_id: workflowRunId,
          status: "pending",
          message: "Workflow triggered via webhook",
        },
        { status: 200 }
      );
    }

    // ── 7. Fallback Proxy ───────────────────────────────────────────
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const authHeader = req.headers.get("authorization");
    if (authHeader) headers["authorization"] = authHeader;

    const targetUrl = `${TARGET_FUNCTIONS_URL}/${subpath}`;
    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error("[Backend Proxy Error]", err);
    return NextResponse.json(
      { message: err.message || "Failed to process request" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const subpath = path.join("/");

    const headers: Record<string, string> = {};
    const authHeader = req.headers.get("authorization");
    if (authHeader) headers["authorization"] = authHeader;

    const targetUrl = `${TARGET_FUNCTIONS_URL}/${subpath}`;
    const res = await fetch(targetUrl, {
      method: "GET",
      headers,
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error("[Backend Proxy Error]", err);
    return NextResponse.json(
      { message: err.message || "Failed to process request" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
