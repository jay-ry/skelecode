# Phase 3: Auth + Database - Pattern Map

**Mapped:** 2026-04-21
**Files analyzed:** 14 new/modified files
**Analogs found:** 11 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/middleware.ts` | middleware | request-response | none (new pattern) | no analog |
| `frontend/drizzle.config.ts` | config | — | none (new pattern) | no analog |
| `frontend/lib/db/schema.ts` | model | — | `frontend/lib/types.ts` | partial (same lib folder, type-definition role) |
| `frontend/lib/db/index.ts` | utility | — | `frontend/lib/types.ts` | partial (same lib folder) |
| `frontend/app/layout.tsx` | provider | request-response | `frontend/app/layout.tsx` (self — modify) | exact (modify existing) |
| `frontend/app/sign-in/[[...sign-in]]/page.tsx` | component | request-response | `frontend/app/sprints/page.tsx` | role-match (client page) |
| `frontend/app/sign-up/[[...sign-up]]/page.tsx` | component | request-response | `frontend/app/sprints/page.tsx` | role-match (client page) |
| `frontend/app/dashboard/page.tsx` | component | CRUD | `frontend/app/sprints/page.tsx` | role-match (client page with fetch + state) |
| `frontend/app/api/projects/route.ts` | route | CRUD | `frontend/app/api/brainstorm/route.ts` | role-match (Next.js API route) |
| `frontend/app/api/projects/[id]/route.ts` | route | CRUD | `frontend/app/api/brainstorm/route.ts` | role-match (dynamic API route) |
| `frontend/app/api/projects/[id]/sprints/route.ts` | route | CRUD | `frontend/app/api/brainstorm/route.ts` | role-match (dynamic API route) |
| `frontend/context/ProjectContext.tsx` | provider | event-driven | `frontend/context/ProjectContext.tsx` (self — modify) | exact (modify existing) |
| `frontend/components/BrainstormChat.tsx` | component | event-driven | `frontend/components/BrainstormChat.tsx` (self — modify) | exact (modify existing) |
| `frontend/app/sprints/page.tsx` | component | streaming | `frontend/app/sprints/page.tsx` (self — modify) | exact (modify existing) |

---

## Pattern Assignments

### `frontend/middleware.ts` (middleware, request-response)

**Analog:** None — no middleware.ts exists yet. Use RESEARCH.md Pattern 1 verbatim.

**Core pattern** (from RESEARCH.md lines 179-201):
```typescript
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
  matcher: ['/((?!_next|.*\\..*).*)',],
}
```

**Critical note:** `auth.protect()` must be awaited (Clerk 7). Without `NEXT_PUBLIC_CLERK_SIGN_IN_URL` set in `.env.local`, `auth.protect()` redirects to Clerk Account Portal instead of `/sign-in`.

---

### `frontend/drizzle.config.ts` (config)

**Analog:** None — no drizzle.config.ts exists. Use RESEARCH.md Pattern 5.

**Core pattern** (from RESEARCH.md lines 272-290):
```typescript
import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: '.env.local' })   // Pitfall 5: drizzle-kit CLI does not auto-load .env.local

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

**Note:** The `dotenv` import with `config({ path: '.env.local' })` is mandatory — `drizzle-kit push` runs as standalone CLI and does not use Next.js env loading.

---

### `frontend/lib/db/schema.ts` (model)

**Analog:** `frontend/lib/types.ts` (lines 1-4) — same lib directory, type-definition role.

**Imports pattern from analog** (`frontend/lib/types.ts` lines 1-4):
```typescript
// Analog is a plain export of TypeScript interfaces.
// schema.ts uses drizzle-orm/pg-core table builders instead — different pattern.
```

