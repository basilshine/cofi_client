import { ceitsSiteUrl, normalizeCeitsSiteBase } from "@cofi/ceits-urls";

/** Local marketing dev server (see `apps/marketing` vite port). */
const MARKETING_DEV_FALLBACK = "http://127.0.0.1:5173";

export const getMarketingSiteBase = (): string =>
	normalizeCeitsSiteBase(
		import.meta.env.VITE_MARKETING_URL,
		MARKETING_DEV_FALLBACK,
	);

/** Absolute URL on the marketing host (`ceits.app` in production). */
export const marketingUrl = (path: string): string =>
	ceitsSiteUrl(getMarketingSiteBase(), path);
