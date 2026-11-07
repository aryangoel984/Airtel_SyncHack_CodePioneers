import { defineConfig } from "vitest/config";
import path from "path";

// "@/lib/x" in tests points at backend/src/lib/x. Tests run with cwd = backend/.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // An empty key means dotenv will NOT load the real one, so tests can never reach Groq.
    env: { GROQ_API_KEY: "" },
  },
});
