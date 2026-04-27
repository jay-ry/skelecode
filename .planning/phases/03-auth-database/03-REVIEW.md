---
phase: 03-auth-database
reviewed: 2026-04-21T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - frontend/.env.example
  - frontend/.gitignore
  - frontend/app/api/projects/[id]/route.ts
  - frontend/app/api/projects/[id]/sprints/route.ts
  - frontend/app/api/projects/route.ts
  - frontend/app/dashboard/page.tsx
  - frontend/app/layout.tsx
  - frontend/app/page.tsx
  - frontend/app/sign-in/[[...sign-in]]/page.tsx
  - frontend/app/sign-up/[[...sign-up]]/page.tsx
  - frontend/app/sprints/page.tsx
  - frontend/components/BrainstormChat.tsx
  - frontend/components/Header.tsx
  - frontend/context/ProjectContext.tsx
  - frontend/drizzle.config.ts
  - frontend/lib/db/index.ts
  - frontend/lib/db/schema.ts
  - frontend/middleware.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

This phase adds Clerk authentication, a Neon/Drizzle database layer, protected API routes, and a dashboard page. The overall structure is sound: ownership checks are present before writes, auth is checked before all DB operations, and the middleware correctly protects UI routes. Two critical issues exist — a missing API route protection pattern that exposes `/api/brainstorm` to unauthenticated users (and silently stores data for them), and a non-null assertion on `DATABASE_URL` that crashes the entire application at cold-start if the variable is absent. Four warnings cover logic gaps and unsafe patterns that could cause runtime errors or data inconsistency in production.

---

## Critical Issues

### CR-01: `DATABASE_URL!` non-null assertion crashes the server at cold-start

**File:** `frontend/lib/db/index.ts:4`
**Issue:** `neon(process.env.DATABASE_URL!)` uses a TypeScript non-null assertion. When `DATABASE_URL` is undefined (e.g., during local dev without `.env.local`, or a misconfigured Vercel deployment), `neon()` will throw at module import time, crashing every API route handler before they even execute. The error message surfaced to the user will be a generic 500 with no actionable guidance.

**Fix:**
```typescript
// frontend/lib/db/index.ts
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Copy frontend/.env.example to frontend/.env.local and fill in your Neon connection string."
  );
}
const sql = neon(databaseUrl);
export const db = drizzle({ client: sql });
```
This turns a cryptic module-load failure into an actionable error message visible in server logs and during `next build`.

---

### CR-02: `/api/brainstorm` and `/api/sprint-planner` routes are not covered by middleware auth, and `BrainstormChat` silently saves unauthenticated projects

**File:** `frontend/middleware.ts:3-7` and `frontend/components/BrainstormChat.tsx:99`
**Issue:** The middleware `isProtectedRoute` matcher only covers `/dashboard(.*)`, `/sprints(.*)`, and `/skeleton(.*)`. The API routes `/api/projects` and `/api/projects/[id]/sprints` do check `auth()` server-side — that is correct. However, `/api/brainstorm` and `/api/sprint-planner` are not listed in `BrainstormChat.tsx` but are called client-side by users who may not be signed in. The real issue is the `BrainstormChat` auto-save: on a 401 it logs `"Not signed in — skipping project save"` and continues silently. This means:

1. Unauthenticated users generate full project specs (upstream AI cost, no rate limit).
2. After signing in later, those specs are never saved — work is silently lost.
3. The `/sprints` page is middleware-protected, but `/` (brainstorm) is not, so unauthenticated users can fully use the brainstorm+spec flow with no record of it.

If the intent is to gate brainstorming behind auth, add `/` to the protected routes. If the intent is to allow anonymous brainstorming but require login to save, the 401 path in `BrainstormChat` should prompt the user to sign in rather than silently discarding their work.

**Fix (option A — gate brainstorm behind auth):**
```typescript
// frontend/middleware.ts
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/sprints(.*)",
  "/skeleton(.*)",
  "/",          // brainstorm page requires sign-in
]);
```

**Fix (option B — preserve anonymous work, prompt sign-in on save):**
```typescript
// frontend/components/BrainstormChat.tsx  (~line 99)
} else if (saveRes.status === 401) {
  // Surface to the user instead of silently dropping their work
  console.info("[BrainstormChat] Not signed in — project not saved");
  // e.g. trigger a sign-in modal or toast: "Sign in to save your project"
  onProjectSaved?.("__anonymous__"); // signal to parent to show sign-in CTA
}
```

---

## Warnings

### WR-01: Sprint auto-save inside `setSprints` updater performs a side-effectful fetch inside a state setter

**File:** `frontend/app/sprints/page.tsx:76-100`
**Issue:** The `[DONE]` handler calls `setSprints((latest) => { fetch(...); return latest; })`. React's state updater function is meant to be a pure transformation of state. Performing a `fetch()` side effect inside it is an anti-pattern: React may invoke updaters more than once in Strict Mode (development), leading to duplicate save requests. It also makes the code harder to reason about and test.

