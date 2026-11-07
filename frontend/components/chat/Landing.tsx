"use client";
// First screen: what this is, why it's easy, and "pick your language to start chatting".
import Link from "next/link";
import { useLang } from "@/lib/LangContext";
import { CHAT_LANGUAGES } from "@/lib/i18n";
import type { ChatLang } from "@/lib/types";
import Icon, { type IconName } from "@/components/ui/Icon";

export default function Landing({ busy, error, onPick }: { busy: boolean; error: string; onPick: (l: ChatLang) => void }) {
  const { t } = useLang();

  const benefits: [IconName, string, string][] = [
    ["clock", t("land_b1"), t("land_b1_sub")],
    ["rupee", t("land_b2"), t("land_b2_sub")],
    ["headset", t("land_b3"), t("land_b3_sub")],
  ];
  const steps: [IconName, string, string][] = [
    ["chat", t("j_plan"), t("land_s1")],
    ["edit", t("j_customise"), t("land_s2")],
    ["shield", t("j_verify"), t("land_s3")],
    ["clock", t("j_track"), t("land_s4")],
  ];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-6 sm:px-6 lg:pt-14">
      {/* Phone order: headline → language picker → benefits. Desktop: headline + benefits left, picker right. */}
      <div className="grid items-start gap-6 lg:grid-cols-[1.05fr_1fr] lg:gap-x-14 lg:gap-y-6">
        {/* Hero */}
        <section className="order-1 animate-rise lg:order-none lg:col-start-1 lg:row-start-1">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand ring-1 ring-brand-ring">
            <Icon name="sparkle" size={14} /> {t("land_badge")}
          </p>
          <h1 className="mt-4 text-[28px] font-extrabold leading-[1.12] tracking-tight text-ink sm:text-4xl lg:text-[44px]">
            {t("land_title_1")} <span className="text-brand">{t("land_title_2")}</span>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-2 sm:text-lg">{t("land_sub")}</p>
        </section>

        <section className="order-3 animate-rise lg:order-none lg:col-start-1 lg:row-start-2" aria-label={t("land_b1")}>
          <ul className="grid gap-3 sm:grid-cols-3 lg:max-w-md lg:grid-cols-1">
            {benefits.map(([icon, title, sub]) => (
              <li key={title} className="flex items-start gap-3 rounded-2xl bg-white/70 p-3 ring-1 ring-line">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon name={icon} size={18} /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-ink">{title}</span>
                  <span className="block text-xs leading-snug text-muted">{sub}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Language picker card */}
        <section className="order-2 animate-pop rounded-3xl bg-white p-5 shadow-[var(--shadow-lift)] ring-1 ring-line sm:p-7 lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1" aria-labelledby="pick-h">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand text-white"><Icon name="chat" size={22} /></span>
            <div>
              <h2 id="pick-h" className="text-lg font-bold text-ink sm:text-xl">{t("adv_pick_title")}</h2>
              <p className="text-sm text-muted">{t("adv_pick_sub")}</p>
            </div>
          </div>
          {error && (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-2xl bg-brand-soft p-3 text-sm text-brand-dark ring-1 ring-brand-ring">
              <Icon name="info" size={18} className="mt-px shrink-0" /> {error}
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {CHAT_LANGUAGES.map((l, i) => (
              <button key={l.code} onClick={() => onPick(l.code)} disabled={busy}
                className={`group flex min-h-13 items-center justify-between rounded-2xl px-4 py-3 text-left text-[15px] font-semibold transition-all disabled:opacity-50 ${
                  i < 2 ? "bg-ink text-white hover:bg-ink-2" : "bg-surface-2 text-ink ring-1 ring-line hover:bg-brand-soft hover:ring-brand-ring"}`}>
                <span>{l.label}</span>
                <Icon name="arrowRight" size={16} className={`transition-transform group-hover:translate-x-0.5 ${i < 2 ? "opacity-80" : "text-muted"}`} />
              </button>
            ))}
          </div>

          {busy && <p className="mt-4 text-center text-sm text-muted" role="status">{t("land_starting")}</p>}

          <div className="my-5 flex items-center gap-3 text-xs font-medium text-muted" aria-hidden>
            <span className="h-px flex-1 bg-line" />{t("or")}<span className="h-px flex-1 bg-line" />
          </div>
          <Link href="/form" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-ink ring-1 ring-line hover:bg-surface-2">
            <Icon name="form" size={18} /> {t("adv_form_link")}
          </Link>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted">
            <Icon name="lock" size={13} /> {t("land_privacy")}
          </p>
        </section>
      </div>

      {/* How it works */}
      <section className="mt-12 lg:mt-16" aria-labelledby="how-h">
        <h2 id="how-h" className="text-sm font-bold uppercase tracking-wider text-muted">{t("land_how")}</h2>
        <ol className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {steps.map(([icon, title, sub], i) => (
            <li key={title} className="rounded-2xl bg-white p-4 ring-1 ring-line">
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink"><Icon name={icon} size={18} /></span>
                <span className="text-xs font-bold text-muted">0{i + 1}</span>
              </div>
              <p className="mt-3 font-bold text-ink">{title}</p>
              <p className="mt-0.5 text-xs leading-snug text-muted">{sub}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
