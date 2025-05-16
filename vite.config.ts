import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	base: process.env.NODE_ENV === "production" ? "/" : "/",
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@components": path.resolve(__dirname, "./src/components"),
			"@features": path.resolve(__dirname, "./src/features"),
			"@hooks": path.resolve(__dirname, "./src/hooks"),
			"@store": path.resolve(__dirname, "./src/store"),
			"@types": path.resolve(__dirname, "./src/types"),
			"@utils": path.resolve(__dirname, "./src/utils"),
			"@pages": path.resolve(__dirname, "./src/pages"),
			"@contexts": path.resolve(__dirname, "./src/contexts"),
			"@services": path.resolve(__dirname, "./src/services"),
			"@providers": path.resolve(__dirname, "./src/providers"),
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
