# Phase 3: Auth + Database - Research

**Researched:** 2026-04-21
**Domain:** Clerk authentication + Drizzle ORM + Neon serverless Postgres in Next.js 16 App Router
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Auth: Clerk (`@clerk/nextjs`), `<ClerkProvider>` wrapping entire app in `app/layout.tsx`
- Sign-in: `app/sign-in/[[...sign-in]]/page.tsx` using `<SignIn />` from `@clerk/nextjs`
- Sign-up: `app/sign-up/[[...sign-up]]/page.tsx` using `<SignUp />`
- `<UserButton />` in top nav for avatar + sign-out
- Middleware: `clerkMiddleware` + `createRouteMatcher` from `@clerk/nextjs/server`
- Protected routes: `/dashboard(.*)`, `/sprints(.*)`, `/skeleton(.*)`
- Matcher config: `["/((?!_next|.*\\..*).*)"]`
- DB: Neon serverless Postgres — single `DATABASE_URL` connection string
- ORM: Drizzle ORM with `@neondatabase/serverless` HTTP driver
- No Supabase. No `supabase-py`. No Supabase browser client.
- Schema location: `frontend/lib/db/schema.ts` and `frontend/lib/db/index.ts`
- Drizzle Kit config at `frontend/drizzle.config.ts`
- Migrations: `npx drizzle-kit push` (no migration files in MVP)
- Data layer: Next.js API routes only — FastAPI unchanged
- Auto-save: `POST /api/projects` after `generateProjectSpec`, `PUT /api/projects/{id}/sprints` after sprint stream
- Dashboard: `GET /api/projects`, table with name/date/count/Open, empty state

### Claude's Discretion
- Error handling beyond what's specified (toast library, error boundaries)
- Loading states on dashboard fetch
- Exact Drizzle Kit migration workflow details

### Deferred Ideas (OUT OF SCOPE)
- Skeleton save to DB — Phase 4
- Stripe tier enforcement on save — Phase 5
- Drizzle migration files (Alembic-style) — post-MVP
- RLS at DB level
- Real-time collaboration
- pgAdmin Docker Compose setup
</user_constraints>

---

## Summary

This phase wires Clerk authentication and Drizzle+Neon persistence into the existing Next.js 16.2.4 App Router frontend. The FastAPI backend is not touched — it remains AI-only.

**Critical version discovery:** The project runs **Next.js 16.2.4**, not 14 as the PROJECT.md states. In Next.js 15+ (which 16.x descends from), dynamic route `params` in route handlers is a **Promise**, not a plain object. Every dynamic route handler (`app/api/projects/[id]/route.ts`, `app/api/projects/[id]/sprints/route.ts`) must `await params` before accessing properties. This is the highest-risk pitfall in this phase.

Clerk 7.x (current: 7.2.3, published 2026-04-17) aligns well with Next.js 15/16 — `auth()` is async by design (`await auth()`). The HTTP driver pattern for Neon (`drizzle-orm/neon-http` + `@neondatabase/serverless`) is the correct choice for Next.js serverless API routes: it uses HTTP fetch, not WebSockets, eliminating connection-pool exhaustion in serverless contexts.

