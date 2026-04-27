# Phase 4: Skeleton Generator - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Source:** PRD Express Path (plan/sprint-3b.md) + architectural adaptation notes

<domain>
## Phase Boundary

A user navigates to `/skeleton`, clicks "Generate Skeleton", and receives two outputs:
1. An ASCII folder/file tree for their chosen tech stack — streams line by line
2. An HTML wireframe of Sprint 1 UI — renders in a sandboxed iframe

Both outputs are downloadable as a zip. After generation, the skeleton saves to the Neon DB so it persists across sessions.

**Architecture:** Backend LangGraph agent (FastAPI/Groq) handles AI generation. Next.js API routes handle DB persistence (same pattern as Phase 3). FastAPI is AI-only — no auth, no DB writes.

Do not touch existing agents (brainstorm, sprint_planner), CopilotKit components, or Clerk auth.

</domain>

<decisions>
## Implementation Decisions

### Backend: SkeletonState
- `backend/models/skeleton_state.py` — `SkeletonState` TypedDict:
  - `project_md: str`
  - `sprints: List[dict]`
  - `tech_stack: dict` — `{frontend: str, backend: str, db: str | None}`
  - `file_list: List[str]` — flat list e.g. `["frontend/app/layout.tsx", ...]`
  - `folder_tree: str` — formatted ASCII tree string
  - `wireframe_html: str` — complete HTML string
  - `status: str` — `resolving | building_tree | building_wireframe | done`

### Backend: LangGraph Skeleton Graph
- `backend/agents/skeleton.py` — 3-node linear graph:
  - `stack_resolver`: reads `project_md` + `sprints`, extracts `tech_stack` dict
  - `tree_builder`: uses `tech_stack` to generate `file_list`, passes to `tree_formatter` utility → `folder_tree` string
  - `wireframe_builder`: reads `sprints[0]` (Sprint 1 only), generates single-file HTML wireframe (inline CSS, no CDN, Sprint 1 screens only, `<!-- Sprint 1: [task name] -->` annotations)
- Edges: `stack_resolver → tree_builder → wireframe_builder → END` (no conditional edges)
- LLM: `ChatGroq(model="llama-3.3-70b-versatile")` — consistent with existing agents
- Load `.env` via `load_dotenv` at module top (before langchain imports)
- Compile graph once at module import

### Backend: Tree Formatter Utility
- `backend/utils/tree_formatter.py` — pure Python, no LLM call:
  - `format_tree(file_list: list[str]) -> str`
  - Input: `["frontend/app/layout.tsx", "backend/main.py"]`
  - Output: ASCII tree with `├──`, `│`, `└──` characters
