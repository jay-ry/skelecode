---
phase: 3
slug: auth-database
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (no jest/vitest detected in frontend/) |
| **Config file** | `frontend/tsconfig.json` (existing) |
| **Quick run command** | `cd frontend && npm run build` |
| **Full suite command** | `cd frontend && npm run build && npx tsc --noEmit` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npm run build`
- **After every plan wave:** Run `cd frontend && npm run build && npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full build must be green + manual test scenario passes
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-W0-01 | setup | 0 | pre-existing bug fix | — | Link import present in sprints/page.tsx | compile | `cd frontend && npm run build` | ✅ existing | ⬜ pending |
| 03-W0-02 | setup | 0 | ProjectContext type | — | projectId field exists in context type | compile | `cd frontend && npm run build` | ❌ W0 | ⬜ pending |
| 03-01-01 | deps | 1 | install packages | — | N/A | compile | `cd frontend && npm run build` | ❌ W0 | ⬜ pending |
| 03-01-02 | schema | 1 | DB schema defined | — | schema.ts exists with projects + sprints tables | compile | `cd frontend && npm run build` | ❌ W0 | ⬜ pending |
| 03-01-03 | db client | 1 | Drizzle client singleton | — | DATABASE_URL not exposed to client (no NEXT_PUBLIC_) | compile | `cd frontend && npm run build` | ❌ W0 | ⬜ pending |
| 03-02-01 | middleware | 2 | route protection | T-03-01 | unauthenticated redirect | manual | visit /dashboard while signed out | ❌ W0 | ⬜ pending |
| 03-02-02 | auth | 2 | await auth() in routes | T-03-02 | userId not undefined | compile | `cd frontend && npm run build` | ❌ W0 | ⬜ pending |
| 03-02-03 | await params | 2 | dynamic route params | — | params typed as Promise | compile | `cd frontend && npm run build` | ❌ W0 | ⬜ pending |
| 03-03-01 | ownership | 3 | project ownership check | T-03-03 | AND user_id check before write | compile + manual | `cd frontend && npm run build` | ❌ W0 | ⬜ pending |
| 03-04-01 | auto-save | 4 | save after brainstorm | — | "Saved ✓" appears | manual | generate project spec → check toast | ❌ W0 | ⬜ pending |
| 03-04-02 | auto-save | 4 | save after sprints | — | "Saved ✓" appears | manual | generate sprints → check toast | ❌ W0 | ⬜ pending |
| 03-05-01 | dashboard | 5 | list projects | — | saved project appears after refresh | manual | generate → navigate to /dashboard → refresh | ❌ W0 | ⬜ pending |
| 03-05-02 | open project | 5 | load sprints into context | — | sprint cards load on /sprints?project={id} | manual | click Open → verify sprint cards | ❌ W0 | ⬜ pending |
| 03-05-03 | user isolation | 5 | RLS equivalent | T-03-04 | different user sees empty dashboard | manual | two-user test (two browsers) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Fix pre-existing bug: add `import Link from 'next/link'` to `frontend/app/sprints/page.tsx`
- [ ] Extend `ProjectContextValue` in `frontend/context/ProjectContext.tsx` with `projectId: string | null` and `setProjectId: (id: string | null) => void`
- [ ] Install packages: `cd frontend && npm install @clerk/nextjs drizzle-orm drizzle-kit @neondatabase/serverless`
- [ ] Create `.env.local` template with all required env vars documented (Clerk keys + DATABASE_URL)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Unauthenticated redirect from /dashboard | AUTH-01 | Requires browser session state | Visit http://localhost:3000/dashboard while signed out → verify redirect to /sign-in |
| Sign up + verify email + sign in | AUTH-02 | Clerk UI flow + email inbox | Sign up as new user → verify email → sign in → confirm land on /dashboard |
| UserButton visible when signed in | AUTH-03 | Visual check | Sign in → confirm avatar appears in nav top-right |
| project.md auto-save | SAVE-01 | Requires full brainstorm flow | Complete brainstorm → "Saved ✓" toast must appear |
| Sprints auto-save | SAVE-02 | Requires sprint generation | Generate sprints → "Saved ✓" toast must appear |
| Dashboard persistence after refresh | DB-01 | Browser state + DB | Save project → refresh → project still in list |
| Open project loads sprints | DB-02 | End-to-end flow | Click Open on saved project → verify all sprint cards load |
| User isolation | DB-03 | Multi-session test | Sign in as user-B → verify user-A's projects are not visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
