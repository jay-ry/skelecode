# Phase 4: Skeleton Generator - Research

**Researched:** 2026-04-21
**Domain:** LangGraph SSE agent + Next.js 16 API routes + Drizzle+Neon persistence + iframe rendering
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Backend:** 3-node linear LangGraph graph (`stack_resolver → tree_builder → wireframe_builder → END`). No conditional edges.
- **LLM:** `ChatGroq(model="llama-3.3-70b-versatile")` — consistent with existing agents.
- **SSE events:** `{ type: 'tree_line', line: str }` (line by line from folder_tree) and `{ type: 'wireframe', html: str }` (once).
- **Tree formatter:** Pure Python utility `backend/utils/tree_formatter.py`, no LLM call.
- **DB table:** `skeletons` pgTable added to `frontend/lib/db/schema.ts`. DELETE+INSERT pattern (not UPSERT).
- **DB layer:** Next.js API routes only — FastAPI does NOT touch the DB.
- **Save/Load route:** `frontend/app/api/projects/[id]/skeleton/route.ts` — PUT + GET with Clerk auth + ownership check.
- **Frontend page:** `frontend/app/skeleton/page.tsx` — 50/50 two-panel layout, existing `h-screen` flex pattern.
- **Download:** `jszip` (already installed at `^3.10.1`) — `structure.txt` + `wireframe.html` in `skeleton.zip`.
- **Page mount load:** GET `/api/projects/{id}/skeleton` on mount; restore `folderTree` + `wireframeHtml` state.
- **Input caps:** `project_md` truncated to 50,000 chars; sprints list capped at first 6.
- **Wireframe fallback:** `<html><body><h1>Sprint 1 wireframe unavailable</h1></body></html>` on generation failure.
- **Stub strategy:** If `sprints` is empty on `/skeleton`, use a hardcoded stub Sprint 1 for dev/testing.
- **Architecture:** FastAPI is AI-only — no auth, no DB writes.

### Claude's Discretion

- Error handling beyond what's specified (toast library choice, error boundaries).
- Loading states on DB fetch.
- Exact Groq temperature/max_tokens for skeleton nodes (suggested: `stack_resolver` temp=0.0, `tree_builder` temp=0.0, `wireframe_builder` temp=0.5).
- Whether to create a `GenerateSkeleton.tsx` component or keep logic in `page.tsx`.

### Deferred Ideas (OUT OF SCOPE)

- Stripe tier enforcement on skeleton export — Phase 5.
- Skeleton save to Supabase Storage as files — post-MVP.
- Multiple wireframes per sprint — MVP only generates Sprint 1.
- Runnable code generation — explicitly out of scope per PROJECT.md.
- Real-time collaboration — out of scope.
</user_constraints>

---

## Summary

Phase 4 extends SkeleCode with a skeleton generator: a 3-node LangGraph agent that reads `project_md` + `sprints`, resolves the tech stack, builds an ASCII folder tree, and produces a single-file HTML wireframe for Sprint 1. All AI work runs through FastAPI. All DB persistence runs through Next.js API routes using Drizzle+Neon — exactly the same architecture as Phase 3.

The phase introduces two new backend files (`backend/agents/skeleton.py`, `backend/api/skeleton.py`), one new model (`backend/models/skeleton_state.py`), one new utility (`backend/utils/tree_formatter.py`), one new DB table (`skeletons`), one new Next.js API route (`frontend/app/api/projects/[id]/skeleton/route.ts`), one new Next.js proxy route (`frontend/app/api/skeleton/route.ts`), and three new frontend files (`frontend/app/skeleton/page.tsx`, `frontend/components/FolderTree.tsx`, `frontend/components/WireframePreview.tsx`).

The critical discovery from reading the installed codebase: **Next.js is version 16.2.4**, not "Next.js 14" as stated in `PROJECT.md`. All route handler patterns must follow Next.js 16 conventions (`params: Promise<{ id: string }>`, `await params`). The existing Phase 3 routes already use this pattern correctly, so they serve as reliable templates.

**Primary recommendation:** Copy `backend/api/sprint_planner.py` → `backend/api/skeleton.py` and `frontend/app/api/sprint-planner/route.ts` → `frontend/app/api/skeleton/route.ts`, then adapt. Copy `frontend/app/api/projects/[id]/sprints/route.ts` → `frontend/app/api/projects/[id]/skeleton/route.ts` and add a GET handler. Follow the Phase 3 patterns exactly — all are proven and present in the repo.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| AI generation (tree + wireframe) | API / Backend (FastAPI) | — | LangGraph agent runs in Python; Groq API calls from server only |
| SSE streaming to browser | API / Backend (FastAPI) → Frontend Server proxy (Next.js) | Browser / Client | FastAPI streams; Next.js proxy pipes through; browser reads SSE |
| DB persistence (save skeleton) | Frontend Server (Next.js API route) | Database (Neon) | Per Phase 3 architecture: FastAPI is AI-only; all DB writes via Next.js |
| DB load on page mount | Frontend Server (Next.js API route) | Browser / Client | GET route returns JSON; client hydrates state |
| Skeleton page rendering | Browser / Client | — | "use client" page consuming context + local state |
| ZIP download | Browser / Client | — | JSZip runs in browser; no server needed |
| ASCII tree formatting | API / Backend (FastAPI) | — | Pure Python utility called by tree_builder node |
| Wireframe iframe rendering | Browser / Client | — | `<iframe srcDoc>` — browser renders HTML string |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `langchain-groq` | installed in venv | ChatGroq LLM interface | Already used by brainstorm + sprint_planner agents |
| `langgraph` | installed in venv | Graph orchestration | Already used; same `StateGraph + astream` pattern |
| `jszip` | `^3.10.1` (already installed) | ZIP download in browser | Already in `frontend/package.json`; used by sprints page |
| `drizzle-orm` | `^0.45.2` | DB queries in Next.js routes | Already used by Phase 3 routes |
| `@clerk/nextjs` | `^7.2.3` | Auth in Next.js API routes | Already installed; `auth()` pattern from Phase 3 |
| `@neondatabase/serverless` | `^1.1.0` | Neon HTTP driver | Already wired in `lib/db/index.ts` |

