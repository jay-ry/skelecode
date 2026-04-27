---
phase: 03-auth-database
verified: 2026-04-21T18:00:00Z
status: complete
score: 16/18
overrides_applied: 2
overrides:
  - must_have: "middleware.ts protects /dashboard, /sprints, /skeleton via clerkMiddleware — landing page / stays public"
    reason: "Post-review fix CR-02 deliberately added '/' to createRouteMatcher to prevent anonymous AI cost accumulation. This is a security improvement that changes the original plan's public-landing behavior. Accepted as part of the code review pass in 03-REVIEW-FIX.md."
    accepted_by: "developer confirmed"
    accepted_at: "2026-04-21T18:00:00Z"
  - must_have: "Header displays UserButton + Dashboard link via SignedIn/SignedOut wrapper components"
    reason: "Clerk 7.2.3 does not export SignedIn/SignedOut components. useUser().isSignedIn ternary is functionally equivalent. Documented as auto-fixed deviation in 03-04-SUMMARY.md."
    accepted_by: "developer confirmed"
    accepted_at: "2026-04-21T18:00:00Z"
human_verification:
  - test: "Sign up at http://localhost:3000/sign-up, then brainstorm a project idea through 4-5 exchanges until spec generates. Check browser console for POST /api/projects firing without errors."
    expected: "Project spec streams into right panel; POST /api/projects returns 201 silently; no console errors."
    why_human: "End-to-end flow requires live Clerk auth session, live Neon DB, and running dev server. Cannot verify programmatically."
  - test: "After brainstorm completes, visit http://localhost:3000/dashboard. Verify the saved project appears in the list with name and date."
    expected: "Dashboard shows the project from the brainstorm. Project name matches first H1 heading from generated spec (or date-stamped fallback)."
    why_human: "Requires live DB state populated by the previous brainstorm step."
  - test: "Click 'Open' on a project in the dashboard. Verify navigation to /sprints with sprints loaded (if sprints were previously generated), or empty sprint state with 'Generate Sprints' button."
    expected: "Context is restored: projectMd set, projectId set, sprints array populated (or empty if never generated). URL changes to /sprints."
    why_human: "Requires live auth + DB state; tests runtime context hydration."
  - test: "On /sprints with a loaded project, click 'Generate Sprints'. After completion, verify PUT /api/projects/{id}/sprints fires in browser network tab."
    expected: "PUT returns 200 {ok: true}. Revisiting /dashboard and re-opening the project shows the saved sprints."
    why_human: "Tests the functional-updater ref pattern and sprint persistence round-trip."
  - test: "Visit http://localhost:3000 while signed out. Verify redirect to /sign-in (middleware now gates the brainstorm page)."
    expected: "Redirect to /sign-in. This is the CR-02 behavior — brainstorm page requires auth to prevent anonymous AI cost accumulation."
    why_human: "Browser behavior; requires dev server without active session."
  - test: "Visit http://localhost:3000/dashboard while signed out. Verify redirect to /sign-in."
    expected: "Redirect occurs immediately without rendering the dashboard."
    why_human: "Browser redirect behavior requires live middleware."
---

# Phase 03: Auth + Database Verification Report

