# Project Udyam Digital (Airtel SYNC / YTL Hackathon, Track A)

## Problem (5 lines)
1. Small business owners struggle to pick the right Airtel/Accel telecom bundle without a salesperson.
2. Goal: let them discover a bundle, get a clear quote, finish KYC and track activation, on their phone, in their language.
3. The old process mis-sold bundles (about 48 of 368 activated historic bundles break eligibility rules).
4. The funnel leaks heavily: 5,000 leads -> 368 activated (~17.6 days, 3 chase calls, ~Rs 15k acquisition cost).
5. All data is synthetic; treat it like real customer data (consent, masked IDs, minimal collection).

## Roadmap
1. **Foundation** (data + rules + lookup APIs) <- done
2. Quote screen
3. AI Advisor
4. Smart KYC
5. Tracker
6. Back-office dashboard + submission

## Rules (from the dataset README)
- `available_city_tiers`: product only sold in those tiers.
- `min_employees` / `min_sites`: only offered at or above these sizes.
- `requires_gstin = Y`: needs a valid AND ACTIVE GSTIN (Cancelled/Suspended = not eligible).
- `requires_one_of`: needs at least one of those products in the same bundle.
- `typical_install_days`: drives the tracker and the expected activation date.
- GSTIN: real 15-char structure + mod-36 checksum; PAN 4th char is always `X` (accept it).
- Udyam: `UDYAM-XX-00-1234567`; district `00` is fake but accepted.
- "Today" is **2026-07-15** (`TODAY` in `lib/validators.ts`). Address proof must be <= 90 days old.
- Privacy: mask IDs in logs/UI (`lib/mask.ts`), show consent before KYC, explain retention.
- NEVER modify the original dataset folder; `data/` holds copies.

## Assumptions / decisions
- List price = `price_min_inr_per_month` (switch via `PRICE_BASIS` in `lib/quote.ts`).
- One-time setup fee = catalogue setup fee x quantity (matches historic lead data).
- Contract length = longest `min_contract_months` in the bundle; install days = longest `typical_install_days`.
- Segment (`target_segments`) is only a recommendation hint, not a blocking rule. `segmentCode()` in `lib/rules.ts` maps lead segment names to catalogue codes.
- Missing dependency -> engine auto-adds the cheapest eligible required product and reports a fix; if none is eligible the item is blocked.
- Historic check: 56 activated bundles have some problem; **48 have a blocked product**, the other 8 only lack a dependency product.

## Folder structure
```
data/        copies of the 4 CSVs
lib/         data.ts (loaders), validators.ts, mask.ts, lookups.ts, rules.ts, quote.ts
app/         page.tsx (test page) + api/{gstin,udyam,quote,catalogue,eligible}
tests/       vitest tests (validators, rules+quote, historic-leads)
```

## API
- `GET /api/gstin/:gstin`, `GET /api/udyam/:udyam`
- `GET /api/catalogue`
- `POST /api/eligible` body = business profile
- `POST /api/quote` body = `{ profile, items: [{product_id, quantity}] }`
- Profile = `{ segment, city_tier, employee_count, num_sites, has_valid_active_gstin }`

## Run and test
```
npm install
npm run dev      # http://localhost:3000
npm test         # vitest (prints the historic-bundle count)
```
