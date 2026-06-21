import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";

/** In-app paths only: absolute on this origin, not protocol-relative or http(s) URLs. */
const isAllowedLocalAppPath = (href: string): boolean => {
	const t = href.trim();
	if (!t.startsWith("/")) return false;
	if (t.startsWith("//")) return false;
	return true;
};

const MD_LINK = /^\[([^\]]+)\]\(([^)]+)\)$/;

/** Matches line shortcuts, markdown links, and bare `/console` paths. External URLs stay plain text. */
const TOKEN = /\[\[line:(\d+)\]\]|\[[^\]]+\]\([^)]+\)|\/console\/[^\s]+/g;

/**
 * Renders chat text: `[[line:N]]`, markdown `[label](/console/...)`, and local `/console/...` paths.
 */
export const ChatMessageRichText = ({
	body,
	onJumpToLine,
}: {
	body: string;
	onJumpToLine: (lineOneBased: number) => void;
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
			} else {
				nodes.push(<Fragment key={`mdu-${key++}`}>{match}</Fragment>);
			}
		} else if (match.startsWith("/console")) {
			if (isAllowedLocalAppPath(match)) {
				nodes.push(
					<Link
						className="break-all font-medium text-primary underline decoration-primary/60 underline-offset-2 hover:decoration-primary"
						key={`br-${key++}`}
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
