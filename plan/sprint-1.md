# Sprint 1 — Scaffold + Brainstorm Agent

**Duration:** Week 1–2
**Claude Code session concern:** One LangGraph agent + one CopilotKit chat UI + SSE streaming
**Files touched:** ~12

---

## Sprint Goal

A user can open the app, have a conversation with the Brainstorm Bot, and see a fully generated `project.md` stream live into the right panel. No auth, no DB — just the core value loop working end to end.

---

## Claude Code Instructions

When starting this sprint, give Claude Code this context:

> "We are building SkeleCode, an AI project planner. This sprint scaffolds the Next.js frontend and FastAPI backend, builds a LangGraph brainstorm agent, connects it to a CopilotKit chat UI, and streams the output into a live markdown preview. No auth or DB this sprint."

---

## File Map

```
frontend/
  app/
    layout.tsx              ← CopilotKit provider wraps entire app
    page.tsx                ← brainstorm page (chat + preview split)
    api/
      brainstorm/
        route.ts            ← proxies SSE from FastAPI
  components/
    BrainstormChat.tsx      ← CopilotKit chat + useCopilotAction
    ProjectPreview.tsx      ← markdown preview pane + download button
  lib/
    types.ts                ← shared TypeScript types

backend/
  main.py                   ← FastAPI app, CORS, health check
  agents/
    brainstorm.py           ← LangGraph brainstorm graph
  models/
    brainstorm_state.py     ← BrainstormState TypedDict
  api/
    brainstorm.py           ← POST /api/brainstorm SSE endpoint
```

---

## Frontend Tasks

### F1 — Next.js scaffold
- `npx create-next-app@latest frontend --typescript --tailwind --app`
- Install: `@copilotkit/react-core @copilotkit/react-ui react-markdown`
- Wrap `app/layout.tsx` with `<CopilotKit runtimeUrl="/api/copilotkit">`
- Two-column layout: left = chat (40%), right = preview (60%)

### F2 — BrainstormChat component
- Renders `<CopilotChat>` with system prompt:
  > "You are a project brainstorm interviewer. Ask the user about their idea, who it's for, key features, and tech preferences. Ask one question at a time. After 4–5 exchanges, call generateProjectSpec."
- Register `useCopilotAction("generateProjectSpec")`:
  - Parameters: `{ conversation: Message[] }`
  - Handler: POST to `/api/brainstorm`, consume SSE stream, update preview state
  - Render: loading spinner while streaming, nothing after (preview handles display)

### F3 — ProjectPreview component
- Accepts `markdown: string` prop
- Renders via `react-markdown` with prose styling
- Placeholder when empty: "Your project spec will appear here once the brainstorm is complete"
- "Download project.md" button — uses `Blob` + `URL.createObjectURL`; disabled until markdown is non-empty

### F4 — API proxy route
- `app/api/brainstorm/route.ts`
- Forwards POST body to `http://localhost:8000/api/brainstorm`
- Pipes the SSE response through — do not buffer

---

## Backend Tasks

### B1 — FastAPI scaffold
```python
# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health(): return {"status": "ok"}
```

### B2 — BrainstormState
```python
# models/brainstorm_state.py
from typing import TypedDict, List

class BrainstormState(TypedDict):
    conversation: List[dict]   # [{role, content}, ...]
    extracted: dict            # {problem, users, features, stack, constraints}
    missing_fields: List[str]  # fields still needed
    project_md: str
    status: str                # extracting | drafting | done
```

### B3 — Brainstorm LangGraph graph
```python
# agents/brainstorm.py
# Nodes:
#   extractor  → reads conversation, fills extracted{}, lists missing_fields
#   reviewer   → if missing_fields is empty go to drafter, else return
#   drafter    → writes project_md from extracted{}
#
# Edges:
#   extractor → reviewer
#   reviewer  → drafter        (if missing_fields == [])
#   reviewer  → END            (if missing_fields != [], frontend asks follow-up)
#   drafter   → END
```

Key constraint: reviewer loops back to END (not to extractor) when fields are missing. The frontend re-sends the updated conversation on the next user message. This keeps the graph stateless and the session simple.

### B4 — SSE endpoint
```python
# api/brainstorm.py
@router.post("/api/brainstorm")
async def brainstorm(req: BrainstormRequest):
    async def stream():
        init = BrainstormState(
            conversation=req.conversation,
            extracted={}, missing_fields=[],
            project_md="", status="extracting"
        )
        async for event in graph.astream(init):
            node_name = list(event.keys())[0]
            data = list(event.values())[0]
            yield f"data: {json.dumps({'node': node_name, 'data': data})}\n\n"
        yield "data: [DONE]\n\n"
    return StreamingResponse(stream(), media_type="text/event-stream")
```

---

## Environment Variables

```bash
# backend/.env
ANTHROPIC_API_KEY=sk-ant-...

# frontend/.env.local
NEXT_PUBLIC_COPILOTKIT_RUNTIME_URL=/api/copilotkit
BACKEND_URL=http://localhost:8000
```

---

## Stub / Mock Strategy

- No auth — all sessions are anonymous
- No persistence — state lives in React `useState`; refresh = start over (acceptable)
- Reviewer node caps at 2 iterations max to prevent infinite loops during dev
- If brainstorm agent fails, frontend shows: "Something went wrong — try rephrasing your idea"

---

## Definition of Done

- [ ] `npm run dev` and `uvicorn main:app --reload` both start with no errors
- [ ] `GET http://localhost:8000/health` returns `{"status": "ok"}`
- [ ] User types "I want to build a recipe sharing app" — bot asks 3–4 clarifying questions one at a time
- [ ] After enough context, bot calls `generateProjectSpec` — right panel streams content
- [ ] Markdown renders with correct headings, tables, and code blocks
- [ ] "Download project.md" downloads a clean `.md` file
- [ ] No console errors in browser devtools

---

## Test Scenario

1. Open `localhost:3000`
2. Type: "I have no idea, help me think of something"
3. Bot suggests 3 project ideas — pick one
4. Answer 3–4 follow-up questions
5. Bot triggers spec generation — watch right panel populate live
6. Download the file, open in a text editor — verify it is complete and readable
