"use client";
// Smart KYC (Step 4): consent -> documents -> checks -> e-sign.
// Everything is decided by the backend; this page only shows the steps.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Header from "@/components/Header";
import ErrorBox from "@/components/ErrorBox";
import JourneySteps from "@/components/ui/JourneySteps";
import Icon, { type IconName } from "@/components/ui/Icon";
import { useLang } from "@/lib/LangContext";
import { ApiError, BackendDownError, api } from "@/lib/api";
import { rupees } from "@/lib/i18n";
import type { KycCheck, Order } from "@/lib/types";
import UploadStep, { type UploadState } from "./UploadStep";
import ResultsStep from "./ResultsStep";

type View = "consent" | "upload" | "checking" | "results" | "esign" | "done";
const AFTER_KYC = ["KYC_VERIFIED", "SITE_CHECK", "TECH_SCHEDULED", "INSTALLED", "ACTIVE"];

function initialView(o: Order): View {
  if (AFTER_KYC.includes(o.status)) return "done";
  if (!o.kyc.consent) return "consent";
  if (o.kyc.result) return "results";
  return "upload";
}

export default function KycView() {
  const { id } = useParams<{ id: string }>();
  const { lang, t } = useLang();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [view, setView] = useState<View>("consent");
  const [upload, setUpload] = useState<UploadState>({ files: {}, noGst: false, noUdyam: false, gstin: "" });
  const [issues, setIssues] = useState<KycCheck[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [callAsked, setCallAsked] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const o = await api.getOrder(id);
      setOrder(o);
      setView(initialView(o));
      setUpload((u) => ({ ...u, noGst: !o.profile.has_valid_active_gstin }));
      if (o.kyc.result) setIssues(o.kyc.result.checks.filter((c) => c.result === "fail"));
    } catch (e) { setLoadError(e); }
  }, [id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch the order when the page opens
  useEffect(() => { load(); }, [load]);

  const msg = (e: unknown) => e instanceof BackendDownError ? t("server_down") : e instanceof ApiError ? e.message : t("something_wrong");
  const refresh = async () => { const o = await api.getOrder(id); setOrder(o); return o; };

  async function acceptConsent() {
    setBusy(true); setError("");
    try { await api.kycConsent(id, lang); await refresh(); setView("upload"); } catch (e) { setError(msg(e)); }
    setBusy(false);
  }

  /** When the customer replaces or removes a document, its old problem message disappears. */
  function changeUpload(next: UploadState) {
    setIssues((list) => list.filter((c) => c.doc === "overall" || next.files[c.doc] === upload.files[c.doc]));
    setUpload(next);
  }

  async function runChecks() {
    setBusy(true); setError(""); setView("checking");
    try {
      await api.kycVerify(id, upload.files, { noGst: upload.noGst, noUdyam: upload.noUdyam, gstin: upload.gstin || undefined });
      const o = await refresh();
      setIssues(o.kyc.result?.checks.filter((c) => c.result === "fail") ?? []);
      setView("results");
      window.scrollTo({ top: 0 });
    } catch (e) { setError(msg(e)); setView("upload"); }
    setBusy(false);
  }

  // ---------- shell ----------
  const step = view === "done" ? 3 : 2;
  const shell = (body: React.ReactNode) => (
    <>
      <Header />
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6"><JourneySteps current={step} compact /></div>
      </div>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16 pt-5 sm:px-6 lg:pt-8">{body}</main>
    </>
  );

  if (loadError instanceof ApiError && loadError.status === 404) {
    return shell(<p className="rounded-3xl bg-white p-8 text-center ring-1 ring-line">{t("order_not_found")}</p>);
  }
  if (loadError) return shell(<ErrorBox error={loadError} onRetry={load} />);
  if (!order) return shell(<div className="h-64 animate-pulse rounded-3xl bg-white ring-1 ring-line" aria-busy="true" />);

  const title = (
    <div className="mb-5">
      <Link href={`/order/${order.id}`} className="mb-2 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink">
        <Icon name="arrowLeft" size={16} /> {t("kyc_back_order", { id: order.id })}
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{t("kyc_title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("kyc_sub")}</p>
      <KycSteps view={view} />
    </div>
  );

  // ---------- 1. consent ----------
  if (view === "consent") {
    const items: [IconName, string, string][] = [
      ["doc", t("kyc_c_what"), t("kyc_c_what_sub")],
      ["shield", t("kyc_c_why"), t("kyc_c_why_sub")],
      ["clock", t("kyc_c_keep"), t("kyc_c_keep_sub")],
      ["lock", t("kyc_c_ai"), t("kyc_c_ai_sub")],
      ["user", t("kyc_c_rights"), t("kyc_c_rights_sub")],
    ];
    return shell(
      <>
        {title}
        <section className="rounded-3xl bg-white p-5 ring-1 ring-line sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><Icon name="lock" size={20} className="text-brand" /> {t("kyc_c_title")}</h2>
          <ul className="mt-4 space-y-4">
            {items.map(([icon, head, body]) => (
              <li key={head} className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2"><Icon name={icon} size={18} /></span>
                <span><span className="block text-sm font-bold text-ink">{head}</span><span className="block text-sm leading-snug text-muted">{body}</span></span>
              </li>
            ))}
          </ul>
          <ConsentBox busy={busy} onAccept={acceptConsent} />
          {error && <p role="alert" className="mt-3 text-sm text-brand-dark">{error}</p>}
        </section>
      </>,
    );
  }

  // ---------- 2. upload ----------
  if (view === "upload") {
    return shell(
      <>
        {title}
        <UploadStep state={upload} setState={changeUpload} issues={issues} orderId={order.id} onSubmit={runChecks} busy={busy} error={error} />
      </>,
    );
  }

  // ---------- checking ----------
  if (view === "checking") return shell(<>{title}<Checking /></>);

  // ---------- 3. results ----------
  if (view === "results" && order.kyc.result) {
    return shell(
      <>
        {title}
        {callAsked && (
          <p className="mb-4 flex items-center gap-2 rounded-2xl bg-info-soft px-4 py-3 text-sm text-info">
            <Icon name="headset" size={18} className="shrink-0" /> {t("kyc_call_done", { m: order.mobile_masked })}
          </p>
        )}
        <ResultsStep result={order.kyc.result} onFix={() => setView("upload")} onSign={() => setView("esign")} onCall={() => setCallAsked(true)} />
      </>,
    );
  }

  // ---------- 4. e-sign ----------
  if (view === "esign") {
    return shell(<>{title}<Esign order={order} onDone={async () => { await refresh(); setView("done"); }} /></>);
  }

  // ---------- done ----------
  return shell(
    <section className="animate-pop rounded-3xl bg-white p-6 text-center ring-1 ring-line sm:p-8">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ok-soft text-ok"><Icon name="checkCircle" size={34} /></span>
      <h1 className="mt-4 text-2xl font-extrabold text-ink">{t("kyc_done_title")}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{t("kyc_done_sub")}</p>
      {order.kyc.esign && <p className="mt-3 text-xs text-muted">{t("kyc_signed_by", { name: order.kyc.esign.name })}</p>}
      <button onClick={() => router.push(`/order/${order.id}`)}
        className="mt-6 inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-brand px-6 text-base font-bold text-white hover:bg-brand-dark">
        <Icon name="clock" size={19} /> {t("kyc_track_btn")}
      </button>
    </section>,
  );
}

function KycSteps({ view }: { view: View }) {
  const { t } = useLang();
  const steps = ["kyc_s_consent", "kyc_s_docs", "kyc_s_check", "kyc_s_sign"];
  const idx = { consent: 0, upload: 1, checking: 2, results: 2, esign: 3, done: 4 }[view];
  return (
    <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label={t("kyc_title")}>
      {steps.map((s, i) => (
        <li key={s}>
          <span className={`block h-1.5 rounded-full ${i < idx ? "bg-ok" : i === idx ? "bg-brand" : "bg-line"}`} />
          <span className={`mt-1 block truncate text-[11px] font-semibold ${i === idx ? "text-ink" : "text-muted"}`}>{t(s)}</span>
        </li>
      ))}
    </ol>
  );
}

function ConsentBox({ busy, onAccept }: { busy: boolean; onAccept: () => void }) {
  const { t } = useLang();
  const [ok, setOk] = useState(false);
  return (
    <div className="mt-6 border-t border-line pt-5">
      <label className="flex cursor-pointer items-start gap-3 text-sm text-ink">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-brand)]" />
        <span>{t("kyc_c_agree")}</span>
      </label>
      <button onClick={onAccept} disabled={!ok || busy}
        className="mt-4 flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-bold text-white hover:bg-brand-dark disabled:opacity-40">
        {t("kyc_c_btn")} <Icon name="arrowRight" size={18} />
      </button>
    </div>
  );
}

