import { buildExpenseThreadLink } from "./draftLineAnchors";

/** In-app paths only: absolute on this origin, not protocol-relative or http(s) URLs. */
export const isAllowedLocalAppPath = (href: string): boolean => {
	const t = href.trim();
	if (!t.startsWith("/")) return false;
	if (t.startsWith("//")) return false;
	return true;
};

/** Stored in messages as plain text; rendered as a clickable local link. */
export const buildExpenseThreadMarkdownLink = (
	spaceId: string | number,
	expenseId: string | number,
	lineOneBased: number,
): string => {
	const path = buildExpenseThreadLink(spaceId, expenseId, lineOneBased);
	return `[Line ${lineOneBased}](${path})`;
};
