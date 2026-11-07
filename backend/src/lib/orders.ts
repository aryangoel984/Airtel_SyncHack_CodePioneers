// Order storage: one JSON file (simple, no database yet). Every write goes through one queue
// so two requests arriving together can't overwrite each other.
import fs from "fs";
import path from "path";
import { BusinessProfile, BundleItem } from "./rules";
import { Quote, buildQuote } from "./quote";
import { TODAY } from "./validators";
import { maskMobile } from "./mask";
import type { KycRecord } from "./kyc/types";

/**
 * The order's journey. Steps 4 (Smart KYC) and 5 (Tracker) move it forward.
 *   QUOTE_ACCEPTED -> (KYC_ACTION_NEEDED | KYC_REJECTED) -> KYC_VERIFIED
 *   -> SITE_CHECK -> TECH_SCHEDULED -> INSTALLED -> ACTIVE
 */
export const ORDER_STATUSES = [
  "QUOTE_ACCEPTED", "KYC_ACTION_NEEDED", "KYC_REJECTED", "KYC_VERIFIED",
  "SITE_CHECK", "TECH_SCHEDULED", "INSTALLED", "ACTIVE",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** A mock SMS / WhatsApp update (nothing is really sent in the prototype). */
export interface Notification { at: string; channel: "SMS" | "WhatsApp"; status: OrderStatus; text_en: string; text_hi: string }

export interface Order {
  id: string; // UD-2026-0001
  createdAt: string; // simulated clock: TODAY's date + real time of day
  language: "en" | "hi";
  mobile: string; // full number, stored only for order updates. NEVER returned by the API
  profile: BusinessProfile;
  items: BundleItem[]; // what was actually priced (after the rules engine)
  quote: Quote;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: string; note?: string }[];
  kyc?: KycRecord; // consent, check results, e-sign (Step 4). Never contains document images.
  notifications?: Notification[];
}

/** What the API returns: same as Order but with the mobile number masked. */
export type PublicOrder = Omit<Order, "mobile"> & { mobile_masked: string };

const ordersFile = () => process.env.ORDERS_FILE ?? path.join(process.cwd(), "data", "orders.json");

function readAll(): Order[] {
  try {
    return JSON.parse(fs.readFileSync(ordersFile(), "utf8")) as Order[];
  } catch {
    return []; // file doesn't exist yet
  }
}

function writeAll(orders: Order[]) {
  const tmp = ordersFile() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(orders, null, 2));
  fs.renameSync(tmp, ordersFile()); // atomic swap, so a crash can't leave half a file
}

/** Simulated "now": the prototype's TODAY date with the real clock time. */
export function simNow(): string {
  const real = new Date();
  const d = new Date(TODAY);
  d.setUTCHours(real.getUTCHours(), real.getUTCMinutes(), real.getUTCSeconds(), 0);
  return d.toISOString();
}

export const toPublic = ({ mobile, ...rest }: Order): PublicOrder => ({ ...rest, mobile_masked: maskMobile(mobile) });

// One queue for every write (create + update).
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => T): Promise<T> {
  const job = queue.then(fn);
  queue = job.catch(() => undefined);
  return job;
}

export function createOrder(input: {
  profile: BusinessProfile;
  items: BundleItem[];
  language: "en" | "hi";
  mobile: string;
}): Promise<{ order: PublicOrder; blocked: Quote["blocked"] } | { error: string }> {
  return enqueue(() => {
    // Prices come from the server, never from the browser.
    const quote = buildQuote(input.profile, input.items);
    if (quote.lines.length === 0) return { error: "None of the selected products can be sold to this business" };

    const orders = readAll();
    const next = orders.reduce((m, o) => Math.max(m, Number(o.id.split("-")[2])), 0) + 1;
    const at = simNow();
    const order: Order = {
      id: `UD-${TODAY.getUTCFullYear()}-${String(next).padStart(4, "0")}`,
      createdAt: at,
      language: input.language,
      mobile: input.mobile,
      profile: input.profile,
      items: quote.lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
      quote,
      status: "QUOTE_ACCEPTED",
      statusHistory: [{ status: "QUOTE_ACCEPTED", at }],
      notifications: [],
    };
    order.notifications!.push(notificationFor(order, "QUOTE_ACCEPTED", at));
    orders.push(order);
    writeAll(orders);
    console.log(`[order] created ${order.id} mobile=${maskMobile(order.mobile)}`);
    return { order: toPublic(order), blocked: quote.blocked };
  });
}

