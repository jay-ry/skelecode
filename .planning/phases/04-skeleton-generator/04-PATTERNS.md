# Phase 4: Skeleton Generator - Pattern Map

**Mapped:** 2026-04-22
**Files analyzed:** 11 new/modified files
**Analogs found:** 10 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/models/skeleton_state.py` | model | transform | `backend/models/sprint_state.py` | exact |
| `backend/agents/skeleton.py` | service | event-driven | `backend/agents/sprint_planner.py` | role-match (multi-node vs single-node) |
| `backend/api/skeleton.py` | controller | streaming | `backend/api/sprint_planner.py` | exact |
| `backend/utils/__init__.py` | config | — | `backend/models/__init__.py` | exact (empty init file) |
| `backend/utils/tree_formatter.py` | utility | transform | none | no analog |
| `frontend/app/api/skeleton/route.ts` | middleware | request-response | `frontend/app/api/sprint-planner/route.ts` | exact |
| `frontend/app/api/projects/[id]/skeleton/route.ts` | controller | CRUD | `frontend/app/api/projects/[id]/sprints/route.ts` + `[id]/route.ts` | exact |
| `frontend/lib/db/schema.ts` | model | CRUD | self (modification only) | exact |
| `frontend/app/skeleton/page.tsx` | component | streaming | `frontend/app/sprints/page.tsx` | exact |
| `frontend/components/FolderTree.tsx` | component | request-response | `frontend/components/SprintCard.tsx` | role-match |
| `frontend/components/WireframePreview.tsx` | component | request-response | `frontend/components/ProjectPreview.tsx` | role-match |

---

## Pattern Assignments

### `backend/models/skeleton_state.py` (model, transform)

**Analog:** `backend/models/sprint_state.py`

**Full analog** (lines 1-31):
```python
from typing import TypedDict, List
from pydantic import BaseModel, Field

class SprintState(TypedDict):
    project_md: str
    sprints: List[dict]
    status: str
```

**Imports pattern to copy** (lines 1-2):
```python
from typing import TypedDict, List
```

**Core TypedDict pattern** — copy structure from `backend/models/sprint_state.py` lines 27-31, expand with skeleton fields:
```python
class SkeletonState(TypedDict):
    project_md: str
    sprints: List[dict]
    tech_stack: dict           # {frontend: str, backend: str, db: str | None}
    file_list: List[str]       # ["frontend/app/layout.tsx", ...]
    folder_tree: str           # formatted ASCII tree string
    wireframe_html: str        # complete HTML string
    status: str                # resolving | building_tree | building_wireframe | done
```

No Pydantic BaseModel needed — the whole state is a TypedDict. Each node returns a partial dict update (not a structured output object).

---

### `backend/agents/skeleton.py` (service, event-driven)

**Analog:** `backend/agents/sprint_planner.py` (single-node graph); secondary analog `backend/agents/brainstorm.py` (multi-node graph with separate LLM instances per node)

**Critical constraint:** `load_dotenv` MUST be the first 3 lines of the file, before any `langchain_groq` or `langgraph` imports.

**Imports pattern** (`backend/agents/sprint_planner.py` lines 1-13):
```python
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent.parent / ".env")

from pathlib import Path
import logging

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, START, END

from models.skeleton_state import SkeletonState
```

**Multi-LLM instance pattern** (`backend/agents/brainstorm.py` lines 25-34) — use separate ChatGroq instances per node temperature:
```python
llm_extractor = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0.0,
    max_tokens=1024,
)
llm_drafter = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0.7,
    max_tokens=4096,
)
```

Translate to skeleton nodes: `stack_resolver` (temp=0.0, max_tokens=512), `tree_builder` (temp=0.0, max_tokens=2048), `wireframe_builder` (temp=0.5, max_tokens=1500).

**Graph compile pattern** (`backend/agents/sprint_planner.py` lines 53-59):
```python
builder = StateGraph(SprintState)
builder.add_node("planner", planner_node)
builder.add_edge(START, "planner")
builder.add_edge("planner", END)
graph = builder.compile()
```

Translate to 3-node linear graph:
```python
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

