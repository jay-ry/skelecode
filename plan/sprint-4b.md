# Sprint 4b — Polish, Landing Page & Production Deploy

**Duration:** Week 8
**Claude Code session concern:** Landing page + error/empty states + UI consistency + Vercel + Railway deploy
**Files touched:** ~12
**External services wired:** Vercel (frontend deploy), Railway (backend deploy) — configuration only, no new API integrations

---

## Sprint Goal

SkeleCode is deployed to production. A logged-out visitor sees a real landing page. Every page has proper error and empty states. The UI is visually consistent. A real user can sign up, plan a project, and pay — end to end — on the production URL.

---

## Claude Code Instructions

> "We are completing SkeleCode. Sprints 1–4a are done and working locally. This sprint adds the landing page, fixes all empty/error states, does a UI consistency pass, and deploys to Vercel (frontend) and Railway (backend). No new agents, no new DB tables, no new external API integrations beyond configuring deploy environment variables."

---

## File Map

```
frontend/
  app/
    page.tsx                ← replace brainstorm with landing page (logged-out)
                              (logged-in users skip this → /dashboard)
    (app)/                  ← route group for authenticated pages
      layout.tsx            ← authenticated layout (nav with UserButton)
      brainstorm/
        page.tsx            ← moved from / to /brainstorm
      sprints/
        page.tsx            ← unchanged
      skeleton/
        page.tsx            ← unchanged
      dashboard/
        page.tsx            ← unchanged
  components/
    landing/
      Hero.tsx              ← headline + CTA
      HowItWorks.tsx        ← 3-step explainer
      PricingSection.tsx    ← pricing columns (reuses pricing page content)
      FAQ.tsx               ← 5–6 common questions
    ErrorBoundary.tsx       ← catches render errors, shows retry button
    EmptyState.tsx          ← reusable empty state (icon + message + CTA)
    LoadingSkeleton.tsx     ← reusable card skeleton (pulsing gray bars)

.github/
  (no CI needed for MVP — manual deploy via CLI)

railway.toml                ← Railway backend config
vercel.json                 ← Vercel rewrite rules (/ → Next.js, /api/* → Railway)
```

---

## Frontend Tasks

### F1 — Landing page restructure
- Move brainstorm page from `/` to `/(app)/brainstorm`
- New `app/page.tsx`:
  - If user is signed in (check with `useUser()` from Clerk): redirect to `/dashboard`
  - If signed out: render the landing page
- Landing page sections (in order):
  1. Hero
  2. How it works
  3. Pricing (reuse `PricingSection`)
  4. FAQ
  5. Footer (links: Pricing, Sign in, Privacy, Terms)

### F2 — Hero section
```
Headline:   "Go from idea to sprint plan in minutes"
Subheader:  "SkeleCode interviews you, plans your sprints, and generates a UI skeleton — so you can start building immediately."
CTA:        [Plan your first project free]  →  /sign-up
Secondary:  [See how it works ↓]           →  smooth scroll to #how-it-works
```
- No hero image needed — clean text + subtle background pattern (CSS only, no images)

### F3 — How it works section
Three steps, horizontal on desktop / vertical on mobile:
1. "Brainstorm" — describe your idea or let the AI suggest one
2. "Plan sprints" — get Scrum-ready sprints with testable definitions of done
3. "Get your skeleton" — download a folder structure and UI wireframe

### F4 — FAQ section
At minimum, answer these questions:
- "Do I need to know how to code?"
- "What tech stacks does SkeleCode support?"
- "Can I edit the generated plans?"
- "What happens when I hit the free limit?"
- "Is my data private?"
- "What is the Lifetime plan?"

Use `<details>` / `<summary>` — no JS accordion needed.

### F5 — Error and empty states (all pages)

| Page | Empty state | Error state |
|---|---|---|
| Dashboard | "No projects yet — start brainstorming" + button | "Couldn't load projects — retry" button |
| Sprints | "Complete a brainstorm first" + link | "Sprint generation failed — retry" button |
| Skeleton | "Complete sprint planning first" + link | "Skeleton generation failed — retry" button |
| Brainstorm | n/a | "Something went wrong — try rephrasing" toast |

- `ErrorBoundary.tsx` wraps each page — catches React render errors
- All SSE stream failures: show a toast with a retry button (re-runs the action)
- Network errors: "Check your connection and try again"

### F6 — UI consistency pass
These are the only things to fix — do not redesign:
- Consistent `gap`, `padding`, and `rounded` values across all cards
- All buttons use the same variants: primary (filled), secondary (outlined), ghost (text only)
- All loading states use `LoadingSkeleton` — remove any ad-hoc spinners
- Font sizes: headings use `text-xl` or `text-2xl`, body uses `text-base`
- Nav height is consistent on all pages (no jumps between routes)
- Mobile: nav collapses to hamburger at `sm` breakpoint (basic, not perfect)

