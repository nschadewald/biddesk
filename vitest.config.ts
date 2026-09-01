import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // A git worktree under .claude/ holds a second copy of every test file and
    // would double the count. The number has to mean something.
    exclude: ["**/node_modules/**", "**/dist/**", ".claude/**"]
  }
});
