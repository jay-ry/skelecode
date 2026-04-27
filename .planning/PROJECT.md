# SkeleCode

## What This Is

SkeleCode is an AI-powered project planning tool that takes a user from a raw idea to a fully scoped, sprint-ready development plan with a UI skeleton — in minutes. It combines a conversational brainstorm agent, a Scrum-aware sprint planner, and a skeleton generator to produce everything a developer or PM needs to start building immediately.

## Core Value

A user goes from raw idea to actionable, sprint-ready development plan in under 5 minutes.

## Requirements

### Validated

- [x] Sprint planner produces 10-section markdown output with `content_md` SSE field — Validated in Phase 5: enhance-ai-prompts
- [x] Brainstorm pipeline produces project.md with 11 sections, conditional Monetization, UNTRUSTED DATA guard — Validated in Phase 5: enhance-ai-prompts
- [x] Skeleton prompts handle T3, Django+React, Rails stacks; Next.js scaffold includes tailwind/env/middleware — Validated in Phase 5: enhance-ai-prompts
- [x] Frontend sprint cards render markdown via ReactMarkdown with legacy Section fallback — Validated in Phase 5: enhance-ai-prompts

### Active

- [ ] Conversational brainstorm agent (CopilotKit chat UI) that produces a `project.md`
- [ ] Sprint planner agent that reads `project.md` and generates N sprint files streamed progressively
- [ ] Skeleton generator that produces ASCII folder tree + HTML wireframe from sprint plans
- [ ] Clerk authentication with Supabase persistence (projects and sprints saved automatically)
- [ ] Stripe monetization: free tier (1 project), Pro ($15/mo unlimited), Lifetime ($129)
- [ ] Production deployment: Vercel (frontend) + Railway (backend)
- [ ] Landing page for logged-out visitors

### Out of Scope

- Real-time collaboration — v1 is single-user only
- GitHub integration / auto-PR creation — not in MVP
- Runnable code generation — skeleton is structure only, not runnable code
- Mobile app — web only for v1
- Team roles / permissions — single-user model for MVP

## Context

- Tech stack: Next.js 14 (App Router), CopilotKit, Tailwind CSS, shadcn/ui (frontend); Python 3.11+, FastAPI, LangGraph, LangChain, Anthropic Claude claude-sonnet-4-5 (backend)
- Storage: Supabase (Postgres + RLS) + Supabase Storage for generated files
- Auth: Clerk; Payments: Stripe; Infra: Vercel + Railway
- Each sprint designed to be executed in one Claude Code session (~15 files touched max)
- No more than 2 external services wired per sprint
- All LLM calls use Anthropic Claude — no OpenAI dependency
- Sprint files are plain Markdown — portable and readable without SkeleCode

## Constraints

- **Tech stack**: Next.js 14, FastAPI, LangGraph, Anthropic Claude — no substitutions in v1
- **LLM provider**: Anthropic Claude only — no OpenAI dependency
- **Sprint scope**: Each sprint executable in one Claude Code session, max ~15 files touched
- **External services**: Max 2 external services per sprint
- **Code generation**: No runnable code generation in MVP — skeleton is structure only

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| LangGraph for agent orchestration | Stateful multi-agent pipeline with conditional edges | — Pending |
| CopilotKit for chat UI | Native integration with Next.js + SSE streaming | — Pending |
| Supabase for storage | Postgres + RLS + Storage in one service | — Pending |
| Clerk for auth | Fastest auth integration for Next.js | — Pending |
| SSE streaming (not WebSockets) | Simpler, no persistent connection needed | — Pending |

---
*Last updated: 2026-04-27 — Phase 5 complete: sprint planner markdown refactor, brainstorm expansion, skeleton prompt polish, frontend rendering update*
