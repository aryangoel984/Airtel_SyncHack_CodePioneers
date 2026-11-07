"use client";
// Top bar: brand name and the English / Hindi switch.
import Link from "next/link";
import { useLang } from "@/lib/LangContext";

export default function Header() {
  const { lang, setLang, t } = useLang();
  const btn = (l: "en" | "hi", label: string) => (
    <button
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
      className={`min-h-9 px-3 text-sm font-medium ${lang === l ? "bg-brand text-white" : "bg-white text-gray-700"}`}
    >
      {label}
    </button>
  );
  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-bold text-white">A</span>
          <span className="font-semibold">{t("brand")}</span>
        </Link>
        <div role="group" aria-label={t("language")} className="flex overflow-hidden rounded-lg border border-gray-300">
          {btn("en", "English")}
          {btn("hi", "हिंदी")}
        </div>
      </div>
    </header>
  );
}
