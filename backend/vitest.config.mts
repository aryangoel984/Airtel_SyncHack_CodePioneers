import { defineConfig } from "vitest/config";
import path from "path";

// "@/lib/x" in tests points at backend/src/lib/x. Tests run with cwd = backend/.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
