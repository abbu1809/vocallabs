import { gql } from '@apollo/client';

// ── Queries ────────────────────────────────────────────────

export const GET_USER_ORGS = gql`
  query GetUserOrgs {
    org_members {
      org_id
      role
      organization {
        id
        name
        quota_limit
        quota_used
      }
    }
  }
`;

export const GET_ORG_WORKFLOWS = gql`
  query GetOrgWorkflows($org_id: uuid!) {
    workflows(where: { org_id: { _eq: $org_id } }, order_by: { updated_at: desc }) {
      id
      name
      description
      is_active
      created_at
      updated_at
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
      workflow_runs(limit: 1, order_by: { created_at: desc }) {
        id
        status
        started_at
        completed_at
        triggered_by
      }
    }
  }
`;

export const GET_WORKFLOW_DETAIL = gql`
  query GetWorkflowDetail($id: uuid!) {
    workflows_by_pk(id: $id) {
      id
      name
      description
      is_active
      org_id
      created_at
      updated_at
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
      workflow_runs(order_by: { created_at: desc }, limit: 10) {
        id
        status
        triggered_by
        started_at
        completed_at
        error
        step_runs(order_by: { workflow_step: { step_order: asc } }) {
          id
          status
          output
          error
          attempt_count
          approved_by
          approved_at
          started_at
          completed_at
          workflow_step {
            id
            name
            step_type
            step_order
          }
        }
      }
    }
  }
`;

export const GET_ORG_USAGE = gql`
  query GetOrgUsage($org_id: uuid!) {
    organizations_by_pk(id: $org_id) {
      id
      name
      quota_limit
      quota_used
    }
  }
`;

export const GET_ORG_MEMBERS = gql`
  query GetOrgMembers($org_id: uuid!) {
    org_members(where: { org_id: { _eq: $org_id } }) {
      id
      user_id
      role
      created_at
      user {
        id
        email
        display_name
      }
    }
  }
`;

// ── Mutations ──────────────────────────────────────────────

export const CREATE_WORKFLOW = gql`
  mutation CreateWorkflow($org_id: uuid!, $name: String!, $description: String) {
    insert_workflows_one(object: {
      org_id: $org_id,
      name: $name,
      description: $description
    }) {
      id
      name
    }
  }
`;

export const UPDATE_WORKFLOW = gql`
  mutation UpdateWorkflow($id: uuid!, $name: String!, $description: String, $is_active: Boolean) {
    update_workflows_by_pk(pk_columns: { id: $id }, _set: {
      name: $name,
      description: $description,
      is_active: $is_active,
      updated_at: "now()"
    }) {
      id
      name
    }
  }
`;

export const DELETE_WORKFLOW = gql`
  mutation DeleteWorkflow($id: uuid!) {
    delete_workflows_by_pk(id: $id) {
      id
    }
  }
`;

export const INSERT_WORKFLOW_STEP = gql`
  mutation InsertWorkflowStep(
    $workflow_id: uuid!,
    $step_order: Int!,
    $name: String!,
    $step_type: String!,
    $config: jsonb!
  ) {
    insert_workflow_steps_one(object: {
      workflow_id: $workflow_id,
      step_order: $step_order,
      name: $name,
      step_type: $step_type,
      config: $config
    }) {
      id
      step_order
      name
      step_type
    }
  }
`;

export const UPDATE_WORKFLOW_STEP = gql`
  mutation UpdateWorkflowStep(
    $id: uuid!,
    $name: String!,
    $step_type: String!,
    $config: jsonb!,
    $step_order: Int!
  ) {
    update_workflow_steps_by_pk(pk_columns: { id: $id }, _set: {
      name: $name,
      step_type: $step_type,
      config: $config,
      step_order: $step_order,
      updated_at: "now()"
    }) {
      id
    }
  }
`;

export const DELETE_WORKFLOW_STEP = gql`
  mutation DeleteWorkflowStep($id: uuid!) {
    delete_workflow_steps_by_pk(id: $id) {
      id
    }
  }
`;

export const INSERT_WORKFLOW_TRIGGER = gql`
  mutation InsertWorkflowTrigger(
    $workflow_id: uuid!,
    $trigger_type: String!,
    $config: jsonb!
  ) {
    insert_workflow_triggers_one(object: {
      workflow_id: $workflow_id,
      trigger_type: $trigger_type,
      config: $config
    }) {
      id
    }
  }
`;

export const DELETE_WORKFLOW_TRIGGER = gql`
  mutation DeleteWorkflowTrigger($id: uuid!) {
    delete_workflow_triggers_by_pk(id: $id) {
      id
    }
  }
`;

export const ADD_ORG_MEMBER = gql`
  mutation AddOrgMember($org_id: uuid!, $user_id: uuid!, $role: String!) {
    insert_org_members_one(object: {
      org_id: $org_id,
      user_id: $user_id,
      role: $role
    }) {
      id
    }
  }
`;

export const REMOVE_ORG_MEMBER = gql`
  mutation RemoveOrgMember($id: uuid!) {
    delete_org_members_by_pk(id: $id) {
      id
    }
  }
`;

// ── Action Mutations ───────────────────────────────────────

export const TRIGGER_WORKFLOW_RUN = gql`
  mutation TriggerWorkflowRun($workflow_id: uuid!) {
    triggerWorkflowRun(workflow_id: $workflow_id) {
      workflow_run_id
      status
      message
    }
  }
`;

export const APPROVE_STEP = gql`
  mutation ApproveStep($step_run_id: uuid!) {
    approveStep(step_run_id: $step_run_id) {
      success
      message
      workflow_run_id
    }
  }
`;

// ── Subscriptions ──────────────────────────────────────────

export const SUBSCRIBE_STEP_RUNS = gql`
  subscription WatchStepRuns($workflow_run_id: uuid!) {
    step_runs(
      where: { workflow_run_id: { _eq: $workflow_run_id } }
      order_by: { workflow_step: { step_order: asc } }
    ) {
      id
      status
      input
      output
      error
      attempt_count
      approved_by
      approved_at
      started_at
      completed_at
      workflow_step {
        id
        name
        step_type
        step_order
      }
    }
  }
`;

export const SUBSCRIBE_WORKFLOW_RUN = gql`
  subscription WatchWorkflowRun($id: uuid!) {
    workflow_runs_by_pk(id: $id) {
      id
      status
      started_at
      completed_at
      error
    }
  }
`;
