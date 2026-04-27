---
phase: 03-auth-database
plan: "04"
subsystem: frontend/api
tags: [drizzle, clerk, api-routes, nextjs, auth, ownership]
dependency_graph:
  requires: [03-01, 03-03]
  provides: [api-projects-list, api-projects-create, api-projects-get, api-projects-sprints-upsert, header-userbutton]
  affects: [frontend/app/api/projects, frontend/components/Header.tsx]
tech_stack:
  added: []
  patterns:
    - Next.js dynamic route handlers with Promise<params> (Next.js 16 breaking change)
    - Drizzle ownership check pattern: and(eq(projects.id, projectId), eq(projects.userId, userId))
    - DELETE+INSERT upsert pattern for sprint replacement
    - useUser() hook for conditional client-side Clerk rendering (Clerk 7 — SignedIn/SignedOut not exported)
key_files:
  created:
    - frontend/app/api/projects/route.ts
    - frontend/app/api/projects/[id]/route.ts
    - frontend/app/api/projects/[id]/sprints/route.ts
  modified:
    - frontend/components/Header.tsx
decisions:
  - Next.js 16 requires params typed as Promise<{ id: string }> and awaited — without await, params is undefined
  - Clerk 7.2.3 does not export SignedIn/SignedOut components — useUser().isSignedIn used instead for conditional rendering in client components
  - UserButton afterSignOutUrl prop does not exist in Clerk 7 — removed; sign-out redirect configured at ClerkProvider level
  - 404 returned (not 403) when ownership check fails — prevents IDOR enumeration (T-03-I-05)
  - DELETE+INSERT chosen over UPSERT for sprint replacement — simpler MVP pattern, preserves full sprint object as JSONB fallback
metrics:
  duration: "~15 minutes"
  completed: "2026-04-21T16:30:00Z"
  tasks_completed: 3
  files_changed: 4
---

# Phase 03 Plan 04: Project API Routes + Header Auth Summary

Three Next.js API routes for project CRUD with Clerk auth + Drizzle ownership checks, and Header updated with conditional Dashboard link and UserButton using Clerk 7's useUser hook.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create GET list + POST create /api/projects | 3747a09 | frontend/app/api/projects/route.ts |
| 2 | Create dynamic [id] and [id]/sprints routes | f8dd2db | frontend/app/api/projects/[id]/route.ts, frontend/app/api/projects/[id]/sprints/route.ts |
| 3 | Update Header with UserButton + Dashboard link | e6dd56b | frontend/components/Header.tsx |

## API Routes Created

### GET /api/projects
- Returns all projects for the authenticated user, ordered by `createdAt` DESC
- Auth guard: `await auth()` → 401 if no userId
- Query: `db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt))`

### POST /api/projects
- Creates a new project for the authenticated user
- Request body: `{ name: string; project_md?: string }`
- Response 201: `{ project_id: string }`
- Validation: 400 on missing/non-string `name`

### GET /api/projects/[id]
- Returns a single project with its sprints (ordered by `sprintNumber` ASC)
- Ownership check: `and(eq(projects.id, projectId), eq(projects.userId, userId))`
- 404 if not found or not owned (prevents IDOR enumeration)
- Response: `{ ...project, sprints: [...] }`

### PUT /api/projects/[id]/sprints
- Upserts sprints via DELETE+INSERT pattern
- Ownership verified before any write
- Accepts `{ sprints: Array<{ number, goal, user_stories?, technical_tasks?, definition_of_done?, content_md?, sprint_data? }> }`
- Stores full sprint object as JSONB fallback when `sprint_data` not pre-built

## Ownership Check Pattern

All dynamic routes use:
```typescript
and(eq(projects.id, projectId), eq(projects.userId, userId))
```
This enforces that only the authenticated user's own resources are accessible/modifiable. 404 is returned on ownership miss (not 403) to prevent existence-leak attacks.

## Next.js 16 Promise Params Pattern

Both dynamic routes type `params` as `Promise<{ id: string }>` and await it:
```typescript
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
```
Without this await, `projectId` is `undefined` — a silent breaking change in Next.js 16.

## Header.tsx Clerk Integration

