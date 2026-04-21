import { readChatWorkspaceScope } from "./chatWorkspaceScope";

/**
 * Legacy helper — console is personal-only; kept so callers still compile.
 */
export const resolveHeaderWorkspaceTab = (
	_pathname: string,
): "personal" | "business" => {
	const chat = readChatWorkspaceScope();
	if (chat?.kind === "organization") return "business";
	return "personal";
};
