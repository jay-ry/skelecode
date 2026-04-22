---
phase: 04-skeleton-generator
plan: "02"
subsystem: db-persistence
tags: [drizzle, neon, nextjs-api, auth, skeleton, persistence]
dependency_graph:
  requires: []
  provides: [skeletons-table, skeleton-api-route]
  affects: [04-04-frontend-skeleton-page]
tech_stack:
  added: []
  patterns: [drizzle-pgTable, clerk-auth, delete-insert, idor-ownership-check]
key_files:
  created:
    - frontend/app/api/projects/[id]/skeleton/route.ts
  modified:
    - frontend/lib/db/schema.ts
decisions:
  - DELETE+INSERT pattern used (no UPSERT) — matches sprints route, simpler for MVP
  - 401 for unauthenticated, 404 for non-owner (no info leak distinguishing project not found from not your project)
  - Ownership check runs BEFORE any DB write or read (IDOR mitigation, ASVS V4)
metrics:
  duration: "~8 minutes"
  completed: "2026-04-22"
  tasks: 3
  files: 2
---

# Phase 04 Plan 02: DB Persistence Layer for Skeleton Generator Summary

**One-liner:** Drizzle `skeletons` table with Neon schema push + authenticated PUT/GET API route using DELETE+INSERT pattern and IDOR-safe ownership checks.

## What Was Built

### Task 1: skeletons pgTable appended to schema.ts

Appended a `skeletons` pgTable to `frontend/lib/db/schema.ts`. No new imports needed — all required Drizzle types (`pgTable`, `uuid`, `text`, `timestamp`) were already imported on line 1.

Schema now has exactly 3 exported tables: `projects`, `sprints`, `skeletons`.

```
skeletons columns: id (uuid PK), project_id (uuid FK→projects.id ON DELETE CASCADE NOT NULL),
                   folder_tree (text nullable), wireframe_html (text nullable),
                   created_at (timestamp defaultNow)
```

**Commit:** `3809f76`

### Task 2: Schema pushed to Neon via drizzle-kit

Ran `npx drizzle-kit push` from `frontend/`. Output: `[✓] Changes applied`.

Post-push verification — `information_schema.columns` query returned 5 columns for `skeletons`:
```json
[{"column_name":"id"},{"column_name":"project_id"},{"column_name":"folder_tree"},{"column_name":"wireframe_html"},{"column_name":"created_at"}]
```

`project_id` is NOT NULL (confirmed via `is_nullable: "NO"`). Runtime-only task — no source files committed.

### Task 3: PUT + GET route for skeleton persistence

Created `frontend/app/api/projects/[id]/skeleton/route.ts` with two exported handlers:

**PUT `/api/projects/[id]/skeleton`**
- Clerk auth check → 401 if no userId
- Ownership check (`and(eq(projects.id, projectId), eq(projects.userId, userId))`) runs BEFORE any write (IDOR mitigation)
- Try/catch around `req.json()` → 400 for malformed body
- DELETE + INSERT pattern (no UPSERT, matches sprints route)
- Returns `{ ok: true }`

**GET `/api/projects/[id]/skeleton`**
- Same auth + ownership check pattern
- Returns `{ folder_tree, wireframe_html }` from DB row, or `{ folder_tree: null, wireframe_html: null }` if no row exists
- 401 for unauthenticated, 404 for non-owners

**Commit:** `e2152cb`

## Verification Results

| Check | Result |
|-------|--------|
| `grep -c "^export const" frontend/lib/db/schema.ts` | 3 (projects, sprints, skeletons) |
| `grep -c "export const skeletons = pgTable" schema.ts` | 1 |
| `grep -c 'folder_tree' schema.ts` | 1 |
| `grep -c 'wireframe_html' schema.ts` | 1 |
| `grep -c '"cascade"' schema.ts` | 2 |
| `grep -c "references(() => projects.id" schema.ts` | 2 |
| `npx tsc --noEmit` | Exit 0 (clean) |
| `npx drizzle-kit push` | [✓] Changes applied |
| Neon columns for `skeletons` | 5 (id, project_id, folder_tree, wireframe_html, created_at) |
| PUT handler count | 1 |
| GET handler count | 1 |
| `Promise<{ id: string }>` occurrences | 2 (Next.js 16 params pattern) |
| `await auth()` calls | 2 |
| Unauthorized responses | 2 |
| Ownership checks (`and(eq(projects.id`) | 2 |
| `db.delete(skeletons)` | 1 |
| `db.insert(skeletons)` | 1 |
| `allow-same-origin` string | 0 |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Compliance

All STRIDE threats from the plan's threat register were mitigated:

| Threat ID | Status |
|-----------|--------|
| T-04-06 (IDOR on PUT) | Mitigated — auth + ownership check before any write |
| T-04-07 (IDOR on GET) | Mitigated — auth + ownership check before SELECT |
| T-04-08 (SQL injection) | Mitigated — Drizzle parameterized queries only |
| T-04-09 (info disclosure) | Mitigated — 401 for unauth, 404 for non-owner |
| T-04-10 (DoS body size) | Accepted — Next.js default limit applies |
| T-04-11 (malformed JSON) | Mitigated — try/catch on req.json() returns 400 |

## Known Stubs

None — the route and schema are fully functional with no hardcoded stubs.

## Threat Flags

None — no new security-relevant surface beyond what was planned in the threat model.

## Self-Check: PASSED

- `frontend/lib/db/schema.ts` — exists, 3 exported tables confirmed
- `frontend/app/api/projects/[id]/skeleton/route.ts` — exists, PUT+GET handlers confirmed
- Commit `3809f76` — confirmed in git log
- Commit `e2152cb` — confirmed in git log
- Neon `skeletons` table — 5 columns confirmed via information_schema query
