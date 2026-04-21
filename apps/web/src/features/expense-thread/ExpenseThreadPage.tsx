import { useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
	type ChatWorkspaceScope,
	isChatWorkspaceScope,
} from "../../shared/lib/chatWorkspaceScope";

/**
 * Legacy URL `/console/chat/thread?spaceId=&expenseId=` redirects into Chat with the
 * expense thread opened in the workspace Expenses panel (right rail).
 */
export const ExpenseThreadPage = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const [searchParams] = useSearchParams();

	useEffect(() => {
		const spaceId = searchParams.get("spaceId");
		const expenseId = searchParams.get("expenseId");
		const lineRaw = searchParams.get("line");
		const lineParsed =
			lineRaw != null ? Number.parseInt(lineRaw, 10) : Number.NaN;
		const openThreadDraftLine =
			Number.isFinite(lineParsed) && lineParsed >= 1 ? lineParsed : undefined;
		const st = location.state as { chatWorkspace?: unknown } | null;
		const fromLink =
			st?.chatWorkspace != null && isChatWorkspaceScope(st.chatWorkspace)
				? (st.chatWorkspace as ChatWorkspaceScope)
				: null;
		if (!expenseId) {
			navigate("/console/chat", {
				replace: true,
				state: fromLink ? { chatWorkspace: fromLink } : {},
			});
			return;
		}
		const threadState: {
			openThreadExpenseId: string;
			openThreadSpaceId?: string;
			openThreadDraftLine?: number;
			chatWorkspace?: ChatWorkspaceScope;
		} = {
			openThreadExpenseId: expenseId,
			...(spaceId != null ? { openThreadSpaceId: spaceId } : {}),
			...(openThreadDraftLine != null ? { openThreadDraftLine } : {}),
			...(fromLink ? { chatWorkspace: fromLink } : {}),
		};
		navigate("/console/chat", {
			replace: true,
			state: threadState,
		});
	}, [location.state, navigate, searchParams]);

	return (
		<p aria-live="polite" className="p-4 text-sm text-muted-foreground">
			Opening thread…
		</p>
	);
};
