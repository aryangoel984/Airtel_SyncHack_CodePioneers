"use client";
// Order page = the live tracker (Step 5): where the order is, what happens next, and the messages sent.
// The timeline comes from the backend (order.tracker); this page only displays it.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Header from "@/components/Header";
import ErrorBox from "@/components/ErrorBox";
import JourneySteps from "@/components/ui/JourneySteps";
import Icon, { ProductIcon, type IconName } from "@/components/ui/Icon";
import { useLang } from "@/lib/LangContext";
import { ApiError, api } from "@/lib/api";
import { formatDate, nameOf, rupees, unitLabel } from "@/lib/i18n";
import type { Order, StageView } from "@/lib/types";

const STAGE: Record<StageView["key"], { icon: IconName; title: string; sub: string }> = {
  QUOTE_ACCEPTED: { icon: "receipt", title: "tl_quote", sub: "tl_quote_sub" },
  KYC_VERIFIED: { icon: "shield", title: "tl_verify", sub: "tl_verify_sub" },
  SITE_CHECK: { icon: "pin", title: "tl_site", sub: "tl_site_sub" },
  TECH_SCHEDULED: { icon: "calendar", title: "tl_tech", sub: "tl_tech_sub" },
  INSTALLED: { icon: "router", title: "tl_install", sub: "tl_install_sub" },
  ACTIVE: { icon: "bolt", title: "tl_active", sub: "tl_active_sub" },
};