**Node function pattern** (`backend/agents/sprint_planner.py` lines 32-50):
```python
async def planner_node(state: SprintState) -> dict:
    messages = [
        SystemMessage(content=SPRINT_PLANNER_PROMPT),
        HumanMessage(content=f"Project spec:\n\n{state['project_md']}"),
    ]
    result: SprintPlan = await structured_planner.ainvoke(messages)
    return {
        "sprints": [s.model_dump() for s in result.sprints],
        "status": "done",
    }
```

For skeleton nodes: each node returns a partial dict that updates SkeletonState (e.g., `stack_resolver` returns `{"tech_stack": {...}, "status": "building_tree"}`). The `wireframe_builder` uses plain `llm.ainvoke()` (not structured output) and returns `response.content` directly — add `re.sub` post-processing to strip markdown fences:
```python
import re
html = re.sub(r'^```html\n|```$', '', result.strip(), flags=re.MULTILINE)
```

**Prompts:** Load from `backend/prompts/` directory at module startup (not inside node functions) — pattern from `backend/agents/sprint_planner.py` lines 17-18:
```python
_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
SKELETON_STACK_RESOLVER_PROMPT = (_PROMPTS_DIR / "skeleton_stack_resolver_system.txt").read_text()
```

---

### `backend/api/skeleton.py` (controller, streaming)

**Analog:** `backend/api/sprint_planner.py` — copy this file almost verbatim, with two key differences: (1) two SSE event types instead of one, (2) `sprints` field added to request model.

**Imports pattern** (`backend/api/sprint_planner.py` lines 1-8):
```python
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json

from agents.skeleton import graph
from models.skeleton_state import SkeletonState
```

**Request model** — add `List[dict]` field (not in sprint_planner):
```python
from typing import List

class SkeletonRequest(BaseModel):
    project_md: str
    sprints: List[dict]
```

**Truncation constants** (`backend/api/sprint_planner.py` line 11 pattern):
```python
MAX_PROJECT_MD_CHARS = 50_000
MAX_SPRINTS = 6
```

**Init state pattern** (`backend/api/sprint_planner.py` lines 26-30):
```python
init_state = SprintState(
    project_md=req.project_md[:MAX_PROJECT_MD_CHARS],
    sprints=[],
    status="planning",
)
```

Translate to skeleton:
```python
init_state = SkeletonState(
    project_md=req.project_md[:MAX_PROJECT_MD_CHARS],
    sprints=req.sprints[:MAX_SPRINTS],
    tech_stack={}, file_list=[],
    folder_tree="", wireframe_html="",
    status="resolving",
)
```

**SSE event_stream pattern** (`backend/api/sprint_planner.py` lines 32-47) — copy structure, change event routing:
```python
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
```

NOTE: Event shape uses `type` key (not `node` key) — this is a deliberate departure from sprint_planner's `{'node': ..., 'data': ...}` shape. The frontend must check `event.type === 'tree_line'`.

**StreamingResponse return** (`backend/api/sprint_planner.py` line 49):
```python
return StreamingResponse(event_stream(), media_type="text/event-stream")
```

---

### `backend/utils/__init__.py` (config, empty)

**Analog:** `backend/models/__init__.py` (empty file, makes directory a Python package)

```bash
# Verify pattern:
cat /home/jayry/projects/skelecode/backend/models/__init__.py
```

Create as an empty file. Without this, `from utils.tree_formatter import format_tree` will raise `ModuleNotFoundError`.

---

### `backend/utils/tree_formatter.py` (utility, transform)

**No analog in codebase** — this is the only pure Python utility file in the project. No existing `utils/` directory. Implement from scratch.

See "No Analog Found" section below. Use the algorithm from RESEARCH.md Pattern 9.

---

### `frontend/app/api/skeleton/route.ts` (middleware, request-response)

