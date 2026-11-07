// Smart KYC checks: read every document, compare it with the government registries and with
// the other documents, and explain each result in simple English and Hindi.
import { loadGstinRegistry, loadUdyamRegistry, getProduct, GstinRecord, UdyamRecord } from "../data";
import { TODAY, isAddressProofFresh, validateUdyam } from "../validators";
import { maskId, maskUdyam } from "../mask";
import type { BusinessProfile, BundleItem } from "../rules";
import { ocrImage, BadImageError } from "./ocr";
import { parseBill, parseGst, parseId, parseUdyam, readGstin, sameText, norm } from "./parse";
import type { DocSummary, DocType, KycCheck, KycResult } from "./types";
import { simNow } from "../orders";

/** Below this OCR confidence we treat a photo as unreadable (blurry, dark, cut off). */
export const MIN_CONFIDENCE = 60;

export interface VerifyInput {
  files: Partial<Record<DocType, Buffer>>;
  noGst: boolean; // customer says: "I don't have GST"
  noUdyam: boolean; // customer says: "I don't have Udyam registration"
  typedGstin?: string; // optional: the GSTIN the customer typed
  profile?: BusinessProfile; // from the order, to know if the plan needs GST
  items?: BundleItem[];
}

const pass = (code: string, doc: KycCheck["doc"], en: string, hi: string): KycCheck => ({ code, doc, result: "pass", en, hi });
const fix = (code: string, doc: KycCheck["doc"], en: string, hi: string): KycCheck => ({ code, doc, result: "fail", severity: "fix", en, hi });
const reject = (code: string, doc: KycCheck["doc"], en: string, hi: string): KycCheck => ({ code, doc, result: "fail", severity: "reject", en, hi });
const warn = (code: string, doc: KycCheck["doc"], en: string, hi: string): KycCheck => ({ code, doc, result: "warn", en, hi });

const DOC_NAME: Record<DocType, [string, string]> = {
  gst_certificate: ["GST certificate", "GST सर्टिफ़िकेट"],
  udyam_certificate: ["Udyam certificate", "उद्यम सर्टिफ़िकेट"],
  signatory_id: ["signatory ID", "हस्ताक्षरकर्ता ID"],
  address_proof: ["electricity bill (address proof)", "बिजली बिल (पते का प्रमाण)"],
};

