// Order storage: one JSON file (simple, no database yet). Writes go through a queue
// so two orders arriving together can't overwrite each other.
import fs from "fs";
import path from "path";
import { BusinessProfile, BundleItem } from "./rules";
import { Quote, buildQuote } from "./quote";
import { TODAY } from "./validators";
import { maskMobile } from "./mask";

export type OrderStatus = "QUOTE_ACCEPTED"; // more statuses arrive with the Tracker (Step 5)

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
function simNow(): string {
  const real = new Date();
  const d = new Date(TODAY);
  d.setUTCHours(real.getUTCHours(), real.getUTCMinutes(), real.getUTCSeconds(), 0);
  return d.toISOString();
}

export const toPublic = ({ mobile, ...rest }: Order): PublicOrder => ({ ...rest, mobile_masked: maskMobile(mobile) });

// Simple queue: each create waits for the previous one to finish.
let queue: Promise<unknown> = Promise.resolve();

export function createOrder(input: {
  profile: BusinessProfile;
  items: BundleItem[];
  language: "en" | "hi";
  mobile: string;
}): Promise<{ order: PublicOrder; blocked: Quote["blocked"] } | { error: string }> {
  const job = queue.then(() => {
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
    };
    orders.push(order);
    writeAll(orders);
    console.log(`[order] created ${order.id} mobile=${maskMobile(order.mobile)}`);
    return { order: toPublic(order), blocked: quote.blocked };
  });
  queue = job.catch(() => undefined);
  return job;
}

export function getOrder(id: string): PublicOrder | undefined {
  const o = readAll().find((x) => x.id === id);
  return o ? toPublic(o) : undefined;
}
