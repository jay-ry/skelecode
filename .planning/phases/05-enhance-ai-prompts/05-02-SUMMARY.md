---
phase: 05-enhance-ai-prompts
plan: "02"
subsystem: backend/prompts + backend/models
tags:
  - prompt-engineering
  - llm
  - extractor
  - drafter
  - project-md
dependency_graph:
  requires: []
  provides:
    - ExtractedFields with 7 fields (monetization, sprint_count_hint added)
    - extractor_system.txt with 7-field extraction list
    - drafter_system.txt with 11-section project.md structure
  affects:
    - backend/agents/brainstorm.py (extractor_node consumes ExtractedFields)
    - drafter LLM output (richer project.md)
tech_stack:
  added: []
  patterns:
    - Optional[str] Pydantic field extension
    - UNTRUSTED DATA prompt guard
    - Conditional section omission in LLM prompt
key_files:
  created: []
  modified:
    - backend/models/brainstorm_state.py
    - backend/prompts/extractor_system.txt
    - backend/prompts/drafter_system.txt
decisions:
  - "Used ## heading level for all 11 top-level sections in drafter_system.txt (matching plan/project.md)"
  - "REQUIRED_FIELDS in brainstorm.py left unchanged — monetization and sprint_count_hint are optional and do not gate the reviewer router"
  - "Groq API key required at runtime to test graph compile; structure is correct and imports succeed without API key only for model-level tests"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-27"
  tasks_completed: 3
  files_modified: 3
---

# Phase 5 Plan 02: Expand Brainstorm Pipeline for Rich project.md Summary

One-liner: Extended ExtractedFields with monetization/sprint_count_hint, updated extractor prompt to 7 fields, and rewrote drafter prompt with all 11 project.md sections, exact table column specs, UNTRUSTED DATA guard, and conditional Monetization omission.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend ExtractedFields with monetization and sprint_count_hint | ff10d82 | backend/models/brainstorm_state.py |
| 2 | Extend extractor_system.txt with 2 new field bullets | bfa93a7 | backend/prompts/extractor_system.txt |
| 3 | Rewrite drafter_system.txt with 11-section structure | a36a505 | backend/prompts/drafter_system.txt |

## ExtractedFields — Final 7 Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| problem | Optional[str] | No | Core problem the project solves |
| users | Optional[str] | No | Primary target users |
| features | Optional[str] | No | 3-5 core MVP features |
| stack | Optional[str] | No | Preferred tech stack |
| constraints | Optional[str] | No | Budget, timeline, technical constraints |
| monetization | Optional[str] | No (NEW) | Pricing model or revenue approach |
| sprint_count_hint | Optional[str] | No (NEW) | Rough sprint count implied by scope |

## REQUIRED_FIELDS Confirmation

`REQUIRED_FIELDS` in `backend/agents/brainstorm.py` was **NOT modified**. It still contains only `["problem", "users", "features", "stack", "constraints"]`. The two new fields are fully optional and do not block the reviewer router. The plan explicitly declared `brainstorm.py` as out of scope.

## drafter_system.txt Section Heading Levels

All 11 top-level sections use `## ` (h2) heading level, matching `plan/project.md` exactly:

1. `## Vision`
2. `## Problem`
3. `## Target Users`
4. `## Core Features`
5. `## Tech Stack`
6. `## Data Model`
7. `## Monetization` (OMIT when `monetization` not in input data)
8. `## Sprint Overview`
9. `## Constraints & Assumptions`
10. `## Success Metrics`
11. `## Out of Scope (v1)`

The document top heading uses `# ` (h1): `# <Project Name> — Project Specification`

## Conditional Monetization Omission

The drafter prompt contains the rule verbatim:
> "OMIT this entire section if `monetization` is not present in the input data"
> "Omit the Monetization section entirely if the project data contains no `monetization` field — do not write a placeholder or empty table."

Since `model_dump(exclude_none=True)` omits None-valued fields, when a user does not mention pricing the `monetization` key is absent from the JSON the drafter receives — the conditional rule fires and the section is silently omitted. Manual verification of this flow requires a live brainstorm run with GROQ_API_KEY set (see plan section 4 of verification).

## Deviations from Plan

None — plan executed exactly as written. All three files modified match the plan's `files_modified` list. No REQUIRED_FIELDS changes made. No extra files touched.

## Known Stubs

None. This plan modifies prompt text files and a Pydantic model — no UI stubs or placeholder data.

## Threat Flags

T-05-05 mitigated: UNTRUSTED DATA guard embedded verbatim in `drafter_system.txt` as required.
T-05-07 mitigated: Drafter prompt UNTRUSTED DATA guard covers monetization field injection path.

## Self-Check: PASSED

- [x] `backend/models/brainstorm_state.py` exists and contains 7 Optional[str] fields
- [x] `backend/prompts/extractor_system.txt` exists and contains 7 field bullets
- [x] `backend/prompts/drafter_system.txt` exists with 3998 chars (> 2500) and all 11 sections
- [x] Commits ff10d82, bfa93a7, a36a505 exist in git log
