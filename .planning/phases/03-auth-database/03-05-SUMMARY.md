---
phase: 03-auth-database
plan: "05"
subsystem: frontend/client
tags: [auto-save, dashboard, context, clerk, drizzle, nextjs]
dependency_graph:
  requires: [03-01, 03-02, 03-03, 03-04]
  provides: [brainstorm-auto-save, sprint-auto-save, dashboard-page, project-open]
  affects: [frontend/components/BrainstormChat.tsx, frontend/app/page.tsx, frontend/app/sprints/page.tsx, frontend/app/dashboard/page.tsx]
tech_stack:
  added: []
  patterns:
    - Functional-updater snapshot pattern for stale-closure safety in SSE handlers
    - Fire-and-forget fetch with try/catch for stub-safe auto-save
    - Cancellation flag (cancelled = true) in useEffect for unmount safety
    - Sprint rehydration from JSONB sprintData with column fallbacks
key_files:
  created:
    - frontend/app/dashboard/page.tsx
  modified:
    - frontend/components/BrainstormChat.tsx
    - frontend/app/page.tsx
    - frontend/app/sprints/page.tsx
decisions:
  - Functional-updater setSprints((latest) => { ... return latest }) used for sprint auto-save to avoid stale closure — outer `sprints` variable captured at handler creation may be empty even after streaming
  - Auto-save is fire-and-forget with console.warn on failure — UI never blocks or fails on save errors
  - extractProjectName() reads first H1 heading from markdown; falls back to date-stamped name if no heading found
  - 401 responses logged at console.info (not console.warn) — expected in dev without Clerk keys, not an error
  - Dashboard uses fetch-on-mount with cancelled flag (not SWR/React Query) — consistent with rest of codebase pattern
metrics:
  duration: "~20 minutes"
  completed: "2026-04-21T17:00:00Z"
  tasks_completed: 3
  files_changed: 4
---

# Phase 03 Plan 05: Client Wiring — Auto-Save + Dashboard Summary

End-to-end save/load loop wired: brainstorm auto-saves project on spec generation, sprints auto-save on stream completion, dashboard lists all saved projects and re-hydrates full context on Open.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add auto-save to BrainstormChat + wire project_id through page.tsx | 1581ece | frontend/components/BrainstormChat.tsx, frontend/app/page.tsx |
| 2 | Add sprint auto-save on [DONE] in sprints/page.tsx | 9aae668 | frontend/app/sprints/page.tsx |
| 3 | Create /dashboard page with list, empty state, Open handler | 6f97dc6 | frontend/app/dashboard/page.tsx |

## BrainstormChat Changes

**New interface field:** `onProjectSaved?: (projectId: string) => void;`

**New helper function** (module-level):
```typescript
function extractProjectName(md: string): string {
  const match = md.match(/^#\s+(.+)$/m);
  if (match) return match[1].trim();
  return `Project ${new Date().toLocaleDateString()}`;
}
```

**Auto-save block** inserted inside the `[DONE]` branch:
- Declares `let finalProjectMd = ""` at handler start
- Captures `finalProjectMd = event.data.project_md` in each drafter event (avoids relying on React state for final value)
- On `[DONE]`: fires `POST /api/projects` with `{ name, project_md }` inside `try/catch`
- On 200: calls `onProjectSaved?.(project_id)` to store ID in context
- On 401: `console.info` (not signed in — expected in dev)
- On other error or network failure: `console.warn` — UI continues normally

**page.tsx additions:**
- `setProjectId` added to `useProjectContext()` destructure
- `onProjectSaved={setProjectId}` prop passed to `<BrainstormChat>`
- `setProjectId(null)` called in both `handleStartOver` and `handleRetry`

## Sprint Auto-Save Pattern (sprints/page.tsx)

The key design decision is the **functional-updater snapshot** pattern:

```typescript
setSprints((latest) => {
  if (projectId && latest.length > 0) {
    fetch(`/api/projects/${projectId}/sprints`, { method: "PUT", ... })
      .catch((e) => console.warn("[SprintsPage] Sprint auto-save skipped", e));
  }
  return latest; // no-op — does not trigger re-render
});
```

**Why:** The `sprints` variable from the component scope is captured at handler creation time. When `[DONE]` fires, the outer closure may still see an empty array. `setSprints((latest) => ...)` receives the guaranteed-current value from React's state queue without triggering a re-render (returning the same reference is a no-op).

## Dashboard Page Structure (frontend/app/dashboard/page.tsx)