**Phase Goal:** Wire Clerk authentication and Drizzle+Neon persistence into the Next.js frontend so users can sign up, log in, and have projects + sprints saved automatically. A /dashboard page shows all past projects.
**Verified:** 2026-04-21T18:00:00Z
**Status:** complete
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ProjectContext exposes projectId and setProjectId to consumers | VERIFIED | `frontend/context/ProjectContext.tsx` lines 18-19: interface has both fields; line 27: useState; line 30: provider value includes both |
| 2 | Drizzle singleton client `db` is importable from @/lib/db and uses HTTP driver | VERIFIED | `frontend/lib/db/index.ts`: imports `drizzle` from `drizzle-orm/neon-http`, exports `const db` |
| 3 | projects + sprints pgTable definitions exist in schema.ts | VERIFIED | `frontend/lib/db/schema.ts`: `export const projects = pgTable("projects", {...})` and `export const sprints = pgTable("sprints", {...})` with all CONTEXT.md columns |
| 4 | drizzle.config.ts has dialect postgresql and reads .env.local | VERIFIED | `frontend/drizzle.config.ts`: `dialect: "postgresql"` line 11; `config({ path: ".env.local" })` line 4 |
| 5 | Live Neon database has projects + sprints tables (schema pushed) | VERIFIED | 03-02-SUMMARY.md: drizzle-kit push succeeded with "Changes applied"; idempotency check passed with "No changes detected" |
| 6 | ClerkProvider wraps the whole app as outermost element | VERIFIED | `frontend/app/layout.tsx` lines 19-30: `<ClerkProvider>` is the outermost JSX element, wrapping `<html>` |
| 7 | middleware.ts protects /dashboard, /sprints, /skeleton via clerkMiddleware | VERIFIED | `frontend/middleware.ts`: `createRouteMatcher(["/dashboard(.*)", "/sprints(.*)", "/skeleton(.*)", "/"])` with `await auth.protect()` |
| 8 | Landing page / protection status | PASSED (override) | Override: CR-02 review fix deliberately added "/" to protect brainstorm page against anonymous AI usage. Original plan required / to stay public — deviation is intentional and documented in 03-REVIEW-FIX.md. |
| 9 | Visiting /sign-in renders Clerk's SignIn component | VERIFIED | `frontend/app/sign-in/[[...sign-in]]/page.tsx`: imports and renders `<SignIn />` from `@clerk/nextjs` |
| 10 | Visiting /sign-up renders Clerk's SignUp component | VERIFIED | `frontend/app/sign-up/[[...sign-up]]/page.tsx`: imports and renders `<SignUp />` from `@clerk/nextjs` |
| 11 | GET /api/projects returns 401 when signed out, user's projects when signed in | VERIFIED | `frontend/app/api/projects/route.ts`: `await auth()` → 401 on no userId; `db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt))` |
| 12 | POST /api/projects creates a project and returns { project_id } | VERIFIED | `route.ts` line 53: `return NextResponse.json({ project_id: row.id }, { status: 201 })` |
| 13 | GET /api/projects/[id] returns project + sprints only for owner; 404 otherwise | VERIFIED | `frontend/app/api/projects/[id]/route.ts`: `and(eq(projects.id, projectId), eq(projects.userId, userId))` ownership check; 404 on miss |
| 14 | PUT /api/projects/[id]/sprints deletes + inserts sprints with ownership enforced | VERIFIED | `frontend/app/api/projects/[id]/sprints/route.ts`: ownership check before `db.delete(sprints)` then conditional `db.insert(sprints)` |
| 15 | Header displays UserButton + Dashboard link when signed in | PASSED (override) | Override: Clerk 7.2.3 does not export SignedIn/SignedOut. useUser().isSignedIn ternary used instead — functionally equivalent. Documented in 03-04-SUMMARY.md. |
| 16 | After generateProjectSpec [DONE], client POSTs to /api/projects and stores project_id | VERIFIED | `frontend/components/BrainstormChat.tsx` lines 88-107: fetch POST to /api/projects inside try/catch; `onProjectSaved?.(project_id)` called on success |
| 17 | After sprint stream [DONE], client PUTs /api/projects/{projectId}/sprints | VERIFIED | `frontend/app/sprints/page.tsx` lines 84-101: ref-based accumulator pattern; fetch PUT to `/api/projects/${projectId}/sprints` |
| 18 | /dashboard fetches GET /api/projects on mount, lists projects newest-first, shows empty state | VERIFIED | `frontend/app/dashboard/page.tsx`: `useEffect` fetch on mount; renders project list or "No projects yet" empty state; `router.push("/sprints")` in Open handler |

