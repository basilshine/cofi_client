/** Query param for deep-linking to a manual draft line in the expense thread UI. */
export const DRAFT_LINE_QUERY = "line";

/**
 * Stable DOM id for a manual line row (1-based line index, matches "Line N" labels).
 */
export const draftLineElementId = (
	expenseId: string | number,
	lineOneBased: number,
): string => `draft-line-${String(expenseId)}-${String(lineOneBased)}`;

/**
 * Shareable URL; opening it redirects into chat with the inline thread and optional line focus.
 */
export const buildExpenseThreadLink = (
	spaceId: string | number,
	expenseId: string | number,
	lineOneBased?: number,
): string => {
	const qs = new URLSearchParams({
		spaceId: String(spaceId),
		expenseId: String(expenseId),
	});
	if (lineOneBased != null && lineOneBased >= 1) {
		qs.set(DRAFT_LINE_QUERY, String(lineOneBased));
	}
	return `/console/chat/thread?${qs.toString()}`;
};
