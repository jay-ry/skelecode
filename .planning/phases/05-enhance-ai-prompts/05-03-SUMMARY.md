---
phase: 05-enhance-ai-prompts
plan: "03"
subsystem: backend/prompts
tags:
  - prompt-engineering
  - llm
  - skeleton
dependency_graph:
  requires: []
  provides:
    - "skeleton_stack_resolver with T3, Django+React, Rails common-stack defaults"
    - "skeleton_tree_builder Next.js template with tailwind.config.ts, .env.example, middleware.ts"
  affects:
    - "backend/agents/skeleton.py (reads both prompts at module startup)"
tech_stack:
  added: []
  patterns:
    - "UNTRUSTED DATA guard preserved in both prompts"
    - "JSON-only output contract preserved"
key_files:
  modified:
    - backend/prompts/skeleton_stack_resolver_system.txt
    - backend/prompts/skeleton_tree_builder_system.txt
decisions:
  - "Inserted Common stack defaults block after the Rules section in stack resolver (before Example output line)"
  - "Added frontend/middleware.ts between page.tsx and components/Header.tsx in tree builder template"
  - "Added frontend/tailwind.config.ts and frontend/.env.example after next.config.ts in tree builder template"
  - "Example array updated to 20 entries (alphabetically sorted), well under the 25-entry cap"
metrics:
  duration_seconds: 90
  completed_date: "2026-04-27"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 05 Plan 03: Skeleton Prompt Enhancements Summary

Extended both skeleton generator prompts with broader stack support and a more complete Next.js file scaffold, while preserving all existing JSON-only output contracts and UNTRUSTED DATA guards.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend stack resolver with T3, Django+React, Rails defaults | 2c1a379 | backend/prompts/skeleton_stack_resolver_system.txt |
| 2 | Extend tree builder Next.js template with tailwind, .env.example, middleware | c1b0a35 | backend/prompts/skeleton_tree_builder_system.txt |

## Changes Made

### Task 1: skeleton_stack_resolver_system.txt

Added a new "Common stack defaults" block between the Rules section and the Example output line. Exact wording:

```
Common stack defaults — apply when the user mentions one of these by name:
- "T3 stack" or "T3" → {"frontend": "Next.js", "backend": "Next.js API routes", "db": "Neon"}
- "Django + React" or "Django and React" → {"frontend": "React", "backend": "Django", "db": "Postgres"}
- "Rails" → {"frontend": "Rails ERB", "backend": "Rails", "db": "Postgres"}
```

File grew from ~700 bytes to 1454 bytes. All preserved: UNTRUSTED DATA guard, JSON output schema, existing default rule `{"frontend": "Next.js", "backend": "FastAPI", "db": "Neon"}`, and Example output line.

### Task 2: skeleton_tree_builder_system.txt

**Change 1 — Next.js template:** Added three entries in order:
- `frontend/middleware.ts` (after `frontend/app/page.tsx`, before `frontend/components/Header.tsx`)
- `frontend/tailwind.config.ts` (after `frontend/next.config.ts`)
- `frontend/.env.example` (after `frontend/tailwind.config.ts`)

Final Next.js template ordering:
```
Next.js frontend:
  - frontend/app/layout.tsx
  - frontend/app/page.tsx
  - frontend/middleware.ts
  - frontend/components/Header.tsx
  - frontend/lib/
  - frontend/public/
  - frontend/next.config.ts
  - frontend/tailwind.config.ts
  - frontend/.env.example
  - frontend/package.json
  - frontend/tsconfig.json
```

**Change 2 — Example output array:** Updated to 20 entries (was 17). New array includes all three new Next.js paths. Entry count: 20, well under the 25-entry cap. Array is alphabetically sorted.

## Verification Results

All static checks passed:
- `grep -q "T3 stack"` — PASS
- `grep -q "Django + React"` — PASS  
- `grep -q '"Rails"'` — PASS
- `grep -q "UNTRUSTED DATA"` in both files — PASS
- `grep -q "Output ONLY the JSON object"` — PASS
- `grep -q "frontend/tailwind.config.ts"` — PASS
- `grep -q "frontend/.env.example"` — PASS
- `grep -q "frontend/middleware.ts"` — PASS
- `grep -q "FastAPI backend:"` — PASS
- `grep -q "migrations/001_init.sql"` — PASS

JSON validity check: `python3 -c "... json.loads(...)"` returned `OK 20 entries` — PASS

Skeleton agent import smoke test: Fails only on missing `GROQ_API_KEY` environment variable (expected in test environment with no credentials). Both prompts load correctly at module level before the API key check fails — this is not a code defect.

## Deviations from Plan

None — plan executed exactly as written. Both prompts edited with minimal, surgical changes matching the exact text specified in the plan's `<action>` blocks.

## Known Stubs

None. Both files are complete prompt text — no placeholders or TODOs.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Both files are static `.txt` prompts. The UNTRUSTED DATA guard is preserved in both (T-05-08 mitigation confirmed). JSON-only output instructions preserved in both (T-05-09 mitigation confirmed).

## What You Can Test Now

**Prerequisites:** Set `GROQ_API_KEY` in `backend/.env`

| What | How | Expected |
|------|-----|----------|
| Stack resolver import | `cd backend && venv/bin/python -c "from agents.skeleton import graph; print('OK')"` | `OK` |
| T3 stack resolution | Generate a skeleton from a project.md mentioning "T3 stack" | Resolver returns `{"frontend": "Next.js", "backend": "Next.js API routes", "db": "Neon"}` |
| Next.js file list | Generate a skeleton for a Next.js project | File list includes `frontend/tailwind.config.ts`, `frontend/.env.example`, `frontend/middleware.ts` |

**Not yet testable:** Full UI flow requires running frontend + backend together with valid API keys.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| backend/prompts/skeleton_stack_resolver_system.txt | FOUND |
| backend/prompts/skeleton_tree_builder_system.txt | FOUND |
| .planning/phases/05-enhance-ai-prompts/05-03-SUMMARY.md | FOUND |
| Commit 2c1a379 (Task 1) | FOUND |
| Commit c1b0a35 (Task 2) | FOUND |
