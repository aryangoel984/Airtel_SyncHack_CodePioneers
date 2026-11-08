"use client";
// Step 6: back office for sales teams and channel partners (English only: internal staff screen).
// Shows who the digital journey couldn't close, who should call them, and a "who to call first" score.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/Header";
import Icon, { type IconName } from "@/components/ui/Icon";
import { ApiError, BackendDownError, api } from "@/lib/api";
import type { BoOwner, BoStatus, BoSummary, LeadScore, ModelReport, QueueItem, Reengage, SystemStatus } from "@/lib/types";
import Sheet from "@/components/ui/Sheet";

const PIN_KEY = "udyam_bo_pin";
const SEG: Record<string, string> = { micro: "Micro retail", prof: "Professional office", multi: "Multi-site", mfg: "Manufacturer" };
const rupees = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

type Tab = "queue" | "winback" | "model";

export default function BackOffice() {
  const [pin, setPin] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { setPin(sessionStorage.getItem(PIN_KEY)); } catch { /* storage blocked */ } // eslint-disable-line react-hooks/set-state-in-effect -- read saved PIN
    setReady(true);
  }, []);
  const lock = () => { try { sessionStorage.removeItem(PIN_KEY); } catch { /* ignore */ } setPin(null); };
  if (!ready) return null;
  if (!pin) return <PinGate onOk={(p) => { try { sessionStorage.setItem(PIN_KEY, p); } catch { /* ignore */ } setPin(p); }} />;
  return <Dashboard pin={pin} onLock={lock} />;
}

// ---------------- PIN gate ----------------
function PinGate({ onOk }: { onOk: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try { await api.bo(pin).summary(); onOk(pin); }
    catch (err) { setError(err instanceof ApiError && err.status === 401 ? "Wrong PIN." : err instanceof BackendDownError ? "Can't reach the server." : "Something went wrong."); }
    setBusy(false);
  }
  return (
    <main className="grid min-h-dvh place-items-center bg-ink px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-[var(--shadow-lift)]">
        <div className="flex items-center gap-3"><BrandMark size={40} /><div><p className="font-bold text-ink">Accel Business</p><p className="text-xs text-muted">Back office · staff only</p></div></div>
        <label className="mt-6 block">
          <span className="text-sm font-semibold text-ink">Staff PIN</span>
          <input type="password" inputMode="numeric" autoFocus value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            className="tabular mt-1.5 h-13 w-full rounded-2xl bg-surface-2 px-4 text-center text-2xl tracking-[0.5em] text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-brand-ring" />
        </label>
        {error && <p role="alert" className="mt-2 text-sm text-brand-dark">{error}</p>}
        <button disabled={busy || pin.length < 4} className="mt-4 min-h-12 w-full rounded-2xl bg-brand font-bold text-white disabled:opacity-40">Open back office</button>
        <p className="mt-3 text-center text-[11px] text-muted">Demo PIN: 2468 (set BACKOFFICE_PIN in backend/.env)</p>
        <Link href="/" className="mt-2 block text-center text-xs font-semibold text-ink-2 hover:underline">← Customer app</Link>
      </form>
    </main>
  );
}

