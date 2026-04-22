---
phase: 04-skeleton-generator
plan: "03"
subsystem: backend-agent
tags: [skeleton-generator, langgraph, fastapi, sse, tdd, groq]
dependency_graph:
  requires:
    - SkeletonState TypedDict (backend/models/skeleton_state.py) — from Plan 01
    - format_tree utility (backend/utils/tree_formatter.py) — from Plan 01
    - skeleton_stack_resolver prompt (backend/prompts/skeleton_stack_resolver_system.txt) — from Plan 01
    - skeleton_tree_builder prompt (backend/prompts/skeleton_tree_builder_system.txt) — from Plan 01
    - skeleton_wireframe_builder prompt (backend/prompts/skeleton_wireframe_builder_system.txt) — from Plan 01
  provides:
    - skeleton LangGraph compiled graph (backend/agents/skeleton.py)
    - POST /api/skeleton SSE endpoint (backend/api/skeleton.py)
    - skeleton router registration in main.py
  affects:
    - backend/main.py (skeleton_router added)
tech_stack:
  added: []
  patterns:
    - 3-node linear LangGraph with defensive fallbacks per node
    - dotenv-first import pattern (before langchain imports)
    - per-node LLM instance with different temperatures
    - SSE stream_mode="updates" yielding partial state per node
    - type-keyed SSE events (not node-keyed — locked CONTEXT.md contract)
    - always-in-finally [DONE] emission invariant
key_files:
  created:
    - backend/agents/skeleton.py
    - backend/api/skeleton.py
    - backend/tests/test_skeleton_graph.py
    - backend/tests/test_skeleton_sse_endpoint.py
  modified:
    - backend/main.py
decisions:
  - Event shape uses 'type' key (not 'node' key) per CONTEXT.md locked contract — different from sprint_planner's {node, data} shape
  - stack_resolver returns DEFAULT_STACK dict copy on any JSON parse failure (Pitfall 6 defensive default)
  - wireframe_builder returns FALLBACK_WIREFRAME immediately when sprints list is empty (no LLM call wasted)
  - test-key GROQ_API_KEY used in test environment — ChatGroq init requires non-null key even when LLM is mocked
  - main.py router was registered as part of Task 2 unblocking (Rule 3 deviation) then committed separately in Task 3
metrics:
  duration_minutes: 4
  tasks_completed: 3
  files_created: 4
  files_modified: 1
  tests_added: 24
  completed_date: "2026-04-22"
---

# Phase 04 Plan 03: Skeleton Generator AI Layer Summary

**One-liner:** 3-node LangGraph skeleton agent (stack_resolver → tree_builder → wireframe_builder) with FastAPI SSE endpoint using type-keyed events, defensive fallbacks at every node, and [DONE]-in-finally invariant.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create skeleton LangGraph agent (3-node graph) | a015955 | backend/agents/skeleton.py, backend/tests/test_skeleton_graph.py |
| 2 | Create FastAPI SSE endpoint for skeleton | f8f2709 | backend/api/skeleton.py, backend/tests/test_skeleton_sse_endpoint.py |
| 3 | Register skeleton router in main.py | 1aa9bd4 | backend/main.py |

## Test Results

All 25 tests pass (16 graph + 8 endpoint + 1 health):

