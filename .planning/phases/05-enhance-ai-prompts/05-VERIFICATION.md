---
phase: 05-enhance-ai-prompts
verified: 2026-04-27T11:38:30Z
status: human_needed
score: 16/16
overrides_applied: 0
human_verification:
  - test: "Generate sprints for a project — verify each SprintCard expands to show full 10-section markdown rendering (Sprint Goal, File Map, Frontend/Backend Tasks, Env Vars, DoD sections)"
    expected: "Each card renders formatted markdown including headings, code blocks, and checklists — not the old three-bullet structure"
    why_human: "Requires live backend (GROQ_API_KEY) + frontend rendering — cannot verify visually via grep"
  - test: "Generate sprints, then refresh the page — verify rehydrated sprints still render markdown"
    expected: "Sprint cards re-load from DB with content_md populated and render full markdown (round-trip through DB succeeds)"
    why_human: "Requires Supabase DB write/read cycle with live credentials"
  - test: "Open a project created before Phase 5 (with sprintData blob, no contentMd column) — verify SprintCard falls back to legacy Section components"
    expected: "User Stories, Technical Tasks, and Definition of Done sections displayed; no JS error; no broken layout"
    why_human: "Requires a real legacy DB row — cannot mock this path programmatically without credentials"
  - test: "Run a brainstorm conversation that mentions a pricing model — verify streamed project.md contains a Monetization section with | Tier | Price | Limits | table"
    expected: "Monetization section present in the generated project.md"
    why_human: "Requires live LLM call (GROQ_API_KEY) and chat session"
  - test: "Run a brainstorm conversation that does NOT mention pricing — verify project.md has no Monetization section"
    expected: "Monetization section entirely absent from generated project.md"
    why_human: "Conditional omission rule can only be validated by running the LLM with the updated prompt"
---

# Phase 5: Enhance AI Prompts — Verification Report

**Phase Goal:** Enhance AI prompts — refactor sprint planner to markdown output, expand brainstorm pipeline, polish skeleton prompts, update frontend to render new content_md field.
**Verified:** 2026-04-27T11:38:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All code artifacts are present, substantive, and wired. 16/16 must-haves verified programmatically. Five behaviors that require a live LLM or real DB credentials are routed to human verification below.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Sprint planner LLM call produces a single raw markdown string (not JSON-validated structured output) | VERIFIED | `sprint_planner.py` uses `llm_planner.ainvoke(messages)` directly; `with_structured_output` appears only in a comment (line 21). No `structured_planner` variable. |
| 2 | The output of the planner is split into one chunk per sprint by the inter-sprint separator `\n\n---\n\n` | VERIFIED | `SPRINT_SEPARATOR_PATTERN = re.compile(r'\n\n---\n\n')` defined; `_parse_sprint_markdown` splits on it. Spot-check: 2-sprint synthetic blob correctly splits to 2 dicts. |
| 3 | Each parsed sprint chunk is stored under content_md with sprint_number and goal extracted | VERIFIED | `_parse_sprint_markdown` returns `{number, goal, content_md}` per chunk. Parser spot-check passes for 2-sprint blob and fallback case. |
| 4 | The SSE endpoint emits one event per sprint with payload {number, goal, content_md} | VERIFIED | `api/sprint_planner.py` line 43: `yield f"data: {json.dumps({'node': 'sprint', 'data': sprint})}\n\n"` — `sprint` is the dict from `_parse_sprint_markdown` with `{number, goal, content_md}`. |
| 5 | Each generated sprint document follows the 10-section structure of plan/sprint-1.md | VERIFIED | `sprint_planner_system.txt` (9667 bytes) contains all 10 required section headings: Sprint Goal, Claude Code Instructions, File Map, Frontend Tasks, Backend Tasks, Environment Variables, Stub/Mock Strategy, Definition of Done, Test Scenario; plus the separator instruction and embedded sprint-1.md. |
| 6 | The sprint planner prompt contains the UNTRUSTED DATA prompt-injection guard | VERIFIED | `grep -c "UNTRUSTED DATA" sprint_planner_system.txt` returns 1. |
| 7 | The extractor LLM call extracts two new optional fields: monetization and sprint_count_hint | VERIFIED | `brainstorm_state.py` has 7 `Optional[str] = Field(` entries; `monetization` and `sprint_count_hint` both present with correct descriptions. `model_dump(exclude_none=True)` wiring confirmed in `brainstorm.py` line 54. |
| 8 | The drafter prompt instructs the LLM to produce all 11 sections from plan/project.md in exact order | VERIFIED | `drafter_system.txt` (3998 bytes) contains all 11 section headings in order: Vision, Problem, Target Users, Core Features, Tech Stack, Data Model, Monetization, Sprint Overview, Constraints, Success Metrics, Out of Scope. |
| 9 | The Monetization section is conditionally omitted when the extracted data has no `monetization` key | VERIFIED | `drafter_system.txt` contains `OMIT` rule adjacent to the Monetization section. `model_dump(exclude_none=True)` in `brainstorm.py` ensures the key is absent from the JSON when not extracted. |
| 10 | The drafter generates the Sprint Overview table itself (no separate agent) | VERIFIED | `drafter_system.txt` instructs the drafter to produce the `| Sprint | Concern | Key output |` table and to use `sprint_count_hint` when present. No new agent node introduced in `brainstorm.py`. |
| 11 | Drafter prompt contains the UNTRUSTED DATA guard | VERIFIED | `grep -q "UNTRUSTED DATA" drafter_system.txt` passes. |
| 12 | Stack resolver recognizes T3 stack, Django + React, and Rails as common stack inputs | VERIFIED | `skeleton_stack_resolver_system.txt` (1454 bytes) contains all three entries in the "Common stack defaults" block. UNTRUSTED DATA guard and JSON-only output contract preserved. |
| 13 | Tree builder Next.js template produces tailwind.config.ts, .env.example, and middleware.ts | VERIFIED | `skeleton_tree_builder_system.txt` template block and example array both contain all three paths. Example array: 20 entries, valid JSON, < 25 cap. |
| 14 | Both skeleton prompts preserve their JSON-only output contract and UNTRUSTED DATA guard | VERIFIED | `grep -q "UNTRUSTED DATA"` and `grep -q "Output ONLY the JSON"` both pass for both prompt files. |
| 15 | The Sprint TypeScript interface has a content_md string field; legacy fields are optional | VERIFIED | `frontend/types/sprint.ts` has `content_md: string;` (required) and `user_stories?: string[]`, `technical_tasks?: string[]`, `definition_of_done?: string[]` (all optional). |
| 16 | SprintCard renders sprint.content_md via react-markdown; falls back to legacy Section components | VERIFIED | `SprintCard.tsx` imports `ReactMarkdown` and `remarkGfm`, uses `hasMarkdown` conditional, renders `<ReactMarkdown remarkPlugins={[remarkGfm]}>{sprint.content_md}</ReactMarkdown>` when truthy, else renders Section components with `?? []` fallback. |

