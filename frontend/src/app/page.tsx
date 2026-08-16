"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Sparkles, ArrowRight, Search, Zap, Layers, ShieldCheck,
  Bot, Network, CheckCircle2, Play, GitBranch, Bell,
  Database, Globe, Clock, ChevronRight, Lock, Code2
} from "lucide-react";

const TEMPLATE_PINS = [
  {
    id: "content-review",
    category: "Content Publishing",
    title: "AI Content Review & Multi-Channel Pipeline",
    description: "Chain Llama 3.3 for editorial analysis, verification via HTTP, human approval gate, and sandboxed database persistence.",
    badge: "Featured Pipeline",
    accent: "#e60023",
    steps: [
      { name: "LLM Drafting", type: "llm_call", color: "#7e238b" },
      { name: "Content Filter", type: "conditional_branch", color: "#6845ab" },
      { name: "Fact Check", type: "http_request", color: "#617bff" },
      { name: "Lead Approval", type: "approval_gate", color: "#e60023" },
      { name: "Store DB", type: "db_write", color: "#103c25" },
    ],
    author: "Acme AI Labs",
    role: "Owner",
    runs: "1,420 runs",
  },
  {
    id: "lead-enrichment",
    category: "LLM Reasoning",
    title: "Autonomous Customer Support Triager",
    description: "Evaluates inbound customer support requests, classifies intent, drafts solution vectors, and notifies internal Slack channels.",
    badge: "Customer Ops",
    accent: "#6845ab",
    steps: [
      { name: "Webhook Inbound", type: "webhook", color: "#617bff" },
      { name: "Groq Reasoning", type: "llm_call", color: "#7e238b" },
      { name: "Sentiment Gate", type: "conditional_branch", color: "#6845ab" },
      { name: "Notify Slack", type: "notify", color: "#e60023" },
    ],
    author: "Growth Squad",
    role: "Editor",
    runs: "890 runs",
  },
  {
    id: "market-analyst",
    category: "API Chaining",
    title: "Real-Time Market Data Synthesizer",
    description: "Fetches live market statistics via HTTP API, summarizes key trends using fast Llama 3.1 8B, and alerts subscribers.",
    badge: "Market Intel",
    accent: "#617bff",
    steps: [
      { name: "Cron Trigger", type: "scheduled", color: "#617bff" },
      { name: "Fetch Quotes", type: "http_request", color: "#617bff" },
      { name: "LLM Summary", type: "llm_call", color: "#7e238b" },
      { name: "Archive DB", type: "db_write", color: "#103c25" },
    ],
    author: "Quant Ops",
    role: "Owner",
    runs: "3,210 runs",
  },
  {
    id: "compliance-checker",
    category: "Human Approvals",
    title: "Enterprise Compliance & Audit Gate",
    description: "Validates security tokens, parses incoming payloads, verifies compliance boundaries, and holds for security officer sign-off.",
    badge: "Security & Trust",
    accent: "#103c25",
    steps: [
      { name: "Security Webhook", type: "webhook", color: "#617bff" },
      { name: "Token Check", type: "http_request", color: "#617bff" },
      { name: "Audit Officer Sign-off", type: "approval_gate", color: "#e60023" },
      { name: "Audit Log DB", type: "db_write", color: "#103c25" },
    ],
    author: "Security Team",
    role: "Owner",
    runs: "650 runs",
  },
  {
    id: "code-review-bot",
    category: "Data Extraction",
    title: "Automated PR Review & Vulnerability Scanner",
    description: "Analyzes pull requests using high-context LLMs, flags security anti-patterns, and triggers deployment webhooks.",
    badge: "DevOps",
    accent: "#7e238b",
    steps: [
      { name: "PR Webhook", type: "webhook", color: "#617bff" },
      { name: "Diff Analysis", type: "llm_call", color: "#7e238b" },
      { name: "Branch on Severity", type: "conditional_branch", color: "#6845ab" },
      { name: "Notify Devs", type: "notify", color: "#e60023" },
    ],
    author: "Platform Eng",
    role: "Editor",
    runs: "2,180 runs",
  },
  {
    id: "newsletter-curator",
    category: "Content Publishing",
    title: "Weekly AI Research Digest Creator",
    description: "Extracts top findings from research feeds, formats markdown briefs, and requires editor-in-chief approval prior to dispatch.",
    badge: "Editorial",
    accent: "#e60023",
    steps: [
      { name: "Fetch Papers", type: "http_request", color: "#617bff" },
      { name: "Mixtral Digest", type: "llm_call", color: "#7e238b" },
      { name: "Editor Sign-off", type: "approval_gate", color: "#e60023" },
      { name: "Publish Data", type: "db_write", color: "#103c25" },
    ],
    author: "Research Labs",
    role: "Owner",
    runs: "540 runs",
  },
];

