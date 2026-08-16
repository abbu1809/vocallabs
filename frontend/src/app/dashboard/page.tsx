"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@apollo/client/react";
import {
  GET_USER_ORGS, GET_ORG_WORKFLOWS, GET_ORG_USAGE,
  CREATE_WORKFLOW, DELETE_WORKFLOW
} from "@/lib/graphql-operations";
import {
  LayoutDashboard, Plus, Play, Settings, LogOut,
  Workflow, ChevronRight, Building2, Users, Gauge,
  Zap, Clock, CheckCircle2, XCircle, PauseCircle,
  Trash2, Search, ArrowRight, ShieldCheck, Filter,
  SlidersHorizontal, Radio, Webhook, Calendar, Sparkles,
  ChevronDown, Check, AlertCircle, AlertTriangle, FolderPlus
} from "lucide-react";

const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="w-3.5 h-3.5 text-[#0d5932]" />,
  failed: <XCircle className="w-3.5 h-3.5 text-[#9e0a0a]" />,
  running: <Play className="w-3.5 h-3.5 text-[#1d4ed8] fill-current" />,
  paused: <PauseCircle className="w-3.5 h-3.5 text-[#92400e]" />,
  pending: <Clock className="w-3.5 h-3.5 text-[#62625b]" />,
};

