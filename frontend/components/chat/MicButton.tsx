"use client";
// Voice input with the browser's Web Speech API. Hidden when the browser does not support it.
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/LangContext";

interface Recognition {
  lang: string; interimResults: boolean; continuous: boolean;
  start(): void; stop(): void;
  onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
}

export default function MicButton({ speechLang, onText, disabled }: { speechLang: string; onText: (text: string) => void; disabled?: boolean }) {
  const { t } = useLang();
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature check that can only run in the browser
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  if (!supported) return null;

  function toggle() {
    if (listening) { rec.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = speechLang; r.interimResults = false; r.continuous = false;
    r.onresult = (e) => onText(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    try { r.start(); } catch { setListening(false); }
  }

  return (
    <button type="button" onClick={toggle} disabled={disabled} aria-label={listening ? t("adv_mic_listening") : t("adv_mic")}
      className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border ${listening ? "animate-pulse border-brand bg-brand text-white" : "border-gray-300 bg-white"}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
      </svg>
    </button>
  );
}
