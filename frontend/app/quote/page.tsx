"use client";
// The Quote screen: starter plan, add-ons, more options, and a live price (sticky bar on phones, side card on desktop).
// All prices come from the backend (POST /api/quote). This page does no pricing itself.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import ErrorBox from "@/components/ErrorBox";
import ProductRow from "@/components/ProductRow";
import ConfirmDialog from "@/components/ConfirmDialog";
import JourneySteps from "@/components/ui/JourneySteps";
import Icon, { ProductIcon, type IconName } from "@/components/ui/Icon";
import { useLang } from "@/lib/LangContext";
import { api } from "@/lib/api";
import { formatDate, nameOf, rupees } from "@/lib/i18n";
import { loadProfile } from "@/lib/profile";
import { loadAdvisorSessionId, loadInitialItems } from "@/lib/advisorStore";
import type { BusinessProfile, Quote, StarterItem, StarterResponse } from "@/lib/types";

interface Sel { on: boolean; qty: number }

export default function QuotePage() {
  const { lang, t } = useLang();
  const router = useRouter();

  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [starter, setStarter] = useState<StarterResponse | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [sel, setSel] = useState<Record<string, Sel>>({});
  // Which products make up "Your plan": the advisor's exact items, or the starter bundle when there are none
  const [planIds, setPlanIds] = useState<Set<string>>(new Set());
  const [fromAdvisor, setFromAdvisor] = useState(false);
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
      const advisorItems = loadInitialItems(); // set when the customer came from the AI Advisor
      const initial: Record<string, Sel> = {};
      for (const i of [...s.base, ...s.addons, ...s.more]) initial[i.product_id] = { on: false, qty: i.quantity };
      if (advisorItems?.length) {
        for (const i of advisorItems) if (initial[i.product_id]) initial[i.product_id] = { on: true, qty: i.quantity };
        setPlanIds(new Set(advisorItems.map((i) => i.product_id)));
        setFromAdvisor(true);
      } else {
        for (const i of s.base) initial[i.product_id] = { on: true, qty: i.quantity };
        setPlanIds(new Set(s.base.map((i) => i.product_id)));
        setFromAdvisor(false);
      }
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
      const advisorId = loadAdvisorSessionId();
      if (advisorId) api.advisorEvent(advisorId, "ordered").catch(() => {}); // best effort, for the back-office view
      router.push(`/order/${order.id}`);
    } catch (e) {
      setPlaceError(e); setPlacing(false);
    }
  }

  // ---------- Render ----------
  const shell = (children: React.ReactNode) => (
    <>
      <Header />
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6"><JourneySteps current={1} compact /></div>
      </div>
      {children}
    </>
  );

  if (!profile || (!starter && !loadError)) {
    return shell(
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6" aria-busy="true">
        <p className="sr-only">{t("loading_plan")}</p>
        <div className="space-y-4 lg:max-w-[calc(100%-404px)]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-3xl bg-white p-5 ring-1 ring-line">
              <div className="h-4 w-1/3 rounded-full bg-line" />
              <div className="mt-4 flex gap-3"><div className="h-11 w-11 rounded-2xl bg-line" /><div className="flex-1 space-y-2"><div className="h-3 w-2/3 rounded-full bg-line" /><div className="h-3 w-1/2 rounded-full bg-line" /></div></div>
            </div>
          ))}
        </div>
      </main>,
    );
  }
  if (loadError || !starter) {
    return shell(<main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6"><ErrorBox error={loadError} onRetry={() => loadStarter(profile)} /></main>);
  }

  // Products the engine added by itself (e.g. internet for CCTV) that the customer hasn't picked.
  const autoAdded = (quote?.fixes ?? [])
    .filter((f) => !sel[f.added_product_id]?.on)
    .map((f) => ({ fix: f, line: quote!.lines.find((l) => l.product_id === f.added_product_id) }))
    .filter((x) => x.line);

  const facts: [IconName, string][] = [
    ["store", t("seg_" + profile.segment).split(":")[0]],
    ["pin", t("city_" + profile.city_tier).split("(")[0].trim()],
    ["users", t("summary_staff", { n: profile.employee_count })],
    ["stores", t("summary_sites", { n: profile.num_sites })],
    ["receipt", t("summary_gst", { v: profile.has_valid_active_gstin ? t("yes") : t("no") })],
  ];

  // Sections: the plan, add-ons, more options. With no advisor items this is exactly starter.base / addons / more.
  const allItems = [...starter.base, ...starter.addons, ...starter.more];
  const planItems = allItems.filter((i) => planIds.has(i.product_id));
  const addonItems = starter.addons.filter((i) => !planIds.has(i.product_id));
  const moreItems = [...starter.base, ...starter.more].filter((i) => !planIds.has(i.product_id));
  const selectedExtras = [...addonItems, ...moreItems].filter((i) => sel[i.product_id]?.on).length;

  const row = (i: StarterItem, mode: "plan" | "toggle") => (
    <ProductRow
      key={i.product_id}
      productId={i.product_id}
      copy={i.copy} unit={i.unit} unitPrice={i.unit_price_inr}
      quantity={sel[i.product_id]?.qty ?? i.quantity} selected={!!sel[i.product_id]?.on}
      mode={mode}
      onToggle={() => toggle(i.product_id)}
      onQty={(q) => setQty(i.product_id, q)}
    />
  );
  const card = "rounded-3xl bg-white px-4 py-4 ring-1 ring-line sm:px-6 sm:py-5";
  const nothingSelected = items.length === 0;
  const canConfirm = !nothingSelected && !!quote && !quoting && !quoteError;
  const readyBy = quote ? formatDate(quote.expected_activation_date, lang) : "";

  const sectionTitle = (icon: IconName, title: string, sub?: string, id?: string) => (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2"><Icon name={icon} size={18} /></span>
      <div>
        <h2 id={id} className="text-lg font-bold text-ink">{title}</h2>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </div>
    </div>
  );

  // Price summary (used in the desktop side card)
  const summaryCard = (
    <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-line" aria-live="polite">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{t("summary_title")}</h2>
      {quoteError ? <div className="mt-3"><ErrorBox error={quoteError} /></div> : nothingSelected ? (
        <p className="mt-3 text-sm text-muted">{t("empty_plan")}</p>
      ) : (
        <>
          <ul className={`mt-3 space-y-2 transition-opacity ${quoting ? "opacity-50" : ""}`}>
            {(quote?.lines ?? []).map((l) => (
              <li key={l.product_id} className="tabular flex justify-between gap-3 text-sm">
                <span className="min-w-0 text-ink-2">{nameOf(l.copy, lang)}{l.quantity > 1 && <span className="text-muted"> ×{l.quantity}</span>}</span>
                <span className="shrink-0 font-semibold text-ink">{rupees(l.monthly_inr)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-dashed border-line pt-4">
            <p className="text-xs font-semibold text-muted">{t("total_monthly")}</p>
            <p className={`tabular text-4xl font-extrabold tracking-tight text-ink transition-opacity ${quoting ? "opacity-40" : ""}`}>
              {quote ? rupees(quote.monthly_total_inr) : "₹ …"}<span className="text-base font-medium text-muted">{t("per_month")}</span>
            </p>
            <p className="text-xs text-muted">{t("gst_note")}</p>
          </div>
          {quote && (
            <dl className="tabular mt-4 grid grid-cols-3 gap-2 text-center">
              {[[t("card_setup"), quote.one_time_setup_total_inr ? rupees(quote.one_time_setup_total_inr) : t("free")],
                [t("card_contract"), t("months_n", { n: quote.contract_months })],
                [t("card_ready"), readyBy]].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-surface-2 px-1 py-2.5">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{k}</dt>
                  <dd className="mt-0.5 text-[13px] font-bold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </>
      )}
      <button disabled={!canConfirm} onClick={() => { setPlaceError(null); setConfirming(true); }}
        className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-bold text-white transition-colors hover:bg-brand-dark disabled:opacity-40">
        {t("confirm")} <Icon name="arrowRight" size={18} />
      </button>
      <ul className="mt-4 space-y-1.5 text-xs text-muted">
        <li className="flex items-center gap-2"><Icon name="checkCircle" size={15} className="text-ok" /> {t("trust_1")}</li>
        <li className="flex items-center gap-2"><Icon name="checkCircle" size={15} className="text-ok" /> {t("trust_2")}</li>
        <li className="flex items-center gap-2"><Icon name="checkCircle" size={15} className="text-ok" /> {t("trust_3")}</li>
      </ul>
    </div>
  );

  return shell(
    <>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-44 pt-5 sm:px-6 lg:pb-12 lg:pt-8">
        <div className="lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-6">
          <div className="space-y-4">
            {/* Title + business summary */}
            <div>
              {fromAdvisor && (
                <Link href="/" className="mb-2 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink">
                  <Icon name="arrowLeft" size={16} /> {t("back_to_chat")}
                </Link>
              )}
              <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{t("quote_title")}</h1>
              <p className="mt-1 text-sm text-muted">{t("quote_sub")}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {facts.map(([icon, label]) => (
                  <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink-2 ring-1 ring-line">
                    <Icon name={icon} size={13} className="text-muted" /> {label}
                  </span>
                ))}
                <Link href="/form" className="inline-flex min-h-8 items-center gap-1 rounded-full px-2.5 text-xs font-bold text-brand hover:bg-brand-soft">
                  <Icon name="edit" size={13} /> {t("edit")}
                </Link>
              </div>
            </div>

            {/* Your plan */}
            <section className={card} aria-labelledby="plan-h">
              <div className="flex flex-wrap items-start justify-between gap-2">
                {sectionTitle("sparkle", t("your_plan"), undefined, "plan-h")}
                {fromAdvisor && <span className="rounded-full bg-ok-soft px-2.5 py-1 text-[11px] font-bold text-ok">{t("from_advisor")}</span>}
              </div>
              {starter.based_on.count > 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                  <Icon name="users" size={14} className="shrink-0" /> {lang === "hi" ? starter.based_on.line_hi : starter.based_on.line_en}
                </p>
              )}
              <div className="mt-2">
                {planItems.length === 0 && <p className="py-3 text-sm text-muted">{t("empty_base")}</p>}
                {autoAdded.map(({ fix, line }) => (
                  <ProductRow
                    key={"auto-" + fix.added_product_id}
                    productId={fix.added_product_id}
                    copy={line!.copy} unit={line!.unit} unitPrice={line!.unit_price_inr}
                    quantity={line!.quantity} selected locked mode="plan"
                    note={t("added_note", { added: nameOf(fix.added_copy, lang), for: nameOf(fix.for_copy, lang) })}
                  />
                ))}
                {planItems.map((i) => row(i, "plan"))}
              </div>
            </section>

            {/* Add-ons */}
            {addonItems.length > 0 && (
              <section className={card} aria-labelledby="addons-h">
                {sectionTitle("plus", t("addons"), t("addons_sub"), "addons-h")}
                <div className="mt-2">{addonItems.map((i) => row(i, "toggle"))}</div>
              </section>
            )}

            {/* More options (collapsible) */}
            {moreItems.length > 0 && (
              <section className={card} aria-labelledby="more-h">
                <button onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}
                  className="flex w-full items-center justify-between gap-3 text-left">
                  {sectionTitle("form", showMore ? t("more_hide") : t("more_show", { n: moreItems.length }), selectedExtras ? t("extras_on", { n: selectedExtras }) : t("more_sub"), "more-h")}
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2 transition-transform ${showMore ? "rotate-180" : ""}`} aria-hidden>
                    <Icon name="chevronDown" size={18} />
                  </span>
                </button>
                {showMore && <div className="mt-2">{moreItems.map((i) => row(i, "toggle"))}</div>}
              </section>
            )}

            {/* Not available */}
            {starter.blocked.length > 0 && (
              <section className="rounded-3xl bg-surface-2 px-4 py-4 ring-1 ring-line sm:px-6" aria-labelledby="na-h">
                {sectionTitle("lock", t("unavailable"), t("unavailable_sub"), "na-h")}
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {starter.blocked.map((b) => (
                    <li key={b.product_id} className="flex items-start gap-2.5 rounded-2xl bg-white/60 p-2.5">
                      <span className="opacity-70"><ProductIcon productId={b.product_id} muted size="sm" /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink-2">{nameOf(b.copy, lang)}</span>
                        <span className="block text-xs text-muted">{lang === "hi" ? b.reason_hi : b.reason_en}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Desktop: sticky summary card */}
          <aside className="hidden lg:sticky lg:top-24 lg:block">{summaryCard}</aside>
        </div>
      </main>

      {/* Phone: sticky price bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 shadow-[var(--shadow-bar)] backdrop-blur lg:hidden">
        <div className="mx-auto max-w-2xl px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {quoteError ? (
            <ErrorBox error={quoteError} />
          ) : nothingSelected ? (
            <p className="py-1 text-sm text-muted">{t("empty_plan")}</p>
          ) : (
            <div className="flex items-end justify-between gap-3" aria-live="polite">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-muted">{t("total_monthly")} · {t("gst_short")}</p>
                <p className={`tabular text-[28px] font-extrabold leading-tight tracking-tight text-ink transition-opacity ${quoting ? "opacity-40" : ""}`}>
                  {quote ? rupees(quote.monthly_total_inr) : "₹ …"}<span className="text-sm font-medium text-muted">{t("per_month")}</span>
                </p>
              </div>
              <div className="tabular shrink-0 pb-1 text-right text-[11px] leading-snug text-ink-2">
                {quoting ? <p className="text-muted">{t("updating")}</p> : quote && (
                  <>
                    <p>{t("setup_fee")}: <b>{quote.one_time_setup_total_inr ? rupees(quote.one_time_setup_total_inr) : t("free")}</b></p>
                    <p>{t("contract", { n: quote.contract_months })}</p>
                    <p className="font-semibold text-ok">{t("ready_by", { date: readyBy })}</p>
                  </>
                )}
              </div>
            </div>
          )}
          <button disabled={!canConfirm} onClick={() => { setPlaceError(null); setConfirming(true); }}
            className="mt-2.5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-bold text-white active:bg-brand-dark disabled:opacity-40">
            {t("confirm")} <Icon name="arrowRight" size={18} />
          </button>
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          busy={placing}
          summary={quote ? `${rupees(quote.monthly_total_inr)}${t("per_month")} · ${t("ready_by", { date: readyBy })}` : undefined}
          error={placeError ? <ErrorBox error={placeError} /> : null}
          onCancel={() => setConfirming(false)}
          onSubmit={placeOrder}
        />
      )}
    </>,
  );
}
