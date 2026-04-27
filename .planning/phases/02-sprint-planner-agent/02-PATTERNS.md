# Phase 2: Sprint Planner Agent - Pattern Map

**Mapped:** 2026-04-21
**Files analyzed:** 12 new/modified files
**Analogs found:** 12 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/models/sprint_state.py` | model | transform | `backend/models/brainstorm_state.py` | exact |
| `backend/agents/sprint_planner.py` | service | request-response | `backend/agents/brainstorm.py` | exact |
| `backend/api/sprint_planner.py` | controller | streaming | `backend/api/brainstorm.py` | exact |
| `backend/prompts/sprint_planner_system.txt` | config | — | `backend/prompts/drafter_system.txt` | role-match |
| `backend/main.py` (modify) | config | — | `backend/main.py` | self |
| `frontend/app/api/sprint-planner/route.ts` | middleware | streaming | `frontend/app/api/brainstorm/route.ts` | exact |
| `frontend/context/ProjectContext.tsx` | provider | event-driven | `frontend/app/page.tsx` (useState pattern) | partial |
| `frontend/app/layout.tsx` (modify) | config | — | `frontend/app/layout.tsx` | self |
| `frontend/app/sprints/page.tsx` | component | streaming | `frontend/app/page.tsx` | role-match |
| `frontend/components/SprintCard.tsx` | component | event-driven | `frontend/components/ProjectPreview.tsx` | role-match |
| `frontend/components/SprintList.tsx` | component | event-driven | `frontend/components/ProjectPreview.tsx` | role-match |
| `backend/tests/test_sprint_planner_graph.py` | test | — | `backend/tests/test_brainstorm_graph.py` | exact |
| `backend/tests/test_sprint_sse_endpoint.py` | test | — | `backend/tests/test_sse_endpoint.py` | exact |

---

## Pattern Assignments

### `backend/models/sprint_state.py` (model, transform)

**Analog:** `backend/models/brainstorm_state.py`

**Full analog** (lines 1–37):
```python
from typing import TypedDict, List, Optional
from pydantic import BaseModel, Field


class ExtractedFields(BaseModel):
    """Structured output from the extractor node.
    All fields are Optional — the LLM may not have enough conversation context yet.
    """
    problem: Optional[str] = Field(
        None,
        description="The core problem the project solves, in one or two sentences."
    )
    # ... more Optional fields with Field(None, description=...)


class BrainstormState(TypedDict):
    conversation: List[dict]   # [{role: str, content: str}, ...]
    extracted: dict            # populated from ExtractedFields.model_dump(exclude_none=True)
    missing_fields: List[str]  # fields that are still None in ExtractedFields
    project_md: str
    status: str                # extracting | drafting | done
```

**Copy this structure for sprint_state.py.** Produce two classes:
1. A `Sprint` BaseModel with `Field(description=...)` on every field — used as structured output schema.
2. A `SprintPlan` BaseModel with `sprints: List[Sprint]` — the top-level structured output target.
3. A `SprintState` TypedDict — the LangGraph state object.

**Key Field descriptions** (from RESEARCH.md — required for Groq structured output):
```python
class Sprint(BaseModel):
    number: int = Field(description="Sprint number, starting from 1")
    goal: str = Field(description="One-sentence sprint goal")
    user_stories: List[str] = Field(description="3-5 user stories in 'As a ... I want ... so that ...' format")
    technical_tasks: List[str] = Field(description="3-7 concrete technical implementation tasks")
    definition_of_done: List[str] = Field(
        description="3-5 criteria. At least one MUST be browser-testable (e.g., 'Navigate to X, see Y')"
    )

class SprintPlan(BaseModel):
    sprints: List[Sprint] = Field(description="2-6 sprints covering the full project scope")

class SprintState(TypedDict):
    project_md: str
    sprints: List[dict]   # List of Sprint.model_dump() dicts
    status: str           # planning | done
```

---

### `backend/agents/sprint_planner.py` (service, request-response)

**Analog:** `backend/agents/brainstorm.py`

**Imports pattern** (lines 1–16 of analog):
```python
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent.parent / ".env")

from pathlib import Path
import logging

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, START, END

