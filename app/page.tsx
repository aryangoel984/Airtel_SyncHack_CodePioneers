"use client";
// Plain test page: proves the APIs work. No styling effort (Step 2 builds the real UI).
import { useState } from "react";

export default function Home() {
  const [gstin, setGstin] = useState("03PJNXS4821G1ZB");
  const [gstinOut, setGstinOut] = useState<unknown>(null);

  const [tier, setTier] = useState(1);
  const [employees, setEmployees] = useState(10);
  const [sites, setSites] = useState(1);
  const [hasGstin, setHasGstin] = useState(true);
  const [products, setProducts] = useState<
    { product_id: string; product_name: string; unit: string; price_min_inr_per_month: number; suggested_quantity: number }[]
  >([]);

  async function lookup() {
    const res = await fetch(`/api/gstin/${encodeURIComponent(gstin)}`);
    setGstinOut(await res.json());
  }

  async function listEligible() {
    const res = await fetch("/api/eligible", {
      method: "POST",
      body: JSON.stringify({
        segment: "prof", city_tier: tier, employee_count: employees,
        num_sites: sites, has_valid_active_gstin: hasGstin,
      }),
    });
    setProducts((await res.json()).products);
  }

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <h1 className="text-xl font-bold">Udyam Digital: Step 1 API test page</h1>

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
            <li key={p.product_id}>
              {p.product_id} {p.product_name} ({p.unit}) from ₹{p.price_min_inr_per_month}, suggested qty {p.suggested_quantity}
            </li>
          ))}
        </ul>
        {products.length > 0 && <p className="text-sm">{products.length} products eligible</p>}
      </section>
    </main>
  );
}
