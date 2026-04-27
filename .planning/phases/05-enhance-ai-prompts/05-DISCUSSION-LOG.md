# Phase 5: Enhance AI Prompts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-23
**Phase:** 05-enhance-ai-prompts
**Areas discussed:** Sprint output format, Project.md completeness, Prompt scope

---

## Sprint output format

| Option | Description | Selected |
|--------|-------------|----------|
| Rich markdown | Switch to raw markdown output — each sprint is a full .md document like plan/sprint-1.md | ✓ |
| Extend structured JSON | Keep Pydantic but add file_map, frontend_tasks, backend_tasks, etc. | |
| Hybrid: markdown body + JSON metadata | Pydantic wrapper with typed fields + raw content_md | |

**User's choice:** Rich markdown

**Sprint structure sub-question:**

| Option | Description | Selected |
|--------|-------------|----------|
| Match plan/sprint-1.md exactly | File Map, numbered F/B tasks with code snippets, Env Vars, Stub Strategy, DoD, Test Scenario | ✓ |
| Close but lighter | Sprint Goal, Frontend/Backend Tasks, DoD, Test Scenario — skip File Map and code | |

**User's choice:** Match plan/sprint-1.md exactly

**Frontend compatibility sub-question:**

| Option | Description | Selected |
|--------|-------------|----------|
| Update frontend to render content_md | Sprint cards render full markdown body | ✓ |
| Keep frontend unchanged | Sprint planner wraps markdown in JSON, frontend unchanged | |

**User's choice:** Update frontend to render content_md

---

## Project.md completeness

**Sections to add:**

| Option | Description | Selected |
|--------|-------------|----------|
| Sprint Overview table | Table: Sprint / Concern / Key output | ✓ |
| Success Metrics | Measurable outcomes bullet list | ✓ |
| Out of Scope | Excluded features list | ✓ |
| Monetization / Business model | Pricing tiers table (conditional on conversation) | ✓ |

**User's choice:** All sections from plan/project.md

**Format strictness:**

| Option | Description | Selected |
|--------|-------------|----------|
| Strictly match plan/project.md structure | Exact section order, table formats, heading levels | ✓ |
| Flexible format | Required sections enforced, LLM adapts format | |

**User's choice:** Strictly match plan/project.md structure

---

## Prompt scope

| Option | Description | Selected |
|--------|-------------|----------|
| drafter_system.txt | Update project.md format | ✓ |
| sprint_planner_system.txt | Update sprint format | ✓ |
| extractor_system.txt + brainstorm quality | Improve extraction + conversational quality | ✓ |
| Skeleton prompts | Improve stack resolver and tree builder | ✓ |

**Sprint parsing strategy:**

| Option | Description | Selected |
|--------|-------------|----------|
| Drop Pydantic, parse markdown by sprint number | Split on --- divider, regex for sprint number | ✓ |
| Keep minimal Pydantic wrapper (number + content_md) | Typed number field, markdown body | |

**User's choice:** Drop Pydantic, parse markdown by sprint number

**Model choice:**

| Option | Description | Selected |
|--------|-------------|----------|
| Keep Groq for all prompts | Consistent, faster | ✓ |
| Switch drafter to Claude sonnet | Claude for complex multi-section doc | |
| Switch drafter + sprint planner to Claude | Both rich outputs use Claude | |

**User's choice:** Keep Groq for all prompts

---

## Claude's Discretion

- Temperature/max_tokens tuning for updated sprint planner
- Whether to delete SprintPlan/Sprint Pydantic models or keep them
- ExtractedFields model update strategy for new fields
- Error handling fallback for sprint markdown parsing failures

## Deferred Ideas

- Stripe tier enforcement — Phase 6
- Landing page and production deploy — Phase 6