export default function OrderView() {
  const { id } = useParams<{ id: string }>();
  const { lang, t } = useLang();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [copied, setCopied] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try { setOrder(await api.getOrder(id)); } catch (e) { setError(e); }
  }, [id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch the order when the page opens
  useEffect(() => { load(); }, [load]);

  const verifiedOrLater = order && ["KYC_VERIFIED", "SITE_CHECK", "TECH_SCHEDULED", "INSTALLED", "ACTIVE"].includes(order.status);
  const wrap = (children: React.ReactNode) => (
    <>
      <Header />
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6"><JourneySteps current={verifiedOrLater ? 3 : 2} compact /></div>
      </div>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-6 sm:px-6 lg:pt-10">{children}</main>
    </>
  );

  if (error instanceof ApiError && error.status === 404) {
    return wrap(
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center ring-1 ring-line">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-muted"><Icon name="receipt" size={26} /></span>
        <p className="mt-4 font-semibold text-ink">{t("order_not_found")}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/track" className="inline-flex min-h-12 items-center rounded-2xl px-5 font-bold text-ink ring-1 ring-line">{t("track_title")}</Link>
          <Link href="/" className="inline-flex min-h-12 items-center rounded-2xl bg-brand px-5 font-bold text-white">{t("back_home")}</Link>
        </div>
      </div>,
    );
  }
  if (error) return wrap(<div className="mx-auto max-w-md"><ErrorBox error={error} onRetry={load} /></div>);
  if (!order) {
    return wrap(
      <div className="mx-auto max-w-3xl animate-pulse space-y-4" aria-busy="true">
        <div className="h-40 rounded-3xl bg-white ring-1 ring-line" /><div className="h-64 rounded-3xl bg-white ring-1 ring-line" />
      </div>,
    );
  }

  const q = order.quote;
  const tr = order.tracker;
  const live = order.status === "ACTIVE";
  const fresh = order.status === "QUOTE_ACCEPTED";
  const needsKyc = ["QUOTE_ACCEPTED", "KYC_ACTION_NEEDED"].includes(order.status);
  const dt = (iso: string) => new Date(iso).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

  async function copyId() {
    try { await navigator.clipboard.writeText(order!.id); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  }
  async function advance() {
    setAdvancing(true);
    try { setOrder(await api.advanceOrder(order!.id)); } catch (e) { setError(e); }
    setAdvancing(false);
  }

  const heroCls = live || fresh ? "from-ok to-[#0b6e3c]" : order.status === "KYC_REJECTED" ? "from-brand to-brand-dark"
    : order.status === "KYC_ACTION_NEEDED" ? "from-[#c27400] to-[#9a5b00]" : "from-ink to-[#2b2f38]";
  const heroTitle = live ? t("hero_live") : fresh ? t("order_title") : t("hero_" + order.status);
  const sms = [...(order.notifications ?? [])].reverse();

  return wrap(
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1.1fr_1fr] lg:items-start">
      <div className="space-y-5">
        {/* Status hero */}
        <section className="animate-pop overflow-hidden rounded-3xl bg-white ring-1 ring-line">
          <div className={`bg-gradient-to-br ${heroCls} px-6 pb-6 pt-7 text-white`}>
            <span className="grid h-14 w-14 place-items-center rounded-full bg-white/15 ring-4 ring-white/10">
              <Icon name={live || fresh ? "check" : order.status === "KYC_REJECTED" ? "cross" : order.status === "KYC_ACTION_NEEDED" ? "alert" : "clock"} size={28} strokeWidth={live || fresh ? 2.8 : 2} />
            </span>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">{heroTitle}</h1>
            <p className="mt-1 text-sm text-white/85">
              {live ? t("hero_live_sub")
                : order.status === "KYC_REJECTED" ? t("kyc_call_done", { m: order.mobile_masked })
                : order.status === "KYC_ACTION_NEEDED" ? t("hero_fix_sub", { date: formatDate(tr.expected_live, lang) })
                : t("hero_eta", { date: formatDate(tr.expected_live, lang) })}
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20" aria-label={t("j_label")}>
              <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${Math.max(6, tr.progress * 100)}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t("order_id")}</p>
              <p className="tabular text-lg font-extrabold tracking-wide text-ink">{order.id}</p>
            </div>
            <button onClick={copyId} className="flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-ink-2 ring-1 ring-line hover:bg-surface-2">
              <Icon name={copied ? "check" : "copy"} size={14} /> {copied ? t("copied") : t("copy")}
            </button>
          </div>
        </section>

        {/* Timeline */}
        <section className="rounded-3xl bg-white p-6 ring-1 ring-line" aria-labelledby="next-h">
          <h2 id="next-h" className="font-bold text-ink">{t("tl_heading")}</h2>
          <ol className="mt-4">
            {tr.stages.map((s, i) => {
              const m = STAGE[s.key];
              const color = s.state === "done" ? "bg-ok text-white"
                : s.state === "current" ? "bg-brand text-white ring-4 ring-brand-ring"
                : s.state === "attention" ? "bg-warn text-white ring-4 ring-warn-soft"
                : s.state === "blocked" ? "bg-brand-dark text-white"
                : "bg-surface-2 text-muted ring-1 ring-line";
              return (
                <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < tr.stages.length - 1 && <span className={`absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-0.5 ${s.state === "done" ? "bg-ok/40" : "bg-line"}`} aria-hidden />}
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${color}`}>
                    <Icon name={s.state === "done" ? "check" : s.state === "attention" ? "alert" : s.state === "blocked" ? "cross" : m.icon} size={19} strokeWidth={s.state === "done" ? 2.6 : 1.8} />
                  </span>
                  <div className="min-w-0 pt-1">
                    <p className={`font-semibold ${s.state === "upcoming" ? "text-ink-2" : "text-ink"}`}>
                      {t(m.title)}
                      {s.state === "current" && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand">{t("tl_now")}</span>}
                      {s.state === "attention" && <span className="ml-2 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-bold text-warn">{t("tl_fix")}</span>}
                    </p>
                    <p className="text-sm text-muted">
                      {s.at ? dt(s.at) : s.state === "attention" ? t("tl_attention") : s.state === "blocked" ? t("tl_blocked") : s.expected ? `${t(m.sub)} · ${t("tl_expected", { date: formatDate(s.expected, lang) })}` : t(m.sub)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          {needsKyc && (
            <Link href={`/kyc/${order.id}`} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-bold text-white hover:bg-brand-dark">
              <Icon name="shield" size={18} /> {order.status === "KYC_ACTION_NEEDED" ? t("verify_fix_cta") : t("verify_cta")}
            </Link>
          )}
          {order.status === "KYC_REJECTED" && (
            <div className="mt-6 space-y-2">
              <p className="flex items-start gap-2 rounded-2xl bg-info-soft px-4 py-3 text-sm text-info"><Icon name="headset" size={18} className="shrink-0" /> {t("kyc_call_done", { m: order.mobile_masked })}</p>
              <Link href={`/kyc/${order.id}`} className="block text-center text-sm font-semibold text-ink-2 underline-offset-2 hover:underline">{t("kyc_try_other")}</Link>
            </div>
          )}
          {tr.canAdvance && (
            <div className="mt-6 rounded-2xl border border-dashed border-line p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t("demo_label")}</p>
              <button onClick={advance} disabled={advancing}
                className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-surface-2 text-sm font-bold text-ink ring-1 ring-line hover:bg-white disabled:opacity-50">
                <Icon name="arrowRight" size={16} /> {t("demo_next")}
              </button>
            </div>
          )}
        </section>
      </div>

      <div className="space-y-5">
        {/* Messages sent to the customer (mock SMS) */}
        {sms.length > 0 && (
          <section className="rounded-3xl bg-white p-6 ring-1 ring-line" aria-labelledby="sms-h">
            <h2 id="sms-h" className="flex items-center gap-2 font-bold text-ink"><Icon name="message" size={18} className="text-muted" /> {t("sms_title", { m: order.mobile_masked })}</h2>
            <ul className="mt-3 space-y-2.5">
              {sms.map((n, i) => (
                <li key={i} className={`rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm ${i === 0 ? "bg-ok-soft text-ink" : "bg-surface-2 text-ink-2"}`}>
                  <p>{lang === "hi" ? n.text_hi : n.text_en}</p>
                  <p className="mt-1 text-[11px] text-muted">{n.channel} · {dt(n.at)}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-muted">{t("sms_demo")}</p>
          </section>
        )}

        {/* Order summary */}
        <section className="rounded-3xl bg-white p-6 ring-1 ring-line" aria-labelledby="sum-h">
          <h2 id="sum-h" className="text-sm font-bold uppercase tracking-wide text-muted">{t("summary_title")}</h2>
          <ul className="mt-2">
            {q.lines.map((l) => (
              <li key={l.product_id} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
                <ProductIcon productId={l.product_id} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{nameOf(l.copy, lang)}</p>
                  <p className="tabular text-xs text-muted">{l.quantity} × {rupees(l.unit_price_inr)} {unitLabel(lang, l.unit)}</p>
                </div>
                <p className="tabular shrink-0 text-sm font-bold text-ink">{rupees(l.monthly_inr)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t border-dashed border-line pt-4">
            <p className="tabular flex items-baseline justify-between">
              <span className="text-sm font-semibold text-ink-2">{t("total_monthly")}</span>
              <span className="text-2xl font-extrabold text-ink">{rupees(q.monthly_total_inr)}<span className="text-sm font-medium text-muted">{t("per_month")}</span></span>
            </p>
            <dl className="tabular mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted">{t("setup_fee")}</dt><dd className="font-semibold text-ink">{q.one_time_setup_total_inr ? rupees(q.one_time_setup_total_inr) : t("free")}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">{t("card_contract")}</dt><dd className="font-semibold text-ink">{t("months_n", { n: q.contract_months })}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted">{t("gst_note")}</p>
          </div>
        </section>
      </div>
    </div>,
  );
}
