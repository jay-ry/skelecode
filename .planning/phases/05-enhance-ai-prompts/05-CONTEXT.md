# Phase 5: Enhance AI Prompts - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Update the backend AI system prompts so that generated `project.md` and sprint files match the rich, human-readable format of the reference documents in `plan/`. This includes updating the sprint planner's output strategy (structured JSON → rich markdown), enriching the project.md drafter with all sections from the reference, improving the extractor prompt, and polishing the skeleton prompts. The frontend sprint rendering is updated to render markdown instead of structured arrays.

Do NOT touch:
- The brainstorm LangGraph graph structure (nodes/edges)
- The skeleton LangGraph graph structure
- Auth (Clerk), database schema, or API routes
- The wireframe builder prompt (already improved in Phase 4)

</domain>

<decisions>
## Implementation Decisions

### Sprint Output Format — D-01 through D-04
- **D-01:** Switch sprint planner from `with_structured_output(SprintPlan)` to raw text output. Remove the Pydantic `Sprint` and `SprintPlan` models entirely from the planner's invocation path.
- **D-02:** Sprint planner produces a single LLM response containing all sprints as markdown documents, separated by `---` dividers. Example: `# Sprint 1 ...\n\n---\n\n# Sprint 2 ...`
- **D-03:** Backend parsing: split on `---` divider, strip whitespace, store each chunk as `content_md`. Extract `sprint_number` from the leading `# Sprint N` heading via regex. Store as `content_md` in DB (column already exists — no schema change needed).
- **D-04:** `sprint_data` (JSONB) is no longer populated by the sprint planner. It may retain old data for existing rows but new generations write only `content_md` + `goal` (extracted from first line of markdown).

### Sprint Markdown Format — D-05
- **D-05:** Each sprint document MUST match the structure of `plan/sprint-1.md` exactly:
  1. Header block: `**Duration:** ...`, `**Files touched:** ~N`, `**External services wired:** N`
  2. `## Sprint Goal` — one sentence
  3. `## Claude Code Instructions` — fenced quote block giving context for an agent session
  4. `## File Map` — fenced code block with directory tree of files touched
  5. `## Frontend Tasks` — numbered F1, F2, F3... with code examples where relevant
  6. `## Backend Tasks` — numbered B1, B2, B3... with code examples where relevant
  7. `## Environment Variables` — fenced bash block with new vars for this sprint
  8. `## Stub / Mock Strategy` — brief prose on dev shortcuts
  9. `## Definition of Done` — checklist (`- [ ] ...`) with browser-testable items
  10. `## Test Scenario` — numbered steps for manual end-to-end verification

### Project.md Format — D-06 through D-08
- **D-06:** `drafter_system.txt` updated to produce ALL sections from `plan/project.md` in exact order:
  1. Vision
  2. Problem
  3. Target Users (markdown table)
  4. Core Features (grouped by stage/feature area with subsections)
  5. Tech Stack (grouped by tier: Frontend, Backend, Storage, Auth & Payments, Infrastructure)
  6. Data Model (ASCII entity diagram + SQL schema with RLS)
  7. Monetization (markdown table: Tier / Price / Limits — only if monetization mentioned in conversation; omit silently otherwise)
  8. Sprint Overview (markdown table: Sprint / Concern / Key output)
  9. Constraints & Assumptions (bullet list)
  10. Success Metrics (bullet list of measurable outcomes)
  11. Out of Scope (v1 exclusion list)
- **D-07:** Section format strictly matches the reference — exact heading levels, table column names, and content style.
- **D-08:** Sprint Overview section requires the drafter to synthesize a reasonable sprint breakdown from the extracted project data. The drafter generates this, not a separate agent.

### Extractor Improvements — D-09
- **D-09:** Update `extractor_system.txt` to also extract:
  - `monetization`: pricing model or revenue approach (optional)
  - `sprint_count_hint`: rough number of sprints implied by project complexity (optional)
  These new fields feed into the richer drafter to populate Sprint Overview and Monetization sections.

### Skeleton Prompts — D-10 through D-11
- **D-10:** `skeleton_stack_resolver_system.txt` — add more stack defaults and improve handling of common stacks (e.g., T3 stack, Django + React, Rails). Keep JSON-only output contract.
- **D-11:** `skeleton_tree_builder_system.txt` — improve file list templates to include common config files (`tailwind.config.ts`, `.env.example`, `middleware.ts`). Keep JSON array output contract.

### Frontend Sprint Rendering — D-12
- **D-12:** Update `frontend/app/sprints/[id]/page.tsx` and `SprintList` component to render `content_md` as markdown (using `react-markdown` already installed). The existing `Sprint` TypeScript interface can be simplified or kept for backwards compat — new data flows through `content_md`. The `formatSprintMarkdown()` function becomes redundant and can be removed.

