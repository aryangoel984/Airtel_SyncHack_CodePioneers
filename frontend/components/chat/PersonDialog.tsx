"use client";
// "Talk to a person": the mobile number goes straight to our server, never through the AI.
import { useState } from "react";
import { useLang } from "@/lib/LangContext";
import { api } from "@/lib/api";
import ErrorBox from "@/components/ErrorBox";
import Sheet, { MobileInput } from "@/components/ui/Sheet";
import Icon from "@/components/ui/Icon";

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
    <Sheet icon="headset" title={t("adv_person_title")} onClose={onClose}>
      {done ? (
        <div className="text-center">
          <span className="mx-auto mt-2 grid h-14 w-14 place-items-center rounded-full bg-ok-soft text-ok"><Icon name="check" size={28} strokeWidth={2.6} /></span>
          <p className="mt-3 text-sm text-ink-2">{t("adv_person_done")}</p>
          <button type="button" onClick={onClose} className="mt-5 min-h-12 w-full rounded-2xl bg-ink font-bold text-white">{t("ok")}</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm leading-relaxed text-ink-2">{t("adv_person_body")}</p>
          <MobileInput value={mobile} onChange={setMobile} label={t("mobile_label")} invalid={touched && !valid} invalidText={t("mobile_bad")} />
          {error ? <ErrorBox error={error} /> : null}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-2xl font-semibold text-ink-2 ring-1 ring-line hover:bg-surface-2">{t("cancel")}</button>
            <button type="submit" disabled={busy} className="min-h-12 flex-[2] rounded-2xl bg-brand font-bold text-white hover:bg-brand-dark disabled:opacity-60">
              {busy ? t("placing") : t("adv_person_cta")}
            </button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