**Primary recommendation:** Use the `drizzle-orm/neon-http` HTTP driver (not `neon-serverless` WebSocket driver) for all Next.js API routes. Await `params` in every dynamic route handler. Await `auth()` everywhere.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auth session verification | Frontend Server (middleware) | API / Backend (route auth check) | Clerk middleware intercepts at edge; API routes double-check userId |
| Sign-in / sign-up UI | Browser / Client | — | Clerk-hosted `<SignIn />` / `<SignUp />` components are client-rendered |
| UserButton avatar | Browser / Client | — | Client component — needs session context |
| Route protection | Frontend Server (middleware.ts) | — | middleware.ts runs before page render; protects `/dashboard`, `/sprints`, `/skeleton` |
| Project CRUD persistence | API / Backend (Next.js routes) | Database / Storage (Neon) | Next.js API routes own the data layer; FastAPI not modified |
| Drizzle schema + migrations | Database / Storage | API / Backend | Schema lives in `lib/db/`; push runs from CLI |
| Auto-save trigger (BrainstormChat) | Browser / Client | API / Backend | Client code fires fetch after stream completes |
| Auto-save trigger (SprintsPage) | Browser / Client | API / Backend | Client code fires fetch after `[DONE]` SSE event |
| Dashboard data fetch | Browser / Client | API / Backend | `useEffect` fetch in client component |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@clerk/nextjs` | 7.2.3 | Auth provider, middleware, UI components | Official Clerk SDK for Next.js; async `auth()` is Next.js 15/16-compatible |
| `drizzle-orm` | 0.45.2 | Type-safe SQL ORM | Fastest migration-by-push for serverless Postgres; minimal overhead |
| `drizzle-kit` | 0.31.10 | Schema migrations / push CLI | Paired with drizzle-orm; `push` workflow suits MVP |
| `@neondatabase/serverless` | 1.1.0 | Neon HTTP driver | HTTP fetch transport — no WebSocket; compatible with Vercel/Next.js serverless |

**Version verification:** All versions confirmed against npm registry on 2026-04-21.
[VERIFIED: npm registry — `npm view <pkg> version`]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dotenv` | already present | Load `.env` vars in drizzle.config.ts | Already in package.json |
| `next/server` | (built-in) | `NextRequest`, `NextResponse` in route handlers | Already used in existing API routes |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `drizzle-orm/neon-http` | `drizzle-orm/neon-serverless` (WebSocket) | WebSocket driver needs `ws` package in Node.js; HTTP is simpler and sufficient for non-streaming queries |
| Clerk `<UserButton />` | Custom avatar dropdown | UserButton is zero-implementation; custom adds ~100 lines |

### Installation

```bash
cd frontend
npm install @clerk/nextjs drizzle-orm drizzle-kit @neondatabase/serverless
```

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (React)
    │
    │  1. Visit /dashboard, /sprints, /skeleton
    ▼
middleware.ts (clerkMiddleware)
    │  → check Clerk session cookie
    │  → unauthenticated? redirect to /sign-in
    ▼
Next.js Page / Route Handler
    │
    ├─ Server Component / API route
    │      const { userId } = await auth()
    │      if (!userId) return 401
    │
    ├─ db.select/insert/delete  ──►  Neon Postgres (HTTP)
    │      via drizzle-orm/neon-http
    │
    └─ Return JSON  ──►  Browser

Browser auto-save flow:
    generateProjectSpec completes
        │
        └─► POST /api/projects  { name, project_md }
                │
                └─► store project_id in ProjectContext
                        │
                        └─► sprint stream [DONE]
                                │
                                └─► PUT /api/projects/{id}/sprints
```

### Recommended Project Structure

```
frontend/
├── middleware.ts                         # Clerk route protection
├── drizzle.config.ts                     # Drizzle Kit config
├── lib/
│   └── db/
│       ├── index.ts                      # Drizzle client singleton
│       └── schema.ts                     # pgTable definitions
└── app/
    ├── layout.tsx                        # Add ClerkProvider here (Server Component)
    ├── sign-in/[[...sign-in]]/
    │   └── page.tsx                      # <SignIn /> component
    ├── sign-up/[[...sign-up]]/
    │   └── page.tsx                      # <SignUp /> component
    ├── dashboard/
    │   └── page.tsx                      # Project list — "use client"
    └── api/
        └── projects/
            ├── route.ts                  # GET list + POST create
            └── [id]/
                ├── route.ts              # GET project + sprints
                └── sprints/
                    └── route.ts          # PUT upsert sprints