- Stack-specific file rules for `tree_builder`:
  - Next.js: `app/`, `components/`, `lib/`, `public/`, `next.config.ts`, `package.json`, `tsconfig.json`
  - FastAPI: `main.py`, `agents/`, `models/`, `api/`, `db/`, `utils/`, `requirements.txt`, `.env.example`
  - Neon/Postgres: `migrations/001_init.sql` (or omit if stack doesn't include DB)

### Backend: SSE Endpoint
- `backend/api/skeleton.py` — `POST /api/skeleton` streaming endpoint
- Request model: `SkeletonRequest(project_md: str, sprints: List[dict])`
- Two SSE event types streamed to client:
  - `{ type: 'tree_line', line: str }` — emitted line by line from `folder_tree`
  - `{ type: 'wireframe', html: str }` — emitted once when wireframe is ready
- Stream using `graph.astream(init_state, stream_mode="updates")`
- Always emit `data: [DONE]\n\n` in `finally` block
- Register router in `backend/main.py`

### Backend: Input cap
- Truncate `project_md` to 50,000 chars before graph invocation (consistent with sprint planner pattern)
- Truncate sprints list to first 6 sprints if longer (wireframe builder only uses sprint[0])

### Frontend: Next.js API Proxy
- `frontend/app/api/skeleton/route.ts` — proxy to `${BACKEND_URL}/api/skeleton`
- Copy pattern exactly from `frontend/app/api/sprint-planner/route.ts` — only change the URL path
- No auth on this proxy (same as existing proxies)

### Frontend: /skeleton page
- `frontend/app/skeleton/page.tsx` — two-panel layout (50/50 split), existing `h-screen` flex pattern
- Left panel: "Folder structure" — monospace `<pre>` block, streams line by line
- Right panel: "Sprint 1 wireframe" — sandboxed `<iframe srcDoc={wireframeHtml}>`
- "Generate Skeleton" button at top
- Empty state guard: if no sprints in context → "Complete the sprint planner first" with link

### Frontend: FolderTree component
- `frontend/components/FolderTree.tsx`
- Renders ASCII tree in `<pre>` with monospace font
- "Copy to clipboard" button (`navigator.clipboard.writeText`)
- Lines stream in and append as they arrive
- Collapse/expand directories on click (post-streaming only — don't block streaming)

### Frontend: WireframePreview component
- `frontend/components/WireframePreview.tsx`
- `<iframe srcDoc={wireframeHtml} sandbox="allow-scripts" style={{ width: '100%', height: '500px', border: '1px solid #e5e7eb' }} />`
- Loading placeholder until HTML is received
- "Open in new tab" button: `window.open(URL.createObjectURL(new Blob([html], {type: 'text/html'})))`

### Frontend: GenerateSkeleton + SSE consumption
- `frontend/app/skeleton/page.tsx` handles the generation trigger
- POST to `/api/skeleton` with `{ project_md, sprints }` from ProjectContext
- SSE loop: `event.type === 'tree_line'` → append line; `event.type === 'wireframe'` → set wireframe HTML
- [DONE]: set generating=false, isDone=true
- Use same SSE fetch + TextDecoder buffer pattern as sprint planner page

### Frontend: Download button
- "Download skeleton.zip" using `jszip`
- Contains: `structure.txt` (full ASCII tree) + `wireframe.html` (complete HTML)
- Available only when `isDone && folderTree !== '' && wireframeHtml !== ''`

### DB: Skeletons Table (Drizzle + Neon)
- Add `skeletons` pgTable to `frontend/lib/db/schema.ts`:
  ```typescript
  export const skeletons = pgTable("skeletons", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    folderTree: text("folder_tree"),
    wireframeHtml: text("wireframe_html"),
    createdAt: timestamp("created_at").defaultNow(),
  });
  ```
- Run `npx drizzle-kit push` to apply to Neon after schema change

### DB: Save/Load API Route (Next.js — not FastAPI)
- `frontend/app/api/projects/[id]/skeleton/route.ts`:
  - `PUT`: save skeleton — verify project ownership, upsert skeleton row (DELETE + INSERT, same pattern as sprints)
  - `GET`: load skeleton — return `{ folder_tree, wireframe_html }` for a project (for persistence on page reload)
- Auth: `await auth()` from `@clerk/nextjs/server`, return 401 if not signed in
- Ownership check: `and(eq(projects.id, projectId), eq(projects.userId, userId))`

### Frontend: Save to DB
- After generation completes (`[DONE]`), call `PUT /api/projects/{projectId}/skeleton`
- Body: `{ folder_tree: folderTree, wireframe_html: wireframeHtml }`
- Show "Saved ✓" SaveStatus indicator near the generate button
- If `projectId` is null (user not signed in or project not saved): skip save silently

### Frontend: Load from DB
- On `/skeleton` page mount: if `projectId` in context, call `GET /api/projects/{id}/skeleton`
- If skeleton exists in DB: populate folderTree + wireframeHtml state (restore previous output)
- Show restored state with a "Regenerate" button option

### Stub / Mock Strategy
- If `sprints` array is empty on `/skeleton`, use a hardcoded stub Sprint 1 so the agent can still run (dev/testing without completing sprint flow)
- `wireframe_builder` output cap: 1500 tokens / ~50 lines of HTML; simpler is better
- If wireframe HTML generation fails: fall back to `<html><body><h1>Sprint 1 wireframe unavailable</h1></body></html>`
- Folder tree always generated before wireframe — tree failure does not block wireframe

### Claude's Discretion
- Error handling beyond what's specified (toast library choice, error boundaries)
- Loading states on DB fetch
- Exact Groq temperature/max_tokens for skeleton nodes (suggest: stack_resolver temp=0.0, tree_builder temp=0.0, wireframe_builder temp=0.5)
- Whether to create a `GenerateSkeleton.tsx` component or keep logic in page.tsx (either is fine)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Sprint Specification
- `plan/sprint-3b.md` — Original Sprint 3b spec (skeleton generator, folder tree UI, wireframe, definition of done). Note: DB layer decisions override this spec — use Drizzle + Neon + Next.js API routes instead of Supabase + FastAPI routes.

### Architecture Pattern (MANDATORY — DB layer)
- `.planning/phases/03-auth-database/03-CONTEXT.md` — Drizzle + Neon architecture decisions. Phase 4 DB work MUST follow same patterns (Next.js API routes, auth(), ownership check, DELETE+INSERT).
- `frontend/lib/db/schema.ts` — Add `skeletons` table here; do not create a separate schema file
- `frontend/app/api/projects/[id]/sprints/route.ts` — Exact pattern to follow for skeleton PUT route (ownership check + DELETE + INSERT)
- `frontend/app/api/projects/[id]/route.ts` — Ownership check pattern

### Existing Agent Patterns (MANDATORY — backend)
- `backend/agents/brainstorm.py` — load_dotenv pattern, Groq initialization, graph compilation
- `backend/agents/sprint_planner.py` — single-node graph pattern (simpler than brainstorm)
- `backend/api/sprint_planner.py` — SSE endpoint pattern with stream_mode="updates"
- `backend/models/sprint_state.py` — TypedDict state model pattern
- `.planning/phases/02-sprint-planner-agent/02-PATTERNS.md` — Full code excerpts for all patterns

### Existing Frontend Patterns (MANDATORY)
- `frontend/app/sprints/page.tsx` — SSE fetch loop, page layout, empty state guard, ProjectContext usage
- `frontend/app/api/sprint-planner/route.ts` — Next.js proxy route (copy verbatim, change URL)
- `frontend/components/BrainstormChat.tsx` — SSE TextDecoder buffer loop (exact implementation to copy)
- `frontend/components/SprintCard.tsx` — "use client" component structure
- `frontend/context/ProjectContext.tsx` — ProjectContext (projectId, projectMd, sprints — all needed for skeleton page)

### Project Context
- `.planning/PROJECT.md` — Tech stack constraints

</canonical_refs>

<specifics>
## Specific Ideas

- Tree formatter is pure Python string manipulation — no LLM call, no external library
- iframe `sandbox="allow-scripts"` — allows inline scripts in wireframe HTML but prevents navigation away
- `window.open(URL.createObjectURL(...))` for "Open in new tab" — creates a temporary blob URL
- jszip is already used or easily added: `npm install jszip` in `/frontend`
- Skeleton save uses DELETE + INSERT (not UPSERT) — same simplification as sprints
- `GET /api/projects/[id]/skeleton` on page mount allows page reload persistence (D-4 of definition of done)
- Wireframe annotations: `<!-- Sprint 1: [task name] -->` comments in HTML for each section

</specifics>

<deferred>
## Deferred Ideas

- Stripe tier enforcement on skeleton export — Phase 5
- Skeleton save to Supabase Storage as files — post-MVP (plain DB column is sufficient for MVP)
- Multiple wireframes per sprint — MVP only generates Sprint 1 wireframe
- Runnable code generation — explicitly out of scope per PROJECT.md
- Real-time collaboration — out of scope

</deferred>

---

*Phase: 04-skeleton-generator*
*Context gathered: 2026-04-21 via PRD Express Path (plan/sprint-3b.md) + architectural adaptation*