```
============================= test session starts ==============================
platform linux -- Python 3.12.3, pytest-8.3.5, pluggy-1.6.0 -- /home/jayry/projects/skelecode/backend/venv/bin/python
cachedir: .pytest_cache
rootdir: /home/jayry/projects/skelecode/.claude/worktrees/agent-a72fb1ec/backend
configfile: pyproject.toml
plugins: asyncio-0.25.3, anyio-4.13.0, langsmith-0.7.32
asyncio: mode=Mode.AUTO, asyncio_default_fixture_loop_scope=None
collecting ... collected 25 items

tests/test_skeleton_graph.py::TestPromptsLoaded::test_stack_resolver_prompt_non_empty PASSED [  4%]
tests/test_skeleton_graph.py::TestPromptsLoaded::test_tree_builder_prompt_non_empty PASSED [  8%]
tests/test_skeleton_graph.py::TestPromptsLoaded::test_wireframe_builder_prompt_non_empty PASSED [ 12%]
tests/test_skeleton_graph.py::TestGraphCompiles::test_graph_is_not_none PASSED [ 16%]
tests/test_skeleton_graph.py::TestGraphCompiles::test_graph_has_astream PASSED [ 20%]
tests/test_skeleton_graph.py::TestGraphCompiles::test_default_stack_matches_context PASSED [ 24%]
tests/test_skeleton_graph.py::TestGraphCompiles::test_fallback_wireframe_matches_context PASSED [ 28%]
tests/test_skeleton_graph.py::TestStackResolver::test_returns_default_on_empty_llm_output PASSED [ 32%]
tests/test_skeleton_graph.py::TestStackResolver::test_returns_llm_stack_on_valid_json PASSED [ 36%]
tests/test_skeleton_graph.py::TestStackResolver::test_strips_markdown_fences PASSED [ 40%]
tests/test_skeleton_graph.py::TestTreeBuilder::test_builds_folder_tree_from_llm_file_list PASSED [ 44%]
tests/test_skeleton_graph.py::TestTreeBuilder::test_falls_back_on_malformed_llm_output PASSED [ 48%]
tests/test_skeleton_graph.py::TestWireframeBuilder::test_strips_html_markdown_fences PASSED [ 52%]
tests/test_skeleton_graph.py::TestWireframeBuilder::test_fallback_on_llm_exception PASSED [ 56%]
tests/test_skeleton_graph.py::TestWireframeBuilder::test_empty_sprints_returns_fallback_immediately PASSED [ 60%]
tests/test_skeleton_graph.py::TestLoadDotenvFirst::test_dotenv_loads_before_langchain_imports PASSED [ 64%]
tests/test_skeleton_sse_endpoint.py::TestSkeletonSSEEndpoint::test_returns_event_stream_content_type PASSED [ 68%]
tests/test_skeleton_sse_endpoint.py::TestSkeletonSSEEndpoint::test_emits_one_tree_line_event_per_line PASSED [ 72%]
tests/test_skeleton_sse_endpoint.py::TestSkeletonSSEEndpoint::test_emits_exactly_one_wireframe_event PASSED [ 76%]
tests/test_skeleton_sse_endpoint.py::TestSkeletonSSEEndpoint::test_stream_ends_with_done PASSED [ 80%]
tests/test_skeleton_sse_endpoint.py::TestSkeletonSSEEndpoint::test_done_emitted_even_on_graph_exception PASSED [ 84%]
tests/test_skeleton_sse_endpoint.py::TestSkeletonSSEEndpoint::test_project_md_truncated_to_max_chars PASSED [ 88%]
tests/test_skeleton_sse_endpoint.py::TestSkeletonSSEEndpoint::test_sprints_truncated_to_max PASSED [ 92%]
tests/test_skeleton_sse_endpoint.py::TestSkeletonSSEEndpoint::test_event_shape_uses_type_key_not_node_key PASSED [ 96%]
tests/test_health.py::test_health_returns_ok PASSED                      [100%]

============================== 25 passed in 1.82s ==============================
```

## App Routes (Integration Check)

```
['/openapi.json', '/docs', '/docs/oauth2-redirect', '/redoc', '/api/brainstorm', '/api/sprint-planner', '/api/skeleton', '/health']
```

`/api/skeleton` is registered and visible in `app.routes`.

## TDD Gate Compliance

Both TDD tasks followed RED/GREEN cycle:

- Task 1: Tests written first (16 tests — all ModuleNotFoundError on RED), then `backend/agents/skeleton.py` implemented (16 PASSED on GREEN).
- Task 2: Tests written first (8 tests — all failed with `ModuleNotFoundError` or 404 on RED), then `backend/api/skeleton.py` created (8 PASSED on GREEN after Task 3 unblocked main.py).

## Decisions Made

