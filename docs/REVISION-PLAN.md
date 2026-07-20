# HustleBricks Revision Plan — Reconciling Design v1, the Current Build, and the Founder Vision

> **⚠ REV 3 SUPERSEDES THE CODE INVENTORY BELOW.** Sections 1B, 2, and the phase framing were written against a stale snapshot (`_codeHB`). The co-developer's real repo (github.com/wgt567654/Hustle-Bricks, last commit 2026-07-12) is months ahead. See §8 for the corrected state and the revised sprint. Product decisions (§5) all still stand.

*Prepared 2026-07-19. Inputs: `design/v1_screenshots` review, deep codebase review, founder direction (evolve codebase; hosted brandable booking with white-label tier, embed-ready; flexible payments defaulting to track-only; all four pillars in scope; training extends to sales roles).*

**Spirit of this revision:** this is a build-out, not a teardown. The existing app is a competent, working foundation — the revision keeps the owner experience intact, extends the system to full functionality, and adopts the co-developer's public roadmap (hustlebricks.com) wherever it converges with the founder vision, which is most places (see §7).

*Rev 2 (same day): founder dropped the blended owner/worker account model. Owner accounts and worker accounts are separate; workers can join multiple teams; each business auto-creates a schedulable member profile for its owner (so solo operators are bookable without a second account). An owner who wants to work for someone else's business signs up separately as a worker. This de-risks Phase 1 substantially — owner-side pages and RLS stay untouched; the worker layer is additive.*

---

## 1. The Three Visions on the Table

**A. The design screenshots (v1 vision).** A multi-role *network*: one person can own businesses, work for others, or both — memberships in many teams, invitations with required capabilities, a blended home feed of jobs you're WORKING (earnings) vs MANAGING (revenue). Workers join with a Gmail account *specifically for calendar sync*; availability comes from Google Calendar or .ics upload and "automatically calculates open slots per service." Each member has per-service capabilities with their own pay structure ($/hr or %/job) and a training-readiness percentage; training is NotebookLM-powered per service (audio/video/flashcards/quiz) with proof-of-completion uploads and "Certified via AI" badges. Quotes are attributed to a person, request crew roles, move through Unsent→Unsigned→Unpaid→Paid, and deliver by email or text. AI tips appear throughout.

**B. The current codebase.** A competent **single-owner field-service tool** (Jobber-style): polished CRM (clients, leads→clients), service catalog, quote→job conversion, job lifecycle with photos/recurrence/clock-in-out, drag-drop calendar, per-client no-login portals with realtime chat and booking requests, manual payments (cash/venmo/check "Mark Paid"). The co-developer's spec (`Untitled document.md`) confirms intent: "Notion + Stripe + Uber dispatch" FSM for a solo operator. Multi-role exists only as *inert scaffolding*: team_members with roles/certifications, worker_availability, job_crew, commission_rate — captured in UI, consumed by nothing. Every RLS policy and ~15 pages assume `owner_id = auth.uid()`.

**C. The founder vision (this week).** An **operating system for micro-entrepreneurs**: side-hustlers running virtual teams of other side-hustlers. HustleBricks does the management: knows who's qualified and available (via Google Calendar), populates a salon-style public booking page per business, books and notifies workers with minimal owner involvement, supports door-to-door sales roles with owner-configured quote forms and commissions, and trains/qualifies both workers and salespeople.

**Reconciliation verdict:** A and C are the *same product* — the screenshots are a faithful UI of the founder vision (plus specifics worth adopting: NotebookLM training, per-capability pay structures, multi-team membership, WORKING/MANAGING blend). B is a strong single-player foundation for that product: ~60% of the entities carry forward, but the *access model* and four subsystems are new.

---

## 2. Discrepancy Register (design/vision vs. code)