**Analog:** `frontend/app/api/sprint-planner/route.ts` — copy verbatim, change only the URL path.

**Full file** (`frontend/app/api/sprint-planner/route.ts` lines 1-33):
```typescript
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

  const upstream = await fetch(`${backendUrl}/api/sprint-planner`, {  // change to /api/skeleton
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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

Only change: `${backendUrl}/api/sprint-planner` → `${backendUrl}/api/skeleton`. No auth on this proxy (same as sprint-planner). No new imports.

---

### `frontend/app/api/projects/[id]/skeleton/route.ts` (controller, CRUD)

**Analog:** `frontend/app/api/projects/[id]/sprints/route.ts` (PUT pattern) + `frontend/app/api/projects/[id]/route.ts` (GET pattern)

**Imports pattern** (`frontend/app/api/projects/[id]/sprints/route.ts` lines 1-5):
```typescript
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, skeletons } from "@/lib/db/schema";  // import skeletons (not sprints)
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
```

**Params pattern — Next.js 16 required** (`frontend/app/api/projects/[id]/sprints/route.ts` lines 19-23):
```typescript
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
```

**Auth + ownership check pattern** (`frontend/app/api/projects/[id]/sprints/route.ts` lines 24-38):
```typescript
const { userId } = await auth();
if (!userId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const [owned] = await db
  .select({ id: projects.id })
  .from(projects)
  .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
  .limit(1);

if (!owned) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
```

**DELETE + INSERT pattern** (`frontend/app/api/projects/[id]/sprints/route.ts` lines 50-63):
```typescript
await db.delete(sprints).where(eq(sprints.projectId, projectId));

if (sprintData.length > 0) {
  await db.insert(sprints).values(/* ... */);
}
```

Translate to skeleton (no array — single row):
```typescript
await db.delete(skeletons).where(eq(skeletons.projectId, projectId));
await db.insert(skeletons).values({
  projectId,
  folderTree: body.folder_tree ?? null,
  wireframeHtml: body.wireframe_html ?? null,
});
```

**GET pattern** (`frontend/app/api/projects/[id]/route.ts` lines 9-36) — same params + auth + ownership, then select:
```typescript
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

---

### `frontend/lib/db/schema.ts` (model, CRUD — modification)

**Analog:** self — add to end of existing file

**Existing imports** (`frontend/lib/db/schema.ts` line 1) — all needed types already imported, no new imports required:
```typescript
import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
```

**Existing table pattern to follow** (`frontend/lib/db/schema.ts` lines 12-22):
```typescript
export const sprints = pgTable("sprints", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sprintNumber: integer("sprint_number").notNull(),
  goal: text("goal"),
  contentMd: text("content_md"),
  sprintData: jsonb("sprint_data"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Skeletons table to append** — add after line 23 (end of file):
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

After schema edit, run from `frontend/`:
```bash
npx drizzle-kit push
```

---

### `frontend/app/skeleton/page.tsx` (component, streaming)

**Analog:** `frontend/app/sprints/page.tsx` — closest match for SSE consumption loop, page layout, empty state guard, ProjectContext usage, useRef accumulator, JSZip download.

**Imports pattern** (`frontend/app/sprints/page.tsx` lines 1-7):
```typescript
"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import JSZip from "jszip";
import { Header } from "../../components/Header";
import { useProjectContext } from "../../context/ProjectContext";
```

Replace `SprintList` import with `FolderTree` and `WireframePreview`.

**State declarations** (`frontend/app/sprints/page.tsx` lines 27-34):
```typescript
const { projectMd, sprints, setSprints, projectId } = useProjectContext();
const [isGenerating, setIsGenerating] = useState<boolean>(false);
const [isDone, setIsDone] = useState<boolean>(false);
const [errorMsg, setErrorMsg] = useState<string | null>(null);
const accumulatedSprintsRef = useRef<Sprint[]>([]);
```

Translate for skeleton — replace sprint ref with folderTree ref:
```typescript
const { projectMd, sprints, projectId } = useProjectContext();
const [isGenerating, setIsGenerating] = useState<boolean>(false);
const [isDone, setIsDone] = useState<boolean>(false);
const [folderTree, setFolderTree] = useState<string>("");
const [wireframeHtml, setWireframeHtml] = useState<string>("");
const [errorMsg, setErrorMsg] = useState<string | null>(null);
// useRef avoids stale closure when reading folderTree at [DONE] time (RESEARCH.md Pitfall 2)
const folderTreeRef = useRef<string>("");
const wireframeHtmlRef = useRef<string>("");
```

**SSE fetch + TextDecoder buffer loop** (`frontend/app/sprints/page.tsx` lines 49-118) — the core pattern to copy:
```typescript
const response = await fetch("/api/skeleton", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ project_md: projectMd, sprints }),
});

