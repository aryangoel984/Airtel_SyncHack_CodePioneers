# Project Udyam Digital

Airtel SYNC / YTL Hackathon 2026, Track A (fictional operator: Accel Business).
A small business owner picks a telecom bundle, sees one clear monthly price and confirms it on a phone, in English or Hindi, without a salesperson. All data is synthetic.

**Status:** Step 1 (foundation) and Step 2 (quote screen) are done. Next: AI Advisor, Smart KYC, Tracker, back-office dashboard.

## Run it
```
npm run install:all   # installs root, backend and frontend
npm run dev           # backend http://localhost:4000 + frontend http://localhost:3000
npm test              # backend tests (Vitest + supertest)
```
Open http://localhost:3000 (start page), then "Show my plan". `/dev` is a developer test page.

## How it is organised
- `backend/` Express + TypeScript API (port 4000). All business logic: rules, pricing, validators, orders.
- `frontend/` Next.js + Tailwind (port 3000). Only calls the backend; no logic, no CSV reading.
- `docs/PROBLEM_STATEMENT.md` the full case. `CLAUDE.md` project notes and decisions.

## Main API endpoints
| Endpoint | Purpose |
|---|---|
| `GET /api/health` | liveness check |
| `GET /api/gstin/:gstin`, `GET /api/udyam/:udyam` | mocked government lookups |
| `GET /api/catalogue` | all products with English/Hindi text |
| `POST /api/eligible` | products a business profile may buy |
| `POST /api/bundles/starter` | starter plan from what similar, retained customers bought |
| `POST /api/quote` | priced quote (runs the rules engine first) |
| `POST /api/orders`, `GET /api/orders/:id` | place and read an order (mobile number masked) |

## Privacy notes (so far)
Identifiers are masked in logs and responses. The mobile number is the only personal detail collected in Step 2; it is stored in `backend/data/orders.json` (git-ignored) and never returned in full.