- `UserButton` from `@clerk/nextjs` renders the Clerk avatar/dropdown when signed in
- `useUser().isSignedIn` drives conditional rendering (ternary — Dashboard + UserButton when signed in, Sign in link when signed out)
- Note: `SignedIn`/`SignedOut` wrapper components are not exported in `@clerk/nextjs` 7.2.3 — `useUser()` hook is the correct pattern for client components in this version

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Clerk 7 does not export SignedIn/SignedOut components**
- **Found during:** Task 3 build verification
- **Issue:** Plan specified `import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs"` but Clerk 7.2.3 does not export these components. Build failed with "Export SignedOut doesn't exist in target module".
- **Fix:** Replaced `<SignedIn>/<SignedOut>` wrapper pattern with `useUser().isSignedIn` conditional rendering — functionally equivalent and correct for Clerk 7 client components.
- **Files modified:** `frontend/components/Header.tsx`
- **Commit:** e6dd56b

**2. [Rule 1 - Bug] UserButton does not accept afterSignOutUrl prop in Clerk 7**
- **Found during:** Task 3 TypeScript check
- **Issue:** Plan specified `<UserButton afterSignOutUrl="/" />` but this prop does not exist in Clerk 7's `UserButtonProps`. TypeScript build error.
- **Fix:** Removed `afterSignOutUrl="/"` prop — in Clerk 7, sign-out redirect is configured via `ClerkProvider`'s `afterSignOutUrl` prop (set in layout.tsx in Plan 03).
- **Files modified:** `frontend/components/Header.tsx`
- **Commit:** e6dd56b

**3. [Rule 3 - Blocking] Worktree missing node_modules — installed dependencies**
- **Found during:** Task 1 build verification
- **Issue:** Worktree had no `node_modules/` directory, so `npm run build` failed with `next: not found`.
- **Fix:** Ran `npm install --prefer-offline` in worktree's `frontend/` directory to install from npm cache.
- **Files modified:** None committed (node_modules not tracked)

**4. [Rule 3 - Blocking] Worktree missing .env.local — copied from main repo**
- **Found during:** Task 1 build verification (after node_modules installed)
- **Issue:** Build failed with "No database connection string was provided to neon()" because the Neon client initializes at module load time and requires `DATABASE_URL`.
- **Fix:** Copied `frontend/.env.local` from main repo to worktree. File is gitignored and not committed.
- **Files modified:** None committed (.env.local is gitignored)

## Known Stubs

None — all three API routes are fully implemented. No data flows use hardcoded placeholder values.

## Threat Surface Scan

All threats in the plan's threat model are mitigated:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-03-S-02 | `await auth()` present in all three route handlers — verified by grep |
| T-03-T-03 | All Drizzle queries use `eq()`, `and()`, `.values()` — no template-string SQL |
| T-03-E-02 | `and(eq(projects.id, projectId), eq(projects.userId, userId))` runs before any read/write |
| T-03-I-05 | 404 returned on ownership miss — not 403 |

No new threat surface introduced beyond the plan's model.

## Self-Check: PASSED

- `frontend/app/api/projects/route.ts` — FOUND
- `frontend/app/api/projects/[id]/route.ts` — FOUND
- `frontend/app/api/projects/[id]/sprints/route.ts` — FOUND
- `frontend/components/Header.tsx` updated — FOUND
- Task 1 commit 3747a09 — FOUND
- Task 2 commit f8dd2db — FOUND
- Task 3 commit e6dd56b — FOUND
- `npm run build` exits 0 — PASSED

## What You Can Test Now

**Prerequisites:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in `frontend/.env.local`
- `DATABASE_URL` (Neon connection string) in `frontend/.env.local`
- Tables migrated (Plan 02 required): `projects` and `sprints` exist in Neon

| What | How | Expected |
|------|-----|----------|
| Build passes | `cd frontend && npm run build` | Exit 0, routes show /api/projects, /api/projects/[id], /api/projects/[id]/sprints |
| GET /api/projects unauthenticated | `curl http://localhost:3000/api/projects` | `{"error":"Unauthorized"}` with 401 |
| POST /api/projects unauthenticated | `curl -X POST http://localhost:3000/api/projects -d '{}'` | `{"error":"Unauthorized"}` with 401 |
| GET /api/projects authenticated | Sign in via Clerk, then `curl` with session cookie | JSON array of user's projects (empty `[]` if none yet) |
| POST /api/projects authenticated | Sign in, then POST `{"name":"My Project"}` | `{"project_id":"<uuid>"}` with 201 |
| Header sign-in state | `npm run dev` → visit http://localhost:3000 while signed out | "Sign in" link visible in header |
| Header signed-in state | Sign in via /sign-in, return to any page | Dashboard link + UserButton avatar visible in header |
| UserButton dropdown | Click UserButton in header | Clerk profile/sign-out dropdown appears |

**Not yet testable:** Dashboard page (Plan 05 — reads project list), auto-save on brainstorm/sprints pages (Plan 05), project persistence end-to-end flow.
