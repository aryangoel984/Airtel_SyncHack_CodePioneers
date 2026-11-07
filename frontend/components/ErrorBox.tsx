"use client";
import { useLang } from "@/lib/LangContext";
import { BackendDownError } from "@/lib/api";

/** Friendly error with a retry button. Shows the "server is down" text for network failures. */
export default function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useLang();
  const down = error instanceof BackendDownError;
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-brand-soft p-4 text-sm">
      <p className="font-medium text-brand-dark">{down ? t("server_down") : t("something_wrong")}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 min-h-11 rounded-lg bg-brand px-4 font-semibold text-white">
          {t("retry")}
        </button>
      )}
    </div>
  );
}
