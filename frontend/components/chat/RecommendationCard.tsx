"use client";
// The plan card inside the chat. Built from STRUCTURED data from the backend, never from the AI's text.
import { useLang } from "@/lib/LangContext";
import { formatDate, nameOf, rupees, unitLabel } from "@/lib/i18n";
import type { Recommendation } from "@/lib/types";
import Icon, { ProductIcon } from "@/components/ui/Icon";

export default function RecommendationCard({ rec, onBuy }: { rec: Recommendation; onBuy: () => void }) {
  const { lang, t } = useLang();
  const q = rec.quote;

  return (
    <section className="mt-2 animate-pop overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-lift)] ring-1 ring-line" aria-label={t("card_title")}>
      {/* Header band */}
      <div className="bg-gradient-to-br from-ink to-[#2b2f38] px-5 pb-4 pt-4 text-white">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/70">
          <Icon name="sparkle" size={13} /> {t("card_title")}
        </p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="tabular text-[32px] font-extrabold leading-none">
            {rupees(q.monthly_total_inr)}<span className="ml-1 text-sm font-medium text-white/70">{t("per_month")}</span>
          </p>
          <p className="pb-1 text-right text-[11px] text-white/70">{t("gst_note")}</p>
        </div>
        {rec.based_on && !rec.minimal && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-white/80">
            <Icon name="users" size={14} className="shrink-0" /> {lang === "hi" ? rec.based_on.line_hi : rec.based_on.line_en}
          </p>
        )}
      </div>

      {/* Key facts */}
      <div className="grid grid-cols-3 divide-x divide-line border-b border-line text-center">
        {[
          [t("card_setup"), q.one_time_setup_total_inr ? rupees(q.one_time_setup_total_inr) : t("free")],
          [t("card_contract"), t("months_n", { n: q.contract_months })],
          [t("card_ready"), formatDate(q.expected_activation_date, lang)],
        ].map(([k, v]) => (
          <div key={k} className="px-2 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{k}</p>
            <p className="tabular mt-0.5 text-[13px] font-bold text-ink">{v}</p>
          </div>
        ))}
      </div>

      <div className="px-4 pb-4 pt-2 sm:px-5">
        <ul>
          {rec.items.map((i) => (
            <li key={i.product_id} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
              <ProductIcon productId={i.product_id} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug text-ink">{nameOf(i.copy, lang)}</p>
                <p className="tabular text-xs text-muted">
                  {t("card_unit_each", { n: i.quantity, price: rupees(i.unit_price_inr) })} {unitLabel(lang, i.unit)}
                </p>
              </div>
              <p className="tabular shrink-0 text-sm font-bold text-ink">{rupees(i.monthly_inr)}</p>
            </li>
          ))}
        </ul>

        {q.fixes.map((f) => (
          <p key={f.added_product_id} className="mt-1 flex items-start gap-2 rounded-2xl bg-info-soft px-3 py-2 text-xs text-info">
            <Icon name="info" size={15} className="mt-px shrink-0" />
            {t("card_auto", { added: nameOf(f.added_copy, lang), for: nameOf(f.for_copy, lang) })}
          </p>
        ))}

        {rec.budget.requested !== null && rec.budget.within === false && (
          <p className="mt-2 flex items-start gap-2 rounded-2xl bg-warn-soft px-3 py-2 text-xs text-warn">
            <Icon name="info" size={15} className="mt-px shrink-0" />
            {t("card_over_budget", { price: rupees(rec.budget.cheapest_possible_inr ?? q.monthly_total_inr) })}
          </p>
        )}
        {rec.dropped_for_budget.length > 0 && (
          <p className="mt-2 text-xs text-muted">{t("card_dropped", { names: rec.dropped_for_budget.map((d) => nameOf(d.copy, lang)).join(", ") })}</p>
        )}
        {rec.indicative && (
          <p className="mt-2 flex items-start gap-2 rounded-2xl bg-info-soft px-3 py-2 text-xs text-info">
            <Icon name="headset" size={15} className="mt-px shrink-0" /> {t("card_indicative")}
          </p>
        )}

        {rec.blocked_wishes.length > 0 && (
          <div className="mt-3 rounded-2xl bg-surface-2 p-3 ring-1 ring-line">
            <p className="flex items-center gap-1.5 text-xs font-bold text-ink-2"><Icon name="lock" size={14} /> {t("card_blocked")}</p>
            {rec.blocked_wishes.map((b) => (
              <div key={b.product_id} className="mt-2">
                <p className="text-sm font-semibold text-ink-2">{nameOf(b.copy, lang)}</p>
                <p className="text-xs text-muted">{lang === "hi" ? b.reason_hi : b.reason_en}</p>
                {b.alternative && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-ok">
                    <Icon name="arrowRight" size={13} />
                    {b.alternative.in_plan
                      ? t("card_alt_in_plan", { name: nameOf(b.alternative.copy, lang) })
                      : t("card_alt", { name: nameOf(b.alternative.copy, lang), price: rupees(b.alternative.unit_price_inr) })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {rec.suggested_addons.length > 0 && !rec.minimal && (
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t("card_extras")}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {rec.suggested_addons.map((a) => (
                <span key={a.product_id} className="tabular rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-2 ring-1 ring-line">
                  {nameOf(a.copy, lang)} <span className="text-muted">+{rupees(a.monthly_inr)}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <button onClick={onBuy}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-bold text-white transition-colors hover:bg-brand-dark">
          {t("card_buy")} <Icon name="arrowRight" size={18} />
        </button>
      </div>
    </section>
  );
}