1. **type-keyed SSE events** — `{"type": "tree_line", ...}` and `{"type": "wireframe", ...}` per CONTEXT.md locked contract. Deliberately different from sprint_planner's `{"node": ..., "data": ...}` shape which the frontend consumes separately.
2. **Per-node LLM instances** — stack_resolver (temp=0.0, max_tokens=512), tree_builder (temp=0.0, max_tokens=2048), wireframe_builder (temp=0.5, max_tokens=1500). Different temperatures reflect the nature of each task: stack/tree are deterministic, wireframe is creative.
3. **stack_resolver copies DEFAULT_STACK** — `dict(DEFAULT_STACK)` creates a new dict each call to avoid shared mutable state between concurrent requests.
4. **wireframe_builder short-circuits on empty sprints** — returns FALLBACK_WIREFRAME immediately without invoking the LLM, saving a Groq API call.
5. **GROQ_API_KEY=test-key in tests** — ChatGroq validates the API key at `__init__` time (not at call time), so even when LLMs are mocked via `patch`, the module-level initialization requires a non-null key. Tests use env var override, not a conftest fixture, to keep test isolation clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Registered main.py router during Task 2 to unblock endpoint tests**
- **Found during:** Task 2 (endpoint tests)
- **Issue:** `test_skeleton_sse_endpoint.py` tests use `from main import app` → `TestClient(app)`. Without the skeleton router registered in main.py, all 8 endpoint tests returned 404. This is a direct dependency: Task 2 tests cannot pass without Task 3's change.
- **Fix:** Modified main.py as part of Task 2 execution, then committed the main.py change separately as Task 3's commit per the plan's task structure.
- **Files modified:** backend/main.py
- **Commit:** 1aa9bd4

## Known Stubs

None — all nodes have real LLM calls or explicit fallback paths. No placeholder data flows to any consumer.

## Threat Flags

No new security surface beyond what the plan's threat model documents. All mitigations from T-04-12 through T-04-18 are implemented:
- T-04-12/T-04-14: `project_md[:MAX_PROJECT_MD_CHARS]` truncation enforced in endpoint and verified by test
- T-04-13: `sprints[:MAX_SPRINTS]` cap enforced and verified by test
- T-04-16: `finally: yield "data: [DONE]\n\n"` always-in-finally invariant verified by test
- T-04-18: `str(e)` only (not traceback) in error events; full traceback to `logger.exception()`

## What You Can Test Now

**Prerequisites:** `GROQ_API_KEY` set in backend environment (or `backend/.env`)

| What | How | Expected |
|------|-----|----------|
| All unit tests | `cd backend && GROQ_API_KEY=your-key venv/bin/python -m pytest tests/test_skeleton_graph.py tests/test_skeleton_sse_endpoint.py tests/test_health.py -v` | 25 passed |
| Backend health | `cd backend && GROQ_API_KEY=your-key venv/bin/uvicorn main:app --reload` then `curl http://localhost:8000/health` | `{"status":"ok"}` |
| Skeleton route registered | `cd backend && GROQ_API_KEY=your-key venv/bin/python -c "from main import app; print([getattr(r,'path','') for r in app.routes])"` | `/api/skeleton` in list |
| Live SSE stream | `curl -sN -X POST http://localhost:8000/api/skeleton -H 'Content-Type: application/json' -d '{"project_md":"# Test app","sprints":[{"number":1,"goal":"Setup","user_stories":[],"technical_tasks":["Create skeleton"],"definition_of_done":[]}]}'` | SSE frames with `"type":"tree_line"` then `"type":"wireframe"` then `data: [DONE]` |

**Not yet testable:** Frontend /skeleton page (Plan 04), skeleton DB persistence (Plan 04), download zip (Plan 04)

## Self-Check: PASSED

Files created:
- backend/agents/skeleton.py: FOUND
- backend/api/skeleton.py: FOUND
- backend/tests/test_skeleton_graph.py: FOUND
- backend/tests/test_skeleton_sse_endpoint.py: FOUND

Files modified:
- backend/main.py: skeleton_router import + include_router confirmed present

Commits verified:
- a015955: feat(04-03): create skeleton LangGraph 3-node agent and unit tests
- f8f2709: feat(04-03): create FastAPI SSE endpoint for skeleton and endpoint tests
- 1aa9bd4: feat(04-03): register skeleton router in main.py
