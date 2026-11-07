"use client";
// Order confirmation: shows what was ordered. (Verification and tracking come in Steps 4 and 5.)
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Header from "@/components/Header";
import ErrorBox from "@/components/ErrorBox";
import { useLang } from "@/lib/LangContext";
import { ApiError, api } from "@/lib/api";
import { formatDate, nameOf, rupees, unitLabel, whyOf } from "@/lib/i18n";
import type { Order } from "@/lib/types";

export default function OrderView() {
  const { id } = useParams<{ id: string }>();
  const { lang, t } = useLang();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setError(null);
    try { setOrder(await api.getOrder(id)); } catch (e) { setError(e); }
  }, [id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch the order when the page opens
  useEffect(() => { load(); }, [load]);

  const wrap = (children: React.ReactNode) => (
    <>
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-6">{children}</main>
    </>
  );

  if (error instanceof ApiError && error.status === 404) {
    return wrap(
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <p className="mb-4">{t("order_not_found")}</p>
        <Link href="/" className="inline-flex min-h-12 items-center rounded-xl bg-brand px-5 font-semibold text-white">{t("back_home")}</Link>
      </div>,
    );
  }
  if (error) return wrap(<ErrorBox error={error} onRetry={load} />);
  if (!order) return wrap(<p className="py-10 text-center text-gray-600" aria-busy="true">{t("loading_plan")}</p>);

  const q = order.quote;
  return wrap(
    <>
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">{t("order_title")}</h1>
        <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-gray-500">{t("order_id")}</dt>
          <dd className="text-right font-semibold">{order.id}</dd>
          <dt className="text-gray-500">{t("status")}</dt>
          <dd className="text-right">
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
              {t("status_" + order.status)}
            </span>
          </dd>
        </dl>
        <p className="mt-3 text-xs text-gray-500">{t("order_mobile", { m: order.mobile_masked })}</p>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        {q.lines.map((l) => (
          <div key={l.product_id} className="flex justify-between gap-3 border-t border-gray-100 py-3 first:border-t-0">
            <div>
              <p className="font-medium">{nameOf(l.copy, lang)}</p>
              <p className="text-sm text-gray-600">{whyOf(l.copy, lang)}</p>
              <p className="text-xs text-gray-500">{l.quantity} × {rupees(l.unit_price_inr)} {unitLabel(lang, l.unit)}</p>
            </div>
            <p className="shrink-0 font-semibold">{rupees(l.monthly_inr)}</p>
          </div>
        ))}
        <div className="mt-2 space-y-1 border-t border-gray-200 pt-3 text-sm">
          <p className="flex justify-between text-lg font-bold">
            <span>{t("total_monthly")}</span><span>{rupees(q.monthly_total_inr)}{t("per_month")}</span>
          </p>
          <p className="flex justify-between"><span>{t("setup_fee")}</span><span>{rupees(q.one_time_setup_total_inr)}</span></p>
          <p className="flex justify-between"><span>{t("contract", { n: q.contract_months })}</span><span>{t("ready_by", { date: formatDate(q.expected_activation_date, lang) })}</span></p>
          <p className="text-xs text-gray-500">{t("gst_note")}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-brand p-4 text-center text-sm font-medium text-brand-dark">
        {t("order_next")}
      </section>
    </>,
  );
}