export function getOrder(id: string): PublicOrder | undefined {
  const o = readAll().find((x) => x.id === id);
  return o ? toPublic(o) : undefined;
}

/** Full order including the mobile number: server-side use only (e.g. tracker lookup). */
export function getOrderPrivate(id: string): Order | undefined {
  return readAll().find((x) => x.id === id);
}

/**
 * Change an order safely (read -> change -> write inside the queue).
 * The function may return an error string to refuse the change.
 */
export function updateOrder(id: string, change: (o: Order) => string | void): Promise<{ order: PublicOrder } | { error: string; notFound?: boolean }> {
  return enqueue(() => {
    const orders = readAll();
    const o = orders.find((x) => x.id === id);
    if (!o) return { error: "Order not found", notFound: true };
    const err = change(o);
    if (err) return { error: err };
    writeAll(orders);
    return { order: toPublic(o) };
  });
}

/** Move an order to a new status, record it in the history and add a mock SMS. */
export function setStatus(o: Order, status: OrderStatus, note?: string, at = simNow()) {
  if (o.status === status) return;
  o.status = status;
  o.statusHistory.push({ status, at, ...(note ? { note } : {}) });
  (o.notifications ??= []).push(notificationFor(o, status, at));
  console.log(`[order] ${o.id} -> ${status} (sms to ${maskMobile(o.mobile)})`);
}

// ---------- mock SMS text for each status ----------
const SMS: Record<OrderStatus, [string, string]> = {
  QUOTE_ACCEPTED: ["Accel Business: plan {id} confirmed. Next, verify your business: it takes about 3 minutes.", "Accel Business: प्लान {id} कन्फ़र्म। अगला कदम: अपने बिज़नेस का सत्यापन करें, लगभग 3 मिनट लगेंगे।"],
  KYC_ACTION_NEEDED: ["Accel Business: we need a small fix in your documents for {id}. Open your order to see what to re-upload.", "Accel Business: {id} के दस्तावेज़ों में एक छोटा सुधार चाहिए। क्या दोबारा अपलोड करना है, ऑर्डर में देखें।"],
  KYC_REJECTED: ["Accel Business: we could not verify the business for {id}. Our team will call you to help.", "Accel Business: {id} के लिए बिज़नेस का सत्यापन नहीं हो सका। हमारी टीम मदद के लिए कॉल करेगी।"],
  KYC_VERIFIED: ["Accel Business: business verified for {id}. We'll check your site next.", "Accel Business: {id} के लिए बिज़नेस सत्यापित। अगला कदम: साइट जाँच।"],
  SITE_CHECK: ["Accel Business: site check done for {id}. Your location is ready for installation.", "Accel Business: {id} की साइट जाँच पूरी। आपकी जगह इंस्टॉलेशन के लिए तैयार है।"],
  TECH_SCHEDULED: ["Accel Business: technician booked for {id}. They will call you before the visit.", "Accel Business: {id} के लिए टेक्नीशियन बुक। आने से पहले वे आपको कॉल करेंगे।"],
  INSTALLED: ["Accel Business: installation complete for {id}. We are switching your services on.", "Accel Business: {id} का इंस्टॉलेशन पूरा। आपकी सेवाएँ चालू की जा रही हैं।"],
  ACTIVE: ["Accel Business: all services for {id} are live. One bill, one support number: 1800-XXX-XXXX.", "Accel Business: {id} की सभी सेवाएँ चालू। एक बिल, एक सपोर्ट नंबर: 1800-XXX-XXXX।"],
};

function notificationFor(o: Order, status: OrderStatus, at: string): Notification {
  const [en, hi] = SMS[status];
  return { at, channel: "SMS", status, text_en: en.replace("{id}", o.id), text_hi: hi.replace("{id}", o.id) };
}
