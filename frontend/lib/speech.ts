// Voice replies: the browser reads the advisor's answers aloud (Web Speech API, free, on the device).
// Nothing is sent to any server. Hidden when the browser has no speech voices.

export const speechSupported = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

/** Turn a chat reply into something that sounds right when spoken. Display text is never changed. */
export function spokenText(text: string, speechLang: string): string {
  const en = speechLang.startsWith("en");
  let t = text
    .replace(/[*_#`>]/g, " ")
    .replace(/^\s*[-•]\s+/gm, "")              // bullet markers
    .replace(/\p{Extended_Pictographic}/gu, "")   // emoji
    .replace(/(\d),(?=\d)/g, "$1");               // 4,393 -> 4393 (read as a number)
  // ₹4393 -> "4393 rupees" in English voices; Indian-language voices read ₹ themselves
  if (en) t = t.replace(/₹\s?(\d+(?:\.\d+)?)/g, "$1 rupees");
  // "Udyam" is उद्यम ("ud-yum"), never "you-dee-am"
  t = t.replace(/\budyam\b/gi, en ? "Ud-yum" : "उद्यम");
  t = t.replace(/\bMbps\b/g, en ? "M B P S" : "Mbps").replace(/\bGbps\b/g, en ? "G B P S" : "Gbps");
  return t.replace(/\s+/g, " ").trim();
}

/** Best installed voice for a language ("hi-IN"): exact match, then same language, else the default. */
export function pickVoice(speechLang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const norm = (s: string) => s.replace("_", "-").toLowerCase();
  const want = norm(speechLang);
  const base = want.split("-")[0];
  const exact = voices.filter((v) => norm(v.lang) === want);
  const same = voices.filter((v) => norm(v.lang).split("-")[0] === base);
  const pool = exact.length ? exact : same;
  // prefer natural / online voices when there is a choice
  return pool.find((v) => /natural|neural|google|online/i.test(v.name)) ?? pool[0] ?? null;
}

let current: SpeechSynthesisUtterance | null = null;

export function speak(text: string, speechLang: string, onEnd?: () => void) {
  if (!speechSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(spokenText(text, speechLang));
  u.lang = speechLang;
  const v = pickVoice(speechLang);
  if (v) u.voice = v;
  u.rate = 1;
  u.onend = () => { if (current === u) current = null; onEnd?.(); };
  u.onerror = () => { if (current === u) current = null; onEnd?.(); };
  current = u;
  synth.speak(u);
}

export function stopSpeaking() {
  if (!speechSupported()) return;
  current = null;
  window.speechSynthesis.cancel();
}
