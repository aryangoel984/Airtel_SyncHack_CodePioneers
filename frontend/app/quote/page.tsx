"use client";
// The Quote screen: starter plan, add-ons, more options, and a live price in a sticky bar.
// All prices come from the backend (POST /api/quote). This page does no pricing itself.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import ErrorBox from "@/components/ErrorBox";
import ProductRow from "@/components/ProductRow";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useLang } from "@/lib/LangContext";
import { api } from "@/lib/api";
import { formatDate, nameOf, rupees } from "@/lib/i18n";
import { loadProfile } from "@/lib/profile";
import type { BusinessProfile, Quote, StarterItem, StarterResponse } from "@/lib/types";

interface Sel { on: boolean; qty: number }

export default function QuotePage() {
  const { lang, t } = useLang();
  const router = useRouter();

  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [starter, setStarter] = useState<StarterResponse | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [sel, setSel] = useState<Record<string, Sel>>({});
  const [showMore, setShowMore] = useState(false);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<unknown>(null);

  const [confirming, setConfirming] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<unknown>(null);

  // 1. Read the profile (or go back to the start page), then fetch the starter plan.
  const loadStarter = useCallback(async (p: BusinessProfile) => {
    setLoadError(null);
    setStarter(null);
    try {
      const s = await api.starter(p);
      setStarter(s);
      const initial: Record<string, Sel> = {};
      for (const i of s.base) initial[i.product_id] = { on: true, qty: i.quantity };
      for (const i of [...s.addons, ...s.more]) initial[i.product_id] = { on: false, qty: i.quantity };
      setSel(initial);
    } catch (e) {
      setLoadError(e);
    }
  }, []);

  useEffect(() => {
    const p = loadProfile();
    if (!p) { router.replace("/"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read saved profile, then fetch the plan
    setProfile(p);
    loadStarter(p);
  }, [router, loadStarter]);

  // 2. Whatever is switched on right now
  const items = useMemo(
    () => Object.entries(sel).filter(([, s]) => s.on).map(([product_id, s]) => ({ product_id, quantity: s.qty })),
    [sel],
  );

  // 3. Ask the backend for the price, a short moment after the last change (debounce).
  const reqId = useRef(0);
  useEffect(() => {
    if (!profile || !starter) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the price when nothing is selected
    if (items.length === 0) { setQuote(null); setQuoting(false); setQuoteError(null); return; }
    setQuoting(true);
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      try {
        const q = await api.quote(profile, items);
        if (id !== reqId.current) return; // a newer request is already on its way
        setQuote(q); setQuoteError(null);
      } catch (e) {
        if (id === reqId.current) setQuoteError(e);
      } finally {
        if (id === reqId.current) setQuoting(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [items, profile, starter]);

  const setQty = (id: string, qty: number) => setSel((s) => ({ ...s, [id]: { ...s[id], qty } }));
  const toggle = (id: string) => setSel((s) => ({ ...s, [id]: { ...s[id], on: !s[id].on } }));

  async function placeOrder(mobile: string) {
    if (!profile) return;
    setPlacing(true); setPlaceError(null);
    try {
      const order = await api.createOrder({ profile, items, language: lang, mobile });
      router.push(`/order/${order.id}`);
    } catch (e) {
      setPlaceError(e); setPlacing(false);
    }
  }

  // ---------- Render ----------
  if (!profile || (!starter && !loadError)) {
    return (
      <>
        <Header />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 text-center text-gray-600" aria-busy="true">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
          {t("loading_plan")}
        </main>
      </>
    );
  }
  if (loadError || !starter) {
    return (
      <>
        <Header />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6"><ErrorBox error={loadError} onRetry={() => loadStarter(profile)} /></main>
      </>
    );
  }

  // Products the engine added by itself (e.g. internet for CCTV) that the customer hasn't picked.
  const autoAdded = (quote?.fixes ?? [])
    .filter((f) => !sel[f.added_product_id]?.on)
    .map((f) => ({ fix: f, line: quote!.lines.find((l) => l.product_id === f.added_product_id) }))
    .filter((x) => x.line);

  const summary = [
    t("seg_" + profile.segment).split(":")[0],
    t("city_" + profile.city_tier).split("(")[0].trim(),
    t("summary_staff", { n: profile.employee_count }),
    t("summary_sites", { n: profile.num_sites }),
    t("summary_gst", { v: profile.has_valid_active_gstin ? t("yes") : t("no") }),
  ].join(" · ");

  const row = (i: StarterItem, mode: "plan" | "toggle") => (
    <ProductRow
      key={i.product_id}
      copy={i.copy} unit={i.unit} unitPrice={i.unit_price_inr}
      quantity={sel[i.product_id]?.qty ?? i.quantity} selected={!!sel[i.product_id]?.on}
      mode={mode}
      onToggle={() => toggle(i.product_id)}
      onQty={(q) => setQty(i.product_id, q)}
    />
  );
  const card = "rounded-2xl bg-white p-4 shadow-sm";
  const nothingSelected = items.length === 0;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 pb-56 pt-4">
        {/* Business summary */}
        <div className="flex items-start justify-between gap-3 text-sm text-gray-700">
          <p>{summary}</p>
          <Link href="/" className="min-h-11 shrink-0 px-2 font-semibold text-brand underline">{t("edit")}</Link>
        </div>

        {/* Your plan */}
        <section className={card} aria-labelledby="plan-h">
          <h1 id="plan-h" className="text-xl font-bold">{t("your_plan")}</h1>
          {starter.based_on.count > 0 && (
            <p className="mb-2 mt-1 text-xs text-gray-500">{lang === "hi" ? starter.based_on.line_hi : starter.based_on.line_en}</p>
          )}
          {starter.base.length === 0 && <p className="py-3 text-sm text-gray-600">{t("empty_base")}</p>}
          {autoAdded.map(({ fix, line }) => (
            <ProductRow
              key={"auto-" + fix.added_product_id}
              copy={line!.copy} unit={line!.unit} unitPrice={line!.unit_price_inr}
              quantity={line!.quantity} selected locked mode="plan"
              note={t("added_note", { added: nameOf(fix.added_copy, lang), for: nameOf(fix.for_copy, lang) })}
            />
          ))}
          {starter.base.map((i) => row(i, "plan"))}
        </section>

        {/* Add-ons */}
        {starter.addons.length > 0 && (
          <section className={card} aria-labelledby="addons-h">
            <h2 id="addons-h" className="text-lg font-bold">{t("addons")}</h2>
            <p className="mb-1 text-xs text-gray-500">{t("addons_sub")}</p>
            {starter.addons.map((i) => row(i, "toggle"))}
          </section>
        )}

        {/* More options (collapsible) */}
        {starter.more.length > 0 && (
          <section className={card} aria-labelledby="more-h">
            <h2 id="more-h" className="sr-only">{t("more")}</h2>
            <button
              onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}
              className="flex min-h-12 w-full items-center justify-between text-left text-lg font-bold"
            >
              {showMore ? t("more_hide") : t("more_show", { n: starter.more.length })}
              <span aria-hidden className={`transition-transform ${showMore ? "rotate-180" : ""}`}>⌄</span>
            </button>
            {showMore && <div className="mt-1">{starter.more.map((i) => row(i, "toggle"))}</div>}
          </section>
        )}

        {/* Not available */}
        {starter.blocked.length > 0 && (
          <section className="rounded-2xl border border-dashed border-gray-300 p-4" aria-labelledby="na-h">
            <h2 id="na-h" className="text-base font-bold text-gray-500">{t("unavailable")}</h2>
            <ul className="mt-2 space-y-3">
              {starter.blocked.map((b) => (
                <li key={b.product_id} className="text-gray-400">
                  <p className="text-sm font-medium">{nameOf(b.copy, lang)}</p>
                  <p className="text-xs">{lang === "hi" ? b.reason_hi : b.reason_en}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {/* Sticky price bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="mx-auto max-w-2xl px-4 pb-3 pt-3">
          {quoteError ? (
            <ErrorBox error={quoteError} />
          ) : nothingSelected ? (
            <p className="py-2 text-sm text-gray-600">{t("empty_plan")}</p>
          ) : (
            <div aria-live="polite">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500">{t("total_monthly")}</p>
                  <p className={`text-3xl font-bold leading-tight transition-opacity ${quoting ? "opacity-40" : ""}`}>
                    {quote ? rupees(quote.monthly_total_inr) : "₹ …"}
                    <span className="text-sm font-normal text-gray-500">{t("per_month")}</span>
                  </p>
                </div>
                <div className="text-right text-xs text-gray-700">
                  {quoting && <p className="text-gray-500">{t("updating")}</p>}
                  {quote && !quoting && (
                    <>
                      <p>{t("setup_fee")}: <b>{quote.one_time_setup_total_inr ? rupees(quote.one_time_setup_total_inr) : "₹0"}</b></p>
                      <p>{t("contract", { n: quote.contract_months })}</p>
                      <p>{t("ready_by", { date: formatDate(quote.expected_activation_date, lang) })}</p>
                    </>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">{t("gst_note")}</p>
            </div>
          )}
          <button
            disabled={nothingSelected || !quote || quoting || !!quoteError}
            onClick={() => { setPlaceError(null); setConfirming(true); }}
            className="mt-2 min-h-12 w-full rounded-xl bg-brand text-lg font-semibold text-white active:bg-brand-dark disabled:opacity-40"
          >
            {t("confirm")}
          </button>
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          busy={placing}
          error={placeError ? <ErrorBox error={placeError} /> : null}
          onCancel={() => setConfirming(false)}
          onSubmit={placeOrder}
        />
      )}
    </>
  );
}
