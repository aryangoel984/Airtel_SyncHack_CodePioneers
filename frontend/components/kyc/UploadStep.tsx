"use client";
// KYC step 2: GSTIN lookup (optional) + four document slots + DigiLocker (demo).
import { useEffect, useState } from "react";
import { useLang } from "@/lib/LangContext";
import { api } from "@/lib/api";
import type { DocType, GstinLookup, KycCheck, KycSample } from "@/lib/types";
import Icon, { type IconName } from "@/components/ui/Icon";
import Sheet from "@/components/ui/Sheet";

export const DOC_META: Record<DocType, { icon: IconName; title: string; hint: string }> = {
  gst_certificate: { icon: "receipt", title: "doc_gst", hint: "doc_gst_hint" },
  udyam_certificate: { icon: "briefcase", title: "doc_udyam", hint: "doc_udyam_hint" },
  signatory_id: { icon: "idcard", title: "doc_id", hint: "doc_id_hint" },
  address_proof: { icon: "pin", title: "doc_bill", hint: "doc_bill_hint" },
};
const ORDER: DocType[] = ["gst_certificate", "udyam_certificate", "signatory_id", "address_proof"];

export interface UploadState {
  files: Partial<Record<DocType, File>>;
  noGst: boolean;
  noUdyam: boolean;
  gstin: string;
}

function Preview({ file }: { file: File }) {
  // Create the preview URL inside the effect so it is always paired with its cleanup
  // (with useMemo, React's dev double-run revoked the URL and the thumbnail broke after "Fix and check again").
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u); // eslint-disable-line react-hooks/set-state-in-effect -- the URL only exists in the browser
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element -- local preview of the customer's own file
  return <img src={url} alt="" className="h-full w-full object-cover object-top" />;
}

