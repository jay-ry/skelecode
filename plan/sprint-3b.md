# Sprint 3b — Skeleton Generator

**Duration:** Week 6
**Claude Code session concern:** One LangGraph skeleton agent + folder tree UI + HTML wireframe + `/skeleton` page
**Files touched:** ~10
**External services wired:** None new (uses existing FastAPI + Anthropic)

---

## Sprint Goal

A user can navigate to `/skeleton`, click "Generate Skeleton", and receive two outputs: an ASCII folder/file tree for their chosen stack, and a basic HTML wireframe of the Sprint 1 UI — both rendered live and downloadable.

---

## Claude Code Instructions

> "We are extending SkeleCode. Sprints 1–3a are complete. This sprint adds the Skeleton Generator: a new LangGraph agent that reads the sprint plan and produces two outputs — an ASCII folder tree and an HTML wireframe for Sprint 1. Add a `/skeleton` page with two side-by-side panels. No new external services — uses the existing FastAPI backend and Anthropic API."

---

## File Map

```
frontend/
  app/
    skeleton/
      page.tsx              ← skeleton page (tree panel + wireframe panel)
  components/
    FolderTree.tsx          ← renders ASCII tree with monospace + copy button
    WireframePreview.tsx    ← renders HTML wireframe in sandboxed iframe
    GenerateSkeleton.tsx    ← trigger button + useCopilotAction

backend/
  agents/
    skeleton.py             ← LangGraph skeleton graph
  models/
    skeleton_state.py       ← SkeletonState TypedDict
  api/
    skeleton.py             ← POST /api/skeleton SSE endpoint
  utils/
    tree_formatter.py       ← formats raw file list into ASCII tree string
```

---

## Frontend Tasks

### F1 — Skeleton page (`/skeleton`)
- Two panels side by side (50/50 split):
  - Left: "Folder structure" — monospace text rendering of ASCII tree
  - Right: "Sprint 1 wireframe" — iframe showing the generated HTML
- "Generate Skeleton" button at the top
- If no sprints in context/DB: show "Complete the sprint planner first" with a link

### F2 — FolderTree component
- Renders the ASCII tree string in a `<pre>` block with monospace font
- "Copy to clipboard" button (uses `navigator.clipboard.writeText`)
- Tree streams in line by line — append each line as it arrives
- Collapse/expand directories on click (post-streaming only)

### F3 — WireframePreview component
- Renders HTML in a sandboxed `<iframe>`:
  ```tsx
  <iframe
    srcDoc={wireframeHtml}
    sandbox="allow-scripts"
    style={{ width: '100%', height: '500px', border: '1px solid #e5e7eb' }}
  />
  ```
- Shows a loading placeholder until HTML is received
- "Open in new tab" button — `window.open(URL.createObjectURL(new Blob([html], {type: 'text/html'})))`

### F4 — GenerateSkeleton + useCopilotAction
- `useCopilotAction("generateSkeleton")`:
  - Parameters: `{ project_md: string, sprints: Sprint[] }`
  - Handler: POST `/api/skeleton`, consume SSE stream
  - Two event types: `{ type: 'tree_line', line: string }` and `{ type: 'wireframe', html: string }`
  - On `tree_line`: append to folder tree state
  - On `wireframe`: set wireframe HTML state

### F5 — Download button
- "Download skeleton.zip" — uses `jszip`
- Contains:
  - `structure.txt` — the full ASCII folder tree
  - `wireframe.html` — the complete HTML wireframe
- Available once both outputs are complete

### F6 — Save to DB (extends sprint 3a)
- After generation completes, call `PUT /api/projects/{id}/skeleton`
- Use the existing project_id from context
- Show "Saved ✓" toast

---

## Backend Tasks

### B1 — SkeletonState
```python
# models/skeleton_state.py
from typing import TypedDict, List

class SkeletonState(TypedDict):
    project_md: str
    sprints: List[dict]
    tech_stack: dict          # {frontend: str, backend: str, db: str | None}
    file_list: List[str]      # flat list of file paths e.g. ["frontend/app/layout.tsx", ...]
    folder_tree: str          # formatted ASCII tree
    wireframe_html: str       # complete HTML string
    status: str               # resolving | building_tree | building_wireframe | done
```

### B2 — Skeleton LangGraph graph

