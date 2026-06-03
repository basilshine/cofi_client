import type { ChatWorkspaceScope } from "../../../shared/lib/chatWorkspaceScope";

export type SelectSpaceOptions = {
	openExpenseId?: string | number;
};

export type ChatLogLocationState = {
	chatWorkspace?: ChatWorkspaceScope;
	openExpenseId?: string | number;
	openExpenseSpaceId?: string | number;
	selectSpaceId?: string | number;
	composerDraftText?: string;
};
