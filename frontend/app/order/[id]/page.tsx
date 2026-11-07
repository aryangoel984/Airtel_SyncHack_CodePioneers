// Server page: just wraps the client view in Suspense (required by Next's cache-components mode,
// because the view reads the URL parameter at runtime).
import { Suspense } from "react";
import OrderView from "@/components/OrderView";

export default function OrderPage() {
  return (
    <Suspense fallback={<p className="p-10 text-center text-gray-600">…</p>}>
      <OrderView />
    </Suspense>
  );
}
