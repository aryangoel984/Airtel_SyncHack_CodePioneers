# Project Udyam Digital

Airtel SYNC / YTL Hackathon 2026, Track A (fictional operator: Accel Business).
A small business owner picks a telecom bundle, sees one clear monthly price and confirms it on a phone, in English or Hindi, without a salesperson. All data is synthetic.

**Status:** Step 1 (foundation), Step 2 (quote screen) and Step 3 (AI Advisor) are done. Next: Smart KYC, Tracker, back-office dashboard.

## Run it
Copy `backend/.env.example` to `backend/.env` and put your own Groq API key in `GROQ_API_KEY` (the file is git-ignored; never commit it). Without a key the advisor still works in simple "guided" mode.
```
npm run install:all   # installs root, backend and frontend
npm run dev           # backend http://localhost:4000 + frontend http://localhost:3000
npm test              # backend tests (Vitest + supertest, Groq is mocked)
npm run eval:advisor --prefix backend   # live advisor evaluation against Groq (writes docs/advisor-eval.md)
```
Open http://localhost:3000: pick a language and chat with the advisor. `/form` is the quick form, `/dev` a developer test page.

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
| `POST /api/advisor/start`, `POST /api/advisor/chat` | AI Advisor conversation (Groq `gpt-oss-120b`, fallback `gpt-oss-20b`, then guided mode) |
| `GET /api/advisor/session/:id`, `POST /api/advisor/callback` | session view; "talk to a person" callback (mobile number masked) |

## Privacy notes (so far)
Identifiers are masked in logs and responses. The mobile number is the only personal detail collected so far (orders and callback requests); it is stored in git-ignored files in `backend/data/` and never returned in full. The AI only sees redacted text (GSTIN looked up by our server, Aadhaar/PAN/mobile/email removed). Chat text lives in memory for at most 30 idle minutes and is never saved to disk. See the Step 3 section of `CLAUDE.md`.