[VERIFIED: codebase grep of `package.json` and `requirements.txt`]

### Installation Required

```bash
# No new packages needed — all dependencies are already installed.
# jszip: already at ^3.10.1 in frontend/package.json
# No backend packages to add
```

[VERIFIED: `frontend/package.json` — jszip present; no new backend deps needed]

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  │
  │  POST /api/skeleton  (SSE)
  ▼
Next.js Proxy Route
  frontend/app/api/skeleton/route.ts
  │
  │  pipe upstream SSE  (no buffering)
  ▼
FastAPI  POST /api/skeleton
  backend/api/skeleton.py
  │
  │  graph.astream(init_state, stream_mode="updates")
  ▼
LangGraph SkeletonGraph
  ├─ stack_resolver node  ──► { tech_stack }
  ├─ tree_builder node  ──► { file_list, folder_tree }  ──► tree_line events
  └─ wireframe_builder node  ──► { wireframe_html }  ──► wireframe event
  │
  └─ [DONE] sentinel

Browser (state update)
  ├── folderTree: append each tree_line
  └── wireframeHtml: set on wireframe event

  After [DONE]:
  │
  ▼
Next.js API Route  PUT /api/projects/[id]/skeleton
  frontend/app/api/projects/[id]/skeleton/route.ts
  │  auth() ownership check → DELETE + INSERT skeletons row
  ▼
Neon (Postgres via Drizzle)

On page mount:
  Browser → GET /api/projects/[id]/skeleton → restore state
```

### Recommended Project Structure (new files only)

```
backend/
├── models/
│   └── skeleton_state.py      # SkeletonState TypedDict
├── agents/
│   └── skeleton.py            # 3-node LangGraph graph
├── api/
│   └── skeleton.py            # POST /api/skeleton SSE endpoint
└── utils/
    └── tree_formatter.py      # format_tree() pure Python utility

frontend/
├── app/
│   ├── skeleton/
│   │   └── page.tsx           # /skeleton page — two-panel layout
│   └── api/
│       ├── skeleton/
│       │   └── route.ts       # Next.js proxy → FastAPI /api/skeleton
│       └── projects/[id]/
│           └── skeleton/
│               └── route.ts   # PUT + GET for save/load
├── components/
│   ├── FolderTree.tsx          # ASCII tree renderer + copy button
│   └── WireframePreview.tsx    # iframe + open-in-new-tab
└── lib/db/
    └── schema.ts              # ADD skeletons table here (not a new file)
```

### Pattern 1: SkeletonState TypedDict

Follows `backend/models/sprint_state.py` exactly. No Pydantic BaseModel needed (no structured output for the whole state — each node uses its own LLM call).

```python
# Source: backend/models/sprint_state.py (verified in repo)
from typing import TypedDict, List

class SkeletonState(TypedDict):
    project_md: str
    sprints: List[dict]
    tech_stack: dict           # {frontend: str, backend: str, db: str | None}
    file_list: List[str]       # ["frontend/app/layout.tsx", ...]
    folder_tree: str           # formatted ASCII tree string
    wireframe_html: str        # complete HTML string
    status: str                # resolving | building_tree | building_wireframe | done
```

[VERIFIED: analog in `backend/models/sprint_state.py`]

### Pattern 2: LangGraph Agent — load_dotenv, graph compile, 3-node linear

```python
# Source: backend/agents/sprint_planner.py (verified in repo)
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent.parent / ".env")

# ... imports after dotenv ...

from langgraph.graph import StateGraph, START, END
from models.skeleton_state import SkeletonState

async def stack_resolver(state: SkeletonState) -> dict: ...
async def tree_builder(state: SkeletonState) -> dict: ...
async def wireframe_builder(state: SkeletonState) -> dict: ...

builder = StateGraph(SkeletonState)
builder.add_node("stack_resolver", stack_resolver)
builder.add_node("tree_builder", tree_builder)
builder.add_node("wireframe_builder", wireframe_builder)
builder.add_edge(START, "stack_resolver")
builder.add_edge("stack_resolver", "tree_builder")
builder.add_edge("tree_builder", "wireframe_builder")
builder.add_edge("wireframe_builder", END)
graph = builder.compile()
```

**Critical:** `load_dotenv` MUST be first — before any langchain/langgraph imports. This is the established pattern in both `brainstorm.py` and `sprint_planner.py`. [VERIFIED: both agent files start with dotenv lines 1-3]

### Pattern 3: FastAPI SSE Endpoint for skeleton

Two event types instead of one. Key differences from sprint_planner endpoint:

```python
# Source: adapted from backend/api/sprint_planner.py (verified in repo)
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List
import json

