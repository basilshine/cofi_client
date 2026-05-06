/**
 * Public URL of the Ceits web workspace (signed-in app on `use.ceits.app`) and Telegram web app.
 * Set `VITE_CEITS_APP_URL` in `.env.local` to the workspace origin (e.g. `https://use.ceits.app`).
 * No trailing slash.
 */

const normalizeBase = (raw: string): string => raw.trim().replace(/\/+$/, "");

/**
 * Origin + optional pathname prefix for deployments where the app is not at `/`.
 */
export const getCeitsAppBaseUrl = (): string | null => {
	const raw = import.meta.env.VITE_CEITS_APP_URL;
	if (typeof raw !== "string" || !raw.trim()) {
		return null;
	}
	try {
		const u = new URL(normalizeBase(raw));
		const path = u.pathname.replace(/\/+$/, "");
		return `${u.origin}${path === "/" ? "" : path}`;
	} catch {
		return null;
	}
};

export const ceitsSpaceExpensesListUrl = (
	spaceId: string | number,
): string | null => {
	const base = getCeitsAppBaseUrl();
	if (!base) return null;
	return `${base}/spaces/${encodeURIComponent(String(spaceId))}/expenses`;
};

export const ceitsSpaceExpenseAddUrl = (
	spaceId: string | number,
): string | null => {
	const base = getCeitsAppBaseUrl();
	if (!base) return null;
	return `${base}/spaces/${encodeURIComponent(String(spaceId))}/expenses/add`;
};

/** Join landing page with a space/tenant invite token (share this from invite emails). */
export const ceitsInviteJoinUrl = (token: string): string | null => {
	const base = getCeitsAppBaseUrl();
	if (!base) return null;
	return `${base}/join?token=${encodeURIComponent(token)}`;
};

export const ceitsSpaceExpenseEditUrl = (
	spaceId: string | number,
	expenseId: string | number,
): string | null => {
	const base = getCeitsAppBaseUrl();
	if (!base) return null;
	return `${base}/spaces/${encodeURIComponent(String(spaceId))}/expenses/${encodeURIComponent(String(expenseId))}/edit`;
};
