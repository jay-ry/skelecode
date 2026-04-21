---
phase: 03-auth-database
plan: "03"
subsystem: frontend/auth
tags: [clerk, nextjs, middleware, auth, layout]
dependency_graph:
  requires: [03-01]
  provides: [clerk-provider, clerk-middleware, sign-in-page, sign-up-page]
  affects: [frontend/app/layout.tsx, frontend/middleware.ts, frontend/app/sign-in, frontend/app/sign-up]
tech_stack:
  added: []
  patterns:
    - ClerkProvider as outermost layout wrapper (Server Component)
    - clerkMiddleware with createRouteMatcher for route protection
    - Catch-all [[...slug]] routing for Clerk multi-step auth flows
key_files:
  created:
    - frontend/middleware.ts
    - frontend/app/sign-in/[[...sign-in]]/page.tsx
    - frontend/app/sign-up/[[...sign-up]]/page.tsx
    - frontend/components/Header.tsx (deviation: untracked in main, needed for build)
    - frontend/public/skelecode-logo.png (deviation: untracked in main, needed for build)
  modified:
    - frontend/app/layout.tsx
decisions:
  - ClerkProvider is outermost wrapper (outside <html>) — required for auth() to work in any Server Component
  - middleware.ts filename kept despite Next.js 16 "proxy" deprecation warning — Clerk 7 requires this exact filename
  - await auth.protect() used (not auth().protect()) — Clerk 7 async API
  - Landing page / excluded from createRouteMatcher per PROJECT.md logged-out visitor requirement
metrics:
  duration: "~6 minutes"
  completed: "2026-04-21T10:33:58Z"
  tasks_completed: 3
  files_changed: 6
---

# Phase 03 Plan 03: Clerk Auth Integration Summary

ClerkProvider wraps the entire Next.js app tree, middleware protects three routes with async auth.protect(), and catch-all sign-in/sign-up pages enable Clerk's multi-step auth flows.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wrap root layout with ClerkProvider (outermost) | d9c6827 | frontend/app/layout.tsx, frontend/components/Header.tsx, frontend/public/skelecode-logo.png |
| 2 | Create middleware.ts with clerkMiddleware + createRouteMatcher | 4f2ba88 | frontend/middleware.ts |
| 3 | Create catch-all sign-in and sign-up pages | d4c59cd | frontend/app/sign-in/[[...sign-in]]/page.tsx, frontend/app/sign-up/[[...sign-up]]/page.tsx |

## Key Implementation Details

### layout.tsx — ClerkProvider wrapping order

`ClerkProvider` is the outermost JSX element, wrapping `<html>`, which in turn contains `<body>`, `<CopilotKit>`, and `<ProjectContextProvider>`. This order is required so `auth()` resolves in any Server Component or route handler. The file remains a Server Component — no `"use client"` directive was added.

Final wrapper order:
```
ClerkProvider
  └── <html>
        └── <body>
              └── CopilotKit
                    └── ProjectContextProvider
                          └── {children}
```

### middleware.ts — Protected routes + matcher

Protected routes (from CONTEXT.md locked decision):
- `/dashboard(.*)`
- `/sprints(.*)`
- `/skeleton(.*)`

Matcher: `/((?!_next|.*\\..*).*)` — per CONTEXT.md locked pattern.

`await auth.protect()` is used (with `await`) — required for Clerk 7 async API. Without `await`, the guard is a no-op (T-03-S-01 threat mitigated).

Note: Next.js 16.2.4 emits a deprecation warning suggesting `proxy` instead of `middleware` as the filename convention. The file is kept as `middleware.ts` because Clerk 7 requires this exact filename to inject its auth context. The build succeeds with only a warning, not an error.

### Sign-in/sign-up catch-all paths

- `frontend/app/sign-in/[[...sign-in]]/page.tsx` — renders `<SignIn />`
- `frontend/app/sign-up/[[...sign-up]]/page.tsx` — renders `<SignUp />`

Double-bracket `[[...]]` makes the segment optional + catch-all, enabling Clerk's multi-step flows (e.g., `/sign-in/factor-one`, `/sign-in/sso-callback`). Neither page has `"use client"` — Clerk components handle their own client boundary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Copy Header.tsx from main working directory to worktree**
- **Found during:** Task 1 build verification
- **Issue:** `frontend/app/sprints/page.tsx` imports `../../components/Header` but `Header.tsx` was untracked in the main repo (not committed), so the worktree didn't have it. Build failed with `Module not found: Can't resolve '../../components/Header'`.
- **Fix:** Copied `frontend/components/Header.tsx` from the main working directory (`/home/jayry/projects/skelecode/frontend/components/Header.tsx`) into the worktree and committed it.
- **Files modified:** `frontend/components/Header.tsx` (created in worktree)
- **Commit:** d9c6827

**2. [Rule 3 - Blocking] Copy skelecode-logo.png from main working directory to worktree**
- **Found during:** Task 1 build verification (same build failure context)
- **Issue:** `Header.tsx` references `/skelecode-logo.png` via `next/image`. The image existed in the main repo as an untracked file but not in the worktree's `frontend/public/`.
- **Fix:** Copied `frontend/public/skelecode-logo.png` from the main working directory into the worktree and committed it.
- **Files modified:** `frontend/public/skelecode-logo.png` (created in worktree)
- **Commit:** d9c6827

## Known Stubs

None — this plan wires authentication infrastructure; no UI data flows have stub values.

## Threat Surface Scan

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-03-S-01 | `await auth.protect()` — await keyword present, confirmed by grep |
| T-03-E-01 | `createRouteMatcher(["/dashboard(.*)", "/sprints(.*)", "/skeleton(.*)"])` — landing page `/` excluded |

No new threat surface beyond the plan's threat model.

## Self-Check: PASSED

- `frontend/app/layout.tsx` contains ClerkProvider — FOUND
- `frontend/middleware.ts` exists — FOUND
- `frontend/app/sign-in/[[...sign-in]]/page.tsx` — FOUND
- `frontend/app/sign-up/[[...sign-up]]/page.tsx` — FOUND
- Task 1 commit d9c6827 — FOUND
- Task 2 commit 4f2ba88 — FOUND
- Task 3 commit d4c59cd — FOUND

## What You Can Test Now

**Prerequisites:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in `frontend/.env.local`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` in `frontend/.env.local`

| What | How | Expected |
|------|-----|----------|
| Build passes | `cd frontend && npm run build` | Exit 0, routes include /sign-in/[[...sign-in]] and /sign-up/[[...sign-up]] |
| Sign-in page renders | `npm run dev` then visit http://localhost:3000/sign-in | Clerk SignIn widget on dark bg-[#020408] background |
| Sign-up page renders | Visit http://localhost:3000/sign-up | Clerk SignUp widget on dark background |
| Protected route redirect | Visit http://localhost:3000/sprints while signed out | Redirected to /sign-in |
| Protected route access | Visit http://localhost:3000/sprints while signed in | Sprints page loads |
| Landing page public | Visit http://localhost:3000 while signed out | Landing page loads (no redirect) |

**Not yet testable:** `await auth()` returning real userId in route handlers (Plan 04), UserButton in header (Plan 04), project/sprint persistence to DB (Plans 04-05).
