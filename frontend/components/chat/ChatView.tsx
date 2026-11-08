"use client";
// The AI Advisor chat. All plans, prices and eligibility come from the backend as structured data.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header, { BrandMark } from "@/components/Header";
import { useLang } from "@/lib/LangContext";
import { ApiError, BackendDownError, api } from "@/lib/api";
import { CHAT_LANGUAGES } from "@/lib/i18n";
import { saveProfile } from "@/lib/profile";
import {
  ChatMessage, clearChat, loadChat, saveAdvisorSessionId, saveChat, saveInitialItems,
} from "@/lib/advisorStore";
import type { AdvisorProfileView, ChatLang, ChatResponse, QuickReply, Recommendation } from "@/lib/types";
import Icon from "@/components/ui/Icon";
import RecommendationCard from "./RecommendationCard";
import MicButton from "./MicButton";
import { speak, speechSupported, stopSpeaking } from "@/lib/speech";
import PersonDialog from "./PersonDialog";
import Landing from "./Landing";
import BusinessPanel, { ProgressStrip } from "./BusinessPanel";

const VOICE_KEY = "udyam_voice_replies";

export default function ChatView() {
  const { t, setLang } = useLang();
  const router = useRouter();

  const [chatLang, setChatLang] = useState<ChatLang | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chips, setChips] = useState<QuickReply[]>([]);
  const [mode, setMode] = useState<"ai" | "guided">("ai");
  const [handoff, setHandoff] = useState(false);
  const [profile, setProfile] = useState<AdvisorProfileView | null>(null);
  const [missing, setMissing] = useState<string[] | undefined>();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const voiceOnRef = useRef(false);

  const lastRecId = useRef(0);
  const nextId = useRef(1);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore the chat when the customer comes back from /quote.
  useEffect(() => {
    const saved = loadChat();
    if (saved) {
      /* eslint-disable react-hooks/set-state-in-effect -- restoring saved browser state on load */
      setChatLang(saved.lang); setSessionId(saved.sessionId); setMessages(saved.messages);
      setChips(saved.quickReplies); setMode(saved.mode); setHandoff(saved.handoff);
      setProfile(saved.profile ?? null); setMissing(saved.missingSlots);
      /* eslint-enable react-hooks/set-state-in-effect */
      nextId.current = Math.max(0, ...saved.messages.map((m) => m.id)) + 1;
      lastRecId.current = Math.max(0, ...saved.messages.map((m) => m.rec?.id ?? 0));
    }
    setReady(true);
  }, []);

  // Voice replies: only where the browser can speak; the choice is remembered on this device.
  useEffect(() => {
    if (!speechSupported()) return;
    /* eslint-disable react-hooks/set-state-in-effect -- browser-only feature check + saved preference */
    setCanSpeak(true);
    let on = false;
    try { on = localStorage.getItem(VOICE_KEY) === "1"; } catch { /* storage blocked */ }
    setVoiceOn(on); voiceOnRef.current = on;
    /* eslint-enable react-hooks/set-state-in-effect */
    window.speechSynthesis.getVoices(); // starts loading the voice list
    return () => stopSpeaking();
  }, []);

  const speakMessage = useCallback((id: number, text: string, lang: ChatLang | null) => {
    const code = CHAT_LANGUAGES.find((l) => l.code === lang)?.speech ?? "en-IN";
    setSpeakingId(id);
    speak(text, code, () => setSpeakingId((cur) => (cur === id ? null : cur)));
  }, []);

  function toggleVoice() {
    const on = !voiceOn;
    setVoiceOn(on); voiceOnRef.current = on;
    try { localStorage.setItem(VOICE_KEY, on ? "1" : "0"); } catch { /* storage blocked */ }
    if (!on) { stopSpeaking(); setSpeakingId(null); }
    else {
      const last = [...messages].reverse().find((m) => m.role === "bot");
      if (last) speakMessage(last.id, last.text, chatLang); // speak now: this tap also unlocks audio on phones
    }
  }

  // Save after every change, and keep the newest message in view.
  useEffect(() => {
    if (!ready || !chatLang || !sessionId) return;
    saveChat({ sessionId, lang: chatLang, messages, quickReplies: chips, mode, handoff, profile, missingSlots: missing });
  }, [ready, chatLang, sessionId, messages, chips, mode, handoff, profile, missing]);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, busy, chips]);

  const friendlyError = useCallback((e: unknown) => {
    if (e instanceof BackendDownError) return t("server_down");
    if (e instanceof ApiError && e.status === 429) return t("rate_limited");
    return t("adv_sorry");
  }, [t]);

  function apply(r: ChatResponse, lang: ChatLang | null = chatLang) {
    setSessionId(r.sessionId);
    saveAdvisorSessionId(r.sessionId);
    const showCard = r.recommendation && r.recommendation.id !== lastRecId.current;
    if (showCard) lastRecId.current = r.recommendation!.id;
    const id = nextId.current++;
    setMessages((m) => [...m, { id, role: "bot", text: r.reply, rec: showCard ? r.recommendation! : undefined }]);
    if (voiceOnRef.current) speakMessage(id, r.reply, lang);
    setChips(r.quickReplies);
    setMode(r.mode);
    setHandoff(!!r.handoff);
    setProfile(r.profile ?? null);
    setMissing(r.missingSlots);
  }

  async function pickLanguage(code: ChatLang) {
    setError(""); setBusy(true);
    setChatLang(code);
    setLang(code === "hi" ? "hi" : "en"); // the screen text is English or Hindi
    try {
      lastRecId.current = 0;
      apply(await api.advisorStart(code), code);
    } catch (e) {
      setError(friendlyError(e)); setChatLang(null);
    }
    setBusy(false);
  }

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy || !chatLang) return;
    setError(""); setInput(""); setChips([]);
    stopSpeaking(); setSpeakingId(null);
    setMessages((m) => [...m, { id: nextId.current++, role: "user", text: msg }]);
    setBusy(true);
    try {
      apply(await api.advisorChat(sessionId, msg, chatLang));
    } catch (e) {
      setError(friendlyError(e));
    }
    setBusy(false);
    inputRef.current?.focus({ preventScroll: true });
  }

  function buy(rec: Recommendation) {
    saveProfile(rec.profile);
    saveInitialItems(rec.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })));
    if (sessionId) api.advisorEvent(sessionId, "quote_opened").catch(() => {}); // best effort
    router.push("/quote");
  }

  function restart() {
    stopSpeaking(); setSpeakingId(null);
    clearChat();
    setChatLang(null); setSessionId(undefined); setMessages([]); setChips([]); setMode("ai");
    setHandoff(false); setError(""); setProfile(null); setMissing(undefined); lastRecId.current = 0;
  }

  // ---------- Landing + language picker ----------
  if (!ready) return <><Header /><main className="flex-1" /></>;
  if (!chatLang || messages.length === 0) {
    return (
      <>
        <Header />
        <Landing busy={busy} error={error} onPick={pickLanguage} />
      </>
    );
  }

  // ---------- Chat ----------
  const speech = CHAT_LANGUAGES.find((l) => l.code === chatLang)?.speech ?? "en-IN";
  const langLabel = CHAT_LANGUAGES.find((l) => l.code === chatLang)?.label ?? "";
  const hasPlan = messages.some((m) => m.rec);

  return (
    <div className="flex h-dvh flex-col">
      <Header />
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 gap-6 lg:px-6 lg:py-5">
        {/* Chat panel */}
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white lg:rounded-3xl lg:shadow-[var(--shadow-card)] lg:ring-1 lg:ring-line" aria-label={t("adv_title")}>
          {/* Advisor bar */}
          <div className="flex items-center gap-3 border-b border-line px-4 py-2.5 sm:px-5">
            <span className="relative">
              <BrandMark size={38} />
              <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${mode === "guided" ? "bg-amber-400" : "bg-ok"}`} aria-hidden />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[15px] font-bold text-ink">{t("adv_title")}</p>
              <p className="truncate text-xs text-muted">
                {mode === "guided" ? t("adv_status_simple") : t("adv_status_online")} · {langLabel}
              </p>
            </div>
            {canSpeak && (
              <button onClick={toggleVoice} aria-pressed={voiceOn} title={voiceOn ? t("adv_voice_on") : t("adv_voice_off")}
                aria-label={voiceOn ? t("adv_voice_on") : t("adv_voice_off")}
                className={`grid h-10 w-10 place-items-center rounded-full ring-1 transition-colors ${voiceOn ? "bg-brand text-white ring-brand" : "text-ink-2 ring-line hover:bg-surface-2"}`}>
                <Icon name={voiceOn ? "speaker" : "speakerOff"} size={18} />
              </button>
            )}
            <button onClick={() => setPersonOpen(true)} disabled={!sessionId}
              className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-2 ring-1 ring-line hover:bg-surface-2 lg:hidden"
              aria-label={t("adv_person")}>
              <Icon name="headset" size={18} /><span className="hidden sm:inline">{t("adv_person_short")}</span>
            </button>
            <button onClick={restart} className="grid h-10 w-10 place-items-center rounded-full text-ink-2 ring-1 ring-line hover:bg-surface-2"
              aria-label={t("adv_new_chat")} title={t("adv_new_chat")}>
              <Icon name="refresh" size={18} />
            </button>
          </div>
          <ProgressStrip profile={profile} missing={missing} hasPlan={hasPlan} />

          {/* Messages */}
          <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-surface-2 px-3 py-5 sm:px-6" aria-live="polite">
            {mode === "guided" && (
              <p className="mx-auto flex max-w-md items-center justify-center gap-1.5 rounded-full bg-warn-soft px-3 py-1.5 text-center text-xs font-medium text-warn">
                <Icon name="info" size={14} className="shrink-0" /> {t("adv_guided_note")}
              </p>
            )}
            {messages.map((m) => m.role === "user" ? (
              <div key={m.id} className="flex animate-rise justify-end">
                <p className="max-w-[82%] whitespace-pre-wrap rounded-3xl rounded-br-md bg-brand px-4 py-2.5 text-[15px] leading-relaxed text-white shadow-sm">
                  {m.text}
                </p>
              </div>
            ) : (
              <div key={m.id} className="flex animate-rise items-end gap-2">
                <span className="mb-0.5 hidden shrink-0 self-start sm:block"><BrandMark size={28} /></span>
                <div className="min-w-0 max-w-[92%] sm:max-w-[80%]">
                  <p className="whitespace-pre-wrap rounded-3xl rounded-tl-md bg-white px-4 py-2.5 text-[15px] leading-relaxed text-ink shadow-sm ring-1 ring-line">
                    {m.text}
                  </p>
                  {canSpeak && (
                    <button type="button" onClick={() => (speakingId === m.id ? (stopSpeaking(), setSpeakingId(null)) : speakMessage(m.id, m.text, chatLang))}
                      className={`ml-2 mt-1 inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold transition-colors ${speakingId === m.id ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-white hover:text-ink"}`}>
                      <Icon name={speakingId === m.id ? "stop" : "speaker"} size={14} />
                      {speakingId === m.id ? t("adv_speak_stop") : t("adv_speak")}
                    </button>
                  )}
                  {m.rec && <RecommendationCard rec={m.rec} onBuy={() => buy(m.rec!)} />}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex items-end gap-2" role="status" aria-label={t("adv_typing")}>
                <span className="hidden sm:block"><BrandMark size={28} /></span>
                <div className="flex gap-1 rounded-3xl rounded-tl-md bg-white px-4 py-3.5 shadow-sm ring-1 ring-line">
                  {[0, 150, 300].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-muted/60" style={{ animationDelay: `${d}ms` }} />)}
                </div>
              </div>
            )}
            {handoff && (
              <p className="mx-auto flex max-w-md items-center gap-2 rounded-2xl bg-info-soft px-4 py-3 text-sm text-info">
                <Icon name="headset" size={18} className="shrink-0" /> {t("adv_person_done")}
              </p>
            )}
            {error && (
              <p role="alert" className="mx-auto flex max-w-md items-center gap-2 rounded-2xl bg-brand-soft px-4 py-3 text-sm text-brand-dark">
                <Icon name="info" size={18} className="shrink-0" /> {error}
              </p>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-line bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 sm:px-5">
            {chips.length > 0 && !busy && (
              <div className="no-scrollbar -mx-3 mb-2.5 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0">
                {chips.map((c) => (
                  <button key={c.label} onClick={() => send(c.value)}
                    className="h-10 shrink-0 rounded-full bg-white px-4 text-sm font-semibold text-ink ring-1 ring-line transition-colors hover:bg-brand-soft hover:text-brand-dark hover:ring-brand-ring">
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            <form className="flex items-center gap-1.5 rounded-full bg-surface-2 p-1.5 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand-ring"
              onSubmit={(e) => { e.preventDefault(); send(input); }}>
              <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} disabled={busy}
                placeholder={t("adv_placeholder")} aria-label={t("adv_placeholder")}
                className="h-11 min-w-0 flex-1 bg-transparent pl-3 text-base text-ink outline-none placeholder:text-muted focus-visible:outline-none" />
              <MicButton speechLang={speech} onText={(txt) => setInput((v) => (v ? v + " " : "") + txt)} disabled={busy} />
              <button type="submit" disabled={busy || !input.trim()} aria-label={t("adv_send")}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-dark disabled:bg-line disabled:text-muted">
                <Icon name="send" size={19} />
              </button>
            </form>
            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-muted">
              <span className="flex min-w-0 items-center gap-1"><Icon name="lock" size={12} className="shrink-0" /><span className="truncate">{t("adv_notice")}</span></span>
              <Link href="/form" className="shrink-0 font-semibold text-ink-2 underline-offset-2 hover:underline">{t("adv_form_short")}</Link>
            </div>
          </div>
        </section>

        <div className="w-80 shrink-0 max-lg:hidden">
          <BusinessPanel profile={profile} missing={missing} hasPlan={hasPlan} onPerson={() => setPersonOpen(true)} />
        </div>
      </div>

      {personOpen && sessionId && <PersonDialog sessionId={sessionId} onClose={() => setPersonOpen(false)} />}
    </div>
  );
}