### Model — D-13
- **D-13:** Keep Groq `llama-3.3-70b-versatile` for ALL prompts. No Anthropic/Claude dependency added in this phase.

### Claude's Discretion
- Exact temperature/max_tokens tuning for the updated sprint planner (suggest: temperature=0.4, max_tokens=8192 to accommodate longer markdown output)
- Whether to keep or delete the `SprintPlan` / `Sprint` Pydantic models (they can be deleted since they're no longer used)
- Whether `ExtractedFields` model needs updating for new fields or if a simpler dict append is cleaner
- Error handling for sprint markdown parsing failures (suggest: on regex failure, fall back to storing the full raw text as `content_md` for sprint 1)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reference Documents (Target Output Format)
- `plan/project.md` — The exact format and section structure the drafter must produce. Every section heading, table column name, and content style is defined here.
- `plan/sprint-1.md` — The exact format and section structure each sprint document must produce. F1/B1 task numbering, code examples, checklist format all defined here.
- `plan/sprint-2.md` — Second sprint example (verify sprint format is consistent across examples)

### Existing Prompts (Files Being Modified)
- `backend/prompts/drafter_system.txt` — Current 7-section drafter prompt (being expanded)
- `backend/prompts/sprint_planner_system.txt` — Current structured-output sprint planner (being rewritten)
- `backend/prompts/extractor_system.txt` — Current extractor (being extended with monetization + sprint_count_hint fields)
- `backend/prompts/skeleton_stack_resolver_system.txt` — Stack resolver (minor improvements)
- `backend/prompts/skeleton_tree_builder_system.txt` — Tree builder (minor improvements)

### Existing Agent Code (Read Before Modifying)
- `backend/agents/brainstorm.py` — Extractor + drafter nodes, model config, structured output pattern
- `backend/agents/sprint_planner.py` — Current planner node with `with_structured_output(SprintPlan)` (removing this)
- `backend/models/sprint_state.py` — `Sprint` + `SprintPlan` Pydantic models (likely removable after refactor)
- `backend/models/brainstorm_state.py` — `ExtractedFields` Pydantic model (adding optional fields)

### Architecture Pattern (Must Follow)
- `.planning/phases/03-auth-database/03-CONTEXT.md` — DB schema: `content_md` column already exists in `sprints` table. No migration needed.
- `frontend/app/sprints/[id]/page.tsx` — Current sprint rendering using structured arrays (updating to render `content_md`)
- `frontend/app/api/projects/[id]/sprints/route.ts` — Sprint upsert route: writes `goal` + `content_md` + `sprint_data` — after this phase only `goal` + `content_md` needed

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `react-markdown` — already installed in frontend; use for rendering `content_md` in sprint cards
- `SprintList` component — renders sprint cards; will need markdown body rendering
- `content_md` DB column — already exists in `sprints` table; ready to receive markdown
- GROQ `llama-3.3-70b-versatile` — model already configured in all agents; max_tokens may need bumping for longer sprint docs

### Established Patterns
- All prompts loaded at module startup from `.txt` files (not inside node functions)
- `with_structured_output()` for extraction nodes (extractor keeps this; sprint planner removes it)
- Raw `ainvoke()` for generative nodes (drafter uses this; sprint planner switches to this)
- UNTRUSTED DATA guard in prompt preamble (keep in all updated prompts)
- SSE streaming unaffected — planner node returns one result; SSE endpoint iterates the list

### Integration Points
- `frontend/app/api/projects/[id]/sprints/route.ts` — writes sprint data to DB; need to pass `content_md` from the SSE payload
- `frontend/app/sprints/[id]/page.tsx` — reads `content_md` from DB rows; renders as markdown
- `backend/api/sprint_planner.py` — SSE endpoint; emits one SSE event per sprint; payload changes from `Sprint` dict to `{number, goal, content_md}`

</code_context>

<specifics>
## Specific Ideas

- The sprint planner prompt should include `plan/sprint-1.md` content verbatim (or a condensed version) as a format example — few-shot formatting beats prose instructions for Groq models
- The drafter prompt should include the section list with explicit column names for tables (e.g., "Sprint Overview: | Sprint | Concern | Key output |")
- Sprint separator: use `\n\n---\n\n` (double newline before and after) to avoid false splits on horizontal rules inside content
- The `rehydrateSprints()` function in the frontend can be simplified or removed — new sprints have `content_md` populated directly

</specifics>

<deferred>
## Deferred Ideas

- Stripe tier enforcement on skeleton export — Phase 6
- Landing page and production deploy — Phase 6
- Multiple sprint template styles (Claude Code session vs. team sprint) — post-MVP
- Brainstorm quality improvement beyond extractor (e.g., better interviewer system prompt) — could be Phase 5 stretch goal but not core

</deferred>

---

*Phase: 05-enhance-ai-prompts*
*Context gathered: 2026-04-23*
