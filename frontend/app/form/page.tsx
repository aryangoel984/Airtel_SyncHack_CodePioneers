"use client";
// Quick form: an alternative to the AI Advisor for people who prefer tapping over chatting.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import JourneySteps from "@/components/ui/JourneySteps";
import Icon, { type IconName } from "@/components/ui/Icon";
import { useLang } from "@/lib/LangContext";
import { saveProfile } from "@/lib/profile";
import { clearInitialItems } from "@/lib/advisorStore";

const SEGMENTS: [string, IconName][] = [["micro", "store"], ["prof", "briefcase"], ["multi", "stores"], ["mfg", "factory"]];

function Stepper({ label, icon, value, onChange, max }: { label: string; icon: IconName; value: number; onChange: (n: number) => void; max: number }) {
  const { t } = useLang();
  const btn = "grid h-11 w-11 place-items-center rounded-full bg-white text-ink ring-1 ring-line hover:bg-surface-2 disabled:opacity-30";
  return (
    <div className="rounded-2xl bg-surface-2 p-3 ring-1 ring-line">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink"><Icon name={icon} size={16} className="text-muted" /> {label}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button type="button" aria-label={t("dec")} disabled={value <= 1} onClick={() => onChange(Math.max(1, value - 1))} className={btn}>
          <Icon name="minus" size={18} strokeWidth={2.4} />
        </button>
        <input inputMode="numeric" aria-label={label} value={value}
          onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, "") || "1", 10); onChange(Math.min(max, Math.max(1, n))); }}
          className="tabular h-11 w-16 min-w-0 rounded-xl bg-white text-center text-xl font-extrabold text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-brand-ring" />
        <button type="button" aria-label={t("inc")} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className={btn}>
          <Icon name="plus" size={18} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

export default function FormPage() {
  const { t } = useLang();
  const router = useRouter();
  const [segment, setSegment] = useState<string>("micro");
  const [tier, setTier] = useState(1);
  const [staff, setStaff] = useState(3);
  const [sites, setSites] = useState(1);
  const [gst, setGst] = useState(true);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    clearInitialItems(); // a fresh form means a fresh starter plan, not the advisor's items
    saveProfile({ segment, city_tier: tier, employee_count: staff, num_sites: sites, has_valid_active_gstin: gst });
    router.push("/quote");
  }

  const choice = (active: boolean) =>
    `flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-all ${
      active ? "bg-brand-soft text-ink ring-2 ring-brand" : "bg-white text-ink-2 ring-1 ring-line hover:ring-ink/20"}`;
  const legend = "text-[15px] font-bold text-ink";

  return (
    <>
      <Header />
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6"><JourneySteps current={0} compact /></div>
      </div>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-12 pt-6 sm:px-6">
        <Link href="/" className="mb-3 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink">
          <Icon name="chat" size={16} /> {t("form_to_chat")}
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{t("start_title")}</h1>
        <p className="mt-1 text-sm text-muted sm:text-base">{t("start_sub")}</p>

        <form onSubmit={submit} className="mt-6 space-y-7 rounded-3xl bg-white p-5 ring-1 ring-line sm:p-7">
          <fieldset>
            <legend className={legend}>{t("f_type")}</legend>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {SEGMENTS.map(([s, icon]) => (
                <button type="button" key={s} onClick={() => setSegment(s)} aria-pressed={segment === s} className={choice(segment === s)}>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${segment === s ? "bg-brand text-white" : "bg-surface-2 text-ink-2"}`}><Icon name={icon} size={20} /></span>
                  <span className="leading-snug">{t("seg_" + s)}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className={legend}>{t("f_city")}</legend>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {[1, 2].map((v) => (
                <button type="button" key={v} onClick={() => setTier(v)} aria-pressed={tier === v} className={choice(tier === v)}>
                  <Icon name="pin" size={18} className={tier === v ? "text-brand" : "text-muted"} />
                  <span className="leading-snug">{t("city_" + v)}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Stepper label={t("f_staff")} icon="users" value={staff} onChange={setStaff} max={100000} />
            <Stepper label={t("f_sites")} icon="stores" value={sites} onChange={setSites} max={10000} />
          </div>

          <fieldset>
            <legend className={legend}>{t("f_gst")}</legend>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => setGst(true)} aria-pressed={gst} className={choice(gst)}>
                <Icon name="checkCircle" size={18} className={gst ? "text-brand" : "text-muted"} /> {t("yes")}
              </button>
              <button type="button" onClick={() => setGst(false)} aria-pressed={!gst} className={choice(!gst)}>
                <Icon name="x" size={18} className={!gst ? "text-brand" : "text-muted"} /> {t("no")}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">{t("f_gst_hint")}</p>
          </fieldset>

          <button type="submit" className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-bold text-white transition-colors hover:bg-brand-dark">
            {t("show_plan")} <Icon name="arrowRight" size={20} />
          </button>
        </form>
      </main>
    </>
  );
}
