import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // A git worktree under .claude/ holds a second copy of every test file and
    // would double the count. The number has to mean something.
    // The App tests render the whole page against a stubbed API; on a loaded
    // machine that takes longer than the 5 s default, and a timeout is not a
    // finding about the code.
    testTimeout: 15000,
    exclude: ["**/node_modules/**", "**/dist/**", ".claude/**"]
  }
});