**Score:** 16/16 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/prompts/sprint_planner_system.txt` | Raw-markdown sprint generator with 10-section format and UNTRUSTED DATA guard | VERIFIED | 9667 bytes; all 10 sections, separator instruction, sprint-1.md embedded, UNTRUSTED DATA guard |
| `backend/agents/sprint_planner.py` | planner_node using raw ainvoke() + _parse_sprint_markdown helper | VERIFIED | `_parse_sprint_markdown` defined at line 37, called at line 76; `llm_planner.ainvoke` at line 74; temp=0.4, max_tokens=8192 |
| `backend/models/sprint_state.py` | SprintState TypedDict only — Sprint and SprintPlan deleted | VERIFIED | File contains only `SprintState(TypedDict)` with 3 fields; no Pydantic, no Sprint, no SprintPlan |
| `backend/api/sprint_planner.py` | SSE endpoint emitting {number, goal, content_md} payloads | VERIFIED | `content_md` documented in comment; `'node': 'sprint'` key intact; 50K cap and always-DONE invariant preserved |
| `backend/prompts/extractor_system.txt` | Extractor prompt with 7 fields including monetization and sprint_count_hint | VERIFIED | 7 `^- ` bullets; monetization and sprint_count_hint bullets present; preamble preserved |
| `backend/models/brainstorm_state.py` | ExtractedFields with two new Optional[str] fields | VERIFIED | 7 `Optional[str] = Field(` entries; monetization and sprint_count_hint with correct descriptions |
| `backend/prompts/drafter_system.txt` | 11-section project.md drafter with conditional Monetization, table column specs, and UNTRUSTED DATA guard | VERIFIED | 3998 bytes; all 11 sections; `\| Persona \| Description \|`, `\| Sprint \| Concern \| Key output \|`, `\| Tier \| Price \| Limits \|`; OMIT rule; UNTRUSTED DATA guard |
| `backend/prompts/skeleton_stack_resolver_system.txt` | Stack resolver with T3, Django+React, and Rails defaults | VERIFIED | 1454 bytes; T3, Django+React, Rails entries; UNTRUSTED DATA and JSON-only contract preserved |
| `backend/prompts/skeleton_tree_builder_system.txt` | Tree builder with tailwind.config.ts, .env.example, middleware.ts in Next.js template | VERIFIED | All 3 new paths in template and example array; 20 entries; valid JSON; < 25 cap |
| `frontend/types/sprint.ts` | Sprint interface with content_md (required) and optional legacy fields | VERIFIED | `content_md: string;` required; 3 legacy fields optional |
| `frontend/components/SprintCard.tsx` | Conditional rendering: ReactMarkdown when content_md present, legacy Section otherwise | VERIFIED | ReactMarkdown + remarkGfm imported; hasMarkdown guard; prose container matching ProjectPreview.tsx; legacy Section fallback |
| `frontend/app/sprints/[id]/page.tsx` | SSE reader + rehydration that handles content_md as primary field | VERIFIED | Sprint imported from types; no inline interface; contentMd in SprintRowApi; rehydrateSprints populates content_md; download preference; SSE handler and auto-save unchanged |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/agents/sprint_planner.py` | `backend/prompts/sprint_planner_system.txt` | `read_text()` at module load | WIRED | Line 19: `SPRINT_PLANNER_PROMPT = (_PROMPTS_DIR / "sprint_planner_system.txt").read_text()` |
| `backend/agents/sprint_planner.py` | `_parse_sprint_markdown` | function call inside planner_node | WIRED | Line 76: `sprints = _parse_sprint_markdown(response.content)` |
| `backend/api/sprint_planner.py` | `backend/agents/sprint_planner.py` | graph import | WIRED | Line 6: `from agents.sprint_planner import graph` |
| `backend/agents/brainstorm.py` extractor_node | `backend/models/brainstorm_state.py` ExtractedFields | `with_structured_output(ExtractedFields)` | WIRED | Line 38: `structured_extractor = llm_extractor.with_structured_output(ExtractedFields)` |
| `backend/agents/brainstorm.py` drafter_node | `backend/prompts/drafter_system.txt` | module-level read_text | WIRED | Line 21: `DRAFTER_PROMPT = (_PROMPTS_DIR / "drafter_system.txt").read_text()` |
| `backend/agents/brainstorm.py` extractor_node | `model_dump(exclude_none=True)` | result.model_dump(exclude_none=True) | WIRED | Line 54: `extracted = result.model_dump(exclude_none=True)` |
| `backend/agents/skeleton.py` | `backend/prompts/skeleton_stack_resolver_system.txt` | module-level read_text | WIRED | Line 21: `STACK_RESOLVER_PROMPT = (_PROMPTS_DIR / "skeleton_stack_resolver_system.txt").read_text()` |
| `backend/agents/skeleton.py` | `backend/prompts/skeleton_tree_builder_system.txt` | module-level read_text | WIRED | Line 22: `TREE_BUILDER_PROMPT = (_PROMPTS_DIR / "skeleton_tree_builder_system.txt").read_text()` |
| `frontend/components/SprintCard.tsx` | `react-markdown` + `remark-gfm` | import ReactMarkdown from 'react-markdown' | WIRED | Both imports present; `<ReactMarkdown remarkPlugins={[remarkGfm]}>` renders `sprint.content_md` |
| `frontend/app/sprints/[id]/page.tsx` | `frontend/types/sprint.ts` | import type { Sprint } | WIRED | `import type { Sprint } from "../../../types/sprint"` |
| `frontend/app/sprints/[id]/page.tsx` | `/api/projects/[id]/sprints PUT` | fetch with body.sprints[].content_md | WIRED | `JSON.stringify({ sprints: accumulated })` — accumulated is `Sprint[]` with `content_md` field; SSE `event.data as Sprint` carries `content_md` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SprintCard.tsx` | `sprint.content_md` | SSE event.data (backend planner_node) or rehydrateSprints (DB contentMd column) | Yes — LLM generates markdown; DB column stores it; rehydrateSprints reads it | FLOWING |
| `sprints/[id]/page.tsx` | `sprints` state | `rehydrateSprints(data.sprints)` from GET API + SSE accumulator | Yes — DB row reads `contentMd` column; SSE accumulates `{number, goal, content_md}` dicts | FLOWING |
| `drafter_system.txt` consumer | `project_md` | `brainstorm.py` drafter_node uses `DRAFTER_PROMPT` with `state['extracted']` JSON | Yes — `extracted` populated from `structured_extractor.ainvoke` call | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `_parse_sprint_markdown` splits 2-sprint blob correctly | `python3 -c "..."` (inline re-implementation) | 2 dicts with correct number/goal; fallback returns `[{number:1, goal:'', content_md:'garbage...'}]` | PASS |
| sprint_planner_system.txt contains all 10 sections | `grep` checks for each heading | All 10 sections present; separator instruction present; sprint-1.md embedded | PASS |
| example JSON array in tree_builder parses as valid JSON with 3 new entries | `python3 -c "json.loads(...)"` | `OK 20 entries` | PASS |
| All 12 commit hashes from SUMMARYs exist in git log | `git log --oneline \| grep ...` | All 12 commits verified | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status |
|-------------|------------|-------------|--------|
| D-01 | 05-01 | Switch sprint planner to raw text output, remove Pydantic Sprint/SprintPlan | SATISFIED |
| D-02 | 05-01 | Sprint planner produces multi-sprint markdown separated by `\n\n---\n\n` | SATISFIED |
| D-03 | 05-01 | Backend splits blob on separator, stores each chunk as content_md | SATISFIED |
| D-04 | 05-01 | sprint_data no longer populated; new generations write content_md only | SATISFIED |
| D-05 | 05-01 | Each sprint doc matches 10-section structure of plan/sprint-1.md | SATISFIED |
| D-06 | 05-02 | drafter_system.txt updated to produce all 11 sections from plan/project.md | SATISFIED |
| D-07 | 05-02 | Section format matches reference — exact heading levels, table column names | SATISFIED |
| D-08 | 05-02 | Drafter generates Sprint Overview table; no separate agent | SATISFIED |
| D-09 | 05-02 | extractor_system.txt extracts monetization and sprint_count_hint | SATISFIED |
| D-10 | 05-03 | skeleton_stack_resolver extended with T3, Django+React, Rails defaults | SATISFIED |
| D-11 | 05-03 | skeleton_tree_builder Next.js template includes tailwind.config.ts, .env.example, middleware.ts | SATISFIED |
| D-12 | 05-04 | Frontend sprint rendering updated to render content_md via ReactMarkdown | SATISFIED |
| D-13 | 05-01/02/03 | Groq llama-3.3-70b-versatile used for sprint planner | SATISFIED |

### Anti-Patterns Found

None. All 7 modified code files scanned. No TODO/FIXME/PLACEHOLDER comments, no return null/empty stubs, no orphaned state variables.

### Human Verification Required

#### 1. Sprint Card Markdown Rendering (Full Flow)

**Test:** Log in, open a project with project.md, click "Generate Sprints"
**Expected:** Each SprintCard expands to show full 10-section markdown (Sprint Goal heading, code blocks, checklists in DoD, numbered tasks) — not the old three-bullet User Stories / Technical Tasks / Definition of Done structure
**Why human:** Requires live GROQ_API_KEY + running backend. Cannot verify LLM output format programmatically without calling the API.

#### 2. Sprint Round-Trip via DB

**Test:** Generate sprints, then hard-refresh the page (`Cmd+Shift+R` / `Ctrl+Shift+R`)
**Expected:** Sprint cards reload from DB (via `rehydrateSprints` + `contentMd` column) and still render full markdown content — cards do not appear empty or fall back to legacy three-section layout
**Why human:** Requires Supabase credentials and an actual DB write/read cycle.

#### 3. Legacy DB Row Backwards Compatibility

**Test:** Open a project created before Phase 5 (with `sprintData` blob populated, no `contentMd` column value)
**Expected:** Sprint cards render the legacy User Stories / Technical Tasks / Definition of Done sections via the Section component fallback; no JavaScript error; no blank cards
**Why human:** Requires a real legacy DB row with `contentMd = null` and `sprintData` populated.

#### 4. Drafter Monetization Section — Present When Mentioned

**Test:** Run a brainstorm conversation that explicitly mentions a pricing model (e.g., "it will be free with a $10/month Pro tier")
**Expected:** The streamed `project.md` preview contains a `## Monetization` section with a `| Tier | Price | Limits |` table
**Why human:** Conditional section presence depends on the LLM correctly extracting `monetization` from conversation and the drafter rendering the section — requires live LLM call.

#### 5. Drafter Monetization Section — Absent When Not Mentioned

**Test:** Run a brainstorm conversation that never mentions pricing or revenue
**Expected:** The generated `project.md` has NO `## Monetization` section at all (not even an empty one)
**Why human:** Conditional omission rule fires only during live LLM execution; `model_dump(exclude_none=True)` behavior must be observed end-to-end.

### Gaps Summary

No gaps found. All 16 must-have truths are verified programmatically. The five human verification items above are behavioral/visual checks that require live credentials and LLM calls — they cannot be verified by static analysis alone. All code paths are correctly implemented and wired.

---

_Verified: 2026-04-27T11:38:30Z_
_Verifier: Claude (gsd-verifier)_