/** Progress animation while the server reads the documents (usually 3-10 seconds). */
function Checking() {
  const { t } = useLang();
  const steps = ["kyc_p1", "kyc_p2", "kyc_p3", "kyc_p4"];
  const [i, setI] = useState(0);
  useEffect(() => { const h = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 1600); return () => clearInterval(h); }, [steps.length]);
  return (
    <section className="rounded-3xl bg-white p-6 ring-1 ring-line" role="status" aria-live="polite">
      <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-line border-t-brand" />
      <p className="mt-4 text-center font-bold text-ink">{t("kyc_checking")}</p>
      <ul className="mx-auto mt-4 max-w-xs space-y-2">
        {steps.map((s, n) => (
          <li key={s} className={`flex items-center gap-2 text-sm ${n < i ? "text-ok" : n === i ? "font-semibold text-ink" : "text-muted"}`}>
            <Icon name={n < i ? "checkCircle" : "clock"} size={16} /> {t(s)}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Esign({ order, onDone }: { order: Order; onDone: () => void }) {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState<{ sentTo: string; demoOtp: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const otpRef = useRef<HTMLInputElement>(null);
  const q = order.quote;

  async function send() {
    setBusy(true); setError("");
    try { setSent(await api.kycEsignStart(order.id)); setTimeout(() => otpRef.current?.focus(), 50); }
    catch (e) { setError(e instanceof ApiError ? e.message : t("something_wrong")); }
    setBusy(false);
  }
  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try { await api.kycEsignConfirm(order.id, name, otp); onDone(); }
    catch (err) { setError(err instanceof ApiError ? err.message : t("something_wrong")); setBusy(false); }
  }

  return (
    <form onSubmit={confirm} className="space-y-4">
      <section className="rounded-3xl bg-white p-5 ring-1 ring-line">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><Icon name="pen" size={20} className="text-brand" /> {t("kyc_e_title")}</h2>
        <div className="tabular mt-3 rounded-2xl bg-surface-2 p-4 text-sm ring-1 ring-line">
          <p className="font-semibold text-ink">{t("kyc_e_agreement", { id: order.id })}</p>
          <ul className="mt-2 space-y-1 text-ink-2">
            <li>• {t("kyc_e_l1", { price: rupees(q.monthly_total_inr), n: q.lines.length })}</li>
            <li>• {t("kyc_e_l2", { setup: rupees(q.one_time_setup_total_inr) })}</li>
            <li>• {t("kyc_e_l3", { n: q.contract_months })}</li>
            <li>• {t("gst_note")}</li>
          </ul>
        </div>
        <label className="mt-4 block">
          <span className="text-sm font-semibold text-ink">{t("kyc_e_name")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name"
            className="mt-1.5 h-12 w-full rounded-xl bg-surface-2 px-3 text-base text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-brand-ring" />
        </label>
        {!sent ? (
          <button type="button" onClick={send} disabled={busy || name.trim().length < 2}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink font-bold text-white disabled:opacity-40">
            <Icon name="phone" size={18} /> {t("kyc_e_send", { m: order.mobile_masked })}
          </button>
        ) : (
          <>
            <p className="mt-4 rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">{t("kyc_e_demo", { m: sent.sentTo, code: sent.demoOtp })}</p>
            <label className="mt-3 block">
              <span className="text-sm font-semibold text-ink">{t("kyc_e_otp")}</span>
              <input ref={otpRef} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code"
                className="tabular mt-1.5 h-13 w-full rounded-xl bg-surface-2 px-3 text-center text-2xl font-bold tracking-[0.4em] text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-brand-ring" />
            </label>
            <button type="submit" disabled={busy || otp.length !== 6}
              className="mt-4 flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-bold text-white hover:bg-brand-dark disabled:opacity-40">
              <Icon name="check" size={19} strokeWidth={2.6} /> {t("kyc_e_confirm")}
            </button>
            <button type="button" onClick={send} disabled={busy} className="mt-1 min-h-10 w-full text-sm font-semibold text-ink-2">{t("kyc_e_resend")}</button>
          </>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-brand-dark">{error}</p>}
      </section>
    </form>
  );
}
