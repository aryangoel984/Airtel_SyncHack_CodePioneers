"use client";
// One product line: name, why, price, and either a toggle (add-ons / more) or a stepper.
import { useLang } from "@/lib/LangContext";
import { nameOf, rupees, unitLabel, whyOf } from "@/lib/i18n";
import type { ProductCopy } from "@/lib/types";

export interface RowProps {
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

  return (
    <div className={`border-t border-gray-100 py-4 first:border-t-0 ${p.mode === "plan" && !p.selected ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{nameOf(p.copy, lang)}</p>
          <p className="mt-0.5 text-sm text-gray-600">{whyOf(p.copy, lang)}</p>
          <p className="mt-1 text-xs text-gray-500">
            {rupees(p.unitPrice)} {unitLabel(lang, p.unit)}
          </p>
          {p.note && <p className="mt-2 rounded-lg bg-brand-soft px-2 py-1 text-xs text-brand-dark">{p.note}</p>}
        </div>

        <div className="shrink-0 text-right">
          {p.mode === "toggle" && !p.selected ? (
            <p className="text-sm font-semibold">{t("plus_month", { n: monthly.toLocaleString("en-IN") })}</p>
          ) : (
            <p className="text-sm font-semibold">
              {rupees(monthly)}
              <span className="text-xs font-normal text-gray-500">{t("per_month")}</span>
            </p>
          )}
          {p.mode === "toggle" && !p.locked && (
            <button
              role="switch"
              aria-checked={p.selected}
              aria-label={nameOf(p.copy, lang)}
              onClick={p.onToggle}
              className="-mr-2 mt-1 grid min-h-11 min-w-11 place-items-center"
            >
              <span className={`relative h-7 w-12 rounded-full transition-colors ${p.selected ? "bg-brand" : "bg-gray-300"}`}>
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${p.selected ? "left-[22px]" : "left-0.5"}`} />
              </span>
            </button>
          )}
        </div>
      </div>

      {/* quantity stepper (when the item is in the plan) */}
      {p.selected && !p.locked && (
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button aria-label={t("dec")} disabled={p.quantity <= 1}
              onClick={() => p.onQty?.(p.quantity - 1)}
              className="grid h-11 w-11 place-items-center rounded-lg border border-gray-300 text-xl disabled:opacity-30">−</button>
            <span className="min-w-10 text-center font-semibold" aria-label={t("qty")}>{p.quantity}</span>
            <button aria-label={t("inc")} disabled={p.quantity >= 99}
              onClick={() => p.onQty?.(p.quantity + 1)}
              className="grid h-11 w-11 place-items-center rounded-lg border border-gray-300 text-xl disabled:opacity-30">+</button>
          </div>
          {p.mode === "plan" && (
            <button onClick={p.onToggle} className="min-h-11 px-2 text-sm text-gray-500 underline">{t("remove")}</button>
          )}
        </div>
      )}
      {p.mode === "plan" && !p.selected && !p.locked && (
        <button onClick={p.onToggle} className="mt-1 min-h-11 text-sm font-medium text-brand underline">{t("add_back")}</button>
      )}
    </div>
  );
}
