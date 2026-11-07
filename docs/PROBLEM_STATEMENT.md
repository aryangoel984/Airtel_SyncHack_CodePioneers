# Project Udyam Digital — Problem Statement (transcribed from Airtel_SYNC_Case.pdf)

YTL Hackathon 2026 · Enterprise Track A (Airtel SYNC, platform partner Unstop)
"Making small businesses go digital in one sitting" · Prepared by Ankit Srivastava · October 2026

> About this case: Teams submit a working prototype plus a short business case, so we can assess
> technical depth and business judgement together. The case uses a fictional operator, Accel Telecom,
> and its B2B arm Accel Business. All figures and data are synthetic.

## Context
Accel Telecom leads India's mobile market and is a top-2 player in home broadband. Its enterprise arm,
Accel Business, serves large corporates well but has a small share of India's 6 crore+ MSMEs: kirana
stores, clinics, coaching centres, small manufacturers, CA firms and restaurants.

These businesses increasingly need more than a SIM. A typical clinic or retail shop now wants fixed
broadband or a leased line, a few business SIMs, a WhatsApp/SMS channel to reach customers, cloud email
and storage, basic cybersecurity, and CCTV or POS connectivity. Today they buy each piece from a
different vendor, often a local reseller, with no single bill or support number.

Accel Business already offers most of these products, but sells them one at a time through a field sales
force built for large accounts. The journey is slow and paper-heavy:
- Needs are discovered in a visit by a sales executive, who often pitches whatever is on target that month
- A quote takes 3–5 days and comes as a PDF with product codes the owner does not understand
- KYC needs GST certificate, Udyam registration, address proof and signatory ID, collected physically or over email
- Installation and activation take 10–14 days on average, with 3–4 follow-up calls from the customer
- Each product is billed and supported separately after activation

Result: high cost to acquire a small business, low conversion, and a large share of interested prospects
drop out before activation. Competitors and digital-first players offer instant online sign-up for single products.

## The problem
**Design and build a digital-first acquisition and onboarding journey that lets a small business owner
discover the right bundle, buy it and get it activated with minimal human effort — on a phone, in their
preferred language.**

## Key questions (answer in the business case)
1. Which MSME segments should Accel Business prioritise first, and what bundle (products, price point,
   contract length) fits each?
2. How should needs discovery work without a salesperson? A conversational advisor (chat or voice, in Hindi
   and regional languages) that asks a few questions and recommends a bundle with a clear monthly price.
3. How can KYC and documentation be made near-instant (GSTIN/Udyam lookup, document OCR, DigiLocker,
   e-sign) while staying compliant with the DPDP Act, 2023 — consent, purpose limitation and data minimisation?
4. What role should the existing field force and local channel partners play, so the digital journey adds
   to them instead of competing with them?
5. How will you measure success? Define 3–5 metrics (e.g. lead-to-activation conversion, time to activate,
   cost of acquisition, 6-month churn) and the targets you would set.

## Build challenge — prototype must cover at least
| Module | Requirement |
|---|---|
| Advisor | A GenAI-powered assistant that asks about the business (type, size, locations, current tools) and recommends a bundle from the product catalogue, explaining why in plain language |
| Quote and checkout | A single, transparent monthly price with add-ons the owner can toggle |
| Smart KYC | Document upload with extraction and validation, mocked lookups of GSTIN and Udyam data, and a clear consent screen |
| Tracker | An order status view the owner can check instead of calling support |

Stretch goals: a voice or WhatsApp front end; a back-office view for sales or partners showing leads the
advisor could not close; a simple propensity score for which leads to call.

## What teams submit
1. Working prototype (demo video of 3 minutes max + code repository)
2. Solution architecture diagram with the main components and data flows
3. Business case in 10 slides or fewer: target customer, value, pricing or savings, rollout, risks
4. A 1-page note on data privacy and security choices made in the design

## Judging note
Judges have a separate pack (not shared with teams): **15 advisor test scenarios run live during demos**,
the KYC answer key, the signals planted in the leads data, and the data-generation scripts.
=> The advisor must be robust to edge cases and must never break catalogue eligibility rules.

## Appendix A1 — SMB acquisition funnel (Apr–Jun 2026, Tier 1–2 cities)
Only 7% of leads get activated; the steepest drop is needs assessed → quote accepted.

| Stage | Leads | % of previous |
|---|---|---|
| Leads generated | 5,000 | — |
| Contacted | 3,406 | 68% |
| Needs assessed | 1,974 | 58% |
| Quote accepted | 861 | 44% |
| KYC complete | 588 | 68% |
| Activated | 368 | 63% |

- 17.6 days average lead to activation; 3 status chases per customer
- ~Rs 15,000 blended acquisition cost per activated SMB, vs median bundle Rs 6,900/month (micro ~Rs 2,500)
- Leads with a GSTIN activate at 9.6%, without at 2.0%

## Appendix A2 — Customer segments (indicative)
| Segment | Share of SMB base | Typical example | Current setup | Key needs | Price sensitivity |
|---|---|---|---|---|---|
| Micro retail & services | 55% | Kirana, salon, pharmacy | Owner's mobile + hotspot, UPI QR | Reliable internet for UPI/POS, WhatsApp catalogue | Very high |
| Professional offices | 25% | Clinic, CA firm, coaching centre | Home broadband, personal Gmail | Uptime, cloud email/storage, data security | Medium |
| Small multi-site businesses | 15% | Restaurant chain, 3–10 store retailer | Mixed ISPs per site, no central IT | One bill, central management, CCTV, failover | Medium–low |
| Small manufacturers | 5% | Auto-parts unit, textile unit | Leased line or local ISP | Dedicated bandwidth, IoT for machines, ERP access | Low |

## Submission template
`6ad9d4887d445_airtel_sync/Submission Template_Sync.pptx` — 2 image-only slides (Airtel SYNC title slide
and a blank content master with Airtel/SYNC logos and "Platform Partner Unstop"). Use for the business case deck.
