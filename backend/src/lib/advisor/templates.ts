// Fixed texts used WITHOUT the LLM: greetings, guided-mode questions, quick-reply chips,
// and the safe "template reply" used when the guardrail rejects the LLM twice.
// English and Hindi are complete; other languages fall back to English (greetings exist in all).
import { AdvisorLang } from "./config";
import { Session } from "./session";
import { RequiredSlot, Recommendation, missingSlots } from "./recommend";

export interface QuickReply { label: string; value: string }

const isHindi = (l: AdvisorLang) => l === "hi";
const isHinglish = (l: AdvisorLang) => l === "hinglish";

export const GREETINGS: Record<AdvisorLang, string> = {
  en: "Hello! I'm your Accel Business advisor. I'll help you find the right internet and business plan in a few quick questions. What kind of business do you run?",
  hi: "नमस्ते! मैं आपका Accel Business सलाहकार हूँ। कुछ सवालों में मैं आपके बिज़नेस के लिए सही इंटरनेट और प्लान ढूँढने में मदद करूँगा। आप कौन सा बिज़नेस चलाते हैं?",
  hinglish: "Namaste! Main aapka Accel Business advisor hoon. Kuch sawalon mein main aapke business ke liye sahi internet aur plan dhoondhne mein madad karunga. Aap kaun sa business chalate hain?",
  mr: "नमस्कार! मी तुमचा Accel Business सल्लागार आहे. काही प्रश्नांमध्ये मी तुमच्या व्यवसायासाठी योग्य इंटरनेट आणि प्लॅन शोधायला मदत करेन. तुम्ही कोणता व्यवसाय करता?",
  ta: "வணக்கம்! நான் உங்கள் Accel Business ஆலோசகர். சில கேள்விகளில் உங்கள் தொழிலுக்கு ஏற்ற இணையம் மற்றும் திட்டத்தைக் கண்டறிய உதவுவேன். நீங்கள் என்ன தொழில் செய்கிறீர்கள்?",
  te: "నమస్కారం! నేను మీ Accel Business సలహాదారుని. కొన్ని ప్రశ్నల్లో మీ వ్యాపారానికి సరైన ఇంటర్నెట్ మరియు ప్లాన్ కనుగొనడంలో సహాయం చేస్తాను. మీరు ఏ వ్యాపారం చేస్తున్నారు?",
  kn: "ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ Accel Business ಸಲಹೆಗಾರ. ಕೆಲವು ಪ್ರಶ್ನೆಗಳಲ್ಲಿ ನಿಮ್ಮ ವ್ಯಾಪಾರಕ್ಕೆ ಸರಿಯಾದ ಇಂಟರ್ನೆಟ್ ಮತ್ತು ಪ್ಲಾನ್ ಹುಡುಕಲು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ. ನೀವು ಯಾವ ವ್ಯಾಪಾರ ಮಾಡುತ್ತೀರಿ?",
  gu: "નમસ્તે! હું તમારો Accel Business સલાહકાર છું. થોડા પ્રશ્નોમાં હું તમારા ધંધા માટે યોગ્ય ઇન્ટરનેટ અને પ્લાન શોધવામાં મદદ કરીશ. તમે કયો ધંધો કરો છો?",
  bn: "নমস্কার! আমি আপনার Accel Business পরামর্শদাতা। কয়েকটি প্রশ্নে আপনার ব্যবসার জন্য সঠিক ইন্টারনেট ও প্ল্যান খুঁজে পেতে সাহায্য করব। আপনি কী ব্যবসা করেন?",
  pa: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਤੁਹਾਡਾ Accel Business ਸਲਾਹਕਾਰ ਹਾਂ। ਕੁਝ ਸਵਾਲਾਂ ਵਿੱਚ ਮੈਂ ਤੁਹਾਡੇ ਕਾਰੋਬਾਰ ਲਈ ਸਹੀ ਇੰਟਰਨੈੱਟ ਅਤੇ ਪਲਾਨ ਲੱਭਣ ਵਿੱਚ ਮਦਦ ਕਰਾਂਗਾ। ਤੁਸੀਂ ਕਿਹੜਾ ਕਾਰੋਬਾਰ ਕਰਦੇ ਹੋ?",
  ml: "നമസ്കാരം! ഞാൻ നിങ്ങളുടെ Accel Business ഉപദേഷ്ടാവാണ്. കുറച്ച് ചോദ്യങ്ങളിലൂടെ നിങ്ങളുടെ ബിസിനസിന് അനുയോജ്യമായ ഇന്റർനെറ്റും പ്ലാനും കണ്ടെത്താൻ സഹായിക്കാം. നിങ്ങൾ ഏത് ബിസിനസാണ് ചെയ്യുന്നത്?",
};