```

### Pattern 1: Clerk Middleware (clerkMiddleware + createRouteMatcher)

**What:** Edge middleware that checks auth session before page render.
**When to use:** All pages that require login.

```typescript
// middleware.ts
// Source: https://github.com/clerk/clerk-docs/blob/main/docs/reference/nextjs/clerk-middleware.mdx
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/sprints(.*)',
  '/skeleton(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Note: CONTEXT.md specifies simpler pattern — use the one from CONTEXT.md
    '/((?!_next|.*\\..*).*)' ,
  ],
}
```

**Note:** The CONTEXT.md matcher `["/((?!_next|.*\\..*).*)"]` is slightly simpler than Clerk's default. Either works; CONTEXT.md pattern is locked. [VERIFIED: Context7 /clerk/clerk-docs]

### Pattern 2: auth() in API Route Handlers

**What:** Server-side auth check inside Next.js Route Handlers.
**When to use:** Every API route that reads or writes user data.

```typescript
// app/api/projects/route.ts
// Source: https://github.com/clerk/clerk-docs/blob/main/docs/reference/nextjs/app-router/route-handlers.mdx
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()   // MUST await — async in Clerk 6+/7+

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // db query using userId
}
```

[VERIFIED: Context7 /clerk/clerk-docs]

### Pattern 3: Neon HTTP Client Singleton

**What:** Single Drizzle client instance reused across all API route invocations.
**When to use:** Every Next.js API route that queries Neon.

```typescript
// lib/db/index.ts
// Source: https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/tutorials/drizzle-with-db/drizzle-with-neon.mdx
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle({ client: sql })
```

**Why singleton works here:** The Neon HTTP driver (`drizzle-orm/neon-http`) uses stateless HTTP fetch calls — there is no persistent connection to pool-exhaust. Module-level instantiation is safe in Next.js serverless. The WebSocket driver (`neon-serverless`) would require connection pooling management. [VERIFIED: Context7 /drizzle-team/drizzle-orm-docs]

### Pattern 4: Dynamic Route Params as Promise (Next.js 15+/16+)

**What:** In Next.js 15+, `context.params` is a `Promise`, not a plain object.
**When to use:** ALL dynamic route handlers: `app/api/projects/[id]/route.ts` and `app/api/projects/[id]/sprints/route.ts`.

```typescript
// app/api/projects/[id]/route.ts
// Source: Next.js 16.2.4 node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md
import type { NextRequest } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }  // ← Promise, not plain object
) {
  const { id } = await params  // ← MUST await

  // ... rest of handler
}
```

[VERIFIED: Next.js 16.2.4 bundled docs in `node_modules/next/dist/docs/`]

### Pattern 5: Drizzle Kit Config for Neon

```typescript
// drizzle.config.ts (at frontend/ root)
// Source: https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/tutorials/drizzle-with-db/drizzle-with-neon.mdx
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

Push workflow (no migration files generated):
```bash
cd frontend
npx drizzle-kit push
```

[VERIFIED: Context7 /drizzle-team/drizzle-orm-docs]

### Pattern 6: ClerkProvider in layout.tsx

**What:** Wrap all children with `<ClerkProvider>` so auth context is available everywhere.
**Constraint:** `layout.tsx` is a Server Component. `ClerkProvider` is safe to use in Server Components.

```typescript
// app/layout.tsx — modified version
// Source: https://github.com/clerk/clerk-docs/blob/main/docs/getting-started/quickstart.mdx
import { ClerkProvider } from '@clerk/nextjs'
import { CopilotKit } from '@copilotkit/react-core'
import { ProjectContextProvider } from '../context/ProjectContext'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#020408] font-sans antialiased">
        <ClerkProvider>
          <CopilotKit runtimeUrl="/api/copilotkit">
            <ProjectContextProvider>
              {children}
            </ProjectContextProvider>
          </CopilotKit>
        </ClerkProvider>
      </body>
    </html>
  )
}
```

**Order matters:** `ClerkProvider` must be the outermost wrapper — it must wrap `CopilotKit` and `ProjectContextProvider`. [VERIFIED: Context7 /clerk/clerk-docs]

### Pattern 7: Clerk Environment Variables

```bash
# frontend/.env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
```

[VERIFIED: Context7 /clerk/clerk-docs — sign-in/sign-up URL env vars required when using custom pages]

### Pattern 8: Drizzle Query Patterns

