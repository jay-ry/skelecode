# Sprint 4a — Monetization (Stripe)

**Duration:** Week 7
**Claude Code session concern:** Stripe checkout + webhook + free tier enforcement + paywall modal
**Files touched:** ~10
**External services wired:** Stripe — one only

---

## Sprint Goal

Free users are limited to 1 project. Attempting a second project shows an upgrade modal. Clicking upgrade opens a real Stripe checkout. After payment, the user's plan upgrades to Pro and the paywall disappears.

---

## Claude Code Instructions

> "We are extending SkeleCode. Sprints 1–3b are complete. This sprint adds Stripe monetization. Free users can only create 1 project. When they try to create a second, show an upgrade modal that opens Stripe Checkout. After successful payment, the user becomes Pro with unlimited projects. Add a `/pricing` page. Do not touch the LangGraph agents."

---

## File Map

```
frontend/
  app/
    pricing/
      page.tsx              ← pricing page (Free / Pro / Lifetime columns)
    api/
      stripe/
        checkout/
          route.ts          ← POST → create Stripe checkout session
        portal/
          route.ts          ← POST → create Stripe billing portal session
        webhook/
          route.ts          ← POST → handle Stripe webhook events
  components/
    UpgradeModal.tsx         ← paywall modal shown on limit hit
    PlanBadge.tsx            ← "Free" / "Pro" badge in nav/settings

backend/
  api/
    stripe.py               ← POST /api/stripe/checkout, /portal, /webhook
  db/
    queries.py              ← add: get_plan, set_plan (extends sprint 3a)
```

---

## Frontend Tasks

### F1 — Pricing page (`/pricing`)
Three-column layout:

| Free | Pro | Lifetime |
|---|---|---|
| $0 | $15/mo | $129 once |
| 1 project | Unlimited projects | Unlimited projects |
| 3 sprints max | Unlimited sprints | Unlimited sprints |
| Skeleton export | Skeleton export | Skeleton export |
| "Get started" | "Upgrade to Pro" | "Buy lifetime" |

- "Get started" → `/sign-up`
- "Upgrade to Pro" → calls `POST /api/stripe/checkout?plan=pro`, redirects to Stripe URL
- "Buy lifetime" → calls `POST /api/stripe/checkout?plan=lifetime`, redirects to Stripe URL
- Add `/pricing` link to the nav (visible to all users, signed in or not)

### F2 — UpgradeModal component
- Triggered when `POST /api/projects` returns `402 Payment Required`
- Content:
  - "You've used your free project"
  - Brief Pro feature list
  - "Upgrade to Pro — $15/mo" button → Stripe checkout
  - "Maybe later" closes the modal
- Use a CSS `dialog` element (no extra libraries needed)

### F3 — Free tier check in project creation
- In `BrainstormChat.tsx`, after `generateProjectSpec` completes:
  - Call `POST /api/projects` as before
  - If response status is `402`: open `UpgradeModal`
  - If `200`: continue as normal, store `project_id`

### F4 — PlanBadge in nav
- Fetch `GET /api/user/plan` on app load (or derive from Clerk session metadata)
- Show small badge next to user avatar: "Free" (gray) or "Pro" (purple)
- "Manage billing" link in a dropdown → calls `POST /api/stripe/portal`, redirects

### F5 — Stripe success/cancel redirect handling
- Stripe redirects to `?session_id={CHECKOUT_SESSION_ID}` after payment
- On landing, show a "Payment successful — you're now Pro!" toast
- On cancel, return to wherever the user was — no message needed
- Add `NEXT_PUBLIC_STRIPE_SUCCESS_URL` and `NEXT_PUBLIC_STRIPE_CANCEL_URL` to env

---

## Backend Tasks

### B1 — Stripe client setup
```python
# Install: pip install stripe
import stripe
import os
stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
```

### B2 — Checkout session endpoint
```python
# api/stripe.py

@router.post("/api/stripe/checkout")
async def create_checkout(req: CheckoutRequest, user_id=Depends(get_current_user)):
    price_id = (
        os.environ["STRIPE_PRO_PRICE_ID"] if req.plan == "pro"
        else os.environ["STRIPE_LIFETIME_PRICE_ID"]
    )
    session = stripe.checkout.Session.create(
        mode="subscription" if req.plan == "pro" else "payment",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{os.environ['FRONTEND_URL']}/dashboard?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{os.environ['FRONTEND_URL']}/pricing",
        metadata={"user_id": user_id},
    )
    return {"url": session.url}
```

### B3 — Billing portal endpoint
```python
@router.post("/api/stripe/portal")
async def create_portal(user_id=Depends(get_current_user)):
    sub = get_subscription(user_id)         # from db/queries.py
    session = stripe.billing_portal.Session.create(
        customer=sub["stripe_customer_id"],
        return_url=f"{os.environ['FRONTEND_URL']}/dashboard",
    )
    return {"url": session.url}
```

