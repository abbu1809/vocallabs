# VocalLabs — AI Agent Workflow Builder

A full-stack workflow automation platform for chaining AI agent steps, built with **nhost / Hasura GraphQL Engine**, **PostgreSQL 16**, **Node.js/TypeScript Serverless Functions**, and **Next.js 16 (React 19)** with **Apollo Client** live subscriptions and the **Pinterest Design System** (100% SVG icons, zero emojis).

---

## 🏛️ Architecture

- **Database**: PostgreSQL 16 (multi-tenant schema, relations, constraints, triggers, and aggregation view).
- **GraphQL API**: Hasura GraphQL Engine v2.44 (Role-Based RLS, WebSocket Subscriptions, and Actions).
- **Execution Engine**: Node.js/Express Serverless Functions service with Groq LLM integration, retry backoff, approval gate handlers, and webhooks.
- **Frontend**: Next.js App Router (Turbopack), Tailwind CSS v4, Pinterest Design System tokens, Apollo Client GraphQL queries/mutations/subscriptions.

---

## ✨ Features

1. **Step Types (Nodes)**:
   - `llm_call` — Real LLM calls via Groq API (Llama 3.1 8B / Llama 3.3 70B / Mixtral 8x7B) with prompt interpolation and retry backoff.
   - `http_request` — External HTTP API calls (GET, POST, PUT, DELETE) with body templating.
   - `conditional_branch` — Dynamic branching based on upstream output fields (contains, equals, regex, etc.).
   - `approval_gate` — Mid-execution pause requiring owner/editor approval to proceed.
   - `db_write` — Sandboxed persistence of step results into `workflow_data`.
   - `notify` — Simulated and webhook-based notification events.
2. **Trigger Types**:
   - `manual` — One-click execution from the studio UI (restricted to owner/editor).
   - `webhook` — Inbound external HTTP endpoint with secret token validation.
   - `scheduled` — Cron-based workflow triggers.
   - `database_event` — Reactive database event triggers.
3. **Two-Layer Permission System**:
   - **Layer 1 (Hasura RLS)**: Strict organization boundary filtering via `org_members`. Direct ID guessing across organizations returns 0 records.
   - **Layer 2 (Action Handler Gating)**: Step-level capability checks (e.g. only owners can create `db_write`/`notify`/`webhook`; only owners/editors can execute `approveStep`).