```typescript
// Source: https://github.com/drizzle-team/drizzle-orm-docs
import { db } from '@/lib/db'
import { projects, sprints } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

// GET list for user
const rows = await db
  .select()
  .from(projects)
  .where(eq(projects.userId, userId))
  .orderBy(desc(projects.createdAt))

// INSERT project
const [row] = await db
  .insert(projects)
  .values({ userId, name, projectMd })
  .returning({ id: projects.id })

// Ownership check before write
const [owned] = await db
  .select({ id: projects.id })
  .from(projects)
  .where(eq(projects.id, projectId) && eq(projects.userId, userId))
  .limit(1)

// DELETE + INSERT for sprints upsert
await db.delete(sprints).where(eq(sprints.projectId, projectId))
await db.insert(sprints).values(sprintRows)
```

[VERIFIED: Context7 /drizzle-team/drizzle-orm-docs]

### Anti-Patterns to Avoid

- **Synchronous `params` access in dynamic routes:** `const { id } = context.params` (without `await`) silently returns undefined in Next.js 16. Always `const { id } = await params`.
- **Synchronous `auth()` call:** `const { userId } = auth()` (without `await`) is deprecated in Clerk 6+; in Clerk 7 it may fail entirely. Always `await auth()`.
- **WebSocket Neon driver in serverless:** `drizzle-orm/neon-serverless` with WebSocket requires `neonConfig.webSocketConstructor = ws` and connection pooling management. Use HTTP driver instead.
- **`ClerkProvider` inside a `"use client"` boundary:** layout.tsx is Server Component — keep it that way. Do not add `"use client"` to layout.tsx.
- **Missing `NEXT_PUBLIC_CLERK_SIGN_IN_URL`:** Without this env var, Clerk's `auth.protect()` redirects to the Clerk Account Portal (hosted), not your custom `/sign-in` page.
- **`Link` import missing in `sprints/page.tsx`:** The existing sprints page uses `<Link>` but does not import it from `next/link`. This is a pre-existing bug — Wave 0 must add the import.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session cookies / JWT verification | Custom JWT decode + cookie logic | `auth()` from `@clerk/nextjs/server` | Clerk handles token rotation, JWKS caching, clock skew |
| Sign-in form + validation | Custom form with password handling | `<SignIn />` from `@clerk/nextjs` | OAuth, email verification, MFA, brute-force protection all built in |
| Avatar + sign-out dropdown | Custom user menu | `<UserButton />` | Handles session management, account switching, profile links |
| Route protection logic | Custom session cookie check in every page | `clerkMiddleware` in middleware.ts | Runs at edge before any page logic; single source of truth |
| Postgres connection pooling | Custom pool + lifecycle | `neon()` HTTP driver | Stateless HTTP — no pool needed; Neon handles server-side pooling |
| Schema migration files | Custom SQL migration files | `drizzle-kit push` | For MVP, push is sufficient; avoids migration file management |

**Key insight:** Clerk and Drizzle together cover every auth + persistence concern without custom infrastructure. The entire data layer is ~50 lines of code.

---

## Common Pitfalls

### Pitfall 1: params is a Promise in Next.js 15+/16+
**What goes wrong:** `const { id } = context.params` returns `undefined` silently. All DB queries that use `id` fail or query wrong data.
**Why it happens:** Breaking change introduced in Next.js 15.0.0-RC. The `params` object is now a Promise to support streaming renders.
**How to avoid:** Always type params as `Promise<{ id: string }>` and `await params` before use.
**Warning signs:** `id` is `undefined` in the handler body; DB WHERE clause filters nothing and returns all rows.
[VERIFIED: Next.js 16.2.4 bundled docs — explicit changelog entry: "v15.0.0-RC: context.params is now a promise"]

### Pitfall 2: auth() is async — forgetting await
**What goes wrong:** `const { userId } = auth()` returns a Promise object, not the auth data. `userId` is `undefined`. All auth checks pass (or fail with cryptic errors).
**Why it happens:** Clerk made `auth()` async in v6 to support Next.js 15 dynamic APIs.
**How to avoid:** Always `const { userId } = await auth()` in every route handler and server component.
**Warning signs:** `userId` is always `undefined`; all users appear unauthenticated to the API even when logged in.
[VERIFIED: Context7 /clerk/clerk-docs — "Migrate auth() to asynchronous in Route Handlers"]