from models.sprint_state import SprintState, Sprint, SprintPlan

logger = logging.getLogger(__name__)
```

**Prompt loading pattern** (lines 19–21 of analog — load at module startup, not inside node):
```python
_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
SPRINT_PLANNER_PROMPT = (_PROMPTS_DIR / "sprint_planner_system.txt").read_text()
```

**LLM + structured output initialization** (lines 25–38 of analog):
```python
llm_planner = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0.3,
    max_tokens=8192,
)
structured_planner = llm_planner.with_structured_output(SprintPlan)
```

**Node pattern** (lines 82–90 of analog — drafter_node is the closest single LLM call):
```python
async def planner_node(state: SprintState) -> dict:
    """Generate all sprints from project.md in a single structured LLM call."""
    messages = [
        SystemMessage(content=SPRINT_PLANNER_PROMPT),
        HumanMessage(content=f"Project spec:\n\n{state['project_md']}"),
    ]
    result = await structured_planner.ainvoke(messages)
    return {"sprints": [s.model_dump() for s in result.sprints], "status": "done"}
```

**Graph compilation pattern** (lines 103–119 of analog):
```python
# Compile once at module import — safe to reuse across concurrent FastAPI requests
builder = StateGraph(SprintState)
builder.add_node("planner", planner_node)
builder.add_edge(START, "planner")
builder.add_edge("planner", END)
graph = builder.compile()
```

Note: Sprint planner has one node and no conditional edges — simpler than brainstorm graph. No `reviewer_router` equivalent needed.

---

### `backend/api/sprint_planner.py` (controller, streaming)

**Analog:** `backend/api/brainstorm.py`

**Imports pattern** (lines 1–8 of analog):
```python
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json

from agents.sprint_planner import graph
from models.sprint_state import SprintState
```

**Request model pattern** (lines 15–17 of analog):
```python
class SprintPlannerRequest(BaseModel):
    project_md: str
```

**Router + endpoint signature pattern** (lines 10, 24–25 of analog):
```python
router = APIRouter()

MAX_PROJECT_MD_CHARS = 50_000  # Defensive cap — RESEARCH.md Security

@router.post("/api/sprint-planner")
async def sprint_planner_endpoint(req: SprintPlannerRequest):
    """SSE endpoint. Runs LangGraph planner, yields one event per sprint, ends with [DONE].

    Truncates project_md to MAX_PROJECT_MD_CHARS before graph invocation.
    Wraps graph execution in try/except — SSE error event + [DONE] on failure.
    Never closes the stream without emitting [DONE].
    """
```

**event_stream() pattern with per-sprint iteration** (lines 43–55 of analog — critical difference: iterate sprints list after graph completes):
```python
    init_state = SprintState(
        project_md=req.project_md[:MAX_PROJECT_MD_CHARS],
        sprints=[],
        status="planning",
    )

    async def event_stream():
        try:
            # stream_mode="updates" yields only changed keys per node
            async for event in graph.astream(init_state, stream_mode="updates"):
                node_name = list(event.keys())[0]
                data = list(event.values())[0]
                if node_name == "planner" and data.get("sprints"):
                    # Iterate sprints list — emit one SSE frame per sprint
                    for sprint in data["sprints"]:
                        yield f"data: {json.dumps({'node': 'sprint', 'data': sprint})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'node': 'error', 'data': {'reason': str(e)}})}\n\n"
        finally:
            # Always emit [DONE] — even if graph raised an exception
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

**Key difference from analog:** The brainstorm endpoint yields one frame per LangGraph node. The sprint endpoint must yield one frame per sprint object by iterating `data["sprints"]` after the `planner` node completes. Do not yield the `planner` node event directly — iterate its `sprints` list.

---

### `backend/prompts/sprint_planner_system.txt` (config)

**Analog:** `backend/prompts/drafter_system.txt` (a text file read by agents at module startup)

This is a plain text file, no code pattern required. Key constraints from RESEARCH.md:
- Instruct the agent to generate 2–6 sprints based on project complexity.
- Each sprint must have: Sprint Goal, User Stories, Technical Tasks, Definition of Done.
- Each sprint's DoD must contain at least one browser-testable item (e.g., "Navigate to X, see Y").
- The system prompt must instruct the agent to treat `project_md` as data, not instructions (prompt injection defense).

