"use client";
// The AI Advisor chat. All plans, prices and eligibility come from the backend as structured data.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useLang } from "@/lib/LangContext";
import { ApiError, BackendDownError, api } from "@/lib/api";
import { CHAT_LANGUAGES } from "@/lib/i18n";
import { saveProfile } from "@/lib/profile";
import {
  ChatMessage, clearChat, loadChat, saveAdvisorSessionId, saveChat, saveInitialItems,
} from "@/lib/advisorStore";
import type { ChatLang, ChatResponse, QuickReply, Recommendation } from "@/lib/types";
import RecommendationCard from "./RecommendationCard";
import MicButton from "./MicButton";
import PersonDialog from "./PersonDialog";

export default function ChatView() {
  const { t, setLang } = useLang();
  const router = useRouter();

  const [chatLang, setChatLang] = useState<ChatLang | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chips, setChips] = useState<QuickReply[]>([]);
  const [mode, setMode] = useState<"ai" | "guided">("ai");
  const [handoff, setHandoff] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);

  const lastRecId = useRef(0);
  const nextId = useRef(1);
  const bottom = useRef<HTMLDivElement>(null);

  // Restore the chat when the customer comes back from /quote.
  useEffect(() => {
    const saved = loadChat();
    if (saved) {
      /* eslint-disable react-hooks/set-state-in-effect -- restoring saved browser state on load */
      setChatLang(saved.lang); setSessionId(saved.sessionId); setMessages(saved.messages);
      setChips(saved.quickReplies); setMode(saved.mode); setHandoff(saved.handoff);
      /* eslint-enable react-hooks/set-state-in-effect */
      nextId.current = Math.max(0, ...saved.messages.map((m) => m.id)) + 1;
      lastRecId.current = Math.max(0, ...saved.messages.map((m) => m.rec?.id ?? 0));
    }
    setReady(true);
  }, []);

  // Save after every change, and keep the newest message in view.
  useEffect(() => {
    if (!ready || !chatLang || !sessionId) return;
    saveChat({ sessionId, lang: chatLang, messages, quickReplies: chips, mode, handoff });
  }, [ready, chatLang, sessionId, messages, chips, mode, handoff]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy, chips]);

  const friendlyError = useCallback((e: unknown) => {
    if (e instanceof BackendDownError) return t("server_down");
    if (e instanceof ApiError && e.status === 429) return t("rate_limited");
    return t("adv_sorry");
  }, [t]);

  function apply(r: ChatResponse) {
    setSessionId(r.sessionId);
    saveAdvisorSessionId(r.sessionId);
    const showCard = r.recommendation && r.recommendation.id !== lastRecId.current;
    if (showCard) lastRecId.current = r.recommendation!.id;
    setMessages((m) => [...m, { id: nextId.current++, role: "bot", text: r.reply, rec: showCard ? r.recommendation! : undefined }]);
    setChips(r.quickReplies);
    setMode(r.mode);
    setHandoff(!!r.handoff);
  }

  async function pickLanguage(code: ChatLang) {
    setError(""); setBusy(true);
    setChatLang(code);
    setLang(code === "hi" ? "hi" : "en"); // the screen text is English or Hindi
    try {
      lastRecId.current = 0;
      apply(await api.advisorStart(code));
    } catch (e) {
      setError(friendlyError(e)); setChatLang(null);
    }
    setBusy(false);
  }

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy || !chatLang) return;
    setError(""); setInput(""); setChips([]);
    setMessages((m) => [...m, { id: nextId.current++, role: "user", text: msg }]);
    setBusy(true);
    try {
      apply(await api.advisorChat(sessionId, msg, chatLang));
    } catch (e) {
      setError(friendlyError(e));
    }
    setBusy(false);
  }

  function buy(rec: Recommendation) {
    saveProfile(rec.profile);
    saveInitialItems(rec.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })));
    if (sessionId) api.advisorEvent(sessionId, "quote_opened").catch(() => {}); // best effort
    router.push("/quote");
  }

  function restart() {
    clearChat();
    setChatLang(null); setSessionId(undefined); setMessages([]); setChips([]); setMode("ai");
    setHandoff(false); setError(""); lastRecId.current = 0;
  }

  // ---------- Language picker ----------
  if (!ready) return <><Header /><main className="flex-1" /></>;
  if (!chatLang) {
    return (
      <>
        <Header />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
          <h1 className="text-2xl font-bold">{t("adv_pick_title")}</h1>
          <p className="mt-1 text-gray-600">{t("adv_pick_sub")}</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {CHAT_LANGUAGES.map((l) => (
              <button key={l.code} onClick={() => pickLanguage(l.code)} disabled={busy}
                className="min-h-14 rounded-xl border border-gray-300 bg-white px-3 text-lg font-semibold shadow-sm active:border-brand active:bg-brand-soft disabled:opacity-50">
                {l.label}
              </button>
            ))}
          </div>
          {error && <p role="alert" className="mt-4 rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">{error}</p>}
          <p className="mt-6 text-center text-sm"><Link href="/form" className="font-semibold text-brand underline">{t("adv_form_link")}</Link></p>
        </main>
      </>
    );
  }

  // ---------- Chat ----------
  const speech = CHAT_LANGUAGES.find((l) => l.code === chatLang)?.speech ?? "en-IN";
  return (
    <div className="flex h-dvh flex-col">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={m.role === "user" ? "max-w-[85%]" : "w-full max-w-[95%]"}>
              <p className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                m.role === "user" ? "rounded-br-sm bg-brand text-white" : "rounded-bl-sm bg-white shadow-sm"}`}>
                {m.text}
              </p>
              {m.rec && <RecommendationCard rec={m.rec} onBuy={() => buy(m.rec!)} />}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start" role="status" aria-label={t("adv_typing")}>
            <div className="flex gap-1 rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm">
              {[0, 150, 300].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: `${d}ms` }} />)}
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">{error}</p>
        )}
        <div ref={bottom} />
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto w-full max-w-2xl px-4 pb-2 pt-2">
          {mode === "guided" && <p className="mb-1 text-xs text-amber-800">{t("adv_guided_note")}</p>}
          {chips.length > 0 && !busy && (
            <div className="mb-2 flex flex-wrap gap-2">
              {chips.map((c) => (
                <button key={c.label} onClick={() => send(c.value)}
                  className="min-h-11 rounded-full border border-brand px-4 text-sm font-medium text-brand-dark active:bg-brand-soft">
                  {c.label}
                </button>
              ))}
            </div>
          )}
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} disabled={busy}
              placeholder={t("adv_placeholder")} aria-label={t("adv_placeholder")}
              className="min-h-12 min-w-0 flex-1 rounded-full border border-gray-300 px-4 text-base" />
            <MicButton speechLang={speech} onText={(txt) => setInput((v) => (v ? v + " " : "") + txt)} disabled={busy} />
            <button type="submit" disabled={busy || !input.trim()}
              className="min-h-12 shrink-0 rounded-full bg-brand px-5 font-semibold text-white disabled:opacity-40">{t("adv_send")}</button>
          </form>
          <p className="mt-1.5 text-center text-[11px] text-gray-500">{t("adv_notice")}</p>
          <div className="flex flex-wrap items-center justify-between gap-x-4 text-xs">
            <button onClick={() => setPersonOpen(true)} className="min-h-11 font-semibold text-brand underline">{t("adv_person")}</button>
            <Link href="/form" className="flex min-h-11 items-center text-gray-600 underline">{t("adv_form_link")}</Link>
            <button onClick={restart} className="min-h-11 text-gray-500 underline">{t("adv_new_chat")}</button>
          </div>
          {handoff && <p className="pb-1 text-center text-xs text-gray-600">{t("adv_person_done")}</p>}
        </div>
      </footer>

      {personOpen && sessionId && <PersonDialog sessionId={sessionId} onClose={() => setPersonOpen(false)} />}
    </div>
  );
}
