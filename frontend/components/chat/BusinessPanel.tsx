"use client";
// "Your business" panel: what the advisor has understood so far. Desktop side panel + mobile progress strip.
import { useLang } from "@/lib/LangContext";
import type { AdvisorProfileView } from "@/lib/types";
import Icon, { type IconName } from "@/components/ui/Icon";

export const SLOTS = ["business_type", "employee_count", "num_sites", "city", "gst"] as const;

export function slotProgress(missing: string[] | undefined, hasPlan: boolean) {
  if (hasPlan) return { done: SLOTS.length, total: SLOTS.length };
  const miss = new Set(missing ?? SLOTS);
  return { done: SLOTS.filter((s) => !miss.has(s)).length, total: SLOTS.length };
}

function rows(p: AdvisorProfileView | null | undefined, t: (k: string, v?: Record<string, string | number>) => string) {
  const seg = p?.segment ? t("seg_" + p.segment).split(":")[0] : null;
  const gst = p?.has_gst == null ? null
    : p.gstin_status && p.gstin_status !== "Active" ? t("bp_gst_inactive", { s: p.gstin_status })
    : p.has_gst ? t("yes") : t("no");
  const city = p?.city ?? (p?.city_tier ? t("city_" + p.city_tier).split("(")[0].trim() : null);
  const list: [IconName, string, string | null][] = [
    ["store", t("bp_business"), p?.business_name ?? p?.business_type ?? seg],
    ["users", t("bp_staff"), p?.employee_count != null ? String(p.employee_count) : null],
    ["stores", t("bp_sites"), p?.num_sites != null ? String(p.num_sites) : null],
    ["pin", t("bp_city"), city],
    ["receipt", t("bp_gst"), gst],
  ];
  return list;
}

export function ProgressStrip({ profile, missing, hasPlan }: { profile?: AdvisorProfileView | null; missing?: string[]; hasPlan: boolean }) {
  const { t } = useLang();
  const { done, total } = slotProgress(missing, hasPlan);
  const filled = rows(profile, t).filter(([, , v]) => v);
  return (
    <div className="border-b border-line bg-white px-4 py-2 lg:hidden">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-ink-2">{hasPlan ? t("bp_ready") : t("bp_progress", { n: done, total })}</span>
        <span className="flex gap-1">
          {filled.slice(0, 4).map(([icon, label, v]) => (
            <span key={label} title={`${label}: ${v}`} className="grid h-6 w-6 place-items-center rounded-full bg-ok-soft text-ok"><Icon name={icon} size={13} /></span>
          ))}
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className={`h-full rounded-full transition-all duration-500 ${hasPlan ? "bg-ok" : "bg-brand"}`} style={{ width: `${(done / total) * 100}%` }} />
      </div>
    </div>
  );
}

export default function BusinessPanel({ profile, missing, hasPlan, onPerson }: {
  profile?: AdvisorProfileView | null; missing?: string[]; hasPlan: boolean; onPerson: () => void;
}) {
  const { t } = useLang();
  const { done, total } = slotProgress(missing, hasPlan);
  const wishes = profile?.wishes ?? [];

  return (
    <aside className="hidden space-y-4 lg:block">
      <section className="rounded-3xl bg-white p-5 ring-1 ring-line" aria-labelledby="bp-h">
        <div className="flex items-center justify-between">
          <h2 id="bp-h" className="font-bold text-ink">{t("bp_title")}</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${hasPlan ? "bg-ok-soft text-ok" : "bg-surface-2 text-ink-2"}`}>
            {hasPlan ? t("bp_ready") : `${done}/${total}`}
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className={`h-full rounded-full transition-all duration-500 ${hasPlan ? "bg-ok" : "bg-brand"}`} style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <ul className="mt-4 space-y-3">
          {rows(profile, t).map(([icon, label, value]) => (
            <li key={label} className="flex items-center gap-3">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${value ? "bg-ok-soft text-ok" : "bg-surface-2 text-muted"}`}>
                <Icon name={value ? "check" : icon} size={16} strokeWidth={value ? 2.6 : 1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
                <span className={`block truncate text-sm first-letter:uppercase ${value ? "font-semibold text-ink" : "text-muted"}`}>{value ?? t("bp_pending")}</span>
              </span>
            </li>
          ))}
        </ul>
        {wishes.length > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t("bp_wants")}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {wishes.map((w) => (
                <span key={w} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark">{t("w_" + w)}</span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-ink p-5 text-white">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10"><Icon name="headset" size={20} /></span>
        <p className="mt-3 font-bold">{t("bp_human_title")}</p>
        <p className="mt-1 text-sm text-white/70">{t("bp_human_sub")}</p>
        <button onClick={onPerson} className="mt-4 min-h-11 w-full rounded-2xl bg-white text-sm font-bold text-ink hover:bg-white/90">
          {t("adv_person")}
        </button>
      </section>

      <p className="flex items-start gap-2 px-2 text-xs leading-relaxed text-muted">
        <Icon name="lock" size={14} className="mt-0.5 shrink-0" /> {t("bp_privacy")}
      </p>
    </aside>
  );
}
