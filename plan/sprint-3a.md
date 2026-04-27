# Sprint 3a — Auth + Database

**Duration:** Week 5
**Claude Code session concern:** Clerk auth + Supabase schema + save/load API + dashboard page
**Files touched:** ~14
**External services wired:** Clerk (auth), Supabase (DB) — two max

---

## Sprint Goal

Users can sign up, log in, and have their projects and sprints saved automatically. A dashboard shows all their past projects. Refreshing the page no longer loses data.

---

## Claude Code Instructions

> "We are extending SkeleCode. Sprints 1 and 2 are complete — the brainstorm agent and sprint planner work, but nothing persists. This sprint adds Clerk auth and Supabase persistence. When a user generates a `project.md` or sprint plan, it saves automatically. Add a `/dashboard` page showing saved projects. Do not touch the LangGraph agents or CopilotKit components."

---

## File Map

```
frontend/
  app/
    dashboard/
      page.tsx              ← project list page
    sign-in/[[...sign-in]]/
      page.tsx              ← Clerk hosted sign-in
    sign-up/[[...sign-up]]/
      page.tsx              ← Clerk hosted sign-up
    api/
      projects/
        route.ts            ← GET list + POST create
      projects/[id]/
        sprints/
          route.ts          ← PUT upsert sprints
  components/
    ProjectDashboard.tsx    ← project list + empty state
    SaveStatus.tsx          ← "Saving..." / "Saved" toast
  lib/
    supabase.ts             ← Supabase client (browser)
    api.ts                  ← typed fetch helpers
  middleware.ts             ← Clerk route protection

backend/
  middleware/
    auth.py                 ← Clerk JWT verification
  api/
    projects.py             ← POST /api/projects, GET /api/projects
    sprints_save.py         ← PUT /api/projects/{id}/sprints
  db/
    client.py               ← Supabase client (service key)
    queries.py              ← save_project, get_projects, save_sprints
```

---

## Frontend Tasks

### F1 — Clerk setup
- Install: `npm install @clerk/nextjs`
- Add `<ClerkProvider>` to `app/layout.tsx` wrapping everything
- Create `app/sign-in/[[...sign-in]]/page.tsx`:
  ```tsx
  import { SignIn } from "@clerk/nextjs"
  export default function Page() { return <SignIn /> }
  ```
- Create `app/sign-up/[[...sign-up]]/page.tsx` — same pattern with `<SignUp />`
- Add user avatar + sign-out to the top nav using `<UserButton />`

### F2 — Route protection middleware
```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isProtected = createRouteMatcher(["/dashboard(.*)", "/sprints(.*)", "/skeleton(.*)"])

export default clerkMiddleware((auth, req) => {
  if (isProtected(req)) auth().protect()
})

export const config = { matcher: ["/((?!_next|.*\\..*).*)"] }
```

### F3 — Auto-save on generation
- In `BrainstormChat.tsx`: after `generateProjectSpec` completes, call `POST /api/projects` to save project + `project_md`, store returned `project_id` in context
- In `GenerateSprints.tsx`: after all sprints stream in, call `PUT /api/projects/{id}/sprints`
- Add `SaveStatus` component near each generate button — shows "Saving..." then "Saved ✓"

### F4 — Dashboard page (`/dashboard`)
- Fetch `GET /api/projects` on mount
- Render a table/list: project name, date, sprint count, "Open" button
- "Open" navigates to `/sprints?project={id}` and loads project data from DB into context
- "New Project" button: clears context, navigates to `/`
- Empty state: "No projects yet — start a brainstorm to create your first one"

### F5 — Nav update
- Add "Dashboard" link to the top nav (only visible when signed in)
- Show `<UserButton />` on the right side of the nav

---

## Backend Tasks

### B1 — Clerk JWT middleware
```python
# middleware/auth.py
import httpx
from fastapi import Request, HTTPException
from jose import jwt

CLERK_JWKS_URL = "https://api.clerk.dev/v1/jwks"

async def get_current_user(request: Request) -> str:
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    # Fetch JWKS and verify — cache the keys, don't fetch on every request
    # Return user_id (sub claim)
    ...
```