```
Nodes:
  stack_resolver
    - reads project_md + sprints
    - confirms final tech_stack: {frontend, backend, db}
    - example: {frontend: "Next.js 14", backend: "FastAPI", db: "Supabase"}

  tree_builder
    - given tech_stack, generates file_list
    - rules by stack:
        Next.js:  app/, components/, lib/, public/, next.config.ts, package.json, tsconfig.json
        FastAPI:  main.py, agents/, models/, api/, db/, utils/, requirements.txt, .env.example
        Supabase: migrations/001_init.sql
    - passes file_list to tree_formatter utility → folder_tree string

  wireframe_builder
    - reads sprints[0] (Sprint 1 only)
    - extracts: sprint goal + frontend tasks
    - generates a single-file HTML wireframe:
        - inline CSS only (no external deps, no CDN)
        - renders the Sprint 1 screens: nav, main layout, placeholder components
        - annotates each section: <!-- Sprint 1: [task name] -->
        - dark-ish neutral color palette, readable at a glance
        - does NOT need to be production-ready — just scannable

Edges:
  stack_resolver → tree_builder → wireframe_builder → END
```

### B3 — Tree formatter utility
```python
# utils/tree_formatter.py

def format_tree(file_list: list[str]) -> str:
    """
    Input:  ["frontend/app/layout.tsx", "frontend/app/page.tsx", "backend/main.py"]
    Output: ASCII tree string like:
      frontend/
      ├── app/
      │   ├── layout.tsx
      │   └── page.tsx
      backend/
      └── main.py
    """
    ...
```

This is pure Python string manipulation — no LLM call needed.

### B4 — SSE endpoint
```python
# api/skeleton.py

@router.post("/api/skeleton")
async def skeleton(req: SkeletonRequest):
    async def stream():
        init = SkeletonState(
            project_md=req.project_md,
            sprints=req.sprints,
            tech_stack={}, file_list=[],
            folder_tree="", wireframe_html="",
            status="resolving"
        )
        async for event in graph.astream(init):
            node = list(event.keys())[0]
            data = list(event.values())[0]

            if node == "tree_builder":
                # stream tree line by line
                for line in data["folder_tree"].split("\n"):
                    yield f"data: {json.dumps({'type': 'tree_line', 'line': line})}\n\n"

            elif node == "wireframe_builder":
                yield f"data: {json.dumps({'type': 'wireframe', 'html': data['wireframe_html']})}\n\n"

        yield "data: [DONE]\n\n"
    return StreamingResponse(stream(), media_type="text/event-stream")
```

### B5 — Save skeleton endpoint (extends sprint 3a DB)
```python
# Add to db/queries.py
def save_skeleton(project_id: str, folder_tree: str, wireframe_html: str) -> None:
    supabase.table("skeletons").upsert({
        "project_id": project_id,
        "folder_tree": folder_tree,
        "wireframe_html": wireframe_html,
    }).execute()

# Add to api/projects.py
@router.put("/api/projects/{project_id}/skeleton")
async def save_skeleton_route(project_id: str, req: SkeletonSaveRequest, user_id=Depends(get_current_user)):
    save_skeleton(project_id, req.folder_tree, req.wireframe_html)
    return {"ok": True}
```

---

## Stub / Mock Strategy

- If `sprints` array is empty when landing on `/skeleton`, use a hardcoded stub Sprint 1 so the agent can still run (for dev/testing without completing Sprint 2 flow)
- `wireframe_builder` has a 1500-token output cap — HTML must stay under ~50 lines; simpler is better
- If the HTML generation fails, fall back to a minimal placeholder: `<html><body><h1>Sprint 1 wireframe unavailable</h1></body></html>`
- The folder tree is always generated before the wireframe — tree failure does not block wireframe attempt

---

## Definition of Done

- [ ] Navigate to `/skeleton` — page loads with two empty panels and "Generate Skeleton" button
- [ ] Click "Generate Skeleton" — folder tree streams in line by line on the left
- [ ] Wireframe renders in the iframe on the right
- [ ] Folder tree includes correct directories for the tech stack (e.g. `app/`, `components/` for Next.js)
- [ ] Wireframe HTML has at least a nav, main content area, and one placeholder component
- [ ] Wireframe HTML has `<!-- Sprint 1: ... -->` annotations
- [ ] "Copy to clipboard" copies the full tree text
- [ ] "Open in new tab" opens a readable wireframe page
- [ ] "Download skeleton.zip" produces two files: `structure.txt` + `wireframe.html`
- [ ] Skeleton saves to DB — refreshing the page and re-opening the project shows the skeleton

---

## Test Scenario

1. Complete Sprints 1 + 2 flow (or stub them manually)
2. Navigate to `/skeleton`, click "Generate Skeleton"
3. Watch folder tree populate line by line
4. Wireframe appears in iframe — verify nav and layout are visible
5. Check the HTML source in "open in new tab" — find `<!-- Sprint 1: ... -->` comments
6. Verify folder tree matches the stack chosen in brainstorm (e.g. Next.js files if frontend is Next.js)
7. Download zip — extract, open both files
8. Reload the page — navigate back from dashboard — skeleton still shows