### Pitfall 3: Missing NEXT_PUBLIC_CLERK_SIGN_IN_URL
**What goes wrong:** `auth.protect()` redirects unauthenticated users to `https://accounts.clerk.dev` (Clerk's hosted portal) instead of your custom `/sign-in` page.
**Why it happens:** Clerk defaults to its Account Portal when no custom sign-in URL is configured.
**How to avoid:** Add `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` to `.env.local`.
**Warning signs:** Redirect goes to `accounts.clerk.dev/sign-in` instead of `localhost:3000/sign-in`.
[VERIFIED: Context7 /clerk/clerk-docs]

### Pitfall 4: Neon WebSocket driver vs HTTP driver confusion
**What goes wrong:** Using `drizzle-orm/neon-serverless` (WebSocket) without providing `ws` package in Node.js environments. Queries hang or throw `WebSocket is not defined`.
**Why it happens:** The WebSocket driver needs a WebSocket implementation injected via `neonConfig.webSocketConstructor = ws` outside browser environments.
**How to avoid:** Use `drizzle-orm/neon-http` with `neon()` from `@neondatabase/serverless`. HTTP driver works in all environments without configuration.
**Warning signs:** `WebSocket is not defined` error; queries never resolve.
[VERIFIED: Context7 /drizzle-team/drizzle-orm-docs]

### Pitfall 5: drizzle.config.ts must load env vars explicitly
**What goes wrong:** `drizzle-kit push` cannot read `DATABASE_URL` from `.env.local` and throws "Cannot read properties of undefined".
**Why it happens:** Drizzle Kit runs as a standalone CLI — it does not use Next.js env loading. It reads `.env` by default, not `.env.local`.
**How to avoid:** Two options: (a) Copy `DATABASE_URL` to `frontend/.env` in addition to `.env.local`, or (b) add `import { config } from 'dotenv'; config({ path: '.env.local' })` at the top of `drizzle.config.ts`.
**Warning signs:** `drizzle-kit push` exits with env var error even though Next.js dev server works fine.
[VERIFIED: Context7 /drizzle-team/drizzle-orm-docs — `config({ path: '.env' })`]

### Pitfall 6: ProjectContext does not yet store project_id
**What goes wrong:** After `POST /api/projects` returns `{ project_id }`, there is nowhere to store it. The subsequent sprint-save `PUT /api/projects/{id}/sprints` cannot know the ID.
**Why it happens:** `ProjectContext.tsx` currently stores only `projectMd` and `sprints`. Adding `projectId` to context is required.
**How to avoid:** Wave 0 or Task 1 must extend `ProjectContextValue` with `projectId: string | null` and `setProjectId`.
**Warning signs:** Sprint save fails with "project_id is null" or saves to wrong project.
[VERIFIED: direct codebase read of `frontend/context/ProjectContext.tsx`]

### Pitfall 7: sprints/page.tsx has a missing Link import
**What goes wrong:** The existing `sprints/page.tsx` uses `<Link href="/">` but never imports `Link` from `next/link`. The page may compile with an error or use an undefined component.
**Why it happens:** Pre-existing bug in the codebase.
**How to avoid:** Wave 0 must add `import Link from 'next/link'` to `app/sprints/page.tsx`.
**Warning signs:** TypeScript error "Link is not defined" or runtime "Link is undefined".
[VERIFIED: direct codebase read of `frontend/app/sprints/page.tsx` line 132]

---

## Code Examples

### Drizzle Schema (exact as specified in CONTEXT.md)

```typescript
// lib/db/schema.ts
// Matches CONTEXT.md locked decision verbatim
import { pgTable, uuid, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core'

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  projectMd: text('project_md'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const sprints = pgTable('sprints', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  sprintNumber: integer('sprint_number').notNull(),
  goal: text('goal'),
  contentMd: text('content_md'),
  sprintData: jsonb('sprint_data'),
  createdAt: timestamp('created_at').defaultNow(),
})
```

[VERIFIED: matches CONTEXT.md locked schema + drizzle-orm/pg-core import syntax from Context7]

### POST /api/projects — Full Route Handler

```typescript
// app/api/projects/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.createdAt))

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, project_md } = await req.json()
  const [row] = await db
    .insert(projects)
    .values({ userId, name, projectMd: project_md })
    .returning({ id: projects.id })

  return NextResponse.json({ project_id: row.id }, { status: 201 })
}
```

### PUT /api/projects/[id]/sprints — With Awaited params

```typescript
// app/api/projects/[id]/sprints/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { projects, sprints } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }   // Promise in Next.js 16
) {
  const { id: projectId } = await params             // await required

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Ownership check
  const [owned] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1)

  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { sprints: sprintData } = await req.json()

  // DELETE + INSERT (simpler than upsert for MVP)
  await db.delete(sprints).where(eq(sprints.projectId, projectId))
  if (sprintData.length > 0) {
    await db.insert(sprints).values(
      sprintData.map((s: { number: number; goal: string; content_md?: string; sprint_data?: unknown }, i: number) => ({
        projectId,
        sprintNumber: s.number ?? i + 1,
        goal: s.goal,
        contentMd: s.content_md ?? null,
        sprintData: s.sprint_data ?? null,
      }))
    )
  }

  return NextResponse.json({ ok: true })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sync `auth()` in Clerk | Async `await auth()` | Clerk v6 (2024) | All route handlers must await |
| `params` as plain object | `params` as Promise | Next.js 15.0.0-RC | All dynamic route handlers must await params |
| `drizzle-kit generate` + `migrate` | `drizzle-kit push` for dev | Drizzle Kit 0.20+ | No migration files needed for MVP |
| Supabase (original plan) | Drizzle + Neon | Phase 3 architectural decision | No Supabase client anywhere — Drizzle is the only data access layer |

**Deprecated/outdated (from sprint-3a.md):**
- Supabase client (`@supabase/supabase-js`): replaced by Drizzle + Neon — do not install or reference.
- FastAPI CRUD routes (`backend/api/projects.py`, `backend/api/sprints_save.py`): not created — data layer is in Next.js API routes.
- Backend auth middleware (`backend/middleware/auth.py`): not created.
- `auth().protect()` (synchronous call in Clerk 5): updated to `await auth.protect()` in Clerk 7.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ClerkProvider` as outermost wrapper in layout.tsx (outside CopilotKit) is the correct order | Pattern 6 | CopilotKit may need Clerk context, or vice versa — if auth breaks, swap order |
| A2 | `database.userId` as `text` (Clerk user ID format) — Clerk user IDs are strings like `user_xxx` | Schema | If Clerk changes ID format, no migration impact since column is `text` |
| A3 | `drizzle-kit push` reads `.env` not `.env.local` by default | Pitfall 5 | If wrong, the dotenv workaround still works |

---

## Open Questions

1. **Should BrainstormChat save use project name derived from project_md, or a placeholder?**
   - What we know: `POST /api/projects` requires `{ name, project_md }`. The brainstorm produces `project_md` but no explicit `name` field.
   - What's unclear: Where does `name` come from? Extract first H1 from `project_md`? Use a timestamp?
   - Recommendation: Parse first `# ` heading from `project_md` as name; fallback to `"Project ${new Date().toLocaleDateString()}"`.

2. **Dashboard page: client component or server component?**
   - What we know: CONTEXT.md says "Fetch `GET /api/projects` on mount". "On mount" implies `useEffect` → client component.
   - What's unclear: Could also use a server component with `async/await` and avoid useEffect complexity.
   - Recommendation: Server component pattern is cleaner (`async function DashboardPage()` + `await fetch` or direct `db` call). Claude's discretion — planner should decide.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | ✓ | v22.22.0 | — |
| npm | Package install | ✓ | 10.9.4 | — |
| Neon account + DATABASE_URL | Drizzle queries | Not verified | — | Phase cannot execute without real Neon project |
| Clerk account + API keys | Auth | Not verified | — | Stub mode (dev banner) per CONTEXT.md |

**Missing dependencies with no fallback:**
- Neon project URL (`DATABASE_URL`): user must create a Neon project and obtain the connection string before `drizzle-kit push` or any DB queries can run.
- Clerk publishable + secret keys: user must create a Clerk application.

**Missing dependencies with fallback:**
- If Clerk env vars missing: skip route protection, show "Auth disabled" banner (per CONTEXT.md stub strategy).
- If DATABASE_URL missing: skip all save calls silently, log console warning (per CONTEXT.md stub strategy).

---

## Validation Architecture

> `workflow.nyquist_validation` is absent from `.planning/config.json` (only `_auto_chain_active` present) — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected (no jest.config, no vitest.config, no pytest.ini in frontend/) |
| Config file | Wave 0 must create none — this phase uses manual smoke tests per Definition of Done |
| Quick run command | `npm run build` (TypeScript compile check) |
| Full suite command | Manual test scenario in sprint-3a.md Definition of Done |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Unauthenticated redirect from /dashboard | manual-only | visit http://localhost:3000/dashboard while signed out | ❌ Wave 0 |
| AUTH-02 | Sign up + sign in flow | manual-only | Clerk UI flow in browser | ❌ Wave 0 |
| AUTH-03 | UserButton appears when signed in | manual-only | visual check in browser | ❌ Wave 0 |
| SAVE-01 | project.md auto-save after brainstorm | manual-only | generate spec → check "Saved ✓" | ❌ Wave 0 |
| SAVE-02 | sprints auto-save after generation | manual-only | generate sprints → check "Saved ✓" | ❌ Wave 0 |
| DB-01 | Dashboard shows saved project after refresh | manual-only | navigate → refresh → check list | ❌ Wave 0 |
| DB-02 | Open project loads sprints into context | manual-only | click Open → verify sprint cards | ❌ Wave 0 |
| DB-03 | User isolation — different user sees empty dashboard | manual-only | two-user test per sprint-3a.md | ❌ Wave 0 |
| TS-01 | TypeScript compiles without errors | automated | `cd frontend && npm run build` | ✓ existing |

### Wave 0 Gaps

- No automated tests exist for auth/DB behaviors — all validation is manual per Definition of Done checklist.
- [ ] Fix pre-existing bug: add `import Link from 'next/link'` to `frontend/app/sprints/page.tsx`
- [ ] TypeScript check: `cd frontend && npm run build` — must pass after each task

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Clerk (all auth logic — no hand-rolled auth) |
| V3 Session Management | yes | Clerk session cookies (managed by ClerkProvider + middleware) |
| V4 Access Control | yes | `userId` ownership check before every DB read/write |
| V5 Input Validation | yes | Validate request body in route handlers; reject missing fields with 400 |
| V6 Cryptography | no | Clerk handles all token signing; no crypto hand-rolled |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized project access | Elevation of privilege | Ownership check: `WHERE id = ? AND user_id = ?` before every write and read |
| Missing auth check on API route | Spoofing | `await auth()` + early return 401 in every route handler |
| SQL injection via userId | Tampering | Drizzle parameterized queries — no raw SQL string interpolation |
| Stale session token | Repudiation | Clerk handles token refresh automatically |
| Insecure DATABASE_URL exposure | Information disclosure | `DATABASE_URL` is server-only (no `NEXT_PUBLIC_` prefix); never passed to client |

---

## Sources

### Primary (HIGH confidence)
- Context7 `/clerk/clerk-docs` — middleware patterns, auth(), ClerkProvider, environment variables, UserButton
- Context7 `/drizzle-team/drizzle-orm-docs` — Neon HTTP client, drizzle.config.ts, push workflow, query patterns
- Next.js 16.2.4 bundled docs (`node_modules/next/dist/docs/`) — params as Promise, route handler API, cookies

### Secondary (MEDIUM confidence)
- npm registry — package versions verified (`npm view <pkg> version`) on 2026-04-21
- Direct codebase read — existing route pattern from `frontend/app/api/brainstorm/route.ts`, existing context from `frontend/context/ProjectContext.tsx`, pre-existing bug in `frontend/app/sprints/page.tsx`

### Tertiary (LOW confidence)
- None — all critical claims are HIGH or MEDIUM confidence.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry
- Architecture: HIGH — verified against Context7 Clerk + Drizzle docs and Next.js 16 bundled docs
- Pitfalls: HIGH — params-as-Promise from official Next.js 16 bundled changelog; Link bug from direct codebase read

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable libraries; Clerk 7.x is very active — check for minor updates before executing)