Cache JWKS keys in a module-level dict — refresh only on key ID mismatch.

### B2 — Supabase client
```python
# db/client.py
from supabase import create_client
import os

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_KEY"]   # service key bypasses RLS for server-side ops
)
```

### B3 — DB query functions
```python
# db/queries.py

def save_project(user_id: str, name: str, project_md: str) -> str:
    # INSERT into projects, return id
    ...

def get_projects(user_id: str) -> list:
    # SELECT * from projects where user_id = user_id order by created_at desc
    ...

def save_sprints(project_id: str, sprints: list) -> None:
    # DELETE existing sprints for project, then INSERT all new ones
    # (simpler than upsert for MVP)
    ...

def get_project_with_sprints(project_id: str, user_id: str) -> dict:
    # SELECT project + sprints, verify user_id matches (defense in depth)
    ...
```

### B4 — Project API routes
```python
# api/projects.py

@router.post("/api/projects")
async def create_project(req: CreateProjectRequest, user_id=Depends(get_current_user)):
    project_id = save_project(user_id, req.name, req.project_md)
    return {"project_id": project_id}

@router.get("/api/projects")
async def list_projects(user_id=Depends(get_current_user)):
    return get_projects(user_id)

@router.put("/api/projects/{project_id}/sprints")
async def upsert_sprints(project_id: str, req: SprintsRequest, user_id=Depends(get_current_user)):
    save_sprints(project_id, req.sprints)
    return {"ok": True}

@router.get("/api/projects/{project_id}")
async def get_project(project_id: str, user_id=Depends(get_current_user)):
    return get_project_with_sprints(project_id, user_id)
```

---

## DB Tasks

### D1 — Run schema in Supabase SQL editor

```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  project_md text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table sprints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  sprint_number int not null,
  goal text,
  content_md text,
  sprint_data jsonb,
  created_at timestamptz default now()
);

alter table projects enable row level security;
alter table sprints enable row level security;

create policy "Users see own projects" on projects
  for all using (user_id = auth.uid()::text);

create policy "Users see own sprints" on sprints
  for all using (
    project_id in (select id from projects where user_id = auth.uid()::text)
  );
```

### D2 — Environment variables

```bash
# backend/.env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...   # service role key (not anon key)

# frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

---

## Stub / Mock Strategy

- If Clerk env vars are missing, skip route protection (dev mode banner: "Auth disabled")
- If Supabase env vars are missing, skip all save calls silently and log a warning
- "Open" on dashboard: if a project fails to load, show error toast and stay on dashboard
- Do not migrate existing in-memory context to DB automatically — user must regenerate (acceptable for sprint 3a)

---

## Definition of Done

- [ ] `localhost:3000` redirects unauthenticated users away from `/dashboard`
- [ ] User can sign up with email, verify, and land on dashboard
- [ ] User can sign in with existing account
- [ ] `UserButton` appears in nav when signed in
- [ ] Generate a project.md → "Saved ✓" toast appears
- [ ] Generate sprints → "Saved ✓" toast appears
- [ ] Navigate to `/dashboard` — the saved project appears in the list
- [ ] Refresh the page — project still in the list
- [ ] Click "Open" on a saved project — navigates to `/sprints` with all sprint cards loaded
- [ ] Sign out, sign back in — dashboard shows the project
- [ ] Open a second browser incognito, sign in as a different user — project list is empty (RLS working)

---

## Test Scenario

1. Visit `localhost:3000` — redirected to sign-in
2. Sign up as `user-a@test.com`
3. Run brainstorm → "Saved ✓" appears
4. Run sprint planner → "Saved ✓" appears
5. Navigate to `/dashboard` — project listed with correct name and sprint count
6. Refresh browser — project still there
7. Click "Open" — sprints load correctly
8. Sign out
9. Sign up as `user-b@test.com`
10. Dashboard is empty — cannot see user-a's project