from agents.skeleton import graph
from models.skeleton_state import SkeletonState

router = APIRouter()
MAX_PROJECT_MD_CHARS = 50_000
MAX_SPRINTS = 6

class SkeletonRequest(BaseModel):
    project_md: str
    sprints: List[dict]

@router.post("/api/skeleton")
async def skeleton_endpoint(req: SkeletonRequest):
    init_state = SkeletonState(
        project_md=req.project_md[:MAX_PROJECT_MD_CHARS],
        sprints=req.sprints[:MAX_SPRINTS],
        tech_stack={}, file_list=[],
        folder_tree="", wireframe_html="",
        status="resolving",
    )

    async def event_stream():
        try:
            async for event in graph.astream(init_state, stream_mode="updates"):
                node_name = list(event.keys())[0]
                data = list(event.values())[0]
                if node_name == "tree_builder" and data.get("folder_tree"):
                    for line in data["folder_tree"].split("\n"):
                        yield f"data: {json.dumps({'type': 'tree_line', 'line': line})}\n\n"
                elif node_name == "wireframe_builder" and data.get("wireframe_html"):
                    yield f"data: {json.dumps({'type': 'wireframe', 'html': data['wireframe_html']})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'reason': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

**Event shape difference from sprint_planner:** Skeleton uses `type` key (not `node`/`data`). The CONTEXT.md spec locks this: `{ type: 'tree_line', line: str }` and `{ type: 'wireframe', html: str }`. [VERIFIED: CONTEXT.md Implementation Decisions — SSE Endpoint section]

### Pattern 4: Next.js Proxy Route (copy verbatim)

```typescript
// Source: frontend/app/api/sprint-planner/route.ts (verified in repo — all 33 lines)
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

  const upstream = await fetch(`${backendUrl}/api/skeleton`, {  // only change
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(JSON.stringify({ error: "Backend error" }), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
```

[VERIFIED: `frontend/app/api/sprint-planner/route.ts` exact content in repo]

### Pattern 5: Drizzle Schema — skeletons table addition

Add to the END of `frontend/lib/db/schema.ts` (after the `sprints` table). No new imports needed — `uuid`, `text`, and `timestamp` already imported.

```typescript
// Source: frontend/lib/db/schema.ts (verified — existing imports cover all needed types)
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

**Push command** (run from `frontend/` directory):
```bash
cd frontend && npx drizzle-kit push
```

Drizzle Kit reads `.env.local` via `config({ path: ".env.local" })` in `drizzle.config.ts`. [VERIFIED: `frontend/drizzle.config.ts`]

### Pattern 6: Next.js API Route — PUT + GET with ownership check

Exactly mirrors `frontend/app/api/projects/[id]/sprints/route.ts`. Key elements confirmed in existing code:

```typescript
// Source: frontend/app/api/projects/[id]/sprints/route.ts (verified in repo)
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, skeletons } from "@/lib/db/schema";   // import skeletons
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// PUT handler — exact ownership check + DELETE + INSERT pattern:
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }   // REQUIRED in Next.js 16
) {
  const { id: projectId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [owned] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  // DELETE + INSERT (not UPSERT — same simplification as sprints)
  await db.delete(skeletons).where(eq(skeletons.projectId, projectId));
  await db.insert(skeletons).values({
    projectId,
    folderTree: body.folder_tree ?? null,
    wireframeHtml: body.wireframe_html ?? null,
  });

  return NextResponse.json({ ok: true });
}

// GET handler — returns skeleton data for the project:
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [owned] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [row] = await db
    .select()
    .from(skeletons)
    .where(eq(skeletons.projectId, projectId))
    .limit(1);

  if (!row) return NextResponse.json({ folder_tree: null, wireframe_html: null });
  return NextResponse.json({ folder_tree: row.folderTree, wireframe_html: row.wireframeHtml });
}
```

[VERIFIED: sprints route pattern in `frontend/app/api/projects/[id]/sprints/route.ts`]

### Pattern 7: SSE Consumption in skeleton/page.tsx

Identical to `frontend/app/sprints/page.tsx` SSE loop. Change event key check from `event.node === "sprint"` to `event.type === "tree_line"` / `event.type === "wireframe"`.

```typescript
// Source: frontend/app/sprints/page.tsx lines 59-122 (verified in repo)
// Key difference: skeleton events use `type` not `node`
const event = JSON.parse(payload);
if (event.type === "tree_line") {
  setFolderTree((prev) => prev ? prev + "\n" + event.line : event.line);
} else if (event.type === "wireframe") {
  setWireframeHtml(event.html);
} else if (event.type === "error") {
  setErrorMsg(event.reason ?? "Unknown error");
}
```

### Pattern 8: iframe srcDoc — confirmed safe in Next.js 16

```typescript
// Source: CONTEXT.md specifics (VERIFIED: confirmed by Next.js 16 docs — no breaking change)
<iframe
  srcDoc={wireframeHtml}
  sandbox="allow-scripts"
  style={{ width: "100%", height: "500px", border: "1px solid #e5e7eb" }}