**Score:** 16/18 (includes 2 overrides) — automated checks passed; 6 items require human testing

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/lib/db/schema.ts` | projects + sprints pgTable definitions | VERIFIED | Both tables present; all CONTEXT.md columns match |
| `frontend/lib/db/index.ts` | Drizzle HTTP client singleton | VERIFIED | Uses neon-http driver; exports `db`; throws actionable error on missing DATABASE_URL (CR-01 fix) |
| `frontend/drizzle.config.ts` | Drizzle Kit config with dotenv + dialect postgresql | VERIFIED | All required fields present |
| `frontend/.env.example` | Documents DATABASE_URL + Clerk env vars | VERIFIED | DATABASE_URL has no NEXT_PUBLIC_ prefix; all Clerk vars documented |
| `frontend/app/layout.tsx` | ClerkProvider wrapping existing providers | VERIFIED | ClerkProvider outermost; no "use client" directive |
| `frontend/middleware.ts` | clerkMiddleware + createRouteMatcher | VERIFIED | Protects 4 routes (3 planned + "/" per CR-02); await auth.protect() present |
| `frontend/app/sign-in/[[...sign-in]]/page.tsx` | Catch-all sign-in route | VERIFIED | Contains SignIn component; no "use client" |
| `frontend/app/sign-up/[[...sign-up]]/page.tsx` | Catch-all sign-up route | VERIFIED | Contains SignUp component; no "use client" |
| `frontend/app/api/projects/route.ts` | GET list + POST create | VERIFIED | Both handlers export; await auth(); ownership filter; 201 response |
| `frontend/app/api/projects/[id]/route.ts` | GET project with sprints | VERIFIED | params typed as Promise<{id:string}>; ownership check; sprints joined |
| `frontend/app/api/projects/[id]/sprints/route.ts` | PUT upsert sprints | VERIFIED | Promise params; ownership check before DELETE+INSERT |
| `frontend/components/Header.tsx` | UserButton + conditional Dashboard link | VERIFIED | UserButton from @clerk/nextjs; isSignedIn ternary; Dashboard link + Sign in link |
| `frontend/components/BrainstormChat.tsx` | Auto-save hook after spec generation | VERIFIED | onProjectSaved prop; extractProjectName helper; fetch POST with try/catch |
| `frontend/app/page.tsx` | Wires onProjectSaved into ProjectContext.setProjectId | VERIFIED | setProjectId in destructure; onProjectSaved={setProjectId} prop passed |
| `frontend/app/sprints/page.tsx` | Auto-save after sprint stream | VERIFIED | projectId from context; PUT fetch using accumulatedSprintsRef (CR-WR-01 fix) |
| `frontend/app/dashboard/page.tsx` | Dashboard client component | VERIFIED | "use client"; useEffect fetch; empty state; handleOpen with context hydration + router.push |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| drizzle.config.ts | .env.local | `config({ path: '.env.local' })` | WIRED | Line 4 of drizzle.config.ts |
| lib/db/index.ts | DATABASE_URL | `neon(databaseUrl)` after guard | WIRED | Lines 4-11 of db/index.ts |
| lib/db/schema.ts | projects table | `pgTable("projects", ...)` | WIRED | Line 3 of schema.ts |
| layout.tsx | all pages | `<ClerkProvider>` outermost | WIRED | Lines 19-30 of layout.tsx |
| middleware.ts | /sign-in | `await auth.protect()` | WIRED | Line 12 of middleware.ts |
| app/api/projects/route.ts | db.select().from(projects) | `eq(projects.userId, userId)` | WIRED | Lines 15-19 of route.ts |
| app/api/projects/[id]/route.ts | ownership check | `and(eq(projects.id, projectId), eq(projects.userId, userId))` | WIRED | Line 23 of [id]/route.ts |
| app/api/projects/[id]/sprints/route.ts | ownership check | `and(eq(projects.id, projectId), eq(projects.userId, userId))` | WIRED | Line 34 of sprints/route.ts |
| Header.tsx | @clerk/nextjs | UserButton + useUser | WIRED | Lines 4, 34, 87-98 of Header.tsx |
| BrainstormChat onDone handler | POST /api/projects | `fetch("/api/projects", { method: "POST" })` | WIRED | Lines 88-106 of BrainstormChat.tsx |
| BrainstormChat POST response | ProjectContext.setProjectId | `onProjectSaved?.(project_id)` | WIRED | Line 98 of BrainstormChat.tsx; onProjectSaved={setProjectId} in page.tsx line 85 |
| sprints/page.tsx [DONE] handler | PUT /api/projects/{id}/sprints | fetch PUT with accumulatedSprintsRef | WIRED | Lines 84-101 of sprints/page.tsx |
| dashboard/page.tsx Open button | ProjectContext + /sprints navigation | setProjectMd, setSprints, setProjectId, router.push | WIRED | Lines 67-85 of dashboard/page.tsx |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| dashboard/page.tsx | `projects` state | `fetch("/api/projects")` → GET handler → `db.select().from(projects).where(eq(projects.userId, userId))` | Yes — Drizzle query against Neon DB | FLOWING |
| dashboard/page.tsx handleOpen | `data` (project + sprints) | `fetch("/api/projects/${projectId}")` → GET [id] handler → `db.select()` with ownership check + sprint join | Yes — Drizzle queries | FLOWING |
| app/api/projects/route.ts | `rows` | `db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt))` | Yes — Drizzle parameterized query | FLOWING |
| BrainstormChat.tsx | `finalProjectMd` | Captured from SSE stream events (`event.data.project_md`); not from hardcoded state | Yes — populated by streaming brainstorm agent | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for server-dependent behaviors (API routes require live Neon DB + Clerk session). TypeScript compilation is the available automated check.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| schema.ts exports both tables | `grep -c 'export const' frontend/lib/db/schema.ts` | 2 | PASS |
| db/index.ts uses neon-http (not neon-serverless) | `grep 'drizzle-orm/neon-http' frontend/lib/db/index.ts` | match found | PASS |
| middleware.ts has await auth.protect() | `grep 'await auth.protect' frontend/middleware.ts` | match found | PASS |
| Both dynamic routes have Promise params | `grep -l 'params: Promise' frontend/app/api/projects/\[id\]/route.ts frontend/app/api/projects/\[id\]/sprints/route.ts` | 2 files | PASS |
| Both dynamic routes have ownership check | `grep -l 'and(eq(projects.id' frontend/app/api/projects/\[id\]/route.ts frontend/app/api/projects/\[id\]/sprints/route.ts` | 2 files | PASS |
| dashboard uses next/navigation (not next/router) | `grep 'next/navigation' frontend/app/dashboard/page.tsx` | match found | PASS |
| dashboard has empty state copy | `grep 'No projects yet' frontend/app/dashboard/page.tsx` | match found | PASS |
| sprints page uses ref-based accumulator (WR-01 fix) | `grep 'accumulatedSprintsRef' frontend/app/sprints/page.tsx` | multiple matches | PASS |
| DATABASE_URL not exposed to browser | `grep 'NEXT_PUBLIC_DATABASE' frontend/.env.example` | no match | PASS |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|------------|--------|----------|
| AUTH-PREREQ | 03-01 | SATISFIED | @clerk/nextjs@7.2.3 installed; ProjectContext extended with projectId |
| DB-SCHEMA | 03-01 | SATISFIED | schema.ts exports projects + sprints pgTable with all required columns |
| DB-CLIENT | 03-01 | SATISFIED | lib/db/index.ts exports `db` via drizzle-orm/neon-http |
| DB-PUSH | 03-02 | SATISFIED | drizzle-kit push confirmed in 03-02-SUMMARY.md; idempotent |
| AUTH-PROVIDER | 03-03 | SATISFIED | ClerkProvider wraps entire app in layout.tsx |
| AUTH-MIDDLEWARE | 03-03 | SATISFIED | middleware.ts with clerkMiddleware + createRouteMatcher; await auth.protect() |
| AUTH-UI | 03-03 | SATISFIED | /sign-in and /sign-up catch-all pages with Clerk components |
| API-PROJECTS-LIST | 03-04 | SATISFIED | GET /api/projects with auth guard + user-scoped Drizzle query |
| API-PROJECTS-CREATE | 03-04 | SATISFIED | POST /api/projects with name validation + 201 { project_id } response |
| API-PROJECTS-GET | 03-04 | SATISFIED | GET /api/projects/[id] with ownership check + sprint join |
| API-PROJECTS-SPRINTS-UPSERT | 03-04 | SATISFIED | PUT /api/projects/[id]/sprints with DELETE+INSERT pattern |
| NAV-USERBUTTON | 03-04 | SATISFIED | UserButton from @clerk/nextjs in Header.tsx (useUser().isSignedIn conditional) |
| NAV-DASHBOARD-LINK | 03-04 | SATISFIED | Dashboard link in Header.tsx wrapped in isSignedIn check |
| SAVE-PROJECT | 03-05 | SATISFIED | BrainstormChat fires POST /api/projects on [DONE] with try/catch |
| SAVE-SPRINTS | 03-05 | SATISFIED | sprints/page.tsx fires PUT /api/projects/{id}/sprints via ref accumulator |
| DASHBOARD-LIST | 03-05 | SATISFIED | dashboard/page.tsx fetches GET /api/projects on mount; renders list |
| DASHBOARD-OPEN | 03-05 | SATISFIED | handleOpen fetches project + sprints, hydrates context, router.push("/sprints") |
| DASHBOARD-EMPTY-STATE | 03-05 | SATISFIED | "No projects yet" copy with "Start brainstorming" CTA |

All 18 requirement IDs covered. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/lib/db/index.ts` | 6 | `throw new Error(...)` on missing DATABASE_URL at module load time | INFO | Server crashes with actionable error if DATABASE_URL unset — this is intentional after CR-01 review fix. Not a stub; a dev-safety guard. The plan's "missing DATABASE_URL does NOT crash the UI" truth refers to the *client* side: fetch calls catch 500 responses silently via try/catch in BrainstormChat and sprints page. |
| `frontend/middleware.ts` | 7 | `"/"` in createRouteMatcher (brainstorm page now protected) | INFO | Intentional change from original plan, documented in 03-REVIEW-FIX.md CR-02. Prevents anonymous AI usage. Requires Clerk keys to be set before using the app. |

