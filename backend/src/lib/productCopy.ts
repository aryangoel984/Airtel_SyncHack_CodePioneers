// Customer-facing names and one-line "why you need it" for every product, in English and Hindi.
// Customers must NEVER see product codes (P01...), so the UI uses only this text.
import { ReasonCode } from "./rules";
import { Product } from "./data";

export interface ProductCopy {
  name_en: string;
  name_hi: string;
  why_en: string;
  why_hi: string;
}

const c = (name_en: string, name_hi: string, why_en: string, why_hi: string): ProductCopy => ({
  name_en, name_hi, why_en, why_hi,
});

export const PRODUCT_COPY: Record<string, ProductCopy> = {
  P01: c("Shop Internet 100 Mbps", "दुकान इंटरनेट 100 Mbps",
    "Fast, unlimited internet for UPI, billing and WhatsApp", "UPI, बिलिंग और WhatsApp के लिए तेज़, अनलिमिटेड इंटरनेट"),
  P02: c("Office Internet 300 Mbps", "ऑफ़िस इंटरनेट 300 Mbps",
    "Very fast internet so your whole team can work online without slowing down", "पूरी टीम बिना रुके ऑनलाइन काम कर सके, इसके लिए बहुत तेज़ इंटरनेट"),
  P03: c("Ultra-fast Internet 1 Gbps", "अल्ट्रा-फ़ास्ट इंटरनेट 1 Gbps",
    "Top speed with priority support, for heavy video, cloud and large teams", "भारी वीडियो, क्लाउड और बड़ी टीम के लिए टॉप स्पीड और प्राथमिकता सहायता"),
  P04: c("Wireless Internet 100 Mbps (5G)", "वायरलेस इंटरनेट 100 Mbps (5G)",
    "Plug in and start in 2 days, with no cable work", "प्लग लगाइए और 2 दिन में शुरू करिए, तार बिछाने की ज़रूरत नहीं"),
  P05: c("Dedicated Internet Line 20 Mbps", "डेडिकेटेड इंटरनेट लाइन 20 Mbps",
    "A private line only for you, with a 99.5% uptime promise", "सिर्फ़ आपकी निजी लाइन, 99.5% चालू रहने की गारंटी के साथ"),
  P06: c("Dedicated Internet Line 100 Mbps", "डेडिकेटेड इंटरनेट लाइन 100 Mbps",
    "A private high-speed line for factories, with a 99.9% uptime promise", "फ़ैक्टरी के लिए निजी हाई-स्पीड लाइन, 99.9% चालू रहने की गारंटी के साथ"),
  P07: c("Business SIM: Basic", "बिज़नेस सिम: बेसिक",
    "A business number with 50 GB data and unlimited calls", "50 GB डेटा और अनलिमिटेड कॉल के साथ बिज़नेस नंबर"),
  P08: c("Business SIM: Plus", "बिज़नेस सिम: प्लस",
    "A business number with 150 GB data, roaming included, for people who travel", "150 GB डेटा और रोमिंग के साथ बिज़नेस नंबर, घूमने-फिरने वालों के लिए"),
  P09: c("Backup Internet", "बैकअप इंटरनेट",
    "A mobile-network backup, so billing and UPI keep working if the main line goes down", "मुख्य इंटरनेट बंद हो जाए तब भी बिलिंग और UPI चलते रहें"),
  P10: c("Multi-location Network Manager", "मल्टी-लोकेशन नेटवर्क मैनेजर",
    "Connects all your shops or offices and manages them from one place", "आपकी सभी दुकानों या ऑफ़िस को जोड़ता है और एक जगह से संभालता है"),
  P11: c("Fixed Internet Address", "फ़िक्स्ड इंटरनेट एड्रेस",
    "Needed to reach your CCTV, server or office computer from anywhere", "CCTV, सर्वर या ऑफ़िस कंप्यूटर को कहीं से भी खोलने के लिए ज़रूरी"),
  P12: c("Business Phone Lines", "बिज़नेस फ़ोन लाइनें",
    "Several people can take calls on one business number, with call recording", "एक बिज़नेस नंबर पर कई लोग कॉल ले सकते हैं, रिकॉर्डिंग के साथ"),
  P13: c("Toll-free Number", "टोल-फ़्री नंबर",
    "Customers call you for free, which builds trust", "ग्राहक मुफ़्त में कॉल करते हैं, इससे भरोसा बढ़ता है"),
  P14: c("Bulk SMS Pack (10,000)", "बल्क SMS पैक (10,000)",
    "Send offers and alerts to customers, with the registration paperwork handled for you", "ग्राहकों को ऑफ़र और अलर्ट भेजिए, रजिस्ट्रेशन का काम हम करेंगे"),
  P15: c("WhatsApp for Business", "बिज़नेस के लिए WhatsApp",
    "Show your catalogue and reply to customers on WhatsApp", "WhatsApp पर अपना कैटलॉग दिखाइए और ग्राहकों को जवाब दीजिए"),
  P16: c("Business Email & Office Apps", "बिज़नेस ईमेल और ऑफ़िस ऐप्स",
    "Your own email address, shared documents and video meetings", "आपका अपना ईमेल, साझा डॉक्यूमेंट और वीडियो मीटिंग"),
  P17: c("Online Backup 1 TB", "ऑनलाइन बैकअप 1 TB",
    "Your files and records stay safe even if a computer is lost or damaged", "कंप्यूटर खो जाए या ख़राब हो जाए तब भी आपकी फ़ाइलें सुरक्षित रहती हैं"),
  P18: c("Website & Domain", "वेबसाइट और डोमेन",
    "A simple website with your own web address, so customers can find you online", "अपने नाम के वेब एड्रेस वाली सरल वेबसाइट, ताकि ग्राहक आपको ऑनलाइन खोज सकें"),
  P19: c("Billing & Card/UPI Machine Software", "बिलिंग और कार्ड/UPI मशीन सॉफ़्टवेयर",
    "Make bills, track stock and accept UPI and cards on a tablet", "टैबलेट पर बिल बनाइए, स्टॉक देखिए और UPI व कार्ड से पेमेंट लीजिए"),
  P20: c("Computer & Phone Protection", "कंप्यूटर और फ़ोन सुरक्षा",
    "Protects your devices from viruses and online fraud", "आपके डिवाइस को वायरस और ऑनलाइन धोखाधड़ी से बचाता है"),
  P21: c("Managed Network Security", "मैनेज्ड नेटवर्क सिक्योरिटी",
    "A security expert team watches your network around the clock", "सुरक्षा विशेषज्ञों की टीम आपके नेटवर्क पर चौबीसों घंटे नज़र रखती है"),
  P22: c("Secure Wi-Fi with Guest Access", "सुरक्षित Wi-Fi, मेहमानों के लिए अलग",
    "Separate Wi-Fi for customers, so your own devices stay safe", "ग्राहकों के लिए अलग Wi-Fi, ताकि आपके अपने डिवाइस सुरक्षित रहें"),
  P23: c("Cloud CCTV Cameras", "क्लाउड CCTV कैमरे",
    "Watch your shop from your phone, with recordings saved online", "फ़ोन से अपनी दुकान देखिए, रिकॉर्डिंग ऑनलाइन सेव रहती है"),
  P24: c("Machine Monitoring", "मशीन मॉनिटरिंग",
    "See when a machine stops or breaks down, and fix it sooner", "मशीन कब रुकी या ख़राब हुई, यह तुरंत दिखता है और जल्दी ठीक होती है"),
  P25: c("Vehicle Tracker", "गाड़ी ट्रैकर",
    "Know where your delivery vehicles are, live", "आपकी डिलीवरी गाड़ियाँ अभी कहाँ हैं, लाइव देखिए"),
};

