# Phase 1: Scaffold + Brainstorm Agent - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold the Next.js 14 frontend and FastAPI backend, build a LangGraph brainstorm agent, connect it to a CopilotKit chat UI, and stream the generated project.md into a live markdown preview. No auth or DB this phase. Delivers the core value loop end-to-end.

</domain>

<decisions>
## Implementation Decisions

### Visual Design & Theme
- Light mode default — cleaner for first-time users and demos
- Minimal developer-tool aesthetic: white background, clean borders, monospace accents for code blocks
- System font stack (Tailwind default, no custom font loading)
- Desktop-only MVP — no mobile responsive handling needed this phase

### Brainstorm Agent Behavior
- 4–5 exchanges before bot triggers spec generation — bot decides when it has enough context
- "No idea" flow: bot suggests 3 project ideas, user picks one, then normal Q&A continues
- Show "thinking..." indicator in chat while LLM generates each response
- "Start over" button in UI header — clears React state, no confirmation modal

### project.md Output Format
- Fixed template sections: Vision, Problem, Target Users, Core Features, Tech Stack, Data Model, Constraints — consistent for downstream agents
- Comprehensive spec with all sections populated (downstream sprint planner needs rich input)
- Always named `project.md` — simple and predictable
- Error UX: inline error in preview panel with retry button: "Generation failed — try rephrasing your idea"

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project

### Established Patterns
- None — this phase establishes the patterns for all future phases

### Integration Points
- plan/ directory contains detailed sprint plans that specify exact file structure and component names
- sprint-1.md specifies exact LangGraph node structure: extractor → reviewer → drafter
- sprint-1.md specifies exact SSE endpoint contract: POST /api/brainstorm, yields node events, ends with [DONE]

</code_context>

<specifics>
## Specific Ideas

- sprint-1.md provides exact file map: frontend/ and backend/ directory structure
- BrainstormState TypedDict defined in sprint plan: conversation, extracted, missing_fields, project_md, status
- CopilotKit action: useCopilotAction("generateProjectSpec") with parameters { conversation: Message[] }
- Reviewer node caps at 2 iterations max to prevent infinite loops
- API proxy route at app/api/brainstorm/route.ts forwards to localhost:8000/api/brainstorm
- Layout: left = chat (40%), right = preview (60%)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