---

## Backend Tasks

### B1 — Production CORS
```python
# main.py — update CORS origins
allow_origins = [
    "http://localhost:3000",
    os.environ.get("FRONTEND_URL", ""),  # e.g. https://skelecode.vercel.app
]
```

### B2 — Health check + readiness
```python
@app.get("/health")
def health():
    return {"status": "ok", "env": os.environ.get("ENVIRONMENT", "development")}
```

Railway uses this for health checks — make sure it returns 200 with no DB call.

### B3 — Environment validation on startup
```python
# main.py — add at top
REQUIRED_ENV = [
    "ANTHROPIC_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_KEY",
    "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
    "CLERK_SECRET_KEY", "FRONTEND_URL"
]
missing = [k for k in REQUIRED_ENV if not os.environ.get(k)]
if missing:
    raise RuntimeError(f"Missing env vars: {missing}")
```

Fail fast on startup rather than failing silently mid-request.

---

## Deploy Tasks (manual steps — Claude Code writes the config files, human runs the commands)

### D1 — Railway (backend)

Create `railway.toml` in `/backend`:
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "on-failure"
```

Manual steps (outside Claude Code):
1. `railway login` → `railway init` → `railway up`
2. Set all env vars in Railway dashboard
3. Note the deploy URL (e.g. `https://skelecode-backend.railway.app`)

### D2 — Vercel (frontend)

Create `vercel.json` in `/frontend`:
```json
{
  "rewrites": [
    { "source": "/api/backend/:path*", "destination": "https://skelecode-backend.railway.app/:path*" }
  ]
}
```

Update all `BACKEND_URL` references in Next.js API routes to use `/api/backend` prefix in production.

Manual steps:
1. `vercel --prod` from `/frontend`
2. Set all env vars in Vercel dashboard
3. Update `FRONTEND_URL` in Railway env vars to the Vercel URL

### D3 — Stripe webhook production URL
- In Stripe dashboard: add a new webhook endpoint pointing to `https://skelecode-backend.railway.app/api/stripe/webhook`
- Copy the new webhook signing secret to Railway env vars (`STRIPE_WEBHOOK_SECRET`)
- Switch from Stripe test keys to live keys when ready to accept real payments (separate step, post-launch)

---

## Stub / Mock Strategy

- Keep Stripe in test mode for this sprint — switch to live keys after first manual QA on production
- If any env var is missing in production, the startup check in B3 will catch it before requests fail mysteriously
- Mobile nav: hamburger opens a full-screen overlay — acceptable CSS-only implementation, no animation required

---

## Definition of Done

- [ ] `https://skelecode.vercel.app` (or your domain) loads the landing page for logged-out users
- [ ] Logged-in users visiting `/` are redirected to `/dashboard`
- [ ] Landing page has all four sections: Hero, How it works, Pricing, FAQ
- [ ] "Plan your first project free" CTA goes to sign-up
- [ ] All four app pages have correct empty states
- [ ] All four app pages have retry buttons on error
- [ ] UI is visually consistent — no obvious spacing or font-size anomalies
- [ ] Backend health check: `GET https://skelecode-backend.railway.app/health` returns 200
- [ ] Full end-to-end flow works on production: sign up → brainstorm → sprints → skeleton → save
- [ ] Stripe webhook is pointed at the production backend URL
- [ ] No `.env` secrets committed to git (verify with `git log` + `.gitignore` check)

---

## Test Scenario

1. Open production URL in an incognito window — landing page appears
2. Click "Plan your first project free" — sign-up flow works
3. Complete full brainstorm → sprints → skeleton flow on production
4. Check Supabase — data is saved correctly
5. Navigate to `/dashboard` — project appears
6. Try the upgrade flow with Stripe test card — checkout works on production
7. Check webhook in Stripe dashboard — events are received at the production backend URL
8. Open the app on a mobile device — nav is usable, content is readable
9. Disconnect from wifi mid-generation — error state appears with retry button
10. Reconnect and retry — generation completes successfully

---

## Post-Launch Checklist (after this sprint)

- [ ] Post on r/SideProject and r/indiehackers with a short demo GIF
- [ ] List the Lifetime deal on Gumroad ($129)
- [ ] Submit to Product Hunt (schedule Tuesday 12:01am PST)
- [ ] Set up Plausible Analytics (privacy-friendly, free tier) on the frontend
- [ ] Write a short "how I built it" post — dev.to or your own blog