function DocSlot({ doc, file, issue, onFile, onRemove }: {
  doc: DocType; file?: File; issue?: string; onFile: (f: File) => void; onRemove: () => void;
}) {
  const { t } = useLang();
  const m = DOC_META[doc];
  const inputId = `file-${doc}`;
  return (
    <div className={`flex gap-3 rounded-2xl bg-white p-3 ring-1 ${issue ? "ring-2 ring-brand" : file ? "ring-ok/40" : "ring-line"}`}>
      <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line">
        {file ? <Preview file={file} /> : <span className="grid h-full w-full place-items-center text-muted"><Icon name={m.icon} size={24} /></span>}
        {file && !issue && <span className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-ok text-white"><Icon name="check" size={12} strokeWidth={3} /></span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{t(m.title)}</p>
        <p className="text-xs leading-snug text-muted">{t(m.hint)}</p>
        {issue && <p className="mt-1 flex items-start gap-1 text-xs font-medium text-brand-dark"><Icon name="alert" size={13} className="mt-px shrink-0" /> {issue}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label htmlFor={inputId}
            className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${file ? "text-ink-2 ring-1 ring-line hover:bg-surface-2" : "bg-ink text-white hover:bg-ink-2"}`}>
            <Icon name={file ? "refresh" : "upload"} size={15} /> {file ? t("kyc_replace") : t("kyc_upload")}
          </label>
          <input id={inputId} type="file" accept="image/png,image/jpeg,image/webp" capture="environment" className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
          {file && (
            <button type="button" onClick={onRemove} className="h-9 rounded-full px-2 text-sm text-muted hover:text-brand">{t("remove")}</button>
          )}
          {file && <span className="truncate text-[11px] text-muted">{file.name}</span>}
        </div>
      </div>
    </div>
  );
}

function GstinBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useLang();
  const [res, setRes] = useState<GstinLookup | null>(null);
  const [busy, setBusy] = useState(false);
  const clean = value.trim().toUpperCase();

  useEffect(() => {
    if (clean.length !== 15) { setRes(null); return; } // eslint-disable-line react-hooks/set-state-in-effect -- clear the old result
    let live = true;
    setBusy(true);
    api.lookupGstin(clean).then((r) => { if (live) setRes(r); }).catch(() => { if (live) setRes(null); }).finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [clean]);

  const rec = res?.record;
  return (
    <div className="rounded-2xl bg-surface-2 p-3 ring-1 ring-line">
      <label className="block">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink"><Icon name="search" size={15} className="text-muted" /> {t("kyc_gstin_label")}</span>
        <input value={value} onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15))}
          placeholder="e.g. 03PJNXS4821G1ZB" spellCheck={false} autoCapitalize="characters"
          className="tabular mt-1.5 h-12 w-full rounded-xl bg-white px-3 text-base tracking-wider text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-brand-ring" />
      </label>
      <p className="mt-1.5 text-xs text-muted">{t("kyc_gstin_hint")}</p>
      {busy && <p className="mt-2 text-xs text-muted">{t("kyc_checking_registry")}</p>}
      {res && !busy && (
        <div className={`mt-2 rounded-xl px-3 py-2 text-sm ${res.eligible ? "bg-ok-soft text-ok" : "bg-brand-soft text-brand-dark"}`} role="status">
          {res.found && rec ? (
            <>
              <p className="font-bold">{rec.trade_name} · {rec.status === "Active" ? t("kyc_active") : rec.status}</p>
              <p className="text-xs opacity-90">{rec.principal_place_of_business}</p>
              {!res.eligible && <p className="mt-1 text-xs font-semibold">{t("kyc_gst_inactive_note")}</p>}
            </>
          ) : (
            <p className="font-semibold">{res.error === "checksum_failed" ? t("kyc_gstin_checksum") : res.valid ? t("kyc_gstin_not_found") : t("kyc_gstin_bad")}</p>
          )}
        </div>
      )}
    </div>
  );
}

function DigiLockerSheet({ onClose, onPick }: { onClose: () => void; onPick: (s: KycSample) => Promise<void> }) {
  const { t } = useLang();
  const [samples, setSamples] = useState<KycSample[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  useEffect(() => { api.kycSamples().then(setSamples).catch(() => setSamples([])); }, []);
  return (
    <Sheet icon="folder" title={t("kyc_dl_title")} onClose={onClose}>
      <p className="text-sm text-ink-2">{t("kyc_dl_body")}</p>
      <p className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-xs font-medium text-warn">{t("kyc_dl_demo")}</p>
      <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {(samples ?? []).map((s) => (
          <li key={s.id}>
            <button disabled={!!busyId} onClick={async () => { setBusyId(s.id); await onPick(s); setBusyId(null); }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 ring-line hover:bg-surface-2 disabled:opacity-50">
              <span className="tabular grid h-8 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-xs font-bold text-ink-2">{s.id}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{s.business}</span>
              <span className="text-xs text-muted">{busyId === s.id ? "…" : t("kyc_dl_docs", { n: s.docs.length })}</span>
            </button>
          </li>
        ))}
        {!samples && <li className="py-4 text-center text-sm text-muted">…</li>}
      </ul>
    </Sheet>
  );
}

export default function UploadStep({ state, setState, issues, orderId, onSubmit, busy, error }: {
  state: UploadState;
  setState: (s: UploadState) => void;
  issues: KycCheck[]; // failed checks from the last attempt, shown on the right slot
  orderId: string;
  onSubmit: () => void;
  busy: boolean;
  error: string;
}) {
  const { lang, t } = useLang();
  const [dlOpen, setDlOpen] = useState(false);
  const required = ORDER.filter((d) => !(d === "gst_certificate" && state.noGst) && !(d === "udyam_certificate" && state.noUdyam));
  const done = required.filter((d) => state.files[d]).length;
  const issueFor = (d: DocType) => {
    const c = issues.find((x) => x.doc === d && x.result === "fail");
    if (!c) return undefined;
    return lang === "hi" ? c.hi : c.en;
  };

  async function pickSample(s: KycSample) {
    await api.kycDigilocker(orderId).catch(() => {});
    const files: Partial<Record<DocType, File>> = {};
    for (const d of s.docs) files[d] = await api.kycSampleFile(s.id, d);
    setState({ ...state, files, noGst: !s.docs.includes("gst_certificate") && state.noGst, noUdyam: false, gstin: "" });
    setDlOpen(false);
  }

  const toggle = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" /> {label}
    </label>
  );

  return (
    <div className="space-y-4">
      <button onClick={() => setDlOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl bg-[#eef3ff] p-4 text-left ring-1 ring-[#d6e0ff] hover:bg-[#e5edff]">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-info text-white"><Icon name="folder" size={22} /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-ink">{t("kyc_dl_cta")}</span>
          <span className="block text-xs text-ink-2">{t("kyc_dl_cta_sub")}</span>
        </span>
        <Icon name="chevronRight" size={18} className="text-muted" />
      </button>

      <div className="flex items-center gap-3 text-xs font-medium text-muted" aria-hidden><span className="h-px flex-1 bg-line" />{t("kyc_or_upload")}<span className="h-px flex-1 bg-line" /></div>

      {!state.noGst && <GstinBox value={state.gstin} onChange={(gstin) => setState({ ...state, gstin })} />}

      <div className="space-y-2.5">
        {ORDER.filter((d) => required.includes(d)).map((d) => (
          <DocSlot key={d} doc={d} file={state.files[d]} issue={issueFor(d)}
            onFile={(f) => setState({ ...state, files: { ...state.files, [d]: f } })}
            onRemove={() => { const files = { ...state.files }; delete files[d]; setState({ ...state, files }); }} />
        ))}
      </div>

      <div className="space-y-2 rounded-2xl bg-white p-3 ring-1 ring-line">
        {toggle(t("kyc_no_gst"), state.noGst, (v) => setState({ ...state, noGst: v }))}
        {toggle(t("kyc_no_udyam"), state.noUdyam, (v) => setState({ ...state, noUdyam: v }))}
      </div>

      {error && <p role="alert" className="flex items-start gap-2 rounded-2xl bg-brand-soft p-3 text-sm text-brand-dark"><Icon name="info" size={18} className="shrink-0" /> {error}</p>}

      <button onClick={onSubmit} disabled={busy || done === 0}
        className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-bold text-white hover:bg-brand-dark disabled:opacity-40">
        <Icon name="shield" size={19} /> {t("kyc_check_btn", { n: done, total: required.length })}
      </button>
      <p className="flex items-start justify-center gap-1.5 text-center text-[11px] leading-snug text-muted">
        <Icon name="lock" size={12} className="mt-px shrink-0" /> {t("kyc_upload_privacy")}
      </p>

      {dlOpen && <DigiLockerSheet onClose={() => setDlOpen(false)} onPick={pickSample} />}
    </div>
  );
}