export async function verifyKyc(input: VerifyInput): Promise<KycResult> {
  const checks: KycCheck[] = [];
  const docs: DocSummary[] = [];
  let ocrMs = 0;
  const gstReg = loadGstinRegistry();
  const udyamReg = loadUdyamRegistry();

  // ---------- 1. read every uploaded document ----------
  const text: Partial<Record<DocType, string>> = {};
  const meta: Partial<Record<DocType, { confidence: number; rotated: boolean }>> = {};
  for (const doc of ["gst_certificate", "udyam_certificate", "signatory_id", "address_proof"] as DocType[]) {
    const buf = input.files[doc];
    if (!buf) continue;
    try {
      const r = await ocrImage(buf);
      ocrMs += r.ms;
      text[doc] = r.text;
      meta[doc] = { confidence: r.confidence, rotated: r.rotated };
    } catch (e) {
      if (!(e instanceof BadImageError)) throw e;
      text[doc] = "";
      meta[doc] = { confidence: 0, rotated: false };
    }
  }

  const readable = (doc: DocType) => (meta[doc]?.confidence ?? 0) >= MIN_CONFIDENCE;
  const unreadable = (doc: DocType) => fix(`${doc}_unreadable`, doc,
    `We couldn't read your ${DOC_NAME[doc][0]}: the photo looks blurry or dark. Please take a clear photo in good light and upload it again.`,
    `आपका ${DOC_NAME[doc][1]} पढ़ा नहीं जा सका: फ़ोटो धुँधली या अँधेरी है। अच्छी रोशनी में साफ़ फ़ोटो लेकर दोबारा अपलोड करें।`);
  const wrongDoc = (doc: DocType) => fix(`${doc}_wrong_type`, doc,
    `This doesn't look like a ${DOC_NAME[doc][0]}. Please check you uploaded the right document.`,
    `यह ${DOC_NAME[doc][1]} जैसा नहीं लगता। कृपया देखें कि सही दस्तावेज़ अपलोड किया है।`);

  // ---------- 2. what is required ----------
  const needsGstForPlan = !!input.items?.some((i) => getProduct(i.product_id)?.requires_gstin) || !!input.profile?.has_valid_active_gstin;
  if (input.noGst && input.noUdyam) {
    checks.push(fix("no_registration", "overall",
      "We need at least one business registration: a GST certificate or a Udyam certificate.",
      "हमें कम से कम एक बिज़नेस रजिस्ट्रेशन चाहिए: GST सर्टिफ़िकेट या उद्यम सर्टिफ़िकेट।"));
  }
  if (input.noGst && needsGstForPlan) {
    checks.push(fix("plan_needs_gst", "overall",
      "Your plan has products that need an active GST number. Upload your GST certificate, or go back and remove those products.",
      "आपके प्लान में ऐसे प्रोडक्ट हैं जिनके लिए सक्रिय GST नंबर ज़रूरी है। GST सर्टिफ़िकेट अपलोड करें, या वापस जाकर वे प्रोडक्ट हटा दें।"));
  }
  const missing = (doc: DocType, en: string, hi: string) => checks.push(fix(`${doc}_missing`, doc, en, hi));
  if (!input.files.gst_certificate && !input.noGst) missing("gst_certificate", "GST certificate is missing. Upload it, or tick \"I don't have GST\".", "GST सर्टिफ़िकेट नहीं है। इसे अपलोड करें, या \"मेरे पास GST नहीं है\" चुनें।");
  if (!input.files.udyam_certificate && !input.noUdyam) missing("udyam_certificate", "Udyam certificate is missing. Upload it, or tick \"I don't have Udyam\".", "उद्यम सर्टिफ़िकेट नहीं है। इसे अपलोड करें, या \"मेरे पास उद्यम नहीं है\" चुनें।");
  if (!input.files.signatory_id) missing("signatory_id", "ID of the person signing is missing.", "हस्ताक्षर करने वाले व्यक्ति का ID नहीं है।");
  if (!input.files.address_proof) missing("address_proof", "Address proof (a recent electricity bill) is missing.", "पते का प्रमाण (हाल का बिजली बिल) नहीं है।");

  // ---------- 3. GST certificate ----------
  let gstRec: GstinRecord | undefined;
  const gstFields: Record<string, string> = {};
  if (input.files.gst_certificate) {
    const p = parseGst(text.gst_certificate ?? "");
    const g = readGstin(p.gstinText, (v) => gstReg.has(v));
    if (!readable("gst_certificate") || (!g && !p.legalName)) checks.push(unreadable("gst_certificate"));
    else if (!p.title && !g) checks.push(wrongDoc("gst_certificate"));
    else if (!g) {
      checks.push(fix("gstin_not_found_on_doc", "gst_certificate", "We couldn't find a GSTIN on the certificate. Please upload the full first page.", "सर्टिफ़िकेट पर GSTIN नहीं मिला। कृपया पूरा पहला पेज अपलोड करें।"));
    } else {
      gstFields.gstin = maskId(g.value);
      if (p.tradeName) gstFields.trade_name = p.tradeName;
      if (!g.checksumOk) {
        checks.push(reject("gstin_checksum", "gst_certificate",
          "The GSTIN on this certificate fails the official check-digit test. It may have been altered or mistyped. Our team will help verify your business.",
          "इस सर्टिफ़िकेट का GSTIN आधिकारिक जाँच में फ़ेल है। हो सकता है इसमें बदलाव किया गया हो। हमारी टीम सत्यापन में मदद करेगी।"));
      } else {
        checks.push(pass("gstin_checksum", "gst_certificate", "GSTIN format and check digit are valid.", "GSTIN का फ़ॉर्मेट और चेक-डिजिट सही है।"));
        gstRec = gstReg.get(g.value);
        if (!gstRec) {
          checks.push(reject("gstin_registry", "gst_certificate", "This GSTIN is not in the GST registry.", "यह GSTIN GST रजिस्ट्री में नहीं है।"));
        } else if (gstRec.status !== "Active") {
          checks.push(reject("gst_status", "gst_certificate",
            `This GST registration is ${gstRec.status.toLowerCase()} in the government registry, so we can't activate business services on it.`,
            `सरकारी रजिस्ट्री में यह GST रजिस्ट्रेशन ${gstRec.status === "Cancelled" ? "रद्द" : "निलंबित"} है, इसलिए इस पर बिज़नेस सेवाएँ चालू नहीं हो सकतीं।`));
        } else {
          checks.push(pass("gst_status", "gst_certificate", "GST registration is active in the government registry.", "सरकारी रजिस्ट्री में GST रजिस्ट्रेशन सक्रिय है।"));
        }
        if (gstRec) {
          const nameOk = sameText(p.legalName, gstRec.legal_name) && sameText(p.tradeName, gstRec.trade_name);
          checks.push(nameOk
            ? pass("gst_name_match", "gst_certificate", "Business name matches the GST registry.", "बिज़नेस का नाम GST रजिस्ट्री से मेल खाता है।")
            : fix("gst_name_match", "gst_certificate",
              `The name on the certificate doesn't match the GST registry (registry: "${gstRec.legal_name}"). Please upload your latest GST certificate.`,
              `सर्टिफ़िकेट पर लिखा नाम GST रजिस्ट्री से मेल नहीं खाता (रजिस्ट्री: "${gstRec.legal_name}")। कृपया नवीनतम GST सर्टिफ़िकेट अपलोड करें।`));
          checks.push(sameText(p.address, gstRec.principal_place_of_business)
            ? pass("gst_address_match", "gst_certificate", "Business address matches the GST registry.", "बिज़नेस का पता GST रजिस्ट्री से मेल खाता है।")
            : fix("gst_address_match", "gst_certificate", "The address on the certificate doesn't match the GST registry.", "सर्टिफ़िकेट का पता GST रजिस्ट्री से मेल नहीं खाता।"));
        }
        if (input.typedGstin && input.typedGstin.toUpperCase() !== g.value) {
          checks.push(fix("gstin_typed_mismatch", "gst_certificate", "The GSTIN you typed is different from the one on the certificate.", "आपका लिखा GSTIN सर्टिफ़िकेट वाले से अलग है।"));
        }
      }
    }
  }

  // ---------- 4. Udyam certificate ----------
  let udyamRec: UdyamRecord | undefined;
  let udyamName: string | null = null;
  const udyamFields: Record<string, string> = {};
  if (input.files.udyam_certificate) {
    const p = parseUdyam(text.udyam_certificate ?? "");
    udyamName = p.enterpriseName;
    if (!readable("udyam_certificate") || (!p.number && !p.enterpriseName)) checks.push(unreadable("udyam_certificate"));
    else if (!p.title) checks.push(wrongDoc("udyam_certificate"));
    else if (!p.number) {
      checks.push(fix("udyam_number_missing", "udyam_certificate",
        "The Udyam registration number is blank on this certificate. Please upload a certificate that shows the number.",
        "इस सर्टिफ़िकेट पर उद्यम रजिस्ट्रेशन नंबर ख़ाली है। कृपया नंबर वाला सर्टिफ़िकेट अपलोड करें।"));
    } else {
      udyamFields.udyam = maskUdyam(p.number);
      if (p.enterpriseName) udyamFields.enterprise_name = p.enterpriseName;
      if (!validateUdyam(p.number).valid) {
        checks.push(fix("udyam_format", "udyam_certificate", "The Udyam number on the certificate isn't in the right format.", "सर्टिफ़िकेट पर उद्यम नंबर सही फ़ॉर्मेट में नहीं है।"));
      } else {
        udyamRec = udyamReg.get(p.number);
        if (!udyamRec) {
          checks.push(fix("udyam_registry", "udyam_certificate", "This Udyam number is not in the Udyam registry.", "यह उद्यम नंबर उद्यम रजिस्ट्री में नहीं है।"));
        } else {
          checks.push(pass("udyam_registry", "udyam_certificate", "Udyam registration found in the government registry.", "सरकारी रजिस्ट्री में उद्यम रजिस्ट्रेशन मिला।"));
          checks.push(sameText(p.enterpriseName, udyamRec.enterprise_name)
            ? pass("udyam_name_match", "udyam_certificate", "Enterprise name matches the Udyam registry.", "एंटरप्राइज़ का नाम उद्यम रजिस्ट्री से मेल खाता है।")
            : fix("udyam_name_match", "udyam_certificate", "The enterprise name doesn't match the Udyam registry.", "एंटरप्राइज़ का नाम उद्यम रजिस्ट्री से मेल नहीं खाता।"));
          if (p.city && !sameText(p.city, udyamRec.city)) {
            checks.push(warn("udyam_city", "udyam_certificate", "The city on the Udyam certificate differs from the registry.", "उद्यम सर्टिफ़िकेट का शहर रजिस्ट्री से अलग है।"));
          }
        }
      }
    }
  }

  // ---------- 5. who is the business? ----------
  const businessName = gstRec?.trade_name ?? udyamRec?.enterprise_name ?? udyamName ?? null;
  if (gstRec && (udyamRec || udyamName)) {
    const n = udyamRec?.enterprise_name ?? udyamName;
    checks.push(sameText(n, gstRec.trade_name)
      ? pass("cross_name", "overall", "GST and Udyam certificates are for the same business.", "GST और उद्यम सर्टिफ़िकेट एक ही बिज़नेस के हैं।")
      : fix("cross_name", "overall", "The GST and Udyam certificates show different business names.", "GST और उद्यम सर्टिफ़िकेट पर बिज़नेस के नाम अलग हैं।"));
  }

  // ---------- 6. Signatory ID ----------
  const idFields: Record<string, string> = {};
  if (input.files.signatory_id) {
    const p = parseId(text.signatory_id ?? "");
    if (!readable("signatory_id") || !p.name) checks.push(unreadable("signatory_id"));
    else {
      idFields.name = p.name;
      if (p.designation) idFields.designation = p.designation;
      if (p.idNo) idFields.id_no = maskId(p.idNo.replace(/\s/g, ""));
      if (p.validTill) idFields.valid_till = p.validTill;
      if (!p.validTill || new Date(p.validTill + "T00:00:00Z") < TODAY) {
        checks.push(fix("id_valid", "signatory_id", "This ID has expired (or the expiry date isn't readable). Please upload a valid ID.", "यह ID एक्सपायर हो चुका है (या तारीख़ पढ़ी नहीं जा सकी)। कृपया वैध ID अपलोड करें।"));
      } else {
        checks.push(pass("id_valid", "signatory_id", "ID is valid.", "ID वैध है।"));
      }
      if (businessName) {
        checks.push(sameText(p.business, businessName)
          ? pass("id_business", "signatory_id", "The ID is issued for this business.", "ID इसी बिज़नेस के लिए जारी है।")
          : fix("id_business", "signatory_id", `The ID is for a different business ("${p.business ?? "not readable"}").`, `ID किसी दूसरे बिज़नेस के लिए है ("${p.business ?? "पढ़ा नहीं जा सका"}")।`));
      }
      // For a one-owner business the signatory should be the owner named in the GST record.
      if (gstRec?.constitution === "Proprietorship" && !norm(gstRec.legal_name).startsWith(norm(p.name))) {
        checks.push(warn("id_is_owner", "signatory_id", "The person signing is not the owner on the GST record. The owner may need to approve.", "हस्ताक्षर करने वाला व्यक्ति GST रिकॉर्ड में मालिक नहीं है। मालिक की मंज़ूरी लग सकती है।"));
      }
    }
  }

  // ---------- 7. Address proof ----------
  const billFields: Record<string, string> = {};
  if (input.files.address_proof) {
    const p = parseBill(text.address_proof ?? "");
    if (!readable("address_proof") || (!p.billDate && !p.billedTo)) checks.push(unreadable("address_proof"));
    else if (!p.title) checks.push(wrongDoc("address_proof"));
    else {
      if (p.billDate) billFields.bill_date = p.billDate;
      if (p.billedTo) billFields.billed_to = p.billedTo;
      if (!p.billDate) {
        checks.push(fix("bill_date", "address_proof", "We couldn't read the bill date.", "बिल की तारीख़ पढ़ी नहीं जा सकी।"));
      } else if (!isAddressProofFresh(p.billDate)) {
        checks.push(fix("bill_fresh", "address_proof",
          `This bill is dated ${p.billDate}. Address proof must be from the last 90 days. Please upload a recent bill.`,
          `यह बिल ${p.billDate} का है। पते का प्रमाण पिछले 90 दिनों का होना चाहिए। कृपया हाल का बिल अपलोड करें।`));
      } else {
        checks.push(pass("bill_fresh", "address_proof", "Bill is recent (within 90 days).", "बिल हाल का है (90 दिनों के अंदर)।"));
      }
      if (businessName) {
        checks.push(sameText(p.billedTo, businessName)
          ? pass("bill_name", "address_proof", "Bill is in the business's name.", "बिल बिज़नेस के नाम पर है।")
          : fix("bill_name", "address_proof", "The bill is in a different name from the business.", "बिल बिज़नेस से अलग नाम पर है।"));
      }
      if (gstRec) {
        checks.push(sameText(p.address, gstRec.principal_place_of_business)
          ? pass("bill_address", "address_proof", "Bill address matches the registered business address.", "बिल का पता रजिस्टर्ड पते से मेल खाता है।")
          : fix("bill_address", "address_proof", "The bill address doesn't match the registered business address.", "बिल का पता रजिस्टर्ड पते से मेल नहीं खाता।"));
      } else if (udyamRec && p.address && !norm(p.address).includes(norm(udyamRec.city))) {
        checks.push(warn("bill_city", "address_proof", "The bill address is not in the city on the Udyam record.", "बिल का पता उद्यम रिकॉर्ड वाले शहर में नहीं है।"));
      }
    }
  }

  // ---------- 8. verdict ----------
  const fails = checks.filter((c) => c.result === "fail");
  const verdict = fails.some((c) => c.severity === "reject") ? "REJECTED" : fails.length ? "ACTION_NEEDED" : "VERIFIED";

  const summary = (doc: DocType, fields: Record<string, string>): DocSummary => ({
    doc, provided: !!input.files[doc], readable: input.files[doc] ? readable(doc) : false,
    confidence: meta[doc]?.confidence ?? null, rotated: meta[doc]?.rotated ?? false, fields,
  });
  docs.push(summary("gst_certificate", gstFields), summary("udyam_certificate", udyamFields), summary("signatory_id", idFields), summary("address_proof", billFields));

  return {
    verdict,
    checkedAt: simNow(),
    business: {
      name: businessName,
      source: gstRec ? "gst" : udyamRec || udyamName ? "udyam" : null,
      gstin_masked: gstFields.gstin ?? null,
      udyam_masked: udyamFields.udyam ?? null,
      gst_status: gstRec?.status ?? null,
    },
    docs,
    checks,
    ocrMs,
  };
}
