import { createWsClient } from "@cofi/api";
import { authSessionStore } from "./authSessionStore";

const toWsBaseUrl = (apiBaseUrl: string) => {
	const trimmed = apiBaseUrl.trim().replace(/\/+$/, "");
	try {
		const url = new URL(trimmed);
		if (url.protocol === "https:") url.protocol = "wss:";
		else if (url.protocol === "http:") url.protocol = "ws:";
		return url.toString().replace(/\/+$/, "");
	} catch {
		// If it's not a full URL, return as-is and let caller-provided WS URL handle local/dev.
	}
	return trimmed;
};

const apiBaseUrl = import.meta.env.VITE_API_URL?.trim() || "";
const baseWsUrl =
	import.meta.env.VITE_WS_URL?.trim() ||
	(apiBaseUrl ? toWsBaseUrl(apiBaseUrl) : "");

export const wsClient = createWsClient({
	baseWsUrl,
	getAccessToken: () => authSessionStore.getRequestAccessToken(),
});
