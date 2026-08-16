"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useSubscription } from "@apollo/client/react";
import {
  GET_WORKFLOW_DETAIL, INSERT_WORKFLOW_STEP, UPDATE_WORKFLOW_STEP,
  DELETE_WORKFLOW_STEP, INSERT_WORKFLOW_TRIGGER, DELETE_WORKFLOW_TRIGGER,
  UPDATE_WORKFLOW,
  SUBSCRIBE_STEP_RUNS, SUBSCRIBE_WORKFLOW_RUN
} from "@/lib/graphql-operations";
import {
  ArrowLeft, Play, Plus, Trash2, Save, Settings, ChevronDown,
  CheckCircle2, XCircle, Clock, PauseCircle, Loader2,
  Brain, Globe, Database, Bell, GitBranch, ShieldCheck,
  Zap, Webhook, Calendar, Radio, Eye, Copy, Check,
  AlertCircle, Lock, Sparkles, Terminal, Info
} from "lucide-react";

const STEP_TYPES = [
  { value: "llm_call", label: "LLM Call", icon: Brain, color: "#7e238b", desc: "Call Groq AI models (Llama 3.3 / Mixtral)" },
  { value: "http_request", label: "HTTP Request", icon: Globe, color: "#617bff", desc: "Execute external REST API endpoints" },
  { value: "db_write", label: "DB Write", icon: Database, color: "#103c25", desc: "Persist sandboxed workflow data" },
  { value: "notify", label: "Notify", icon: Bell, color: "#e60023", desc: "Dispatch simulated or webhook alerts" },
  { value: "conditional_branch", label: "Conditional Branch", icon: GitBranch, color: "#6845ab", desc: "Dynamic upstream response routing" },
  { value: "approval_gate", label: "Approval Gate", icon: ShieldCheck, color: "#cc001f", desc: "Mid-execution human sign-off checkpoint" },
];

const TRIGGER_TYPES = [
  { value: "manual", label: "Manual Run", icon: Play, desc: "Trigger directly from studio UI" },
  { value: "webhook", label: "Inbound Webhook", icon: Webhook, desc: "Trigger via authenticated HTTP POST" },
  { value: "scheduled", label: "Cron Schedule", icon: Calendar, desc: "Periodic automated execution" },
  { value: "database_event", label: "Database Event", icon: Radio, desc: "Reactive database mutation trigger" },
];

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: "#62625b", bg: "badge-pending", label: "Pending" },
  running: { icon: Loader2, color: "#1d4ed8", bg: "badge-running", label: "Running" },
  completed: { icon: CheckCircle2, color: "#0d5932", bg: "badge-completed", label: "Completed" },
  failed: { icon: XCircle, color: "#9e0a0a", bg: "badge-failed", label: "Failed" },
  skipped: { icon: Eye, color: "#91918c", bg: "badge-skipped", label: "Skipped" },
  paused_awaiting_approval: { icon: PauseCircle, color: "#92400e", bg: "badge-paused", label: "Awaiting Approval" },
  paused: { icon: PauseCircle, color: "#92400e", bg: "badge-paused", label: "Paused" },
};

