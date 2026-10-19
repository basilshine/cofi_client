import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/styles",
	outputDir: "./.tmp/style-results",
	fullyParallel: true,
	timeout: 30_000,
	expect: { timeout: 7_500 },
	use: {
		contextOptions: { reducedMotion: "reduce" },
		serviceWorkers: "block",
		trace: "retain-on-failure",
	},
	projects: [
		{
			name: "desktop",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1440, height: 1000 },
			},
		},
		{
			name: "narrow",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 320, height: 900 },
			},
		},
		{
			name: "webkit",
			use: { ...devices["iPhone 13"], browserName: "webkit" },
		},
		{ name: "firefox", use: { ...devices["Desktop Firefox"] } },
	],
	snapshotPathTemplate:
		"{testDir}/../../.tmp/tailwind-visual/{projectName}/{arg}{ext}",
	webServer: [
		{
			command:
				"node node_modules/vite/bin/vite.js preview apps/web --host 127.0.0.1 --port 5210 --strictPort",
			url: "http://127.0.0.1:5210",
			reuseExistingServer: false,
		},
		{
			command:
				"node node_modules/vite/bin/vite.js preview apps/marketing --host 127.0.0.1 --port 5211 --strictPort",
			url: "http://127.0.0.1:5211",
			reuseExistingServer: false,
		},
		{
			command:
				"node node_modules/vite/bin/vite.js preview apps/telegram-webapp --host 127.0.0.1 --port 5212 --strictPort",
			url: "http://127.0.0.1:5212",
			reuseExistingServer: false,
		},
	],
});
