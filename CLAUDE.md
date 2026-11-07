# Project Udyam Digital (Airtel SYNC / YTL Hackathon, Track A)

## Problem (5 lines)
1. Small business owners struggle to pick the right Airtel/Accel telecom bundle without a salesperson.
2. Goal: let them discover a bundle, get a clear quote, finish KYC and track activation, on their phone, in their language.
3. The old process mis-sold bundles (about 48 of 368 activated historic bundles break eligibility rules).
4. The funnel leaks heavily: 5,000 leads -> 368 activated (~17.6 days, 3 chase calls, ~Rs 15k acquisition cost).
5. All data is synthetic; treat it like real customer data (consent, masked IDs, minimal collection).

## Roadmap
1. **Foundation** (data + rules + lookup APIs) <- done
2. **Quote screen** <- done
3. **AI Advisor** <- done (see docs/advisor-eval.md for the live evaluation). 3.5: blocked wishes always explained <- done
4. **Smart KYC** <- done
5. **Tracker** <- done
6. Back-office dashboard + lead score, then submission (deploy, architecture diagram, 10-slide case, privacy note, video)

## From the full problem statement (docs/PROBLEM_STATEMENT.md)
- Goal: a digital-first journey to discover the right bundle, buy it and get it activated with minimal human effort, on a phone, in the owner's language.
- **4 required modules:** (1) Advisor: GenAI assistant that asks about the business and recommends a catalogue bundle, explaining why in plain language; (2) Quote and checkout: one transparent monthly price with toggleable add-ons; (3) Smart KYC: upload + extraction + validation, mocked GSTIN/Udyam lookups, clear consent screen; (4) Tracker: order status view instead of calling support. Stretch: voice/WhatsApp front end, back-office view of leads the advisor couldn't close, propensity score.
- **5 business-case questions:** (1) which segments first and what bundle/price/contract; (2) how needs discovery works without a salesperson (Hindi/regional chat or voice); (3) near-instant KYC while staying DPDP Act 2023 compliant (consent, purpose limitation, data minimisation); (4) role of field force and channel partners; (5) 3-5 success metrics with targets (conversion, time to activate, CAC, 6-month churn).
- **Submission:** (1) working prototype: demo video <= 3 min + repo; (2) solution architecture diagram; (3) business case, <= 10 slides (template: `6ad9d4887d445_airtel_sync/Submission Template_Sync.pptx`); (4) 1-page data privacy and security note.
- **Judges run 15 live advisor test scenarios.** The advisor must handle edge cases and NEVER break catalogue eligibility rules.
- Key numbers: 7% lead-to-activation; steepest drop is needs assessed -> quote accepted (44%); leads with GSTIN activate at 9.6% vs 2.0% without; median bundle ~Rs 6,900/month (micro ~Rs 2,500).
- Segments (share of base): Micro retail & services 55% (very price sensitive), Professional offices 25%, Small multi-site 15%, Small manufacturers 5%.

## Rules (from the dataset README)
- `available_city_tiers`: product only sold in those tiers.
- `min_employees` / `min_sites`: only offered at or above these sizes.
- `requires_gstin = Y`: needs a valid AND ACTIVE GSTIN (Cancelled/Suspended = not eligible).
- `requires_one_of`: needs at least one of those products in the same bundle.
- `typical_install_days`: drives the tracker and the expected activation date.
- GSTIN: real 15-char structure + mod-36 checksum; PAN 4th char is always `X` (accept it).
- Udyam: `UDYAM-XX-00-1234567`; district `00` is fake but accepted.
- "Today" is **2026-07-15** (`TODAY` in `backend/src/lib/validators.ts`). Address proof must be <= 90 days old.
- Privacy: mask IDs in logs/UI (`backend/src/lib/mask.ts`), show consent before KYC, explain retention.
- NEVER modify the original dataset folder; `backend/data/` holds copies.

