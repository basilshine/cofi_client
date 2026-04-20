import { ceitsSiteUrl, normalizeCeitsSiteBase } from "@cofi/ceits-urls";

/** Local workspace dev server (see `apps/web` vite port). */
const WORKSPACE_DEV_FALLBACK = "http://127.0.0.1:5174";

export const getWorkspaceSiteBase = (): string =>
	normalizeCeitsSiteBase(
		import.meta.env.VITE_WORKSPACE_URL,
		WORKSPACE_DEV_FALLBACK,
	);

/** Absolute URL on the workspace host (`use.ceits.app` in production). */
export const workspaceUrl = (path: string): string =>
	ceitsSiteUrl(getWorkspaceSiteBase(), path);