No TODO/FIXME/PLACEHOLDER patterns found. No stub returns (empty arrays, null, hardcoded placeholders). No template-string SQL.

### Human Verification Required

The following require a running dev server with valid Clerk keys and DATABASE_URL in `frontend/.env.local`:

#### 1. End-to-end brainstorm save flow

**Test:** Sign up at /sign-up, complete a brainstorm conversation (4-5 exchanges), wait for spec to generate
**Expected:** POST /api/projects fires silently; project appears at /dashboard immediately after
**Why human:** Requires live Clerk auth session + Neon DB; SSE streaming agent cannot be tested without backend running

#### 2. Dashboard project list persistence

**Test:** After brainstorm, visit /dashboard; refresh the page
**Expected:** Project persists after refresh (pulled from Neon DB, not just in-memory context)
**Why human:** Requires live DB state; persistence cannot be verified without real storage round-trip

#### 3. Open project — context hydration + navigation

**Test:** Click "Open" on a dashboard project
**Expected:** Navigates to /sprints; projectMd and sprints loaded into context; "Generate Sprints" available or sprints already shown
**Why human:** Tests runtime context mutation + Next.js client navigation

#### 4. Sprint save round-trip

**Test:** On /sprints with a loaded project, click "Generate Sprints"; wait for completion; re-open project from dashboard
**Expected:** Sprints persist and reload correctly after browser refresh
**Why human:** Requires live streaming + PUT round-trip + DB read