4. **Live Subscriptions**: Real-time step status streaming (`pending` → `running` → `paused_awaiting_approval` → `completed`) without page refreshes.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (must be running)
- [Node.js 18+](https://nodejs.org/)
- [Groq API Key](https://console.groq.com/) (Free tier)

### 1. Configure Environment
```bash
cp .env.example .env
```
Edit `.env` or set your `GROQ_API_KEY`:
```ini
GROQ_API_KEY=gsk_your_groq_api_key_here
```

### 2. Start Backend Services (PostgreSQL + Hasura + Functions)
```bash
docker compose up -d --build
```
This spins up:
- **PostgreSQL**: `localhost:5432` (Auto-initializes schema and seed data)
- **Hasura GraphQL Engine**: `localhost:8080` (Console available at `http://localhost:8080/console`)
- **Functions Execution Engine**: `localhost:3001` (Health check at `http://localhost:3001/healthz`)

### 3. Apply Hasura Metadata & Permissions
```bash
npx tsx nhost/setup-hasura.ts
```

### 4. Start Next.js Frontend
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Pre-Seeded Test Accounts

All pre-seeded accounts use password: `password123`

| Organization | Email | Role | Capabilities |
|---|---|---|---|
| **Org A** (Acme AI Labs) | `owner_a@acme.ai` | **Owner** | Full control, add/delete steps, run, approve |
| **Org A** (Acme AI Labs) | `editor_a@acme.ai` | **Editor** | Build workflows, run, approve |
| **Org A** (Acme AI Labs) | `viewer_a@acme.ai` | **Viewer** | Read-only, cannot run or approve |
| **Org B** (Beta Corp) | `owner_b@beta.com` | **Owner** | Full control in Org B only |
| **Org B** (Beta Corp) | `editor_b@beta.com` | **Editor** | Editor in Org B only |

---

## 🧪 Final Task Verification Scenario Walkthrough

To verify the end-to-end criteria required by the assignment:

1. **Sign in as Org A Owner** (`owner_a@acme.ai` / `password123`).
2. Navigate to the pre-seeded workflow **"AI Content Review & Publishing Pipeline"**.
   - Contains: `llm_call` → `conditional_branch` → `http_request` → `approval_gate` → `db_write`.
3. Click **"Run Pipeline"**:
   - Step 1 (`llm_call`) executes via Groq API.
   - Step 2 (`conditional_branch`) evaluates output.
   - Step 3 (`http_request`) calls external verification endpoint.
   - Step 4 (`approval_gate`) enters **`paused_awaiting_approval`** state.
   - The workflow run shows as `paused`.
4. Observe the live GraphQL subscription updating the UI in real-time with no refresh.
5. Click **"Approve & Continue"**:
   - The `approveStep` Action verifies your Org A role, approves the step, and resumes execution.
   - Step 5 (`db_write`) saves the published payload into `workflow_data`.
   - Workflow finishes in `completed` state and organization quota usage increments.
6. **Trigger via Webhook**:
   - Send a POST request to `http://localhost:3000/api/webhook` with body:
     ```json
     {
       "workflow_id": "w0000000-0000-0000-0000-000000000001",
       "secret": "acme_secret_key_123"
     }
     ```
   - Watch the new run appear and execute live.
7. **Verify Airtight Cross-Org Isolation**:
   - Log out and log in as **Org B Owner** (`owner_b@beta.com` / `password123`).
   - Org B dashboard shows 0 workflows.
   - Attempting to directly navigate to `/workflows/w0000000-0000-0000-0000-000000000001` results in "Workflow not found" because Hasura RLS filters out Org A rows.

---

## 🌐 Production Deployment Guide

### 1. Deploy Frontend to Vercel (Recommended)
1. Push your repository to GitHub.
2. Log into [Vercel](https://vercel.com) and click **"Add New Project"** -> **"Import Git Repository"**.
3. Set **Root Directory** to `frontend`.
4. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_HASURA_HTTP_URL`: `https://<your-hasura-host>/v1/graphql`
   - `NEXT_PUBLIC_HASURA_WS_URL`: `wss://<your-hasura-host>/v1/graphql`
   - `NEXT_PUBLIC_FUNCTIONS_URL`: `https://<your-functions-host>`
5. Click **Deploy**. Vercel will build and host your production Next.js app.

### 2. Deploy Backend (nhost Cloud or Docker Host)
- **Option A (nhost Cloud)**:
  1. Connect your repository to [nhost Cloud](https://app.nhost.io).
  2. nhost automatically detects and applies `nhost/migrations` and `nhost/metadata`.
  3. Set `GROQ_API_KEY` in nhost Environment Variables.
- **Option B (Docker / Railway / Render / Fly.io / VPS)**:
  1. Deploy using `docker compose up -d --build`.
  2. Run `npx tsx nhost/setup-hasura.ts` to apply Hasura tracking, permissions, and actions.
  3. Point your frontend environment variables to your public URLs.

---

## 📁 Repository Structure

```
├── .env.example              # Root environment template
├── docker-compose.yaml       # PostgreSQL + Hasura + Functions stack
├── README.md                 # Complete setup & deployment guide
├── WRITEUP.md                # Security model & architecture documentation
├── DESIGN.md                 # Pinterest design system specifications
├── frontend/                 # Next.js App Router frontend
│   ├── src/app/              # Pages: Marketing, Dashboard, Studio, Settings, Auth
│   ├── src/lib/              # Apollo client, Auth context, GraphQL queries/mutations
│   └── package.json
└── nhost/                    # Backend services
    ├── functions/            # Express execution engine & Groq LLM handlers
    ├── migrations/           # PostgreSQL schema DDL (tables, views, indexes)
    ├── metadata/             # Hasura metadata & Action definitions
    ├── seeds/                # Multi-tenant test seed data (Orgs, users, workflows)
    └── setup-hasura.ts       # Automated Hasura tracking & RLS permission script
```
