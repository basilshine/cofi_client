/**
 * Build client routes for expense list / add / edit.
 * When `spaceId` is set, paths are nested under `/spaces/:spaceId/expenses/...`
 * so space-scoped flows (e.g. vendors for that space’s tenant) keep stable URLs.
 */

export const expenseListPath = (spaceId?: number): string =>
	spaceId != null ? `/spaces/${spaceId}/expenses` : "/expenses";

export const expenseAddPath = (spaceId?: number): string =>
	spaceId != null ? `/spaces/${spaceId}/expenses/add` : "/expenses/add";

export const expenseEditPath = (
	expenseId: string | number,
	opts?: {
		spaceId?: number;
		item?: string;
		returnTo?: string;
	},
): string => {
	const base =
		opts?.spaceId != null
			? `/spaces/${opts.spaceId}/expenses/${expenseId}/edit`
			: `/expenses/${expenseId}/edit`;
	const q = new URLSearchParams();
	if (opts?.item) {
		q.set("item", opts.item);
	}
	if (opts?.returnTo) {
		q.set("returnTo", opts.returnTo);
	}
	const qs = q.toString();
	return qs ? `${base}?${qs}` : base;
};
