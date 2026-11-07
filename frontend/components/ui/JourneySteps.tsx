"use client";
// The 4-step journey bar: Plan → Customise → Verify → Track. Shows the customer where they are.
import { useLang } from "@/lib/LangContext";
import Icon from "./Icon";

const STEPS = ["j_plan", "j_customise", "j_verify", "j_track"] as const;

export default function JourneySteps({ current, compact = false }: { current: 0 | 1 | 2 | 3; compact?: boolean }) {
  const { t } = useLang();
  return (
    <ol className={`flex items-center ${compact ? "gap-1.5" : "gap-2"}`} aria-label={t("j_label")}>
      {STEPS.map((key, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={key} className={`flex items-center gap-1.5 ${now ? "flex-[1.6]" : "min-w-0 flex-1"} last:flex-none`} aria-current={now ? "step" : undefined}>
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
              done ? "bg-ok text-white" : now ? "bg-brand text-white ring-4 ring-brand-ring" : "bg-white text-muted ring-1 ring-line"}`}>
              {done ? <Icon name="check" size={13} strokeWidth={3} /> : i + 1}
            </span>
            <span className={`text-xs font-semibold ${now ? "whitespace-nowrap text-ink" : done ? "truncate text-ink-2" : "truncate text-muted"} ${compact && !now ? "hidden sm:inline" : ""}`}>
              {t(key)}
            </span>
            {i < STEPS.length - 1 && <span className={`h-px min-w-3 flex-1 ${done ? "bg-ok/50" : "bg-line"}`} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
