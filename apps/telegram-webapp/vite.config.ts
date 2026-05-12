import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	base: process.env.NODE_ENV === "production" ? "/" : "/",
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@web": path.resolve(__dirname, "../web/src"),
		},
	},
	server: {
		proxy: {
			"/api": {
				target: process.env.VITE_API_URL,
				changeOrigin: true,
			},
		},
	},
});