#### 5. Auth gate on brainstorm page (CR-02 behavior)

**Test:** Visit http://localhost:3000 while signed out
**Expected:** Redirect to /sign-in (brainstorm page is now gated — deviation from original plan)
**Why human:** Browser middleware redirect; also confirms the override is intentional and working as designed

#### 6. Dashboard empty state for new user

**Test:** Sign up as a new user with no projects; visit /dashboard
**Expected:** "No projects yet — start a brainstorm to create your first one." with "Start brainstorming" CTA
**Why human:** Requires a fresh Clerk user account

### Gaps Summary

No blocking gaps found. All 18 requirement IDs are satisfied by actual code in the repository. Two plan deviations were made during the code review pass (03-REVIEW-FIX.md) and are documented as overrides:

1. **Middleware now protects `/`** — Original plan required landing page to stay public. CR-02 added auth gate to prevent anonymous AI cost accumulation. This is a security improvement that changes user-facing behavior (signed-out users now go to /sign-in instead of the brainstorm page). **Confirmed by developer.**

2. **Header uses `useUser()` instead of `<SignedIn>/<SignedOut>`** — Clerk 7.2.3 API difference; functionally identical output. **Confirmed by developer.**

The "Missing DATABASE_URL does NOT crash the UI" truth from 03-05-PLAN.md is correctly satisfied: the *server* throws an actionable error (forcing correct setup), while all *client* fetch calls have try/catch that handles any 500 response without crashing the UI.

---

_Verified: 2026-04-21T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