// ---- guided-mode questions ----
type Q = Record<"en" | "hi" | "hinglish", string>;
const QUESTIONS: Record<RequiredSlot | "wishes" | "tier" | "gst_recheck", Q> = {
  business_type: {
    en: "What kind of business do you run? For example a kirana store, salon, clinic or factory.",
    hi: "आप कौन सा बिज़नेस चलाते हैं? जैसे किराना दुकान, सैलून, क्लिनिक या फ़ैक्टरी।",
    hinglish: "Aap kaun sa business chalate hain? Jaise kirana dukaan, salon, clinic ya factory.",
  },
  employee_count: {
    en: "How many people work in your business, including you?",
    hi: "आपके बिज़नेस में आपको मिलाकर कितने लोग काम करते हैं?",
    hinglish: "Aapke business mein aapko milakar kitne log kaam karte hain?",
  },
  num_sites: {
    en: "How many locations (shops, outlets or offices) do you have?",
    hi: "आपकी कितनी जगहें (दुकानें, आउटलेट या ऑफ़िस) हैं?",
    hinglish: "Aapki kitni jagah (dukaan, outlet ya office) hain?",
  },
  city: {
    en: "Which city is your business in?",
    hi: "आपका बिज़नेस किस शहर में है?",
    hinglish: "Aapka business kis shehar mein hai?",
  },
  gst: {
    en: "Do you have a GST number for your business?",
    hi: "क्या आपके बिज़नेस के पास GST नंबर है?",
    hinglish: "Kya aapke business ke paas GST number hai?",
  },
  wishes: {
    en: "Is there anything specific you need, like CCTV, WhatsApp for business or a billing machine?",
    hi: "क्या आपको कुछ खास चाहिए, जैसे CCTV, बिज़नेस के लिए WhatsApp या बिलिंग मशीन?",
    hinglish: "Kya aapko kuch khaas chahiye, jaise CCTV, business ke liye WhatsApp ya billing machine?",
  },
  tier: {
    en: "Is it a big metro city or a smaller city?",
    hi: "क्या यह बड़ा मेट्रो शहर है या छोटा शहर?",
    hinglish: "Kya yeh bada metro shehar hai ya chhota shehar?",
  },
  gst_recheck: {
    en: "That GST number doesn't look right. Could you check it and type it again, or tell me if you don't have one?",
    hi: "यह GST नंबर सही नहीं लग रहा। कृपया दोबारा जाँचकर लिखिए, या बताइए कि आपके पास नहीं है।",
    hinglish: "Yeh GST number sahi nahi lag raha. Kripya dobara check karke likhiye, ya bataiye ki aapke paas nahi hai.",
  },
};

const pick = (q: Q, l: AdvisorLang) => (isHindi(l) ? q.hi : isHinglish(l) ? q.hinglish : q.en);

export type NextStep = RequiredSlot | "wishes" | "tier" | "gst_recheck" | "done";

/** What should we ask next? (Used by guided mode and as a safe fallback.) */
export function nextStep(s: Session): NextStep {
  const missing = missingSlots(s.profile);
  const p = s.profile;
  if (missing.includes("gst") && p.gstin && ["checksum_failed", "bad_format"].includes(p.gstin.status)) return "gst_recheck";
  if (missing.includes("city") && p.city) return "tier"; // we know the text but not the tier
  if (missing.length) return missing[0];
  if (!s.guided.wishesAsked && p.wishes.length === 0) return "wishes";
  return "done";
}

export const questionFor = (step: Exclude<NextStep, "done">, l: AdvisorLang) => pick(QUESTIONS[step], l);

