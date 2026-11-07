"use client";
// "Talk to a person": the mobile number goes straight to our server, never through the AI.
import { useState } from "react";
import { useLang } from "@/lib/LangContext";
import { api } from "@/lib/api";
import ErrorBox from "@/components/ErrorBox";

export default function PersonDialog({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { t } = useLang();
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [touched, setTouched] = useState(false);
  const valid = /^[6-9]\d{9}$/.test(mobile);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    setBusy(true); setError(null);
    try { await api.advisorCallback(sessionId, mobile); setDone(true); } catch (err) { setError(err); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <h2 className="text-lg font-bold">{t("adv_person_title")}</h2>
        {done ? (
          <>
            <p className="text-sm text-gray-700">{t("adv_person_done")}</p>
            <button type="button" onClick={onClose} className="min-h-12 w-full rounded-xl bg-brand font-semibold text-white">OK</button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">{t("adv_person_body")}</p>
            <label className="block text-sm font-medium">
              {t("mobile_label")}
              <input inputMode="numeric" maxLength={10} autoFocus value={mobile} placeholder="98XXXXXXXX"
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                className="mt-1 block min-h-12 w-full rounded-lg border border-gray-300 px-3 text-lg tracking-wider" />
            </label>
            {touched && !valid && <p className="text-sm text-brand-dark">{t("mobile_bad")}</p>}
            {error ? <ErrorBox error={error} /> : null}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-xl border border-gray-300 font-medium">{t("cancel")}</button>
              <button type="submit" disabled={busy} className="min-h-12 flex-[2] rounded-xl bg-brand font-semibold text-white disabled:opacity-60">
                {busy ? t("placing") : t("place_order")}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
