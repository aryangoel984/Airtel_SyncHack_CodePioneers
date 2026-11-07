// All UI text, in English and Hindi. Product names/reasons come from the backend (copy fields).
import type { Lang, ProductCopy } from "./types";

type Dict = Record<string, string>;

const en: Dict = {
  brand: "Accel Business",
  tagline: "Build your business plan in 2 minutes",
  start_title: "Tell us about your business",
  start_sub: "We'll suggest a plan based on businesses like yours. No salesperson needed.",
  f_type: "What kind of business do you run?",
  seg_micro: "Small shop: kirana, salon, pharmacy",
  seg_prof: "Clinic, CA firm, coaching centre, office",
  seg_multi: "Restaurant chain or 3-10 stores",
  seg_mfg: "Small factory or workshop",
  f_city: "Where is your business?",
  city_1: "Big city (Delhi, Mumbai, Bengaluru...)",
  city_2: "Smaller city",
  f_staff: "How many people work for you?",
  f_sites: "How many locations (shops / offices)?",
  f_gst: "Do you have a GST number?",
  yes: "Yes",
  no: "No",
  show_plan: "Show my plan",
  err_staff: "Enter 1 or more",
  err_sites: "Enter 1 or more",
  summary_staff: "{n} staff",
  summary_sites: "{n} location(s)",
  summary_gst: "GST: {v}",
  edit: "Edit",
  your_plan: "Your plan",
  addons: "Recommended add-ons",
  addons_sub: "Other businesses like yours often add these",
  more: "More options",
  more_show: "Show more options ({n})",
  more_hide: "Hide more options",
  unavailable: "Not available for your business",
  added_note: "We added {added} because {for} needs internet",
  per_month: "/month",
  plus_month: "+₹{n}/month",
  remove: "Remove",
  add_back: "Add back",
  total_monthly: "Monthly total",
  setup_fee: "One-time setup",
  contract: "{n}-month contract",
  ready_by: "Ready by {date}",
  gst_note: "Prices exclude 18% GST",
  confirm: "Confirm plan",
  updating: "Updating price...",
  loading_plan: "Preparing your plan...",
  empty_plan: "Your plan is empty. Add something below to see your price.",
  empty_base: "We couldn't find a ready-made plan for you. Pick from the options below.",
  none: "None",
  server_down: "We can't reach our server right now. Please check your internet and try again.",
  retry: "Try again",
  something_wrong: "Something went wrong. Please try again.",
  mobile_title: "Your mobile number",
  mobile_why: "Only used to send you order updates.",
  mobile_label: "10-digit mobile number",
  mobile_bad: "Enter a valid 10-digit mobile number",
  cancel: "Cancel",
  place_order: "Confirm and continue",
  placing: "Saving...",
  order_title: "Your order",
  order_id: "Order number",
  status: "Status",
  status_QUOTE_ACCEPTED: "Quote accepted",
  order_next: "Next: verify your business (coming in Step 4)",
  order_mobile: "Updates go to {m}",
  order_not_found: "We couldn't find this order.",
  back_home: "Start again",
  language: "Language",
  setup_label: "Setup",
  based_on_none: "",
  u_site: "per location", u_line: "per SIM", u_user: "per person", u_camera: "per camera",
  u_ip: "per address", u_channel: "per line", u_number: "per number", u_pack: "per pack",
  u_account: "per account", u_counter: "per counter", u_device: "per device", u_vehicle: "per vehicle",
  qty: "Quantity",
  dec: "Decrease",
  inc: "Increase",
};

