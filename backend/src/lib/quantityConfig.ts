// All settings for default quantities live here. Change a number and restart.
//
// How a default quantity is chosen (see quantities.ts):
//   1. Look at customers in the same segment who bought the product, were activated and did NOT churn.
//   2. Take the MEDIAN of (quantity / their employees) or (quantity / their sites).
//   3. Multiply by THIS customer's employees or sites, round, and clamp to 1..historic max.
//   4. No usable history for that segment + product? Use the simple unit rule in rules.ts.

export type Basis = "employee" | "site";

export const QUANTITY_CONFIG = {
  /** Which number a unit scales with. Units not listed use the simple unit rule instead. */
  basisByUnit: {
    "per site": "site",
    "per counter": "site", // history: exactly 1 per site (checked in the data)
    "per line": "employee",
    "per user": "employee",
    "per device": "employee",
    "per camera": "employee",
    "per channel": "employee", // history: roughly 1 per 4-5 staff
  } as Record<string, Basis>,

  /** Fixed limits for specific products. They replace the historic max (SIMs: 2 to 6). */
  limitsByProduct: {
    P07: { min: 2, max: 6 }, // Business Postpaid 299
    P08: { min: 2, max: 6 }, // Business Postpaid 599
  } as Record<string, { min: number; max: number }>,

  /** Fewer historic purchases than this = not enough history, so use the unit rule. */
  minSamples: 3,
};
