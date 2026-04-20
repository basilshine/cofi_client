import { createWsClient } from "@cofi/api";
import { tokenStorage } from "./tokenStorage";

const toWsBaseUrl = (apiBaseUrl: string) => {
	const trimmed = apiBaseUrl.trim().replace(/\/+$/, "");
	if (trimmed.startsWith("https://")) return trimmed.replace(/^https:\/\//, "wss://");
	if (trimmed.startsWith("http://")) return trimmed.replace(/^http:\/\//, "ws://");
	return trimmed;
};

const apiBaseUrl = import.meta.env.VITE_API_URL?.trim() || "";
const baseWsUrl = import.meta.env.VITE_WS_URL?.trim() || (apiBaseUrl ? toWsBaseUrl(apiBaseUrl) : "");

export const wsClient = createWsClient({
	baseWsUrl,
	getAccessToken: () => tokenStorage.getToken(),
});

