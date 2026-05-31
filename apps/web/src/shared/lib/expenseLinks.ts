export const buildExpenseDetailHref = (
	spaceId: string | number,
	expenseId: string | number,
	options?: { line?: number | null },
): string => {
	const params = new URLSearchParams({
		spaceId: String(spaceId),
		expenseId: String(expenseId),
	});
	if (options?.line != null && options.line >= 1) {
		params.set("line", String(options.line));
	}
	return `/console/chat/expenses?${params.toString()}`;
};