// ---------------- dashboard ----------------
function Dashboard({ pin, onLock }: { pin: string; onLock: () => void }) {
  const bo = useMemo(() => api.bo(pin), [pin]);
  const [tab, setTab] = useState<Tab>("queue");
  const [summary, setSummary] = useState<BoSummary | null>(null);
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    setError("");
    api.status().then(setStatus).catch(() => setStatus(null));
    try { const [s, q] = await Promise.all([bo.summary(), bo.queue()]); setSummary(s); setQueue(q); }
    catch (e) { if (e instanceof ApiError && e.status === 401) onLock(); else setError(e instanceof BackendDownError ? "Can't reach the server." : "Couldn't load the back office."); }
  }, [bo, onLock]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load data when the dashboard opens
  useEffect(() => { load(); }, [load]);

  const openCount = queue?.filter((q) => q.status === "New" || q.status === "Contacted").length ?? 0;
  const tabs: [Tab, string, IconName][] = [["queue", `To call (${openCount})`, "phone"], ["winback", "Win back past leads", "refresh"], ["model", "Lead score", "signal"]];

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-ink text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <BrandMark size={32} />
          <p className="font-bold">Back office</p>
          <span className="hidden rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white/80 sm:inline">Sales & partners</span>
          <div className="ml-auto flex items-center gap-2">
            {status?.demoControls && (
              <button onClick={() => setResetOpen(true)} className="hidden h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-1 ring-white/20 hover:bg-white/10 sm:flex">
                <Icon name="bolt" size={15} /> Reset demo
              </button>
            )}
            <button onClick={load} className="grid h-9 w-9 place-items-center rounded-full ring-1 ring-white/20 hover:bg-white/10" aria-label="Refresh"><Icon name="refresh" size={16} /></button>
            <button onClick={onLock} className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-1 ring-white/20 hover:bg-white/10"><Icon name="lock" size={15} /> Lock</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">
        {error && <p role="alert" className="mb-4 rounded-2xl bg-brand-soft p-3 text-sm text-brand-dark">{error}</p>}
        <StatusStrip status={status} />
        {summary && <Funnel s={summary} />}

        <nav className="no-scrollbar mt-6 flex gap-2 overflow-x-auto" aria-label="Sections">
          {tabs.map(([k, label, icon]) => (
            <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
              className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ${tab === k ? "bg-ink text-white" : "bg-white text-ink-2 ring-1 ring-line hover:bg-surface-2"}`}>
              <Icon name={icon} size={16} /> {label}
            </button>
          ))}
        </nav>

        <div className="mt-4">
          {tab === "queue" && (queue ? <Queue items={queue} bo={bo} onChange={(it) => setQueue((q) => (q ?? []).map((x) => (x.id === it.id ? it : x)))} /> : <Skeleton />)}
          {tab === "winback" && <WinBack bo={bo} />}
          {tab === "model" && <ModelView bo={bo} />}
        </div>
      </main>
      {resetOpen && (
        <Sheet icon="bolt" title="Reset demo data?" onClose={() => !resetting && setResetOpen(false)}>
          <p className="text-sm text-ink-2">This removes every test order, call request, chat summary and note, so the next demo starts clean. The 5,000 historic leads, the lead score and the audit log stay. It can&apos;t be undone.</p>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setResetOpen(false)} disabled={resetting} className="min-h-12 flex-1 rounded-2xl font-semibold text-ink-2 ring-1 ring-line hover:bg-surface-2">Cancel</button>
            <button disabled={resetting} onClick={async () => {
              setResetting(true);
              try { await bo.demoReset(); setResetOpen(false); await load(); } catch { setError("Couldn't reset the demo data."); setResetOpen(false); }
              setResetting(false);
            }} className="min-h-12 flex-[2] rounded-2xl bg-brand font-bold text-white hover:bg-brand-dark disabled:opacity-60">{resetting ? "Resetting…" : "Reset demo data"}</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function Skeleton() {
  return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-3xl bg-white ring-1 ring-line" />)}</div>;
}

// ---------------- funnel ----------------
function Funnel({ s }: { s: BoSummary }) {
  const st = s.funnel.stages;
  return (
    <section aria-labelledby="funnel-h">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 id="funnel-h" className="text-2xl font-extrabold tracking-tight text-ink">Digital journey today</h1>
        <p className="text-xs text-muted">{Math.round(s.funnel.aiShare * 100)}% of chats handled by the AI · {s.funnel.callbacks} call requests · {s.funnel.handoffs} hand-overs</p>
      </div>
      <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {st.map((x, i) => (
          <li key={x.key} className="rounded-2xl bg-white p-3.5 ring-1 ring-line">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{x.label}</p>
            <p className="tabular mt-1 text-2xl font-extrabold text-ink">{x.value}</p>
            {i > 0 && st[i - 1].value > 0 && (x.value <= st[i - 1].value
              ? <p className="tabular text-xs text-muted">{Math.round((x.value / st[i - 1].value) * 100)}% of previous</p>
              : <p className="text-xs text-muted">incl. quick-form orders</p>)}
          </li>
        ))}
      </ol>
      {Object.keys(s.funnel.stoppedAt).length > 0 && (
        <p className="mt-2 text-xs text-muted">
          Unfinished chats stopped at: {Object.entries(s.funnel.stoppedAt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.replace(/_/g, " ")} (${v})`).join(" · ")}
        </p>
      )}
    </section>
  );
}