/>
```

`sandbox="allow-scripts"` allows inline `<script>` tags in generated HTML but blocks navigation, form submission, and top-level context access. This is the correct minimal sandbox for wireframe display. [VERIFIED: HTML Living Standard; no Next.js-specific concern]

### Pattern 9: tree_formatter.py algorithm

Pure Python — no external library. The algorithm must handle nested paths of arbitrary depth:

```python
# Source: sprint-3b.md B3 spec + CONTEXT.md (algorithm design — ASSUMED for implementation)
def format_tree(file_list: list[str]) -> str:
    """Build a nested dict tree, then render with box-drawing characters."""
    # Step 1: Build nested dict
    tree = {}
    for path in sorted(file_list):
        parts = path.split("/")
        node = tree
        for part in parts[:-1]:           # directories
            node = node.setdefault(part + "/", {})
        node[parts[-1]] = None            # file (leaf)

    # Step 2: Render recursively
    lines = []
    def render(node, prefix=""):
        items = list(node.items())
        for i, (name, children) in enumerate(items):
            is_last = (i == len(items) - 1)
            connector = "└── " if is_last else "├── "
            lines.append(prefix + connector + name)
            if children is not None:      # directory
                extension = "    " if is_last else "│   "
                render(children, prefix + extension)
    render(tree)
    return "\n".join(lines)