---

### `backend/main.py` (modify — register new router)

**Analog:** `backend/main.py` (self — add one `include_router` call)

**Existing router registration pattern** (lines 1–8, 18 of existing file):
```python
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.brainstorm import router as brainstorm_router

app = FastAPI(title="SkeleCode API")
# ... CORS middleware ...
app.include_router(brainstorm_router)
```

**Add after line 8 (imports) and after `include_router(brainstorm_router)` (line 18):**
```python
from api.sprint_planner import router as sprint_planner_router
# ...
app.include_router(sprint_planner_router)
```

---

### `frontend/app/api/sprint-planner/route.ts` (middleware, streaming)

**Analog:** `frontend/app/api/brainstorm/route.ts`

**Full analog** (all 33 lines — copy verbatim, change only the upstream URL path):
```typescript
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

  const upstream = await fetch(`${backendUrl}/api/brainstorm`, {  // change to /api/sprint-planner
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

  // Pipe upstream SSE directly to browser — no buffering (RESEARCH.md Pitfall 2)
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Prevents NGINX buffering in production
    },
  });
}
```

**Only change:** Line 9 — `${backendUrl}/api/brainstorm` → `${backendUrl}/api/sprint-planner`. All headers, error handling, and streaming pipe are identical.

---

### `frontend/context/ProjectContext.tsx` (provider, event-driven)

**Analog:** `frontend/app/page.tsx` (useState pattern; no exact provider analog exists in Phase 1)

**useState pattern from page.tsx** (lines 1–9 of analog):
```typescript
"use client";
import { useState } from "react";
// ...
const [markdown, setMarkdown] = useState<string>("");
const [isStreaming, setIsStreaming] = useState<boolean>(false);
```

**Full provider pattern to build** (no exact analog — use RESEARCH.md Pattern 4):
```typescript
"use client";
import { createContext, useContext, useState } from "react";

interface Sprint {
  number: number;
  goal: string;
  user_stories: string[];
  technical_tasks: string[];
  definition_of_done: string[];
}

interface ProjectContextValue {
  projectMd: string;
  setProjectMd: (md: string) => void;
  sprints: Sprint[];
  setSprints: React.Dispatch<React.SetStateAction<Sprint[]>>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectContextProvider({ children }: { children: React.ReactNode }) {
  const [projectMd, setProjectMd] = useState("");
  const [sprints, setSprints] = useState<Sprint[]>([]);

  return (
    <ProjectContext.Provider value={{ projectMd, setProjectMd, sprints, setSprints }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjectContext must be used within ProjectContextProvider");
  return ctx;
}
```

**Critical:** `setSprints` must be typed as `React.Dispatch<React.SetStateAction<Sprint[]>>` (not `(sprints: Sprint[]) => void`) so that `/sprints/page.tsx` can call `setSprints((prev) => [...prev, sprint])` as a functional updater. Export the `Sprint` type from this file for reuse in SprintCard and SprintList.

---

### `frontend/app/layout.tsx` (modify — wrap with ProjectContextProvider)

**Analog:** `frontend/app/layout.tsx` (self)

**Existing layout** (all 25 lines):
```typescript
import type { Metadata } from "next";
import { CopilotKit } from "@copilotkit/react-core";
import "./globals.css";
import "@copilotkit/react-ui/styles.css";

export const metadata: Metadata = {
  title: "SkeleCode — AI Project Planner",
  description: "From idea to sprint-ready plan in minutes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white font-sans antialiased">
        <CopilotKit runtimeUrl="/api/copilotkit">
          {children}
        </CopilotKit>
      </body>
    </html>
  );
}
```

**Minimal modification — add import and wrap children:**
```typescript
import { ProjectContextProvider } from "../context/ProjectContext";
// ...
        <CopilotKit runtimeUrl="/api/copilotkit">
          <ProjectContextProvider>
            {children}
          </ProjectContextProvider>
        </CopilotKit>
```

