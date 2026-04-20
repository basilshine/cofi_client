/**
 * Shared helpers for Ceits marketing (`ceits.app`) and workspace (`use.ceits.app`) URLs.
 * Env-specific defaults live in each Vite app.
 */

/**
 * Normalize a site base URL (origin, or origin + pathname prefix). No trailing slash.
 */
export const normalizeCeitsSiteBase = (
	raw: string | undefined,
	fallback: string,
): string => {
	const t = raw?.trim() ?? "";
	if (!t) {
		return fallback.replace(/\/+$/, "");
	}
	try {
		const u = new URL(t);
		const path = u.pathname.replace(/\/+$/, "");
		const prefix = path === "" || path === "/" ? "" : path;
		return `${u.origin}${prefix}`;
	} catch {
		return fallback.replace(/\/+$/, "");
	}
};

/**
 * Join a site base with a path or path+query (`path` should start with `/`).
 */
export const ceitsSiteUrl = (siteBase: string, path: string): string => {
	const base = siteBase.replace(/\/+$/, "");
	const p = path.startsWith("/") ? path : `/${path}`;
	return `${base}${p}`;
};
