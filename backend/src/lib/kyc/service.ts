// Smart KYC flow on an order: consent -> documents -> checks -> e-sign.
// Document images are read in memory and thrown away. Only the results (with masked numbers) are kept.
import { Order, setStatus, simNow, updateOrder, getOrderPrivate } from "../orders";
import { maskMobile } from "../mask";
import { verifyKyc, VerifyInput } from "./checks";
import type { KycRecord, KycResult } from "./types";

export const CONSENT_VERSION = "2026-07-v1";
export const MAX_ATTEMPTS = 5;
const OTP_TTL_MS = 10 * 60_000;

/** What the browser may see: everything except the pending OTP code. */
export function publicKyc(k: KycRecord | undefined) {
  if (!k) return { attempts: 0 };
  const { pendingOtp, ...rest } = k;
  return { ...rest, otpPending: !!pendingOtp && pendingOtp.expires > Date.now() };
}

const canDoKyc = (o: Order) => ["QUOTE_ACCEPTED", "KYC_ACTION_NEEDED", "KYC_REJECTED"].includes(o.status);

export function recordConsent(orderId: string, language: "en" | "hi") {
  return updateOrder(orderId, (o) => {
    if (!canDoKyc(o) && o.status !== "KYC_VERIFIED") return "KYC is already complete for this order";
    o.kyc ??= { attempts: 0 };
    o.kyc.consent = { accepted: true, at: simNow(), version: CONSENT_VERSION, language };
  });
}

export function recordDigilocker(orderId: string) {
  return updateOrder(orderId, (o) => {
    if (!o.kyc?.consent) return "Please accept the consent first";
    o.kyc.digilocker = { at: simNow() };
  });
}

/** Run the checks, store the result on the order, and move the order's status. */
export async function runVerification(orderId: string, input: Omit<VerifyInput, "profile" | "items">):
  Promise<{ result: KycResult } | { error: string; status: number }> {
  const before = getOrderPrivate(orderId);
  if (!before) return { error: "Order not found", status: 404 };
  if (!before.kyc?.consent) return { error: "Please accept the consent first", status: 409 };
  if (!canDoKyc(before)) return { error: "KYC is already complete for this order", status: 409 };
  if ((before.kyc.attempts ?? 0) >= MAX_ATTEMPTS) return { error: "Too many attempts. Our team will call you to help.", status: 429 };

  // OCR is slow-ish, so it runs OUTSIDE the order-file queue; then we save the result.
  const result = await verifyKyc({ ...input, profile: before.profile, items: before.items });

  const saved = await updateOrder(orderId, (o) => {
    if (!canDoKyc(o)) return "KYC is already complete for this order";
    o.kyc ??= { attempts: 0 };
    o.kyc.attempts = (o.kyc.attempts ?? 0) + 1;
    o.kyc.result = result;
    delete o.kyc.pendingOtp;
    if (result.verdict === "ACTION_NEEDED") setStatus(o, "KYC_ACTION_NEEDED", "documents need a fix");
    if (result.verdict === "REJECTED") setStatus(o, "KYC_REJECTED", "could not verify online: needs a call");
    // VERIFIED: the status changes only after the e-sign.
  });
  if ("error" in saved) return { error: saved.error, status: saved.notFound ? 404 : 409 };
  return { result };
}

/** Demo OTP for the e-sign. A real launch would send it by SMS / Aadhaar e-sign; here we return it to show on screen. */
export async function startEsign(orderId: string) {
  let code = "";
  let sentTo = "";
  const r = await updateOrder(orderId, (o) => {
    if (o.kyc?.result?.verdict !== "VERIFIED") return "Documents must pass the checks before signing";
    if (!canDoKyc(o)) return "Already signed";
    code = String(Math.floor(100000 + Math.random() * 900000));
    o.kyc.pendingOtp = { code, expires: Date.now() + OTP_TTL_MS };
    sentTo = maskMobile(o.mobile);
  });
  if ("error" in r) return r;
  return { sentTo, demoOtp: code };
}

export function confirmEsign(orderId: string, name: string, otp: string) {
  return updateOrder(orderId, (o) => {
    const k = o.kyc;
    if (k?.result?.verdict !== "VERIFIED") return "Documents must pass the checks before signing";
    if (!canDoKyc(o)) return "Already signed";
    if (!k.pendingOtp || k.pendingOtp.expires < Date.now()) return "The code has expired. Please ask for a new one.";
    if (k.pendingOtp.code !== otp) return "Wrong code. Please check and try again.";
    k.esign = { at: simNow(), name: name.slice(0, 80), otpSentTo: maskMobile(o.mobile) };
    delete k.pendingOtp;
    setStatus(o, "KYC_VERIFIED", "documents checked and agreement e-signed");
  });
}
