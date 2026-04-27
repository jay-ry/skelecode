# SkeleCode — Project Specification

## Vision

SkeleCode is an AI-powered project planning tool that takes a user from a raw idea (or no idea at all) to a fully scoped, sprint-ready development plan with a UI skeleton — in minutes. It combines a conversational brainstorm agent, a Scrum-aware sprint planner, and a skeleton generator to produce everything a developer or PM needs to start building immediately.

---

## Problem

Starting a new project is one of the most expensive phases in software development. Developers waste hours writing vague requirements, arguing about tech stacks, and producing sprint plans that don't map to testable outcomes. Non-technical founders have it worse — they can't translate their ideas into anything a developer can act on.

SkeleCode eliminates that gap.

---

## Target Users

| Persona | Description |
|---|---|
| Solo dev / indie hacker | Has an idea, wants a clean plan and folder scaffold before writing a line of code |
| Technical PM | Needs sprint-ready tickets with a testable definition of done per sprint |
| Non-technical founder | Has a product vision but needs structured output a dev team can execute |

---

## Core Features

### Stage 1 — Brainstorm Bot
- Conversational AI interviewing the user via CopilotKit chat UI
- Asks targeted questions: problem, users, features, tech preferences, constraints
- If user has no idea, suggests project types and brainstorms collaboratively
- Produces a single `project.md` — source of truth for all downstream stages

### Stage 2 — Sprint Planner
- Reads `project.md` and produces N sprint files (`sprint-1.md` through `sprint-N.md`)
- Each sprint follows Scrum principles with a browser-testable definition of done
- Sprints are sized for a solo developer running Claude Code

### Stage 3 — Skeleton Generator
- Reads all sprint files and infers the full project structure
- Outputs a folder/file tree for the chosen stack and an HTML wireframe of Sprint 1 UI
- Technical users get a scaffold; non-technical users get a visual to react to

---

## Tech Stack

### Frontend
- **Next.js 14** (App Router)
- **CopilotKit** (`@copilotkit/react-core`, `@copilotkit/react-ui`)
- **Tailwind CSS**
- **shadcn/ui**

### Backend
- **Python 3.11+**
- **FastAPI** — REST API + SSE streaming
- **LangGraph** — stateful multi-agent pipeline
- **LangChain** — LLM orchestration
- **Anthropic Claude** (`claude-sonnet-4-5`) — underlying model

### Storage
- **Supabase** (Postgres + RLS)
- **Supabase Storage** — generated file storage

### Auth & Payments
- **Clerk** — authentication
- **Stripe** — subscription billing

### Infrastructure
- **Vercel** — frontend
- **Railway** — backend (FastAPI)

---

## Data Model

```
User
  └── Project (1 project.md)
        └── Sprint[] (sprint-1.md … sprint-N.md)
              └── SkeletonOutput (folder tree + wireframe HTML)
```

### DB Schema (Supabase)

```sql
-- Projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  project_md text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Sprints
create table sprints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  sprint_number int not null,
  goal text,
  content_md text,
  sprint_data jsonb,
  created_at timestamptz default now()
);

-- Skeletons
create table skeletons (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  folder_tree text,
  wireframe_html text,
  created_at timestamptz default now()
);

-- Subscriptions
create table user_subscriptions (
  user_id text primary key,
  plan text not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  valid_until timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

## Monetization

| Tier | Price | Limits |
|---|---|---|
| Free | $0 | 1 project, 3 sprints max |
| Pro | $15/mo | Unlimited projects + sprints + skeleton exports |
| Lifetime | $129 one-time | Same as Pro — early adopters via Gumroad |

---

## Sprint Overview

This project is structured into 6 focused sprints, each designed to be executed in a single Claude Code session by a solo developer. Each sprint has one dominant concern and a browser-testable definition of done.

| Sprint | Concern | Key output |
|---|---|---|
| 1 | Scaffolding + brainstorm agent | Chat UI → live `project.md` |
| 2 | Sprint planner agent | Progressive sprint cards + zip download |
| 3a | Auth + database | Clerk login, Supabase save/load, dashboard |
| 3b | Skeleton generator | Folder tree + HTML wireframe page |
| 4a | Monetization | Stripe checkout, webhook, paywall |
| 4b | Polish + deploy | Landing page, error states, production |

---

## Constraints & Assumptions

- Each sprint is executable in one Claude Code session (~15 files touched max)
- No more than 2 external services wired per sprint
- All LLM calls use Anthropic Claude — no OpenAI dependency
- Sprint files are plain Markdown — portable, readable without SkeleCode
- No code generation in MVP — skeleton is structure only, not runnable code
- Each stage is re-runnable independently (idempotent)

---

## Success Metrics (MVP)

- User goes from idea to full sprint plan in under 5 minutes
- Sprint 1 of the generated plan is immediately actionable
- Skeleton HTML wireframe is shareable with a stakeholder without editing
- First paying customer within 2 weeks of launch

---

## Out of Scope (v1)

- Real-time collaboration
- GitHub integration / auto-PR creation
- Runnable code generation (beyond folder scaffold)
- Mobile app
- Team roles / permissions