const CATEGORIES = [
  "All Pipelines",
  "Content Publishing",
  "LLM Reasoning",
  "API Chaining",
  "Human Approvals",
  "Data Extraction",
];

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("All Pipelines");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  const filteredPins = TEMPLATE_PINS.filter((pin) => {
    const matchesCategory = selectedCategory === "All Pipelines" || pin.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === "" ||
      pin.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pin.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pin.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#fbfbf9] flex flex-col text-[#33332e]">
      {/* Pinterest Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#ffffff] border-b border-[#dadad3]/60 px-6 h-16 flex items-center justify-between gap-6">
        <div className="flex items-center gap-6 shrink-0">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2.5 bg-transparent border-none p-0 cursor-pointer text-left"
          >
            <div className="w-9 h-9 rounded-full bg-[#e60023] flex items-center justify-center text-white font-black text-xl shadow-sm">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <span className="font-extrabold text-xl text-[#000000] tracking-tight">VocalLabs</span>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => setSelectedCategory("All Pipelines")}
              className="px-4 py-2 rounded-full font-bold text-sm text-[#000000] hover:bg-[#f6f6f3] transition-colors"
            >
              Explore
            </button>
            <button
              onClick={() => router.push("/login")}
              className="px-4 py-2 rounded-full font-semibold text-sm text-[#62625b] hover:bg-[#f6f6f3] transition-colors"
            >
              Workflows
            </button>
            <button
              onClick={() => router.push("/login")}
              className="px-4 py-2 rounded-full font-semibold text-sm text-[#62625b] hover:bg-[#f6f6f3] transition-colors"
            >
              Documentation
            </button>
          </nav>
        </div>

        {/* Centered Search Pill */}
        <div className="flex-1 max-w-2xl search-bar-container">
          <Search className="absolute left-4 w-4 h-4 text-[#62625b] pointer-events-none" />
          <input
            type="text"
            className="search-bar"
            placeholder="Search AI workflow templates, LLM pipelines, APIs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Right Action Cluster */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => router.push("/login")}
            className="btn btn-secondary btn-pill text-sm px-4"
          >
            Log in
          </button>
          <button
            onClick={() => router.push("/register")}
            className="btn btn-primary btn-pill text-sm px-5"
          >
            Sign up
          </button>
        </div>
      </header>

      {/* Hero Header Section */}
      <section className="pt-16 pb-12 px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#f6f6f3] border border-[#dadad3] mb-6">
          <Sparkles className="w-4 h-4 text-[#e60023]" />
          <span className="text-xs font-bold text-[#000000] tracking-wide uppercase">
            AI Agent Workflow Engine
          </span>
        </div>

        <h1 className="font-display-xl mb-6">
          Create AI workflows with visual precision
        </h1>

        <p className="text-lg md:text-xl text-[#62625b] leading-relaxed max-w-2xl mx-auto mb-8 font-normal">
          Chain Groq LLM intelligence, external REST APIs, dynamic conditional branches,
          and human approval gates into secure, observable pipelines.
        </p>

        <div className="flex flex-wrap gap-3 justify-center items-center">
          <button
            onClick={() => router.push("/register")}
            className="btn btn-primary btn-pill text-base px-8 py-3 h-12"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => router.push("/login")}
            className="btn btn-secondary btn-pill text-base px-8 py-3 h-12"
          >
            Explore Pre-Seeded Studio
          </button>
        </div>
      </section>

      {/* Filter Chips Row */}
      <section className="px-6 py-4 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`filter-chip ${isActive ? "filter-chip-active" : ""}`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* Pinterest Masonry Pin Grid */}
      <section className="px-6 py-8 max-w-7xl mx-auto w-full flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPins.map((pin) => (
            <div
              key={pin.id}
              onClick={() => router.push("/login")}
              className="pin-card-white p-6 cursor-pointer flex flex-col justify-between hover:shadow-md transition-all group"
            >
              <div>
                {/* Header with Overlay Tag */}
                <div className="flex items-center justify-between mb-4">
                  <span className="pin-overlay-pill">
                    <Zap className="w-3 h-3 text-[#e60023]" />
                    {pin.badge}
                  </span>
                  <span className="text-xs font-semibold text-[#62625b]">
                    {pin.category}
                  </span>
                </div>

                <h3 className="font-heading-md text-[#000000] mb-2 group-hover:text-[#e60023] transition-colors">
                  {pin.title}
                </h3>
                <p className="text-sm text-[#62625b] line-clamp-3 mb-6 leading-relaxed">
                  {pin.description}
                </p>

                {/* Visual Step Chain */}
                <div className="bg-[#f6f6f3] rounded-2xl p-4 mb-6 border border-[#e5e5e0]">
                  <span className="text-[0.7rem] font-bold text-[#62625b] uppercase tracking-wider block mb-3">
                    Execution Graph
                  </span>
                  <div className="flex items-center flex-wrap gap-1.5">
                    {pin.steps.map((step, idx) => (
                      <div key={idx} className="flex items-center">
                        <div
                          className="px-2.5 py-1 rounded-full text-xs font-bold text-white flex items-center gap-1 shadow-xs"
                          style={{ backgroundColor: step.color }}
                        >
                          <span>{step.name}</span>
                        </div>
                        {idx < pin.steps.length - 1 && (
                          <ChevronRight className="w-3.5 h-3.5 text-[#91918c] mx-0.5" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Footer Info */}
              <div className="pt-4 border-t border-[#e5e5e0] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#e5e5e0] flex items-center justify-center font-bold text-xs text-[#000000]">
                    {pin.author.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#000000] block">{pin.author}</span>
                    <span className="text-[0.65rem] text-[#62625b]">{pin.runs}</span>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-full bg-[#f6f6f3] flex items-center justify-center group-hover:bg-[#e60023] group-hover:text-white transition-colors">
                  <Play className="w-3.5 h-3.5 fill-current" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Alternating Feature Cards (Pinterest Editorial Layout) */}
      <section className="py-16 px-6 bg-[#f6f6f3] border-t border-[#dadad3]">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Feature 1 */}
          <div className="bg-[#ffffff] rounded-3xl p-8 md:p-12 border border-[#dadad3] grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f6f6f3] text-[#000000] text-xs font-bold mb-4">
                <Bot className="w-3.5 h-3.5 text-[#e60023]" />
                Multi-Model LLM Intelligence
              </div>
              <h2 className="font-heading-xl mb-4">
                Chain Groq LLMs with real-time prompt templating
              </h2>
              <p className="text-base text-[#62625b] leading-relaxed mb-6">
                Connect Llama 3.3 70B, Llama 3.1 8B, and Mixtral models into complex analytical
                pipelines. Dynamic state interpolation allows every subsequent node to ingest
                and transform outputs seamlessly.
              </p>
              <button
                onClick={() => router.push("/register")}
                className="btn btn-primary btn-pill px-6"
              >
                Explore LLM Nodes
              </button>
            </div>
            <div className="bg-[#f6f6f3] rounded-2xl p-6 border border-[#e5e5e0]">
              <div className="space-y-3 font-mono text-xs text-[#211922]">
                <div className="p-3 bg-white rounded-xl border border-[#dadad3] flex items-center justify-between">
                  <span className="font-bold text-[#7e238b]">Node 1: Groq LLM Drafting</span>
                  <span className="badge badge-completed">Success</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-[#dadad3] flex items-center justify-between">
                  <span className="font-bold text-[#6845ab]">Node 2: Conditional Quality Gate</span>
                  <span className="badge badge-completed">Branch: Approved</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-[#dadad3] flex items-center justify-between">
                  <span className="font-bold text-[#103c25]">Node 3: Multi-tenant Persistence</span>
                  <span className="badge badge-completed">200 OK</span>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="bg-[#ffffff] rounded-3xl p-8 md:p-12 border border-[#dadad3] grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="order-2 md:order-1 bg-[#f6f6f3] rounded-2xl p-6 border border-[#e5e5e0]">
              <div className="p-4 bg-[#fef3c7] rounded-xl border border-[#fde68a] mb-3">
                <div className="flex items-center gap-2 text-[#92400e] font-bold text-sm mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  Approval Gate Triggered
                </div>
                <p className="text-xs text-[#92400e]">
                  Publishing high-impact summary requires confirmation by Org Owner.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button className="btn btn-secondary btn-sm">Reject</button>
                <button className="btn btn-primary btn-sm">Approve &amp; Resume</button>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f6f6f3] text-[#000000] text-xs font-bold mb-4">
                <Lock className="w-3.5 h-3.5 text-[#e60023]" />
                Human-In-The-Loop Control
              </div>
              <h2 className="font-heading-xl mb-4">
                Mid-execution approval gates with live streaming
              </h2>
              <p className="text-base text-[#62625b] leading-relaxed mb-6">
                Pause high-consequence operations at critical checkpoints. Role-based authorization
                ensures only verified Owners and Editors can review step payloads and resume execution.
              </p>
              <button
                onClick={() => router.push("/register")}
                className="btn btn-secondary btn-pill px-6"
              >
                Learn About Approval Gates
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Column Footer */}
      <footer className="bg-[#ffffff] border-t border-[#dadad3] py-12 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div>
            <span className="text-xs font-bold text-[#000000] uppercase tracking-wider block mb-4">
              Platform
            </span>
            <ul className="space-y-2.5 text-sm text-[#62625b] list-none p-0 m-0">
              <li><button onClick={() => router.push("/login")} className="hover:text-[#000000] transition-colors">Workflow Studio</button></li>
              <li><button onClick={() => router.push("/login")} className="hover:text-[#000000] transition-colors">LLM Orchestration</button></li>
              <li><button onClick={() => router.push("/login")} className="hover:text-[#000000] transition-colors">Approval Gates</button></li>
              <li><button onClick={() => router.push("/login")} className="hover:text-[#000000] transition-colors">Webhook Ingestion</button></li>
            </ul>
          </div>

          <div>
            <span className="text-xs font-bold text-[#000000] uppercase tracking-wider block mb-4">
              Security &amp; Tech
            </span>
            <ul className="space-y-2.5 text-sm text-[#62625b] list-none p-0 m-0">
              <li><span className="text-[#62625b]">Hasura GraphQL Engine v2.44</span></li>
              <li><span className="text-[#62625b]">PostgreSQL 16 Multi-Tenant</span></li>
              <li><span className="text-[#62625b]">Two-Layer RBAC Enforcement</span></li>
              <li><span className="text-[#62625b]">Live WebSocket Subscriptions</span></li>
            </ul>
          </div>

          <div>
            <span className="text-xs font-bold text-[#000000] uppercase tracking-wider block mb-4">
              Resources
            </span>
            <ul className="space-y-2.5 text-sm text-[#62625b] list-none p-0 m-0">
              <li><button onClick={() => router.push("/login")} className="hover:text-[#000000] transition-colors">API Documentation</button></li>
              <li><button onClick={() => router.push("/login")} className="hover:text-[#000000] transition-colors">Architecture Guide</button></li>
              <li><button onClick={() => router.push("/login")} className="hover:text-[#000000] transition-colors">Pre-Seeded Walkthrough</button></li>
              <li><button onClick={() => router.push("/login")} className="hover:text-[#000000] transition-colors">Security Model</button></li>
            </ul>
          </div>

          <div>
            <span className="text-xs font-bold text-[#000000] uppercase tracking-wider block mb-4">
              VocalLabs
            </span>
            <p className="text-sm text-[#62625b] leading-relaxed mb-4">
              Production-grade AI agent workflow builder designed for enterprise multi-tenancy and high-speed execution.
            </p>
            <div className="flex items-center gap-2">
              <span className="badge badge-completed text-[0.65rem]">System Healthy</span>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-8 border-t border-[#dadad3] flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#62625b]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-[#e60023] flex items-center justify-center text-white text-[0.6rem] font-black">
              V
            </div>
            <span>© 2026 VocalLabs. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <span>Privacy</span>
            <span>Terms</span>
            <span>Security</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
