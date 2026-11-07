"use client";
// Top bar: brand mark, name, and the English / Hindi switch.
import Link from "next/link";
import { useLang } from "@/lib/LangContext";
import Icon from "@/components/ui/Icon";

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="11" fill="var(--color-brand)" />
      {/* stylised "A" made of signal arcs */}
      <path d="M12 29 20 11l8 18" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.6 22.5h8.8" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="30.5" cy="10.5" r="2.4" fill="#fff" />
    </svg>
  );
}

export default function Header({ subtitle }: { subtitle?: string }) {
  const { lang, setLang, t } = useLang();
  const btn = (l: "en" | "hi", label: string) => (
    <button
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
      className={`h-8 rounded-full px-3 text-[13px] font-semibold transition-colors ${
        lang === l ? "bg-ink text-white shadow-sm" : "text-ink-2 hover:text-ink"}`}
    >
      {label}
    </button>
  );
  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label={t("brand")}>
          <BrandMark />
          <span className="min-w-0 leading-tight">
            <span className="block text-[15px] font-bold tracking-tight text-ink sm:text-base">{t("brand")}</span>
            <span className="block truncate text-[11px] font-medium text-muted sm:text-xs">{subtitle ?? t("brand_sub")}</span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/track" className="flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink-2 ring-1 ring-line hover:bg-surface-2" aria-label={t("track_title")}>
            <Icon name="clock" size={16} /><span className="hidden sm:inline">{t("track_short")}</span>
          </Link>
          <div role="group" aria-label={t("language")} className="flex items-center rounded-full bg-surface-2 p-1 ring-1 ring-line">
            {btn("en", "EN")}
            {btn("hi", "हिं")}
          </div>
        </div>
      </div>
    </header>
  );
}
