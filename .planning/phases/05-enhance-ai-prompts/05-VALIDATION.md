---
phase: 5
slug: enhance-ai-prompts
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual + browser testing (no automated test suite detected) |
| **Config file** | None — no pytest/jest config present |
| **Quick run command** | Start backend + frontend; trigger sprint generation via UI |
| **Full suite command** | End-to-end: brainstorm → sprint generation → card rendering → save → reload |
| **Estimated runtime** | ~5 minutes (manual flow) |

---

## Sampling Rate

- **After every task commit:** Verify the modified file renders/runs without error
- **After every plan wave:** Run the full E2E flow (brainstorm → sprints → save → reload)
- **Before `/gsd-verify-work`:** Full E2E suite must pass with all 8 behaviors below confirmed
- **Max feedback latency:** ~5 minutes per wave

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01 | Sprint Planner Refactor | 1 | D-01,D-02,D-03,D-04 | Prompt Injection | UNTRUSTED DATA guard in sprint_planner_system.txt | Manual | Inspect SSE payload: `event.data.content_md` is non-empty string | ✅ | ⬜ pending |
| 5-02 | Sprint Markdown Format | 1 | D-05 | — | N/A | Browser | Open `/sprints/[id]`; expand card; verify headings render (Sprint Goal, File Map etc.) | ✅ | ⬜ pending |
| 5-03 | Drafter Expansion | 1 | D-06,D-07,D-08 | Prompt Injection | UNTRUSTED DATA guard preserved | Browser | Complete brainstorm → view project.md preview; count 11 sections | ✅ | ⬜ pending |
| 5-04 | Extractor Extension | 1 | D-09 | — | N/A | Manual | Send brainstorm with pricing mention; SSE `drafter` node data contains monetization | ✅ | ⬜ pending |
| 5-05 | Skeleton Prompts | 2 | D-10,D-11 | — | N/A | Manual | Call skeleton with T3 project.md; verify tech_stack.frontend = "Next.js" | ✅ | ⬜ pending |
| 5-06 | Frontend Sprint Rendering | 2 | D-12 | — | N/A | Browser | Open `/sprints/[id]`; verify markdown renders (not raw text); legacy rows show fallback | ✅ | ⬜ pending |
| 5-07 | Sprint Save | 2 | D-03,D-04 | — | N/A | DB check | After generating, check Supabase `sprints` table: `content_md` populated, not null | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — no new test files required. This phase modifies prompt text files, Python agent code, and React components. Verification is manual/browser-based.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sprint planner produces markdown (not JSON) | D-01, D-02 | SSE payload inspection needed | Start backend; generate sprints; check browser DevTools Network tab for SSE events; verify `data.content_md` is a markdown string |
| Sprint separator parsing is correct | D-03 | Parse logic runs inside backend | Verify >1 sprint returned when generating a multi-sprint project; check sprint count matches expected |
| Sprint cards show all 10 sections | D-05 | Browser rendering verification | Open generated sprint; expand card; verify Sprint Goal, File Map, Frontend Tasks, Backend Tasks, Env Vars, Stub Strategy, DoD, Test Scenario are visible |
| project.md has 11 sections including Sprint Overview | D-06, D-07, D-08 | UI rendering check | Complete full brainstorm; open project preview; verify Sprint Overview table is present |
| `content_md` saved to DB | D-03 | Database check | After sprint generation + save, open Supabase dashboard; verify sprints rows have content_md populated |
| Legacy rows display via fallback | D-12 | Backwards compat check | If any old sprints exist with `sprint_data` but no `content_md`, verify SprintCard renders legacy Section components instead of blank |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 300s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