// ---------------- the call queue ----------------
function ScoreBadge({ s }: { s: LeadScore }) {
  const cls = s.band === "High" ? "bg-ok text-white" : s.band === "Medium" ? "bg-amber-400 text-ink" : "bg-line text-ink-2";
  return (
    <span className={`inline-flex flex-col items-center justify-center rounded-2xl px-3 py-1.5 ${cls}`} title="Chance to become a customer, learned from 5,000 past leads">
      <span className="text-[10px] font-bold uppercase tracking-wide">{s.band}</span>
      <span className="tabular text-sm font-extrabold">{pct(s.probability)}</span>
    </span>
  );
}

function Queue({ items, bo, onChange }: { items: QueueItem[]; bo: ReturnType<typeof api.bo>; onChange: (it: QueueItem) => void }) {
  const [owner, setOwner] = useState<"All" | BoOwner>("All");
  const [showDone, setShowDone] = useState(false);
  const owners: ("All" | BoOwner)[] = ["All", "Field sales", "Channel partner", "Inside sales"];
  const list = items.filter((x) => (owner === "All" || x.owner === owner) && (showDone || x.status === "New" || x.status === "Contacted"));

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        {owners.map((o) => (
          <button key={o} onClick={() => setOwner(o)} aria-pressed={owner === o}
            className={`h-9 rounded-full px-3 text-sm font-semibold ${owner === o ? "bg-brand text-white" : "bg-white text-ink-2 ring-1 ring-line"}`}>
            {o} <span className="tabular opacity-70">{o === "All" ? items.length : items.filter((x) => x.owner === o).length}</span>
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-ink-2"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-[var(--color-brand)]" /> Show won / lost</label>
      </div>
      <p className="mt-2 text-xs text-muted">Sorted by urgency (asked for a call first), then by expected value = chance × monthly plan value.</p>

      {list.length === 0 && <p className="mt-6 rounded-3xl bg-white p-8 text-center text-sm text-muted ring-1 ring-line">Nothing to call right now.</p>}
      <ul className="mt-3 space-y-3">
        {list.map((it) => <QueueCard key={it.id} it={it} bo={bo} onChange={onChange} />)}
      </ul>
    </section>
  );
}

function QueueCard({ it, bo, onChange }: { it: QueueItem; bo: ReturnType<typeof api.bo>; onChange: (it: QueueItem) => void }) {
  const [number, setNumber] = useState<string | null>(null);
  const [note, setNote] = useState(it.note);
  const [saving, setSaving] = useState(false);
  const b = it.business;
  const save = async (change: Partial<Pick<QueueItem, "owner" | "status" | "note">>) => {
    setSaving(true);
    try { onChange(await bo.update(it.id, change)); } catch { /* keep the old value */ }
    setSaving(false);
  };
  const facts = [
    b.segment ? SEG[b.segment] : null,
    b.city_tier ? (b.city_tier === 1 ? "Big city" : "Smaller city") : null,
    b.employees != null ? `${b.employees} staff` : null,
    b.sites != null ? `${b.sites} location${b.sites === 1 ? "" : "s"}` : null,
    b.has_gst == null ? null : b.has_gst ? "GST" : "No GST",
    b.language ? b.language.toUpperCase() : null,
  ].filter(Boolean);
  const reasonCls = ["user_asked", "frustrated"].includes(it.reason.code) ? "bg-brand-soft text-brand-dark"
    : it.reason.code.startsWith("kyc") ? "bg-warn-soft text-warn" : "bg-info-soft text-info";

  return (
    <li className={`rounded-3xl bg-white p-4 ring-1 ring-line sm:p-5 ${it.status === "Won" || it.status === "Lost" ? "opacity-60" : ""}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 gap-4">
          <ScoreBadge s={it.score} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${reasonCls}`}>{it.reason.label}</span>
              <span className="tabular text-xs text-muted">{it.id} · {new Date(it.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span>
            </div>
            <p className="mt-1.5 font-bold text-ink">{b.name ?? (it.kind === "callback" ? "Chat customer" : "Order customer")}</p>
            <p className="text-sm text-ink-2">{facts.join(" · ") || "Few details shared"}</p>
            {it.reason.detail && <p className="mt-1 flex items-start gap-1.5 text-xs text-warn"><Icon name="alert" size={13} className="mt-px shrink-0" /> {it.reason.detail}</p>}
            {it.wishes.length > 0 && <p className="mt-1 text-xs text-muted">Wants: {it.wishes.map((w) => w.replace(/_/g, " ")).join(", ")}</p>}
            {it.score.reasons.length > 0 && (
              <p className="mt-1.5 text-xs text-muted">
                Score: {it.score.reasons.map((r) => <span key={r.label} className={r.effect === "up" ? "text-ok" : "text-brand-dark"}>{r.effect === "up" ? "▲" : "▼"} {r.label} </span>)}
              </p>
            )}
          </div>
        </div>

        <div className="grid shrink-0 gap-2 sm:grid-cols-[1fr_1fr] lg:w-[420px]">
          <div className="rounded-2xl bg-surface-2 px-3 py-2 ring-1 ring-line">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Plan value</p>
            <p className="tabular text-sm font-bold text-ink">{it.value_inr ? `${rupees(it.value_inr)}/mo` : "Unknown"}{it.valueEstimated && it.value_inr ? <span className="font-normal text-muted"> est.</span> : null}</p>
          </div>
          <div className="rounded-2xl bg-surface-2 px-3 py-2 ring-1 ring-line">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Contact</p>
            {number ? <a href={`tel:+91${number}`} className="tabular text-sm font-bold text-brand hover:underline">+91 {number}</a>
              : it.mobile_masked ? (
                <button onClick={async () => { try { setNumber((await bo.reveal(it.id)).mobile); } catch { /* ignore */ } }}
                  className="tabular text-sm font-bold text-ink-2 hover:text-brand" title="Showing the number is recorded in the audit log">{it.mobile_masked} · <span className="text-brand">Show</span></button>
              ) : <p className="text-sm text-muted">Not shared</p>}
          </div>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Owner</span>
            <select value={it.owner} onChange={(e) => save({ owner: e.target.value as BoOwner })} disabled={saving}
              className="mt-0.5 h-10 w-full rounded-xl bg-white px-2 text-sm font-semibold text-ink ring-1 ring-line">
              {(["Field sales", "Channel partner", "Inside sales"] as BoOwner[]).map((o) => <option key={o}>{o}</option>)}
            </select>
            <span className="mt-0.5 block text-[11px] text-muted">{it.ownerWhy}</span>
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Status</span>
            <select value={it.status} onChange={(e) => save({ status: e.target.value as BoStatus })} disabled={saving}
              className="mt-0.5 h-10 w-full rounded-xl bg-white px-2 text-sm font-semibold text-ink ring-1 ring-line">
              {(["New", "Contacted", "Won", "Lost"] as BoStatus[]).map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
          <input value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== it.note && save({ note })} placeholder="Add a note…"
            className="h-10 rounded-xl bg-white px-3 text-sm text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-brand-ring sm:col-span-2" />
          {it.kind === "order" && (
            <Link href={`/order/${it.id}`} target="_blank" className="text-xs font-semibold text-ink-2 hover:underline sm:col-span-2">Open the customer&apos;s order →</Link>
          )}
        </div>
      </div>
    </li>
  );
}

// ---------------- win back past leads ----------------
function WinBack({ bo }: { bo: ReturnType<typeof api.bo> }) {
  const [r, setR] = useState<Reengage | null>(null);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  useEffect(() => { bo.reengage().then(setR).catch(() => setR(null)); }, [bo]);
  if (!r) return <Skeleton />;
  return (
    <section>
      <div className="rounded-3xl bg-ink p-5 text-white sm:p-6">
        <p className="text-sm text-white/70">Past leads (Apr–Jun) lost only because nobody visited or reached them</p>
        <p className="tabular mt-1 text-4xl font-extrabold">{r.pool.toLocaleString("en-IN")}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {Object.entries(r.byReason).map(([k, v]) => <span key={k} className="tabular rounded-full bg-white/10 px-2.5 py-1">{k}: {v}</span>)}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Stat k="Expected customers if we contact the top 20%" v={String(r.expectedCustomersTop20)} />
          <Stat k="Monthly revenue from them" v={rupees(r.expectedMonthlyTop20)} />
          <Stat k="Expected customers if we contact all" v={String(r.expectedCustomersAll)} />
        </div>
        <p className="mt-4 text-xs text-white/60">Idea: these leads never got a visit. Send each one a WhatsApp link to the AI advisor. No visit needed, and the score says who to try first.</p>
      </div>

      <div className="mt-4 overflow-x-auto rounded-3xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
            <tr><th className="px-4 py-3">Score</th><th className="px-2 py-3">Business</th><th className="px-2 py-3">Lost because</th><th className="px-2 py-3">Typical value</th><th className="px-2 py-3">Best owner</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody>
            {r.leads.map((l) => (
              <tr key={l.lead_id} className="border-b border-line last:border-0">
                <td className="px-4 py-3"><ScoreBadge s={l.score} /></td>
                <td className="px-2 py-3">
                  <p className="font-semibold text-ink">{l.business_name}</p>
                  <p className="text-xs text-muted">{l.contact_name} · {l.segment ? SEG[l.segment] : ""} · {l.city} · {l.language} · {l.lead_id}</p>
                </td>
                <td className="px-2 py-3 text-ink-2">{l.drop_reason}</td>
                <td className="tabular px-2 py-3 text-ink-2">{rupees(l.value_inr)}/mo</td>
                <td className="px-2 py-3 text-ink-2">{l.channel}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setSent((s) => ({ ...s, [l.lead_id]: true }))} disabled={sent[l.lead_id]}
                    className="h-9 whitespace-nowrap rounded-full px-3 text-xs font-bold text-ink ring-1 ring-line hover:bg-surface-2 disabled:bg-ok-soft disabled:text-ok disabled:ring-0">
                    {sent[l.lead_id] ? "✓ Link sent (demo)" : "Send WhatsApp link"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">Showing the 50 with the highest expected value. Data: smb_leads.csv (synthetic).</p>
    </section>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div className="rounded-2xl bg-white/10 p-3"><p className="text-xs text-white/70">{k}</p><p className="tabular mt-0.5 text-2xl font-extrabold">{v}</p></div>;
}

// ---------------- how the score works ----------------
function ModelView({ bo }: { bo: ReturnType<typeof api.bo> }) {
  const [m, setM] = useState<ModelReport | null>(null);
  useEffect(() => { bo.model().then(setM).catch(() => setM(null)); }, [bo]);
  if (!m) return <Skeleton />;
  const maxRate = Math.max(...m.deciles.map((d) => d.rate));
  const maxW = Math.max(...m.factors.map((f) => Math.abs(f.weight)));
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-3xl bg-white p-5 ring-1 ring-line sm:p-6">
        <h2 className="font-bold text-ink">How good is the score?</h2>
        <p className="mt-1 text-sm text-muted">
          Learned from {m.trainedOn.toLocaleString("en-IN")} past leads, then tested on {m.testedOn.toLocaleString("en-IN")} leads it had never seen.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-surface-2 p-3"><p className="text-[11px] text-muted">Average lead</p><p className="tabular text-xl font-extrabold text-ink">{pct(m.baseRate)}</p><p className="text-[11px] text-muted">became customers</p></div>
          <div className="rounded-2xl bg-ok-soft p-3"><p className="text-[11px] text-muted">Top 20% by score</p><p className="tabular text-xl font-extrabold text-ok">{pct(m.top20Rate)}</p><p className="text-[11px] text-muted">became customers</p></div>
          <div className="rounded-2xl bg-surface-2 p-3"><p className="text-[11px] text-muted">That is</p><p className="tabular text-xl font-extrabold text-ink">{m.lift}×</p><p className="text-[11px] text-muted">better than random</p></div>
        </div>
        <p className="mt-3 text-xs text-muted">Ranking quality (AUC): {m.auc}. 0.5 is a coin toss, 1.0 is perfect.</p>

        <h3 className="mt-6 text-sm font-bold text-ink">Customers per score group (tested leads)</h3>
        <div className="mt-3 flex h-40 items-end gap-1.5" role="img" aria-label="Activation rate falls from the highest-scored group to the lowest">
          {m.deciles.map((d) => (
            <div key={d.decile} className="flex flex-1 flex-col items-center gap-1">
              <span className="tabular text-[10px] text-muted">{Math.round(d.rate * 100)}%</span>
              <div className={`w-full rounded-t-md ${d.decile <= 2 ? "bg-ok" : "bg-line"}`} style={{ height: `${Math.max(3, (d.rate / maxRate) * 120)}px` }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted"><span>Highest scores</span><span>Lowest scores</span></div>
      </div>

      <div className="rounded-3xl bg-white p-5 ring-1 ring-line sm:p-6">
        <h2 className="font-bold text-ink">What moves the score</h2>
        <p className="mt-1 text-sm text-muted">Green raises the chance of becoming a customer, red lowers it.</p>
        <ul className="mt-4 space-y-2">
          {m.factors.slice(0, 14).map((f) => (
            <li key={f.name} className="grid grid-cols-[1fr_120px] items-center gap-3 text-sm">
              <span className="text-ink-2">{f.label}</span>
              <span className="flex h-3 items-center">
                <span className="relative h-full w-full">
                  <span className="absolute left-1/2 top-0 h-full w-px bg-line" />
                  <span className={`absolute top-0 h-full rounded ${f.weight > 0 ? "left-1/2 bg-ok" : "right-1/2 bg-brand"}`}
                    style={{ width: `${(Math.abs(f.weight) / maxW) * 50}%` }} />
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">Model: logistic regression trained in the backend at start-up (no outside service). Live leads often miss some details; missing details count as average.</p>
      </div>
    </section>
  );
}

// ---------- system status: is the AI live, is the document reader loaded? ----------
function StatusStrip({ status }: { status: SystemStatus | null }) {
  if (!status) return null;
  const ai = status.ai.state === "live"
    ? { tone: "bg-ok", text: status.ai.usingBackupKey ? "AI advisor live (backup key)" : "AI advisor live" }
    : status.ai.state === "degraded"
      ? { tone: "bg-amber-400", text: "AI busy: chats use simple mode until it recovers" }
      : { tone: "bg-amber-400", text: "AI not configured: simple mode" };
  const ocr = status.ocr.ready ? { tone: "bg-ok", text: "Document reader ready" } : { tone: "bg-amber-400", text: "Document reader warming up" };
  const items = [ai, ocr, { tone: status.ai.backupKey ? "bg-ok" : "bg-line", text: status.ai.backupKey ? "Backup AI key set" : "No backup AI key" }];
  return (
    <div className="mb-4 flex flex-wrap gap-2" aria-label="System status">
      {items.map((i) => (
        <span key={i.text} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink-2 ring-1 ring-line">
          <span className={`h-2 w-2 rounded-full ${i.tone}`} aria-hidden /> {i.text}
        </span>
      ))}
    </div>
  );
}
