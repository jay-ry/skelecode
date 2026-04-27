---
phase: 2
slug: sprint-planner-agent
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend) / manual browser (frontend) |
| **Config file** | backend/pytest.ini or none — Wave 0 installs |
| **Quick run command** | `cd backend && venv/bin/pytest tests/ -x -q` |
| **Full suite command** | `cd backend && venv/bin/pytest tests/ -v` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && venv/bin/pytest tests/ -x -q`
- **After every plan wave:** Run `cd backend && venv/bin/pytest tests/ -v`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | Sprint planner agent | — | LLM input sanitized | unit | `cd backend && venv/bin/pytest tests/test_sprint_planner.py -x -q` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | Sprint planner agent | — | SSE stream terminates on error | unit | `cd backend && venv/bin/pytest tests/test_sprint_planner.py::test_sse_endpoint -x -q` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | Progressive sprint cards | — | N/A (UI component) | manual | Browser: cards appear one by one with auto-expand | — | ⬜ pending |
| 02-02-02 | 02 | 2 | Progressive sprint cards | — | N/A (UI component) | manual | Browser: each card has 4 sections populated | — | ⬜ pending |
| 02-03-01 | 03 | 3 | State sharing | — | Context serializes safely | unit | `cd frontend && npm run build 2>&1 | grep -c error` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 3 | Zip download | — | Zip filenames validated | manual | Browser: download zip, verify sprint-1.md naming | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_sprint_planner.py` — stubs for sprint planner agent and SSE endpoint
- [ ] `backend/tests/conftest.py` — shared fixtures (if not exists from Phase 1)

*Frontend components verified manually via browser; Next.js build check covers TypeScript correctness.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cards appear one by one as SSE streams | Progressive sprint cards | Requires live SSE connection and browser rendering | Start dev server, open /sprints, click Generate, observe cards appearing sequentially |
| Card auto-expands on arrival | Progressive sprint cards | Visual behavior requires browser | Verify each new card expands while previous stays in user-set state |
| Download produces valid zip | Zip download | File system download requires browser | Click download, open zip, verify sprint-N.md files with correct content |
| Context survives navigation | State sharing | Requires browser navigation | Go to /, generate project.md, navigate to /sprints, generate sprints, navigate back to /, return to /sprints — sprint data still present |
| /sprints guard for empty projectMd | Sprint planner agent | UI state check | Navigate directly to /sprints without project.md — verify "Generate Sprints" disabled with message |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
