"use client";
// Developer test page (the Step 1 page): proves the backend APIs work. Not for customers.
import { useState } from "react";
import { api } from "@/lib/api";
import type { EligibleProduct, GstinLookup } from "@/lib/types";

export default function DevPage() {
  const [gstin, setGstin] = useState("03PJNXS4821G1ZB");
  const [gstinOut, setGstinOut] = useState<GstinLookup | null>(null);
  const [tier, setTier] = useState(1);
  const [employees, setEmployees] = useState(10);
  const [sites, setSites] = useState(1);
  const [hasGstin, setHasGstin] = useState(true);
  const [products, setProducts] = useState<EligibleProduct[]>([]);
  const [error, setError] = useState("");

  async function lookup() {
    try { setError(""); setGstinOut(await api.lookupGstin(gstin)); } catch (e) { setError(String(e)); }
  }
  async function listEligible() {
    try {
      setError("");
      const r = await api.eligible({ segment: "prof", city_tier: tier, employee_count: employees, num_sites: sites, has_valid_active_gstin: hasGstin });
      setProducts(r.products);
    } catch (e) { setError(String(e)); }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <h1 className="text-xl font-bold">Dev test page (calls the backend)</h1>
      {error && <p className="text-red-600">{error}</p>}
      <section className="space-y-2">
        <h2 className="font-semibold">GSTIN lookup</h2>
        <input className="border p-1" value={gstin} onChange={(e) => setGstin(e.target.value)} />{" "}
        <button className="border px-2" onClick={lookup}>Look up</button>
        <pre className="overflow-auto bg-gray-100 p-2 text-xs text-black">{gstinOut ? JSON.stringify(gstinOut, null, 2) : ""}</pre>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">Eligible products</h2>
        <label>Tier <select className="border" value={tier} onChange={(e) => setTier(+e.target.value)}><option>1</option><option>2</option></select></label>{" "}
        <label>Employees <input className="w-16 border" type="number" min={1} value={employees} onChange={(e) => setEmployees(+e.target.value)} /></label>{" "}
        <label>Sites <input className="w-16 border" type="number" min={1} value={sites} onChange={(e) => setSites(+e.target.value)} /></label>{" "}
        <label><input type="checkbox" checked={hasGstin} onChange={(e) => setHasGstin(e.target.checked)} /> Valid active GSTIN</label>{" "}
        <button className="border px-2" onClick={listEligible}>Show products</button>
        <ul className="list-disc pl-6 text-sm">
          {products.map((p) => (
            <li key={p.product_id}>{p.product_id} {p.product_name} ({p.unit}) from ₹{p.price_min_inr_per_month}, suggested qty {p.suggested_quantity}</li>
          ))}
        </ul>
        {products.length > 0 && <p className="text-sm">{products.length} products eligible</p>}
      </section>
    </main>
  );
}
