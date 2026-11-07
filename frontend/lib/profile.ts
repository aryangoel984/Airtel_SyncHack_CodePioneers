// The business profile lives in the browser's session storage, so /quote survives a refresh.
import type { BusinessProfile } from "./types";

const KEY = "udyam_profile";

export function saveProfile(p: BusinessProfile) {
  try { sessionStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ }
}

export function loadProfile(): BusinessProfile | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BusinessProfile) : null;
  } catch {
    return null;
  }
}
