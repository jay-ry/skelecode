---
phase: 1
slug: scaffold-brainstorm-agent
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (backend) + manual browser verification (frontend) |
| **Config file** | backend/pytest.ini (Wave 0 installs) |
| **Quick run command** | `cd backend && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -v` |
| **Estimated runtime** | ~10 seconds (unit tests only) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/ -x -q`
- **After every plan wave:** Run full suite + browser smoke test
- **Before `/gsd-verify-work`:** Full suite must be green + all 6 DoD items verified in browser
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01-01 | 1 | CopilotKit chat UI | — | N/A | manual | browser: localhost:3000 chat loads | ✅ after task | ⬜ pending |
| 01-01-02 | 01-01 | 1 | SSE streaming | — | N/A | manual | browser: preview populates on spec gen | ✅ after task | ⬜ pending |
| 01-02-01 | 01-02 | 1 | Brainstorm agent | — | N/A | unit | `pytest tests/test_brainstorm_graph.py` | ❌ W0 | ⬜ pending |
| 01-02-02 | 01-02 | 1 | Brainstorm agent — drafter section completeness | — | N/A | unit | `pytest tests/test_drafter.py::test_section_completeness -x` | ❌ W0 | ⬜ pending |
| 01-03-01 | 01-03 | 2 | SSE endpoint | — | N/A | unit | `pytest tests/test_sse_endpoint.py` | ❌ W0 | ⬜ pending |
| 01-03-02 | 01-03 | 2 | project.md preview | — | N/A | manual | browser: markdown renders correctly | ✅ after task | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/__init__.py` — empty init for test discovery
- [ ] `backend/tests/conftest.py` — shared fixtures (sample_conversation, incomplete_conversation)
- [ ] `backend/tests/test_brainstorm_graph.py` — reviewer routing logic + graph compile + prompt load tests (covers former test_brainstorm_agent.py and test_reviewer_loop_guard.py)
- [ ] `backend/tests/test_drafter.py` — drafter section completeness: asserts all 7 required headers present in project_md output
- [ ] `backend/tests/test_sse_endpoint.py` — SSE endpoint response format, [DONE] sentinel, truncation
- [ ] `backend/tests/test_health.py` — smoke test for GET /health

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CopilotKit chat renders and receives messages | CopilotKit chat UI | Browser UI — no headless test | Open localhost:3000, type in chat, verify response |
| Preview panel streams content live | SSE streaming | Requires real Anthropic API call | After brainstorm, verify right panel populates in real time |
| Markdown renders correctly | project.md preview | Visual rendering check | Verify headings, tables, code blocks render in preview |
| Download button works | project.md preview | Browser download API | Click download, verify .md file downloads cleanly |
| GET /health returns ok | Brainstorm agent | Integration | curl localhost:8000/health |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