**Do NOT add `"use client"` to layout.tsx.** This would break `export const metadata`. The `ProjectContextProvider` already has `"use client"` — Server Components can render Client Component children. (RESEARCH.md Pitfall 2)

---

### `frontend/app/sprints/page.tsx` (component, streaming)

**Analog:** `frontend/app/page.tsx`

**Imports + "use client" pattern** (lines 1–4 of analog):
```typescript
"use client";
import { useState } from "react";
import { useProjectContext } from "../../context/ProjectContext";
// also: import SprintList, import JSZip, import Link from "next/link"
```

**Header layout pattern** (lines 26–44 of analog — copy structure verbatim):
```typescript
<header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
  <span className="font-mono text-sm font-semibold tracking-tight text-gray-800">
    SkeleCode
  </span>
  <div className="flex items-center gap-2">
    {/* ← Brainstorm link */}
    <button
      onClick={handleDownloadAll}
      disabled={!isDone || sprints.length === 0}
      className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      Download all (.zip)
    </button>
  </div>
</header>
```

**Full-height flex layout pattern** (lines 24, 47 of analog):
```typescript
<div className="flex flex-col h-screen">
  {/* header */}
  <div className="flex flex-1 overflow-hidden min-h-0">
    {/* content */}
  </div>
</div>
```

**State management pattern** (lines 7–10 of analog — adapt for sprints):
```typescript
const { projectMd, sprints, setSprints } = useProjectContext();
const [isGenerating, setIsGenerating] = useState(false);
const [isDone, setIsDone] = useState(false);
```

**SSE fetch loop** — copy from `frontend/components/BrainstormChat.tsx` lines 48–93. Change:
- POST target: `/api/sprint-planner`
- Body: `{ project_md: projectMd }`
- Event handling: check `event.node === "sprint"` (not `event.node === "drafter"`)
- On sprint event: `setSprints((prev) => [...prev, event.data])`
- On `[DONE]`: `setIsGenerating(false); setIsDone(true);`

**Empty state guard pattern** (adapt from ProjectPreview.tsx lines 53–66):
```typescript
if (!projectMd) {
  return (
    <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
      Return to <Link href="/" className="underline ml-1">Brainstorm</Link> to generate a project spec first.
    </div>
  );
}
```

---

### `frontend/components/SprintCard.tsx` (component, event-driven)

**Analog:** `frontend/components/ProjectPreview.tsx`

**"use client" + typed props pattern** (lines 1–9 of analog):
```typescript
"use client";
import { useState } from "react";

interface SprintCardProps {
  sprint: Sprint;       // import Sprint type from context/ProjectContext
  defaultOpen?: boolean;
}
```

**Panel section header pattern** (lines 71–74 of analog — section dividers with border):
```typescript
<div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
  <span className="font-mono text-sm font-semibold text-gray-700">
    {label}
  </span>
</div>
```

**Disabled button pattern** (lines 82–86 of analog):
```typescript
className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
```

**Accordion open/close state** (no direct analog — use RESEARCH.md Pattern 5):
```typescript
export function SprintCard({ sprint, defaultOpen = false }: SprintCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded mb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-mono text-sm font-semibold">
          Sprint {sprint.number} — {sprint.goal}
        </span>
        <span className="text-gray-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 space-y-4">
          {/* User Stories, Technical Tasks, Definition of Done sections */}
        </div>
      )}
    </div>
  );
}
```

**defaultOpen behavior:** `useState(defaultOpen)` means the prop only controls initial state. Passing `defaultOpen={true}` to a newly mounted card opens it. Passing it to an already-mounted card does nothing — user collapse is preserved. This is correct per D-03.

---

### `frontend/components/SprintList.tsx` (component, event-driven)

**Analog:** `frontend/components/ProjectPreview.tsx` (list rendering section)

**"use client" + typed props pattern** (lines 1–9 of analog):
```typescript
"use client";
import { SprintCard } from "./SprintCard";
import { Sprint } from "../context/ProjectContext";

interface SprintListProps {
  sprints: Sprint[];
  isGenerating: boolean;
}
```

