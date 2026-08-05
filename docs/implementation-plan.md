# The Daily Win — Implementation Plan

*July 2026 · Ben (founder) + Claude (design, development, daily content drafting)*

## 1. Decisions locked

- **Concept:** daily 5-minute real-life missions with AI; the challenge game instead of quizzes; streaks and logged wins. Distinctiveness ("the lesson is the application") is protected — no pivots.
- **Personas (5):** Small-business owner, Parent, Job-seeker, Retiree, **Office worker** (new). Teacher is next in line, added when demand shows. Beyond that, persona additions are data decisions, not brainstorms.
- **In-page AI:** live generation on our site for everyone at launch, as a free trial capped at ~10 generations/day per visitor (abuse and cost protection). Later, when traffic is established, unlimited generation becomes a member perk; the free cap stays. The cap makes that switch feel natural, not punitive.
- **Email:** daily mission email from day one. Email drives the habit; the site delivers the experience.
- **Payments:** none at launch. "Founding Member waitlist" validates demand first; Stripe comes only after the waitlist proves it.
- **Rewards reframe:** the certificate becomes one of several persona-fitted proofs (shareable portfolio link for job-seekers, window badge for shop owners, milestone celebrations for retirees).

## 2. Phase 1 — Prototype v2 (done, delivered with this plan)

Changes folded in from the three reviews: onboarding persona picker on first visit; 5th persona; **day switcher with three complete missions in different life domains** (Money / Words / Time — proving mission variety, not just persona variety); simulated in-page generation with a "refine" step; one-line reflection when logging a win; challenge expanded to 4 rounds with rising difficulty, ✓/✗ symbols (not color alone), and a real copyable share card; persona-fitted membership rewards and a Founding Member waitlist CTA; "Showing examples for" indicator; domain removed from the header; footer cleaned.

**Your action:** click through v2, confirm it's the blueprint to build.

## 3. Phase 2 — The real build

**Stack:** Next.js hosted on Vercel (free tier) · Supabase (auth, database, cron — free tier) · Resend for email (free tier: 3,000/month) · one LLM API (Anthropic or OpenAI) for in-page generation · lightweight analytics (Plausible or a simple events table in Supabase).

**Core features, in build order:**

1. Site shell + design system from v2; missions stored in a database, not hardcoded.
2. Accounts (email magic-link — no passwords, right for this audience), persona saved to profile, streaks and win log with reflections.
3. Challenge engine: rounds stored per day, score tracking, share card.
4. In-page generation service: serverless endpoint calling the LLM with the mission's prompt template + user's bracket answers. Guardrails: per-visitor daily cap, rate limiting, monthly budget alarm, and a hard spend limit set on the API account itself.
5. Daily email: morning send (per user's timezone at ~7am) with the mission + one-tap link to the challenge. Scheduled via Supabase cron.
6. Analytics events: visit, mission viewed, generation used, win logged, challenge completed, signup, email open.
7. Founding Member waitlist (a button and a table — one hour of work, high information value).

## 4. Phase 3 — Content

- **Launch stock:** 7 complete missions (each × 5 personas + its 4-round challenge) before anyone sees the site. Drafted by me, approved by you.
- **Daily rhythm thereafter:** each morning I draft the next mission + challenge; you review, tweak, approve (~15 min). We keep a 7-day buffer at all times so a busy day never breaks the streak promise.
- **Mission domains rotate** so no two consecutive days feel alike: Words, Money, Time, Work, Home, Health-admin, Fun.

## 5. Phase 4 — Launch

1. **Quiet beta (10–20 real people** from the target audience — not tech friends). Watch them use it; fix confusion.
2. **Founding Members open:** first 100 waitlist joiners get "Founding Member #N" status, locked $5/mo price for life when payments start.
3. **Public push,** led by the challenge (the shareable piece), not the homepage.

## 6. Timeline (approximate)

- **Week 1:** v2 sign-off · final name + domain purchase · accounts created · missions 1–7 drafted.
- **Week 2:** core build (site, accounts, missions, challenge, streaks).
- **Week 3:** in-page AI + daily email + analytics · quiet beta begins.
- **Week 4:** fixes from beta · waitlist live · public launch.

## 7. What I need from you

1. Confirm the name ("The Daily Win" or alternative) → check domain availability → buy (~$12/yr).
2. Create free accounts (I'll walk you through each, ~30 min total): Vercel, Supabase, Resend, and an LLM API key **with a hard monthly spend limit set** (start: $20).
3. List 10–20 real people for the quiet beta.
4. Daily: ~15 minutes to approve the day's mission.

## 8. Costs

Domain ~$12/yr. Hosting, database, email, analytics: $0 at launch scale. In-page AI: using an efficient model, roughly $0.001–0.003 per generation — even 1,000 generations/day is single-digit dollars, and the cap + hard API limit bound the worst case. Total realistic burn until revenue: **under $25/month.**

## 9. Success metrics (checked weekly, no dashboards needed yet)

- **Next-day return rate** — the single number that decides everything.
- Mission completion rate (wins logged ÷ missions viewed) and challenge completion rate.
- Email open rate; signups; waitlist joins.
- Generations per visitor (tells us if in-page AI is the hook we think it is).

Target for beta: at least half of beta users come back unprompted on day 2, and at least one says something like "this already saved me time/money." If we get that, we push public. If not, we fix before scaling — the concept earns its marketing.