```

[ASSUMED: specific implementation — algorithm is standard "tree command" output style]

### Pattern 10: LLM settings for skeleton nodes

| Node | temperature | max_tokens | Rationale |
|------|-------------|------------|-----------|
| `stack_resolver` | 0.0 | 512 | Deterministic extraction from existing text |
| `tree_builder` | 0.0 | 2048 | Deterministic file list generation |
| `wireframe_builder` | 0.5 | 1500 | Creative but constrained HTML generation |

[ASSUMED: suggested in CONTEXT.md "Claude's Discretion"; consistent with brainstorm.py temperature split (extractor=0.0, drafter=0.7)]

### Pattern 11: main.py router registration

```python
# Source: backend/main.py (verified — existing pattern)
from api.skeleton import router as skeleton_router
# ... after existing include_router calls:
app.include_router(skeleton_router)
```

[VERIFIED: `backend/main.py` lines 7-20]

### Anti-Patterns to Avoid

- **dotenv after imports:** `load_dotenv` MUST be the first 3 lines of `skeleton.py` before any `from langchain_groq import...`. Confirmed both existing agents do this. [VERIFIED]
- **Non-promise params in Next.js 16:** `{ params }: { params: { id: string } }` without `Promise<>` and `await params` will fail. **All existing Phase 3 routes use `Promise<>` correctly.** [VERIFIED: Next.js 16 docs + existing routes]
- **Putting DB logic in FastAPI:** FastAPI is AI-only. The skeleton endpoint does NOT save to DB — that is the Next.js API route's job. [VERIFIED: CONTEXT.md architecture constraint]
- **Using UPSERT instead of DELETE+INSERT:** The established pattern (and simplest for MVP) is to delete the skeleton row for a project then insert a new one. [VERIFIED: sprints/route.ts lines 51-63]
- **stream_mode default:** Must pass `stream_mode="updates"` explicitly to `graph.astream()`. Without it, stream_mode defaults to "values" which yields the full state after each node, not just the delta. [VERIFIED: sprint_planner.py line 37]
- **Returning END sentinel in conditional edge router:** Only relevant for brainstorm (no conditional edges in skeleton). [VERIFIED: skeleton has no conditional edges]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ZIP creation | Custom tar/zip logic | `jszip` (already installed) | Already used by sprints page; handles blob output |
| Clipboard copy | Manual execCommand | `navigator.clipboard.writeText()` | Modern async API; works in secure context |
| DB schema migration | Hand-written SQL | `npx drizzle-kit push` | Already wired; reads `.env.local` automatically |
| HTML blob URL for new tab | Server route | `URL.createObjectURL(new Blob([html], {type: 'text/html'}))` | Client-side; no server needed |
| Streaming pipe in Next.js | Body buffering | `return new Response(upstream.body, {...})` | Direct pipe pattern already proven in sprint-planner proxy |

---

## Common Pitfalls

### Pitfall 1: SSE Event Shape Mismatch (tree_line vs node/data)

**What goes wrong:** Sprint planner uses `{ node: 'sprint', data: {...} }`. Skeleton uses `{ type: 'tree_line', line: str }` and `{ type: 'wireframe', html: str }`. If the implementer copies the sprint_planner SSE event shape, the frontend parser will look for `event.node === 'tree_line'` and never match.
**Why it happens:** Locked decision in CONTEXT.md uses `type` key not `node` key — different from the sprint_planner pattern.
**How to avoid:** Backend emits `json.dumps({'type': 'tree_line', 'line': line})`. Frontend checks `event.type === 'tree_line'`.
**Warning signs:** Folder tree never populates despite SSE connection succeeding.

### Pitfall 2: Stale Closure on [DONE] Save

**What goes wrong:** The save-to-DB fetch inside the `[DONE]` handler reads stale `folderTree` state (empty string).
**Why it happens:** React state updates are asynchronous — `folderTree` state inside a closure captures the value at the time the handler was created, not at `[DONE]` time.
**How to avoid:** Use a `useRef` accumulator for `folderTree` (same pattern as `accumulatedSprintsRef` in `sprints/page.tsx`). Read from the ref when constructing the PUT body. [VERIFIED: sprints/page.tsx lines 34, 81]
**Warning signs:** PUT to `/api/projects/{id}/skeleton` fires but body has empty `folder_tree`.

### Pitfall 3: Missing `utils/` directory

**What goes wrong:** `backend/utils/tree_formatter.py` fails to import because `utils/` doesn't exist yet.
**Why it happens:** The `utils/` directory has never been created in this project.
**How to avoid:** Create `backend/utils/__init__.py` alongside `tree_formatter.py`. [VERIFIED: `ls backend/` shows no `utils/` dir]
**Warning signs:** `ModuleNotFoundError: No module named 'utils'` on backend startup.

### Pitfall 4: Drizzle schema import in skeleton route

**What goes wrong:** `import { skeletons } from "@/lib/db/schema"` fails because `skeletons` is not exported until the schema is updated and the `npx drizzle-kit push` command is run.
**Why it happens:** Two steps required — add to `schema.ts` AND push to Neon.
**How to avoid:** Schema update and push must happen before testing any DB-touching code. Wave ordering in the plan should put schema + push in Wave 0 or Wave 1.
**Warning signs:** TypeScript error on import; runtime 500 if wrong table name.

### Pitfall 5: iframe srcDoc XSS with `sandbox="allow-scripts"`

**What goes wrong:** Wireframe HTML runs inline scripts — if the HTML contains malicious JS, it executes in the browser.
**Why it happens:** `sandbox="allow-scripts"` is intentional (allows wireframe interactivity). This is AI-generated content from the user's own project spec.
**How to avoid:** The sandbox blocks `allow-same-origin`, which prevents the iframe from accessing the parent page's DOM, cookies, or localStorage. This is the correct risk trade-off for MVP. Do NOT add `allow-same-origin`. [VERIFIED: HTML Living Standard sandbox attribute]
**Warning signs:** Adding `allow-same-origin` is the dangerous combination — never add it.

### Pitfall 6: `project_md` NODE count in stack_resolver

**What goes wrong:** `stack_resolver` reads `project_md` but the project_md produced by the brainstorm agent doesn't explicitly name the tech stack in a machine-parseable format.
**Why it happens:** The brainstorm drafter prompt doesn't enforce structured output — it's freeform markdown.
**How to avoid:** The `stack_resolver` node prompt must be written to extract stack defensively: default to `{frontend: "Next.js", backend: "FastAPI", db: "Neon"}` if no explicit stack is mentioned. The prompt must treat `project_md` as data.
**Warning signs:** `tech_stack` comes back with empty/null values; tree_builder generates generic files.

### Pitfall 7: `folder_tree` accumulation — newline handling

**What goes wrong:** Tree lines arrive as `event.line` and are appended with `"\n"` — but the tree formatter already embeds newlines between lines via `"\n".join(lines)`. If the split happens on the backend at `"\n"` and each line is emitted separately, the frontend should join with `"\n"` without adding an extra blank line.
**Why it happens:** Double-newline injection when appending lines.
**How to avoid:** Frontend state update: `setFolderTree((prev) => prev ? prev + "\n" + event.line : event.line)`. This correctly accumulates without leading/trailing extra newlines.
**Warning signs:** ASCII tree renders with blank lines between every entry.

---

## Code Examples

### tree_formatter.py — test cases to validate

```python
# Expected output for canonical input
file_list = [
    "frontend/app/layout.tsx",
    "frontend/app/page.tsx",
    "frontend/components/Header.tsx",
    "backend/main.py",
    "backend/agents/skeleton.py",
]
# Expected:
# ├── backend/
# │   ├── agents/
# │   │   └── skeleton.py
# │   └── main.py
# └── frontend/
#     ├── app/
#     │   ├── layout.tsx
#     │   └── page.tsx
#     └── components/
#         └── Header.tsx
```

### WireframePreview.tsx — open in new tab

```typescript
// Source: CONTEXT.md specifics (confirmed in sprint-3b.md F3)
const handleOpenInNewTab = () => {
  const blob = new Blob([wireframeHtml], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  // Note: do NOT revoke immediately — the new tab needs the URL alive
};
```

### FolderTree.tsx — copy to clipboard

```typescript
// Source: CONTEXT.md specifics
const handleCopy = async () => {
  await navigator.clipboard.writeText(folderTree);
  // Optional: brief "Copied!" feedback state
};
```

### Download skeleton.zip

```typescript
// Source: adapted from frontend/app/sprints/page.tsx lines 129-143 (verified)
import JSZip from "jszip";

const handleDownload = async () => {
  const zip = new JSZip();
  zip.file("structure.txt", folderTree);
  zip.file("wireframe.html", wireframeHtml);
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "skeleton.zip";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
```

### ProjectContext — no changes needed

`ProjectContext.tsx` already exposes `projectMd`, `sprints`, and `projectId`. The skeleton page reads all three from context. No new fields needed — `folderTree` and `wireframeHtml` are local state in `skeleton/page.tsx` (not shared across pages).

[VERIFIED: `frontend/context/ProjectContext.tsx` — exports `projectMd`, `sprints`, `projectId`]

---

## Key Technical Answers

### Q1: Exact Drizzle schema for skeletons table

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

No new imports needed — `uuid`, `text`, `timestamp`, `pgTable` already imported in `schema.ts`. [VERIFIED: `frontend/lib/db/schema.ts`]

### Q2: Groq temperature/max_tokens for wireframe_builder

Suggested: `temperature=0.5`, `max_tokens=1500`. The 1500-token cap enforces the "simpler is better" constraint from CONTEXT.md. The existing pattern uses `max_tokens=8192` for sprint planner (structured output) and `max_tokens=4096` for brainstorm drafter — 1500 is appropriate for a compact HTML wireframe. [ASSUMED: Claude's Discretion per CONTEXT.md]

### Q3: ASCII tree formatter algorithm

Pure Python recursive dict-based approach. No external library. Build nested dict from sorted paths, then render with `├──`, `│   `, `└──`, `    ` characters. See Pattern 9 above. [ASSUMED: standard algorithm; specific implementation]

### Q4: Next.js API route for PUT + GET skeleton

Use `params: Promise<{ id: string }>` with `const { id: projectId } = await params`. This is confirmed by Next.js 16.2.4 docs AND the existing Phase 3 routes. [VERIFIED: Next.js 16 route.md docs + `frontend/app/api/projects/[id]/sprints/route.ts`]

### Q5: jszip already installed?

Yes. `jszip: "^3.10.1"` is in `frontend/package.json`. Already used in `frontend/app/sprints/page.tsx` line 4. No installation needed. [VERIFIED: `frontend/package.json` + `sprints/page.tsx`]

### Q6: folderTree/wireframeHtml — ProjectContext or local state?

**Local state in `skeleton/page.tsx`.** These values are only consumed on the skeleton page and don't need to be shared across pages. ProjectContext already has `projectMd` and `sprints` (for sending to the backend) and `projectId` (for save/load). No context changes needed. [VERIFIED: CONTEXT.md — no mention of context changes; 04-CONTEXT.md "Stub/Mock Strategy" implies page-local state]

### Q7: SSE event shapes

- Backend emits: `data: {"type": "tree_line", "line": "├── app/"}\n\n`
- Backend emits: `data: {"type": "wireframe", "html": "<!DOCTYPE html>..."}\n\n`
- Backend always emits: `data: [DONE]\n\n` in `finally` block
- Frontend checks: `event.type === "tree_line"`, `event.type === "wireframe"`

[VERIFIED: CONTEXT.md SSE Endpoint section]

### Q8: iframe srcDoc pitfalls in Next.js 16

No Next.js-specific pitfalls. `<iframe srcDoc={...} sandbox="allow-scripts">` is standard HTML. The risk is `allow-same-origin` being added — never do this. With only `allow-scripts`, the iframe is a secure sandbox. The `sandbox` attribute blocks `allow-same-origin` by default when omitted. [VERIFIED: HTML spec; no Next.js-specific concern found]

### Q9: Restore skeleton data on page mount

```typescript
// In skeleton/page.tsx useEffect (runs on mount when projectId available)
useEffect(() => {
  if (!projectId) return;
  fetch(`/api/projects/${projectId}/skeleton`)
    .then((res) => res.ok ? res.json() : null)
    .then((data) => {
      if (data?.folder_tree) setFolderTree(data.folder_tree);
      if (data?.wireframe_html) setWireframeHtml(data.wireframe_html);
      if (data?.folder_tree || data?.wireframe_html) setIsDone(true);
    })
    .catch(() => {/* silent — no saved skeleton is fine */});
}, [projectId]);
```

[ASSUMED: pattern; matches CONTEXT.md "Load from DB" spec]

### Q10: Drizzle push command

```bash
cd frontend && npx drizzle-kit push
```

`drizzle.config.ts` has `config({ path: ".env.local" })` so it reads DATABASE_URL from `.env.local` automatically. [VERIFIED: `frontend/drizzle.config.ts`]

---

## Runtime State Inventory

> Not a rename/refactor/migration phase. Section included only to document the one DB state change.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Neon DB — `skeletons` table does NOT yet exist | `npx drizzle-kit push` after schema.ts update |
| Live service config | None | — |
| OS-registered state | None | — |
| Secrets/env vars | No new env vars needed | — |
| Build artifacts | None | — |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Frontend build + drizzle-kit | Assumed available | — | — |
| Python venv | Backend agents | Assumed available | — | — |
| Neon DATABASE_URL | `npx drizzle-kit push` + save/load routes | Assumed set in `.env.local` | — | Skip save silently (already guarded in db/index.ts) |
| GROQ_API_KEY | `skeleton.py` agent | Assumed set in `backend/.env` | — | Agent fails with 500; fallback wireframe HTML served |
| jszip | ZIP download | ✓ already installed | `^3.10.1` | — |

[VERIFIED: `frontend/package.json` for jszip; other deps assumed from Phase 3 completion]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js 14 (PROJECT.md) | Next.js 16.2.4 (actual installed) | Before Phase 3 | `params` is `Promise<{id: string}>` not plain object — must `await params` |
| `{ params }: { params: { id: string } }` | `{ params }: { params: Promise<{ id: string }> }` | Next.js 15+ | All existing Phase 3 routes already handle this correctly |
| Supabase (PROJECT.md) | Neon + Drizzle (actual architecture) | Phase 3 decision | No Supabase in any code; all persistence via Drizzle |

**Note on PROJECT.md:** The tech stack listed in PROJECT.md is outdated — it says "Next.js 14" and "Supabase". The actual installed versions are Next.js 16.2.4 and Neon+Drizzle. Trust the installed packages and Phase 3 CONTEXT.md, not PROJECT.md.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tree_formatter.py` recursive dict approach is the correct algorithm | Pattern 9 | Tree renders with wrong indentation; easy to fix with unit tests |
| A2 | `stack_resolver` temp=0.0, `tree_builder` temp=0.0, `wireframe_builder` temp=0.5 | Key Technical Q2 | Wireframe too deterministic (boring) or too creative (malformed HTML); adjust prompt |
| A3 | `folderTree` should be local state in page.tsx, not ProjectContext | Key Technical Q6 | Minor refactor if context needed; low risk — skeleton page is self-contained |
| A4 | Restore skeleton on mount is correct pattern (useEffect on projectId) | Key Technical Q9 | Race condition if projectId loads after mount; add dependency array correctly |
| A5 | `wireframe_builder` LLM call does NOT use structured output (plain text HTML) | Pattern 2 | If LLM wraps in JSON, response.content needs extraction |

---

## Open Questions (RESOLVED)

1. **wireframe_builder output format:** Should the LLM be instructed to return raw HTML (no markdown fences), or should the node strip markdown fences from the response?
   - What we know: `drafter_node` in brainstorm returns `response.content` directly (plain text).
   - What's unclear: Groq's llama-3.3-70b sometimes wraps in ```html fences.
   - RESOLVED: Add post-processing: `html = re.sub(r'^```html\n|```$', '', result.strip(), flags=re.MULTILINE)` as a safety net. Implemented in Plan 01 Task 3 (system prompts) and Plan 03 Task 1 (wireframe_builder node).

2. **stack_resolver node — LLM vs regex:** The CONTEXT.md locks this as an LLM node, but the project_md already contains stack information from the brainstorm. A regex/heuristic fallback would be faster and cheaper.
   - RESOLVED: Use LLM for the primary path (locked decision), with a hardcoded fallback `{frontend: "Next.js", backend: "FastAPI", db: "Neon"}` if `tech_stack` is empty after resolution. Implemented in Plan 03 Task 1.

---

## Validation Architecture

### What can be tested with grep/file checks (no server needed)

| Check | Command | What it verifies |
|-------|---------|-----------------|
| `skeletons` table exported from schema.ts | `grep -c 'export const skeletons' frontend/lib/db/schema.ts` → `1` | Schema addition present |
| `skeletons` references `projects.id` | `grep 'references.*projects.id' frontend/lib/db/schema.ts` → match | FK constraint wired |
| `skeleton.py` agent starts with dotenv | `head -3 backend/agents/skeleton.py` → `load_dotenv` on line 3 | dotenv-before-imports invariant |
| `backend/utils/__init__.py` exists | `ls backend/utils/__init__.py` → file found | `utils` is a Python package |
| `format_tree` exported from tree_formatter | `grep 'def format_tree' backend/utils/tree_formatter.py` → match | Utility function present |
| `SkeletonState` TypedDict in skeleton_state.py | `grep 'class SkeletonState(TypedDict)' backend/models/skeleton_state.py` → match | State model defined |
| skeleton router registered in main.py | `grep 'skeleton_router' backend/main.py` → match | Router wired up |
| `/api/skeleton` proxy route exists | `ls frontend/app/api/skeleton/route.ts` → file found | Proxy route present |
| skeleton save/load route exists | `ls "frontend/app/api/projects/[id]/skeleton/route.ts"` → file found | DB route present |
| `params: Promise<` pattern in skeleton route | `grep 'Promise<' "frontend/app/api/projects/[id]/skeleton/route.ts"` → 2 matches | Next.js 16 pattern used |
| `/skeleton` page exists | `ls frontend/app/skeleton/page.tsx` → file found | Page created |
| FolderTree component exists | `ls frontend/components/FolderTree.tsx` → file found | Component created |
| WireframePreview component exists | `ls frontend/components/WireframePreview.tsx` → file found | Component created |
| `jszip` import in skeleton page | `grep 'jszip' frontend/app/skeleton/page.tsx` → match | Download wired |
| `allow-same-origin` NOT in sandbox | `grep -L 'allow-same-origin' frontend/components/WireframePreview.tsx` → file listed | Security: no dangerous sandbox combo |
| `[DONE]` in skeleton SSE endpoint | `grep 'DONE' backend/api/skeleton.py` → match in finally block | Always-emit invariant |
| `stream_mode="updates"` used | `grep 'stream_mode.*updates' backend/api/skeleton.py` → match | Correct astream mode |
| `tree_line` event type used (not `node`) | `grep "tree_line" backend/api/skeleton.py` → match | Event shape correct |

### What requires a running backend server

| Test | Method | Expected |
|------|--------|----------|
| `POST /api/skeleton` with stub payload | `curl -X POST http://localhost:8000/api/skeleton -H "Content-Type: application/json" -d '{"project_md":"# Test\n- FastAPI backend\n- Next.js frontend","sprints":[{"number":1,"goal":"Setup","user_stories":[],"technical_tasks":["Create skeleton"],"definition_of_done":[]}]}'` | SSE stream with `tree_line` events followed by `wireframe` event, ends with `[DONE]` |
| `GET /health` after adding skeleton router | `curl http://localhost:8000/health` | `{"status": "ok"}` — confirms no import error in skeleton.py |
| tree_formatter unit test | `cd backend && python -m pytest tests/test_tree_formatter.py -v` | All tree structure assertions pass |
| skeleton SSE endpoint mock test | `cd backend && python -m pytest tests/test_skeleton_sse_endpoint.py -v` | All SSE invariants pass |
| `npx drizzle-kit push` | Run from `frontend/` with DATABASE_URL set | "Changes applied" or "No changes" (if already applied) |
| PUT /api/projects/{id}/skeleton | Requires live Clerk session + Neon DB | 200 `{ok: true}` |
| GET /api/projects/{id}/skeleton | Requires live Clerk session + Neon DB | `{folder_tree: "...", wireframe_html: "..."}` |

### What requires human testing (browser)

| Test | Expected | Why human |
|------|----------|-----------|
| Navigate to `/skeleton` — page loads | Two empty panels + "Generate Skeleton" button visible | Browser render; requires live dev server |
| Click "Generate Skeleton" — folder tree streams | ASCII tree populates line by line in left panel | SSE streaming + state update visible in browser only |
| Wireframe renders in iframe | Visible HTML layout in right panel; no blank iframe | iframe srcDoc rendering requires browser |
| "Copy to clipboard" button | Paste confirms full tree text copied | Clipboard API; browser only |
| "Open in new tab" button | New tab opens with readable wireframe HTML | Blob URL + window.open; browser only |
| "Download skeleton.zip" button | ZIP downloads with `structure.txt` + `wireframe.html` | File download; browser only |
| Page reload with saved project | Skeleton restores (both panels populated) | DB round-trip + context hydration; requires live Clerk session |
| Empty state guard — no sprints | "Complete the sprint planner first" message shown | Conditional render; browser only |
| Stub Sprint 1 fallback | Generation works even with empty sprints array | Integration: stub path through LangGraph |

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes — skeleton save/load | `await auth()` from `@clerk/nextjs/server` (Phase 3 pattern) |
| V3 Session Management | No | Handled by Clerk |
| V4 Access Control | Yes — ownership check | `and(eq(projects.id, projectId), eq(projects.userId, userId))` before write/read |
| V5 Input Validation | Yes — project_md/sprints truncation | 50,000 char cap + 6 sprint cap in FastAPI endpoint |
| V6 Cryptography | No | No cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on skeleton save/load | Spoofing/Tampering | Ownership check: `and(eq(projects.id, projectId), eq(projects.userId, userId))` before every DB operation |
| XSS via iframe | Tampering | `sandbox="allow-scripts"` without `allow-same-origin` — iframe cannot access parent page |
| Prompt injection via project_md | Tampering | System prompt must instruct model to treat `project_md` as data; 50,000 char truncation limits payload |
| Oversized wireframe HTML in DB | DoS | wireframe_builder 1500-token cap; Neon text column has no practical size limit but output is bounded |

---

## Sources

### Primary (HIGH confidence)
- `frontend/app/api/projects/[id]/sprints/route.ts` — exact pattern for skeleton PUT route
- `frontend/app/api/projects/[id]/route.ts` — GET + ownership check pattern
- `backend/agents/sprint_planner.py` — exact pattern for skeleton agent
- `backend/api/sprint_planner.py` — exact pattern for skeleton SSE endpoint
- `frontend/app/api/sprint-planner/route.ts` — exact pattern for skeleton proxy
- `frontend/app/sprints/page.tsx` — SSE consumption loop + save pattern
- `frontend/context/ProjectContext.tsx` — context fields available (no changes needed)
- `frontend/lib/db/schema.ts` — existing imports; where skeletons table goes
- `frontend/drizzle.config.ts` — push command reads `.env.local`
- `frontend/package.json` — jszip already present at ^3.10.1
- `backend/main.py` — router registration pattern
- Next.js 16.2.4 local docs at `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — confirms `params: Promise<{...}>` pattern
- `plan/sprint-3b.md` — definition of done, file map, original spec

### Secondary (MEDIUM confidence)
- `.planning/phases/04-skeleton-generator/04-CONTEXT.md` — all implementation decisions locked
- `.planning/phases/03-auth-database/03-VERIFICATION.md` — Phase 3 completion status and pattern evidence
- `.planning/phases/02-sprint-planner-agent/02-PATTERNS.md` — full code excerpts with line-level verification

### Tertiary (LOW confidence)
- `tree_formatter.py` algorithm design — standard "tree command" pattern; specific implementation not verified against running code (new file)
- LLM temperature/max_tokens recommendations — derived from existing agent settings + CONTEXT.md suggestion; not tested with actual Groq API

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all libraries verified via package.json and installed code
- Architecture patterns: HIGH — exact code from Phase 3 routes confirmed line by line
- Next.js 16 route API: HIGH — confirmed in local node_modules docs
- Pitfalls: HIGH (most) / MEDIUM (wireframe LLM output format) — based on codebase evidence
- tree_formatter algorithm: MEDIUM — standard algorithm, untested implementation
- LLM settings: LOW — suggested in CONTEXT.md but not empirically validated

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable stack; Drizzle/Clerk/LangGraph APIs unlikely to change in 30 days)
