import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";

/** In-app paths only: absolute on this origin, not protocol-relative or http(s) URLs. */
const isAllowedLocalAppPath = (href: string): boolean => {
	const t = href.trim();
	if (!t.startsWith("/")) return false;
	if (t.startsWith("//")) return false;
	return true;
};

const parseLegacyReviewDeepLink = (
	raw: string,
): { spaceId: string; expenseId: string; line: number | null } | null => {
	try {
		const u = raw.startsWith("/")
			? new URL(raw, "https://ceits.local")
			: new URL(raw);
		const path = u.pathname.replace(/\/$/, "");
		if (!path.endsWith("/console/chat/thread")) return null;
		const expenseId = u.searchParams.get("expenseId");
		const spaceId = u.searchParams.get("spaceId");
		const lineRaw = u.searchParams.get("line");
		if (!expenseId || !spaceId) return null;
		const line = lineRaw != null ? Number.parseInt(lineRaw, 10) : Number.NaN;
		return {
			spaceId,
			expenseId,
			line: Number.isFinite(line) && line >= 1 ? line : null,
		};
	} catch {
		return null;
	}
};

export type LegacyReviewDeepLink = {
	spaceId: string;
	expenseId: string;
	line: number | null;
};

const isSameExpenseLink = (
	parsed: { spaceId: string; expenseId: string; line: number | null },
	spaceId: string | number,
	expenseId: string | number | null | undefined,
): boolean =>
	expenseId != null &&
	String(parsed.spaceId) === String(spaceId) &&
	String(parsed.expenseId) === String(expenseId);

const MD_LINK = /^\[([^\]]+)\]\(([^)]+)\)$/;

/** Matches line shortcuts, markdown links, and bare `/console` paths. External URLs stay plain text. */
const TOKEN = /\[\[line:(\d+)\]\]|\[[^\]]+\]\([^)]+\)|\/console\/[^\s]+/g;

/**
 * Renders chat text: `[[line:N]]`, markdown `[label](/console/...)`, and local `/console/...` paths.
 * Old `/console/chat/thread` links are treated as compatibility review links.
 */
export const ChatMessageRichText = ({
	body,
	spaceId,
	expenseId,
	onJumpToLine,
	onOpenLegacyReviewLink,
}: {
	body: string;
	spaceId: string | number;
	expenseId: string | number | null | undefined;
	onJumpToLine: (lineOneBased: number) => void;
	onOpenLegacyReviewLink?: (link: LegacyReviewDeepLink) => void;
}): ReactNode => {
	const nodes: ReactNode[] = [];
	let lastIndex = 0;
	let key = 0;
	let m: RegExpExecArray | null;

	for (;;) {
		m = TOKEN.exec(body);
		if (m === null) break;
		if (m.index > lastIndex) {
			nodes.push(
				<Fragment key={`t-${key++}`}>
					{body.slice(lastIndex, m.index)}
				</Fragment>,
			);
		}

		const match = m[0];

		if (m[1] != null) {
			const line = Number.parseInt(m[1], 10);
			if (Number.isFinite(line) && line >= 1) {
				nodes.push(
					<button
						className="inline font-medium text-primary underline decoration-primary/60 underline-offset-2 hover:decoration-primary"
						key={`ln-${key++}`}
						onClick={() => onJumpToLine(line)}
						type="button"
					>
						Line {line}
					</button>,
				);
			} else {
				nodes.push(<Fragment key={`bad-${key++}`}>{match}</Fragment>);
			}
		} else if (match.startsWith("[")) {
			const parsedMd = match.match(MD_LINK);
			if (parsedMd) {
				const label = parsedMd[1];
				const url = parsedMd[2].trim();
				if (!isAllowedLocalAppPath(url)) {
					nodes.push(<Fragment key={`mdx-${key++}`}>{match}</Fragment>);
				} else {
					const parsed = parseLegacyReviewDeepLink(url);
					if (
						parsed?.line != null &&
						isSameExpenseLink(parsed, spaceId, expenseId)
					) {
						nodes.push(
							<button
								className="inline font-medium text-primary underline decoration-primary/60 underline-offset-2 hover:decoration-primary"
								key={`mdj-${key++}`}
								onClick={() => onJumpToLine(parsed.line as number)}
								type="button"
							>
								{label}
							</button>,
						);
					} else if (parsed && onOpenLegacyReviewLink) {
						nodes.push(
							<button
								className="inline font-medium text-primary underline decoration-primary/60 underline-offset-2 hover:decoration-primary"
								key={`mdo-${key++}`}
								onClick={() => onOpenLegacyReviewLink(parsed)}
								type="button"
							>
								{label}
							</button>,
						);
					} else {
						nodes.push(
							<Link
								className="inline font-medium text-primary underline decoration-primary/60 underline-offset-2 hover:decoration-primary"
								key={`mdk-${key++}`}
								to={url}
							>
								{label}
							</Link>,
						);
					}
				}
			} else {
				nodes.push(<Fragment key={`mdu-${key++}`}>{match}</Fragment>);
			}
		} else if (match.startsWith("/console")) {
			const parsed = parseLegacyReviewDeepLink(match);
			if (
				parsed?.line != null &&
				isSameExpenseLink(parsed, spaceId, expenseId)
			) {
				nodes.push(
					<button
						className="inline font-medium text-primary underline decoration-primary/60 underline-offset-2 hover:decoration-primary"
						key={`br-${key++}`}
						onClick={() => onJumpToLine(parsed.line as number)}
						type="button"
					>
						Line {parsed.line}
					</button>,
				);
			} else if (parsed && onOpenLegacyReviewLink) {
				nodes.push(
					<button
						className="break-all font-medium text-primary underline decoration-primary/60 underline-offset-2 hover:decoration-primary"
						key={`bro-${key++}`}
						onClick={() => onOpenLegacyReviewLink(parsed)}
						type="button"
					>
						Review capture
					</button>,
				);
			} else if (isAllowedLocalAppPath(match)) {
				nodes.push(
					<Link
						className="break-all font-medium text-primary underline decoration-primary/60 underline-offset-2 hover:decoration-primary"
						key={`brk-${key++}`}
						to={match}
					>
						{match}
					</Link>,
				);
			} else {
				nodes.push(<Fragment key={`brx-${key++}`}>{match}</Fragment>);
			}
		}

		lastIndex = m.index + match.length;
	}

	if (lastIndex < body.length) {
		nodes.push(
			<Fragment key={`end-${key++}`}>{body.slice(lastIndex)}</Fragment>,
		);
	}

	return <>{nodes}</>;
};
