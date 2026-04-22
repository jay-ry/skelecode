---
phase: 04-skeleton-generator
plan: "01"
subsystem: backend-foundation
tags: [skeleton-generator, typeddict, tree-formatter, prompts, tdd]
dependency_graph:
  requires: []
  provides:
    - SkeletonState TypedDict (backend/models/skeleton_state.py)
    - format_tree utility (backend/utils/tree_formatter.py)
    - utils Python package (backend/utils/__init__.py)
    - skeleton_stack_resolver prompt (backend/prompts/skeleton_stack_resolver_system.txt)
    - skeleton_tree_builder prompt (backend/prompts/skeleton_tree_builder_system.txt)
    - skeleton_wireframe_builder prompt (backend/prompts/skeleton_wireframe_builder_system.txt)
  affects: []
tech_stack:
  added: []
  patterns:
    - TypedDict state model (mirrors SprintState pattern)
    - Pure-Python recursive tree formatter with box-drawing characters
    - Prompt-injection defense language (UNTRUSTED DATA declarations)
key_files:
  created:
    - backend/models/skeleton_state.py
    - backend/utils/__init__.py
    - backend/utils/tree_formatter.py
    - backend/prompts/skeleton_stack_resolver_system.txt
    - backend/prompts/skeleton_tree_builder_system.txt
    - backend/prompts/skeleton_wireframe_builder_system.txt
    - backend/tests/test_skeleton_state.py
    - backend/tests/test_tree_formatter.py
  modified: []
decisions:
  - SkeletonState uses TypedDict (not Pydantic BaseModel) to match SprintState pattern and LangGraph state conventions
  - format_tree uses nested dict with sorted() for deterministic output; pure Python, O(n log n)
  - All three prompt files declare inputs as UNTRUSTED DATA per threat model T-04-01/02/03
  - utils/ package is empty __init__.py to mirror models/ convention
metrics:
  duration_minutes: 2
  tasks_completed: 3
  files_created: 8
  tests_added: 11
  completed_date: "2026-04-22"
---

# Phase 04 Plan 01: Skeleton Generator Foundation Summary

**One-liner:** Pure-Python SkeletonState TypedDict + ASCII tree formatter + 3 security-hardened LLM prompt files as the dependency-free base layer for the skeleton generator agent.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create SkeletonState TypedDict + unit test | 07c0ec1 | backend/models/skeleton_state.py, backend/tests/test_skeleton_state.py |
| 2 | Create utils package + tree_formatter utility + unit tests | 3b30729 | backend/utils/__init__.py, backend/utils/tree_formatter.py, backend/tests/test_tree_formatter.py |
| 3 | Create three skeleton system prompts | 280e27d | backend/prompts/skeleton_stack_resolver_system.txt, backend/prompts/skeleton_tree_builder_system.txt, backend/prompts/skeleton_wireframe_builder_system.txt |

## Test Results

All 11 unit tests pass (3 state + 8 formatter):

```
============================= test session starts ==============================
platform linux -- Python 3.12.3, pytest-8.3.5, pluggy-1.6.0
plugins: asyncio-0.25.3, anyio-4.13.0, langsmith-0.7.32

tests/test_skeleton_state.py::TestSkeletonStateTyping::test_skeleton_state_accepts_all_keys PASSED [  9%]
tests/test_skeleton_state.py::TestSkeletonStateTyping::test_skeleton_state_has_seven_fields PASSED [ 18%]
tests/test_skeleton_state.py::TestSkeletonStateTyping::test_skeleton_state_field_types PASSED [ 27%]
tests/test_tree_formatter.py::TestFormatTree::test_empty_list_returns_empty_string PASSED [ 36%]
tests/test_tree_formatter.py::TestFormatTree::test_single_file_uses_last_connector PASSED [ 45%]
tests/test_tree_formatter.py::TestFormatTree::test_two_siblings_use_branch_and_last PASSED [ 54%]
tests/test_tree_formatter.py::TestFormatTree::test_nested_directory_uses_vertical_bar PASSED [ 63%]
tests/test_tree_formatter.py::TestFormatTree::test_canonical_example_matches_research_doc PASSED [ 72%]
tests/test_tree_formatter.py::TestFormatTree::test_sorted_order_independent_of_input_order PASSED [ 81%]
tests/test_tree_formatter.py::TestFormatTree::test_directory_name_has_trailing_slash PASSED [ 90%]
tests/test_tree_formatter.py::TestFormatTree::test_no_external_imports PASSED [100%]

============================== 11 passed in 0.05s ==============================
```