**Core pattern** (from CONTEXT.md locked schema — use verbatim):
```typescript
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

---

### `frontend/lib/db/index.ts` (utility — DB client singleton)

**Analog:** `frontend/lib/types.ts` — same lib directory, export-only module role.

**Core pattern** (from RESEARCH.md Pattern 3, lines 235-243):
```typescript
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle({ client: sql })
```

**Critical:** Use `drizzle-orm/neon-http` (HTTP fetch driver), NOT `drizzle-orm/neon-serverless` (WebSocket driver). The HTTP driver is stateless — safe for serverless Next.js without connection pool management.

---

### `frontend/app/layout.tsx` (provider — modify existing)

**Analog:** `frontend/app/layout.tsx` itself (lines 1-28) — modification of existing file.

**Current imports pattern** (`frontend/app/layout.tsx` lines 1-6):
```typescript
import type { Metadata } from "next";
import { CopilotKit } from "@copilotkit/react-core";
import { ProjectContextProvider } from "../context/ProjectContext";
import "@copilotkit/react-ui/styles.css";
import "./globals.css";
```

**Current provider wrapping** (lines 12-28):
```typescript
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#020408] font-sans antialiased">
        <CopilotKit runtimeUrl="/api/copilotkit">
          <ProjectContextProvider>
            {children}
          </ProjectContextProvider>
        </CopilotKit>
      </body>
    </html>
  )
}
```

**Target pattern** (ClerkProvider wraps everything — add import + outermost wrapper):
```typescript
import { ClerkProvider } from '@clerk/nextjs'
// ... existing imports ...

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="bg-[#020408] font-sans antialiased">
          <CopilotKit runtimeUrl="/api/copilotkit">
            <ProjectContextProvider>
              {children}
            </ProjectContextProvider>
          </CopilotKit>
        </body>
      </html>
    </ClerkProvider>
  )
}
```

**Critical:** `ClerkProvider` wraps `<html>` — it is outermost. Do NOT add `"use client"` to layout.tsx. It stays a Server Component.

---

### `frontend/app/sign-in/[[...sign-in]]/page.tsx` (component, request-response)

**Analog:** `frontend/app/sprints/page.tsx` — client page component structure.

**Page structure pattern from analog** (`frontend/app/sprints/page.tsx` lines 1-3):
```typescript
"use client";
import { useState } from "react";
// ... other imports
```

**Core pattern** (Clerk catch-all sign-in page — minimal, no state needed):
```typescript
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020408]">
      <SignIn />
    </div>
  )
}
```

**Note:** This page does NOT need `"use client"` — `<SignIn />` is a Clerk component that handles its own client boundary internally. It is a Server Component page that renders a Clerk-hosted component.

---

### `frontend/app/sign-up/[[...sign-up]]/page.tsx` (component, request-response)

**Analog:** Same as sign-in — `frontend/app/sprints/page.tsx` page structure.

**Core pattern** (mirrors sign-in page exactly with `<SignUp />`):
```typescript
import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020408]">
      <SignUp />
    </div>
  )
}
```

---

### `frontend/app/dashboard/page.tsx` (component, CRUD)

**Analog:** `frontend/app/sprints/page.tsx` — client page with fetch, state, conditional render, and Header.

**Client directive + imports pattern from analog** (`frontend/app/sprints/page.tsx` lines 1-6):
```typescript
"use client";
import { useState } from "react";
import JSZip from "jszip";
import { Header } from "../../components/Header";
import { useProjectContext, type Sprint } from "../../context/ProjectContext";
import { SprintList } from "../../components/SprintList";
```

**State pattern from analog** (`frontend/app/sprints/page.tsx` lines 26-29):
```typescript
const [isGenerating, setIsGenerating] = useState<boolean>(false);
const [isDone, setIsDone] = useState<boolean>(false);
const [errorMsg, setErrorMsg] = useState<string | null>(null);
```

**Fetch-on-mount pattern** (no exact analog — use useEffect):
```typescript
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "../../components/Header";
import { useProjectContext } from "../../context/ProjectContext";

interface ProjectRow {
  id: string;
  name: string;
  createdAt: string;
  sprintCount?: number;
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { setProjectMd, setSprints, setProjectId } = useProjectContext();

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load projects');
        return r.json();
      })
      .then(setProjects)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Empty state, loading state, table render, Open handler, New Project handler
}
```

**Error display pattern from analog** (`frontend/app/sprints/page.tsx` lines 156-168):
```typescript
{errorMsg && (
  <div className="flex flex-col items-center gap-2 py-4">
    <p className="text-sm text-[#ff003c]">
      Sprint generation failed. Check your connection and try again.
    </p>
  </div>
)}
```

**Tailwind class conventions** (from Header.tsx and sprints/page.tsx):
- Background: `bg-[#020408]`
- Text primary: `text-[#c8f0ea]`
- Text accent: `text-[#00ffe0]`
- Error: `text-[#ff003c]`
- Muted text: `text-[#7abfb8]`
- Button: `text-sm px-3 py-1 border border-[rgba(0,255,224,0.15)] rounded text-[#c8f0ea] hover:bg-[#050d14] hover:border-[#00ffe0] transition-colors`

---

### `frontend/app/api/projects/route.ts` (route, CRUD)

**Analog:** `frontend/app/api/brainstorm/route.ts` (lines 1-33) — Next.js API route handler.

**Existing route structure** (`frontend/app/api/brainstorm/route.ts` lines 1-5):
```typescript
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
```

**Target pattern** — extends analog with Clerk auth + Drizzle:
```typescript
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'  // same as analog

export async function GET() {
  const { userId } = await auth()       // MUST await (Clerk 7)
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

**Error handling pattern from analog** (`frontend/app/api/brainstorm/route.ts` lines 17-21):
```typescript
if (!upstream.ok || !upstream.body) {
  return new Response(JSON.stringify({ error: "Backend error" }), {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
```

---

### `frontend/app/api/projects/[id]/route.ts` (route, CRUD — dynamic)

**Analog:** `frontend/app/api/brainstorm/route.ts` — closest existing route; no dynamic route analog exists yet.

**Dynamic params pattern** (Next.js 16 — params is a Promise, RESEARCH.md Pattern 4, lines 257-264):
```typescript
import type { NextRequest } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }  // Promise in Next.js 15+/16+
) {
  const { id: projectId } = await params  // MUST await — never access params synchronously
```

**Full handler pattern** (ownership check before returning data):
```typescript
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { projects, sprints } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1)

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sprintRows = await db
    .select()
    .from(sprints)
    .where(eq(sprints.projectId, projectId))
    .orderBy(asc(sprints.sprintNumber))

  return NextResponse.json({ ...project, sprints: sprintRows })
}
```

---

### `frontend/app/api/projects/[id]/sprints/route.ts` (route, CRUD — dynamic)

**Analog:** `frontend/app/api/brainstorm/route.ts` — same Next.js API route structure.

**Full PUT handler pattern** (RESEARCH.md Code Examples, lines 527-569):
```typescript
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { projects, sprints } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }   // Promise — Next.js 16
) {
  const { id: projectId } = await params             // await required

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [owned] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1)

  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { sprints: sprintData } = await req.json()

  // DELETE + INSERT — simpler than UPSERT for MVP (CONTEXT.md specifics)
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