if (!response.ok || !response.body) {
  throw new Error(`Stream failed: ${response.status}`);
}

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();

    if (payload === "[DONE]") {
      setIsGenerating(false);
      setIsDone(true);
      // Save to DB using refs (not state — stale closure)
      if (projectId) {
        fetch(`/api/projects/${projectId}/skeleton`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folder_tree: folderTreeRef.current,
            wireframe_html: wireframeHtmlRef.current,
          }),
        }).catch((e) => console.warn("[SkeletonPage] Save skipped", e));
      }
      return;
    }

    try {
      const event = JSON.parse(payload);
      // NOTE: uses 'type' key, NOT 'node' key (different from sprint_planner events)
      if (event.type === "tree_line") {
        const line = event.line as string;
        folderTreeRef.current = folderTreeRef.current
          ? folderTreeRef.current + "\n" + line
          : line;
        setFolderTree(folderTreeRef.current);
      } else if (event.type === "wireframe") {
        wireframeHtmlRef.current = event.html as string;
        setWireframeHtml(event.html as string);
      } else if (event.type === "error") {
        setErrorMsg(event.reason ?? "Unknown backend error");
      }
    } catch {
      // Partial JSON — skip
    }
  }
}
```

**Empty state guard** (`frontend/app/sprints/page.tsx` lines 37, 159-169):
```typescript
const noSprints = sprints.length === 0;
// ...
{noSprints ? (
  <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[#7abfb8] text-sm">
    <p className="font-semibold text-[#c8f0ea]">No sprints loaded</p>
    <p>
      Return to{" "}
      <Link href="/sprints" className="underline text-[#00ffe0] hover:text-[#c8f0ea] transition-colors">
        Sprint Planner
      </Link>{" "}
      to generate sprints first.
    </p>
  </div>
) : ( /* main content */ )}
```

**JSZip download pattern** (`frontend/app/sprints/page.tsx` lines 125-143):
```typescript
const handleDownload = async () => {
  if (isGenerating || !isDone || folderTree === "" || wireframeHtml === "") return;
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

**Page mount load (useEffect)** — no analog in existing pages; implement from scratch:
```typescript
import { useState, useRef, useEffect } from "react";

useEffect(() => {
  if (!projectId) return;
  fetch(`/api/projects/${projectId}/skeleton`)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data?.folder_tree) {
        setFolderTree(data.folder_tree);
        folderTreeRef.current = data.folder_tree;
      }
      if (data?.wireframe_html) {
        setWireframeHtml(data.wireframe_html);
        wireframeHtmlRef.current = data.wireframe_html;
      }
      if (data?.folder_tree || data?.wireframe_html) setIsDone(true);
    })
    .catch(() => { /* silent — no saved skeleton is fine */ });
}, [projectId]);
```

**Two-panel layout** — copy h-screen flex pattern from `frontend/app/sprints/page.tsx` line 148:
```typescript
<div className="flex flex-col h-screen bg-[#020408]">
  <Header ... />
  <div className="flex flex-1 overflow-hidden min-h-0">
    {/* Left panel — folder tree */}
    <div className="w-1/2 flex flex-col border-r border-[rgba(0,255,224,0.15)] overflow-y-auto p-4">
      ...
    </div>
    {/* Right panel — wireframe */}
    <div className="w-1/2 flex flex-col overflow-hidden p-4">
      ...
    </div>
  </div>
</div>
```

---

### `frontend/components/FolderTree.tsx` (component, request-response)

**Analog:** `frontend/components/SprintCard.tsx` — "use client" component structure with local toggle state.

**Imports + component shell** (`frontend/components/SprintCard.tsx` lines 1-4):
```typescript
"use client";
import { useState } from "react";
```

**Props interface pattern** (`frontend/components/SprintCard.tsx` lines 5-8):
```typescript
interface FolderTreeProps {
  tree: string;          // full ASCII tree string
  isStreaming?: boolean; // collapse/expand disabled during streaming
}
```

**Core render** — ASCII tree in `<pre>` with monospace font:
```typescript
<pre className="font-mono text-sm text-[#c8f0ea] whitespace-pre leading-relaxed">
  {tree}
</pre>
```

**Clipboard copy pattern** — use `navigator.clipboard.writeText` (no external library):
```typescript
const handleCopy = async () => {
  await navigator.clipboard.writeText(tree);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};
```

**Button style to match existing** (`frontend/components/SprintCard.tsx` lines 25-34):
```typescript
<button
  type="button"
  onClick={handleCopy}
  className="text-sm px-3 py-1 border border-[rgba(0,255,224,0.15)] rounded text-[#c8f0ea] hover:bg-[#050d14] hover:border-[#00ffe0] transition-colors"
>
  {copied ? "Copied!" : "Copy"}
</button>
```

---

### `frontend/components/WireframePreview.tsx` (component, request-response)

**Analog:** `frontend/components/ProjectPreview.tsx` — display panel component (read-only output, no editable state).

**Component shell** — "use client" with props interface:
```typescript
"use client";

interface WireframePreviewProps {
  html: string;          // complete HTML string from wireframe_builder
  isLoading?: boolean;   // shows placeholder when waiting for first event
}
```

**iframe srcDoc pattern** (from CONTEXT.md specifics — no codebase analog):
```typescript
<iframe
  srcDoc={html}
  sandbox="allow-scripts"
  style={{ width: "100%", height: "500px", border: "1px solid #e5e7eb" }}
  title="Sprint 1 Wireframe"
/>
```

NEVER add `allow-same-origin` to sandbox — dangerous combination per RESEARCH.md Pitfall 5.

**Open in new tab pattern** (blob URL — no analog in codebase):
```typescript
const handleOpenInNewTab = () => {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  // Do NOT revoke URL immediately — the new tab needs it alive
};
```

**Loading placeholder** — show when `isLoading && !html`:
```typescript
{isLoading && !html ? (
  <div className="flex items-center justify-center h-[500px] border border-[rgba(0,255,224,0.15)] rounded text-[#7abfb8] text-sm font-mono animate-pulse">
    Generating wireframe...
  </div>
) : (
  <iframe ... />
)}
```

---

## Shared Patterns

### Authentication + Authorization
**Source:** `frontend/app/api/projects/[id]/sprints/route.ts` lines 24-38
**Apply to:** `frontend/app/api/projects/[id]/skeleton/route.ts` (both PUT and GET handlers)
```typescript
const { userId } = await auth();
if (!userId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
const [owned] = await db
  .select({ id: projects.id })
  .from(projects)
  .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
  .limit(1);
if (!owned) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
```

### Next.js 16 Params Pattern
**Source:** `frontend/app/api/projects/[id]/sprints/route.ts` lines 19-23
**Apply to:** `frontend/app/api/projects/[id]/skeleton/route.ts` (all handlers)
```typescript
{ params }: { params: Promise<{ id: string }> }
// ...
const { id: projectId } = await params;
```
Plain `{ params: { id: string } }` without `Promise<>` fails in Next.js 16.

### load_dotenv First-Lines Invariant
**Source:** `backend/agents/sprint_planner.py` lines 1-3
**Apply to:** `backend/agents/skeleton.py`
```python
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent.parent / ".env")
```
This MUST be the first 3 lines. All `langchain_groq` / `langgraph` imports come after.

### FastAPI Router Registration
**Source:** `backend/main.py` lines 7-20
**Apply to:** `backend/main.py` (modification — add skeleton router)
```python
from api.skeleton import router as skeleton_router
# after existing include_router calls:
app.include_router(skeleton_router)
```

### SSE TextDecoder Buffer Loop
**Source:** `frontend/app/sprints/page.tsx` lines 59-118 (also `frontend/components/BrainstormChat.tsx` lines 67-121)
**Apply to:** `frontend/app/skeleton/page.tsx`
```typescript
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (payload === "[DONE]") { /* handle done */ return; }
    try {
      const event = JSON.parse(payload);
      /* handle event */
    } catch { /* partial JSON — skip */ }
  }
}
```

### useRef Accumulator (Stale Closure Prevention)
**Source:** `frontend/app/sprints/page.tsx` lines 34, 81-82
**Apply to:** `frontend/app/skeleton/page.tsx` for `folderTreeRef` and `wireframeHtmlRef`
```typescript
const accumulatedSprintsRef = useRef<Sprint[]>([]);
// ... inside [DONE] handler:
const accumulatedSprints = accumulatedSprintsRef.current;
```
Without refs, the PUT body at `[DONE]` time reads stale empty state. Keep ref and state in sync on every append.

### DELETE + INSERT Pattern (not UPSERT)
**Source:** `frontend/app/api/projects/[id]/sprints/route.ts` lines 50-63
**Apply to:** `frontend/app/api/projects/[id]/skeleton/route.ts` PUT handler
```typescript
await db.delete(skeletons).where(eq(skeletons.projectId, projectId));
await db.insert(skeletons).values({ projectId, folderTree: ..., wireframeHtml: ... });
```

### Tailwind Color Palette
**Source:** Throughout `frontend/components/SprintCard.tsx` and `frontend/app/sprints/page.tsx`
**Apply to:** All new frontend components and pages
- Background: `bg-[#020408]`
- Border: `border-[rgba(0,255,224,0.15)]`
- Text primary: `text-[#c8f0ea]`
- Text accent: `text-[#00ffe0]`
- Text muted: `text-[#7abfb8]`
- Error: `text-[#ff003c]`
- Hover bg: `hover:bg-[#050d14]`
- Hover border: `hover:border-[#00ffe0]`

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `backend/utils/tree_formatter.py` | utility | transform | No utility files exist in codebase (`backend/utils/` directory does not exist yet). Pure Python recursive algorithm — implement from scratch using RESEARCH.md Pattern 9. |

**Implementation reference for tree_formatter.py** (from RESEARCH.md Pattern 9 — algorithm is standard, no codebase analog):
```python
def format_tree(file_list: list[str]) -> str:
    tree = {}
    for path in sorted(file_list):
        parts = path.split("/")
        node = tree
        for part in parts[:-1]:
            node = node.setdefault(part + "/", {})
        node[parts[-1]] = None

    lines = []
    def render(node, prefix=""):
        items = list(node.items())
        for i, (name, children) in enumerate(items):
            is_last = (i == len(items) - 1)
            connector = "└── " if is_last else "├── "
            lines.append(prefix + connector + name)
            if children is not None:
                extension = "    " if is_last else "│   "
                render(children, prefix + extension)
    render(tree)
    return "\n".join(lines)
```

Also create `backend/utils/__init__.py` as an empty file to make `utils/` a Python package.

---

## Metadata

**Analog search scope:** `backend/agents/`, `backend/api/`, `backend/models/`, `frontend/app/`, `frontend/components/`, `frontend/context/`, `frontend/lib/db/`
**Files scanned:** 13 source files read directly
**Pattern extraction date:** 2026-04-22
