# Sprint 2 — Sprint Planner Agent

**Duration:** Week 3–4
**Claude Code session concern:** One LangGraph planner agent + progressive UI cards + client-side zip
**Files touched:** ~10

---

## Sprint Goal

A user can paste or carry over their `project.md`, click "Generate Sprints", and watch sprint cards appear one by one in the UI. Each card is fully populated with goal, tasks, and a testable DoD. All sprints are downloadable as a zip.

---

## Claude Code Instructions

> "We are extending SkeleCode. Sprint 1 is complete — we have a working brainstorm agent and `project.md` preview. This sprint adds the Sprint Planner: a new LangGraph agent that reads `project.md` and generates Scrum sprints one at a time, streamed to the frontend as progressive cards. Add a `/sprints` page. No auth or DB this sprint."

---

## File Map

```
frontend/
  app/
    sprints/
      page.tsx              ← sprints page (project.md sidebar + sprint cards)
  components/
    SprintCard.tsx          ← individual sprint card (collapsible sections)
    SprintList.tsx          ← list of SprintCards, handles streaming state
    GenerateSprints.tsx     ← trigger button + useCopilotAction
  lib/
    types.ts                ← add Sprint type

backend/
  agents/
    planner.py              ← LangGraph sprint planner graph
  models/
    planner_state.py        ← PlannerState TypedDict + Sprint schema
  api/
    planner.py              ← POST /api/plan SSE endpoint
```

---

## Frontend Tasks

### F1 — Stage nav
- Add a simple top nav to `layout.tsx`: "Brainstorm" | "Sprints" | "Skeleton"
- Stage links: `/` , `/sprints`, `/skeleton`
- Active stage is highlighted; future stages are visually muted but still clickable

### F2 — Sprints page (`/sprints`)
- Left panel (30%): collapsible `project.md` preview (collapsed by default, expandable)
- Right panel (70%): sprint cards area
- If no `project.md` in state: show a prompt to go back or paste markdown manually
- "Generate Sprints" button at the top of the right panel

### F3 — SprintCard component
- Props: `sprint: Sprint, status: 'generating' | 'ready'`
- Header: sprint number + goal + status badge
- Four collapsible sections using `<details>` / `<summary>`:
  - Frontend tasks (bulleted list)
  - Backend tasks (bulleted list)
  - DB tasks (bulleted list, hidden if empty)
  - Definition of done (checklist — unchecked checkboxes)
- Generating state: pulsing skeleton on the sections not yet populated
- Ready state: full content, no skeleton

### F4 — GenerateSprints + useCopilotAction
- `useCopilotAction("generateSprints")`:
  - Parameters: `{ project_md: string }`
  - Handler: POST `/api/plan`, consume SSE stream
  - On each sprint event: append to `sprints` state array → SprintList re-renders
  - Render: "Planning your sprints..." text while streaming

### F5 — Download controls
- "Download all (.zip)" button — uses `jszip` library (install: `npm install jszip`)
- Generates one file per sprint: `sprint-1.md`, `sprint-2.md`, etc.
- Converts sprint object back to markdown using a `sprintToMarkdown(sprint)` utility
- Individual "Download" button on each SprintCard
- Both buttons disabled until that sprint's status is `ready`

---

## Backend Tasks

### B1 — Sprint schema
```python
# models/planner_state.py
from typing import TypedDict, List

class Sprint(TypedDict):
    sprint_number: int
    goal: str
    duration: str
    frontend_tasks: List[str]
    backend_tasks: List[str]
    db_tasks: List[str]          # empty list if none
    stub_strategy: str
    definition_of_done: List[str]
    test_scenario: str

class PlannerState(TypedDict):
    project_md: str
    tech_stack: dict             # extracted from project_md
    total_sprints: int
    sprints: List[Sprint]
    current_index: int
    status: str                  # analyzing | generating | validating | done
```

### B2 — Planner LangGraph graph
```
Nodes:
  analyzer      → reads project_md, extracts: feature list, stack, complexity
                  sets total_sprints (2–6 max), initializes sprints = []

  sprint_writer → writes one sprint at a time (sprints[current_index])
                  each sprint must have: testable DoD, ≥1 frontend task
                  no sprint may reference a DB table not created in a prior sprint

  validator     → checks the written sprint:
                  - DoD has at least one browser-checkable item
                  - no forward DB references
                  if invalid: rewrites (max 1 retry)

  router        → conditional edge:
                  if current_index < total_sprints → back to sprint_writer
                  else → END

Edges:
  analyzer → sprint_writer
  sprint_writer → validator
  validator → router
  router → sprint_writer  (loop)
  router → END
```

### B3 — SSE endpoint
```python
# api/planner.py
@router.post("/api/plan")
async def plan(req: PlanRequest):
    async def stream():
        init = PlannerState(
            project_md=req.project_md,
            tech_stack={}, total_sprints=0,
            sprints=[], current_index=0,
            status="analyzing"
        )
        async for event in graph.astream(init):
            node = list(event.keys())[0]
            data = list(event.values())[0]
            # Only emit when a sprint is validated and ready
            if node == "validator" and data.get("sprints"):
                latest = data["sprints"][-1]
                yield f"data: {json.dumps({'type': 'sprint', 'sprint': latest})}\n\n"
        yield "data: [DONE]\n\n"
    return StreamingResponse(stream(), media_type="text/event-stream")
```

---

## State Sharing Between Pages

Sprint 1 state (`projectMd`) must survive navigation to `/sprints`. Use a simple React Context:

```typescript
// lib/ProjectContext.tsx
const ProjectContext = createContext<{
  projectMd: string
  setProjectMd: (md: string) => void
  sprints: Sprint[]
  setSprints: (s: Sprint[]) => void
}>()
```

Wrap in `layout.tsx`. Both pages read/write through context. No localStorage, no DB yet.

---

## Stub / Mock Strategy

- If `project_md` is empty on `/sprints`, show a textarea: "Paste your project.md here to continue"
- Cap `total_sprints` at 6 in the analyzer node
- Validator max 1 retry per sprint — if still invalid after retry, emit the sprint anyway with a `warning` flag
- `jszip` download: if a sprint is still `generating`, exclude it from the zip with a note in the console

---

## Definition of Done

- [ ] Navigate to `/sprints` — page loads without errors
- [ ] With `project.md` in state, click "Generate Sprints" — cards appear one by one
- [ ] Each card shows: sprint number, goal, all four sections populated
- [ ] Collapsible sections open and close correctly
- [ ] Each sprint's Definition of Done contains at least one item with "browser" or "frontend" in it
- [ ] No sprint card references a DB table that hasn't been introduced in a prior sprint
- [ ] "Download all (.zip)" produces a zip with correctly named `.md` files
- [ ] Individual sprint download works on each card
- [ ] Navigating back to `/` and returning to `/sprints` preserves the sprint data (context survives navigation)

---

## Test Scenario

1. Complete Sprint 1 flow — `project.md` is in the preview
2. Click "Sprints" in the nav
3. Click "Generate Sprints"
4. Watch 3–5 sprint cards appear with pulsing skeletons, then populate
5. Open each card — verify frontend tasks, backend tasks, DoD are all filled
6. Confirm Sprint 1's DoD is testable without anything from Sprint 2
7. Click "Download all (.zip)" — extract and open each file — formatting is clean
8. Paste a completely different `project.md` manually — regenerate — new sprints appear correctly
