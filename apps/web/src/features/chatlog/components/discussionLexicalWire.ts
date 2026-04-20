import { $createLinkNode, $isLinkNode } from "@lexical/link";
import {
	$createParagraphNode,
	$createTextNode,
	$getRoot,
	$isParagraphNode,
	$isTextNode,
	type ParagraphNode,
} from "lexical";
import { isAllowedLocalAppPath } from "./discussionLocalLinks";

/**
 * Serialize editor → plain string stored on the server (markdown links + newlines).
 */
export const $serializeDiscussionWire = (): string => {
	const root = $getRoot();
	const lines: string[] = [];
	for (const child of root.getChildren()) {
		if ($isParagraphNode(child)) {
			lines.push($serializeParagraphInline(child));
		}
	}
	return lines.join("\n");
};

const $serializeParagraphInline = (p: ParagraphNode): string => {
	let s = "";
	for (const n of p.getChildren()) {
		if ($isTextNode(n)) {
			s += n.getTextContent();
		} else if ($isLinkNode(n)) {
			const url = n.getURL();
			const text = n.getTextContent();
			s += `[${text}](${url})`;
		}
	}
	return s;
};

/**
 * Replace editor content from wire string (same format as textarea + markdown links).
 */
export const $hydrateDiscussionWire = (text: string): void => {
	const root = $getRoot();
	root.clear();
	if (!text) {
		const p = $createParagraphNode();
		p.append($createTextNode(""));
		root.append(p);
		return;
	}
	const lines = text.split("\n");
	for (const line of lines) {
		const p = $createParagraphNode();
		appendLineSegmentsToParagraph(p, line);
		root.append(p);
	}
};

const appendLineSegmentsToParagraph = (
	p: ParagraphNode,
	line: string,
): void => {
	let i = 0;
	while (i < line.length) {
		if (line[i] === "[") {
			const closeLabel = line.indexOf("]", i + 1);
			if (closeLabel > i && line[closeLabel + 1] === "(") {
				const closeParen = line.indexOf(")", closeLabel + 2);
				if (closeParen > closeLabel) {
					const label = line.slice(i + 1, closeLabel);
					const href = line.slice(closeLabel + 2, closeParen);
					if (isAllowedLocalAppPath(href)) {
						const link = $createLinkNode(href);
						link.append($createTextNode(label));
						p.append(link);
						i = closeParen + 1;
						continue;
					}
				}
			}
		}
		const nextBracket = line.indexOf("[", i + 1);
		const end = nextBracket === -1 ? line.length : nextBracket;
		const chunk = line.slice(i, end);
		if (chunk) {
			p.append($createTextNode(chunk));
		}
		i = end;
	}
	if (p.getChildrenSize() === 0) {
		p.append($createTextNode(""));
	}
};
