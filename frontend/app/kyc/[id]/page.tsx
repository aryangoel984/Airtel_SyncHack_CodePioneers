// Server page: wraps the client KYC view in Suspense (the view reads the URL parameter at runtime).
import { Suspense } from "react";
import KycView from "@/components/kyc/KycView";

export default function KycPage() {
  return (
    <Suspense fallback={<p className="p-10 text-center text-gray-600">…</p>}>
      <KycView />
    </Suspense>
  );
}