## Assumptions / decisions
- List price = `price_min_inr_per_month` (switch via `PRICE_BASIS` in `backend/src/lib/quote.ts`).
- One-time setup fee = catalogue setup fee x quantity (matches historic lead data).
- Contract length = longest `min_contract_months` in the bundle; install days = longest `typical_install_days`.
- Segment (`target_segments`) is only a recommendation hint, not a blocking rule. `segmentCode()` in `backend/src/lib/rules.ts` maps lead segment names to catalogue codes.
- Missing dependency -> engine auto-adds the cheapest eligible required product and reports a fix; if none is eligible the item is blocked.
- Historic check: 56 activated bundles have some problem; **48 have a blocked product**, the other 8 only lack a dependency product.

## Step 2 decisions
- **Starter bundles** (`backend/src/lib/starter.ts`): from ACTIVATED, non-churned leads in the same segment. Base = products in >= 40% of bundles, add-ons = 10-40% (`STARTER_CONFIG`). Computed once at startup and cached. Everything runs through the rules engine with the customer's real profile.
- Only ONE internet plan and ONE SIM plan go in the base bundle (the most common eligible one); the others appear in "more options". An add-on that would force an extra product (e.g. Static IP on a leased line) stays in "more options" instead of the add-on list.
- **Default quantities are learned from history** (`backend/src/lib/quantities.ts`, all settings in `quantityConfig.ts`): for each (segment, product) among ACTIVATED + NOT churned leads we take the median quantity per employee (lines, users, devices, cameras, channels) or per site (per-site and per-counter products), multiply by the customer's employees/sites, round, and clamp to 1..historic max. SIMs (P07/P08) are fixed at 2..6. Fewer than `minSamples` (3) purchases, or a unit not in `basisByUnit` (account, pack, number, IP, vehicle), falls back to the simple unit rule in `rules.ts`. Customers can still change quantities with +/-. Note: per-site products are clamped to the historic max, so e.g. a 3-site professional office defaults to 1 connection (history never had more).
- Starter base price vs historic IQR of `monthly_bundle_value_inr` (`tests/iqr.test.ts`, typical profiles): prof (Rs 5,338) and multi-site (Rs 25,775) are inside; micro (Rs 1,597 vs 1,862-2,995) and factory (Rs 11,464 vs 13,330-21,250) are BELOW. Reported, not forced: the IQR is for whole bundles (base + add-ons), we compare the base only. The test records these verdicts so any change is noticed.
- Blocked items carry structured `codes`; `productCopy.ts` turns them into customer text (EN/HI), e.g. "Needs a GST number".
- Customers never see product codes (P01...). The UI only shows `copy` names from the backend.
- Orders: `backend/data/orders.json` (git-ignored), ids `UD-2026-0001`, server recalculates prices, mobile stored in full but only ever returned masked (`98******21`). Order times use the simulated clock (TODAY's date + real time of day). Writes go through a queue.
- Frontend runs Next 16 with cache components on: any client page using `useParams` etc. needs a `<Suspense>` wrapper (see `app/order/[id]/page.tsx`). Read `frontend/node_modules/next/dist/docs/` before changing Next features (`frontend/AGENTS.md`).
- Frontend `lib/types.ts` is a hand-copied mirror of backend response types. **Keep it in sync** when backend responses change.

## Git rules
- Never add Co-Authored-By, Claude-Session or 'Generated with Claude Code' lines to commit messages or PR descriptions.

## Step 3: AI Advisor (design, settings, privacy)
**Principle: the AI talks, the code decides.** The LLM never invents products, quantities, prices or eligibility. Everything comes from tools that call our own rules engine, starter bundles and quote calculator. The plan card in the chat is rendered by the frontend from structured JSON, not from the LLM's text.
- **Flow:** `message -> redact.ts (GSTIN lookup + PII removal) -> safety-net save -> Groq with tools -> guardrail -> reply`. Code: `backend/src/lib/advisor/` (engine, tools, recommend, mapping, redact, guardrail, guided, templates, session, llm, systemPrompt, config). Route: `backend/src/routes/advisor.ts`.
- **Tools:** `update_profile`, `check_product`, `get_recommendation`, `request_human`. Schemas are deliberately lenient (strings/numbers/null) because Groq rejects the WHOLE request (HTTP 400) when a model sends an enum value that is not in the schema. Values are normalised and validated in `mapping.ts` (`validateSlots`) instead.
- **Safety net:** before the LLM runs, a KNOWN city and clearly stated wishes (no negation in the message) are saved by code, in case the model forgets `update_profile`. Handoffs ("talk to a person", frustration, >12 sites or >150 staff) are also triggered by code. Thresholds live in `advisor/config.ts`.
- **Mappings (code, not LLM):** city->tier and business type->segment come from smb_leads.csv (+ aliases/Hindi names/keywords). **Assumption: 3 or more locations is always "Small multi-site businesses", whatever the business type.** Wishes -> products via a synonym map (English, Hindi, Hinglish); the LLM passes wish keys.
- **Recommendation rules (`recommend.ts`):** starter bundle + eligible wishes + auto-added dependencies; blocked wishes get a plain reason and the closest allowed alternative; "only X" requests give a minimal plan (SIM-only = 1 SIM per person, max 6); a budget drops wished add-ons first (dearest first), then falls back to cheapest essentials, and reports honestly when impossible (`budget.within`, `cheapest_possible_inr`). The plan also lists `suggested_addons` ("you may also like").
- **Groq settings:** SDK `groq-sdk` in the backend only. Primary `openai/gpt-oss-120b`, fallback `openai/gpt-oss-20b` (from `backend/.env`, see `.env.example`). `reasoning_effort: "low"`, `include_reasoning: false` (reasoning is never requested, read or stored; only `message.content` and `tool_calls` are used), temperature 0.3, max 700 completion tokens, 20 s timeout, `tool_choice: auto` (`required` made gpt-oss fail with 400s). Startup checks the models list and logs model names only. Primary fails (error/timeout/429) -> one retry on the fallback -> if both are rate-limited and Groq says it clears within 20 s we wait and retry the primary once -> otherwise **guided mode** (no AI: fixed questions with buttons, same recommendation code). Per-IP rate limit on `/api/advisor/*` (20 requests/minute, configurable).
- **Groq account limits seen on this key:** 8,000 tokens/minute per model and 1,000 requests/day. One advisor turn uses roughly 3-6k tokens, so about one turn per minute per model. For a live demo with many judges, upgrade the Groq tier. The prompt and tool schemas are already compressed for this limit.
- **Guardrail (`guardrail.ts`):** every LLM reply is checked for rupee amounts not present in tool results, product codes (P01-P25), leaked reasoning/tool names, offering things we don't sell (DTH, laptops, loans...) and recommending a product blocked for this customer. On failure: regenerate once with a correction note, then a safe template reply built from the structured plan. Hits are counted and logged (masked). Name checks run for English/Hindi/Hinglish replies only.
- **Privacy choices (for the 1-page privacy note):** the LLM only ever sees redacted text: a GSTIN is looked up on OUR server and replaced by a token like `[GSTIN_PROVIDED: Active, Saffron Bakers, Ludhiana, Punjab]`; Aadhaar-like numbers, PAN, mobile numbers and emails become `[REDACTED]` and the customer is told not to share them. The Groq key stays on the server (never logged, never sent to the browser, `backend/.env` is git-ignored). Conversation state is in memory per session and **deleted after 30 minutes idle**; raw chat text is never written to disk. Only a MASKED summary (outcome, last slot reached, segment, tier, counts, wishes, models used, no identifiers) is saved to `backend/data/advisor_sessions.json` (git-ignored) for the Step 6 dashboard. The browser keeps the transcript in sessionStorage only (cleared when the tab closes). "Talk to a person": the mobile number goes straight to `POST /api/advisor/callback`, never through the AI, and is stored in `backend/data/callbacks.json` (git-ignored) and returned only masked.
- **Frontend:** `/` is the advisor (language picker with 11 languages in their own scripts, chat, quick-reply chips, typing dots, plan card, "Customise & buy" -> `/quote` with the exact items, "Talk to a person", mic button via the Web Speech API, hidden when unsupported). Old form is at `/form`. Screen text is English or Hindi; the chat itself is in the customer's language. Plan-card product names exist only in English/Hindi (the LLM may not write product names).
- **Evaluation:** `npm run eval:advisor` (live, real Groq, not part of `npm test`; `-- --only=3,7` to re-run some, `-- --fresh` to start over). Results: `docs/advisor-eval.md` (table + transcripts) and `docs/advisor-eval.json`. Unit tests use a mocked Groq (`backend/tests/advisor/`).

## Step 3.5: blocked wishes are always explained
- Eval scenario 2 failed live: a no-GST shop asked for WhatsApp Business and the AI skipped the "needs GST" reason.
- Fix (`advisor/engine.ts`): when a NEW wish arrives and all details are known, code rebuilds the plan immediately and tells the AI (server note) what is blocked and why. After the reply, `ensureBlockedExplained()` appends the reason from the rules engine if the reply doesn't mention it. Works in AI and guided mode. Tests: `tests/advisor/blocked-wish.test.ts`.

## Step 4: Smart KYC
- **Flow:** `/kyc/[orderId]`: consent -> documents -> checks -> e-sign. Backend `src/lib/kyc/` (types, ocr, parse, checks, service) + `src/routes/kyc.ts`.
- **OCR:** Tesseract (`tesseract.js` + `@tesseract.js-data/eng`, runs on our server, offline, never an outside AI). `sharp` cleans the image and sets 300 DPI metadata (without it the auto-rotation fails and the tilted K02 can't be read). `rotateAuto` straightens tilted photos. Confidence < 60 = unreadable (blurry). ~0.8 s per document; one OCR at a time (queue).
- **Parsing (`parse.ts`):** label/value lines (same line or the next line for ID cards); GSTIN fixed by position (O/0, I/1...) then, if the check digit fails, ONE look-alike swap is accepted only if the result passes the checksum AND is in the registry (K10 I->J). A tampered GSTIN (K06) is never "fixed". Names/addresses compared with `sameText` (edit distance <= max(2, 5%)).
- **Checks (`checks.ts`), each with EN/HI text:** missing documents; unreadable; GSTIN check digit (reject); in registry (reject); GST status Active (reject if Cancelled/Suspended); legal + trade name and address vs registry (fix); typed GSTIN vs certificate; Udyam number present / format / registry / name; GST vs Udyam name; signatory ID valid date, issued for this business, owner check for proprietorships (warn); bill within 90 days of TODAY, bill name, bill address vs registry. Verdict: any reject -> REJECTED; any other fail -> ACTION_NEEDED; else VERIFIED. Udyam registration dates and "major activity" differ on every sample certificate (data noise), so they are NOT checked.
- **Required documents:** signatory ID + address proof always; GST certificate unless "I don't have GST"; Udyam certificate unless "I don't have Udyam"; at least one registration; if the plan has GST-only products, GST is required.
- **Sample answer key (`tests/kyc.test.ts`, real OCR):** K01 REJECTED (GST cancelled + Udyam number blank), K02 VERIFIED (tilted), K03 VERIFIED, K04 ACTION_NEEDED (blurry GST), K05 ACTION_NEEDED (no Udyam), K06 REJECTED (altered GSTIN), K07 ACTION_NEEDED (name mismatch), K08-K10 VERIFIED, K11 ACTION_NEEDED (bill too old), K12 VERIFIED.
- **Order statuses:** QUOTE_ACCEPTED -> KYC_ACTION_NEEDED / KYC_REJECTED -> KYC_VERIFIED (only after e-sign) -> SITE_CHECK -> TECH_SCHEDULED -> INSTALLED -> ACTIVE. `updateOrder()` / `setStatus()` in `orders.ts` (one write queue, mock SMS per status).
- **Privacy:** uploads stay in memory (multer memoryStorage, 8 MB, images only) and are discarded after OCR; the order keeps only the result with masked GSTIN/Udyam/ID numbers. Consent (time, version, language) is stored. Max 5 attempts; verify endpoint rate-limited.
- **Mocks:** DigiLocker button = demo loader for the 12 sample applicants (`backend/data/kyc_samples/`, served by `GET /api/kyc/samples/:id/:doc`). e-sign = 6-digit OTP shown on screen ("sent" to the masked mobile), 10-minute expiry.

## Step 5: Tracker
- `/order/[id]` is the live tracker: status hero with progress bar, 6-stage timeline (done / current / attention / blocked / upcoming) with real or expected dates, KYC call-to-action, mock SMS list, order summary. `/track`: find an order with order number + mobile (must match, rate-limited).
- Timeline maths (`src/lib/tracker.ts`): after verification, site check +1 day, technician +1-2 days, installed and live after the plan's install days.
- **Demo control:** "Move installation to the next step" button (`POST /api/orders/:id/advance`) for presentations; only after KYC_VERIFIED. Turn off with `DEMO_CONTROLS=false` in `backend/.env`.

## Folder structure
```
backend/                 Express + TypeScript API, port 4000
  data/                  4 CSVs (+ orders.json at runtime, git-ignored)
  src/server.ts          app, CORS (localhost:3000 only), error handler, /api/health
  src/lib/advisor/       AI Advisor (see Step 3 section)
  src/lib/kyc/           Smart KYC: ocr, parse, checks, service, types (Step 4)
  src/lib/tracker.ts     tracker timeline + demo advance (Step 5)
  data/kyc_samples/      the 12 sample applicants' documents (K01-K12)
  scripts/evalAdvisor.ts live advisor evaluation
  src/lib/               data, validators, mask, lookups, rules, quote, segments,
                         quantities + quantityConfig (history-based default quantities),
                         productCopy (EN/HI text), starter, orders, validate (input checks)
  src/routes/            gstin, udyam, catalogue, eligible, quote, bundles, orders, advisor, kyc
  tests/                 validators, rules+quote, historic-leads, starter, orders, iqr, advisor/*
frontend/                Next.js + Tailwind, port 3000 (no business logic)
  app/                   page.tsx (AI Advisor chat), form/, quote/, order/[id]/ (tracker), kyc/[id]/, track/, dev/ (API test page)
  components/            Header, ProductRow, ConfirmDialog, ErrorBox, OrderView (tracker), ui/ (Icon, JourneySteps, Sheet),
                         chat/ (ChatView, Landing, BusinessPanel, RecommendationCard, PersonDialog, MicButton), kyc/ (KycView, UploadStep, ResultsStep)
  lib/                   api.ts (backend client), types.ts, i18n.ts (EN/HI strings), LangContext, profile
docs/PROBLEM_STATEMENT.md
```

## API (all under http://localhost:4000)
- `GET /api/health`, `GET /api/gstin/:gstin`, `GET /api/udyam/:udyam`, `GET /api/catalogue`
- `POST /api/eligible` body = profile
- `POST /api/bundles/starter` body = profile -> `{ based_on, base, addons, more, blocked, fixes }`
- `POST /api/quote` body = `{ profile, items: [{product_id, quantity}] }`
- `POST /api/orders` body = `{ profile, items, language, mobile }`; `GET /api/orders/:id` (includes `tracker`, `kyc`, `notifications`); `POST /api/orders/track {orderId, mobile}`; `POST /api/orders/:id/advance` (demo)
- KYC: `GET /api/kyc/samples`, `GET /api/kyc/samples/:id/:doc`, `GET /api/kyc/:orderId`, `POST /api/kyc/:orderId/consent {accepted, language}`, `POST /api/kyc/:orderId/digilocker`, `POST /api/kyc/:orderId/verify` (multipart: gst_certificate, udyam_certificate, signatory_id, address_proof, noGst, noUdyam, gstin), `POST /api/kyc/:orderId/esign/start`, `POST /api/kyc/:orderId/esign/confirm {name, otp}`
- Advisor: `POST /api/advisor/start {language}`, `POST /api/advisor/chat {sessionId?, message, language?}`, `GET /api/advisor/session/:id`, `POST /api/advisor/session/:id/event {quote_opened|ordered}`, `POST /api/advisor/callback {sessionId, mobile}`, `POST /api/advisor/handoff {sessionId}`
- Profile = `{ segment, city_tier, employee_count, num_sites, has_valid_active_gstin }`; segment = `micro | prof | multi | mfg`

## Run and test
```
npm run install:all
npm run dev      # backend :4000 + frontend :3000
npm test         # backend Vitest + supertest (129 tests, about 1 minute: includes real OCR on the 12 KYC samples)
npm run eval:advisor --prefix backend   # live advisor evaluation (needs GROQ_API_KEY in backend/.env)
```
Backend env: `backend/.env.example`. Frontend env: `frontend/.env.example` (`NEXT_PUBLIC_API_URL`).