**Ordered list rendering with SprintCard.** Each card receives `defaultOpen={true}` so it auto-expands on arrival (D-03). The generating pulse indicator mirrors the `animate-pulse` pattern from ProjectPreview.tsx line 78:

```typescript
{isGenerating && (
  <span className="text-xs text-gray-400 font-mono animate-pulse px-4 py-2">
    Generating sprints...
  </span>
)}
{sprints.map((sprint) => (
  <SprintCard key={sprint.number} sprint={sprint} defaultOpen={true} />
))}
```

**Empty state pattern** (lines 53–66 of analog — adapt):
```typescript
if (sprints.length === 0 && !isGenerating) {
  return (
    <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
      Click "Generate Sprints" to plan your project
    </div>
  );
}
```

---

### `backend/tests/test_sprint_planner_graph.py` (test)

**Analog:** `backend/tests/test_brainstorm_graph.py`

**Test file structure** (lines 1–7 of analog):
```python
import pytest
from models.sprint_state import SprintState, Sprint, SprintPlan
```

**Class-based test grouping pattern** (lines 6–54 of analog):
```python
class TestPlannerNode:
    """Tests for planner_node — requires mocking LLM calls."""

    @pytest.mark.asyncio
    async def test_planner_node_returns_sprints_list(self):
        # mock structured_planner.ainvoke
        ...

class TestSprintCountBounds:
    def test_sprint_count_bounds(self):
        ...

class TestGraphCompiles:
    def test_graph_is_not_none(self):
        from agents.sprint_planner import graph
        assert graph is not None
```

**Prompt loading test pattern** (lines 87–102 of analog):
```python
class TestPromptsLoaded:
    def test_sprint_planner_prompt_non_empty(self):
        from agents.sprint_planner import SPRINT_PLANNER_PROMPT
        assert isinstance(SPRINT_PLANNER_PROMPT, str)
        assert len(SPRINT_PLANNER_PROMPT) > 50
```

---

### `backend/tests/test_sprint_sse_endpoint.py` (test)

**Analog:** `backend/tests/test_sse_endpoint.py`

**Fixtures and helper pattern** (lines 1–27 of analog):
```python
import pytest
import json
from unittest.mock import patch
from fastapi.testclient import TestClient


def make_mock_sprint_event(sprint_list: list):
    """Helper — creates an astream() event dict with planner node output."""
    return {"planner": {"sprints": sprint_list, "status": "done"}}


@pytest.fixture
def client():
    from main import app
    return TestClient(app)


@pytest.fixture
def valid_payload():
    return {"project_md": "# Vision\nA recipe sharing app for home cooks."}
```

**mock_astream pattern** (lines 40–47 of analog):
```python
async def mock_astream(state, stream_mode=None):
    for event in mock_events:
        yield event

with patch("api.sprint_planner.graph") as mock_graph:
    mock_graph.astream = mock_astream
    response = client.post("/api/sprint-planner", json=valid_payload)
```

**[DONE] always emitted test** (lines 70–81 of analog — copy with path change):
```python
def test_done_emitted_even_on_graph_exception(self, client, valid_payload):
    async def failing_astream(state, stream_mode=None):
        raise RuntimeError("Simulated graph failure")
        yield

    with patch("api.sprint_planner.graph") as mock_graph:
        mock_graph.astream = failing_astream
        response = client.post("/api/sprint-planner", json=valid_payload)

    assert "data: [DONE]" in response.text
    assert '"node": "error"' in response.text
```

**One-frame-per-sprint test** (new test, no analog — key Phase 2 invariant):
```python
def test_stream_yields_one_frame_per_sprint(self, client, valid_payload):
    mock_sprints = [
        {"number": 1, "goal": "Setup", "user_stories": [], "technical_tasks": [], "definition_of_done": []},
        {"number": 2, "goal": "Core", "user_stories": [], "technical_tasks": [], "definition_of_done": []},
    ]

    async def mock_astream(state, stream_mode=None):
        yield {"planner": {"sprints": mock_sprints, "status": "done"}}

    with patch("api.sprint_planner.graph") as mock_graph:
        mock_graph.astream = mock_astream
        response = client.post("/api/sprint-planner", json=valid_payload)

    sprint_lines = [
        line for line in response.text.split("\n")
        if line.startswith("data: ") and '"node": "sprint"' in line
    ]
    assert len(sprint_lines) == 2, f"Expected 2 sprint frames, got {len(sprint_lines)}"
```

