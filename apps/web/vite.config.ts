import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "VITE_");
	const rawTarget = env.VITE_API_URL?.trim() ?? "";
	const fallbackTarget = "http://127.0.0.1:8090";
	const target = rawTarget || fallbackTarget;

	const proxy = (() => {
		// If target isn't a valid absolute URL, disable proxy to avoid Vite crashing.
		try {
			// eslint-disable-next-line no-new
			new URL(target);
		} catch {
			return undefined;
		}

		return {
			"/api": {
				target,
				changeOrigin: true,
			},
		};
	})();

	return {
		plugins: [react()],
		base: process.env.NODE_ENV === "production" ? "/" : "/",
		server: {
			host: "127.0.0.1",
			port: 5174,
			proxy,
		},
	};
});
