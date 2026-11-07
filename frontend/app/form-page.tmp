"use client";
// Start page: a short form about the business. (The AI Advisor replaces this in Step 3.)
import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useLang } from "@/lib/LangContext";
import { saveProfile } from "@/lib/profile";

const SEGMENTS = ["micro", "prof", "multi", "mfg"] as const;

export default function StartPage() {
  const { t } = useLang();
  const router = useRouter();
  const [segment, setSegment] = useState<string>("micro");
  const [tier, setTier] = useState(1);
  const [staff, setStaff] = useState("3");
  const [sites, setSites] = useState("1");
  const [gst, setGst] = useState(true);
  const [tried, setTried] = useState(false);

  const staffN = parseInt(staff, 10);
  const sitesN = parseInt(sites, 10);
  const staffOk = staffN >= 1 && staffN <= 100000;
  const sitesOk = sitesN >= 1 && sitesN <= 10000;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!staffOk || !sitesOk) return;
    saveProfile({ segment, city_tier: tier, employee_count: staffN, num_sites: sitesN, has_valid_active_gstin: gst });
    router.push("/quote");
  }

  const choice = (active: boolean) =>
    `min-h-12 rounded-xl border px-3 py-2 text-left text-sm font-medium ${active ? "border-brand bg-brand-soft text-brand-dark" : "border-gray-300 bg-white"}`;
  const input = "mt-1 block min-h-12 w-full rounded-lg border border-gray-300 bg-white px-3 text-lg";

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="text-2xl font-bold">{t("start_title")}</h1>
        <p className="mt-1 text-gray-600">{t("start_sub")}</p>

        <form onSubmit={submit} className="mt-5 space-y-6 rounded-2xl bg-white p-4 shadow-sm">
          <fieldset>
            <legend className="font-semibold">{t("f_type")}</legend>
            <div className="mt-2 grid gap-2">
              {SEGMENTS.map((s) => (
                <button type="button" key={s} onClick={() => setSegment(s)} aria-pressed={segment === s} className={choice(segment === s)}>
                  {t("seg_" + s)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="font-semibold">{t("f_city")}</legend>
            <div className="mt-2 grid gap-2">
              {[1, 2].map((v) => (
                <button type="button" key={v} onClick={() => setTier(v)} aria-pressed={tier === v} className={choice(tier === v)}>
                  {t("city_" + v)}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <label className="font-semibold">
              {t("f_staff")}
              <input inputMode="numeric" value={staff} onChange={(e) => setStaff(e.target.value.replace(/\D/g, ""))} className={input} />
              {tried && !staffOk && <span className="text-sm font-normal text-brand-dark">{t("err_staff")}</span>}
            </label>
            <label className="font-semibold">
              {t("f_sites")}
              <input inputMode="numeric" value={sites} onChange={(e) => setSites(e.target.value.replace(/\D/g, ""))} className={input} />
              {tried && !sitesOk && <span className="text-sm font-normal text-brand-dark">{t("err_sites")}</span>}
            </label>
          </div>

          <fieldset>
            <legend className="font-semibold">{t("f_gst")}</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setGst(true)} aria-pressed={gst} className={choice(gst)}>{t("yes")}</button>
              <button type="button" onClick={() => setGst(false)} aria-pressed={!gst} className={choice(!gst)}>{t("no")}</button>
            </div>
          </fieldset>

          <button type="submit" className="min-h-14 w-full rounded-xl bg-brand text-lg font-semibold text-white active:bg-brand-dark">
            {t("show_plan")}
          </button>
        </form>
      </main>
    </>
  );
}
