"use client";
// Bottom sheet on phones, centred dialog on larger screens. Closes on Escape and on backdrop tap.
import { useEffect } from "react";
import Icon, { type IconName } from "./Icon";

export default function Sheet({ icon, title, onClose, children }: {
  icon: IconName; title: string; onClose: () => void; children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="w-full max-w-md animate-rise rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-lift)] sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><Icon name={icon} size={22} /></span>
          <h2 className="flex-1 pt-2 text-lg font-bold leading-snug text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface-2">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

/** The mobile-number field used in both dialogs. */
export function MobileInput({ value, onChange, label, invalid, invalidText, autoFocus = true }: {
  value: string; onChange: (v: string) => void; label: string; invalid: boolean; invalidText: string; autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <span className={`mt-1.5 flex h-13 items-center overflow-hidden rounded-2xl bg-surface-2 ring-1 focus-within:ring-2 ${invalid ? "ring-brand" : "ring-line focus-within:ring-brand-ring"}`}>
        <span className="flex h-full items-center border-r border-line px-3 text-base font-semibold text-ink-2">+91</span>
        <input inputMode="numeric" autoComplete="tel-national" maxLength={10} autoFocus={autoFocus} value={value} placeholder="98XXXXXXXX"
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          className="tabular h-full min-w-0 flex-1 bg-transparent px-3 text-lg tracking-wider text-ink outline-none focus-visible:outline-none" />
      </span>
      {invalid && <span className="mt-1.5 block text-sm text-brand-dark">{invalidText}</span>}
    </label>
  );
}
