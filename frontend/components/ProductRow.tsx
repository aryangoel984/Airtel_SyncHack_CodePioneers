"use client";
// One product line: icon, name, why, price, and either a switch (add-ons / more) or a quantity stepper.
import { useLang } from "@/lib/LangContext";
import { nameOf, rupees, unitLabel, whyOf } from "@/lib/i18n";
import type { ProductCopy } from "@/lib/types";
import Icon, { ProductIcon } from "@/components/ui/Icon";

export interface RowProps {
  /** internal id, used only to pick the icon; never displayed */
  productId: string;
  copy: ProductCopy;
  unit: string;
  unitPrice: number;
  quantity: number;
  selected: boolean;
  /** "plan" rows can be removed; "toggle" rows show a switch and "+₹X/month" */
  mode: "plan" | "toggle";
  /** Extra note under the text, e.g. "We added Shop Internet because CCTV needs internet" */
  note?: string;
  /** Read-only row (auto-added dependency): no controls */
  locked?: boolean;
  onToggle?: () => void;
  onQty?: (q: number) => void;
}

export default function ProductRow(p: RowProps) {
  const { lang, t } = useLang();
  const monthly = p.unitPrice * p.quantity;
  const removed = p.mode === "plan" && !p.selected;
  const stepBtn = "grid h-9 w-9 place-items-center rounded-full text-ink transition-colors hover:bg-white disabled:opacity-30";

  return (
    <div className={`border-t border-line py-4 first:border-t-0 ${removed ? "opacity-55" : ""}`}>
      <div className="flex items-start gap-3">
        <ProductIcon productId={p.productId} muted={removed || (p.mode === "toggle" && !p.selected)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="pt-0.5 font-semibold leading-snug text-ink">{nameOf(p.copy, lang)}</p>
            {p.mode === "toggle" && !p.locked ? (
              <button role="switch" aria-checked={p.selected} aria-label={nameOf(p.copy, lang)} onClick={p.onToggle}
                className="-my-1 grid min-h-11 min-w-11 shrink-0 place-items-center">
                <span className={`relative h-7 w-12 rounded-full transition-colors ${p.selected ? "bg-brand" : "bg-line"}`}>
                  <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${p.selected ? "left-[22px]" : "left-0.5"}`} />
                </span>
              </button>
            ) : (
              <p className="tabular shrink-0 pt-0.5 text-[15px] font-bold text-ink">
                {rupees(monthly)}<span className="text-xs font-medium text-muted">{t("per_month")}</span>
              </p>
            )}
          </div>
          <p className="mt-0.5 text-sm leading-snug text-muted">{whyOf(p.copy, lang)}</p>
          {p.note && (
            <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-info-soft px-2.5 py-1.5 text-xs text-info">
              <Icon name="info" size={14} className="mt-px shrink-0" /> {p.note}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
            <p className="tabular text-xs font-medium text-muted">
              {rupees(p.unitPrice)} {unitLabel(lang, p.unit)}
              {p.mode === "toggle" && !p.selected && (
                <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 font-semibold text-ink-2 ring-1 ring-line">
                  {t("plus_month", { n: monthly.toLocaleString("en-IN") })}
                </span>
              )}
              {p.mode === "toggle" && p.selected && (
                <span className="ml-2 font-bold text-ink">= {rupees(monthly)}{t("per_month")}</span>
              )}
              {p.locked && <span className="ml-2 rounded-full bg-info-soft px-2 py-0.5 font-semibold text-info">{t("auto_added")}</span>}
            </p>

            {p.selected && !p.locked && (
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-full bg-surface-2 p-0.5 ring-1 ring-line" aria-label={t("qty")}>
                  <button aria-label={t("dec")} disabled={p.quantity <= 1} onClick={() => p.onQty?.(p.quantity - 1)} className={stepBtn}>
                    <Icon name="minus" size={16} strokeWidth={2.4} />
                  </button>
                  <span className="tabular min-w-8 text-center text-sm font-bold text-ink">{p.quantity}</span>
                  <button aria-label={t("inc")} disabled={p.quantity >= 99} onClick={() => p.onQty?.(p.quantity + 1)} className={stepBtn}>
                    <Icon name="plus" size={16} strokeWidth={2.4} />
                  </button>
                </div>
                {p.mode === "plan" && (
                  <button onClick={p.onToggle} aria-label={`${t("remove")}: ${nameOf(p.copy, lang)}`}
                    className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-brand-soft hover:text-brand" title={t("remove")}>
                    <Icon name="x" size={17} />
                  </button>
                )}
              </div>
            )}
            {removed && !p.locked && (
              <button onClick={p.onToggle} className="flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-brand ring-1 ring-brand-ring hover:bg-brand-soft">
                <Icon name="plus" size={15} strokeWidth={2.4} /> {t("add_back")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