// ---- quick replies ----
type Chips = [string, string][];
const CHIPS = {
  business_type: {
    en: [["Small shop", "small shop"], ["Clinic / office", "clinic"], ["Restaurant / chain", "restaurant chain"], ["Factory", "factory"]] as Chips,
    hi: [["छोटी दुकान", "छोटी दुकान"], ["क्लिनिक / ऑफ़िस", "क्लिनिक"], ["रेस्टोरेंट / चेन", "restaurant chain"], ["फ़ैक्टरी", "फैक्ट्री"]] as Chips,
  },
  employee_count: {
    en: [["1 (just me)", "1 (just me)"], ["2-5", "2-5 people"], ["6-15", "6-15 people"], ["16-50", "16-50 people"]] as Chips,
    hi: [["1 (सिर्फ़ मैं)", "1 (सिर्फ़ मैं)"], ["2-5", "2-5 लोग"], ["6-15", "6-15 लोग"], ["16-50", "16-50 लोग"]] as Chips,
  },
  num_sites: {
    en: [["1", "1 location"], ["2", "2 locations"], ["3-5", "3-5 locations"], ["6-12", "6-12 locations"]] as Chips,
    hi: [["1", "1 जगह"], ["2", "2 जगहें"], ["3-5", "3-5 जगहें"], ["6-12", "6-12 जगहें"]] as Chips,
  },
  city: {
    en: [["Big metro city", "big metro city"], ["Smaller city", "smaller city"]] as Chips,
    hi: [["बड़ा मेट्रो शहर", "बड़ा मेट्रो शहर"], ["छोटा शहर", "छोटा शहर"]] as Chips,
  },
  gst: {
    en: [["Yes, I have GST", "Yes, I have a GST number"], ["No GST", "No, I don't have GST"]] as Chips,
    hi: [["हाँ, GST है", "हाँ, मेरे पास GST नंबर है"], ["GST नहीं है", "नहीं, मेरे पास GST नहीं है"]] as Chips,
  },
  wishes: {
    en: [["CCTV cameras", "I want CCTV cameras"], ["WhatsApp", "I want WhatsApp for my business"], ["Only a mobile plan", "I only want a mobile plan"], ["Nothing specific", "Nothing specific, show me a plan"]] as Chips,
    hi: [["CCTV कैमरे", "मुझे CCTV कैमरे चाहिए"], ["WhatsApp", "मुझे बिज़नेस के लिए WhatsApp चाहिए"], ["सिर्फ़ मोबाइल प्लान", "मुझे सिर्फ़ मोबाइल प्लान चाहिए"], ["कुछ खास नहीं", "कुछ खास नहीं, प्लान दिखाइए"]] as Chips,
  },
  after: {
    en: [["Why this plan?", "Why this plan?"], ["Make it cheaper", "Can you make it cheaper?"], ["Add CCTV", "I also want CCTV"]] as Chips,
    hi: [["यह प्लान क्यों?", "यह प्लान क्यों सुझाया?"], ["सस्ता करें", "क्या इसे सस्ता कर सकते हैं?"], ["CCTV जोड़ें", "मुझे CCTV भी चाहिए"]] as Chips,
  },
};

export function quickRepliesFor(s: Session): QuickReply[] {
  const l = s.profile.language;
  const set = (c: { en: Chips; hi: Chips }) => (isHindi(l) ? c.hi : c.en).map(([label, value]) => ({ label, value }));
  if (s.recommendation) {
    // Don't offer "Add CCTV" when CCTV (P23) is already in the plan.
    const hasCctv = s.recommendation.items.some((i) => i.product_id === "P23");
    return set(CHIPS.after).filter((c, idx) => !(hasCctv && idx === 2));
  }
  const step = nextStep(s);
  if (step === "done") return [];
  if (step === "tier") return set(CHIPS.city);
  if (step === "gst_recheck") return set(CHIPS.gst);
  return set(CHIPS[step as keyof typeof CHIPS] as { en: Chips; hi: Chips });
}

