import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5174";
const channel = process.env.PLAYWRIGHT_CHANNEL ?? "msedge";
const storageState = process.env.PLAYWRIGHT_STORAGE_STATE || undefined;

export default defineConfig({
	testDir: "./tests/browser",
	timeout: 30_000,
	expect: {
		timeout: 7_500,
	},
	use: {
		...devices["Desktop Chrome"],
		baseURL,
		channel,
		screenshot: "only-on-failure",
		storageState,
		trace: "retain-on-failure",
	},
	webServer: {
		command: "npm run dev:web -- --host 127.0.0.1 --port 5174",
		reuseExistingServer: true,
		timeout: 120_000,
		url: baseURL,
	},
});
