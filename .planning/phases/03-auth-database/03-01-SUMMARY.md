---
phase: 03-auth-database
plan: "01"
subsystem: frontend/db
tags: [drizzle, neon, clerk, schema, context]
dependency_graph:
  requires: []
  provides: [db-singleton, drizzle-schema, drizzle-config, project-context-projectId]
  affects: [frontend/context/ProjectContext.tsx, frontend/lib/db, frontend/app/sprints/page.tsx]
tech_stack:
  added:
    - "@clerk/nextjs@7.2.3"
    - "drizzle-orm@0.45.2"
    - "@neondatabase/serverless@1.1.0"
    - "drizzle-kit@0.31.10 (dev)"
  patterns:
    - Drizzle HTTP client singleton (neon-http driver, not WebSocket)
    - pgTable schema with uuid primary keys and cascade foreign key
    - dotenv config({ path: '.env.local' }) workaround for drizzle-kit CLI
key_files:
  created:
    - frontend/lib/db/schema.ts
    - frontend/lib/db/index.ts
    - frontend/drizzle.config.ts
    - frontend/.env.example
  modified:
    - frontend/app/sprints/page.tsx
    - frontend/context/ProjectContext.tsx
    - frontend/.gitignore
decisions:
  - Used drizzle-orm/neon-http (HTTP fetch driver) not neon-serverless (WebSocket) — edge-compatible, no ws package needed
  - Added !.env.example exception to frontend/.gitignore so the template is committed
  - DATABASE_URL documented without NEXT_PUBLIC_ prefix — server-only secret, never bundled to browser
metrics:
  duration: "~10 minutes"
  completed: "2026-04-21T10:25:43Z"
  tasks_completed: 2
  files_changed: 7
---

# Phase 03 Plan 01: DB Foundation + ProjectContext Extension Summary

Drizzle ORM + Neon schema foundation and ProjectContext extension for projectId, unblocking every downstream plan in Phase 3.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix Link import bug + extend ProjectContext with projectId | 6916a54 | frontend/app/sprints/page.tsx, frontend/context/ProjectContext.tsx |
| 2 | Install DB packages, create schema.ts, db/index.ts, drizzle.config.ts, .env.example | 472b5e6 | frontend/package.json, frontend/package-lock.json, frontend/lib/db/schema.ts, frontend/lib/db/index.ts, frontend/drizzle.config.ts, frontend/.env.example, frontend/.gitignore |

## Packages Installed (resolved versions from package-lock.json)

| Package | Resolved Version | Type |
|---------|-----------------|------|
| @clerk/nextjs | 7.2.3 | runtime dependency |
| drizzle-orm | 0.45.2 | runtime dependency |
| @neondatabase/serverless | 1.1.0 | runtime dependency |
| drizzle-kit | 0.31.10 | devDependency |

## Schema Tables Defined

**`projects`** (`frontend/lib/db/schema.ts`):
- `id` — uuid, primary key, defaultRandom()
- `user_id` — text, notNull
- `name` — text, notNull
- `project_md` — text, nullable
- `created_at` — timestamp, defaultNow()
- `updated_at` — timestamp, defaultNow()

**`sprints`** (`frontend/lib/db/schema.ts`):
- `id` — uuid, primary key, defaultRandom()
- `project_id` — uuid, foreign key → projects.id (cascade delete)
- `sprint_number` — integer, notNull
- `goal` — text, nullable
- `content_md` — text, nullable
- `sprint_data` — jsonb, nullable
- `created_at` — timestamp, defaultNow()

No discrepancies from CONTEXT.md locked schema.

## Files Created (absolute paths)

- `/home/jayry/projects/skelecode/frontend/lib/db/schema.ts` — Drizzle pgTable definitions for projects + sprints
- `/home/jayry/projects/skelecode/frontend/lib/db/index.ts` — Drizzle HTTP client singleton (`export const db`)
- `/home/jayry/projects/skelecode/frontend/drizzle.config.ts` — Drizzle Kit config with dotenv workaround
- `/home/jayry/projects/skelecode/frontend/.env.example` — Phase 3 env var documentation template

## Files Modified

- `/home/jayry/projects/skelecode/frontend/app/sprints/page.tsx` — Added `import Link from "next/link"` (pre-existing bug fix)
- `/home/jayry/projects/skelecode/frontend/context/ProjectContext.tsx` — Added `projectId: string | null` + `setProjectId` to interface, state, and provider value
- `/home/jayry/projects/skelecode/frontend/.gitignore` — Added `!.env.example` exception so template is committed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Add .env.example gitignore exception**
- **Found during:** Task 2 commit
- **Issue:** `frontend/.gitignore` has `.env*` catch-all that blocked committing `.env.example`. The plan requires `.env.example` to be committed as a documentation artifact.
- **Fix:** Added `!.env.example` exception line to `frontend/.gitignore`.
- **Files modified:** `frontend/.gitignore`
- **Commit:** 472b5e6

## Known Stubs

None — this plan creates infrastructure files only; no UI data flows introduced.

## Threat Flags

No new threat surface beyond what is covered in the plan's threat model. `DATABASE_URL` has no `NEXT_PUBLIC_` prefix in `.env.example`, confirming it will not be bundled to the browser.

## Self-Check: PASSED

- `frontend/lib/db/schema.ts` — FOUND
- `frontend/lib/db/index.ts` — FOUND
- `frontend/drizzle.config.ts` — FOUND
- `frontend/.env.example` — FOUND
- Task 1 commit 6916a54 — FOUND
- Task 2 commit 472b5e6 — FOUND

## What You Can Test Now

**Prerequisites:** None required for compilation checks. For `drizzle-kit push` (Plan 02), you will need `DATABASE_URL` in `frontend/.env.local`.

| What | How | Expected |
|------|-----|----------|
| TypeScript compile | `cd frontend && npm run build` | Exits 0, no type errors |
| Schema file exists | `cat frontend/lib/db/schema.ts` | Projects + sprints pgTable definitions |
| DB client importable | `node -e "require('./frontend/lib/db/index.ts')"` | Requires DATABASE_URL at runtime |
| Drizzle Kit config | `cd frontend && npx drizzle-kit --help` | Shows drizzle-kit CLI (requires DATABASE_URL in .env.local to push) |

**Not yet testable:** DB migration (`drizzle-kit push`) — requires Plan 02 + a real `DATABASE_URL` in `.env.local`. Clerk auth UI — requires Plans 03-02 through 03-04 + Clerk API keys.
