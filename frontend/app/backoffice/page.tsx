// Back office for sales teams and channel partners (Step 6). Staff PIN required.
import type { Metadata } from "next";
import BackOffice from "@/components/backoffice/BackOffice";

export const metadata: Metadata = { title: "Accel Business: Back office", robots: { index: false } };

export default function BackOfficePage() {
  return <BackOffice />;
}