### `frontend/context/ProjectContext.tsx` (provider — modify existing)

**Analog:** `frontend/context/ProjectContext.tsx` itself — modification of existing file.

**Current interface and state** (`frontend/context/ProjectContext.tsx` lines 1-39):
```typescript
"use client";
import { createContext, useContext, useState } from "react";

export interface ProjectContextValue {
  projectMd: string;
  setProjectMd: (md: string) => void;
  sprints: Sprint[];
  setSprints: React.Dispatch<React.SetStateAction<Sprint[]>>;
}
```

**Target additions** — extend `ProjectContextValue` with `projectId`:
```typescript
export interface ProjectContextValue {
  projectMd: string;
  setProjectMd: (md: string) => void;
  sprints: Sprint[];
  setSprints: React.Dispatch<React.SetStateAction<Sprint[]>>;
  projectId: string | null;            // add
  setProjectId: (id: string | null) => void;  // add
}
```

**Provider state extension** (mirrors existing `useState` pattern, lines 22-31):
```typescript
export function ProjectContextProvider({ children }: { children: React.ReactNode }) {
  const [projectMd, setProjectMd] = useState<string>("");
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);  // add

  return (
    <ProjectContext.Provider value={{ projectMd, setProjectMd, sprints, setSprints, projectId, setProjectId }}>
      {children}
    </ProjectContext.Provider>
  );
}
```

---

### `frontend/components/BrainstormChat.tsx` (component — modify existing)

**Analog:** `frontend/components/BrainstormChat.tsx` itself — modification of existing file.

**Current handler completion point** (`frontend/components/BrainstormChat.tsx` lines 73-77):
```typescript
if (payload === "[DONE]") {
  onStreamingChange(false);
  return "Spec generated successfully. Check the preview panel on the right.";
}
```

**Target: add auto-save fetch before returning** — insert after `onStreamingChange(false)`:
```typescript
if (payload === "[DONE]") {
  onStreamingChange(false);
  // Auto-save: POST /api/projects after spec generation
  try {
    const name = extractProjectName(currentMd) // parse first # heading
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, project_md: currentMd }),
    })
    if (res.ok) {
      const { project_id } = await res.json()
      onProjectSaved(project_id)  // new prop — calls setProjectId in context
    }
  } catch {
    // Silently fail if DB unavailable (CONTEXT.md stub safety)
    console.warn('[BrainstormChat] Auto-save failed — DATABASE_URL may be missing')
  }
  return "Spec generated successfully. Check the preview panel on the right.";
}
```

**Helper to extract project name** (extract from project_md H1):
```typescript
function extractProjectName(md: string): string {
  const match = md.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : `Project ${new Date().toLocaleDateString()}`
}
```

---

### `frontend/app/sprints/page.tsx` (component — modify existing)

**Analog:** `frontend/app/sprints/page.tsx` itself — modification of existing file.

**Pre-existing bug to fix first** (lines 130-136):
```typescript
// MISSING: import Link from 'next/link'
// Line 132 uses <Link href="/"> without importing it
// Wave 0 must add: import Link from 'next/link'
```

**Current [DONE] handler** (`frontend/app/sprints/page.tsx` lines 68-73):
```typescript
if (payload === "[DONE]") {
  setIsGenerating(false);
  setIsDone(true);
  return;
}
```

