---
phase: 03-auth-database
fixed_at: 2026-04-21T00:00:00Z
review_path: .planning/phases/03-auth-database/03-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-04-21T00:00:00Z
**Source review:** .planning/phases/03-auth-database/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: `DATABASE_URL!` non-null assertion crashes the server at cold-start

**Files modified:** `frontend/lib/db/index.ts`
**Commit:** 03ee795
**Applied fix:** Replaced `neon(process.env.DATABASE_URL!)` with an explicit guard that reads the env var into a local `databaseUrl` variable, throws an `Error` with an actionable message if it is undefined, then passes `databaseUrl` to `neon()`. The error message directs developers to copy `.env.example` to `.env.local`.

---

### CR-02: `/api/brainstorm` and `/api/sprint-planner` routes are not covered by middleware auth

**Files modified:** `frontend/middleware.ts`
**Commit:** 6f0b57a
**Applied fix:** Added `"/"` to the `createRouteMatcher` array in `middleware.ts` (Option A — gate brainstorm behind auth). Unauthenticated users are now redirected to sign-in before reaching the brainstorm page, preventing anonymous AI cost accumulation and silent data loss.

---

### WR-01: Sprint auto-save inside `setSprints` updater performs a side-effectful fetch inside a state setter

**Files modified:** `frontend/app/sprints/page.tsx`
**Commit:** 0d8ad8e
**Applied fix:** Added a `useRef<Sprint[]>([])` accumulator (`accumulatedSprintsRef`). The accumulator is reset to `[]` at the start of each generation, and each incoming sprint event pushes to it in addition to calling `setSprints`. At `[DONE]`, the ref is read directly: `setSprints(accumulatedSprints)` is a pure assignment, and the `fetch()` call runs immediately afterward outside the setter. This eliminates the Strict Mode double-invocation risk and the stale-closure issue with `latest`.

---

### WR-02: `body.name` length is not validated — unbounded string stored in DB

**Files modified:** `frontend/app/api/projects/route.ts`
**Commit:** 1520c11
**Applied fix:** Extended the existing name check to also reject whitespace-only strings (`body.name.trim().length === 0`) and added a separate 500-character maximum check returning a `400` with a descriptive error message.

---

### WR-03: `sprints` table `projectId` column is nullable — FK constraint can be silently bypassed

**Files modified:** `frontend/lib/db/schema.ts`
**Commit:** 855b627
**Applied fix:** Added `.notNull()` before `.references(...)` on the `projectId` column. The column is now `NOT NULL` at the Drizzle schema level; a migration regeneration with `npx drizzle-kit generate` will enforce it at the database level too.

---

### WR-04: `drizzle.config.ts` uses non-null assertion on `DATABASE_URL` — `drizzle-kit` CLI fails silently in CI

**Files modified:** `frontend/drizzle.config.ts`
**Commit:** 4ca9047
**Applied fix:** Replaced `url: process.env.DATABASE_URL!` with an explicit check: read into a `url` variable, throw `Error("DATABASE_URL must be set for drizzle-kit commands.")` if absent, then pass `url` to `dbCredentials`. Mirrors the pattern applied to `lib/db/index.ts` in CR-01.

---

_Fixed: 2026-04-21T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