**Fetch on mount** (`useEffect`):
- Fetches `GET /api/projects` on mount
- Cancellation flag (`cancelled = true` in cleanup) prevents state updates after unmount
- Three render states: loading, error, success (empty list or project list)

**Open handler** (`handleOpen`):
1. Sets `openingId` for button loading state
2. Fetches `GET /api/projects/{id}` for full project + sprints
3. Rehydrates `Sprint[]` from `sprintData` JSONB with column fallbacks:
   ```typescript
   number: blob?.number ?? row.sprintNumber,
   goal: blob?.goal ?? row.goal ?? "",
   user_stories: blob?.user_stories ?? [],
   ...
   ```
4. Sorts by sprint number (defense in depth)
5. Sets `projectMd`, `projectId`, `sprints` in context
6. Navigates to `/sprints`

**Empty state:** Shown when no projects exist — "No projects yet" copy + "Start brainstorming" CTA.

**New Project button:** Clears context (`projectMd`, `sprints`, `projectId`) and navigates to `/`.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All data flows are fully wired:
- BrainstormChat POSTs to real `/api/projects` endpoint (Plan 04)
- SprintsPage PUTs to real `/api/projects/{id}/sprints` endpoint (Plan 04)
- Dashboard fetches from real endpoints with real Drizzle + Neon responses

## Threat Surface Scan

All threats in the plan's threat model are mitigated:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-03-S-03 | Clerk session cookie sent automatically with fetch; no userId in request body |
| T-03-E-03 | Dashboard Open calls `GET /api/projects/[id]` — server enforces ownership (Plan 04) |
| T-03-T-04 | `sprintData` JSONB only readable by owner; client trusts its own saved data |
| T-03-I-06 | console.warn messages reveal "server unavailable" only — no secrets logged |
| T-03-D-03 | `.catch()` on every fetch; sprint save is fire-and-forget |

No new threat surface introduced beyond the plan's model.

## Self-Check: PASSED

- `frontend/components/BrainstormChat.tsx` — FOUND, contains onProjectSaved + extractProjectName + fetch POST
- `frontend/app/page.tsx` — FOUND, contains setProjectId + onProjectSaved={setProjectId}
- `frontend/app/sprints/page.tsx` — FOUND, contains projectId + functional-updater + PUT fetch
- `frontend/app/dashboard/page.tsx` — FOUND, contains useEffect + fetch + empty state + Open handler
- Task 1 commit 1581ece — FOUND
- Task 2 commit 9aae668 — FOUND
- Task 3 commit 6f97dc6 — FOUND
- `npm run build` exits 0, /dashboard listed as route — PASSED

## What You Can Test Now

**Prerequisites:**

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in `frontend/.env.local`
- `DATABASE_URL` (Neon connection string) in `frontend/.env.local`
- Database tables migrated (Plan 02): `projects` and `sprints` tables must exist in Neon

| What | How | Expected |
|------|-----|----------|
| Frontend dev server | `cd frontend && npm run dev` → http://localhost:3000 | Landing page + brainstorm chat loads |
| Sign up | Visit http://localhost:3000/sign-up | Clerk sign-up form renders |
| Full brainstorm flow | Sign in, open http://localhost:3000, type a project idea, chat through 4-5 exchanges until bot calls generateProjectSpec | Project spec streams into right panel |
| Auto-save on brainstorm | After spec generates, check browser console | No errors; POST /api/projects fires silently |
| Visit dashboard | http://localhost:3000/dashboard | Project appears in list with name + date |
| Refresh dashboard | Reload http://localhost:3000/dashboard | Project persists (pulled from Neon DB) |
| Open project | Click "Open" on any project | Context restored, navigates to /sprints with sprints loaded |
| Sprint generation | On /sprints page with loaded project, click "Generate Sprints" | Sprints stream in; on completion PUT /api/projects/{id}/sprints fires |
| Empty state | Sign in as a new user with no projects | "No projects yet" message with "Start brainstorming" CTA |
| Dev mode without DB | Remove DATABASE_URL from .env.local, run brainstorm | Spec generates normally; console.warn about auto-save; UI does not crash |
| Dev mode without auth | Remove Clerk keys, run brainstorm | Spec generates normally; console.info "Not signed in — skipping project save" |

**Not yet testable:**
- Tier enforcement (Phase 5 — free tier project limit, Pro unlock)
- Skeleton/wireframe generation (Phase 4 — skeleton generator agent)
- Production deployment (Phase 6 — Vercel + Railway)