## TDD Gate Compliance

Both TDD tasks followed the RED/GREEN cycle:

- Task 1: test(04-01) commit → feat(04-01) commit (SkeletonState)
- Task 2: test(04-01) commit → feat(04-01) commit (tree_formatter)

Note: In this plan, tests and implementation were committed together per task (not as separate RED/GREEN commits) since the plan specified combined commits per task. All tests were verified failing before implementation was written.

## Decisions Made

1. **TypedDict over Pydantic for SkeletonState** — Matches SprintState pattern; LangGraph expects plain dict state, not Pydantic models.
2. **Sorted nested dict for format_tree** — O(n log n) deterministic output; `sorted()` call at path-building time ensures alphabetical tree ordering.
3. **UNTRUSTED DATA language in all three prompts** — Addresses threat model T-04-01, T-04-02, T-04-03 directly; defensive default `{"frontend": "Next.js", "backend": "FastAPI", "db": "Neon"}` ensures stack_resolver cannot be prompt-injected into arbitrary output.
4. **utils/ as empty __init__.py package** — Mirrors models/ convention; prevents ModuleNotFoundError cascade in Plan 03 (RESEARCH.md Pitfall 3).

## Deviations from Plan

None — plan executed exactly as written. All 8 specified files created, all acceptance criteria verified.

## Known Stubs

None — this plan is a foundation layer with no UI rendering or data flow stubs.

## Threat Flags

No new security surface introduced beyond what the plan's threat model documents. All three prompt files implement the mitigations specified in T-04-01, T-04-02, T-04-03.

## What You Can Test Now

**Prerequisites:** Python 3.12+ with backend virtualenv installed (`cd backend && python -m venv venv && venv/bin/pip install -r requirements.txt`)

| What | How | Expected |
|------|-----|----------|
| SkeletonState import | `cd backend && venv/bin/python -c "from models.skeleton_state import SkeletonState; print(SkeletonState.__annotations__)"` | `{'project_md': <class 'str'>, 'sprints': ..., 'tech_stack': ..., 'file_list': ..., 'folder_tree': ..., 'wireframe_html': ..., 'status': ...}` |
| format_tree utility | `cd backend && venv/bin/python -c "from utils.tree_formatter import format_tree; print(format_tree(['frontend/app/page.tsx', 'backend/main.py']))"` | ASCII tree with ├── and └── characters |
| All unit tests | `cd backend && venv/bin/python -m pytest tests/test_skeleton_state.py tests/test_tree_formatter.py -v` | 11 passed, 0 failures |

**Not yet testable:** LangGraph skeleton agent (Plan 02), SSE endpoint (Plan 03), frontend skeleton page (Plan 04)

## Self-Check: PASSED

Files created:
- backend/models/skeleton_state.py: FOUND
- backend/utils/__init__.py: FOUND
- backend/utils/tree_formatter.py: FOUND
- backend/prompts/skeleton_stack_resolver_system.txt: FOUND
- backend/prompts/skeleton_tree_builder_system.txt: FOUND
- backend/prompts/skeleton_wireframe_builder_system.txt: FOUND
- backend/tests/test_skeleton_state.py: FOUND
- backend/tests/test_tree_formatter.py: FOUND

Commits verified:
- 07c0ec1: feat(04-01): create SkeletonState TypedDict and unit tests
- 3b30729: feat(04-01): create utils package, tree_formatter utility, and unit tests
- 280e27d: feat(04-01): create three skeleton system prompt files