| # | Discrepancy | Design/Vision | Code today | Severity |
|---|---|---|---|---|
| D1 | **Identity & tenancy** | One account, many teams, roles per team; owner+worker blend *(rev 2: blend dropped — separate owner and worker accounts; workers still multi-team)* | Owner-only RLS + owner-only queries everywhere; worker login exists but sees nothing | **Foundational** |
| D2 | **Worker availability** | Google Calendar / .ics per member drives open slots | ICS *export* only; worker_availability captured, never consumed | **Foundational** |
| D3 | **Booking surface** | Public, brandable, per-business, service-first, availability-driven; future seamless embed | Per-existing-client link; time slots from business hours only; no service selection | **Foundational** |
| D4 | **Autonomy** | System auto-books & notifies workers; owner mostly out of loop | Zero notification infra (no email/SMS/push); owner manually confirms every request and assigns nobody | **Foundational** |
| D5 | **Qualification & training** | Per-service capabilities gates; NotebookLM modules; proof-of-completion; AI certification; readiness %; applies to sales too | certifications = free-text tags, never read | Major |
| D6 | **Sales roles & commissions** | Salesperson quotes in the field, attribution, commission on booked jobs, owner-configured quote forms | `/sales` is an owner quote board; commission_rate stored, never computed | Major |
| D7 | **Worker pay** | Per-capability pay structure ($/hr or %/job); payout tracking | Payments = customer→business only; no worker-earnings ledger | Major |
| D8 | **Quote depth** | Tax codes, coupons, discountable flags, crew-role requests, email/text delivery, W-9, Unsent→Unsigned→Unpaid→Paid | Simpler builder, hardcoded 8% tax, flat discount, status flips without real delivery | Moderate |
| D9 | **AI presence** | AI tips/critiques throughout; AI-verified training | None | Moderate |
| D10 | **Brand/personality** | Brick-themed section identities, "Stack Your Side Hustle," playful | Generic-clean current UI | Cosmetic |

**Code-only landmines to fix regardless:** middleware never runs (file is `src/proxy.ts`; Next.js requires `middleware.ts`) — auth holds only via per-page checks; schema drift (`businesses.comm_settings` used in code, absent from schema.sql); no migrations discipline; public surfaces (invoice/portal/team-portal) RLS-blocked; Stripe recording bugs (missing business_id, anon client in webhook).

**Feasibility flags (external constraints):**
- **NotebookLM has no public API.** Realistic v1: owner pastes a NotebookLM share link per service; worker completes it; uploads proof (quiz screenshot/notes); *our own* AI (Claude API) grades the proof and grants certification. Matches the mockups' "proof of completion" flow exactly.
- **Google Calendar OAuth with calendar scopes requires Google app verification** (weeks of lead time). Start the OAuth consent process early; .ics upload (already in the design!) is the interim path.
- **Venmo has no send-money API.** Payout options: record-only "Mark Paid" (default), PayPal Payouts rails (can deliver to Venmo, needs PayPal business acct) as a later investigation.

---

## 3. Target Architecture Shifts