**Target: add auto-save after `[DONE]`** — insert before `return`:
```typescript
if (payload === "[DONE]") {
  setIsGenerating(false);
  setIsDone(true);
  // Auto-save sprints to DB
  if (projectId) {
    fetch(`/api/projects/${projectId}/sprints`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprints: currentSprints }),  // snapshot at [DONE]
    }).catch(() => {
      console.warn('[SprintsPage] Sprint auto-save failed')
    })
  }
  return;
}
```

---

## Shared Patterns

### Auth Check (apply to all API routes)

**Source:** RESEARCH.md Pattern 2 (lines 213-226)
**Apply to:** `app/api/projects/route.ts`, `app/api/projects/[id]/route.ts`, `app/api/projects/[id]/sprints/route.ts`

```typescript
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// At the top of EVERY handler function body:
const { userId } = await auth()   // MUST await — Clerk 7 is async
if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

### Dynamic Params as Promise (apply to all dynamic routes)

**Source:** RESEARCH.md Pattern 4 (lines 248-264)
**Apply to:** `app/api/projects/[id]/route.ts`, `app/api/projects/[id]/sprints/route.ts`

```typescript
// EVERY dynamic route handler signature — Next.js 16
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }  // Promise, not plain object
) {
  const { id } = await params  // always await before use
```

### Ownership Check Before DB Write (apply to all routes with projectId)

**Source:** RESEARCH.md Pattern 8 + CONTEXT.md Specifics
**Apply to:** `app/api/projects/[id]/route.ts`, `app/api/projects/[id]/sprints/route.ts`

```typescript
import { and, eq } from 'drizzle-orm'

const [owned] = await db
  .select({ id: projects.id })
  .from(projects)
  .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
  .limit(1)

if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })
```

### `force-dynamic` Export (apply to all API routes)

**Source:** `frontend/app/api/brainstorm/route.ts` line 3
**Apply to:** All new `app/api/projects/` route files

```typescript
export const dynamic = 'force-dynamic'
```

### Tailwind Design System (apply to all new UI components)

**Source:** `frontend/components/Header.tsx` lines 18-19, `frontend/app/sprints/page.tsx`
**Apply to:** `app/dashboard/page.tsx`, `app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx`

```typescript
const btnClass =
  "text-sm px-3 py-1 border border-[rgba(0,255,224,0.15)] rounded text-[#c8f0ea] hover:bg-[#050d14] hover:border-[#00ffe0] transition-colors";

// Color tokens:
// bg-[#020408]           — page background
// text-[#c8f0ea]         — primary text
// text-[#00ffe0]         — accent / links
// text-[#7abfb8]         — muted/secondary text
// text-[#ff003c]         — error text
// border-[rgba(0,255,224,0.15)] — subtle borders
```

### Stub/Dev Safety Pattern (apply to auto-save calls)

**Source:** CONTEXT.md Stub/Dev Safety section
**Apply to:** All client-side fetch calls to `/api/projects`

```typescript
// If DATABASE_URL missing, API routes will throw — catch silently on client
try {
  const res = await fetch('/api/projects', { ... })
  if (res.ok) { /* handle success */ }
} catch {
  console.warn('[Component] Auto-save skipped — server unavailable')
}
```

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns verbatim):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `frontend/middleware.ts` | middleware | request-response | No middleware.ts exists; no edge middleware pattern in codebase |
| `frontend/drizzle.config.ts` | config | — | No ORM config files exist; no Drizzle usage anywhere yet |

---

## Key Implementation Notes for Planner

1. **Wave 0 pre-requisite:** Fix the pre-existing `Link` import bug in `frontend/app/sprints/page.tsx` (line 4 — add `import Link from 'next/link'`) before any other changes. This bug will cause TypeScript compile failure once other files import from sprints page.

2. **ProjectContext must be extended first:** `frontend/context/ProjectContext.tsx` must add `projectId` / `setProjectId` before `BrainstormChat.tsx` or `sprints/page.tsx` can use them.

3. **Params always a Promise:** Next.js 16.2.4 (this project's version) requires `await params` in ALL dynamic route handlers. Accessing `params.id` synchronously returns `undefined` silently — DB queries will fail with no obvious error.

4. **auth() always async:** `const { userId } = auth()` (without await) returns a Promise object in Clerk 7. `userId` will always be `undefined`. Every route handler must `await auth()`.

5. **drizzle-kit push reads .env not .env.local:** Add `import { config } from 'dotenv'; config({ path: '.env.local' })` to `drizzle.config.ts`.

6. **ClerkProvider placement:** Must be outermost wrapper in `layout.tsx` — it wraps `<html>`, not just `<body>`. Do not add `"use client"` to layout.tsx.

---

## Metadata

**Analog search scope:** `frontend/app/`, `frontend/context/`, `frontend/components/`, `frontend/lib/`
**Files scanned:** 9 existing files read
**Pattern extraction date:** 2026-04-21
