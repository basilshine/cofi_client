import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/pnz",
	timeout: 30_000,
	use: {
		...devices["iPhone 13"],
		browserName: "chromium",
		baseURL: "http://127.0.0.1:5203",
		serviceWorkers: "block",
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
	},
	webServer: {
		command:
			"node node_modules/vite/bin/vite.js preview apps/poka-ne-zabyl --host 127.0.0.1 --port 5203 --strictPort",
		url: "http://127.0.0.1:5203/app",
		reuseExistingServer: !process.env.CI,
	},
});
