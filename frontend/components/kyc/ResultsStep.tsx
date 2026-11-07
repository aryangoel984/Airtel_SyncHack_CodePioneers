"use client";
// KYC step 3: the verdict and every check, grouped by document, in plain language.
import { useLang } from "@/lib/LangContext";
import type { DocType, KycCheck, KycResult } from "@/lib/types";
import Icon from "@/components/ui/Icon";
import { DOC_META } from "./UploadStep";

const VERDICT = {
  VERIFIED: { icon: "checkCircle", cls: "from-ok to-[#0b6e3c]", title: "kyc_v_ok", sub: "kyc_v_ok_sub" },
  ACTION_NEEDED: { icon: "alert", cls: "from-[#c27400] to-[#9a5b00]", title: "kyc_v_fix", sub: "kyc_v_fix_sub" },
  REJECTED: { icon: "cross", cls: "from-brand to-brand-dark", title: "kyc_v_rej", sub: "kyc_v_rej_sub" },
} as const;

function CheckRow({ c }: { c: KycCheck }) {
  const { lang } = useLang();
  const style = c.result === "pass" ? "text-ok" : c.result === "warn" ? "text-warn" : "text-brand";
  const icon = c.result === "pass" ? "checkCircle" : c.result === "warn" ? "info" : "cross";
  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <Icon name={icon} size={17} className={`mt-px shrink-0 ${style}`} />
      <span className={`text-sm leading-snug ${c.result === "pass" ? "text-ink-2" : "font-medium text-ink"}`}>{lang === "hi" ? c.hi : c.en}</span>
    </li>
  );
}

export default function ResultsStep({ result, onFix, onSign, onCall }: {
  result: KycResult; onFix: () => void; onSign: () => void; onCall: () => void;
}) {
  const { t } = useLang();
  const v = VERDICT[result.verdict];
  const fails = result.checks.filter((c) => c.result === "fail").length;
  const order = { fail: 0, warn: 1, pass: 2 } as const;
  // Documents with a problem come first, so the customer sees what to fix without scrolling.
  const worst = (g: DocType | "overall") => Math.min(3, ...result.checks.filter((c) => c.doc === g).map((c) => order[c.result]));
  const groups = (["overall", "gst_certificate", "udyam_certificate", "signatory_id", "address_proof"] as (DocType | "overall")[])
    .sort((a, b) => worst(a) - worst(b));

  return (
    <div className="space-y-4">
      <section className={`animate-pop overflow-hidden rounded-3xl bg-gradient-to-br ${v.cls} p-5 text-white`}>
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/15"><Icon name={v.icon} size={26} /></span>
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold">{t(v.title)}</h2>
            <p className="mt-0.5 text-sm text-white/85">{t(v.sub, { n: fails })}</p>
          </div>
        </div>
        {result.business.name && (
          <dl className="tabular mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-white/10 px-3 py-2"><dt className="text-white/70">{t("kyc_business")}</dt><dd className="truncate font-bold">{result.business.name}</dd></div>
            <div className="rounded-xl bg-white/10 px-3 py-2"><dt className="text-white/70">GSTIN</dt><dd className="font-bold">{result.business.gstin_masked ?? "–"}{result.business.gst_status ? ` · ${result.business.gst_status}` : ""}</dd></div>
          </dl>
        )}
        <p className="mt-3 text-[11px] text-white/70">{t("kyc_read_in", { s: (result.ocrMs / 1000).toFixed(1) })}</p>
      </section>

      {groups.map((g) => {
        const list = result.checks.filter((c) => c.doc === g).sort((a, b) => order[a.result] - order[b.result]);
        if (!list.length) return null;
        const doc = g === "overall" ? null : result.docs.find((d) => d.doc === g);
        const bad = list.some((c) => c.result === "fail");
        return (
          <section key={g} className={`rounded-3xl bg-white p-4 ring-1 sm:p-5 ${bad ? "ring-brand-ring" : "ring-line"}`}>
            <div className="flex items-center gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${bad ? "bg-brand-soft text-brand" : "bg-ok-soft text-ok"}`}>
                <Icon name={g === "overall" ? "shield" : DOC_META[g].icon} size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-ink">{g === "overall" ? t("kyc_overall") : t(DOC_META[g].title)}</h3>
                {doc?.provided && doc.confidence !== null && (
                  <p className="text-[11px] text-muted">
                    {t("kyc_ocr_conf", { n: doc.confidence })}{doc.rotated ? ` · ${t("kyc_straightened")}` : ""}
                  </p>
                )}
              </div>
            </div>
            <ul className="mt-2">{list.map((c) => <CheckRow key={c.code} c={c} />)}</ul>
            {doc && Object.keys(doc.fields).length > 0 && (
              <dl className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(doc.fields).map(([k, val]) => (
                  <div key={k} className="tabular rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-ink-2 ring-1 ring-line">
                    <dt className="inline text-muted">{t("kf_" + k)}: </dt><dd className="inline font-semibold">{val}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        );
      })}

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        {result.verdict === "VERIFIED" && (
          <button onClick={onSign} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-bold text-white hover:bg-brand-dark">
            <Icon name="pen" size={19} /> {t("kyc_sign_btn")}
          </button>
        )}
        {result.verdict === "ACTION_NEEDED" && (
          <button onClick={onFix} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-bold text-white hover:bg-brand-dark">
            <Icon name="upload" size={19} /> {t("kyc_fix_btn")}
          </button>
        )}
        {result.verdict === "REJECTED" && (
          <div className="space-y-2">
            <button onClick={onCall} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-base font-bold text-white">
              <Icon name="headset" size={19} /> {t("kyc_call_btn")}
            </button>
            <button onClick={onFix} className="min-h-11 w-full text-sm font-semibold text-ink-2 underline-offset-2 hover:underline">{t("kyc_try_other")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
