// Shared logic for the mocked government lookups (used by API routes and tests).
import { loadGstinRegistry, loadUdyamRegistry, GstinRecord, UdyamRecord } from "./data";
import { validateGstin, validateUdyam } from "./validators";

export function lookupGstin(raw: string) {
  const gstin = raw.trim().toUpperCase();
  const check = validateGstin(gstin);
  if (!check.valid) {
    return { gstin, valid: false, found: false, error: check.reason, message: check.message, eligible: false } as const;
  }
  const record: GstinRecord | undefined = loadGstinRegistry().get(gstin);
  if (!record) {
    return { gstin, valid: true, found: false, eligible: false, message: "GSTIN format is valid but it is not in the registry." } as const;
  }
  const active = record.status === "Active";
  return {
    gstin,
    valid: true,
    found: true,
    record,
    eligible: active,
    message: active ? "GSTIN is active." : `Not eligible: GSTIN status is ${record.status}.`,
  } as const;
}

export function lookupUdyam(raw: string) {
  const udyam = raw.trim().toUpperCase();
  const check = validateUdyam(udyam);
  if (!check.valid) return { udyam, valid: false, found: false, message: check.message } as const;
  const record: UdyamRecord | undefined = loadUdyamRegistry().get(udyam);
  return record
    ? ({ udyam, valid: true, found: true, record, message: "Udyam registration found." } as const)
    : ({ udyam, valid: true, found: false, message: "Format is valid but not found in the registry." } as const);
}