### B4 — Webhook handler
```python
@router.post("/api/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    try:
        event = stripe.Webhook.construct_event(
            payload, sig, os.environ["STRIPE_WEBHOOK_SECRET"]
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session["metadata"]["user_id"]
        plan = "lifetime" if session["mode"] == "payment" else "pro"
        set_plan(user_id, plan, session.get("customer"), session.get("subscription"))

    elif event["type"] == "customer.subscription.deleted":
        customer_id = event["data"]["object"]["customer"]
        downgrade_by_customer(customer_id)   # set plan = 'free'

    return {"ok": True}
```

### B5 — Free tier enforcement
```python
# In api/projects.py — modify create_project
@router.post("/api/projects")
async def create_project(req: CreateProjectRequest, user_id=Depends(get_current_user)):
    plan = get_plan(user_id)                # 'free' | 'pro' | 'lifetime'
    if plan == "free":
        count = count_projects(user_id)
        if count >= 1:
            raise HTTPException(
                status_code=402,
                detail={"message": "Free tier limit reached", "upgrade_url": "/pricing"}
            )
    project_id = save_project(user_id, req.name, req.project_md)
    return {"project_id": project_id}
```

### B6 — DB additions (extends sprint 3a)
```python
# db/queries.py additions

def get_plan(user_id: str) -> str:
    result = supabase.table("user_subscriptions").select("plan").eq("user_id", user_id).execute()
    return result.data[0]["plan"] if result.data else "free"

def set_plan(user_id: str, plan: str, customer_id: str, subscription_id: str) -> None:
    supabase.table("user_subscriptions").upsert({
        "user_id": user_id, "plan": plan,
        "stripe_customer_id": customer_id,
        "stripe_subscription_id": subscription_id,
        "updated_at": "now()"
    }).execute()

def downgrade_by_customer(customer_id: str) -> None:
    supabase.table("user_subscriptions").update({"plan": "free"}).eq(
        "stripe_customer_id", customer_id
    ).execute()

def count_projects(user_id: str) -> int:
    result = supabase.table("projects").select("id", count="exact").eq("user_id", user_id).execute()
    return result.count
```

---

## DB Tasks

### D1 — user_subscriptions table (run in Supabase SQL editor)
```sql
create table user_subscriptions (
  user_id text primary key,
  plan text not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  valid_until timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table user_subscriptions enable row level security;
create policy "Users see own subscription" on user_subscriptions
  for select using (user_id = auth.uid()::text);
```

---

## Environment Variables

```bash
# backend/.env additions
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_LIFETIME_PRICE_ID=price_...
FRONTEND_URL=http://localhost:3000

# frontend/.env.local additions
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_LIFETIME_PRICE_ID=price_...
```

---

## Stripe Test Setup (manual — outside Claude Code)

1. Create a Stripe account (test mode)
2. Create two products: "SkeleCode Pro" (recurring $15/mo) and "SkeleCode Lifetime" (one-time $129)
3. Copy price IDs to `.env`
4. Run Stripe CLI to forward webhooks: `stripe listen --forward-to localhost:8000/api/stripe/webhook`
5. Copy the webhook secret from CLI output to `STRIPE_WEBHOOK_SECRET`
6. Test card: `4242 4242 4242 4242`, any future expiry, any CVC

---

## Stub / Mock Strategy

- If Stripe env vars are missing, skip the `402` check and treat all users as Pro (log a warning)
- The upgrade modal can be tested without Stripe by temporarily forcing a `402` in the create endpoint
- Lifetime plan: same as Pro in the DB — no different feature set in MVP

---

## Definition of Done

- [ ] `/pricing` page renders all three tiers with correct prices and feature lists
- [ ] Free user creates 1 project — succeeds
- [ ] Free user tries to create a 2nd project — `UpgradeModal` appears
- [ ] Clicking "Upgrade to Pro" in the modal redirects to Stripe Checkout (test mode)
- [ ] Completing test checkout (card `4242 4242 4242 4242`) redirects back with success toast
- [ ] User's plan in `user_subscriptions` table is now `pro`
- [ ] Pro user creates a 2nd project — no paywall, succeeds
- [ ] "Manage billing" in the nav opens the Stripe Customer Portal
- [ ] Cancelling subscription via portal triggers webhook → plan reverts to `free`
- [ ] `PlanBadge` shows "Free" or "Pro" correctly in the nav

---

## Test Scenario

1. Sign in as a free user
2. Create 1 project — succeeds
3. Try to create a 2nd — upgrade modal appears
4. Click "Upgrade to Pro", complete Stripe test checkout
5. Redirected back — "Payment successful" toast
6. Create 2nd project — no paywall
7. Check Supabase `user_subscriptions` table — plan = `pro`
8. Click "Manage billing" — Stripe portal opens
9. Cancel subscription in portal — wait for Stripe CLI webhook forwarding
10. Check DB — plan reverted to `free`
11. Try to create 3rd project — paywall appears again
