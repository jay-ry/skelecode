---
phase: 05-enhance-ai-prompts
plan: "04"
subsystem: frontend
tags: [frontend, react-markdown, sprint-rendering, typescript]

# Dependency graph
requires:
  - phase: 05-enhance-ai-prompts
    plan: "01"
    provides: "{number, goal, content_md} SSE payload shape from sprint planner"
provides:
  - frontend/types/sprint.ts — Sprint interface with required content_md and optional legacy fields
  - frontend/components/SprintCard.tsx — ReactMarkdown rendering with legacy Section fallback
  - frontend/app/sprints/[id]/page.tsx — rehydration from contentMd column + content_md download preference
affects:
  - frontend/components/SprintList.tsx (passes Sprint[] unchanged — no change needed)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "react-markdown + remark-gfm pattern mirrored from ProjectPreview.tsx (prose container with identical className)"
    - "hasMarkdown guard: typeof === string && trim().length > 0 — safe against null/undefined/empty"
    - "rehydrateSprints: column-first, blob-fallback, empty-string default for content_md"

key-files:
  created: []
  modified:
    - frontend/types/sprint.ts
    - frontend/components/SprintCard.tsx
    - frontend/app/sprints/[id]/page.tsx

key-decisions:
  - "Inline Sprint interface in page.tsx removed — single source of truth is types/sprint.ts"
  - "formatSprintMarkdown kept as legacy fallback for old DB rows with no content_md"
  - "No rehypeRaw plugin added — react-markdown@10 default HTML escaping satisfies T-05-10 (XSS mitigation)"

# Metrics
duration: 12min
completed: 2026-04-27
---

# Phase 5 Plan 04: Frontend Sprint Rendering Update Summary

**Sprint cards now render 10-section markdown via ReactMarkdown when content_md is present; legacy DB rows (pre-phase-5) fall back to the original Section components unchanged.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-27T11:17:00Z
- **Completed:** 2026-04-27T11:29:19Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Updated `frontend/types/sprint.ts`: added required `content_md: string` field, marked `user_stories`, `technical_tasks`, `definition_of_done` as optional (`?:`) for backwards compatibility
- Refactored `frontend/components/SprintCard.tsx`: imports `ReactMarkdown` and `remarkGfm`, renders `sprint.content_md` inside the same prose container used by `ProjectPreview.tsx` when `content_md` is a non-empty string; falls back to legacy `Section` components otherwise
- Updated `frontend/app/sprints/[id]/page.tsx`: removed inline `Sprint` interface, added `import type { Sprint } from "../../../types/sprint"`, extended `SprintRowApi` with `contentMd: string | null`, updated `rehydrateSprints` to populate `content_md` from DB column or legacy blob, updated `handleDownloadAll` to prefer `content_md` for download files

## Task Commits

1. **Task 1: Update frontend/types/sprint.ts** - `0cbfab5` (feat)
2. **Task 2: Refactor SprintCard.tsx** - `861d6e1` (feat)
3. **Task 3: Update sprints page** - `3bcd08f` (feat)

## Files Created/Modified

- `frontend/types/sprint.ts` — Added `content_md: string` (required); `user_stories`, `technical_tasks`, `definition_of_done` now optional `string[]`
- `frontend/components/SprintCard.tsx` — ReactMarkdown import, `hasMarkdown` conditional, prose container matching ProjectPreview.tsx, legacy Section fallback
- `frontend/app/sprints/[id]/page.tsx` — Removed inline Sprint interface, import from types, `contentMd` in SprintRowApi, rehydrateSprints content_md logic, download preference

## Decisions Made

- **Inline Sprint interface removed** from `page.tsx` — the duplicate was a D-08 (single source of truth) violation. `types/sprint.ts` is now the only definition.
- **formatSprintMarkdown kept** — serves as legacy fallback in `handleDownloadAll` for old DB rows with no `content_md`. Not removed.
- **No rehypeRaw** — deliberately omitted to satisfy T-05-10 XSS threat mitigation. Only `[remarkGfm]` is in the plugin list.