function StepConfigForm({ step, onConfigChange }: { step: any; onConfigChange: (config: any) => void }) {
  const config = step.config || {};

  switch (step.step_type) {
    case "llm_call":
      return (
        <div className="space-y-4 pt-2">
          <div>
            <label className="label">Groq Model</label>
            <select
              className="text-input text-xs"
              value={config.model || "llama-3.1-8b-instant"}
              onChange={(e) => onConfigChange({ ...config, model: e.target.value })}
            >
              <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant (Ultra-fast)</option>
              <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile (Deep Reasoning)</option>
              <option value="mixtral-8x7b-32768">Mixtral 8x7B (High Context)</option>
            </select>
          </div>
          <div>
            <label className="label">System Prompt</label>
            <textarea
              className="text-input text-xs"
              value={config.system_prompt || ""}
              onChange={(e) => onConfigChange({ ...config, system_prompt: e.target.value })}
              placeholder="You are an expert workflow agent..."
              rows={2}
            />
          </div>
          <div>
            <label className="label">
              User Prompt (Use <code className="text-[#e60023] font-bold">{"{{previous_output}}"}</code> for state chaining)
            </label>
            <textarea
              className="text-input text-xs"
              value={config.prompt || ""}
              onChange={(e) => onConfigChange({ ...config, prompt: e.target.value })}
              placeholder="Analyze the following: {{previous_output}}"
              rows={3}
            />
          </div>
        </div>
      );

    case "http_request":
      return (
        <div className="space-y-4 pt-2">
          <div>
            <label className="label">Target Endpoint URL</label>
            <input
              className="text-input text-xs"
              value={config.url || ""}
              onChange={(e) => onConfigChange({ ...config, url: e.target.value })}
              placeholder="https://api.example.com/verify"
            />
          </div>
          <div>
            <label className="label">HTTP Method</label>
            <select
              className="text-input text-xs"
              value={config.method || "GET"}
              onChange={(e) => onConfigChange({ ...config, method: e.target.value })}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
        </div>
      );

    case "conditional_branch":
      return (
        <div className="space-y-4 pt-2">
          <div>
            <label className="label">Target Field (from upstream output)</label>
            <input
              className="text-input text-xs"
              value={config.condition?.field || "response"}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  condition: { ...config.condition, field: e.target.value },
                })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Comparison Operator</label>
              <select
                className="text-input text-xs"
                value={config.condition?.operator || "contains"}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    condition: { ...config.condition, operator: e.target.value },
                  })
                }
              >
                <option value="contains">Contains</option>
                <option value="not_contains">Does Not Contain</option>
                <option value="equals">Equals</option>
                <option value="not_equals">Not Equals</option>
              </select>
            </div>
            <div>
              <label className="label">Expected Value</label>
              <input
                className="text-input text-xs"
                value={config.condition?.value || ""}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    condition: { ...config.condition, value: e.target.value },
                  })
                }
                placeholder="e.g. true, yes, 200"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-[#33332e] cursor-pointer">
            <input
              type="checkbox"
              checked={config.skip_on_false || false}
              onChange={(e) => onConfigChange({ ...config, skip_on_false: e.target.checked })}
              className="rounded accent-[#e60023]"
            />
            <span>Skip downstream execution if condition evaluates to false</span>
          </label>
        </div>
      );

    case "approval_gate":
      return (
        <div className="space-y-4 pt-2">
          <div>
            <label className="label">Approval Instruction Message</label>
            <textarea
              className="text-input text-xs"
              value={config.approval_message || ""}
              onChange={(e) => onConfigChange({ ...config, approval_message: e.target.value })}
              placeholder="Please inspect the generated payload and verify accuracy before publishing..."
              rows={2}
            />
          </div>
        </div>
      );

    case "db_write":
      return (
        <div className="space-y-4 pt-2">
          <div>
            <label className="label">Payload Structure (JSON or State Key)</label>
            <textarea
              className="text-input text-xs font-mono"
              value={
                typeof config.data === "string"
                  ? config.data
                  : JSON.stringify(config.data || {}, null, 2)
              }
              onChange={(e) => {
                try {
                  onConfigChange({ ...config, data: JSON.parse(e.target.value) });
                } catch {
                  onConfigChange({ ...config, data: e.target.value });
                }
              }}
              placeholder='{"status": "published", "record_id": "{{previous_output}}"}'
              rows={3}
            />
          </div>
        </div>
      );

    case "notify":
      return (
        <div className="space-y-4 pt-2">
          <div>
            <label className="label">Notification Channel</label>
            <select
              className="text-input text-xs"
              value={config.channel || "log"}
              onChange={(e) => onConfigChange({ ...config, channel: e.target.value })}
            >
              <option value="log">Internal System Log</option>
              <option value="slack">Slack Webhook</option>
              <option value="email">Email Notification</option>
            </select>
          </div>
          <div>
            <label className="label">Message Template</label>
            <textarea
              className="text-input text-xs"
              value={config.message || ""}
              onChange={(e) => onConfigChange({ ...config, message: e.target.value })}
              placeholder="Pipeline completed successfully: {{previous_output}}"
              rows={2}
            />
          </div>
        </div>
      );

    default:
      return <p className="text-xs text-[#91918c]">No custom properties required for this node.</p>;
  }
}

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token, userRole, isAuthenticated, isLoading: authLoading } = useAuth();
  const workflowId = params.id as string;

  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [stepConfigs, setStepConfigs] = useState<Record<string, any>>({});
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [showAddStep, setShowAddStep] = useState(false);
  const [showAddTrigger, setShowAddTrigger] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Fetch workflow detail
  const { data, loading, refetch } = useQuery<any>(GET_WORKFLOW_DETAIL, {
    variables: { id: workflowId },
    skip: !workflowId || !isAuthenticated,
    pollInterval: 3000,
  });

  const workflow = data?.workflows_by_pk;

  useEffect(() => {
    if (workflow) {
      setEditName(workflow.name);
      setEditDesc(workflow.description || "");
      if (workflow.workflow_runs?.[0] && !activeRunId) {
        setActiveRunId(workflow.workflow_runs[0].id);
      }
    }
  }, [workflow, activeRunId]);

  // Mutations
  const [insertStep] = useMutation(INSERT_WORKFLOW_STEP, { onCompleted: () => refetch() });
  const [updateStep] = useMutation(UPDATE_WORKFLOW_STEP, { onCompleted: () => refetch() });
  const [deleteStep] = useMutation(DELETE_WORKFLOW_STEP, { onCompleted: () => refetch() });
  const [insertTrigger] = useMutation(INSERT_WORKFLOW_TRIGGER, { onCompleted: () => refetch() });
  const [deleteTrigger] = useMutation(DELETE_WORKFLOW_TRIGGER, { onCompleted: () => refetch() });
  const [updateWorkflow] = useMutation(UPDATE_WORKFLOW);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const triggerRun = async (opts: { variables: { workflow_id: string } }) => {
    setTriggerLoading(true);
    try {
      const res = await fetch('/api/backend/api/trigger-workflow-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ input: { workflow_id: opts.variables.workflow_id } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to trigger workflow');
      setActiveRunId(data.workflow_run_id);
      showToast("Workflow execution launched!", "success");
      refetch();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setTriggerLoading(false);
    }
  };

  const [approvingStep, setApprovingStep] = useState(false);
  const approveStepMut = async (opts: { variables: { step_run_id: string } }) => {
    setApprovingStep(true);
    try {
      const res = await fetch('/api/backend/api/approve-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ input: { step_run_id: opts.variables.step_run_id } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to approve step');
      showToast("Step approved! Resuming execution stream.", "success");
      refetch();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setApprovingStep(false);
    }
  };

  // Live Subscriptions & Fallback
  const { data: stepRunsData } = useSubscription<any>(SUBSCRIBE_STEP_RUNS, {
    variables: { workflow_run_id: activeRunId },
    skip: !activeRunId,
  });

  const { data: runData } = useSubscription<any>(SUBSCRIBE_WORKFLOW_RUN, {
    variables: { id: activeRunId },
    skip: !activeRunId,
  });

  const activeRun = workflow?.workflow_runs?.find((r: any) => r.id === activeRunId) || workflow?.workflow_runs?.[0];
  const liveStepRuns = (stepRunsData?.step_runs?.length ? stepRunsData.step_runs : activeRun?.step_runs) || [];
  const liveRunStatus = runData?.workflow_runs_by_pk?.status || activeRun?.status;

  const showToast = (message: string, type: string) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, authLoading, router]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[#fbfbf9] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-3 border-[#dadad3] border-t-[#e60023] animate-spin" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="min-h-screen bg-[#fbfbf9] flex items-center justify-center p-6">
        <div className="pin-card-white p-8 text-center max-w-md">
          <div className="w-12 h-12 rounded-full bg-[#f6f6f3] flex items-center justify-center mx-auto mb-4 text-[#e60023]">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="font-heading-lg text-[#000000] mb-2">Workflow Not Found</h2>
          <p className="text-sm text-[#62625b] mb-6">
            This workflow does not exist or your organization does not hold authorization to access it.
          </p>
          <button onClick={() => router.push("/dashboard")} className="btn btn-primary btn-pill px-6">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const steps = workflow.workflow_steps || [];
  const triggers = workflow.workflow_triggers || [];
  const canEdit = userRole === "owner" || userRole === "editor";
  const canRun = canEdit;
  const webhookTrigger = triggers.find((t: any) => t.trigger_type === "webhook");

  return (
    <div className="min-h-screen bg-[#fbfbf9] text-[#33332e] flex flex-col">
      {/* Studio Header Bar */}
      <header className="sticky top-0 z-30 bg-[#ffffff] border-b border-[#dadad3] px-6 h-16 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => router.push("/dashboard")}
            className="btn-icon-circular w-9 h-9 shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            {canEdit ? (
              <input
                className="font-heading-md text-[#000000] bg-transparent border-none outline-none focus:text-[#e60023] transition-colors p-0 truncate max-w-md"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() =>
                  updateWorkflow({
                    variables: { id: workflowId, name: editName, description: editDesc },
                  })
                }
              />
            ) : (
              <h1 className="font-heading-md text-[#000000] truncate">{workflow.name}</h1>
            )}

            <div className="flex items-center gap-2 mt-0.5 text-xs text-[#62625b]">
              <span>{steps.length} steps</span>
              <span>•</span>
              <span>{triggers.length} triggers</span>
              {liveRunStatus && (
                <>
                  <span>•</span>
                  <span className={`badge badge-${liveRunStatus} text-[0.65rem]`}>
                    {liveRunStatus.replace("_", " ")}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right CTA Cluster */}
        <div className="flex items-center gap-3 shrink-0">
          {canRun && (
            <button
              onClick={() => triggerRun({ variables: { workflow_id: workflowId } })}
              disabled={triggerLoading || steps.length === 0}
              className="btn btn-primary btn-pill text-xs px-5 py-2 flex items-center gap-2"
            >
              {triggerLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>Run Pipeline</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Studio 2-Column Grid */}
      <main className="max-w-7xl mx-auto px-6 py-8 w-full flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Workflow Step Builder (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading-md text-[#000000]">Pipeline Nodes</h2>
              <p className="text-xs text-[#62625b]">Sequential agent logic, models, and checkpoints</p>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowAddStep(true)}
                className="btn btn-secondary btn-pill text-xs px-4"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Node
              </button>
            )}
          </div>

          {/* Steps List */}
          <div className="space-y-4">
            {steps.map((step: any, idx: number) => {
              const stepType = STEP_TYPES.find((t) => t.value === step.step_type);
              const Icon = stepType?.icon || Zap;
              const isEditing = editingStep === step.id;

              return (
                <div key={step.id} className="relative">
                  <div
                    className="pin-card-white p-5 hover:border-[#dadad3] transition-all"
                    style={{
                      borderLeft: `4px solid ${stepType?.color || "#62625b"}`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-2xs shrink-0"
                          style={{ backgroundColor: stepType?.color || "#62625b" }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#000000]">{step.name}</span>
                            <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-[#f6f6f3] text-[#62625b] font-semibold">
                              Step {step.step_order}
                            </span>
                          </div>
                          <span className="text-xs text-[#62625b]">
                            {stepType?.desc || step.step_type}
                          </span>
                        </div>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingStep(isEditing ? null : step.id)}
                            className="btn-icon-circular w-8 h-8"
                            title="Configure Node"
                          >
                            <Settings className="w-3.5 h-3.5 text-[#62625b]" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Remove step "${step.name}"?`)) {
                                deleteStep({ variables: { id: step.id } });
                              }
                            }}
                            className="btn-icon-circular w-8 h-8 hover:text-[#9e0a0a]"
                            title="Delete Node"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Node Config Drawer */}
                    {isEditing && (
                      <div className="mt-4 pt-4 border-t border-[#e5e5e0] space-y-4">
                        <div>
                          <label className="label">Step Label</label>
                          <input
                            className="text-input text-xs"
                            value={stepConfigs[step.id]?.name ?? step.name}
                            onChange={(e) =>
                              setStepConfigs({
                                ...stepConfigs,
                                [step.id]: { ...stepConfigs[step.id], name: e.target.value },
                              })
                            }
                          />
                        </div>

                        <StepConfigForm
                          step={{
                            ...step,
                            config: stepConfigs[step.id]?.config ?? step.config,
                          }}
                          onConfigChange={(config) =>
                            setStepConfigs({
                              ...stepConfigs,
                              [step.id]: { ...stepConfigs[step.id], config },
                            })
                          }
                        />

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            onClick={() => setEditingStep(null)}
                            className="btn btn-secondary btn-sm"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              const updates = stepConfigs[step.id] || {};
                              updateStep({
                                variables: {
                                  id: step.id,
                                  name: updates.name || step.name,
                                  step_type: step.step_type,
                                  config: updates.config || step.config,
                                  step_order: step.step_order,
                                },
                              });
                              setEditingStep(null);
                              showToast("Step configuration saved!", "success");
                            }}
                            className="btn btn-primary btn-sm"
                          >
                            <Save className="w-3.5 h-3.5" />
                            Save Configuration
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {idx < steps.length - 1 && (
                    <div className="flex justify-center my-1.5">
                      <div className="w-6 h-6 rounded-full bg-[#f6f6f3] border border-[#dadad3] flex items-center justify-center text-[#91918c]">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {steps.length === 0 && (
              <div className="pin-card p-8 text-center">
                <Brain className="w-8 h-8 mx-auto text-[#91918c] mb-2" />
                <p className="text-sm font-semibold text-[#000000]">No nodes added</p>
                <p className="text-xs text-[#62625b] mt-1 mb-4">
                  Add your first LLM reasoning, API request, or approval node to activate this pipeline.
                </p>
                {canEdit && (
                  <button onClick={() => setShowAddStep(true)} className="btn btn-primary btn-pill text-xs">
                    <Plus className="w-3.5 h-3.5" /> Add Node
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Trigger Management */}
          <div className="pt-6 border-t border-[#dadad3] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading-md text-[#000000]">Workflow Triggers</h3>
                <p className="text-xs text-[#62625b]">Configured entry points for this pipeline</p>
              </div>
              {canEdit && (
                <button
                  onClick={() => setShowAddTrigger(true)}
                  className="btn btn-secondary btn-pill text-xs px-4"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Trigger
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {triggers.map((trigger: any) => {
                const tt = TRIGGER_TYPES.find((t) => t.value === trigger.trigger_type);
                const TIcon = tt?.icon || Zap;

                return (
                  <div
                    key={trigger.id}
                    className="pin-card-white p-4 flex items-center justify-between border border-[#e5e5e0]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#f6f6f3] flex items-center justify-center text-[#e60023]">
                        <TIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[#000000] capitalize block">
                          {trigger.trigger_type.replace("_", " ")}
                        </span>
                        <span className="text-[0.65rem] text-[#62625b]">
                          {tt?.desc || "Automated trigger"}
                        </span>
                      </div>
                    </div>

                    {canEdit && (
                      <button
                        onClick={() => deleteTrigger({ variables: { id: trigger.id } })}
                        className="btn-icon-circular w-7 h-7 hover:text-[#9e0a0a]"
                        title="Remove Trigger"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Webhook Endpoint Code Box */}
            {webhookTrigger && (
              <div className="pin-card p-5 bg-[#ffffff] border border-[#dadad3] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#000000] flex items-center gap-2">
                    <Webhook className="w-4 h-4 text-[#e60023]" />
                    Inbound Webhook Specification
                  </span>
                  <button
                    onClick={() => {
                      const payload = JSON.stringify(
                        {
                          workflow_id: workflowId,
                          secret: webhookTrigger.config?.secret || "acme_secret_key_123",
                        },
                        null,
                        2
                      );
                      navigator.clipboard.writeText(payload);
                      setCopiedWebhook(true);
                      setTimeout(() => setCopiedWebhook(false), 3000);
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    {copiedWebhook ? <Check className="w-3.5 h-3.5 text-[#0d5932]" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedWebhook ? "Copied" : "Copy Payload"}
                  </button>
                </div>

                <div className="bg-[#f6f6f3] rounded-xl p-3 font-mono text-[0.7rem] text-[#211922] overflow-x-auto border border-[#e5e5e0]">
                  <p className="text-[#62625b] mb-1">// POST to Webhook Endpoint</p>
                  <p className="font-bold text-[#000000] mb-2">
                    POST {typeof window !== "undefined" ? window.location.origin : ""}/api/webhook
                  </p>
                  <p className="text-[#62625b] mb-1">// JSON Request Body</p>
                  <pre className="m-0 text-[#211922]">
{`{
  "workflow_id": "${workflowId}",
  "secret": "${webhookTrigger.config?.secret || 'YOUR_SECRET'}",
  "payload": {}
}`}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Run Monitor (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div>
            <h2 className="font-heading-md text-[#000000]">Execution Stream</h2>
            <p className="text-xs text-[#62625b]">Real-time node telemetry and outputs via WebSocket</p>
          </div>

          {liveStepRuns.length > 0 ? (
            <div className="space-y-4">
              {liveStepRuns.map((sr: any) => {
                const statusConf = STATUS_CONFIG[sr.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusConf.icon;
                const isAwaitingApproval = sr.status === "paused_awaiting_approval";
                const isRunning = sr.status === "running";

                return (
                  <div
                    key={sr.id}
                    className={`pin-card-white p-5 space-y-3 transition-all ${
                      isRunning ? "running-pulse border-[#617bff]" : ""
                    } ${isAwaitingApproval ? "border-[#f59e0b] bg-[#fefdf9]" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shadow-2xs"
                          style={{
                            backgroundColor: `${statusConf.color}15`,
                            color: statusConf.color,
                          }}
                        >
                          <StatusIcon className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} />
                        </div>
                        <div>
                          <span className="font-bold text-xs text-[#000000] block">
                            {sr.workflow_step?.name}
                          </span>
                          <span className="text-[0.65rem] text-[#62625b] capitalize">
                            {sr.workflow_step?.step_type?.replace("_", " ")}
                          </span>
                        </div>
                      </div>

                      <span className={`badge ${statusConf.bg}`}>
                        {statusConf.label}
                      </span>
                    </div>

                    {/* Step Output Box */}
                    {sr.output && Object.keys(sr.output).length > 0 && (
                      <div className="bg-[#f6f6f3] rounded-xl p-3 text-[0.7rem] font-mono text-[#211922] max-h-36 overflow-y-auto border border-[#e5e5e0]">
                        {sr.output.response
                          ? sr.output.response
                          : JSON.stringify(sr.output, null, 2)}
                      </div>
                    )}

                    {/* Error Box */}
                    {sr.error && (
                      <div className="bg-[#fde8e8] border border-[#fbd5d5] rounded-xl p-3 text-xs text-[#9e0a0a]">
                        <span className="font-bold block mb-1">Execution Error:</span>
                        {sr.error}
                      </div>
                    )}

                    {/* Mid-Execution Approval Gate Banner */}
                    {isAwaitingApproval && canEdit && (
                      <div className="p-4 rounded-2xl bg-[#fef3c7] border border-[#fde68a] space-y-3">
                        <div className="flex items-start gap-2.5">
                          <PauseCircle className="w-5 h-5 text-[#92400e] shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-xs text-[#92400e] block">
                              Approval Sign-off Required
                            </span>
                            <p className="text-xs text-[#92400e] mt-0.5 leading-relaxed">
                              {sr.output?.message || "Execution is currently held awaiting authorized human approval."}
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => approveStepMut({ variables: { step_run_id: sr.id } })}
                            disabled={approvingStep}
                            className="btn btn-primary btn-pill text-xs px-5"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {approvingStep ? "Authorizing..." : "Approve & Continue"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Approval Receipt */}
                    {sr.approved_by && (
                      <div className="flex items-center gap-1.5 text-xs text-[#0d5932] font-semibold pt-1">
                        <Check className="w-3.5 h-3.5 text-[#0d5932]" />
                        <span>
                          Approved by {sr.approved_by} at {new Date(sr.approved_at).toLocaleTimeString()}
                        </span>
                      </div>
                    )}

                    {/* Telemetry Timing */}
                    {sr.completed_at && sr.started_at && (
                      <div className="flex items-center justify-between text-[0.65rem] text-[#91918c] pt-2 border-t border-[#e5e5e0]">
                        <span>
                          Elapsed: {((new Date(sr.completed_at).getTime() - new Date(sr.started_at).getTime()) / 1000).toFixed(2)}s
                        </span>
                        {sr.attempt_count > 1 && <span>Attempts: {sr.attempt_count}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="pin-card-white p-8 text-center">
              <div className="w-10 h-10 rounded-full bg-[#f6f6f3] flex items-center justify-center mx-auto mb-3 text-[#62625b]">
                <Terminal className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-[#000000]">No Active Execution</p>
              <p className="text-xs text-[#62625b] mt-1 mb-4">
                Click &quot;Run Pipeline&quot; to stream real-time node outputs.
              </p>
              {canRun && (
                <button
                  onClick={() => triggerRun({ variables: { workflow_id: workflowId } })}
                  disabled={triggerLoading || steps.length === 0}
                  className="btn btn-primary btn-pill text-xs px-5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Run Pipeline
                </button>
              )}
            </div>
          )}

          {/* Historical Runs Pill List */}
          {workflow.workflow_runs?.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-[#dadad3]">
              <span className="text-xs font-bold text-[#000000] uppercase tracking-wider block">
                Run History ({workflow.workflow_runs.length})
              </span>
              <div className="space-y-2">
                {workflow.workflow_runs.map((run: any) => {
                  const isActive = run.id === activeRunId;
                  return (
                    <button
                      key={run.id}
                      onClick={() => setActiveRunId(run.id)}
                      className={`w-full pin-card-white p-3.5 flex items-center justify-between text-left transition-all ${
                        isActive ? "border-[#000000] shadow-2xs" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`badge badge-${run.status} text-[0.65rem]`}>
                          {run.status.replace("_", " ")}
                        </span>
                        <span className="text-xs text-[#62625b]">
                          {new Date(run.started_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <span className="text-[0.65rem] text-[#91918c] font-semibold capitalize">
                        {run.triggered_by}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Add Step Modal (Pinterest 32px Modal Card) */}
      {showAddStep && (
        <div className="modal-overlay" onClick={() => setShowAddStep(false)}>
          <div className="modal-card max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#f6f6f3] flex items-center justify-center text-[#e60023]">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-heading-lg text-[#000000]">Add Node to Pipeline</h2>
                <p className="text-xs text-[#62625b]">Select node type to chain into execution sequence</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6">
              {STEP_TYPES.map((type) => {
                const Icon = type.icon;
                // Layer 2: Only owners can add db_write and notify steps
                const restricted = ["db_write", "notify"].includes(type.value) && userRole !== "owner";

                return (
                  <button
                    key={type.value}
                    disabled={restricted}
                    onClick={() => {
                      insertStep({
                        variables: {
                          workflow_id: workflowId,
                          step_order: steps.length + 1,
                          name: `${type.label} ${steps.length + 1}`,
                          step_type: type.value,
                          config: {},
                        },
                      });
                      setShowAddStep(false);
                      showToast(`Added ${type.label} node!`, "success");
                    }}
                    className={`pin-card-white p-4 text-left border border-[#e5e5e0] hover:border-[#dadad3] transition-all flex flex-col justify-between ${
                      restricted ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    <div>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white mb-2.5 shadow-2xs"
                        style={{ backgroundColor: type.color }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-sm text-[#000000]">{type.label}</h3>
                      <p className="text-xs text-[#62625b] mt-1 leading-relaxed">{type.desc}</p>
                    </div>

                    {restricted && (
                      <span className="inline-flex items-center gap-1 text-[0.65rem] text-[#9e0a0a] font-bold mt-2">
                        <Lock className="w-3 h-3" /> Owner permission required
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end pt-4 border-t border-[#e5e5e0]">
              <button
                onClick={() => setShowAddStep(false)}
                className="btn btn-secondary btn-pill px-6"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Trigger Modal (Pinterest 32px Modal Card) */}
      {showAddTrigger && (
        <div className="modal-overlay" onClick={() => setShowAddTrigger(false)}>
          <div className="modal-card max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#f6f6f3] flex items-center justify-center text-[#e60023]">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-heading-lg text-[#000000]">Configure Trigger</h2>
                <p className="text-xs text-[#62625b]">Select execution source for this workflow</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {TRIGGER_TYPES.map((type) => {
                const Icon = type.icon;
                const restricted = type.value === "webhook" && userRole !== "owner";
                const alreadyExists = triggers.some((t: any) => t.trigger_type === type.value);

                return (
                  <button
                    key={type.value}
                    disabled={restricted || alreadyExists}
                    onClick={() => {
                      const config: any = {};
                      if (type.value === "webhook") {
                        config.secret = Math.random().toString(36).slice(2, 18);
                      }
                      if (type.value === "scheduled") {
                        config.cron = "0 */6 * * *";
                      }
                      insertTrigger({
                        variables: { workflow_id: workflowId, trigger_type: type.value, config },
                      });
                      setShowAddTrigger(false);
                      showToast(`Added ${type.label}!`, "success");
                    }}
                    className={`w-full pin-card-white p-4 text-left border border-[#e5e5e0] hover:border-[#dadad3] transition-all flex items-center justify-between ${
                      restricted || alreadyExists ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#f6f6f3] flex items-center justify-center text-[#e60023]">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-sm text-[#000000] block">{type.label}</span>
                        <span className="text-xs text-[#62625b]">{type.desc}</span>
                      </div>
                    </div>

                    {restricted && (
                      <span className="text-[0.65rem] text-[#9e0a0a] font-bold">Owner only</span>
                    )}
                    {alreadyExists && (
                      <span className="text-[0.65rem] text-[#91918c] font-semibold">Active</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end pt-4 border-t border-[#e5e5e0]">
              <button
                onClick={() => setShowAddTrigger(false)}
                className="btn btn-secondary btn-pill px-6"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type === "error" ? "toast-error" : "toast-success"}`}>
            {toast.type === "error" ? (
              <AlertCircle className="w-4 h-4 text-[#9e0a0a]" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#0d5932]" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
