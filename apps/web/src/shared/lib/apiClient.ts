import { createApiClient } from "@cofi/api";
import { tokenStorage } from "./tokenStorage";

export const apiClient = createApiClient({
	// In dev we usually rely on Vite proxying `/api` to the backend.
	// When VITE_API_URL is not set, default to relative `/api`.
	baseUrl: import.meta.env.VITE_API_URL?.trim() || "/api",
	getAccessToken: () => tokenStorage.getToken(),
});

