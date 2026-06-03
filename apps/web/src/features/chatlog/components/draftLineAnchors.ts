/**
 * Stable DOM id for a manual line row (1-based line index, matches "Line N" labels).
 */
export const draftLineElementId = (
	expenseId: string | number,
	lineOneBased: number,
): string => `draft-line-${String(expenseId)}-${String(lineOneBased)}`;
