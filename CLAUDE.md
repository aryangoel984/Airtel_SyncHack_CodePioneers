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
3. AI Advisor
4. Smart KYC
5. Tracker
6. Back-office dashboard + submission

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

## Folder structure
```
backend/                 Express + TypeScript API, port 4000
  data/                  4 CSVs (+ orders.json at runtime, git-ignored)
  src/server.ts          app, CORS (localhost:3000 only), error handler, /api/health
  src/lib/               data, validators, mask, lookups, rules, quote, segments,
                         quantities + quantityConfig (history-based default quantities),
                         productCopy (EN/HI text), starter, orders, validate (input checks)
  src/routes/            gstin, udyam, catalogue, eligible, quote, bundles, orders
  tests/                 validators, rules+quote, historic-leads, starter, orders, iqr
frontend/                Next.js + Tailwind, port 3000 (no business logic)
  app/                   page.tsx (start form), quote/, order/[id]/, dev/ (API test page)
  components/            Header, ProductRow, ConfirmDialog, ErrorBox, OrderView
  lib/                   api.ts (backend client), types.ts, i18n.ts (EN/HI strings), LangContext, profile
docs/PROBLEM_STATEMENT.md
```

## API (all under http://localhost:4000)
- `GET /api/health`, `GET /api/gstin/:gstin`, `GET /api/udyam/:udyam`, `GET /api/catalogue`
- `POST /api/eligible` body = profile
- `POST /api/bundles/starter` body = profile -> `{ based_on, base, addons, more, blocked, fixes }`
- `POST /api/quote` body = `{ profile, items: [{product_id, quantity}] }`
- `POST /api/orders` body = `{ profile, items, language, mobile }`; `GET /api/orders/:id`
- Profile = `{ segment, city_tier, employee_count, num_sites, has_valid_active_gstin }`; segment = `micro | prof | multi | mfg`

## Run and test
```
npm run install:all
npm run dev      # backend :4000 + frontend :3000
npm test         # backend Vitest + supertest (36 tests; prints the historic-bundle count)
```
Backend env: `backend/.env.example`. Frontend env: `frontend/.env.example` (`NEXT_PUBLIC_API_URL`).