const hi: Dict = {
  brand: "Accel Business",
  tagline: "2 मिनट में अपना बिज़नेस प्लान बनाइए",
  start_title: "अपने बिज़नेस के बारे में बताइए",
  start_sub: "आपके जैसे बिज़नेस के आधार पर हम प्लान सुझाएँगे। किसी सेल्समैन की ज़रूरत नहीं।",
  f_type: "आप कौन सा बिज़नेस चलाते हैं?",
  seg_micro: "छोटी दुकान: किराना, सैलून, मेडिकल स्टोर",
  seg_prof: "क्लिनिक, CA फ़र्म, कोचिंग सेंटर, ऑफ़िस",
  seg_multi: "रेस्टोरेंट चेन या 3-10 स्टोर",
  seg_mfg: "छोटी फ़ैक्टरी या वर्कशॉप",
  f_city: "आपका बिज़नेस कहाँ है?",
  city_1: "बड़ा शहर (दिल्ली, मुंबई, बेंगलुरु...)",
  city_2: "छोटा शहर",
  f_staff: "आपके यहाँ कितने लोग काम करते हैं?",
  f_sites: "कितनी जगहें (दुकानें / ऑफ़िस) हैं?",
  f_gst: "क्या आपके पास GST नंबर है?",
  yes: "हाँ",
  no: "नहीं",
  show_plan: "मेरा प्लान दिखाइए",
  err_staff: "1 या ज़्यादा लिखिए",
  err_sites: "1 या ज़्यादा लिखिए",
  summary_staff: "{n} कर्मचारी",
  summary_sites: "{n} जगह",
  summary_gst: "GST: {v}",
  edit: "बदलें",
  your_plan: "आपका प्लान",
  addons: "सुझाए गए ऐड-ऑन",
  addons_sub: "आपके जैसे बिज़नेस अक्सर ये भी लेते हैं",
  more: "और विकल्प",
  more_show: "और विकल्प दिखाइए ({n})",
  more_hide: "और विकल्प छिपाइए",
  unavailable: "आपके बिज़नेस के लिए उपलब्ध नहीं",
  added_note: "हमने {added} जोड़ा है क्योंकि {for} के लिए इंटरनेट चाहिए",
  per_month: "/महीना",
  plus_month: "+₹{n}/महीना",
  remove: "हटाइए",
  add_back: "वापस जोड़िए",
  total_monthly: "महीने का कुल",
  setup_fee: "एक बार का सेटअप",
  contract: "{n} महीने का कॉन्ट्रैक्ट",
  ready_by: "{date} तक तैयार",
  gst_note: "कीमतों में 18% GST शामिल नहीं है",
  confirm: "प्लान कन्फ़र्म करें",
  updating: "कीमत अपडेट हो रही है...",
  loading_plan: "आपका प्लान तैयार हो रहा है...",
  empty_plan: "आपका प्लान ख़ाली है। कीमत देखने के लिए नीचे से कुछ जोड़िए।",
  empty_base: "हमें आपके लिए तैयार प्लान नहीं मिला। नीचे के विकल्पों में से चुनिए।",
  none: "कोई नहीं",
  server_down: "अभी हमारा सर्वर नहीं मिल रहा। कृपया अपना इंटरनेट देखकर फिर कोशिश करें।",
  retry: "फिर कोशिश करें",
  something_wrong: "कुछ गड़बड़ हो गई। कृपया फिर कोशिश करें।",
  mobile_title: "आपका मोबाइल नंबर",
  mobile_why: "सिर्फ़ ऑर्डर की जानकारी भेजने के लिए इस्तेमाल होगा।",
  mobile_label: "10 अंकों का मोबाइल नंबर",
  mobile_bad: "10 अंकों का सही मोबाइल नंबर लिखिए",
  cancel: "रद्द करें",
  place_order: "कन्फ़र्म करके आगे बढ़ें",
  placing: "सेव हो रहा है...",
  order_title: "आपका ऑर्डर",
  order_id: "ऑर्डर नंबर",
  status: "स्थिति",
  status_QUOTE_ACCEPTED: "कोटेशन मंज़ूर",
  order_next: "अगला कदम: अपने बिज़नेस का सत्यापन (स्टेप 4 में आएगा)",
  order_mobile: "अपडेट {m} पर भेजे जाएँगे",
  order_not_found: "यह ऑर्डर नहीं मिला।",
  back_home: "फिर से शुरू करें",
  language: "भाषा",
  setup_label: "सेटअप",
  based_on_none: "",
  u_site: "प्रति जगह", u_line: "प्रति सिम", u_user: "प्रति व्यक्ति", u_camera: "प्रति कैमरा",
  u_ip: "प्रति एड्रेस", u_channel: "प्रति लाइन", u_number: "प्रति नंबर", u_pack: "प्रति पैक",
  u_account: "प्रति अकाउंट", u_counter: "प्रति काउंटर", u_device: "प्रति डिवाइस", u_vehicle: "प्रति गाड़ी",
  qty: "संख्या",
  dec: "घटाइए",
  inc: "बढ़ाइए",
};

const DICTS: Record<Lang, Dict> = { en, hi };

/** Translate a key, filling {placeholders}. */
export function translate(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  let s = DICTS[lang][key] ?? DICTS.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** "per site" (from the backend) -> friendly text in the chosen language. */
const UNIT_KEYS: Record<string, string> = {
  "per site": "u_site", "per line": "u_line", "per user": "u_user", "per camera": "u_camera",
  "per IP": "u_ip", "per channel": "u_channel", "per number": "u_number", "per pack": "u_pack",
  "per account": "u_account", "per counter": "u_counter", "per device": "u_device", "per vehicle": "u_vehicle",
};
export const unitLabel = (lang: Lang, unit: string) => translate(lang, UNIT_KEYS[unit] ?? "qty");

/** Pick the product name / reason in the chosen language. */
export const nameOf = (c: ProductCopy, lang: Lang) => (lang === "hi" ? c.name_hi : c.name_en);
export const whyOf = (c: ProductCopy, lang: Lang) => (lang === "hi" ? c.why_hi : c.why_en);

/** ₹1,23,456 style (Indian digit grouping). */
export const rupees = (n: number) => "₹" + n.toLocaleString("en-IN");

/** "2026-07-20" -> "20 Jul 2026" (or the Hindi equivalent). */
export function formatDate(iso: string, lang: Lang): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}
