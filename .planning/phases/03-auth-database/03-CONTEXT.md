# Phase 3: Auth + Database - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Source:** PRD Express Path (plan/sprint-3a.md) + architectural decisions

<domain>
## Phase Boundary

Users can sign up, log in, and have their projects and sprints saved automatically. A `/dashboard` shows all their past projects. Refreshing the page no longer loses data.

**Architecture:** Clerk handles auth in Next.js. Drizzle ORM + Neon (serverless Postgres) handle persistence via Next.js API routes. FastAPI is NOT modified — it stays AI-only.

Do not touch the LangGraph agents, FastAPI backend, or CopilotKit components.

</domain>

<decisions>
## Implementation Decisions

### Auth Provider
- Clerk for auth — `@clerk/nextjs` with `<ClerkProvider>` wrapping the entire app in `app/layout.tsx`
- Sign-in page: `app/sign-in/[[...sign-in]]/page.tsx` using `<SignIn />` from `@clerk/nextjs`
- Sign-up page: `app/sign-up/[[...sign-up]]/page.tsx` using `<SignUp />`
- `<UserButton />` in top nav for avatar + sign-out

### Route Protection
- `middleware.ts` using `clerkMiddleware` + `createRouteMatcher` from `@clerk/nextjs/server`
- Protected routes: `/dashboard(.*)`, `/sprints(.*)`, `/skeleton(.*)`
- Matcher config: `["/((?!_next|.*\\..*).*)"]`

### Database
- **Neon** serverless Postgres — single `DATABASE_URL` connection string
- **Drizzle ORM** in Next.js for schema definition, queries, and migrations
- No Supabase. No `supabase-py`. No Supabase browser client.
- pgAdmin optional — connects directly to Neon for admin/inspection

### Drizzle Setup
- `frontend/lib/db/schema.ts` — Drizzle schema: `projects` + `sprints` tables
- `frontend/lib/db/index.ts` — Drizzle client using `@neondatabase/serverless` HTTP driver
- `frontend/drizzle.config.ts` — Drizzle Kit config pointing to `DATABASE_URL`
- Migrations: `npx drizzle-kit generate` → `npx drizzle-kit push` (push to Neon)

### Schema
```typescript
// lib/db/schema.ts
import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core"

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  projectMd: text("project_md"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const sprints = pgTable("sprints", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  sprintNumber: integer("sprint_number").notNull(),
  goal: text("goal"),
  contentMd: text("content_md"),
  sprintData: jsonb("sprint_data"),
  createdAt: timestamp("created_at").defaultNow(),
})
```

### Next.js API Routes (data layer — replaces FastAPI CRUD)
- `app/api/projects/route.ts` — `GET` list + `POST` create
  - Auth: `const { userId } = auth()` from `@clerk/nextjs/server`; return 401 if not signed in
  - GET: `db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt))`
  - POST body: `{ name, project_md }`; INSERT, return `{ project_id }`
- `app/api/projects/[id]/sprints/route.ts` — `PUT` upsert sprints
  - DELETE existing for `project_id`, then INSERT all new (simpler than merge)
  - Verify project ownership before write: `SELECT id FROM projects WHERE id = ? AND user_id = ?`
- `app/api/projects/[id]/route.ts` — `GET` project with sprints
  - Verify ownership, return project + ordered sprints

### Auto-Save Behavior
- In `BrainstormChat.tsx`: after `generateProjectSpec` completes → `POST /api/projects` → store `project_id` in context
- In the sprints page (wherever sprint stream completes): `PUT /api/projects/{id}/sprints`
- `SaveStatus` component near each generate button: "Saving..." → "Saved ✓"

### Dashboard Page (`/dashboard`)
- Fetch `GET /api/projects` on mount
- Table/list: project name, date, sprint count, "Open" button
- "Open" → navigates to `/sprints?project={id}` + loads project data from DB into context
- "New Project" button: clears context, navigates to `/`
- Empty state: "No projects yet — start a brainstorm to create your first one"

### Nav Updates
- Add "Dashboard" link — visible only when signed in
- `<UserButton />` on right side of nav

### Environment Variables
```bash
# frontend/.env.local
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### Stub/Dev Safety
- If Clerk env vars missing: skip route protection, show "Auth disabled" dev banner
- If `DATABASE_URL` missing: skip all save calls silently, log a warning to console
- "Open" on dashboard: if project fails to load → error toast, stay on dashboard
- Existing in-memory context is NOT migrated — user must regenerate (acceptable for MVP)

### Claude's Discretion
- Error handling beyond what's specified (toast library, error boundaries)
- Loading states on dashboard fetch
- Exact Drizzle Kit migration workflow details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Sprint Specification
- `plan/sprint-3a.md` — Original Sprint 3a spec (auth + DB UX, save/load flows, definition of done). Note: DB layer decisions override this spec — use Drizzle + Neon + Next.js API routes instead of Supabase + FastAPI routes.

### Existing Patterns to Follow
- `frontend/app/api/brainstorm/route.ts` — Next.js API route pattern (already exists, establishes file structure)
- `frontend/app/api/sprint-planner/route.ts` — Second API route (confirms pattern)
- `frontend/app/page.tsx` — BrainstormChat location (auto-save hook goes here after spec generation)
- `frontend/app/sprints/page.tsx` — Sprint page (auto-save hook goes here after sprints stream)
- `frontend/components/BrainstormChat.tsx` — Must add save call after generateProjectSpec completes
- `frontend/app/layout.tsx` — Add ClerkProvider + UserButton here
- `frontend/context/ProjectContext.tsx` — Project context (store project_id here after save)

### Project Context
- `.planning/PROJECT.md` — Tech stack constraints

</canonical_refs>

<specifics>
## Specific Ideas

- Drizzle `@neondatabase/serverless` HTTP driver — best for Vercel/Next.js edge-compatible deployments
- `middleware.ts` exact implementation from sprint-3a.md F2 — use verbatim (Clerk part unchanged)
- Project ownership verification: always check `user_id` matches before any write (defense in depth even without RLS)
- `save_sprints` does DELETE + INSERT (not UPSERT) — simpler for MVP
- `app/api/projects/[id]/route.ts` must verify ownership before returning data
- Drizzle Kit: `push` workflow for dev (no migration files needed until prod hardening)

</specifics>

<deferred>
## Deferred Ideas

- Skeleton save to DB — sprint-3b / Phase 4
- Stripe tier enforcement on save — Phase 5
- Drizzle migration files (Alembic-style) — post-MVP when schema stabilizes
- RLS at DB level — unnecessary since auth is enforced at API route layer
- Real-time collaboration — explicitly out of scope
- pgAdmin Docker Compose setup — optional, user can connect any Postgres client to Neon

</deferred>

---

*Phase: 03-auth-database*
*Context gathered: 2026-04-21 via PRD Express Path (plan/sprint-3a.md) + architectural decisions*
