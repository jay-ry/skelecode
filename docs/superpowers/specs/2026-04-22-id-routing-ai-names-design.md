# Design: ID-based Routing + AI Project Names

**Date:** 2026-04-22
**Status:** Approved

## Problem

Two related issues:
1. Every project is saved with the name "Vision" (the brainstorm AI always opens the spec with `# Vision`).
2. Routes are stateful — `/sprints` and `/skeleton` depend on React Context that's lost on reload or direct navigation. Projects have no shareable URL.

## Solution

Move project identity into the URL. Use AI to generate real project names. Remove React Context in favour of per-page DB fetches.

---

## Routes

| Path | Page | Data source |
|------|------|-------------|
| `/` | Dashboard — project list | `GET /api/projects` |
| `/chat` | New brainstorm (no project yet) | — |
| `/chat/[id]` | Brainstorm for existing project | component state (streamed) |
| `/sprints/[id]` | Sprint planner | `GET /api/projects/[id]` on mount |
| `/skeleton/[id]` | Skeleton generator | `GET /api/projects/[id]` on mount |

`/dashboard` is removed; a redirect to `/` is added so any saved links still work.

---

## First-Message Project Creation (ChatGPT pattern)

1. User lands on `/chat` and types their first message.
2. **Before the message is sent to the AI**: fire `POST /api/projects` with `name: "Untitled Project"` and `project_md: ""`.
3. Receive `project_id` from the response.
4. Call `router.replace("/chat/" + project_id)` — URL changes, component stays mounted, `projectId` is now in state.
5. The conversation proceeds as normal. The project row exists from the very first message.

Only the first message triggers this. Subsequent messages check `projectId !== null` and skip creation.

---

## AI Project Naming

### Backend: `POST /api/name`

New FastAPI route in `backend/api/name.py`, registered in `backend/main.py`.

- Input: `{ "project_md": string }`
- Single synchronous Groq call (not streaming) with this prompt:
  > You are a project namer. Read the project spec and output ONLY a 2-5 word project name. No quotes, no punctuation, no explanation.
- Output: `{ "name": string }`
- Fallback: if Groq call fails or returns empty, extract the first `# Heading` from `project_md`. If that is "Vision" or absent, fall back to `"Untitled Project"`.

### Frontend: `PATCH /api/projects/[id]`

New Next.js API route at `frontend/app/api/projects/[id]/route.ts` (added alongside the existing `GET`).

- Input: `{ "name": string }`
- Auth + ownership check (same pattern as all other project routes).
- Runs `UPDATE projects SET name = $1 WHERE id = $2 AND user_id = $3`.

### Trigger point

In `BrainstormChat`, after `generateProjectSpec` fires and `finalProjectMd` is complete (same place the `POST /api/projects` currently fires):

1. Call `POST /api/name` with `{ project_md: finalProjectMd }`.
2. Call `PATCH /api/projects/[id]` with `{ name }`.
3. Update local display state so the header shows the new name without a reload.

---

## State Management

`ProjectContext` is removed entirely.

| Page | What it needs | How it gets it |
|------|--------------|----------------|
| `/chat/[id]` | `project_md` (live, streaming) | Local component state built up during the chat session |
| `/sprints/[id]` | `project_md` | `GET /api/projects/[id]` on mount |
| `/skeleton/[id]` | `project_md`, `sprints` | `GET /api/projects/[id]` on mount (response includes sprints) |

`/sprints/[id]` and `/skeleton/[id]` show a loading state while fetching, then an error state if the project is not found or not owned.

---

## Header Navigation

The Header component receives the project ID as a prop when inside a project page. Navigation links are constructed with the ID:

| Page | Back | Forward |
|------|------|---------|
| `/chat/[id]` | `/` (Dashboard) | `/sprints/[id]` |
| `/sprints/[id]` | `/chat/[id]` | `/skeleton/[id]` |
| `/skeleton/[id]` | `/sprints/[id]` | — |

Logo always links to `/`.

The existing "Dashboard" button in the Header links to `/`.

---

## File Changes Summary

**New files:**
- `frontend/app/page.tsx` — replaces current brainstorm page with dashboard content
- `frontend/app/chat/page.tsx` — new project brainstorm entry point
- `frontend/app/chat/[id]/page.tsx` — brainstorm for existing project
- `frontend/app/sprints/[id]/page.tsx` — sprint planner reading from DB
- `frontend/app/skeleton/[id]/page.tsx` — skeleton generator reading from DB
- `backend/api/name.py` — AI name generation endpoint

**Modified files:**
- `frontend/app/api/projects/[id]/route.ts` — add `PATCH` handler
- `frontend/components/BrainstormChat.tsx` — first-message creation + AI naming trigger
- `frontend/components/Header.tsx` — accept `projectId` prop, build dynamic hrefs
- `backend/main.py` — register name router
- `frontend/app/layout.tsx` — remove `ProjectContextProvider`

**Deleted files:**
- `frontend/app/dashboard/page.tsx` — content moved to `/`
- `frontend/app/sprints/page.tsx` — replaced by `/sprints/[id]`
- `frontend/app/skeleton/page.tsx` — replaced by `/skeleton/[id]`
- `frontend/context/ProjectContext.tsx` — no longer needed

**Redirect:**
- `frontend/app/dashboard/page.tsx` becomes a `redirect("/")` (or is deleted and middleware handles it)

---

## Out of Scope

- Chat history persistence (brainstorm messages are not saved to DB — the conversation restarts if the user navigates away from `/chat/[id]` and returns)
- Project rename UI (name is set by AI; no manual rename field in this spec)
- Project deletion
