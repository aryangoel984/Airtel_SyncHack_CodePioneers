"use client";
import { useLang } from "@/lib/LangContext";
import { BackendDownError } from "@/lib/api";
import Icon from "@/components/ui/Icon";

/** Friendly error with a retry button. Shows the "server is down" text for network failures. */
export default function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useLang();
  const down = error instanceof BackendDownError;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl bg-brand-soft p-4 text-sm ring-1 ring-brand-ring">
      <Icon name="info" size={20} className="mt-px shrink-0 text-brand" />
      <div className="flex-1">
        <p className="font-semibold text-brand-dark">{down ? t("server_down") : t("something_wrong")}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-brand px-4 font-bold text-white hover:bg-brand-dark">
            <Icon name="refresh" size={16} /> {t("retry")}
          </button>
        )}
      </div>
    </div>
  );
}
