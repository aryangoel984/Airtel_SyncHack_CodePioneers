"use client";
// Track an order from any phone: order number + the mobile number used for the order.
import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Icon from "@/components/ui/Icon";
import { MobileInput } from "@/components/ui/Sheet";
import { useLang } from "@/lib/LangContext";
import { ApiError, BackendDownError, api } from "@/lib/api";

export default function TrackPage() {
  const { t } = useLang();
  const router = useRouter();
  const [orderId, setOrderId] = useState("UD-2026-");
  const [mobile, setMobile] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const validMobile = /^[6-9]\d{9}$/.test(mobile);
  const validId = /^UD-\d{4}-\d{4}$/i.test(orderId.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!validMobile || !validId) return;
    setBusy(true); setError("");
    try {
      const r = await api.trackOrder(orderId.trim().toUpperCase(), mobile);
      router.push(`/order/${r.id}`);
    } catch (err) {
      setError(err instanceof BackendDownError ? t("server_down") : err instanceof ApiError && err.status === 429 ? t("rate_limited") : t("track_not_found"));
      setBusy(false);
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-12 pt-8 sm:px-6">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-white"><Icon name="clock" size={24} /></span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{t("track_title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("track_sub")}</p>

        <form onSubmit={submit} className="mt-6 space-y-4 rounded-3xl bg-white p-5 ring-1 ring-line sm:p-6">
          <label className="block">
            <span className="text-sm font-semibold text-ink">{t("order_id")}</span>
            <input value={orderId} onChange={(e) => setOrderId(e.target.value.toUpperCase())} spellCheck={false}
              className={`tabular mt-1.5 h-13 w-full rounded-2xl bg-surface-2 px-3 text-lg tracking-wide text-ink ring-1 outline-none focus:ring-2 ${touched && !validId ? "ring-brand" : "ring-line focus:ring-brand-ring"}`} />
            {touched && !validId && <span className="mt-1.5 block text-sm text-brand-dark">{t("track_bad_id")}</span>}
          </label>
          <MobileInput value={mobile} onChange={setMobile} label={t("mobile_label")} invalid={touched && !validMobile} invalidText={t("mobile_bad")} autoFocus={false} />
          {error && <p role="alert" className="flex items-start gap-2 rounded-2xl bg-brand-soft p-3 text-sm text-brand-dark"><Icon name="info" size={18} className="shrink-0" /> {error}</p>}
          <button type="submit" disabled={busy}
            className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-bold text-white hover:bg-brand-dark disabled:opacity-50">
            <Icon name="search" size={18} /> {busy ? "…" : t("track_btn")}
          </button>
        </form>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted"><Icon name="lock" size={13} /> {t("track_privacy")}</p>
      </main>
    </>
  );
}
