import { readActiveOrgTenantId } from "./apiClient";
import { readChatWorkspaceScope } from "./chatWorkspaceScope";

/**
 * Which workspace tab (Personal vs Business) should appear active in the shell,
 * based on dashboard URL, chat scope, and last-selected org tenant id.
 */
export const resolveHeaderWorkspaceTab = (
	pathname: string,
): "personal" | "business" => {
	if (pathname.startsWith("/console/dashboard/business")) return "business";
	if (pathname.startsWith("/console/dashboard/personal")) return "personal";

	const chat = readChatWorkspaceScope();
	if (chat?.kind === "organization") return "business";
	if (chat?.kind === "personal") return "personal";

	if (readActiveOrgTenantId() != null) return "business";

	return "personal";
};
