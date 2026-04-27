# Project Instructions

## After Each Phase Execution

At the end of every phase, always include a **"What You Can Test Now"** section summarizing:
- What is runnable/testable at this point (commands to start services, URLs to visit, flows to try)
- Prerequisites needed (env vars, API keys, dependencies)
- Known limitations or items blocked until a later phase

Example format:
```
## What You Can Test Now

**Prerequisites:** Set ANTHROPIC_API_KEY in frontend/.env.local and backend/.env

| What | How | Expected |
|------|-----|----------|
| Backend health | `cd backend && venv/bin/uvicorn main:app --reload` → GET /health | `{"status": "ok"}` |
| Frontend dev server | `cd frontend && npm run dev` → http://localhost:3000 | Two-column layout loads |
| Full brainstorm flow | Open browser, type an idea in chat | Bot interviews, right panel streams project.md |

**Not yet testable:** Auth (Phase 3), payment flows (Phase 5)
```