1. **Membership model (rev 2 — split accounts).** Owners keep the existing `businesses.owner_id` model and owner-only RLS — untouched. Workers are separate accounts linked via `team_members.user_id` memberships (role member/sales, status invited/active), joinable across multiple businesses, with *additive* worker-scoped RLS (their assignments, schedule, capabilities, earnings). Each business auto-creates a schedulable member profile for its owner (owner manages "My availability & services" inside the owner app). Worker app = own surface with team switcher (per design's multi-team screen). Blended WORKING/MANAGING feed dropped; re-blending stays possible later without schema changes.
2. **Availability engine.** Per-member sources: weekly hours (exists) + Google Calendar free/busy + .ics upload + blocked dates. One internal function: `openSlots(business, service, dateRange)` = ∪ over qualified members of (working hours − busy − booked jobs). Serves booking page, calendar, and auto-assignment.
3. **Public booking.** `/book/[slug]` (business slug + branding fields on businesses; white-label flag as the paid tier). Service-first flow → real slots → anonymous customer capture (creates client) → booked job auto-assigned to a qualified available member (owner-confirm mode as fallback toggle). Built as a self-contained, themable module from day one so it can later ship as an embed/widget.
4. **Notification layer.** Event-driven (job booked, assigned, reminder, completed, review request) → channel adapters (email first via Resend; SMS second via Telnyx/Twilio — A2P registration lead time). The existing Settings comm-template UI becomes real.
5. **Qualification & training.** `service_capabilities` (member × service: pay structure, readiness %, certified flag) + `training_modules` (per service: NotebookLM link, required features, instructions) + `training_completions` (proof upload, AI grade). Certification gates assignment and booking-slot participation. Applies to `sales` role via sales-training modules.
6. **Sales & commissions.** Quote attribution (`quotes.created_by_member_id`), owner-configurable quote forms (per-service custom questions), commission ledger (rate from business default or per-member override; accrues when quoted job completes/paid), payout tracking (worker + sales in one earnings ledger; "Mark Paid" memo per payout).
7. **Money.** Keep track-only default (cash/venmo/check) — already matches the code's strength. Optional Stripe invoice per job. Worker/sales payouts: ledger + manual mark-paid.

---

## 4. Phased Plan (evolve, don't rebuild)

**Phase 0 — Foundation hardening (short).** Rename proxy→`middleware.ts`; adopt Supabase CLI migrations and reconcile schema drift; password reset flow; remove Apple button; service-role client for public surfaces (fixes invoice/portal/team-portal today); fix Stripe recording bugs; seed brand touches (logo, brick section headers) opportunistically.

**Phase 1 — Worker accounts & memberships (rev 2: additive, de-risked).** Worker signup + invitation flow (email invite with required capabilities, per design); `team_members.user_id` memberships across multiple businesses; *additive* worker-scoped RLS (owner policies untouched); worker app shell (my teams / my jobs / my schedule / my earnings) with team switcher; owner's auto-created member profile ("My availability & services"). *Unlocks everything else; no longer requires touching working owner pages.*

**Phase 2 — Capabilities & availability.** service_capabilities with pay structures; capability editor (per design's team screens); .ics upload + weekly hours consumed by a real `openSlots()`; Google OAuth + Calendar free/busy sync (start Google verification at phase start); calendar page shows true team availability.

**Phase 3 — Public booking engine.** `/book/[slug]` brandable page (HustleBricks-branded free tier; white-label flag for paid); service-first booking with real slots; anonymous client creation; auto-assign qualified+available member with owner-confirm fallback; embed-ready component boundaries.

**Phase 4 — Notifications & autonomy.** Resend email adapter + event bus; job lifecycle notifications to customers and workers; worker accept/decline; comm-templates backend; SMS channel once A2P clears.

**Phase 5 — Sales & commissions.** Sales workspace; quote attribution; quote-form builder; commission ledger + earnings integration; email/text quote delivery; quote pipeline states per design.

**Phase 6 — Training & AI certification.** Training modules per service (NotebookLM links + feature checklist); proof-of-completion uploads; Claude-graded certification; readiness gates; sales-role training; Team Hub strength metrics; "Certified via AI" badges.

**Phase 7 — Polish & monetization.** Branding tiers billing; AI tips surfaces; reports across roles; embed widget productization.

**Sequencing rationale:** 1→2→3 is a strict dependency chain (booking needs availability needs membership). 4 could swap ahead of 3's auto-assign portion; grill-me session should pressure-test that and Phase 1 scope.

---

## 5. Decisions from the Grill Session (2026-07-19)

| Topic | Decision |
|---|---|
| Pilot | **CFoam Detailing** (founder's son's business) — immediate real use. Vehicle detailing + window washing; one sales-focused person (also works windows); rotating friend-workers. |
| Sprint 1 centerpiece | **Crew wrangling**: know who's free, assign, notify, confirm. |
| Notifications | Email (Resend) + **calendar-invite emails** (event lands on worker's Google Calendar natively; Accept/Decline = confirm/decline signal). **SMS is required** for this audience → start HustleBricks A2P registration immediately; SMS reminders + owner pings activate on approval. |
| Google integration | **No Google API for now.** Availability lives **in HustleBricks** (weekly hours + away dates per member) — kids' schedules are predictable blocks. Optional calendar-link enrichment later; full OAuth maybe never. |
| Assignment model | System **smart-proposes** qualified + free crew; **owner confirms everything**. Client-facing bookings are labeled **tentative until confirmed** (UI language, not code). Auto-assign shelved. |
| Pay | Varies wildly by design → **owner-configurable pay rules**: per member per service, type = $/hr, %-of-job, or flat-per-job; plus per-job override/split editor. Sales = % commission on jobs they book. Schema in sprint 1; payout UI sprint 2. |
| Hosting | Deploy to **Vercel → hustlebricks.ai** now (hustlebricks.com may hold the co-dev's push; don't touch). CFoam starts on the owner app immediately. |
| Co-developer | Paused; founder + Claude drive. Revision plan doc available for their review. |

## 6. Sprint 1 Backlog (grilled)

**Ship-now track (this week):** deploy current owner app to Vercel at hustlebricks.ai; CFoam onboards (business, services, clients). Includes Phase-0 hardening: `middleware.ts` fix, service-role client for public pages (fixes invoice/portal/team-portal), password reset, remove Apple button, Supabase CLI migrations baseline. **Founder task: start Telnyx/Twilio A2P registration for HustleBricks SMS.**

**Worker platform track:**
1. Worker account type + signup (separate from owner accounts).
2. Email invitations w/ required capabilities; membership claim; multi-team support + team switcher.
3. Worker app shell: my teams / my jobs / my schedule — including clock in/out and before/after photos on assigned jobs (delivers the site's "Employee Portal" promise).
4. Per-member **service capabilities** + pay config (type/rate per service).
5. Per-member availability: weekly hours grid + away dates (in-HB only).
6. **Smart-propose**: on job create / booking confirm, rank members by qualified ∩ free; owner taps to confirm crew.
7. Assignment notifications: email + calendar invite w/ job address & details; Accept/Decline round-trips to job status; decline alerts owner (email now, SMS later).
8. "Tentative until confirmed" language on portal booking.

**Deferred to sprint 2+:** SMS activation (on A2P approval), payout/earnings ledger UI, public `/book/[slug]` page, quote attribution + commission ledger, training modules, calendar-link enrichment, branding tiers/billing.

---

## 7. hustlebricks.com Reconciliation (co-developer's public promises)

Reviewed 2026-07-19: homepage features, pricing, FAQ. The live marketing site promises several things beyond the codebase — and most converge with the founder vision. Adopt, don't discard:

| Site promise | Status in code | Integration into this plan |
|---|---|---|
| **Employee Portal** — crew views assigned jobs, clocks in/out, takes before/after photos, collects payment "from a mobile browser" (Team tier, FAQ) | Claim-link stub only | This IS Sprint 1's worker app. Added to sprint 1 scope: clock in/out + job photos in the worker view. "Collect payment" (worker marks cash/venmo received on-site) → sprint 2 with payout ledger. |
| **Canvassing module** — live territory map, color-coded door pins (interested/no answer/follow-up), knock counts per rep, leaderboard, convert-to-job (Business tier) | Not built (map page plots jobs/clients only) | This is the co-developer's fleshed-out version of the founder's door-to-door sales pillar. **Phase 5 adopts it by name**: canvassing map + knock tracking + leaderboard alongside quote attribution & commissions. |
| **Google Calendar sync** ("for every team member", Solo tier) | Not built (ICS export only) | Sprint 1's calendar-invite emails partially deliver the promise; full sync stays Phase 2 enrichment (calendar-link, then OAuth if warranted). Marketing copy should stay honest in the interim. |
| **Job assignment & notifications** (Team tier) | Not built | Sprint 1 core. |
| **Stripe invoices, email/SMS links, cash & check logging, tip collection** | Stripe coded/unconfigured; cash-check logging works | Tip collection added to payments backlog (Phase with payouts). SMS invoice links after A2P. |
| **Customize Studio** — themes, custom statuses/fields, editable automation texts, dashboard widgets, AI personality | comm-template config UI only | Long-term differentiator; keep the comm-template UI on the roadmap (Phase 4 backend). Full studio deferred past Phase 7 unless pilot demands it. |
| **Pricing: Solo $49 / Team $119 / Business $249, 7-day trial** | No billing | Phase 7 monetization adopts this published tier structure (worker platform = Team, canvassing = Business) and folds the white-label booking-page idea into it, rather than inventing a parallel scheme. |
| Positioning: "home service businesses… your operating system" | — | Matches the founder's "OS for micro-entrepreneurs" — same product, the site skews slightly more established-business; the micro-hustle framing is a marketing evolution, not a product conflict. |

---

## 8. Rev 3 (2026-07-19) — Reconciliation Against the Real Repo

Reviewed github.com/wgt567654/Hustle-Bricks @ `23c4300` (2026-07-12). The co-developer built far more than the stale snapshot showed. Stack additions: Resend email (live), Twilio SMS (queue + inbox + webhooks, credential-gated), Stripe Connect + platform subscription billing with trial-pause, Google Calendar OAuth (outbound sync), Anthropic AI assistant, canvassing maps, Customize Studio, 6 Vercel cron automations, 24 Playwright e2e specs, password reset. Auth confirm-email flow handled properly (check-email page). Middleware correctly named for Next 16.

### Sprint-1 gap table (grilled list vs. real repo)

| Capability | Status | Note |
|---|---|---|
| Worker accounts + approval | BUILT- | Shared business join code (not per-invite emails); owner approves pending workers |
| Multi-team membership | **PARTIAL — UI broken** | Schema supports it; employee app `.single()` crashes on >1 membership; no switcher |
| Worker app (jobs/clock/photos) | BUILT | `/employee/*` with scoped RLS |
| Per-member per-service pay ($/hr, %, flat) | **MISSING** | Only flat hourly_rate + commission_rate override |
| Per-job pay override / splits | **MISSING** | |
| In-app availability (hours + away) | BUILT | Self-editable |
| Smart-propose crew | PARTIAL | Auto-picks ONE member by availability; ignores certifications; no crew |
| Assignment notifications | BUILT- | Email + SMS on assign; calendar guest-invite exists but not auto-fired |
| Worker accept/decline | **MISSING** | Dispatch auto-assigns, no worker consent step |
| Tentative-until-confirmed | PARTIAL | Booking requests pending→accept; no job-level tentative state |
| Public booking page /book/[slug] | PARTIAL | Exists w/ capacity-aware slots; **services hardcoded**, not from services table |
| Commissions | PARTIAL | revenue×rate attributed to job *assignee*, not seller/canvasser |
| Canvassing | BUILT | Map, statuses, territories, booking conversion, analytics |
| Google Calendar | PARTIAL | Owner-level outbound job→event sync only; no availability read (matches our in-HB decision) |
| Password reset | BUILT | e2e-tested |
| Training/qualification | MISSING | certifications column inert (as before) |

### Revised Sprint 1 (verify + fill, not build-from-scratch)

0. **Infra spine:** write `.env.example` (≈25 vars reverse-engineered — Supabase incl. service role, Stripe ×9, Google ×3, Resend, Twilio ×3, Anthropic, app secrets); consolidate the ~40 manual SQL files into one canonical migration path; stand up against a decided database (see open Qs); verify the RLS tenant-scoping fix is applied (repo history shows a serious cross-tenant leak was patched — confirm in prod).
1. ~~**Multi-team fix**~~ ✅ DONE 2026-07-19: `get_my_memberships()` RPC (supabase/multi_team_memberships.sql — applied to shared DB), server/client helpers (src/lib/employee-membership*.ts), layout + EmployeeShell team switcher (cookie `hb_active_business`), 13 employee pages converted off the crashing `.single()` pattern. Verified live with a 2-team worker; switcher works; tsc clean. Deferred nit: switcher dropdown has no click-outside-close.
2. ~~**Pay model**~~ ✅ DONE 2026-07-19: `member_pay_rules` + `job_payouts` tables + completion trigger (supabase/pay_model.sql — applied; resolution: service rule > member default > legacy hourly/commission). Owner UI: Pay section in Team member editor (default + per-service rates, $/hr / % / flat) and Crew Pay card on completed jobs (basis line, editable amount → custom, mark paid w/ method, unmark). Verified live: $20/hr × 90 min → $30 pending → paid via Venmo; owner override survives re-completion. Left for later: payouts not yet rolled into Expenses & Profit margin math; no member-facing earnings view yet (RLS already allows).
3. ~~**Consent loop**~~ ✅ DONE 2026-07-20: job_crew.status (pending/accepted/declined) + responded_at + worker-update RLS (supabase/job_crew_consent.sql applied); POST /api/job-consent (RLS-scoped, declines notify owner); employee "You're requested" Accept/Decline card w/ clock-in gated on accepted (legacy no-row jobs = confirmed); owner per-crew badge + "Tentative — awaiting crew confirmation" banner (derived, no enum change). Verified live both paths incl. owner decline notification. NOT YET: auto-fire .ics calendar invite on assignment (deferred — needs RESEND_API_KEY; in-app loop delivers core value).
4. **Skill-aware dispatch:** wire certifications into findBestMember; propose crew (not single) for owner confirmation (per grilled decision: owner confirms everything — today's auto-assign contradicts it).
5. ~~**Booking page truth**~~ ✅ DONE 2026-07-19 (late night): /book/[slug] now renders the business's real active services with prices (zero-services → free-text fallback); selected services stored on the request; **owner notified on every booking** via notify-owner helper (email live when RESEND_API_KEY set; SMS queued until Twilio creds). Verified live end-to-end: real catalog → availability slots ("1 left" = Wally) → request → owner inbox → Approve & Schedule → scheduled job.

5b. **Quote → schedule chain** ✅ DONE 2026-07-19 (late night): quotes carry optional proposed_date/time (owner + employee builders; supabase/quote_proposed_schedule.sql applied); public /q page shows "Proposed service time"; acceptance auto-creates a pending booking request + notifies owner (alongside pre-existing job creation + SMS). Verified live: accept → request in owner inbox w/ quote reference → approve → scheduled job. Gap-fill applied: quotes.video_url column was missing from all SQL files (ad-hoc dashboard column) — added to DB; get-business.ts limit(1) made deterministic with created_at ordering.
6. **CFoam onboarding + deploy** to hustlebricks.ai from this repo (standalone repo — mono-repo split no longer needed).

### Open questions for next session
- **Which database?** Live hustlebricks.com Supabase (may hold real CFoam data — ask son/co-dev) vs. fresh shared-account project + full migration run. Need SUPABASE_SERVICE_ROLE_KEY either way.
- Access to co-dev's Vercel (or new Vercel project from this repo → hustlebricks.ai)?
- Stripe/Twilio/Google/Resend credentials: co-dev's accounts or founder's own?
- ~334 TODO/stub markers in src — triage pass wanted?