export const copyFor = (productId: string): ProductCopy =>
  PRODUCT_COPY[productId] ?? c(productId, productId, "", ""); // fallback never expected

// ---------- Customer-friendly "why not available" text ----------
export interface FriendlyReason {
  reason_en: string;
  reason_hi: string;
}

export function friendlyReason(p: Product, codes: ReasonCode[]): FriendlyReason {
  const en: string[] = [];
  const hi: string[] = [];
  for (const code of codes) {
    switch (code.code) {
      case "gstin":
        en.push("Needs a GST number"); hi.push("GST नंबर चाहिए"); break;
      case "tier": {
        const big = p.available_city_tiers.includes(1);
        en.push(big ? "Only in big cities" : "Only in smaller cities");
        hi.push(big ? "सिर्फ़ बड़े शहरों में" : "सिर्फ़ छोटे शहरों में");
        break;
      }
      case "employees":
        en.push(`Needs at least ${code.value} staff`); hi.push(`कम से कम ${code.value} कर्मचारी चाहिए`); break;
      case "sites":
        en.push(`Needs at least ${code.value} locations`); hi.push(`कम से कम ${code.value} लोकेशन चाहिए`); break;
      case "dependency":
        en.push("Needs an internet plan that isn't available for your business");
        hi.push("इसके लिए इंटरनेट प्लान चाहिए, जो आपके बिज़नेस के लिए उपलब्ध नहीं है"); break;
      default:
        en.push("Not available"); hi.push("उपलब्ध नहीं");
    }
  }
  return { reason_en: en.join(", "), reason_hi: hi.join(", ") };
}

// ---------- Add customer-friendly text to API responses ----------
import type { Quote } from "./quote";
import { getProduct } from "./data";

export function quoteWithCopy(q: Quote) {
  return {
    ...q,
    lines: q.lines.map((l) => ({ ...l, copy: copyFor(l.product_id) })),
    blocked: q.blocked.map((b) => {
      const p = getProduct(b.product_id);
      return { ...b, copy: copyFor(b.product_id), ...(p ? friendlyReason(p, b.codes) : {}) };
    }),
    fixes: q.fixes.map((f) => ({
      ...f,
      for_copy: copyFor(f.for_product_id),
      added_copy: copyFor(f.added_product_id),
    })),
  };
}
