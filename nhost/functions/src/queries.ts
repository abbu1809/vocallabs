import { gql } from 'graphql-request';

// ── Workflow + Steps + Triggers ────────────────────────────

export const GET_WORKFLOW_WITH_STEPS = gql`
  query GetWorkflowWithSteps($workflow_id: uuid!) {
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
      workflow_triggers {
        id
        trigger_type
        config
        is_active
      }
    }
  }
`;

// ── Org Member Role Check ──────────────────────────────────

export const GET_USER_ORG_ROLE = gql`
  query GetUserOrgRole($user_id: uuid!, $org_id: uuid!) {
    org_members(where: {
      user_id: { _eq: $user_id },
      org_id: { _eq: $org_id }
    }) {
      id
      role
    }
  }
`;

// ── Workflow Run Mutations ─────────────────────────────────

export const CREATE_WORKFLOW_RUN = gql`
  mutation CreateWorkflowRun(
    $workflow_id: uuid!,
    $triggered_by: String!,
    $started_by: uuid
  ) {
    insert_workflow_runs_one(object: {
      workflow_id: $workflow_id,
      status: "pending",
      triggered_by: $triggered_by,
      started_by: $started_by,
      started_at: "now()"
    }) {
      id
      status
    }
  }
`;

export const UPDATE_WORKFLOW_RUN = gql`
  mutation UpdateWorkflowRun($id: uuid!, $status: String!, $error: String, $completed_at: timestamptz) {
    update_workflow_runs_by_pk(pk_columns: { id: $id }, _set: {
      status: $status,
      error: $error,
      completed_at: $completed_at
    }) {
      id
      status
    }
  }
`;

// ── Step Run Mutations ─────────────────────────────────────

export const CREATE_STEP_RUNS = gql`
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

export const UPDATE_STEP_RUN = gql`
  mutation UpdateStepRun(
    $id: uuid!,
    $status: String!,
    $input: jsonb,
    $output: jsonb,
    $error: String,
    $attempt_count: Int,
    $started_at: timestamptz,
    $completed_at: timestamptz,
    $approved_by: uuid,
    $approved_at: timestamptz
  ) {
    update_step_runs_by_pk(pk_columns: { id: $id }, _set: {
      status: $status,
      input: $input,
      output: $output,
      error: $error,
      attempt_count: $attempt_count,
      started_at: $started_at,
      completed_at: $completed_at,
      approved_by: $approved_by,
      approved_at: $approved_at
    }) {
      id
      status
    }
  }
`;

// ── Step Run Query (for approval resumption) ───────────────

export const GET_STEP_RUN_DETAILS = gql`
  query GetStepRunDetails($step_run_id: uuid!) {
    step_runs_by_pk(id: $step_run_id) {
      id
      status
      workflow_run_id
      workflow_step_id
      workflow_run {
        id
        workflow_id
        status
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
      workflow_step {
        id
        step_order
        name
        step_type
      }
    }
  }
`;

// ── Remaining Step Runs (after approval) ───────────────────

export const GET_REMAINING_STEP_RUNS = gql`
  query GetRemainingStepRuns($workflow_run_id: uuid!, $min_step_order: Int!) {
    step_runs(
      where: {
        workflow_run_id: { _eq: $workflow_run_id },
        workflow_step: { step_order: { _gt: $min_step_order } }
      },
      order_by: { workflow_step: { step_order: asc } }
    ) {
      id
      status
      workflow_step_id
      workflow_step {
        id
        step_order
        name
        step_type
        config
      }
    }
  }
`;

// ── Quota Update ───────────────────────────────────────────

export const INCREMENT_QUOTA = gql`
  mutation IncrementQuota($org_id: uuid!) {
    update_organizations_by_pk(pk_columns: { id: $org_id }, _inc: { quota_used: 1 }) {
      id
      quota_used
    }
  }
`;

// ── DB Write ───────────────────────────────────────────────

export const INSERT_WORKFLOW_DATA = gql`
  mutation InsertWorkflowData($org_id: uuid!, $workflow_run_id: uuid!, $step_run_id: uuid!, $data: jsonb!) {
    insert_workflow_data_one(object: {
      org_id: $org_id,
      workflow_run_id: $workflow_run_id,
      step_run_id: $step_run_id,
      data: $data
    }) {
      id
    }
  }
`;

// ── Webhook Trigger Lookup ─────────────────────────────────

export const GET_WORKFLOW_WEBHOOK_TRIGGER = gql`
  query GetWorkflowWebhookTrigger($workflow_id: uuid!) {
    workflow_triggers(where: {
      workflow_id: { _eq: $workflow_id },
      trigger_type: { _eq: "webhook" },
      is_active: { _eq: true }
    }) {
      id
      config
      workflow {
        id
        org_id
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
  }
`;

// ── Users Table ────────────────────────────────────────────

export const CREATE_USER = gql`
  mutation CreateUser($id: uuid!, $email: String!, $password_hash: String!, $display_name: String!) {
    insert_users_one(object: {
      id: $id,
      email: $email,
      password_hash: $password_hash,
      display_name: $display_name
    }) {
      id
      email
    }
  }
`;

export const GET_USER_BY_EMAIL = gql`
  query GetUserByEmail($email: String!) {
    users(where: { email: { _eq: $email } }) {
      id
      email
      password_hash
      display_name
    }
  }
`;

// ── Scheduled triggers lookup ──────────────────────────────

export const GET_SCHEDULED_TRIGGERS = gql`
  query GetScheduledTriggers {
    workflow_triggers(where: {
      trigger_type: { _eq: "scheduled" },
      is_active: { _eq: true }
    }) {
      id
      config
      workflow {
        id
        org_id
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
  }
`;
