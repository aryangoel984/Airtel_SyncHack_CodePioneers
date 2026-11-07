"use client";
// Asks for the mobile number (the only personal detail collected at this step), then places the order.
import { useState } from "react";
import { useLang } from "@/lib/LangContext";

export default function ConfirmDialog({
  busy, error, onCancel, onSubmit,
}: {
  busy: boolean;
  error: React.ReactNode;
  onCancel: () => void;
  onSubmit: (mobile: string) => void;
}) {
  const { t } = useLang();
  const [mobile, setMobile] = useState("");
  const [touched, setTouched] = useState(false);
  const valid = /^[6-9]\d{9}$/.test(mobile);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true">
      <form
        className="w-full max-w-md space-y-3 rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        onSubmit={(e) => { e.preventDefault(); setTouched(true); if (valid) onSubmit(mobile); }}
      >
        <h2 className="text-lg font-bold">{t("mobile_title")}</h2>
        <p className="text-sm text-gray-600">{t("mobile_why")}</p>
        <label className="block text-sm font-medium">
          {t("mobile_label")}
          <input
            inputMode="numeric" autoComplete="tel-national" maxLength={10} autoFocus
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
            className="mt-1 block min-h-12 w-full rounded-lg border border-gray-300 px-3 text-lg tracking-wider"
            placeholder="98XXXXXXXX"
          />
        </label>
        {touched && !valid && <p className="text-sm text-brand-dark">{t("mobile_bad")}</p>}
        {error}
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="min-h-12 flex-1 rounded-xl border border-gray-300 font-medium">{t("cancel")}</button>
          <button type="submit" disabled={busy} className="min-h-12 flex-[2] rounded-xl bg-brand font-semibold text-white disabled:opacity-60">
            {busy ? t("placing") : t("place_order")}
          </button>
        </div>
      </form>
    </div>
  );
}
