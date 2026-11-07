import { it, expect } from "vitest";
import { loadLeads, loadGstinRegistry, parseBundle } from "@/lib/data";
import { checkBundle } from "@/lib/rules";

// Sanity check: how many ACTIVATED historic bundles break today's rules?
it("counts rule-breaking activated bundles", () => {
  const registry = loadGstinRegistry();
  const activated = loadLeads().filter((l) => l.outcome === "Activated");
  let broken = 0; // any problem at all
  let blockedOnly = 0; // at least one product blocked (tier/size/GSTIN/unfixable dependency)
  for (const lead of activated) {
    const gstinActive = lead.has_gstin && registry.get(lead.gstin)?.status === "Active";
    const r = checkBundle(
      {
        segment: lead.segment,
        city_tier: lead.city_tier,
        employee_count: lead.employee_count,
        num_sites: lead.num_sites,
        has_valid_active_gstin: gstinActive,
      },
      parseBundle(lead.bundle_products),
    );
    if (r.violation_count > 0) broken++;
    if (r.blocked.length > 0) blockedOnly++;
  }
  console.log(`\n>>> Activated bundles checked: ${activated.length}; rule-breaking (any rule incl. missing dependency): ${broken}; with a blocked product: ${blockedOnly}\n`);
  expect(activated.length).toBe(368);
  expect(broken).toBeGreaterThan(0);
  expect(blockedOnly).toBe(48); // README-expected ~48; the other 8 only lack a dependency product
});
