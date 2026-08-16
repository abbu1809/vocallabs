"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@apollo/client/react";
import {
  GET_ORG_MEMBERS,
  GET_ORG_USAGE,
  ADD_ORG_MEMBER,
  REMOVE_ORG_MEMBER
} from "@/lib/graphql-operations";
import {
  ArrowLeft,
  Users,
  Shield,
  Trash2,
  UserPlus,
  Building2,
  Gauge,
  CheckCircle2,
  AlertCircle,
  Clock,
  Info,
  ShieldCheck,
  Zap,
  Lock
} from "lucide-react";

export default function SettingsPage() {
  const { user, isAuthenticated, isLoading, currentOrg, userRole } = useAuth();
  const router = useRouter();

  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("editor");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  const { data: membersData, loading: membersLoading, refetch: refetchMembers } = useQuery<any>(
    GET_ORG_MEMBERS,
    {
      variables: { org_id: currentOrg?.org_id },
      skip: !currentOrg?.org_id,
    }
  );

  const { data: usageData, loading: usageLoading } = useQuery<any>(GET_ORG_USAGE, {
    variables: { org_id: currentOrg?.org_id },
    skip: !currentOrg?.org_id,
  });

  const [addMember, { loading: addingMember }] = useMutation(ADD_ORG_MEMBER, {
    onCompleted: () => {
      setSuccess("Organization member added successfully!");
      setNewMemberEmail("");
      setError("");
      refetchMembers();
      setTimeout(() => setSuccess(""), 4000);
    },
    onError: (err: any) => {
      setError(err.message || "Failed to add member");
      setSuccess("");
    },
  });

  const [removeMember] = useMutation(REMOVE_ORG_MEMBER, {
    onCompleted: () => {
      refetchMembers();
      setSuccess("Member removed from organization.");
      setTimeout(() => setSuccess(""), 4000);
    },
    onError: (err: any) => {
      setError(err.message || "Failed to remove member");
    },
  });

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#fbfbf9] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-3 border-[#dadad3] border-t-[#e60023] animate-spin" />
      </div>
    );
  }

  const org = usageData?.organizations_by_pk || currentOrg?.organization;
  const members = membersData?.org_members || [];
  const isOwner = userRole === "owner";
  const quotaUsed = org?.quota_used ?? 0;
  const quotaLimit = org?.quota_limit ?? 100;
  const quotaPercent = quotaLimit > 0 ? Math.min((quotaUsed / quotaLimit) * 100, 100) : 0;

  return (
    <div className="min-h-screen bg-[#fbfbf9] text-[#33332e] flex flex-col">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-[#ffffff] border-b border-[#dadad3] px-6 h-16 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4 max-w-5xl mx-auto w-full">
          <button
            onClick={() => router.push("/dashboard")}
            className="btn-icon-circular w-9 h-9"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-heading-md text-[#000000]">Workspace Settings</h1>
            <p className="text-xs text-[#62625b]">
              {org?.name} • Multi-Tenant Quotas &amp; Roles
            </p>
          </div>
        </div>
      </header>

      {/* Main Settings Container */}
      <main className="max-w-5xl mx-auto px-6 py-8 w-full flex-1 space-y-8">
        {/* Alerts */}
        {error && (
          <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-[#fde8e8] border border-[#fbd5d5] text-[#9e0a0a] text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-[#c7f0da] border border-[#a3e6be] text-[#0d5932] text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#0d5932]" />
            <span>{success}</span>
          </div>
        )}

        {/* Organization Overview & Quotas */}
        <div className="pin-card-white p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#f6f6f3] flex items-center justify-center text-[#e60023]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading-md text-[#000000]">{org?.name}</h2>
              <p className="text-xs text-[#62625b] font-mono">Workspace ID: {currentOrg?.org_id}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#f6f6f3] p-4 rounded-2xl border border-[#e5e5e0]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#62625b] uppercase tracking-wider">
                  Executions Used
                </span>
                <Gauge className="w-4 h-4 text-[#e60023]" />
              </div>
              <p className="text-2xl font-black text-[#000000]">{quotaUsed}</p>
              <p className="text-xs text-[#62625b] mt-1">out of {quotaLimit} allocated</p>
            </div>

            <div className="bg-[#f6f6f3] p-4 rounded-2xl border border-[#e5e5e0]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#62625b] uppercase tracking-wider">
                  Your Access Role
                </span>
                <ShieldCheck className="w-4 h-4 text-[#0d5932]" />
              </div>
              <p className="text-2xl font-black text-[#000000] capitalize">{userRole}</p>
              <p className="text-xs text-[#62625b] mt-1">
                {isOwner
                  ? "Full governance & execution permissions"
                  : userRole === "editor"
                  ? "Workflow builder and execution rights"
                  : "Read-only workspace access"}
              </p>
            </div>

            <div className="bg-[#f6f6f3] p-4 rounded-2xl border border-[#e5e5e0]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#62625b] uppercase tracking-wider">
                  Team Members
                </span>
                <Users className="w-4 h-4 text-[#617bff]" />
              </div>
              <p className="text-2xl font-black text-[#000000]">{members.length}</p>
              <p className="text-xs text-[#62625b] mt-1">Users in this workspace</p>
            </div>
          </div>

          {/* Quota Progress Meter */}
          <div className="pt-4 border-t border-[#e5e5e0]">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-[#000000]">Monthly Execution Quota Utilization</span>
              <span className="font-mono text-[#62625b]">
                {quotaPercent.toFixed(1)}% ({quotaUsed} / {quotaLimit})
              </span>
            </div>
            <div className="quota-meter-bg">
              <div
                className="quota-meter-fill"
                style={{
                  width: `${quotaPercent}%`,
                  backgroundColor: quotaPercent > 85 ? "#cc001f" : "#e60023",
                }}
              />
            </div>
          </div>
        </div>

        {/* Team Members Management */}
        <div className="pin-card-white p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#f6f6f3] flex items-center justify-center text-[#617bff]">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-heading-md text-[#000000]">Workspace Members</h2>
                <p className="text-xs text-[#62625b]">Manage user access, roles, and capability tiers</p>
              </div>
            </div>
          </div>

          {/* Add Member Form (Owner only) */}
          {isOwner ? (
            <div className="bg-[#f6f6f3] p-5 rounded-2xl border border-[#e5e5e0] space-y-3">
              <span className="text-xs font-bold text-[#000000] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#e60023]" />
                Add New Workspace Member
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-6">
                  <input
                    type="text"
                    placeholder="User UUID (e.g. from users table)"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    className="text-input text-xs"
                  />
                </div>
                <div className="sm:col-span-3">
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className="text-input text-xs"
                  >
                    <option value="owner">Owner (Full Admin)</option>
                    <option value="editor">Editor (Builder)</option>
                    <option value="viewer">Viewer (Read-Only)</option>
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <button
                    onClick={() => {
                      if (newMemberEmail.trim()) {
                        addMember({
                          variables: {
                            org_id: currentOrg?.org_id,
                            user_id: newMemberEmail.trim(),
                            role: newMemberRole,
                          },
                        });
                      }
                    }}
                    disabled={addingMember || !newMemberEmail.trim()}
                    className="btn btn-primary btn-pill w-full text-xs"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {addingMember ? "Adding..." : "Add Member"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-[#f6f6f3] border border-[#dadad3] text-xs text-[#62625b]">
              <Info className="w-4 h-4 text-[#617bff] shrink-0" />
              <span>
                Only organization Owners can add or remove members. You are currently logged in with {userRole} privileges.
              </span>
            </div>
          )}

          {/* Members List */}
          <div className="space-y-2.5">
            {members.map((m: any) => {
              const memberIsSelf = m.user_id === user?.id;
              return (
                <div
                  key={m.id}
                  className="p-4 rounded-2xl bg-[#ffffff] border border-[#e5e5e0] flex items-center justify-between hover:border-[#dadad3] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#f6f6f3] border border-[#dadad3] flex items-center justify-center font-bold text-xs text-[#000000]">
                      {m.user?.email ? m.user.email.slice(0, 2).toUpperCase() : m.user_id.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#000000]">
                        {m.user?.display_name || m.user?.email || `User (${m.user_id.slice(0, 8)}...)`}
                        {memberIsSelf && (
                          <span className="ml-2 text-xs text-[#e60023] font-semibold">(You)</span>
                        )}
                      </p>
                      <p className="text-xs text-[#91918c] font-mono">{m.user_id}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`badge ${
                        m.role === "owner"
                          ? "badge-completed"
                          : m.role === "editor"
                          ? "badge-running"
                          : "badge-pending"
                      } capitalize`}
                    >
                      {m.role}
                    </span>

                    {isOwner && !memberIsSelf && (
                      <button
                        onClick={() => {
                          if (confirm("Are you sure you want to remove this member from the organization?")) {
                            removeMember({ variables: { id: m.id } });
                          }
                        }}
                        className="btn-icon-circular w-8 h-8 hover:text-[#9e0a0a]"
                        title="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
