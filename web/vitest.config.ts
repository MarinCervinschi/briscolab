import { defineConfig } from "vitest/config";

// Separate from vite.config.ts, whose Start plugin wants the whole app to boot.
export default defineConfig({
	resolve: { tsconfigPaths: true },
	test: { include: ["src/**/*.test.ts"] },
});