**Fix:** Separate the side effect from the state update:
```typescript
if (payload === "[DONE]") {
  setIsGenerating(false);
  setIsDone(true);
  // Read sprints from a ref or use a local variable captured in the same closure
  // Option: use a local accumulated array instead of relying on state
  if (projectId && accumulatedSprints.length > 0) {
    fetch(`/api/projects/${projectId}/sprints`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sprints: accumulatedSprints }),
    }).catch((e) => console.warn("[SprintsPage] Sprint auto-save failed", e));
  }
  setSprints(accumulatedSprints);
  return;
}
```
Where `accumulatedSprints` is a `useRef`-backed array or a local variable in the `handleGenerate` function scope that is pushed to as SSE events arrive.

---

### WR-02: `body.name` length is not validated — unbounded string stored in DB

**File:** `frontend/app/api/projects/route.ts:37-39`
**Issue:** The POST handler checks `!body.name || typeof body.name !== "string"` but does not enforce a maximum length. A malicious or buggy client can send a multi-megabyte string as `name`, which will be written directly to the `text` column. This wastes DB storage and can cause issues if the name is later rendered in the UI without truncation.

**Fix:**
```typescript
if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
  return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
}
if (body.name.length > 500) {
  return NextResponse.json({ error: "Field 'name' must be 500 characters or fewer" }, { status: 400 });
}
```

---

### WR-03: `sprints` table `projectId` column is nullable — FK constraint can be silently bypassed

**File:** `frontend/lib/db/schema.ts:14-15`
**Issue:** `projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" })` does not include `.notNull()`. Drizzle will generate the column as nullable, meaning a sprint row can be inserted with `projectId = NULL`. The `onDelete: "cascade"` constraint only fires when the referenced project row is deleted — a NULL FK silently bypasses both cascade and ownership queries (the `eq(sprints.projectId, projectId)` filter will not match NULL rows).

**Fix:**
```typescript
// frontend/lib/db/schema.ts
projectId: uuid("project_id")
  .notNull()
  .references(() => projects.id, { onDelete: "cascade" }),
```
After adding `.notNull()`, regenerate the migration with `npx drizzle-kit generate` so the constraint is applied at the database level.

---

### WR-04: `drizzle.config.ts` uses non-null assertion on `DATABASE_URL` — `drizzle-kit` CLI fails silently in CI

**File:** `frontend/drizzle.config.ts:11`
**Issue:** `url: process.env.DATABASE_URL!` has the same non-null assertion problem as `lib/db/index.ts`. When `drizzle-kit generate` or `drizzle-kit migrate` is run in a CI environment that does not have `DATABASE_URL` set, the tool will throw a runtime error that may be misread as a Drizzle config bug rather than a missing env var.

**Fix:**
```typescript
// frontend/drizzle.config.ts
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL must be set for drizzle-kit commands.");

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url },
});
```

---

## Info

### IN-01: `updatedAt` column is not updated on project edits

**File:** `frontend/lib/db/schema.ts:9`
**Issue:** The `projects` table declares `updatedAt: timestamp("updated_at").defaultNow()`, but the `POST` route (project creation) is the only write path. There is no `UPDATE` route that sets `updatedAt` to the current timestamp. When sprints are saved via the `PUT /api/projects/[id]/sprints` route, the parent project's `updatedAt` is not touched. This means the column will remain frozen at creation time and cannot be used for "last modified" sorting on the dashboard.

**Fix:** Either use a database-level trigger (`ON UPDATE CURRENT_TIMESTAMP`) or add an explicit `updatedAt` set in any future project-update handler. For the current MVP scope this is low priority, but the column is misleading as-is.

---

### IN-02: `Header` component uses `useUser()` for sign-in state check but `UserButton` may render before hydration is complete

**File:** `frontend/components/Header.tsx:34`
**Issue:** `const { isSignedIn } = useUser()` returns `undefined` on first render before Clerk hydrates, then `true/false`. During that window, `isSignedIn` is falsy so the "Sign in" link is always shown briefly before the `UserButton` and "Dashboard" link appear. This causes a visible layout shift (flash of unauthenticated state) on every page load for signed-in users.

**Fix:** Use `isLoaded` from `useUser()` to suppress the auth controls until Clerk is ready:
```typescript
const { isSignedIn, isLoaded } = useUser();
// ...
{isLoaded && (
  isSignedIn ? (
    <>
      <Link href="/dashboard" className={btnClass}>Dashboard</Link>
      <UserButton />
    </>
  ) : (
    <Link href="/sign-in" className={btnClass}>Sign in</Link>
  )
)}
```

---

### IN-03: `console.log`/`console.warn`/`console.info` calls left in production code paths

**File:** `frontend/components/BrainstormChat.tsx:100,103,105`, `frontend/app/sprints/page.tsx:85,92,95`
**Issue:** Multiple `console.warn` and `console.info` calls are present in production code paths (not test files). While not a security risk (they don't expose secrets), they produce noise in browser DevTools and in Vercel function logs, and `console.info` on line 95 of `sprints/page.tsx` leaks internal architectural details ("sprint save (brainstorm may have been run without DB)") to any user who opens DevTools.

**Fix:** Replace with a structured logger utility that respects `NODE_ENV`, or remove info-level logs from production paths. The `console.warn` calls in save-failure paths are reasonable to keep as warnings, but `console.info` disclosing internal state should be removed.

---

_Reviewed: 2026-04-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
