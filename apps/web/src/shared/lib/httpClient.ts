import axios from "axios";
import { tokenStorage } from "./tokenStorage";

export const httpClient = axios.create({
	// In dev we usually rely on Vite proxying `/api` to the backend.
	// When VITE_API_URL is set (e.g. http://127.0.0.1:8090), we still need the `/api` prefix
	// because backend routes are mounted under `/api/v1/...`.
	baseURL: (() => {
		const raw = import.meta.env.VITE_API_URL?.trim();
		if (!raw) return "/api";
		return raw.endsWith("/api") ? raw : `${raw.replace(/\/+$/, "")}/api`;
	})(),
	headers: { "Content-Type": "application/json" },
});

httpClient.interceptors.request.use((config) => {
	const token = tokenStorage.getToken();
	if (token) config.headers.Authorization = `Bearer ${token}`;
	return config;
});