---

## Shared Patterns

### "use client" Component Structure
**Source:** `frontend/components/BrainstormChat.tsx` lines 1–2, `frontend/components/ProjectPreview.tsx` lines 1–2
**Apply to:** All new frontend components and pages (`SprintCard.tsx`, `SprintList.tsx`, `sprints/page.tsx`, `ProjectContext.tsx`)
```typescript
"use client";
import { useState } from "react";
```

### SSE Fetch + TextDecoder Loop
**Source:** `frontend/components/BrainstormChat.tsx` lines 56–91
**Apply to:** `frontend/app/sprints/page.tsx` (the `generateSprints` function)
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

    if (payload === "[DONE]") {
      // handle done
      return;
    }

    try {
      const event = JSON.parse(payload);
      // handle event
    } catch {
      // Partial JSON — skip
    }
  }
}
```

### Header Button Style
**Source:** `frontend/app/page.tsx` lines 31–43
**Apply to:** All header buttons in `sprints/page.tsx` and `page.tsx` (Plan Sprints link)
```typescript
className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
```

### Disabled Button Style
**Source:** `frontend/components/ProjectPreview.tsx` lines 82–86
**Apply to:** Download button in `sprints/page.tsx`
```typescript
disabled={!isDone || sprints.length === 0}
className="... disabled:opacity-40 disabled:cursor-not-allowed"
```

### FastAPI SSE Event Shape
**Source:** `backend/api/brainstorm.py` lines 50–52
**Apply to:** `backend/api/sprint_planner.py`
```python
yield f"data: {json.dumps({'node': node_name, 'data': data})}\n\n"
# For sprint planner:
yield f"data: {json.dumps({'node': 'sprint', 'data': sprint})}\n\n"
```

### Always-Emit [DONE] Pattern
**Source:** `backend/api/brainstorm.py` lines 52–55
**Apply to:** `backend/api/sprint_planner.py`
```python
except Exception as e:
    yield f"data: {json.dumps({'node': 'error', 'data': {'reason': str(e)}})}\n\n"
finally:
    yield "data: [DONE]\n\n"
```

### Groq with_structured_output
**Source:** `backend/agents/brainstorm.py` lines 36–38
**Apply to:** `backend/agents/sprint_planner.py`
```python
structured_extractor = llm_extractor.with_structured_output(ExtractedFields)
# → for sprint planner:
structured_planner = llm_planner.with_structured_output(SprintPlan)
```

### load_dotenv at Agent Module Top
**Source:** `backend/agents/brainstorm.py` lines 1–3
**Apply to:** `backend/agents/sprint_planner.py` — must be first two lines before any langchain imports
```python
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent.parent / ".env")
```

### Client-Side Blob Download
**Source:** `frontend/components/ProjectPreview.tsx` lines 18–24
**Apply to:** Download handler in `frontend/app/sprints/page.tsx` (with JSZip producing the blob instead of raw text)
```typescript
const handleDownload = () => {
  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "project.md";
  a.click();
  URL.revokeObjectURL(url);
};
```

### pytest Mock Pattern for LangGraph
**Source:** `backend/tests/test_sse_endpoint.py` lines 7–9, 41–47
**Apply to:** `backend/tests/test_sprint_sse_endpoint.py`
```python
def make_mock_event(node_name: str, data: dict):
    return {node_name: data}

async def mock_astream(state, stream_mode=None):
    for event in mock_events:
        yield event

with patch("api.sprint_planner.graph") as mock_graph:
    mock_graph.astream = mock_astream
```

---

## No Analog Found

All files have close analogs. No files require pure RESEARCH.md patterns.

---

## Metadata

**Analog search scope:** `backend/agents/`, `backend/api/`, `backend/models/`, `backend/tests/`, `frontend/app/`, `frontend/components/`
**Files scanned:** 13 project source files (excluding venv)
**Pattern extraction date:** 2026-04-21