const STEP_TYPE_COLORS: Record<string, string> = {
  llm_call: "#7e238b",
  http_request: "#617bff",
  db_write: "#103c25",
  notify: "#e60023",
  conditional_branch: "#6845ab",
  approval_gate: "#cc001f",
};

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading, logout, currentOrg, setCurrentOrg, orgs, setOrgs, createWorkspace, userRole } = useAuth();
  const router = useRouter();
  const [showNewWorkflow, setShowNewWorkflow] = useState(false);
  const [newWfName, setNewWfName] = useState("");
  const [newWfDesc, setNewWfDesc] = useState("");
  const [createError, setCreateError] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [showNewOrgModal, setShowNewOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [orgError, setOrgError] = useState("");
  const orgDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(event.target as Node)) {
        setIsOrgDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Fetch user orgs
  const { data: orgsData, loading: orgsLoading, refetch: refetchOrgs } = useQuery<any>(GET_USER_ORGS, {
    skip: !isAuthenticated,
  });

  useEffect(() => {
    if (orgsData?.org_members && orgsData.org_members.length > 0) {
      setOrgs(orgsData.org_members);
      if (!currentOrg) {
        setCurrentOrg(orgsData.org_members[0]);
      }
    }
  }, [orgsData, setOrgs, currentOrg, setCurrentOrg]);

  const effectiveOrgList = orgs.length > 0 ? orgs : (orgsData?.org_members || []);
  const effectiveOrg = currentOrg || effectiveOrgList[0];
  const activeOrgId = effectiveOrg?.org_id;

  // Fetch workflows for current org
  const { data: wfData, loading: wfLoading, refetch: refetchWf } = useQuery<any>(GET_ORG_WORKFLOWS, {
    variables: { org_id: activeOrgId },
    skip: !activeOrgId,
    pollInterval: 5000,
  });

  // Create workflow mutation with comprehensive error handling
  const [createWorkflow, { loading: creatingWf }] = useMutation(CREATE_WORKFLOW, {
    onCompleted: (data: any) => {
      refetchWf();
      setShowNewWorkflow(false);
      setNewWfName("");
      setNewWfDesc("");
      setCreateError("");
      if (data?.insert_workflows_one?.id) {
        router.push(`/workflows/${data.insert_workflows_one.id}`);
      }
    },
    onError: (err: any) => {
      console.error("Create workflow error:", err);
      setCreateError(err.message || "Failed to create workflow. Please verify permissions.");
    },
  });

  // Delete workflow mutation
  const [deleteWorkflow] = useMutation(DELETE_WORKFLOW, {
    onCompleted: () => refetchWf(),
  });

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#fbfbf9] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-3 border-[#dadad3] border-t-[#e60023] animate-spin" />
      </div>
    );
  }

  const org = effectiveOrg?.organization;
  const quotaUsed = org?.quota_used ?? 0;
  const quotaLimit = org?.quota_limit ?? 100;
  const quotaPercent = quotaLimit > 0 ? Math.min((quotaUsed / quotaLimit) * 100, 100) : 0;
  const effectiveRole = effectiveOrg?.role || userRole;

  const workflows = wfData?.workflows || [];

  const filteredWorkflows = workflows.filter((wf: any) => {
    const lastRun = wf.workflow_runs?.[0];
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "never_run" && !lastRun) ||
      lastRun?.status === filterStatus;
    const matchesSearch =
      searchFilter.trim() === "" ||
      wf.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (wf.description && wf.description.toLowerCase().includes(searchFilter.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const handleOpenCreateModal = () => {
    setCreateError("");
    setNewWfName("");
    setNewWfDesc("");
    setShowNewWorkflow(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");

    if (!newWfName.trim()) {
      setCreateError("Please enter a workflow name");
      return;
    }

    let targetOrgId = activeOrgId;

    // If no org exists yet, automatically create one first
    if (!targetOrgId) {
      try {
        const autoOrg = await createWorkspace(`${user?.display_name || user?.email?.split('@')[0] || 'My'}'s Workspace`);
        targetOrgId = autoOrg.org_id;
        refetchOrgs();
      } catch (err: any) {
        setCreateError(err.message || "Failed to auto-create workspace");
        return;
      }
    }

    createWorkflow({
      variables: {
        org_id: targetOrgId,
        name: newWfName.trim(),
        description: newWfDesc.trim() || "Automated AI Agent Workflow",
      },
    });
  };

  const handleCreateWorkspaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) {
      setOrgError("Please enter a workspace name");
      return;
    }
    setCreatingOrg(true);
    setOrgError("");

    try {
      await createWorkspace(newOrgName.trim());
      setShowNewOrgModal(false);
      setNewOrgName("");
      refetchOrgs();
    } catch (err: any) {
      setOrgError(err.message || "Failed to create workspace");
    } finally {
      setCreatingOrg(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfbf9] text-[#33332e] flex flex-col">
      {/* Pinterest Top Nav Bar */}
      <header className="sticky top-0 z-40 bg-[#ffffff] border-b border-[#dadad3] px-6 h-16 flex items-center justify-between gap-6">
        <div className="flex items-center gap-6 shrink-0">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2.5 bg-transparent border-none p-0 cursor-pointer text-left"
          >
            <div className="w-9 h-9 rounded-full bg-[#e60023] flex items-center justify-center text-white font-black text-xl shadow-xs">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <span className="font-extrabold text-xl text-[#000000] tracking-tight">VocalLabs</span>
          </button>

          {/* Custom Pinterest Org Dropdown Menu */}
          <div className="relative" ref={orgDropdownRef}>
            <button
              onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
              className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-[#f6f6f3] hover:bg-[#e5e5e0] transition-colors border border-[#dadad3] cursor-pointer text-left"
            >
              <div className="w-5 h-5 rounded-full bg-[#ffffff] flex items-center justify-center text-[#e60023] shadow-2xs">
                <Building2 className="w-3 h-3" />
              </div>
              <span className="text-xs font-bold text-[#000000] max-w-[140px] truncate">
                {org?.name || (effectiveOrgList.length > 0 ? "Select Workspace" : "No Workspace")}
              </span>
              {effectiveRole && (
                <span className="text-[0.65rem] px-1.5 py-0.5 rounded-md bg-[#ffffff] text-[#62625b] font-bold uppercase">
                  {effectiveRole}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-[#62625b] transition-transform ${isOrgDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Popup Menu */}
            {isOrgDropdownOpen && (
              <div className="absolute left-0 mt-2 w-72 bg-[#ffffff] rounded-2xl shadow-xl border border-[#dadad3] p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-2 border-b border-[#e5e5e0] mb-1 flex items-center justify-between">
                  <span className="text-[0.65rem] font-bold text-[#62625b] uppercase tracking-wider block">
                    Your Workspaces ({effectiveOrgList.length})
                  </span>
                  <button
                    onClick={() => {
                      setIsOrgDropdownOpen(false);
                      setShowNewOrgModal(true);
                    }}
                    className="text-xs text-[#e60023] font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    New
                  </button>
                </div>

                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {effectiveOrgList.map((o: any) => {
                    const isSelected = activeOrgId === o.org_id;
                    return (
                      <button
                        key={o.org_id}
                        onClick={() => {
                          setCurrentOrg(o);
                          setIsOrgDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors ${
                          isSelected ? "bg-[#f6f6f3] text-[#000000]" : "hover:bg-[#fbfbf9] text-[#33332e]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-[#e5e5e0] flex items-center justify-center text-xs font-bold text-[#000000] shrink-0">
                            {o.organization.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold block truncate">{o.organization.name}</span>
                            <span className="text-[0.65rem] text-[#62625b] capitalize block">{o.role}</span>
                          </div>
                        </div>

                        {isSelected && <Check className="w-4 h-4 text-[#e60023] shrink-0" />}
                      </button>
                    );
                  })}

                  {effectiveOrgList.length === 0 && (
                    <div className="p-3 text-center text-xs text-[#62625b]">
                      No workspaces yet. Create your first workspace below!
                    </div>
                  )}
                </div>

                <div className="pt-2 mt-1 border-t border-[#e5e5e0] space-y-1">
                  <button
                    onClick={() => {
                      setIsOrgDropdownOpen(false);
                      setShowNewOrgModal(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-[#e60023] hover:bg-[#f6f6f3] transition-colors"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Create New Workspace</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsOrgDropdownOpen(false);
                      router.push("/settings");
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#62625b] hover:bg-[#f6f6f3] hover:text-[#000000] transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Workspace Settings &amp; Quotas</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Centered Search Pill */}
        <div className="flex-1 max-w-xl search-bar-container">
          <Search className="absolute left-4 w-4 h-4 text-[#62625b] pointer-events-none" />
          <input
            type="text"
            className="search-bar"
            placeholder="Search workflows, triggers, actions..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>

        {/* Right Nav & User Cluster */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => router.push("/settings")}
            className="btn btn-secondary btn-pill text-xs px-3.5 py-1.5 flex items-center gap-1.5"
            title="Settings & Quota"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>

          {effectiveRole !== "viewer" && (
            <button
              onClick={handleOpenCreateModal}
              className="btn btn-primary btn-pill text-xs px-4 py-1.5 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Workflow</span>
            </button>
          )}

          {/* User Avatar Chip */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#dadad3]">
            <div className="w-8 h-8 rounded-full bg-[#e5e5e0] flex items-center justify-center font-bold text-xs text-[#000000]" title={user?.email}>
              {user?.email ? user.email.slice(0, 2).toUpperCase() : "U"}
            </div>
            <button
              onClick={logout}
              className="btn-icon-circular w-8 h-8"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5 text-[#62625b]" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="max-w-7xl mx-auto px-6 py-8 w-full flex-1 space-y-8">
        {/* If user has NO workspaces yet, show Pinterest Onboarding Card */}
        {effectiveOrgList.length === 0 ? (
          <div className="pin-card-white p-8 max-w-xl mx-auto text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#f6f6f3] flex items-center justify-center mx-auto text-[#e60023]">
              <Building2 className="w-6 h-6" />
            </div>
            <h2 className="font-heading-lg text-[#000000]">Create Your Workspace</h2>
            <p className="text-sm text-[#62625b] leading-relaxed">
              Every workflow belongs to an isolated organization workspace with dedicated execution quotas and role permissions.
            </p>
            <button
              onClick={() => setShowNewOrgModal(true)}
              className="btn btn-primary btn-pill px-6"
            >
              <Plus className="w-4 h-4" />
              Create Workspace
            </button>
          </div>
        ) : (
          /* Workspace Summary Card */
          org && (
            <div className="pin-card-white p-6 grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
              <div className="md:col-span-2">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="font-heading-lg text-[#000000]">{org.name}</h1>
                  <span className="badge badge-pending text-xs capitalize">
                    {effectiveRole}
                  </span>
                </div>
                <p className="text-xs text-[#62625b]">
                  Multi-tenant workspace with isolated execution boundaries &amp; RLS policies.
                </p>
              </div>

              <div className="bg-[#f6f6f3] p-4 rounded-2xl border border-[#e5e5e0]">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-[#000000]">Execution Quota</span>
                  <span className="font-mono text-[#62625b]">
                    {quotaUsed} / {quotaLimit}
                  </span>
                </div>
                <div className="quota-meter-bg">
                  <div
                    className="quota-meter-fill"
                    style={{
                      width: `${quotaPercent}%`,
                      backgroundColor: quotaPercent > 80 ? "#cc001f" : "#e60023",
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-3">
                <div className="text-right">
                  <span className="text-2xl font-black text-[#000000] block leading-none">
                    {workflows.length}
                  </span>
                  <span className="text-xs text-[#62625b]">Pipelines</span>
                </div>
                {effectiveRole !== "viewer" && (
                  <button
                    onClick={handleOpenCreateModal}
                    className="btn btn-primary btn-pill text-xs px-4"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New
                  </button>
                )}
              </div>
            </div>
          )
        )}

        {/* Filter Chips Bar */}
        <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setFilterStatus("all")}
              className={`filter-chip ${filterStatus === "all" ? "filter-chip-active" : ""}`}
            >
              All ({workflows.length})
            </button>
            <button
              onClick={() => setFilterStatus("running")}
              className={`filter-chip ${filterStatus === "running" ? "filter-chip-active" : ""}`}
            >
              Running
            </button>
            <button
              onClick={() => setFilterStatus("paused")}
              className={`filter-chip ${filterStatus === "paused" ? "filter-chip-active" : ""}`}
            >
              Awaiting Approval
            </button>
            <button
              onClick={() => setFilterStatus("completed")}
              className={`filter-chip ${filterStatus === "completed" ? "filter-chip-active" : ""}`}
            >
              Completed
            </button>
            <button
              onClick={() => setFilterStatus("never_run")}
              className={`filter-chip ${filterStatus === "never_run" ? "filter-chip-active" : ""}`}
            >
              Drafts
            </button>
          </div>

          <span className="text-xs text-[#62625b] font-medium">
            Showing {filteredWorkflows.length} of {workflows.length} workflows
          </span>
        </div>

        {/* Workflows Masonry Pin Grid */}
        {wfLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 rounded-full border-3 border-[#dadad3] border-t-[#e60023] animate-spin" />
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <div className="pin-card-white p-12 text-center max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-[#f6f6f3] flex items-center justify-center mx-auto mb-4 text-[#62625b]">
              <Workflow className="w-6 h-6" />
            </div>
            <h3 className="font-heading-md text-[#000000] mb-2">No workflows found</h3>
            <p className="text-sm text-[#62625b] mb-6 leading-relaxed">
              {workflows.length === 0
                ? "Get started by building your first AI pipeline with LLM calls, logic gates, and approvals."
                : "No workflows matched your current filter criteria."}
            </p>
            {effectiveRole !== "viewer" && workflows.length === 0 && (
              <button
                onClick={handleOpenCreateModal}
                className="btn btn-primary btn-pill px-6"
              >
                <Plus className="w-4 h-4" />
                Create Workflow
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorkflows.map((wf: any) => {
              const lastRun = wf.workflow_runs?.[0];
              const isRunning = lastRun?.status === "running";
              const isPaused = lastRun?.status === "paused";

              return (
                <div
                  key={wf.id}
                  onClick={() => router.push(`/workflows/${wf.id}`)}
                  className={`pin-card-white p-6 cursor-pointer flex flex-col justify-between hover:shadow-md transition-all group ${
                    isRunning ? "running-pulse border-[#617bff]" : ""
                  } ${isPaused ? "border-[#f59e0b]" : ""}`}
                >
                  <div>
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h3 className="font-heading-md text-[#000000] group-hover:text-[#e60023] transition-colors leading-snug">
                        {wf.name}
                      </h3>
                      {effectiveRole === "owner" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete workflow "${wf.name}"?`)) {
                              deleteWorkflow({ variables: { id: wf.id } });
                            }
                          }}
                          className="btn-icon-circular w-8 h-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-[#9e0a0a]"
                          title="Delete Workflow"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {wf.description && (
                      <p className="text-sm text-[#62625b] mb-4 line-clamp-2 leading-relaxed">
                        {wf.description}
                      </p>
                    )}

                    {/* Step Visual Graph */}
                    <div className="bg-[#f6f6f3] rounded-2xl p-3.5 mb-4 border border-[#e5e5e0]">
                      <span className="text-[0.65rem] font-bold text-[#62625b] uppercase tracking-wider block mb-2.5">
                        Pipeline Nodes ({wf.workflow_steps?.length || 0})
                      </span>
                      <div className="flex items-center flex-wrap gap-1.5">
                        {wf.workflow_steps?.slice(0, 6).map((step: any, idx: number) => (
                          <div key={step.id} className="flex items-center">
                            <div
                              className="px-2 py-0.5 rounded-full text-[0.65rem] font-bold text-white shadow-2xs"
                              style={{
                                backgroundColor: STEP_TYPE_COLORS[step.step_type] || "#62625b",
                              }}
                              title={`${step.name} (${step.step_type})`}
                            >
                              {step.step_order}. {step.name.length > 12 ? step.name.slice(0, 10) + '...' : step.name}
                            </div>
                            {idx < Math.min(wf.workflow_steps.length, 6) - 1 && (
                              <ChevronRight className="w-3 h-3 text-[#91918c] mx-0.5" />
                            )}
                          </div>
                        ))}
                        {(!wf.workflow_steps || wf.workflow_steps.length === 0) && (
                          <span className="text-xs text-[#91918c]">No steps configured</span>
                        )}
                      </div>
                    </div>

                    {/* Trigger Chips */}
                    <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                      {wf.workflow_triggers?.map((t: any) => (
                        <span
                          key={t.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.7rem] font-semibold bg-[#f6f6f3] text-[#33332e] border border-[#dadad3]"
                        >
                          {t.trigger_type === "webhook" && <Webhook className="w-3 h-3 text-[#617bff]" />}
                          {t.trigger_type === "manual" && <Play className="w-3 h-3 text-[#e60023]" />}
                          {t.trigger_type === "scheduled" && <Calendar className="w-3 h-3 text-[#7e238b]" />}
                          {t.trigger_type === "database_event" && <Radio className="w-3 h-3 text-[#103c25]" />}
                          <span className="capitalize">{t.trigger_type.replace("_", " ")}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Card Footer Status */}
                  <div className="pt-4 border-t border-[#e5e5e0] flex items-center justify-between">
                    {lastRun ? (
                      <div className="flex items-center gap-2">
                        {STATUS_ICONS[lastRun.status]}
                        <span className={`badge badge-${lastRun.status}`}>
                          {lastRun.status.replace("_", " ")}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-[#91918c] flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Never run
                      </span>
                    )}

                    <div className="flex items-center gap-1 text-xs font-bold text-[#000000] group-hover:text-[#e60023] transition-colors">
                      <span>Open</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Workflow Modal (Pinterest 32px Radius Card) */}
      {showNewWorkflow && (
        <div className="modal-overlay" onClick={() => setShowNewWorkflow(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#f6f6f3] flex items-center justify-center text-[#e60023]">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-heading-lg text-[#000000]">Create New Workflow</h2>
                <p className="text-xs text-[#62625b]">
                  Workspace: <span className="font-bold text-[#000000]">{org?.name || "Auto Workspace"}</span>
                </p>
              </div>
            </div>

            {createError && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#fde8e8] border border-[#fbd5d5] text-[#9e0a0a] text-xs mb-5 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="label">Workflow Name</label>
                <input
                  className="text-input"
                  value={newWfName}
                  onChange={(e) => setNewWfName(e.target.value)}
                  placeholder="e.g. AI Content Review & Publishing Pipeline"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="label">Description (Optional)</label>
                <textarea
                  className="text-input"
                  value={newWfDesc}
                  onChange={(e) => setNewWfDesc(e.target.value)}
                  placeholder="Summarize what this pipeline accomplishes..."
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e5e5e0]">
                <button
                  type="button"
                  onClick={() => setShowNewWorkflow(false)}
                  className="btn btn-secondary btn-pill px-5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingWf || !newWfName.trim()}
                  className="btn btn-primary btn-pill px-6 flex items-center gap-2"
                >
                  {creatingWf ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Pipeline</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Workspace Modal */}
      {showNewOrgModal && (
        <div className="modal-overlay" onClick={() => setShowNewOrgModal(false)}>
          <div className="modal-card max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#f6f6f3] flex items-center justify-center text-[#e60023]">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-heading-lg text-[#000000]">New Workspace</h2>
                <p className="text-xs text-[#62625b]">Create an isolated organization workspace</p>
              </div>
            </div>

            {orgError && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#fde8e8] border border-[#fbd5d5] text-[#9e0a0a] text-xs mb-5 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{orgError}</span>
              </div>
            )}

            <form onSubmit={handleCreateWorkspaceSubmit} className="space-y-4">
              <div>
                <label className="label">Workspace Name</label>
                <input
                  className="text-input"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="e.g. Acme AI Labs, Product Growth"
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e5e5e0]">
                <button
                  type="button"
                  onClick={() => setShowNewOrgModal(false)}
                  className="btn btn-secondary btn-pill px-5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingOrg || !newOrgName.trim()}
                  className="btn btn-primary btn-pill px-6 flex items-center gap-2"
                >
                  {creatingOrg ? "Creating..." : "Create Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
