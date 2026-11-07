"use client";
// Asks for the mobile number (the only personal detail collected at this step), then places the order.
import { useState } from "react";
import { useLang } from "@/lib/LangContext";
import Sheet, { MobileInput } from "@/components/ui/Sheet";
import Icon from "@/components/ui/Icon";

export default function ConfirmDialog({
  busy, error, onCancel, onSubmit, summary,
}: {
  busy: boolean;
  error: React.ReactNode;
  onCancel: () => void;
  onSubmit: (mobile: string) => void;
  /** e.g. "₹1,597/month · Ready by 20 Jul 2026" */
  summary?: string;
}) {
  const { t } = useLang();
  const [mobile, setMobile] = useState("");
  const [touched, setTouched] = useState(false);
  const valid = /^[6-9]\d{9}$/.test(mobile);

  return (
    <Sheet icon="phone" title={t("mobile_title")} onClose={onCancel}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setTouched(true); if (valid) onSubmit(mobile); }}>
        {summary && (
          <p className="tabular flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2.5 text-sm font-semibold text-ink ring-1 ring-line">
            <Icon name="receipt" size={17} className="text-muted" /> {summary}
          </p>
        )}
        <p className="text-sm text-ink-2">{t("mobile_why")}</p>
        <MobileInput value={mobile} onChange={setMobile} label={t("mobile_label")} invalid={touched && !valid} invalidText={t("mobile_bad")} />
        {error}
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="min-h-12 flex-1 rounded-2xl font-semibold text-ink-2 ring-1 ring-line hover:bg-surface-2">{t("cancel")}</button>
          <button type="submit" disabled={busy} className="min-h-12 flex-[2] rounded-2xl bg-brand font-bold text-white hover:bg-brand-dark disabled:opacity-60">
            {busy ? t("placing") : t("place_order")}
          </button>
        </div>
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted"><Icon name="lock" size={12} /> {t("mobile_privacy")}</p>
      </form>
    </Sheet>
  );
}
