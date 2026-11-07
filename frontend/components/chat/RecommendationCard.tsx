"use client";
// The plan card inside the chat. Built from STRUCTURED data from the backend, never from the AI's text.
import { useLang } from "@/lib/LangContext";
import { formatDate, nameOf, rupees, unitLabel, whyOf } from "@/lib/i18n";
import type { Recommendation } from "@/lib/types";

export default function RecommendationCard({ rec, onBuy }: { rec: Recommendation; onBuy: () => void }) {
  const { lang, t } = useLang();
  const q = rec.quote;

  return (
    <section className="mt-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm" aria-label={t("card_title")}>
      <h3 className="text-base font-bold">{t("card_title")}</h3>
      {rec.based_on && !rec.minimal && (
        <p className="text-xs text-gray-500">{lang === "hi" ? rec.based_on.line_hi : rec.based_on.line_en}</p>
      )}

      <ul className="mt-2">
        {rec.items.map((i) => (
          <li key={i.product_id} className="border-t border-gray-100 py-2 first:border-t-0">
            <div className="flex justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold leading-snug">{nameOf(i.copy, lang)}</p>
                <p className="text-xs text-gray-600">{whyOf(i.copy, lang)}</p>
                <p className="text-xs text-gray-500">
                  {t("card_unit_each", { n: i.quantity, price: rupees(i.unit_price_inr) })} {unitLabel(lang, i.unit)}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold">{rupees(i.monthly_inr)}</p>
            </div>
          </li>
        ))}
      </ul>

      {q.fixes.map((f) => (
        <p key={f.added_product_id} className="mt-1 rounded-lg bg-brand-soft px-2 py-1 text-xs text-brand-dark">
          {t("card_auto", { added: nameOf(f.added_copy, lang), for: nameOf(f.for_copy, lang) })}
        </p>
      ))}

      <div className="mt-3 border-t border-gray-200 pt-3">
        <p className="flex items-end justify-between">
          <span className="text-sm text-gray-600">{t("total_monthly")}</span>
          <span className="text-2xl font-bold">{rupees(q.monthly_total_inr)}<span className="text-xs font-normal text-gray-500">{t("per_month")}</span></span>
        </p>
        <p className="mt-1 flex justify-between text-xs text-gray-700"><span>{t("setup_fee")}</span><span>{rupees(q.one_time_setup_total_inr)}</span></p>
        <p className="flex justify-between text-xs text-gray-700"><span>{t("contract", { n: q.contract_months })}</span><span>{t("ready_by", { date: formatDate(q.expected_activation_date, lang) })}</span></p>
        <p className="mt-1 text-xs text-gray-500">{t("gst_note")}</p>
      </div>

      {rec.budget.requested !== null && rec.budget.within === false && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">
          {t("card_over_budget", { price: rupees(rec.budget.cheapest_possible_inr ?? q.monthly_total_inr) })}
        </p>
      )}
      {rec.dropped_for_budget.length > 0 && (
        <p className="mt-2 text-xs text-gray-600">{t("card_dropped", { names: rec.dropped_for_budget.map((d) => nameOf(d.copy, lang)).join(", ") })}</p>
      )}
      {rec.indicative && <p className="mt-2 rounded-lg bg-blue-50 px-2 py-1 text-xs text-blue-900">{t("card_indicative")}</p>}

      {rec.blocked_wishes.length > 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-gray-300 p-3">
          <p className="text-xs font-bold text-gray-500">{t("card_blocked")}</p>
          {rec.blocked_wishes.map((b) => (
            <div key={b.product_id} className="mt-1 text-gray-500">
              <p className="text-sm font-medium">{nameOf(b.copy, lang)}</p>
              <p className="text-xs">{lang === "hi" ? b.reason_hi : b.reason_en}</p>
              {b.alternative && (
                <p className="text-xs text-gray-700">
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
        <p className="mt-3 text-xs text-gray-600">
          <b>{t("card_extras")}:</b> {rec.suggested_addons.map((a) => `${nameOf(a.copy, lang)} (+${rupees(a.monthly_inr)})`).join(", ")}
        </p>
      )}

      <button onClick={onBuy} className="mt-3 min-h-12 w-full rounded-xl bg-brand text-base font-semibold text-white active:bg-brand-dark">
        {t("card_buy")}
      </button>
    </section>
  );
}