// ---- safe template reply built from the structured recommendation ----
function fmtDate(iso: string, l: AdvisorLang) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString(isHindi(l) ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
const rupees = (n: number) => "₹" + n.toLocaleString("en-IN");

export function recommendationReply(r: Recommendation, l: AdvisorLang): string {
  const hi = isHindi(l);
  const names = r.items.map((i) => `${hi ? i.copy.name_hi : i.copy.name_en}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join(", ");
  const parts: string[] = [];
  parts.push(hi ? `आपके बिज़नेस के लिए यह प्लान है: ${names}।` : `Here is a plan for your business: ${names}.`);
  const fix = r.quote.fixes[0];
  if (fix) parts.push(hi ? `${fix.added_copy.name_hi} अपने आप जोड़ा गया है क्योंकि ${fix.for_copy.name_hi} के लिए इंटरनेट चाहिए।` : `${fix.added_copy.name_en} was added because ${fix.for_copy.name_en} needs internet.`);
  parts.push(hi
    ? `महीने का कुल ${rupees(r.quote.monthly_total_inr)} (कीमतों में 18% GST शामिल नहीं), एक बार का सेटअप ${rupees(r.quote.one_time_setup_total_inr)}, ${fmtDate(r.quote.expected_activation_date, l)} तक तैयार।`
    : `Monthly total ${rupees(r.quote.monthly_total_inr)} (prices exclude 18% GST), one-time setup ${rupees(r.quote.one_time_setup_total_inr)}, ready by ${fmtDate(r.quote.expected_activation_date, l)}.`);
  for (const b of r.blocked_wishes) {
    const reason = hi ? b.reason_hi : b.reason_en;
    parts.push(hi ? `${b.copy.name_hi} अभी उपलब्ध नहीं: ${reason}।` : `${b.copy.name_en} is not available for you: ${reason}.`);
  }
  if (r.budget.requested !== null && r.budget.within === false) {
    parts.push(hi ? `यह आपके बजट से ज़्यादा है; सबसे सस्ता विकल्प ${rupees(r.budget.cheapest_possible_inr ?? r.quote.monthly_total_inr)} है।` : `This is above your budget; the cheapest option is ${rupees(r.budget.cheapest_possible_inr ?? r.quote.monthly_total_inr)}.`);
  }
  parts.push(hi ? "पूरा प्लान देखने के लिए नीचे “Customise & buy” दबाइए।" : "Tap “Customise & buy” below to see the full plan.");
  return parts.join(" ");
}

export const NOTICES = {
  piiRedacted: {
    en: "I removed personal details from your message. Please don't share Aadhaar, PAN, bank details, phone numbers or emails in chat. ID checks happen later in a secure step.",
    hi: "मैंने आपके संदेश से निजी जानकारी हटा दी है। कृपया चैट में आधार, PAN, बैंक डिटेल, फ़ोन नंबर या ईमेल न भेजें। पहचान की जाँच बाद में सुरक्षित तरीके से होगी।",
    hinglish: "Maine aapke message se personal details hata di hain. Kripya chat mein Aadhaar, PAN, bank details, phone number ya email na bhejein. ID check baad mein secure step mein hoga.",
  } as Q,
  gstInactive: {
    en: "That GST number is not active, so products that need an active GST can't be offered right now. I'll suggest everything else.",
    hi: "यह GST नंबर चालू नहीं है, इसलिए जिन प्रोडक्ट्स के लिए चालू GST चाहिए वे अभी नहीं दिए जा सकते। बाकी सब मैं सुझाऊँगा।",
    hinglish: "Yeh GST number active nahi hai, isliye jin products ke liye active GST chahiye woh abhi nahi diye ja sakte. Baaki sab main suggest karunga.",
  } as Q,
  handoff: {
    en: "I've asked an expert to call you back within 1 working day.",
    hi: "मैंने एक विशेषज्ञ से कहा है कि वे 1 कार्य दिवस में आपको कॉल करें।",
    hinglish: "Maine ek expert se kaha hai ki woh 1 working day mein aapko call karein.",
  } as Q,
  guidedMode: {
    en: "I'm in simple mode right now, so I'll ask a few quick questions.",
    hi: "अभी मैं सरल मोड में हूँ, इसलिए कुछ छोटे सवाल पूछूँगा।",
    hinglish: "Abhi main simple mode mein hoon, isliye kuch chhote sawal poochhunga.",
  } as Q,
  planAgain: {
    en: "Tap “Customise & buy” to continue, or tell me what to change.",
    hi: "आगे बढ़ने के लिए “Customise & buy” दबाइए, या बताइए क्या बदलना है।",
    hinglish: "Aage badhne ke liye “Customise & buy” dabaiye, ya bataiye kya badalna hai.",
  } as Q,
};
export const notice = (q: Q, l: AdvisorLang) => pick(q, l);
