import type { ChatWorkspaceScope } from "../../../shared/lib/chatWorkspaceScope";

export type SelectSpaceOptions = {
	openThreadExpenseId?: string | number;
	/** Focus manual draft line N (1-based) after opening the expense thread in the right panel. */
	openThreadDraftLine?: number;
	quickCapture?: "photo" | "voice";
	focusCaptureComposer?: boolean;
	focusMessageComposer?: boolean;
	/** Open the workspace expenses panel (right rail). */
	openExpensesPanel?: boolean;
};

export type ChatLogLocationState = {
	chatWorkspace?: ChatWorkspaceScope;
	openThreadExpenseId?: string | number;
	openThreadSpaceId?: string | number;
	openThreadDraftLine?: number;
	selectSpaceId?: string | number;
	quickCapture?: "photo" | "voice";
	focusCaptureComposer?: boolean;
	focusMessageComposer?: boolean;
	openExpensesPanel?: boolean;
};