## TypeScript Baseline — Before vs After

**Before changes** (original project, all three files): 0 errors  
**After changes** (worktree with symlinked node_modules): 0 errors across `types/sprint.ts`, `components/SprintCard.tsx`, and `app/sprints/[id]/page.tsx`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `formatSprintMarkdown` for optional legacy fields**
- **Found during:** Task 3 tsc verification
- **Issue:** After marking `user_stories`, `technical_tasks`, `definition_of_done` as optional in the Sprint type (Task 1), `formatSprintMarkdown` in page.tsx was calling `.map()` directly on potentially-undefined arrays, producing 3 TypeScript errors (TS18048: possibly undefined).
- **Fix:** Added `?? []` fallbacks to all three array spreads in `formatSprintMarkdown`, consistent with the same pattern used in `rehydrateSprints` and `SprintCard`'s legacy Section fallback.
- **Files modified:** `frontend/app/sprints/[id]/page.tsx`
- **Commit:** `3bcd08f`

## Backwards Compatibility Verification

The legacy fallback path was verified by code inspection:
- `rehydrateSprints` always sets `content_md: ""` when neither `row.contentMd` nor `blob?.content_md` is present — old rows without the column get an empty string
- `SprintCard` checks `typeof sprint.content_md === "string" && sprint.content_md.trim().length > 0` before rendering ReactMarkdown — empty string routes to the Section fallback
- `formatSprintMarkdown` uses `?? []` for all three legacy arrays — safe against undefined values from old rows

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. The react-markdown render of LLM-generated content (T-05-10) is mitigated by omitting `rehypeRaw` — only `remarkGfm` is in the plugin list, preserving react-markdown's default HTML escaping.

## Known Stubs

None — all data paths are wired. `content_md` flows from SSE → `accumulatedSprintsRef` → `setSprints` → `SprintCard` render, and from DB → `rehydrateSprints` → `setSprints` → `SprintCard` render.

## Self-Check: PASSED

- [x] `frontend/types/sprint.ts` has `content_md: string;` (required)
- [x] `frontend/components/SprintCard.tsx` has `import ReactMarkdown from "react-markdown"`
- [x] `frontend/app/sprints/[id]/page.tsx` has `import type { Sprint } from "../../../types/sprint"`
- [x] `frontend/app/sprints/[id]/page.tsx` does NOT contain `^interface Sprint {`
- [x] 3 task commits exist: 0cbfab5, 861d6e1, 3bcd08f
- [x] 0 tsc errors across all three modified files

## What You Can Test Now

**Prerequisites:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `GROQ_API_KEY` set in `frontend/.env.local` and `backend/.env`. Phase 01 (sprint planner refactor) must also be deployed for new sprints to produce `content_md`.

| What | How | Expected |
|------|-----|----------|
| Backend health | `cd backend && venv/bin/uvicorn main:app --reload` then GET /health | `{"status": "ok"}` |
| Frontend dev server | `cd frontend && npm run dev` then http://localhost:3000 | Sprint page loads without errors |
| Sprint generation (full flow) | Log in, open a project, click Generate Sprints | Sprint cards appear with full 10-section markdown rendered (headings, code blocks, checklists visible) |
| Sprint card markdown rendering | Expand any generated sprint card | Sprint Goal, File Map, Frontend/Backend Tasks, Env Vars, DoD sections render as formatted markdown |
| Sprint save round-trip | Generate sprints, then refresh page | Sprints re-load from DB and still render full markdown (not empty cards) |
| Legacy DB row fallback | Open a project created before phase 5 | Sprint cards show User Stories / Technical Tasks / Definition of Done sections (legacy Section fallback, no UI break) |
| Download ZIP | Click Download all (.zip), open sprint-1.md | File contains full 10-section sprint document (not three-bullet legacy format) |

**Not yet testable independently:** New-format sprint cards only render once Plan 01 (sprint planner refactor) is also deployed. Frontend changes are complete.
