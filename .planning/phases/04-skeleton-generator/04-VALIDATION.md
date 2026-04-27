---
phase: 4
slug: skeleton-generator
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend) |
| **Config file** | `backend/pytest.ini` or `backend/pyproject.toml` (existing) |
| **Quick run command** | `cd backend && python -m pytest tests/test_tree_formatter.py tests/test_skeleton_sse_endpoint.py -v` |
| **Full suite command** | `cd backend && python -m pytest tests/ -v` |
| **Estimated runtime** | ~5 seconds (mocked tests) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_tree_formatter.py -v` (tree formatter unit tests)
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -v`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | SKEL-BACKEND-STATE | — | N/A | grep | `grep 'class SkeletonState(TypedDict)' backend/models/skeleton_state.py` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | SKEL-BACKEND-TREE-UTIL | — | N/A | unit | `cd backend && python -m pytest tests/test_tree_formatter.py -v` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | SKEL-BACKEND-AGENT | — | load_dotenv before imports | grep | `head -3 backend/agents/skeleton.py` → load_dotenv on line 3 | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | SKEL-BACKEND-SSE | IDOR/DoS | input truncation enforced | unit | `cd backend && python -m pytest tests/test_skeleton_sse_endpoint.py -v` | ❌ W0 | ⬜ pending |
| 04-01-05 | 01 | 1 | SKEL-BACKEND-ROUTER | — | N/A | grep | `grep 'skeleton_router' backend/main.py` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | SKEL-DB-SCHEMA | — | N/A | grep | `grep -c 'export const skeletons' frontend/lib/db/schema.ts` → 1 | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | SKEL-DB-PUSH | — | N/A | manual | `cd frontend && npx drizzle-kit push` → "Changes applied" | N/A | ⬜ pending |
| 04-02-03 | 02 | 2 | SKEL-API-ROUTE | IDOR | ownership check present | grep | `grep 'and(eq(projects.id' "frontend/app/api/projects/[id]/skeleton/route.ts"` | ❌ W0 | ⬜ pending |
| 04-02-04 | 02 | 2 | SKEL-API-PROXY | — | N/A | grep | `ls frontend/app/api/skeleton/route.ts` | ❌ W0 | ⬜ pending |
| 04-02-05 | 02 | 2 | SKEL-FRONTEND-PAGE | XSS | sandbox no allow-same-origin | grep | `grep -L 'allow-same-origin' frontend/components/WireframePreview.tsx` | ❌ W0 | ⬜ pending |
| 04-02-06 | 02 | 2 | SKEL-FRONTEND-DOWNLOAD | — | N/A | grep | `grep 'jszip' frontend/app/skeleton/page.tsx` | ❌ W0 | ⬜ pending |
| 04-02-07 | 02 | 2 | SKEL-FRONTEND-SAVE | — | N/A | grep | `grep 'PUT.*skeleton' frontend/app/skeleton/page.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_tree_formatter.py` — unit tests for `format_tree()` with nested directory assertions
- [ ] `backend/tests/test_skeleton_sse_endpoint.py` — SSE invariant tests: `[DONE]` always emitted, tree_line events, wireframe event, error path
- [ ] `backend/utils/__init__.py` — empty init to make utils a Python package

*Existing pytest infrastructure covers all other requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/skeleton` page renders two panels | SKEL-FRONTEND-PAGE | Browser render | `npm run dev` → navigate to `/skeleton`; verify left + right panels visible |
| Folder tree streams line by line | SKEL-FRONTEND-STREAM | SSE + state update | Click "Generate Skeleton"; watch left panel populate |
| Wireframe renders in iframe | SKEL-FRONTEND-IFRAME | iframe srcDoc rendering | Verify right panel shows HTML layout after generation |
| "Copy to clipboard" works | SKEL-FRONTEND-COPY | Clipboard API | Click copy; paste into text editor; verify full tree |
| "Open in new tab" works | SKEL-FRONTEND-NEWTAB | Blob URL | Click button; verify new tab opens with wireframe HTML |
| ZIP download | SKEL-FRONTEND-ZIP | File download | Click download; unzip; verify `structure.txt` + `wireframe.html` |
| Page reload restores skeleton | SKEL-DB-PERSIST | DB round-trip + context | Complete generation; reload page; verify both panels still populated |
| Empty state guard | SKEL-FRONTEND-EMPTY | Conditional render | Clear context; navigate to `/skeleton`; verify "Complete the sprint planner first" message |
| `npx drizzle-kit push` applies skeletons table | SKEL-DB-PUSH | Requires live Neon DB | Run push; verify "Changes applied" in output |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
